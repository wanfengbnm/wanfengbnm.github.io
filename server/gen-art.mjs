// 生成主页用的矢量插画：5 张轮番横幅 + 5 张功能模拟界面图
// 运行：node server/gen-art.mjs（输出到 docs/public/art/）
import { writeFileSync, mkdirSync, unlinkSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const OUT = resolve(dirname(fileURLToPath(import.meta.url)), '../docs/public/art');
mkdirSync(OUT, { recursive: true });

const FONT = `'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif`;
const gridLines = (w, h, gap = 80, color = 'rgba(148,163,184,0.10)') => {
  let s = '';
  for (let x = gap; x < w; x += gap) s += `<line x1="${x}" y1="0" x2="${x}" y2="${h}" stroke="${color}"/>`;
  for (let y = gap; y < h; y += gap) s += `<line x1="0" y1="${y}" x2="${w}" y2="${y}" stroke="${color}"/>`;
  return s;
};
const cylinder = (x, y, w, h, body, lid, op = 1) => `
  <g opacity="${op}">
    <path d="M ${x - w / 2} ${y} v ${h} a ${w / 2} 16 0 0 0 ${w} 0 v ${-h}" fill="${body}" stroke="${lid}" stroke-width="2"/>
    <ellipse cx="${x}" cy="${y}" rx="${w / 2}" ry="16" fill="${lid}"/>
    <ellipse cx="${x}" cy="${y + h}" rx="${w / 2}" ry="16" fill="none" stroke="${lid}" stroke-width="2" opacity="0.7"/>
  </g>`;
const windowChrome = (w, title, barFill = '#f1f5f9') => `
  <rect width="${w}" height="44" rx="14" fill="${barFill}"/>
  <rect y="24" width="${w}" height="20" fill="${barFill}"/>
  <circle cx="24" cy="22" r="6" fill="#ff5f57"/><circle cx="44" cy="22" r="6" fill="#febc2e"/><circle cx="64" cy="22" r="6" fill="#28c840"/>
  <text x="86" y="27" font-family=${JSON.stringify(FONT)} font-size="13.5" fill="#64748b">${title}</text>`;
const textLine = (x, y, w, h = 10, color = '#e2e8f0', rx = 5) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="${color}"/>`;

// ================= 轮番横幅（1600×686） =================
const heroes = [
  {
    name: 'hero-1', // 数据库管理
    bg: ['#0f172a', '#1e3a5f'],
    art: `
      ${cylinder(1180, 210, 150, 210, '#1d4ed8', '#60a5fa')}
      ${cylinder(1330, 250, 150, 240, '#2563eb', '#93c5fd', 0.9)}
      ${cylinder(1030, 290, 120, 160, '#1e40af', '#3b82f6', 0.75)}
      <rect x="1090" y="500" width="330" height="14" rx="7" fill="#334155"/>
      <rect x="1090" y="526" width="240" height="14" rx="7" fill="#1e293b"/>
      <circle cx="320" cy="150" r="70" fill="none" stroke="#3b82f6" stroke-width="2" opacity="0.5"/>
      <circle cx="480" cy="520" r="110" fill="none" stroke="#3b82f6" stroke-width="2" opacity="0.3"/>`,
  },
  {
    name: 'hero-2', // 结构图
    bg: ['#0c4a6e', '#0369a1'],
    art: `
      <g font-family=${JSON.stringify(FONT)}>
        <g transform="translate(1010,190)">
          <rect width="200" height="120" rx="10" fill="#0f172a" stroke="#38bdf8" stroke-width="2"/>
          <rect width="200" height="34" rx="10" fill="#0284c7"/><rect y="20" width="200" height="14" fill="#0284c7"/>
          <text x="100" y="23" text-anchor="middle" font-size="15" fill="#fff" font-weight="600">users</text>
          <text x="16" y="58" font-size="13" fill="#bae6fd">id</text><text x="16" y="82" font-size="13" fill="#bae6fd">name</text><text x="16" y="106" font-size="13" fill="#bae6fd">email</text>
        </g>
        <g transform="translate(1300,330)">
          <rect width="200" height="120" rx="10" fill="#0f172a" stroke="#38bdf8" stroke-width="2"/>
          <rect width="200" height="34" rx="10" fill="#0284c7"/><rect y="20" width="200" height="14" fill="#0284c7"/>
          <text x="100" y="23" text-anchor="middle" font-size="15" fill="#fff" font-weight="600">orders</text>
          <text x="16" y="58" font-size="13" fill="#bae6fd">order_no</text><text x="16" y="82" font-size="13" fill="#bae6fd">user_id</text><text x="16" y="106" font-size="13" fill="#bae6fd">amount</text>
        </g>
        <path d="M 1110 310 C 1110 380, 1350 260, 1360 330" fill="none" stroke="#7dd3fc" stroke-width="2.5"/>
        <polygon points="1355,322 1368,332 1352,340" fill="#7dd3fc"/>
      </g>
      <circle cx="420" cy="470" r="120" fill="none" stroke="#38bdf8" stroke-width="2" opacity="0.35"/>`,
  },
  {
    name: 'hero-3', // 图表
    bg: ['#312e81', '#4338ca'],
    art: `
      <g transform="translate(1010,170)">
        <rect x="0" y="330" width="500" height="3" fill="#c7d2fe"/>
        ${[150, 220, 180, 290, 240, 330].map((h, i) => `<rect x="${20 + i * 82}" y="${330 - h}" width="52" height="${h}" rx="8" fill="${i % 2 ? '#818cf8' : '#a5b4fc'}"/>`).join('')}
        <polyline points="46,120 128,60 210,95 292,40 374,70 456,25" fill="none" stroke="#fbbf24" stroke-width="4"/>
        ${[46, 120, 128, 60, 210, 95, 292, 40, 374, 70, 456, 25].map((v, i, a) => i % 2 === 0 ? '' : `<circle cx="${a[i - 1]}" cy="${a[i]}" r="6" fill="#fde68a"/>`).join('')}
      </g>
      <circle cx="380" cy="180" r="130" fill="none" stroke="#a5b4fc" stroke-width="2" opacity="0.4"/>`,
  },
  {
    name: 'hero-4', // 数据治理
    bg: ['#064e3b', '#047857'],
    art: `
      <path d="M 1250 150 l 130 52 v 140 c 0 90 -65 150 -130 180 c -65 -30 -130 -90 -130 -180 v -140 z" fill="#065f46" stroke="#6ee7b7" stroke-width="3"/>
      <path d="M 1200 330 l 45 45 l 90 -95" fill="none" stroke="#6ee7b7" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/>
      <g transform="translate(1000,200)">
        <rect width="190" height="16" rx="8" fill="#34d399" opacity="0.75"/><rect y="34" width="150" height="16" rx="8" fill="#34d399" opacity="0.5"/><rect y="68" width="170" height="16" rx="8" fill="#34d399" opacity="0.35"/>
      </g>
      <circle cx="420" cy="170" r="90" fill="none" stroke="#34d399" stroke-width="2" opacity="0.4"/>`,
  },
  {
    name: 'hero-5', // 多端
    bg: ['#1e1b4b', '#3730a3'],
    art: `
      <g fill="none" stroke="#a5b4fc" stroke-width="3">
        <rect x="1050" y="200" width="260" height="170" rx="10" fill="#312e81"/>
        <rect x="1105" y="370" width="150" height="100" rx="10" fill="#312e81"/>
        <rect x="1320" y="330" width="80" height="140" rx="12" fill="#312e81"/>
        <line x1="1180" y1="370" x2="1180" y2="382"/><line x1="1150" y1="470" x2="1210" y2="470"/>
      </g>
      <g fill="#c7d2fe" opacity="0.9">
        <rect x="1070" y="222" width="90" height="10" rx="5"/><rect x="1070" y="244" width="130" height="10" rx="5" opacity="0.6"/><rect x="1070" y="266" width="110" height="10" rx="5" opacity="0.4"/>
        <rect x="1120" y="392" width="60" height="9" rx="4.5"/><rect x="1120" y="410" width="80" height="9" rx="4.5" opacity="0.6"/>
        <rect x="1334" y="350" width="50" height="8" rx="4"/><rect x="1334" y="366" width="38" height="8" rx="4" opacity="0.6"/>
      </g>
      <path d="M 1180 480 C 1180 560, 1360 480, 1360 540" fill="none" stroke="#818cf8" stroke-width="3" stroke-dasharray="8 8"/>
      <circle cx="400" cy="480" r="100" fill="none" stroke="#818cf8" stroke-width="2" opacity="0.4"/>`,
  },
];
heroes.forEach((h, i) => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="686" viewBox="0 0 1600 686">
  <defs><linearGradient id="bg${i}" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0%" stop-color="${h.bg[0]}"/><stop offset="100%" stop-color="${h.bg[1]}"/>
  </linearGradient></defs>
  <rect width="1600" height="686" fill="url(#bg${i})"/>
  ${gridLines(1600, 686)}
  ${h.art}
</svg>`;
  writeFileSync(resolve(OUT, `${h.name}.svg`), svg);
});

