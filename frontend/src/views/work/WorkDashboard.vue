<script setup>
import { computed, ref } from 'vue'
import { useRouter, RouterLink } from 'vue-router'
import dayjs from 'dayjs'
import { useWorkClientsStore } from '@/stores/workClients'
import { useWorkItemsStore } from '@/stores/workItems'
import { useWorkInvoicesStore } from '@/stores/workInvoices'
import { useWorkMeetingsStore } from '@/stores/workMeetings'
import { useWorkForecastStore } from '@/stores/workForecast'
import { useWorkLeadsStore } from '@/stores/workLeads'
import { useUIStore } from '@/stores/ui'

import PageHeader from '@/components/PageHeader.vue'
import SectionHeader from '@/components/SectionHeader.vue'
import EmptyState from '@/components/EmptyState.vue'
import MeetingPrep from '@/components/work/MeetingPrep.vue'
import WorkItemCard from '@/components/work/WorkItemCard.vue'
import ResurfacingCockpit from '@/components/work/ResurfacingCockpit.vue'
import ScopeCreepWidget from '@/components/work/ScopeCreepWidget.vue'

import { 
  ArrowRight, Plus, FolderKanban, Users, Target, Receipt, 
  BarChart2, ShieldAlert, Sparkles, Zap, Award, ChevronRight, Calendar
} from 'lucide-vue-next'

const router = useRouter()
const clientsStore = useWorkClientsStore()
const itemsStore = useWorkItemsStore()
const invoicesStore = useWorkInvoicesStore()
const meetingsStore = useWorkMeetingsStore()
const forecastStore = useWorkForecastStore()
const leadsStore = useWorkLeadsStore()
const ui = useUIStore()

const greeting = computed(() => {
  const h = new Date().getHours()
  if (h < 5) return 'Late night coding'
  if (h < 12) return 'Good morning'
  if (h < 18) return 'Good afternoon'
  return 'Good evening'
})

const todayDate = computed(() => dayjs().format('dddd, MMMM D'))

// Single next upcoming meeting in the future
const nextUpcomingMeeting = computed(() => {
  const rightNow = new Date().toISOString()
  const sorted = [...meetingsStore.items]
    .filter(m => m.startDateTime > rightNow)
    .sort((a, b) => a.startDateTime.localeCompare(b.startDateTime))
  return sorted[0] || null
})

// Filter today's focus work items: due today or marked as in_progress (and not done)
const focusItems = computed(() => {
  const todayStr = dayjs().format('YYYY-MM-DD')
  return itemsStore.items.filter(item => {
    if (itemsStore.isCompleted(item.status)) return false
    if (item.snoozedUntil && new Date(item.snoozedUntil) > new Date()) return false
    return item.status === 'in_progress' || item.dueDate === todayStr || (item.important && item.urgent)
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
async function addQuickWork() {
  if (!quickTitle.value.trim()) return
  await itemsStore.add({
    title: quickTitle.value.trim(),
    clientId: selectedClient.value,
    important: false,
    urgent: false,
    billingType: 'fixed',
    status: 'open'
  })
  quickTitle.value = ''
  selectedClient.value = ''
  ui.showToast('Work item added', 'success')
}
</script>

<template>
  <div class="px-8 md:px-12 py-10 max-w-6xl mx-auto space-y-10" data-testid="work-dashboard">
    
    <!-- HEADER -->
    <PageHeader :overline="todayDate" :title="`${greeting}.`"
      :sub="capacity.burnoutRisk ? '⚠️ Your schedule indicates a high burnout risk. Take it slow.' : 'A focused operational space for your independent work.'">
      <template #right>
        <button class="btn-secondary" @click="router.push('/work/forecasting')">
          <BarChart2 class="w-4 h-4" /> Capacity: {{ Math.round(capacity.totalLoad) }}/{{ capacity.availableHours }}h
        </button>
        <button class="btn-primary" @click="router.push('/work/items')">
          <Plus class="w-4 h-4" /> New Work Item
        </button>
      </template>
    </PageHeader>

    <!-- MEETING PREP BANNER -->
    <MeetingPrep />

    <!-- UPCOMING MEETING BRIEFING -->
    <div v-if="nextUpcomingMeeting" class="card p-4 bg-surface/50 border border-line flex items-center justify-between gap-4 animate-fade-in">
      <div class="flex items-center gap-3">
        <div class="p-2 bg-canvas border rounded-xl text-ink-3">
          <Calendar class="w-4.5 h-4.5" />
        </div>
        <div>
          <span class="overline text-ink-3">Next Upcoming Meeting</span>
          <h4 class="font-serif text-base text-ink font-semibold mt-0.5">{{ nextUpcomingMeeting.title }}</h4>
          <p class="text-xs text-ink-2">
            {{ dayjs(nextUpcomingMeeting.startDateTime).format('dddd, MMMM D [at] h:mm A') }}
          </p>
        </div>
      </div>
      <button @click="router.push(nextUpcomingMeeting.clientId ? `/work/clients/${nextUpcomingMeeting.clientId}` : '/')" 
        class="btn-ghost !text-xs !py-1.5 px-3">
        Open Workspace
      </button>
    </div>

    <!-- BRIEFING ALERTS (STALE STUFF) -->
    <ResurfacingCockpit />

    <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
      
      <!-- TODAY'S COCKPIT (LEFT 2 COLS) -->
      <div class="lg:col-span-2 space-y-8">
        
        <!-- FOCUS ITEMS -->
        <section>
          <SectionHeader overline="Execution" title="Today Focus" hint="The select tasks guiding your day.">
            <template #right>
              <RouterLink to="/work/items" class="btn-ghost text-xs">All items <ChevronRight class="w-3.5 h-3.5" /></RouterLink>
            </template>
          </SectionHeader>
          
          <!-- Quick item add -->
          <div class="card p-3.5 mb-4 border border-line bg-canvas flex gap-2 flex-wrap items-center">
            <input v-model="quickTitle" @keyup.enter="addQuickWork" placeholder="Add quick work item..." 
              class="bg-transparent border-0 focus:outline-none text-sm placeholder:text-ink-3 flex-1 min-w-[200px]" />
            <select v-model="selectedClient" class="text-xs bg-surface border border-line rounded-lg px-2.5 py-1 text-ink focus:outline-none">
              <option value="">No Client</option>
              <option v-for="c in clientsStore.items" :key="c.id" :value="c.id">{{ c.name }}</option>
            </select>
            <button @click="addQuickWork" class="btn-primary !py-1 !px-3 text-xs">Add</button>
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
                <div class="font-serif text-lg text-ink font-semibold mt-0.5">${{ pendingRevenue.toLocaleString() }}</div>
              </div>
              <div class="bg-pri-critical-bg border border-pri-critical-bd p-3 rounded-xl">
                <div class="text-[10px] uppercase tracking-wider text-pri-critical">Overdue</div>
                <div class="font-serif text-lg text-pri-critical font-semibold mt-0.5">${{ overdueRevenue.toLocaleString() }}</div>
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
              <span class="text-pri-strategic font-semibold">${{ Math.round(leadsStore.forecast.high).toLocaleString() }}</span>
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
            "We build systems to sustain ourselves, not to squeeze out every drop of human capability." Take a 5-minute breather between tasks.
          </p>
        </div>

      </div>

    </div>

  </div>
</template>
