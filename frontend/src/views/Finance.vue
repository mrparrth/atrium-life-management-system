<script setup>
import { computed, ref } from 'vue'
import { useFinanceStore } from '@/stores/finance'
import { useUIStore } from '@/stores/ui'
import PageHeader from '@/components/PageHeader.vue'
import SectionHeader from '@/components/SectionHeader.vue'
import Sparkline from '@/components/Sparkline.vue'
import EmptyState from '@/components/EmptyState.vue'
import NetworthLogForm from '@/components/NetworthLogForm.vue'
import CashflowPeriodForm from '@/components/CashflowPeriodForm.vue'
import DonutChart from '@/components/DonutChart.vue'
import { inr, inrCompact } from '@/lib/money'
import { Plus, Trash2, Edit3, Tag, X, ArrowDownToLine, ArrowUpFromLine, PiggyBank, Wallet, Archive, Percent, RotateCcw } from 'lucide-vue-next'
import { DEFAULT_CATEGORIES } from '@/db'

import { useRoute, useRouter } from 'vue-router'
const route = useRoute()
const router = useRouter()

const finance = useFinanceStore()
const ui = useUIStore()

const tab = ref('overview')

// Dynamic Averages setup
const avgMonthsRange = ref(6) // X months default

const showNwForm = ref(false)
const editingNw = ref(null)
function openNwForm(log = null) { editingNw.value = log; showNwForm.value = true }
function closeNwForm() { showNwForm.value = false; editingNw.value = null }

const showCfForm = ref(false)
const editingCf = ref(null)
function openCfForm(p = null) { editingCf.value = p; showCfForm.value = true }
function closeCfForm() { showCfForm.value = false; editingCf.value = null }

import { onMounted, onUnmounted, watch } from 'vue'

const tabsList = ['overview', 'networth', 'cashflow', 'budgets', 'categories']

function handleKeydown(e) {
  if (e.altKey && e.code && e.code.startsWith('Digit')) {
    const num = e.code.replace('Digit', '')
    const idx = parseInt(num) - 1
    if (tabsList[idx]) {
      e.preventDefault()
      tab.value = tabsList[idx]
    }
  }
  if ((e.metaKey || e.ctrlKey) && e.key === '2') {
    if (tab.value === 'overview' || tab.value === 'cashflow') {
      const logMonthBtn = document.querySelector('[data-testid="overview-log-cf"], [data-testid="cf-add-btn"]')
      if (logMonthBtn) {
        e.preventDefault()
        logMonthBtn.click()
      }
    }
  }
}

function handleQuery() {
  if (route.query.tab) tab.value = route.query.tab
  if (route.query.new === 'nw') {
    tab.value = 'networth'
    openNwForm()
  } else if (route.query.new === 'cf') {
    tab.value = 'cashflow'
    openCfForm()
  }
  if (route.query.new || route.query.tab) {
    router.replace({ query: {} })
  }
}

onMounted(() => {
  handleQuery()
  window.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown)
})
watch(() => route.query, handleQuery)

async function deleteNw(log) {
  if (!await ui.confirm({ message: `Delete net worth snapshot from ${log.date}?`, title: 'Delete Snapshot' })) return
  await finance.removeNetworthLog(log.id); ui.showToast('Snapshot removed', 'success')
}
async function deleteCf(p) {
  if (!await ui.confirm({ message: `Delete ${formatMonth(p.month)} entry?`, title: 'Delete Month' })) return
  await finance.removeCashflowPeriod(p.id); ui.showToast('Month removed', 'success')
}

const sparkData = computed(() => finance.networthSeries.map(s => s.value))
const cashflowSpark = computed(() => finance.cashflowSeries.map(s => s.net))

function formatMonth(m) {
  if (!m) return ''
  const [y, mo] = m.split('-')
  const d = new Date(+y, +mo - 1, 1)
  return d.toLocaleString('en-IN', { month: 'long', year: 'numeric' })
}
function label(s) { return (s || '').replace(/_/g, ' ') }

// Categories tab
const newCatScope = ref('expense')
const newCatName = ref('')
const newCatGroup = ref('Need')

const scopeGroups = {
  asset: [], liability: [], income: [], expense: [], investment: []
}
DEFAULT_CATEGORIES.forEach(c => {
  if (c.group && !scopeGroups[c.scope].includes(c.group)) {
    scopeGroups[c.scope].push(c.group)
  }
})

