<script setup>
import { computed, ref, onMounted } from 'vue'
import { useRouter, RouterLink } from 'vue-router'
import dayjs from 'dayjs'
import { useWorkClientsStore } from '@/stores/workClients'
import { useWorkItemsStore } from '@/stores/workItems'
import { useWorkInvoicesStore } from '@/stores/workInvoices'
import { useWorkMeetingsStore } from '@/stores/workMeetings'
import { useWorkForecastStore } from '@/stores/workForecast'
import { useWorkLeadsStore } from '@/stores/workLeads'
import { useNotesStore } from '@/stores/notes'
import { useWorkResourcesStore } from '@/stores/workResources'
import { useUIStore } from '@/stores/ui'
import { isConnected as isGoogleConnected, syncGoogleCalendar } from '@/services/drive'

import PageHeader from '@/components/PageHeader.vue'
import SectionHeader from '@/components/SectionHeader.vue'
import EmptyState from '@/components/EmptyState.vue'
import MeetingPrep from '@/components/work/MeetingPrep.vue'
import WorkItemCard from '@/components/work/WorkItemCard.vue'
import ResurfacingCockpit from '@/components/work/ResurfacingCockpit.vue'
import ScopeCreepWidget from '@/components/work/ScopeCreepWidget.vue'

import {
  ArrowRight, Plus, FolderKanban, Users, Target, Receipt,
  BarChart2, ShieldAlert, Sparkles, Zap, Award, ChevronRight, Calendar, FileText,
  RefreshCw, Video
} from 'lucide-vue-next'

const syncingCalendar = ref(false)
async function manualCalendarSync() {
  syncingCalendar.value = true
  try {
    await syncGoogleCalendar({ force: true })
    ui.showToast('Google Calendar synced', 'success')
  } catch (err) {
    ui.showToast(`Calendar sync failed: ${err.message}`, 'error')
  } finally {
    syncingCalendar.value = false
  }
}

const router = useRouter()
const clientsStore = useWorkClientsStore()
const itemsStore = useWorkItemsStore()
const invoicesStore = useWorkInvoicesStore()
const meetingsStore = useWorkMeetingsStore()
const forecastStore = useWorkForecastStore()
const leadsStore = useWorkLeadsStore()
const notesStore = useNotesStore()
const resourcesStore = useWorkResourcesStore()
const ui = useUIStore()

const greeting = computed(() => {
  const h = new Date().getHours()
  if (h < 5) return 'Late night coding'
  if (h < 12) return 'Good morning'
  if (h < 18) return 'Good afternoon'
  return 'Good evening'
})

const todayDate = computed(() => dayjs().format('dddd, MMMM D'))

// Filter today's focus work items: due today or marked as in_progress (and not done)
const focusItems = computed(() => {
  const todayStr = dayjs().format('YYYY-MM-DD')
  return itemsStore.items.filter(item => {
    if (itemsStore.isCompleted(item.status)) return false
    if (item.snoozedUntil && new Date(item.snoozedUntil) > new Date()) return false
    return item.status === 'in_progress' || !item.dueDate || item.dueDate <= todayStr || (item.important && item.urgent)
  }).slice(0, 5)
})

// Compute revenue stats
const pendingRevenue = computed(() => invoicesStore.summary.pending)
const overdueRevenue = computed(() => invoicesStore.summary.overdue)

// Get current capacity stats
const capacity = computed(() => forecastStore.currentWeekStats)

// Quick capture handler
function openQuickCapture() {
  ui.openQuickCapture()
}

// Inline quick add work item
const quickTitle = ref('')
const selectedClient = ref('')

// Client Combobox dropdown state
const showClientDropdown = ref(false)
const clientSearchQuery = ref('')
const selectedClientName = computed(() => {
  const c = clientsStore.items.find(x => x.id === selectedClient.value)
  return c ? c.name : 'Select Client...'
})
const filteredClientsForDropdown = computed(() => {
  const q = clientSearchQuery.value.toLowerCase().trim()
  const activeClients = clientsStore.items.filter(c => c.status !== 'inactive')
  if (!q) return activeClients
  return activeClients.filter(c => c.name.toLowerCase().includes(q))
})
function selectClientFromDropdown(clientIdVal) {
  selectedClient.value = clientIdVal
  showClientDropdown.value = false
  clientSearchQuery.value = ''
}

async function addQuickWork() {
  if (!quickTitle.value.trim()) return
  if (!selectedClient.value) {
    ui.showToast('Please select a client', 'warning')
    return
  }
  const todayStr = dayjs().format('YYYY-MM-DD')
  await itemsStore.add({
    title: quickTitle.value.trim(),
    clientId: selectedClient.value,
    dueDate: todayStr,
    billingType: 'fixed',
    status: 'in_progress'
  })
  quickTitle.value = ''
  selectedClient.value = ''
  ui.showToast('Work item added', 'success')
}

