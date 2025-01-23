<script lang="ts" setup>
import { ref } from 'vue';

const images = ref([
    '/img/1.jpg',
    '/img/2.jpg',
    '/img/3.jpg',
    '/img/4.jpg',
    '/img/5.jpg',
]);
</script>

<template>
    <div class="divider"></div>
    <br>
    <div class="image-container">
        <a v-for="(image, index) in images" :key="index" :href="image" target="_blank" rel="noopener noreferrer">
            <img :src="image" class="picture" loading="lazy" alt="示例图片" />
        </a>
    </div>
</template>

<style lang="css" scoped>
.divider {
    margin: 24px auto 18px;
    width: 80%;
    height: 1px;
    background-color: var(--vp-c-divider, #ccc);
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
    .divider {
        width: 90%;
    }

    .image-container {
        gap: 12px;
    }

    img.picture {
        max-height: 200px;
    }
}
</style>
