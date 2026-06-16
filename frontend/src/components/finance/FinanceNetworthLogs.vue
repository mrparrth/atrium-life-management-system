<script setup>
import { ref } from 'vue'
import { useFinanceStore } from '@/stores/finance'
import { useUIStore } from '@/stores/ui'
import EmptyState from '@/components/EmptyState.vue'
import { inr } from '@/lib/money'
import { Plus, Edit3, Trash2, ChevronDown, ChevronRight, Copy, TrendingUp, TrendingDown, Wallet } from 'lucide-vue-next'

const emit = defineEmits(['open-nw'])

const finance = useFinanceStore()
const ui = useUIStore()

const expanded = ref({})

function togglePeriod(id) {
  expanded.value[id] = !expanded.value[id]
}

async function deleteNw(log) {
  if (!await ui.confirm({ message: `Delete net worth snapshot for ${formatMonth(log.date)}?`, title: 'Delete Month' })) return
  await finance.removeNetworthLog(log.id)
  ui.showToast('Month removed', 'success')
}

function formatMonth(m) {
  if (!m) return ''
  const [y, mo] = m.split('-')
  const d = new Date(+y, +mo - 1, 1)
  return d.toLocaleString('en-IN', { month: 'short', year: 'numeric' })
}

function label(s) { return (s || '').replace(/_/g, ' ') }

function filterEntries(log, scope) {
  if (!log || !log.entries) return []
  const list = log.entries.filter(e => e.type === scope)

  const getCatGroup = (catName) => {
    const c = finance.categories.find(x => x.scope === scope && x.name === catName)
    return c ? (c.group || 'Other') : 'Other'
  }

  const groupOrder = {
    asset: ['Liquid', 'Fixed'],
    liability: ['Short-term', 'Long-term']
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
        <div class="overline">Monthly snapshots</div>
        <div class="font-serif text-3xl mt-1">{{ finance.networthLogs.length }} month<span
            v-if="finance.networthLogs.length !== 1">s</span></div>
      </div>
      <button class="btn-primary" @click="emit('open-nw')" data-testid="nw-add-btn">
        <Plus class="w-4 h-4" /> Log net worth <span
          class="kbd ml-1.5 !bg-canvas/20 !border-canvas/10 !text-canvas select-none">⌘1</span>
      </button>
    </div>

    <div v-if="finance.networthLogs.length" class="space-y-4">
      <div v-for="log in finance.networthLogs" :key="log.id" class="card overflow-hidden" :data-testid="`nw-log-${log.id}`">
        <!-- Header Toggle Area -->
        <div class="p-5 cursor-pointer select-none hover:bg-canvas/10 transition-colors" @click="togglePeriod(log.id)">
          <div class="flex items-center justify-between gap-4">
            <div class="flex-1 flex flex-col md:flex-row md:items-center gap-x-6 gap-y-2 min-w-0">
              <!-- Month Name with Chevron -->
              <div class="flex items-center gap-2 shrink-0">
                <component :is="expanded[log.id] ? ChevronDown : ChevronRight" class="w-4 h-4 text-ink-3" />
                <div class="overline font-semibold text-ink-2 whitespace-nowrap">{{ formatMonth(log.date) }}</div>
              </div>
              <!-- Totals row on the same line -->
              <div class="flex items-center flex-wrap gap-x-5 gap-y-1">
                <div class="flex items-center gap-1.5">
                  <TrendingUp class="w-3 h-3 text-pri-strategic" />
                  <span class="text-[10px] uppercase font-semibold text-ink-3">Assets</span>
                  <span class="font-serif text-base font-bold text-pri-strategic">{{ inr(finance.logAssets(log)) }}</span>
                </div>
                <div class="flex items-center gap-1.5">
                  <TrendingDown class="w-3 h-3 text-pri-critical" />
                  <span class="text-[10px] uppercase font-semibold text-ink-3">Liabilities</span>
                  <span class="font-serif text-base font-bold text-pri-critical">{{ inr(finance.logLiabilities(log)) }}</span>
                </div>
                <div class="flex items-center gap-1.5">
                  <Wallet class="w-3 h-3 text-ink-3" />
                  <span class="text-[10px] uppercase font-semibold text-ink-3">Net</span>
                  <span class="font-serif text-base font-bold" :class="finance.logTotal(log) >= 0 ? 'text-pri-strategic' : 'text-pri-critical'">{{ inr(finance.logTotal(log)) }}</span>
                </div>
              </div>
              <!-- Note inline if present -->
              <p v-if="log.note" class="text-xs text-ink-3 italic font-sans truncate flex-1 md:border-l md:border-line/30 md:pl-4 min-w-0" :title="log.note">{{ log.note }}</p>
            </div>
            <div class="flex gap-1 shrink-0" @click.stop>
              <button class="btn-ghost !p-1.5 hover:text-pri-strategic" @click="emit('open-nw', log, true)" :data-testid="`nw-copy-${log.id}`" title="Copy Month">
                <Copy class="w-4 h-4" />
              </button>
              <button class="btn-ghost !p-1.5" @click="emit('open-nw', log)" :data-testid="`nw-edit-${log.id}`">
                <Edit3 class="w-4 h-4" />
              </button>
              <button class="btn-ghost !p-1.5 hover:text-pri-critical" @click="deleteNw(log)"
                :data-testid="`nw-delete-${log.id}`">
                <Trash2 class="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        <!-- Collapsible Details Grid ordered like the form -->
        <div v-show="expanded[log.id]" class="px-6 pb-6 pt-4 border-t border-line bg-canvas/5 animate-fade-in">
          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <!-- Assets column -->
            <div class="space-y-3">
              <div class="text-[10px] uppercase tracking-wider font-bold text-pri-strategic border-b border-line/40 pb-1 mb-2">Assets</div>
              <div class="space-y-1">
                <div v-for="e in filterEntries(log, 'asset')" :key="e.category" class="flex items-baseline justify-between py-1 border-b border-line/10 last:border-b-0">
                  <span class="text-xs text-ink-2 capitalize">{{ label(e.category) }}</span>
                  <span class="text-xs font-mono font-semibold text-pri-strategic">+{{ inr(e.value) }}</span>
                </div>
                <div v-if="!filterEntries(log, 'asset').length" class="text-xs text-ink-3/40 italic">No asset entries</div>
              </div>
            </div>

            <!-- Liabilities column -->
            <div class="space-y-3">
              <div class="text-[10px] uppercase tracking-wider font-bold text-pri-critical border-b border-line/40 pb-1 mb-2">Liabilities</div>
              <div class="space-y-1">
                <div v-for="e in filterEntries(log, 'liability')" :key="e.category" class="flex items-baseline justify-between py-1 border-b border-line/10 last:border-b-0">
                  <span class="text-xs text-ink-2 capitalize">{{ label(e.category) }}</span>
                  <span class="text-xs font-mono font-semibold text-pri-critical">-{{ inr(e.value) }}</span>
                </div>
                <div v-if="!filterEntries(log, 'liability').length" class="text-xs text-ink-3/40 italic">No liability entries</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    <EmptyState v-else title="No snapshots yet" hint="Log your first net worth above." />
  </div>
</template>
