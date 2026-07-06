<script setup>
import { computed, ref, onMounted, watch } from 'vue'
import { useFinanceStore } from '@/stores/finance'
import { useSettingsStore } from '@/stores/settings'
import Sparkline from '@/components/Sparkline.vue'
import SectionHeader from '@/components/SectionHeader.vue'
import DonutChart from '@/components/DonutChart.vue'
import InteractiveChart from '@/components/InteractiveChart.vue'
import Combobox from '@/components/Combobox.vue'
import { inr, inrCompact } from '@/lib/money'
import { Plus } from 'lucide-vue-next'
import { Line as LineChart } from 'vue-chartjs'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js'

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
)

const emit = defineEmits(['open-nw', 'open-cf'])

const finance = useFinanceStore()
const settings = useSettingsStore()

// Dynamic Averages setup
const avgMonthsRange = ref(6) // X months default

const sparkData = computed(() => finance.networthSeries.map(s => s.value))
const cashflowSpark = computed(() => finance.cashflowSeries.map(s => s.net))

const latest = computed(() => finance.latestNetworth)
const latestCf = computed(() => finance.latestCashflow)
const latestCfTotals = computed(() => finance.periodTotals(latestCf.value))

const latestMonthGroupTotals = computed(() => {
  if (!latestCf.value) return null
  const groups = { income: {}, investment: {}, expense: {} }
  const scopeGroups = { income: new Set(), investment: new Set(), expense: new Set() }

  finance.categories.forEach(c => {
    if (!c.archived && scopeGroups[c.scope]) {
      scopeGroups[c.scope].add(c.group || 'One-Off')
    }
  })

  Object.keys(scopeGroups).forEach(scope => {
    scopeGroups[scope].forEach(grp => {
      groups[scope][grp] = 0
    })
  })

    ; (latestCf.value.entries || []).forEach(e => {
      const scope = e.type
      if (groups[scope]) {
        const cat = finance.categories.find(c => c.scope === scope && c.name === e.category)
        const grp = (cat && cat.group) || 'One-Off'
        groups[scope][grp] = (groups[scope][grp] || 0) + +e.value
      }
    })

  const result = {}
  Object.keys(groups).forEach(scope => {
    result[scope] = Object.entries(groups[scope])
      .map(([name, val]) => ({ name, val }))
      .sort((a, b) => b.val - a.val)
  })
  return result
})

// ───── Averages computation for the last X months
const averages = computed(() => {
  const periods = finance.cashflowPeriods.slice(0, avgMonthsRange.value)
  if (!periods.length) return { income: 0, activeIncome: 0, passiveIncome: 0, expense: 0, saveRate: 0 }

  let totalIncome = 0
  let totalActiveIncome = 0
  let totalPassiveIncome = 0
  let totalExpense = 0

  periods.forEach(p => {
    const t = finance.periodTotals(p)
    totalIncome += t.income
    totalExpense += t.expense

      ; (p.entries || []).forEach(e => {
        if (e.type === 'income') {
          const cat = finance.categories.find(c => c.scope === 'income' && c.name === e.category)
          const grp = ((cat && cat.group) || '').toLowerCase()
          if (grp === 'active') {
            totalActiveIncome += +e.value
          } else if (grp === 'passive') {
            totalPassiveIncome += +e.value
          }
        }
      })
  })

  const incomeAvg = totalIncome / periods.length
  const activeIncomeAvg = totalActiveIncome / periods.length
  const passiveIncomeAvg = totalPassiveIncome / periods.length
  const expenseAvg = totalExpense / periods.length
  const saveRateAvg = incomeAvg > 0 ? ((incomeAvg - expenseAvg) / incomeAvg) * 100 : 0

  return {
    income: incomeAvg,
    activeIncome: activeIncomeAvg,
    passiveIncome: passiveIncomeAvg,
    expense: expenseAvg,
    saveRate: saveRateAvg
  }
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
      saveRateChange: (current.income && prevMonthTotals.income) ? (current.income - current.expense) / current.income * 100 - (prevMonthTotals.income - prevMonthTotals.expense) / prevMonthTotals.income * 100 : 0
    },
    lastYear: {
      available: !!prevYearPeriod,
      yearName: String(currY - 1),
      incomeChange: getPctChange(current.income, prevYearTotals.income),
      expenseChange: getPctChange(current.expense, prevYearTotals.expense),
      saveRateChange: (current.income && prevYearTotals.income) ? (current.income - current.expense) / current.income * 100 - (prevYearTotals.income - prevYearTotals.expense) / prevYearTotals.income * 100 : 0
    }
  }
})

