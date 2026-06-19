<script setup>
import { computed, ref } from 'vue'
import { useFinanceStore } from '@/stores/finance'
import { useSettingsStore } from '@/stores/settings'
import SectionHeader from '@/components/SectionHeader.vue'
import { inr, inrCompact } from '@/lib/money'
import { ChevronDown, ChevronRight, Check, TrendingUp, Wallet, Scale } from 'lucide-vue-next'

const collapsedSubgroups = ref({})

function isSubgroupCollapsed(scope, name) {
  const key = `${scope}::${name}`
  return collapsedSubgroups.value[key] !== false // collapsed by default
}

function toggleSubgroup(scope, name) {
  const key = `${scope}::${name}`
  collapsedSubgroups.value[key] = !isSubgroupCollapsed(scope, name)
}

const finance = useFinanceStore()
const settings = useSettingsStore()

const startMonth = computed({
  get: () => settings.get('financeStartMonth', '01'),
  set: (val) => settings.set('financeStartMonth', val)
})

const selectedSummaryYear = ref(new Date().getFullYear())

const budgetYears = computed(() => {
  const yearsSet = new Set()
  const current = new Date().getFullYear()
  yearsSet.add(current - 1)
  yearsSet.add(current)
  yearsSet.add(current + 1)

  finance.cashflowPeriods.forEach(p => {
    if (p.month) {
      const y = parseInt(p.month.split('-')[0])
      if (y) yearsSet.add(y)
    }
  })

  finance.networthLogs.forEach(l => {
    if (l.date) {
      const y = parseInt(l.date.split('-')[0])
      if (y) yearsSet.add(y)
    }
  })

  return Array.from(yearsSet).sort((a, b) => b - a)
})

function getYearMonths(year, startMonthNum) {
  const months = []
  let currentYear = year
  let currentMonth = startMonthNum
  for (let i = 0; i < 12; i++) {
    const yStr = String(currentYear)
    const mStr = String(currentMonth).padStart(2, '0')
    months.push({
      key: `${yStr}-${mStr}`,
      monthName: new Date(currentYear, currentMonth - 1, 1).toLocaleString('en-IN', { month: 'short' }),
      year: currentYear,
      monthNum: currentMonth
    })
    currentMonth++
    if (currentMonth > 12) {
      currentMonth = 1
      currentYear++
    }
  }
  return months
}

const summaryMonths = computed(() => {
  return getYearMonths(selectedSummaryYear.value, parseInt(startMonth.value))
})

const networthSummaryMonths = computed(() => {
  const allMonths = summaryMonths.value
  const targetMonthsKeys = allMonths.map(m => m.key)
  const logs = finance.networthLogs.filter(l => l.date && targetMonthsKeys.includes(l.date.slice(0, 7)))
  const loggedMonthsKeys = new Set(logs.map(l => l.date.slice(0, 7)))
  return allMonths.filter(m => loggedMonthsKeys.has(m.key))
})

const elapsedMonthsCount = computed(() => {
  const targetMonthsKeys = summaryMonths.value.map(m => m.key)
  const loggedKeys = new Set(finance.cashflowPeriods.map(p => p.month))
  return targetMonthsKeys.filter(key => loggedKeys.has(key)).length
})

function diffClass(val, scope) {
  if (!val) return 'text-ink-3 font-mono'
  const isGood = (scope === 'income' || scope === 'investment' || scope === 'asset') ? val >= 0 : val <= 0
  return isGood ? 'text-pri-strategic font-mono font-medium' : 'text-pri-critical font-mono font-medium'
}

function formatPctDiff(val) {
  if (val === null || val === undefined || isNaN(val)) return '—'
  if (val === 0) return '0%'
  const prefix = val > 0 ? '+' : ''
  return prefix + val.toFixed(1) + '%'
}

function prBudTooltip(row) {
  if (!row.budget) return 'No budget set for this category'
  return `Actual YTD: ${inr(row.proratedTotal)} / Prorated Budget: ${inr(row.proratedBudget)} (Yearly Budget: ${inr(row.budget)})`
}

function prLyTooltip(row) {
  if (!row.lastYearProrated) return `Actual YTD: ${inr(row.proratedTotal)} / Last Year corresponding period had no data`
  return `Actual YTD: ${inr(row.proratedTotal)} / Prorated Last Year: ${inr(row.lastYearProrated)} (Last Year Total: ${inr(row.lastYearTotal)})`
}

function groupPrBudTooltip(group) {
  if (!group.grandBudget) return 'No budget set for categories in this group'
  return `Actual YTD: ${inr(group.grandProratedTotal)} / Prorated Budget: ${inr(group.grandProratedBudget)} (Yearly Budget: ${inr(group.grandBudget)})`
}

function groupPrLyTooltip(group) {
  if (!group.grandLastYearProrated) return `Actual YTD: ${inr(group.grandProratedTotal)} / Last Year corresponding period had no data`
  return `Actual YTD: ${inr(group.grandProratedTotal)} / Prorated Last Year: ${inr(group.grandLastYearProrated)} (Last Year Total: ${inr(group.grandLastYearTotal)})`
}