async function addCategoryFn() {
  const r = await finance.addCategory(newCatScope.value, newCatName.value, newCatGroup.value)
  if (!r) { ui.showToast('Category exists or empty', 'error'); return }
  newCatName.value = ''; ui.showToast('Category added', 'success')
}
async function removeCategoryFn(c) {
  if (await ui.confirm({ message: `Remove "${label(c.name)}" from ${c.scope}?`, title: 'Remove Category' })) await finance.removeCategory(c.id)
}

const editingCategoryId = ref(null)
const editingCategoryName = ref('')

function startRenameCategory(c) {
  editingCategoryId.value = c.id
  editingCategoryName.value = label(c.name)
}

async function saveRenameCategory(c) {
  if (!editingCategoryName.value.trim()) { editingCategoryId.value = null; return }
  const ok = await finance.renameCategory(c.id, editingCategoryName.value)
  if (ok) {
    ui.showToast('Category renamed', 'success')
  } else {
    ui.showToast('Failed to rename (duplicate name)', 'error')
  }
  editingCategoryId.value = null
}

async function archiveCategoryFn(c) {
  await finance.toggleArchiveCategory(c.id)
  ui.showToast(c.archived ? 'Category archived' : 'Category restored', 'success')
}

async function resetCategoriesFn() {
  const confirmed = await ui.confirm({
    title: 'Reset Categories',
    message: 'Are you sure you want to reset all categories to their default presets? Custom categories will be removed.'
  })
  if (!confirmed) return
  await finance.resetCategories()
  ui.showToast('Categories reset to presets', 'success')
}

// Category Budgets handling
async function saveCategoryBudget(c, amount) {
  await finance.updateCategoryBudget(c.id, amount)
  ui.showToast('Budget updated', 'success')
}

const latest = computed(() => finance.latestNetworth)
const latestCf = computed(() => finance.latestCashflow)
const latestCfTotals = computed(() => finance.periodTotals(latestCf.value))

// ───── Averages computation for the last X months
const averages = computed(() => {
  const periods = finance.cashflowPeriods.slice(0, avgMonthsRange.value)
  if (!periods.length) return { income: 0, expense: 0, saveRate: 0 }
  
  let totalIncome = 0
  let totalExpense = 0
  periods.forEach(p => {
    const t = finance.periodTotals(p)
    totalIncome += t.income
    totalExpense += t.expense
  })
  
  const incomeAvg = totalIncome / periods.length
  const expenseAvg = totalExpense / periods.length
  const saveRateAvg = incomeAvg > 0 ? ((incomeAvg - expenseAvg) / incomeAvg) * 100 : 0
  
  return {
    income: incomeAvg,
    expense: expenseAvg,
    saveRate: saveRateAvg
  }
})

// ───── Category Actual Spend & Budget status for current year
const budgetStatus = computed(() => {
  const currentYearStr = new Date().getFullYear().toString()
  const yearPeriods = finance.cashflowPeriods.filter(p => p.month.startsWith(currentYearStr))
  
  // Calculate total spent per category in this year
  const actuals = {}
  yearPeriods.forEach(p => {
    (p.entries || []).forEach(e => {
      const key = `${e.type}::${e.category}`
      actuals[key] = (actuals[key] || 0) + +e.value
    })
  })
  
  // Mix in categories with budgets
  return finance.categories.map(c => {
    const key = `${c.scope}::${c.name}`
    const actual = actuals[key] || 0
    const budget = c.yearlyBudget || 0
    let progress = 0
    if (budget > 0) {
      progress = (actual / budget) * 100
    }
    return {
      category: c,
      actual,
      budget,
      progress
    }
  }).filter(item => item.budget > 0 || item.actual > 0)
})

