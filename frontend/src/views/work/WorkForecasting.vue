<script setup>
import { computed, ref, onMounted, watch } from 'vue'
import { useWorkForecastStore } from '@/stores/workForecast'
import { useWorkItemsStore } from '@/stores/workItems'
import { useWorkClientsStore } from '@/stores/workClients'
import { useUIStore } from '@/stores/ui'
import PageHeader from '@/components/PageHeader.vue'
import SectionHeader from '@/components/SectionHeader.vue'
import { BarChart2, Calendar, ShieldAlert, Check, Settings, Sparkles, Smile, Filter, Trash } from 'lucide-vue-next'
import dayjs from 'dayjs'

const forecastStore = useWorkForecastStore()
const itemsStore = useWorkItemsStore()
const clientsStore = useWorkClientsStore()
const ui = useUIStore()

const startOfWeekStr = computed(() => forecastStore.selectedWeekStart)
const activeSpec = computed(() => forecastStore.getWeeklyCapacity(startOfWeekStr.value))

const capacity = computed(() => forecastStore.currentWeekStats)

// Form edit states
const availableHoursInput = ref(40)
const adminLoadInput = ref(10)
const isUpdating = ref(false)

const statusFilter = ref('active') // active, in_progress, open, done

const forecastItems = computed(() => {
  return itemsStore.items.filter(item => {
    if (statusFilter.value === 'active') {
      return item.status === 'open' || item.status === 'in_progress'
    }
    return item.status === statusFilter.value
  })
})

function getClientName(cId) {
  const c = clientsStore.items.find(x => x.id === cId)
  return c ? c.name : 'Standalone'
}

async function updateEstimate(itemId, val) {
  const num = Number(val)
  if (!isNaN(num)) {
    await itemsStore.update(itemId, { estimatedHours: num })
  }
}

// Allocations grid ref
const allocations = ref({
  Mon: [],
  Tue: [],
  Wed: [],
  Thu: [],
  Fri: [],
  Sat: [],
  Sun: []
})

watch(startOfWeekStr, () => {
  const spec = forecastStore.getWeeklyCapacity(startOfWeekStr.value)
  availableHoursInput.value = spec.availableHours
  adminLoadInput.value = spec.adminLoadPercent
  
  if (spec.allocations && typeof spec.allocations === 'object' && !Array.isArray(spec.allocations)) {
    allocations.value = JSON.parse(JSON.stringify(spec.allocations))
  } else {
    allocations.value = {
      Mon: [],
      Tue: [],
      Wed: [],
      Thu: [],
      Fri: [],
      Sat: [],
      Sun: []
    }
  }
}, { immediate: true })

watch(allocations, (newVal) => {
  forecastStore.saveAllocations(startOfWeekStr.value, newVal)
}, { deep: true })

const dayLabels = computed(() => {
  const start = dayjs(startOfWeekStr.value)
  return [
    { key: 'Mon', label: `Monday (${start.format('M/D')})` },
    { key: 'Tue', label: `Tuesday (${start.add(1, 'day').format('M/D')})` },
    { key: 'Wed', label: `Wednesday (${start.add(2, 'day').format('M/D')})` },
    { key: 'Thu', label: `Thursday (${start.add(3, 'day').format('M/D')})` },
    { key: 'Fri', label: `Friday (${start.add(4, 'day').format('M/D')})` },
    { key: 'Sat', label: `Saturday (${start.add(5, 'day').format('M/D')})` },
    { key: 'Sun', label: `Sunday (${start.add(6, 'day').format('M/D')})` }
  ]
})

const bulkProjectName = ref('')

function addProjectToAllDays() {
  if (!bulkProjectName.value.trim()) return
  const daysKeys = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
  daysKeys.forEach(day => {
    if (!allocations.value[day]) {
      allocations.value[day] = []
    }
    allocations.value[day].push({
      id: forecastStore.newId(),
      projectName: bulkProjectName.value.trim(),
      hours: 0
    })
  })
  bulkProjectName.value = ''
  ui.showToast('Project added to all days', 'success')
}

function addDayAllocationRow(dayKey) {
  if (!allocations.value[dayKey]) {
    allocations.value[dayKey] = []
  }
  allocations.value[dayKey].push({
    id: forecastStore.newId(),
    projectName: '',
    hours: 0
  })
}

