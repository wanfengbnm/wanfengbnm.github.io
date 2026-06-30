<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue';

type PreviewState = 'idle' | 'loading' | 'ready' | 'error';

type DiagramResponse = {
  imageUrl?: string;
  imageBase64?: string;
  svg?: string;
  title?: string;
  message?: string;
};

const form = ref({
  server: '',
  port: '1433',
  database: '',
  username: '',
  password: '',
  instanceName: '',
});

const connecting = ref(false);
const connected = ref(false);
const serverDatabases = ref<string[]>([]);

onMounted(() => {
  const saved = localStorage.getItem('sqlserver_diagram_server');
  if (saved) {
    form.value.server = saved;
  }
});

import { API_ORIGIN } from '../apiConfig';

const apiEndpoint = API_ORIGIN ? `${API_ORIGIN}/api/sqlserver/diagram` : '/api/sqlserver/diagram';
const previewState = ref<PreviewState>('idle');
const previewTitle = ref('等待生成可视化图像');
const previewMessage = ref('填写 SQL Server 连接信息并点击生成，右侧将展示数据库结构图。');
const previewSrc = ref('');
const previewDownloadSrc = ref('');
const previewDownloadName = ref('sqlserver-diagram.svg');
const errorMessage = ref('');
const isZoomOpen = ref(false);
let objectUrl: string | null = null;

const clearPreviewUrl = () => {
  if (objectUrl) {
    URL.revokeObjectURL(objectUrl);
    objectUrl = null;
  }
};

const setPreviewFromBlob = (blob: Blob, filename = 'sqlserver-diagram.svg') => {
  clearPreviewUrl();
  objectUrl = URL.createObjectURL(blob);
  previewSrc.value = objectUrl;
  previewDownloadSrc.value = objectUrl;
  previewDownloadName.value = filename;
};

const setPreviewFromSvg = (svg: string, filename = 'sqlserver-diagram.svg') => {
  clearPreviewUrl();
  const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
  objectUrl = URL.createObjectURL(blob);
  previewSrc.value = objectUrl;
  previewDownloadSrc.value = objectUrl;
  previewDownloadName.value = filename;
};

const resetPreviewArtifacts = () => {
  previewSrc.value = '';
  previewDownloadSrc.value = '';
  previewDownloadName.value = 'sqlserver-diagram.svg';
  isZoomOpen.value = false;
};

const applyDiagramResponse = async (response: Response) => {
  const contentType = response.headers.get('content-type') || '';

  const parseErrorMessage = async () => {
    try {
      if (contentType.includes('application/json')) {
        const data = await response.json() as DiagramResponse;
        return data.message || '后端返回了错误，但没有提供详细信息。';
      }

      const text = await response.text();
      if (text.trim()) {
        try {
          const data = JSON.parse(text) as DiagramResponse;
          return data.message || text;
        } catch {
          return text;
        }
      }
    } catch {
      // ignore parse errors and fall back below
    }

    return `接口请求失败，状态码 ${response.status}`;
  };

  if (contentType.includes('image/')) {
    setPreviewFromBlob(await response.blob(), `${form.value.database || 'sqlserver-diagram'}.svg`);
    return;
  }

  if (contentType.includes('application/json')) {
    const data = (await response.json()) as DiagramResponse;

    if (data.imageUrl) {
      clearPreviewUrl();
      previewSrc.value = data.imageUrl;
      previewDownloadSrc.value = data.imageUrl;
      previewDownloadName.value = `${form.value.database || 'sqlserver-diagram'}.svg`;
    } else if (data.imageBase64) {
      clearPreviewUrl();
      previewSrc.value = `data:image/png;base64,${data.imageBase64}`;
      previewDownloadSrc.value = previewSrc.value;
      previewDownloadName.value = `${form.value.database || 'sqlserver-diagram'}.png`;
    } else if (data.svg) {
      setPreviewFromSvg(data.svg, `${form.value.database || 'sqlserver-diagram'}.svg`);
    } else {
      throw new Error(data.message || '后端没有返回可视化图像');
    }

    previewTitle.value = data.title || `${form.value.database} 数据库可视化`;
    return;
  }

  const text = await response.text();
  if (text.trim().startsWith('<svg')) {
    setPreviewFromSvg(text, `${form.value.database || 'sqlserver-diagram'}.svg`);
    previewTitle.value = `${form.value.database} 数据库可视化`;
    return;
  }

  throw new Error(await parseErrorMessage());
};

