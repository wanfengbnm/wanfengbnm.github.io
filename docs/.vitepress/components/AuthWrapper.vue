<template>
  <div class="container">
    <!-- 验证中 -->
    <div v-if="!authReady" class="login-box">
      <h2>验证中...</h2>
    </div>

    <!-- 未登录 -->
    <div v-else-if="!isLogin" class="login-box">
      <h2>管理员登录</h2>

      <input v-model="username" placeholder="请输入账号" />
      <input v-model="password" type="password" placeholder="请输入密码" />

      <button @click="login">登 录</button>

      <p class="error" v-if="errorMsg">{{ errorMsg }}</p>
    </div>

    <!-- 已登录 -->
    <div v-else class="dashboard">

      <!-- 顶部栏 -->
      <div class="header">
        <div class="logo">管理后台</div>

        <div class="right">
          <span class="welcome">欢迎，{{ username }}</span>

          <div class="logout-btn" @click="logout">
            退出登录
          </div>
        </div>
      </div>

      <!-- 主内容 -->
      <div class="main">
        <div class="redirect-card">
          <div class="redirect-icon">🗄️</div>
          <p>已登录，正在跳转至多平台数据库管理...</p>
        </div>
      </div>

    </div>

  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'

const isLogin = ref(false)
const authReady = ref(false)
const username = ref('')
const password = ref('')
const errorMsg = ref('')

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
  checkLogin()

  // 自动填充账号
  const lastUser = localStorage.getItem('last_username')
  if (lastUser) {
    username.value = lastUser
  }
})

// 登录
const login = async () => {
  errorMsg.value = ''

  if (!username.value || !password.value) {
    errorMsg.value = '请输入账号和密码'
    return
  }

  // 构造 API 地址
  const base = window.location.hostname === 'localhost' ? '' : 'https://api.wfbnm.xyz'
  const url = `${base}/api/auth/login`

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

:global(:root) {
  color-scheme: light dark;
}

/* 背景 */
.container {
  position: fixed;
  inset: var(--vp-nav-height, 0px) 0 0 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 32px 20px;
  box-sizing: border-box;
  z-index: 1;
  background: radial-gradient(circle at top, var(--vp-c-bg-soft, rgba(0, 0, 0, 0.04)), transparent 60%);
}

/* 登录框 */
.login-box {
  width: 320px;
  padding: 30px;
  border-radius: 12px;
  background: var(--vp-c-bg, #fff);
  color: var(--vp-c-text-1, #1f2328);
  border: 1px solid var(--vp-c-divider, rgba(0, 0, 0, 0.08));
  box-shadow: 0 18px 48px rgba(0,0,0,0.16);
  backdrop-filter: blur(10px);
}

.login-box h2 {
  text-align: center;
  margin-bottom: 20px;
  color: var(--vp-c-text-1, #1f2328);
}

.login-box input {
  width: 100%;
  padding: 10px;
  margin-bottom: 15px;
  border: 1px solid var(--vp-c-divider, #ddd);
  border-radius: 6px;
  background: var(--vp-c-bg-soft, #f6f7f9);
  color: var(--vp-c-text-1, #1f2328);
  box-sizing: border-box;
}

.login-box input::placeholder {
  color: var(--vp-c-text-3, #8c8c8c);
}

.login-box button {
  width: 100%;
  padding: 10px;
  background: var(--vp-c-brand-1, #409eff);
  color: var(--vp-c-white, #fff);
  border: none;
  border-radius: 6px;
  cursor: pointer;
}

.login-box button:hover {
  background: var(--vp-c-brand-2, #66b1ff);
}

.error {
  color: var(--vp-c-danger-1, #f56c6c);
  margin-top: 10px;
  text-align: center;
}

/* 后台布局 */
.dashboard {
  width: 100%;
  min-height: calc(100vh - var(--vp-nav-height, 0px));
  display: flex;
  flex-direction: column;
}

/* 顶部栏 */
.header {
  height: 60px;
  background: #2d3a4b;
  color: #fff;

  display: flex;
  justify-content: space-between;
  align-items: center;

  padding: 0 20px;
}

.logo {
  font-size: 18px;
  font-weight: bold;
}

.right {
  display: flex;
  align-items: center;
  gap: 15px;
}

.welcome {
  font-size: 14px;
}

/* 退出按钮 */
.logout-btn {
  background: linear-gradient(135deg, #ff4d4f, #ff7875);
  padding: 6px 14px;
  border-radius: 20px;
  cursor: pointer;
  transition: 0.3s;
}

.logout-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(255,77,79,0.4);
}

.logout-btn:active {
  transform: scale(0.95);
}

/* 主体 */
.main {
  flex: 1;
  background: #f5f7fa;

  display: flex;
  justify-content: center;
  align-items: center;
}

/* ========== 跳转提示 ========== */
.redirect-card {
  background: #fff;
  border-radius: 16px;
  padding: 40px 36px;
  text-align: center;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.06);
  animation: fadeIn 0.4s ease;
}

.redirect-icon {
  font-size: 48px;
  margin-bottom: 16px;
}

.redirect-card p {
  font-size: 16px;
  color: #64748b;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(12px); }
  to { opacity: 1; transform: translateY(0); }
}
</style>