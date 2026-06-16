<script setup>
import { ref, computed, watch, nextTick } from 'vue'
import { useFinanceStore } from '@/stores/finance'
import { useUIStore } from '@/stores/ui'
import EmptyState from '@/components/EmptyState.vue'
import { inr } from '@/lib/money'
import { 
  Plus, Edit3, Trash2, Calendar, CreditCard, Play, Pause, X, AlertTriangle, ArrowUpDown, ChevronDown
} from 'lucide-vue-next'

const finance = useFinanceStore()
const ui = useUIStore()

// State
const filterStatus = ref('all') // 'all' | 'active' | 'paused'
const sortBy = ref('nextRenewal') // 'name' | 'cost' | 'nextRenewal'
const showModal = ref(false)
const formNameInput = ref(null)
watch(showModal, (open) => {
  if (open) {
    nextTick(() => {
      formNameInput.value?.focus()
    })
  }
})
const editingSub = ref(null)

// Form Fields
const formName = ref('')
const formCost = ref('')
const formCurrency = ref('INR')
const formBillingPeriod = ref('monthly')
const formNextRenewal = ref(new Date().toISOString().slice(0, 10))
const formCategory = ref('')
const formStatus = ref('active')

// Computeds
const expenseCategories = computed(() => {
  return finance.categories.filter(c => c.scope === 'expense' && !c.archived)
})

const daysRemaining = (dateStr) => {
  if (!dateStr) return 0
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const ren = new Date(dateStr)
  ren.setHours(0, 0, 0, 0)
  const diffTime = ren - today
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24))
}

const formatDaysRemaining = (dateStr) => {
  const diff = daysRemaining(dateStr)
  if (diff < 0) return `${Math.abs(diff)} days ago`
  if (diff === 0) return 'Today'
  if (diff === 1) return 'Tomorrow'
  return `In ${diff} days`
}

const filteredAndSortedSubscriptions = computed(() => {
  let list = [...finance.subscriptions]
  
  if (filterStatus.value !== 'all') {
    list = list.filter(s => s.status === filterStatus.value)
  }
  
  return list.sort((a, b) => {
    if (sortBy.value === 'name') {
      return a.name.localeCompare(b.name)
    } else if (sortBy.value === 'cost') {
      const costA = a.billingPeriod === 'yearly' ? a.cost / 12 : a.cost
      const costB = b.billingPeriod === 'yearly' ? b.cost / 12 : b.cost
      return costB - costA // High to low
    } else if (sortBy.value === 'nextRenewal') {
      return a.nextRenewal.localeCompare(b.nextRenewal)
    }
    return 0
  })
})

const stats = computed(() => {
  const activeSubs = finance.subscriptions.filter(s => s.status === 'active')
  
  const monthlySum = activeSubs.reduce((sum, s) => {
    const cost = +s.cost || 0
    return sum + (s.billingPeriod === 'yearly' ? cost / 12 : cost)
  }, 0)
  
  const yearlySum = activeSubs.reduce((sum, s) => {
    const cost = +s.cost || 0
    return sum + (s.billingPeriod === 'monthly' ? cost * 12 : cost)
  }, 0)
  
  return {
    monthly: monthlySum,
    yearly: yearlySum,
    count: activeSubs.length,
    totalCount: finance.subscriptions.length
  }
})

// Methods
function openAddModal() {
  editingSub.value = null
  formName.value = ''
  formCost.value = ''
  formCurrency.value = 'INR'
  formBillingPeriod.value = 'monthly'
  formNextRenewal.value = new Date().toISOString().slice(0, 10)
  
  const defaultCat = expenseCategories.value.find(
    c => c.name === 'subscriptions_and_entertainment' || c.name === 'subscriptions' || c.name.includes('subscription')
  )
  formCategory.value = defaultCat ? defaultCat.name : (expenseCategories.value[0]?.name || '')
  
  formStatus.value = 'active'
  showModal.value = true
}

