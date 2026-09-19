import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
dotenv.config({ path: resolve(dirname(fileURLToPath(import.meta.url)), '../.env') });
import express from 'express';
import cors from 'cors';
import mssql from 'mssql';
import mysql from 'mysql2/promise';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import {
  isSafeIdent, backtick, STRICT_IDENT_RE, isValidColumnType, sqlDefaultLiteral,
  splitStatements, findForbiddenKeyword, csvField,
} from './sql-utils.js';

const app = express();
const port = Number(process.env.PORT || 3001);
const rowHeight = 24;

// === 环境变量配置 ===
const MYSQL_HOST = process.env.MYSQL_HOST || '127.0.0.1';
const MYSQL_PORT = Number(process.env.MYSQL_PORT) || 3306;
const MYSQL_USER = process.env.MYSQL_USER || 'root';
const MYSQL_PASS = process.env.MYSQL_PASS || '';
const MYSQL_DB   = process.env.MYSQL_DB || 'test';
const API_SECRET = process.env.API_SECRET || 'change-me';

// === CORS 白名单 ===
const ALLOWED_ORIGINS = [
  'https://wybnm.xyz',
  'https://www.wybnm.xyz',
  'https://wfbnm.xyz',
  'https://www.wfbnm.xyz',
  'http://localhost:5173',
  'http://localhost:5174',
];
app.use(cors({
  origin(origin, callback) {
    if (!origin || ALLOWED_ORIGINS.includes(origin)) {
      callback(null, true);
    } else {
      callback(null, false);
    }
  },
}));
app.use(express.json({ limit: '1mb' }));

// === 请求频率限制 ===
const rateLimitMap = new Map();
function rateLimitCheck(req) {
  const ip = req.ip || req.socket?.remoteAddress || 'unknown';
  const now = Date.now();
  const entry = rateLimitMap.get(ip) || { count: 0, reset: now + 60000 };
  if (now > entry.reset) { entry.count = 0; entry.reset = now + 60000; }
  entry.count++;
  rateLimitMap.set(ip, entry);
  return entry.count <= 120;
}

// 登录接口独立限流（防爆破）
const loginRateMap = new Map();
function loginRateCheck(req) {
  const ip = req.ip || req.socket?.remoteAddress || 'unknown';
  const now = Date.now();
  const entry = loginRateMap.get(ip) || { count: 0, reset: now + 60000 };
  if (now > entry.reset) { entry.count = 0; entry.reset = now + 60000; }
  entry.count++;
  loginRateMap.set(ip, entry);
  return entry.count <= 10;
}

// === HMAC Token 工具 ===
const TOKEN_TTL = 30 * 60 * 1000; // 30 分钟

function signToken(payload) {
  const json = JSON.stringify(payload);
  const sig = crypto.createHmac('sha256', API_SECRET).update(json).digest('base64url');
  return Buffer.from(JSON.stringify({ ...payload, sig })).toString('base64url');
}

function verifyToken(token) {
  try {
    const raw = JSON.parse(Buffer.from(token, 'base64url').toString());
    if (!raw.sig || !raw.exp) return null;
    if (Date.now() > raw.exp) return null;
    const expected = crypto.createHmac('sha256', API_SECRET).update(JSON.stringify({ userId: raw.userId, username: raw.username, exp: raw.exp })).digest('base64url');
    if (expected !== raw.sig) return null;
    return { userId: raw.userId, username: raw.username };
  } catch { return null; }
}

// === Auth 中间件 ===
function authMiddleware(req, res, next) {
  if (!rateLimitCheck(req)) {
    return res.status(429).json({ message: '请求过于频繁，请稍后再试。' });
  }
  const token = req.headers.authorization?.replace('Bearer ', '');
  const user = verifyToken(token || '');
  if (!user) {
    return res.status(401).json({ message: '未授权访问。' });
  }
  req.user = user;
  next();
}

// 所有 MySQL API 路径加鉴权
app.use('/api/mysql', authMiddleware);

// === 查询缓存 ===
const queryCache = new Map();
const CACHE_TTL = 5000;

function getCached(key) {
  const entry = queryCache.get(key);
  if (entry && Date.now() - entry.time < CACHE_TTL) return entry.data;
  return undefined;
}
function setCached(key, data) {
  queryCache.set(key, { data, time: Date.now() });
}
function clearCache(prefix) {
  if (prefix) {
    for (const k of queryCache.keys()) if (k.startsWith(prefix)) queryCache.delete(k);
  } else {
    queryCache.clear();
  }
}
// 清空指定数据库的缓存（缓存键以 "库名:" 开头）
function clearDbCache(dbName) {
  clearCache(`${dbName}:`);
}

// === MySQL 连接池 — 按库缓存，支持多个客户端/终端并发使用不同数据库 ===
// 每个请求通过 X-Database 头指定目标库，从缓存取对应连接池，
// 不再有全局 "当前数据库"，各端互不干扰。
const dbCredentials = new Map(); // database -> { user, password }（切换弹窗提供的自定义凭据）
const poolCache = new Map();     // `${database}::${user}` -> { pool, db, lastUsed }

function resolveCreds(database) {
  const c = dbCredentials.get(database);
  return { user: c?.user || MYSQL_USER, password: c?.password || MYSQL_PASS };
}

function getPool(database) {
  const { user, password } = resolveCreds(database);
  const key = `${database}::${user}`;
  let entry = poolCache.get(key);
  if (!entry) {
    entry = {
      db: database,
      lastUsed: Date.now(),
      pool: mysql.createPool({
        host: MYSQL_HOST, port: MYSQL_PORT, database,
        user, password,
        charset: 'utf8mb4', waitForConnections: true, connectionLimit: 4,
        queueLimit: 0, connectTimeout: 15000,
      }),
    };
    poolCache.set(key, entry);
  }
  entry.lastUsed = Date.now();
  return entry.pool;
}

function dropPoolsForDb(database) {
  for (const [key, entry] of poolCache) {
    if (entry.db === database) {
      poolCache.delete(key);
      entry.pool.end().catch(() => {});
    }
  }
}

// 定时清理：过期限流计数、过期缓存、空闲超过 15 分钟的连接池
setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of rateLimitMap) if (now > entry.reset) rateLimitMap.delete(ip);
  for (const [ip, entry] of loginRateMap) if (now > entry.reset) loginRateMap.delete(ip);
  for (const [k, entry] of queryCache) if (now - entry.time >= CACHE_TTL) queryCache.delete(k);
  for (const [key, entry] of poolCache) {
    if (now - entry.lastUsed > 15 * 60 * 1000) {
      poolCache.delete(key);
      entry.pool.end().catch(() => {});
    }
  }
}, 5 * 60 * 1000).unref();

// 每个请求解析目标数据库（X-Database 头，未指定时用默认库）
app.use('/api/mysql', (req, res, next) => {
  const db = String(req.headers['x-database'] || MYSQL_DB);
  if (!isSafeIdent(db)) return res.status(400).json({ message: `数据库名 "${db}" 不合法。` });
  req.dbName = db;
  req.dbPool = getPool(db);
  next();
});

// === 审计日志（集中写入默认库的 audit_log 表，跨库统一记录） ===
let auditEnsured = false;
async function ensureAuditTable() {
  if (auditEnsured) return true;
  try {
    await getPool(MYSQL_DB).query(`CREATE TABLE IF NOT EXISTS \`audit_log\` (
      id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      username VARCHAR(64) NOT NULL DEFAULT '',
      action VARCHAR(32) NOT NULL DEFAULT '',
      target VARCHAR(191) NOT NULL DEFAULT '',
      detail VARCHAR(1024) NOT NULL DEFAULT '',
      ip VARCHAR(64) NOT NULL DEFAULT '',
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      KEY idx_created (created_at),
      KEY idx_action (action)
    ) CHARSET=utf8mb4`);
    auditEnsured = true;
    return true;
  } catch { return false; }
}

async function writeAudit(req, action, target = '', detail = '') {
  try {
    if (!(await ensureAuditTable())) return;
    await getPool(MYSQL_DB).query(
      'INSERT INTO `audit_log` (username, action, target, detail, ip) VALUES (?, ?, ?, ?, ?)',
      [req.user?.username || 'unknown', action, String(target || '').slice(0, 190), String(detail || '').slice(0, 1000), String(req.ip || '').slice(0, 60)]
    );
  } catch { /* 审计失败不阻断主流程 */ }
}

const safeId = (name) => `[${String(name).replace(/]/g, '')}]`;

const escapeXml = (value = '') => String(value)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&apos;');

const buildConnectionConfig = ({ server, port, database, username, password, instanceName }) => ({
  server, port: Number(port) || 1433, database, user: username, password,
  options: { encrypt: false, trustServerCertificate: true, ...(instanceName ? { instanceName } : {}) },
  pool: { max: 4, min: 0, idleTimeoutMillis: 30000 },
  connectionTimeout: 15000, requestTimeout: 30000,
});

