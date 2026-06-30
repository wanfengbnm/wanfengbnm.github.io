<script setup lang="ts">
import { computed, onBeforeMount, ref } from 'vue';
import DataChartPanel from '../.vitepress/components/DataChartPanel.vue';

interface TableInfo {
  schema: string;
  name: string;
  columns: { name: string; type: string }[];
}

type ConnectionState = 'idle' | 'connecting' | 'connected' | 'error';
type ChartType = 'bar' | 'line' | 'pie' | 'scatter';

import { API_ORIGIN } from '../.vitepress/apiConfig';

const apiEndpoint = API_ORIGIN ? `${API_ORIGIN}/api/sqlserver` : '/api/sqlserver';

const form = ref({
  server: '',
  port: '1433',
  database: '',
  username: '',
  password: '',
  instanceName: '',
});

const connState = ref<ConnectionState>('idle');
const connMessage = ref('');
const tables = ref<TableInfo[]>([]);
const selectedTable = ref('');
const xColumn = ref('');
const yColumn = ref('');
const aggregation = ref<'COUNT' | 'SUM' | 'AVG' | 'NONE'>('COUNT');
const chartType = ref<ChartType>('bar');

const chartLabels = ref<string[]>([]);
const chartValues = ref<number[]>([]);
const chartXColumn = ref('');
const chartYColumn = ref('');
const chartTitle = ref('');
const mode = ref<'single' | 'multi'>('single');
const selectedTables = ref<string[]>([]);
const joinRelations = ref<{from: {schema:string;table:string;column:string}; to: {schema:string;table:string;column:string}; fkName: string}[]>([]);
const joinHubTable = ref<{schema: string; name: string} | null>(null);
const qualifiedColumns = ref<{qualified: string; name: string; table: string; tableSchema: string; type: string}[]>([]);
const joinDescription = ref('');
const generating = ref(false);
const errorMessage = ref('');
const chartPanelRef = ref<{ downloadPNG: () => void; viewImage: () => void } | null>(null);

const currentTable = computed(() =>
  tables.value.find((t) => `${t.schema}.${t.name}` === selectedTable.value)
);

const yColumnRequired = computed(() => aggregation.value !== 'COUNT');

onBeforeMount(() => {
  const saved = sessionStorage.getItem('sqlserver_connection');
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      form.value.server = parsed.server || '';
      form.value.port = parsed.port || '1433';
      form.value.database = parsed.database || '';
      form.value.username = parsed.username || '';
      form.value.password = parsed.password || '';
      form.value.instanceName = parsed.instanceName || '';

      if (parsed.server && parsed.database && parsed.username && parsed.password) {
        connect();
      }
    } catch {
      // ignore parse errors
    }
  }
});

const buildPayload = () => ({
  server: form.value.server.trim(),
  port: form.value.port.trim(),
  database: form.value.database.trim(),
  username: form.value.username.trim(),
  password: form.value.password,
  instanceName: form.value.instanceName.trim(),
});

const connect = async () => {
  if (!form.value.server.trim() || !form.value.database.trim() || !form.value.username.trim() || !form.value.password) {
    connMessage.value = '请填写完整的连接信息。';
    return;
  }

  connState.value = 'connecting';
  connMessage.value = '正在连接...';
  errorMessage.value = '';
  tables.value = [];
  selectedTable.value = '';
  xColumn.value = '';
  yColumn.value = '';

  try {
    const resp = await fetch(`${apiEndpoint}/tables-info`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(buildPayload()),
    });

    const data = await resp.json();

    if (!resp.ok) {
      throw new Error(data.message || `请求失败 (${resp.status})`);
    }

    tables.value = data.tables || [];
    connState.value = 'connected';
    connMessage.value = `已连接，共 ${tables.value.length} 张表`;
  } catch (err) {
    connState.value = 'error';
    connMessage.value = err instanceof Error ? err.message : '连接失败';
  }
};

const onTableSelect = () => {
  xColumn.value = '';
  yColumn.value = '';
  chartLabels.value = [];
  chartValues.value = [];
};