function openEditModal(sub) {
  editingSub.value = sub
  formName.value = sub.name
  formCost.value = sub.cost
  formCurrency.value = sub.currency || 'INR'
  formBillingPeriod.value = sub.billingPeriod || 'monthly'
  formNextRenewal.value = sub.nextRenewal || new Date().toISOString().slice(0, 10)
  formCategory.value = sub.category || ''
  formStatus.value = sub.status || 'active'
  showModal.value = true
}

async function saveSubscription() {
  const payload = {
    name: formName.value.trim(),
    cost: +formCost.value || 0,
    currency: formCurrency.value,
    billingPeriod: formBillingPeriod.value,
    nextRenewal: formNextRenewal.value,
    category: formCategory.value,
    status: formStatus.value
  }

  if (!payload.name) {
    ui.showToast('Please enter a subscription name', 'error')
    return
  }

  if (editingSub.value) {
    await finance.updateSubscription(editingSub.value.id, payload)
    ui.showToast('Subscription updated', 'success')
  } else {
    await finance.addSubscription(payload)
    ui.showToast('Subscription added', 'success')
  }
  
  showModal.value = false
}

async function toggleStatus(sub) {
  const newStatus = sub.status === 'active' ? 'paused' : 'active'
  await finance.updateSubscription(sub.id, { status: newStatus })
  ui.showToast(`Subscription ${newStatus === 'active' ? 'resumed' : 'paused'}`, 'success')
}

async function deleteSub(sub) {
  if (await ui.confirm({ 
    title: 'Delete Subscription', 
    message: `Are you sure you want to delete "${sub.name}"?` 
  })) {
    await finance.removeSubscription(sub.id)
    ui.showToast('Subscription deleted', 'success')
  }
}

function label(s) { return (s || '').replace(/_/g, ' ') }
</script>

