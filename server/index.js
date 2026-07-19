import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import mssql from 'mssql';
import mysql from 'mysql2/promise';
import bcrypt from 'bcryptjs';

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

// === Auth 中间件 ===
function authMiddleware(req, res, next) {
  if (!rateLimitCheck(req)) {
    return res.status(429).json({ message: '请求过于频繁，请稍后再试。' });
  }
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token || token !== API_SECRET) {
    return res.status(401).json({ message: '未授权访问。' });
  }
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

// === MySQL 连接池 — 动态切换 ===
let currentDb = MYSQL_DB;
const dbCredentials = new Map();

function createPoolForDb(database, user, password) {
  return mysql.createPool({
    host: MYSQL_HOST, port: MYSQL_PORT, database,
    user: user || MYSQL_USER, password: password || MYSQL_PASS,
    charset: 'utf8mb4', waitForConnections: true, connectionLimit: 4,
    queueLimit: 0, connectTimeout: 15000,
  });
}

let mysqlPool = createPoolForDb(currentDb, MYSQL_USER, MYSQL_PASS);

function switchDatabase(database, user, password) {
  const oldPool = mysqlPool;
  const u = user || dbCredentials.get(database)?.user || MYSQL_USER;
  const p = password || dbCredentials.get(database)?.password || MYSQL_PASS;
  mysqlPool = createPoolForDb(database, u, p);
  currentDb = database;
  if (user || password) dbCredentials.set(database, { user: u, password: p });
  oldPool.end().catch(() => {});
  clearCache();
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

// ==================== MySQL API (全部受 authMiddleware 保护) ====================

app.get('/api/mysql/databases', async (_req, res) => {
  try {
    const [rows] = await mysqlPool.query('SHOW DATABASES');
    const dbs = rows.map((r) => Object.values(r)[0])
      .filter((db) => !['information_schema','performance_schema','mysql','sys'].includes(db));
    res.json({ databases: dbs, current: currentDb });
  } catch (e) { res.status(500).json({ message: `获取数据库列表失败：${e.message}` }); }
});

app.post('/api/mysql/use-database', async (req, res) => {
  const { database, user, password } = req.body || {};
  if (!database) return res.status(400).json({ message: '请提供数据库名。' });
  try {
    switchDatabase(database, user, password);
    await mysqlPool.query('SELECT 1');
    clearCache();
    res.json({ message: `已切换到数据库 ${database}。`, current: currentDb });
  } catch (e) { res.status(500).json({ message: `切换数据库失败：${e.message}` }); }
});

app.get('/api/mysql/tables', async (_req, res) => {
  const cacheKey = 'tables_list';
  const cached = getCached(cacheKey);
  if (cached) return res.json(cached);
  try {
    const [tables] = await mysqlPool.query('SHOW TABLES');
    const tableKey = Object.keys(tables[0] || {})[0] || 'Tables_in_mysql_mulpro';
    const result = [];
    for (const row of tables) {
      const name = row[tableKey];
      try { const [c] = await mysqlPool.query(`SELECT COUNT(*) AS cnt FROM \`${name}\``); result.push({ name, rowCount: c[0].cnt }); }
      catch { result.push({ name, rowCount: 0 }); }
    }
    const data = { tables: result };
    setCached(cacheKey, data);
    res.json(data);
  } catch (e) { res.status(500).json({ message: `获取表列表失败：${e.message}` }); }
});

app.post('/api/mysql/tables/:name/columns', async (req, res) => {
  const { name } = req.params;
  const { colName, colType, nullable, defaultValue } = req.body || {};
  if (!colName || !colType) return res.status(400).json({ message: '请提供列名和类型。' });
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(colName)) return res.status(400).json({ message: `列名 "${colName}" 不合法。` });
  let def = `ADD COLUMN \`${colName}\` ${colType}`;
  if (!nullable) def += ' NOT NULL';
  if (defaultValue !== undefined && defaultValue !== null && defaultValue !== '') {
    def += ` DEFAULT ${typeof defaultValue === 'string' ? `'${defaultValue}'` : defaultValue}`;
  } else if (!nullable) {
    const t = colType.toUpperCase();
    if (/INT|DECIMAL|FLOAT|DOUBLE|NUMERIC/.test(t)) def += ' DEFAULT 0';
    else if (/CHAR|TEXT/.test(t)) def += " DEFAULT ''";
    else if (/DATETIME|TIMESTAMP/.test(t)) def += ' DEFAULT CURRENT_TIMESTAMP';
    else def += " DEFAULT ''";
  }
  try {
    await mysqlPool.query(`ALTER TABLE \`${name}\` ${def}`);
    clearCache('tables_');
    res.json({ message: `列 ${colName} 已添加到表 ${name}。` });
  } catch (e) { res.status(500).json({ message: `添加列失败：${e.message}` }); }
});

