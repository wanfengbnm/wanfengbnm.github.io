<template>
  <div v-if="authReady" class="mgmt-container">

    <!-- ==================== 侧边栏 ==================== -->
    <aside class="mgmt-sidebar">
      <div class="sidebar-brand">
        <span class="brand-icon">🗄️</span>
        <span class="brand-text">多平台数据库管理</span>
      </div>

      <!-- 数据库选择 -->
      <div class="db-selector">
        <div class="db-current" @click="openDbModal">
          <span class="db-label">📦 {{ selectedDb || '选择数据库' }}</span>
          <span class="db-arrow">▾</span>
        </div>
      </div>

      <!-- 连接状态 -->
      <div class="conn-status" :class="dbStatus">
        <span class="conn-dot"></span>
        <span class="conn-text">{{ statusText }}</span>
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
          <button class="btn-refresh-top" @click="refreshAll">🔄 刷新状态</button>
          <button class="btn-logout-top" @click="handleLogout">退出登录</button>
        </div>
      </div>

      <div class="mgmt-content-area">
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
            <div class="ov-value">{{ totalRowCount }}</div>
            <div class="ov-label">总行数</div>
          </div>
          <div class="overview-card">
            <div class="ov-icon">🟢</div>
            <div class="ov-value">{{ overviewStatus }}</div>
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
            <button class="btn-secondary" @click="renumberIds" :disabled="renumbering">
              {{ renumbering ? '处理中...' : '↻ 重新编号ID' }}
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
          </div>
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
              📦 {{ db }}
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
const authReady = ref(false)
const dbStatus = ref('connecting') // 'connecting' | 'connected' | 'error'
const loadingTables = ref(false)
const databases = ref([])
const selectedDb = ref('')

const statusText = computed(() => {
  const dbName = selectedDb.value || 'mysql_mulpro'
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

// 只读字段（不在编辑表单中显示）
const READONLY_COLS = ['id', 'created_at', 'updated_at']

// ====================== 计算属性 ======================
const tabs = [
  { key: 'data', label: '📋 浏览数据' },
  { key: 'structure', label: '📐 表结构' },
  { key: 'sql', label: '✏️ SQL 查询' },
]

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
  // 权限检查
  const token = localStorage.getItem('token')
  const expire = localStorage.getItem('expire')
  if (!token || !expire || Date.now() > Number(expire)) {
    localStorage.removeItem('token')
    localStorage.removeItem('expire')
    window.location.href = '/TaskLog/'
    return
  }
  authReady.value = true
  await fetchDatabases()
  fetchTables()
})

// ====================== 表列表 ======================
async function fetchDatabases() {
  try {
    const res = await fetch(apiUrl('/databases'))
    if (res.ok) {
      const data = await res.json()
      databases.value = data.databases || []
      selectedDb.value = data.current || (databases.value[0] || '')
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

    const res = await fetch(apiUrl('/use-database'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const data = await res.json()
    if (res.ok) {
      selectedDb.value = dbModalDb.value
      showDbModal.value = false
      selectedTable.value = ''
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
    const res = await fetch(apiUrl('/tables'))
    if (res.ok) {
      const data = await res.json()
      tables.value = data.tables || []
      dbStatus.value = 'connected'
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
    const res = await fetch(apiUrl(`/tables/${selectedTable.value}/columns`), {
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
  deleteRowData.value = null
  modalError.value = ''
  showDeleteConfirm.value = true
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
  if (selectedTable.value) {
    fetchTableStructure()
    fetchTableData()
  }
}
async function renumberIds() {
  if (!confirm(`确定要重新编号 "${selectedTable.value}" 的 ID 字段吗？`)) return
  renumbering.value = true
  try {
    const res = await fetch(apiUrl(`/tables/${selectedTable.value}/renumber-ids`), { method: 'POST' })
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

  const url = editingRow.value
    ? apiUrl(`/tables/${selectedTable.value}/rows/${encodeURIComponent(editingRow.value[primaryKey.value])}`)
    : apiUrl(`/tables/${selectedTable.value}/rows`)

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
function handleLogout() {
  localStorage.removeItem('token')
  localStorage.removeItem('expire')
  window.location.href = '/TaskLog/'
}
</script>

<style scoped>
/* 隐藏 VitePress 底部 footer */
:global(.VPFooter) { display: none !important; }

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

.brand-icon { font-size: 24px; }
.brand-text { font-size: 17px; font-weight: 700; color: #f1f5f9; }

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
.db-label {
  font-size: 13px;
  font-weight: 500;
  color: #e2e8f0;
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
.table-icon { font-size: 16px; flex-shrink: 0; }
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
.ov-icon { font-size: 32px; margin-bottom: 8px; }
.ov-value { font-size: 28px; font-weight: 700; color: #1e293b; }
.ov-label { font-size: 14px; color: #64748b; margin-top: 4px; }

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
  font-size: 24px;
  font-weight: 700;
  color: #1e293b;
  margin: 0;
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
</style>