onMounted(async () => {
  await syncGoogleCalendar()
})
</script>

<template>
  <div class="px-8 md:px-12 py-10 max-w-7xl mx-auto space-y-10" data-testid="work-dashboard">

    <!-- HEADER -->
    <PageHeader :overline="todayDate" :title="`${greeting}.`"
      :sub="capacity.burnoutRisk ? '⚠️ Your schedule indicates a high burnout risk. Take it slow.' : 'A focused operational space for your independent work.'">
      <template #right>
        <button v-if="isGoogleConnected()" class="relative group btn-secondary text-xs flex items-center gap-1.5"
          @click="manualCalendarSync" :disabled="syncingCalendar">
          <Calendar class="w-3.5 h-3.5" />
          <span>Sync Calendar</span>
          <RefreshCw class="w-3.5 h-3.5 text-ink-3" :class="{ 'animate-spin': syncingCalendar }" />
          <span
            class="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-30 px-2 py-1 text-[10px] font-semibold bg-ink text-canvas rounded-lg shadow-md whitespace-nowrap pointer-events-none select-none border border-canvas/10">
            Sync Google Calendar
            <span class="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-ink"></span>
          </span>
        </button>
        <button class="btn-secondary" @click="router.push('/work/forecasting')">
          <BarChart2 class="w-4 h-4" /> Capacity: {{ Math.round(capacity.totalLoad) }}/{{ capacity.availableHours }}h
          <span class="kbd ml-1.5 font-sans select-none bg-elevated border-line text-ink-2">⌘2</span>
        </button>
        <button class="btn-primary" @click="router.push('/work/items?new=true')">
          <Plus class="w-4 h-4" /> New Work Item <span
            class="kbd ml-1.5 !bg-canvas/20 !border-canvas/10 !text-canvas select-none">⌘1</span>
        </button>
      </template>
    </PageHeader>

    <!-- UPCOMING SCHEDULE / MEETING PREP -->
    <MeetingPrep />

    <!-- BRIEFING ALERTS (STALE STUFF) -->
    <ResurfacingCockpit />

    <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">

      <!-- TODAY'S COCKPIT (LEFT 2 COLS) -->
      <div class="lg:col-span-2 space-y-8">

        <!-- FOCUS ITEMS -->
        <section>
          <SectionHeader overline="Execution" title="Today Focus" hint="The select tasks guiding your day.">
            <template #right>
              <RouterLink to="/work/items" class="btn-ghost text-xs">All items
                <ChevronRight class="w-3.5 h-3.5" />
              </RouterLink>
            </template>
          </SectionHeader>

          <!-- Quick item add -->
          <div class="p-2 mb-4 border border-line bg-canvas rounded-xl flex gap-2 flex-wrap items-center">
            <input v-model="quickTitle" @keyup.enter="addQuickWork" placeholder="Add quick work item..."
              class="dashboard-quick-input bg-surface border border-line rounded-md px-3 h-8 focus:outline-none focus:border-line-2 text-sm placeholder:text-ink-3 flex-1 min-w-[200px]" />
            <span class="kbd text-[10px] select-none text-ink-3 mr-1">⌘3</span>
            <!-- Custom Combobox for Client -->
            <div class="relative min-w-[150px] sm:min-w-[200px]">
              <button @click="showClientDropdown = !showClientDropdown" type="button"
                class="w-full text-left text-xs bg-surface border border-line rounded-md px-2.5 h-8 text-ink flex items-center justify-between gap-1.5 focus:outline-none hover:border-line-2 transition-colors">
                <span class="truncate">{{ selectedClientName }}</span>
                <span class="text-ink-3">▼</span>
              </button>

              <div v-if="showClientDropdown" class="fixed inset-0 z-10" @click="showClientDropdown = false"></div>

              <div v-if="showClientDropdown"
                class="absolute right-0 mt-1 w-full bg-surface border border-line rounded-md shadow-lg z-20 p-2 space-y-1.5 min-w-[220px]">
                <input v-model="clientSearchQuery" placeholder="Search client..."
                  class="w-full text-xs bg-canvas border border-line rounded px-2 py-1 focus:outline-none focus:border-line-2"
                  @click.stop />
                <div class="max-h-36 overflow-y-auto space-y-0.5">

                  <button v-for="c in filteredClientsForDropdown" :key="c.id" @click="selectClientFromDropdown(c.id)"
                    type="button"
                    class="w-full text-left text-xs px-2.5 py-1 rounded hover:bg-canvas text-ink transition-colors block truncate"
                    :class="{ 'font-semibold bg-canvas': selectedClient === c.id }">
                    {{ c.name }}
                  </button>
                  <div v-if="filteredClientsForDropdown.length === 0" class="text-[10px] text-ink-3 px-2 py-1">
                    No matches found
                  </div>
                </div>
              </div>
            </div>
            <button @click="addQuickWork" class="btn-primary h-8 !py-0 !px-4 text-xs !rounded-md">Add</button>
          </div>

          <div v-if="focusItems.length" class="space-y-3">
            <WorkItemCard v-for="item in focusItems" :key="item.id" :item="item" />
          </div>
          <EmptyState v-else title="Horizon is clear" hint="Add or unsnooze tasks to structure your day." />
        </section>

        <!-- SCOPE CREEP INTEL -->
        <ScopeCreepWidget />

      </div>

      <!-- METRICS SIDEBAR (RIGHT 1 COL) -->
      <div class="space-y-8">

        <!-- COCKPIT METRICS CARD -->
        <div class="card p-6 border bg-surface space-y-6">
          <h3 class="overline text-ink-3">Operational Vitality</h3>

          <!-- Capacity Gauge -->
          <div class="space-y-2">
            <div class="flex justify-between text-xs font-semibold text-ink">
              <span>Weekly Capacity Load</span>
              <span :class="capacity.overloadRisk ? 'text-pri-critical font-bold animate-pulse' : 'text-ink-2'">
                {{ Math.round(capacity.totalLoad) }}h / {{ capacity.availableHours }}h
              </span>
            </div>
            <div class="h-2 w-full bg-canvas rounded-full overflow-hidden border border-line">
              <div class="h-full rounded-full transition-all duration-500"
                :class="capacity.burnoutRisk ? 'bg-pri-critical' : capacity.overloadRisk ? 'bg-pri-interruptive' : 'bg-pri-strategic'"
                :style="{ width: `${Math.min(100, (capacity.totalLoad / capacity.availableHours) * 100)}%` }">
              </div>
            </div>
            <div class="flex justify-between text-[10px] text-ink-3">
              <span>Meetings: {{ capacity.meetingHours.toFixed(1) }}h</span>
              <span>Work: {{ capacity.allocatedHours.toFixed(1) }}h</span>
            </div>
          </div>

          <!-- Invoices Overview -->
          <div class="pt-4 border-t border-line space-y-3">
            <div class="text-xs font-semibold text-ink">Receivables Ledger</div>

            <div class="grid grid-cols-2 gap-3">
              <div class="bg-canvas border border-line p-3 rounded-xl">
                <div class="text-[10px] uppercase tracking-wider text-ink-3">Pending</div>
                <div class="font-serif text-lg text-ink font-semibold mt-0.5">${{ pendingRevenue.toLocaleString() }}
                </div>
              </div>
              <div class="bg-pri-critical-bg border border-pri-critical-bd p-3 rounded-xl">
                <div class="text-[10px] uppercase tracking-wider text-pri-critical">Overdue</div>
                <div class="font-serif text-lg text-pri-critical font-semibold mt-0.5">${{
                  overdueRevenue.toLocaleString()
                  }}</div>
              </div>
            </div>
          </div>

          <!-- Leads Funnel Forecast -->
          <div class="pt-4 border-t border-line space-y-2">
            <div class="text-xs font-semibold text-ink flex justify-between">
              <span>Pipeline Weighted Estimate</span>
              <span class="text-ink-2 font-medium">${{ Math.round(leadsStore.forecast.total).toLocaleString() }}</span>
            </div>
            <div class="text-[11px] text-ink-2 flex justify-between">
              <span>High Confidence:</span>
              <span class="text-pri-strategic font-semibold">${{ Math.round(leadsStore.forecast.high).toLocaleString()
                }}</span>
            </div>
          </div>
        </div>

        <!-- INTUITIVE REFLECTION WIDGET -->
        <div class="card p-6 border bg-pri-strategic-bg/30 border-pri-strategic-bd/50 space-y-3">
          <div class="flex items-center gap-2">
            <Award class="w-4 h-4 text-pri-strategic" />
            <span class="overline text-pri-strategic font-bold">Sustainability check</span>
          </div>
          <p class="text-xs text-ink-2 leading-relaxed">
            "We build systems to sustain ourselves, not to squeeze out every drop of human capability." Take a 5-minute
            breather between tasks.
          </p>
        </div>

      </div>

    </div>

  </div>
</template>
