import express from 'express';
import cors from 'cors';
import mssql from 'mssql';

const app = express();
const port = Number(process.env.PORT || 3001);
const rowHeight = 24;

app.use(cors());
app.use(express.json({ limit: '1mb' }));

const escapeXml = (value = '') => String(value)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&apos;');

const buildConnectionConfig = ({ server, port, database, username, password, instanceName }) => ({
  server,
  port: Number(port) || 1433,
  database,
  user: username,
  password,
  options: {
    encrypt: false,
    trustServerCertificate: true,
    ...(instanceName ? { instanceName } : {}),
  },
  pool: {
    max: 4,
    min: 0,
    idleTimeoutMillis: 30000,
  },
  connectionTimeout: 15000,
  requestTimeout: 30000,
});

const fetchSchema = async (pool) => {
  const tablesResult = await pool.request().query(`
    SELECT
      t.TABLE_SCHEMA,
      t.TABLE_NAME,
      c.COLUMN_NAME,
      c.DATA_TYPE,
      c.IS_NULLABLE,
      c.CHARACTER_MAXIMUM_LENGTH,
      c.ORDINAL_POSITION
    FROM INFORMATION_SCHEMA.TABLES AS t
    JOIN INFORMATION_SCHEMA.COLUMNS AS c
      ON t.TABLE_SCHEMA = c.TABLE_SCHEMA
     AND t.TABLE_NAME = c.TABLE_NAME
    WHERE t.TABLE_TYPE = 'BASE TABLE'
    ORDER BY t.TABLE_SCHEMA, t.TABLE_NAME, c.ORDINAL_POSITION;
  `);

  const relationsResult = await pool.request().query(`
    SELECT
      fk.name AS fk_name,
      sch1.name AS from_schema,
      tab1.name AS from_table,
      col1.name AS from_column,
      sch2.name AS to_schema,
      tab2.name AS to_table,
      col2.name AS to_column
    FROM sys.foreign_keys AS fk
    INNER JOIN sys.foreign_key_columns AS fkc
      ON fk.object_id = fkc.constraint_object_id
    INNER JOIN sys.tables AS tab1
      ON fkc.parent_object_id = tab1.object_id
    INNER JOIN sys.schemas AS sch1
      ON tab1.schema_id = sch1.schema_id
    INNER JOIN sys.columns AS col1
      ON fkc.parent_object_id = col1.object_id
     AND fkc.parent_column_id = col1.column_id
    INNER JOIN sys.tables AS tab2
      ON fkc.referenced_object_id = tab2.object_id
    INNER JOIN sys.schemas AS sch2
      ON tab2.schema_id = sch2.schema_id
    INNER JOIN sys.columns AS col2
      ON fkc.referenced_object_id = col2.object_id
     AND fkc.referenced_column_id = col2.column_id
    ORDER BY sch1.name, tab1.name, fk.name;
  `);

  const tableMap = new Map();

  for (const row of tablesResult.recordset) {
    const key = `${row.TABLE_SCHEMA}.${row.TABLE_NAME}`;

    if (!tableMap.has(key)) {
      tableMap.set(key, {
        schema: row.TABLE_SCHEMA,
        name: row.TABLE_NAME,
        columns: [],
      });
    }

    tableMap.get(key).columns.push({
      name: row.COLUMN_NAME,
      type: row.CHARACTER_MAXIMUM_LENGTH && row.CHARACTER_MAXIMUM_LENGTH > 0
        ? `${row.DATA_TYPE}(${row.CHARACTER_MAXIMUM_LENGTH})`
        : row.DATA_TYPE,
      nullable: row.IS_NULLABLE === 'YES',
    });
  }

  return {
    tables: Array.from(tableMap.values()),
    relations: relationsResult.recordset,
  };
};

