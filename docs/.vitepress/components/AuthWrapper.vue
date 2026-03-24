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
        <div v-if="isLogin">
            <div class="logout-btn" @click="logout">退出登录</div>

            <div class="content">
                <slot />
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

// 登录检测
const checkLogin = () => {
    const token = localStorage.getItem('token')
    const expire = localStorage.getItem('expire')

    if (token && expire && Date.now() < expire) {
        isLogin.value = true
    } else {
        // ❗ 自动清理异常状态
        localStorage.removeItem('token')
        localStorage.removeItem('expire')
        isLogin.value = false
    }
}

onMounted(() => {
    checkLogin()
})

// 登录
const login = async () => {
    errorMsg.value = ''

    if (!username.value || !password.value) {
        errorMsg.value = '请输入账号和密码'
        return
    }

    if (username.value === 'admin' && password.value === '123456') {

        const target = 'http://117.72.77.63:7500/static/#/'

        try {
            const res = await fetch(target)

            if (res.ok) {
                // ✅ 只有成功才存 token
                const expireTime = Date.now() + 30 * 60 * 1000

                localStorage.setItem('token', 'admin-token')
                localStorage.setItem('expire', expireTime)

                window.location.href = target
            } else {
                errorMsg.value = '后端暂未开放，请稍后'
            }

        } catch (e) {
            errorMsg.value = '后端暂未开放，请稍后'
        }

    } else {
        errorMsg.value = '账号或密码错误'
    }
}
// 退出
const logout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('expire')
    window.location.reload()
}
</script>

<style scoped>
/* 背景 */
.container {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100vh;

    display: flex;
    justify-content: center;
    align-items: center;

    background: linear-gradient(135deg, #4facfe, #00f2fe);
}

/* 登录卡片 */
.login-box {
    width: 320px;
    padding: 30px;
    border-radius: 12px;
    background: #fff;
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
    text-align: center;
    animation: fadeIn 0.5s ease;
}

.login-box h2 {
    margin-bottom: 20px;
}

/* 输入框 */
.login-box input {
    width: 100%;
    padding: 10px;
    margin-bottom: 15px;
    border: 1px solid #ddd;
    border-radius: 6px;
    transition: 0.3s;
}

.login-box input:focus {
    border-color: #409eff;
    outline: none;
    box-shadow: 0 0 5px rgba(64, 158, 255, 0.5);
}

/* 按钮 */
.login-box button {
    width: 100%;
    padding: 10px;
    background: #409eff;
    color: #fff;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    transition: 0.3s;
}

.login-box button:hover {
    background: #66b1ff;
    transform: translateY(-1px);
}

.login-box button:active {
    transform: scale(0.98);
}

/* 错误提示 */
.error {
    color: #f56c6c;
    margin-top: 10px;
}

/* 退出按钮 */
.logout-btn {
    position: fixed;
    top: 20px;
    right: 20px;
    z-index: 9999;

    background: #f56c6c;
    color: #fff;
    padding: 10px 15px;
    cursor: pointer;
    border-radius: 6px;
}

.logout-btn:hover {
    background: #ff7875;
}

/* 内容区 */
.content {
    padding: 20px;
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