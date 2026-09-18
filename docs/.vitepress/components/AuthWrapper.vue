<template>
  <div class="container">

    <!-- 背景装饰：网格 + 光晕 + 光点 -->
    <div class="bg-grid" aria-hidden="true"></div>
    <div class="bg-glow bg-glow-a" aria-hidden="true"></div>
    <div class="bg-glow bg-glow-b" aria-hidden="true"></div>
    <div class="particles" aria-hidden="true">
      <i class="particle p1"></i><i class="particle p2"></i><i class="particle p3"></i>
      <i class="particle p4"></i><i class="particle p5"></i><i class="particle p6"></i>
    </div>

    <!-- 漂浮功能标签（多端主题） -->
    <div class="float-chips" aria-hidden="true">
      <span class="chip chip-1">MySQL</span>
      <span class="chip chip-2">SQL Server</span>
      <span class="chip chip-3">SELECT * FROM users</span>
      <span class="chip chip-4">📊 数据可视化</span>
      <span class="chip chip-5">多端管理</span>
    </div>

    <!-- 验证中 -->
    <div v-if="!authReady" class="auth-card single">
      <div class="state-icon">
        <span class="spinner"></span>
      </div>
      <h2>验证中...</h2>
      <p class="state-desc">正在检查登录会话</p>
    </div>

    <!-- 未登录 -->
    <div v-else-if="!isLogin" class="auth-card">

      <!-- 左侧：品牌与功能介绍 -->
      <div class="intro-pane">
        <div class="brand">
          <div class="brand-icon">🗄️</div>
          <h2 class="brand-title">多端数据库管理</h2>
          <p class="brand-sub">跨平台数据管理与可视化 · 管理控制台</p>
        </div>

        <ul class="feature-list">
          <li class="feat">
            <span class="feat-icon">🔄</span>
            <div class="feat-text"><b>多端数据库切换</b><span>连接池按库缓存，各端互不干扰</span></div>
          </li>
          <li class="feat">
            <span class="feat-icon">🗺️</span>
            <div class="feat-text"><b>表结构可视化</b><span>SQL Server 结构图一键生成</span></div>
          </li>
          <li class="feat">
            <span class="feat-icon">⌨️</span>
            <div class="feat-text"><b>SQL 编辑器</b><span>执行历史与快捷键运行</span></div>
          </li>
          <li class="feat">
            <span class="feat-icon">📊</span>
            <div class="feat-text"><b>图表与统计</b><span>数据总览一目了然</span></div>
          </li>
        </ul>

        <div class="terminal">
          <div class="terminal-bar">
            <i class="t-dot t-dot-r"></i><i class="t-dot t-dot-y"></i><i class="t-dot t-dot-g"></i>
            <span>admin@multi-db — mysql</span>
          </div>
          <pre><span class="t-dim">$ mysql -u admin -p</span>
Enter password: ********
mysql&gt; <span class="t-kw">SHOW</span> <span class="t-kw">DATABASES</span>;
+----------------+
| mysql_mulpro   |
| mysql_web      |
+----------------+
<span class="t-ok">2 rows in set (0.00 sec)</span></pre>
        </div>
      </div>

      <!-- 右侧：登录表单 -->
      <div class="form-pane">
        <h2 class="form-title">管理员登录</h2>
        <p class="form-desc">请输入凭据以进入管理控制台</p>

        <div class="field">
          <svg class="field-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
          </svg>
          <input v-model="username" placeholder="管理员账号" autocomplete="username" @keyup.enter="login" />
        </div>

        <div class="field">
          <svg class="field-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
          </svg>
          <input
            v-model="password"
            :type="showPass ? 'text' : 'password'"
            placeholder="登录密码"
            autocomplete="current-password"
            @keyup.enter="login"
          />
          <button class="eye-btn" type="button" tabindex="-1" :title="showPass ? '隐藏密码' : '显示密码'" @click="showPass = !showPass">
            <svg v-if="!showPass" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z"/><circle cx="12" cy="12" r="3"/>
            </svg>
            <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/>
            </svg>
          </button>
        </div>

        <button class="login-btn" @click="login" :disabled="loggingIn">
          <span v-if="loggingIn" class="btn-spinner"></span>
          {{ loggingIn ? '登录中…' : '登  录' }}
        </button>

        <p class="error" v-if="errorMsg">{{ errorMsg }}</p>

        <div class="login-foot">
          <span>🔐 密码加密校验</span>
          <span class="foot-dot"></span>
          <span>Token 会话保护</span>
        </div>
        <a class="back-home" href="/">← 返回站点首页</a>
      </div>
    </div>

    <!-- 已登录 -->
    <div v-else class="auth-card single">
      <div class="state-icon ok">✓</div>
      <h2>欢迎回来，{{ username }}</h2>
      <p class="state-desc">已登录，正在跳转至多端数据库管理...</p>
      <div class="logout-btn" @click="logout">退出登录</div>
    </div>

  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'

