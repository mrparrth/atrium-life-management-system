<script setup>
import { ref } from 'vue'
import { useFinanceStore } from '@/stores/finance'
import { useUIStore } from '@/stores/ui'
import EmptyState from '@/components/EmptyState.vue'
import { inr } from '@/lib/money'
import { Plus, Edit3, Trash2, ArrowDownToLine, ArrowUpFromLine, PiggyBank, Wallet, ChevronDown, ChevronRight, Copy } from 'lucide-vue-next'

const emit = defineEmits(['open-cf'])

const finance = useFinanceStore()
const ui = useUIStore()

const expanded = ref({})

function togglePeriod(id) {
  expanded.value[id] = !expanded.value[id]
}

async function deleteCf(p) {
  if (!await ui.confirm({ message: `Delete ${formatMonth(p.month)} entry?`, title: 'Delete Month' })) return
  await finance.removeCashflowPeriod(p.id)
  ui.showToast('Month removed', 'success')
}

function formatMonth(m) {
  if (!m) return ''
  const [y, mo] = m.split('-')
  const d = new Date(+y, +mo - 1, 1)
  return d.toLocaleString('en-IN', { month: 'short', year: 'numeric' })
}

function label(s) { return (s || '').replace(/_/g, ' ') }

function filterEntries(p, scope) {
  if (!p || !p.entries) return []
  const list = p.entries.filter(e => e.type === scope)
  
  const getCatGroup = (catName) => {
    const c = finance.categories.find(x => x.scope === scope && x.name === catName)
    return c ? (c.group || 'Other') : 'Other'
  }

  const groupOrder = {
    income: ['Active', 'Passive', 'One-Off'],
    investment: ['Equity', 'Debt', 'Debt/Other', 'Bullion', 'Real Estate', 'Illiquid'],
    expense: ['Need', 'Want', 'Business']
  }
  const scopeGroups = groupOrder[scope] || []

  return list.sort((a, b) => {
    const groupA = getCatGroup(a.category)
    const groupB = getCatGroup(b.category)
    
    const idxA = scopeGroups.indexOf(groupA)
    const idxB = scopeGroups.indexOf(groupB)

    if (idxA !== -1 && idxB !== -1) {
      if (idxA !== idxB) return idxA - idxB
    } else if (idxA !== -1) {
      return -1
    } else if (idxB !== -1) {
      return 1
    } else {
      const cmp = groupA.localeCompare(groupB)
      if (cmp !== 0) return cmp
    }

    return a.category.localeCompare(b.category)
  })
}
</script>

