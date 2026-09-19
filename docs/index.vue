<script lang="ts" setup>
import { ref, onMounted, onBeforeUnmount } from 'vue';

// 主轮番图（矢量插画，由 server/gen-art.mjs 生成）
const slides = ref([
    { src: '/art/hero-1.svg', text: '多端数据库开发 · 跨平台数据管理与可视化' },
    { src: '/art/hero-2.svg', text: '数据库结构图 · 一键生成' },
    { src: '/art/hero-3.svg', text: '数据图表 · 让规律一目了然' },
    { src: '/art/hero-4.svg', text: '数据治理 · 质量与安全并重' },
    { src: '/art/hero-5.svg', text: '多端协同 · 随时随地管理' },
]);
const current = ref(0);
let timer: ReturnType<typeof setInterval> | null = null;

const startTimer = () => {
    stopTimer();
    timer = setInterval(() => { current.value = (current.value + 1) % slides.value.length; }, 4500);
};
const stopTimer = () => { if (timer) { clearInterval(timer); timer = null; } };
const goTo = (i: number) => { current.value = i; startTimer(); };
const prevSlide = () => { current.value = (current.value - 1 + slides.value.length) % slides.value.length; startTimer(); };
const nextSlide = () => { current.value = (current.value + 1) % slides.value.length; startTimer(); };
onMounted(() => {
  // 主页导航悬浮：给 body 打标记（样式泄漏安全），离开主页即恢复
  document.body.classList.add('dbm-home-active');
  startTimer();
});
onBeforeUnmount(() => {
  document.body.classList.remove('dbm-home-active');
  stopTimer();
});

// 功能一览
const features = ref([
    {
        title: '后端数据库管理控制台',
        desc: '多平台数据库一站式管理：数据表增删改查、字段管理、SQL 编辑器（执行历史 + Ctrl+Enter 运行）、数据治理（质量检测 / 敏感字段识别 / 数据字典 / 审计日志）与多表整合数据分析图表。',
        img: '/art/feature-console.svg',
        link: '/TaskLog/',
        linkText: '进入管理控制台（需登录）',
        tags: ['MySQL', '数据治理', '统计图表'],
    },
    {
        title: '数据库可视化工具',
        desc: '免登录的轻量工具箱：连接 SQL Server 后一键生成数据库结构图，并可对表数据生成柱状图、折线图、饼图、散点图等统计图表，支持多表 JOIN 分析与图片 / SVG 导出，连接信息不会被存储。',
        img: '/art/feature-viz.svg',
        link: '/Tools/',
        linkText: '立即使用（免登录）',
        tags: ['SQL Server', '结构图', '统计图表', '免登录'],
    },
    {
        title: '日常问题记录',
        desc: '记录开发与运维过程中的常见问题、排查思路与解决方案，持续积累一线实战经验。',
        img: '/art/feature-notes.svg',
        link: '/DailyProblem/',
        linkText: '阅读记录',
        tags: ['经验沉淀'],
    },
    {
        title: '文档研究',
        desc: '技术文档的阅读笔记与研究心得，沉淀方法论与最佳实践。',
        img: '/art/feature-docs.svg',
        link: '/DocumentResearch/',
        linkText: '开始阅读',
        tags: ['技术笔记'],
    },
]);

// 底部导航
const footerNav = ref([
    {
        title: '功能入口',
        links: [
            { text: '管理控制台', href: '/TaskLog/' },
            { text: '数据库可视化工具', href: '/Tools/' },
            { text: '图表分析', href: '/Tools/?tab=charts' },
        ],
    },
    {
        title: '文档资源',
        links: [
            { text: '日常问题', href: '/DailyProblem/' },
            { text: '文档研究', href: '/DocumentResearch/' },
        ],
    },
    {
        title: '关于本站',
        links: [
            { text: 'GitHub 仓库', href: 'https://github.com/wanfengbnm', external: true },
            { text: '返回主页', href: '/' },
        ],
    },
]);
</script>