const fetchSchema = async (pool) => {
  const tablesResult = await pool.request().query(`
    SELECT t.TABLE_SCHEMA, t.TABLE_NAME, c.COLUMN_NAME, c.DATA_TYPE,
           c.IS_NULLABLE, c.CHARACTER_MAXIMUM_LENGTH, c.ORDINAL_POSITION
    FROM INFORMATION_SCHEMA.TABLES AS t JOIN INFORMATION_SCHEMA.COLUMNS AS c
      ON t.TABLE_SCHEMA = c.TABLE_SCHEMA AND t.TABLE_NAME = c.TABLE_NAME
    WHERE t.TABLE_TYPE = 'BASE TABLE'
    ORDER BY t.TABLE_SCHEMA, t.TABLE_NAME, c.ORDINAL_POSITION;
  `);
  const relationsResult = await pool.request().query(`
    SELECT fk.name AS fk_name, sch1.name AS from_schema, tab1.name AS from_table,
           col1.name AS from_column, sch2.name AS to_schema, tab2.name AS to_table,
           col2.name AS to_column
    FROM sys.foreign_keys AS fk INNER JOIN sys.foreign_key_columns AS fkc
      ON fk.object_id = fkc.constraint_object_id
    INNER JOIN sys.tables AS tab1 ON fkc.parent_object_id = tab1.object_id
    INNER JOIN sys.schemas AS sch1 ON tab1.schema_id = sch1.schema_id
    INNER JOIN sys.columns AS col1 ON fkc.parent_object_id = col1.object_id
      AND fkc.parent_column_id = col1.column_id
    INNER JOIN sys.tables AS tab2 ON fkc.referenced_object_id = tab2.object_id
    INNER JOIN sys.schemas AS sch2 ON tab2.schema_id = sch2.schema_id
    INNER JOIN sys.columns AS col2 ON fkc.referenced_object_id = col2.object_id
      AND fkc.referenced_column_id = col2.column_id
    ORDER BY sch1.name, tab1.name, fk.name;
  `);
  const tableMap = new Map();
  for (const row of tablesResult.recordset) {
    const key = `${row.TABLE_SCHEMA}.${row.TABLE_NAME}`;
    if (!tableMap.has(key)) tableMap.set(key, { schema: row.TABLE_SCHEMA, name: row.TABLE_NAME, columns: [] });
    tableMap.get(key).columns.push({
      name: row.COLUMN_NAME,
      type: row.CHARACTER_MAXIMUM_LENGTH && row.CHARACTER_MAXIMUM_LENGTH > 0
        ? `${row.DATA_TYPE}(${row.CHARACTER_MAXIMUM_LENGTH})` : row.DATA_TYPE,
      nullable: row.IS_NULLABLE === 'YES',
    });
  }
  return { tables: Array.from(tableMap.values()), relations: relationsResult.recordset };
};

function findJoinPath(tables, relations) {
  const key = (s, t) => `${s}.${t}`;
  const selectedKeys = new Set(tables.map((t) => key(t.schema, t.name)));
  const relevant = relations.filter((r) => selectedKeys.has(key(r.from_schema, r.from_table))
    && selectedKeys.has(key(r.to_schema, r.to_table)));
  if (relevant.length === 0) return { error: '未在所选表之间检测到外键关系。' };
  const degree = {};
  for (const t of tables) degree[key(t.schema, t.name)] = 0;
  for (const r of relevant) {
    degree[key(r.from_schema, r.from_table)]++;
    degree[key(r.to_schema, r.to_table)]++;
  }
  let hubKey = null, maxDeg = -1;
  for (const t of tables) {
    const k = key(t.schema, t.name);
    if (degree[k] > maxDeg) { maxDeg = degree[k]; hubKey = k; }
  }
  const [hubSchema, hubName] = hubKey.split('.');
  const hubFKMap = {};
  for (const r of relevant) {
    const fromK = key(r.from_schema, r.from_table), toK = key(r.to_schema, r.to_table);
    if (fromK === hubKey) hubFKMap[toK] = { dir: 'from', ...r };
    if (toK === hubKey) hubFKMap[fromK] = { dir: 'to', ...r };
  }
  for (const t of tables) {
    const k = key(t.schema, t.name);
    if (k !== hubKey && !hubFKMap[k]) return { error: `表 ${k} 与中心表 ${hubKey} 之间没有外键关系。` };
  }
  const joins = [];
  for (const t of tables) {
    const k = key(t.schema, t.name);
    if (k === hubKey) continue;
    const rel = hubFKMap[k];
    const cond = `${safeId(rel.from_schema)}.${safeId(rel.from_table)}.${safeId(rel.from_column)} = ${safeId(rel.to_schema)}.${safeId(rel.to_table)}.${safeId(rel.to_column)}`;
    if (rel.dir === 'from') joins.push({ targetSchema: rel.to_schema, targetTable: rel.to_table, joinCondition: cond });
    else joins.push({ targetSchema: rel.from_schema, targetTable: rel.from_table, joinCondition: cond });
  }
  return {
    hubSchema, hubName, joins,
    relevantRelations: relevant.map((r) => ({
      from: { schema: r.from_schema, table: r.from_table, column: r.from_column },
      to: { schema: r.to_schema, table: r.to_table, column: r.to_column }, fkName: r.fk_name,
    })),
  };
}

const layoutTables = (tables) => {
  if (tables.length === 0) return { nodes: [], width: 1200, height: 600 };
  const columns = Math.min(3, Math.max(1, Math.ceil(Math.sqrt(tables.length))));
  const cardWidth = 320, headerHeight = 48, xGap = 40, yGap = 48, margin = 40;
  const rows = [];
  const baseNodes = tables.map((table, index) => {
    const column = index % columns, row = Math.floor(index / columns);
    const visibleColumns = table.columns, contentRows = visibleColumns.length + 1;
    const bottomPadding = 72, height = headerHeight + contentRows * rowHeight + bottomPadding;
    if (!rows[row]) rows[row] = [];
    rows[row].push(height);
    return { ...table, visibleColumns, column, row, width: cardWidth, height };
  });
  const rowOffsets = [];
  let currentY = margin;
  for (let ri = 0; ri < rows.length; ri += 1) {
    rowOffsets[ri] = currentY;
    currentY += Math.max(...rows[ri]) + yGap;
  }
  const nodes = baseNodes.map((node) => ({ ...node, x: margin + node.column * (cardWidth + xGap), y: rowOffsets[node.row] }));
  const maxHeight = Math.max(...nodes.map((n) => n.y + n.height));
  return { nodes, width: margin * 2 + columns * cardWidth + (columns - 1) * xGap, height: Math.max(600, maxHeight + margin), columns };
};