app.get('/api/mysql/tables/:name', async (req, res) => {
  const cacheKey = `tables_struct:${req.params.name}`;
  const cached = getCached(cacheKey);
  if (cached) return res.json(cached);
  try {
    const [cols] = await mysqlPool.query(`DESCRIBE \`${req.params.name}\``);
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
  if (!name || !Array.isArray(columns) || columns.length === 0) return res.status(400).json({ message: '请提供表名和至少一列的定义。' });
  const re = /^[a-zA-Z_][a-zA-Z0-9_]*$/;
  for (const col of columns) { if (!re.test(col.name)) return res.status(400).json({ message: `列名 "${col.name}" 不合法。` }); }
  const colDefs = columns.map((col) => {
    let d = `\`${col.name}\` ${col.type}`;
    if (!col.nullable) d += ' NOT NULL';
    if (col.default !== undefined && col.default !== null && col.default !== '') d += ` DEFAULT ${typeof col.default === 'string' && col.default.toUpperCase() !== 'CURRENT_TIMESTAMP' ? `'${col.default}'` : col.default}`;
    if (col.autoInc) d += ' AUTO_INCREMENT';
    if (col.pk) d += ' PRIMARY KEY';
    return d;
  });
  try {
    await mysqlPool.query(`CREATE TABLE \`${name}\` (${colDefs.join(', ')})`);
    clearCache('tables_');
    res.json({ message: `表 ${name} 创建成功。` });
  } catch (e) { res.status(500).json({ message: `创建表失败：${e.message}` }); }
});

app.post('/api/mysql/tables/:name/renumber-ids', async (req, res) => {
  const { name } = req.params;
  try {
    const [cols] = await mysqlPool.query(`DESCRIBE \`${name}\``);
    const pkCol = cols.find((c) => c.Key === 'PRI');
    if (!pkCol || !pkCol.Extra?.includes('auto_increment')) return res.status(400).json({ message: '该表没有自增主键，无法重新编号。' });
    const pk = pkCol.Field;
    await mysqlPool.query(`SET @num = 0`);
    await mysqlPool.query(`UPDATE \`${name}\` SET \`${pk}\` = @num := @num + 1 ORDER BY \`${pk}\``);
    const [mx] = await mysqlPool.query(`SELECT MAX(\`${pk}\`) AS max_id FROM \`${name}\``);
    const next = (mx[0].max_id || 0) + 1;
    await mysqlPool.query(`ALTER TABLE \`${name}\` AUTO_INCREMENT = ${next}`);
    clearCache('tables_');
    res.json({ message: `ID 重新编号完成，下次插入起始: ${next}。` });
  } catch (e) { res.status(500).json({ message: `重新编号失败：${e.message}` }); }
});

app.delete('/api/mysql/tables/:name', async (req, res) => {
  try {
    await mysqlPool.query(`DROP TABLE IF EXISTS \`${req.params.name}\``);
    clearCache('tables_');
    res.json({ message: `表 ${req.params.name} 已删除。` });
  } catch (e) { res.status(500).json({ message: `删除表失败：${e.message}` }); }
});

app.get('/api/mysql/tables/:name/rows', async (req, res) => {
  const { name } = req.params;
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const pageSize = Math.min(200, Math.max(1, parseInt(req.query.pageSize) || 20));
  const search = req.query.search || '', orderBy = req.query.orderBy || '';
  const orderDir = req.query.orderDir === 'asc' ? 'ASC' : 'DESC';
  const offset = (page - 1) * pageSize;
  try {
    const [cols] = await mysqlPool.query(`DESCRIBE \`${name}\``);
    const pkCol = cols.find((c) => c.Key === 'PRI')?.Field || cols[0]?.Field;
    const stringCols = cols.filter((c) => ['varchar','char','text','longtext','mediumtext','tinytext'].some((t) => c.Type.toLowerCase().includes(t)));
    let where = '', params = [];
    if (search && stringCols.length > 0) {
      where = `WHERE (${stringCols.map((c) => `\`${c.Field}\` LIKE ?`).join(' OR ')})`;
      for (let i = 0; i < stringCols.length; i++) params.push(`%${search}%`);
    }
    const [[{ total }]] = await mysqlPool.query(`SELECT COUNT(*) AS total FROM \`${name}\` ${where}`, params);
    let orderClause = '';
    if (orderBy && cols.some((c) => c.Field === orderBy)) orderClause = `ORDER BY \`${orderBy}\` ${orderDir}`;
    else if (pkCol) orderClause = `ORDER BY \`${pkCol}\` DESC`;
    const [rows] = await mysqlPool.query(`SELECT * FROM \`${name}\` ${where} ${orderClause} LIMIT ? OFFSET ?`, [...params, pageSize, offset]);
    res.json({ tableName: name, columns: cols.map((c) => ({ name: c.Field, type: c.Type, key: c.Key || null })), rows, total, page, pageSize, totalPages: Math.ceil(total / pageSize) });
  } catch (e) { res.status(500).json({ message: `查询数据失败：${e.message}` }); }
});