const layoutTables = (tables) => {
  if (tables.length === 0) {
    return { nodes: [], width: 1200, height: 600 };
  }

  const columns = Math.min(3, Math.max(1, Math.ceil(Math.sqrt(tables.length))));
  const cardWidth = 320;
  const headerHeight = 48;
  const xGap = 40;
  const yGap = 48;
  const margin = 40;

  const rows = [];

  const baseNodes = tables.map((table, index) => {
    const column = index % columns;
    const row = Math.floor(index / columns);
    const visibleColumns = table.columns;
    const contentRows = visibleColumns.length + 1;
    const bottomPadding = 72;
    const height = headerHeight + contentRows * rowHeight + bottomPadding;

    if (!rows[row]) {
      rows[row] = [];
    }
    rows[row].push(height);

    return {
      ...table,
      visibleColumns,
      column,
      row,
      width: cardWidth,
      height,
    };
  });

  const rowOffsets = [];
  let currentY = margin;

  for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
    rowOffsets[rowIndex] = currentY;
    const rowMaxHeight = Math.max(...rows[rowIndex]);
    currentY += rowMaxHeight + yGap;
  }

  const nodes = baseNodes.map((node) => ({
    ...node,
    x: margin + node.column * (cardWidth + xGap),
    y: rowOffsets[node.row],
  }));

  const maxHeight = Math.max(...nodes.map((node) => node.y + node.height));
  const width = margin * 2 + columns * cardWidth + (columns - 1) * xGap;
  const height = Math.max(600, maxHeight + margin);

  return { nodes, width, height, columns };
};

const buildDiagramSvg = (schemaName, schema) => {
  const { nodes, width, height } = layoutTables(schema.tables);
  const headerOffset = 24;
  const titleBlockHeight = 0;
  const offsetNodes = nodes.map((node) => ({
    ...node,
    y: node.y + headerOffset,
  }));
  const centerMap = new Map(offsetNodes.map((node) => [`${node.schema}.${node.name}`, node]));

  const relationLines = schema.relations
    .map((relation) => {
      const from = centerMap.get(`${relation.from_schema}.${relation.from_table}`);
      const to = centerMap.get(`${relation.to_schema}.${relation.to_table}`);

      if (!from || !to) {
        return '';
      }

      const x1 = from.x + from.width;
      const y1 = from.y + from.height / 2;
      const x2 = to.x;
      const y2 = to.y + to.height / 2;

      return `<path d="M ${x1} ${y1} C ${x1 + 30} ${y1}, ${x2 - 30} ${y2}, ${x2} ${y2}" class="relation" marker-end="url(#arrow)" />`;
    })
    .join('');

  const cards = nodes
    .map((node) => {
      const offsetNode = {
        ...node,
        y: node.y + headerOffset,
      };

      const contentTop = 76;
      const leftX = 16;
      const rightX = 162;

      const renderColumnLabel = (column) => {
        const rawLabel = `${column.name} : ${column.type}${column.nullable ? ' ?' : ''}`;
        return escapeXml(rawLabel.length > 28 ? `${rawLabel.slice(0, 27)}…` : rawLabel);
      };

      const columnLines = offsetNode.visibleColumns
            .map((column, index) => {
              const rowY = contentTop + index * rowHeight;
              return `<text x="${leftX}" y="${rowY}" class="column">${renderColumnLabel(column)}</text>`;
            })
            .join('');

      const extraColumnsLine = '';

      return `
        <g transform="translate(${offsetNode.x}, ${offsetNode.y})">
          <defs>
            <clipPath id="clip-${escapeXml(offsetNode.schema)}-${escapeXml(offsetNode.name)}">
              <rect x="0" y="0" width="${offsetNode.width}" height="${offsetNode.height}" rx="18" />
            </clipPath>
          </defs>
          <rect x="0" y="0" width="${offsetNode.width}" height="${offsetNode.height}" rx="18" class="card" />
          <rect x="0" y="0" width="${offsetNode.width}" height="48" rx="18" class="card__header" />
          <g clip-path="url(#clip-${escapeXml(offsetNode.schema)}-${escapeXml(offsetNode.name)})">
            <text x="16" y="30" class="table-name">${escapeXml(offsetNode.schema)}.${escapeXml(offsetNode.name)}</text>
            <text x="16" y="52" class="table-meta">${offsetNode.columns.length} columns</text>
            ${columnLines}
            ${extraColumnsLine}
          </g>
        </g>`;
    })
    .join('');

  const emptyState = nodes.length === 0
    ? `
      <g transform="translate(${width / 2 - 170}, ${headerOffset + height / 2 - 44})">
        <rect width="340" height="88" rx="18" class="empty" />
        <text x="170" y="40" text-anchor="middle" class="empty__title">未找到可视化表结构</text>
        <text x="170" y="62" text-anchor="middle" class="empty__desc">当前数据库里没有可展示的基础表</text>
      </g>`
    : '';

  const svgHeight = height + headerOffset + titleBlockHeight + 24;

  return `<?xml version="1.0" encoding="UTF-8"?>
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${svgHeight}" width="${width}" height="${svgHeight}">
    <defs>
      <linearGradient id="background" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#f7fbff" />
        <stop offset="100%" stop-color="#ffffff" />
      </linearGradient>
      <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse">
        <path d="M 0 0 L 10 5 L 0 10 z" fill="#4c7bd9" />
      </marker>
      <style>
        .bg { fill: url(#background); }
        .title { font: 700 28px 'Segoe UI', Arial, sans-serif; fill: #17324d; }
        .subtitle { font: 400 14px 'Segoe UI', Arial, sans-serif; fill: #5f6d7a; }
        .card { fill: #ffffff; stroke: #d7e3f1; stroke-width: 1.2; filter: drop-shadow(0px 12px 24px rgba(18, 38, 63, 0.08)); }
        .card__header { fill: #ebf2ff; }
        .table-name { font: 700 15px 'Segoe UI', Arial, sans-serif; fill: #12304b; }
        .table-meta { font: 400 12px 'Segoe UI', Arial, sans-serif; fill: #5d7488; }
        .column { font: 400 11px 'Segoe UI', Arial, sans-serif; fill: #30485f; }
        .column--more { font-style: italic; fill: #6e88a5; }
        .relation { fill: none; stroke: #4c7bd9; stroke-width: 1.8; opacity: 0.65; }
        .empty { fill: #ffffff; stroke: #dbe7f4; stroke-width: 1.2; }
        .empty__title { font: 700 16px 'Segoe UI', Arial, sans-serif; fill: #17324d; }
        .empty__desc { font: 400 13px 'Segoe UI', Arial, sans-serif; fill: #5f6d7a; }
      </style>
    </defs>

    <rect class="bg" x="0" y="0" width="100%" height="100%" />

    ${cards}
    ${relationLines}
    ${emptyState}
  </svg>`;
};

