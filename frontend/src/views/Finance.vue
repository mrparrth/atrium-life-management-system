<script setup>
import { computed, ref } from 'vue'
import { useFinanceStore } from '@/stores/finance'
import { useUIStore } from '@/stores/ui'
import PageHeader from '@/components/PageHeader.vue'
import SectionHeader from '@/components/SectionHeader.vue'
import Sparkline from '@/components/Sparkline.vue'
import EmptyState from '@/components/EmptyState.vue'
import { Plus, X, Trash2, CameraIcon } from 'lucide-vue-next'

const finance = useFinanceStore()
const ui = useUIStore()
const showNew = ref(false)
const form = ref({ name: '', type: 'asset', category: 'cash', value: 0, growthRate: 0, contribution: 0 })

const sparkData = computed(() => finance.snapshots.map(s => s.netWorth))
const fmt = (n) => `$${Math.round(n).toLocaleString()}`

const allocation = computed(() => {
  const entries = Object.entries(finance.allocation)
  const total = entries.reduce((s, [, v]) => s + v, 0) || 1
  return entries.map(([k, v]) => ({ key: k, value: v, pct: (v / total) * 100 }))
})

const projections = computed(() => [1, 3, 5, 10, 20].map(y => ({ year: y, value: finance.project(y) })))

async function addAsset() {
  if (!form.value.name) return
  await finance.addAsset({ ...form.value, value: +form.value.value })
  form.value = { name: '', type: 'asset', category: 'cash', value: 0, growthRate: 0, contribution: 0 }; showNew.value = false
}
async function snap() { await finance.takeSnapshot(); ui.showToast('Snapshot taken', 'success') }
async function remove(a) { if (confirm('Remove?')) await finance.removeAsset(a.id) }
</script>

<template>
  <div class="px-8 md:px-12 py-10 max-w-6xl mx-auto" data-testid="finance-view">
    <PageHeader overline="Memory · Finance" title="Net worth" sub="A long, calm view of what you've gathered.">
      <template #right>
        <button class="btn-ghost" @click="snap" data-testid="finance-snapshot-btn"><CameraIcon class="w-4 h-4" /> Snapshot</button>
        <button class="btn-primary" @click="showNew = true" data-testid="new-asset-btn"><Plus class="w-4 h-4" /> Add asset</button>
      </template>
    </PageHeader>

    <div class="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-10">
      <div class="card p-6 lg:col-span-2">
        <div class="overline">Net worth</div>
        <div class="font-serif text-5xl tracking-tight mt-2" data-testid="finance-net-worth">{{ fmt(finance.netWorth) }}</div>
        <div class="flex items-center gap-6 mt-4 text-sm text-ink-2">
          <span>Assets <span class="text-ink font-medium">{{ fmt(finance.totalAssets) }}</span></span>
          <span>Liabilities <span class="text-ink font-medium">{{ fmt(finance.totalLiabilities) }}</span></span>
        </div>
        <div class="mt-6"><Sparkline :data="sparkData" :height="80" color="rgb(90 115 83)" /></div>
        <div class="text-xs text-ink-3 mt-2">{{ finance.snapshots.length }} snapshots</div>
      </div>
      <div class="card p-6">
        <div class="overline mb-2">Projection</div>
        <ul class="space-y-2.5">
          <li v-for="p in projections" :key="p.year" class="flex items-baseline justify-between" :data-testid="`projection-${p.year}y`">
            <span class="text-ink-2 text-sm">in {{ p.year }} year<span v-if="p.year !== 1">s</span></span>
            <span class="font-serif text-lg">{{ fmt(p.value) }}</span>
          </li>
        </ul>
      </div>
    </div>

    <SectionHeader overline="Distribution" title="Allocation" />
    <div class="card p-6 mb-10">
      <div v-if="allocation.length" class="space-y-3.5">
        <div v-for="a in allocation" :key="a.key">
          <div class="flex items-baseline justify-between text-sm mb-1.5">
            <span class="capitalize text-ink-2">{{ a.key }}</span>
            <span class="text-ink font-medium">{{ fmt(a.value) }} · {{ a.pct.toFixed(0) }}%</span>
          </div>
          <div class="h-1.5 rounded-full bg-elevated overflow-hidden">
            <div class="h-full bg-pri-strategic rounded-full transition-all duration-700" :style="{ width: a.pct + '%' }"></div>
          </div>
        </div>
      </div>
      <EmptyState v-else title="No assets yet" />
    </div>

    <SectionHeader overline="Holdings" title="Assets & liabilities" />
    <div v-if="finance.assets.length" class="card divide-y divide-line">
      <div v-for="a in finance.assets" :key="a.id" class="p-5 flex items-center justify-between gap-4" :data-testid="`asset-row-${a.id}`">
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2"><span class="overline">{{ a.type }} · {{ a.category }}</span></div>
          <div class="font-serif text-lg mt-0.5">{{ a.name }}</div>
          <div v-if="a.growthRate" class="text-xs text-ink-3 mt-0.5">expected {{ a.growthRate }}%/yr<template v-if="a.contribution"> · +${{ a.contribution }}/mo</template></div>
        </div>
        <div class="font-serif text-xl text-ink">{{ fmt(a.value) }}</div>
        <button class="btn-ghost !p-1.5 hover:text-pri-critical" @click="remove(a)"><Trash2 class="w-3.5 h-3.5" /></button>
      </div>
    </div>
    <EmptyState v-else title="No holdings yet" />

    <div v-if="showNew" class="fixed inset-0 z-50 flex items-start justify-center pt-24 px-4">
      <div class="fixed inset-0 bg-ink/40 backdrop-blur-sm" @click="showNew = false"></div>
      <form @submit.prevent="addAsset" class="relative w-full max-w-md card p-8 animate-rise-in">
        <button type="button" class="absolute top-4 right-4 btn-ghost !p-1.5" @click="showNew = false"><X class="w-4 h-4" /></button>
        <div class="overline">New holding</div>
        <h2 class="font-serif text-2xl mt-1 mb-5">Add to the ledger</h2>
        <input v-model="form.name" placeholder="Name…" class="input-soft mb-3" required data-testid="new-asset-name" />
        <div class="grid grid-cols-2 gap-3 mb-3">
          <label class="block"><span class="overline block mb-1">Type</span>
            <select v-model="form.type" class="input-block text-sm"><option>asset</option><option>liability</option></select>
          </label>
          <label class="block"><span class="overline block mb-1">Category</span>
            <select v-model="form.category" class="input-block text-sm"><option>cash</option><option>investments</option><option>retirement</option><option>crypto</option><option>real_estate</option><option>other</option></select>
          </label>
        </div>
        <label class="block mb-3"><span class="overline block mb-1">Value (USD)</span>
          <input type="number" v-model="form.value" class="input-block" required data-testid="new-asset-value" />
        </label>
        <div class="grid grid-cols-2 gap-3 mb-5">
          <label class="block"><span class="overline block mb-1">Growth %/yr</span><input type="number" v-model="form.growthRate" class="input-block" /></label>
          <label class="block"><span class="overline block mb-1">$/month</span><input type="number" v-model="form.contribution" class="input-block" /></label>
        </div>
        <div class="flex justify-end gap-2">
          <button type="button" class="btn-ghost" @click="showNew = false">Cancel</button>
          <button type="submit" class="btn-primary" data-testid="new-asset-save">Save</button>
        </div>
      </form>
    </div>
  </div>
</template>
