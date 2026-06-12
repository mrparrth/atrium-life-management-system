<script setup>
import { ref, computed, watch } from 'vue'
import { useFinanceStore } from '@/stores/finance'
import { useUIStore } from '@/stores/ui'
import { inr } from '@/lib/money'
import { X, ChevronDown, ChevronRight } from 'lucide-vue-next'
import { onKeyStroke } from '@vueuse/core'

const props = defineProps({ initial: { type: Object, default: null } })
const emit = defineEmits(['close', 'saved'])

const finance = useFinanceStore()
const ui = useUIStore()

const month = ref(props.initial?.month || new Date().toISOString().slice(0, 7))
const note = ref(props.initial?.note || '')

// ── Values ─────────────────────────────────────────────────────
const valuesMap = ref({})
function makeKey(type, category) { return `${type}::${category}` }

function initValues() {
  const map = {}
  for (const scope of ['income', 'investment', 'expense'])
    for (const cat of finance.visibleCategoriesForScope(scope, props.initial))
      map[makeKey(scope, cat.name)] = 0
  if (props.initial?.entries)
    for (const e of props.initial.entries) map[makeKey(e.type, e.category)] = +e.value
  valuesMap.value = map
}
initValues()
watch(() => finance.categories.length, initValues)

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
  const groups = {}
  for (const c of cats) {
    const g = c.group || 'Other'
    if (!groups[g]) groups[g] = []
    groups[g].push(c)
  }
  return groups
}

function groupTotal(scope, cats) {
  return cats.reduce((s, c) => s + (+valuesMap.value[makeKey(scope, c.name)] || 0), 0)
}

// ── Collapse state — all open by default ───────────────────────
const collapsed = ref({})
function initCollapsed() {
  for (const scope of ['income', 'investment', 'expense'])
    for (const [gName] of Object.entries(groupedCategories(scope)))
      collapsed.value[`${scope}::${gName}`] = false
}
initCollapsed()