const buildPayload = () => ({
  server: form.value.server.trim(),
  port: form.value.port.trim(),
  database: form.value.database.trim(),
  username: form.value.username.trim(),
  password: form.value.password,
  instanceName: form.value.instanceName.trim(),
});

const saveServer = () => {
  localStorage.setItem('sqlserver_diagram_server', form.value.server.trim());
  if (connected.value) {
    connected.value = false;
    serverDatabases.value = [];
    form.value.database = '';
  }
};

const connectToServer = async () => {
  errorMessage.value = '';
  if (!form.value.server.trim() || !form.value.username.trim() || !form.value.password) {
    errorMessage.value = '请至少填写服务器地址、用户名和密码。';
    return;
  }

  connecting.value = true;
  connected.value = false;
  serverDatabases.value = [];
  form.value.database = '';
  saveServer();

  const listEndpoint = API_ORIGIN ? `${API_ORIGIN}/api/sqlserver/list-databases` : '/api/sqlserver/list-databases';

  try {
    const resp = await fetch(listEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        server: form.value.server.trim(),
        port: form.value.port.trim(),
        username: form.value.username.trim(),
        password: form.value.password,
        instanceName: form.value.instanceName.trim(),
      }),
    });

    const data = await resp.json();
    if (!resp.ok) throw new Error(data.message || '连接失败');

    serverDatabases.value = data.databases || [];
    if (serverDatabases.value.length === 0) {
      throw new Error('服务器上未找到可用数据库。');
    }
    connected.value = true;
    errorMessage.value = '';
  } catch (err) {
    connected.value = false;
    errorMessage.value = err instanceof Error ? err.message : '连接服务器失败';
  } finally {
    connecting.value = false;
  }
};

const submit = async () => {
  errorMessage.value = '';

  if (!form.value.server.trim() || !form.value.username.trim() || !form.value.password) {
    errorMessage.value = '请至少填写服务器地址、用户名和密码。';
    return;
  }
  if (!form.value.database.trim()) {
    errorMessage.value = '请先连接服务器并选择数据库。';
    return;
  }

  previewState.value = 'loading';
  previewTitle.value = '正在生成图像';
  previewMessage.value = '已提交连接信息，等待后端返回数据库结构图。';

  try {
    const response = await fetch(apiEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(buildPayload()),
    });

    if (!response.ok) {
      throw new Error(await (async () => {
        try {
          const text = await response.text();
          if (!text.trim()) {
            return `接口请求失败，状态码 ${response.status}`;
          }

          try {
            const data = JSON.parse(text) as DiagramResponse;
            return data.message || text;
          } catch {
            return text;
          }
        } catch {
          return `接口请求失败，状态码 ${response.status}`;
        }
      })());
    }

    await applyDiagramResponse(response);
    previewTitle.value = `${form.value.database} 数据库可视化`;
    previewState.value = 'ready';
    previewMessage.value = '图像已经加载完成，可以直接在网站中查看。';
  } catch (error) {
    const message = error instanceof Error ? error.message : '生成失败，请检查后端接口。';
    errorMessage.value = `${message} 请确认 ${apiEndpoint} 可访问，并且后端已接入 SQL Server。`;
    previewState.value = 'error';
    previewTitle.value = '生成失败';
    previewMessage.value = '当前页面只能发起请求并展示结果，实际连接数据库需要后端服务支持。';
    clearPreviewUrl();
    resetPreviewArtifacts();
  }
};