<template>
  <div>
    <!-- Stats Row -->
    <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
      <div class="card p-6 flex flex-col justify-between">
        <div>
          <div class="overline text-ink-3">Monthly Outflow</div>
          <div class="font-serif text-3xl font-bold text-pri-critical mt-1">{{ inr(stats.monthly) }}</div>
        </div>
        <div class="text-xs text-ink-3 mt-4">Equivalent active spend per month</div>
      </div>
      <div class="card p-6 flex flex-col justify-between">
        <div>
          <div class="overline text-ink-3">Yearly Outflow</div>
          <div class="font-serif text-3xl font-bold text-pri-critical mt-1">{{ inr(stats.yearly) }}</div>
        </div>
        <div class="text-xs text-ink-3 mt-4">Projected active spend per year</div>
      </div>
      <div class="card p-6 flex flex-col justify-between">
        <div>
          <div class="overline text-ink-3">Active Services</div>
          <div class="font-serif text-3xl font-bold text-ink mt-1">
            {{ stats.count }} <span class="text-lg text-ink-3 font-sans font-normal">/ {{ stats.totalCount }} total</span>
          </div>
        </div>
        <div class="text-xs text-ink-3 mt-4">Currently billing subscriptions</div>
      </div>
    </div>

    <!-- Filters and Actions Header -->
    <div class="flex flex-wrap items-center justify-between gap-4 mb-6">
      <div class="flex items-center gap-4 flex-wrap">
        <!-- Status Filter Tab Strip -->
        <div class="flex gap-1 bg-elevated rounded-xl p-0.5 border border-line text-xs">
          <button 
            v-for="s in [{ k: 'all', l: 'All' }, { k: 'active', l: 'Active' }, { k: 'paused', l: 'Paused' }]" 
            :key="s.k"
            class="px-3 py-1.5 rounded-lg transition-all"
            :class="filterStatus === s.k ? 'bg-surface text-ink font-medium shadow-sm' : 'text-ink-3 hover:text-ink'"
            @click="filterStatus = s.k"
          >
            {{ s.l }}
          </button>
        </div>

        <!-- Sort Select Pill -->
        <div class="flex items-center gap-1.5 text-xs text-ink-3">
          <ArrowUpDown class="w-3.5 h-3.5" />
          <span>Sort:</span>
          <select v-model="sortBy" class="bg-elevated border border-line rounded-lg px-2.5 py-1.5 outline-none text-ink cursor-pointer hover:border-line-2">
            <option value="nextRenewal">Renewal Date</option>
            <option value="name">Service Name</option>
            <option value="cost">Highest Cost</option>
          </select>
        </div>
      </div>

      <button class="btn-primary text-xs" @click="openAddModal" data-testid="add-sub-btn">
        <Plus class="w-4 h-4" /> Add subscription
      </button>
    </div>

    <!-- Subscriptions List Grid -->
    <div v-if="filteredAndSortedSubscriptions.length" class="grid grid-cols-1 md:grid-cols-2 gap-5">
      <div 
        v-for="sub in filteredAndSortedSubscriptions" 
        :key="sub.id" 
        class="card p-5 hover:border-line-2 transition-all group flex flex-col justify-between"
        :class="sub.status === 'paused' ? 'opacity-70 bg-elevated/20' : ''"
        :data-testid="`sub-card-${sub.id}`"
      >
        <div>
          <!-- Card Title & Status Trigger -->
          <div class="flex items-start justify-between gap-3 mb-3">
            <div>
              <h4 class="font-serif text-lg font-bold text-ink leading-tight capitalize">{{ sub.name }}</h4>
              <span v-if="sub.category" class="inline-block text-[10px] font-mono uppercase tracking-wider text-ink-2 bg-elevated border border-line rounded px-1.5 py-0.5 mt-1">
                {{ label(sub.category) }}
              </span>
            </div>
            
            <div class="flex items-center gap-1 shrink-0" @click.stop>
              <!-- Play / Pause Action Button -->
              <button 
                @click="toggleStatus(sub)"
                class="btn-ghost !p-1.5 rounded-lg transition-all"
                :class="sub.status === 'active' ? 'text-ink-3 hover:text-pri-interruptive hover:bg-pri-interruptive/10' : 'text-pri-strategic hover:bg-pri-strategic/10'"
                :title="sub.status === 'active' ? 'Pause subscription' : 'Resume subscription'"
                :data-testid="`sub-toggle-${sub.id}`"
              >
                <component :is="sub.status === 'active' ? Pause : Play" class="w-4 h-4" />
              </button>
              <!-- Edit Button -->
              <button 
                @click="openEditModal(sub)"
                class="btn-ghost !p-1.5 rounded-lg text-ink-3 hover:text-ink hover:bg-elevated"
                title="Edit subscription"
                :data-testid="`sub-edit-${sub.id}`"
              >
                <Edit3 class="w-4 h-4" />
              </button>
              <!-- Delete Button -->
              <button 
                @click="deleteSub(sub)"
                class="btn-ghost !p-1.5 rounded-lg text-ink-3 hover:text-pri-critical hover:bg-pri-critical/10"
                title="Delete subscription"
                :data-testid="`sub-delete-${sub.id}`"
              >
                <Trash2 class="w-4 h-4" />
              </button>
            </div>
          </div>

          <!-- Price Display -->
          <div class="flex items-baseline gap-1.5 mb-4">
            <span class="font-serif text-2xl font-bold text-ink">{{ inr(sub.cost) }}</span>
            <span class="text-xs text-ink-3 font-semibold uppercase">/ {{ sub.billingPeriod }}</span>
          </div>
        </div>

        <!-- Bottom Renewal Status Badge -->
        <div class="border-t border-line/40 pt-3 flex items-center justify-between text-xs mt-auto">
          <div class="flex items-center gap-1.5 text-ink-2">
            <Calendar class="w-3.5 h-3.5 text-ink-3" />
            <span>Renewal: <span class="font-mono text-ink">{{ sub.nextRenewal }}</span></span>
          </div>
          
          <div>
            <!-- Renewal Indicator badge -->
            <span 
              v-if="sub.status === 'active' && daysRemaining(sub.nextRenewal) <= 7 && daysRemaining(sub.nextRenewal) >= 0"
              class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-pri-interruptive/10 text-pri-interruptive animate-pulse"
            >
              <AlertTriangle class="w-3 h-3" /> Renewal Soon
            </span>
            <span 
              v-else-if="sub.status === 'active'"
              class="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-pri-strategic/10 text-pri-strategic"
            >
              {{ formatDaysRemaining(sub.nextRenewal) }}
            </span>
            <span 
              v-else
              class="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-pri-critical/10 text-pri-critical"
            >
              Paused
            </span>
          </div>
        </div>
      </div>
    </div>
    
    <EmptyState 
      v-else 
      title="No subscriptions found" 
      hint="Log your recurring SaaS, utilities, or services above to track your aggregates." 
    />

    <!-- Add/Edit Subscription Modal Popup -->
    <div v-if="showModal" @keydown.window.esc="showModal = false" class="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in">
      <div class="fixed inset-0 bg-ink/40 backdrop-blur-sm" @click="showModal = false"></div>
      
      <form 
        @submit.prevent="saveSubscription" 
        @keydown.meta.enter.prevent="saveSubscription"
        @keydown.ctrl.enter.prevent="saveSubscription"
        class="relative w-full max-w-lg card p-8 animate-rise-in shadow-2xl bg-surface"
        data-testid="sub-modal-form"
      >
        <button type="button" class="absolute top-5 right-5 btn-ghost !p-1.5" @click="showModal = false">
          <X class="w-4 h-4 text-ink-3 hover:text-ink" />
        </button>
        
        <h3 class="font-serif text-2xl text-ink font-semibold leading-none mb-6">
          {{ editingSub ? 'Edit Subscription' : 'Add Subscription' }}
        </h3>

        <div class="space-y-5 mb-8">
          <!-- Name -->
          <div>
            <label class="text-xs uppercase tracking-wider text-ink-3 block mb-1.5 font-mono">Service Name</label>
            <input ref="formNameInput" v-model="formName" placeholder="e.g. Netflix, GitHub" class="input-soft !text-base text-ink" required />
          </div>

          <!-- Price & Cycle -->
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="text-xs uppercase tracking-wider text-ink-3 block mb-1.5 font-mono">Cost (INR)</label>
              <input type="number" v-model.number="formCost" placeholder="e.g. 199" class="input-soft !text-base text-ink text-right" required />
            </div>
            <div>
              <label class="text-xs uppercase tracking-wider text-ink-3 block mb-1.5 font-mono">Billing Cycle</label>
              <select v-model="formBillingPeriod" class="input-soft !text-base text-ink cursor-pointer">
                <option value="monthly">Monthly</option>
                <option value="yearly">Yearly</option>
              </select>
            </div>
          </div>

          <!-- Category Selection -->
          <div>
            <label class="text-xs uppercase tracking-wider text-ink-3 block mb-1.5 font-mono">Category</label>
            <select v-model="formCategory" class="input-soft !text-base text-ink cursor-pointer capitalize">
              <option v-for="cat in expenseCategories" :key="cat.id" :value="cat.name">
                {{ label(cat.name) }}
              </option>
            </select>
          </div>

          <!-- Next Renewal Date -->
          <div>
            <label class="text-xs uppercase tracking-wider text-ink-3 block mb-1.5 font-mono">Next Renewal</label>
            <input type="date" v-model="formNextRenewal" class="input-soft !text-base text-ink" required />
          </div>

          <!-- Status selection (only when editing) -->
          <div v-if="editingSub">
            <label class="text-xs uppercase tracking-wider text-ink-3 block mb-1.5 font-mono">Status</label>
            <select v-model="formStatus" class="input-soft !text-base text-ink cursor-pointer">
              <option value="active">Active</option>
              <option value="paused">Paused</option>
            </select>
          </div>
        </div>

        <div class="flex justify-end gap-3">
          <button type="button" class="btn-ghost !text-sm !py-2 !px-4" @click="showModal = false">Cancel</button>
          <button type="submit" class="btn-primary !text-sm !py-2 !px-4">
            {{ editingSub ? 'Save changes' : 'Add subscription' }} <span class="kbd !bg-canvas/20 !border-canvas/10 !text-canvas select-none text-[9px] ml-1">⌘Enter</span>
          </button>
        </div>
      </form>
    </div>
  </div>
</template>