const buildDiagramSvg = (schemaName, schema) => {
  const { nodes, width, height } = layoutTables(schema.tables);
  const headerOffset = 24;
  const offsetNodes = nodes.map((n) => ({ ...n, y: n.y + headerOffset }));
  const centerMap = new Map(offsetNodes.map((n) => [`${n.schema}.${n.name}`, n]));
  const relationLines = schema.relations.map((rel) => {
    const from = centerMap.get(`${rel.from_schema}.${rel.from_table}`);
    const to = centerMap.get(`${rel.to_schema}.${rel.to_table}`);
    if (!from || !to) return '';
    return `<path d="M ${from.x + from.width} ${from.y + from.height / 2} C ${from.x + from.width + 30} ${from.y + from.height / 2}, ${to.x - 30} ${to.y + to.height / 2}, ${to.x} ${to.y + to.height / 2}" class="relation" marker-end="url(#arrow)" />`;
  }).join('');
  const cards = nodes.map((node) => {
    const on = { ...node, y: node.y + headerOffset };
    const columnLines = on.visibleColumns.map((col, i) => {
      const label = escapeXml(`${col.name} : ${col.type}${col.nullable ? ' ?' : ''}`);
      return `<text x="16" y="${76 + i * rowHeight}" class="column">${label.length > 28 ? label.slice(0, 27) + '…' : label}</text>`;
    }).join('');
    return `<g transform="translate(${on.x}, ${on.y})"><rect x="0" y="0" width="${on.width}" height="${on.height}" rx="18" class="card" /><rect x="0" y="0" width="${on.width}" height="48" rx="18" class="card__header" /><text x="16" y="30" class="table-name">${escapeXml(on.schema)}.${escapeXml(on.name)}</text><text x="16" y="52" class="table-meta">${on.columns.length} columns</text>${columnLines}</g>`;
  }).join('');
  const empty = nodes.length === 0
    ? `<g transform="translate(${width / 2 - 170}, ${headerOffset + height / 2 - 44})"><rect width="340" height="88" rx="18" class="empty" /><text x="170" y="40" text-anchor="middle" class="empty__title">未找到可视化表结构</text><text x="170" y="62" text-anchor="middle" class="empty__desc">当前数据库里没有可展示的基础表</text></g>` : '';
  const svgHeight = height + headerOffset + 24;
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${svgHeight}" width="${width}" height="${svgHeight}">
  <defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#f7fbff"/><stop offset="100%" stop-color="#fff"/></linearGradient>
  <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="#4c7bd9"/></marker>
  <style>.bg{fill:url(#bg)}.card{fill:#fff;stroke:#d7e3f1;stroke-width:1.2;filter:drop-shadow(0 12px 24px rgba(18,38,63,.08))}.card__header{fill:#ebf2ff}.table-name{font:700 15px Segoe UI,sans-serif;fill:#12304b}.table-meta{font:400 12px Segoe UI,sans-serif;fill:#5d7488}.column{font:400 11px Segoe UI,sans-serif;fill:#30485f}.relation{fill:none;stroke:#4c7bd9;stroke-width:1.8;opacity:.65}.empty{fill:#fff;stroke:#dbe7f4;stroke-width:1.2}.empty__title{font:700 16px Segoe UI,sans-serif;fill:#17324d}.empty__desc{font:400 13px Segoe UI,sans-serif;fill:#5f6d7a}</style></defs>
  <rect class="bg" x="0" y="0" width="100%" height="100%"/>${cards}${relationLines}${empty}
</svg>`;
};

app.get('/health', (_req, res) => { res.json({ ok: true }); });

app.post('/api/sqlserver/diagram', async (req, res) => {
  const { server, port, database, username, password, instanceName } = req.body || {};
  if (!server || !database || !username || !password) return res.status(400).json({ message: '请提供 server、database、username 和 password。' });
  const config = buildConnectionConfig({ server, port, database, username, password, instanceName });
  let pool;
  try {
    pool = await new mssql.ConnectionPool(config).connect();
    const schema = await fetchSchema(pool);
    res.setHeader('Content-Type', 'image/svg+xml; charset=utf-8');
    res.send(buildDiagramSvg(database, schema));
  } catch (error) {
    res.status(500).json({ message: `生成数据库结构图失败：${error instanceof Error ? error.message : '数据库连接失败'}` });
  } finally { if (pool) await pool.close().catch(() => {}); }
});

app.post('/api/sqlserver/tables-info', async (req, res) => {
  const { server, port, database, username, password, instanceName } = req.body || {};
  if (!server || !database || !username || !password) return res.status(400).json({ message: '请提供 server、database、username 和 password。' });
  let pool;
  try {
    pool = await new mssql.ConnectionPool(buildConnectionConfig({ server, port, database, username, password, instanceName })).connect();
    res.json({ tables: (await fetchSchema(pool)).tables });
  } catch (error) {
    res.status(500).json({ message: `获取表信息失败：${error instanceof Error ? error.message : '数据库连接失败'}` });
  } finally { if (pool) await pool.close().catch(() => {}); }
});

app.post('/api/sqlserver/chart-data', async (req, res) => {
  const { server, port, database, username, password, instanceName, tableSchema, tableName, xColumn, yColumn, aggregation } = req.body || {};
  if (!server || !database || !username || !password || !tableSchema || !tableName || !xColumn || !aggregation) return res.status(400).json({ message: '缺少必要参数。' });
  const validAggs = ['COUNT', 'SUM', 'AVG', 'NONE'];
  if (!validAggs.includes(aggregation)) return res.status(400).json({ message: `aggregation 必须是 ${validAggs.join('、')} 之一。` });
  if (aggregation !== 'COUNT' && !yColumn) return res.status(400).json({ message: '非 COUNT 聚合需要提供 yColumn。' });
  let pool;
  try {
    pool = await new mssql.ConnectionPool(buildConnectionConfig({ server, port, database, username, password, instanceName })).connect();
    const colCheck = await pool.request().input('schema', mssql.NVarChar, tableSchema).input('table', mssql.NVarChar, tableName).query(`SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @schema AND TABLE_NAME = @table`);
    const validCols = new Set(colCheck.recordset.map((r) => r.COLUMN_NAME));
    if (validCols.size === 0) return res.status(400).json({ message: `表 ${tableSchema}.${tableName} 不存在或无列。` });
    if (!validCols.has(xColumn)) return res.status(400).json({ message: `列 ${xColumn} 不存在。` });
    if (aggregation !== 'COUNT' && !validCols.has(yColumn)) return res.status(400).json({ message: `列 ${yColumn} 不存在。` });
    const S = safeId, sT = S(tableName), sS = S(tableSchema), sX = S(xColumn), sY = aggregation !== 'COUNT' ? S(yColumn) : null;
    let query;
    if (aggregation === 'COUNT') query = `SELECT ${sX} AS label, COUNT(*) AS value FROM ${sS}.${sT} GROUP BY ${sX} ORDER BY value DESC`;
    else if (aggregation === 'SUM') query = `SELECT ${sX} AS label, SUM(${sY}) AS value FROM ${sS}.${sT} GROUP BY ${sX} ORDER BY value DESC`;
    else if (aggregation === 'AVG') query = `SELECT ${sX} AS label, AVG(CAST(${sY} AS FLOAT)) AS value FROM ${sS}.${sT} GROUP BY ${sX} ORDER BY value DESC`;
    else query = `SELECT TOP 500 ${sX} AS label, ${sY} AS value FROM ${sS}.${sT} ORDER BY ${sX}`;
    const result = await pool.request().query(query);
    const labels = [], values = [];
    for (const row of result.recordset) { labels.push(String(row.label ?? '')); values.push(Number(row.value) || 0); }
    res.json({ labels, values, xColumn, yColumn: aggregation === 'COUNT' ? 'COUNT(*)' : yColumn, aggregation });
  } catch (error) {
    res.status(500).json({ message: `查询图表数据失败：${error instanceof Error ? error.message : '查询失败'}` });
  } finally { if (pool) await pool.close().catch(() => {}); }
});

async function buildJoinQuery(pool, hubSchema, hubName, xCol, yCol, aggregation, joins) {
  const allT = [{ schema: hubSchema, name: hubName }, ...joins.map((j) => ({ schema: j.targetSchema, name: j.targetTable }))];
  for (const t of allT) {
    const check = await pool.request().input('schema', mssql.NVarChar, t.schema).input('table', mssql.NVarChar, t.name).query(`SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @schema AND TABLE_NAME = @table`);
    const cols = new Set(check.recordset.map((r) => r.COLUMN_NAME));
    if (cols.size === 0) throw new Error(`表 ${t.schema}.${t.name} 不存在或无列。`);
    if (xCol.table === t.name && !cols.has(xCol.name)) throw new Error(`列 ${xCol.qualified} 不存在。`);
    if (yCol && yCol.table === t.name && !cols.has(yCol.name)) throw new Error(`列 ${yCol.qualified} 不存在。`);
  }
  const hRef = `${safeId(hubSchema)}.${safeId(hubName)}`;
  const jClauses = joins.map((j) => `LEFT JOIN ${safeId(j.targetSchema)}.${safeId(j.targetTable)} ON ${j.joinCondition}`).join('\n');
  const sX = `${safeId(xCol.tableSchema || hubSchema)}.${safeId(xCol.table)}.${safeId(xCol.name)}`;
  const sY = yCol ? `${safeId(yCol.tableSchema || hubSchema)}.${safeId(yCol.table)}.${safeId(yCol.name)}` : null;
  if (aggregation === 'COUNT') return `SELECT ${sX} AS label, COUNT(*) AS value FROM ${hRef}\n${jClauses}\nGROUP BY ${sX} ORDER BY value DESC`;
  if (aggregation === 'SUM') return `SELECT ${sX} AS label, SUM(${sY}) AS value FROM ${hRef}\n${jClauses}\nGROUP BY ${sX} ORDER BY value DESC`;
  if (aggregation === 'AVG') return `SELECT ${sX} AS label, AVG(CAST(${sY} AS FLOAT)) AS value FROM ${hRef}\n${jClauses}\nGROUP BY ${sX} ORDER BY value DESC`;
  return `SELECT TOP 500 ${sX} AS label, ${sY} AS value FROM ${hRef}\n${jClauses}\nORDER BY ${sX}`;
}

app.post('/api/sqlserver/join-relations', async (req, res) => {
  const { server, port, database, username, password, instanceName, tables } = req.body || {};
  if (!server || !database || !username || !password || !Array.isArray(tables) || tables.length < 2) return res.status(400).json({ message: '请提供连接信息并选择至少 2 张表。' });
  let pool;
  try {
    pool = await new mssql.ConnectionPool(buildConnectionConfig({ server, port, database, username, password, instanceName })).connect();
    const schema = await fetchSchema(pool);
    const result = findJoinPath(tables, schema.relations);
    if (result.error) return res.status(400).json({ message: result.error });
    const hubFull = schema.tables.find((t) => t.schema === result.hubSchema && t.name === result.hubName);
    const cols = [];
    const addCols = (tbl) => { if (!tbl) return; for (const col of tbl.columns) cols.push({ qualified: `${tbl.name}.${col.name}`, name: col.name, table: tbl.name, tableSchema: tbl.schema, type: col.type }); };
    addCols(hubFull);
    for (const j of result.joins) { const tbl = schema.tables.find((t) => t.schema === j.targetSchema && t.name === j.targetTable); addCols(tbl); }
    res.json({ relations: result.relevantRelations, hubTable: { schema: result.hubSchema, name: result.hubName }, columns: cols });
  } catch (error) {
    res.status(500).json({ message: `检测表关系失败：${error instanceof Error ? error.message : '查询失败'}` });
  } finally { if (pool) await pool.close().catch(() => {}); }
});

app.post('/api/sqlserver/join-data', async (req, res) => {
  const { server, port, database, username, password, instanceName, tables, hubTable, xColumn, yColumn, aggregation } = req.body || {};
  if (!server || !database || !username || !password || !Array.isArray(tables) || tables.length < 2 || !hubTable || !xColumn || !aggregation) return res.status(400).json({ message: '缺少必要参数。' });
  const validAggs = ['COUNT', 'SUM', 'AVG', 'NONE'];
  if (!validAggs.includes(aggregation)) return res.status(400).json({ message: `aggregation 必须是 ${validAggs.join('、')} 之一。` });
  if (aggregation !== 'COUNT' && !yColumn) return res.status(400).json({ message: '非 COUNT 聚合需要提供 yColumn。' });
  let pool;
  try {
    pool = await new mssql.ConnectionPool(buildConnectionConfig({ server, port, database, username, password, instanceName })).connect();
    const schema = await fetchSchema(pool);
    const pathResult = findJoinPath(tables, schema.relations);
    if (pathResult.error) return res.status(400).json({ message: pathResult.error });
    const query = await buildJoinQuery(pool, hubTable.schema, hubTable.name, xColumn, yColumn, aggregation, pathResult.joins);
    const result = await pool.request().query(query);
    const labels = [], values = [];
    for (const row of result.recordset) { labels.push(String(row.label ?? '')); values.push(Number(row.value) || 0); }
    const joinDesc = pathResult.relevantRelations.map((r) => `${r.from.schema}.${r.from.table}.${r.from.column} → ${r.to.schema}.${r.to.table}.${r.to.column}`).join(', ');
    res.json({ labels, values, xColumn: xColumn.qualified || xColumn.name, yColumn: aggregation === 'COUNT' ? 'COUNT(*)' : (yColumn.qualified || yColumn.name), aggregation, joinDescription: joinDesc });
  } catch (error) {
    res.status(500).json({ message: `查询 JOIN 数据失败：${error instanceof Error ? error.message : '查询失败'}` });
  } finally { if (pool) await pool.close().catch(() => {}); }
});

app.post('/api/sqlserver/list-databases', async (req, res) => {
  const { server, port, username, password, instanceName } = req.body || {};
  if (!server || !username || !password) return res.status(400).json({ message: '请提供服务器地址、用户名和密码。' });
  let pool;
  try {
    pool = await new mssql.ConnectionPool(buildConnectionConfig({ server, port, database: 'master', username, password, instanceName })).connect();
    const result = await pool.request().query(`SELECT name FROM sys.databases WHERE database_id > 4 ORDER BY name`);
    res.json({ databases: result.recordset.map((r) => r.name) });
  } catch (error) {
    res.status(500).json({ message: `连接服务器失败：${error instanceof Error ? error.message : '连接失败'}` });
  } finally { if (pool) await pool.close().catch(() => {}); }
});

// ==================== 认证 API（不受 authMiddleware 保护）====================

app.post('/api/auth/login', async (req, res) => {
  if (!loginRateCheck(req)) {
    return res.status(429).json({ message: '尝试次数过多，请一分钟后再试。' });
  }
  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ message: '请输入账号和密码。' });
  }
  try {
    const [rows] = await getPool(MYSQL_DB).query('SELECT id, name, password, role FROM users WHERE name = ?', [username]);
    if (rows.length === 0) {
      return res.status(401).json({ message: '账号或密码错误。' });
    }
    const user = rows[0];
    const ok = await bcrypt.compare(password, user.password);
    if (!ok) {
      return res.status(401).json({ message: '账号或密码错误。' });
    }
    const token = signToken({
      userId: user.id,
      username: user.name,
      exp: Date.now() + TOKEN_TTL,
    });
    res.json({ token, user: { id: user.id, name: user.name, role: user.role } });
  } catch (e) {
    res.status(500).json({ message: `登录失败：${e.message}` });
  }
});

// 验证 token 是否有效
app.get('/api/auth/me', async (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  const user = verifyToken(token || '');
  if (!user) return res.status(401).json({ message: '登录已过期。' });
  res.json({ user });
});

// 滑动续期：token 仍有效时签发新 token，前端在临近过期时自动调用
app.post('/api/auth/refresh', (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  const user = verifyToken(token || '');
  if (!user) return res.status(401).json({ message: '登录已过期，请重新登录。' });
  res.json({ token: signToken({ userId: user.userId, username: user.username, exp: Date.now() + TOKEN_TTL }) });
});

// ==================== MySQL API (全部受 authMiddleware 保护) ====================

app.get('/api/mysql/databases', async (_req, res) => {
  try {
    const [rows] = await getPool(MYSQL_DB).query('SHOW DATABASES');
    const dbs = rows.map((r) => Object.values(r)[0])
      .filter((db) => !['information_schema','performance_schema','mysql','sys'].includes(db));
    res.json({ databases: dbs, current: MYSQL_DB });
  } catch (e) { res.status(500).json({ message: `获取数据库列表失败：${e.message}` }); }
});

// 校验目标库连通性并登记自定义凭据；实际连接由每个请求的 X-Database 头决定
app.post('/api/mysql/use-database', async (req, res) => {
  const { database, user, password } = req.body || {};
  if (!isSafeIdent(database)) return res.status(400).json({ message: `数据库名 "${database}" 不合法。` });
  const creds = resolveCreds(database);
  let testPool;
  try {
    testPool = mysql.createPool({
      host: MYSQL_HOST, port: MYSQL_PORT, database,
      user: user || creds.user, password: password || creds.password,
      charset: 'utf8mb4', connectionLimit: 1, connectTimeout: 8000,
    });
    await testPool.query('SELECT 1');
    if (user || password) {
      dbCredentials.set(database, { user: user || creds.user, password: password || creds.password });
      dropPoolsForDb(database);
    }
    await writeAudit(req, 'SWITCH_DATABASE', database);
    res.json({ message: `数据库 ${database} 可用。`, current: database });
  } catch (e) {
    res.status(500).json({ message: `切换数据库失败：${e.message}` });
  } finally { if (testPool) await testPool.end().catch(() => {}); }
});

// 当前数据库的元信息（版本号等）
app.get('/api/mysql/meta', async (req, res) => {
  try {
    const [[row]] = await req.dbPool.query('SELECT VERSION() AS version');
    res.json({ version: row.version, database: req.dbName });
  } catch (e) { res.status(500).json({ message: `获取元信息失败：${e.message}` }); }
});

// ==================== 数据治理 API ====================

const GOV_STRING_TYPES = ['char','varchar','text','tinytext','mediumtext','longtext','enum','set'];
const GOV_ISSUE_ORDER = { error: 0, warn: 1, info: 2 };

// 数据质量检测：主键、空值率、空字符串、唯一值、整行重复
app.get('/api/mysql/governance/quality/:name', async (req, res) => {
  const tName = backtick(req.params.name);
  if (!tName) return res.status(400).json({ message: `表名 "${req.params.name}" 不合法。` });
  try {
    const [cols] = await req.dbPool.query(`DESCRIBE ${tName}`);
    if (cols.length === 0) return res.status(400).json({ message: '该表没有任何字段。' });
    const hasPK = cols.some((c) => c.Key === 'PRI');
    const [[{ total }]] = await req.dbPool.query(`SELECT COUNT(*) AS total FROM ${tName}`);
    const totalRows = Number(total);
    const issues = [];
    let score = 100;

    if (totalRows === 0) issues.push({ level: 'info', message: '表当前没有任何数据。' });
    if (!hasPK) {
      issues.push({ level: 'error', message: '表没有主键，无法唯一定位行记录，不利于数据同步与去重。' });
      score -= 20;
    }

    const SKIP_SCAN_ROWS = 500000;
    let colStats;
    if (totalRows > 0 && totalRows <= SKIP_SCAN_ROWS) {
      const parts = [];
      for (const c of cols) {
        const b = backtick(c.Field);
        parts.push(`SUM(${b} IS NULL) AS ${backtick('null_' + c.Field)}`);
        if (GOV_STRING_TYPES.some((t) => c.Type.toLowerCase().includes(t))) {
          parts.push(`SUM(${b} = '') AS ${backtick('empty_' + c.Field)}`);
        }
        parts.push(`COUNT(DISTINCT ${b}) AS ${backtick('dist_' + c.Field)}`);
      }
      const [[agg]] = await req.dbPool.query(`SELECT ${parts.join(', ')} FROM ${tName}`);
      colStats = cols.map((c) => {
        const isStr = GOV_STRING_TYPES.some((t) => c.Type.toLowerCase().includes(t));
        const nullCount = Number(agg[`null_${c.Field}`] || 0);
        const emptyCount = isStr ? Number(agg[`empty_${c.Field}`] || 0) : null;
        const distinct = Number(agg[`dist_${c.Field}`] || 0);
        const nullRatio = totalRows > 0 ? nullCount / totalRows : 0;
        if (totalRows > 0 && nullRatio > 0.5 && c.Null === 'YES') {
          issues.push({ level: 'warn', message: `字段 ${c.Field} 的空值率 ${(nullRatio * 100).toFixed(1)}%，请确认该字段是否仍有业务意义。` });
          score -= 10;
        }
        if (emptyCount > 0) {
          issues.push({ level: 'info', message: `字段 ${c.Field} 存在 ${emptyCount} 个空字符串值。` });
          score -= 3;
        }
        return { name: c.Field, type: c.Type, nullable: c.Null === 'YES', key: c.Key || null, nullCount, nullRatio, emptyCount, distinct };
      });
    } else {
      issues.push({ level: 'info', message: `表行数超过 ${SKIP_SCAN_ROWS}，已跳过逐字段扫描，仅检测结构性问题。` });
      colStats = cols.map((c) => ({ name: c.Field, type: c.Type, nullable: c.Null === 'YES', key: c.Key || null, nullCount: null, nullRatio: null, emptyCount: null, distinct: null }));
    }

    // 整行重复检测（仅中小表）
    if (totalRows > 0 && totalRows <= 100000) {
      const allCols = cols.map((c) => backtick(c.Field)).join(', ');
      const [[{ n }]] = await req.dbPool.query(`SELECT COUNT(*) AS n FROM (SELECT 1 FROM ${tName} GROUP BY ${allCols} HAVING COUNT(*) > 1 LIMIT 50) x`);
      const dupGroups = Number(n || 0);
      if (dupGroups > 0) {
        issues.push({ level: 'error', message: `发现 ${dupGroups} 组完全重复的记录。` });
        score -= 15;
      }
    }

    score = Math.max(0, Math.min(100, score));
    issues.sort((a, b) => GOV_ISSUE_ORDER[a.level] - GOV_ISSUE_ORDER[b.level]);
    res.json({ table: req.params.name, totalRows, hasPK, score, issues, columns: colStats });
  } catch (e) { res.status(500).json({ message: `质量检测失败：${e.message}` }); }
});

// 敏感字段识别：字段命名规则 + 内容采样（各字符串字段采样 500 行）
const SENSITIVE_NAME_RULES = [
  { re: /pass|pwd|secret|token|credential/i, category: '凭证口令', level: 'high' },
  { re: /idcard|id_card|identity|sfz/i, category: '身份证号', level: 'high' },
  { re: /bank|card_no|cardno/i, category: '银行卡号', level: 'high' },
  { re: /phone|mobile|tel/i, category: '手机号', level: 'high' },
  { re: /email|mail/i, category: '邮箱', level: 'medium' },
  { re: /addr|address/i, category: '住址信息', level: 'medium' },
  { re: /birth|birthday/i, category: '出生日期', level: 'medium' },
  { re: /(^|_)name$/i, category: '姓名信息', level: 'low' },
];
const SENSITIVE_VALUE_RULES = [
  { re: /1[3-9]\d{9}/, category: '手机号', level: 'high' },
  { re: /[\w.+-]+@[\w-]+\.[\w.-]+/, category: '邮箱', level: 'medium' },
  { re: /\d{17}[\dXx]/, category: '身份证号', level: 'high' },
];

app.get('/api/mysql/governance/sensitive/:name', async (req, res) => {
  const tName = backtick(req.params.name);
  if (!tName) return res.status(400).json({ message: `表名 "${req.params.name}" 不合法。` });
  try {
    const [cols] = await req.dbPool.query(`DESCRIBE ${tName}`);
    const findings = [];
    const seen = new Set();
    const add = (f) => {
      const k = `${f.column}|${f.category}`;
      if (!seen.has(k)) { seen.add(k); findings.push(f); }
    };
    for (const c of cols) {
      for (const r of SENSITIVE_NAME_RULES) {
        if (r.re.test(c.Field)) add({ column: c.Field, type: c.Type, category: r.category, level: r.level, source: '字段命名', hits: null });
      }
    }
    const stringCols = cols.filter((c) => GOV_STRING_TYPES.some((t) => c.Type.toLowerCase().includes(t)));
    for (const c of stringCols.slice(0, 8)) {
      const b = backtick(c.Field);
      const [rows] = await req.dbPool.query(`SELECT ${b} AS v FROM ${tName} WHERE ${b} IS NOT NULL AND ${b} != '' LIMIT 500`);
      for (const r of SENSITIVE_VALUE_RULES) {
        let hits = 0;
        for (const row of rows) if (r.re.test(String(row.v))) hits++;
        if (hits > 0) add({ column: c.Field, type: c.Type, category: r.category, level: r.level, source: '内容采样', hits });
      }
    }
    const levelOrder = { high: 0, medium: 1, low: 2 };
    findings.sort((a, b) => levelOrder[a.level] - levelOrder[b.level]);
    res.json({ table: req.params.name, scanned: { stringColumns: stringCols.length, sampleSize: 500 }, findings });
  } catch (e) { res.status(500).json({ message: `敏感字段扫描失败：${e.message}` }); }
});

// 数据字典：表与字段的类型、键、注释（information_schema）
app.get('/api/mysql/governance/dictionary', async (req, res) => {
  const table = req.query.table;
  if (table && !isSafeIdent(String(table))) return res.status(400).json({ message: `表名 "${table}" 不合法。` });
  try {
    const [tables] = await req.dbPool.query(
      `SELECT TABLE_NAME, TABLE_COMMENT FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_TYPE = 'BASE TABLE' ORDER BY TABLE_NAME`,
      [req.dbName]
    );
    let colSql = `SELECT TABLE_NAME, COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_KEY, COLUMN_DEFAULT, EXTRA, COLUMN_COMMENT
      FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ?`;
    const params = [req.dbName];
    if (table) { colSql += ' AND TABLE_NAME = ?'; params.push(String(table)); }
    colSql += ' ORDER BY TABLE_NAME, ORDINAL_POSITION';
    const [cols] = await req.dbPool.query(colSql, params);
    res.json({
      tables: tables.map((t) => ({ name: t.TABLE_NAME, comment: t.TABLE_COMMENT || '' })),
      columns: cols.map((c) => ({
        table: c.TABLE_NAME, name: c.COLUMN_NAME, type: c.COLUMN_TYPE,
        nullable: c.IS_NULLABLE === 'YES', key: c.COLUMN_KEY || null,
        default: c.COLUMN_DEFAULT, extra: c.EXTRA || '', comment: c.COLUMN_COMMENT || '',
      })),
    });
  } catch (e) { res.status(500).json({ message: `获取数据字典失败：${e.message}` }); }
});

// 数据字典导出 CSV（当前库全部表）
app.get('/api/mysql/governance/dictionary/export', async (req, res) => {
  try {
    const [cols] = await req.dbPool.query(
      `SELECT TABLE_NAME, COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_KEY, COLUMN_DEFAULT, EXTRA, COLUMN_COMMENT
       FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? ORDER BY TABLE_NAME, ORDINAL_POSITION`,
      [req.dbName]
    );
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="data-dictionary.csv"');
    res.write('\uFEFF');
    res.write('表名,序号,字段名,字段类型,可空,键,默认值,额外,注释\r\n');
    let last = null, seq = 0;
    for (const c of cols) {
      if (c.TABLE_NAME !== last) { last = c.TABLE_NAME; seq = 0; }
      seq++;
      const row = [c.TABLE_NAME, seq, c.COLUMN_NAME, c.COLUMN_TYPE, c.IS_NULLABLE, c.COLUMN_KEY || '', c.COLUMN_DEFAULT ?? '', c.EXTRA || '', c.COLUMN_COMMENT || ''];
      res.write(row.map(csvField).join(',') + '\r\n');
    }
    res.end();
  } catch (e) { res.status(500).json({ message: `导出数据字典失败：${e.message}` }); }
});

// 数据库总览统计：各表引擎、行数估算、占用空间（information_schema）
app.get('/api/mysql/governance/overview', async (req, res) => {
  try {
    const [rows] = await req.dbPool.query(
      `SELECT TABLE_NAME AS name, ENGINE AS engine, TABLE_ROWS AS approxRows,
              DATA_LENGTH AS dataLength, INDEX_LENGTH AS indexLength,
              UPDATE_TIME AS updateTime, TABLE_COMMENT AS comment
       FROM information_schema.TABLES
       WHERE TABLE_SCHEMA = ? AND TABLE_TYPE = 'BASE TABLE'
       ORDER BY TABLE_NAME`,
      [req.dbName]
    );
    const tables = rows.map((r) => ({
      name: r.name,
      engine: r.engine || '—',
      approxRows: Number(r.approxRows || 0),
      sizeKb: Number((((Number(r.dataLength) || 0) + (Number(r.indexLength) || 0)) / 1024).toFixed(1)),
      updateTime: r.updateTime || null,
      comment: r.comment || '',
    }));
    const totalSizeKb = Number(tables.reduce((s, t) => s + t.sizeKb, 0).toFixed(1));
    res.json({ tables, totalSizeKb });
  } catch (e) { res.status(500).json({ message: `获取总览统计失败：${e.message}` }); }
});

// 数据分析：多表整合分析（可用性 / 填充率 / 数值统计 / 字段相关性 / 跨表关联字段）
const GOV_NUMERIC_RE = /^(int|tinyint|smallint|mediumint|bigint|decimal|numeric|float|double)/i;

// Pearson 相关系数（成对剔除空值，有效样本 <10 返回 null）
function pearsonCorrelation(pairs) {
  const pts = pairs.filter(([x, y]) => x !== null && y !== null && Number.isFinite(x) && Number.isFinite(y));
  const n = pts.length;
  if (n < 10) return null;
  let sx = 0, sy = 0;
  for (const [x, y] of pts) { sx += x; sy += y; }
  const mx = sx / n, my = sy / n;
  let num = 0, dx2 = 0, dy2 = 0;
  for (const [x, y] of pts) {
    const dx = x - mx, dy = y - my;
    num += dx * dy; dx2 += dx * dx; dy2 += dy * dy;
  }
  const den = Math.sqrt(dx2 * dy2);
  return den === 0 ? null : Number((num / den).toFixed(3));
}

app.post('/api/mysql/analysis', async (req, res) => {
  const raw = Array.isArray(req.body?.tables) ? req.body.tables.map(String) : [];
  const tableList = [...new Set(raw)];
  if (tableList.length === 0 || tableList.length > 8) return res.status(400).json({ message: '请选择 1-8 张表。' });
  for (const t of tableList) {
    if (!isSafeIdent(t)) return res.status(400).json({ message: `表名 "${t}" 不合法。` });
  }
  // 可选：每表指定参与分析的字段（与实际字段求交集）
  const fieldsReq = {};
  if (req.body?.fields && typeof req.body.fields === 'object' && !Array.isArray(req.body.fields)) {
    for (const [k, v] of Object.entries(req.body.fields)) {
      if (Array.isArray(v)) fieldsReq[k] = v.map(String);
    }
  }
  try {
    const [sizeRows] = await req.dbPool.query(
      'SELECT TABLE_NAME, DATA_LENGTH, INDEX_LENGTH FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_NAME IN (?)',
      [req.dbName, tableList]
    );
    const sizeMap = new Map(sizeRows.map((r) => [r.TABLE_NAME, Number((((Number(r.DATA_LENGTH) || 0) + (Number(r.INDEX_LENGTH) || 0)) / 1024).toFixed(1))]));

    const SKIP_ROWS = 200000;
    const tables = [], fillRates = [], numericStats = [], correlations = [];
    const colFillMap = new Map(); // 字段名 -> [{table, type, fillRate}]

    for (const t of tableList) {
      const tName = backtick(t);
      const [cols] = await req.dbPool.query(`DESCRIBE ${tName}`);
      const wanted = fieldsReq[t];
      let colList = Array.isArray(wanted) && wanted.length
        ? cols.filter((c) => wanted.includes(c.Field))
        : cols;
      colList = colList.slice(0, 15);
      const [[{ total }]] = await req.dbPool.query(`SELECT COUNT(*) AS total FROM ${tName}`);
      const totalRows = Number(total);
      const tableEntry = {
        name: t, rows: totalRows, columnCount: cols.length,
        hasPK: cols.some((c) => c.Key === 'PRI'),
        sizeKb: sizeMap.get(t) ?? 0, completeness: null,
      };
      tables.push(tableEntry);

      if (totalRows > 0 && totalRows <= SKIP_ROWS && colList.length > 0) {
        const parts = [];
        const numericCols = [];
        for (const c of colList) {
          const b = backtick(c.Field);
          parts.push(`SUM(${b} IS NULL) AS ${backtick('null_' + c.Field)}`);
          if (GOV_NUMERIC_RE.test(c.Type)) {
            numericCols.push(c.Field);
            parts.push(`MIN(${b}) AS ${backtick('min_' + c.Field)}, MAX(${b}) AS ${backtick('max_' + c.Field)}, AVG(${b}) AS ${backtick('avg_' + c.Field)}`);
          }
        }
        const [[agg]] = await req.dbPool.query(`SELECT ${parts.join(', ')} FROM ${tName}`);
        let nullCells = 0;
        for (const c of colList) {
          const nullCount = Number(agg[`null_${c.Field}`] || 0);
          nullCells += nullCount;
          fillRates.push({ table: t, column: c.Field, fillRate: Number((1 - nullCount / totalRows).toFixed(4)), nullCount });
          const arr = colFillMap.get(c.Field) || [];
          arr.push({ table: t, type: c.Type, fillRate: Number((1 - nullCount / totalRows).toFixed(4)) });
          colFillMap.set(c.Field, arr);
        }
        tableEntry.completeness = Number((1 - nullCells / (totalRows * colList.length)).toFixed(4));

        for (const name of numericCols) {
          const avgRaw = agg[`avg_${name}`];
          numericStats.push({
            table: t, column: name,
            min: agg[`min_${name}`] ?? null, max: agg[`max_${name}`] ?? null,
            avg: avgRaw === null ? null : Number(Number(avgRaw).toFixed(3)),
          });
        }

        // 数值字段 Pearson 相关性（采样 ≤2000 行）
        if (numericCols.length >= 2 && totalRows >= 10) {
          const sampleCols = numericCols.slice(0, 8);
          const sel = sampleCols.map((c) => `${backtick(c)} AS ${backtick('v_' + c)}`).join(', ');
          const [srows] = await req.dbPool.query(`SELECT ${sel} FROM ${tName} LIMIT 2000`);
          const series = sampleCols.map((c) => srows.map((r) => {
            const v = Number(r['v_' + c]);
            return Number.isFinite(v) ? v : null;
          }));
          const matrix = sampleCols.map((_, i) => sampleCols.map((_, j) =>
            i === j ? 1 : pearsonCorrelation(series[i].map((v, k) => [v, series[j][k]]))));
          correlations.push({ table: t, columns: sampleCols, matrix, sampleRows: srows.length });
        }
      } else if (totalRows > SKIP_ROWS) {
        // 大表跳过逐字段扫描，仅保留结构信息
        for (const c of colList) fillRates.push({ table: t, column: c.Field, fillRate: null, nullCount: null });
      }
    }

    // 跨表关联字段：同名列出现在 ≥2 张选中表
    const sharedColumns = [];
    for (const [column, arr] of colFillMap) {
      if (arr.length < 2) continue;
      const entry = { column, tables: arr.map((a) => a.table), fills: arr.map((a) => ({ table: a.table, fillRate: a.fillRate })), valueOverlap: null };
      const [s1, s2] = arr;
      const bothString = GOV_STRING_TYPES.some((x) => s1.type.toLowerCase().includes(x))
        && GOV_STRING_TYPES.some((x) => s2.type.toLowerCase().includes(x));
      if (bothString) {
        try {
          const cb = backtick(column);
          const cond = `${cb} IS NOT NULL AND ${cb} != ''`;
          const [ra] = await req.dbPool.query(`SELECT DISTINCT ${cb} AS v FROM ${backtick(s1.table)} WHERE ${cond} LIMIT 300`);
          const [rb] = await req.dbPool.query(`SELECT DISTINCT ${cb} AS v FROM ${backtick(s2.table)} WHERE ${cond} LIMIT 300`);
          const setA = new Set(ra.map((r) => String(r.v)));
          const setB = new Set(rb.map((r) => String(r.v)));
          let inter = 0;
          for (const v of setA) if (setB.has(v)) inter++;
          const union = new Set([...setA, ...setB]).size;
          entry.valueOverlap = { tables: [s1.table, s2.table], ratio: union ? Number((inter / union).toFixed(3)) : 0, sampled: [setA.size, setB.size] };
        } catch { /* 重叠采样失败不阻断 */ }
      }
      sharedColumns.push(entry);
      if (sharedColumns.length >= 6) break;
    }

    await writeAudit(req, 'ANALYZE', req.dbName, tableList.join(','));
    res.json({ tables, fillRates, numericStats, correlations, sharedColumns });
  } catch (e) { res.status(500).json({ message: `数据分析失败：${e.message}` }); }
});

// 审计日志查询（集中存储于默认库，与 X-Database 无关）
app.get('/api/mysql/governance/audit', async (req, res) => {
  if (!(await ensureAuditTable())) return res.status(500).json({ message: '审计表初始化失败，请检查默认数据库连接。' });
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize) || 15));
  const action = String(req.query.action || '');
  const where = action ? 'WHERE action = ?' : '';
  const params = action ? [action] : [];
  try {
    const [[{ total }]] = await getPool(MYSQL_DB).query(`SELECT COUNT(*) AS total FROM \`audit_log\` ${where}`, params);
    const [rows] = await getPool(MYSQL_DB).query(
      `SELECT id, username, action, target, detail, ip, created_at FROM \`audit_log\` ${where} ORDER BY id DESC LIMIT ? OFFSET ?`,
      [...params, pageSize, (page - 1) * pageSize]
    );
    const [acts] = await getPool(MYSQL_DB).query('SELECT DISTINCT action FROM `audit_log` ORDER BY action');
    res.json({ rows, total, page, pageSize, totalPages: Math.ceil(total / pageSize), actions: acts.map((r) => r.action) });
  } catch (e) { res.status(500).json({ message: `查询审计日志失败：${e.message}` }); }
});