<template>
    <div class="home-page">
        <!-- 主轮番图 -->
        <section class="hero-carousel" aria-label="站点轮播展示" @mouseenter="stopTimer" @mouseleave="startTimer">
            <div class="carousel-track" :style="{ transform: `translateX(-${current * 100}%)` }">
                <div class="carousel-slide" v-for="(s, i) in slides" :key="i">
                    <img :src="s.src" :alt="s.text" :loading="i === 0 ? 'eager' : 'lazy'" />
                    <div class="carousel-caption">{{ s.text }}</div>
                </div>
            </div>
            <button class="carousel-arrow prev" aria-label="上一张" @click="prevSlide">‹</button>
            <button class="carousel-arrow next" aria-label="下一张" @click="nextSlide">›</button>
            <div class="carousel-dots">
                <button
                    v-for="(s, i) in slides"
                    :key="i"
                    class="dot"
                    :class="{ active: current === i }"
                    :aria-label="`第 ${i + 1} 张`"
                    @click="goTo(i)"
                ></button>
            </div>
        </section>

        <!-- 功能一览 -->
        <section class="features">
            <h2 class="section-title">功能一览</h2>
            <p class="section-subtitle">站内全部能力，按模块分别介绍</p>
            <div
                v-for="(f, i) in features"
                :key="f.title"
                class="feature-row"
                :class="{ reverse: i % 2 === 1 }"
            >
                <div class="feature-img">
                    <img :src="f.img" :alt="`${f.title} 示例图`" loading="lazy" />
                </div>
                <div class="feature-text">
                    <div class="feature-tags">
                        <span v-for="t in f.tags" :key="t" class="tag">{{ t }}</span>
                    </div>
                    <h3>{{ f.title }}</h3>
                    <p>{{ f.desc }}</p>
                    <a class="feature-link" :href="f.link">{{ f.linkText }} →</a>
                </div>
            </div>
        </section>

        <!-- 底部导航 -->
        <section class="home-footer-nav" aria-label="页面底部导航">
            <div class="footer-cols">
                <div v-for="col in footerNav" :key="col.title" class="footer-col">
                    <h4>{{ col.title }}</h4>
                    <a
                        v-for="l in col.links"
                        :key="l.text"
                        :href="l.href"
                        :target="l.external ? '_blank' : undefined"
                        :rel="l.external ? 'noopener noreferrer' : undefined"
                    >{{ l.text }}</a>
                </div>
            </div>
            <p class="footer-note">多端数据库开发 · 跨平台数据管理与可视化</p>
        </section>
    </div>
</template>

<style lang="css" scoped>
/* 主页整体：深灰底色（与轮番图、控制台风格协调），白字 */
:global(body.dbm-home-active) {
    background-color: #12161f !important;
    background-image: radial-gradient(1400px 800px at 50% -10%, #1c2433 0%, #141926 55%, #111521 100%) !important;
}
/* 主页导航悬浮：仅在 body 带主页标记时生效（样式泄漏安全），离开主页即恢复常规导航 */
:global(body.dbm-home-active .VPNavBar) {
    top: 14px !important;
    left: 16px !important;
    right: 16px !important;
    border-radius: 16px;
    background: rgba(15, 23, 42, 0.72) !important;
    -webkit-backdrop-filter: blur(16px) saturate(1.5);
    backdrop-filter: blur(16px) saturate(1.5);
    border: 1px solid rgba(71, 85, 105, 0.45);
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.35);
    overflow: hidden;
    transition: background 0.3s ease;
}
:global(body.dbm-home-active .VPNavBar .content-body),
:global(body.dbm-home-active .VPNavBar .title) {
    background: transparent !important;
}
:global(body.dbm-home-active .VPNavBar .divider) {
    display: none !important;
}
:global(body.dbm-home-active .VPContent) {
    padding-top: 0 !important;
}
:global(body.dbm-home-active .VPFooter) {
    display: none !important;
}
/* 深色胶囊上的导航文字提亮 */
:global(body.dbm-home-active .VPNavBarTitle .title),
:global(body.dbm-home-active .VPNavBarTitle .text) {
    color: #f1f5f9 !important;
}
:global(body.dbm-home-active .VPNavBarMenuLink) {
    color: #cbd5e1 !important;
}
:global(body.dbm-home-active .VPNavBarMenuLink.active),
:global(body.dbm-home-active .VPNavBarMenuLink:hover) {
    color: #7db2ff !important;
}
:global(body.dbm-home-active .VPNavBarSearch .DocSearch-Button) {
    background: rgba(30, 41, 59, 0.7) !important;
    border-color: rgba(71, 85, 105, 0.5) !important;
}
:global(body.dbm-home-active .VPNavBarSearch .DocSearch-Button-Placeholder),
:global(body.dbm-home-active .VPNavBarSearch .DocSearch-Button-Key) {
    color: #7c8aa0 !important;
    background: transparent !important;
    border-color: rgba(71, 85, 105, 0.5) !important;
}
:global(body.dbm-home-active .VPSwitch) {
    background: rgba(30, 41, 59, 0.7) !important;
    border-color: rgba(71, 85, 105, 0.5) !important;
}
:global(body.dbm-home-active .VPSwitch .icon),
:global(body.dbm-home-active .VPSocialLink) {
    color: #cbd5e1 !important;
}