// Calculate monthly net worth growth rate from last 3-4 years (or all logs)
const historicalMonthlyGrowth = computed(() => {
  const series = finance.networthSeries // chronological [{date, value}]
  if (series.length < 2) {
    // Fallback: average savings if available, otherwise 8% annual return on net worth
    const savings = averages.value.income - averages.value.expense
    if (savings > 0) return savings
    return (finance.currentNetWorth * 0.08) / 12
  }

  const oldest = series[0]
  const latestNw = series[series.length - 1]

  // Calculate months between oldest.date (YYYY-MM) and latestNw.date (YYYY-MM)
  const [oldY, oldM] = oldest.date.split('-').map(Number)
  const [latY, latM] = latestNw.date.split('-').map(Number)
  const elapsedMonths = (latY - oldY) * 12 + (latM - oldM)

  if (elapsedMonths <= 0) {
    const savings = averages.value.income - averages.value.expense
    return savings > 0 ? savings : (finance.currentNetWorth * 0.08) / 12
  }

  const totalGrowth = latestNw.value - oldest.value
  return totalGrowth / elapsedMonths
})

// 5-year projection math (60 monthly increments)
const projectedNetworth = computed(() => {
  const startNW = finance.currentNetWorth || 0
  const growthPerMonth = historicalMonthlyGrowth.value

  const points = [startNW]
  const years = []

  let currentP = startNW
  for (let m = 1; m <= 60; m++) {
    currentP += growthPerMonth
    points.push(currentP)
    if (m % 12 === 0) {
      years.push({
        year: m / 12,
        label: `Yr ${m / 12}`,
        value: currentP
      })
    }
  }

  return {
    points,
    years
  }
})

// Active hover point for net worth projection chart
function hexToRgba(hex, alpha) {
  if (!hex || !hex.startsWith('#')) return hex
  const clean = hex.replace('#', '')
  let r, g, b
  if (clean.length === 3) {
    r = parseInt(clean[0] + clean[0], 16)
    g = parseInt(clean[1] + clean[1], 16)
    b = parseInt(clean[2] + clean[2], 16)
  } else {
    r = parseInt(clean.slice(0, 2), 16)
    g = parseInt(clean.slice(2, 4), 16)
    b = parseInt(clean.slice(4, 6), 16)
  }
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

function getProjectedMonthLabel(m) {
  const latestDate = latest.value ? latest.value.date : null
  if (!latestDate) return `Yr ${Math.ceil(m / 12)}`
  const [y, mo] = latestDate.split('-').map(Number)
  const totalMonths = (mo - 1) + m
  const projYear = y + Math.floor(totalMonths / 12)
  const projMonth = (totalMonths % 12) + 1
  const d = new Date(projYear, projMonth - 1, 1)
  return d.toLocaleString('en-IN', { month: 'short', year: 'numeric' })
}

const networthChartData = computed(() => {
  const hist = finance.networthSeries
  if (!hist.length) return null

  // We want history to take 65% of horizontal space (x: 0 to 130)
  // And projection to take 35% of horizontal space (x: 130 to 200)
  const histPoints = hist.map((s, i) => {
    const xVal = hist.length > 1 ? (i / (hist.length - 1)) * 130 : 0
    return {
      x: xVal,
      y: s.value,
      label: formatMonth(s.date),
      type: 'history'
    }
  })

  const startNW = finance.currentNetWorth || 0
  const growthPerMonth = historicalMonthlyGrowth.value
  let currentP = startNW

  const projPoints = []
  // Transition point (overlap) at x: 130
  projPoints.push({
    x: 130,
    y: startNW,
    label: histPoints[histPoints.length - 1]?.label || '',
    type: 'projection'
  })

  for (let m = 1; m <= 60; m++) {
    currentP += growthPerMonth
    const xVal = 130 + (m / 60) * 70
    projPoints.push({
      x: xVal,
      y: currentP,
      label: getProjectedMonthLabel(m),
      type: 'projection'
    })
  }

  return {
    datasets: [
      {
        label: 'Verified Log',
        data: histPoints,
        borderColor: '#5A7353',
        backgroundColor: hexToRgba('#5A7353', 0.12),
        fill: true,
        tension: 0.35,
        borderWidth: 2.5,
        pointRadius: (ctx) => (ctx.dataIndex === histPoints.length - 1 ? 4.5 : 0),
        pointHoverRadius: 6,
        pointBackgroundColor: '#5A7353',
        pointBorderColor: '#F9F8F6',
        pointBorderWidth: 1.5,
      },
      {
        label: 'Projection',
        data: projPoints,
        borderColor: '#5A7353',
        backgroundColor: hexToRgba('#5A7353', 0.04),
        fill: true,
        tension: 0.35,
        borderWidth: 2,
        borderDash: [4, 3],
        pointRadius: 0,
        pointHoverRadius: 5,
      }
    ]
  }
})

const networthChartOptions = computed(() => {
  const hist = finance.networthSeries
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false
      },
      tooltip: {
        mode: 'index',
        intersect: false,
        backgroundColor: 'rgba(30, 30, 30, 0.95)',
        titleColor: '#A5A5A5',
        bodyColor: '#F9F8F6',
        titleFont: { family: 'sans-serif', size: 10, weight: 'bold' },
        bodyFont: { family: 'serif', size: 12 },
        padding: 10,
        cornerRadius: 8,
        borderColor: 'rgba(255,255,255,0.1)',
        borderWidth: 1,
        callbacks: {
          title: function (context) {
            const pt = context[0]?.raw
            return pt?.label || ''
          },
          label: function (context) {
            const pt = context.raw
            if (!pt) return ''
            const typeLabel = pt.type === 'history' ? 'Verified Log' : 'Projection'
            return ` Net Worth: ${inr(pt.y)} (${typeLabel})`
          },
          labelTextColor: function () {
            return '#F9F8F6'
          }
        },
        filter: function (tooltipItem) {
          // Hide redundant overlap projection point at x: 130
          const pt = tooltipItem.raw
          if (pt?.type === 'projection' && pt?.x === 130) {
            return false
          }
          return true
        }
      }
    },
    scales: {
      x: {
        type: 'linear',
        min: 0,
        max: 200,
        grid: {
          display: false
        },
        ticks: {
          color: 'var(--color-ink-3, #8E8D8A)',
          font: { family: 'monospace', size: 9 },
          autoSkip: false,
          callback: function (value) {
            if (!networthChartData.value) return ''
            const histLen = hist.length

            // Render specific timeline ticks at Start (0), Now (130), Projected End (200)
            if (value === 0) {
              const label = networthChartData.value.datasets[0].data[0]?.label || ''
              return ['Start', label]
            }
            if (value === 130) {
              const label = networthChartData.value.datasets[0].data[histLen - 1]?.label || ''
              return ['Now', label]
            }
            if (value === 200) {
              const projData = networthChartData.value.datasets[1].data
              const label = projData[projData.length - 1]?.label || ''
              return ['Projected', label]
            }
            return ''
          }
        }
      },
      y: {
        grid: {
          display: false
        },
        border: {
          display: false
        },
        ticks: {
          color: 'var(--color-ink-3, #8E8D8A)',
          font: { family: 'monospace', size: 10 },
          callback: function (value) {
            return inrCompact(value)
          }
        }
      }
    },
    interaction: {
      mode: 'nearest',
      axis: 'x',
      intersect: false
    }
  }
})