// ───── Month-over-Month & Year-over-Year Comparative Metrics
const comparisonMetrics = computed(() => {
  if (!latestCf.value) return null
  
  const current = latestCfTotals.value
  const currentMonth = latestCf.value.month // YYYY-MM
  const [currY, currM] = currentMonth.split('-').map(Number)
  
  // Last Month String
  const prevMonthDate = new Date(currY, currM - 2, 1)
  const prevMonthStr = prevMonthDate.toISOString().slice(0, 7)
  
  // Last Year String
  const prevYearStr = `${currY - 1}-${String(currM).padStart(2, '0')}`
  
  const prevMonthPeriod = finance.cashflowPeriods.find(p => p.month === prevMonthStr)
  const prevYearPeriod = finance.cashflowPeriods.find(p => p.month === prevYearStr)
  
  const prevMonthTotals = finance.periodTotals(prevMonthPeriod)
  const prevYearTotals = finance.periodTotals(prevYearPeriod)
  
  function getPctChange(currVal, prevVal) {
    if (!prevVal) return null
    return ((currVal - prevVal) / prevVal) * 100
  }
  
  return {
    lastMonth: {
      available: !!prevMonthPeriod,
      monthName: prevMonthDate.toLocaleString('en-IN', { month: 'short', year: 'numeric' }),
      incomeChange: getPctChange(current.income, prevMonthTotals.income),
      expenseChange: getPctChange(current.expense, prevMonthTotals.expense),
      saveRateChange: current.income ? (current.income - current.expense) / current.income * 100 - (prevMonthTotals.income - prevMonthTotals.expense) / prevMonthTotals.income * 100 : 0
    },
    lastYear: {
      available: !!prevYearPeriod,
      yearName: String(currY - 1),
      incomeChange: getPctChange(current.income, prevYearTotals.income),
      expenseChange: getPctChange(current.expense, prevYearTotals.expense),
    }
  }
})
</script>

