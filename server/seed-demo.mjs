// 演示数据种子脚本：创建常见业务表并填充测试数据，可重复执行（先删后建）
// 运行：node server/seed-demo.mjs
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
dotenv.config({ path: resolve(dirname(fileURLToPath(import.meta.url)), '../.env') });
import mysql from 'mysql2/promise';

const pool = mysql.createPool({
  host: process.env.MYSQL_HOST || '127.0.0.1',
  port: Number(process.env.MYSQL_PORT) || 3306,
  user: process.env.MYSQL_USER || 'root',
  password: process.env.MYSQL_PASS || '',
  database: process.env.MYSQL_DB || 'test',
  charset: 'utf8mb4',
});

// 可复现的伪随机数
let seed = 20260919;
const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
const ri = (min, max) => Math.floor(rnd() * (max - min + 1)) + min;
const pick = (arr) => arr[Math.floor(rnd() * arr.length)];

const fmtTs = (d) => {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
};
const daysAgo = (n, hourShift = 0) => {
  const d = new Date(Date.now() - n * 86400000 + hourShift * 3600000);
  return fmtTs(d);
};

// ---------- 商品表 ----------
const CATALOG = [
  ['手机', ['手机 Pro Max', '手机 标准版', '手机 青春版', '手机 至尊版'], [6999, 4999, 2999, 7999]],
  ['笔记本', ['笔记本 轻薄本', '笔记本 游戏本', '笔记本 商务本'], [4999, 8999, 6499]],
  ['平板', ['平板 11 英寸', '平板 Pro', '平板 mini'], [2499, 4999, 1999]],
  ['耳机', ['无线耳机 入门款', '无线耳机 降噪款'], [199, 899]],
  ['手表', ['智能手表 标准版', '智能手表 运动版'], [1299, 2199]],
];
const products = [];
CATALOG.forEach(([cat, names, prices]) => {
  names.forEach((name, i) => {
    const price = prices[i];
    // 销量与价格负相关（便于相关性分析），加噪声
    const sales = Math.max(15, Math.round(4000 - price * 0.4 + ri(-300, 300)));
    products.push({
      name, price,
      stock: ri(10, 200),
      sales,
      category: rnd() < 0.09 ? null : cat, // 少量空分类，触发质量告警
      status: rnd() < 0.15 ? 'off' : 'active',
      created_at: daysAgo(ri(30, 120)),
    });
  });
});

// ---------- 订单表 ----------
const users = (await pool.query('SELECT id FROM users ORDER BY id'))[0].map((r) => r.id);
const productIds = products.map((_, i) => i + 1);
const ORDER_STATUS = ['completed', 'completed', 'completed', 'completed', 'paid', 'paid', 'shipped', 'pending', 'cancelled'];
const orders = [];
for (let i = 1; i <= 60; i++) {
  const pid = pick(productIds);
  const qty = ri(1, 3);
  const p = products[pid - 1];
  const status = pick(ORDER_STATUS);
  const day = ri(0, 29);
  const created = daysAgo(day, -ri(0, 20));
  orders.push({
    order_no: `ORD${fmtTs(new Date(Date.now() - day * 86400000)).slice(0, 10).replace(/-/g, '')}${String(i).padStart(4, '0')}`,
    user_id: pick(users),
    product_id: pid,
    quantity: qty,
    // 金额 = 数量 × 单价 ± 5% 噪声（与数量、商品价格正相关）
    amount: p ? Math.round(qty * p.price * (0.95 + rnd() * 0.1) * 100) / 100 : null,
    status,
    remark: rnd() < 0.2 ? pick(['加急', '发票已开', '礼品包装']) : null,
    created_at: created,
    // 待支付订单没有更新时间（制造空值差异）
    updated_at: status === 'pending' ? null : daysAgo(Math.max(0, day - ri(0, 2))),
  });
}

// ---------- 员工表（演示敏感数据识别） ----------
const NAMES = ['张伟', '王芳', '李娜', '刘强', '陈静', '杨洋', '赵敏', '黄磊', '周杰', '吴霞', '徐峥', '孙悦', '马超', '朱琳', '胡军', '郭涛', '林峰', '何洁'];
const DEPTS = ['技术部', '市场部', '财务部', '人事部', '运营部'];
const employees = NAMES.map((name, i) => ({
  name,
  email: `demo.user${String(i + 1).padStart(2, '0')}@demo.test`,
  // 明显的测试假数据：138 段测试号码、测试证件号
  phone: i === 3 || i === 11 ? null : `138${String(10000000 + i * 111111).slice(0, 8)}`,
  idcard: `110101199001${String(1 + i).padStart(2, '0')}00${i % 10}X`,
  department: pick(DEPTS),
  salary: ri(80, 260) * 100,
  hired_at: daysAgo(ri(200, 1200)).slice(0, 10),
}));