// Budget Alerts (Prorated YTD based on Indian Fiscal Year starting in April)
const budgetAlerts = computed(() => {
  const now = new Date()
  const currentMonth = now.getMonth() + 1
  const currentYear = now.getFullYear()

  let fyStartYear = currentYear
  if (currentMonth < 4) {
    fyStartYear = currentYear - 1
  }
  const fyStartMonthStr = `${fyStartYear}-04`

  const currentFYPeriods = finance.cashflowPeriods.filter(p => p.month >= fyStartMonthStr)

  let loggedMonthsCount = currentFYPeriods.length
  if (loggedMonthsCount === 0) {
    const monthsElapsed = (currentYear - fyStartYear) * 12 + (currentMonth - 4) + 1
    loggedMonthsCount = Math.max(1, monthsElapsed)
  }
  const prorateFactor = loggedMonthsCount / 12

  const categoryActuals = {}
  currentFYPeriods.forEach(p => {
    (p.entries || []).forEach(e => {
      const key = `${e.type}::${e.category}`
      categoryActuals[key] = (categoryActuals[key] || 0) + +e.value
    })
  })

  const over = []
  const close = []

  finance.categories.forEach(c => {
    if (c.archived || c.scope !== 'expense') return
    const key = `${c.scope}::${c.name}`
    const actual = categoryActuals[key] || 0
    const budget = c.budgets?.[fyStartYear] || c.yearlyBudget || 0

    if (budget > 0) {
      const proratedBudget = budget * prorateFactor
      const pct = (actual / proratedBudget) * 100

      if (actual > proratedBudget) {
        over.push({
          category: c,
          actual,
          budget,
          proratedBudget,
          pct
        })
      } else if (actual >= proratedBudget * 0.90) {
        close.push({
          category: c,
          actual,
          budget,
          proratedBudget,
          pct
        })
      }
    }
  })

  return {
    over: over.sort((a, b) => b.pct - a.pct),
    close: close.sort((a, b) => b.pct - a.pct)
  }
})

const budgetAlertsRangeLabel = computed(() => {
  const now = new Date()
  const currentMonth = now.getMonth() + 1
  const currentYear = now.getFullYear()

  let fyStartYear = currentYear
  if (currentMonth < 4) {
    fyStartYear = currentYear - 1
  }
  const fyStartMonthStr = `${fyStartYear}-04`
  const currentFYPeriods = finance.cashflowPeriods.filter(p => p.month >= fyStartMonthStr)
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

  if (currentFYPeriods.length > 0) {
    const periodMonths = currentFYPeriods.map(p => p.month)
    periodMonths.sort()
    const latestPeriodMonth = periodMonths[periodMonths.length - 1]
    const latestMonthNum = parseInt(latestPeriodMonth.split('-')[1])
    return `Apr – ${monthNames[latestMonthNum - 1]}`
  } else {
    return `Apr – ${monthNames[now.getMonth()]}`
  }
})

