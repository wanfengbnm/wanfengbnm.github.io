<template>
  <div class="container">

    <!-- 未登录 -->
    <div v-if="!isLogin" class="login-box">
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

      <!-- 主内容：界面选择 -->
      <div class="main">
        <div class="select-page">
          <h2 class="select-title">请选择要进入的管理界面</h2>
          <div class="select-cards">
            <!-- FRP 服务器监控 -->
            <div class="select-card" @click="openFrp">
              <div class="card-icon frp-icon">
                <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <rect x="4" y="8" width="40" height="32" rx="3" stroke="currentColor" stroke-width="2.5"/>
                  <rect x="8" y="14" width="14" height="8" rx="1.5" stroke="currentColor" stroke-width="2"/>
                  <rect x="26" y="14" width="14" height="8" rx="1.5" stroke="currentColor" stroke-width="2"/>
                  <rect x="8" y="26" width="14" height="8" rx="1.5" stroke="currentColor" stroke-width="2"/>
                  <rect x="26" y="26" width="14" height="8" rx="1.5" stroke="currentColor" stroke-width="2"/>
                  <circle cx="38" cy="10" r="3" fill="#22c55e" stroke="none"/>
                </svg>
              </div>
              <h3>FRP 服务器监控</h3>
              <p>查看 FRP 内网穿透服务运行状态、流量统计与客户端连接信息</p>
              <span class="card-badge external">外部页面</span>
            </div>

            <!-- 管理后台 -->
            <div class="select-card" @click="goManagement">
              <div class="card-icon mgmt-icon">
                <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <rect x="6" y="6" width="36" height="36" rx="4" stroke="currentColor" stroke-width="2.5"/>
                  <path d="M6 16h36" stroke="currentColor" stroke-width="2.5"/>
                  <path d="M6 32h36" stroke="currentColor" stroke-width="2.5"/>
                  <rect x="12" y="22" width="8" height="6" rx="1.5" stroke="currentColor" stroke-width="2"/>
                  <rect x="28" y="22" width="8" height="6" rx="1.5" stroke="currentColor" stroke-width="2"/>
                  <circle cx="18" cy="10" r="2" fill="currentColor"/>
                  <circle cx="24" cy="10" r="2" fill="currentColor"/>
                  <circle cx="30" cy="10" r="2" fill="currentColor"/>
                </svg>
              </div>
              <h3>系统管理后台</h3>
              <p>用户管理、系统设置、操作日志等后台管理功能</p>
              <span class="card-badge internal">站内页面</span>
            </div>
          </div>
        </div>
      </div>

    </div>

  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'

const isLogin = ref(false)
const username = ref('')
const password = ref('')
const errorMsg = ref('')

// 检查登录状态
const checkLogin = () => {
  const token = localStorage.getItem('token')
  const expire = localStorage.getItem('expire')

  if (token && expire && Date.now() < expire) {
    isLogin.value = true
    username.value = localStorage.getItem('last_username') || ''
  } else {
    localStorage.removeItem('token')
    localStorage.removeItem('expire')
    isLogin.value = false
  }
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
const login = () => {
  errorMsg.value = ''

  if (!username.value || !password.value) {
    errorMsg.value = '请输入账号和密码'
    return
  }

  if (username.value === 'admin' && password.value === 'REMOVED') {

    // 保存账号
    localStorage.setItem('last_username', username.value)

    // 设置登录状态
    const expireTime = Date.now() + 30 * 60 * 1000
    localStorage.setItem('token', 'admin-token')
    localStorage.setItem('expire', expireTime)

    isLogin.value = true
  } else {
    errorMsg.value = '账号或密码错误'
  }
}

// 打开 FRP 服务器监控
const openFrp = () => {
  const target = 'http://117.72.77.63:7500/static/#/'
  const newWindow = window.open(target, '_blank')
  if (!newWindow) {
    errorMsg.value = '浏览器拦截了弹窗，请允许弹窗后重试'
  }
}

// 进入管理后台
const goManagement = () => {
  window.location.href = '/Management/'
}

// 退出登录
const logout = () => {
  localStorage.removeItem('token')
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

/* ========== 选择页面 ========== */
.select-page {
  max-width: 780px;
  width: 100%;
  padding: 20px;
}

.select-title {
  text-align: center;
  font-size: 22px;
  color: #1f2328;
  margin-bottom: 36px;
  font-weight: 600;
}

.select-cards {
  display: flex;
  gap: 28px;
  justify-content: center;
  flex-wrap: wrap;
}

.select-card {
  flex: 1;
  min-width: 260px;
  max-width: 340px;
  background: #fff;
  border-radius: 16px;
  padding: 32px 24px 24px;
  cursor: pointer;
  text-align: center;
  border: 2px solid transparent;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.06);
  transition: all 0.3s ease;
  position: relative;
  overflow: hidden;
}

.select-card:hover {
  transform: translateY(-6px);
  box-shadow: 0 14px 36px rgba(0, 0, 0, 0.12);
}

.select-card:first-child:hover {
  border-color: #22c55e;
}

.select-card:last-child:hover {
  border-color: var(--vp-c-brand-1, #409eff);
}

.card-icon {
  width: 72px;
  height: 72px;
  margin: 0 auto 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 18px;
  transition: transform 0.3s ease;
}

.select-card:hover .card-icon {
  transform: scale(1.08);
}

.frp-icon {
  background: #f0fdf4;
  color: #22c55e;
}

.mgmt-icon {
  background: #eff6ff;
  color: var(--vp-c-brand-1, #409eff);
}

.card-icon svg {
  width: 48px;
  height: 48px;
}

.select-card h3 {
  font-size: 18px;
  color: #1f2328;
  margin-bottom: 10px;
  font-weight: 600;
}

.select-card p {
  font-size: 13px;
  color: #6b7280;
  line-height: 1.6;
  margin-bottom: 16px;
}

.card-badge {
  display: inline-block;
  padding: 4px 12px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 500;
}

.card-badge.external {
  background: #fef3c7;
  color: #d97706;
}

.card-badge.internal {
  background: #dbeafe;
  color: #2563eb;
}

/* 动画 */
@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(20px)
  }
  to {
    opacity: 1;
    transform: translateY(0)
  }
}

.select-card {
  animation: fadeIn 0.5s ease both;
}

.select-card:last-child {
  animation-delay: 0.12s;
}
</style>