<script setup>
import { ref, computed, watch, nextTick } from 'vue'
import { useFinanceStore } from '@/stores/finance'
import { useUIStore } from '@/stores/ui'
import { inr, inrShort } from '@/lib/money'
import { X, ChevronDown, ChevronRight, Plus } from 'lucide-vue-next'
import { onKeyStroke } from '@vueuse/core'

const props = defineProps({
  initial: { type: Object, default: null }, // edit or copy source
  isCopy: { type: Boolean, default: false }
})
const emit = defineEmits(['close', 'saved'])

const finance = useFinanceStore()
const ui = useUIStore()

const date = ref(props.initial?.date || new Date().toISOString().slice(0, 7))
const note = ref(props.initial?.note || '')

// Build the working map: scope+category → value
const valuesMap = ref({})
const displayValues = ref({})
function makeKey(type, category) { return `${type}::${category}` }

function initValues() {
  const map = {}
  const dispMap = {}
  for (const scope of ['asset', 'liability']) {
    for (const cat of finance.visibleCategoriesForScope(scope, props.initial)) {
      const key = makeKey(scope, cat.name)
      const def = cat.defaultValue ? +cat.defaultValue : 0
      map[key] = def
      dispMap[key] = def === 0 ? '0' : inrShort(def)
    }
  }
  if (props.initial?.entries) {
    for (const e of props.initial.entries) {
      const key = makeKey(e.type, e.category)
      map[key] = +e.value
      dispMap[key] = inrShort(e.value)
    }
  }
  valuesMap.value = map
  displayValues.value = dispMap
}
initValues()

function onFocus(scope, catName, event) {
  const key = makeKey(scope, catName)
  const val = valuesMap.value[key]
  displayValues.value[key] = val === 0 ? '' : val.toString()
  nextTick(() => {
    event?.target?.select()
  })
}

function onInput(scope, catName, textValue) {
  const key = makeKey(scope, catName)
  displayValues.value[key] = textValue
  const cleaned = textValue.replace(/[^0-9.]/g, '')
  const num = parseFloat(cleaned)
  valuesMap.value[key] = isNaN(num) ? 0 : num
}

function onBlur(scope, catName) {
  const key = makeKey(scope, catName)
  const val = valuesMap.value[key]
  displayValues.value[key] = val === 0 ? '0' : inrShort(val)
}

// ── Grouped categories ──────────────────────────────────────────
function groupedCategories(scope) {
  const cats = finance.visibleCategoriesForScope(scope, props.initial)
  const groupsMap = {}
  for (const c of cats) {
    const g = c.group || 'Other'
    if (!groupsMap[g]) groupsMap[g] = []
    groupsMap[g].push(c)
  }

  const order = {
    asset: ['Liquid', 'Fixed'],
    liability: ['Short-term', 'Long-term']
  }

  const scopeOrder = order[scope] || []

  const sortedGroupNames = Object.keys(groupsMap).sort((a, b) => {
    const idxA = scopeOrder.indexOf(a)
    const idxB = scopeOrder.indexOf(b)
    if (idxA !== -1 && idxB !== -1) return idxA - idxB
    if (idxA !== -1) return -1
    if (idxB !== -1) return 1
    return a.localeCompare(b)
  })

  return sortedGroupNames.map(name => ({
    name,
    cats: groupsMap[name]
  }))
}

// ── Collapse state — all open by default ───────────────────────
const collapsed = ref({})
function initCollapsed() {
  for (const scope of ['asset', 'liability'])
    for (const group of groupedCategories(scope))
      collapsed.value[`${scope}::${group.name}`] = false
}
initCollapsed()

watch(() => finance.categories.length, () => {
  initValues()
  initCollapsed()
})

watch(valuesMap, () => {
  for (const scope of ['asset', 'liability'])
    for (const group of groupedCategories(scope)) {
      const key = `${scope}::${group.name}`
      if (groupTotal(scope, group.cats) > 0 && collapsed.value[key]) collapsed.value[key] = false
    }
}, { deep: true })

function toggleGroup(key) { collapsed.value[key] = !collapsed.value[key] }

