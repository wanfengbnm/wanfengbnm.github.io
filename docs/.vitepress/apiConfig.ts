// 共享 API 配置 — 修改此文件即可切换后端地址
// 本地开发时自动使用 Vite 代理，无需修改

function getApiOrigin(): string {
  if (typeof window === 'undefined') return '';
  // 本地开发 — 通过 Vite proxy 转发到 localhost:3001
  if (window.location.hostname === 'localhost') return '';
  // 生产环境 — Cloudflare Tunnel 地址
  return 'https://api.wfbnm.xyz';
}

export const API_ORIGIN = getApiOrigin();