const isLogin = ref(false)
const authReady = ref(false)
const username = ref('')
const password = ref('')
const errorMsg = ref('')
const showPass = ref(false)
const loggingIn = ref(false)

// 登录页挂载期间给 body 打标记，用于隐藏站点导航/页脚/大纲遮罩；
// 组件卸载（SPA 离开本页）即移除，避免全局样式泄漏到其他页面
const BODY_FLAG = 'dbm-login-active'

// 检查登录状态
const checkLogin = () => {
  const token = localStorage.getItem('admin_token')
  const expire = localStorage.getItem('expire')

  if (token && expire && Date.now() < Number(expire)) {
    // 已登录，直接跳转管理后台
    window.location.href = '/Management/'
    return
  }
  localStorage.removeItem('admin_token')
  localStorage.removeItem('expire')
  isLogin.value = false
  authReady.value = true
}

onMounted(() => {
  document.body.classList.add(BODY_FLAG)
  checkLogin()

  // 自动填充账号
  const lastUser = localStorage.getItem('last_username')
  if (lastUser) {
    username.value = lastUser
  }
})

onUnmounted(() => {
  document.body.classList.remove(BODY_FLAG)
})

// 登录
const login = async () => {
  if (loggingIn.value) return
  errorMsg.value = ''

  if (!username.value || !password.value) {
    errorMsg.value = '请输入账号和密码'
    return
  }

  // 构造 API 地址
  const base = window.location.hostname === 'localhost' ? '' : 'https://api.wfbnm.xyz'
  const url = `${base}/api/auth/login`

  loggingIn.value = true
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: username.value, password: password.value }),
    })
    const data = await res.json()

    if (res.ok && data.token) {
      // 保存账号和 token
      localStorage.setItem('last_username', username.value)
      localStorage.setItem('admin_token', data.token)
      localStorage.setItem('expire', String(Date.now() + 30 * 60 * 1000))

      // 直接跳转管理后台
      window.location.href = '/Management/'
    } else {
      errorMsg.value = data.message || '账号或密码错误'
    }
  } catch (e) {
    errorMsg.value = '连接服务器失败，请检查网络'
  } finally {
    loggingIn.value = false
  }
}

// 退出登录
const logout = () => {
  localStorage.removeItem('admin_token')
  localStorage.removeItem('expire')

  isLogin.value = false
  password.value = ''
  errorMsg.value = '已退出登录'
}
</script>

<style scoped>
/* 登录页为全屏控制台风格：仅在 body 带有登录页标记时隐藏站点导航/页脚/大纲遮罩，
   样式即使被其他页面加载也不会生效（离开登录页即恢复导航） */
:global(body.dbm-login-active .VPNav),
:global(body.dbm-login-active .VPFooter),
:global(body.dbm-login-active .aside-curtain) { display: none !important; }