.home-page {
    width: calc(100% - 32px);
    margin: 0 auto;
    padding: 16px 0 40px;
}

/* ========== 主轮番图 ========== */
.hero-carousel {
    position: relative;
    border-radius: 16px;
    overflow: hidden;
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.14);
    aspect-ratio: 21 / 9;
    background: var(--vp-c-bg-soft, #f1f5f9);
}
.carousel-track {
    display: flex;
    height: 100%;
    transition: transform 0.6s cubic-bezier(0.22, 1, 0.36, 1);
}
.carousel-slide {
    flex: 0 0 100%;
    position: relative;
    height: 100%;
}
.carousel-slide img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
}
.carousel-caption {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    padding: 40px 28px 16px;
    background: linear-gradient(transparent, rgba(0, 0, 0, 0.62));
    color: #fff;
    font-size: 18px;
    font-weight: 600;
    letter-spacing: 0.5px;
    text-align: center;
    text-shadow: 0 1px 4px rgba(0, 0, 0, 0.4);
}
.carousel-arrow {
    position: absolute;
    top: 50%;
    transform: translateY(-50%);
    width: 40px;
    height: 40px;
    border-radius: 50%;
    border: none;
    background: rgba(0, 0, 0, 0.35);
    color: #fff;
    font-size: 22px;
    line-height: 1;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background 0.2s;
    backdrop-filter: blur(4px);
}
.carousel-arrow:hover { background: rgba(0, 0, 0, 0.55); }
.carousel-arrow.prev { left: 14px; }
.carousel-arrow.next { right: 14px; }
.carousel-dots {
    position: absolute;
    bottom: 12px;
    right: 18px;
    display: flex;
    gap: 8px;
}
.dot {
    width: 9px;
    height: 9px;
    border-radius: 50%;
    border: none;
    padding: 0;
    background: rgba(255, 255, 255, 0.5);
    cursor: pointer;
    transition: all 0.2s;
}
.dot.active { background: #fff; width: 22px; border-radius: 5px; }

/* ========== 功能一览 ========== */
.features { margin-top: 48px; }
.section-title {
    text-align: center;
    font-size: 28px;
    font-weight: 700;
    color: #f1f5f9;
    margin: 0 0 6px;
}
.section-subtitle {
    text-align: center;
    font-size: 15.5px;
    color: #8fa1b8;
    margin: 0 0 36px;
}
.feature-row {
    display: grid;
    grid-template-columns: 1.05fr 1fr;
    gap: 40px;
    align-items: stretch;
    padding: 34px 0;
    border-top: 1px solid rgba(255, 255, 255, 0.08);
}
.feature-row.reverse .feature-img { order: 2; }
.feature-row.reverse .feature-text { order: 1; }
.feature-img {
    border-radius: 14px;
    overflow: hidden;
    box-shadow: 0 12px 30px rgba(0, 0, 0, 0.4);
    aspect-ratio: 16 / 10;
}
.feature-img img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
    transition: transform 0.35s ease;
}
.feature-row:hover .feature-img img { transform: scale(1.04); }
.feature-tags { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 16px; }
.tag {
    font-size: 13.5px;
    font-weight: 600;
    padding: 3px 14px;
    border-radius: 999px;
    color: #93c5fd;
    background: rgba(59, 130, 246, 0.16);
    border: 1px solid rgba(96, 165, 250, 0.35);
}
/* 功能描述：悬浮玻璃卡片，悬停上浮 */
.feature-text {
    display: flex;
    flex-direction: column;
    justify-content: center;
    background: rgba(255, 255, 255, 0.035);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 18px;
    padding: 32px 36px;
    -webkit-backdrop-filter: blur(10px);
    backdrop-filter: blur(10px);
    box-sizing: border-box;
    transition: transform 0.25s ease, border-color 0.25s ease, background 0.25s ease, box-shadow 0.25s ease;
}
.feature-row:hover .feature-text {
    transform: translateY(-5px);
    border-color: rgba(96, 165, 250, 0.45);
    background: rgba(255, 255, 255, 0.06);
    box-shadow: 0 16px 38px rgba(0, 0, 0, 0.35);
}
.feature-text h3 {
    font-size: 25px;
    font-weight: 700;
    color: #f1f5f9;
    margin: 0 0 14px;
}
.feature-text p {
    font-size: 17.5px;
    line-height: 1.9;
    color: #b7c2d4;
    margin: 0 0 22px;
}
.feature-link {
    align-self: flex-start;
    display: inline-block;
    padding: 11px 26px;
    border-radius: 10px;
    font-size: 16px;
    font-weight: 600;
    text-decoration: none;
    color: #7db2ff;
    border: 1px solid #3b82f6;
    transition: all 0.2s;
}
.feature-link:hover {
    color: #fff;
    background: #3b82f6;
    transform: translateY(-1px);
    box-shadow: 0 8px 18px rgba(59, 130, 246, 0.35);
}

