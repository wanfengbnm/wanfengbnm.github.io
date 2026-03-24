<template>
  <div class="login-container">
    <div class="login-box">
      <h2>管理员登录</h2>

      <input v-model="username" placeholder="请输入账号" />
      <input v-model="password" type="password" placeholder="请输入密码" />

      <button :disabled="loading" @click="login">
        {{ loading ? '登录中...' : '登 录' }}
      </button>

      <p class="error" v-if="errorMsg">{{ errorMsg }}</p>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'

const username = ref('')
const password = ref('')
const loading = ref(false)
const errorMsg = ref('')
const router = useRouter()

// ✅ 已登录直接跳过登录页（很专业！）
onMounted(() => {
  const token = localStorage.getItem('token')
  if (token) {
    router.push('/admin')
  }
})

const login = () => {
  errorMsg.value = ''

  if (!username.value || !password.value) {
    errorMsg.value = '请输入账号和密码'
    return
  }

  loading.value = true

  setTimeout(() => {
    if (username.value === 'admin' && password.value === '123456') {
      localStorage.setItem('token', 'admin-token')

      alert('登录成功！')

      // ✅ 跳转到 VitePress 页面
      const redirect = localStorage.getItem('redirect')

      if (redirect) {
        window.location.href = redirect
      } else {
        window.location.href = '/TaskLog/index.html'
      }

    } else {
      errorMsg.value = '账号或密码错误'
    }

    loading.value = false
  }, 800)
}
</script>

<style scoped>
.login-container {
  height: 100vh;
  display: flex;
  justify-content: center;
  align-items: center;
  background: linear-gradient(135deg, #4facfe, #00f2fe);
}

.login-box {
  width: 320px;
  padding: 30px;
  border-radius: 10px;
  background: #fff;
  box-shadow: 0 10px 25px rgba(0,0,0,0.2);
  text-align: center;
}

.login-box input {
  width: 100%;
  padding: 10px;
  margin-bottom: 15px;
  border: 1px solid #ddd;
  border-radius: 5px;
}

.login-box button {
  width: 100%;
  padding: 10px;
  background: #409eff;
  color: #fff;
  border: none;
  border-radius: 5px;
  cursor: pointer;
}

.login-box button:disabled {
  background: #aaa;
  cursor: not-allowed;
}

.error {
  color: red;
  margin-top: 10px;
}
</style>