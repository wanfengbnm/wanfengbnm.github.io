<script lang="ts" setup>
import { ref, onMounted } from 'vue';
import { useRoute } from 'vitepress';
import SqlServerDiagramPanel from '../.vitepress/components/SqlServerDiagramPanel.vue';
import DataVizPage from '../DataVisualization/index.vue';

const route = useRoute();
const activeTab = ref<'diagram' | 'charts'>('diagram');
const chartsMounted = ref(false);

function switchTab(tab: 'diagram' | 'charts') {
    activeTab.value = tab;
    if (tab === 'charts') chartsMounted.value = true;
}

onMounted(() => {
    if (route.query.tab === 'charts') switchTab('charts');
});
</script>

<template>
    <div class="tools-page">
        <header class="tools-hero">
            <span class="tools-badge">免登录 · 随开随用</span>
            <h1>便携式数据库可视化工具</h1>
            <p>
                填写 SQL Server 连接信息，一键生成数据库结构图，并对表数据生成统计图表，支持图片与 SVG 导出。
                连接信息仅用于本次会话，后台不会存储。
            </p>
        </header>

        <nav class="tools-tabs" aria-label="工具切换">
            <button
                class="tools-tab"
                :class="{ active: activeTab === 'diagram' }"
                @click="switchTab('diagram')"
            >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
                    <ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/>
                </svg>
                结构图生成
            </button>
            <button
                class="tools-tab"
                :class="{ active: activeTab === 'charts' }"
                @click="switchTab('charts')"
            >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
                    <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>
                </svg>
                图表分析
            </button>
        </nav>

        <div class="tools-body">
            <div v-show="activeTab === 'diagram'">
                <SqlServerDiagramPanel @go-viz="switchTab('charts')" />
            </div>
            <div v-if="chartsMounted" v-show="activeTab === 'charts'">
                <DataVizPage />
            </div>
        </div>
    </div>
</template>

<style scoped>
.tools-page {
    width: min(1400px, calc(100% - 32px));
    margin: 0 auto;
    padding: 8px 0 48px;
}

.tools-hero {
    padding: 28px 0 8px;
    text-align: center;
}

.tools-badge {
    display: inline-block;
    padding: 3px 14px;
    border-radius: 999px;
    font-size: 12.5px;
    font-weight: 600;
    color: var(--vp-c-brand-1, #3b82f6);
    background: var(--vp-c-brand-soft, rgba(59, 130, 246, 0.12));
    border: 1px solid var(--vp-c-brand-soft, rgba(59, 130, 246, 0.3));
    margin-bottom: 14px;
}

.tools-hero h1 {
    font-size: 30px;
    font-weight: 700;
    color: var(--vp-c-text-1, #1f2328);
    margin: 0 0 10px;
    letter-spacing: 0.5px;
}

.tools-hero p {
    max-width: 680px;
    margin: 0 auto;
    font-size: 14.5px;
    line-height: 1.75;
    color: var(--vp-c-text-2, #5d7488);
}

/* 标签页 */
.tools-tabs {
    display: flex;
    gap: 8px;
    margin: 22px 0 0;
    border-bottom: 2px solid var(--vp-c-divider, rgba(0, 0, 0, 0.08));
}
.tools-tab {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 11px 22px;
    margin-bottom: -2px;
    border: none;
    border-bottom: 2px solid transparent;
    background: transparent;
    font-size: 15px;
    font-weight: 600;
    color: var(--vp-c-text-2, #5d7488);
    cursor: pointer;
    transition: color 0.15s, border-color 0.15s;
}
.tools-tab svg { width: 17px; height: 17px; }
.tools-tab:hover { color: var(--vp-c-text-1, #1f2328); }
.tools-tab.active {
    color: var(--vp-c-brand-1, #3b82f6);
    border-bottom-color: var(--vp-c-brand-1, #3b82f6);
}

.tools-body {
    margin-top: 4px;
}

/* 面板在标签页内收紧顶部留白 */
.tools-body :deep(.sql-panel) { margin-top: 20px; }
.tools-body :deep(.dv-page) { padding-top: 20px; }
.tools-body :deep(.dv-header) { display: none; }

@media (max-width: 768px) {
    .tools-hero h1 { font-size: 24px; }
    .tools-hero p { font-size: 13.5px; }
    .tools-tab { font-size: 14px; padding: 10px 14px; }
    .tools-body :deep(.sql-panel) { padding: 18px; border-radius: 16px; }
}
</style>
