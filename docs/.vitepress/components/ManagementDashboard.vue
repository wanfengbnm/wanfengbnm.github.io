<template>
  <div v-if="authReady" class="mgmt-container">

      <!-- ==================== 侧边栏 ==================== -->
      <aside class="mgmt-sidebar">
        <div class="sidebar-brand">
          <div class="brand-logo">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
              <ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/>
            </svg>
          </div>
          <div class="brand-meta">
            <span class="brand-text">数据库管理控制台</span>
          </div>
        </div>

        <!-- 数据库选择 -->
        <div class="db-selector">
          <div class="db-current" @click="openDbModal">
            <div class="db-meta">
              <span class="db-label">当前数据库</span>
              <span class="db-name">{{ selectedDb || '选择数据库' }}</span>
            </div>
            <span class="db-arrow">▾</span>
          </div>
        </div>

      <!-- 连接状态 -->
      <div class="conn-status" :class="dbStatus">
        <span class="conn-dot"></span>
        <span class="conn-text">{{ statusText }}</span>
      </div>

      <!-- 主导航 -->
      <nav class="side-nav">
        <div class="table-item" :class="{ active: !selectedTable && !sqlView && !analysisView }" @click="selectTable('')">
          <span class="nav-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
            </svg>
          </span>
          <span class="table-name-text">总览</span>
        </div>
        <div class="table-item" :class="{ active: sqlView }" @click="openSqlView">
          <span class="nav-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/>
            </svg>
          </span>
          <span class="table-name-text">SQL 编辑器</span>
        </div>
        <div class="table-item" :class="{ active: analysisView }" @click="openAnalysisView">
          <span class="nav-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>
            </svg>
          </span>
          <span class="table-name-text">数据分析</span>
        </div>
      </nav>

      <!-- 表列表 -->
      <div class="sidebar-section">
        <div class="section-header">
          <span class="section-title">数据表</span>
          <span class="section-count" v-if="tables.length">{{ tables.length }}</span>
        </div>
        <div class="table-filter-wrap" v-if="tables.length > 5">
          <input v-model="tableFilter" class="table-filter" placeholder="筛选表..." />
        </div>
        <nav class="table-list">
          <div
            v-for="t in filteredTables"
            :key="t.name"
            class="table-item"
            :class="{ active: selectedTable === t.name }"
            @click="selectTable(t.name)"
          >
            <span class="table-name-text">{{ t.name }}</span>
            <span class="table-row-count">{{ t.rowCount }}</span>
            <span class="table-delete" @click.stop="confirmDropTable(t.name)" title="删除表">×</span>
          </div>
          <div v-if="!loadingTables && tables.length === 0" class="empty-tables">
            暂无数据表
          </div>
          <div v-if="loadingTables" class="loading-tables">
            加载中...
          </div>
          <div class="sidebar-new-table" @click="openCreateTable">
            <span class="table-icon">＋</span>
            <span class="table-name-text">创建新表</span>
          </div>
        </nav>
      </div>
    </aside>

    <!-- ==================== 主内容区 ==================== -->
    <main class="mgmt-main">

      <!-- 顶部工具栏 -->
      <div class="main-toolbar">
        <span class="main-title" v-if="selectedTable">{{ selectedTable }}</span>
        <span class="main-title" v-else>总览</span>
        <div class="main-toolbar-right">
          <button class="btn-refresh-top" @click="refreshAll">刷新状态</button>
          <button class="btn-logout-top" @click="handleLogout">退出登录</button>
        </div>
      </div>

      <div class="mgmt-content-area">
      <!-- ===== 独立 SQL 编辑器视图 ===== -->
      <div v-if="sqlView" class="sql-view">
        <div class="sql-card sql-card-full">
          <div class="sql-view-head">
            <h2 class="card-title">SQL 查询编辑器</h2>
            <span class="gov-hint">当前数据库：{{ selectedDb || '—' }} · Ctrl+Enter 执行</span>
          </div>
          <textarea
            v-model="sqlQuery"
            class="sql-editor sql-editor-tall"
            placeholder="输入 SQL 语句…（Ctrl+Enter 执行）&#10;例如：CREATE TABLE users (id INT AUTO_INCREMENT PRIMARY KEY, name VARCHAR(100) NOT NULL, email VARCHAR(255))"
            rows="12"
            @keydown.ctrl.enter.prevent="runSql"
            @keydown.meta.enter.prevent="runSql"
          ></textarea>
          <div v-if="sqlHistory.length" class="sql-history">
            <span class="sql-history-label">🕘 历史</span>
            <button
              v-for="(h, hi) in sqlHistory.slice(0, 8)"
              :key="hi"
              class="sql-history-chip"
              :title="h"
              @click="sqlQuery = h"
            >{{ sqlHistorySnippet(h) }}</button>
            <button class="sql-history-clear" @click="clearSqlHistory">清空历史</button>
          </div>
          <div class="sql-actions">
            <button class="btn-run" @click="runSql" :disabled="runningSql">
              {{ runningSql ? '执行中...' : '▶ 执行' }}
            </button>
            <button class="btn-secondary" v-if="sqlQuery || sqlResult || sqlError" @click="clearSqlEditor">清空</button>
          </div>
          <div v-if="sqlError" class="sql-error">{{ sqlError }}</div>
          <div v-if="sqlResult" class="sql-result">
            <div v-if="sqlResult.type === 'affected'" class="sql-affected">
              {{ sqlResult.message }}
            </div>
            <div v-else class="sql-result-table-wrap">
              <div class="sql-result-info">返回 {{ sqlResult.rowCount }} 行</div>
              <div class="table-wrap mini">
                <table class="data-table">
                  <thead>
                    <tr>
                      <th v-for="col in sqlResult.columns" :key="col">{{ col }}</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="(row, ri) in sqlResult.rows" :key="ri">
                      <td v-for="col in sqlResult.columns" :key="col">{{ formatCell(row[col]) }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- ===== 数据分析视图 ===== -->
      <div v-else-if="analysisView" class="analysis-view">
        <div class="analysis-picker">
          <div class="sql-view-head">
            <h2 class="card-title">数据分析</h2>
            <span class="gov-hint">当前数据库：{{ selectedDb || '—' }} · 选择表与字段，整合后生成可用性与关联分析图表</span>
          </div>

          <div class="analysis-step">
            <span class="step-badge">1</span>
            <span class="step-title">选择数据表</span>
            <span class="gov-hint">最多 8 张</span>
          </div>
          <div class="analysis-checks" v-if="tables.length">
            <label
              v-for="t in tables"
              :key="t.name"
              class="analysis-check"
              :class="{ checked: analysisSelected.includes(t.name) }"
            >
              <input type="checkbox" :checked="analysisSelected.includes(t.name)" @change="toggleAnalysisTable(t.name)" />
              <span class="analysis-check-name">{{ t.name }}</span>
              <span class="analysis-check-count">{{ t.rowCount }} 行</span>
            </label>
          </div>
          <div v-else class="analysis-no-table">当前数据库没有数据表</div>

          <template v-if="analysisSelected.length">
            <div class="analysis-step">
              <span class="step-badge">2</span>
              <span class="step-title">选择分析字段</span>
              <span class="gov-hint">默认全选（每表最多 15 个字段），可按需取消；字段全部取消的表不参与分析</span>
            </div>
            <div class="field-groups">
              <div v-for="t in analysisSelected" :key="t" class="field-group">
                <div class="field-group-head">
                  <span class="field-group-name">{{ t }}</span>
                  <button class="field-group-link" @click="selectAllFields(t, true)">全选</button>
                  <button class="field-group-link" @click="selectAllFields(t, false)">清空</button>
                  <span class="gov-hint">已选 {{ (selectedFields[t] || []).length }} / {{ (fieldOptions[t] || []).length }}</span>
                </div>
                <div class="field-pills">
                  <button
                    v-for="c in (fieldOptions[t] || [])"
                    :key="c.name"
                    class="field-pill"
                    :class="{ active: (selectedFields[t] || []).includes(c.name) }"
                    @click="toggleAnalysisField(t, c.name)"
                  >{{ c.name }}<span v-if="c.key === 'PRI'" class="pill-pk">PK</span></button>
                  <span v-if="!(fieldOptions[t] || []).length" class="gov-hint">字段加载中...</span>
                </div>
              </div>
            </div>
          </template>

          <div class="analysis-toolbar">
            <button class="btn-primary" @click="runAnalysis" :disabled="analysisRunning || !analysisSelected.length">
              {{ analysisRunning ? '分析中...' : '生成分析报告' }}
            </button>
            <button class="btn-secondary" v-if="analysisSelected.length" @click="resetAnalysisSelection">重选</button>
            <span class="gov-hint" v-if="!analysisSelected.length">请至少选择一张表</span>
          </div>
        </div>

        <template v-if="analysisResult">
          <div class="analysis-grid">
            <div class="chart-card">
              <h3 class="chart-title">数据可用性评分对比（字段完整率）</h3>
              <div ref="usabilityChartEl" class="chart-body"></div>
            </div>
            <div class="chart-card">
              <h3 class="chart-title">字段填充率热力图</h3>
              <div ref="fillHeatmapEl" class="chart-body chart-body-tall"></div>
            </div>
          </div>

          <div v-if="analysisResult.correlations.length" class="chart-card analysis-block">
            <div class="corr-head">
              <h3 class="chart-title">数值字段相关性（Pearson）</h3>
              <select v-if="analysisResult.correlations.length > 1" v-model="corrTable" class="gov-select corr-select" @change="renderCorrChart">
                <option v-for="c in analysisResult.correlations" :key="c.table" :value="c.table">{{ c.table }}</option>
              </select>
            </div>
            <div ref="corrHeatmapEl" class="chart-body"></div>
          </div>

          <div v-if="analysisResult.sharedColumns.length" class="chart-card analysis-block">
            <h3 class="chart-title">跨表关联字段（同名列）</h3>
            <div class="table-wrap">
              <table class="data-table">
                <thead>
                  <tr><th>字段</th><th>出现表</th><th>各表填充率</th><th>值重叠度</th></tr>
                </thead>
                <tbody>
                  <tr v-for="s in analysisResult.sharedColumns" :key="s.column">
                    <td class="col-name">{{ s.column }}</td>
                    <td>{{ s.tables.join('、') }}</td>
                    <td>{{ s.fills.map((f) => f.table + ' ' + (f.fillRate * 100).toFixed(0) + '%').join(' · ') }}</td>
                    <td>
                      <template v-if="s.valueOverlap">
                        {{ (s.valueOverlap.ratio * 100).toFixed(1) }}%
                        <span class="gov-hint">（采样 {{ s.valueOverlap.sampled.join(' vs ') }}）</span>
                      </template>
                      <span v-else>—</span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div v-if="analysisResult.numericStats.length" class="chart-card analysis-block">
            <h3 class="chart-title">数值字段统计</h3>
            <div class="table-wrap">
              <table class="data-table">
                <thead>
                  <tr><th>表</th><th>字段</th><th>最小值</th><th>最大值</th><th>平均值</th></tr>
                </thead>
                <tbody>
                  <tr v-for="(s, si) in analysisResult.numericStats" :key="si">
                    <td class="col-name">{{ s.table }}</td>
                    <td class="col-name">{{ s.column }}</td>
                    <td>{{ s.min ?? '—' }}</td>
                    <td>{{ s.max ?? '—' }}</td>
                    <td>{{ s.avg ?? '—' }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </template>
        <div v-else-if="!analysisRunning" class="gov-empty">选择表后点击“生成分析报告”</div>
      </div>

      <!-- ===== 未选中表：总览统计 ===== -->
      <div v-else-if="!selectedTable" class="welcome-view">
        <!-- 概览统计 -->
        <div class="overview-cards">
          <div class="overview-card">
            <div class="ov-value">{{ tables.length }}</div>
            <div class="ov-label">数据表</div>
          </div>
          <div class="overview-card">
            <div class="ov-value">{{ totalRowCount }}</div>
            <div class="ov-label">总行数</div>
          </div>
          <div class="overview-card">
            <div class="ov-value" :class="dbStatus === 'connected' ? 'ov-ok' : (dbStatus === 'error' ? 'ov-bad' : '')">{{ overviewStatus }}</div>
            <div class="ov-label">连接状态</div>
          </div>
          <div class="overview-card">
            <div class="ov-value ov-sm">{{ dbVersion || '—' }}</div>
            <div class="ov-label">数据库版本</div>
          </div>
          <div class="overview-card">
            <div class="ov-value ov-sm">{{ fmtSize(govOverview?.totalSizeKb) }}</div>
            <div class="ov-label">总存储空间</div>
          </div>
        </div>

        <!-- 统计图表 -->
        <div class="overview-charts" v-if="tables.length > 0">
          <div class="chart-card">
            <h3 class="chart-title">各表行数分布</h3>
            <div ref="rowsChartEl" class="chart-body"></div>
          </div>
          <div class="chart-card">
            <h3 class="chart-title">各表存储空间占比</h3>
            <div ref="sizeChartEl" class="chart-body"></div>
          </div>
        </div>
      </div>

      <!-- ===== 选中表：Tab 切换 ===== -->
      <div v-else class="table-view">
        <div class="table-header-bar">
          <h2 class="table-name-title">{{ selectedTable }}</h2>
        </div>

        <div class="tab-bar">
          <div
            v-for="tab in tabs"
            :key="tab.key"
            class="tab-item"
            :class="{ active: activeTab === tab.key }"
            @click="activeTab = tab.key"
          >
            {{ tab.label }}
          </div>
        </div>

        <!-- Tab：浏览数据 -->
        <div v-if="activeTab === 'data'" class="tab-content">
          <div class="toolbar">
            <input
              v-model="searchText"
              class="search-input"
              placeholder="搜索..."
              @input="onSearchInput"
            />
            <select v-model.number="pageSize" class="page-size-select" @change="onPageSizeChange" title="每页行数">
              <option :value="20">20 条/页</option>
              <option :value="50">50 条/页</option>
              <option :value="100">100 条/页</option>
              <option :value="200">200 条/页</option>
            </select>
            <button class="btn-primary" @click="openInsertRow">+ 新增行</button>
            <button class="btn-secondary" @click="exportCsv" :disabled="exporting">
              {{ exporting ? '导出中...' : '导出 CSV' }}
            </button>
            <button class="btn-secondary" @click="renumberIds" :disabled="renumbering">
              {{ renumbering ? '处理中...' : '重新编号 ID' }}
            </button>
          </div>

          <div class="table-wrap">
            <table class="data-table" v-if="tableColumns.length > 0">
              <thead>
                <tr>
                  <th v-for="col in tableColumns" :key="col.name" class="sortable" @click="toggleSort(col.name)">
                    {{ col.name }}
                    <span class="sort-icon" v-if="sortBy === col.name">{{ sortDir === 'asc' ? '↑' : '↓' }}</span>
                    <span class="pk-badge" v-if="col.key === 'PRI'">PK</span>
                  </th>
                  <th class="th-actions">操作</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="row in tableRows" :key="row[primaryKey] ?? JSON.stringify(row)">
                  <td v-for="col in tableColumns" :key="col.name" :class="col.key === 'PRI' ? 'pk-cell' : ''">
                    {{ formatCell(row[col.name]) }}
                  </td>
                  <td class="td-actions">
                    <button class="btn-sm btn-edit" @click="openEditRow(row)">编辑</button>
                    <button class="btn-sm btn-del" @click="confirmDeleteRow(row)">删除</button>
                  </td>
                </tr>
                <tr v-if="tableRows.length === 0">
                  <td :colspan="tableColumns.length + 1" class="empty-cell">暂无数据</td>
                </tr>
              </tbody>
            </table>
            <div v-else class="empty-cell">加载中...</div>
          </div>

          <!-- 分页 -->
          <div class="pagination" v-if="totalPages > 1">
            <button :disabled="page <= 1" @click="goPage(page - 1)">‹ 上一页</button>
            <span class="page-info">{{ page }} / {{ totalPages }}（共 {{ totalRows }} 条）</span>
            <button :disabled="page >= totalPages" @click="goPage(page + 1)">下一页 ›</button>
          </div>
        </div>

        <!-- Tab：表结构 -->
        <div v-if="activeTab === 'structure'" class="tab-content">
          <div class="toolbar">
            <button class="btn-primary" @click="openAddColumn">+ 新建列</button>
          </div>          <div class="table-wrap">
            <table class="data-table">
              <thead>
                <tr>
                  <th>列名</th>
                  <th>类型</th>
                  <th>可空</th>
                  <th>键</th>
                  <th>默认值</th>
                  <th>额外</th>
                  <th class="th-actions">操作</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="col in tableStructure" :key="col.name">
                  <td class="col-name">{{ col.name }}</td>
                  <td><code>{{ col.type }}</code></td>
                  <td>{{ col.nullable ? 'YES' : 'NO' }}</td>
                  <td><span v-if="col.key" class="key-badge">{{ col.key }}</span></td>
                  <td>{{ col.default ?? 'NULL' }}</td>
                  <td>{{ col.extra || '—' }}</td>
                  <td class="td-actions">
                    <button
                      v-if="col.key !== 'PRI' && tableStructure.length > 1"
                      class="btn-sm btn-del"
                      @click="confirmDropColumn(col)"
                    >删除</button>
                    <span v-else class="col-locked">—</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- Tab：SQL -->
        <div v-if="activeTab === 'sql'" class="tab-content">
          <div class="sql-card">
            <textarea
              v-model="tableSqlQuery"
              class="sql-editor"
              rows="4"
              placeholder="输入 SQL 语句…（Ctrl+Enter 执行）"
              @keydown.ctrl.enter.prevent="runTableSql"
              @keydown.meta.enter.prevent="runTableSql"
            ></textarea>
            <div class="sql-actions">
              <button class="btn-run" @click="runTableSql" :disabled="runningSql">
                {{ runningSql ? '执行中...' : '▶ 执行' }}
              </button>
            </div>
            <div v-if="sqlError" class="sql-error">{{ sqlError }}</div>
            <div v-if="sqlResult" class="sql-result">
              <div v-if="sqlResult.type === 'affected'" class="sql-affected">
                {{ sqlResult.message }}
              </div>
              <div v-else class="sql-result-table-wrap">
                <div class="sql-result-info">返回 {{ sqlResult.rowCount }} 行</div>
                <div class="table-wrap mini">
                  <table class="data-table">
                    <thead>
                      <tr>
                        <th v-for="col in sqlResult.columns" :key="col">{{ col }}</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr v-for="(row, ri) in sqlResult.rows" :key="ri">
                        <td v-for="col in sqlResult.columns" :key="col">{{ formatCell(row[col]) }}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Tab：数据治理 -->
        <div v-if="activeTab === 'gov'" class="tab-content">
          <div class="gov-subnav">
            <div
              v-for="gt in govTabs"
              :key="gt.key"
              class="gov-subitem"
              :class="{ active: govTab === gt.key }"
              @click="onGovTabChange(gt.key)"
            >{{ gt.label }}</div>
          </div>

          <!-- 质量检测 -->
          <div v-if="govTab === 'quality'" class="gov-section">
            <div class="gov-toolbar">
              <button class="btn-primary" @click="runQuality" :disabled="qualityLoading">
                {{ qualityLoading ? '检测中...' : '运行质量检测' }}
              </button>
              <span class="gov-hint">对表 {{ selectedTable }} 执行主键、空值率、空字符串与整行重复检查</span>
            </div>
            <div v-if="qualityData" class="quality-summary">
              <div class="quality-score-box" :class="qualityScoreClass">
                <div class="quality-score">{{ qualityData.score }}</div>
                <div class="quality-score-label">质量评分</div>
              </div>
              <div class="quality-meta">
                <div class="q-meta-row">共 {{ qualityData.totalRows }} 行数据 · {{ qualityData.columns.length }} 个字段</div>
                <div class="q-meta-row">{{ qualityData.hasPK ? '已定义主键' : '未定义主键' }} · 发现 {{ qualityData.issues.length }} 项待关注问题</div>
              </div>
              <ul class="issue-list">
                <li v-if="qualityData.issues.length === 0" class="issue-item ok">未发现数据质量问题</li>
                <li v-for="(iss, ii) in qualityData.issues" :key="ii" class="issue-item" :class="iss.level">
                  <span class="issue-level">{{ levelLabel(iss.level) }}</span>{{ iss.message }}
                </li>
              </ul>
            </div>
            <div v-if="qualityData" class="table-wrap gov-table">
              <table class="data-table">
                <thead>
                  <tr>
                    <th>字段</th><th>类型</th><th>空值数</th><th>空值率</th><th>空字符串</th><th>唯一值数</th><th>键</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="c in qualityData.columns" :key="c.name">
                    <td class="col-name">{{ c.name }}</td>
                    <td><code>{{ c.type }}</code></td>
                    <td>{{ c.nullCount ?? '—' }}</td>
                    <td>{{ c.nullRatio === null ? '—' : ((c.nullRatio * 100).toFixed(1) + '%') }}</td>
                    <td>{{ c.emptyCount ?? '—' }}</td>
                    <td>{{ c.distinct ?? '—' }}</td>
                    <td><span v-if="c.key" class="key-badge">{{ c.key }}</span><span v-else>—</span></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <!-- 敏感字段 -->
          <div v-if="govTab === 'sensitive'" class="gov-section">
            <div class="gov-toolbar">
              <button class="btn-primary" @click="runSensitive" :disabled="sensitiveLoading">
                {{ sensitiveLoading ? '扫描中...' : '开始敏感扫描' }}
              </button>
              <span class="gov-hint">基于字段命名规则与内容采样（每字段 500 行）识别敏感数据</span>
            </div>
            <div v-if="sensitiveData" class="table-wrap gov-table">
              <table class="data-table" v-if="sensitiveData.findings.length > 0">
                <thead>
                  <tr><th>字段</th><th>类型</th><th>敏感类别</th><th>风险等级</th><th>识别依据</th><th>命中数</th></tr>
                </thead>
                <tbody>
                  <tr v-for="(f, fi) in sensitiveData.findings" :key="fi">
                    <td class="col-name">{{ f.column }}</td>
                    <td><code>{{ f.type }}</code></td>
                    <td>{{ f.category }}</td>
                    <td><span class="risk-badge" :class="f.level">{{ riskLabel(f.level) }}</span></td>
                    <td>{{ f.source }}</td>
                    <td>{{ f.hits === null ? '—' : f.hits + ' / 500' }}</td>
                  </tr>
                </tbody>
              </table>
              <div v-else class="gov-empty">未在表 {{ selectedTable }} 中识别到敏感字段</div>
            </div>
          </div>

          <!-- 数据字典 -->
          <div v-if="govTab === 'dict'" class="gov-section">
            <div class="gov-toolbar">
              <select v-model="dictTable" @change="fetchDictionary" class="gov-select">
                <option value="" disabled>选择表</option>
                <option v-for="t in dictTables" :key="t.name" :value="t.name">{{ t.name }}{{ t.comment ? '（' + t.comment + '）' : '' }}</option>
              </select>
              <button class="btn-secondary" @click="exportDictionary" :disabled="dictExporting">
                {{ dictExporting ? '导出中...' : '导出全部 CSV' }}
              </button>
            </div>
            <div v-if="dictColumns.length" class="table-wrap gov-table">
              <table class="data-table">
                <thead>
                  <tr><th>字段</th><th>类型</th><th>可空</th><th>键</th><th>默认值</th><th>注释</th></tr>
                </thead>
                <tbody>
                  <tr v-for="c in dictColumns" :key="c.name">
                    <td class="col-name">{{ c.name }}</td>
                    <td><code>{{ c.type }}</code></td>
                    <td>{{ c.nullable ? 'YES' : 'NO' }}</td>
                    <td><span v-if="c.key" class="key-badge">{{ c.key }}</span><span v-else>—</span></td>
                    <td>{{ c.default ?? 'NULL' }}</td>
                    <td class="dict-comment">{{ c.comment || '—' }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div v-else class="gov-empty">{{ dictLoading ? '加载中...' : '请选择要查看的表' }}</div>
          </div>

          <!-- 审计日志 -->
          <div v-if="govTab === 'audit'" class="gov-section">
            <div class="gov-toolbar">
              <select v-model="auditAction" @change="onAuditFilter" class="gov-select">
                <option value="">全部操作</option>
                <option v-for="a in auditActions" :key="a" :value="a">{{ govActionLabel(a) }}</option>
              </select>
              <button class="btn-secondary" @click="onAuditFilter">刷新</button>
              <span class="gov-hint">共 {{ auditTotal }} 条记录</span>
            </div>
            <div class="table-wrap gov-table">
              <table class="data-table">
                <thead>
                  <tr><th>时间</th><th>操作人</th><th>操作</th><th>对象</th><th>详情</th><th>IP</th></tr>
                </thead>
                <tbody>
                  <tr v-for="r in auditRows" :key="r.id">
                    <td class="audit-time">{{ formatTime(r.created_at) }}</td>
                    <td>{{ r.username }}</td>
                    <td><span class="audit-action">{{ govActionLabel(r.action) }}</span></td>
                    <td class="audit-target">{{ r.target || '—' }}</td>
                    <td class="audit-detail" :title="r.detail">{{ r.detail || '—' }}</td>
                    <td class="audit-ip">{{ r.ip || '—' }}</td>
                  </tr>
                  <tr v-if="auditRows.length === 0">
                    <td colspan="6" class="empty-cell">{{ auditLoading ? '加载中...' : '暂无审计记录' }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div class="pagination" v-if="auditPages > 1">
              <button :disabled="auditPage <= 1" @click="goAuditPage(auditPage - 1)">‹ 上一页</button>
              <span class="page-info">{{ auditPage }} / {{ auditPages }}</span>
              <button :disabled="auditPage >= auditPages" @click="goAuditPage(auditPage + 1)">下一页 ›</button>
            </div>
          </div>
        </div>
      </div>
      </div>
    </main>

    <!-- ==================== 弹窗：切换数据库 ==================== -->
    <div v-if="showDbModal" class="modal-overlay" @click.self="showDbModal = false">
      <div class="modal modal-sm">
        <h3>切换数据库</h3>
        <div class="form-group">
          <label>选择数据库</label>
          <div class="db-list">
            <div
              v-for="db in databases"
              :key="db"
              class="db-option"
              :class="{ active: dbModalDb === db }"
              @click="dbModalDb = db"
            >
              {{ db }}
            </div>
          </div>
        </div>
        <div class="form-group">
          <label>用户名 <span class="col-type-hint">(为空则使用默认)</span></label>
          <input v-model="dbModalUser" class="form-input" placeholder="默认: sa" />
        </div>
        <div class="form-group">
          <label>密码 <span class="col-type-hint">(为空则使用默认)</span></label>
          <input v-model="dbModalPass" type="password" class="form-input" placeholder="默认密码" />
        </div>
        <div class="modal-actions">
          <button class="btn-cancel" @click="showDbModal = false">取消</button>
          <button class="btn-primary" @click="switchDb" :disabled="switchingDb || !dbModalDb">
            {{ switchingDb ? '切换中...' : '切换' }}
          </button>
        </div>
        <div v-if="modalError" class="modal-error">{{ modalError }}</div>
      </div>
    </div>

    <!-- ==================== 弹窗：创建表 ==================== -->
    <div v-if="showCreateTable" class="modal-overlay" @click.self="showCreateTable = false">
      <div class="modal">
        <h3>创建新表</h3>
        <div class="form-group">
          <label>表名</label>
          <input v-model="newTable.name" class="form-input" placeholder="例如：users" />
        </div>
        <div class="form-group">
          <label>列定义</label>
          <div class="col-defs">
            <div v-for="(col, ci) in newTable.columns" :key="ci" class="col-row">
              <input v-model="col.name" placeholder="列名" class="col-input" />
              <input v-model="col.type" placeholder="类型" class="col-input type" />
              <label class="col-check"><input type="checkbox" v-model="col.pk" /> PK</label>
              <label class="col-check"><input type="checkbox" v-model="col.autoInc" /> AI</label>
              <label class="col-check"><input type="checkbox" v-model="col.nullable" /> Null</label>
              <button class="btn-sm btn-del" @click="removeColumn(ci)">×</button>
            </div>
          </div>
          <button class="btn-add-col" @click="addColumn">+ 添加列</button>
        </div>
        <div class="modal-actions">
          <button class="btn-cancel" @click="showCreateTable = false">取消</button>
          <button class="btn-primary" @click="createTable" :disabled="creatingTable">
            {{ creatingTable ? '创建中...' : '创建表' }}
          </button>
        </div>
        <div v-if="modalError" class="modal-error">{{ modalError }}</div>
      </div>
    </div>

    <!-- ==================== 弹窗：新建列 ==================== -->
    <div v-if="showAddColumn" class="modal-overlay" @click.self="showAddColumn = false">
      <div class="modal modal-sm">
        <h3>新建列 — {{ selectedTable }}</h3>
        <div class="form-group">
          <label>列名</label>
          <input v-model="newColumn.name" class="form-input" placeholder="例如：age" />
        </div>
        <div class="form-group">
          <label>类型</label>
          <input v-model="newColumn.type" class="form-input" placeholder="例如：VARCHAR(100), INT, DATETIME" />
        </div>
        <div class="form-group">
          <label class="col-check"><input type="checkbox" v-model="newColumn.nullable" /> 允许为空 (NULL)</label>
        </div>
        <div class="form-group">
          <label>默认值 <span class="col-type-hint">(可选，非空列无默认值将自动填充)</span></label>
          <input v-model="newColumn.defaultVal" class="form-input" placeholder="留空则根据类型自动填充" />
          <p class="form-hint" v-if="!newColumn.nullable && !newColumn.defaultVal">
            非空列将自动填充默认值：数值→0，文本→''，日期时间→CURRENT_TIMESTAMP
          </p>
        </div>
        <div class="modal-actions">
          <button class="btn-cancel" @click="showAddColumn = false">取消</button>
          <button class="btn-primary" @click="createColumn" :disabled="addingColumn">
            {{ addingColumn ? '添加中...' : '添加列' }}
          </button>
        </div>
        <div v-if="modalError" class="modal-error">{{ modalError }}</div>
      </div>
    </div>

    <!-- ==================== 弹窗：新增/编辑行 ==================== -->
    <div v-if="showRowModal" class="modal-overlay" @click.self="showRowModal = false">
      <div class="modal">
        <h3>{{ editingRow ? '编辑行' : '新增行' }} — {{ selectedTable }}</h3>
        <div class="form-group" v-for="col in editableColumns" :key="col.name">
          <label>
            {{ col.name }}
            <span class="col-type-hint">{{ col.type }}</span>
            <span v-if="col.key === 'PRI'" class="pk-badge">PK</span>
          </label>
          <input
            v-model="rowForm[col.name]"
            class="form-input"
            :placeholder="col.nullable ? '(可空)' : '必填'"
            :disabled="editingRow && col.key === 'PRI'"
          />
        </div>
        <div class="modal-actions">
          <button class="btn-cancel" @click="showRowModal = false">取消</button>
          <button class="btn-primary" @click="saveRow" :disabled="savingRow">
            {{ savingRow ? '保存中...' : '保存' }}
          </button>
        </div>
        <div v-if="modalError" class="modal-error">{{ modalError }}</div>
      </div>
    </div>

    <!-- ==================== 弹窗：删除确认 ==================== -->
    <div v-if="showDeleteConfirm" class="modal-overlay" @click.self="showDeleteConfirm = false">
      <div class="modal modal-sm">
        <h3>确认删除</h3>
        <p v-if="deleteTarget === 'ROW'">确定要删除这条记录吗？此操作不可撤销。</p>
        <p v-else-if="deleteTarget === 'COLUMN'">确定要删除列 <strong>{{ deleteColumnName }}</strong> 吗？该列的所有数据将丢失。</p>
        <p v-else>确定要删除表 <strong>{{ deleteTableName }}</strong> 吗？所有数据将丢失。</p>
        <div class="modal-actions">
          <button class="btn-cancel" @click="showDeleteConfirm = false">取消</button>
          <button class="btn-danger" @click="doDelete" :disabled="deleting">
            {{ deleting ? '删除中...' : '确认删除' }}
          </button>
        </div>
        <div v-if="modalError" class="modal-error">{{ modalError }}</div>
      </div>
    </div>

  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, nextTick, watch } from 'vue'
import * as echarts from 'echarts'

// 管理页挂载期间给 body 打标记以隐藏 VitePress 页脚；卸载即移除，避免全局样式泄漏
const BODY_FLAG = 'dbm-dashboard-active'

// ====================== 状态 ======================
const authReady = ref(false)
const dbStatus = ref('connecting') // 'connecting' | 'connected' | 'error'
const loadingTables = ref(false)
const databases = ref([])
const selectedDb = ref('')

const statusText = computed(() => {
  const dbName = selectedDb.value || '数据库'
  if (dbStatus.value === 'connecting') return dbName + ' · 连接中...'
  if (dbStatus.value === 'connected') return dbName + ' · 已连接'
  return '数据库连接失败'
})
const overviewStatus = computed(() => {
  if (dbStatus.value === 'connecting') return '连接中...'
  if (dbStatus.value === 'connected') return '正常'
  return '异常'
})
const tables = ref([])
const tableFilter = ref('')
const sqlView = ref(false) // 独立 SQL 编辑器视图
const analysisView = ref(false) // 数据分析视图
const filteredTables = computed(() => {
  const kw = tableFilter.value.trim().toLowerCase()
  if (!kw) return tables.value
  return tables.value.filter((t) => t.name.toLowerCase().includes(kw))
})
const dbVersion = ref('')
const selectedTable = ref('')
const tableStructure = ref([])
const tableRows = ref([])
const tableColumns = ref([])
const primaryKey = ref('')
const totalRows = ref(0)
const totalPages = ref(1)
const page = ref(1)
const pageSize = ref(20)
const searchText = ref('')
const sortBy = ref('id')
const sortDir = ref('asc')
const activeTab = ref('data')

// SQL 编辑器
const sqlQuery = ref('')
const tableSqlQuery = ref('')
const runningSql = ref(false)
const sqlResult = ref(null)
const sqlError = ref('')

// 弹窗
const showCreateTable = ref(false)
const creatingTable = ref(false)
const newTable = ref({ name: '', columns: [{ name: '', type: 'VARCHAR(255)', pk: false, autoInc: false, nullable: true, default: null }] })

const showRowModal = ref(false)
const editingRow = ref(null)
const rowForm = ref({})
const savingRow = ref(false)
const renumbering = ref(false)
const showAddColumn = ref(false)
const newColumn = ref({ name: '', type: 'VARCHAR(255)', nullable: true, defaultVal: '', afterColumn: '' })
const addingColumn = ref(false)

const showDbModal = ref(false)
const dbModalDb = ref('')
const dbModalUser = ref('')
const dbModalPass = ref('')
const switchingDb = ref(false)
const showDeleteConfirm = ref(false)
const deleteTarget = ref('') // 'ROW' | 'TABLE' | 'COLUMN'
const deleteTableName = ref('')
const deleteColumnName = ref('')
const deleteRowData = ref(null)
const deleting = ref(false)
const exporting = ref(false)
const modalError = ref('')

// SQL 执行历史（localStorage 持久化，最近 30 条）
const sqlHistory = ref(loadSqlHistory())

// 防抖定时器
let searchTimer = null

// ====================== API 基地址 ======================
const apiBase = () => {
  if (typeof window === 'undefined') return ''
  if (window.location.hostname === 'localhost') return ''
  return 'https://api.wfbnm.xyz'
}

const apiUrl = (path) => `${apiBase()}/api/mysql${path}`
const authUrl = (path) => `${apiBase()}/api/auth${path}`

function getToken() {
  return localStorage.getItem('admin_token') || ''
}

// 临近过期（<5 分钟）时自动续期 token，活跃用户不会被 30 分钟登出
let refreshingToken = false
function maybeRefreshToken() {
  const expire = Number(localStorage.getItem('expire') || 0)
  if (refreshingToken || !expire || Date.now() < expire - 5 * 60 * 1000) return
  refreshingToken = true
  fetch(authUrl('/refresh'), {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${getToken()}` },
  })
    .then(async (res) => {
      if (!res.ok) return
      const data = await res.json()
      if (data.token) {
        localStorage.setItem('admin_token', data.token)
        localStorage.setItem('expire', String(Date.now() + 30 * 60 * 1000))
      }
    })
    .catch(() => {})
    .finally(() => { setTimeout(() => { refreshingToken = false }, 10 * 1000) })
}

function apiFetch(path, opts = {}) {
  maybeRefreshToken()
  return fetch(apiUrl(path), {
    ...opts,
    headers: {
      ...(opts?.headers || {}),
      'Authorization': `Bearer ${getToken()}`,
      // 告知后端当前操作的数据库，各端/各标签页互不影响
      ...(selectedDb.value ? { 'X-Database': selectedDb.value } : {}),
    },
  })
}

// ====================== SQL 历史 ======================
const SQL_HISTORY_KEY = 'mysql_sql_history'
const SQL_HISTORY_MAX = 30

function loadSqlHistory() {
  try {
    if (typeof localStorage === 'undefined') return []
    const raw = localStorage.getItem(SQL_HISTORY_KEY)
    const arr = raw ? JSON.parse(raw) : []
    return Array.isArray(arr) ? arr.filter((s) => typeof s === 'string') : []
  } catch { return [] }
}

function pushSqlHistory(sql) {
  const q = (sql || '').trim()
  if (!q) return
  sqlHistory.value = [q, ...sqlHistory.value.filter((x) => x !== q)].slice(0, SQL_HISTORY_MAX)
  try { localStorage.setItem(SQL_HISTORY_KEY, JSON.stringify(sqlHistory.value)) } catch {}
}

function clearSqlHistory() {
  sqlHistory.value = []
  try { localStorage.removeItem(SQL_HISTORY_KEY) } catch {}
}

function sqlHistorySnippet(sql) {
  const oneLine = sql.replace(/\s+/g, ' ').trim()
  return oneLine.length > 32 ? oneLine.slice(0, 31) + '…' : oneLine
}

// 只读字段（不在编辑表单中显示）
const READONLY_COLS = ['id', 'created_at', 'updated_at']

// ====================== 计算属性 ======================
const tabs = [
  { key: 'data', label: '数据浏览' },
  { key: 'structure', label: '表结构' },
  { key: 'sql', label: 'SQL 查询' },
  { key: 'gov', label: '数据治理' },
]

// ====================== 数据治理 ======================
const govTabs = [
  { key: 'quality', label: '质量检测' },
  { key: 'sensitive', label: '敏感字段' },
  { key: 'dict', label: '数据字典' },
  { key: 'audit', label: '审计日志' },
]
const govTab = ref('quality')
const qualityLoading = ref(false)
const qualityData = ref(null)
const sensitiveLoading = ref(false)
const sensitiveData = ref(null)
const dictTable = ref('')
const dictTables = ref([])
const dictColumns = ref([])
const dictLoading = ref(false)
const dictExporting = ref(false)
const auditRows = ref([])
const auditTotal = ref(0)
const auditPage = ref(1)
const auditPageSize = ref(15)
const auditPages = ref(1)
const auditAction = ref('')
const auditActions = ref([])
const auditLoading = ref(false)

const GOV_ACTION_LABELS = {
  SWITCH_DATABASE: '切换数据库',
  CREATE_TABLE: '创建表',
  DROP_TABLE: '删除表',
  ADD_COLUMN: '新增列',
  DROP_COLUMN: '删除列',
  RENUMBER_IDS: '重排编号',
  INSERT_ROW: '插入行',
  UPDATE_ROW: '更新行',
  DELETE_ROW: '删除行',
  SQL_EXECUTE: '执行 SQL',
}

const qualityScoreClass = computed(() => {
  if (!qualityData.value) return ''
  const s = qualityData.value.score
  return s >= 90 ? 'good' : s >= 70 ? 'mid' : 'bad'
})

function levelLabel(level) {
  return { error: '严重', warn: '警告', info: '提示', ok: '通过' }[level] || level
}
function riskLabel(level) {
  return { high: '高危', medium: '中危', low: '低危' }[level] || level
}
function govActionLabel(action) {
  return GOV_ACTION_LABELS[action] || action
}
function formatTime(v) {
  if (!v) return '—'
  const d = new Date(v)
  return isNaN(d.getTime()) ? String(v) : d.toLocaleString('zh-CN', { hour12: false })
}

async function runQuality() {
  if (!selectedTable.value) return
  qualityLoading.value = true
  try {
    const res = await apiFetch(`/governance/quality/${encodeURIComponent(selectedTable.value)}`)
    const data = await res.json()
    if (res.ok) qualityData.value = data
    else alert(data.message || `检测失败（${res.status}）`)
  } catch (e) {
    alert(`请求失败：${e.message}`)
  } finally {
    qualityLoading.value = false
  }
}

async function runSensitive() {
  if (!selectedTable.value) return
  sensitiveLoading.value = true
  try {
    const res = await apiFetch(`/governance/sensitive/${encodeURIComponent(selectedTable.value)}`)
    const data = await res.json()
    if (res.ok) sensitiveData.value = data
    else alert(data.message || `扫描失败（${res.status}）`)
  } catch (e) {
    alert(`请求失败：${e.message}`)
  } finally {
    sensitiveLoading.value = false
  }
}

async function fetchDictionary() {
  if (!dictTable.value) { dictColumns.value = []; return }
  dictLoading.value = true
  try {
    const res = await apiFetch(`/governance/dictionary?table=${encodeURIComponent(dictTable.value)}`)
    const data = await res.json()
    if (res.ok) {
      dictTables.value = data.tables || []
      dictColumns.value = data.columns || []
    } else {
      alert(data.message || `获取数据字典失败（${res.status}）`)
    }
  } catch (e) {
    alert(`请求失败：${e.message}`)
  } finally {
    dictLoading.value = false
  }
}

async function exportDictionary() {
  dictExporting.value = true
  try {
    const res = await apiFetch('/governance/dictionary/export')
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      alert(err.message || `导出失败（${res.status}）`)
      return
    }
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `data-dictionary-${selectedDb.value || 'db'}.csv`
    a.click()
    URL.revokeObjectURL(url)
  } catch (e) {
    alert(`导出失败：${e.message}`)
  } finally {
    dictExporting.value = false
  }
}

function onGovTabChange(key) {
  govTab.value = key
  if (key === 'dict' && !dictTables.value.length) {
    dictTable.value = dictTable.value || selectedTable.value
    fetchDictionary()
  }
  if (key === 'audit' && !auditRows.value.length) {
    fetchAudit()
  }
}

async function fetchAudit() {
  auditLoading.value = true
  try {
    const params = new URLSearchParams({
      page: auditPage.value,
      pageSize: auditPageSize.value,
      action: auditAction.value,
    })
    const res = await apiFetch(`/governance/audit?${params}`)
    const data = await res.json()
    if (res.ok) {
      auditRows.value = data.rows || []
      auditTotal.value = data.total || 0
      auditPages.value = data.totalPages || 1
      auditActions.value = data.actions || []
    } else {
      alert(data.message || `查询审计日志失败（${res.status}）`)
    }
  } catch (e) {
    alert(`请求失败：${e.message}`)
  } finally {
    auditLoading.value = false
  }
}

function onAuditFilter() {
  auditPage.value = 1
  fetchAudit()
}

function goAuditPage(p) {
  auditPage.value = p
  fetchAudit()
}

// ====================== 总览统计图表 ======================
const govOverview = ref(null) // { tables: [{name, engine, approxRows, sizeKb, updateTime}], totalSizeKb }
const rowsChartEl = ref(null)
const sizeChartEl = ref(null)
let rowsChart = null
let sizeChart = null

const CHART_COLORS = ['#2563eb', '#0ea5e9', '#818cf8', '#10b981', '#f59e0b', '#ef4444', '#a855f7', '#14b8a6']

function fmtSize(kb) {
  if (kb === null || kb === undefined) return '—'
  if (kb < 1024) return `${kb} KB`
  if (kb < 1024 * 1024) return `${(kb / 1024).toFixed(2)} MB`
  return `${(kb / 1024 / 1024).toFixed(2)} GB`
}

async function fetchGovOverview() {
  try {
    const res = await apiFetch('/governance/overview')
    if (res.ok) govOverview.value = await res.json()
  } catch { /* 静默失败，图表区域保持为空 */ }
  if (!selectedTable.value) {
    await nextTick()
    renderOverviewCharts()
  }
}

function renderOverviewCharts() {
  if (selectedTable.value || !govOverview.value) return
  const list = tables.value
  const ovTables = govOverview.value.tables || []

  // 图一：各表行数（横向条形图，精确行数来自表列表）
  if (rowsChartEl.value) {
    const sorted = [...list].sort((a, b) => a.rowCount - b.rowCount)
    const names = sorted.map((t) => t.name)
    const counts = sorted.map((t) => t.rowCount)
    rowsChart?.dispose()
    rowsChart = echarts.init(rowsChartEl.value)
    rowsChart.setOption({
      grid: { left: 8, right: 44, top: 10, bottom: 10, containLabel: true },
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
      xAxis: { type: 'value', splitLine: { lineStyle: { color: '#eef2f7' } } },
      yAxis: {
        type: 'category', data: names,
        axisLabel: { color: '#475569', fontSize: 12.5 },
        axisLine: { lineStyle: { color: '#e2e8f0' } }, axisTick: { show: false },
      },
      series: [{
        type: 'bar', data: counts, barMaxWidth: 16,
        itemStyle: {
          borderRadius: [0, 4, 4, 0],
          color: new echarts.graphic.LinearGradient(0, 0, 1, 0, [
            { offset: 0, color: '#60a5fa' }, { offset: 1, color: '#2563eb' },
          ]),
        },
        label: { show: true, position: 'right', color: '#64748b', fontSize: 12 },
      }],
    }, true)
  }

  // 图二：各表存储空间占比（环形图，来自 information_schema）
  if (sizeChartEl.value) {
    const data = ovTables
      .filter((t) => t.sizeKb > 0)
      .sort((a, b) => b.sizeKb - a.sizeKb)
      .map((t, i) => ({ name: t.name, value: t.sizeKb, itemStyle: { color: CHART_COLORS[i % CHART_COLORS.length] } }))
    sizeChart?.dispose()
    sizeChart = echarts.init(sizeChartEl.value)
    sizeChart.setOption({
      tooltip: {
        trigger: 'item',
        formatter: (p) => `${p.name}：${fmtSize(p.value)}（${p.percent}%）`,
      },
      legend: { bottom: 0, type: 'scroll', icon: 'circle', textStyle: { color: '#64748b', fontSize: 12 }, pageIconSize: 10 },
      series: [{
        type: 'pie', radius: ['48%', '72%'], center: ['50%', '44%'],
        data: data.length ? data : [{ name: '无数据', value: 1, itemStyle: { color: '#e2e8f0' } }],
        label: { show: false },
        itemStyle: { borderColor: '#fff', borderWidth: 2, borderRadius: 4 },
      }],
    }, true)
  }
}

function handleChartResize() {
  rowsChart?.resize()
  sizeChart?.resize()
  usabilityChart?.resize()
  fillHeatmap?.resize()
  corrHeatmap?.resize()
}

// 视图切换时释放总览图表实例，回到总览时重建（避免实例绑定已被 Vue 销毁的旧 DOM）
watch([selectedTable, sqlView, analysisView], () => {
  const onOverview = !selectedTable.value && !sqlView.value && !analysisView.value
  if (!onOverview) {
    rowsChart?.dispose(); rowsChart = null
    sizeChart?.dispose(); sizeChart = null
  } else {
    nextTick(() => renderOverviewCharts())
  }
})

// ====================== 数据分析 ======================
const analysisSelected = ref([])
const analysisRunning = ref(false)
const analysisResult = ref(null)
const fieldOptions = ref({})  // 表 -> [{name, type, key}]
const selectedFields = ref({}) // 表 -> [字段名]
const corrTable = ref('')
const usabilityChartEl = ref(null)
const fillHeatmapEl = ref(null)
const corrHeatmapEl = ref(null)
let usabilityChart = null
let fillHeatmap = null
let corrHeatmap = null

function openAnalysisView() {
  selectedTable.value = ''
  sqlView.value = false
  analysisView.value = true
}

function toggleAnalysisTable(name) {
  const arr = analysisSelected.value
  const i = arr.indexOf(name)
  if (i >= 0) {
    arr.splice(i, 1)
    delete selectedFields.value[name]
    delete fieldOptions.value[name]
  } else if (arr.length < 8) {
    arr.push(name)
    // 拉取表结构以列出可选字段（服务端有 5 秒缓存）
    if (!fieldOptions.value[name]) {
      apiFetch(`/tables/${encodeURIComponent(name)}`)
        .then(async (res) => {
          if (!res.ok) return
          const data = await res.json()
          const cols = (data.columns || []).slice(0, 15).map((c) => ({ name: c.name, type: c.type, key: c.key }))
          fieldOptions.value[name] = cols
          // 默认全选（排除表中已不存在的旧选择）
          const prev = selectedFields.value[name]
          selectedFields.value[name] = prev
            ? cols.filter((c) => prev.includes(c.name)).map((c) => c.name)
            : cols.map((c) => c.name)
        })
        .catch(() => {})
    }
  }
}

function toggleAnalysisField(table, field) {
  const arr = selectedFields.value[table] || []
  const i = arr.indexOf(field)
  if (i >= 0) arr.splice(i, 1)
  else arr.push(field)
}

function selectAllFields(table, on) {
  selectedFields.value[table] = on ? (fieldOptions.value[table] || []).map((c) => c.name) : []
}

function resetAnalysisSelection() {
  analysisSelected.value = []
  selectedFields.value = {}
  fieldOptions.value = {}
}

async function runAnalysis() {
  if (!analysisSelected.value.length) return
  // 字段全部被取消的表不参与分析
  const tablesPayload = []
  const fieldsPayload = {}
  for (const t of analysisSelected.value) {
    const sel = selectedFields.value[t]
    if (Array.isArray(sel) && sel.length === 0) continue
    tablesPayload.push(t)
    if (Array.isArray(sel) && sel.length) fieldsPayload[t] = sel
  }
  if (!tablesPayload.length) {
    alert('请至少为一张表保留分析字段')
    return
  }
  analysisRunning.value = true
  try {
    const res = await apiFetch('/analysis', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tables: tablesPayload, fields: fieldsPayload }),
    })
    const data = await res.json()
    if (res.ok) {
      analysisResult.value = data
      corrTable.value = data.correlations[0]?.table || ''
      await nextTick()
      renderAnalysisCharts()
      renderCorrChart()
    } else {
      alert(data.message || `分析失败（${res.status}）`)
    }
  } catch (e) {
    alert(`请求失败：${e.message}`)
  } finally {
    analysisRunning.value = false
  }
}

function disposeAnalysisCharts() {
  usabilityChart?.dispose(); usabilityChart = null
  fillHeatmap?.dispose(); fillHeatmap = null
  corrHeatmap?.dispose(); corrHeatmap = null
}

watch(analysisView, (val) => {
  if (!val) {
    disposeAnalysisCharts()
  } else if (analysisResult.value) {
    // 返回分析视图时用已有结果重建图表
    nextTick(() => { renderAnalysisCharts(); renderCorrChart() })
  }
})

function renderAnalysisCharts() {
  const R = analysisResult.value
  if (!R) return

  // 可用性评分（字段完整率）横向条形图
  if (usabilityChartEl.value) {
    const rows = R.tables
      .filter((t) => t.completeness !== null)
      .map((t) => ({ name: t.name, value: Math.round(t.completeness * 1000) / 10 }))
      .sort((a, b) => a.value - b.value)
    usabilityChart?.dispose()
    usabilityChart = echarts.init(usabilityChartEl.value)
    usabilityChart.setOption({
      grid: { left: 8, right: 56, top: 10, bottom: 10, containLabel: true },
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, valueFormatter: (v) => v + '%' },
      xAxis: { type: 'value', max: 100, splitLine: { lineStyle: { color: '#eef2f7' } } },
      yAxis: {
        type: 'category', data: rows.map((r) => r.name),
        axisLabel: { color: '#475569', fontSize: 12.5 },
        axisLine: { lineStyle: { color: '#e2e8f0' } }, axisTick: { show: false },
      },
      series: [{
        type: 'bar', barMaxWidth: 16,
        data: rows.map((r) => ({
          value: r.value,
          itemStyle: { borderRadius: [0, 4, 4, 0], color: r.value >= 95 ? '#22c55e' : r.value >= 85 ? '#f59e0b' : '#ef4444' },
        })),
        label: { show: true, position: 'right', color: '#64748b', fontSize: 12, formatter: '{c}%' },
      }],
    }, true)
  }

  // 字段填充率热力图（行：字段并集，列：表）
  if (fillHeatmapEl.value) {
    const tableNames = R.tables.map((t) => t.name)
    const colSet = []
    for (const f of R.fillRates) if (!colSet.includes(f.column)) colSet.push(f.column)
    const cols = colSet.slice(0, 22)
    const data = []
    for (const f of R.fillRates) {
      const ci = cols.indexOf(f.column)
      const ti = tableNames.indexOf(f.table)
      if (ci >= 0 && ti >= 0 && f.fillRate !== null) data.push([ci, ti, Math.round(f.fillRate * 1000) / 10])
    }
    if (!fillHeatmapEl.value) return
    fillHeatmap?.dispose()
    fillHeatmap = echarts.init(fillHeatmapEl.value)
    fillHeatmap.setOption({
      grid: { left: 8, right: 16, top: 12, bottom: 52, containLabel: true },
      tooltip: {
        position: 'top',
        formatter: (p) => `${tableNames[p.value[1]]} · ${cols[p.value[0]]}：填充率 ${p.value[2]}%`,
      },
      xAxis: {
        type: 'category', data: cols,
        axisLabel: { color: '#475569', fontSize: 11.5, rotate: 30 },
        axisLine: { show: false }, axisTick: { show: false },
      },
      yAxis: {
        type: 'category', data: tableNames,
        axisLabel: { color: '#475569', fontSize: 12.5 },
        axisLine: { show: false }, axisTick: { show: false },
      },
      visualMap: {
        min: 0, max: 100, calculable: false, orient: 'horizontal',
        left: 'center', bottom: 0, itemWidth: 12, itemHeight: 90,
        textStyle: { color: '#64748b', fontSize: 11 },
        inRange: { color: ['#ef4444', '#f59e0b', '#eab308', '#84cc16', '#22c55e'] },
      },
      series: [{
        type: 'heatmap', data,
        label: { show: true, fontSize: 10.5, color: '#334155', formatter: (p) => p.value[2] + '%' },
        itemStyle: { borderColor: '#fff', borderWidth: 2, borderRadius: 3 },
      }],
    }, true)
  }
}

function renderCorrChart() {
  const c = analysisResult.value?.correlations.find((x) => x.table === corrTable.value)
  if (!c || !corrHeatmapEl.value) return
  const data = []
  c.matrix.forEach((row, i) => row.forEach((v, j) => {
    if (v !== null) data.push([i, j, v])
  }))
  corrHeatmap?.dispose()
  corrHeatmap = echarts.init(corrHeatmapEl.value)
  corrHeatmap.setOption({
    grid: { left: 8, right: 16, top: 12, bottom: 52, containLabel: true },
    tooltip: {
      position: 'top',
      formatter: (p) => `${c.columns[p.value[0]]} × ${c.columns[p.value[1]]}：r = ${p.value[2]}`,
    },
    xAxis: { type: 'category', data: c.columns, axisLabel: { color: '#475569', fontSize: 11.5, rotate: 30 }, axisLine: { show: false }, axisTick: { show: false } },
    yAxis: { type: 'category', data: c.columns, axisLabel: { color: '#475569', fontSize: 11.5 }, axisLine: { show: false }, axisTick: { show: false } },
    visualMap: {
      min: -1, max: 1, calculable: false, orient: 'horizontal',
      left: 'center', bottom: 0, itemWidth: 12, itemHeight: 90,
      textStyle: { color: '#64748b', fontSize: 11 },
      inRange: { color: ['#2563eb', '#93c5fd', '#f8fafc', '#fca5a5', '#dc2626'] },
    },
    series: [{
      type: 'heatmap', data,
      label: { show: true, fontSize: 10.5, color: '#334155', formatter: (p) => Number(p.value[2]).toFixed(2) },
      itemStyle: { borderColor: '#fff', borderWidth: 2, borderRadius: 3 },
    }],
  }, true)
}

const editableColumns = computed(() => {
  return tableStructure.value.filter((col) =>
    !col.extra?.includes('auto_increment') && !READONLY_COLS.includes(col.name)
  )
})

const totalRowCount = computed(() => {
  return tables.value.reduce((sum, t) => sum + t.rowCount, 0)
})

// ====================== 初始化 ======================
onMounted(async () => {
  document.body.classList.add(BODY_FLAG)
  window.addEventListener('resize', handleChartResize)
  // 权限检查
  const token = localStorage.getItem('admin_token')
  const expire = localStorage.getItem('expire')
  if (!token || !expire || Date.now() > Number(expire)) {
    localStorage.removeItem('admin_token')
    localStorage.removeItem('expire')
    window.location.href = '/TaskLog/'
    return
  }
  authReady.value = true
  await fetchDatabases()
  fetchTables()
  fetchMeta()
})

onUnmounted(() => {
  document.body.classList.remove(BODY_FLAG)
  window.removeEventListener('resize', handleChartResize)
  rowsChart?.dispose()
  sizeChart?.dispose()
  disposeAnalysisCharts()
})

// ====================== 表列表 ======================
async function fetchMeta() {
  try {
    const res = await apiFetch('/meta')
    if (res.ok) {
      const data = await res.json()
      dbVersion.value = data.version || ''
    }
  } catch (e) {
    console.error('获取元信息失败:', e.message)
  }
}

async function fetchDatabases() {
  try {
    const res = await apiFetch('/databases')
    if (res.ok) {
      const data = await res.json()
      databases.value = data.databases || []
      // 仅在尚未选择时设置（刷新时不能覆盖用户当前选中的库）
      if (!selectedDb.value) {
        selectedDb.value = data.current || (databases.value[0] || '')
      }
    }
  } catch (e) {
    console.error('获取数据库列表失败:', e.message)
  }
}

function openDbModal() {
  dbModalDb.value = selectedDb.value || (databases.value[0] || '')
  dbModalUser.value = ''
  dbModalPass.value = ''
  modalError.value = ''
  showDbModal.value = true
}

async function switchDb() {
  switchingDb.value = true
  modalError.value = ''
  try {
    const body = { database: dbModalDb.value }
    if (dbModalUser.value) body.user = dbModalUser.value
    if (dbModalPass.value) body.password = dbModalPass.value

    const res = await apiFetch('/use-database', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const data = await res.json()
    if (res.ok) {
      selectedDb.value = dbModalDb.value
      showDbModal.value = false
      selectedTable.value = ''
      sqlView.value = false
      analysisView.value = false
      analysisResult.value = null
      analysisSelected.value = []
      fieldOptions.value = {}
      selectedFields.value = {}
      sqlResult.value = null
      sqlError.value = ''
      fetchTables()
    } else { modalError.value = data.message }
  } catch (e) {
    modalError.value = `切换失败：${e.message}`
  } finally { switchingDb.value = false }
}

async function fetchTables() {
  loadingTables.value = true
  dbStatus.value = 'connecting'
  try {
    const res = await apiFetch('/tables')
    if (res.ok) {
      const data = await res.json()
      tables.value = data.tables || []
      dbStatus.value = 'connected'
      fetchGovOverview()
    } else {
      const err = await res.json()
      console.error('获取表列表失败:', err.message)
      dbStatus.value = 'error'
    }
  } catch (e) {
    console.error('数据库连接失败:', e.message)
    dbStatus.value = 'error'
  } finally {
    loadingTables.value = false
  }
}

function selectTable(name) {
  sqlView.value = false
  analysisView.value = false
  if (!name) {
    selectedTable.value = ''
    sqlResult.value = null
    sqlError.value = ''
    return
  }
  selectedTable.value = name
  activeTab.value = 'data'
  page.value = 1
  searchText.value = ''
  sortBy.value = 'id'
  sortDir.value = 'asc'
  tableSqlQuery.value = `SELECT * FROM \`${name}\` LIMIT 100`
  sqlResult.value = null
  sqlError.value = ''
  // 重置数据治理状态（新表需重新检测）
  govTab.value = 'quality'
  qualityData.value = null
  sensitiveData.value = null
  fetchTableStructure()
  fetchTableData()
}

async function fetchTableStructure() {
  try {
    const res = await apiFetch(`/tables/${selectedTable.value}`)
    if (res.ok) {
      const data = await res.json()
      tableStructure.value = data.columns
      const pk = data.columns.find((c) => c.key === 'PRI')
      primaryKey.value = pk ? pk.name : (data.columns[0]?.name || '')
    }
  } catch (e) {
    console.error('获取表结构失败:', e.message)
  }
}

async function fetchTableData() {
  try {
    const params = new URLSearchParams({
      page: page.value,
      pageSize: pageSize.value,
      search: searchText.value,
      orderBy: sortBy.value,
      orderDir: sortDir.value,
    })
    const res = await apiFetch(`/tables/${selectedTable.value}/rows?${params}`)
    if (res.ok) {
      const data = await res.json()
      tableRows.value = data.rows
      tableColumns.value = data.columns
      totalRows.value = data.total
      totalPages.value = data.totalPages
    }
  } catch (e) {
    console.error('获取表数据失败:', e.message)
  }
}

// ====================== 分页/排序/搜索 ======================
function goPage(p) {
  page.value = p
  fetchTableData()
}

function onPageSizeChange() {
  page.value = 1
  fetchTableData()
}

function toggleSort(col) {
  if (sortBy.value === col) {
    sortDir.value = sortDir.value === 'asc' ? 'desc' : 'asc'
  } else {
    sortBy.value = col
    sortDir.value = 'asc'
  }
  fetchTableData()
}

function onSearchInput() {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(() => {
    page.value = 1
    fetchTableData()
  }, 400)
}

// ====================== SQL 执行 ======================
// 打开独立 SQL 编辑器视图
function openSqlView() {
  selectedTable.value = ''
  sqlView.value = true
  analysisView.value = false
  sqlResult.value = null
  sqlError.value = ''
}

// 清空编辑器与结果
function clearSqlEditor() {
  sqlQuery.value = ''
  sqlResult.value = null
  sqlError.value = ''
}

async function runSql() {
  if (!sqlQuery.value.trim()) return
  runningSql.value = true
  sqlError.value = ''
  sqlResult.value = null

  try {
    const res = await apiFetch('/query', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sql: sqlQuery.value }),
    })
    const data = await res.json()
    if (res.ok) {
      sqlResult.value = data
      pushSqlHistory(sqlQuery.value)
      // 刷新表列表（可能创建/删除了表）
      fetchTables()
    } else {
      sqlError.value = data.message
    }
  } catch (e) {
    sqlError.value = `请求失败：${e.message}`
  } finally {
    runningSql.value = false
  }
}

async function runTableSql() {
  if (!tableSqlQuery.value.trim()) return
  runningSql.value = true
  sqlError.value = ''
  sqlResult.value = null

  try {
    const res = await apiFetch('/query', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sql: tableSqlQuery.value }),
    })
    const data = await res.json()
    if (res.ok) {
      sqlResult.value = data
      pushSqlHistory(tableSqlQuery.value)
      fetchTables()
      if (activeTab.value === 'data') fetchTableData()
    } else {
      sqlError.value = data.message
    }
  } catch (e) {
    sqlError.value = `请求失败：${e.message}`
  } finally {
    runningSql.value = false
  }
}

