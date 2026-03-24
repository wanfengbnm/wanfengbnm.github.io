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

      <!-- 主内容 -->
      <div class="main">
        <div class="card">
          <h3>登录成功 🎉</h3>
          <p>后台系统已在新窗口加载</p>
          <p>若未加载成功，请尝试重新登录</p>
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

  if (username.value === 'admin' && password.value === '123456') {

    const target = 'http://117.72.77.63:7500/static/#/'

    // 保存账号
    localStorage.setItem('last_username', username.value)

    // 打开新窗口
    const newWindow = window.open(target, '_blank')

    if (!newWindow) {
      errorMsg.value = '浏览器拦截了弹窗，请允许弹窗后重试'
      return
    }

    // 设置登录状态
    const expireTime = Date.now() + 30 * 60 * 1000
    localStorage.setItem('token', 'admin-token')
    localStorage.setItem('expire', expireTime)

    isLogin.value = true
  } else {
    errorMsg.value = '账号或密码错误'
  }
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

/* 背景 */
.container {
  width: 100%;
  height: 100vh;
}

/* 登录框 */
.login-box {
  width: 320px;
  padding: 30px;
  border-radius: 12px;
  background: #fff;
  box-shadow: 0 10px 30px rgba(0,0,0,0.2);

  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
}

.login-box h2 {
  text-align: center;
  margin-bottom: 20px;
}

.login-box input {
  width: 100%;
  padding: 10px;
  margin-bottom: 15px;
  border: 1px solid #ddd;
  border-radius: 6px;
}

.login-box button {
  width: 100%;
  padding: 10px;
  background: #409eff;
  color: #fff;
  border: none;
  border-radius: 6px;
  cursor: pointer;
}

.login-box button:hover {
  background: #66b1ff;
}

.error {
  color: #f56c6c;
  margin-top: 10px;
  text-align: center;
}

/* 后台布局 */
.dashboard {
  height: 100vh;
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

/* 卡片 */
.card {
  background: #fff;
  padding: 30px;
  border-radius: 12px;
  box-shadow: 0 10px 30px rgba(0,0,0,0.1);
  text-align: center;

  animation: fadeIn 0.5s ease;
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
</style>