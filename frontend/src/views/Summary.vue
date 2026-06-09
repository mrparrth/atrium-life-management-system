<script setup>
import { computed, ref, onMounted } from 'vue'
import { useYearsStore } from '@/stores/years'
import { useGoalsStore } from '@/stores/goals'
import { useProjectsStore } from '@/stores/projects'
import { useTasksStore } from '@/stores/tasks'
import { useFinanceStore } from '@/stores/finance'
import PageHeader from '@/components/PageHeader.vue'
import SectionHeader from '@/components/SectionHeader.vue'
import EmptyState from '@/components/EmptyState.vue'
import InteractiveChart from '@/components/InteractiveChart.vue'
import Combobox from '@/components/Combobox.vue'
import { inr, inrCompact } from '@/lib/money'
import { Target, FolderKanban, CheckSquare, Presentation, Wallet, TrendingUp, Sparkles, ArrowDownToLine, ArrowUpFromLine, PiggyBank, Calendar, Layers } from 'lucide-vue-next'

const years = useYearsStore()
const goals = useGoalsStore()
const projects = useProjectsStore()
const tasks = useTasksStore()
const finance = useFinanceStore()

import { useRoute, useRouter } from 'vue-router'
const route = useRoute()
const router = useRouter()

const activeYearId = ref(null)
const selectedCategory = ref('net_worth')
const activeTab = ref('yearly') // 'yearly' or 'yoy'

import { watch } from 'vue'

function handleQuery() {
  if (route.query.tab) {
    activeTab.value = route.query.tab
    router.replace({ query: {} })
  }
}

onMounted(async () => {
  handleQuery()
  if (years.items.length) {
    // Sort years descending for dropdown
    const sorted = [...years.items].sort((a, b) => b.year - a.year)
    activeYearId.value = sorted[0].id
  }
})

watch(() => route.query, handleQuery)

const selectedYear = computed(() => {
  return years.items.find(y => y.id === activeYearId.value) || years.items[0] || null
})

// ───── Horizon Analytics
const goalsForYear = computed(() => {
  if (!selectedYear.value) return []
  return goals.items.filter(g => g.yearId === selectedYear.value.id)
})

const projectsForYear = computed(() => {
  const gids = new Set(goalsForYear.value.map(g => g.id))
  return projects.items.filter(p => gids.has(p.goalId))
})

const activeProjects = computed(() => projectsForYear.value.filter(p => p.status === 'active' || !p.status))
const completedProjects = computed(() => projectsForYear.value.filter(p => p.status === 'completed'))

const tasksStats = computed(() => {
  const pids = new Set(projectsForYear.value.map(p => p.id))
  const relevantTasks = tasks.items.filter(t => pids.has(t.projectId))
  const done = relevantTasks.filter(t => t.status === 'done').length
  const open = relevantTasks.filter(t => t.status === 'open').length
  return { total: relevantTasks.length, done, open, pct: relevantTasks.length ? Math.round((done / relevantTasks.length) * 100) : 0 }
})

function getLinkedProjects(goalId) {
  return projects.items.filter(p => p.goalId === goalId && p.status !== 'archived')
}

// ───── Yearly Finance Summary
const yearlyFinanceSummary = computed(() => {
  if (!selectedYear.value) return null
  const yStr = String(selectedYear.value.year)
  const periods = finance.cashflowPeriods.filter(p => p.month.startsWith(`${yStr}-`))

  if (!periods.length) return null

  let totalIncome = 0
  let totalExpense = 0
  let totalInvestment = 0

  periods.forEach(p => {
    const t = finance.periodTotals(p)
    totalIncome += t.income
    totalExpense += t.expense
    totalInvestment += t.investment
  })

  const mCount = periods.length
  const avgIncome = totalIncome / mCount
  const avgExpense = totalExpense / mCount
  const avgInvested = totalInvestment / mCount
  const savingsRate = totalIncome > 0 ? ((totalIncome - totalExpense) / totalIncome) * 100 : 0

  return {
    mCount,
    totalIncome,
    totalExpense,
    totalInvestment,
    avgIncome,
    avgExpense,
    avgInvested,
    savingsRate
  }
})

