<script setup>
import { ref, computed, watch, nextTick, onMounted, onBeforeUnmount } from 'vue'
import { useFinanceStore } from '@/stores/finance'
import { useUIStore } from '@/stores/ui'
import EmptyState from '@/components/EmptyState.vue'
import { inr } from '@/lib/money'
import {
  Plus, Edit3, Trash2, Calendar, CreditCard, Play, Pause, X, AlertTriangle, ArrowUpDown, ChevronDown, MoreVertical
} from 'lucide-vue-next'
import DateField from '@/components/DateField.vue'
import VInput from '@/components/VInput.vue'
import VSelect from '@/components/VSelect.vue'
import VRow from '@/components/VRow.vue'
import VCol from '@/components/VCol.vue'
import VTooltip from '@/components/VTooltip.vue'
const finance = useFinanceStore()
const ui = useUIStore()

// State
const filterStatus = ref('all') // 'all' | 'active' | 'paused'
const filterType = ref('all') // 'all' | 'subscription' | 'fixed'
const sortBy = ref(localStorage.getItem('atrium.subscriptions.sort_by') || 'nextRenewal')
watch(sortBy, (val) => {
  localStorage.setItem('atrium.subscriptions.sort_by', val)
})
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

const activeMenuId = ref(null)
function toggleMenu(id, event) {
  event.stopPropagation()
  if (activeMenuId.value === id) {
    activeMenuId.value = null
  } else {
    activeMenuId.value = id
  }
}
function onDocumentClick() {
  activeMenuId.value = null
}
onMounted(() => {
  document.addEventListener('click', onDocumentClick)
})
onBeforeUnmount(() => {
  document.removeEventListener('click', onDocumentClick)
})

// Form Fields
const formName = ref('')
const formCost = ref('')
const formCurrency = ref('INR')
const formBillingPeriod = ref('monthly')
const formRenewalDate = ref(new Date().toISOString().slice(0, 10))
const formStatus = ref('active')
const formType = ref('subscription') // 'subscription' | 'fixed'