/* ========== 底部导航 ========== */
.home-footer-nav {
    margin-top: 48px;
    padding: 32px 28px 22px;
    border-radius: 16px;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.08);
}
.footer-cols {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    gap: 24px;
}
.footer-col h4 {
    font-size: 15px;
    font-weight: 700;
    color: #f1f5f9;
    margin: 0 0 12px;
}
.footer-col a {
    display: block;
    font-size: 14.5px;
    color: #9aa7ba;
    text-decoration: none;
    padding: 5px 0;
    transition: color 0.15s;
}
.footer-col a:hover { color: #7db2ff; }
.footer-note {
    margin: 26px 0 0;
    padding-top: 16px;
    border-top: 1px solid rgba(255, 255, 255, 0.08);
    text-align: center;
    font-size: 13.5px;
    color: #64748b;
}

/* ========== 响应式 ========== */
@media (max-width: 820px) {
    .feature-row {
        grid-template-columns: 1fr;
        gap: 18px;
        padding: 24px 0;
    }
    .feature-row.reverse .feature-img { order: 0; }
    .hero-carousel { aspect-ratio: 16 / 9; }
    .carousel-caption { font-size: 15px; }
    .section-title { font-size: 24px; }
}
@media (max-width: 600px) {
    .home-page { width: calc(100% - 20px); }
    .feature-text { padding: 24px 22px; border-radius: 14px; }
    .feature-text h3 { font-size: 22px; }
    .feature-text p { font-size: 16px; }
    .section-title { font-size: 24px; }
    .section-subtitle { font-size: 14px; }
    .home-footer-nav { padding: 24px 18px 16px; }
    :global(body.dbm-home-active .VPNavBar) {
        top: 10px !important;
        left: 10px !important;
        right: 10px !important;
    }
}
</style>