const generateChart = async () => {
  if (!selectedTable.value || !xColumn.value || !aggregation.value) {
    errorMessage.value = '请选择表和 X 轴列。';
    return;
  }

  if (yColumnRequired.value && !yColumn.value) {
    errorMessage.value = '当前聚合方式需要选择 Y 轴列。';
    return;
  }

  errorMessage.value = '';
  generating.value = true;

  const [schema, name] = selectedTable.value.split('.');

  try {
    const resp = await fetch(`${apiEndpoint}/chart-data`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...buildPayload(),
        tableSchema: schema,
        tableName: name,
        xColumn: xColumn.value,
        yColumn: yColumn.value || undefined,
        aggregation: aggregation.value,
      }),
    });

    const data = await resp.json();

    if (!resp.ok) {
      throw new Error(data.message || `请求失败 (${resp.status})`);
    }

    chartLabels.value = data.labels || [];
    chartValues.value = data.values || [];
    chartXColumn.value = data.xColumn || '';
    chartYColumn.value = data.yColumn || '';
    chartTitle.value = `${name} — ${data.xColumn}${data.aggregation !== 'NONE' ? ` ${data.aggregation} ${data.yColumn}` : ` / ${data.yColumn}`}`;
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : '生成图表失败';
    chartLabels.value = [];
    chartValues.value = [];
  } finally {
    generating.value = false;
  }
};

