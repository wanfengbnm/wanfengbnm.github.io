<script setup lang="ts">
import * as echarts from 'echarts';
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';

const props = defineProps<{
  labels: string[];
  values: number[];
  chartType: 'bar' | 'line' | 'pie' | 'scatter';
  title: string;
  xColumn: string;
  yColumn: string;
}>();

const chartContainer = ref<HTMLDivElement | null>(null);
let chart: echarts.ECharts | null = null;

const buildOption = (): echarts.EChartsOption => {
  const baseOption: echarts.EChartsOption = {
    title: {
      text: props.title,
      left: 'center',
      textStyle: { fontSize: 16, color: '#1f2328' },
    },
    tooltip: {
      trigger: props.chartType === 'pie' ? 'item' : 'axis',
    },
    legend: {
      bottom: 0,
      type: 'scroll',
    },
    grid: props.chartType !== 'pie' ? {
      left: '3%',
      right: '4%',
      bottom: '15%',
      top: '18%',
      containLabel: true,
    } : undefined,
  };

  if (props.chartType === 'pie') {
    return {
      ...baseOption,
      series: [{
        type: 'pie',
        radius: ['45%', '72%'],
        center: ['50%', '52%'],
        data: props.labels.map((label, i) => ({
          name: label,
          value: props.values[i],
        })),
        emphasis: {
          itemStyle: { shadowBlur: 10, shadowOffsetX: 0, shadowColor: 'rgba(0, 0, 0, 0.5)' },
        },
        label: {
          formatter: '{b}: {d}%',
        },
      }],
    };
  }

  if (props.chartType === 'scatter') {
    return {
      ...baseOption,
      xAxis: {
        type: 'category',
        data: props.labels,
        name: props.xColumn,
        axisLabel: { rotate: 30 },
      },
      yAxis: {
        type: 'value',
        name: props.yColumn,
      },
      series: [{
        type: 'scatter',
        data: props.values.map((v, i) => [props.labels[i], v]),
        symbolSize: 10,
      }],
    };
  }

  return {
    ...baseOption,
    xAxis: {
      type: 'category',
      data: props.labels,
      name: props.xColumn,
      axisLabel: { rotate: props.labels.length > 8 ? 30 : 0 },
    },
    yAxis: {
      type: 'value',
      name: props.yColumn,
    },
    series: [{
      type: props.chartType,
      data: props.values,
      smooth: props.chartType === 'line',
      barMaxWidth: 48,
      itemStyle: {
        color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
          { offset: 0, color: '#409eff' },
          { offset: 1, color: '#5a9cff' },
        ]),
      },
    }],
  };
};

const renderChart = () => {
  if (!chartContainer.value) return;
  if (!chart) {
    chart = echarts.init(chartContainer.value);
  }
  chart.setOption(buildOption(), true);
};

const handleResize = () => {
  chart?.resize();
};

onMounted(() => {
  renderChart();
  window.addEventListener('resize', handleResize);
});

onBeforeUnmount(() => {
  window.removeEventListener('resize', handleResize);
  chart?.dispose();
  chart = null;
});

watch(() => [props.labels, props.values, props.chartType, props.title], () => {
  renderChart();
}, { deep: true });
</script>

<template>
  <div class="chart-panel">
    <div v-if="!labels.length" class="chart-panel__empty">
      <div class="chart-panel__empty-icon">📈</div>
      <p>暂无数据 — 请选择表和列后生成图表</p>
    </div>
    <div ref="chartContainer" class="chart-panel__container" :class="{ 'chart-panel__container--hidden': !labels.length }"></div>
  </div>
</template>

<style scoped>
.chart-panel {
  min-height: 420px;
  position: relative;
}

.chart-panel__container {
  width: 100%;
  height: 460px;
}

.chart-panel__container--hidden {
  visibility: hidden;
  height: 0;
  min-height: 0;
}

.chart-panel__empty {
  display: grid;
  place-items: center;
  min-height: 420px;
  text-align: center;
  color: var(--vp-c-text-2, #555);
}

.chart-panel__empty-icon {
  font-size: 48px;
  margin-bottom: 12px;
}

.chart-panel__empty p {
  font-size: 14px;
}
</style>
