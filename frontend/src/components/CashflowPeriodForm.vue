<script setup>
import { ref, computed, watch, nextTick } from 'vue'
import { useFinanceStore } from '@/stores/finance'
import { useUIStore } from '@/stores/ui'
import { inr, inrShort } from '@/lib/money'
import { X, ChevronDown, ChevronRight } from 'lucide-vue-next'
import { onKeyStroke } from '@vueuse/core'

const props = defineProps({
  initial: { type: Object, default: null },
  isCopy: { type: Boolean, default: false }
})
const emit = defineEmits(['close', 'saved'])

const finance = useFinanceStore()
const ui = useUIStore()

const month = ref(props.initial?.month || new Date().toISOString().slice(0, 7))
const note = ref(props.initial?.note || '')

// ── Values ─────────────────────────────────────────────────────
const valuesMap = ref({})
const displayValues = ref({})
function makeKey(type, category) { return `${type}::${category}` }

function initValues() {
  const map = {}
  const dispMap = {}
  for (const scope of ['income', 'investment', 'expense']) {
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
watch(() => finance.categories.length, initValues)

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
  const cleaned = scope === 'investment' ? textValue.replace(/[^0-9.-]/g, '') : textValue.replace(/[^0-9.]/g, '')
  const num = parseFloat(cleaned)
  valuesMap.value[key] = isNaN(num) ? 0 : num
}

function onBlur(scope, catName) {
  const key = makeKey(scope, catName)
  const val = valuesMap.value[key]
  displayValues.value[key] = val === 0 ? '0' : inrShort(val)
}

// ── Totals ──────────────────────────────────────────────────────
const totals = computed(() => {
  const o = { income: 0, expense: 0, investment: 0 }
  for (const [k, v] of Object.entries(valuesMap.value)) {
    const [t] = k.split('::'); o[t] += (+v || 0)
  }
  o.net = o.income - o.expense - o.investment
  o.savingsRate = o.income ? ((o.income - o.expense) / o.income) * 100 : 0
  return o
})

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
    income: ['Active', 'Passive', 'One-Off'],
    investment: ['Equity', 'Debt', 'Debt/Other', 'Bullion', 'Real Estate', 'Illiquid'],
    expense: ['Need', 'Want', 'Business']
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

function groupTotal(scope, cats) {
  return cats.reduce((s, c) => s + (+valuesMap.value[makeKey(scope, c.name)] || 0), 0)
}

// ── Collapse state — all open by default ───────────────────────
const collapsed = ref({})
function initCollapsed() {
  for (const scope of ['income', 'investment', 'expense'])
    for (const group of groupedCategories(scope))
      collapsed.value[`${scope}::${group.name}`] = false
}
initCollapsed()

watch(valuesMap, () => {
  for (const scope of ['income', 'investment', 'expense'])
    for (const group of groupedCategories(scope)) {
      const key = `${scope}::${group.name}`
      if (groupTotal(scope, group.cats) !== 0 && collapsed.value[key]) collapsed.value[key] = false
    }
}, { deep: true })

function toggleGroup(key) { collapsed.value[key] = !collapsed.value[key] }

// ── Save / close ────────────────────────────────────────────────
async function save() {
  const entries = []
  for (const [k, v] of Object.entries(valuesMap.value)) {
    const num = +v
    if (!num) continue
    const [type, category] = k.split('::')
    entries.push({ type, category, value: num })
  }
  if (!entries.length) { ui.showToast('Add at least one value', 'error'); return }

  const exists = finance.cashflowPeriods.some(p => p.month === month.value && (!props.initial || props.isCopy || p.id !== props.initial.id))
  if (exists) {
    const monthFormatted = formatMonth(month.value)
    if (!await ui.confirm({
      title: 'Duplicate Month',
      message: `A cashflow log for ${monthFormatted} already exists. Do you want to save anyway and create a duplicate entry?`
    })) {
      return
    }
  }

  if (props.initial && !props.isCopy) {
    await finance.updateCashflowPeriod(props.initial.id, { month: month.value, entries, note: note.value })
    ui.showToast('Updated', 'success')
  } else {
    await finance.addCashflowPeriod({ month: month.value, entries, note: note.value })
    ui.showToast('Month logged', 'success')
  }
  emit('saved'); emit('close')
}

function formatMonth(m) {
  if (!m) return ''
  const [y, mo] = m.split('-')
  const d = new Date(+y, +mo - 1, 1)
  return d.toLocaleString('en-IN', { month: 'short', year: 'numeric' })
}

async function closeForm() {
  const hasValues = Object.values(valuesMap.value).some(v => +v !== 0)
  if (hasValues || note.value.trim()) {
    if (!await ui.confirm({ title: 'Discard draft?', message: 'You have unsaved changes. Discard them?' })) return
  }
  emit('close')
}

onKeyStroke('Escape', (e) => { e.preventDefault(); closeForm() })

function handleFormKeydown(e) {
  if (e.key === 'Enter') {
    if (e.metaKey || e.ctrlKey) {
      e.preventDefault()
      save()
    } else {
      if (e.target.tagName === 'INPUT' && e.target.type !== 'submit') {
        e.preventDefault()
        if (e.target.classList.contains('cf-input')) {
          const inputs = Array.from(document.querySelectorAll('.cf-input'))
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
  income: { label: 'Income', textClass: 'text-pri-strategic', accentBg: 'bg-pri-strategic/8', dot: 'bg-pri-strategic' },
  expense: { label: 'Expenses', textClass: 'text-pri-critical', accentBg: 'bg-pri-critical/8', dot: 'bg-pri-critical' },
  investment: { label: 'Investment', textClass: 'text-pri-interruptive', accentBg: 'bg-pri-interruptive/8', dot: 'bg-pri-interruptive' },
}
</script>

<template>
  <div class="fixed inset-0 z-50 flex items-center justify-center px-4" data-testid="cashflow-form">
    <div class="fixed inset-0 bg-ink/50 backdrop-blur-md" @click="closeForm"></div>

    <form @submit.prevent="save" @keydown="handleFormKeydown"
      class="cf-modal relative w-full max-w-5xl animate-rise-in flex flex-col overflow-hidden"
      style="max-height: max(90vh, 820px)">

      <!-- ══ HEADER ════════════════════════════════════════════════ -->
      <div class="cf-header shrink-0">

        <!-- Month + close -->
        <div class="flex items-center justify-between px-7 pt-6 pb-5">
          <div>
            <h2 class="font-serif text-2xl text-ink font-semibold tracking-tight">
              {{ (initial && !isCopy) ? "Edit Month's Cashflow" : "Log a Month's Cashflow" }}
            </h2>
          </div>
          <div class="flex items-center gap-3">
            <input type="month" v-model="month" class="cf-month-input" data-testid="cf-month" required />
            <button type="button" class="cf-close-btn" @click="closeForm">
              <X class="w-4 h-4" />
            </button>
          </div>
        </div>

        <!-- Summary strip -->
        <div class="cf-summary-strip">
          <!-- Income -->
          <div class="cf-summary-cell">
            <span class="cf-summary-label">Income</span>
            <span class="cf-summary-value text-pri-strategic">
              {{ totals.income !== 0 ? inr(totals.income) : '—' }}
            </span>
          </div>
          <!-- Investment -->
          <div class="cf-summary-cell">
            <span class="cf-summary-label">Invested</span>
            <span class="cf-summary-value text-pri-interruptive">
              {{ totals.investment !== 0 ? inr(totals.investment) : '—' }}
            </span>
          </div>
          <!-- Expense -->
          <div class="cf-summary-cell">
            <span class="cf-summary-label">Expenses</span>
            <span class="cf-summary-value text-pri-critical">
              {{ totals.expense !== 0 ? inr(totals.expense) : '—' }}
            </span>
          </div>
          <!-- Net — emphasized -->
          <div class="cf-summary-cell cf-summary-net">
            <span class="cf-summary-label">Net</span>
            <span class="cf-summary-value cf-net-value" :class="totals.net >= 0 ? 'text-ink' : 'text-pri-critical'"
              data-testid="cf-form-net">
              {{ inr(totals.net) }}
            </span>
          </div>
        </div>
      </div>

      <!-- ══ BODY ═════════════════════════════════════════════════ -->
      <div class="cf-body overflow-y-auto flex-1">
        <div class="cf-body-grid">
          <div v-for="scope in ['income', 'investment', 'expense']" :key="scope" class="cf-column">

            <!-- Section header — column title -->
            <div class="cf-column-header">
              <div class="flex items-center gap-2">
                <span class="cf-section-dot" :class="scopeMeta[scope].dot"></span>
                <span class="cf-section-title" :class="scopeMeta[scope].textClass">
                  {{ scopeMeta[scope].label }}
                </span>
              </div>
              <span class="cf-section-total" :class="totals[scope] !== 0 ? scopeMeta[scope].textClass : 'text-ink-3/40'">
                {{ totals[scope] !== 0 ? inr(totals[scope]) : '—' }}
              </span>
            </div>

            <!-- Groups stacked vertically inside the column -->
            <div class="flex flex-col">
              <div v-for="group in groupedCategories(scope)" :key="group.name" class="cf-group">

                <!-- Group toggle -->
                <button type="button" class="cf-group-header"
                  :class="collapsed[`${scope}::${group.name}`] ? 'cf-group-collapsed' : 'cf-group-expanded'"
                  @click="toggleGroup(`${scope}::${group.name}`)">
                  <span class="flex items-center gap-2">
                    <component :is="collapsed[`${scope}::${group.name}`] ? ChevronRight : ChevronDown"
                      class="cf-chevron"
                      :class="collapsed[`${scope}::${group.name}`] ? 'text-ink-3' : scopeMeta[scope].textClass" />
                    <span class="cf-group-name"
                      :class="collapsed[`${scope}::${group.name}`] ? 'text-ink-3' : 'text-ink'">
                      {{ group.name }}
                    </span>
                  </span>
                  <span class="cf-group-total"
                    :class="groupTotal(scope, group.cats) !== 0 ? scopeMeta[scope].textClass + ' font-bold' : 'text-ink-3/30'">
                    {{ groupTotal(scope, group.cats) !== 0 ? inr(groupTotal(scope, group.cats)) : '—' }}
                  </span>
                </button>

                <!-- Rows — single-column stacked list -->
                <div v-show="!collapsed[`${scope}::${group.name}`]" class="cf-rows-list">
                  <label v-for="c in group.cats" :key="c.id" class="cf-row-single" :class="`cf-row-hover-${scope}`"
                    :data-testid="`cf-input-${scope}-${c.name}`">
                    <span class="cf-row-label">{{ label(c.name) }}</span>
                    <input type="text" :value="displayValues[makeKey(scope, c.name)]"
                      @focus="onFocus(scope, c.name, $event)" @input="onInput(scope, c.name, $event.target.value)"
                      @blur="onBlur(scope, c.name)" class="cf-input"
                      :class="(+valuesMap[makeKey(scope, c.name)] || 0) !== 0 ? 'cf-input-filled' : 'cf-input-empty'"
                      placeholder="0" />
                  </label>
                </div>
              </div>
            </div>

          </div>
        </div>
        <!-- Notes Row -->
        <div class="px-7 pb-6 pt-2 border-t border-line/40">
          <input v-model="note" class="cf-note-input-line" placeholder="Add a note for this month…" data-testid="cf-note" />
        </div>
      </div>

      <!-- ══ FOOTER ════════════════════════════════════════════════ -->
      <div class="cf-footer shrink-0">
        <div class="flex items-center gap-5 min-w-0">
          <div v-if="totals.income > 0" class="flex items-baseline gap-1.5 shrink-0">
            <span class="cf-overline">Save rate</span>
            <span class="font-mono text-sm font-semibold"
              :class="totals.savingsRate >= 30 ? 'text-pri-strategic' : totals.savingsRate >= 10 ? 'text-pri-interruptive' : 'text-pri-critical'">
              {{ totals.savingsRate.toFixed(0) }}%
            </span>
          </div>
        </div>
        <div class="flex items-center gap-2 shrink-0">
          <button type="button" class="btn-ghost text-sm" @click="closeForm">Cancel</button>
          <button type="submit" class="btn-primary text-sm flex items-center gap-1.5" data-testid="cf-save">
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
.cf-modal {
  background: rgb(var(--surface));
  border-radius: 1.25rem;
  border: 1px solid rgb(var(--line));
  box-shadow: 0 32px 64px -12px rgb(0 0 0 / 0.28), 0 0 0 1px rgb(0 0 0 / 0.04);
}

/* ── Header ────────────────────────────────────────────────────── */
.cf-header {
  background: rgb(var(--surface));
  border-bottom: 1px solid rgb(var(--line));
}

.cf-month-input {
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

.cf-month-input:hover {
  background: rgb(var(--elevated));
  border-color: rgb(var(--line-2));
}

.cf-close-btn {
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

.cf-close-btn:hover {
  color: rgb(var(--ink));
  background: rgb(var(--elevated));
}

/* ── Summary strip ─────────────────────────────────────────────── */
.cf-summary-strip {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  border-top: 1px solid rgb(var(--line));
}

.cf-summary-cell {
  padding: 1.125rem 1.75rem 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  /* No dividing borders — clean open layout */
}

.cf-summary-label {
  font-size: 0.625rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: rgb(var(--ink-3));
}

.cf-summary-value {
  font-family: ui-monospace, 'SF Mono', monospace;
  font-size: 1.625rem;
  font-weight: 700;
  line-height: 1;
  letter-spacing: -0.03em;
  font-variant-numeric: tabular-nums;
}

.cf-net-value {
  font-size: 1.875rem;
  font-weight: 800;
  letter-spacing: -0.04em;
}

/* ── Body ──────────────────────────────────────────────────────── */
.cf-body {
  background: rgb(var(--canvas) / 0.1);
}

.cf-body-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  padding: 0.5rem 1.75rem;
}

@media (max-width: 768px) {
  .cf-body-grid {
    grid-template-columns: 1fr;
    gap: 2.25rem;
    padding: 1.25rem 1.25rem;
  }
}

.cf-column {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.cf-column:not(:last-child) {
  border-right: 1px solid rgb(var(--line) / 0.35);
  padding-right: 1.75rem;
}

@media (max-width: 768px) {
  .cf-column:not(:last-child) {
    border-right: none;
    border-bottom: 1px solid rgb(var(--line) / 0.35);
    padding-right: 0;
    padding-bottom: 1.75rem;
  }
}

/* Column header — top visual anchor */
.cf-column-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.5rem 0.25rem 0.75rem;
  border-bottom: 2px solid rgb(var(--line) / 0.9);
  margin-bottom: 0.25rem;
}

.cf-section-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  flex-shrink: 0;
}

.cf-section-title {
  font-size: 0.6875rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.13em;
}

.cf-section-total {
  font-family: ui-monospace, 'SF Mono', monospace;
  font-size: 1rem;
  font-weight: 700;
  letter-spacing: -0.025em;
  font-variant-numeric: tabular-nums;
  transition: color 0.2s;
}

/* ── Group ─────────────────────────────────────────────────────── */
.cf-group {
  display: flex;
  flex-direction: column;
}

.cf-group-header {
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

.cf-group-expanded {
  border-bottom: 1.5px solid rgb(var(--line) / 0.85);
  background: rgb(var(--elevated) / 0.15);
  border-radius: 6px 6px 0 0;
}

.cf-group-collapsed {
  border-bottom: 1px solid rgb(var(--line) / 0.25);
}

.cf-group-collapsed:hover {
  background: rgb(var(--elevated) / 0.3);
}

.cf-group-expanded:hover {
  background: rgb(var(--elevated) / 0.35);
}

.cf-chevron {
  width: 0.875rem;
  height: 0.875rem;
  flex-shrink: 0;
  transition: color 0.15s;
}

.cf-group-name {
  font-size: 0.72rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  transition: color 0.15s;
}

.cf-group-total {
  font-family: ui-monospace, 'SF Mono', monospace;
  font-size: 0.8125rem;
  font-weight: 600;
  letter-spacing: -0.02em;
  font-variant-numeric: tabular-nums;
  transition: color 0.2s;
}

/* ── Rows — stacked single-column layout ──────────────────────── */
.cf-rows-list {
  display: flex;
  flex-direction: column;
  padding: 0.125rem 0;
}

.cf-row-single {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.1rem 0.5rem;
  cursor: text;
  transition: background 0.15s ease, border-left-color 0.15s ease;
  border-left: 3px solid transparent;
  border-bottom: 1px solid rgb(var(--line) / 0.12);
}

.cf-row-single:last-child {
  border-bottom: none;
}

/* ── Themed hover & focus-within states ── */
.cf-row-hover-income:hover {
  background: rgb(var(--pri-strategic) / 0.04);
  border-left-color: rgb(var(--pri-strategic));
}

.cf-row-hover-income:focus-within {
  background: rgb(var(--pri-strategic) / 0.06);
  border-left-color: rgb(var(--pri-strategic));
}

.cf-row-hover-investment:hover {
  background: rgb(var(--pri-interruptive) / 0.04);
  border-left-color: rgb(var(--pri-interruptive));
}

.cf-row-hover-investment:focus-within {
  background: rgb(var(--pri-interruptive) / 0.06);
  border-left-color: rgb(var(--pri-interruptive));
}

.cf-row-hover-expense:hover {
  background: rgb(var(--pri-critical) / 0.04);
  border-left-color: rgb(var(--pri-critical));
}

.cf-row-hover-expense:focus-within {
  background: rgb(var(--pri-critical) / 0.06);
  border-left-color: rgb(var(--pri-critical));
}

.cf-row-single:hover .cf-row-label {
  color: rgb(var(--ink));
}

.cf-row-single:focus-within {
  background: rgb(var(--surface));
}

.cf-row-label {
  flex: 1;
  font-size: 0.78rem;
  color: rgb(var(--ink));
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  user-select: none;
  transition: color 0.12s ease;
}

.cf-row-single:focus-within .cf-row-label {
  color: rgb(var(--ink));
}

/* ── Input — completely flat, no box ──────────────────────────── */
.cf-input {
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

.cf-input-filled {
  color: rgb(var(--ink));
}

.cf-input-empty {
  color: rgb(var(--ink-3) / 0.55);
}

.cf-input:focus {
  border-bottom-color: rgb(var(--ink-2));
  color: rgb(var(--ink));
}

.cf-input::placeholder {
  color: rgb(var(--ink-3) / 0.3);
  font-weight: 400;
}

/* ── Footer ────────────────────────────────────────────────────── */
.cf-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.875rem 1.75rem;
  background: rgb(var(--surface));
  border-top: 1px solid rgb(var(--line));
}

.cf-overline {
  font-size: 0.625rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: rgb(var(--ink-3));
}

.cf-note-input-line {
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

.cf-note-input-line:focus {
  border-bottom-color: rgb(var(--line-2));
}

.cf-note-input-line::placeholder {
  color: rgb(var(--ink-3) / 0.7);
}
</style>
