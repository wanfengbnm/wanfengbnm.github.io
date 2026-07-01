<template>
  <div class="mgmt-container">

    <!-- ==================== 侧边栏 ==================== -->
    <aside class="mgmt-sidebar">
      <div class="sidebar-brand">
        <span class="brand-icon">🗄️</span>
        <span class="brand-text">多平台数据库管理</span>
      </div>

      <!-- 连接状态 -->
      <div class="conn-status" :class="{ connected: dbConnected, error: !dbConnected }">
        <span class="conn-dot"></span>
        <span class="conn-text">{{ dbConnected ? 'mysql_mulpro · 已连接' : '数据库连接失败' }}</span>
      </div>

      <!-- 表列表 -->
      <div class="sidebar-section">
        <div class="section-header">
          <span class="section-title">数据表</span>
          <span class="section-count" v-if="tables.length">{{ tables.length }}</span>
        </div>
        <nav class="table-list">
          <!-- 总览入口 -->
          <div class="table-item overview-item" :class="{ active: !selectedTable }" @click="selectTable('')">
            <span class="table-icon">📊</span>
            <span class="table-name-text">总览</span>
          </div>
          <div
            v-for="t in tables"
            :key="t.name"
            class="table-item"
            :class="{ active: selectedTable === t.name }"
            @click="selectTable(t.name)"
          >
            <span class="table-icon">📋</span>
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
        </nav>
      </div>

      <!-- 新建表按钮 -->
      <div class="sidebar-actions">
        <button class="btn-new-table" @click="openCreateTable">+ 创建表</button>
      </div>

      <!-- 底部 -->
      <div class="sidebar-footer">
        <div class="back-btn" @click="backToSelect">← 返回选择页</div>
        <div class="logout-btn" @click="handleLogout">退出登录</div>
      </div>
    </aside>

    <!-- ==================== 主内容区 ==================== -->
    <main class="mgmt-main">

      <!-- ===== 未选中表：SQL 编辑器 + 概览 ===== -->
      <div v-if="!selectedTable" class="welcome-view">
        <div class="sql-card">
          <h2 class="card-title">📝 SQL 查询编辑器</h2>
          <textarea
            v-model="sqlQuery"
            class="sql-editor"
            placeholder="输入 SQL 语句…&#10;例如：CREATE TABLE users (id INT AUTO_INCREMENT PRIMARY KEY, name VARCHAR(100) NOT NULL, email VARCHAR(255))"
            rows="5"
          ></textarea>
          <div class="sql-actions">
            <button class="btn-run" @click="runSql" :disabled="runningSql">
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

        <!-- 概览统计 -->
        <div class="overview-cards">
          <div class="overview-card">
            <div class="ov-icon">📊</div>
            <div class="ov-value">{{ tables.length }}</div>
            <div class="ov-label">数据表</div>
          </div>
          <div class="overview-card">
            <div class="ov-icon">📝</div>
            <div class="ov-value">{{ totalRows }}</div>
            <div class="ov-label">总行数</div>
          </div>
          <div class="overview-card">
            <div class="ov-icon">🟢</div>
            <div class="ov-value">{{ dbConnected ? '正常' : '异常' }}</div>
            <div class="ov-label">连接状态</div>
          </div>
          <div class="overview-card">
            <div class="ov-icon">🏷️</div>
            <div class="ov-value">MySQL 8.0</div>
            <div class="ov-label">数据库版本</div>
          </div>
        </div>
      </div>

      <!-- ===== 选中表：Tab 切换 ===== -->
      <div v-else class="table-view">
        <div class="table-header-bar">
          <h2 class="table-name-title">{{ selectedTable }}</h2>
          <button class="btn-refresh" @click="refreshTableData">🔄 刷新</button>
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
            <button class="btn-primary" @click="openInsertRow">+ 新增行</button>
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
          <div class="table-wrap">
            <table class="data-table">
              <thead>
                <tr>
                  <th>列名</th>
                  <th>类型</th>
                  <th>可空</th>
                  <th>键</th>
                  <th>默认值</th>
                  <th>额外</th>
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
      </div>
    </main>

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
import { ref, computed, onMounted } from 'vue'

// ====================== 状态 ======================
const dbConnected = ref(false)
const loadingTables = ref(false)
const tables = ref([])
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
const sortBy = ref('')
const sortDir = ref('desc')
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

const showDeleteConfirm = ref(false)
const deleteTarget = ref('') // 'ROW' | 'TABLE'
const deleteTableName = ref('')
const deleteRowData = ref(null)
const deleting = ref(false)
const modalError = ref('')

// 防抖定时器
let searchTimer = null

