<script setup>
import { computed, ref } from 'vue'
import { useFinanceStore } from '@/stores/finance'
import { useUIStore } from '@/stores/ui'
import { useSettingsStore } from '@/stores/settings'
import { inr } from '@/lib/money'

const finance = useFinanceStore()
const ui = useUIStore()
const settings = useSettingsStore()

const startMonth = computed(() => settings.get('financeStartMonth', '01'))
const selectedBudgetYear = ref(new Date().getFullYear())
const showAllCategoriesInBudget = ref(true)

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
    months.push(`${yStr}-${mStr}`)
    currentMonth++
    if (currentMonth > 12) {
      currentMonth = 1
      currentYear++
    }
  }
  return months
}

const budgetStatus = computed(() => {
  const targetMonthsKeys = getYearMonths(selectedBudgetYear.value, parseInt(startMonth.value))
  const yearPeriods = finance.cashflowPeriods.filter(p => targetMonthsKeys.includes(p.month))

  // Calculate total spent per category in this year
  const actuals = {}
  yearPeriods.forEach(p => {
    (p.entries || []).forEach(e => {
      const key = `${e.type}::${e.category}`
      actuals[key] = (actuals[key] || 0) + +e.value
    })
  })

  // Mix in categories with budgets
  const items = finance.categories.map(c => {
    const key = `${c.scope}::${c.name}`
    const actual = actuals[key] || 0
    const budget = c.budgets?.[selectedBudgetYear.value] || (selectedBudgetYear.value === new Date().getFullYear() ? (c.yearlyBudget || 0) : 0)
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
  })

  // Filter out archived categories
  const activeItems = items.filter(item => !item.category.archived)

  // Check if we have any items with budget > 0 or actual > 0
  const hasBudgetOrActual = activeItems.some(item => item.budget > 0 || item.actual > 0)

  const filtered = activeItems.filter(item => showAllCategoriesInBudget.value || !hasBudgetOrActual || item.budget > 0 || item.actual > 0)

  // Sort by scope order and then name
  const scopeOrder = ['income', 'expense', 'investment', 'asset', 'liability']
  return filtered.sort((a, b) => {
    const scopeDiff = scopeOrder.indexOf(a.category.scope) - scopeOrder.indexOf(b.category.scope)
    if (scopeDiff !== 0) return scopeDiff
    return a.category.name.localeCompare(b.category.name)
  })
})

const groupedBudgets = computed(() => {
  const status = budgetStatus.value
  const groups = {}

  status.forEach(item => {
    const scope = item.category.scope
    if (!groups[scope]) groups[scope] = []
    groups[scope].push(item)
  })

  const scopeOrder = ['income', 'expense', 'investment', 'asset', 'liability']
  const scopeLabels = {
    income: 'Income',
    expense: 'Expenses',
    investment: 'Investments',
    asset: 'Assets',
    liability: 'Liabilities'
  }

  const groupOrder = {
    income: ['Active', 'Passive', 'One-Off'],
    investment: ['Equity', 'Debt', 'Debt/Other', 'Bullion', 'Real Estate', 'Illiquid'],
    expense: ['Need', 'Want', 'Business'],
    asset: ['Liquid', 'Fixed'],
    liability: ['Short-term', 'Long-term']
  }

  return scopeOrder.filter(s => groups[s] && groups[s].length > 0).map(s => {
    const scopeItems = groups[s]

    // Group scopeItems by category.group
    const subGroupsMap = {}
    scopeItems.forEach(item => {
      const gName = item.category.group || 'Other'
      if (!subGroupsMap[gName]) subGroupsMap[gName] = []
      subGroupsMap[gName].push(item)
    })

    const order = groupOrder[s] || []
    const subGroups = Object.keys(subGroupsMap).map(gName => {
      const items = subGroupsMap[gName].sort((a, b) => a.category.name.localeCompare(b.category.name))

      // Calculate subgroup totals
      const actual = items.reduce((sum, item) => sum + item.actual, 0)
      const budget = items.reduce((sum, item) => sum + item.budget, 0)
      const progress = budget > 0 ? (actual / budget) * 100 : 0

      return {
        name: gName,
        items,
        actual,
        budget,
        progress
      }
    }).sort((a, b) => {
      const idxA = order.indexOf(a.name)
      const idxB = order.indexOf(b.name)
      if (idxA !== -1 && idxB !== -1) return idxA - idxB
      if (idxA !== -1) return -1
      if (idxB !== -1) return 1
      return a.name.localeCompare(b.name)
    })

    // Calculate scope totals
    const actual = scopeItems.reduce((sum, item) => sum + item.actual, 0)
    const budget = scopeItems.reduce((sum, item) => sum + item.budget, 0)
    const progress = budget > 0 ? (actual / budget) * 100 : 0

    return {
      scope: s,
      label: scopeLabels[s],
      subGroups,
      actual,
      budget,
      progress
    }
  })
})