function groupTotal(scope, cats) {
  return cats.reduce((s, c) => s + (+valuesMap.value[makeKey(scope, c.name)] || 0), 0)
}

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

  const exists = finance.networthLogs.some(l => l.date === date.value && (!props.initial || props.isCopy || l.id !== props.initial.id))
  if (exists) {
    const monthFormatted = formatMonth(date.value)
    if (!await ui.confirm({
      title: 'Duplicate Month',
      message: `A net worth snapshot for ${monthFormatted} already exists. Do you want to save anyway and create a duplicate entry?`
    })) {
      return
    }
  }

  if (props.initial && !props.isCopy) {
    await finance.updateNetworthLog(props.initial.id, { date: date.value, entries, note: note.value })
    ui.showToast('Updated', 'success')
  } else {
    await finance.addNetworthLog({ date: date.value, entries, note: note.value })
    ui.showToast('Net worth logged', 'success')
  }
  emit('saved')
  emit('close')
}

function formatMonth(m) {
  if (!m) return ''
  const [y, mo] = m.split('-')
  const d = new Date(+y, +mo - 1, 1)
  return d.toLocaleString('en-IN', { month: 'short', year: 'numeric' })
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

function handleFormKeydown(e) {
  if (e.key === 'Enter') {
    if (e.metaKey || e.ctrlKey) {
      e.preventDefault()
      save()
    } else {
      if (e.target.tagName === 'INPUT' && e.target.type !== 'submit') {
        e.preventDefault()
        if (e.target.classList.contains('nw-input')) {
          const inputs = Array.from(document.querySelectorAll('.nw-input'))
          const idx = inputs.indexOf(e.target)
          if (idx !== -1 && idx < inputs.length - 1) {
            inputs[idx + 1].focus()
          }
        }
      }
    }
  }
}


function label(name) {
  return (name || '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

const scopeMeta = {
  asset: { label: 'Assets', textClass: 'text-pri-strategic', accentBg: 'bg-pri-strategic/8', dot: 'bg-pri-strategic' },
  liability: { label: 'Liabilities', textClass: 'text-pri-critical', accentBg: 'bg-pri-critical/8', dot: 'bg-pri-critical' },
}
</script>

<template>
  <div class="fixed inset-0 z-50 flex items-center justify-center px-4" data-testid="networth-form">
    <div class="fixed inset-0 bg-ink/50 backdrop-blur-md" @click="closeForm"></div>

    <form @submit.prevent="save" @keydown="handleFormKeydown"
      class="nw-modal relative w-full max-w-4xl animate-rise-in flex flex-col overflow-hidden"
      style="max-height: max(90vh, 720px)">

      <!-- ══ HEADER ════════════════════════════════════════════════ -->
      <div class="nw-header shrink-0">

        <!-- Date + close -->
        <div class="flex items-center justify-between px-7 pt-6 pb-5">
          <div>
            <h2 class="font-serif text-2xl text-ink font-semibold tracking-tight">
              {{ (initial && !isCopy) ? "Edit Month's Net Worth" : "Log a Month's Net Worth" }}
            </h2>
          </div>
          <div class="flex items-center gap-3">
            <input type="month" v-model="date" class="nw-date-input" data-testid="nw-date" required />
            <button type="button" class="nw-close-btn" @click="closeForm">
              <X class="w-4 h-4" />
            </button>
          </div>
        </div>

        <!-- Summary strip -->
        <div class="nw-summary-strip">
          <!-- Assets -->
          <div class="nw-summary-cell">
            <span class="nw-summary-label">Total Assets</span>
            <span class="nw-summary-value text-pri-strategic">
              {{ totalAssets > 0 ? inr(totalAssets) : '—' }}
            </span>
          </div>
          <!-- Liabilities -->
          <div class="nw-summary-cell">
            <span class="nw-summary-label">Total Liabilities</span>
            <span class="nw-summary-value text-pri-critical">
              {{ totalLiabs > 0 ? inr(totalLiabs) : '—' }}
            </span>
          </div>
          <!-- Net Worth — emphasized -->
          <div class="nw-summary-cell nw-summary-net">
            <span class="nw-summary-label">Net Worth</span>
            <span class="nw-summary-value nw-net-value" :class="netTotal >= 0 ? 'text-ink' : 'text-pri-critical'"
              data-testid="nw-form-total">
              {{ inr(netTotal) }}
            </span>
          </div>
        </div>
      </div>

      <!-- ══ BODY ═════════════════════════════════════════════════ -->
      <div class="nw-body overflow-y-auto flex-1">
        <div class="nw-body-grid">
          <div v-for="scope in ['asset', 'liability']" :key="scope" class="nw-column">

            <!-- Section header — column title -->
            <div class="nw-column-header">
              <div class="flex items-center gap-2">
                <span class="nw-section-dot" :class="scopeMeta[scope].dot"></span>
                <span class="nw-section-title" :class="scopeMeta[scope].textClass">
                  {{ scopeMeta[scope].label }}
                </span>
              </div>
              <span class="nw-section-total" :class="(scope === 'asset' ? totalAssets : totalLiabs) > 0 ? scopeMeta[scope].textClass : 'text-ink-3/40'">
                {{ (scope === 'asset' ? totalAssets : totalLiabs) > 0 ? inr(scope === 'asset' ? totalAssets : totalLiabs) : '—' }}
              </span>
            </div>

            <!-- Groups stacked vertically inside the column -->
            <div class="flex flex-col gap-4">
              <div v-for="group in groupedCategories(scope)" :key="group.name" class="nw-group">

                <!-- Group toggle -->
                <button type="button" class="nw-group-header"
                  :class="collapsed[`${scope}::${group.name}`] ? 'nw-group-collapsed' : 'nw-group-expanded'"
                  @click="toggleGroup(`${scope}::${group.name}`)">
                  <span class="flex items-center gap-2">
                    <component :is="collapsed[`${scope}::${group.name}`] ? ChevronRight : ChevronDown" class="nw-chevron"
                      :class="collapsed[`${scope}::${group.name}`] ? 'text-ink-3' : scopeMeta[scope].textClass" />
                    <span class="nw-group-name" :class="collapsed[`${scope}::${group.name}`] ? 'text-ink-3' : 'text-ink'">
                      {{ group.name }}
                    </span>
                  </span>
                  <span class="nw-group-total"
                    :class="groupTotal(scope, group.cats) > 0 ? scopeMeta[scope].textClass + ' font-bold' : 'text-ink-3/30'">
                    {{ groupTotal(scope, group.cats) > 0 ? inr(groupTotal(scope, group.cats)) : '—' }}
                  </span>
                </button>

                <!-- Rows — single-column stacked list -->
                <div v-show="!collapsed[`${scope}::${group.name}`]" class="nw-rows-list">
                  <label v-for="c in group.cats" :key="c.id" class="nw-row-single"
                    :class="`nw-row-hover-${scope}`"
                    :data-testid="`nw-input-${scope}-${c.name}`">
                    <span class="nw-row-label">{{ label(c.name) }}</span>
                    <input type="text"
                      :value="displayValues[makeKey(scope, c.name)]"
                      @focus="onFocus(scope, c.name, $event)"
                      @input="onInput(scope, c.name, $event.target.value)"
                      @blur="onBlur(scope, c.name)"
                      class="nw-input"
                      :class="(+valuesMap[makeKey(scope, c.name)] || 0) > 0 ? 'nw-input-filled' : 'nw-input-empty'"
                      placeholder="0" />
                  </label>
                </div>
              </div>
            </div>

          </div>
        </div>
        <!-- Notes Row -->
        <div class="px-7 pb-6 pt-2 border-t border-line/40">
          <input v-model="note" class="nw-note-input-line" placeholder="Add a month note…" data-testid="nw-note" />
        </div>
      </div>

      <!-- ══ FOOTER ════════════════════════════════════════════════ -->
      <div class="nw-footer shrink-0 justify-end">
        <div class="flex items-center gap-2 shrink-0">
          <button type="button" class="btn-ghost text-sm" @click="closeForm">Cancel</button>
          <button type="submit" class="btn-primary text-sm flex items-center gap-1.5" data-testid="nw-save">
            {{ (initial && !isCopy) ? 'Save changes' : 'Save month' }}
            <span class="kbd !bg-canvas/20 !border-canvas/10 !text-canvas select-none text-[9px] ml-1">⌘Enter</span>
          </button>
        </div>
      </div>
    </form>
  </div>
</template>

<style scoped>
/* ── Modal shell ───────────────────────────────────────────────── */
.nw-modal {
  background: rgb(var(--surface));
  border-radius: 1.25rem;
  border: 1px solid rgb(var(--line));
  box-shadow: 0 32px 64px -12px rgb(0 0 0 / 0.28), 0 0 0 1px rgb(0 0 0 / 0.04);
}

/* ── Header ────────────────────────────────────────────────────── */
.nw-header {
  background: rgb(var(--surface));
  border-bottom: 1px solid rgb(var(--line));
}

.nw-date-input {
  font-family: var(--font-sans, system-ui, sans-serif);
  font-size: 0.875rem;
  font-weight: 500;
  color: rgb(var(--ink));
  background: rgb(var(--elevated) / 0.5);
  border: 1px solid rgb(var(--line));
  border-radius: 0.75rem;
  padding: 0.375rem 0.75rem;
  outline: none;
  cursor: pointer;
  transition: all 0.15s;
}

.nw-date-input:hover {
  background: rgb(var(--elevated));
  border-color: rgb(var(--line-2));
}

.nw-close-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 2rem;
  border-radius: 0.5rem;
  color: rgb(var(--ink-3));
  transition: color 0.15s, background 0.15s;
  border: none;
  cursor: pointer;
  background: transparent;
}

.nw-close-btn:hover {
  color: rgb(var(--ink));
  background: rgb(var(--elevated));
}

/* ── Summary strip ─────────────────────────────────────────────── */
.nw-summary-strip {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  border-top: 1px solid rgb(var(--line));
}

.nw-summary-cell {
  padding: 1.125rem 1.75rem 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.nw-summary-label {
  font-size: 0.625rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: rgb(var(--ink-3));
}

.nw-summary-value {
  font-family: ui-monospace, 'SF Mono', monospace;
  font-size: 1.625rem;
  font-weight: 700;
  line-height: 1;
  letter-spacing: -0.03em;
  font-variant-numeric: tabular-nums;
}

.nw-net-value {
  font-size: 1.875rem;
  font-weight: 800;
  letter-spacing: -0.04em;
}

/* ── Body ──────────────────────────────────────────────────────── */
.nw-body {
  background: rgb(var(--canvas) / 0.1);
}

.nw-body-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 2rem;
  padding: 1.5rem 1.75rem;
}

@media (max-width: 768px) {
  .nw-body-grid {
    grid-template-columns: 1fr;
    gap: 2.25rem;
    padding: 1.25rem 1.25rem;
  }
}

.nw-column {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  min-width: 0;
}

.nw-column:not(:last-child) {
  border-right: 1px solid rgb(var(--line) / 0.35);
  padding-right: 2rem;
}

@media (max-width: 768px) {
  .nw-column:not(:last-child) {
    border-right: none;
    border-bottom: 1px solid rgb(var(--line) / 0.35);
    padding-right: 0;
    padding-bottom: 1.75rem;
  }
}

/* Column header — top visual anchor */
.nw-column-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.5rem 0.25rem 0.75rem;
  border-bottom: 2px solid rgb(var(--line) / 0.9);
  margin-bottom: 0.25rem;
}

.nw-section-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  flex-shrink: 0;
}