const cashflowMatrix = computed(() => {
  const targetMonths = summaryMonths.value
  const targetMonthsKeys = targetMonths.map(m => m.key)
  const periods = finance.cashflowPeriods.filter(p => targetMonthsKeys.includes(p.month))

  const monthPeriods = {}
  periods.forEach(p => {
    monthPeriods[p.month] = p
  })

  // Cache last year's periods
  const lastYearMonths = getYearMonths(selectedSummaryYear.value - 1, parseInt(startMonth.value))
  const lastYearMonthsKeys = lastYearMonths.map(m => m.key)
  const lyPeriods = finance.cashflowPeriods.filter(p => lastYearMonthsKeys.includes(p.month))
  const lyMonthPeriods = {}
  lyPeriods.forEach(p => {
    lyMonthPeriods[p.month] = p
  })

  const cfScopes = ['income', 'investment', 'expense']
  const cfCategories = finance.categories.filter(c => cfScopes.includes(c.scope) && !c.archived)

  const groups = { income: [], expense: [], investment: [] }

  cfCategories.forEach(cat => {
    const monthsData = Array(12).fill(0)
    let total = 0

    for (let i = 0; i < 12; i++) {
      const monthKey = targetMonths[i].key
      const p = monthPeriods[monthKey]
      if (p && p.entries) {
        const entry = p.entries.find(e => e.category === cat.name && e.type === cat.scope)
        if (entry) {
          monthsData[i] = +entry.value || 0
          total += monthsData[i]
        }
      }
    }

    // Last year calculations
    let lastYearTotal = 0
    let lastYearProrated = 0
    for (let i = 0; i < 12; i++) {
      const monthKey = lastYearMonths[i].key
      const p = lyMonthPeriods[monthKey]
      if (p && p.entries) {
        const entry = p.entries.find(e => e.category === cat.name && e.type === cat.scope)
        if (entry) {
          const val = +entry.value || 0
          lastYearTotal += val
          if (i < elapsedMonthsCount.value) {
            lastYearProrated += val
          }
        }
      }
    }

    groups[cat.scope].push({
      category: cat,
      months: monthsData,
      total,
      lastYearTotal,
      lastYearProrated
    })
  })

  const scopeLabels = {
    income: 'Income',
    expense: 'Expenses',
    investment: 'Investments'
  }

  const groupOrder = {
    income: ['Active', 'Passive', 'One-Off'],
    investment: ['Equity', 'Debt', 'Debt/Other', 'Bullion', 'Real Estate', 'Illiquid'],
    expense: ['Need', 'Want', 'Business']
  }

  return cfScopes.map(s => {
    const rows = groups[s]
    const colTotals = Array(12).fill(0)
    let grandTotal = 0
    let grandBudget = 0
    let grandLastYearTotal = 0
    let grandProratedBudget = 0
    let grandLastYearProrated = 0
    let grandProratedTotal = 0

    const rowsData = rows.map(r => {
      const budget = r.category.budgets?.[selectedSummaryYear.value] || (selectedSummaryYear.value === new Date().getFullYear() ? (r.category.yearlyBudget || 0) : 0)
      const proratedBudget = budget * (elapsedMonthsCount.value / 12)
      const proratedTotal = r.months.slice(0, elapsedMonthsCount.value).reduce((sum, v) => sum + v, 0)

      grandBudget += budget
      grandProratedBudget += proratedBudget
      grandLastYearTotal += r.lastYearTotal
      grandLastYearProrated += r.lastYearProrated
      grandProratedTotal += proratedTotal

      return {
        ...r,
        budget,
        proratedBudget,
        proratedTotal,
        vsProratedBudgetPct: proratedBudget > 0 ? ((proratedTotal - proratedBudget) / proratedBudget) * 100 : null,
        vsLastYearProratedPct: r.lastYearProrated > 0 ? ((proratedTotal - r.lastYearProrated) / r.lastYearProrated) * 100 : null
      }
    })

    rowsData.forEach(r => {
      r.months.forEach((val, m) => {
        colTotals[m] += val
      })
      grandTotal += r.total
    })

    // Group rows by category.group
    const order = groupOrder[s] || []
    const subGroupsMap = {}
    rowsData.forEach(r => {
      const gName = r.category.group || 'Other'
      if (!subGroupsMap[gName]) {
        subGroupsMap[gName] = []
      }
      subGroupsMap[gName].push(r)
    })

    const subGroups = Object.keys(subGroupsMap).map(gName => {
      const subgroupRows = subGroupsMap[gName].sort((a, b) => a.category.name.localeCompare(b.category.name))
      const months = Array(12).fill(0)
      let total = 0
      let budget = 0
      let proratedBudget = 0
      let proratedTotal = 0
      let lastYearTotal = 0
      let lastYearProrated = 0

      subgroupRows.forEach(r => {
        r.months.forEach((v, idx) => {
          months[idx] += v
        })
        total += r.total
        budget += r.budget
        proratedBudget += r.proratedBudget
        proratedTotal += r.proratedTotal
        lastYearTotal += r.lastYearTotal
        lastYearProrated += r.lastYearProrated
      })

      const vsProratedBudgetPct = proratedBudget > 0 ? ((proratedTotal - proratedBudget) / proratedBudget) * 100 : null
      const vsLastYearProratedPct = lastYearProrated > 0 ? ((proratedTotal - lastYearProrated) / lastYearProrated) * 100 : null

      return {
        name: gName,
        rows: subgroupRows,
        months,
        total,
        budget,
        proratedBudget,
        proratedTotal,
        lastYearTotal,
        lastYearProrated,
        vsProratedBudgetPct,
        vsLastYearProratedPct
      }
    }).sort((a, b) => {
      const idxA = order.indexOf(a.name)
      const idxB = order.indexOf(b.name)
      if (idxA !== -1 && idxB !== -1) return idxA - idxB
      if (idxA !== -1) return -1
      if (idxB !== -1) return 1
      return a.name.localeCompare(b.name)
    })

    return {
      scope: s,
      label: scopeLabels[s],
      subGroups,
      colTotals,
      grandTotal,
      grandBudget,
      grandLastYearTotal,
      grandProratedBudget,
      grandLastYearProrated,
      grandProratedTotal,
      grandVsProratedBudgetPct: grandProratedBudget > 0 ? ((grandProratedTotal - grandProratedBudget) / grandProratedBudget) * 100 : null,
      grandVsLastYearProratedPct: grandLastYearProrated > 0 ? ((grandProratedTotal - grandLastYearProrated) / grandLastYearProrated) * 100 : null
    }
  }).filter(g => g.subGroups.length > 0)
})