// ================= 功能模拟界面图（1200×750） =================
const featureBg = (accent) => `
  <defs><linearGradient id="fbg" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0%" stop-color="#f8fafc"/><stop offset="100%" stop-color="${accent}22"/>
  </linearGradient></defs>
  <rect width="1200" height="750" fill="url(#fbg)"/>
  ${gridLines(1200, 750)}`;

// 1. 管理控制台
const featureConsole = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="750" viewBox="0 0 1200 750">
  ${featureBg('#dbeafe')}
  <g transform="translate(60,55)">
    ${windowChrome(1080, '数据库管理控制台 — mysql_mulpro', '#1e293b')}
    <rect y="44" width="1080" height="596" rx="0" fill="#f8fafc"/>
    <rect y="44" width="200" height="596" fill="#1e293b"/>
    <rect y="44" width="6" height="596" fill="#3b82f6"/>
    <g fill="#475569">
      <rect x="24" y="80" width="120" height="12" rx="6" fill="#3b82f6"/>
      <rect x="24" y="118" width="100" height="12" rx="6"/><rect x="24" y="156" width="110" height="12" rx="6"/>
      <rect x="24" y="194" width="90" height="12" rx="6"/><rect x="24" y="232" width="105" height="12" rx="6"/>
    </g>
    <g font-family=${JSON.stringify(FONT)} font-size="13" fill="#475569">
      <rect x="232" y="76" width="330" height="30" rx="6" fill="#fff" stroke="#e2e8f0"/>
      <rect x="600" y="76" width="92" height="30" rx="6" fill="#3b82f6"/>
      <rect x="704" y="76" width="92" height="30" rx="6" fill="#fff" stroke="#e2e8f0"/>
      <rect x="232" y="130" width="656" height="36" fill="#eef2ff"/>
      <text x="248" y="153" font-weight="600">id</text><text x="330" y="153" font-weight="600">name</text><text x="470" y="153" font-weight="600">email</text><text x="640" y="153" font-weight="600">status</text>
      ${[0, 1, 2, 3, 4].map((r) => `<rect x="232" y="${170 + r * 44}" width="656" height="36" fill="${r % 2 ? '#fff' : '#f8fafc'}" stroke="#f1f5f9"/>`).join('')}
      <text x="248" y="194">1</text><text x="330" y="194">管理员</text><text x="470" y="194">admin@demo.test</text><text x="640" y="194">active</text>
      <text x="248" y="238">2</text><text x="330" y="238">张三</text><text x="470" y="238">zhangsan@demo.test</text><text x="640" y="238">active</text>
      <text x="248" y="282">3</text><text x="330" y="282">李四</text><text x="470" y="282">lisi@demo.test</text><text x="640" y="282">active</text>
    </g>
    <g transform="translate(930,130)">
      <rect width="180" height="86" rx="10" fill="#fff" stroke="#e2e8f0"/>
      <text x="16" y="38" font-family=${JSON.stringify(FONT)} font-size="24" font-weight="700" fill="#1e293b">6</text>
      <text x="16" y="64" font-family=${JSON.stringify(FONT)} font-size="12" fill="#94a3b8">数据表</text>
      <rect y="102" width="180" height="86" rx="10" fill="#fff" stroke="#e2e8f0"/>
      <text x="16" y="140" font-family=${JSON.stringify(FONT)} font-size="24" font-weight="700" fill="#16a34a">正常</text>
      <text x="16" y="166" font-family=${JSON.stringify(FONT)} font-size="12" fill="#94a3b8">连接状态</text>
    </g>
    <g transform="translate(930,350)">
      <rect width="180" height="180" rx="10" fill="#fff" stroke="#e2e8f0"/>
      ${[60, 100, 80, 130].map((h, i) => `<rect x="${22 + i * 40}" y="${150 - h}" width="26" height="${h}" rx="5" fill="${['#3b82f6', '#60a5fa', '#93c5fd', '#2563eb'][i]}"/>`).join('')}
    </g>
  </g>