async function saveCategoryBudget(c, amount) {
  await finance.updateCategoryBudget(c.id, selectedBudgetYear.value, amount)
  ui.showToast('Budget updated', 'success')
}

function label(s) { return (s || '').replace(/_/g, ' ') }
</script>

<template>
  <div>
    <!-- Header Block conforming to the modern visual layout -->
    <div class="flex flex-col md:flex-row md:items-end justify-between mb-8 ml-1 gap-4 px-1">
      <div>
        <div class="overline text-[10px] text-ink-3 tracking-widest uppercase mb-1 font-sans">Budgets</div>
        <h2 class="font-serif text-3xl font-bold text-ink">Annual Category Budgets</h2>
      </div>
      <!-- Year Selector aligned right in a compact container -->
      <div
        class="flex items-center gap-2 bg-surface border border-line rounded-xl px-3 py-1.5 shadow-sm text-xs select-none">
        <span class="text-[10px] uppercase tracking-wider text-ink-3 font-semibold font-sans">Select Year</span>
        <select v-model="selectedBudgetYear"
          class="bg-transparent font-serif outline-none text-ink font-semibold cursor-pointer"
          data-testid="budget-year-select">
          <option v-for="y in budgetYears" :key="y" :value="y">{{ y }}</option>
        </select>
      </div>
    </div>

    <div class="card p-6 mb-10 overflow-x-auto">
      <div class="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div class="text-xs uppercase tracking-wider font-semibold text-ink-3 font-mono">Category Limits</div>
        <label class="flex items-center gap-2 text-xs text-ink-2 select-none cursor-pointer"
          data-testid="budget-show-all-label">
          <input type="checkbox" v-model="showAllCategoriesInBudget"
            class="rounded border-line bg-canvas text-pri-strategic focus:ring-0"
            data-testid="budget-show-all-checkbox" />
          Show all categories
        </label>
      </div>
      <table class="w-full text-sm text-left border-collapse">
        <thead>
          <tr class="border-b border-line pb-2 text-ink-3 uppercase text-[10px] tracking-wider">
            <th class="py-2 pl-3">Category</th>
            <th class="py-2 text-right">Spent YTD</th>
            <th class="py-2 text-right">Yearly Budget</th>
            <th class="py-2 text-right pl-4 pr-3 w-36">Usage</th>
          </tr>
        </thead>
        <tbody>
          <template v-for="group in groupedBudgets" :key="group.scope">
            <!-- Scope Section Header Row -->
            <tr class="bg-elevated/60 border-b border-line font-bold" :class="{
              'text-pri-strategic border-b border-pri-strategic-bd/50': group.scope === 'income' || group.scope === 'asset',
              'text-pri-critical border-b border-pri-critical-bd/50': group.scope === 'expense' || group.scope === 'liability',
              'text-pri-interruptive border-b border-pri-interruptive-bd/50': group.scope === 'investment'
            }">
              <td colspan="4" class="py-2.5 px-3 text-xs uppercase tracking-wider">
                {{ group.label }}
              </td>
            </tr>

            <!-- Subgroups -->
            <template v-for="sub in group.subGroups" :key="sub.name">
              <!-- Subgroup Header Row -->
              <tr class="bg-elevated/20 border-b border-line/60 font-semibold text-ink">
                <td class="py-2.5 pl-6 capitalize text-xs">{{ sub.name }}</td>
                <td class="py-2.5 text-right font-mono text-ink-2">{{ inr(sub.actual) }}</td>
                <td class="py-2.5 text-right font-mono text-ink-2 pr-2">{{ inr(sub.budget) }}</td>
                <td class="py-2.5 text-right pl-4 pr-3">
                  <div class="flex items-center justify-end gap-2">
                    <div class="w-20 bg-line rounded-full h-1.5 overflow-hidden">
                      <div class="h-full rounded-full transition-all duration-300"
                        :class="sub.progress > 100 ? 'bg-pri-critical' : sub.progress > 80 ? 'bg-pri-interruptive' : 'bg-pri-strategic'"
                        :style="{ width: `${Math.min(100, sub.progress)}%` }"></div>
                    </div>
                    <span class="font-mono text-xs w-10 block text-right"
                      :class="sub.progress > 100 ? 'text-pri-critical font-semibold' : 'text-ink-3'">
                      {{ sub.progress.toFixed(0) }}%
                    </span>
                  </div>
                </td>
              </tr>

              <!-- Category Rows -->
              <tr v-for="item in sub.items" :key="item.category.id"
                class="border-b border-line/40 hover:bg-canvas/30 transition-colors">
                <td class="py-2.5 pl-10 capitalize font-medium text-ink-2">{{ label(item.category.name) }}</td>
                <td class="py-2.5 text-right font-mono text-ink-3">{{ inr(item.actual) }}</td>
                <td class="py-2.5 text-right">
                  <input type="number" :value="item.budget || ''"
                    @change="e => saveCategoryBudget(item.category, e.target.value)" placeholder="Set yearly limit"
                    class="bg-canvas border border-line rounded px-2 py-1 text-right w-28 text-sm outline-none focus:border-line-2 font-mono" />
                </td>
                <td class="py-2.5 text-right pl-4 pr-3">
                  <div class="flex items-center justify-end gap-2">
                    <div class="w-20 bg-line rounded-full h-1.5 overflow-hidden">
                      <div class="h-full rounded-full transition-all duration-300"
                        :class="item.progress > 100 ? 'bg-pri-critical' : item.progress > 80 ? 'bg-pri-interruptive' : 'bg-pri-strategic'"
                        :style="{ width: `${Math.min(100, item.progress)}%` }"></div>
                    </div>
                    <span class="font-mono text-xs w-10 block text-right"
                      :class="item.progress > 100 ? 'text-pri-critical font-semibold' : 'text-ink-2'">
                      {{ item.progress.toFixed(0) }}%
                    </span>
                  </div>
                </td>
              </tr>
            </template>

            <!-- Scope Total Row -->
            <tr class="bg-canvas/40 border-b-2 border-line font-bold text-ink">
              <td class="py-2.5 pl-3 text-xs uppercase tracking-wider">Total {{ group.label }}</td>
              <td class="py-2.5 text-right font-mono">{{ inr(group.actual) }}</td>
              <td class="py-2.5 text-right font-mono pr-2">{{ inr(group.budget) }}</td>
              <td class="py-2.5 text-right pl-4 pr-3">
                <div class="flex items-center justify-end gap-2">
                  <div class="w-20 bg-line rounded-full h-1.5 overflow-hidden">
                    <div class="h-full rounded-full transition-all duration-300"
                      :class="group.progress > 100 ? 'bg-pri-critical' : group.progress > 80 ? 'bg-pri-interruptive' : 'bg-pri-strategic'"
                      :style="{ width: `${Math.min(100, group.progress)}%` }"></div>
                  </div>
                  <span class="font-mono text-xs w-10 block text-right"
                    :class="group.progress > 100 ? 'text-pri-critical font-semibold' : 'text-ink'">
                    {{ group.progress.toFixed(0) }}%
                  </span>
                </div>
              </td>
            </tr>
          </template>
          <tr v-if="!groupedBudgets.length">
            <td colspan="4" class="py-6 text-center text-ink-3 italic">
              No active categories.
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