watch(valuesMap, () => {
  for (const scope of ['income', 'investment', 'expense'])
    for (const [gName, cats] of Object.entries(groupedCategories(scope))) {
      const key = `${scope}::${gName}`
      if (groupTotal(scope, cats) > 0 && collapsed.value[key]) collapsed.value[key] = false
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
  if (props.initial) {
    await finance.updateCashflowPeriod(props.initial.id, { month: month.value, entries, note: note.value })
    ui.showToast('Updated', 'success')
  } else {
    await finance.addCashflowPeriod({ month: month.value, entries, note: note.value })
    ui.showToast('Month logged', 'success')
  }
  emit('saved'); emit('close')
}

async function closeForm() {
  const hasValues = Object.values(valuesMap.value).some(v => +v > 0)
  if (hasValues || note.value.trim()) {
    if (!await ui.confirm({ title: 'Discard draft?', message: 'You have unsaved changes. Discard them?' })) return
  }
  emit('close')
}

onKeyStroke('Escape', (e) => { e.preventDefault(); closeForm() })

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

    <form @submit.prevent="save"
      class="cf-modal relative w-full max-w-4xl animate-rise-in flex flex-col overflow-hidden"
      style="max-height: max(90vh, 820px)">

      <!-- ══ HEADER ════════════════════════════════════════════════ -->
      <div class="cf-header shrink-0">

        <!-- Month + close -->
        <div class="flex items-start justify-between px-7 pt-6 pb-5">
          <div>
            <p class="cf-overline mb-1.5">{{ initial ? 'Editing' : 'Log a month' }}</p>
            <input type="month" v-model="month" class="cf-month-input" data-testid="cf-month" required />
          </div>
          <button type="button" class="cf-close-btn" @click="closeForm">
            <X class="w-4 h-4" />
          </button>
        </div>

        <!-- Summary strip -->
        <div class="cf-summary-strip">
          <!-- Income -->
          <div class="cf-summary-cell">
            <span class="cf-summary-label">Income</span>
            <span class="cf-summary-value text-pri-strategic">
              {{ totals.income > 0 ? inr(totals.income) : '—' }}
            </span>
          </div>
          <!-- Investment -->
          <div class="cf-summary-cell">
            <span class="cf-summary-label">Invested</span>
            <span class="cf-summary-value text-pri-interruptive">
              {{ totals.investment > 0 ? inr(totals.investment) : '—' }}
            </span>
          </div>
          <!-- Expense -->
          <div class="cf-summary-cell">
            <span class="cf-summary-label">Expenses</span>
            <span class="cf-summary-value text-pri-critical">
              {{ totals.expense > 0 ? inr(totals.expense) : '—' }}
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

        <div v-for="scope in ['income', 'investment', 'expense']" :key="scope" class="cf-section">

          <!-- Section header — strong anchor -->
          <div class="cf-section-header">
            <div class="flex items-center gap-2.5">
              <span class="cf-section-dot" :class="scopeMeta[scope].dot"></span>
              <span class="cf-section-title" :class="scopeMeta[scope].textClass">
                {{ scopeMeta[scope].label }}
              </span>
            </div>
            <span class="cf-section-total" :class="totals[scope] > 0 ? scopeMeta[scope].textClass : 'text-ink-3/40'">
              {{ totals[scope] > 0 ? inr(totals[scope]) : '—' }}
            </span>
          </div>

          <!-- Groups -->
          <div v-for="(cats, gName) in groupedCategories(scope)" :key="gName" class="cf-group">

            <!-- Group toggle -->
            <button type="button" class="cf-group-header"
              :class="collapsed[`${scope}::${gName}`] ? 'cf-group-collapsed' : 'cf-group-expanded'"
              @click="toggleGroup(`${scope}::${gName}`)">
              <span class="flex items-center gap-2">
                <component :is="collapsed[`${scope}::${gName}`] ? ChevronRight : ChevronDown" class="cf-chevron"
                  :class="collapsed[`${scope}::${gName}`] ? 'text-ink-3' : scopeMeta[scope].textClass" />
                <span class="cf-group-name" :class="collapsed[`${scope}::${gName}`] ? 'text-ink-3' : 'text-ink-2'">
                  {{ gName }}
                </span>
              </span>
              <span class="cf-group-total"
                :class="groupTotal(scope, cats) > 0 ? scopeMeta[scope].textClass : 'text-ink-3/30'">
                {{ groupTotal(scope, cats) > 0 ? inr(groupTotal(scope, cats)) : '—' }}
              </span>
            </button>

            <!-- Rows — 3-col grid, no box borders -->
            <div v-show="!collapsed[`${scope}::${gName}`]" class="cf-rows-grid">
              <label v-for="(c, idx) in cats" :key="c.id" class="cf-row"
                :class="idx % 3 !== 2 ? 'cf-row-divider' : ''" :data-testid="`cf-input-${scope}-${c.name}`">
                <span class="cf-row-label">{{ label(c.name) }}</span>
                <input type="number" min="0" step="any" v-model="valuesMap[makeKey(scope, c.name)]" class="cf-input"
                  :class="(+valuesMap[makeKey(scope, c.name)] || 0) > 0 ? 'cf-input-filled' : 'cf-input-empty'"
                  placeholder="—" @focus="$event.target.select()" />
              </label>
            </div>
          </div>
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
          <input v-model="note" class="cf-note-input min-w-0 flex-1" placeholder="Add a note…" data-testid="cf-note" />
        </div>
        <div class="flex items-center gap-2 shrink-0">
          <button type="button" class="btn-ghost text-sm" @click="closeForm">Cancel</button>
          <button type="submit" class="btn-primary text-sm" data-testid="cf-save">Save month</button>
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
  font-family: var(--font-serif, Georgia, serif);
  font-size: 1.375rem;
  font-weight: 600;
  color: rgb(var(--ink));
  background: transparent;
  border: none;
  outline: none;
  cursor: pointer;
  line-height: 1.2;
  letter-spacing: -0.01em;
  transition: color 0.15s;
}

.cf-month-input:hover {
  color: rgb(var(--ink-2));
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
  background: rgb(var(--canvas) / 0.25);
}

.cf-section {
  border-bottom: 1px solid rgb(var(--line) / 0.3);
}

.cf-section:last-child {
  border-bottom: none;
}

/* Section header — strong visual anchor */
.cf-section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem 1.75rem 0.5rem;
  position: sticky;
  top: 0;
  z-index: 1;
  background: rgb(var(--surface) / 0.98);
  backdrop-filter: blur(10px);
  border-bottom: 1px solid rgb(var(--line) / 0.35);
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
.cf-group {}

.cf-group-header {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.5rem 1.75rem 0.5rem 1.25rem;
  text-align: left;
  border: none;
  cursor: pointer;
  transition: background 0.12s;
}

.cf-group-expanded {
  background: rgb(var(--surface) / 0.5);
  border-bottom: 1px solid rgb(var(--line) / 0.35);
}

.cf-group-collapsed {
  background: transparent;
}

.cf-group-collapsed:hover {
  background: rgb(var(--surface) / 0.6);
}

.cf-group-expanded:hover {
  background: rgb(var(--surface) / 0.8);
}

.cf-chevron {
  width: 0.875rem;
  height: 0.875rem;
  flex-shrink: 0;
  transition: color 0.15s;
}

.cf-group-name {
  font-size: 0.6875rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.09em;
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

/* ── Rows — ledger style, no grid borders ──────────────────────── */
.cf-rows-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  padding: 0.125rem 0;
}

.cf-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.5rem 1.25rem;
  cursor: text;
  transition: background 0.12s ease;
}

.cf-row:hover {
  background: rgb(var(--elevated));
}

.cf-row:hover .cf-row-label {
  color: rgb(var(--ink));
}

.cf-row:focus-within {
  background: rgb(var(--surface));
}

/* Ghost column divider — near invisible */
.cf-row-divider {
  border-right: 1px solid rgb(var(--line) / 0.12);
}

.cf-row-label {
  flex: 1;
  font-size: 0.75rem;
  color: rgb(var(--ink-2));
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  user-select: none;
  transition: color 0.12s ease;
}

.cf-row:focus-within .cf-row-label {
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
  font-weight: 600;
}

.cf-input-empty {
  color: rgb(var(--ink-3) / 0.55);
}

.cf-input:focus {
  border-bottom-color: rgb(var(--ink-2));
  color: rgb(var(--ink));
  font-weight: 600;
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

.cf-note-input {
  font-size: 0.75rem;
  color: rgb(var(--ink-2));
  background: transparent;
  border: none;
  border-bottom: 1px solid transparent;
  outline: none;
  padding: 0.25rem 0;
  transition: border-color 0.15s;
}

.cf-note-input:focus {
  border-bottom-color: rgb(var(--line));
}

.cf-note-input::placeholder {
  color: rgb(var(--ink-3) / 0.4);
}
</style>