app.get('/api/mysql/tables', async (req, res) => {
  const cacheKey = `${req.dbName}:tables_list`;
  const cached = getCached(cacheKey);
  if (cached) return res.json(cached);
  try {
    const [tables] = await req.dbPool.query('SHOW TABLES');
    const tableKey = Object.keys(tables[0] || {})[0] || 'Tables_in_mysql_mulpro';
    const result = [];
    for (const row of tables) {
      const name = row[tableKey];
      const tName = backtick(name);
      if (!tName) { result.push({ name, rowCount: 0 }); continue; }
      try { const [c] = await req.dbPool.query(`SELECT COUNT(*) AS cnt FROM ${tName}`); result.push({ name, rowCount: c[0].cnt }); }
      catch { result.push({ name, rowCount: 0 }); }
    }
    const data = { tables: result };
    setCached(cacheKey, data);
    res.json(data);
  } catch (e) { res.status(500).json({ message: `获取表列表失败：${e.message}` }); }
});

app.post('/api/mysql/tables/:name/columns', async (req, res) => {
  const tName = backtick(req.params.name);
  if (!tName) return res.status(400).json({ message: `表名 "${req.params.name}" 不合法。` });
  const { colName, colType, nullable, defaultValue } = req.body || {};
  if (!STRICT_IDENT_RE.test(colName || '')) return res.status(400).json({ message: `列名 "${colName}" 不合法。` });
  if (!isValidColumnType(colType)) return res.status(400).json({ message: `列类型 "${colType}" 不受支持，请使用 INT、VARCHAR(n)、DECIMAL(m,d) 等标准类型。` });
  const cName = backtick(colName);
  let def = `ADD COLUMN ${cName} ${colType.trim().toUpperCase()}`;
  if (!nullable) def += ' NOT NULL';
  if (defaultValue !== undefined && defaultValue !== null && defaultValue !== '') {
    def += ` DEFAULT ${sqlDefaultLiteral(defaultValue)}`;
  } else if (!nullable) {
    const t = colType.toUpperCase();
    if (/INT|DECIMAL|FLOAT|DOUBLE|NUMERIC/.test(t)) def += ' DEFAULT 0';
    else if (/CHAR|TEXT/.test(t)) def += " DEFAULT ''";
    else if (/DATETIME|TIMESTAMP/.test(t)) def += ' DEFAULT CURRENT_TIMESTAMP';
    else def += " DEFAULT ''";
  }
  try {
    await req.dbPool.query(`ALTER TABLE ${tName} ${def}`);
    clearDbCache(req.dbName);
    await writeAudit(req, 'ADD_COLUMN', `${req.params.name}.${colName}`, colType);
    res.json({ message: `列 ${colName} 已添加到表 ${req.params.name}。` });
  } catch (e) { res.status(500).json({ message: `添加列失败：${e.message}` }); }
});