const yearlyExpenseBreakdown = computed(() => {
  if (!selectedYear.value) return []
  const yStr = String(selectedYear.value.year)
  const periods = finance.cashflowPeriods.filter(p => p.month.startsWith(`${yStr}-`))

  if (!periods.length) return []

  const map = {}
  periods.forEach(p => {
    (p.entries || []).filter(e => e.type === 'expense').forEach(e => {
      map[e.category] = (map[e.category] || 0) + +e.value
    })
  })

  const total = Object.values(map).reduce((s, v) => s + v, 0) || 1
  return Object.entries(map).map(([k, v]) => ({
    key: k,
    value: v,
    pct: (v / total) * 100
  })).sort((a, b) => b.value - a.value)
})

// ───── Finance Charts Option Mapping
const chartOptions = computed(() => {
  const opts = [
    { key: 'net_worth', label: 'Net Worth (Snapshots)' },
    { key: 'total_investments', label: 'Total Investments (Cash Flow)' }
  ]

  // Add net worth categories
  const nwCats = new Set()
  finance.networthLogs.forEach(log => {
    (log.entries || []).forEach(e => nwCats.add(e.category))
  })
  Array.from(nwCats).sort().forEach(cat => {
    opts.push({ key: `nw_cat_${cat}`, label: `Net Worth Asset · ${cat.replace(/_/g, ' ')}` })
  })

  // Add cashflow categories
  const cfCats = new Set()
  finance.cashflowPeriods.forEach(p => {
    (p.entries || []).forEach(e => cfCats.add(e.category))
  })
  Array.from(cfCats).sort().forEach(cat => {
    opts.push({ key: `cf_cat_${cat}`, label: `Cash Flow Category · ${cat.replace(/_/g, ' ')}` })
  })

  return opts
})

const chartData = computed(() => {
  const opt = selectedCategory.value

  if (opt === 'net_worth') {
    return finance.networthSeries
      .map(s => ({ label: formatLogDate(s.date), value: s.value }))
  }

  if (opt === 'total_investments') {
    return finance.cashflowSeries
      .map(s => ({ label: formatMonth(s.month), value: s.investment }))
  }

  if (opt.startsWith('nw_cat_')) {
    const cat = opt.replace('nw_cat_', '')
    return [...finance.networthLogs].reverse().map(log => {
      const entry = (log.entries || []).find(e => e.category === cat)
      return {
        label: formatLogDate(log.date),
        value: entry ? +entry.value : 0
      }
    })
  }

  if (opt.startsWith('cf_cat_')) {
    const cat = opt.replace('cf_cat_', '')
    return [...finance.cashflowPeriods].reverse().map(p => {
      const entries = (p.entries || []).filter(e => e.category === cat)
      const total = entries.reduce((s, e) => s + +e.value, 0)
      return {
        label: formatMonth(p.month),
        value: total
      }
    })
  }

  return []
})

// ───── Year-on-Year Progression Analytics
const yoyProgression = computed(() => {
  // Sort years ascending for chronological progression
  const sortedYears = [...years.items].sort((a, b) => a.year - b.year)

  return sortedYears.map(y => {
    const yStr = String(y.year)

    // Goals & Projects
    const yearGoals = goals.items.filter(g => g.yearId === y.id)
    const gids = new Set(yearGoals.map(g => g.id))
    const yearProjects = projects.items.filter(p => gids.has(p.goalId))
    const completedProj = yearProjects.filter(p => p.status === 'completed').length

    // Tasks stats
    const pids = new Set(yearProjects.map(p => p.id))
    const yearTasks = tasks.items.filter(t => pids.has(t.projectId))
    const doneTasks = yearTasks.filter(t => t.status === 'done').length

    // Finance - Ending Net Worth (latest log in that year)
    const nwLogsThisYear = finance.networthLogs.filter(log => log.date.startsWith(`${yStr}-`))
    let endingNetWorth = 0
    if (nwLogsThisYear.length) {
      // Net worth logs are sorted DESC by date, so index 0 is latest
      endingNetWorth = finance.logTotal(nwLogsThisYear[0])
    } else {
      // Carry over from previous logs if none logged in this year
      const precedingLogs = finance.networthLogs.filter(log => log.date < `${yStr}-01-01`)
      if (precedingLogs.length) {
        endingNetWorth = finance.logTotal(precedingLogs[0])
      }
    }

    // Finance - Annual cashflow totals
    const cfPeriodsThisYear = finance.cashflowPeriods.filter(p => p.month.startsWith(`${yStr}-`))
    let annualIncome = 0
    let annualExpense = 0
    let annualInvested = 0

    cfPeriodsThisYear.forEach(p => {
      const t = finance.periodTotals(p)
      annualIncome += t.income
      annualExpense += t.expense
      annualInvested += t.investment
    })

    const savingsRate = annualIncome > 0 ? ((annualIncome - annualExpense) / annualIncome) * 100 : 0

    return {
      id: y.id,
      year: y.year,
      theme: y.theme,
      goalsCount: yearGoals.length,
      projectsCount: yearProjects.length,
      projectsCompleted: completedProj,
      tasksTotal: yearTasks.length,
      tasksCompleted: doneTasks,
      endingNetWorth,
      annualIncome,
      annualExpense,
      annualInvested,
      savingsRate
    }
  })
})