// ====================== API 基地址 ======================
const apiBase = () => {
  if (typeof window === 'undefined') return ''
  if (window.location.hostname === 'localhost') return ''
  return 'https://api.wfbnm.xyz'
}

const apiUrl = (path) => `${apiBase()}/api/mysql${path}`

// ====================== 计算属性 ======================
const tabs = [
  { key: 'data', label: '📋 浏览数据' },
  { key: 'structure', label: '📐 表结构' },
  { key: 'sql', label: '✏️ SQL 查询' },
]

const editableColumns = computed(() => {
  return tableStructure.value.filter((col) => !col.extra?.includes('auto_increment'))
})

const totalRowCount = computed(() => {
  return tables.value.reduce((sum, t) => sum + t.rowCount, 0)
})

// ====================== 初始化 ======================
onMounted(() => {
  // 权限检查
  const token = localStorage.getItem('token')
  const expire = localStorage.getItem('expire')
  if (!token || !expire || Date.now() > Number(expire)) {
    localStorage.removeItem('token')
    localStorage.removeItem('expire')
    window.location.href = '/TaskLog/'
    return
  }
  fetchTables()
})

// ====================== 表列表 ======================
async function fetchTables() {
  loadingTables.value = true
  dbConnected.value = false
  try {
    const res = await fetch(apiUrl('/tables'))
    if (res.ok) {
      const data = await res.json()
      tables.value = data.tables || []
      dbConnected.value = true
    } else {
      const err = await res.json()
      console.error('获取表列表失败:', err.message)
    }
  } catch (e) {
    console.error('数据库连接失败:', e.message)
  } finally {
    loadingTables.value = false
  }
}

function selectTable(name) {
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
  sortBy.value = ''
  tableSqlQuery.value = `SELECT * FROM \`${name}\` LIMIT 100`
  sqlResult.value = null
  sqlError.value = ''
  fetchTableStructure()
  fetchTableData()
  fetchTableSql()
}