const cashflowGrandTotals = computed(() => {
  const matrix = cashflowMatrix.value
  const incomeGroup = matrix.find(g => g.scope === 'income')
  const expenseGroup = matrix.find(g => g.scope === 'expense')
  const investGroup = matrix.find(g => g.scope === 'investment')

  const incomeTotals = incomeGroup ? incomeGroup.colTotals : Array(12).fill(0)
  const expenseTotals = expenseGroup ? expenseGroup.colTotals : Array(12).fill(0)
  const investTotals = investGroup ? investGroup.colTotals : Array(12).fill(0)

  const netTotals = Array(12).fill(0)
  const grandIncome = incomeGroup ? incomeGroup.grandTotal : 0
  const grandExpense = expenseGroup ? expenseGroup.grandTotal : 0
  const grandInvest = investGroup ? investGroup.grandTotal : 0
  const grandNet = grandIncome - grandExpense - grandInvest

  for (let i = 0; i < 12; i++) {
    netTotals[i] = incomeTotals[i] - expenseTotals[i] - investTotals[i]
  }

  return {
    net: netTotals,
    grandNet
  }
})


const networthMatrix = computed(() => {
  const targetMonths = networthSummaryMonths.value
  const targetMonthsKeys = targetMonths.map(m => m.key)
  const logs = finance.networthLogs.filter(l => l.date && targetMonthsKeys.includes(l.date.slice(0, 7)))

  const monthLogs = {}
  logs.forEach(l => {
    monthLogs[l.date.slice(0, 7)] = l
  })

  const nwScopes = ['asset', 'liability']
  const nwCategories = finance.categories.filter(c => nwScopes.includes(c.scope) && !c.archived)

  const groups = { asset: [], liability: [] }
  const monthsCount = targetMonths.length

  nwCategories.forEach(cat => {
    const monthsData = Array(monthsCount).fill(null)

    for (let i = 0; i < monthsCount; i++) {
      const monthKey = targetMonths[i].key
      const l = monthLogs[monthKey]
      if (l && l.entries) {
        const entry = l.entries.find(e => e.category === cat.name && e.type === cat.scope)
        if (entry) {
          monthsData[i] = +entry.value
        }
      }
    }

    groups[cat.scope].push({
      category: cat,
      months: monthsData
    })
  })

  const scopeLabels = {
    asset: 'Assets',
    liability: 'Liabilities'
  }

  const groupOrder = {
    asset: ['Liquid', 'Fixed'],
    liability: ['Short-term', 'Long-term']
  }

  return nwScopes.map(s => {
    const rows = groups[s]
    const colTotals = Array(monthsCount).fill(0)
    rows.forEach(r => {
      r.months.forEach((val, m) => {
        if (val !== null) colTotals[m] += val
      })
    })

    // Group rows by category.group
    const order = groupOrder[s] || []
    const subGroupsMap = {}
    rows.forEach(r => {
      const gName = r.category.group || 'Other'
      if (!subGroupsMap[gName]) {
        subGroupsMap[gName] = []
      }
      subGroupsMap[gName].push(r)
    })

    const subGroups = Object.keys(subGroupsMap).map(gName => {
      const subgroupRows = subGroupsMap[gName].sort((a, b) => a.category.name.localeCompare(b.category.name))
      const months = Array(monthsCount).fill(null)
      subgroupRows.forEach(r => {
        r.months.forEach((v, idx) => {
          if (v !== null) {
            if (months[idx] === null) months[idx] = 0
            months[idx] += v
          }
        })
      })
      return {
        name: gName,
        rows: subgroupRows,
        months
      }
    }).sort((a, b) => {
      const idxA = order.indexOf(a.name)
      const idxB = order.indexOf(b.name)
      if (idxA !== -1 && idxB !== -1) return idxA - idxB
      if (idxA !== -1) return -1
      if (idxB !== -1) return 1
      return a.name.localeCompare(b.name)
    })

    return {
      scope: s,
      label: scopeLabels[s],
      subGroups,
      colTotals
    }
  }).filter(g => g.subGroups.length > 0)
})