const navigateToViz = () => {
  sessionStorage.setItem('sqlserver_connection', JSON.stringify({
    server: form.value.server.trim(),
    port: form.value.port.trim(),
    database: form.value.database.trim(),
    username: form.value.username.trim(),
    password: form.value.password,
    instanceName: form.value.instanceName.trim(),
  }));
  window.location.href = '/DataVisualization/';
};

const openZoom = () => {
  if (previewSrc.value) {
    isZoomOpen.value = true;
  }
};

const closeZoom = () => {
  isZoomOpen.value = false;
};

const downloadDiagram = async () => {
  if (!previewDownloadSrc.value) {
    return;
  }

  const link = document.createElement('a');
  link.href = previewDownloadSrc.value;
  link.download = previewDownloadName.value;
  link.rel = 'noopener';
  document.body.appendChild(link);
  link.click();
  link.remove();
};

const exportDiagram = () => {
  if (!previewSrc.value) {
    return;
  }

  const newWindow = window.open(previewSrc.value, '_blank', 'noopener,noreferrer');
  if (newWindow) {
    newWindow.focus();
  }
};

onBeforeUnmount(() => {
  clearPreviewUrl();
  resetPreviewArtifacts();
});
</script>

<template>
  <section class="sql-panel" aria-labelledby="sql-panel-title">
    <div class="sql-panel__header">
      <div>
        <p class="sql-panel__eyebrow">
          便携式数据库可视化工具
          <span class="sql-info-icon" title="该功能目前仅用于帮助开发者观察数据库内部数据，后台不会存储所输入的数据库信息">!</span>
        </p>
        <h2 id="sql-panel-title">SQL Server 数据库可视化</h2>
        <p class="sql-panel__desc">输入数据库连接信息后，请求后端生成结构图，并直接渲染到首页下方。</p>
      </div>
      <div class="sql-panel__badge">支持图片 / SVG 返回</div>
    </div>

    <div class="sql-panel__body">
      <form class="sql-form" @submit.prevent="submit">
        <label>
          <span>服务器地址</span>
          <input v-model="form.server" type="text" placeholder="例如 192.168.1.10" @input="saveServer" />
        </label>

        <div class="sql-form__row">
          <label>
            <span>端口</span>
            <input v-model="form.port" type="text" placeholder="1433" @input="saveServer" />
          </label>

          <label>
            <span>实例名</span>
            <input v-model="form.instanceName" type="text" placeholder="可选" />
          </label>
        </div>

        <label>
          <span>用户名</span>
          <input v-model="form.username" type="text" placeholder="数据库账号" @input="saveServer" />
        </label>

        <label>
          <span>密码</span>
          <input v-model="form.password" type="password" placeholder="数据库密码" @input="saveServer" />
        </label>

        <button type="button" class="sql-form__connect" :disabled="connecting" @click="connectToServer">
          {{ connecting ? '连接中...' : connected ? '已连接' : '连接服务器' }}
        </button>

        <label v-if="connected">
          <span>选择数据库</span>
          <select v-model="form.database">
            <option value="">-- 请选择数据库 --</option>
            <option v-for="db in serverDatabases" :key="db" :value="db">{{ db }}</option>
          </select>
        </label>

        <button class="sql-form__submit" type="submit" :disabled="previewState === 'loading' || !connected">
          {{ previewState === 'loading' ? '生成中...' : '生成可视化图像' }}
        </button>

        <p v-if="errorMessage" class="sql-form__error">{{ errorMessage }}</p>
      </form>

      <div class="sql-preview" :data-state="previewState">
        <div class="sql-preview__actions" v-if="previewSrc && previewState === 'ready'">
          <button type="button" class="sql-preview__action" @click="openZoom">点击放大</button>
          <button type="button" class="sql-preview__action" @click="downloadDiagram">下载图像</button>
          <button type="button" class="sql-preview__action" @click="exportDiagram">导出查看</button>
        </div>

        <div class="sql-preview__image-wrap">
          <button v-if="previewSrc" type="button" class="sql-preview__zoom-trigger" @click="openZoom" aria-label="点击放大预览图像">
            <img :src="previewSrc" :alt="previewTitle" class="sql-preview__image" />
          </button>
          <div v-else class="sql-preview__empty">
            <div class="sql-preview__icon">DB</div>
            <p>{{ previewMessage }}</p>
          </div>
        </div>

        <div class="sql-preview__footer">
          <h3>{{ previewTitle }}</h3>
          <p>{{ previewMessage }}</p>
        </div>
      </div>
    </div>

    <div v-if="previewState === 'ready'" class="sql-viz-entry">
      <button type="button" class="sql-viz-entry__button" @click="navigateToViz">
        <span class="sql-viz-entry__icon">📊</span>
        <span class="sql-viz-entry__text">
          <strong>更多可视化操作</strong>
          <small>对数据库表数据进行统计图表分析</small>
        </span>
        <span class="sql-viz-entry__arrow">→</span>
      </button>
    </div>

    <div v-if="isZoomOpen" class="sql-lightbox" role="dialog" aria-modal="true" @click.self="closeZoom">
      <div class="sql-lightbox__panel">
        <div class="sql-lightbox__header">
          <h3>{{ previewTitle }}</h3>
          <button type="button" class="sql-lightbox__close" @click="closeZoom">关闭</button>
        </div>
        <img :src="previewSrc" :alt="previewTitle" class="sql-lightbox__image" />
      </div>
    </div>
  </section>
