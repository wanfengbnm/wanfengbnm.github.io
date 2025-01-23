<script lang="ts" setup>
import { ref } from 'vue';

// 定义图片数组，方便管理和扩展
const images = ref([
    '/img/test1.jpg',
    '/img/test2.jpg',
    '/img/test3.jpg',
    '/img/test4.jpg',
    '/img/test5.jpg',
]);
</script>

<template>
    <div class="divider"></div>
    <br>
    <div class="image-container">
        <!-- 循环渲染图片 -->
        <img v-for="(image, index) in images" :key="index" :src="image" class="picture" loading="lazy" alt="示例图片" />
    </div>
</template>

<style lang="css" scoped>
.divider {
    margin: 24px auto 18px;
    width: 300px;
    height: 1px;
    background-color: var(--vp-c-divider);
}

.image-container {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 16px;
    /* 图片之间的间距 */
}

img.picture {
    border-radius: 10px;
    /* 调小圆角 */
    max-width: 400px;
    /* 调整图片最大宽度 */
    max-height: 250px;
    /* 调整图片最大高度 */
    width: auto;
    height: auto;
    object-fit: cover;
    /* 保持图片比例 */
}

/* 媒体查询，当屏幕宽度小于 768px 时，即手机屏幕 */
@media (max-width: 768px) {
    .image-container {
        flex-direction: column;
        align-items: center;
    }
}
</style>