<script setup>
import { ref, computed, watch } from 'vue'
import { useFinanceStore } from '@/stores/finance'
import { useUIStore } from '@/stores/ui'
import { inr } from '@/lib/money'
import { X, Plus } from 'lucide-vue-next'

const props = defineProps({
  initial: { type: Object, default: null },
})
const emit = defineEmits(['close', 'saved'])

const finance = useFinanceStore()
const ui = useUIStore()

const month = ref(props.initial?.month || new Date().toISOString().slice(0, 7))
const note = ref(props.initial?.note || '')

const valuesMap = ref({})
function makeKey(type, category) { return `${type}::${category}` }

function initValues() {
  const map = {}
  for (const scope of ['income', 'expense', 'investment']) {
    for (const cat of finance.categoriesForScope(scope)) {
      map[makeKey(scope, cat.name)] = 0
    }
  }
  if (props.initial?.entries) {
    for (const e of props.initial.entries) map[makeKey(e.type, e.category)] = +e.value
  }
  valuesMap.value = map
}
initValues()
watch(() => finance.categories.length, initValues)

const totals = computed(() => {
  const o = { income: 0, expense: 0, investment: 0 }
  for (const [k, v] of Object.entries(valuesMap.value)) {
    const [t] = k.split('::'); o[t] += (+v || 0)
  }
  o.net = o.income - o.expense - o.investment
  o.savingsRate = o.income ? ((o.income - o.expense) / o.income) * 100 : 0
  return o
})

async function save() {
  const entries = []
  for (const [k, v] of Object.entries(valuesMap.value)) {
    const num = +v
    if (!num) continue
    const [type, category] = k.split('::')
    entries.push({ type, category, value: num })
  }
  if (!entries.length) { ui.showToast('Add at least one value', 'error'); return }
  if (props.initial) {
    await finance.updateCashflowPeriod(props.initial.id, { month: month.value, entries, note: note.value })
    ui.showToast('Updated', 'success')
  } else {
    await finance.addCashflowPeriod({ month: month.value, entries, note: note.value })
    ui.showToast('Month logged', 'success')
  }
  emit('saved')
  emit('close')
}

const newCatName = ref({ income: '', expense: '', investment: '' })
async function addCat(scope) {
  const r = await finance.addCategory(scope, newCatName.value[scope])
  if (r) { newCatName.value[scope] = ''; initValues(); ui.showToast('Category added', 'success') }
  else ui.showToast('Category exists or empty', 'error')
}

function label(name) { return (name || '').replace(/_/g, ' ') }
const sectionMeta = {
  income: { label: 'Income', tone: 'pri-strategic' },
  expense: { label: 'Expense', tone: 'pri-critical' },
  investment: { label: 'Investment', tone: 'pri-interruptive' },
}
</script>

<template>
  <div class="fixed inset-0 z-50 flex items-start justify-center pt-10 px-4" data-testid="cashflow-form">
    <div class="fixed inset-0 bg-ink/40 backdrop-blur-sm" @click="$emit('close')"></div>
    <form @submit.prevent="save" class="relative w-full max-w-3xl card p-8 animate-rise-in max-h-[90vh] overflow-y-auto">
      <button type="button" class="absolute top-4 right-4 btn-ghost !p-1.5" @click="$emit('close')"><X class="w-4 h-4" /></button>
      <div class="overline">{{ initial ? 'Edit' : 'Log' }} a month</div>
      <h2 class="font-serif text-3xl mt-1 mb-6">A month, in numbers</h2>

      <div class="grid grid-cols-1 md:grid-cols-5 gap-4 mb-8">
        <label class="block md:col-span-1">
          <span class="overline block mb-1">Month</span>
          <input type="month" v-model="month" class="input-block text-sm" data-testid="cf-month" required />
        </label>
        <div class="md:col-span-4 grid grid-cols-4 gap-3">
          <div><div class="overline">Income</div><div class="font-serif text-lg mt-1 text-pri-strategic">{{ inr(totals.income) }}</div></div>
          <div><div class="overline">Expense</div><div class="font-serif text-lg mt-1 text-pri-critical">{{ inr(totals.expense) }}</div></div>
          <div><div class="overline">Invested</div><div class="font-serif text-lg mt-1 text-pri-interruptive">{{ inr(totals.investment) }}</div></div>
          <div><div class="overline">Net</div><div class="font-serif text-lg mt-1" :class="totals.net >= 0 ? 'text-ink' : 'text-pri-critical'" data-testid="cf-form-net">{{ inr(totals.net) }}</div></div>
        </div>
      </div>

      <div v-for="scope in ['income','expense','investment']" :key="scope" class="mb-8">
        <h3 class="overline mb-3" :class="`text-${sectionMeta[scope].tone}`">{{ sectionMeta[scope].label }}</h3>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-3" :data-testid="`cf-grid-${scope}`">
          <label v-for="c in finance.categoriesForScope(scope)" :key="c.id" class="card p-3 flex items-center gap-3" :data-testid="`cf-input-${scope}-${c.name}`">
            <span class="flex-1 capitalize text-sm text-ink-2">{{ label(c.name) }}</span>
            <input type="number" min="0" step="any" v-model="valuesMap[`${scope}::${c.name}`]"
                   class="bg-transparent border-b border-line focus:border-line-2 text-right w-32 px-1 py-1 outline-none" placeholder="0" />
          </label>
        </div>
        <div class="flex items-center gap-2 mt-3">
          <input v-model="newCatName[scope]" :placeholder="`New ${scope} category`" class="input-block text-sm flex-1" :data-testid="`cf-newcat-${scope}`" />
          <button type="button" class="btn-ghost text-sm" @click="addCat(scope)" :data-testid="`cf-newcat-${scope}-add`"><Plus class="w-3.5 h-3.5" /> Add</button>
        </div>
      </div>

      <label class="block mb-6">
        <span class="overline block mb-1">Note (optional)</span>
        <textarea v-model="note" rows="2" class="input-block resize-none text-sm" placeholder="Anything to remember about this month…" data-testid="cf-note"></textarea>
      </label>

      <div class="flex justify-end gap-2">
        <button type="button" class="btn-ghost" @click="$emit('close')">Cancel</button>
        <button type="submit" class="btn-primary" data-testid="cf-save">Save month</button>
      </div>
    </form>
  </div>
</template>