function formatCompactMoney(val) {
  const abs = Math.abs(val)
  const sign = val < 0 ? '-' : ''
  if (abs >= 10000000) {
    return `${sign}₹${(abs / 10000000).toFixed(2)} Cr`
  }
  if (abs >= 100000) {
    return `${sign}₹${(abs / 100000).toFixed(2)} L`
  }
  if (abs >= 1000) {
    return `${sign}₹${(abs / 1000).toFixed(1)} K`
  }
  return `${sign}₹${Math.round(abs)}`
}

function label(s) {
  return (s || '').replace(/_/g, ' ')
}

function formatMonth(m) {
  if (!m) return ''
  const [y, mo] = m.split('-')
  const d = new Date(+y, +mo - 1, 1)
  return d.toLocaleString('en-IN', { month: 'short', year: 'numeric' })
}

// ───── Dynamics (Financial Progression)
const selectedCategory = ref(['net_worth'])
const chartSelectionMode = ref('multi')

onMounted(async () => {
  await settings.load()
  const savedMode = settings.get('financeOverviewChartSelectionMode')
  if (savedMode) {
    chartSelectionMode.value = savedMode
  }
  const saved = settings.get('financeOverviewSelectedCategory')
  if (saved) {
    if (chartSelectionMode.value === 'multi') {
      selectedCategory.value = Array.isArray(saved) ? saved : [saved]
    } else {
      selectedCategory.value = Array.isArray(saved) ? (saved[0] || 'net_worth') : saved
    }
  }
})

watch(chartSelectionMode, (newVal) => {
  settings.set('financeOverviewChartSelectionMode', newVal)
})

watch(selectedCategory, (newVal) => {
  settings.set('financeOverviewSelectedCategory', newVal)
}, { deep: true })

function toggleSelectionMode(mode) {
  if (chartSelectionMode.value === mode) return
  chartSelectionMode.value = mode

  if (mode === 'single') {
    const first = Array.isArray(selectedCategory.value)
      ? (selectedCategory.value[0] || 'net_worth')
      : (selectedCategory.value || 'net_worth')
    selectedCategory.value = first
  } else {
    const val = Array.isArray(selectedCategory.value)
      ? selectedCategory.value
      : [selectedCategory.value].filter(Boolean)
    selectedCategory.value = val.length ? val : ['net_worth']
  }
}

const chartOptions = computed(() => {
  const opts = [
    { key: 'net_worth', label: 'Net Worth (Snapshots)' },
    { key: 'total_investments', label: 'Total Investments (Cash Flow)' }
  ]

  // 1. Scope Totals
  opts.push({ isSeparator: true })
  opts.push(
    { key: 'scope_asset', label: 'Scope Total · ASSETS' },
    { key: 'scope_liability', label: 'Scope Total · LIABILITIES' },
    { key: 'scope_income', label: 'Scope Total · INCOME' },
    { key: 'scope_expense', label: 'Scope Total · EXPENSES' },
    { key: 'scope_investment', label: 'Scope Total · INVESTMENTS' }
  )

  // 2. Group Totals
  const groupsMap = {}
  finance.categories.forEach(c => {
    if (!c.archived && c.scope && c.group) {
      if (!groupsMap[c.scope]) {
        groupsMap[c.scope] = new Set()
      }
      groupsMap[c.scope].add(c.group)
    }
  })

  const groupOpts = []
  Object.keys(groupsMap).sort().forEach(scope => {
    Array.from(groupsMap[scope]).sort().forEach(grp => {
      groupOpts.push({
        key: `group_${scope}_${grp}`,
        label: `Group Total · ${scope.toUpperCase()} · ${grp}`
      })
    })
  })

  if (groupOpts.length > 0) {
    opts.push({ isSeparator: true })
    opts.push(...groupOpts)
  }

  // 3. Net Worth Assets
  const nwOpts = []
  const nwCats = new Set()
  finance.networthLogs.forEach(log => {
    (log.entries || []).forEach(e => nwCats.add(e.category))
  })
  Array.from(nwCats).sort().forEach(cat => {
    nwOpts.push({ key: `nw_cat_${cat}`, label: `Net Worth Asset · ${cat.replace(/_/g, ' ')}` })
  })

  if (nwOpts.length > 0) {
    opts.push({ isSeparator: true })
    opts.push(...nwOpts)
  }

  // 4. Cashflow Categories
  const cfOpts = []
  const cfCats = new Set()
  finance.cashflowPeriods.forEach(p => {
    (p.entries || []).forEach(e => cfCats.add(e.category))
  })
  Array.from(cfCats).sort().forEach(cat => {
    cfOpts.push({ key: `cf_cat_${cat}`, label: `Cash Flow Category · ${cat.replace(/_/g, ' ')}` })
  })

  if (cfOpts.length > 0) {
    opts.push({ isSeparator: true })
    opts.push(...cfOpts)
  }

  return opts
})