</svg>`;

// 2. 结构图
const featureDiagram = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="750" viewBox="0 0 1200 750">
  ${featureBg('#dbeafe')}
  <defs><marker id="arr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto"><path d="M 0 0 L 10 5 L 0 10 z" fill="#2563eb"/></marker></defs>
  <g transform="translate(60,55)">
    ${windowChrome(1080, '数据库结构图 — sqlserver', '#e2e8f0')}
    <rect y="44" width="1080" height="596" fill="#fbfdff"/>
    <g font-family=${JSON.stringify(FONT)}>
      <g transform="translate(90,120)">
        <rect width="240" height="170" rx="12" fill="#fff" stroke="#bfdbfe" stroke-width="2"/>
        <rect width="240" height="46" rx="12" fill="#2563eb"/><rect y="26" width="240" height="20" fill="#2563eb"/>
        <text x="120" y="30" text-anchor="middle" font-size="16" fill="#fff" font-weight="700">users</text>
        ${['id · PK', 'name', 'email', 'phone'].map((t, i) => `<text x="20" y="${78 + i * 26}" font-size="13.5" fill="#475569">${t}</text>`).join('')}
      </g>
      <g transform="translate(470,300)">
        <rect width="240" height="170" rx="12" fill="#fff" stroke="#bfdbfe" stroke-width="2"/>
        <rect width="240" height="46" rx="12" fill="#0ea5e9"/><rect y="26" width="240" height="20" fill="#0ea5e9"/>
        <text x="120" y="30" text-anchor="middle" font-size="16" fill="#fff" font-weight="700">orders</text>
        ${['id · PK', 'order_no', 'user_id · FK', 'amount'].map((t, i) => `<text x="20" y="${78 + i * 26}" font-size="13.5" fill="#475569">${t}</text>`).join('')}
      </g>
      <g transform="translate(850,130)">
        <rect width="240" height="170" rx="12" fill="#fff" stroke="#bfdbfe" stroke-width="2"/>
        <rect width="240" height="46" rx="12" fill="#8b5cf6"/><rect y="26" width="240" height="20" fill="#8b5cf6"/>
        <text x="120" y="30" text-anchor="middle" font-size="16" fill="#fff" font-weight="700">products</text>
        ${['id · PK', 'name', 'price', 'stock'].map((t, i) => `<text x="20" y="${78 + i * 26}" font-size="13.5" fill="#475569">${t}</text>`).join('')}
      </g>
      <path d="M 330 240 C 400 340, 440 300, 470 340" fill="none" stroke="#2563eb" stroke-width="2.5" marker-end="url(#arr)"/>
      <path d="M 710 350 C 790 320, 800 260, 850 230" fill="none" stroke="#2563eb" stroke-width="2.5" marker-end="url(#arr)" stroke-dasharray="7 6"/>
    </g>
  </g>
</svg>`;