// ====================== 创建表 ======================
function openCreateTable() {
  newTable.value = {
    name: '',
    columns: [{ name: '', type: 'VARCHAR(255)', pk: false, autoInc: false, nullable: true, default: null }],
  }
  modalError.value = ''
  showCreateTable.value = true
}

function addColumn() {
  newTable.value.columns.push({ name: '', type: 'VARCHAR(255)', pk: false, autoInc: false, nullable: true, default: null })
}

function removeColumn(index) {
  if (newTable.value.columns.length <= 1) return
  newTable.value.columns.splice(index, 1)
}

async function createTable() {
  if (!newTable.value.name.trim()) {
    modalError.value = '请输入表名'
    return
  }
  const validCols = newTable.value.columns.filter((c) => c.name.trim())
  if (validCols.length === 0) {
    modalError.value = '至少需要一列'
    return
  }

  creatingTable.value = true
  modalError.value = ''

  try {
    const res = await apiFetch('/tables', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: newTable.value.name.trim(),
        columns: validCols.map((c) => ({
          name: c.name.trim(),
          type: c.type.trim() || 'VARCHAR(255)',
          nullable: c.nullable,
          pk: c.pk,
          autoInc: c.autoInc,
          default: c.default || null,
        })),
      }),
    })
    const data = await res.json()
    if (res.ok) {
      showCreateTable.value = false
      fetchTables()
      selectTable(newTable.value.name.trim())
    } else {
      modalError.value = data.message
    }
  } catch (e) {
    modalError.value = `请求失败：${e.message}`
  } finally {
    creatingTable.value = false
  }
}