const chartSeries = computed(() => {
  const selected = Array.isArray(selectedCategory.value)
    ? selectedCategory.value
    : [selectedCategory.value].filter(Boolean)

  const colors = [
    '#5A7353', // Strategic Green
    '#9E8457', // Gold/Brown
    '#8C5A5B', // Terracotta/Rose
    '#5A718C', // Slate Blue
    '#795A8C', // Plum/Purple
    '#8C775A', // Bronze
    '#5A8C85'  // Teal
  ]

  return selected.map((opt, index) => {
    const color = colors[index % colors.length]
    const option = chartOptions.value.find(o => o.key === opt)
    const name = option ? option.label : opt

    let data = []
    if (opt === 'net_worth') {
      data = finance.networthSeries
        .map(s => ({ label: formatMonth(s.date), value: s.value }))
    } else if (opt === 'total_investments') {
      data = finance.cashflowSeries
        .map(s => ({ label: formatMonth(s.month), value: s.investment }))
    } else if (opt.startsWith('scope_')) {
      const scope = opt.replace('scope_', '')
      if (scope === 'asset' || scope === 'liability') {
        data = [...finance.networthLogs].reverse().map(log => {
          const total = (log.entries || [])
            .filter(e => e.type === scope)
            .reduce((s, e) => s + +e.value, 0)
          return {
            label: formatMonth(log.date),
            value: total
          }
        })
      } else {
        data = [...finance.cashflowPeriods].reverse().map(p => {
          const total = (p.entries || [])
            .filter(e => e.type === scope)
            .reduce((s, e) => s + +e.value, 0)
          return {
            label: formatMonth(p.month),
            value: total
          }
        })
      }
    } else if (opt.startsWith('group_')) {
      const parts = opt.split('_')
      const scope = parts[1]
      const grp = parts.slice(2).join('_')

      const catsInGroup = new Set(
        finance.categories
          .filter(c => c.scope === scope && c.group === grp)
          .map(c => c.name)
      )

      if (scope === 'asset' || scope === 'liability') {
        data = [...finance.networthLogs].reverse().map(log => {
          const total = (log.entries || [])
            .filter(e => e.type === scope && catsInGroup.has(e.category))
            .reduce((s, e) => s + +e.value, 0)
          return {
            label: formatMonth(log.date),
            value: total
          }
        })
      } else {
        data = [...finance.cashflowPeriods].reverse().map(p => {
          const total = (p.entries || [])
            .filter(e => e.type === scope && catsInGroup.has(e.category))
            .reduce((s, e) => s + +e.value, 0)
          return {
            label: formatMonth(p.month),
            value: total
          }
        })
      }
    } else if (opt.startsWith('nw_cat_')) {
      const cat = opt.replace('nw_cat_', '')
      data = [...finance.networthLogs].reverse().map(log => {
        const entry = (log.entries || []).find(e => e.category === cat)
        return {
          label: formatMonth(log.date),
          value: entry ? +entry.value : 0
        }
      })
    } else if (opt.startsWith('cf_cat_')) {
      const cat = opt.replace('cf_cat_', '')
      data = [...finance.cashflowPeriods].reverse().map(p => {
        const entries = (p.entries || []).filter(e => e.category === cat)
        const total = entries.reduce((s, e) => s + +e.value, 0)
        return {
          label: formatMonth(p.month),
          value: total
        }
      })
    }

    return { name, color, data }
  })
})
</script>