app.delete('/api/mysql/tables/:name/columns/:col', async (req, res) => {
  const tName = backtick(req.params.name);
  const cName = backtick(req.params.col);
  if (!tName || !cName) return res.status(400).json({ message: '表名或列名不合法。' });
  try {
    const [cols] = await req.dbPool.query(`DESCRIBE ${tName}`);
    const target = cols.find((c) => c.Field === req.params.col);
    if (!target) return res.status(400).json({ message: `列 "${req.params.col}" 不存在。` });
    if (target.Key === 'PRI') return res.status(400).json({ message: '主键列不允许删除。' });
    if (cols.length <= 1) return res.status(400).json({ message: '表至少需要保留一列。' });
    await req.dbPool.query(`ALTER TABLE ${tName} DROP COLUMN ${cName}`);
    clearDbCache(req.dbName);
    await writeAudit(req, 'DROP_COLUMN', `${req.params.name}.${req.params.col}`);
    res.json({ message: `列 ${req.params.col} 已删除。` });
  } catch (e) { res.status(500).json({ message: `删除列失败：${e.message}` }); }
});

app.get('/api/mysql/tables/:name', async (req, res) => {
  const tName = backtick(req.params.name);
  if (!tName) return res.status(400).json({ message: `表名 "${req.params.name}" 不合法。` });
  const cacheKey = `${req.dbName}:tables_struct:${req.params.name}`;
  const cached = getCached(cacheKey);
  if (cached) return res.json(cached);
  try {
    const [cols] = await req.dbPool.query(`DESCRIBE ${tName}`);
    const data = {
      tableName: req.params.name,
      columns: cols.map((c) => ({ name: c.Field, type: c.Type, nullable: c.Null === 'YES', key: c.Key || null, default: c.Default, extra: c.Extra || null })),
    };
    setCached(cacheKey, data);
    res.json(data);
  } catch (e) { res.status(500).json({ message: `获取表结构失败：${e.message}` }); }
});