app.get('/health', (_req, res) => {
  res.json({ ok: true });
});

app.post('/api/sqlserver/diagram', async (req, res) => {
  const { server, port, database, username, password, instanceName } = req.body || {};

  if (!server || !database || !username || !password) {
    return res.status(400).json({
      message: '请提供 server、database、username 和 password。',
    });
  }

  const config = buildConnectionConfig({ server, port, database, username, password, instanceName });
  let pool;

  try {
    pool = await new mssql.ConnectionPool(config).connect();
    const schema = await fetchSchema(pool);
    const svg = buildDiagramSvg(database, schema);

    res.setHeader('Content-Type', 'image/svg+xml; charset=utf-8');
    res.send(svg);
  } catch (error) {
    const message = error instanceof Error ? error.message : '数据库连接失败';
    res.status(500).json({
      message: `生成数据库结构图失败：${message}`,
    });
  } finally {
    if (pool) {
      await pool.close().catch(() => {});
    }
  }
});

app.post('/api/sqlserver/tables-info', async (req, res) => {
  const { server, port, database, username, password, instanceName } = req.body || {};

  if (!server || !database || !username || !password) {
    return res.status(400).json({ message: '请提供 server、database、username 和 password。' });
  }

  const config = buildConnectionConfig({ server, port, database, username, password, instanceName });
  let pool;

  try {
    pool = await new mssql.ConnectionPool(config).connect();
    const schema = await fetchSchema(pool);
    res.json({ tables: schema.tables });
  } catch (error) {
    const message = error instanceof Error ? error.message : '数据库连接失败';
    res.status(500).json({ message: `获取表信息失败：${message}` });
  } finally {
    if (pool) {
      await pool.close().catch(() => {});
    }
  }
});