.nw-section-title {
  font-size: 0.6875rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.13em;
}

.nw-section-total {
  font-family: ui-monospace, 'SF Mono', monospace;
  font-size: 1rem;
  font-weight: 700;
  letter-spacing: -0.025em;
  font-variant-numeric: tabular-nums;
  transition: color 0.2s;
}

/* ── Group ─────────────────────────────────────────────────────── */
.nw-group {
  display: flex;
  flex-direction: column;
}

.nw-group-header {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.5rem 0.5rem;
  text-align: left;
  border: none;
  cursor: pointer;
  background: transparent;
  transition: all 0.15s ease;
  border-radius: 6px;
}

.nw-group-expanded {
  border-bottom: 1.5px solid rgb(var(--line) / 0.85);
  background: rgb(var(--elevated) / 0.15);
  border-radius: 6px 6px 0 0;
}

.nw-group-collapsed {
  border-bottom: 1px solid rgb(var(--line) / 0.25);
}

.nw-group-collapsed:hover {
  background: rgb(var(--elevated) / 0.3);
}

.nw-group-expanded:hover {
  background: rgb(var(--elevated) / 0.35);
}

.nw-chevron {
  width: 0.875rem;
  height: 0.875rem;
  flex-shrink: 0;
  transition: color 0.15s;
}