const onJoinTablesChange = async () => {
  xColumn.value = '';
  yColumn.value = '';
  qualifiedColumns.value = [];
  joinRelations.value = [];
  joinHubTable.value = null;
  joinDescription.value = '';
  chartLabels.value = [];
  chartValues.value = [];
  errorMessage.value = '';

  if (selectedTables.value.length < 2) return;

  try {
    const tablesPayload = selectedTables.value.map((key) => {
      const [s, ...n] = key.split('.');
      return { schema: s, name: n.join('.') };
    });

    const resp = await fetch(`${apiEndpoint}/join-relations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...buildPayload(), tables: tablesPayload }),
    });

    const data = await resp.json();
    if (!resp.ok) throw new Error(data.message || '关系检测失败');

    joinRelations.value = data.relations || [];
    joinHubTable.value = data.hubTable || null;
    qualifiedColumns.value = data.columns || [];
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : '关系检测失败';
    joinRelations.value = [];
  }
};

const generateJoinChart = async () => {
  if (selectedTables.value.length < 2 || !xColumn.value) {
    errorMessage.value = '请选择表和 X 轴列。';
    return;
  }

  const tablesPayload = selectedTables.value.map((key) => {
    const [s, ...n] = key.split('.');
    return { schema: s, name: n.join('.') };
  });

  const parseQualified = (q: string) => {
    const dotIdx = q.indexOf('.');
    if (dotIdx === -1) return null;
    const tbl = q.slice(0, dotIdx);
    const col = q.slice(dotIdx + 1);
    const found = qualifiedColumns.value.find((c) => c.qualified === q);
    return found ? { qualified: q, name: col, table: tbl, tableSchema: found.tableSchema } : null;
  };

  const xColObj = parseQualified(xColumn.value);
  const yColObj = yColumn.value ? parseQualified(yColumn.value) : null;

  if (!xColObj) {
    errorMessage.value = 'X 轴列无效。';
    return;
  }

  generating.value = true;
  errorMessage.value = '';

  try {
    const resp = await fetch(`${apiEndpoint}/join-data`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...buildPayload(),
        tables: tablesPayload,
        hubTable: joinHubTable.value,
        xColumn: xColObj,
        yColumn: yColObj,
        aggregation: aggregation.value,
      }),
    });

    const data = await resp.json();
    if (!resp.ok) throw new Error(data.message || '查询失败');

    chartLabels.value = data.labels || [];
    chartValues.value = data.values || [];
    chartXColumn.value = data.xColumn || '';
    chartYColumn.value = data.yColumn || '';
    joinDescription.value = data.joinDescription || '';
    chartTitle.value = `JOIN: ${joinDescription.value} — ${data.xColumn}${data.aggregation !== 'NONE' ? ` ${data.aggregation} ${data.yColumn}` : ''}`;
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : '生成图表失败';
    chartLabels.value = [];
    chartValues.value = [];
  } finally {
    generating.value = false;
  }
};

const resetJoinState = () => {
  selectedTables.value = [];
  joinRelations.value = [];
  joinHubTable.value = null;
  qualifiedColumns.value = [];
  joinDescription.value = '';
  xColumn.value = '';
  yColumn.value = '';
  chartLabels.value = [];
  chartValues.value = [];
};

const aggregationOptions = [
  { value: 'COUNT', label: 'COUNT — 计数' },
  { value: 'SUM', label: 'SUM — 求和' },
  { value: 'AVG', label: 'AVG — 平均值' },
  { value: 'NONE', label: '无聚合 — 原始数据' },
] as const;

const chartTypeOptions = [
  { value: 'bar', label: '柱状图' },
  { value: 'line', label: '折线图' },
  { value: 'pie', label: '饼图' },
  { value: 'scatter', label: '散点图' },
] as const;
</script>

<template>
  <div class="dv-page">
    <div class="dv-header">
      <h1>数据库数据可视化</h1>
      <p>连接数据库后，选择表和列生成统计图表</p>
    </div>

    <div class="dv-body">
      <!-- 左侧连接和配置面板 -->
      <aside class="dv-sidebar">
        <!-- 连接信息 -->
        <section class="dv-card">
          <h2>数据库连接</h2>

          <label>
            <span>服务器地址</span>
            <input v-model="form.server" type="text" placeholder="192.168.1.10" />
          </label>

          <div class="dv-form-row">
            <label>
              <span>端口</span>
              <input v-model="form.port" type="text" placeholder="1433" />
            </label>
            <label>
              <span>实例名</span>
              <input v-model="form.instanceName" type="text" placeholder="可选" />
            </label>
          </div>

          <label>
            <span>数据库名</span>
            <input v-model="form.database" type="text" placeholder="business_db" />
          </label>

          <label>
            <span>用户名</span>
            <input v-model="form.username" type="text" placeholder="数据库账号" />
          </label>

          <label>
            <span>密码</span>
            <input v-model="form.password" type="password" placeholder="数据库密码" />
          </label>

          <button class="dv-btn dv-btn--primary" :disabled="connState === 'connecting'" @click="connect">
            {{ connState === 'connecting' ? '连接中...' : connState === 'connected' ? '重新连接' : '连接数据库' }}
          </button>

          <p v-if="connMessage" class="dv-status" :class="`dv-status--${connState}`">{{ connMessage }}</p>
        </section>

        <!-- 查询模式切换 -->
        <section v-if="connState === 'connected'" class="dv-card">
          <h2>查询模式</h2>
          <div class="dv-mode-toggle">
            <button class="dv-mode-btn" :class="{ 'dv-mode-btn--active': mode === 'single' }" @click="mode = 'single'; resetJoinState()">单表查询</button>
            <button class="dv-mode-btn" :class="{ 'dv-mode-btn--active': mode === 'multi' }" @click="mode = 'multi'">多表 JOIN 查询</button>
          </div>
        </section>

        <!-- 图表配置（单表模式） -->
        <section v-if="connState === 'connected' && mode === 'single'" class="dv-card">
          <h2>图表配置</h2>

          <label>
            <span>选择表</span>
            <select v-model="selectedTable" @change="onTableSelect">
              <option value="">-- 请选择表 --</option>
              <option v-for="t in tables" :key="`${t.schema}.${t.name}`" :value="`${t.schema}.${t.name}`">
                {{ t.schema }}.{{ t.name }} ({{ t.columns.length }} 列)
              </option>
            </select>
          </label>

          <label>
            <span>X 轴列（分组列）</span>
            <select v-model="xColumn" :disabled="!selectedTable">
              <option value="">-- 请选择列 --</option>
              <option v-for="col in currentTable?.columns" :key="col.name" :value="col.name">
                {{ col.name }} ({{ col.type }})
              </option>
            </select>
          </label>

          <label v-if="yColumnRequired">
            <span>Y 轴列（数值列）</span>
            <select v-model="yColumn" :disabled="!selectedTable">
              <option value="">-- 请选择列 --</option>
              <option v-for="col in currentTable?.columns" :key="col.name" :value="col.name">
                {{ col.name }} ({{ col.type }})
              </option>
            </select>
          </label>

          <label>
            <span>聚合方式</span>
            <select v-model="aggregation">
              <option v-for="opt in aggregationOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
            </select>
          </label>

          <label>
            <span>图表类型</span>
            <select v-model="chartType">
              <option v-for="opt in chartTypeOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
            </select>
          </label>

          <button class="dv-btn dv-btn--primary" :disabled="generating || !selectedTable || !xColumn" @click="generateChart">
            {{ generating ? '生成中...' : '生成图表' }}
          </button>

          <p v-if="errorMessage" class="dv-error">{{ errorMessage }}</p>
        </section>

        <!-- 多表 JOIN 配置 -->
        <section v-if="connState === 'connected' && mode === 'multi'" class="dv-card">
          <h2>多表 JOIN 配置</h2>

          <label>
            <span>选择表（至少 2 张）</span>
            <div class="dv-multi-select">
              <div v-for="t in tables" :key="`${t.schema}.${t.name}`" class="dv-checkbox-label">
                <span class="dv-checkbox-text">{{ t.schema }}.{{ t.name }} ({{ t.columns.length }} 列)</span>
                <input type="checkbox" :value="`${t.schema}.${t.name}`" v-model="selectedTables" @change="onJoinTablesChange" />
              </div>
            </div>
          </label>

          <div v-if="joinRelations.length > 0" class="dv-join-info">
            <p class="dv-join-info__title">检测到的外键关系：</p>
            <p v-for="rel in joinRelations" :key="rel.fkName" class="dv-join-info__rel">
              {{ rel.from.schema }}.{{ rel.from.table }}.{{ rel.from.column }} → {{ rel.to.schema }}.{{ rel.to.table }}.{{ rel.to.column }}
            </p>
            <p v-if="joinHubTable" class="dv-join-info__hub">
              中心表：{{ joinHubTable.schema }}.{{ joinHubTable.name }}
            </p>
          </div>

          <label>
            <span>X 轴列（分组列）</span>
            <select v-model="xColumn" :disabled="qualifiedColumns.length === 0">
              <option value="">-- 请选择列 --</option>
              <option v-for="col in qualifiedColumns" :key="col.qualified" :value="col.qualified">
                {{ col.qualified }} ({{ col.type }})
              </option>
            </select>
          </label>

          <label v-if="yColumnRequired">
            <span>Y 轴列（数值列）</span>
            <select v-model="yColumn" :disabled="qualifiedColumns.length === 0">
              <option value="">-- 请选择列 --</option>
              <option v-for="col in qualifiedColumns" :key="col.qualified" :value="col.qualified">
                {{ col.qualified }} ({{ col.type }})
              </option>
            </select>
          </label>

          <label>
            <span>聚合方式</span>
            <select v-model="aggregation">
              <option v-for="opt in aggregationOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
            </select>
          </label>

          <label>
            <span>图表类型</span>
            <select v-model="chartType">
              <option v-for="opt in chartTypeOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
            </select>
          </label>

          <button class="dv-btn dv-btn--primary" :disabled="generating || joinRelations.length === 0 || !xColumn" @click="generateJoinChart">
            {{ generating ? '生成中...' : '生成 JOIN 图表' }}
          </button>

          <p v-if="errorMessage" class="dv-error">{{ errorMessage }}</p>
        </section>
      </aside>

      <!-- 右侧图表面板 -->
      <main class="dv-main">
        <DataChartPanel
          ref="chartPanelRef"
          :labels="chartLabels"
          :values="chartValues"
          :chart-type="chartType"
          :title="chartTitle"
          :x-column="chartXColumn"
          :y-column="chartYColumn"
        />
        <div v-if="chartLabels.length" class="dv-chart-toolbar">
          <button class="dv-chart-btn" @click="chartPanelRef?.downloadPNG()">下载 PNG</button>
          <button class="dv-chart-btn" @click="chartPanelRef?.viewImage()">查看图片</button>
        </div>
      </main>
    </div>
  </div>
</template>

<style scoped>
.dv-page {
  max-width: 1400px;
  margin: 0 auto;
  padding: 24px 20px;
}

.dv-header {
  margin-bottom: 28px;
}

.dv-header h1 {
  margin: 0 0 8px;
  font-size: clamp(24px, 3vw, 34px);
  color: var(--vp-c-text-1, #1f2328);
}

.dv-header p {
  margin: 0;
  color: var(--vp-c-text-2, #555);
  font-size: 14px;
}

.dv-sidebar {
  display: grid;
  gap: 16px;
}

.dv-card {
  padding: 20px;
  border: 1px solid var(--vp-c-divider, rgba(0, 0, 0, 0.08));
  border-radius: 18px;
  background: var(--vp-c-bg, #fff);
  display: grid;
  gap: 12px;
}

.dv-card h2 {
  margin: 0 0 4px;
  font-size: 17px;
  color: var(--vp-c-text-1, #1f2328);
}

.dv-card label {
  display: grid;
  gap: 6px;
}

.dv-card span {
  font-size: 13px;
  font-weight: 600;
  color: var(--vp-c-text-2, #555);
}

.dv-card input,
.dv-card select {
  width: 100%;
  padding: 10px 12px;
  border-radius: 10px;
  border: 1px solid var(--vp-c-divider, rgba(0, 0, 0, 0.1));
  background: var(--vp-c-bg-soft, rgba(0, 0, 0, 0.03));
  color: var(--vp-c-text-1, #1f2328);
  box-sizing: border-box;
  font-size: 14px;
}

.dv-card select:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.dv-form-row {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.dv-btn {
  margin-top: 4px;
  padding: 11px 16px;
  border: none;
  border-radius: 12px;
  font-weight: 600;
  font-size: 14px;
  cursor: pointer;
  transition: opacity 0.2s;
}

.dv-btn:disabled {
  cursor: progress;
  opacity: 0.7;
}

.dv-btn--primary {
  background: linear-gradient(135deg, var(--vp-c-brand-1, #409eff), var(--vp-c-brand-2, #5a9cff));
  color: #fff;
  box-shadow: 0 10px 24px rgba(64, 158, 255, 0.2);
}

.dv-status {
  margin: 0;
  font-size: 13px;
  line-height: 1.5;
}

.dv-status--connecting { color: var(--vp-c-brand-1, #409eff); }
.dv-status--connected { color: #22c55e; }
.dv-status--error { color: var(--vp-c-danger-1, #f56c6c); }
.dv-status--idle { color: var(--vp-c-text-3, #888); }

.dv-error {
  margin: 0;
  color: var(--vp-c-danger-1, #f56c6c);
  font-size: 13px;
  line-height: 1.5;
}

.dv-main {
  padding: 20px;
  border: 1px solid var(--vp-c-divider, rgba(0, 0, 0, 0.08));
  border-radius: 18px;
  background: var(--vp-c-bg, #fff);
  min-height: 460px;
}

.dv-chart-toolbar {
  display: flex;
  gap: 8px;
  justify-content: center;
  padding-top: 12px;
}

.dv-body {
  display: grid;
  grid-template-columns: 320px minmax(0, 1fr);
  gap: 24px;
  align-items: start;
}

.dv-chart-btn {
  padding: 7px 20px;
  border: 1px solid var(--vp-c-divider, rgba(0, 0, 0, 0.1));
  border-radius: 8px;
  background: var(--vp-c-bg-soft, rgba(0, 0, 0, 0.03));
  color: var(--vp-c-text-2, #555);
  font-size: 13px;
  cursor: pointer;
  transition: all 0.15s;
}

.dv-chart-btn:hover {
  border-color: var(--vp-c-brand-1, #409eff);
  color: var(--vp-c-brand-1, #409eff);
  background: var(--vp-c-brand-soft, rgba(64, 158, 255, 0.08));
}

@media (max-width: 900px) {
  .dv-body {
    grid-template-columns: 1fr;
  }

  .dv-main {
    min-height: 360px;
  }
}

@media (max-width: 640px) {
  .dv-page {
    padding: 16px 12px;
  }

  .dv-form-row {
    grid-template-columns: 1fr;
  }

  .dv-card {
    padding: 16px;
  }
}

.dv-mode-toggle {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.dv-mode-btn {
  padding: 10px;
  border: 2px solid var(--vp-c-divider, rgba(0, 0, 0, 0.1));
  border-radius: 12px;
  background: var(--vp-c-bg-soft, rgba(0, 0, 0, 0.03));
  font-weight: 600;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s;
  color: var(--vp-c-text-1, #1f2328);
}

.dv-mode-btn--active {
  border-color: var(--vp-c-brand-1, #409eff);
  background: color-mix(in srgb, var(--vp-c-brand-soft, rgba(64, 158, 255, 0.12)) 60%, transparent);
  color: var(--vp-c-brand-1, #409eff);
}

.dv-multi-select {
  max-height: 240px;
  overflow-y: auto;
  border: 1px solid var(--vp-c-divider, rgba(0, 0, 0, 0.1));
  border-radius: 10px;
  padding: 8px;
}

.dv-checkbox-label {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 8px;
  cursor: pointer;
  font-size: 14px;
}

.dv-checkbox-label:hover {
  background: var(--vp-c-bg-soft, rgba(0, 0, 0, 0.03));
  border-radius: 6px;
}

.dv-join-info {
  padding: 10px 12px;
  border-radius: 10px;
  background: color-mix(in srgb, var(--vp-c-brand-soft, rgba(64, 158, 255, 0.08)) 60%, transparent);
  font-size: 13px;
}

.dv-join-info__title {
  margin: 0 0 6px;
  font-weight: 600;
  color: var(--vp-c-text-1, #1f2328);
}

.dv-join-info__rel {
  margin: 3px 0;
  font-family: monospace;
  color: var(--vp-c-brand-1, #409eff);
}

.dv-join-info__hub {
  margin: 8px 0 0;
  font-weight: 600;
  color: var(--vp-c-text-1, #1f2328);
}
</style>