// ====================== 新建列 ======================
function openAddColumn() {
  newColumn.value = { name: '', type: 'VARCHAR(255)', nullable: true, defaultVal: '', afterColumn: '' }
  modalError.value = ''
  showAddColumn.value = true
}
async function createColumn() {
  if (!newColumn.value.name.trim()) { modalError.value = '请输入列名'; return }
  const cn = /^[a-zA-Z_][a-zA-Z0-9_]*$/
  if (!cn.test(newColumn.value.name.trim())) { modalError.value = '列名含非法字符'; return }
  addingColumn.value = true
  modalError.value = ''
  try {
    const res = await apiFetch(`/tables/${selectedTable.value}/columns`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        colName: newColumn.value.name.trim(),
        colType: newColumn.value.type.trim(),
        nullable: newColumn.value.nullable,
        defaultValue: newColumn.value.defaultVal || null,
      }),
    })
    const data = await res.json()
    if (res.ok) {
      showAddColumn.value = false
      fetchTableStructure()
      fetchTableData()
    } else { modalError.value = data.message }
  } catch (e) { modalError.value = `请求失败：${e.message}` }
  finally { addingColumn.value = false }
}

// ====================== 删除表 ======================
function confirmDropTable(name) {
  deleteTarget.value = 'TABLE'
  deleteTableName.value = name
  deleteColumnName.value = ''
  deleteRowData.value = null
  modalError.value = ''
  showDeleteConfirm.value = true
}