function removeDayAllocation(dayKey, id) {
  if (allocations.value[dayKey]) {
    allocations.value[dayKey] = allocations.value[dayKey].filter(a => a.id !== id)
  }
}

function getDayTotal(dayKey) {
  if (!allocations.value[dayKey]) return 0
  return allocations.value[dayKey].reduce((sum, entry) => sum + (Number(entry.hours) || 0), 0)
}

const dailyTotals = computed(() => {
  const totals = { Mon: 0, Tue: 0, Wed: 0, Thu: 0, Fri: 0, Sat: 0, Sun: 0 }
  Object.keys(totals).forEach(day => {
    totals[day] = getDayTotal(day)
  })
  return totals
})

const weeklyAllocationTotal = computed(() => {
  return Object.values(dailyTotals.value).reduce((sum, val) => sum + val, 0)
})

const suggestions = computed(() => {
  const list = []
  clientsStore.items.forEach(c => {
    if (c.name && !list.includes(c.name)) list.push(c.name)
  })
  itemsStore.items.forEach(item => {
    if (item.title && !list.includes(item.title)) list.push(item.title)
  })
  return list
})

async function saveCapacitySettings() {
  isUpdating.value = true
  await forecastStore.updateCapacity(startOfWeekStr.value, {
    availableHours: availableHoursInput.value,
    adminLoadPercent: adminLoadInput.value
  })
  isUpdating.value = false
  ui.showToast('Capacity parameters updated', 'success')
}
</script>