const yoyNetWorthChartData = computed(() => {
  return yoyProgression.value.map(y => ({
    label: String(y.year),
    value: y.endingNetWorth
  }))
})

const yoyInvestmentsChartData = computed(() => {
  return yoyProgression.value.map(y => ({
    label: String(y.year),
    value: y.annualInvested
  }))
})

// ───── Year-on-Year Progression By Scope/Group/Name
const selectedYoyChart = ref('all_scopes')

const yoyChartOptions = computed(() => {
  const scopeOrder = ['asset', 'liability', 'income', 'investment', 'expense']
  const scopeLabels = {
    asset: 'Asset',
    liability: 'Liability',
    income: 'Income',
    investment: 'Investment',
    expense: 'Expense'
  }
  const totalLabels = {
    asset: 'Total Assets',
    liability: 'Total Liabilities',
    income: 'Total Income',
    investment: 'Total Investments',
    expense: 'Total Expenses'
  }

  const opts = [
    { key: 'all_scopes', label: 'All Scopes' },
    { isSeparator: true, key: 'sep_1' }
  ]

  // Totals
  scopeOrder.forEach(scope => {
    opts.push({ key: `scope_${scope}`, label: totalLabels[scope] })
  })

  opts.push({ isSeparator: true, key: 'sep_2' })

  // Types (Groups)
  const mapGroups = {}
  finance.categories.forEach(c => {
    if (c.group) {
      const key = `group_${c.scope}_${c.group}`
      mapGroups[key] = { scope: c.scope, group: c.group }
    }
  })
  scopeOrder.forEach(scope => {
    const scopeGroups = Object.values(mapGroups)
      .filter(g => g.scope === scope)
      .sort((a, b) => a.group.localeCompare(b.group))
    scopeGroups.forEach(g => {
      opts.push({ key: `group_${g.scope}_${g.group}`, label: `${scopeLabels[scope]} Type · ${g.group}` })
    })
  })

  opts.push({ isSeparator: true, key: 'sep_3' })

  // Categories
  scopeOrder.forEach(scope => {
    const scopeCats = finance.categories
      .filter(c => c.scope === scope)
      .sort((a, b) => a.name.localeCompare(b.name))
    scopeCats.forEach(c => {
      opts.push({ key: `name_${c.scope}_${c.name}`, label: `${scopeLabels[scope]} Category · ${c.name.replace(/_/g, ' ')}` })
    })
  })

  return opts
})