.nw-group-name {
  font-size: 0.72rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  transition: color 0.15s;
}

.nw-group-total {
  font-family: ui-monospace, 'SF Mono', monospace;
  font-size: 0.8125rem;
  font-weight: 600;
  letter-spacing: -0.02em;
  font-variant-numeric: tabular-nums;
  transition: color 0.2s;
}

/* ── Rows — stacked single-column layout ──────────────────────── */
.nw-rows-list {
  display: flex;
  flex-direction: column;
  padding: 0.125rem 0;
}

.nw-row-single {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.3rem 0.5rem;
  cursor: text;
  transition: background 0.15s ease;
  border-bottom: 1px solid rgb(var(--line) / 0.12);
}

.nw-row-single:last-child {
  border-bottom: none;
}

/* ── Themed hover & focus-within states ── */
.nw-row-hover-asset:hover {
  background: rgb(var(--pri-strategic) / 0.04);
}
.nw-row-hover-asset:focus-within {
  background: rgb(var(--pri-strategic) / 0.06);
}

.nw-row-hover-liability:hover {
  background: rgb(var(--pri-critical) / 0.04);
}
.nw-row-hover-liability:focus-within {
  background: rgb(var(--pri-critical) / 0.06);
}

.nw-row-single:hover .nw-row-label {
  color: rgb(var(--ink));
}