/* ========== 全屏容器（蓝色调） ========== */
.container {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 32px 20px;
  box-sizing: border-box;
  z-index: 1;
  overflow: hidden;
  color-scheme: dark;
  background: radial-gradient(1200px 800px at 50% -10%, #2b4d96 0%, #1c3367 48%, #142452 100%);
  font-family: 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif;
}

/* 网格底纹（向边缘淡出） */
.bg-grid {
  position: absolute;
  inset: 0;
  background-image:
    linear-gradient(rgba(120, 170, 255, 0.09) 1px, transparent 1px),
    linear-gradient(90deg, rgba(120, 170, 255, 0.09) 1px, transparent 1px);
  background-size: 40px 40px;
  -webkit-mask-image: radial-gradient(ellipse at center, #000 25%, transparent 72%);
  mask-image: radial-gradient(ellipse at center, #000 25%, transparent 72%);
  pointer-events: none;
}

/* 蓝色光晕 */
.bg-glow {
  position: absolute;
  width: 560px;
  height: 560px;
  border-radius: 50%;
  filter: blur(100px);
  pointer-events: none;
}
.bg-glow-a {
  top: -170px;
  left: 6%;
  background: radial-gradient(circle, rgba(59, 130, 246, 0.42), transparent 70%);
}
.bg-glow-b {
  bottom: -190px;
  right: 5%;
  background: radial-gradient(circle, rgba(56, 189, 248, 0.3), transparent 70%);
}

/* 漂浮光点 */
.particles { position: absolute; inset: 0; pointer-events: none; }
.particle {
  position: absolute;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: rgba(147, 197, 253, 0.6);
  box-shadow: 0 0 12px rgba(147, 197, 253, 0.9);
  animation: drift 8s ease-in-out infinite;
}
.p1 { top: 16%; left: 20%; }
.p2 { top: 68%; left: 13%; animation-delay: -2s; animation-duration: 10s; }
.p3 { top: 24%; right: 18%; animation-delay: -4s; }
.p4 { bottom: 20%; right: 14%; animation-delay: -1s; animation-duration: 11s; }
.p5 { top: 42%; right: 6%; animation-delay: -5s; animation-duration: 9s; }
.p6 { bottom: 34%; left: 5%; animation-delay: -6s; }
@keyframes drift {
  0%, 100% { transform: translateY(0); opacity: 0.45; }
  50% { transform: translateY(-24px); opacity: 1; }
}

/* ========== 漂浮功能标签 ========== */
.float-chips { position: absolute; inset: 0; pointer-events: none; }
.chip {
  position: absolute;
  padding: 7px 16px;
  background: rgba(37, 66, 128, 0.75);
  border: 1px solid rgba(110, 165, 255, 0.42);
  border-radius: 999px;
  font-size: 13px;
  font-family: 'Consolas', 'Monaco', monospace;
  color: #bfdbfe;
  backdrop-filter: blur(6px);
  box-shadow: 0 6px 18px rgba(4, 12, 35, 0.45);
  animation: floaty 6s ease-in-out infinite;
  white-space: nowrap;
}
.chip-1 { top: 18%; left: 8%; }
.chip-2 { top: 27%; right: 6%; animation-delay: -1.6s; }
.chip-3 { top: 60%; left: 5%; animation-delay: -3s; }
.chip-4 { bottom: 14%; right: 9%; animation-delay: -4.4s; }
.chip-5 { bottom: 9%; left: 13%; animation-delay: -2.2s; }
@keyframes floaty {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-10px); }
}
@media (max-width: 1024px) {
  .float-chips, .particles { display: none; }
}

/* ========== 双栏登录卡片 ========== */
.auth-card {
  position: relative;
  display: grid;
  grid-template-columns: 1.08fr 1fr;
  width: 880px;
  max-width: 100%;
  border-radius: 22px;
  background: linear-gradient(165deg, rgba(41, 63, 112, 0.96), rgba(27, 43, 82, 0.96));
  border: 1px solid rgba(110, 160, 250, 0.32);
  box-shadow:
    0 30px 90px rgba(4, 12, 35, 0.6),
    inset 0 1px 0 rgba(160, 195, 255, 0.1);
  backdrop-filter: blur(12px);
  animation: cardIn 0.45s cubic-bezier(0.22, 1, 0.36, 1);
}
.auth-card.single {
  display: block;
  width: 420px;
  padding: 40px 34px 30px;
  text-align: center;
}
@keyframes cardIn {
  from { opacity: 0; transform: translateY(16px) scale(0.98); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}

/* ---- 左侧介绍栏 ---- */
.intro-pane {
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 26px;
  padding: 38px 32px;
  border-radius: 21px 0 0 21px;
  background: linear-gradient(165deg, rgba(79, 139, 255, 0.16), rgba(79, 139, 255, 0.03) 62%, transparent);
  border-right: 1px solid rgba(110, 160, 250, 0.22);
}

/* 品牌区 */
.brand { text-align: center; }
.brand-icon {
  width: 66px;
  height: 66px;
  margin: 0 auto 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 32px;
  border-radius: 19px;
  background: linear-gradient(135deg, #3b82f6, #1e40af);
  border: 1px solid rgba(147, 197, 253, 0.45);
  box-shadow: 0 12px 28px rgba(37, 99, 235, 0.45);
}
.brand-title {
  font-size: 25px;
  font-weight: 700;
  color: #f3f7ff;
  margin: 0 0 7px;
  letter-spacing: 1px;
  /* 重置 VitePress .vp-doc h2 的分隔线与内边距 */
  border: none;
  padding: 0;
}
.brand-sub {
  font-size: 15.5px;
  color: #a8bce4;
  margin: 0;
}

/* 功能列表 */
.feature-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 16px;
  text-align: left;
}
.feat { display: flex; align-items: flex-start; gap: 13px; }
.feat-icon {
  width: 40px;
  height: 40px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 19px;
  border-radius: 12px;
  background: rgba(96, 165, 250, 0.18);
  border: 1px solid rgba(110, 165, 255, 0.35);
}
.feat-text b {
  display: block;
  font-size: 16.5px;
  font-weight: 600;
  color: #e8eefb;
  margin-bottom: 4px;
}
.feat-text span {
  font-size: 14px;
  color: #93a7cd;
  line-height: 1.55;
}

/* 装饰终端窗口 */
.terminal {
  background: #0c1834;
  border: 1px solid rgba(110, 160, 250, 0.3);
  border-radius: 13px;
  overflow: hidden;
  box-shadow: 0 14px 30px rgba(4, 12, 35, 0.45);
}
.terminal-bar {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 9px 13px;
  background: rgba(110, 160, 250, 0.09);
  border-bottom: 1px solid rgba(110, 160, 250, 0.18);
}
.t-dot { width: 10px; height: 10px; border-radius: 50%; }
.t-dot-r { background: #ff5f57; }
.t-dot-y { background: #febc2e; }
.t-dot-g { background: #28c840; }
.terminal-bar span {
  margin-left: 6px;
  font-size: 11.5px;
  color: #7e93bd;
  font-family: 'Consolas', 'Monaco', monospace;
}
.terminal pre {
  margin: 0;
  padding: 13px 16px;
  font-family: 'Consolas', 'Monaco', monospace;
  font-size: 13px;
  line-height: 1.75;
  color: #c7d6f5;
  text-align: left;
  overflow-x: auto;
}
.t-dim { color: #7e93bd; }
.t-kw { color: #7dd3fc; }
.t-ok { color: #4ade80; }

/* ---- 右侧表单栏 ---- */
.form-pane {
  display: flex;
  flex-direction: column;
  justify-content: center;
  padding: 38px 36px;
}
.form-title {
  font-size: 24px;
  font-weight: 700;
  color: #f3f7ff;
  margin: 0 0 8px;
  border: none;
  padding: 0;
}
.form-desc {
  font-size: 15.5px;
  color: #a8bce4;
  margin: 0 0 26px;
}

/* ========== 输入框 ========== */
.field { position: relative; margin-bottom: 15px; text-align: left; }
.field-icon {
  position: absolute;
  left: 14px;
  top: 50%;
  transform: translateY(-50%);
  width: 18px;
  height: 18px;
  color: #7e93bd;
  pointer-events: none;
  transition: color 0.2s;
}
.field:focus-within .field-icon { color: #7db2ff; }
.field input {
  width: 100%;
  padding: 13px 44px 13px 43px;
  border: 1px solid rgba(110, 160, 250, 0.35);
  border-radius: 12px;
  background: rgba(13, 25, 52, 0.85);
  color: #eef3ff;
  font-size: 16px;
  outline: none;
  box-sizing: border-box;
  transition: border-color 0.2s, box-shadow 0.2s;
}
.field input::placeholder { color: #64789f; }
.field input:focus {
  border-color: #5a9bff;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.25);
  background: rgba(13, 25, 52, 0.95);
}

/* 密码可见切换 */
.eye-btn {
  position: absolute;
  right: 8px;
  top: 50%;
  transform: translateY(-50%);
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  border-radius: 8px;
  color: #7e93bd;
  cursor: pointer;
  transition: color 0.15s, background 0.15s;
}
.eye-btn svg { width: 18px; height: 18px; }
.eye-btn:hover { color: #bfdbfe; background: rgba(110, 165, 255, 0.12); }

/* ========== 登录按钮 ========== */
.login-btn {
  width: 100%;
  margin-top: 8px;
  padding: 13.5px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 9px;
  background: linear-gradient(135deg, #4f8bff, #2563eb);
  color: #fff;
  border: none;
  border-radius: 12px;
  font-size: 17px;
  font-weight: 600;
  letter-spacing: 6px;
  text-indent: 6px;
  cursor: pointer;
  transition: transform 0.15s, box-shadow 0.2s, filter 0.2s;
  box-shadow: 0 10px 24px rgba(37, 99, 235, 0.42);
}
.login-btn:hover:not(:disabled) {
  transform: translateY(-1px);
  filter: brightness(1.1);
  box-shadow: 0 14px 30px rgba(37, 99, 235, 0.52);
}
.login-btn:active:not(:disabled) { transform: translateY(0); }
.login-btn:disabled { opacity: 0.65; cursor: not-allowed; }

/* 按钮/状态加载圈 */
.btn-spinner,
.spinner {
  width: 17px;
  height: 17px;
  border: 2px solid rgba(255, 255, 255, 0.35);
  border-top-color: #fff;
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
  flex-shrink: 0;
}
.spinner { width: 30px; height: 30px; border-width: 3px; border-color: rgba(125, 178, 255, 0.3); border-top-color: #7db2ff; }
@keyframes spin { to { transform: rotate(360deg); } }

/* ========== 状态区（验证中/已登录） ========== */
.state-icon {
  width: 66px;
  height: 66px;
  margin: 4px auto 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 19px;
  background: linear-gradient(135deg, #3b82f6, #1e40af);
  border: 1px solid rgba(147, 197, 253, 0.45);
}
.state-icon.ok {
  font-size: 28px;
  font-weight: 700;
  color: #4ade80;
  background: linear-gradient(135deg, #14332a, #14532d);
  border-color: rgba(74, 222, 128, 0.35);
}
.auth-card h2 {
  font-size: 23px;
  font-weight: 700;
  color: #f3f7ff;
  margin: 0 0 8px;
  /* 重置 VitePress .vp-doc h2 的分隔线与内边距 */
  border: none;
  padding: 0;
}
.state-desc {
  font-size: 14.5px;
  color: #a8bce4;
  margin: 0 0 18px;
}

/* 错误提示 */
.error {
  margin: 14px 0 0;
  padding: 11px 13px;
  background: rgba(248, 113, 113, 0.12);
  border: 1px solid rgba(248, 113, 113, 0.36);
  border-radius: 10px;
  color: #fca5a5;
  font-size: 14px;
  text-align: center;
}

/* 卡片底部 */
.login-foot {
  margin-top: 24px;
  padding-top: 16px;
  border-top: 1px solid rgba(110, 160, 250, 0.2);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  font-size: 14.5px;
  color: #a8bce4;
}
.foot-dot {
  width: 3.5px;
  height: 3.5px;
  border-radius: 50%;
  background: #5a6f99;
}
.back-home {
  display: inline-block;
  margin-top: 16px;
  padding: 9px 22px;
  border: 1px solid rgba(110, 160, 250, 0.4);
  border-radius: 999px;
  font-size: 15.5px;
  color: #bfdbfe;
  text-decoration: none;
  transition: color 0.15s, border-color 0.15s, background 0.15s;
}
.back-home:hover {
  color: #fff;
  border-color: rgba(147, 197, 253, 0.7);
  background: rgba(96, 165, 250, 0.14);
}

/* 已登录页退出按钮 */
.logout-btn {
  display: inline-block;
  margin-top: 4px;
  padding: 9px 24px;
  border-radius: 999px;
  background: linear-gradient(135deg, #ef4444, #dc2626);
  color: #fff;
  font-size: 14px;
  cursor: pointer;
  transition: transform 0.2s, box-shadow 0.2s;
}
.logout-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 18px rgba(239, 68, 68, 0.35);
}
.logout-btn:active { transform: scale(0.96); }

/* ========== 响应式 ========== */
@media (max-width: 940px) {
  .auth-card { grid-template-columns: 1fr; width: 460px; }
  .intro-pane {
    border-right: none;
    border-bottom: 1px solid rgba(110, 160, 250, 0.22);
    border-radius: 21px 21px 0 0;
    padding: 30px 30px 22px;
    gap: 20px;
  }
  .terminal { display: none; }
  .feature-list {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 14px 16px;
  }
  .form-pane { padding: 28px 30px 30px; }
}
@media (max-width: 620px) {
  .container { padding: 18px 14px; }
  .feature-list { display: none; }
  .intro-pane { padding: 26px 22px 18px; }
  .form-pane { padding: 24px 22px 24px; }
  .brand-icon { width: 58px; height: 58px; font-size: 28px; border-radius: 16px; }
  .brand-title { font-size: 22px; }
}
</style>
