<script setup>
import { computed, ref } from 'vue'
import { useFinanceStore } from '@/stores/finance'
import Sparkline from '@/components/Sparkline.vue'
import SectionHeader from '@/components/SectionHeader.vue'
import DonutChart from '@/components/DonutChart.vue'
import { inr } from '@/lib/money'
import { Plus } from 'lucide-vue-next'

const emit = defineEmits(['open-nw', 'open-cf'])

const finance = useFinanceStore()

// Dynamic Averages setup
const avgMonthsRange = ref(6) // X months default

const sparkData = computed(() => finance.networthSeries.map(s => s.value))
const cashflowSpark = computed(() => finance.cashflowSeries.map(s => s.net))

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

function formatMonth(m) {
  if (!m) return ''
  const [y, mo] = m.split('-')
  const d = new Date(+y, +mo - 1, 1)
  return d.toLocaleString('en-IN', { month: 'short', year: 'numeric' })
}
</script>

<template>
  <div>
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-10">
      <div class="card p-6">
        <div class="overline">Net worth</div>
        <div class="font-serif text-4xl tracking-tight mt-2" data-testid="finance-net-worth">{{
          inr(finance.currentNetWorth) }}</div>
        <p v-if="latest" class="text-xs text-ink-3 mt-2">as of {{ formatMonth(latest.date) }}</p>
        <p v-else class="text-sm text-ink-2 mt-3 italic">No snapshots yet - log one to begin.</p>
        <div class="mt-6">
          <Sparkline :data="sparkData" :height="64" color="rgb(90 115 83)" />
        </div>
        <button class="btn-primary mt-5" @click="emit('open-nw')" data-testid="overview-log-nw">
          <Plus class="w-4 h-4" /> Log net worth <span
            class="kbd ml-1.5 !bg-canvas/20 !border-canvas/10 !text-canvas select-none">⌘1</span>
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
            <div class="overline">Invested</div>
            <div class="font-serif text-lg text-pri-interruptive">{{ inr(latestCfTotals.investment) }}</div>
          </div>
          <div>
            <div class="overline">Expense</div>
            <div class="font-serif text-lg text-pri-critical">{{ inr(latestCfTotals.expense) }}</div>
          </div>
          <div>
            <div class="overline">Net</div>
            <div class="font-serif text-lg" :class="latestCfTotals.net >= 0 ? 'text-pri-strategic' : 'text-pri-critical'">{{
              inr(latestCfTotals.net) }}</div>
          </div>
        </div>
        <div class="mt-5">
          <Sparkline :data="cashflowSpark" :height="48" color="rgb(158 132 87)" />
        </div>
        <button class="btn-primary mt-5" @click="emit('open-cf')" data-testid="overview-log-cf">
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
        <div class="font-serif text-2xl mt-2"
          :class="averages.saveRate >= 30 ? 'text-pri-strategic' : averages.saveRate >= 10 ? 'text-pri-interruptive' : 'text-pri-critical'">
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
  </div>
</template>