const focusedFields = ref({
  billingPeriod: false,
  status: false
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

  if (filterType.value !== 'all') {
    list = list.filter(s => {
      const type = s.type || (s.spendType === 'need' ? 'fixed' : 'subscription')
      return type === filterType.value
    })
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

  let monthlySum = 0
  let yearlySum = 0

  let monthlySubscriptionSum = 0
  let monthlyFixedSum = 0
  let yearlySubscriptionSum = 0
  let yearlyFixedSum = 0

  let subscriptionCount = 0
  let fixedCount = 0

  for (const s of activeSubs) {
    const cost = +s.cost || 0
    const monthlyCost = s.billingPeriod === 'yearly' ? cost / 12 : cost
    const yearlyCost = s.billingPeriod === 'monthly' ? cost * 12 : cost
    const isFixed = s.type === 'fixed' || (!s.type && s.spendType === 'need')

    monthlySum += monthlyCost
    yearlySum += yearlyCost

    if (isFixed) {
      monthlyFixedSum += monthlyCost
      yearlyFixedSum += yearlyCost
      fixedCount++
    } else {
      monthlySubscriptionSum += monthlyCost
      yearlySubscriptionSum += yearlyCost
      subscriptionCount++
    }
  }

  return {
    monthly: monthlySum,
    monthlySubscription: monthlySubscriptionSum,
    monthlyFixed: monthlyFixedSum,
    yearly: yearlySum,
    yearlySubscription: yearlySubscriptionSum,
    yearlyFixed: yearlyFixedSum,
    count: activeSubs.length,
    subscriptionCount,
    fixedCount,
    totalCount: finance.subscriptions.length
  }
})

const activeCounts = computed(() => {
  const activeList = finance.subscriptions.filter(s => s.status === 'active')
  const subs = activeList.filter(s => {
    const type = s.type || (s.spendType === 'need' ? 'fixed' : 'subscription')
    return type === 'subscription'
  })
  const fixed = activeList.filter(s => {
    const type = s.type || (s.spendType === 'need' ? 'fixed' : 'subscription')
    return type === 'fixed'
  })
  return {
    all: activeList.length,
    subscription: subs.length,
    fixed: fixed.length
  }
})

// Methods
function openAddModal() {
  editingSub.value = null
  formName.value = ''
  formCost.value = ''
  formCurrency.value = 'INR'
  formBillingPeriod.value = 'monthly'
  formRenewalDate.value = new Date().toISOString().slice(0, 10)
  formStatus.value = 'active'
  formType.value = filterType.value === 'fixed' ? 'fixed' : 'subscription'
  showModal.value = true
}

function openEditModal(sub) {
  editingSub.value = sub
  formName.value = sub.name
  formCost.value = sub.cost
  formCurrency.value = sub.currency || 'INR'
  formBillingPeriod.value = sub.billingPeriod || 'monthly'
  formRenewalDate.value = sub.renewalDate || sub.nextRenewal || new Date().toISOString().slice(0, 10)
  formStatus.value = sub.status || 'active'
  formType.value = sub.type || (sub.spendType === 'need' ? 'fixed' : 'subscription')
  showModal.value = true
}

async function saveSubscription() {
  const payload = {
    name: formName.value.trim(),
    cost: +formCost.value || 0,
    currency: formCurrency.value,
    billingPeriod: formBillingPeriod.value,
    renewalDate: formRenewalDate.value,
    category: '',
    status: formStatus.value,
    type: formType.value
  }

  if (!payload.name) {
    ui.showToast('Please enter a name', 'error')
    return
  }

  if (editingSub.value) {
    await finance.updateSubscription(editingSub.value.id, payload)
    ui.showToast('Updated successfully', 'success')
  } else {
    await finance.addSubscription(payload)
    ui.showToast('Added successfully', 'success')
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

</script>

<template>
  <div>
    <!-- Compact Stats Banner (Single horizontal full-width bar) -->
    <div class="card px-6 py-4 mb-8 flex flex-wrap items-center gap-6 border border-line bg-elevated/40 text-sm">
      <!-- Monthly Outflow (Primary Metric) -->
      <div class="flex items-center gap-2">
        <span class="text-xs font-bold uppercase tracking-wider text-ink-3">Monthly Outflow:</span>
        <VTooltip position="bottom"
          contentClass="p-3 bg-ink text-canvas border border-line/20 rounded-xl shadow-2xl min-w-[210px]">
          <span
            class="font-serif text-lg font-black text-pri-critical hover:underline cursor-help select-all transition-all leading-none">
            {{ inr(stats.monthly) }}
          </span>
          <template #content>
            <div class="flex flex-col gap-2 font-sans text-xs">
              <div class="font-bold border-b border-canvas/10 pb-1 mb-1">Monthly Breakdown</div>
              <div class="flex justify-between gap-6">
                <span class="opacity-80">Subscriptions:</span>
                <span class="font-mono text-emerald-400 font-semibold">{{ inr(stats.monthlySubscription) }}</span>
              </div>
              <div class="flex justify-between gap-6">
                <span class="opacity-80">Fixed Obligations:</span>
                <span class="font-mono text-rose-400 font-semibold">{{ inr(stats.monthlyFixed) }}</span>
              </div>
            </div>
          </template>
        </VTooltip>
        <span class="text-xs text-ink-3 font-semibold ml-1">
          (Subs: {{ inr(stats.monthlySubscription) }}, Fixed: {{ inr(stats.monthlyFixed) }})
        </span>
      </div>

      <!-- Divider -->
      <span class="text-line select-none text-xs">|</span>

      <!-- Yearly Outflow -->
      <div class="flex items-center gap-2">
        <span class="text-xs font-bold uppercase tracking-wider text-ink-3">Yearly:</span>
        <VTooltip position="bottom"
          contentClass="p-3 bg-ink text-canvas border border-line/20 rounded-xl shadow-2xl min-w-[210px]">
          <span
            class="font-serif text-lg font-bold text-ink hover:underline cursor-help select-all transition-all leading-none">
            {{ inr(stats.yearly) }}
          </span>
          <template #content>
            <div class="flex flex-col gap-2 font-sans text-xs">
              <div class="font-bold border-b border-canvas/10 pb-1 mb-1">Yearly Breakdown</div>
              <div class="flex justify-between gap-6">
                <span class="opacity-80">Subscriptions:</span>
                <span class="font-mono text-emerald-400 font-semibold">{{ inr(stats.yearlySubscription) }}</span>
              </div>
              <div class="flex justify-between gap-6">
                <span class="opacity-80">Fixed Obligations:</span>
                <span class="font-mono text-rose-400 font-semibold">{{ inr(stats.yearlyFixed) }}</span>
              </div>
            </div>
          </template>
        </VTooltip>
      </div>

      <!-- Divider -->
      <span class="text-line select-none text-xs">|</span>

      <!-- Active commitments count -->
      <div class="flex items-center gap-2">
        <span class="text-xs font-bold uppercase tracking-wider text-ink-3">Active:</span>
        <span class="font-mono text-base font-bold text-ink leading-none">{{ stats.count }}</span>
      </div>
    </div>

    <!-- Filters and Actions Header -->
    <div class="flex flex-wrap items-center justify-between gap-4 mb-6">
      <div class="flex items-center gap-4 flex-wrap">
        <!-- Type Filter Tab Strip with integrated count badges -->
        <div class="flex gap-1 bg-elevated rounded-xl p-0.5 border border-line text-xs">
          <button v-for="t in [
            { k: 'all', l: 'All Commitments', count: activeCounts.all },
            { k: 'subscription', l: 'Subscriptions', count: activeCounts.subscription },
            { k: 'fixed', l: 'Fixed Obligations', count: activeCounts.fixed }
          ]" :key="t.k" class="px-3 py-1.5 rounded-lg transition-all flex items-center gap-2"
            :class="filterType === t.k ? 'bg-surface text-ink font-medium shadow-sm' : 'text-ink-3 hover:text-ink'"
            @click="filterType = t.k">
            <span>{{ t.l }}</span>
            <span class="px-1.5 py-0.5 rounded-md text-[9px] font-semibold leading-none font-mono"
              :class="filterType === t.k ? 'bg-ink/5 text-ink-2' : 'bg-elevated text-ink-3 border border-line/30'">
              {{ t.count }}
            </span>
          </button>
        </div>

        <!-- Status Filter Tab Strip -->
        <div class="flex gap-1 bg-elevated rounded-xl p-0.5 border border-line text-xs">
          <button v-for="s in [{ k: 'all', l: 'All' }, { k: 'active', l: 'Active' }, { k: 'paused', l: 'Paused' }]"
            :key="s.k" class="px-3 py-1.5 rounded-lg transition-all"
            :class="filterStatus === s.k ? 'bg-surface text-ink font-medium shadow-sm' : 'text-ink-3 hover:text-ink'"
            @click="filterStatus = s.k">
            {{ s.l }}
          </button>
        </div>

        <!-- Sort Select Pill -->
        <div class="flex items-center gap-1.5 text-xs text-ink-3">
          <ArrowUpDown class="w-3.5 h-3.5" />
          <span>Sort:</span>
          <select v-model="sortBy"
            class="bg-elevated border border-line rounded-lg px-2.5 py-1.5 outline-none text-ink cursor-pointer hover:border-line-2">
            <option value="nextRenewal">Renewal Date</option>
            <option value="name">Service Name</option>
            <option value="cost">Highest Cost</option>
          </select>
        </div>
      </div>

      <button class="btn-primary text-xs" @click="openAddModal" data-testid="add-sub-btn">
        <Plus class="w-4 h-4" /> Add commitment
      </button>
    </div>

    <!-- Subscriptions List Grid -->
    <div v-if="filteredAndSortedSubscriptions.length"
      class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
      <div v-for="sub in filteredAndSortedSubscriptions" :key="sub.id"
        @click="openEditModal(sub)"
        class="card p-5 hover:border-line-2 transition-all relative flex flex-col justify-between cursor-pointer"
        :class="sub.status === 'paused' ? 'opacity-70 bg-elevated/20' : ''" :data-testid="`sub-card-${sub.id}`">

        <!-- Card Body content -->
        <div>
          <!-- Row 1: Name + Type + Dropdown Trigger -->
          <div class="flex items-center justify-between mb-4">
            <h4 class="font-serif text-lg text-ink leading-tight capitalize truncate pr-2" :title="sub.name">
              {{ sub.name }}
            </h4>
            <div class="flex items-center gap-2 shrink-0">
              <!-- Type Tag -->
              <span
                class="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded font-mono border bg-canvas/30 text-ink-2 border-line">
                {{ (sub.type || 'subscription') === 'fixed' ? 'FIXED' : 'SUB' }}
              </span>

              <!-- Options Dropdown Kebab Trigger -->
              <div class="relative">
                <button type="button" @click.stop="toggleMenu(sub.id, $event)"
                  class="btn-ghost !p-1 rounded-md text-ink-3 hover:text-ink hover:bg-elevated" title="Options">
                  <MoreVertical class="w-4 h-4" />
                </button>

                <!-- Dropdown Menu -->
                <div v-if="activeMenuId === sub.id"
                  class="absolute right-0 top-full mt-1 z-30 w-44 rounded-xl bg-surface border border-line shadow-xl py-1 flex flex-col text-xs text-ink"
                  @click.stop>
                  <button type="button" @click="toggleStatus(sub); activeMenuId = null"
                    class="w-full text-left px-3 py-2 hover:bg-elevated flex items-center gap-2"
                    :class="sub.status === 'active' ? 'text-pri-interruptive hover:text-pri-interruptive' : 'text-pri-strategic hover:bg-pri-strategic/10'">
                    <component :is="sub.status === 'active' ? Pause : Play" class="w-3.5 h-3.5" />
                    <span>{{ sub.status === 'active' ? 'Pause commitment' : 'Resume commitment' }}</span>
                  </button>
                  <button type="button" @click="openEditModal(sub); activeMenuId = null"
                    class="w-full text-left px-3 py-2 hover:bg-elevated flex items-center gap-2 text-ink">
                    <Edit3 class="w-3.5 h-3.5 text-ink-3" />
                    <span>Edit details</span>
                  </button>
                  <div class="border-t border-line/40 my-1"></div>
                  <button type="button" @click="deleteSub(sub); activeMenuId = null"
                    class="w-full text-left px-3 py-2 hover:bg-elevated flex items-center gap-2 text-pri-critical">
                    <Trash2 class="w-3.5 h-3.5" />
                    <span>Delete</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          <!-- Row 2: Price / Billing Cycle -->
          <div class="flex items-baseline gap-1.5 mb-2 mt-2">
            <span class="font-serif text-2xl text-ink ">{{ inr(sub.cost) }}</span>
            <span class="text-xs text-ink-3 font-semibold uppercase">/ {{ sub.billingPeriod.toUpperCase() }}</span>
          </div>
        </div>

        <!-- Row 3: Next Due Information -->
        <div class="border-t border-line/40 pt-3 flex items-center justify-between text-xs mt-2">
          <div class="flex items-center gap-1.5 text-ink-3 font-medium">
            <Calendar class="w-3.5 h-3.5 shrink-0" />
            <span>Next Due</span>
          </div>
          <div class="flex items-center gap-2 font-mono">
            <span class="text-ink-2">{{ sub.nextRenewal }}</span>
            <span v-if="sub.status === 'active'"
              class="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-canvas/30 border border-line text-ink-2"
              :class="daysRemaining(sub.nextRenewal) <= 7 ? 'bg-canvas border-line text-ink font-extrabold animate-pulse' : ''">
              {{ formatDaysRemaining(sub.nextRenewal).toUpperCase() }}
            </span>
            <span v-else
              class="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-canvas/30 border border-line text-ink-3">
              PAUSED
            </span>
          </div>
        </div>

      </div>
    </div>

    <EmptyState v-else title="No commitments found"
      hint="Log your recurring SaaS, rent, utilities, or services above to track your aggregates." />

    <!-- Add/Edit Subscription Modal Popup -->
    <div v-if="showModal" @keydown.window.esc="showModal = false"
      class="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in">
      <div class="fixed inset-0 bg-ink/40 backdrop-blur-sm" @click="showModal = false"></div>

      <form @submit.prevent="saveSubscription" @keydown.meta.enter.prevent="saveSubscription"
        @keydown.ctrl.enter.prevent="saveSubscription"
        class="relative w-full max-w-lg card p-8 animate-rise-in shadow-2xl bg-surface" data-testid="sub-modal-form">
        <button type="button" class="absolute top-5 right-5 btn-ghost !p-1.5" @click="showModal = false">
          <X class="w-4 h-4 text-ink-3 hover:text-ink" />
        </button>

        <h3 class="font-serif text-2xl text-ink font-semibold leading-none mb-6">
          {{ editingSub ? (formType === 'fixed' ? 'Edit Fixed Obligation' : 'Edit Subscription') : (formType === 'fixed'
            ? 'Add Fixed Obligation' : 'Add Commitment') }}
        </h3>

        <div class="mb-8">
          <!-- Name -->
          <VRow>
            <VCol>
              <VInput ref="formNameInput" v-model="formName" label="Obligation Name" id="sub-name" required />
            </VCol>
          </VRow>

          <!-- Type Selection -->
          <VRow>
            <VCol>
              <VSelect v-model="formType" label="Obligation Type" id="sub-type" :options="[
                { value: 'subscription', label: 'Subscription (discretionary service)' },
                { value: 'fixed', label: 'Fixed Commitment (essential baseline outgo)' }
              ]" option-value="value" option-label="label" />
            </VCol>
          </VRow>

          <!-- Price & Cycle -->
          <VRow>
            <VCol cols="12" sm="6">
              <VInput type="number" v-model.number="formCost" label="Cost (INR)" id="sub-cost" required />
            </VCol>
            <VCol cols="12" sm="6">
              <VSelect v-model="formBillingPeriod" label="Billing Cycle" id="sub-billing-period" :options="[
                { value: 'monthly', label: 'Monthly' },
                { value: 'yearly', label: 'Yearly' }
              ]" option-value="value" option-label="label" />
            </VCol>
          </VRow>

          <!-- Renewal Date & Status -->
          <VRow>
            <VCol cols="12" :sm="editingSub ? 6 : 12">
              <DateField v-model="formRenewalDate" label="Base/Due Date" id="sub-renewal" required />
            </VCol>
            <VCol cols="12" sm="6" v-if="editingSub">
              <VSelect v-model="formStatus" label="Status" id="sub-status" :options="[
                { value: 'active', label: 'Active' },
                { value: 'paused', label: 'Paused' }
              ]" option-value="value" option-label="label" />
            </VCol>
          </VRow>
        </div>

        <div class="flex justify-end gap-3">
          <button type="button" class="btn-ghost !text-sm !py-2 !px-4" @click="showModal = false">Cancel</button>
          <button type="submit" class="btn-primary !text-sm !py-2 !px-4">
            {{ editingSub ? 'Save changes' : (formType === 'fixed' ? 'Add fixed obligation' : 'Add commitment') }}
            <span class="kbd !bg-canvas/20 !border-canvas/10 !text-canvas select-none text-[9px] ml-1">⌘Enter</span>
          </button>
        </div>
      </form>
    </div>
  </div>
</template>