app.post('/api/mysql/tables', async (req, res) => {
  const { name, columns } = req.body || {};
  const tName = backtick(name || '');
  if (!tName) return res.status(400).json({ message: `表名 "${name}" 不合法。` });
  if (!Array.isArray(columns) || columns.length === 0) return res.status(400).json({ message: '请提供表名和至少一列的定义。' });
  for (const col of columns) {
    if (!STRICT_IDENT_RE.test(col.name || '')) return res.status(400).json({ message: `列名 "${col.name}" 不合法。` });
    if (!isValidColumnType(col.type)) return res.status(400).json({ message: `列类型 "${col.type}" 不受支持，请使用 INT、VARCHAR(n)、DECIMAL(m,d) 等标准类型。` });
  }
  const colDefs = columns.map((col) => {
    let d = `${backtick(col.name)} ${col.type.trim().toUpperCase()}`;
    if (!col.nullable) d += ' NOT NULL';
    if (col.default !== undefined && col.default !== null && col.default !== '') d += ` DEFAULT ${sqlDefaultLiteral(col.default)}`;
    if (col.autoInc) d += ' AUTO_INCREMENT';
    if (col.pk) d += ' PRIMARY KEY';
    return d;
  });
  try {
    await req.dbPool.query(`CREATE TABLE ${tName} (${colDefs.join(', ')})`);
    clearDbCache(req.dbName);
    await writeAudit(req, 'CREATE_TABLE', name, `${columns.length} 个字段`);
    res.json({ message: `表 ${name} 创建成功。` });
  } catch (e) { res.status(500).json({ message: `创建表失败：${e.message}` }); }
});