app.post('/api/mysql/tables/:name/rows', async (req, res) => {
  const { name } = req.params;
  const data = { ...req.body || {} };
  if (Object.keys(data).length === 0) return res.status(400).json({ message: '请提供要插入的数据。' });
  if (data.password_plain && data.password_plain !== '') data.password = await bcrypt.hash(data.password_plain, 10);
  const keys = Object.keys(data), vals = Object.values(data);
  try {
    const [r] = await mysqlPool.query(`INSERT INTO \`${name}\` (${keys.map((k) => `\`${k}\``).join(', ')}) VALUES (${keys.map(() => '?').join(', ')})`, vals);
    clearCache('tables_list');
    res.json({ message: '插入成功。', insertId: r.insertId });
  } catch (e) { res.status(500).json({ message: `插入数据失败：${e.message}` }); }
});

app.put('/api/mysql/tables/:name/rows/:id', async (req, res) => {
  const { name, id } = req.params;
  const data = { ...req.body || {} };
  if (Object.keys(data).length === 0) return res.status(400).json({ message: '请提供要更新的数据。' });
  if (data.password_plain && data.password_plain !== '') data.password = await bcrypt.hash(data.password_plain, 10);
  try {
    const [cols] = await mysqlPool.query(`DESCRIBE \`${name}\``);
    const pkCol = cols.find((c) => c.Key === 'PRI')?.Field;
    if (!pkCol) return res.status(400).json({ message: '该表没有主键，无法通过 ID 更新。' });
    const setClauses = Object.keys(data).map((k) => `\`${k}\` = ?`).join(', ');
    const [r] = await mysqlPool.query(`UPDATE \`${name}\` SET ${setClauses} WHERE \`${pkCol}\` = ?`, [...Object.values(data), id]);
    res.json({ message: '更新成功。', affectedRows: r.affectedRows });
  } catch (e) { res.status(500).json({ message: `更新数据失败：${e.message}` }); }
});

app.delete('/api/mysql/tables/:name/rows/:id', async (req, res) => {
  const { name, id } = req.params;
  try {
    const [cols] = await mysqlPool.query(`DESCRIBE \`${name}\``);
    const pkCol = cols.find((c) => c.Key === 'PRI')?.Field;
    if (!pkCol) return res.status(400).json({ message: '该表没有主键，无法通过 ID 删除。' });
    const [r] = await mysqlPool.query(`DELETE FROM \`${name}\` WHERE \`${pkCol}\` = ?`, [id]);
    res.json({ message: '删除成功。', affectedRows: r.affectedRows });
  } catch (e) { res.status(500).json({ message: `删除数据失败：${e.message}` }); }
});

app.post('/api/mysql/query', async (req, res) => {
  const { sql } = req.body || {};
  if (!sql || typeof sql !== 'string') return res.status(400).json({ message: '请提供 SQL 语句。' });
  const upper = sql.trim().toUpperCase();
  for (const kw of ['DROP DATABASE', 'TRUNCATE', 'ALTER DATABASE']) if (upper.includes(kw)) return res.status(403).json({ message: `禁止执行包含 ${kw} 的语句。` });
  const stmts = sql.split(';').filter((s) => s.trim().length > 0);
  if (stmts.length > 1) return res.status(403).json({ message: '禁止执行多条 SQL 语句。' });
  try {
    const [rows, fields] = await mysqlPool.query(sql);
    if (Array.isArray(rows)) {
      res.json({ type: 'result', columns: fields ? fields.map((f) => f.name) : [], rows, rowCount: rows.length });
    } else {
      res.json({ type: 'affected', affectedRows: rows.affectedRows || 0, insertId: rows.insertId || 0, message: `操作成功，影响 ${rows.affectedRows || 0} 行。` });
    }
    clearCache('tables_');
  } catch (e) { res.status(500).json({ message: `SQL 执行失败：${e.message}` }); }
});

app.listen(port, () => {
  console.log(`API running on http://localhost:${port}`);
});
