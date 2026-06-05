<script setup>
import { computed, ref } from 'vue'
import { useFinanceStore } from '@/stores/finance'
import { useUIStore } from '@/stores/ui'
import PageHeader from '@/components/PageHeader.vue'
import SectionHeader from '@/components/SectionHeader.vue'
import Sparkline from '@/components/Sparkline.vue'
import EmptyState from '@/components/EmptyState.vue'
import { inr, inrCompact } from '@/lib/money'
import { Plus, X, Trash2, Camera, TrendingUp, TrendingDown, PiggyBank, Tag, ArrowDownToLine, ArrowUpFromLine, Wallet } from 'lucide-vue-next'

const finance = useFinanceStore()
const ui = useUIStore()

const tab = ref('overview') // overview | networth | cashflow | categories

const sparkData = computed(() => finance.snapshots.map(s => s.netWorth))
const projections = computed(() => [1, 3, 5, 10, 20].map(y => ({ year: y, value: finance.project(y) })))

const allocation = computed(() => {
  const entries = Object.entries(finance.allocation)
  const total = entries.reduce((s, [, v]) => s + v, 0) || 1
  return entries.map(([k, v]) => ({ key: k, value: v, pct: (v / total) * 100 })).sort((a, b) => b.value - a.value)
})

const expenseBreakdown = computed(() => {
  const entries = Object.entries(finance.expenseByCategory)
  const total = entries.reduce((s, [, v]) => s + v, 0) || 1
  return entries.map(([k, v]) => ({ key: k, value: v, pct: (v / total) * 100 })).sort((a, b) => b.value - a.value)
})

// ───── Asset modal
const showNewAsset = ref(false)
const assetForm = ref({ name: '', type: 'asset', category: 'savings', value: 0, growthRate: 0, contribution: 0 })
function openAssetModal(type = 'asset') {
  assetForm.value = { name: '', type, category: type === 'asset' ? 'savings' : 'credit_card', value: 0, growthRate: 0, contribution: 0 }
  showNewAsset.value = true
}
async function saveAsset() {
  if (!assetForm.value.name) return
  await finance.addAsset(assetForm.value); showNewAsset.value = false
  ui.showToast('Added to ledger', 'success')
}

// ───── Cashflow modal
const showNewFlow = ref(false)
const flowForm = ref({ type: 'expense', name: '', amount: 0, category: 'rent', recurring: 'monthly', date: new Date().toISOString().slice(0, 10) })
function openFlowModal(type = 'expense') {
  const defaults = {
    income: 'salary',
    expense: 'rent',
    investment: 'sip_mutual_fund',
  }
  flowForm.value = { type, name: '', amount: 0, category: defaults[type], recurring: 'monthly', date: new Date().toISOString().slice(0, 10) }
  showNewFlow.value = true
}
async function saveFlow() {
  if (!flowForm.value.name) return
  await finance.addCashflow(flowForm.value); showNewFlow.value = false
  ui.showToast(`${flowForm.value.type} added`, 'success')
}

async function snap() { await finance.takeSnapshot(); ui.showToast('Snapshot taken', 'success') }
async function removeAsset(a) { if (confirm('Remove?')) await finance.removeAsset(a.id) }
async function removeFlow(c) { if (confirm('Remove?')) await finance.removeCashflow(c.id) }

// ───── Category management
const newCatScope = ref('expense')
const newCatName = ref('')
async function addCategoryFn() {
  const created = await finance.addCategory(newCatScope.value, newCatName.value)
  if (!created) { ui.showToast('Category exists or empty', 'error'); return }
  newCatName.value = ''
  ui.showToast('Category added', 'success')
}
async function removeCategoryFn(c) {
  if (confirm(`Remove "${c.name}" from ${c.scope}?`)) await finance.removeCategory(c.id)
}

// Cashflow grouping by type
const flowByType = computed(() => ({
  income: finance.cashflow.filter(c => c.type === 'income'),
  expense: finance.cashflow.filter(c => c.type === 'expense'),
  investment: finance.cashflow.filter(c => c.type === 'investment'),
}))

const assetsList = computed(() => finance.assets.filter(a => a.type === 'asset'))
const liabilitiesList = computed(() => finance.assets.filter(a => a.type === 'liability'))

function categoryLabel(name) {
  return (name || '').replace(/_/g, ' ')
}

const recurringOptions = [
  { v: 'monthly', label: 'Monthly' },
  { v: 'yearly', label: 'Yearly' },
  { v: 'one_time', label: 'One-time' },
]
</script>