<template>
  <div class="px-8 md:px-12 py-10 max-w-5xl mx-auto space-y-10 animate-fade-in" data-testid="work-forecasting">
    
    <!-- HEADER -->
    <PageHeader overline="Business" title="Workload forecasting" sub="Model your available hours, meeting load, administrative overhead, and target deep work time.">
      <template #right>
        <div class="flex items-center gap-2 bg-white/70 border border-emerald-100/30 rounded-xl p-1 shadow-sm">
          <button @click="forecastStore.changeWeek(-1)" class="forecasting-prev-btn px-2.5 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-50 rounded-lg transition-colors flex items-center gap-1">
            ← Prev <span class="text-[9px] opacity-70 bg-emerald-100 px-1 rounded select-none font-sans">⌘2</span>
          </button>
          <span class="text-xs font-mono font-bold text-ink px-2">
            Week of {{ dayjs(startOfWeekStr).format('MMM D, YYYY') }}
          </span>
          <button @click="forecastStore.changeWeek(1)" class="forecasting-next-btn px-2.5 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-50 rounded-lg transition-colors flex items-center gap-1">
            Next → <span class="text-[9px] opacity-70 bg-emerald-100 px-1 rounded select-none font-sans">⌘1</span>
          </button>
        </div>
      </template>
    </PageHeader>

    <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
      
      <!-- FORECAST GAUGE DETAILS (LEFT 2 COLS) -->
      <div class="lg:col-span-2 space-y-8">
        
        <!-- WEEKLY BREAKDOWN CHART -->
        <div class="card p-6 border bg-surface space-y-6">
          <h3 class="font-serif text-xl font-bold text-ink">Weekly Capacity Allocation</h3>
          
          <div class="space-y-4">
            <!-- Admin load bar -->
            <div class="space-y-1.5">
              <div class="flex justify-between text-xs font-semibold text-ink">
                <span>Administrative Buffer ({{ activeSpec.adminLoadPercent }}%)</span>
                <span class="text-ink-2">{{ capacity.adminHours.toFixed(1) }}h</span>
              </div>
              <div class="h-2 w-full bg-canvas rounded-full overflow-hidden border border-line">
                <div class="h-full bg-ink-2 rounded-full" :style="{ width: `${(capacity.adminHours / capacity.availableHours) * 100}%` }"></div>
              </div>
            </div>

            <!-- Meeting load bar -->
            <div class="space-y-1.5">
              <div class="flex justify-between text-xs font-semibold text-ink">
                <span>Calendar Meetings Synced</span>
                <span class="text-ink-2">{{ capacity.meetingHours.toFixed(1) }}h</span>
              </div>
              <div class="h-2 w-full bg-canvas rounded-full overflow-hidden border border-line">
                <div class="h-full bg-pri-interruptive rounded-full" :style="{ width: `${(capacity.meetingHours / capacity.availableHours) * 100}%` }"></div>
              </div>
            </div>

            <!-- Scoped tasks bar -->
            <div class="space-y-1.5">
              <div class="flex justify-between text-xs font-semibold text-ink">
                <span>Active Task Scope (Estimates due this week)</span>
                <span class="text-ink-2">{{ capacity.allocatedHours.toFixed(1) }}h</span>
              </div>
              <div class="h-2 w-full bg-canvas rounded-full overflow-hidden border border-line">
                <div class="h-full bg-pri-strategic rounded-full" :style="{ width: `${(capacity.allocatedHours / capacity.availableHours) * 100}%` }"></div>
              </div>
            </div>

            <!-- Planned allocations bar -->
            <div class="space-y-1.5">
              <div class="flex justify-between text-xs font-semibold text-ink">
                <span>Planned Project Allocations (Top-down plan)</span>
                <span class="text-ink-2">{{ capacity.plannedHours.toFixed(1) }}h</span>
              </div>
              <div class="h-2 w-full bg-canvas rounded-full overflow-hidden border border-line">
                <div class="h-full bg-emerald-600 rounded-full" :style="{ width: `${(capacity.plannedHours / capacity.availableHours) * 100}%` }"></div>
              </div>
            </div>

            <!-- Overdue tasks bar -->
            <div class="space-y-1.5">
              <div class="flex justify-between text-xs font-semibold text-ink">
                <span>Overdue Tasks Load</span>
                <span class="text-ink-2">{{ capacity.overdueHours.toFixed(1) }}h</span>
              </div>
              <div class="h-2 w-full bg-canvas rounded-full overflow-hidden border border-line">
                <div class="h-full bg-pri-critical rounded-full" :style="{ width: `${(capacity.overdueHours / capacity.availableHours) * 100}%` }"></div>
              </div>
            </div>
          </div>

          <!-- Total Allocation Summary -->
          <div class="pt-6 border-t border-line/60 flex items-center justify-between text-sm">
            <div>
              <span class="text-xs uppercase text-ink-3">Total Allocated Hours</span>
              <div class="font-serif text-2xl font-bold mt-1 text-ink">{{ capacity.totalLoad.toFixed(1) }}h</div>
            </div>
            
            <div class="text-right">
              <span class="text-xs uppercase text-ink-3">Remaining Capacity</span>
              <div class="font-serif text-2xl font-bold mt-1" :class="capacity.remainingHours < 0 ? 'text-pri-critical' : 'text-pri-strategic'">
                {{ capacity.remainingHours.toFixed(1) }}h
              </div>
            </div>
          </div>
        </div>

        <!-- WEEKLY PROJECT HOURS PLANNER -->
        <div class="card p-6 border bg-surface space-y-6 relative z-10">
          <div class="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h3 class="font-serif text-lg font-bold text-ink">Weekly Day-by-Day Allocation</h3>
              <p class="text-xs text-ink-2 mt-1">Map out top-down allocations by project/client for each day of the week.</p>
            </div>
            <span class="text-[10px] font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100 animate-pulse">
              ✓ Auto-saved
            </span>
          </div>

          <!-- Bulk Action Bar -->
          <div class="p-4 bg-canvas/30 rounded-xl border border-line/60 flex items-center gap-3 flex-wrap">
            <div class="flex-1 min-w-[200px]">
              <label class="block text-[10px] uppercase font-bold text-ink-3 mb-1">Add Project to All Days of the Week</label>
              <input 
                v-model="bulkProjectName" 
                list="project-suggestions" 
                class="w-full bg-white border border-line rounded px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-emerald-500 text-xs font-medium text-ink" 
                placeholder="Enter project name..." 
                @keyup.enter="addProjectToAllDays"
              />
            </div>
            <button 
              @click="addProjectToAllDays" 
              class="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-colors self-end h-[34px] flex items-center justify-center"
            >
              Add to All Days
            </button>
          </div>

          <!-- Vertical Days List -->
          <div class="space-y-4">
            <div v-for="day in dayLabels" :key="day.key" class="p-4 rounded-xl border border-line/60 bg-canvas/10 space-y-3">
              <div class="flex items-center justify-between border-b border-line/40 pb-2">
                <span class="font-semibold text-xs text-ink uppercase tracking-wider">{{ day.label }}</span>
                <span class="text-xs font-semibold" :class="dailyTotals[day.key] > 8 ? 'text-rose-600 font-bold' : 'text-emerald-700'">
                  {{ dailyTotals[day.key] }}h total
                </span>
              </div>

              <!-- Allocation list for the day -->
              <div class="space-y-2">
                <div v-for="alloc in allocations[day.key]" :key="alloc.id" class="flex items-center gap-2">
                  <div class="flex-1">
                    <input 
                      v-model="alloc.projectName" 
                      list="project-suggestions" 
                      class="w-full bg-white border border-line rounded px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-emerald-500 text-xs font-medium text-ink" 
                      placeholder="Project or client name..." 
                    />
                  </div>
                  <div class="w-20">
                    <input 
                      type="number" 
                      v-model.number="alloc.hours" 
                      min="0" 
                      max="24" 
                      step="0.5"
                      class="w-full bg-white border border-line rounded px-2 py-1.5 text-center focus:outline-none focus:ring-1 focus:ring-emerald-500 text-xs font-mono text-ink" 
                      placeholder="Hours"
                    />
                  </div>
                  <button 
                    @click="removeDayAllocation(day.key, alloc.id)" 
                    class="p-2 text-ink-3 hover:text-rose-600 rounded hover:bg-rose-50 transition-colors"
                    title="Delete Allocation"
                  >
                    <Trash class="w-3.5 h-3.5" />
                  </button>
                </div>

                <div v-if="!allocations[day.key] || !allocations[day.key].length" class="text-xs text-ink-3 italic py-2 text-center bg-white/30 rounded border border-dashed border-line/40">
                  No allocations for this day.
                </div>
              </div>

              <!-- Add Project Button for the day -->
              <div class="pt-1 flex justify-start">
                <button 
                  @click="addDayAllocationRow(day.key)" 
                  class="text-xs font-bold text-emerald-600 hover:text-emerald-700 flex items-center gap-1 transition-colors"
                >
                  + Add Project Hour
                </button>
              </div>
            </div>
          </div>

          <datalist id="project-suggestions">
            <option v-for="s in suggestions" :key="s" :value="s" />
          </datalist>
        </div>

        <!-- RISK AND SUSTAINABILITY INSIGHTS -->
        <div class="space-y-4">
          <SectionHeader overline="Intelligence" title="Sustainability Diagnostics" hint="Calm diagnostics checking client load and schedule risk." />
          
          <div class="grid grid-cols-1 gap-3 text-xs">
            <!-- Burnout Alert -->
            <div v-if="capacity.burnoutRisk" 
              class="card p-4 border border-pri-critical-bd bg-pri-critical-bg flex gap-3 items-start">
              <ShieldAlert class="w-4 h-4 text-pri-critical shrink-0 mt-0.5" />
              <div>
                <h4 class="font-serif text-sm font-semibold text-pri-critical">Burnout Danger Checklist</h4>
                <p class="text-ink-2 mt-1 leading-relaxed">
                  Your total schedule load (Meetings + Work scope + Overdue carryover) is over 115% of your available capacity. Recommend snoozing low-priority backlog items or pushing delivery deadlines.
                </p>
              </div>
            </div>

            <!-- Overload Alert -->
            <div v-else-if="capacity.overloadRisk" 
              class="card p-4 border border-pri-interruptive-bd bg-pri-interruptive-bg flex gap-3 items-start">
              <ShieldAlert class="w-4 h-4 text-pri-interruptive shrink-0 mt-0.5" />
              <div>
                <h4 class="font-serif text-sm font-semibold text-pri-interruptive">Work Overload Alert</h4>
                <p class="text-ink-2 mt-1 leading-relaxed">
                  Total load exceeds available hours. Consider checking if you can compress admin load or if meeting durations are creep-heavy.
                </p>
              </div>
            </div>

            <!-- Slipping Deadlines -->
            <div v-if="capacity.slippingDeadlines" 
              class="card p-4 border border-pri-critical-bd bg-pri-critical-bg flex gap-3 items-start">
              <ShieldAlert class="w-4 h-4 text-pri-critical shrink-0 mt-0.5" />
              <div>
                <h4 class="font-serif text-sm font-semibold text-pri-critical">Slipping Deadlines Detected</h4>
                <p class="text-ink-2 mt-1 leading-relaxed">
                  You have overdue, non-snoozed active work items. Use the work items menu to snooze, reschedule, or check them off.
                </p>
              </div>
            </div>

            <!-- Healthy state -->
            <div v-if="!capacity.overloadRisk && !capacity.slippingDeadlines" 
              class="card p-4 border border-pri-strategic-bd bg-pri-strategic-bg flex gap-3 items-start">
              <Smile class="w-4 h-4 text-pri-strategic shrink-0 mt-0.5" />
              <div>
                <h4 class="font-serif text-sm font-semibold text-pri-strategic">Calm Capacity Level</h4>
                <p class="text-ink-2 mt-1 leading-relaxed">
                  Your workload matches your capacity limits. Your deep work zones are preserved.
                </p>
              </div>
            </div>
          </div>
        </div>

        <!-- MANUAL HOURS FORECASTER -->
        <div class="card p-6 border bg-surface space-y-6">
          <div class="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h3 class="font-serif text-lg font-bold text-ink">Interactive Hours Forecasting</h3>
              <p class="text-xs text-ink-2 mt-1">Review size estimates on all active and backlog tasks to refine planning.</p>
            </div>
            
            <div class="flex items-center gap-2">
              <Filter class="w-3.5 h-3.5 text-ink-3" />
              <select v-model="statusFilter" class="text-xs bg-canvas border border-line rounded-lg px-2.5 py-1 text-ink focus:outline-none">
                <option value="active">All Active Tasks</option>
                <option value="in_progress">Active (In Progress)</option>
                <option value="open">Backlog (Open)</option>
                <option value="done">Completed Tasks</option>
              </select>
            </div>
          </div>

          <div class="space-y-3 pt-2">
            <div v-for="item in forecastItems" :key="item.id" 
              class="flex items-center justify-between gap-4 p-3 rounded-xl border border-line/60 bg-canvas/30 hover:bg-canvas/50 transition-colors">
              <div class="min-w-0 flex-1">
                <span class="text-[9px] uppercase tracking-wider font-semibold text-ink-3 bg-surface border px-1.5 py-0.5 rounded">
                  {{ getClientName(item.clientId) }}
                </span>
                <h4 class="font-medium text-xs text-ink truncate mt-1.5">{{ item.title }}</h4>
              </div>
              
              <div class="flex items-center gap-2 shrink-0">
                <span class="text-[11px] text-ink-3">Est:</span>
                <input type="number" :value="item.estimatedHours" 
                  @input="updateEstimate(item.id, $event.target.value)" 
                  min="0" step="0.5" 
                  class="w-16 text-center text-xs border border-line rounded-lg px-1.5 py-1 text-ink bg-surface focus:outline-none" />
                <span class="text-[11px] text-ink-3">hrs</span>
              </div>
            </div>
            <p v-if="!forecastItems.length" class="text-xs text-ink-3 italic text-center py-4">No work items matching this status filter.</p>
          </div>
        </div>

      </div>

      <!-- EDIT PARAMETERS (RIGHT COL) -->
      <div class="space-y-6">
        <div class="card p-6 border bg-surface space-y-4">
          <h3 class="overline text-ink-3">Capacity Parameters</h3>
          <p class="text-xs text-ink-2 leading-relaxed">Adjust your availability settings for this specific week to recalculate indicators.</p>
          
          <div class="space-y-4 pt-2">
            <div>
              <label class="block text-xs font-semibold text-ink-2 mb-1">Available Hours</label>
              <input type="number" v-model="availableHoursInput" class="input-block text-sm" />
            </div>
            <div>
              <label class="block text-xs font-semibold text-ink-2 mb-1">Admin Load Buffer (%)</label>
              <input type="number" v-model="adminLoadInput" min="0" max="100" class="input-block text-sm" />
            </div>
            
            <button @click="saveCapacitySettings" class="btn-primary w-full text-xs">
              <Check class="w-3.5 h-3.5" /> Save Parameters
            </button>
          </div>
        </div>

        <div class="card p-6 bg-pri-strategic-bg/30 border border-pri-strategic-bd/50 space-y-3">
          <span class="overline text-pri-strategic font-bold flex items-center gap-1.5"><Sparkles class="w-3.5 h-3.5" /> Sustain Wisdom</span>
          <p class="text-xs text-ink-2 leading-relaxed">
            "Capacity is not a target to hit; it is a boundary to protect." Keep deep work limits clear.
          </p>
        </div>
      </div>

    </div>

  </div>
</template>