app.post('/api/mysql/tables/:name/renumber-ids', async (req, res) => {
  const tName = backtick(req.params.name);
  if (!tName) return res.status(400).json({ message: `表名 "${req.params.name}" 不合法。` });
  try {
    const [cols] = await req.dbPool.query(`DESCRIBE ${tName}`);
    const pkCol = cols.find((c) => c.Key === 'PRI');
    if (!pkCol || !pkCol.Extra?.includes('auto_increment')) return res.status(400).json({ message: '该表没有自增主键，无法重新编号。' });
    const pk = backtick(pkCol.Field);
    await req.dbPool.query(`SET @num = 0`);
    await req.dbPool.query(`UPDATE ${tName} SET ${pk} = @num := @num + 1 ORDER BY ${pk}`);
    const [mx] = await req.dbPool.query(`SELECT MAX(${pk}) AS max_id FROM ${tName}`);
    const next = Number(mx[0].max_id || 0) + 1;
    await req.dbPool.query(`ALTER TABLE ${tName} AUTO_INCREMENT = ${next}`);
    clearDbCache(req.dbName);
    await writeAudit(req, 'RENUMBER_IDS', req.params.name);
    res.json({ message: `ID 重新编号完成，下次插入起始: ${next}。` });
  } catch (e) { res.status(500).json({ message: `重新编号失败：${e.message}` }); }
});

app.delete('/api/mysql/tables/:name', async (req, res) => {
  const tName = backtick(req.params.name);
  if (!tName) return res.status(400).json({ message: `表名 "${req.params.name}" 不合法。` });
  try {
    await req.dbPool.query(`DROP TABLE IF EXISTS ${tName}`);
    clearDbCache(req.dbName);
    await writeAudit(req, 'DROP_TABLE', req.params.name);
    res.json({ message: `表 ${req.params.name} 已删除。` });
  } catch (e) { res.status(500).json({ message: `删除表失败：${e.message}` }); }
});

