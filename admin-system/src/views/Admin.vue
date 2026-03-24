<template>
  <div class="admin-container">
    <!-- 顶部栏 -->
    <div class="header">
      <span>后台管理系统</span>
      <button @click="logout">退出登录</button>
    </div>

    <div class="main">
      <!-- 左侧菜单 -->
      <div class="sidebar">
        <ul>
          <li>首页</li>
          <li>用户管理</li>
          <li>活动管理</li>
          <li>系统设置</li>
        </ul>
      </div>

      <!-- 内容区 -->
      <div class="content">
        <h2>欢迎进入管理员后台 🎉</h2>
      </div>
    </div>
  </div>
</template>

<script setup>
import { onMounted } from 'vue'

onMounted(() => {
  const token = localStorage.getItem('token')
  if (!token) {
    window.location.href = '/login'
  }
})

const logout = () => {
  localStorage.removeItem('token')
  window.location.href = '/login'
}
</script>

<style scoped>
.admin-container {
  height: 100vh;
  display: flex;
  flex-direction: column;
}

/* 顶部 */
.header {
  height: 60px;
  background: #409eff;
  color: #fff;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0 20px;
}

/* 主体 */
.main {
  flex: 1;
  display: flex;
}

/* 左侧菜单 */
.sidebar {
  width: 200px;
  background: #2d3a4b;
  color: #fff;
}

.sidebar ul {
  list-style: none;
  padding: 0;
}

.sidebar li {
  padding: 15px;
  cursor: pointer;
}

.sidebar li:hover {
  background: #1f2a38;
}

/* 内容区 */
.content {
  flex: 1;
  padding: 20px;
}
</style>