async function fetchTableStructure() {
  try {
    const res = await fetch(apiUrl(`/tables/${selectedTable.value}`))
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
    const res = await fetch(apiUrl(`/tables/${selectedTable.value}/rows?${params}`))
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

// 每次选中表时预取的表数据查询（用于 SQL tab 默认值）
function fetchTableSql() {
  // 不需要额外请求，只是设置默认 SQL
}

// ====================== 分页/排序/搜索 ======================
function goPage(p) {
  page.value = p
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

function refreshTableData() {
  fetchTableStructure()
  fetchTableData()
  fetchTables()
}

// ====================== SQL 执行 ======================
async function runSql() {
  if (!sqlQuery.value.trim()) return
  runningSql.value = true
  sqlError.value = ''
  sqlResult.value = null

  try {
    const res = await fetch(apiUrl('/query'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sql: sqlQuery.value }),
    })
    const data = await res.json()
    if (res.ok) {
      sqlResult.value = data
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
    const res = await fetch(apiUrl('/query'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sql: tableSqlQuery.value }),
    })
    const data = await res.json()
    if (res.ok) {
      sqlResult.value = data
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
    const res = await fetch(apiUrl('/tables'), {
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

// ====================== 删除表 ======================
function confirmDropTable(name) {
  deleteTarget.value = 'TABLE'
  deleteTableName.value = name
  deleteRowData.value = null
  modalError.value = ''
  showDeleteConfirm.value = true
}

// ====================== 新增行 ======================
function openInsertRow() {
  editingRow.value = null
  rowForm.value = {}
  for (const col of tableStructure.value) {
    if (!col.extra?.includes('auto_increment')) {
      rowForm.value[col.name] = col.default ?? ''
    }
  }
  modalError.value = ''
  showRowModal.value = true
}

// ====================== 编辑行 ======================
function openEditRow(row) {
  editingRow.value = row
  rowForm.value = { ...row }
  modalError.value = ''
  showRowModal.value = true
}

// ====================== 保存行 ======================
async function saveRow() {
  savingRow.value = true
  modalError.value = ''

  const url = editingRow.value
    ? apiUrl(`/tables/${selectedTable.value}/rows/${encodeURIComponent(editingRow.value[primaryKey.value])}`)
    : apiUrl(`/tables/${selectedTable.value}/rows`)

  const method = editingRow.value ? 'PUT' : 'POST'

  // 编辑时移除主键
  const payload = { ...rowForm.value }
  if (editingRow.value && primaryKey.value) {
    delete payload[primaryKey.value]
  }

  try {
    const res = await fetch(url, {
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

  let url
  if (deleteTarget.value === 'ROW') {
    url = apiUrl(`/tables/${selectedTable.value}/rows/${encodeURIComponent(deleteRowData.value[primaryKey.value])}`)
  } else {
    url = apiUrl(`/tables/${deleteTableName.value}`)
  }

  try {
    const res = await fetch(url, { method: 'DELETE' })
    const data = await res.json()
    if (res.ok) {
      showDeleteConfirm.value = false
      if (deleteTarget.value === 'TABLE') {
        if (selectedTable.value === deleteTableName.value) {
          selectedTable.value = ''
        }
      }
      fetchTables()
      if (selectedTable.value) fetchTableData()
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
function backToSelect() {
  window.location.href = '/TaskLog/'
}

function handleLogout() {
  localStorage.removeItem('token')
  localStorage.removeItem('expire')
  window.location.href = '/TaskLog/'
}
</script>

<style scoped>
/* ========== 容器布局 ========== */
.mgmt-container {
  position: fixed;
  inset: var(--vp-nav-height, 0px) 0 0 0;
  display: flex;
  z-index: 1;
}

/* ========== 侧边栏 ========== */
.mgmt-sidebar {
  width: 240px;
  background: #1e293b;
  color: #cbd5e1;
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  user-select: none;
}

.sidebar-brand {
  height: 56px;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 16px;
  border-bottom: 1px solid #334155;
}

.brand-icon { font-size: 20px; }
.brand-text { font-size: 14px; font-weight: 700; color: #f1f5f9; }

/* 连接状态 */
.conn-status {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
  font-size: 12px;
  border-bottom: 1px solid #334155;
}
.conn-status.connected { color: #4ade80; }
.conn-status.error { color: #f87171; }
.conn-dot {
  width: 8px; height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}
.connected .conn-dot { background: #4ade80; box-shadow: 0 0 6px #4ade80; }
.error .conn-dot { background: #f87171; }

/* 表列表 */
.sidebar-section {
  flex: 1;
  overflow-y: auto;
  padding: 8px 0;
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 16px 4px;
}
.section-title {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: #64748b;
}
.section-count {
  font-size: 11px;
  background: #334155;
  color: #94a3b8;
  padding: 1px 8px;
  border-radius: 10px;
}

.table-list { padding: 4px 0; }

.table-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  cursor: pointer;
  font-size: 13px;
  transition: all 0.15s;
  border-left: 3px solid transparent;
}
.table-item:hover { background: #334155; color: #f1f5f9; }
.table-item.active {
  background: #1e3a5f;
  color: #60a5fa;
  border-left-color: #60a5fa;
}
.table-icon { font-size: 14px; flex-shrink: 0; }
.table-name-text {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.table-row-count {
  font-size: 11px;
  color: #64748b;
  background: #0f172a;
  padding: 1px 6px;
  border-radius: 8px;
  flex-shrink: 0;
}
.table-item.active .table-row-count { background: #1e3a5f; color: #93c5fd; }
.table-delete {
  font-size: 14px;
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
  font-size: 13px;
  color: #64748b;
}

/* 创建表按钮 */
.sidebar-actions {
  padding: 10px 16px;
  border-top: 1px solid #334155;
}
.btn-new-table {
  width: 100%;
  padding: 9px;
  border: 1px dashed #475569;
  background: transparent;
  color: #94a3b8;
  border-radius: 8px;
  cursor: pointer;
  font-size: 13px;
  transition: all 0.2s;
}
.btn-new-table:hover {
  border-color: #60a5fa;
  color: #60a5fa;
  background: #1e3a5f;
}

/* 侧边栏底部 */
.sidebar-footer {
  padding: 12px 16px;
  border-top: 1px solid #334155;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.back-btn, .logout-btn {
  font-size: 12px;
  padding: 8px 12px;
  border-radius: 6px;
  cursor: pointer;
  text-align: center;
  transition: all 0.2s ease;
}
.back-btn {
  background: transparent;
  color: #94a3b8;
  border: 1px solid #475569;
}
.back-btn:hover { background: #334155; color: #e2e8f0; }
.logout-btn {
  background: linear-gradient(135deg, #ef4444, #f87171);
  color: #fff;
}
.logout-btn:hover { background: linear-gradient(135deg, #dc2626, #ef4444); }

/* ========== 主内容区 ========== */
.mgmt-main {
  flex: 1;
  background: #f1f5f9;
  overflow-y: auto;
  padding: 28px 32px;
}

.card-title {
  font-size: 18px;
  font-weight: 700;
  color: #1e293b;
  margin-bottom: 16px;
}

/* ========== SQL 编辑器 ========== */
.sql-card {
  background: #fff;
  border-radius: 12px;
  padding: 24px;
  margin-bottom: 24px;
  box-shadow: 0 1px 6px rgba(0,0,0,0.04);
}
.sql-editor {
  width: 100%;
  padding: 14px;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  font-family: 'Consolas', 'Monaco', monospace;
  font-size: 13px;
  line-height: 1.6;
  color: #1e293b;
  background: #f8fafc;
  resize: vertical;
  outline: none;
  box-sizing: border-box;
}
.sql-editor:focus { border-color: #60a5fa; background: #fff; }
.sql-actions { margin-top: 12px; }
.btn-run {
  padding: 10px 28px;
  background: #3b82f6;
  color: #fff;
  border: none;
  border-radius: 8px;
  font-size: 14px;
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
  font-size: 13px;
  white-space: pre-wrap;
}
.sql-result { margin-top: 16px; }
.sql-affected {
  padding: 12px;
  background: #f0fdf4;
  color: #16a34a;
  border-radius: 8px;
  font-size: 14px;
}
.sql-result-info {
  font-size: 13px;
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
.ov-icon { font-size: 28px; margin-bottom: 8px; }
.ov-value { font-size: 26px; font-weight: 700; color: #1e293b; }
.ov-label { font-size: 12px; color: #64748b; margin-top: 4px; }

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
}
.btn-refresh {
  padding: 6px 14px;
  border: 1px solid #d1d5db;
  background: #fff;
  border-radius: 6px;
  font-size: 13px;
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
  font-size: 14px;
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
  padding: 9px 14px;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  font-size: 14px;
  color: #1e293b;
  outline: none;
  transition: border-color 0.2s;
}
.search-input:focus { border-color: #60a5fa; }
.btn-primary {
  padding: 9px 20px;
  background: #3b82f6;
  color: #fff;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  cursor: pointer;
  white-space: nowrap;
  transition: background 0.2s;
}
.btn-primary:hover { background: #2563eb; }
.btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }

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
  font-size: 13px;
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
.sort-icon { font-size: 11px; margin-left: 2px; }
.pk-badge {
  font-size: 10px;
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
code { font-family: 'Consolas', monospace; font-size: 12px; background: #f1f5f9; padding: 2px 6px; border-radius: 4px; }
.key-badge {
  font-size: 11px;
  background: #dbeafe;
  color: #2563eb;
  padding: 2px 8px;
  border-radius: 10px;
  font-weight: 600;
}

/* 操作按钮 */
.td-actions {
  display: flex;
  gap: 6px;
}
.btn-sm {
  padding: 4px 12px;
  border: none;
  border-radius: 4px;
  font-size: 12px;
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
  font-size: 13px;
  cursor: pointer;
  color: #374151;
  transition: all 0.15s;
}
.pagination button:hover:not(:disabled) { background: #f1f5f9; }
.pagination button:disabled { opacity: 0.4; cursor: not-allowed; }
.page-info { font-size: 13px; color: #64748b; }

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
.modal h3 { font-size: 18px; color: #1e293b; margin-bottom: 20px; }
.modal p { font-size: 14px; color: #475569; margin-bottom: 20px; }

.form-group { margin-bottom: 16px; }
.form-group label {
  display: block;
  font-size: 13px;
  font-weight: 600;
  color: #374151;
  margin-bottom: 6px;
}
.col-type-hint { font-weight: 400; color: #94a3b8; font-size: 12px; margin-left: 6px; }
.form-input {
  width: 100%;
  padding: 9px 14px;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  font-size: 14px;
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
  padding: 6px 10px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 13px;
  color: #1e293b;
  outline: none;
  box-sizing: border-box;
}
.col-input:focus { border-color: #60a5fa; }
.col-input:first-child { width: 120px; }
.col-input.type { width: 140px; }
.col-check {
  font-size: 12px;
  color: #475569;
  display: flex;
  align-items: center;
  gap: 3px;
  white-space: nowrap;
}
.btn-add-col {
  padding: 6px 14px;
  border: 1px dashed #d1d5db;
  background: transparent;
  color: #64748b;
  border-radius: 6px;
  font-size: 13px;
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
  padding: 9px 20px;
  border: 1px solid #d1d5db;
  background: #fff;
  border-radius: 8px;
  font-size: 14px;
  cursor: pointer;
  color: #374151;
  transition: all 0.15s;
}
.btn-cancel:hover { background: #f1f5f9; }
.btn-danger {
  padding: 9px 20px;
  background: #ef4444;
  color: #fff;
  border: none;
  border-radius: 8px;
  font-size: 14px;
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
  font-size: 13px;
}
</style>
