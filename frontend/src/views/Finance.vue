<script setup>
import { ref, onMounted, onUnmounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useSettingsStore } from '@/stores/settings'
import PageHeader from '@/components/PageHeader.vue'
import NetworthLogForm from '@/components/NetworthLogForm.vue'
import CashflowPeriodForm from '@/components/CashflowPeriodForm.vue'

// Import child components
import FinanceOverview from '@/components/finance/FinanceOverview.vue'
import FinanceSummary from '@/components/finance/FinanceSummary.vue'
import FinanceNetworthLogs from '@/components/finance/FinanceNetworthLogs.vue'
import FinanceCashflowLogs from '@/components/finance/FinanceCashflowLogs.vue'
import FinanceBudgets from '@/components/finance/FinanceBudgets.vue'
import FinanceSettings from '@/components/finance/FinanceSettings.vue'
import FinanceSubscriptions from '@/components/finance/FinanceSubscriptions.vue'

const route = useRoute()
const router = useRouter()
const settings = useSettingsStore()

const tab = ref('overview')

const showNwForm = ref(false)
const editingNw = ref(null)
const isCopyNw = ref(false)
function openNwForm(log = null, isCopy = false) {
  editingNw.value = log
  isCopyNw.value = isCopy
  showNwForm.value = true
}
function closeNwForm() {
  showNwForm.value = false
  editingNw.value = null
  isCopyNw.value = false
}

const showCfForm = ref(false)
const editingCf = ref(null)
const isCopyCf = ref(false)
function openCfForm(p = null, isCopy = false) {
  editingCf.value = p
  isCopyCf.value = isCopy
  showCfForm.value = true
}
function closeCfForm() {
  showCfForm.value = false
  editingCf.value = null
  isCopyCf.value = false
}

const tabsList = ['overview', 'cashflow', 'networth', 'budgets', 'summary', 'subscriptions', 'categories']

function handleKeydown(e) {
  if (e.altKey && e.code && e.code.startsWith('Digit')) {
    const num = e.code.replace('Digit', '')
    const idx = parseInt(num) - 1
    if (tabsList[idx]) {
      e.preventDefault()
      tab.value = tabsList[idx]
    }
  }
  if ((e.metaKey || e.ctrlKey) && e.key === '2') {
    if (tab.value === 'overview' || tab.value === 'cashflow') {
      const logMonthBtn = document.querySelector('[data-testid="overview-log-cf"], [data-testid="cf-add-btn"]')
      if (logMonthBtn) {
        e.preventDefault()
        logMonthBtn.click()
      }
    }
  }
}

function handleQuery() {
  if (route.query.tab) tab.value = route.query.tab
  if (route.query.new === 'nw') {
    tab.value = 'networth'
    openNwForm()
  } else if (route.query.new === 'cf') {
    tab.value = 'cashflow'
    openCfForm()
  }
  if (route.query.new || route.query.tab) {
    router.replace({ query: {} })
  }
}

onMounted(async () => {
  await settings.load()
  handleQuery()
  window.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown)
})

watch(() => route.query, handleQuery)
</script>

<template>
  <div class="py-10 max-w-7xl mx-auto" data-testid="finance-view">
    <PageHeader overline="Memory · Finance" title="Money, gently tracked"
      sub="Date-stamped net-worth snapshots and month-by-month cash flow." />
    <div class="flex flex-wrap items-center justify-between gap-4 mb-10">
      <div class="flex flex-wrap gap-1 bg-elevated rounded-2xl p-1 border border-line text-sm w-fit"
        data-testid="finance-tabs">
        <button
          v-for="t in [{ k: 'overview', l: 'Overview' }, { k: 'cashflow', l: 'Cash flow' }, { k: 'networth', l: 'Net worth' }, { k: 'budgets', l: 'Budgets' }, { k: 'summary', l: 'Annual Summary' }, { k: 'subscriptions', l: 'Subscriptions' }, { k: 'categories', l: 'Settings' }]"
          :key="t.k" :data-testid="`tab-${t.k}`" class="px-4 py-2 rounded-xl transition-colors duration-200"
          :class="tab === t.k ? 'bg-surface text-ink' : 'text-ink-2 hover:text-ink'" @click="tab = t.k">{{ t.l
          }}</button>
      </div>
      <div class="text-xs text-ink-3 select-none">
        Tip: Use <span class="kbd">⌥1</span> to <span class="kbd">⌥7</span> to switch tabs
      </div>
    </div>

    <!-- Active Tab Components -->
    <FinanceOverview v-if="tab === 'overview'" @open-nw="openNwForm" @open-cf="openCfForm" />
    <FinanceSummary v-else-if="tab === 'summary'" />
    <FinanceNetworthLogs v-else-if="tab === 'networth'" @open-nw="openNwForm" />
    <FinanceCashflowLogs v-else-if="tab === 'cashflow'" @open-cf="openCfForm" />
    <FinanceBudgets v-else-if="tab === 'budgets'" />
    <FinanceSubscriptions v-else-if="tab === 'subscriptions'" />
    <FinanceSettings v-else-if="tab === 'categories'" />

    <!-- Overlays & Modals managed by Parent Orchestrator -->
    <NetworthLogForm v-if="showNwForm" :initial="editingNw" :isCopy="isCopyNw" @close="closeNwForm" />
    <CashflowPeriodForm v-if="showCfForm" :initial="editingCf" :isCopy="isCopyCf" @close="closeCfForm" />
  </div>
</template>
