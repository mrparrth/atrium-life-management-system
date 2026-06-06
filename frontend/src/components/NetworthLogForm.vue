<script setup>
import { ref, computed, watch } from 'vue'
import { useFinanceStore } from '@/stores/finance'
import { useUIStore } from '@/stores/ui'
import { inr } from '@/lib/money'
import { X, Plus } from 'lucide-vue-next'
import { onKeyStroke } from '@vueuse/core'

const props = defineProps({
  initial: { type: Object, default: null }, // edit mode
})
const emit = defineEmits(['close', 'saved'])

const finance = useFinanceStore()
const ui = useUIStore()

const date = ref(props.initial?.date || new Date().toISOString().slice(0, 10))
const note = ref(props.initial?.note || '')

// Build the working map: scope+category → value
const valuesMap = ref({})
function makeKey(type, category) { return `${type}::${category}` }

function initValues() {
  const map = {}
  for (const scope of ['asset', 'liability']) {
    for (const cat of finance.visibleCategoriesForScope(scope, props.initial)) {
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

const totalAssets = computed(() => {
  return Object.keys(valuesMap.value).filter(k => k.startsWith('asset::')).reduce((s, k) => s + (+valuesMap.value[k] || 0), 0)
})
const totalLiabs = computed(() => {
  return Object.keys(valuesMap.value).filter(k => k.startsWith('liability::')).reduce((s, k) => s + (+valuesMap.value[k] || 0), 0)
})
const netTotal = computed(() => totalAssets.value - totalLiabs.value)

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
    await finance.updateNetworthLog(props.initial.id, { date: date.value, entries, note: note.value })
    ui.showToast('Updated', 'success')
  } else {
    await finance.addNetworthLog({ date: date.value, entries, note: note.value })
    ui.showToast('Net worth logged', 'success')
  }
  emit('saved')
  emit('close')
}

async function closeForm() {
  const hasValues = Object.values(valuesMap.value).some(v => +v > 0)
  if (hasValues || note.value.trim()) {
    if (!await ui.confirm({ title: 'Discard draft?', message: 'You have unsaved changes. Discard them?' })) return
  }
  emit('close')
}

onKeyStroke('Escape', (e) => {
  e.preventDefault()
  closeForm()
})

const newCatName = ref({ asset: '', liability: '' })
async function addCat(scope) {
  const r = await finance.addCategory(scope, newCatName.value[scope])
  if (r) { newCatName.value[scope] = ''; initValues(); ui.showToast('Category added', 'success') }
  else ui.showToast('Category exists or empty', 'error')
}

function label(name) { return (name || '').replace(/_/g, ' ') }
</script>

<template>
  <div class="fixed inset-0 z-50 flex items-start justify-center pt-12 px-4" data-testid="networth-form">
    <div class="fixed inset-0 bg-ink/40 backdrop-blur-sm" @click="closeForm"></div>
    <form @submit.prevent="save" class="relative w-full max-w-3xl card p-8 animate-rise-in max-h-[88vh] overflow-y-auto">
      <button type="button" class="absolute top-4 right-4 btn-ghost !p-1.5" @click="closeForm"><X class="w-4 h-4" /></button>
      <div class="overline">{{ initial ? 'Edit' : 'Log' }} net worth</div>
      <h2 class="font-serif text-3xl mt-1 mb-6">A picture of today</h2>

      <div class="grid grid-cols-1 md:grid-cols-3 gap-5 mb-8">
        <label class="block md:col-span-1">
          <span class="overline block mb-1">Date</span>
          <input type="date" v-model="date" class="input-block text-sm" data-testid="nw-date" required />
        </label>
        <div class="md:col-span-2 grid grid-cols-3 gap-4">
          <div><div class="overline">Assets</div><div class="font-serif text-xl mt-1">{{ inr(totalAssets) }}</div></div>
          <div><div class="overline">Liabilities</div><div class="font-serif text-xl mt-1">{{ inr(totalLiabs) }}</div></div>
          <div><div class="overline">Net worth</div><div class="font-serif text-xl mt-1" data-testid="nw-form-total">{{ inr(netTotal) }}</div></div>
        </div>
      </div>

      <!-- ASSETS -->
      <div class="mb-8">
        <div class="flex items-center justify-between mb-3">
          <h3 class="overline">Assets</h3>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-3" data-testid="nw-asset-grid">
          <label v-for="c in finance.visibleCategoriesForScope('asset', props.initial)" :key="c.id" class="card p-3 flex items-center gap-3" :data-testid="`nw-input-asset-${c.name}`">
            <span class="flex-1 capitalize text-sm text-ink-2">{{ label(c.name) }}</span>
            <input type="number" min="0" step="any" v-model="valuesMap[`asset::${c.name}`]"
                   class="bg-transparent border-b border-line focus:border-line-2 text-right w-32 px-1 py-1 outline-none" placeholder="0" />
          </label>
        </div>
        <div class="flex items-center gap-2 mt-3">
          <input v-model="newCatName.asset" placeholder="New asset category (e.g. gold)" class="input-block text-sm flex-1" data-testid="nw-newcat-asset" />
          <button type="button" class="btn-ghost text-sm" @click="addCat('asset')" data-testid="nw-newcat-asset-add"><Plus class="w-3.5 h-3.5" /> Add</button>
        </div>
      </div>

      <!-- LIABILITIES -->
      <div class="mb-8">
        <div class="flex items-center justify-between mb-3">
          <h3 class="overline">Liabilities</h3>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-3" data-testid="nw-liability-grid">
          <label v-for="c in finance.visibleCategoriesForScope('liability', props.initial)" :key="c.id" class="card p-3 flex items-center gap-3" :data-testid="`nw-input-liability-${c.name}`">
            <span class="flex-1 capitalize text-sm text-ink-2">{{ label(c.name) }}</span>
            <input type="number" min="0" step="any" v-model="valuesMap[`liability::${c.name}`]"
                   class="bg-transparent border-b border-line focus:border-line-2 text-right w-32 px-1 py-1 outline-none" placeholder="0" />
          </label>
        </div>
        <div class="flex items-center gap-2 mt-3">
          <input v-model="newCatName.liability" placeholder="New liability category" class="input-block text-sm flex-1" data-testid="nw-newcat-liability" />
          <button type="button" class="btn-ghost text-sm" @click="addCat('liability')" data-testid="nw-newcat-liability-add"><Plus class="w-3.5 h-3.5" /> Add</button>
        </div>
      </div>

      <label class="block mb-6">
        <span class="overline block mb-1">Note (optional)</span>
        <textarea v-model="note" rows="2" class="input-block resize-none text-sm" placeholder="Anything to remember about this snapshot…" data-testid="nw-note"></textarea>
      </label>

      <div class="flex justify-end gap-2">
        <button type="button" class="btn-ghost" @click="closeForm">Cancel</button>
        <button type="submit" class="btn-primary" data-testid="nw-save">Save snapshot</button>
      </div>
    </form>
  </div>
</template>