<template>
  <div>
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-10">
      <!-- Net Worth Card -->
      <div class="card p-6 flex flex-col justify-between lg:col-span-2">
        <div>
          <div class="overline">Net worth</div>
          <div class="flex items-baseline gap-3 mt-2 flex-wrap">
            <span class="font-serif text-3xl tracking-tight" data-testid="finance-net-worth">{{
              inr(finance.currentNetWorth) }}</span>
            <span v-if="latest" class="text-xs text-ink-3">as of {{ formatMonth(latest.date) }} (5Y projection
              continuing via dashed line)</span>
          </div>
          <p v-if="!latest" class="text-sm text-ink-2 mt-3 italic">No snapshots yet - log one to begin.</p>

          <!-- Chart.js Net Worth Graph -->
          <div class="mt-4 w-full h-[320px]" v-if="networthChartData">
            <LineChart :data="networthChartData" :options="networthChartOptions" />
          </div>
          <div v-else class="mt-6">
            <Sparkline :data="sparkData" :height="64" color="rgb(90 115 83)" />
          </div>
        </div>

        <button class="btn-primary mt-5 w-fit self-end" @click="emit('open-nw')" data-testid="overview-log-nw">
          <Plus class="w-4 h-4" /> Log net worth <span
            class="kbd ml-1.5 !bg-canvas/20 !border-canvas/10 !text-canvas select-none">⌘1</span>
        </button>
      </div>

      <!-- Latest Month Card (Takes 1 Col) -->
      <div class="card p-6 flex flex-col justify-between lg:col-span-1">
        <div>
          <div class="overline">Latest month - {{ latestCf ? formatMonth(latestCf.month) : '-' }}</div>
          <div class="space-y-4 mt-4">
            <!-- Income Section -->
            <div class="border-b border-line/30 pb-2">
              <div class="flex justify-between items-baseline">
                <span class="text-xs font-semibold text-ink-2 uppercase tracking-wider">Income</span>
                <span class="font-serif text-lg text-pri-strategic font-semibold">{{ inr(latestCfTotals.income)
                  }}</span>
              </div>
              <div v-if="latestMonthGroupTotals && latestMonthGroupTotals.income.length" class="mt-1 pl-3 space-y-0.5">
                <div v-for="g in latestMonthGroupTotals.income" :key="g.name"
                  class="flex justify-between text-xs text-ink-3">
                  <span>{{ g.name }}</span>
                  <span class="font-mono">{{ inr(g.val) }}</span>
                </div>
              </div>
            </div>

            <!-- Invested Section -->
            <div class="border-b border-line/30 pb-2">
              <div class="flex justify-between items-baseline">
                <span class="text-xs font-semibold text-ink-2 uppercase tracking-wider">Invested</span>
                <span class="font-serif text-lg text-pri-interruptive font-semibold">{{ inr(latestCfTotals.investment)
                  }}</span>
              </div>
              <div v-if="latestMonthGroupTotals && latestMonthGroupTotals.investment.length"
                class="mt-1 pl-3 space-y-0.5">
                <div v-for="g in latestMonthGroupTotals.investment" :key="g.name"
                  class="flex justify-between text-xs text-ink-3">
                  <span>{{ g.name }}</span>
                  <span class="font-mono">{{ inr(g.val) }}</span>
                </div>
              </div>
            </div>

            <!-- Expense Section -->
            <div class="border-b border-line/30 pb-2">
              <div class="flex justify-between items-baseline">
                <span class="text-xs font-semibold text-ink-2 uppercase tracking-wider">Expense</span>
                <span class="font-serif text-lg text-pri-critical font-semibold">{{ inr(latestCfTotals.expense)
                  }}</span>
              </div>
              <div v-if="latestMonthGroupTotals && latestMonthGroupTotals.expense.length" class="mt-1 pl-3 space-y-0.5">
                <div v-for="g in latestMonthGroupTotals.expense" :key="g.name"
                  class="flex justify-between text-xs text-ink-3">
                  <span>{{ g.name }}</span>
                  <span class="font-mono">{{ inr(g.val) }}</span>
                </div>
              </div>
            </div>

            <!-- Net Section -->
            <div>
              <div class="flex justify-between items-baseline">
                <span class="text-xs font-semibold text-ink-2 uppercase tracking-wider">Net</span>
                <span class="font-serif text-lg font-semibold"
                  :class="latestCfTotals.net >= 0 ? 'text-pri-strategic' : 'text-pri-critical'">
                  {{ inr(latestCfTotals.net) }}
                </span>
              </div>
            </div>
          </div>
        </div>

        <button class="btn-primary mt-5 w-fit self-end" @click="emit('open-cf')" data-testid="overview-log-cf">
          <Plus class="w-4 h-4" /> Log a month's cashflow <span
            class="kbd ml-1.5 !bg-canvas/20 !border-canvas/10 !text-canvas select-none">⌘2</span>
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
            <div v-if="comparisonMetrics.lastMonth.available" class="text-sm font-medium mt-1"
              :class="comparisonMetrics.lastMonth.incomeChange >= 0 ? 'text-pri-strategic' : 'text-pri-critical'">
              {{ comparisonMetrics.lastMonth.incomeChange >= 0 ? '+' : '' }}{{
                comparisonMetrics.lastMonth.incomeChange.toFixed(1) }}%
            </div>
            <div v-else class="text-sm text-ink-3 mt-1">—</div>
          </div>
          <div>
            <div class="text-[10px] text-ink-3 uppercase">Expense</div>
            <div v-if="comparisonMetrics.lastMonth.available" class="text-sm font-medium mt-1"
              :class="comparisonMetrics.lastMonth.expenseChange <= 0 ? 'text-pri-strategic' : 'text-pri-critical'">
              {{ comparisonMetrics.lastMonth.expenseChange >= 0 ? '+' : '' }}{{
                comparisonMetrics.lastMonth.expenseChange.toFixed(1) }}%
            </div>
            <div v-else class="text-sm text-ink-3 mt-1">—</div>
          </div>
          <div>
            <div class="text-[10px] text-ink-3 uppercase">Save Rate</div>
            <div v-if="comparisonMetrics.lastMonth.available" class="text-sm font-medium mt-1"
              :class="comparisonMetrics.lastMonth.saveRateChange >= 0 ? 'text-pri-strategic' : 'text-pri-critical'">
              {{ comparisonMetrics.lastMonth.saveRateChange >= 0 ? '+' : '' }}{{
                comparisonMetrics.lastMonth.saveRateChange.toFixed(1) }}%
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
            <div v-if="comparisonMetrics.lastYear.available" class="text-sm font-medium mt-1"
              :class="comparisonMetrics.lastYear.incomeChange >= 0 ? 'text-pri-strategic' : 'text-pri-critical'">
              {{ comparisonMetrics.lastYear.incomeChange >= 0 ? '+' : '' }}{{
                comparisonMetrics.lastYear.incomeChange.toFixed(1) }}%
            </div>
            <div v-else class="text-sm text-ink-3 mt-1">—</div>
          </div>
          <div>
            <div class="text-[10px] text-ink-3 uppercase">Expense</div>
            <div v-if="comparisonMetrics.lastYear.available" class="text-sm font-medium mt-1"
              :class="comparisonMetrics.lastYear.expenseChange <= 0 ? 'text-pri-strategic' : 'text-pri-critical'">
              {{ comparisonMetrics.lastYear.expenseChange >= 0 ? '+' : '' }}{{
                comparisonMetrics.lastYear.expenseChange.toFixed(1) }}%
            </div>
            <div v-else class="text-sm text-ink-3 mt-1">—</div>
          </div>
          <div>
            <div class="text-[10px] text-ink-3 uppercase">Save Rate</div>
            <div v-if="comparisonMetrics.lastYear.available" class="text-sm font-medium mt-1"
              :class="comparisonMetrics.lastYear.saveRateChange >= 0 ? 'text-pri-strategic' : 'text-pri-critical'">
              {{ comparisonMetrics.lastYear.saveRateChange >= 0 ? '+' : '' }}{{
                comparisonMetrics.lastYear.saveRateChange.toFixed(1) }}%
            </div>
            <div v-else class="text-sm text-ink-3 mt-1">—</div>
          </div>
        </div>
      </div>
    </div>

    <!-- HISTORICAL PERIOD AVERAGES & BUDGET ALERTS (Side-by-side) -->
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-10">

      <!-- HISTORICAL PERIOD AVERAGES (Takes 1 Col) -->
      <div class="lg:col-span-1 flex flex-col">
        <SectionHeader overline="Averages" />

        <div class="card p-5 space-y-4 flex-1">
          <div class="flex items-center justify-between pb-3 border-b border-line">
            <span class="text-[10px] font-semibold text-ink-3 uppercase font-mono">Select Period</span>
            <select v-model="avgMonthsRange"
              class="bg-surface border border-line rounded-lg px-2 py-1 text-xs outline-none focus:border-line-2">
              <option :value="3">Last 3 months</option>
              <option :value="6">Last 6 months</option>
              <option :value="12">Last 12 months</option>
            </select>
          </div>

          <div class="flex justify-between items-center py-1.5">
            <span class="text-xs font-medium text-ink-2">Avg Income</span>
            <span class="font-serif text-lg font-semibold text-pri-strategic">{{ inr(averages.income) }}</span>
          </div>

          <div class="flex justify-between items-center py-1 pl-3 border-t border-line/20 text-xs">
            <span class="text-ink-3">↳ Active Income</span>
            <span class="font-mono text-ink-2">{{ inr(averages.activeIncome) }}</span>
          </div>

          <div class="flex justify-between items-center py-1 pl-3 border-t border-line/20 text-xs">
            <span class="text-ink-3">↳ Passive Income</span>
            <span class="font-mono text-ink-2">{{ inr(averages.passiveIncome) }}</span>
          </div>

          <div class="flex justify-between items-center py-1.5 border-t border-line/40">
            <span class="text-xs font-medium text-ink-2">Avg Expense</span>
            <span class="font-serif text-lg font-semibold text-pri-critical">{{ inr(averages.expense) }}</span>
          </div>

          <div class="flex justify-between items-center py-1.5 border-t border-line/40">
            <span class="text-xs font-medium text-ink-2">Avg Save Rate</span>
            <span class="font-serif text-lg font-semibold"
              :class="averages.saveRate >= 30 ? 'text-pri-strategic' : averages.saveRate >= 10 ? 'text-pri-interruptive' : 'text-pri-critical'">
              {{ averages.saveRate.toFixed(1) }}%
            </span>
          </div>
        </div>
      </div>

      <!-- BUDGET ALERTS (Takes 2 Cols) -->
      <div class="lg:col-span-2 flex flex-col">
        <SectionHeader overline="Budget alerts" />

        <div class="card p-5 space-y-4 flex-1 flex flex-col justify-between">
          <div class="flex items-center justify-between pb-3 border-b border-line">
            <span class="text-[10px] font-semibold text-ink-3 uppercase font-mono">YTD Category Warnings</span>
            <span class="text-[10px] bg-elevated border border-line text-ink-2 px-2 py-0.5 rounded-full font-mono">
              {{ budgetAlertsRangeLabel }}
            </span>
          </div>

          <div class="flex-1 space-y-3 overflow-y-auto pr-1">
            <!-- Over Budget List -->
            <div v-if="budgetAlerts.over.length" class="space-y-1.5">
              <div class="text-[10px] uppercase font-bold text-pri-critical tracking-wider flex items-center gap-1.5">
                <span class="inline-block w-1.5 h-1.5 rounded-full bg-pri-critical"></span>
                Over Budget
              </div>
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div v-for="a in budgetAlerts.over" :key="a.category.id"
                  class="flex items-center justify-between bg-pri-critical-bg border border-pri-critical-bd rounded-lg p-2 text-xs">
                  <span class="font-medium capitalize text-ink truncate mr-2">{{ label(a.category.name) }}</span>
                  <div class="text-right flex-shrink-0">
                    <span class="font-semibold text-pri-critical font-mono">{{ inr(a.actual) }}</span>
                    <span class="text-[9px] text-ink-3 block font-mono">Limit: {{ inr(a.proratedBudget) }}</span>
                  </div>
                </div>
              </div>
            </div>

            <!-- Close to Budget List -->
            <div v-if="budgetAlerts.close.length" class="space-y-1.5"
              :class="{ 'pt-2 border-t border-line/40': budgetAlerts.over.length }">
              <div
                class="text-[10px] uppercase font-bold text-pri-interruptive tracking-wider flex items-center gap-1.5">
                <span class="inline-block w-1.5 h-1.5 rounded-full bg-pri-interruptive"></span>
                Near Limit (90%+)
              </div>
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div v-for="a in budgetAlerts.close" :key="a.category.id"
                  class="flex items-center justify-between bg-pri-interruptive-bg border border-pri-interruptive-bd rounded-lg p-2 text-xs">
                  <span class="font-medium capitalize text-ink truncate mr-2">{{ label(a.category.name) }}</span>
                  <div class="text-right flex-shrink-0">
                    <span class="font-semibold text-pri-interruptive font-mono">{{ inr(a.actual) }}</span>
                    <span class="text-[9px] text-ink-3 block font-mono">Limit: {{ inr(a.proratedBudget) }}</span>
                  </div>
                </div>
              </div>
            </div>

            <!-- Empty state (No alerts) -->
            <div v-if="!budgetAlerts.over.length && !budgetAlerts.close.length"
              class="flex flex-col items-center justify-center py-6 text-center text-ink-3 italic">
              <span class="text-pri-strategic text-sm font-semibold">✓ All targets healthy</span>
              <span class="text-[10px] mt-0.5">YTD spending in all budgeted categories is within prorated limits.</span>
            </div>
          </div>
        </div>
      </div>

    </div>

    <!-- ASSETS & EXPENSES DONUT CHARTS -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-10">
      <div>
        <SectionHeader v-if="finance.allocation.length" overline="Distribution" />
        <div v-if="finance.allocation.length" class="card p-6">
          <DonutChart :data="finance.allocation" theme="strategic" />
        </div>
      </div>

      <div>
        <SectionHeader v-if="finance.expenseBreakdownLatest.length" overline="Spending shape" />
        <div v-if="finance.expenseBreakdownLatest.length" class="card p-6">
          <DonutChart :data="finance.expenseBreakdownLatest" theme="critical" />
        </div>
      </div>
    </div>

    <!-- Financial Progression Charts (Dynamics) -->
    <section class="mb-10">
      <div class="flex items-center justify-between gap-6 flex-wrap mb-2">
        <SectionHeader overline="Dynamics" />
        <div class="flex items-center gap-4 flex-wrap">
          <!-- Selection Mode Switcher -->
          <div
            class="flex bg-canvas/40 p-0.5 rounded-lg border border-line/40 text-[10px] uppercase font-bold tracking-wider select-none shrink-0">
            <button type="button" class="px-2.5 py-1 rounded-md transition-all duration-200"
              :class="chartSelectionMode === 'single' ? 'bg-surface text-ink shadow-sm' : 'text-ink-3 hover:text-ink-2'"
              @click="toggleSelectionMode('single')">
              Single
            </button>
            <button type="button" class="px-2.5 py-1 rounded-md transition-all duration-200"
              :class="chartSelectionMode === 'multi' ? 'bg-surface text-ink shadow-sm' : 'text-ink-3 hover:text-ink-2'"
              @click="toggleSelectionMode('multi')">
              Multi
            </button>
          </div>

          <div class="flex items-center gap-2">
            <span class="overline text-[10px]">Select Categories</span>
            <Combobox :options="chartOptions" v-model="selectedCategory" placeholder="Search categories..."
              :multiple="chartSelectionMode === 'multi'" />
          </div>
        </div>
      </div>

      <div class="card p-6" data-testid="summary-chart-container">
        <InteractiveChart :series="chartSeries" :height="580" />
      </div>
    </section>
  </div>
</template>
