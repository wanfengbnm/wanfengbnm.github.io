<script lang="ts" setup>
import { ref, onMounted, onBeforeUnmount } from 'vue';

// 首屏：主轮番图（矢量插画，由 server/gen-art.mjs 生成）
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

// 功能一览：滚动驱动，下滑依次展示各模块
const features = ref([
    {
        title: '后端数据库管理控制台',
        desc: '多平台数据库一站式管理，包括数据表增删改查、字段管理、SQL 编辑器、数据治理与数据分析等，后续功能开发中。',
        img: '/art/feature-console.svg',
        link: '/TaskLog/',
        linkText: '进入管理控制台（需登录）',
        tags: ['数据分析', '数据治理', '统计图表'],
    },
    {
        title: '便携式数据库管理工具',
        desc: '连接 SQL Server 后选择数据库，一键生成实体关系结构图，直观看清表与表之间的关联，支持图片与 SVG 两种格式预览和下载，连接信息不会被存储。',
        img: '/art/feature-diagram.svg',
        link: '/Tools/',
        linkText: '进入接库控制台（免登录）',
        tags: ['便携式', 'ER 图','数据库架构' ],
    },
    {
        title: '统计图表分析',
        desc: '同一连接下选择表与字段，快速生成柱状图、折线图、饼图与散点图，支持单表聚合与多表 JOIN 分析，让数据规律一目了然。',
        img: '/art/feature-charts.svg',
        link: '/Tools/?tab=charts',
        linkText: '打开图表分析（免登录）',
        tags: ['ECharts', '多表 JOIN', '四种图表'],
    },
    {
        title: '日常问题与文档研究',
        desc: '记录开发与运维过程中的常见问题、排查思路与解决方案，技术文档的阅读笔记与研究心得，持续沉淀方法论与最佳实践。',
        img: '/art/feature-notes.svg',
        link: '/DailyProblem/',
        linkText: '开始阅读',
        tags: ['经验沉淀', '技术笔记'],
    },
]);
const pinEl = ref<HTMLElement | null>(null);
const scrollFeat = ref(0);
const featDir = ref<'down' | 'up'>('down');

const heroEl = ref<HTMLElement | null>(null);
const stickyEl = ref<HTMLElement | null>(null);

// 首屏轮番图与功能一览的交叉淡化：根据下滑幅度计算两者透明度
function onHomeScroll() {
    const mobile = window.innerWidth <= 600;
    const vh = window.innerHeight;
    const y = window.scrollY;
    // 手机端：首屏轮番图隐藏，功能区直接展示，滚动仅切换模块
    if (mobile) {
        if (stickyEl.value) {
            stickyEl.value.style.opacity = '1';
            stickyEl.value.style.pointerEvents = 'auto';
        }
        if (heroEl.value) heroEl.value.style.opacity = '0';
        const idx = Math.min(features.value.length - 1, Math.max(0, Math.floor(y / vh)));
        if (idx !== scrollFeat.value) {
            featDir.value = idx > scrollFeat.value ? 'down' : 'up';
            scrollFeat.value = idx;
        }
        return;
    }
    const fadePx = vh * 0.8; // 前 80vh 滚动区间内完成交叉淡化
    const fadeT = Math.min(1, Math.max(0, y / fadePx));
    if (heroEl.value) {
        heroEl.value.style.opacity = String(1 - fadeT);
        heroEl.value.style.transform = `scale(${1 - 0.05 * fadeT})`;
    }
    if (stickyEl.value) {
        stickyEl.value.style.opacity = String(fadeT);
        stickyEl.value.style.pointerEvents = fadeT > 0.5 ? 'auto' : 'none';
    }
    // 淡化完成后再随滚动依次切换功能模块
    const idx = Math.min(features.value.length - 1, Math.max(0, Math.floor(Math.max(0, y - fadePx) / vh)));
    if (idx !== scrollFeat.value) {
        featDir.value = idx > scrollFeat.value ? 'down' : 'up';
        scrollFeat.value = idx;
    }
}
// 手机端与桌面端的功能区滚动高度不同（手机端无首屏与交叉淡化段）
function layoutFeaturePin() {
    if (!pinEl.value) return;
    pinEl.value.style.height = window.innerWidth <= 600
        ? `${features.value.length * 100}vh`
        : `calc(80vh + ${(features.value.length + 1) * 100}vh)`;
}
function scrollToFeat(i: number) {
    const el = pinEl.value;
    if (!el) return;
    const top = el.getBoundingClientRect().top + window.scrollY + i * window.innerHeight;
    window.scrollTo({ top, behavior: 'smooth' });
}
function scrollToFeatures() {
    const el = pinEl.value;
    if (!el) return;
    window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY, behavior: 'smooth' });
}

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
            { text: '日常问题与文档研究', href: '/DailyProblem/' },
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

