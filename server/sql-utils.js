// MySQL 标识符与 SQL 语句的静态安全检查工具（纯函数，无副作用，可独立单测）

// 标识符（库名/表名/已有列名）：允许任意字符（含中文、连字符），
// 但禁止反引号、反斜杠、NUL 和换行，保证用反引号包裹后无法逃逸。
export function isSafeIdent(name) {
  return typeof name === 'string' && name.length > 0 && name.length <= 64 && !/[`\\\0\r\n]/.test(name);
}

export function backtick(name) {
  if (!isSafeIdent(name)) return null;
  return '`' + name + '`';
}

// 新建列名：沿用前后端既有的严格规则
export const STRICT_IDENT_RE = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

// 列类型白名单：类型名 + 可选 (N) 或 (M,D)，禁止携带 NOT NULL / DEFAULT 等后缀
const TYPE_RE = /^(TINYINT|SMALLINT|MEDIUMINT|INT|INTEGER|BIGINT|FLOAT|DOUBLE|REAL|DECIMAL|NUMERIC|BIT|BOOLEAN|BOOL|DATE|DATETIME|TIMESTAMP|TIME|YEAR|CHAR|VARCHAR|NCHAR|NVARCHAR|TINYTEXT|TEXT|MEDIUMTEXT|LONGTEXT|JSON|BLOB|TINYBLOB|MEDIUMBLOB|LONGBLOB|BINARY|VARBINARY)\s*(\(\s*\d+\s*(,\s*\d+\s*)?\))?$/i;

export function isValidColumnType(type) {
  return typeof type === 'string' && TYPE_RE.test(type.trim());
}

// DEFAULT 值字面量：数字与 CURRENT_TIMESTAMP 直接输出，其余按 SQL 字符串转义
export function sqlDefaultLiteral(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  const s = String(value);
  if (/^-?\d+(\.\d+)?$/.test(s)) return s;
  if (s.toUpperCase() === 'CURRENT_TIMESTAMP') return 'CURRENT_TIMESTAMP';
  return `'${s.replace(/\\/g, '\\\\').replace(/'/g, "''")}'`;
}

// 将字符串/反引号标识符/注释的内容掩码为空格（长度不变），
// 用于安全的分号切分与关键字检测。单双引号内支持反斜杠转义与双写转义；
// 反引号内不处理反斜杠转义（与 MySQL 语义一致）。
export function maskLiterals(sql) {
  let out = '';
  let i = 0;
  const n = sql.length;
  while (i < n) {
    const c = sql[i];
    if (c === "'" || c === '"' || c === '`') {
      const useBackslash = c !== '`';
      out += ' ';
      i++;
      while (i < n) {
        if (useBackslash && sql[i] === '\\') { out += '  '; i += 2; continue; }
        if (sql[i] === c) {
          if (sql[i + 1] === c) { out += '  '; i += 2; continue; }
          out += ' ';
          i++;
          break;
        }
        out += ' ';
        i++;
      }
      continue;
    }
    if (c === '-' && sql[i + 1] === '-') {
      while (i < n && sql[i] !== '\n') { out += ' '; i++; }
      continue;
    }
    if (c === '#') {
      while (i < n && sql[i] !== '\n') { out += ' '; i++; }
      continue;
    }
    if (c === '/' && sql[i + 1] === '*') {
      out += '  ';
      i += 2;
      while (i < n) {
        if (sql[i] === '*' && sql[i + 1] === '/') { out += '  '; i += 2; break; }
        out += ' ';
        i++;
      }
      continue;
    }
    out += c;
    i++;
  }
  return out;
}

// 按顶层分号切分语句（字符串/注释里的分号不切分）
export function splitStatements(sql) {
  return maskLiterals(sql)
    .split(';')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

// 检测语句在字符串与注释之外是否包含禁止的关键词（大小写不敏感，空白归一化）
export function findForbiddenKeyword(sql, keywords) {
  const masked = maskLiterals(sql).toUpperCase().replace(/\s+/g, ' ');
  for (const kw of keywords) {
    if (masked.includes(kw)) return kw;
  }
  return null;
}

// CSV 字段转义：含逗号/引号/换行/分号时加引号，引号双写；NULL 输出空串
export function csvField(value) {
  if (value === null || value === undefined) return '';
  const s = value instanceof Date ? value.toISOString() : String(value);
  return /[",\n\r;]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}
