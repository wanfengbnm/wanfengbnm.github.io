<script lang="ts" setup>
import { ref } from 'vue';
import SqlServerDiagramPanel from './.vitepress/components/SqlServerDiagramPanel.vue';

const images = ref([
    '/img/1.jpg',
    '/img/2.jpg',
    '/img/3.jpg',
    '/img/4.jpg',
    '/img/5.jpg',
]);
</script>

<template>
    <div class="section-divider section-divider--top" aria-hidden="true"></div>
    <br>
    <div class="image-container">
        <a v-for="(image, index) in images" :key="index" :href="image" target="_blank" rel="noopener noreferrer">
            <img :src="image" class="picture" loading="lazy" alt="示例图片" />
        </a>
    </div>
    <div class="section-divider" aria-hidden="true"></div>
    <SqlServerDiagramPanel />
</template>

<style lang="css" scoped>
.section-divider {
    margin: 24px auto 0;
    width: min(1200px, calc(100% - 32px));
    height: 1px;
    background: linear-gradient(90deg, transparent, var(--vp-c-divider, #ccc), transparent);
}

.section-divider--top {
    margin-bottom: 18px;
}

.section-divider:not(.section-divider--top) {
    margin-top: 48px;
}

.image-container {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 16px;
    justify-items: center;
    align-items: center;
    padding: 16px;
}

img.picture {
    border-radius: 10px;
    max-width: 100%;
    max-height: 250px;
    width: auto;
    height: auto;
    object-fit: cover;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    transition: transform 0.3s ease, box-shadow 0.3s ease;
}

img.picture:hover {
    transform: scale(1.05);
    box-shadow: 0 8px 12px rgba(0, 0, 0, 0.2);
}

@media (max-width: 768px) {
    .image-container {
        gap: 12px;
    }

    .section-divider {
        width: calc(100% - 24px);
    }

    img.picture {
        max-height: 200px;
    }
}
</style>