// 视口变化：重算功能区滚动高度并刷新状态
function onViewportResize() {
    layoutFeaturePin();
    onHomeScroll();
}
onMounted(() => {
  // 主页导航悬浮：给 body 打标记（样式泄漏安全），离开主页即恢复
  document.body.classList.add('dbm-home-active');
  startTimer();
  layoutFeaturePin();
  onHomeScroll();
  window.addEventListener('scroll', onHomeScroll, { passive: true });
  window.addEventListener('resize', onViewportResize);
});
onBeforeUnmount(() => {
  document.body.classList.remove('dbm-home-active');
  stopTimer();
  window.removeEventListener('scroll', onHomeScroll);
  window.removeEventListener('resize', onViewportResize);
});
</script>

<template>
    <div class="home-page">
        <!-- 首屏：主轮番图（下滑 80vh 内与功能区交叉淡化） -->
        <div class="hero-pin">
            <section class="hero-section" ref="heroEl">
            <div class="hero-carousel" aria-label="站点轮播展示" @mouseenter="stopTimer" @mouseleave="startTimer">
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
            </div>
            <button class="scroll-hint" aria-label="向下滚动查看功能" @click="scrollToFeatures">
                <span>向下滑动 · 探索站内功能</span>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="6 9 12 15 18 9"/>
                </svg>
            </button>
            </section>
        </div>

        <!-- 功能一览：滚动逐项展示（前 80vh 与首屏交叉淡化） -->
        <section class="features-pin" ref="pinEl" :style="{ height: `calc(80vh + ${(features.length + 1) * 100}vh)` }">
            <div class="features-sticky" ref="stickyEl">
                <div class="features-head">
                    <p class="features-eyebrow">FEATURES</p>
                    <h2 class="section-title">功能一览</h2>
                </div>
                <div class="feature-stage">
                    <Transition :name="featDir === 'down' ? 'feat-down' : 'feat-up'" mode="out-in">
                        <div :key="scrollFeat" class="feature-row" :class="{ reverse: scrollFeat % 2 === 1 }">
                            <div class="feature-img">
                                <img :src="features[scrollFeat].img" :alt="`${features[scrollFeat].title} 示例图`" />
                            </div>
                            <div class="feature-text">
                                <div class="feature-tags">
                                    <span v-for="t in features[scrollFeat].tags" :key="t" class="tag">{{ t }}</span>
                                </div>
                                <h3>{{ features[scrollFeat].title }}</h3>
                                <p>{{ features[scrollFeat].desc }}</p>
                                <a class="feature-link" :href="features[scrollFeat].link">{{ features[scrollFeat].linkText }} →</a>
                            </div>
                        </div>
                    </Transition>
                </div>
                <div class="feat-progress" aria-label="功能进度">
                    <button
                        v-for="(f, i) in features"
                        :key="f.title"
                        class="feat-dot"
                        :class="{ active: scrollFeat === i }"
                        :aria-label="f.title"
                        @click="scrollToFeat(i)"
                    ></button>
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
/* ========== 主页配色变量：亮色模式淡蓝底 / 暗色模式深灰底（跟随主题切换） ========== */
:global(body.dbm-home-active) {
    --hp-bg: radial-gradient(1400px 800px at 50% -10%, #eaf3ff 0%, #dcebfd 48%, #d7e8fb 100%) #e3eefc;
    --hp-nav-bg: rgba(255, 255, 255, 0.62);
    --hp-nav-border: rgba(59, 130, 246, 0.22);
    --hp-nav-shadow: 0 10px 30px rgba(30, 64, 175, 0.10);
    --hp-nav-title: #17324d;
    --hp-nav-link: #3d5a80;
    --hp-nav-link-active: #2563eb;
    --hp-nav-pill: rgba(255, 255, 255, 0.75);
    --hp-nav-pill-border: rgba(59, 130, 246, 0.3);
    --hp-nav-pill-text: #6b83a3;
    --hp-icon: #3d5a80;
    --hp-title: #14304d;
    --hp-text: #46608a;
    --hp-muted: #5b7292;
    --hp-line: rgba(37, 99, 235, 0.14);
    --hp-card-bg: rgba(255, 255, 255, 0.62);
    --hp-card-bg-hover: rgba(255, 255, 255, 0.92);
    --hp-card-border: rgba(59, 130, 246, 0.22);
    --hp-card-hover-border: rgba(37, 99, 235, 0.55);
    --hp-card-shadow: 0 18px 44px rgba(30, 64, 175, 0.22);
    --hp-img-shadow: 0 14px 34px rgba(30, 64, 175, 0.20);
    --hp-carousel-shadow: 0 12px 34px rgba(30, 64, 175, 0.18);
    --hp-accent: #2563eb;
    --hp-accent-2: #0891b2;
    --hp-accent-solid: #2563eb;
    --hp-tag-text: #1d4ed8;
    --hp-tag-bg: rgba(37, 99, 235, 0.08);
    --hp-tag-border: rgba(37, 99, 235, 0.24);
    --hp-panel-bg: rgba(255, 255, 255, 0.55);
    --hp-font-serif: 'Times New Roman', 'SimSun', '宋体', serif;
    background: var(--hp-bg) !important;
}
:global(html.dark body.dbm-home-active) {
    --hp-bg: radial-gradient(1400px 800px at 50% -10%, #1c2433 0%, #141926 55%, #111521 100%) #12161f;
    --hp-nav-bg: rgba(15, 23, 42, 0.72);
    --hp-nav-border: rgba(71, 85, 105, 0.45);
    --hp-nav-shadow: 0 10px 30px rgba(0, 0, 0, 0.35);
    --hp-nav-title: #f1f5f9;
    --hp-nav-link: #cbd5e1;
    --hp-nav-link-active: #7db2ff;
    --hp-nav-pill: rgba(30, 41, 59, 0.7);
    --hp-nav-pill-border: rgba(71, 85, 105, 0.5);
    --hp-nav-pill-text: #7c8aa0;
    --hp-icon: #cbd5e1;
    --hp-title: #f1f5f9;
    --hp-text: #b7c2d4;
    --hp-muted: #8fa1b8;
    --hp-line: rgba(255, 255, 255, 0.08);
    --hp-card-bg: rgba(255, 255, 255, 0.035);
    --hp-card-bg-hover: rgba(255, 255, 255, 0.06);
    --hp-card-border: rgba(255, 255, 255, 0.08);
    --hp-card-hover-border: rgba(96, 165, 250, 0.45);
    --hp-card-shadow: 0 16px 38px rgba(0, 0, 0, 0.35);
    --hp-img-shadow: 0 12px 30px rgba(0, 0, 0, 0.4);
    --hp-carousel-shadow: 0 10px 30px rgba(0, 0, 0, 0.14);
    --hp-accent: #7db2ff;
    --hp-accent-2: #67e8f9;
    --hp-accent-solid: #3b82f6;
    --hp-tag-text: #93c5fd;
    --hp-tag-bg: rgba(59, 130, 246, 0.16);
    --hp-tag-border: rgba(96, 165, 250, 0.35);
    --hp-panel-bg: rgba(255, 255, 255, 0.03);
}
/* 主页导航悬浮胶囊：固定定位，真正悬浮于内容之上 */
:global(body.dbm-home-active .VPNavBar) {
    position: fixed !important;
    top: 14px !important;
    left: 16px !important;
    right: 16px !important;
    border-radius: 16px;
    background: var(--hp-nav-bg) !important;
    -webkit-backdrop-filter: blur(16px) saturate(1.5);
    backdrop-filter: blur(16px) saturate(1.5);
    border: 1px solid var(--hp-nav-border);
    box-shadow: var(--hp-nav-shadow);
    font-family: 'Times New Roman', 'SimSun', '宋体', serif;
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
/* 导航文字：亮色模式深蓝字 / 暗色模式浅字 */
:global(body.dbm-home-active .VPNavBarTitle .title),
:global(body.dbm-home-active .VPNavBarTitle .text) {
    color: var(--hp-nav-title) !important;
}
:global(body.dbm-home-active .VPNavBarMenuLink) {
    color: var(--hp-nav-link) !important;
}
:global(body.dbm-home-active .VPNavBarMenuLink.active),
:global(body.dbm-home-active .VPNavBarMenuLink:hover) {
    color: var(--hp-nav-link-active) !important;
}
:global(body.dbm-home-active .VPNavBarSearch .DocSearch-Button) {
    background: var(--hp-nav-pill) !important;
    border-color: var(--hp-nav-pill-border) !important;
}
:global(body.dbm-home-active .VPNavBarSearch .DocSearch-Button-Placeholder),
:global(body.dbm-home-active .VPNavBarSearch .DocSearch-Button-Key) {
    color: var(--hp-nav-pill-text) !important;
    background: transparent !important;
    border-color: var(--hp-nav-pill-border) !important;
}
:global(body.dbm-home-active .VPSwitch) {
    background: var(--hp-nav-pill) !important;
    border-color: var(--hp-nav-pill-border) !important;
}
:global(body.dbm-home-active .VPSwitch .icon),
:global(body.dbm-home-active .VPSocialLink) {
    color: var(--hp-icon) !important;
}

.home-page {
    width: 100%;
    padding: 0;
    /* 统一字体：中文宋体、英文 Times New Roman */
    font-family: 'Times New Roman', 'SimSun', '宋体', serif;

    /* 字号体系（按角色统一） */
    --hp-fs-display: 26px;
    --hp-fs-h3: 26px;
    --hp-fs-desc: 18px;
    --hp-fs-ui: 17px;
    --hp-fs-tag: 15px;
    --hp-fs-small: 14px;
    --hp-fs-link: 15.5px;
    --hp-fs-grouph: 17px;
}

/* ========== 首屏轮番图 ========== */
/* 首屏钉住层：轮番图在前 80vh 滚动区间内固定，随后被功能区覆盖 */
.hero-pin {
    position: relative;
    height: calc(100vh + 80vh);
}
.hero-section {
    position: sticky;
    top: 0;
    height: 100vh;
    height: 100svh;
    min-height: 540px;
    will-change: opacity, transform;
}
.hero-carousel {
    position: relative;
    height: 100%;
    overflow: hidden;
    background: #0f172a;
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
    padding: 46px 28px 24px 48px;
    background: linear-gradient(transparent, rgba(0, 0, 0, 0.62));
    color: #fff;
    font-size: 18px;
    font-weight: 600;
    letter-spacing: 0.5px;
    text-align: left;
    text-shadow: 0 1px 4px rgba(0, 0, 0, 0.4);
}
.carousel-arrow {
    position: absolute;
    top: 50%;
    transform: translateY(-50%);
    width: 42px;
    height: 42px;
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
.carousel-arrow.prev { left: 22px; }
.carousel-arrow.next { right: 22px; }
.carousel-dots {
    position: absolute;
    bottom: 24px;
    right: 26px;
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

/* 下滑提示 */
.scroll-hint {
    position: absolute;
    left: 50%;
    bottom: 20px;
    transform: translateX(-50%);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 3px;
    background: transparent;
    border: none;
    color: #fff;
    font-size: 14px;
    letter-spacing: 2px;
    cursor: pointer;
    text-shadow: 0 1px 6px rgba(0, 0, 0, 0.55);
    z-index: 5;
}
.scroll-hint svg {
    width: 22px;
    height: 22px;
    animation: hintBounce 1.8s ease-in-out infinite;
}
@keyframes hintBounce {
    0%, 100% { transform: translateY(0); opacity: 0.9; }
    50% { transform: translateY(7px); opacity: 0.5; }
}

/* ========== 功能一览：滚动钉住逐项展示 ========== */
.features-pin {
    position: relative;
    margin-top: -100vh; /* 与首屏钉住层重叠，交叉淡化 */
    /* 实际高度由模板 :style 按功能数量设置 */
}
.features-sticky {
    position: sticky;
    top: 0;
    height: 100vh;
    height: 100svh;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 92px 32px 28px;
    box-sizing: border-box;
    overflow: hidden;
    opacity: 0; /* 初始透明，滚动幅度驱动淡入（JS 设置） */
    pointer-events: none;
}
/* 标题区固定高度：翻转切换时不跳动，位置在导航下方居中偏上 */
.features-head {
    text-align: center;
    height: 74px;
    flex-shrink: 0;
}
.features-eyebrow {
    font-size: var(--hp-fs-small);
    letter-spacing: 4px;
    color: var(--hp-accent-2);
    margin: 0 0 8px;
}
.section-title {
    text-align: center;
    font-size: var(--hp-fs-display);
    font-weight: 700;
    letter-spacing: 1px;
    margin: 0;
    background: linear-gradient(95deg, var(--hp-accent) 25%, var(--hp-accent-2) 80%);
    -webkit-background-clip: text;
    background-clip: text;
    -webkit-text-fill-color: transparent;
    color: transparent;
}
/* 功能内容舞台：占满标题以下全部空间，切换时尺寸稳定 */
.feature-stage {
    position: relative;
    flex: 1;
    width: 100%;
    min-height: 0;
    display: flex;
    align-items: center;
    justify-content: center;
}
.feature-row {
    display: grid;
    grid-template-columns: 1.15fr 1fr;
    gap: 52px;
    align-items: stretch;
    width: min(1560px, calc(100% - 48px));
}
.feature-row.reverse .feature-img { order: 2; }
.feature-row.reverse .feature-text { order: 1; }
.feature-img {
    border-radius: 14px;
    overflow: hidden;
    box-shadow: var(--hp-img-shadow);
    aspect-ratio: 16 / 10;
}
.feature-img img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
}
.feature-tags { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 16px; }
.tag {
    font-size: var(--hp-fs-tag);
    font-weight: 600;
    padding: 4px 16px;
    border-radius: 999px;
    color: var(--hp-tag-text);
    background: var(--hp-tag-bg);
    border: 1px solid var(--hp-tag-border);
}
/* 功能描述 + 入口：无边框悬浮文字块，悬停上浮 */
.feature-text {
    display: flex;
    flex-direction: column;
    justify-content: center;
    padding: 0 12px;
    box-sizing: border-box;
    transition: transform 0.3s ease;
}
.feature-row:hover .feature-text {
    transform: translateY(-8px);
}
.feature-text h3 {
    display: flex;
    align-items: center;
    gap: 14px;
    font-size: var(--hp-fs-h3);
    font-weight: 700;
    color: var(--hp-title);
    margin: 0 0 16px;
}
.feature-text h3::before {
    content: '';
    width: 7px;
    height: 27px;
    border-radius: 4px;
    background: linear-gradient(180deg, var(--hp-accent), var(--hp-accent-2));
    flex-shrink: 0;
}
.feature-text p {
    font-size: var(--hp-fs-desc);
    line-height: 1.95;
    color: var(--hp-text);
    margin: 0 0 26px;
}
.feature-link {
    align-self: flex-start;
    display: inline-block;
    padding: 12px 30px;
    border-radius: 12px;
    font-size: var(--hp-fs-ui);
    font-weight: 600;
    text-decoration: none;
    color: var(--hp-accent);
    border: 1px solid var(--hp-accent);
    transition: all 0.2s;
}
.feature-link:hover {
    color: #fff;
    background: var(--hp-accent-solid);
    transform: translateY(-1px);
    box-shadow: 0 8px 18px rgba(37, 99, 235, 0.35);
}

/* 进度点（右侧竖排） */
.feat-progress {
    position: absolute;
    right: 26px;
    top: 50%;
    transform: translateY(-50%);
    display: flex;
    flex-direction: column;
    gap: 12px;
}
.feat-dot {
    width: 9px;
    height: 9px;
    border-radius: 999px;
    border: none;
    padding: 0;
    background: var(--hp-line);
    cursor: pointer;
    transition: all 0.25s;
}
.feat-dot.active { background: var(--hp-accent); height: 24px; border-radius: 5px; }
.feat-counter {
    font-size: var(--hp-fs-small);
    color: var(--hp-muted);
}

/* 切换动画：随滚动方向上滑 / 下滑淡入淡出 */
.feat-down-enter-active, .feat-down-leave-active,
.feat-up-enter-active, .feat-up-leave-active {
    transition: opacity 0.3s ease, transform 0.34s cubic-bezier(0.22, 1, 0.36, 1);
}
.feat-down-enter-from { opacity: 0; transform: translateY(70px); }
.feat-down-leave-to { opacity: 0; transform: translateY(-70px); }
.feat-up-enter-from { opacity: 0; transform: translateY(-70px); }
.feat-up-leave-to { opacity: 0; transform: translateY(70px); }

/* ========== 底部导航 ========== */
.home-footer-nav {
    width: 100%;
    margin: 48px 0 0;
    padding: 34px 48px 22px;
    border-radius: 0;
    background: var(--hp-panel-bg);
    border-top: 1px solid var(--hp-line);
    box-sizing: border-box;
}
.footer-cols {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    gap: 24px;
    max-width: 1560px;
    margin: 0 auto;
}
.footer-col h4 {
    font-size: var(--hp-fs-grouph);
    font-weight: 700;
    letter-spacing: 1px;
    color: var(--hp-title);
    margin: 0 0 12px;
}
.footer-col a {
    display: block;
    font-size: var(--hp-fs-link);
    color: var(--hp-muted);
    text-decoration: none;
    padding: 5px 0;
    transition: color 0.15s;
}
.footer-col a:hover { color: var(--hp-accent); }
.footer-note {
    margin: 26px 0 0;
    padding-top: 16px;
    border-top: 1px solid var(--hp-line);
    text-align: center;
    font-size: var(--hp-fs-small);
    letter-spacing: 1px;
    color: var(--hp-muted);
}

/* ========== 响应式 ========== */
@media (max-width: 820px) {
    .features-sticky {
        padding: 74px 20px 24px;
    }
    .features-head { height: 60px; }
    .feature-row {
        grid-template-columns: 1fr;
        gap: 16px;
        width: calc(100% - 32px);
    }
    .feature-row.reverse .feature-img { order: 0; }
    .feature-img { aspect-ratio: auto; }
    .feature-img img { height: 30vh; }
    .section-title { font-size: 20px; }
    .feat-progress { right: 10px; }
    /* 字幕上移，底部留出下滑提示条空间，避免重叠 */
    .carousel-caption { font-size: 15px; padding: 40px 20px 48px 24px; }
    .scroll-hint { bottom: 12px; }
    .carousel-dots { bottom: 18px; right: 14px; }
    .carousel-arrow.prev { left: 10px; }
    .carousel-arrow.next { right: 10px; }
    .home-footer-nav { padding: 28px 24px 18px; margin-top: 40px; }
    .footer-cols { gap: 20px; }
}
@media (max-width: 600px) {
    .hero-section { min-height: 480px; }
    .carousel-caption { font-size: 14.5px; padding-bottom: 44px; }
    .scroll-hint span { display: none; }
    .scroll-hint { bottom: 10px; }
    .carousel-dots { bottom: 14px; right: 12px; }
    .features-eyebrow { letter-spacing: 3px; }
    .feature-text { padding: 0 6px; }
    .feature-text h3 { font-size: 22px; }
    .feature-text p { font-size: 17px; }
    .home-footer-nav { padding: 24px 20px 14px; margin-top: 32px; }
    .footer-cols { gap: 16px; }
    /* 手机端隐藏首屏轮番图，功能区直接成为首屏 */
    .hero-pin { display: none; }
    .features-pin { margin-top: 0; }
    :global(body.dbm-home-active .VPNavBar) {
        top: 10px !important;
        left: 10px !important;
        right: 10px !important;
    }
}
</style>