app.post('/api/sqlserver/chart-data', async (req, res) => {
  const { server, port, database, username, password, instanceName, tableSchema, tableName, xColumn, yColumn, aggregation } = req.body || {};

  if (!server || !database || !username || !password || !tableSchema || !tableName || !xColumn || !aggregation) {
    return res.status(400).json({ message: '缺少必要参数。' });
  }

  const validAggregations = ['COUNT', 'SUM', 'AVG', 'NONE'];
  if (!validAggregations.includes(aggregation)) {
    return res.status(400).json({ message: `aggregation 必须是 ${validAggregations.join('、')} 之一。` });
  }

  if (aggregation !== 'COUNT' && !yColumn) {
    return res.status(400).json({ message: '非 COUNT 聚合需要提供 yColumn。' });
  }

  const config = buildConnectionConfig({ server, port, database, username, password, instanceName });
  let pool;

  try {
    pool = await new mssql.ConnectionPool(config).connect();

    // 验证表名和列名是否存在（防止 SQL 注入）
    const columnCheck = await pool.request()
      .input('schema', mssql.NVarChar, tableSchema)
      .input('table', mssql.NVarChar, tableName)
      .query(`
        SELECT COLUMN_NAME
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = @schema AND TABLE_NAME = @table
      `);

    const validColumns = new Set(columnCheck.recordset.map((r) => r.COLUMN_NAME));

    if (validColumns.size === 0) {
      return res.status(400).json({ message: `表 ${tableSchema}.${tableName} 不存在或无列。` });
    }

    if (!validColumns.has(xColumn)) {
      return res.status(400).json({ message: `列 ${xColumn} 在表 ${tableSchema}.${tableName} 中不存在。` });
    }

    if (aggregation !== 'COUNT' && !validColumns.has(yColumn)) {
      return res.status(400).json({ message: `列 ${yColumn} 在表 ${tableSchema}.${tableName} 中不存在。` });
    }

    const safeSchema = `[${tableSchema}]`;
    const safeTable = `[${tableName}]`;
    const safeX = `[${xColumn}]`;
    const safeY = aggregation !== 'COUNT' ? `[${yColumn}]` : null;

    let query;
    if (aggregation === 'COUNT') {
      query = `SELECT ${safeX} AS label, COUNT(*) AS value FROM ${safeSchema}.${safeTable} GROUP BY ${safeX} ORDER BY value DESC`;
    } else if (aggregation === 'SUM') {
      query = `SELECT ${safeX} AS label, SUM(${safeY}) AS value FROM ${safeSchema}.${safeTable} GROUP BY ${safeX} ORDER BY value DESC`;
    } else if (aggregation === 'AVG') {
      query = `SELECT ${safeX} AS label, AVG(CAST(${safeY} AS FLOAT)) AS value FROM ${safeSchema}.${safeTable} GROUP BY ${safeX} ORDER BY value DESC`;
    } else {
      query = `SELECT TOP 500 ${safeX} AS label, ${safeY} AS value FROM ${safeSchema}.${safeTable} ORDER BY ${safeX}`;
    }

    const result = await pool.request().query(query);

    const labels = [];
    const values = [];
    for (const row of result.recordset) {
      labels.push(String(row.label ?? ''));
      values.push(Number(row.value) || 0);
    }

    res.json({ labels, values, xColumn, yColumn: aggregation === 'COUNT' ? 'COUNT(*)' : yColumn, aggregation });
  } catch (error) {
    const message = error instanceof Error ? error.message : '查询失败';
    res.status(500).json({ message: `查询图表数据失败：${message}` });
  } finally {
    if (pool) {
      await pool.close().catch(() => {});
    }
  }
});

app.use((_req, res) => {
  res.status(404).json({ message: 'Not Found' });
});

app.listen(port, () => {
  console.log(`SQL Server diagram API is running on http://localhost:${port}`);
  console.log('SQL Server diagram API ready: using the current server/index.js implementation');
});