const yoyChartSeries = computed(() => {
  const activeKey = selectedYoyChart.value
  const opt = yoyChartOptions.value.find(o => o.key === activeKey) || yoyChartOptions.value[0]
  const sortedYears = [...years.items].sort((a, b) => a.year - b.year)

  if (activeKey === 'all_scopes') {
    const colors = { asset: '#5A7353', liability: '#A94A4A', income: '#4A8BA9', expense: '#C48A5E', investment: '#8F77B0' }
    const labels = { asset: 'Total Assets', liability: 'Total Liabilities', income: 'Total Income', expense: 'Total Expense', investment: 'Total Investment' }

    return ['asset', 'liability', 'income', 'expense', 'investment'].map(scope => {
      const data = sortedYears.map(y => {
        const yStr = String(y.year)
        let total = 0
        if (scope === 'asset' || scope === 'liability') {
          const nwLogsThisYear = finance.networthLogs.filter(log => log.date.startsWith(`${yStr}-`))
          let log = nwLogsThisYear.length ? nwLogsThisYear[0] : finance.networthLogs.filter(l => l.date < `${yStr}-01-01`)[0]
          if (log) {
            (log.entries || []).filter(e => e.type === scope).forEach(e => total += +e.value)
          }
        } else {
          const cfPeriodsThisYear = finance.cashflowPeriods.filter(p => p.month.startsWith(`${yStr}-`))
          cfPeriodsThisYear.forEach(p => {
            (p.entries || []).filter(e => e.type === scope).forEach(e => total += +e.value)
          })
        }
        return { label: String(y.year), value: total }
      })
      return { name: labels[scope], color: colors[scope], data }
    })
  }

  const parts = activeKey.split('_')
  const typeFilter = parts[0] // 'scope', 'group', or 'name'
  const scopeFilter = parts[1] // 'asset', 'expense', etc.

  let groupCats = new Set()
  if (typeFilter === 'group') {
    const groupFilter = parts[2]
    finance.categories.filter(c => c.scope === scopeFilter && c.group === groupFilter).forEach(c => groupCats.add(c.name))
  }
  let nameFilter = null
  if (typeFilter === 'name') {
    nameFilter = parts.slice(2).join('_')
  }

  const data = sortedYears.map(y => {
    const yStr = String(y.year)
    let total = 0
    if (scopeFilter === 'asset' || scopeFilter === 'liability') {
      const nwLogsThisYear = finance.networthLogs.filter(log => log.date.startsWith(`${yStr}-`))
      let log = nwLogsThisYear.length ? nwLogsThisYear[0] : finance.networthLogs.filter(l => l.date < `${yStr}-01-01`)[0]
      if (log) {
        (log.entries || []).filter(e => e.type === scopeFilter).forEach(e => {
          let include = false
          if (typeFilter === 'scope') include = true
          else if (typeFilter === 'name') include = (e.category === nameFilter)
          else if (typeFilter === 'group') include = groupCats.has(e.category)
          if (include) total += +e.value
        })
      }
    } else {
      const cfPeriodsThisYear = finance.cashflowPeriods.filter(p => p.month.startsWith(`${yStr}-`))
      cfPeriodsThisYear.forEach(p => {
        (p.entries || []).filter(e => e.type === scopeFilter).forEach(e => {
          let include = false
          if (typeFilter === 'scope') include = true
          else if (typeFilter === 'name') include = (e.category === nameFilter)
          else if (typeFilter === 'group') include = groupCats.has(e.category)
          if (include) total += +e.value
        })
      })
    }
    return { label: String(y.year), value: total }
  })

  return [{ name: opt.label, color: '#916B64', data }]
})

// Date/Format helpers
function formatMonth(m) {
  if (!m) return ''
  const [y, mo] = m.split('-')
  const d = new Date(+y, +mo - 1, 1)
  return d.toLocaleString('en-IN', { month: 'short', year: 'numeric' })
}

function formatLogDate(dStr) {
  if (!dStr) return ''
  const d = new Date(dStr)
  return d.toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}
</script>