// 3. 数据图表
const featureCharts = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="750" viewBox="0 0 1200 750">
  ${featureBg('#e0e7ff')}
  <g transform="translate(60,55)">
    ${windowChrome(1080, '数据可视化图表 — DataChartPanel', '#e2e8f0')}
    <rect y="44" width="1080" height="596" fill="#ffffff"/>
    <g transform="translate(50,110)">
      <rect width="470" height="300" rx="12" fill="#f8fafc" stroke="#e2e8f0"/>
      <rect x="0" y="270" width="470" height="2" fill="#cbd5e1"/>
      ${[110, 190, 150, 240].map((h, i) => `<rect x="${50 + i * 105}" y="${270 - h}" width="58" height="${h}" rx="7" fill="${['#2563eb', '#22c55e', '#f59e0b', '#8b5cf6'][i]}"/>`).join('')}
      <text x="235" y="298" text-anchor="middle" font-family=${JSON.stringify(FONT)} font-size="12.5" fill="#94a3b8">柱状图</text>
    </g>
    <g transform="translate(600,110)">
      <rect width="470" height="300" rx="12" fill="#f8fafc" stroke="#e2e8f0"/>
      <circle cx="160" cy="150" r="85" fill="none" stroke="#2563eb" stroke-width="38" stroke-dasharray="267 534" transform="rotate(-90 160 150)"/>
      <circle cx="160" cy="150" r="85" fill="none" stroke="#22c55e" stroke-width="38" stroke-dasharray="160 534" stroke-dashoffset="-267" transform="rotate(-90 160 150)"/>
      <circle cx="160" cy="150" r="85" fill="none" stroke="#f59e0b" stroke-width="38" stroke-dasharray="107 534" stroke-dashoffset="-427" transform="rotate(-90 160 150)"/>
      ${[['#2563eb', '组 A', 60], ['#22c55e', '组 B', 110], ['#f59e0b', '组 C', 160]].map(([c, t, y]) => `<rect x="300" y="${y}" width="14" height="14" rx="3" fill="${c}"/><text x="322" y="${y + 12}" font-family=${JSON.stringify(FONT)} font-size="13.5" fill="#475569">${t}</text>`).join('')}
      <text x="235" y="298" text-anchor="middle" font-family=${JSON.stringify(FONT)} font-size="12.5" fill="#94a3b8">饼图</text>
    </g>
    <g transform="translate(255,470)">
      <rect width="690" height="180" rx="12" fill="#f8fafc" stroke="#e2e8f0"/>
      <rect x="0" y="150" width="690" height="2" fill="#cbd5e1"/>
      <polyline points="40,120 150,80 260,100 370,50 480,70 590,30 650,45" fill="none" stroke="#2563eb" stroke-width="3.5"/>
      ${[[40, 120], [150, 80], [260, 100], [370, 50], [480, 70], [590, 30], [650, 45]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="5.5" fill="#fff" stroke="#2563eb" stroke-width="3"/>`).join('')}
    </g>
  </g>
</svg>`;

// 4. 日常问题
const featureNotes = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="750" viewBox="0 0 1200 750">
  ${featureBg('#fef3c7')}
  <g transform="translate(150,70)">
    ${windowChrome(900, '日常问题 · 排查记录', '#fef9c3')}
    <rect y="44" width="900" height="546" fill="#fffefb"/>
    <rect x="46" y="90" width="420" height="22" rx="8" fill="#fde047"/>
    ${[[46, 140, 720], [46, 172, 680], [46, 204, 710]].map(([x, y, w]) => textLine(x, y, w, 12, '#e7e5c8')).join('')}
    <g font-family=${JSON.stringify(FONT)}>
      ${[['检查数据库连接配置', true], ['确认字段类型与索引', true], ['回滚近期变更', false]].map(([t, ok], i) => `
        <rect x="46" y="${250 + i * 52}" width="26" height="26" rx="6" fill="${ok ? '#22c55e' : '#fff'}" stroke="${ok ? '#22c55e' : '#d1d5db'}" stroke-width="2"/>
        ${ok ? '<path d="M 52 263 l 6 7 l 12 -14" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round"/>' : ''}
        <text x="86" y="${269 + i * 52}" font-size="15" fill="#57534e">${t}</text>`).join('')}
    </g>
    <g transform="translate(640,250)">
      <path d="M 30 0 L 60 52 L 0 52 z" fill="none" stroke="#f59e0b" stroke-width="4" stroke-linejoin="round"/>
      <line x1="30" y1="18" x2="30" y2="36" stroke="#f59e0b" stroke-width="4" stroke-linecap="round"/>
      <circle cx="30" cy="45" r="2.6" fill="#f59e0b"/>
    </g>
    ${[[46, 480, 760], [46, 512, 700]].map(([x, y, w]) => textLine(x, y, w, 12, '#e7e5c8')).join('')}
  </g>
</svg>`;

// 5. 文档研究
const featureDocs = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="750" viewBox="0 0 1200 750">
  ${featureBg('#e2e8f0')}
  <g transform="translate(160,90)">
    ${windowChrome(880, '文档研究 · 阅读笔记', '#e2e8f0')}
    <rect y="44" width="880" height="536" fill="#f8fafc"/>
    <g transform="translate(120,110)">
      <rect x="0" y="0" width="300" height="400" rx="8" fill="#fff" stroke="#e2e8f0"/>
      <rect x="312" y="0" width="300" height="400" rx="8" fill="#fff" stroke="#e2e8f0"/>
      <rect x="-16" y="-14" width="120" height="34" rx="8" fill="#2563eb"/>
      <text x="12" y="9" font-family=${JSON.stringify(FONT)} font-size="14" fill="#fff" font-weight="600">研究笔记</text>
      ${[0, 1, 2, 3, 4, 5].map((i) => textLine(24, 40 + i * 42, 250 - (i % 3) * 40, 11, '#dbe3f0')).join('')}
      ${[0, 1, 2, 3, 4, 5].map((i) => textLine(336, 40 + i * 42, 250 - ((i + 1) % 3) * 40, 11, '#dbe3f0')).join('')}
      <rect x="312" y="0" width="14" height="56" fill="#ef4444"/>
      <g transform="translate(560,320) rotate(40)">
        <rect width="26" height="150" rx="6" fill="#f59e0b"/>
        <path d="M 0 150 L 13 178 L 26 150 z" fill="#fbbf24"/>
        <rect y="18" width="26" height="10" fill="#d97706"/>
      </g>
    </g>
  </g>
</svg>`;

// 2. 可视化工具（合并版：结构图 + 图表）
const featureViz = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="750" viewBox="0 0 1200 750">
  ${featureBg('#dbeafe')}
  <defs><marker id="arr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto"><path d="M 0 0 L 10 5 L 0 10 z" fill="#2563eb"/></marker></defs>
  <g transform="translate(60,55)">
    ${windowChrome(1080, '数据库可视化工具 — 结构图 + 统计图表', '#e2e8f0')}
    <rect y="44" width="1080" height="596" fill="#fbfdff"/>
    <g font-family=${JSON.stringify(FONT)}>
      <g transform="translate(60,120)">
        <rect width="210" height="150" rx="10" fill="#fff" stroke="#bfdbfe" stroke-width="2"/>
        <rect width="210" height="40" rx="10" fill="#2563eb"/><rect y="22" width="210" height="18" fill="#2563eb"/>
        <text x="105" y="26" text-anchor="middle" font-size="14" fill="#fff" font-weight="700">users</text>
        ${['id · PK', 'name', 'email'].map((t, i) => `<text x="18" y="${70 + i * 25}" font-size="12.5" fill="#475569">${t}</text>`).join('')}
      </g>
      <g transform="translate(330,240)">
        <rect width="210" height="150" rx="10" fill="#fff" stroke="#bfdbfe" stroke-width="2"/>
        <rect width="210" height="40" rx="10" fill="#0ea5e9"/><rect y="22" width="210" height="18" fill="#0ea5e9"/>
        <text x="105" y="26" text-anchor="middle" font-size="14" fill="#fff" font-weight="700">orders</text>
        ${['id · PK', 'order_no', 'amount'].map((t, i) => `<text x="18" y="${70 + i * 25}" font-size="12.5" fill="#475569">${t}</text>`).join('')}
      </g>
      <path d="M 165 270 C 165 330, 380 210, 385 245" fill="none" stroke="#2563eb" stroke-width="2.5" marker-end="url(#arr)"/>
    </g>
    <g transform="translate(640,120)">
      <rect width="440" height="150" rx="10" fill="#f8fafc" stroke="#e2e8f0"/>
      <rect x="0" y="120" width="440" height="2" fill="#cbd5e1"/>
      ${[70, 105, 85, 115].map((h, i) => `<rect x="${44 + i * 100}" y="${120 - h}" width="46" height="${h}" rx="6" fill="${['#2563eb', '#22c55e', '#f59e0b', '#8b5cf6'][i]}"/>`).join('')}
    </g>
    <g transform="translate(640,320)">
      <rect width="440" height="150" rx="10" fill="#f8fafc" stroke="#e2e8f0"/>
      <circle cx="90" cy="75" r="48" fill="none" stroke="#2563eb" stroke-width="22" stroke-dasharray="150 302" transform="rotate(-90 90 75)"/>
      <circle cx="90" cy="75" r="48" fill="none" stroke="#22c55e" stroke-width="22" stroke-dasharray="90 302" stroke-dashoffset="-150" transform="rotate(-90 90 75)"/>
      ${[['#2563eb', '系列 A', 50], ['#22c55e', '系列 B', 92]].map(([c, t, y]) => `<rect x="180" y="${y}" width="13" height="13" rx="3" fill="${c}"/><text x="200" y="${y + 11}" font-family=${JSON.stringify(FONT)} font-size="12.5" fill="#475569">${t}</text>`).join('')}
      <polyline points="330,110 370,70 410,85" fill="none" stroke="#f59e0b" stroke-width="3"/>
    </g>
  </g>
</svg>`;

const features = [
    { name: 'feature-console', svg: featureConsole },
    { name: 'feature-viz', svg: featureViz },
    { name: 'feature-notes', svg: featureNotes },
    { name: 'feature-docs', svg: featureDocs },
];
features.forEach((f) => writeFileSync(resolve(OUT, `${f.name}.svg`), f.svg));

// 清理旧素材
for (const old of ['feature-diagram.svg', 'feature-charts.svg']) {
  try { unlinkSync(resolve(OUT, old)); } catch {}
}

console.log(`已生成 ${heroes.length} 张轮番横幅 + ${features.length} 张功能插画 → ${OUT}`);