// ====================== 删除列 ======================
function confirmDropColumn(col) {
  deleteTarget.value = 'COLUMN'
  deleteColumnName.value = col.name
  deleteTableName.value = ''
  deleteRowData.value = null
  modalError.value = ''
  showDeleteConfirm.value = true
}

// ====================== 导出 CSV ======================
async function exportCsv() {
  exporting.value = true
  try {
    const params = new URLSearchParams({
      search: searchText.value,
      orderBy: sortBy.value,
      orderDir: sortDir.value,
    })
    const res = await apiFetch(`/tables/${selectedTable.value}/export?${params}`)
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      alert(err.message || `导出失败（${res.status}）`)
      return
    }
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${selectedTable.value}.csv`
    a.click()
    URL.revokeObjectURL(url)
  } catch (e) {
    alert(`导出失败：${e.message}`)
  } finally {
    exporting.value = false
  }
}

// ====================== 新增行 ======================
function openInsertRow() {
  editingRow.value = null
  rowForm.value = {}
  for (const col of tableStructure.value) {
    if (!col.extra?.includes('auto_increment') && !READONLY_COLS.includes(col.name)) {
      rowForm.value[col.name] = ''
    }
  }
  modalError.value = ''
  showRowModal.value = true
}

// ====================== 刷新状态 ======================
async function refreshAll() {
  await fetchDatabases()
  fetchTables()
  fetchMeta()
  if (selectedTable.value) {
    fetchTableStructure()
    fetchTableData()
  }
}
async function renumberIds() {
  if (!confirm(`确定要重新编号 "${selectedTable.value}" 的 ID 字段吗？`)) return
  renumbering.value = true
  try {
    const res = await apiFetch(`/tables/${selectedTable.value}/renumber-ids`, { method: 'POST' })
    const data = await res.json()
    if (res.ok) {
      fetchTableData()
      fetchTables()
    } else {
      alert(data.message)
    }
  } catch (e) {
    alert(`请求失败：${e.message}`)
  } finally {
    renumbering.value = false
  }
}

// ====================== 编辑行 ======================
function openEditRow(row) {
  editingRow.value = row
  rowForm.value = {}
  for (const col of tableStructure.value) {
    if (!READONLY_COLS.includes(col.name)) {
      const val = row[col.name]
      rowForm.value[col.name] = (val === null || val === undefined) ? '' : val
    }
  }
  modalError.value = ''
  showRowModal.value = true
}

// ====================== 保存行 ======================
async function saveRow() {
  savingRow.value = true
  modalError.value = ''

  const path = editingRow.value
    ? `/tables/${selectedTable.value}/rows/${encodeURIComponent(editingRow.value[primaryKey.value])}`
    : `/tables/${selectedTable.value}/rows`

  const method = editingRow.value ? 'PUT' : 'POST'

  // 过滤空值：nullable 列的空字符串转为 null
  const payload = {}
  for (const col of tableStructure.value) {
    if (READONLY_COLS.includes(col.name)) continue
    const val = rowForm.value[col.name]
    if (val === '' && col.nullable) {
      payload[col.name] = null
    } else if (val !== '' || !col.nullable) {
      payload[col.name] = val
    }
  }

  try {
    const res = await apiFetch(path, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const data = await res.json()
    if (res.ok) {
      showRowModal.value = false
      fetchTableData()
      fetchTables()
    } else {
      modalError.value = data.message
    }
  } catch (e) {
    modalError.value = `请求失败：${e.message}`
  } finally {
    savingRow.value = false
  }
}

// ====================== 删除行 ======================
function confirmDeleteRow(row) {
  deleteTarget.value = 'ROW'
  deleteRowData.value = row
  deleteTableName.value = ''
  modalError.value = ''
  showDeleteConfirm.value = true
}

async function doDelete() {
  deleting.value = true
  modalError.value = ''

  let path
  if (deleteTarget.value === 'ROW') {
    path = `/tables/${selectedTable.value}/rows/${encodeURIComponent(deleteRowData.value[primaryKey.value])}`
  } else if (deleteTarget.value === 'COLUMN') {
    path = `/tables/${selectedTable.value}/columns/${encodeURIComponent(deleteColumnName.value)}`
  } else {
    path = `/tables/${deleteTableName.value}`
  }

  try {
    const res = await apiFetch(path, { method: 'DELETE' })
    const data = await res.json()
    if (res.ok) {
      showDeleteConfirm.value = false
      if (deleteTarget.value === 'TABLE') {
        if (selectedTable.value === deleteTableName.value) {
          selectedTable.value = ''
        }
      } else if (deleteTarget.value === 'COLUMN') {
        fetchTableData()
      }
      fetchTables()
      if (selectedTable.value) fetchTableStructure()
      if (selectedTable.value && deleteTarget.value !== 'TABLE') fetchTableData()
    } else {
      modalError.value = data.message
    }
  } catch (e) {
    modalError.value = `请求失败：${e.message}`
  } finally {
    deleting.value = false
  }
}

// ====================== 工具函数 ======================
function formatCell(val) {
  if (val === null || val === undefined) return 'NULL'
  if (val instanceof Date || (typeof val === 'string' && val.includes('T') && val.includes(':'))) {
    return String(val)
  }
  if (typeof val === 'object') return JSON.stringify(val)
  return String(val)
}

// ====================== 导航 ======================
function handleLogout() {
  localStorage.removeItem('admin_token')
  localStorage.removeItem('expire')
  window.location.href = '/TaskLog/'
}
</script>

<style scoped>
/* 仅在 body 带有管理页标记时隐藏 VitePress 底部 footer 与大纲遮罩（样式泄漏安全） */
:global(body.dbm-dashboard-active .VPFooter),
:global(body.dbm-dashboard-active .aside-curtain) { display: none !important; }

/* ========== 容器布局 ========== */
.mgmt-container {
  position: fixed;
  inset: var(--vp-nav-height, 64px) 0 0 0;
  display: flex;
  z-index: 1;
}

/* ========== 侧边栏 ========== */
.mgmt-sidebar {
  width: 260px;
  height: 100%;
  overflow: hidden;
  background: #1e293b;
  color: #cbd5e1;
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  user-select: none;
}

.sidebar-brand {
  height: 60px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 0 18px;
  border-bottom: 1px solid #334155;
}

.brand-logo {
  width: 36px;
  height: 36px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 9px;
  background: linear-gradient(135deg, #3b82f6, #1e40af);
  color: #fff;
  box-shadow: 0 4px 12px rgba(37, 99, 235, 0.35);
}
.brand-logo svg { width: 19px; height: 19px; }
.brand-meta { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.brand-text { font-size: 15px; font-weight: 700; color: #f1f5f9; letter-spacing: 0.5px; white-space: nowrap; }

/* 数据库选择器 */
.db-selector {
  flex-shrink: 0;
  padding: 10px 14px;
  border-bottom: 1px solid #334155;
}
.db-current {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 9px 12px;
  background: #0f172a;
  border: 1px solid #334155;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.15s;
}
.db-current:hover { border-color: #60a5fa; }
.db-meta { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.db-label {
  font-size: 10.5px;
  font-weight: 600;
  letter-spacing: 1px;
  color: #64748b;
}
.db-name {
  font-size: 14px;
  font-weight: 600;
  color: #e2e8f0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.db-arrow {
  font-size: 14px;
  color: #64748b;
}

/* 数据库选项列表（弹窗中） */
.db-list {
  max-height: 180px;
  overflow-y: auto;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  margin-bottom: 4px;
}
.db-option {
  padding: 10px 14px;
  cursor: pointer;
  font-size: 14px;
  color: #334155;
  transition: all 0.1s;
  border-bottom: 1px solid #f1f5f9;
}
.db-option:last-child { border-bottom: none; }
.db-option:hover { background: #eff6ff; }
.db-option.active {
  background: #dbeafe;
  color: #1d4ed8;
  font-weight: 600;
}

/* 连接状态 */
.conn-status {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 18px;
  font-size: 14px;
  border-bottom: 1px solid #334155;
}
.conn-status.connecting { color: #facc15; }
.conn-status.connected { color: #4ade80; }
.conn-status.error { color: #f87171; }
.conn-dot {
  width: 8px; height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}
.connecting .conn-dot { background: #facc15; animation: pulse 1s infinite; }
.connected .conn-dot { background: #4ade80; box-shadow: 0 0 6px #4ade80; }
.error .conn-dot { background: #f87171; }

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}

/* 主导航（总览 / SQL 编辑器） */
.side-nav {
  flex-shrink: 0;
  padding: 8px 0;
  border-bottom: 1px solid #334155;
}
.nav-icon {
  width: 17px;
  height: 17px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}
.nav-icon svg { width: 15px; height: 15px; }

/* 表列表 */
.sidebar-section {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 8px 0;
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 18px 6px;
}
.section-title {
  font-size: 13px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: #64748b;
}
.section-count {
  font-size: 13px;
  background: #334155;
  color: #94a3b8;
  padding: 2px 10px;
  border-radius: 10px;
}

/* 表筛选 */
.table-filter-wrap {
  padding: 0 12px 6px;
}
.table-filter {
  width: 100%;
  padding: 7px 10px;
  background: #0f172a;
  border: 1px solid #334155;
  border-radius: 6px;
  font-size: 13px;
  color: #e2e8f0;
  outline: none;
  box-sizing: border-box;
  transition: border-color 0.15s;
}
.table-filter:focus { border-color: #60a5fa; }
.table-filter::placeholder { color: #64748b; }

.table-list { padding: 4px 0; }

.table-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 18px;
  cursor: pointer;
  font-size: 15px;
  transition: all 0.15s;
  border-left: 3px solid transparent;
}
.table-item:hover { background: #334155; color: #f1f5f9; }
.table-item.active {
  background: #1e3a5f;
  color: #60a5fa;
  border-left-color: #60a5fa;
}
.table-name-text {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.table-row-count {
  font-size: 12px;
  color: #64748b;
  background: #0f172a;
  padding: 2px 7px;
  border-radius: 8px;
  flex-shrink: 0;
}
.table-item.active .table-row-count { background: #1e3a5f; color: #93c5fd; }
.table-delete {
  font-size: 16px;
  color: #64748b;
  opacity: 0;
  transition: opacity 0.15s;
  flex-shrink: 0;
  width: 18px;
  text-align: center;
  font-weight: bold;
}
.table-item:hover .table-delete { opacity: 1; }
.table-delete:hover { color: #f87171; }

.empty-tables, .loading-tables {
  padding: 20px 16px;
  text-align: center;
  font-size: 14px;
  color: #64748b;
}

/* 内联新建表项 */
.sidebar-new-table {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 18px;
  cursor: pointer;
  font-size: 15px;
  color: #94a3b8;
  border-left: 3px solid transparent;
  transition: all 0.15s;
  border-top: 1px solid #334155;
}
.sidebar-new-table:hover {
  background: #334155;
  color: #60a5fa;
  border-left-color: #60a5fa;
}

/* 侧边栏底部 */

/* ========== 主内容区 ========== */
.mgmt-main {
  flex: 1;
  background: #f1f5f9;
  overflow-y: auto;
}

/* 顶部工具栏 */
.main-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 32px;
  background: #fff;
  border-bottom: 1px solid #e2e8f0;
  position: sticky;
  top: 0;
  z-index: 10;
}
.main-title {
  font-size: 18px;
  font-weight: 700;
  color: #1e293b;
}
.main-toolbar-right {
  display: flex;
  gap: 10px;
  align-items: center;
}
.btn-refresh-top {
  padding: 7px 16px;
  background: #eff6ff;
  color: #3b82f6;
  border: 1px solid #bfdbfe;
  border-radius: 8px;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.15s;
}
.btn-refresh-top:hover {
  background: #dbeafe;
}
.btn-logout-top {
  padding: 7px 18px;
  background: #fff;
  color: #ef4444;
  border: 1px solid #fca5a5;
  border-radius: 8px;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.15s;
}
.btn-logout-top:hover {
  background: #fef2f2;
  border-color: #ef4444;
}

/* 内容面板区 */
.mgmt-content-area {
  padding: 28px 32px;
}

.card-title {
  font-size: 20px;
  font-weight: 700;
  color: #1e293b;
  margin-bottom: 16px;
  /* 重置 VitePress .vp-doc h2 的分隔线与内边距 */
  border: none;
  padding: 0;
}

/* ========== SQL 编辑器 ========== */
.sql-card {
  background: #fff;
  border-radius: 12px;
  padding: 24px;
  margin-bottom: 24px;
  box-shadow: 0 1px 6px rgba(0,0,0,0.04);
}
/* 独立 SQL 编辑器视图 */
.sql-view-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
}
.sql-editor-tall { min-height: 260px; }
.sql-view .sql-result-table-wrap .table-wrap { max-height: 480px; }
.sql-editor {
  width: 100%;
  padding: 14px;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  font-family: 'Consolas', 'Monaco', monospace;
  font-size: 14px;
  line-height: 1.6;
  color: #1e293b;
  background: #f8fafc;
  resize: vertical;
  outline: none;
  box-sizing: border-box;
}
.sql-editor:focus { border-color: #60a5fa; background: #fff; }
.sql-actions { margin-top: 12px; }

/* SQL 历史 */
.sql-history {
  margin-top: 10px;
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
}
.sql-history-label {
  font-size: 13px;
  color: #64748b;
  flex-shrink: 0;
}
.sql-history-chip {
  max-width: 260px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  padding: 4px 10px;
  background: #f1f5f9;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  font-size: 12px;
  font-family: 'Consolas', 'Monaco', monospace;
  color: #475569;
  cursor: pointer;
  transition: all 0.15s;
}
.sql-history-chip:hover { border-color: #60a5fa; color: #2563eb; background: #eff6ff; }
.sql-history-clear {
  padding: 4px 10px;
  background: transparent;
  border: none;
  font-size: 12px;
  color: #94a3b8;
  cursor: pointer;
}
.sql-history-clear:hover { color: #ef4444; }
.btn-run {
  padding: 10px 28px;
  background: #3b82f6;
  color: #fff;
  border: none;
  border-radius: 8px;
  font-size: 15px;
  cursor: pointer;
  transition: background 0.2s;
}
.btn-run:hover { background: #2563eb; }
.btn-run:disabled { opacity: 0.6; cursor: not-allowed; }
.sql-error {
  margin-top: 12px;
  padding: 12px;
  background: #fef2f2;
  color: #dc2626;
  border-radius: 8px;
  font-size: 14px;
  white-space: pre-wrap;
}
.sql-result { margin-top: 16px; }
.sql-affected {
  padding: 12px;
  background: #f0fdf4;
  color: #16a34a;
  border-radius: 8px;
  font-size: 15px;
}
.sql-result-info {
  font-size: 14px;
  color: #64748b;
  margin-bottom: 8px;
}
.sql-result-table-wrap .table-wrap { max-height: 400px; }

/* ========== 概览卡片 ========== */
.overview-cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: 16px;
}
.overview-card {
  background: #fff;
  border-radius: 12px;
  padding: 22px 18px;
  text-align: center;
  box-shadow: 0 1px 6px rgba(0,0,0,0.04);
}
.ov-value { font-size: 28px; font-weight: 700; color: #1e293b; }
.ov-value.ov-sm { font-size: 20px; line-height: 28px; }
.ov-value.ov-ok { color: #16a34a; }
.ov-value.ov-bad { color: #dc2626; }
.ov-label { font-size: 14px; color: #64748b; margin-top: 4px; }

/* ========== 总览统计图表 ========== */
.overview-charts {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(380px, 1fr));
  gap: 16px;
  margin-top: 24px;
}
.chart-card {
  background: #fff;
  border-radius: 12px;
  padding: 20px 22px 12px;
  box-shadow: 0 1px 6px rgba(0, 0, 0, 0.04);
}
.chart-title {
  font-size: 15px;
  font-weight: 700;
  color: #1e293b;
  margin: 0 0 8px;
  border: none;
  padding: 0;
}
.chart-body { height: 300px; }
.chart-body-tall { height: 340px; }

/* ========== 数据分析 ========== */
.analysis-picker {
  background: #fff;
  border-radius: 12px;
  padding: 22px 24px;
  margin-bottom: 16px;
  box-shadow: 0 1px 6px rgba(0, 0, 0, 0.04);
}
.analysis-step {
  display: flex;
  align-items: center;
  gap: 9px;
  margin: 6px 0 12px;
}
.step-badge {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: #2563eb;
  color: #fff;
  font-size: 12px;
  font-weight: 700;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.step-title { font-size: 14.5px; font-weight: 700; color: #1e293b; }
.analysis-checks {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(210px, 1fr));
  gap: 10px;
  margin-bottom: 20px;
}
.analysis-check {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 11px 14px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.15s;
  font-size: 14px;
  color: #334155;
}
.analysis-check:hover { border-color: #93c5fd; background: #f0f7ff; }
.analysis-check.checked { background: #eff6ff; border-color: #2563eb; }
.analysis-check input {
  width: 16px;
  height: 16px;
  accent-color: #2563eb;
  cursor: pointer;
  flex-shrink: 0;
  margin: 0;
}
.analysis-check-name { font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.analysis-check-count { margin-left: auto; font-size: 12.5px; color: #94a3b8; flex-shrink: 0; }
.analysis-no-table { padding: 6px 0 2px; }
.field-groups {
  display: flex;
  flex-direction: column;
  gap: 14px;
  margin-bottom: 20px;
}
.field-group {
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  padding: 12px 14px;
  background: #fcfdff;
}
.field-group-head { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; flex-wrap: wrap; }
.field-group-name {
  font-size: 13.5px;
  font-weight: 700;
  color: #1e293b;
  font-family: 'Consolas', 'Monaco', monospace;
}
.field-group-link {
  background: transparent;
  border: none;
  color: #2563eb;
  font-size: 12.5px;
  cursor: pointer;
  padding: 2px 8px;
  border-radius: 6px;
  transition: background 0.12s;
}
.field-group-link:hover { background: #eff6ff; }
.field-pills { display: flex; flex-wrap: wrap; gap: 8px; }
.field-pill {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 5px 12px;
  border-radius: 999px;
  border: 1px solid #d1d5db;
  background: #fff;
  font-size: 12.5px;
  font-family: 'Consolas', 'Monaco', monospace;
  color: #64748b;
  cursor: pointer;
  transition: all 0.12s;
}
.field-pill:hover { border-color: #60a5fa; color: #2563eb; }
.field-pill.active {
  background: #2563eb;
  border-color: #2563eb;
  color: #fff;
}
.pill-pk {
  font-size: 9.5px;
  background: #fef3c7;
  color: #b45309;
  border-radius: 4px;
  padding: 0 4px;
  font-weight: 700;
}
.field-pill.active .pill-pk { background: rgba(255, 255, 255, 0.25); color: #fff; }
.analysis-toolbar { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
.analysis-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
  gap: 16px;
  margin-bottom: 16px;
}
.analysis-block { margin-bottom: 16px; }
.corr-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}
.corr-select { min-width: 160px; }

/* ========== 表视图 ========== */
.table-view { animation: panelIn 0.2s ease; }
@keyframes panelIn {
  from { opacity: 0; transform: translateY(6px); }
  to { opacity: 1; transform: translateY(0); }
}

.table-header-bar {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 16px;
}
.table-name-title {
  font-size: 22px;
  font-weight: 700;
  color: #1e293b;
  margin: 0;
  border: none;
  padding: 0;
}
.btn-refresh {
  padding: 7px 16px;
  border: 1px solid #d1d5db;
  background: #fff;
  border-radius: 6px;
  font-size: 14px;
  cursor: pointer;
  color: #475569;
  transition: all 0.15s;
}
.btn-refresh:hover { background: #f1f5f9; }

/* Tab 栏 */
.tab-bar {
  display: flex;
  gap: 2px;
  margin-bottom: 20px;
  border-bottom: 2px solid #e2e8f0;
}
.tab-item {
  padding: 10px 20px;
  font-size: 15px;
  color: #64748b;
  cursor: pointer;
  border-bottom: 2px solid transparent;
  margin-bottom: -2px;
  transition: all 0.15s;
}
.tab-item:hover { color: #334155; }
.tab-item.active {
  color: #3b82f6;
  border-bottom-color: #3b82f6;
  font-weight: 600;
}

.tab-content { animation: panelIn 0.2s ease; }

/* ========== 工具栏 ========== */
.toolbar {
  display: flex;
  gap: 12px;
  margin-bottom: 16px;
}
.search-input {
  flex: 1;
  min-width: 180px;
  padding: 10px 14px;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  font-size: 15px;
  color: #1e293b;
  outline: none;
  transition: border-color 0.2s;
}
.search-input:focus { border-color: #60a5fa; }
.btn-primary {
  padding: 10px 22px;
  background: #3b82f6;
  color: #fff;
  border: none;
  border-radius: 8px;
  font-size: 15px;
  cursor: pointer;
  white-space: nowrap;
  transition: background 0.2s;
}
.btn-primary:hover { background: #2563eb; }
.btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }
.btn-secondary {
  padding: 10px 22px;
  background: #fff;
  color: #475569;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  font-size: 15px;
  cursor: pointer;
  white-space: nowrap;
  transition: background 0.2s;
}
.btn-secondary:hover { background: #f1f5f9; }
.btn-secondary:disabled { opacity: 0.6; cursor: not-allowed; }

/* 每页行数选择 */
.page-size-select {
  padding: 10px 10px;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  font-size: 14px;
  color: #475569;
  background: #fff;
  cursor: pointer;
  outline: none;
}
.page-size-select:focus { border-color: #60a5fa; }

/* ========== 表格 ========== */
.table-wrap {
  background: #fff;
  border-radius: 12px;
  overflow-x: auto;
  box-shadow: 0 1px 6px rgba(0,0,0,0.04);
}
.table-wrap.mini { max-height: 360px; overflow-y: auto; }

.data-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;
}
.data-table thead {
  background: #f8fafc;
  position: sticky;
  top: 0;
  z-index: 1;
}
.data-table th {
  padding: 10px 14px;
  text-align: left;
  font-weight: 600;
  color: #475569;
  border-bottom: 2px solid #e2e8f0;
  white-space: nowrap;
}
.data-table th.sortable {
  cursor: pointer;
  user-select: none;
}
.data-table th.sortable:hover { color: #3b82f6; }
.sort-icon { font-size: 12px; margin-left: 2px; }
.pk-badge {
  font-size: 11px;
  background: #fef3c7;
  color: #d97706;
  padding: 1px 5px;
  border-radius: 4px;
  margin-left: 6px;
  font-weight: 600;
}
.th-actions { width: 130px; }

.data-table td {
  padding: 10px 14px;
  color: #334155;
  border-bottom: 1px solid #f1f5f9;
  max-width: 320px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.data-table tbody tr:hover { background: #f8fafc; }
.pk-cell { font-weight: 600; color: #1e293b; }
.empty-cell {
  text-align: center;
  color: #94a3b8;
  padding: 40px 16px !important;
}
.col-name { font-weight: 600; color: #1e293b; }
code { font-family: 'Consolas', monospace; font-size: 13px; background: #f1f5f9; padding: 2px 6px; border-radius: 4px; }
.key-badge {
  font-size: 12px;
  background: #dbeafe;
  color: #2563eb;
  padding: 2px 8px;
  border-radius: 10px;
  font-weight: 600;
}
.col-locked { color: #cbd5e1; }

/* 操作按钮 */
.td-actions {
  display: flex;
  gap: 6px;
}
.btn-sm {
  padding: 5px 14px;
  border: none;
  border-radius: 4px;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.15s;
}
.btn-edit { background: #eff6ff; color: #3b82f6; }
.btn-edit:hover { background: #dbeafe; }
.btn-del { background: #fef2f2; color: #ef4444; }
.btn-del:hover { background: #fee2e2; }

/* ========== 分页 ========== */
.pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16px;
  margin-top: 16px;
  padding: 12px;
}
.pagination button {
  padding: 8px 16px;
  border: 1px solid #d1d5db;
  background: #fff;
  border-radius: 6px;
  font-size: 14px;
  cursor: pointer;
  color: #374151;
  transition: all 0.15s;
}
.pagination button:hover:not(:disabled) { background: #f1f5f9; }
.pagination button:disabled { opacity: 0.4; cursor: not-allowed; }
.page-info { font-size: 14px; color: #64748b; }

/* ========== 弹窗 ========== */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}
.modal {
  background: #fff;
  border-radius: 14px;
  padding: 28px;
  width: 560px;
  max-width: 90vw;
  max-height: 80vh;
  overflow-y: auto;
  box-shadow: 0 20px 60px rgba(0,0,0,0.2);
}
.modal-sm { width: 420px; }
.modal h3 { font-size: 20px; color: #1e293b; margin-bottom: 20px; }
.modal p { font-size: 15px; color: #475569; margin-bottom: 20px; }

.form-group { margin-bottom: 16px; }
.form-group label {
  display: block;
  font-size: 14px;
  font-weight: 600;
  color: #374151;
  margin-bottom: 6px;
}
.col-type-hint { font-weight: 400; color: #94a3b8; font-size: 13px; margin-left: 6px; }
.form-hint {
  font-size: 12px;
  color: #94a3b8;
  margin-top: 4px;
  padding: 6px 10px;
  background: #f8fafc;
  border-radius: 6px;
}
.form-input {
  width: 100%;
  padding: 10px 14px;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  font-size: 15px;
  color: #1e293b;
  outline: none;
  transition: border-color 0.2s;
  box-sizing: border-box;
}
.form-input:focus { border-color: #60a5fa; }

/* 列定义 */
.col-defs { margin-bottom: 10px; }
.col-row {
  display: flex;
  gap: 8px;
  align-items: center;
  margin-bottom: 8px;
  flex-wrap: wrap;
}
.col-input {
  padding: 7px 10px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 14px;
  color: #1e293b;
  outline: none;
  box-sizing: border-box;
}
.col-input:focus { border-color: #60a5fa; }
.col-input:first-child { width: 130px; }
.col-input.type { width: 150px; }
.col-check {
  font-size: 13px;
  color: #475569;
  display: flex;
  align-items: center;
  gap: 3px;
  white-space: nowrap;
}
.btn-add-col {
  padding: 7px 14px;
  border: 1px dashed #d1d5db;
  background: transparent;
  color: #64748b;
  border-radius: 6px;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.15s;
}
.btn-add-col:hover { border-color: #3b82f6; color: #3b82f6; }

.modal-actions {
  display: flex;
  gap: 10px;
  justify-content: flex-end;
  margin-top: 8px;
}
.btn-cancel {
  padding: 10px 22px;
  border: 1px solid #d1d5db;
  background: #fff;
  border-radius: 8px;
  font-size: 15px;
  cursor: pointer;
  color: #374151;
  transition: all 0.15s;
}
.btn-cancel:hover { background: #f1f5f9; }
.btn-danger {
  padding: 10px 22px;
  background: #ef4444;
  color: #fff;
  border: none;
  border-radius: 8px;
  font-size: 15px;
  cursor: pointer;
  transition: background 0.15s;
}
.btn-danger:hover { background: #dc2626; }
.btn-danger:disabled { opacity: 0.6; cursor: not-allowed; }
.modal-error {
  margin-top: 12px;
  padding: 10px;
  background: #fef2f2;
  color: #dc2626;
  border-radius: 8px;
  font-size: 14px;
}

/* ========== 数据治理 ========== */
.gov-subnav {
  display: flex;
  gap: 4px;
  margin-bottom: 20px;
  border-bottom: 1px solid #e2e8f0;
}
.gov-subitem {
  padding: 9px 18px;
  font-size: 14px;
  color: #64748b;
  cursor: pointer;
  border-bottom: 2px solid transparent;
  margin-bottom: -1px;
  transition: all 0.15s;
  user-select: none;
}
.gov-subitem:hover { color: #334155; }
.gov-subitem.active {
  color: #1d4ed8;
  border-bottom-color: #1d4ed8;
  font-weight: 600;
}

.gov-section { animation: panelIn 0.2s ease; }
.gov-toolbar {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
  flex-wrap: wrap;
}
.gov-hint { font-size: 13px; color: #94a3b8; }
.gov-select {
  padding: 10px 12px;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  font-size: 14px;
  color: #1e293b;
  background: #fff;
  outline: none;
  min-width: 220px;
  cursor: pointer;
}
.gov-select:focus { border-color: #60a5fa; }
.gov-table { margin-bottom: 8px; }
.gov-empty {
  background: #fff;
  border-radius: 12px;
  padding: 48px 16px;
  text-align: center;
  color: #94a3b8;
  font-size: 14px;
  box-shadow: 0 1px 6px rgba(0, 0, 0, 0.04);
}

/* 质量评分摘要 */
.quality-summary {
  display: flex;
  align-items: flex-start;
  gap: 22px;
  background: #fff;
  border-radius: 12px;
  padding: 22px 24px;
  margin-bottom: 16px;
  box-shadow: 0 1px 6px rgba(0, 0, 0, 0.04);
}
.quality-score-box {
  flex-shrink: 0;
  width: 92px;
  height: 92px;
  border-radius: 14px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  border: 1px solid #e2e8f0;
  background: #f8fafc;
}
.quality-score-box.good { background: #f0fdf4; border-color: #bbf7d0; }
.quality-score-box.good .quality-score { color: #16a34a; }
.quality-score-box.mid { background: #fffbeb; border-color: #fde68a; }
.quality-score-box.mid .quality-score { color: #d97706; }
.quality-score-box.bad { background: #fef2f2; border-color: #fecaca; }
.quality-score-box.bad .quality-score { color: #dc2626; }
.quality-score { font-size: 30px; font-weight: 700; color: #1e293b; line-height: 1.1; }
.quality-score-label { font-size: 11.5px; color: #94a3b8; margin-top: 2px; }
.quality-meta { flex-shrink: 0; padding-top: 6px; }
.q-meta-row { font-size: 14px; color: #475569; margin-bottom: 8px; }
.issue-list {
  list-style: none;
  margin: 0;
  padding: 0;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 220px;
  overflow-y: auto;
}
.issue-item {
  display: flex;
  align-items: baseline;
  gap: 8px;
  font-size: 13.5px;
  color: #475569;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 8px 12px;
  line-height: 1.5;
}
.issue-item.ok { color: #16a34a; background: #f0fdf4; border-color: #bbf7d0; }
.issue-item.error { background: #fef2f2; border-color: #fecaca; }
.issue-item.warn { background: #fffbeb; border-color: #fde68a; }
.issue-level {
  flex-shrink: 0;
  font-size: 11.5px;
  font-weight: 600;
  padding: 1px 8px;
  border-radius: 999px;
  color: #fff;
}
.issue-item.error .issue-level { background: #dc2626; }
.issue-item.warn .issue-level { background: #d97706; }
.issue-item.info .issue-level { background: #64748b; }

/* 风险等级徽标 */
.risk-badge {
  font-size: 12px;
  font-weight: 600;
  padding: 2px 10px;
  border-radius: 999px;
  color: #fff;
}
.risk-badge.high { background: #dc2626; }
.risk-badge.medium { background: #d97706; }
.risk-badge.low { background: #2563eb; }

.dict-comment { color: #64748b; }

/* 审计日志 */
.audit-time { white-space: nowrap; color: #475569; }
.audit-action {
  font-size: 12px;
  font-weight: 600;
  background: #eff6ff;
  color: #1d4ed8;
  padding: 2px 10px;
  border-radius: 999px;
  white-space: nowrap;
}
.audit-target { font-family: 'Consolas', 'Monaco', monospace; font-size: 13px; }
.audit-detail {
  max-width: 260px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: #64748b;
}
.audit-ip { color: #94a3b8; font-size: 13px; }
</style>