</template>

<style scoped>
.sql-panel {
  margin: 72px auto 24px;
  width: min(1200px, calc(100% - 32px));
  padding: 28px;
  border: 1px solid var(--vp-c-divider, rgba(0, 0, 0, 0.08));
  border-radius: 24px;
  background:
    linear-gradient(180deg, color-mix(in srgb, var(--vp-c-bg, #fff) 92%, transparent), var(--vp-c-bg, #fff)),
    radial-gradient(circle at top right, rgba(64, 158, 255, 0.16), transparent 32%),
    radial-gradient(circle at bottom left, rgba(60, 180, 120, 0.12), transparent 30%);
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.08);
}

.sql-panel__header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;
  margin-bottom: 24px;
}

.sql-panel__eyebrow {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 0 0 8px;
  font-size: 12px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--vp-c-text-3, #888);
}

.sql-info-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  border: 1.5px solid var(--vp-c-text-3, #888);
  font-size: 10px;
  font-weight: 700;
  font-style: normal;
  cursor: help;
  flex-shrink: 0;
}

.sql-panel h2 {
  margin: 0;
  font-size: clamp(24px, 3vw, 34px);
  line-height: 1.15;
  color: var(--vp-c-text-1, #1f2328);
}

.sql-panel__desc {
  margin: 10px 0 0;
  max-width: 720px;
  color: var(--vp-c-text-2, #555);
  line-height: 1.7;
}

.sql-panel__badge {
  padding: 10px 14px;
  border-radius: 999px;
  border: 1px solid var(--vp-c-divider, rgba(0, 0, 0, 0.08));
  background: var(--vp-c-bg-soft, rgba(0, 0, 0, 0.03));
  color: var(--vp-c-text-2, #555);
  white-space: nowrap;
}

.sql-panel__body {
  display: grid;
  grid-template-columns: minmax(0, 400px) minmax(0, 1fr);
  gap: 20px;
}

.sql-form,
.sql-preview {
  border-radius: 20px;
  border: 1px solid var(--vp-c-divider, rgba(0, 0, 0, 0.08));
  background: var(--vp-c-bg, #fff);
}

.sql-form {
  padding: 22px;
  display: grid;
  gap: 14px;
}

.sql-form label {
  display: grid;
  gap: 8px;
}

.sql-form span {
  font-size: 14px;
  font-weight: 600;
  color: var(--vp-c-text-2, #555);
}

.sql-form input {
  width: 100%;
  padding: 12px 14px;
  border-radius: 12px;
  border: 1px solid var(--vp-c-divider, rgba(0, 0, 0, 0.1));
  background: var(--vp-c-bg-soft, rgba(0, 0, 0, 0.03));
  color: var(--vp-c-text-1, #1f2328);
  box-sizing: border-box;
}

.sql-form input::placeholder {
  color: var(--vp-c-text-3, #8b8b8b);
}

.sql-form__row {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.sql-form__connect {
  margin-top: 4px;
  padding: 11px 16px;
  border: 2px solid var(--vp-c-brand-1, #409eff);
  border-radius: 14px;
  background: transparent;
  color: var(--vp-c-brand-1, #409eff);
  font-weight: 700;
  cursor: pointer;
  transition: all 0.15s;
}

.sql-form__connect:hover {
  background: var(--vp-c-brand-soft, rgba(64, 158, 255, 0.1));
}

.sql-form__connect:disabled {
  cursor: progress;
  opacity: 0.6;
}

.sql-form select {
  width: 100%;
  padding: 12px 14px;
  border-radius: 12px;
  border: 1px solid var(--vp-c-divider, rgba(0, 0, 0, 0.1));
  background: var(--vp-c-bg-soft, rgba(0, 0, 0, 0.03));
  color: var(--vp-c-text-1, #1f2328);
  box-sizing: border-box;
}

.sql-form__submit {
  margin-top: 4px;
  padding: 13px 16px;
  border: none;
  border-radius: 14px;
  background: linear-gradient(135deg, var(--vp-c-brand-1, #409eff), var(--vp-c-brand-2, #5a9cff));
  color: #fff;
  font-weight: 700;
  cursor: pointer;
  box-shadow: 0 14px 30px rgba(64, 158, 255, 0.24);
}

.sql-form__submit:disabled {
  cursor: progress;
  opacity: 0.72;
}

.sql-form__error {
  margin: 0;
  color: var(--vp-c-danger-1, #f56c6c);
  line-height: 1.6;
}

.sql-form__hint {
  margin: 0;
  font-size: 13px;
  color: var(--vp-c-text-3, #8b8b8b);
  word-break: break-all;
}

.sql-preview {
  padding: 18px;
  display: grid;
  grid-template-rows: auto minmax(340px, 1fr) auto;
  gap: 16px;
}

.sql-preview__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  justify-content: flex-end;
}

.sql-preview__action {
  padding: 9px 14px;
  border: 1px solid var(--vp-c-divider, rgba(0, 0, 0, 0.1));
  border-radius: 999px;
  background: var(--vp-c-bg-soft, rgba(0, 0, 0, 0.03));
  color: var(--vp-c-text-1, #1f2328);
  cursor: pointer;
}

.sql-preview__image-wrap {
  border-radius: 18px;
  border: 1px dashed var(--vp-c-divider, rgba(0, 0, 0, 0.12));
  background: linear-gradient(180deg, rgba(127, 127, 127, 0.05), rgba(127, 127, 127, 0.02));
  overflow: hidden;
  min-height: 340px;
}

.sql-preview__zoom-trigger {
  display: block;
  width: 100%;
  padding: 0;
  border: 0;
  background: transparent;
  cursor: zoom-in;
}

.sql-preview__image {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: contain;
  background: var(--vp-c-bg, #fff);
}

.sql-preview__empty {
  min-height: 340px;
  display: grid;
  place-items: center;
  text-align: center;
  padding: 24px;
  color: var(--vp-c-text-2, #555);
}

.sql-preview__icon {
  width: 88px;
  height: 88px;
  border-radius: 24px;
  display: grid;
  place-items: center;
  margin-bottom: 16px;
  font-size: 26px;
  font-weight: 800;
  letter-spacing: 0.04em;
  color: var(--vp-c-brand-1, #409eff);
  background: color-mix(in srgb, var(--vp-c-brand-soft, rgba(64, 158, 255, 0.12)) 75%, transparent);
}

.sql-preview__footer h3 {
  margin: 0;
  color: var(--vp-c-text-1, #1f2328);
}

.sql-preview__footer p {
  margin: 8px 0 0;
  color: var(--vp-c-text-2, #555);
  line-height: 1.7;
}

.sql-viz-entry {
  margin-top: 20px;
  padding-top: 20px;
  border-top: 1px solid var(--vp-c-divider, rgba(0, 0, 0, 0.08));
}

.sql-viz-entry__button {
  display: flex;
  align-items: center;
  gap: 14px;
  width: 100%;
  padding: 16px 20px;
  border: 2px dashed var(--vp-c-brand-1, #409eff);
  border-radius: 16px;
  background: color-mix(in srgb, var(--vp-c-brand-soft, rgba(64, 158, 255, 0.1)) 60%, transparent);
  cursor: pointer;
  transition: background 0.2s, border-color 0.2s, transform 0.2s;
}

.sql-viz-entry__button:hover {
  background: color-mix(in srgb, var(--vp-c-brand-soft, rgba(64, 158, 255, 0.16)) 80%, transparent);
  border-color: var(--vp-c-brand-2, #5a9cff);
  transform: translateY(-2px);
}

.sql-viz-entry__icon {
  font-size: 28px;
  flex-shrink: 0;
}

.sql-viz-entry__text {
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex: 1;
}

.sql-viz-entry__text strong {
  font-size: 15px;
  color: var(--vp-c-text-1, #1f2328);
}

.sql-viz-entry__text small {
  font-size: 13px;
  color: var(--vp-c-text-2, #555);
}

.sql-viz-entry__arrow {
  font-size: 22px;
  color: var(--vp-c-brand-1, #409eff);
  font-weight: 700;
  flex-shrink: 0;
}

.sql-lightbox {
  position: fixed;
  inset: 0;
  z-index: 60;
  display: grid;
  place-items: center;
  padding: 20px;
  background: rgba(15, 23, 42, 0.72);
  backdrop-filter: blur(8px);
}

.sql-lightbox__panel {
  width: min(96vw, 1400px);
  max-height: 92vh;
  display: grid;
  gap: 14px;
  padding: 18px;
  border-radius: 22px;
  background: var(--vp-c-bg, #fff);
  box-shadow: 0 28px 80px rgba(0, 0, 0, 0.35);
  overflow: auto;
}

.sql-lightbox__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
}

.sql-lightbox__header h3 {
  margin: 0;
  color: var(--vp-c-text-1, #1f2328);
}

.sql-lightbox__close {
  padding: 10px 14px;
  border: 1px solid var(--vp-c-divider, rgba(0, 0, 0, 0.1));
  border-radius: 999px;
  background: var(--vp-c-bg-soft, rgba(0, 0, 0, 0.03));
  color: var(--vp-c-text-1, #1f2328);
  cursor: pointer;
}

.sql-lightbox__image {
  width: auto;
  max-width: none;
  height: auto;
  max-height: none;
  margin: 0 auto;
  display: block;
  background: var(--vp-c-bg-soft, rgba(0, 0, 0, 0.02));
  border-radius: 16px;
}

@media (max-width: 960px) {
  .sql-panel__header,
  .sql-panel__body {
    grid-template-columns: 1fr;
  }

  .sql-panel__header {
    display: grid;
  }

  .sql-panel__badge {
    width: fit-content;
  }
}

@media (max-width: 720px) {
  .sql-panel {
    padding: 18px;
    width: min(100% - 20px, 1200px);
  }

  .sql-form__row {
    grid-template-columns: 1fr;
  }

  .sql-preview__image-wrap,
  .sql-preview__empty {
    min-height: 260px;
  }

  .sql-preview__actions {
    justify-content: flex-start;
  }

  .sql-viz-entry__button {
    flex-direction: column;
    text-align: center;
    gap: 8px;
  }

  .sql-viz-entry__arrow {
    display: none;
  }
}
</style>