<template>
  <div class="px-8 md:px-12 py-10 max-w-6xl mx-auto" data-testid="finance-view">
    <PageHeader overline="Memory · Finance" title="Money, gently tracked" sub="A long, calm view of what you've gathered — and what flows through.">
      <template #right>
        <button class="btn-ghost" @click="snap" data-testid="finance-snapshot-btn"><Camera class="w-4 h-4" /> Snapshot</button>
      </template>
    </PageHeader>

    <!-- TABS -->
    <div class="flex flex-wrap gap-1 bg-elevated rounded-2xl p-1 border border-line text-sm w-fit mb-10" data-testid="finance-tabs">
      <button v-for="t in [{k:'overview',l:'Overview'},{k:'networth',l:'Net worth'},{k:'cashflow',l:'Cash flow'},{k:'categories',l:'Categories'}]"
        :key="t.k" :data-testid="`tab-${t.k}`"
        class="px-4 py-2 rounded-xl transition-colors duration-200"
        :class="tab === t.k ? 'bg-surface text-ink' : 'text-ink-2 hover:text-ink'"
        @click="tab = t.k">{{ t.l }}</button>
    </div>

    <!-- ═══════════════ OVERVIEW ═══════════════ -->
    <template v-if="tab === 'overview'">
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-10">
        <div class="card p-6 lg:col-span-2">
          <div class="overline">Net worth</div>
          <div class="font-serif text-5xl tracking-tight mt-2" data-testid="finance-net-worth">{{ inr(finance.netWorth) }}</div>
          <div class="flex flex-wrap items-center gap-6 mt-4 text-sm text-ink-2">
            <span>Assets <span class="text-ink font-medium">{{ inr(finance.totalAssets) }}</span></span>
            <span>Liabilities <span class="text-ink font-medium">{{ inr(finance.totalLiabilities) }}</span></span>
          </div>
          <div class="mt-6"><Sparkline :data="sparkData" :height="80" color="rgb(90 115 83)" /></div>
          <div class="text-xs text-ink-3 mt-2">{{ finance.snapshots.length }} snapshots</div>
        </div>
        <div class="card p-6">
          <div class="overline mb-2">Projection</div>
          <ul class="space-y-2.5">
            <li v-for="p in projections" :key="p.year" class="flex items-baseline justify-between" :data-testid="`projection-${p.year}y`">
              <span class="text-ink-2 text-sm">in {{ p.year }} year<span v-if="p.year !== 1">s</span></span>
              <span class="font-serif text-lg">{{ inrCompact(p.value) }}</span>
            </li>
          </ul>
        </div>
      </div>

      <!-- Cash flow summary cards -->
      <SectionHeader overline="Monthly cash flow" title="What moves through, each month" hint="Recurring entries, normalised to monthly." />
      <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
        <div class="card p-5" data-testid="kpi-income">
          <div class="flex items-center gap-2 text-pri-strategic"><ArrowDownToLine class="w-3.5 h-3.5" /><span class="overline !text-pri-strategic">Income</span></div>
          <div class="font-serif text-2xl mt-2">{{ inr(finance.monthlyIncome) }}</div>
        </div>
        <div class="card p-5" data-testid="kpi-expenses">
          <div class="flex items-center gap-2 text-pri-critical"><ArrowUpFromLine class="w-3.5 h-3.5" /><span class="overline !text-pri-critical">Expenses</span></div>
          <div class="font-serif text-2xl mt-2">{{ inr(finance.monthlyExpenses) }}</div>
        </div>
        <div class="card p-5" data-testid="kpi-invest">
          <div class="flex items-center gap-2 text-pri-interruptive"><PiggyBank class="w-3.5 h-3.5" /><span class="overline !text-pri-interruptive">Invested</span></div>
          <div class="font-serif text-2xl mt-2">{{ inr(finance.monthlyInvestments) }}</div>
        </div>
        <div class="card p-5" data-testid="kpi-net">
          <div class="flex items-center gap-2"><Wallet class="w-3.5 h-3.5 text-ink-3" /><span class="overline">Net (after invest)</span></div>
          <div class="font-serif text-2xl mt-2" :class="finance.monthlyNet >= 0 ? 'text-ink' : 'text-pri-critical'">{{ inr(finance.monthlyNet) }}</div>
          <div class="text-xs text-ink-3 mt-1">Savings rate {{ finance.savingsRate.toFixed(0) }}%</div>
        </div>
      </div>

      <!-- Allocation -->
      <SectionHeader overline="Distribution" title="Asset allocation" />
      <div class="card p-6 mb-10">
        <div v-if="allocation.length" class="space-y-3.5">
          <div v-for="a in allocation" :key="a.key">
            <div class="flex items-baseline justify-between text-sm mb-1.5">
              <span class="capitalize text-ink-2">{{ categoryLabel(a.key) }}</span>
              <span class="text-ink font-medium">{{ inr(a.value) }} · {{ a.pct.toFixed(0) }}%</span>
            </div>
            <div class="h-1.5 rounded-full bg-elevated overflow-hidden">
              <div class="h-full bg-pri-strategic rounded-full transition-all duration-700" :style="{ width: a.pct + '%' }"></div>
            </div>
          </div>
        </div>
        <EmptyState v-else title="No assets yet" />
      </div>

      <!-- Expense breakdown -->
      <SectionHeader overline="Spending shape" title="Expenses by category" />
      <div class="card p-6">
        <div v-if="expenseBreakdown.length" class="space-y-3.5">
          <div v-for="a in expenseBreakdown" :key="a.key">
            <div class="flex items-baseline justify-between text-sm mb-1.5">
              <span class="capitalize text-ink-2">{{ categoryLabel(a.key) }}</span>
              <span class="text-ink font-medium">{{ inr(a.value) }} · {{ a.pct.toFixed(0) }}%</span>
            </div>
            <div class="h-1.5 rounded-full bg-elevated overflow-hidden">
              <div class="h-full bg-pri-critical/70 rounded-full transition-all duration-700" :style="{ width: a.pct + '%' }"></div>
            </div>
          </div>
        </div>
        <EmptyState v-else title="No expenses yet" />
      </div>
    </template>

    <!-- ═══════════════ NET WORTH ═══════════════ -->
    <template v-else-if="tab === 'networth'">
      <div class="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <div class="overline">Net worth</div>
          <div class="font-serif text-4xl mt-1">{{ inr(finance.netWorth) }}</div>
        </div>
        <div class="flex gap-2">
          <button class="btn-secondary" @click="openAssetModal('liability')" data-testid="new-liability-btn"><TrendingDown class="w-4 h-4" /> Add liability</button>
          <button class="btn-primary" @click="openAssetModal('asset')" data-testid="new-asset-btn"><TrendingUp class="w-4 h-4" /> Add asset</button>
        </div>
      </div>

      <SectionHeader overline="Assets" :title="`${assetsList.length} holdings · ${inr(finance.totalAssets)}`" />
      <div v-if="assetsList.length" class="card divide-y divide-line mb-10">
        <div v-for="a in assetsList" :key="a.id" class="p-5 flex items-center justify-between gap-4" :data-testid="`asset-row-${a.id}`">
          <div class="flex-1 min-w-0">
            <span class="overline capitalize">{{ categoryLabel(a.category) }}</span>
            <div class="font-serif text-lg mt-0.5">{{ a.name }}</div>
            <div v-if="a.growthRate" class="text-xs text-ink-3 mt-0.5">expected {{ a.growthRate }}%/yr<template v-if="a.contribution"> · +{{ inr(a.contribution) }}/mo</template></div>
          </div>
          <div class="font-serif text-xl text-ink">{{ inr(a.value) }}</div>
          <button class="btn-ghost !p-1.5 hover:text-pri-critical" @click="removeAsset(a)" :data-testid="`asset-delete-${a.id}`"><Trash2 class="w-3.5 h-3.5" /></button>
        </div>
      </div>
      <EmptyState v-else title="No assets yet" />

      <SectionHeader overline="Liabilities" :title="`${liabilitiesList.length} · ${inr(finance.totalLiabilities)}`" />
      <div v-if="liabilitiesList.length" class="card divide-y divide-line">
        <div v-for="a in liabilitiesList" :key="a.id" class="p-5 flex items-center justify-between gap-4" :data-testid="`liability-row-${a.id}`">
          <div class="flex-1 min-w-0">
            <span class="overline capitalize">{{ categoryLabel(a.category) }}</span>
            <div class="font-serif text-lg mt-0.5">{{ a.name }}</div>
          </div>
          <div class="font-serif text-xl text-pri-critical">-{{ inr(a.value) }}</div>
          <button class="btn-ghost !p-1.5 hover:text-pri-critical" @click="removeAsset(a)"><Trash2 class="w-3.5 h-3.5" /></button>
        </div>
      </div>
      <EmptyState v-else title="No liabilities" hint="Quietly debt-free." />
    </template>

    <!-- ═══════════════ CASH FLOW ═══════════════ -->
    <template v-else-if="tab === 'cashflow'">
      <div class="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <div class="overline">Monthly net (after investments)</div>
          <div class="font-serif text-4xl mt-1" :class="finance.monthlyNet >= 0 ? 'text-ink' : 'text-pri-critical'">{{ inr(finance.monthlyNet) }}</div>
          <div class="text-sm text-ink-3 mt-1">Savings rate {{ finance.savingsRate.toFixed(0) }}%</div>
        </div>
        <div class="flex flex-wrap gap-2">
          <button class="btn-secondary" @click="openFlowModal('income')" data-testid="new-income-btn"><ArrowDownToLine class="w-4 h-4" /> Income</button>
          <button class="btn-secondary" @click="openFlowModal('expense')" data-testid="new-expense-btn"><ArrowUpFromLine class="w-4 h-4" /> Expense</button>
          <button class="btn-primary" @click="openFlowModal('investment')" data-testid="new-investment-btn"><PiggyBank class="w-4 h-4" /> Investment</button>
        </div>
      </div>

      <template v-for="(items, type) in flowByType" :key="type">
        <SectionHeader :overline="type" :title="`${items.length} entries · ${inr(items.reduce((s, e) => s + (e.recurring === 'yearly' ? +e.amount/12 : e.recurring === 'monthly' ? +e.amount : 0), 0))}/mo`" />
        <div v-if="items.length" class="card divide-y divide-line mb-10">
          <div v-for="c in items" :key="c.id" class="p-5 flex items-center justify-between gap-4" :data-testid="`flow-row-${c.id}`">
            <div class="flex-1 min-w-0">
              <span class="overline capitalize">{{ categoryLabel(c.category) }} · {{ c.recurring.replace('_',' ') }}</span>
              <div class="font-serif text-lg mt-0.5">{{ c.name }}</div>
            </div>
            <div class="font-serif text-xl"
                 :class="type === 'income' ? 'text-pri-strategic' : type === 'expense' ? 'text-pri-critical' : 'text-pri-interruptive'">
              {{ type === 'income' ? '+' : '-' }}{{ inr(c.amount) }}
            </div>
            <button class="btn-ghost !p-1.5 hover:text-pri-critical" @click="removeFlow(c)" :data-testid="`flow-delete-${c.id}`"><Trash2 class="w-3.5 h-3.5" /></button>
          </div>
        </div>
        <EmptyState v-else :title="`No ${type} entries yet`" />
      </template>
    </template>

    <!-- ═══════════════ CATEGORIES ═══════════════ -->
    <template v-else-if="tab === 'categories'">
      <SectionHeader overline="Tags" title="Categories" hint="Add or remove categories for assets, liabilities, income, expenses, and investments." />
      <form @submit.prevent="addCategoryFn" class="card p-5 mb-10 flex flex-wrap gap-3 items-end" data-testid="add-category-form">
        <label class="flex-1 min-w-[140px]">
          <span class="overline block mb-1">Scope</span>
          <select v-model="newCatScope" class="input-block text-sm" data-testid="new-category-scope">
            <option value="asset">Asset</option>
            <option value="liability">Liability</option>
            <option value="income">Income</option>
            <option value="expense">Expense</option>
            <option value="investment">Investment</option>
          </select>
        </label>
        <label class="flex-1 min-w-[200px]">
          <span class="overline block mb-1">Name</span>
          <input v-model="newCatName" placeholder="e.g. gold, school_fees" class="input-block text-sm" data-testid="new-category-name" />
        </label>
        <button type="submit" class="btn-primary" data-testid="new-category-save"><Plus class="w-4 h-4" /> Add</button>
      </form>

      <div v-for="scope in ['asset','liability','income','expense','investment']" :key="scope" class="mb-8">
        <h3 class="overline mb-3 capitalize">{{ scope }}</h3>
        <div class="flex flex-wrap gap-2" :data-testid="`category-group-${scope}`">
          <span v-for="c in finance.categoriesForScope(scope)" :key="c.id"
                class="group inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-line bg-surface text-sm capitalize hover:border-line-2 transition-colors duration-300"
                :data-testid="`category-${scope}-${c.name}`">
            <Tag class="w-3 h-3 text-ink-3" />
            {{ categoryLabel(c.name) }}
            <button @click="removeCategoryFn(c)" class="ml-1 opacity-0 group-hover:opacity-100 hover:text-pri-critical transition-opacity"
                    :data-testid="`category-remove-${c.id}`" :title="`Remove ${c.name}`">
              <X class="w-3 h-3" />
            </button>
          </span>
          <span v-if="!finance.categoriesForScope(scope).length" class="text-sm text-ink-3 italic">None yet.</span>
        </div>
      </div>
    </template>

    <!-- ═══════════════ ASSET MODAL ═══════════════ -->
    <div v-if="showNewAsset" class="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4" data-testid="asset-modal">
      <div class="fixed inset-0 bg-ink/40 backdrop-blur-sm" @click="showNewAsset = false"></div>
      <form @submit.prevent="saveAsset" class="relative w-full max-w-md card p-8 animate-rise-in">
        <button type="button" class="absolute top-4 right-4 btn-ghost !p-1.5" @click="showNewAsset = false"><X class="w-4 h-4" /></button>
        <div class="overline capitalize">New {{ assetForm.type }}</div>
        <h2 class="font-serif text-2xl mt-1 mb-5">Add to the ledger</h2>
        <input v-model="assetForm.name" placeholder="Name…" class="input-soft mb-3" required data-testid="new-asset-name" />
        <div class="grid grid-cols-2 gap-3 mb-3">
          <label class="block"><span class="overline block mb-1">Type</span>
            <select v-model="assetForm.type" class="input-block text-sm">
              <option value="asset">asset</option>
              <option value="liability">liability</option>
            </select>
          </label>
          <label class="block"><span class="overline block mb-1">Category</span>
            <select v-model="assetForm.category" class="input-block text-sm capitalize" data-testid="new-asset-category">
              <option v-for="c in finance.categoriesForScope(assetForm.type)" :key="c.id" :value="c.name">{{ categoryLabel(c.name) }}</option>
            </select>
          </label>
        </div>
        <label class="block mb-3"><span class="overline block mb-1">Value (₹)</span>
          <input type="number" v-model="assetForm.value" class="input-block" required data-testid="new-asset-value" />
        </label>
        <div v-if="assetForm.type === 'asset'" class="grid grid-cols-2 gap-3 mb-5">
          <label class="block"><span class="overline block mb-1">Growth %/yr</span><input type="number" v-model="assetForm.growthRate" class="input-block" /></label>
          <label class="block"><span class="overline block mb-1">₹/month</span><input type="number" v-model="assetForm.contribution" class="input-block" /></label>
        </div>
        <div class="flex justify-end gap-2">
          <button type="button" class="btn-ghost" @click="showNewAsset = false">Cancel</button>
          <button type="submit" class="btn-primary" data-testid="new-asset-save">Save</button>
        </div>
      </form>
    </div>

    <!-- ═══════════════ CASHFLOW MODAL ═══════════════ -->
    <div v-if="showNewFlow" class="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4" data-testid="flow-modal">
      <div class="fixed inset-0 bg-ink/40 backdrop-blur-sm" @click="showNewFlow = false"></div>
      <form @submit.prevent="saveFlow" class="relative w-full max-w-md card p-8 animate-rise-in">
        <button type="button" class="absolute top-4 right-4 btn-ghost !p-1.5" @click="showNewFlow = false"><X class="w-4 h-4" /></button>
        <div class="overline capitalize">New {{ flowForm.type }}</div>
        <h2 class="font-serif text-2xl mt-1 mb-5">{{ flowForm.type === 'income' ? 'Money coming in' : flowForm.type === 'expense' ? 'Money flowing out' : 'Money set aside' }}</h2>
        <input v-model="flowForm.name" placeholder="Name (e.g. Rent, Salary)…" class="input-soft mb-3" required data-testid="new-flow-name" />
        <div class="grid grid-cols-2 gap-3 mb-3">
          <label class="block"><span class="overline block mb-1">Category</span>
            <select v-model="flowForm.category" class="input-block text-sm capitalize" data-testid="new-flow-category">
              <option v-for="c in finance.categoriesForScope(flowForm.type)" :key="c.id" :value="c.name">{{ categoryLabel(c.name) }}</option>
            </select>
          </label>
          <label class="block"><span class="overline block mb-1">Frequency</span>
            <select v-model="flowForm.recurring" class="input-block text-sm" data-testid="new-flow-recurring">
              <option v-for="o in recurringOptions" :key="o.v" :value="o.v">{{ o.label }}</option>
            </select>
          </label>
        </div>
        <label class="block mb-3"><span class="overline block mb-1">Amount (₹)</span>
          <input type="number" v-model="flowForm.amount" class="input-block" required data-testid="new-flow-amount" />
        </label>
        <label class="block mb-5"><span class="overline block mb-1">Date</span>
          <input type="date" v-model="flowForm.date" class="input-block text-sm" />
        </label>
        <div class="flex justify-end gap-2">
          <button type="button" class="btn-ghost" @click="showNewFlow = false">Cancel</button>
          <button type="submit" class="btn-primary" data-testid="new-flow-save">Save</button>
        </div>
      </form>
    </div>
  </div>
</template>