.nw-row-single:focus-within {
  background: rgb(var(--surface));
}

.nw-row-label {
  flex: 1;
  font-size: 0.78rem;
  color: rgb(var(--ink-2));
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  user-select: none;
  transition: color 0.12s ease;
}

.nw-row-single:focus-within .nw-row-label {
  color: rgb(var(--ink));
}

/* ── Input — completely flat, no box ──────────────────────────── */
.nw-input {
  -webkit-appearance: none;
  -moz-appearance: textfield;
  appearance: none;
  box-sizing: border-box;
  background: transparent;
  border: none;
  border-bottom: 2px solid transparent;
  border-radius: 0;
  outline: none;
  box-shadow: none;

  width: 6.5rem;
  min-width: 5rem;
  flex-shrink: 0;
  text-align: right;
  padding: 0.2rem 0;

  font-family: ui-monospace, 'SF Mono', 'Cascadia Code', monospace;
  font-size: 0.8125rem;
  font-weight: 500;
  line-height: 1.25;
  letter-spacing: -0.02em;
  font-variant-numeric: tabular-nums;
  transition: border-color 0.12s ease, color 0.12s ease;
}

.nw-input-filled {
  color: rgb(var(--ink));
}

.nw-input-empty {
  color: rgb(var(--ink-3) / 0.55);
}

.nw-input:focus {
  border-bottom-color: rgb(var(--ink-2));
  border-top-color: transparent;
  border-left-color: transparent;
  border-right-color: transparent;
  color: rgb(var(--ink));
  outline: 2px solid transparent !important;
  outline-offset: 2px !important;
  box-shadow: none !important;
}

.nw-input::placeholder {
  color: rgb(var(--ink-3) / 0.3);
  font-weight: 400;
}

/* ── Inline Quick Add ── */
.nw-inline-input {
  font-size: 0.75rem;
  color: rgb(var(--ink-2));
  background: transparent;
  border: none;
  border-bottom: 1px solid transparent;
  outline: none;
  padding: 0.25rem 0;
  transition: border-color 0.15s;
}

.nw-inline-input:focus {
  border-bottom-color: rgb(var(--line));
}

.nw-inline-input::placeholder {
  color: rgb(var(--ink-3) / 0.45);
}

/* ── Footer ────────────────────────────────────────────────────── */
.nw-footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 1rem;
  padding: 0.875rem 1.75rem;
  background: rgb(var(--surface));
  border-top: 1px solid rgb(var(--line));
}

.nw-note-input-line {
  font-family: var(--font-sans, system-ui, sans-serif);
  font-size: 0.875rem;
  color: rgb(var(--ink));
  background: transparent;
  border: none;
  border-bottom: 1px solid rgb(var(--line));
  outline: none;
  padding: 0.5rem 0;
  transition: border-color 0.2s;
  width: 100%;
}

.nw-note-input-line:focus {
  border-bottom-color: rgb(var(--line-2));
}

.nw-note-input-line::placeholder {
  color: rgb(var(--ink-3) / 0.7);
}
</style>