// ---------- 登录日志表 ----------
const LOGIN_USERS = ['admin', 'zhangsan', 'lisi', 'wangwu', 'operator'];
const loginLogs = [];
for (let i = 1; i <= 40; i++) {
  loginLogs.push({
    username: pick(LOGIN_USERS),
    ip: `192.168.1.${ri(2, 254)}`,
    success: rnd() < 0.8 ? 1 : 0,
    user_agent: pick(['Chrome/126 Windows', 'Edge/126 Windows', 'Safari/17 macOS', 'Chrome/126 Android']),
    created_at: daysAgo(ri(0, 14), -ri(0, 23)),
  });
}

const DDL = {
  products: `CREATE TABLE IF NOT EXISTS products (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY COMMENT '商品ID',
    name VARCHAR(100) NOT NULL COMMENT '商品名称',
    category VARCHAR(50) NULL COMMENT '商品分类',
    price DECIMAL(10,2) NOT NULL COMMENT '单价（元）',
    stock INT NOT NULL DEFAULT 0 COMMENT '库存数量',
    sales INT NOT NULL DEFAULT 0 COMMENT '累计销量',
    status VARCHAR(20) NOT NULL DEFAULT 'active' COMMENT '状态：active/off',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '上架时间',
    updated_at DATETIME NULL COMMENT '最近更新时间'
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='商品表'`,
  orders: `CREATE TABLE IF NOT EXISTS orders (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY COMMENT '订单ID',
    order_no VARCHAR(32) NOT NULL COMMENT '订单编号',
    user_id INT NOT NULL COMMENT '下单用户ID（关联 users.id）',
    product_id INT NOT NULL COMMENT '商品ID（关联 products.id）',
    quantity INT NOT NULL DEFAULT 1 COMMENT '购买数量',
    amount DECIMAL(10,2) NULL COMMENT '订单金额（元）',
    status VARCHAR(20) NOT NULL DEFAULT 'pending' COMMENT '状态：pending/paid/shipped/completed/cancelled',
    remark VARCHAR(100) NULL COMMENT '备注',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '下单时间',
    updated_at DATETIME NULL COMMENT '最近状态时间'
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='订单表'`,
  employees: `CREATE TABLE IF NOT EXISTS employees (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY COMMENT '员工ID',
    name VARCHAR(50) NOT NULL COMMENT '姓名',
    email VARCHAR(100) NULL COMMENT '邮箱',
    phone VARCHAR(20) NULL COMMENT '手机号',
    idcard VARCHAR(18) NULL COMMENT '证件号',
    department VARCHAR(50) NULL COMMENT '部门',
    salary DECIMAL(10,2) NULL COMMENT '月薪（元）',
    hired_at DATE NULL COMMENT '入职日期'
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='员工表（演示敏感数据识别，均为假数据）'`,
  login_logs: `CREATE TABLE IF NOT EXISTS login_logs (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY COMMENT '日志ID',
    username VARCHAR(64) NOT NULL COMMENT '登录账号',
    ip VARCHAR(45) NULL COMMENT '来源IP',
    success TINYINT NOT NULL DEFAULT 1 COMMENT '是否成功：1/0',
    user_agent VARCHAR(255) NULL COMMENT '客户端',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '登录时间'
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='登录日志表'`,
};

async function insertRows(table, rows) {
  if (!rows.length) return 0;
  const keys = Object.keys(rows[0]);
  const sql = `INSERT INTO \`${table}\` (${keys.map((k) => `\`${k}\``).join(', ')}) VALUES ${rows.map(() => `(${keys.map(() => '?').join(', ')})`).join(', ')}`;
  const params = rows.flatMap((r) => keys.map((k) => r[k]));
  const [ret] = await pool.query(sql, params);
  return ret.affectedRows;
}

console.log('开始创建演示表...');
for (const [name, ddl] of Object.entries(DDL)) {
  await pool.query(`DROP TABLE IF EXISTS \`${name}\``);
  await pool.query(ddl);
}
await insertRows('products', products);
await insertRows('orders', orders);
await insertRows('employees', employees);
await insertRows('login_logs', loginLogs);
console.log(`完成：products=${products.length} 行, orders=${orders.length} 行, employees=${employees.length} 行, login_logs=${loginLogs.length} 行`);

const [counts] = await pool.query(`SELECT TABLE_NAME, TABLE_ROWS FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() ORDER BY TABLE_NAME`);
console.log('当前库内表：', counts.map((r) => `${r.TABLE_NAME}(${r.TABLE_ROWS})`).join(', '));
await pool.end();