const networthGrandTotals = computed(() => {
  const matrix = networthMatrix.value
  const assetsGroup = matrix.find(g => g.scope === 'asset')
  const liabsGroup = matrix.find(g => g.scope === 'liability')

  const targetMonths = networthSummaryMonths.value
  const monthsCount = targetMonths.length

  const assetsTotals = assetsGroup ? assetsGroup.colTotals : Array(monthsCount).fill(0)
  const liabsTotals = liabsGroup ? liabsGroup.colTotals : Array(monthsCount).fill(0)

  const targetMonthsKeys = targetMonths.map(m => m.key)
  const logs = finance.networthLogs.filter(l => l.date && targetMonthsKeys.includes(l.date.slice(0, 7)))
  const activeMonths = new Set(logs.map(l => l.date.slice(0, 7)))

  const netWorthTotals = Array(monthsCount).fill(null)
  for (let i = 0; i < monthsCount; i++) {
    const monthKey = targetMonths[i].key
    if (activeMonths.has(monthKey)) {
      netWorthTotals[i] = assetsTotals[i] - liabsTotals[i]
    }
  }

  return {
    assets: assetsTotals,
    liabilities: liabsTotals,
    netWorth: netWorthTotals
  }
})

function label(s) { return (s || '').replace(/_/g, ' ') }
</script>