<template>
  <div class="px-8 md:px-12 py-10 max-w-6xl mx-auto" data-testid="finance-view">
    <PageHeader overline="Memory · Finance" title="Money, gently tracked"
      sub="Date-stamped net-worth snapshots and month-by-month cash flow." />
    <div class="flex flex-wrap items-center justify-between gap-4 mb-10">
      <div class="flex flex-wrap gap-1 bg-elevated rounded-2xl p-1 border border-line text-sm w-fit"
        data-testid="finance-tabs">
        <button
          v-for="t in [{ k: 'overview', l: 'Overview' }, { k: 'networth', l: 'Net worth' }, { k: 'cashflow', l: 'Cash flow' }, { k: 'budgets', l: 'Budgets' }, { k: 'categories', l: 'Categories' }]"
          :key="t.k" :data-testid="`tab-${t.k}`" class="px-4 py-2 rounded-xl transition-colors duration-200"
          :class="tab === t.k ? 'bg-surface text-ink' : 'text-ink-2 hover:text-ink'" @click="tab = t.k">{{ t.l }}</button>
      </div>
      <div class="text-xs text-ink-3 select-none">
        Tip: Use <span class="kbd">⌥1</span> to <span class="kbd">⌥5</span> to switch tabs
      </div>
    </div>

    <!-- OVERVIEW -->
    <template v-if="tab === 'overview'">
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-10">
        <div class="card p-6">
          <div class="overline">Net worth</div>
          <div class="font-serif text-4xl tracking-tight mt-2" data-testid="finance-net-worth">{{
            inr(finance.currentNetWorth) }}</div>
          <p v-if="latest" class="text-xs text-ink-3 mt-2">as of {{ latest.date }}</p>
          <p v-else class="text-sm text-ink-2 mt-3 italic">No snapshots yet - log one to begin.</p>
          <div class="mt-6">
            <Sparkline :data="sparkData" :height="64" color="rgb(90 115 83)" />
          </div>
          <button class="btn-primary mt-5" @click="openNwForm()" data-testid="overview-log-nw">
            <Plus class="w-4 h-4" /> Log net worth <span class="kbd ml-1.5 !bg-canvas/20 !border-canvas/10 !text-canvas select-none">⌘1</span>
          </button>
        </div>

        <div class="card p-6">
          <div class="overline">Latest month - {{ latestCf ? formatMonth(latestCf.month) : '-' }}</div>
          <div class="grid grid-cols-2 gap-3 mt-3">
            <div>
              <div class="overline">Income</div>
              <div class="font-serif text-lg text-pri-strategic">{{ inr(latestCfTotals.income) }}</div>
            </div>
            <div>
              <div class="overline">Expense</div>
              <div class="font-serif text-lg text-pri-critical">{{ inr(latestCfTotals.expense) }}</div>
            </div>
            <div>
              <div class="overline">Invested</div>
              <div class="font-serif text-lg text-pri-interruptive">{{ inr(latestCfTotals.investment) }}</div>
            </div>
            <div>
              <div class="overline">Net</div>
              <div class="font-serif text-lg" :class="latestCfTotals.net >= 0 ? 'text-ink' : 'text-pri-critical'">{{
                inr(latestCfTotals.net) }}</div>
            </div>
          </div>
          <div class="mt-5">
            <Sparkline :data="cashflowSpark" :height="48" color="rgb(158 132 87)" />
          </div>
          <button class="btn-primary mt-5" @click="openCfForm()" data-testid="overview-log-cf">
            <Plus class="w-4 h-4" /> Log a month <span class="kbd ml-1.5 !bg-canvas/20 !border-canvas/10 !text-canvas select-none">⌘2</span>
          </button>
        </div>
      </div>

      <!-- COMPARISON VS PREVIOUS MONTHS & YEARS -->
      <div v-if="comparisonMetrics" class="grid grid-cols-1 md:grid-cols-2 gap-5 mb-10">
        <!-- Vs Last Month -->
        <div class="card p-5">
          <div class="overline">vs Last Month ({{ comparisonMetrics.lastMonth.monthName }})</div>
          <div class="grid grid-cols-3 gap-2 mt-3 text-center">
            <div>
              <div class="text-[10px] text-ink-3 uppercase">Income</div>
              <div v-if="comparisonMetrics.lastMonth.available" class="text-sm font-medium mt-1" :class="comparisonMetrics.lastMonth.incomeChange >= 0 ? 'text-pri-strategic' : 'text-pri-critical'">
                {{ comparisonMetrics.lastMonth.incomeChange >= 0 ? '+' : '' }}{{ comparisonMetrics.lastMonth.incomeChange.toFixed(1) }}%
              </div>
              <div v-else class="text-sm text-ink-3 mt-1">—</div>
            </div>
            <div>
              <div class="text-[10px] text-ink-3 uppercase">Expense</div>
              <div v-if="comparisonMetrics.lastMonth.available" class="text-sm font-medium mt-1" :class="comparisonMetrics.lastMonth.expenseChange <= 0 ? 'text-pri-strategic' : 'text-pri-critical'">
                {{ comparisonMetrics.lastMonth.expenseChange >= 0 ? '+' : '' }}{{ comparisonMetrics.lastMonth.expenseChange.toFixed(1) }}%
              </div>
              <div v-else class="text-sm text-ink-3 mt-1">—</div>
            </div>
            <div>
              <div class="text-[10px] text-ink-3 uppercase">Save Rate</div>
              <div v-if="comparisonMetrics.lastMonth.available" class="text-sm font-medium mt-1" :class="comparisonMetrics.lastMonth.saveRateChange >= 0 ? 'text-pri-strategic' : 'text-pri-critical'">
                {{ comparisonMetrics.lastMonth.saveRateChange >= 0 ? '+' : '' }}{{ comparisonMetrics.lastMonth.saveRateChange.toFixed(1) }}%
              </div>
              <div v-else class="text-sm text-ink-3 mt-1">—</div>
            </div>
          </div>
        </div>

        <!-- Vs Last Year -->
        <div class="card p-5">
          <div class="overline">vs Last Year ({{ comparisonMetrics.lastYear.yearName }})</div>
          <div class="grid grid-cols-3 gap-2 mt-3 text-center">
            <div>
              <div class="text-[10px] text-ink-3 uppercase">Income</div>
              <div v-if="comparisonMetrics.lastYear.available" class="text-sm font-medium mt-1" :class="comparisonMetrics.lastYear.incomeChange >= 0 ? 'text-pri-strategic' : 'text-pri-critical'">
                {{ comparisonMetrics.lastYear.incomeChange >= 0 ? '+' : '' }}{{ comparisonMetrics.lastYear.incomeChange.toFixed(1) }}%
              </div>
              <div v-else class="text-sm text-ink-3 mt-1">—</div>
            </div>
            <div>
              <div class="text-[10px] text-ink-3 uppercase">Expense</div>
              <div v-if="comparisonMetrics.lastYear.available" class="text-sm font-medium mt-1" :class="comparisonMetrics.lastYear.expenseChange <= 0 ? 'text-pri-strategic' : 'text-pri-critical'">
                {{ comparisonMetrics.lastYear.expenseChange >= 0 ? '+' : '' }}{{ comparisonMetrics.lastYear.expenseChange.toFixed(1) }}%
              </div>
              <div v-else class="text-sm text-ink-3 mt-1">—</div>
            </div>
            <div>
              <div class="text-[10px] text-ink-3 uppercase">Save Rate</div>
              <div v-if="comparisonMetrics.lastYear.available" class="text-sm font-medium mt-1" :class="comparisonMetrics.lastYear.saveRateChange >= 0 ? 'text-pri-strategic' : 'text-pri-critical'">
                {{ comparisonMetrics.lastYear.saveRateChange >= 0 ? '+' : '' }}{{ comparisonMetrics.lastYear.saveRateChange.toFixed(1) }}%
              </div>
              <div v-else class="text-sm text-ink-3 mt-1">—</div>
            </div>
          </div>
        </div>
      </div>

      <!-- HISTORICAL PERIOD AVERAGES -->
      <SectionHeader overline="Averages" title="Historical Performance">
        <template #right>
          <div class="flex items-center gap-2 text-xs">
            <span class="text-ink-3 font-mono">Period:</span>
            <select v-model="avgMonthsRange" class="bg-surface border border-line rounded-lg px-2 py-1 outline-none">
              <option :value="3">Last 3 months</option>
              <option :value="6">Last 6 months</option>
              <option :value="12">Last 12 months</option>
            </select>
          </div>
        </template>
      </SectionHeader>
      
      <div class="grid grid-cols-1 md:grid-cols-3 gap-5 mb-10">
        <div class="card p-5">
          <div class="overline">Avg Income</div>
          <div class="font-serif text-2xl text-pri-strategic mt-2">{{ inr(averages.income) }}</div>
        </div>
        <div class="card p-5">
          <div class="overline">Avg Expense</div>
          <div class="font-serif text-2xl text-pri-critical mt-2">{{ inr(averages.expense) }}</div>
        </div>
        <div class="card p-5">
          <div class="overline">Avg Save Rate</div>
          <div class="font-serif text-2xl mt-2" :class="averages.saveRate >= 30 ? 'text-pri-strategic' : averages.saveRate >= 10 ? 'text-pri-interruptive' : 'text-pri-critical'">
            {{ averages.saveRate.toFixed(1) }}%
          </div>
        </div>
      </div>

      <!-- ASSETS & EXPENSES DONUT CHARTS -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-10">
        <div>
          <SectionHeader v-if="finance.allocation.length" overline="Distribution" title="Asset allocation" />
          <div v-if="finance.allocation.length" class="card p-6">
            <DonutChart :data="finance.allocation" theme="strategic" />
          </div>
        </div>

        <div>
          <SectionHeader v-if="finance.expenseBreakdownLatest.length" overline="Spending shape" title="Latest expenses" />
          <div v-if="finance.expenseBreakdownLatest.length" class="card p-6">
            <DonutChart :data="finance.expenseBreakdownLatest" theme="critical" />
          </div>
        </div>
      </div>
    </template>

    <!-- BUDGETS TAB -->
    <template v-else-if="tab === 'budgets'">
      <SectionHeader overline="Budgets" title="Annual Category Budgets" hint="Add and configure yearly budgets for your cash flow and net worth categories." />
      
      <form @submit.prevent="addCategoryFn" class="card p-5 mb-10 flex flex-wrap gap-3 items-end"
        data-testid="budget-add-category-form">
        <label class="flex-1 min-w-[140px]">
          <span class="overline block mb-1">Scope</span>
          <select v-model="newCatScope" @change="newCatGroup = scopeGroups[newCatScope][0]" class="input-block text-sm">
            <optgroup label="Net worth">
              <option value="asset">Asset</option>
              <option value="liability">Liability</option>
            </optgroup>
            <optgroup label="Cash flow">
              <option value="income">Income</option>
              <option value="expense">Expense</option>
              <option value="investment">Investment</option>
            </optgroup>
          </select>
        </label>
        <label class="flex-1 min-w-[140px]">
          <span class="overline block mb-1">Type</span>
          <select v-model="newCatGroup" class="input-block text-sm">
            <option v-for="g in scopeGroups[newCatScope]" :key="g" :value="g">{{ g }}</option>
          </select>
        </label>
        <label class="flex-1 min-w-[200px]">
          <span class="overline block mb-1">Category Name</span>
          <input v-model="newCatName" placeholder="e.g. rent, groceries" class="input-block text-sm" />
        </label>
        <button type="submit" class="btn-primary">
          <Plus class="w-4 h-4" /> Add Category
        </button>
      </form>

      <div class="card p-6 mb-10 overflow-x-auto">
        <table class="w-full text-sm text-left border-collapse">
          <thead>
            <tr class="border-b border-line pb-2 text-ink-3 uppercase text-[10px] tracking-wider">
              <th class="py-2">Category</th>
              <th class="py-2">Scope</th>
              <th class="py-2 text-right">Spent YTD</th>
              <th class="py-2 text-right">Yearly Budget</th>
              <th class="py-2 text-right">Usage</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in budgetStatus" :key="item.category.id" class="border-b border-line/40 hover:bg-canvas/30 transition-colors">
              <td class="py-3 capitalize font-medium text-ink">{{ label(item.category.name) }}</td>
              <td class="py-3 text-xs text-ink-3 capitalize">{{ item.category.scope }}</td>
              <td class="py-3 text-right font-mono">{{ inr(item.actual) }}</td>
              <td class="py-3 text-right">
                <input 
                  type="number" 
                  :value="item.budget || ''" 
                  @change="e => saveCategoryBudget(item.category, e.target.value)"
                  placeholder="Set yearly limit"
                  class="bg-canvas border border-line rounded px-2 py-1 text-right w-28 text-sm outline-none focus:border-line-2 font-mono" 
                />
              </td>
              <td class="py-3 text-right">
                <div class="flex items-center justify-end gap-2">
                  <div class="w-20 bg-line rounded-full h-1.5 overflow-hidden">
                    <div 
                      class="h-full rounded-full transition-all duration-300"
                      :class="item.progress > 100 ? 'bg-pri-critical' : item.progress > 80 ? 'bg-pri-interruptive' : 'bg-pri-strategic'"
                      :style="{ width: `${Math.min(100, item.progress)}%` }"
                    ></div>
                  </div>
                  <span class="font-mono text-xs" :class="item.progress > 100 ? 'text-pri-critical font-semibold' : 'text-ink-2'">
                    {{ item.progress.toFixed(0) }}%
                  </span>
                </div>
              </td>
            </tr>
            <tr v-if="!budgetStatus.length">
              <td colspan="5" class="py-6 text-center text-ink-3 italic">
                No active categories. Create one above to configure.
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>

    <!-- NETWORTH LOGS -->
    <template v-else-if="tab === 'networth'">
      <div class="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <div class="overline">Snapshots</div>
          <div class="font-serif text-3xl mt-1">{{ finance.networthLogs.length }} log<span
              v-if="finance.networthLogs.length !== 1">s</span></div>
        </div>
        <button class="btn-primary" @click="openNwForm()" data-testid="nw-add-btn">
          <Plus class="w-4 h-4" /> Log net worth <span class="kbd ml-1.5 !bg-canvas/20 !border-canvas/10 !text-canvas select-none">⌘1</span>
        </button>
      </div>

      <div v-if="finance.networthLogs.length" class="space-y-4">
        <div v-for="log in finance.networthLogs" :key="log.id" class="card p-6" :data-testid="`nw-log-${log.id}`">
          <div class="flex items-start justify-between gap-4 mb-4">
            <div>
              <div class="overline">{{ log.date }}</div>
              <div class="font-serif text-3xl mt-1">{{ inr(finance.logTotal(log)) }}</div>
              <div class="text-sm text-ink-2 mt-1">
                <span>Assets {{ inr(finance.logAssets(log)) }}</span>
                <span class="mx-2">·</span>
                <span>Liabilities {{ inr(finance.logLiabilities(log)) }}</span>
              </div>
              <p v-if="log.note" class="text-sm text-ink-2 italic mt-2">{{ log.note }}</p>
            </div>
            <div class="flex gap-1">
              <button class="btn-ghost !p-1.5" @click="openNwForm(log)" :data-testid="`nw-edit-${log.id}`">
                <Edit3 class="w-4 h-4" />
              </button>
              <button class="btn-ghost !p-1.5 hover:text-pri-critical" @click="deleteNw(log)"
                :data-testid="`nw-delete-${log.id}`">
                <Trash2 class="w-4 h-4" />
              </button>
            </div>
          </div>
          <div class="grid grid-cols-2 md:grid-cols-3 gap-3 pt-4 border-t border-line">
            <div v-for="e in log.entries" :key="e.category + e.type" class="flex items-baseline justify-between">
              <span class="text-xs text-ink-3 capitalize">{{ label(e.category) }}<span v-if="e.type === 'liability'"
                  class="text-pri-critical"> · liability</span></span>
              <span class="text-sm font-medium" :class="e.type === 'liability' ? 'text-pri-critical' : 'text-ink'">{{
                e.type === 'liability' ? '-' : '' }}{{ inr(e.value) }}</span>
            </div>
          </div>
        </div>
      </div>
      <EmptyState v-else title="No snapshots yet" hint="Log your first net worth above." />
    </template>

    <!-- CASHFLOW -->
    <template v-else-if="tab === 'cashflow'">
      <div class="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <div class="overline">Monthly periods</div>
          <div class="font-serif text-3xl mt-1">{{ finance.cashflowPeriods.length }} month<span
              v-if="finance.cashflowPeriods.length !== 1">s</span></div>
        </div>
        <button class="btn-primary" @click="openCfForm()" data-testid="cf-add-btn">
          <Plus class="w-4 h-4" /> Log a month <span class="kbd ml-1.5 !bg-canvas/20 !border-canvas/10 !text-canvas select-none">⌘1</span>
        </button>
      </div>

      <div v-if="finance.cashflowPeriods.length" class="space-y-4">
        <div v-for="p in finance.cashflowPeriods" :key="p.id" class="card p-6" :data-testid="`cf-period-${p.id}`">
          <div class="flex items-start justify-between gap-4 mb-4">
            <div>
              <div class="overline">{{ formatMonth(p.month) }}</div>
              <div class="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-1 mt-2">
                <div class="flex items-baseline gap-2">
                  <ArrowDownToLine class="w-3 h-3 text-pri-strategic" /><span class="text-ink-2 text-xs">In</span><span
                    class="font-serif text-base text-pri-strategic">{{ inr(finance.periodTotals(p).income) }}</span>
                </div>
                <div class="flex items-baseline gap-2">
                  <ArrowUpFromLine class="w-3 h-3 text-pri-critical" /><span class="text-ink-2 text-xs">Out</span><span
                    class="font-serif text-base text-pri-critical">{{ inr(finance.periodTotals(p).expense) }}</span>
                </div>
                <div class="flex items-baseline gap-2">
                  <PiggyBank class="w-3 h-3 text-pri-interruptive" /><span class="text-ink-2 text-xs">Inv</span><span
                    class="font-serif text-base text-pri-interruptive">{{ inr(finance.periodTotals(p).investment)
                    }}</span>
                </div>
                <div class="flex items-baseline gap-2">
                  <Wallet class="w-3 h-3 text-ink-3" /><span class="text-ink-2 text-xs">Net</span><span
                    class="font-serif text-base">{{ inr(finance.periodTotals(p).net) }}</span>
                </div>
              </div>
              <p v-if="p.note" class="text-sm text-ink-2 italic mt-3">{{ p.note }}</p>
            </div>
            <div class="flex gap-1">
              <button class="btn-ghost !p-1.5" @click="openCfForm(p)" :data-testid="`cf-edit-${p.id}`">
                <Edit3 class="w-4 h-4" />
              </button>
              <button class="btn-ghost !p-1.5 hover:text-pri-critical" @click="deleteCf(p)"
                :data-testid="`cf-delete-${p.id}`">
                <Trash2 class="w-4 h-4" />
              </button>
            </div>
          </div>
          <div class="grid grid-cols-2 md:grid-cols-3 gap-3 pt-4 border-t border-line">
            <div v-for="e in p.entries" :key="e.category + e.type" class="flex items-baseline justify-between">
              <span class="text-xs text-ink-3 capitalize">{{ label(e.category) }} <span
                  class="text-[10px] uppercase tracking-overline">·{{ e.type === 'expense' ? 'out' : e.type === 'income'
                    ? 'in' : 'inv' }}</span></span>
              <span class="text-sm font-medium"
                :class="e.type === 'income' ? 'text-pri-strategic' : e.type === 'expense' ? 'text-pri-critical' : 'text-pri-interruptive'">
                {{ e.type === 'expense' ? '-' : e.type === 'investment' ? '-' : '+' }}{{ inr(e.value) }}
              </span>
            </div>
          </div>
        </div>
      </div>
      <EmptyState v-else title="No months logged yet" hint="Capture your first month above." />
    </template>

    <!-- CATEGORIES -->
    <template v-else-if="tab === 'categories'">
      <SectionHeader overline="Tags" title="Categories"
        hint="Net worth categories (asset, liability) and cash flow categories (income, expense, investment) are managed separately.">
        <template #right>
          <button @click="resetCategoriesFn" class="inline-flex items-center justify-center gap-1.5 bg-pri-critical-bg text-pri-critical border border-pri-critical-bd rounded-xl px-3 py-1.5 text-xs font-medium hover:bg-pri-critical hover:text-canvas transition-all duration-300" data-testid="reset-categories-btn">
            <RotateCcw class="w-3.5 h-3.5" /> Reset to presets
          </button>
        </template>
      </SectionHeader>
      <form @submit.prevent="addCategoryFn" class="card p-5 mb-10 flex flex-wrap gap-3 items-end"
        data-testid="add-category-form">
        <label class="flex-1 min-w-[140px]">
          <span class="overline block mb-1">Scope</span>
          <select v-model="newCatScope" @change="newCatGroup = scopeGroups[newCatScope][0]" class="input-block text-sm"
            data-testid="new-category-scope">
            <optgroup label="Net worth">
              <option value="asset">Asset</option>
              <option value="liability">Liability</option>
            </optgroup>
            <optgroup label="Cash flow">
              <option value="income">Income</option>
              <option value="expense">Expense</option>
              <option value="investment">Investment</option>
            </optgroup>
          </select>
        </label>
        <label class="flex-1 min-w-[140px]">
          <span class="overline block mb-1">Type</span>
          <select v-model="newCatGroup" class="input-block text-sm" data-testid="new-category-group">
            <option v-for="g in scopeGroups[newCatScope]" :key="g" :value="g">{{ g }}</option>
          </select>
        </label>
        <label class="flex-1 min-w-[200px]">
          <span class="overline block mb-1">Name</span>
          <input v-model="newCatName" placeholder="e.g. gold, school_fees" class="input-block text-sm"
            data-testid="new-category-name" />
        </label>
        <button type="submit" class="btn-primary" data-testid="new-category-save">
          <Plus class="w-4 h-4" /> Add
        </button>
      </form>

      <div
        v-for="group in [{ label: 'Net worth · Assets', scope: 'asset' }, { label: 'Net worth · Liabilities', scope: 'liability' }, { label: 'Cash flow · Income', scope: 'income' }, { label: 'Cash flow · Expenses', scope: 'expense' }, { label: 'Cash flow · Investments', scope: 'investment' }]"
        :key="group.scope" class="mb-8">
        <h3 class="overline mb-3">{{ group.label }}</h3>
        <div class="flex flex-wrap gap-2" :data-testid="`category-group-${group.scope}`">
          <span v-for="c in finance.categoriesForScope(group.scope)" :key="c.id"
            class="group inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-line bg-surface text-sm capitalize hover:border-line-2 transition-all duration-300"
            :class="c.archived ? 'opacity-70 bg-elevated/40 border-dashed' : ''"
            :data-testid="`category-${group.scope}-${c.name}`">
            <Tag class="w-3 h-3 text-ink-3 shrink-0" />

            <template v-if="editingCategoryId === c.id">
              <input v-model="editingCategoryName" @keydown.enter="saveRenameCategory(c)"
                @keydown.esc="editingCategoryId = null" @blur="saveRenameCategory(c)"
                class="bg-transparent border-b border-line focus:outline-none w-24 text-sm font-sans" autofocus />
            </template>
            <template v-else>
              <span @dblclick="startRenameCategory(c)" :class="c.archived ? 'line-through text-ink-3' : 'text-ink'"
                class="cursor-text flex items-center gap-1.5"
                :title="c.archived ? 'Archived (Double click to rename)' : 'Double click to rename'">
                {{ label(c.name) }}
                <span v-if="c.group"
                  class="text-[9px] uppercase tracking-wider text-ink-3 border border-line rounded px-1">{{ c.group
                  }}</span>
              </span>
            </template>

            <!-- Actions -->
            <div class="flex items-center gap-1.5 ml-1 select-none">
              <button v-if="editingCategoryId !== c.id" @click="startRenameCategory(c)"
                class="opacity-0 group-hover:opacity-100 hover:text-ink transition-opacity" title="Rename category">
                <Edit3 class="w-3 h-3 text-ink-3" />
              </button>
              <button @click="archiveCategoryFn(c)" class="opacity-0 group-hover:opacity-100 transition-opacity"
                :class="c.archived ? 'text-pri-strategic hover:opacity-100' : 'text-ink-3 hover:text-pri-interruptive'"
                :title="c.archived ? 'Restore category' : 'Archive category'">
                <Archive class="w-3 h-3" />
              </button>
              <button @click="removeCategoryFn(c)"
                class="opacity-0 group-hover:opacity-100 hover:text-pri-critical transition-opacity"
                :data-testid="`category-remove-${c.id}`" :title="`Remove ${c.name}`">
                <X class="w-3 h-3 text-ink-3" />
              </button>
            </div>
          </span>
          <span v-if="!finance.categoriesForScope(group.scope).length" class="text-sm text-ink-3 italic">None
            yet.</span>
        </div>
      </div>
    </template>

    <NetworthLogForm v-if="showNwForm" :initial="editingNw" @close="closeNwForm" />
    <CashflowPeriodForm v-if="showCfForm" :initial="editingCf" @close="closeCfForm" />
  </div>
</template>