<template>
  <div class="px-8 md:px-12 py-10 max-w-6xl mx-auto animate-fade-in" data-testid="summary-view">
    <PageHeader overline="Horizon" title="Yearly Summary"
      sub="A full, quiet view of your goals, projects, and money dynamics.">
      <template #right>
        <!-- Tab Toggle -->
        <div class="flex bg-elevated rounded-xl p-1 border border-line text-xs">
          <button @click="activeTab = 'yearly'" class="px-3 py-1.5 rounded-lg transition-colors duration-200"
            :class="activeTab === 'yearly' ? 'bg-surface text-ink font-medium shadow-sm' : 'text-ink-2 hover:text-ink'">
            Yearly Focus
          </button>
          <button @click="activeTab = 'yoy'" class="px-3 py-1.5 rounded-lg transition-colors duration-200"
            :class="activeTab === 'yoy' ? 'bg-surface text-ink font-medium shadow-sm' : 'text-ink-2 hover:text-ink'"
            data-testid="summary-tab-yoy">
            Year-on-Year
          </button>
        </div>
      </template>
    </PageHeader>

    <!-- TAB 1: YEARLY FOCUS -->
    <template v-if="activeTab === 'yearly'">
      <div class="flex items-center justify-end mb-6" v-if="years.items.length">
        <div class="flex items-center gap-2">
          <Calendar class="w-3.5 h-3.5 text-ink-3" />
          <span class="overline text-[10px]">Active Year</span>
          <select v-model="activeYearId"
            class="bg-surface border border-line rounded-xl px-3 py-1.5 text-xs outline-none focus:border-line-2 font-serif"
            data-testid="summary-year-select">
            <option v-for="y in [...years.items].sort((a, b) => b.year - a.year)" :key="y.id" :value="y.id">{{ y.year }}
            </option>
          </select>
        </div>
      </div>

      <template v-if="selectedYear">
        <!-- Year Theme Callout -->
        <div class="card p-7 mb-10 bg-elevated/40 border border-line flex items-center justify-between gap-6"
          data-testid="summary-year-card">
          <div>
            <span class="overline">Yearly Theme</span>
            <h2 class="font-serif text-3xl text-ink mt-1.5 leading-snug">{{ selectedYear.theme || `A Year of Quiet
              Action.` }}</h2>
          </div>
          <Sparkles class="w-10 h-10 text-ink-3/30 shrink-0" />
        </div>

        <!-- Core Statistics Bento Grid -->
        <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
          <div class="card p-6" data-testid="summary-stat-goals">
            <div class="overline flex items-center gap-2">
              <Target class="w-3.5 h-3.5" /> Horizon Goals
            </div>
            <div class="font-serif text-4xl mt-3">{{ goalsForYear.length }}</div>
            <p class="text-xs text-ink-3 mt-2">Set in years timeline</p>
          </div>
          <div class="card p-6" data-testid="summary-stat-projects">
            <div class="overline flex items-center gap-2">
              <FolderKanban class="w-3.5 h-3.5" /> Projects
            </div>
            <div class="font-serif text-4xl mt-3">{{ activeProjects.length + completedProjects.length }}</div>
            <p class="text-xs text-ink-3 mt-2">{{ activeProjects.length }} active · {{ completedProjects.length }}
              completed</p>
          </div>
          <div class="card p-6" data-testid="summary-stat-tasks">
            <div class="overline flex items-center gap-2">
              <CheckSquare class="w-3.5 h-3.5" /> Action Tasks
            </div>
            <div class="font-serif text-4xl mt-3">{{ tasksStats.done }} / {{ tasksStats.total }}</div>
            <p class="text-xs text-ink-3 mt-2">{{ tasksStats.pct }}% completed</p>
            <div class="mt-4 h-1.5 rounded-full bg-elevated overflow-hidden">
              <div class="h-full bg-ink rounded-full transition-all duration-700"
                :style="{ width: tasksStats.pct + '%' }"></div>
            </div>
          </div>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-10">
          <!-- Goal Tracking Details -->
          <div class="lg:col-span-2 space-y-6">
            <SectionHeader overline="Timeline" title="Goals & connected projects" />
            <div v-if="goalsForYear.length" class="space-y-4" data-testid="summary-goals-list">
              <div v-for="g in goalsForYear" :key="g.id" class="card p-5" :data-testid="`summary-goal-card-${g.id}`">
                <div class="font-serif text-xl text-ink">{{ g.title }}</div>
                <p class="text-sm text-ink-2 mt-1">{{ g.description }}</p>

                <div class="mt-4 pt-3 border-t border-line/60">
                  <span class="overline text-[10px] block mb-2">Connected projects</span>
                  <div v-if="getLinkedProjects(g.id).length" class="space-y-2">
                    <div v-for="p in getLinkedProjects(g.id)" :key="p.id"
                      class="flex items-center justify-between text-xs p-2 rounded-lg bg-elevated/40">
                      <span class="font-medium text-ink">{{ p.title }}</span>
                      <span
                        class="text-ink-3 uppercase text-[9px] tracking-wider bg-surface border border-line px-2 py-0.5 rounded-full">{{
                          p.status || 'active' }}</span>
                    </div>
                  </div>
                  <span v-else class="text-xs text-ink-3 italic">No active projects connected yet.</span>
                </div>
              </div>
            </div>
            <EmptyState v-else title="No goals for this year" hint="Setting a goal helps you focus." />
          </div>

          <!-- Yearly Financial Summary -->
          <div class="space-y-6">
            <SectionHeader overline="Finance" title="Yearly Summary" />
            <div v-if="yearlyFinanceSummary" class="card p-6 space-y-4" data-testid="summary-finance-yearly">
              <div class="overline border-b border-line pb-2 mb-2">Logs for {{ selectedYear.year }} ({{
                yearlyFinanceSummary.mCount }} months)</div>

              <div class="space-y-3">
                <div>
                  <span class="overline text-[10px]">Total Income</span>
                  <div class="font-serif text-2xl text-pri-strategic mt-0.5">{{ inr(yearlyFinanceSummary.totalIncome) }}
                  </div>
                </div>
                <div>
                  <span class="overline text-[10px]">Total Expenses</span>
                  <div class="font-serif text-2xl text-pri-critical mt-0.5">{{ inr(yearlyFinanceSummary.totalExpense) }}
                  </div>
                </div>
                <div>
                  <span class="overline text-[10px]">Total Invested</span>
                  <div class="font-serif text-2xl text-pri-interruptive mt-0.5">{{
                    inr(yearlyFinanceSummary.totalInvestment) }}</div>
                </div>
                <div class="pt-2 border-t border-line">
                  <span class="overline text-[10px]">Avg. Monthly Savings Rate</span>
                  <div class="font-serif text-lg mt-0.5 text-ink font-semibold">
                    {{ yearlyFinanceSummary.savingsRate.toFixed(1) }}%
                  </div>
                </div>
              </div>

              <div class="pt-4 border-t border-line text-[11px] text-ink-3 space-y-1 font-mono">
                <div class="flex justify-between"><span>Avg. Income</span><span>{{
                  inrCompact(yearlyFinanceSummary.avgIncome) }}/mo</span></div>
                <div class="flex justify-between"><span>Avg. Expense</span><span>{{
                  inrCompact(yearlyFinanceSummary.avgExpense) }}/mo</span></div>
                <div class="flex justify-between"><span>Avg. Invested</span><span>{{
                  inrCompact(yearlyFinanceSummary.avgInvested) }}/mo</span></div>
              </div>
            </div>
            <div v-else class="card p-6 text-center text-ink-3 italic font-serif text-sm">
              No cashflow periods logged for year {{ selectedYear.year }} yet.
            </div>

            <!-- Yearly Expense breakdown -->
            <div v-if="yearlyFinanceSummary && yearlyExpenseBreakdown.length" class="mt-6 pt-4 border-t border-line"
              data-testid="summary-yearly-expenses">
              <span class="overline text-[10px] block mb-3">Yearly expense breakdown</span>
              <div class="space-y-3">
                <div v-for="a in yearlyExpenseBreakdown" :key="a.key">
                  <div class="flex items-baseline justify-between text-xs mb-1 font-mono">
                    <span class="capitalize text-ink-2">{{ a.key.replace(/_/g, ' ') }}</span>
                    <span class="text-ink font-medium">{{ inrCompact(a.value) }} · {{ a.pct.toFixed(0) }}%</span>
                  </div>
                  <div class="h-1.5 rounded-full bg-elevated overflow-hidden">
                    <div class="h-full bg-pri-critical/70 rounded-full transition-all duration-700"
                      :style="{ width: a.pct + '%' }"></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Financial Progress Charts -->
        <section class="mb-10">
          <div class="flex items-center justify-between gap-6 mb-6 flex-wrap">
            <SectionHeader overline="Dynamics" title="Financial Progression" />
            <div class="flex items-center gap-2">
              <span class="overline text-[10px]">Select Category</span>
              <select v-model="selectedCategory"
                class="bg-surface border border-line rounded-xl px-3 py-1.5 text-xs outline-none focus:border-line-2 font-serif"
                data-testid="summary-chart-select">
                <option v-for="opt in chartOptions" :key="opt.key" :value="opt.key">{{ opt.label }}</option>
              </select>
            </div>
          </div>

          <div class="card p-6" data-testid="summary-chart-container">
            <InteractiveChart :data="chartData" color="#5A7353" />
          </div>
        </section>
      </template>
      <EmptyState v-else title="No years configured" hint="Create your first year inside the Years timeline." />
    </template>

    <!-- TAB 2: YEAR-ON-YEAR PROGRESSION -->
    <template v-else-if="activeTab === 'yoy'">
      <div v-if="yoyProgression.length" class="space-y-10">

        <!-- YoY Progression Cards stack -->
        <section>
          <SectionHeader overline="Timeline" title="Multi-Year Progression"
            hint="Compare metrics and financial growth across all years in Atrium." />
          <div class="grid grid-cols-1 md:grid-cols-2 gap-6" data-testid="summary-yoy-grid">
            <div v-for="y in yoyProgression" :key="y.id"
              class="card p-6 flex flex-col hover:border-line-2 transition-all duration-300"
              :data-testid="`summary-yoy-card-${y.year}`">
              <div class="flex items-baseline justify-between mb-4 border-b border-line pb-2">
                <div class="font-serif text-4xl text-ink font-semibold">{{ y.year }}</div>
                <div class="text-xs text-ink-3 italic truncate max-w-[200px]" :title="y.theme">{{ y.theme || '—' }}
                </div>
              </div>

              <!-- Metrics grid -->
              <div class="grid grid-cols-3 gap-2 text-center text-sm mb-6">
                <div class="p-2 rounded-xl bg-elevated/40">
                  <div class="overline text-[9px]">Goals</div>
                  <div class="font-serif text-lg font-medium text-ink mt-0.5">{{ y.goalsCount }}</div>
                </div>
                <div class="p-2 rounded-xl bg-elevated/40">
                  <div class="overline text-[9px]">Projects</div>
                  <div class="font-serif text-lg font-medium text-ink mt-0.5">{{ y.projectsCompleted }}/{{
                    y.projectsCount }}</div>
                </div>
                <div class="p-2 rounded-xl bg-elevated/40">
                  <div class="overline text-[9px]">Tasks Done</div>
                  <div class="font-serif text-lg font-medium text-ink mt-0.5">{{ y.tasksCompleted }}</div>
                </div>
              </div>

              <!-- Finance metrics -->
              <div class="space-y-2.5 text-xs">
                <div class="flex justify-between items-baseline">
                  <span class="text-ink-2">Ending Net Worth</span>
                  <span class="font-mono font-medium text-ink">{{ inr(y.endingNetWorth) }}</span>
                </div>
                <div class="flex justify-between items-baseline">
                  <span class="text-ink-2">Annual Investments</span>
                  <span class="font-mono font-medium text-pri-interruptive">{{ inr(y.annualInvested) }}</span>
                </div>
                <div class="flex justify-between items-baseline">
                  <span class="text-ink-2">Annual Income / Outgo</span>
                  <span class="font-mono text-ink-3">{{ inrCompact(y.annualIncome) }} / {{ inrCompact(y.annualExpense)
                  }}</span>
                </div>
                <div class="flex justify-between items-baseline pt-2 border-t border-line/40">
                  <span class="text-ink-2">Annual Savings Rate</span>
                  <span class="font-serif font-medium text-pri-strategic text-sm">{{ y.savingsRate.toFixed(1) }}%</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <!-- YoY long term charts -->
        <section class="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div>
            <SectionHeader overline="Long-term growth" title="Ending Net Worth"
              hint="Net worth snapshot at the close of each year." />
            <div class="card p-6 mt-4">
              <InteractiveChart :data="yoyNetWorthChartData" color="#5A7353" />
            </div>
          </div>
          <div>
            <SectionHeader overline="Long-term saving" title="Annual Investments"
              hint="Sum of recurring and one-time investments per year." />
            <div class="card p-6 mt-4">
              <InteractiveChart :data="yoyInvestmentsChartData" color="#9E8457" />
            </div>
          </div>
        </section>

        <!-- YoY Custom charts -->
        <section class="mt-10 mb-10">
          <div class="flex items-center justify-between gap-6 mb-6 flex-wrap">
            <SectionHeader overline="Deep Dive" title="Category Progression"
              hint="Compare specific scopes, types, or categories across years." />
            <div class="flex items-center gap-2">
              <span class="overline text-[10px]">Select View</span>
              <Combobox :options="yoyChartOptions" v-model="selectedYoyChart" placeholder="Search metrics..." />
            </div>
          </div>
          <div class="card p-6" data-testid="summary-yoy-custom-chart">
            <InteractiveChart :series="yoyChartSeries" />
          </div>
        </section>
      </div>
      <EmptyState v-else title="No years configured" hint="Create your first year inside the Years timeline." />
    </template>
  </div>
</template>