// 根据列元数据构建 WHERE/ORDER 子句（rows 查询与 CSV 导出共用）
function buildRowQueryClauses(cols, search, orderBy, orderDir) {
  const stringCols = cols.filter((c) => ['varchar','char','text','longtext','mediumtext','tinytext'].some((t) => c.Type.toLowerCase().includes(t)));
  let where = '', params = [];
  if (search && stringCols.length > 0) {
    where = `WHERE (${stringCols.map((c) => `\`${c.Field}\` LIKE ?`).join(' OR ')})`;
    for (let i = 0; i < stringCols.length; i++) params.push(`%${search}%`);
  }
  const pkCol = cols.find((c) => c.Key === 'PRI')?.Field || cols[0]?.Field;
  let orderClause = '';
  if (orderBy && cols.some((c) => c.Field === orderBy)) orderClause = `ORDER BY \`${orderBy}\` ${orderDir}`;
  else if (pkCol) orderClause = `ORDER BY \`${pkCol}\` DESC`;
  return { where, params, orderClause };
}

app.get('/api/mysql/tables/:name/rows', async (req, res) => {
  const tName = backtick(req.params.name);
  if (!tName) return res.status(400).json({ message: `表名 "${req.params.name}" 不合法。` });
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const pageSize = Math.min(200, Math.max(1, parseInt(req.query.pageSize) || 20));
  const search = req.query.search || '', orderBy = req.query.orderBy || '';
  const orderDir = req.query.orderDir === 'asc' ? 'ASC' : 'DESC';
  const offset = (page - 1) * pageSize;
  try {
    const [cols] = await req.dbPool.query(`DESCRIBE ${tName}`);
    const { where, params, orderClause } = buildRowQueryClauses(cols, search, orderBy, orderDir);
    const [[{ total }]] = await req.dbPool.query(`SELECT COUNT(*) AS total FROM ${tName} ${where}`, params);
    const [rows] = await req.dbPool.query(`SELECT * FROM ${tName} ${where} ${orderClause} LIMIT ? OFFSET ?`, [...params, pageSize, offset]);
    res.json({ tableName: req.params.name, columns: cols.map((c) => ({ name: c.Field, type: c.Type, key: c.Key || null })), rows, total, page, pageSize, totalPages: Math.ceil(total / pageSize) });
  } catch (e) { res.status(500).json({ message: `查询数据失败：${e.message}` }); }
});

// 导出当前表为 CSV（沿用搜索与排序条件，最多 5000 行）
app.get('/api/mysql/tables/:name/export', async (req, res) => {
  const tName = backtick(req.params.name);
  if (!tName) return res.status(400).json({ message: `表名 "${req.params.name}" 不合法。` });
  const search = req.query.search || '', orderBy = req.query.orderBy || '';
  const orderDir = req.query.orderDir === 'asc' ? 'ASC' : 'DESC';
  try {
    const [cols] = await req.dbPool.query(`DESCRIBE ${tName}`);
    const { where, params, orderClause } = buildRowQueryClauses(cols, search, orderBy, orderDir);
    const [rows] = await req.dbPool.query(`SELECT * FROM ${tName} ${where} ${orderClause} LIMIT 5000`, params);
    const fields = cols.map((c) => c.Field);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="export.csv"; filename*=UTF-8''${encodeURIComponent(req.params.name)}.csv`);
    res.write('\uFEFF');
    res.write(fields.map(csvField).join(',') + '\r\n');
    for (const row of rows) res.write(fields.map((f) => csvField(row[f])).join(',') + '\r\n');
    res.end();
  } catch (e) { res.status(500).json({ message: `导出失败：${e.message}` }); }
});

// 校验并整理插入/更新数据：password_plain 转为 bcrypt 哈希，列名必须真实存在
async function prepareRowData(req, tName, data) {
  const clean = { ...data };
  if (clean.password_plain !== undefined) {
    if (clean.password_plain !== '') clean.password = await bcrypt.hash(clean.password_plain, 10);
    delete clean.password_plain;
  }
  const [cols] = await req.dbPool.query(`DESCRIBE ${tName}`);
  const validCols = new Set(cols.map((c) => c.Field));
  for (const k of Object.keys(clean)) {
    if (!validCols.has(k)) throw new Error(`未知列 "${k}"。`);
  }
  return { clean, cols };
}

app.post('/api/mysql/tables/:name/rows', async (req, res) => {
  const tName = backtick(req.params.name);
  if (!tName) return res.status(400).json({ message: `表名 "${req.params.name}" 不合法。` });
  const data = { ...req.body || {} };
  if (Object.keys(data).length === 0) return res.status(400).json({ message: '请提供要插入的数据。' });
  try {
    const { clean } = await prepareRowData(req, tName, data);
    const keys = Object.keys(clean);
    if (keys.length === 0) return res.status(400).json({ message: '请提供要插入的数据。' });
    const [r] = await req.dbPool.query(`INSERT INTO ${tName} (${keys.map((k) => backtick(k)).join(', ')}) VALUES (${keys.map(() => '?').join(', ')})`, Object.values(clean));
    clearDbCache(req.dbName);
    await writeAudit(req, 'INSERT_ROW', req.params.name, `insertId=${r.insertId}; 字段=${keys.join(',')}`);
    res.json({ message: '插入成功。', insertId: r.insertId });
  } catch (e) { res.status(500).json({ message: `插入数据失败：${e.message}` }); }
});

app.put('/api/mysql/tables/:name/rows/:id', async (req, res) => {
  const tName = backtick(req.params.name);
  if (!tName) return res.status(400).json({ message: `表名 "${req.params.name}" 不合法。` });
  const data = { ...req.body || {} };
  if (Object.keys(data).length === 0) return res.status(400).json({ message: '请提供要更新的数据。' });
  try {
    const { clean, cols } = await prepareRowData(req, tName, data);
    if (Object.keys(clean).length === 0) return res.status(400).json({ message: '请提供要更新的数据。' });
    const pkCol = cols.find((c) => c.Key === 'PRI')?.Field;
    if (!pkCol) return res.status(400).json({ message: '该表没有主键，无法通过 ID 更新。' });
    const setClauses = Object.keys(clean).map((k) => `${backtick(k)} = ?`).join(', ');
    const [r] = await req.dbPool.query(`UPDATE ${tName} SET ${setClauses} WHERE ${backtick(pkCol)} = ?`, [...Object.values(clean), req.params.id]);
    await writeAudit(req, 'UPDATE_ROW', `${req.params.name}#${req.params.id}`, Object.keys(clean).join(','));
    res.json({ message: '更新成功。', affectedRows: r.affectedRows });
  } catch (e) { res.status(500).json({ message: `更新数据失败：${e.message}` }); }
});

app.delete('/api/mysql/tables/:name/rows/:id', async (req, res) => {
  const tName = backtick(req.params.name);
  if (!tName) return res.status(400).json({ message: `表名 "${req.params.name}" 不合法。` });
  try {
    const [cols] = await req.dbPool.query(`DESCRIBE ${tName}`);
    const pkCol = cols.find((c) => c.Key === 'PRI')?.Field;
    if (!pkCol) return res.status(400).json({ message: '该表没有主键，无法通过 ID 删除。' });
    const [r] = await req.dbPool.query(`DELETE FROM ${tName} WHERE ${backtick(pkCol)} = ?`, [req.params.id]);
    await writeAudit(req, 'DELETE_ROW', `${req.params.name}#${req.params.id}`);
    res.json({ message: '删除成功。', affectedRows: r.affectedRows });
  } catch (e) { res.status(500).json({ message: `删除数据失败：${e.message}` }); }
});

const FORBIDDEN_KEYWORDS = ['DROP DATABASE', 'TRUNCATE', 'ALTER DATABASE'];

app.post('/api/mysql/query', async (req, res) => {
  const { sql } = req.body || {};
  if (!sql || typeof sql !== 'string') return res.status(400).json({ message: '请提供 SQL 语句。' });
  // 词法分析：字符串/注释里的分号与关键字不会误判
  const stmts = splitStatements(sql);
  if (stmts.length > 1) return res.status(403).json({ message: '禁止执行多条 SQL 语句。' });
  const forbidden = findForbiddenKeyword(sql, FORBIDDEN_KEYWORDS);
  if (forbidden) return res.status(403).json({ message: `禁止执行包含 ${forbidden} 的语句。` });
  try {
    const [rows, fields] = await req.dbPool.query(sql);
    await writeAudit(req, 'SQL_EXECUTE', req.dbName, sql.slice(0, 300));
    if (Array.isArray(rows)) {
      res.json({ type: 'result', columns: fields ? fields.map((f) => f.name) : [], rows, rowCount: rows.length });
    } else {
      res.json({ type: 'affected', affectedRows: rows.affectedRows || 0, insertId: rows.insertId || 0, message: `操作成功，影响 ${rows.affectedRows || 0} 行。` });
    }
    clearDbCache(req.dbName);
  } catch (e) { res.status(500).json({ message: `SQL 执行失败：${e.message}` }); }
});

app.listen(port, () => {
  console.log(`API running on http://localhost:${port}`);
});