<template>
  <div class="pt-2">
    <!-- Header Block conforming to the modern visual layout -->
    <div class="flex flex-col md:flex-row md:items-end justify-between mb-8 ml-1 gap-4 px-1 animate-fade-in">
      <div>
        <div class="overline text-[10px] text-ink-3 tracking-widest uppercase mb-1 font-sans">Annual Overview</div>
        <h2 class="font-serif text-3xl font-bold text-ink">Cash Flow Summary</h2>
      </div>
      <!-- Year Selector aligned right in a compact container -->
      <div
        class="flex items-center gap-2 bg-surface border border-line rounded-xl px-3 py-1.5 shadow-sm text-xs select-none">
        <span class="text-[10px] uppercase tracking-wider text-ink-3 font-semibold font-sans">Select Year</span>
        <select v-model="selectedSummaryYear"
          class="bg-transparent font-serif outline-none text-ink font-semibold cursor-pointer"
          data-testid="summary-year-select">
          <option v-for="y in budgetYears" :key="y" :value="y">{{ y }}</option>
        </select>
      </div>
    </div>

    <!-- CASHFLOW SUMMARY SECTION -->
    <div class="mb-6 animate-fade-in">
      <div class="overflow-x-auto w-full pb-4">
        <div class="w-max min-w-full flex flex-col gap-2 p-1">
          <!-- Table Columns Header Card -->
          <div class="card shadow-sm border border-line/60 rounded-2xl bg-surface select-none overflow-clip">
            <table class="w-[1500px] table-fixed text-xs text-left border-separate border-spacing-0">
              <colgroup>
                <col class="col-category" />
                <col v-for="m in summaryMonths" :key="m.key" class="col-month" />
                <col class="col-summary" v-for="i in 4" :key="i" />
              </colgroup>
              <thead>
                <tr class="text-ink-3 uppercase text-[10px] tracking-wider whitespace-nowrap">
                  <th
                    class="py-2.5 pl-4 pr-3 col-category sticky-col-header font-semibold text-ink-3 border-r border-line/40">
                    Category</th>
                  <th v-for="m in summaryMonths" :key="m.key"
                    class="py-2.5 text-right font-mono col-month px-2">
                    {{ m.monthName }}
                  </th>
                  <th class="py-2.5 text-right font-mono col-summary px-3 font-semibold text-ink-3">Total</th>
                  <th class="py-2.5 text-right font-mono col-summary px-3 font-semibold text-ink-3">Budget</th>
                  <th class="py-2.5 text-right font-mono col-summary px-3 font-semibold text-ink-3">vs PR Bud</th>
                  <th class="py-2.5 text-right font-mono col-summary px-3 font-semibold text-ink-3">vs PR LY</th>
                </tr>
              </thead>
            </table>
          </div>

          <!-- Cards Stack Container -->
          <div class="flex flex-col gap-5">
            <!-- Card Blocks for cash flow scopes -->
            <div v-for="group in cashflowMatrix" :key="group.scope" class="card shadow-sm border border-line/60 rounded-2xl bg-surface overflow-clip">
              <table class="w-[1500px] table-fixed text-xs text-left border-separate border-spacing-0">
                <colgroup>
                  <col class="col-category" />
                  <col v-for="m in summaryMonths" :key="m.key" class="col-month" />
                  <col class="col-summary" v-for="i in 4" :key="i" />
                </colgroup>
                <tbody>
                  <!-- Group Header Row -->
                  <tr class="group transition-colors" :class="{
                    'bg-emerald-500/5 text-emerald-700 dark:text-emerald-400 font-bold': group.scope === 'income',
                    'bg-rose-500/5 text-rose-700 dark:text-rose-400 font-bold': group.scope === 'expense',
                    'bg-blue-500/5 text-blue-700 dark:text-blue-400 font-bold': group.scope === 'investment'
                  }">
                    <td class="py-3 pl-4 pr-3 col-category sticky-col-cell border-r border-b border-line/40 select-none"
                      :class="{
                        'bg-sticky-income': group.scope === 'income',
                        'bg-sticky-investment': group.scope === 'investment',
                        'bg-sticky-expense': group.scope === 'expense'
                      }">
                      <span class="flex items-center gap-2">
                        <span v-if="group.scope === 'income'"
                          class="w-5 h-5 rounded-full bg-emerald-500/10 text-emerald-600 flex items-center justify-center shrink-0">
                          <Check class="w-3 h-3 stroke-[2.5]" />
                        </span>
                        <span v-else-if="group.scope === 'investment'"
                          class="w-5 h-5 rounded-full bg-blue-500/10 text-blue-600 flex items-center justify-center shrink-0">
                          <TrendingUp class="w-3 h-3 stroke-[2.5]" />
                        </span>
                        <span v-else-if="group.scope === 'expense'"
                          class="w-5 h-5 rounded-full bg-rose-500/10 text-rose-600 flex items-center justify-center shrink-0">
                          <Wallet class="w-3 h-3 stroke-[2.5]" />
                        </span>
                        <span class="text-xs font-bold uppercase tracking-wider">{{ group.label }}</span>
                      </span>
                    </td>
                    <td v-for="(val, idx) in group.colTotals" :key="idx"
                      class="py-3 text-right font-mono col-month px-2 text-xs border-b border-line/40">
                      {{ val !== 0 ? inrCompact(val) : '—' }}
                    </td>
                    <td
                      class="py-3 text-right font-mono col-summary px-3 text-xs font-bold border-b border-line/40">
                      {{ group.grandTotal !== 0 ? inrCompact(group.grandTotal) : '—' }}
                    </td>
                    <td class="py-3 text-right font-mono col-summary px-3 text-xs border-b border-line/40">
                      {{ group.grandBudget !== 0 ? inrCompact(group.grandBudget) : '—' }}
                    </td>
                    <td class="py-3 text-right font-mono col-summary px-3 text-xs border-b border-line/40"
                      :class="diffClass(group.grandVsProratedBudgetPct, group.scope)">
                      {{ group.grandBudget !== 0 ? formatPctDiff(group.grandVsProratedBudgetPct) : '—' }}
                    </td>
                    <td class="py-3 text-right font-mono col-summary px-3 text-xs border-b border-line/40"
                      :class="diffClass(group.grandVsLastYearProratedPct, group.scope)">
                      {{ group.grandLastYearProrated !== 0 ? formatPctDiff(group.grandVsLastYearProratedPct) : '—' }}
                    </td>
                  </tr>

                  <!-- Subgroups -->
                  <template v-for="sub in group.subGroups" :key="sub.name">
                    <tr @click="toggleSubgroup(group.scope, sub.name)"
                      class="hover:bg-canvas/30 cursor-pointer transition-colors font-semibold select-none text-ink group">
                      <td
                        class="py-2.5 pl-4 pr-3 col-category sticky-col-cell bg-sticky-subgroup border-r border-b border-line/40 flex items-center gap-1.5">
                        <component :is="isSubgroupCollapsed(group.scope, sub.name) ? ChevronRight : ChevronDown"
                          class="w-3 h-3 text-ink-3 shrink-0" />
                        <span class="w-1.5 h-1.5 rounded-full inline-block shrink-0 animate-pulse" :class="{
                          'bg-emerald-500/70': group.scope === 'income',
                          'bg-rose-500/70': group.scope === 'expense',
                          'bg-blue-500/70': group.scope === 'investment'
                        }"></span>
                        <span class="text-xs font-semibold tracking-wide text-ink-2">{{ sub.name }}</span>
                      </td>
                      <td v-for="(val, idx) in sub.months" :key="idx"
                        class="py-2.5 text-right font-mono col-month px-2 border-b border-line/40"
                        :class="[group.scope === 'income' ? 'text-emerald-600/90' : group.scope === 'investment' ? 'text-blue-600/90' : 'text-rose-600/90']">
                        <template v-if="val !== 0">{{ inrCompact(val) }}</template>
                        <span v-else class="text-ink-3/20">—</span>
                      </td>
                      <td class="py-2.5 text-right font-mono col-summary px-3 font-semibold border-b border-line/40"
                        :class="[group.scope === 'income' ? 'text-emerald-600/90' : group.scope === 'investment' ? 'text-blue-600/90' : 'text-rose-600/90']">
                        {{ sub.total !== 0 ? inrCompact(sub.total) : '—' }}
                      </td>
                      <td class="py-2.5 text-right font-mono col-summary px-3 text-ink-2 border-b border-line/40">
                        {{ sub.budget !== 0 ? inrCompact(sub.budget) : '—' }}
                      </td>
                      <td class="py-2.5 text-right font-mono col-summary px-3 border-b border-line/40"
                        :class="diffClass(sub.vsProratedBudgetPct, group.scope)">
                        {{ sub.budget !== 0 ? formatPctDiff(sub.vsProratedBudgetPct) : '—' }}
                      </td>
                      <td class="py-2.5 text-right font-mono col-summary px-3 border-b border-line/40"
                        :class="diffClass(sub.vsLastYearProratedPct, group.scope)">
                        {{ sub.lastYearProrated !== 0 ? formatPctDiff(sub.vsLastYearProratedPct) : '—' }}
                      </td>
                    </tr>

                    <!-- Category Rows -->
                    <tr v-show="!isSubgroupCollapsed(group.scope, sub.name)" v-for="row in sub.rows"
                      :key="row.category.id" class="hover:bg-canvas/20 transition-colors group">
                      <td
                        class="py-2 pl-8 pr-3 col-category sticky-col-cell bg-sticky-category border-r border-b border-line/30 capitalize font-normal text-ink-3 truncate"
                        :title="label(row.category.name)">
                        {{ label(row.category.name) }}
                      </td>
                      <td v-for="(val, idx) in row.months" :key="idx"
                        class="py-2 text-right font-mono col-month px-2 text-ink-3 border-b border-line/30">
                        <template v-if="val !== 0">{{ inrCompact(val) }}</template>
                        <span v-else class="text-ink-3/20">—</span>
                      </td>
                      <td
                        class="py-2 text-right font-mono col-summary px-3 font-medium text-ink-2 border-b border-line/30">
                        {{ row.total !== 0 ? inrCompact(row.total) : '—' }}
                      </td>
                      <td class="py-2 text-right font-mono col-summary px-3 text-ink-3 border-b border-line/30">
                        {{ row.budget !== 0 ? inrCompact(row.budget) : '—' }}
                      </td>
                      <td class="py-2 text-right font-mono col-summary px-3 border-b border-line/30"
                        :class="diffClass(row.vsProratedBudgetPct, group.scope)">
                        {{ row.budget !== 0 ? formatPctDiff(row.vsProratedBudgetPct) : '—' }}
                      </td>
                      <td class="py-2 text-right font-mono col-summary px-3 border-b border-line/30"
                        :class="diffClass(row.vsLastYearProratedPct, group.scope)">
                        {{ row.lastYearProrated !== 0 ? formatPctDiff(row.vsLastYearProratedPct) : '—' }}
                      </td>
                    </tr>
                  </template>
                </tbody>
              </table>
            </div>

            <!-- Net Cash Flow block -->
            <div v-if="cashflowMatrix.length" class="card shadow-sm border border-line/60 rounded-2xl bg-surface overflow-clip">
              <table class="w-[1500px] table-fixed text-xs text-left border-separate border-spacing-0">
                <colgroup>
                  <col class="col-category" />
                  <col v-for="m in summaryMonths" :key="m.key" class="col-month" />
                  <col class="col-summary" v-for="i in 4" :key="i" />
                </colgroup>
                <tbody>
                  <tr class="bg-elevated/40 font-bold">
                    <td class="py-3 pl-4 pr-3 col-category sticky-col-cell bg-sticky-net border-r border-line/40">
                      <span class="flex items-center gap-2">
                        <span class="w-5 h-5 rounded-full bg-ink/10 text-ink flex items-center justify-center shrink-0">
                          <Scale class="w-3 h-3 stroke-[2.5]" />
                        </span>
                        <span class="text-xs font-bold uppercase tracking-wider">Net Cash Flow</span>
                      </span>
                    </td>
                    <td v-for="(val, idx) in cashflowGrandTotals.net" :key="idx"
                      class="py-3 text-right font-mono col-month px-2 text-xs"
                      :class="val !== 0 ? (val >= 0 ? 'text-emerald-600' : 'text-rose-600') : 'text-ink-3'">
                      {{ val !== 0 ? inrCompact(val) : '—' }}
                    </td>
                    <td class="py-3 text-right font-mono col-summary px-3 text-xs"
                      :class="cashflowGrandTotals.grandNet >= 0 ? 'text-emerald-600' : 'text-rose-600'">
                      {{ cashflowGrandTotals.grandNet !== 0 ? inrCompact(cashflowGrandTotals.grandNet) : '—' }}
                    </td>
                    <td class="py-3 text-right font-mono col-summary px-3 text-ink-3/20">—</td>
                    <td class="py-3 text-right font-mono col-summary px-3 text-ink-3/20">—</td>
                    <td class="py-3 text-right font-mono col-summary px-3 text-ink-3/20">—</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div v-if="!cashflowMatrix.length" class="card p-8 text-center text-ink-3 italic">
              No cashflow data logged for {{ selectedSummaryYear }}.
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- NETWORTH SUMMARY SECTION -->
    <div class="mt-12 mb-10">
      <div class="flex flex-col md:flex-row md:items-end justify-between mb-6 gap-4 px-1">
        <div>
          <h3 class="font-serif text-2xl font-bold text-ink">Net Worth Summary</h3>
          <p class="text-xs text-ink-3 mt-1">Overview of your asset, liability, and total net worth balances
            month-by-month.
          </p>
        </div>
      </div>

      <div class="overflow-x-auto w-full pb-4">
        <div v-if="networthSummaryMonths.length" class="w-max min-w-full flex flex-col gap-2 p-1">
          <!-- Table Columns Header Card -->
          <div class="card shadow-sm border border-line/60 rounded-2xl bg-surface select-none overflow-clip">
            <table :style="{ width: `${180 + networthSummaryMonths.length * 80}px` }" class="table-fixed text-xs text-left border-separate border-spacing-0">
              <colgroup>
                <col class="col-category" />
                <col v-for="m in networthSummaryMonths" :key="m.key" class="col-month" />
              </colgroup>
              <thead>
                <tr class="text-ink-3 uppercase text-[10px] tracking-wider whitespace-nowrap">
                  <th
                    class="py-2.5 pl-4 pr-3 col-category sticky-col-header font-semibold text-ink-3 border-r border-line/40">
                    Category</th>
                  <th v-for="(m, idx) in networthSummaryMonths" :key="m.key"
                    class="py-2.5 text-right font-mono col-month"
                    :class="idx === networthSummaryMonths.length - 1 ? 'pr-8 pl-2' : 'px-2'">
                    {{ m.monthName }}
                  </th>
                </tr>
              </thead>
            </table>
          </div>

          <!-- Cards Stack Container -->
          <div class="flex flex-col gap-5">
            <!-- Card Blocks for assets & liabilities -->
            <div v-for="group in networthMatrix" :key="group.scope"
              class="card shadow-sm border border-line/60 rounded-2xl bg-surface overflow-clip">
              <table :style="{ width: `${180 + networthSummaryMonths.length * 80}px` }" class="table-fixed text-xs text-left border-separate border-spacing-0">
                <colgroup>
                  <col class="col-category" />
                  <col v-for="m in networthSummaryMonths" :key="m.key" class="col-month" />
                </colgroup>
                <tbody>
                  <!-- Group Header Row -->
                  <tr class="group transition-colors" :class="{
                    'bg-emerald-500/5 text-emerald-700 dark:text-emerald-400 font-bold': group.scope === 'asset',
                    'bg-rose-500/5 text-rose-700 dark:text-rose-400 font-bold': group.scope === 'liability'
                  }">
                    <td class="py-3 pl-4 pr-3 col-category sticky-col-cell border-r border-b border-line/40 select-none"
                      :class="{
                        'bg-sticky-asset': group.scope === 'asset',
                        'bg-sticky-liability': group.scope === 'liability'
                      }">
                      <span class="flex items-center gap-2">
                        <span v-if="group.scope === 'asset'"
                          class="w-5 h-5 rounded-full bg-emerald-500/10 text-emerald-600 flex items-center justify-center shrink-0">
                          <Check class="w-3 h-3 stroke-[2.5]" />
                        </span>
                        <span v-else-if="group.scope === 'liability'"
                          class="w-5 h-5 rounded-full bg-rose-500/10 text-rose-600 flex items-center justify-center shrink-0">
                          <Wallet class="w-3 h-3 stroke-[2.5]" />
                        </span>
                        <span class="text-xs font-bold uppercase tracking-wider">{{ group.label }}</span>
                      </span>
                    </td>
                    <td v-for="(val, idx) in group.colTotals" :key="idx"
                      class="py-3 text-right font-mono col-month text-xs border-b border-line/40"
                      :class="[group.scope === 'liability' && val > 0 ? 'text-rose-600' : group.scope === 'asset' && val > 0 ? 'text-emerald-600' : 'text-ink-2', idx === group.colTotals.length - 1 ? 'pr-8 pl-2' : 'px-2']">
                      {{ val !== 0 ? (group.scope === 'liability' ? '-' : '') + inrCompact(val) : '—' }}
                    </td>
                  </tr>

                  <!-- Subgroups -->
                  <template v-for="sub in group.subGroups" :key="sub.name">
                    <tr @click="toggleSubgroup(group.scope, sub.name)"
                      class="hover:bg-canvas/30 cursor-pointer transition-colors font-semibold select-none text-ink group">
                      <td
                        class="py-2.5 pl-4 pr-3 col-category sticky-col-cell bg-sticky-subgroup border-r border-b border-line/40 flex items-center gap-1.5">
                        <component :is="isSubgroupCollapsed(group.scope, sub.name) ? ChevronRight : ChevronDown"
                          class="w-3 h-3 text-ink-3 shrink-0" />
                        <span class="w-1.5 h-1.5 rounded-full inline-block shrink-0 animate-pulse" :class="{
                          'bg-emerald-500/70': group.scope === 'asset',
                          'bg-rose-500/70': group.scope === 'liability'
                        }"></span>
                        <span class="text-xs font-semibold tracking-wide text-ink-2">{{ sub.name }}</span>
                      </td>
                      <td v-for="(val, idx) in sub.months" :key="idx"
                        class="py-2.5 text-right font-mono col-month border-b border-line/40"
                        :class="[group.scope === 'liability' && val > 0 ? 'text-rose-600/80' : 'text-ink-2', idx === sub.months.length - 1 ? 'pr-8 pl-2' : 'px-2']">
                        <template v-if="val !== null">{{ (group.scope === 'liability' ? '-' : '') + inrCompact(val)
                          }}</template>
                        <span v-else class="text-ink-3/20">—</span>
                      </td>
                    </tr>

                    <!-- Category Rows -->
                    <tr v-show="!isSubgroupCollapsed(group.scope, sub.name)" v-for="row in sub.rows"
                      :key="row.category.id" class="hover:bg-canvas/20 transition-colors group">
                      <td
                        class="py-2 pl-8 pr-3 col-category sticky-col-cell bg-sticky-category border-r border-b border-line/30 capitalize font-normal text-ink-3 truncate"
                        :title="label(row.category.name)">
                        {{ label(row.category.name) }}
                      </td>
                      <td v-for="(val, idx) in row.months" :key="idx"
                        class="py-2 text-right font-mono col-month text-ink-3 border-b border-line/30"
                        :class="[group.scope === 'liability' && val > 0 ? 'text-rose-600/70' : '', idx === row.months.length - 1 ? 'pr-8 pl-2' : 'px-2']">
                        <template v-if="val !== null">{{ (group.scope === 'liability' ? '-' : '') + inrCompact(val)
                          }}</template>
                        <span v-else class="text-ink-3/20">—</span>
                      </td>
                    </tr>
                  </template>
                </tbody>
              </table>
            </div>

            <!-- Net Worth block -->
            <div class="card shadow-sm border border-line/60 rounded-2xl bg-surface overflow-clip">
              <table :style="{ width: `${180 + networthSummaryMonths.length * 80}px` }" class="table-fixed text-xs text-left border-separate border-spacing-0">
                <colgroup>
                  <col class="col-category" />
                  <col v-for="m in networthSummaryMonths" :key="m.key" class="col-month" />
                </colgroup>
                <tbody>
                  <tr class="bg-elevated/40 font-bold">
                    <td class="py-3 pl-4 pr-3 col-category sticky-col-cell bg-sticky-net border-r border-line/40">
                      <span class="flex items-center gap-2">
                        <span class="w-5 h-5 rounded-full bg-ink/10 text-ink flex items-center justify-center shrink-0">
                          <Scale class="w-3 h-3 stroke-[2.5]" />
                        </span>
                        <span class="text-xs font-bold uppercase tracking-wider">Net Worth</span>
                      </span>
                    </td>
                    <td v-for="(val, idx) in networthGrandTotals.netWorth" :key="idx"
                      class="py-3 text-right font-mono col-month text-xs"
                      :class="[val !== null ? (val >= 0 ? 'text-emerald-600' : 'text-rose-600') : 'text-ink-3', idx === networthGrandTotals.netWorth.length - 1 ? 'pr-8 pl-2' : 'px-2']">
                      <template v-if="val !== null">{{ inrCompact(val) }}</template>
                      <span v-else class="text-ink-3/20">—</span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
        <div v-else class="card p-8 text-center text-ink-3 italic">
          No net worth data logged for {{ selectedSummaryYear }}.
        </div>
      </div>
    </div>

    <!-- Legend Footer -->
    <div class="mt-6 text-[10px] text-ink-3 select-none text-left pl-2">
      All amounts are in INR • L = Lakhs • K = Thousands
    </div>
  </div>
</template>