<template>
  <div>
    <div class="flex items-center justify-between mb-6 flex-wrap gap-3">
      <div>
        <div class="overline">Monthly periods</div>
        <div class="font-serif text-3xl mt-1">{{ finance.cashflowPeriods.length }} month<span
            v-if="finance.cashflowPeriods.length !== 1">s</span></div>
      </div>
      <button class="btn-primary" @click="emit('open-cf')" data-testid="cf-add-btn">
        <Plus class="w-4 h-4" /> Log a month's cashflow <span
          class="kbd ml-1.5 !bg-canvas/20 !border-canvas/10 !text-canvas select-none">⌘1</span>
      </button>
    </div>

    <div v-if="finance.cashflowPeriods.length" class="space-y-4">
      <div v-for="p in finance.cashflowPeriods" :key="p.id" class="card overflow-hidden" :data-testid="`cf-period-${p.id}`">
        <!-- Header Toggle Area -->
        <div class="p-5 cursor-pointer select-none hover:bg-canvas/10 transition-colors" @click="togglePeriod(p.id)">
          <div class="flex items-center justify-between gap-4">
            <div class="flex-1 flex flex-col md:flex-row md:items-center gap-x-6 gap-y-2 min-w-0">
              <!-- Month Name with Chevron -->
              <div class="flex items-center gap-2 shrink-0">
                <component :is="expanded[p.id] ? ChevronDown : ChevronRight" class="w-4 h-4 text-ink-3" />
                <div class="overline font-semibold text-ink-2 whitespace-nowrap">{{ formatMonth(p.month) }}</div>
              </div>
              <!-- Totals row on the same line -->
              <div class="flex items-center flex-wrap gap-x-5 gap-y-1">
                <div class="flex items-center gap-1.5">
                  <ArrowDownToLine class="w-3 h-3 text-pri-strategic" />
                  <span class="text-[10px] uppercase font-semibold text-ink-3">In</span>
                  <span class="font-serif text-base font-bold text-pri-strategic">{{ inr(finance.periodTotals(p).income) }}</span>
                </div>
                <div class="flex items-center gap-1.5">
                  <ArrowUpFromLine class="w-3 h-3 text-pri-critical" />
                  <span class="text-[10px] uppercase font-semibold text-ink-3">Out</span>
                  <span class="font-serif text-base font-bold text-pri-critical">{{ inr(finance.periodTotals(p).expense) }}</span>
                </div>
                <div class="flex items-center gap-1.5">
                  <PiggyBank class="w-3 h-3 text-pri-interruptive" />
                  <span class="text-[10px] uppercase font-semibold text-ink-3">Inv</span>
                  <span class="font-serif text-base font-bold text-pri-interruptive">{{ inr(finance.periodTotals(p).investment) }}</span>
                </div>
                <div class="flex items-center gap-1.5">
                  <Wallet class="w-3 h-3 text-ink-3" />
                  <span class="text-[10px] uppercase font-semibold text-ink-3">Net</span>
                  <span class="font-serif text-base font-bold" :class="finance.periodTotals(p).net >= 0 ? 'text-pri-strategic' : 'text-pri-critical'">{{ inr(finance.periodTotals(p).net) }}</span>
                </div>
              </div>
              <!-- Note inline if present -->
              <p v-if="p.note" class="text-xs text-ink-3 italic font-sans truncate flex-1 md:border-l md:border-line/30 md:pl-4 min-w-0" :title="p.note">{{ p.note }}</p>
            </div>
            <div class="flex gap-1 shrink-0" @click.stop>
              <button class="btn-ghost !p-1.5 hover:text-pri-strategic" @click="emit('open-cf', p, true)" :data-testid="`cf-copy-${p.id}`" title="Copy Month">
                <Copy class="w-4 h-4" />
              </button>
              <button class="btn-ghost !p-1.5" @click="emit('open-cf', p)" :data-testid="`cf-edit-${p.id}`">
                <Edit3 class="w-4 h-4" />
              </button>
              <button class="btn-ghost !p-1.5 hover:text-pri-critical" @click="deleteCf(p)"
                :data-testid="`cf-delete-${p.id}`">
                <Trash2 class="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        <!-- Collapsible Details Grid ordered like the form -->
        <div v-show="expanded[p.id]" class="px-6 pb-6 pt-4 border-t border-line bg-canvas/5 animate-fade-in">
          <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
            <!-- Income column -->
            <div class="space-y-3">
              <div class="text-[10px] uppercase tracking-wider font-bold text-pri-strategic border-b border-line/40 pb-1 mb-2">Income</div>
              <div class="space-y-1">
                <div v-for="e in filterEntries(p, 'income')" :key="e.category" class="flex items-baseline justify-between py-1 border-b border-line/10 last:border-b-0">
                  <span class="text-xs text-ink-2 capitalize">{{ label(e.category) }}</span>
                  <span class="text-xs font-mono font-semibold text-pri-strategic">{{ e.value < 0 ? `-${inr(Math.abs(e.value))}` : `+${inr(e.value)}` }}</span>
                </div>
                <div v-if="!filterEntries(p, 'income').length" class="text-xs text-ink-3/40 italic">No income entries</div>
              </div>
            </div>

            <!-- Investment column -->
            <div class="space-y-3">
              <div class="text-[10px] uppercase tracking-wider font-bold text-pri-interruptive border-b border-line/40 pb-1 mb-2">Investment</div>
              <div class="space-y-1">
                <div v-for="e in filterEntries(p, 'investment')" :key="e.category" class="flex items-baseline justify-between py-1 border-b border-line/10 last:border-b-0">
                  <span class="text-xs text-ink-2 capitalize">{{ label(e.category) }}</span>
                  <span class="text-xs font-mono font-semibold text-pri-interruptive">{{ e.value < 0 ? `+${inr(Math.abs(e.value))}` : `-${inr(e.value)}` }}</span>
                </div>
                <div v-if="!filterEntries(p, 'investment').length" class="text-xs text-ink-3/40 italic">No investment entries</div>
              </div>
            </div>

            <!-- Expense column -->
            <div class="space-y-3">
              <div class="text-[10px] uppercase tracking-wider font-bold text-pri-critical border-b border-line/40 pb-1 mb-2">Expenses</div>
              <div class="space-y-1">
                <div v-for="e in filterEntries(p, 'expense')" :key="e.category" class="flex items-baseline justify-between py-1 border-b border-line/10 last:border-b-0">
                  <span class="text-xs text-ink-2 capitalize">{{ label(e.category) }}</span>
                  <span class="text-xs font-mono font-semibold text-pri-critical">{{ e.value < 0 ? `+${inr(Math.abs(e.value))}` : `-${inr(e.value)}` }}</span>
                </div>
                <div v-if="!filterEntries(p, 'expense').length" class="text-xs text-ink-3/40 italic">No expense entries</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    <EmptyState v-else title="No months logged yet" hint="Capture your first month above." />
  </div>
</template>
