<script setup>
import { computed, ref, onMounted, onBeforeUnmount, watch } from 'vue'
import { useWorkForecastStore } from '@/stores/workForecast'
import { useWorkItemsStore } from '@/stores/workItems'
import { useWorkClientsStore } from '@/stores/workClients'
import { useUIStore } from '@/stores/ui'
import PageHeader from '@/components/PageHeader.vue'
import SectionHeader from '@/components/SectionHeader.vue'
import { BarChart2, Calendar, ShieldAlert, Check, Settings, Sparkles, Smile, Filter, Trash } from 'lucide-vue-next'
import dayjs from 'dayjs'

import WorkItemPopup from '@/components/work/WorkItemPopup.vue'

const forecastStore = useWorkForecastStore()
const itemsStore = useWorkItemsStore()
const clientsStore = useWorkClientsStore()
const ui = useUIStore()

const activeEditItem = ref(null)
const showEditModal = ref(false)

function openEditModal(item) {
  activeEditItem.value = item
  showEditModal.value = true
}

function getHoursColorClass(hours) {
  if (hours > 8) return 'text-rose-600 font-bold'
  if (hours > 0) return 'text-emerald-700 font-bold'
  return 'text-[#9CA3AF] font-semibold'
}

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
      return ['open', 'todo', 'in_progress', 'critical'].includes(item.status)
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
    { key: 'Mon', label: `Monday (${start.format('M/D')})`, dateStr: start.format('YYYY-MM-DD') },
    { key: 'Tue', label: `Tuesday (${start.add(1, 'day').format('M/D')})`, dateStr: start.add(1, 'day').format('YYYY-MM-DD') },
    { key: 'Wed', label: `Wednesday (${start.add(2, 'day').format('M/D')})`, dateStr: start.add(2, 'day').format('YYYY-MM-DD') },
    { key: 'Thu', label: `Thursday (${start.add(3, 'day').format('M/D')})`, dateStr: start.add(3, 'day').format('YYYY-MM-DD') },
    { key: 'Fri', label: `Friday (${start.add(4, 'day').format('M/D')})`, dateStr: start.add(4, 'day').format('YYYY-MM-DD') },
    { key: 'Sat', label: `Saturday (${start.add(5, 'day').format('M/D')})`, dateStr: start.add(5, 'day').format('YYYY-MM-DD') },
    { key: 'Sun', label: `Sunday (${start.add(6, 'day').format('M/D')})`, dateStr: start.add(6, 'day').format('YYYY-MM-DD') }
  ]
})

function getActiveTasksForDay(dateStr) {
  return itemsStore.items.filter(item => {
    const isActive = ['open', 'todo', 'in_progress', 'critical'].includes(item.status)
    if (!isActive) return false

    const due = item.dueDate ? item.dueDate.slice(0, 10) : null
    const snooze = item.snoozedUntil ? item.snoozedUntil.slice(0, 10) : null
    let taskDate = null
    if (due && snooze) {
      taskDate = due > snooze ? due : snooze
    } else {
      taskDate = due || snooze || null
    }

    return taskDate === dateStr
  })
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
  itemsStore.items.forEach(item => {
    const isActive = ['open', 'todo', 'in_progress', 'critical'].includes(item.status)
    if (isActive && item.title) {
      const clientName = getClientName(item.clientId)
      const fullName = clientName ? `${clientName} - ${item.title}` : item.title
      if (!list.includes(fullName)) {
        list.push(fullName)
      }
    }
  })
  return list
})
const activeDropdownAllocId = ref(null)
const allocSearchQuery = ref('')

function toggleAllocDropdown(id) {
  if (activeDropdownAllocId.value === id) {
    activeDropdownAllocId.value = null
  } else {
    activeDropdownAllocId.value = id
    allocSearchQuery.value = ''
  }
}

function filteredSuggestions(query) {
  if (!query) return suggestions.value
  const q = query.toLowerCase()
  return suggestions.value.filter(s => s.toLowerCase().includes(q))
}

function closeCustomDropdowns(e) {
  const container = e.target.closest('.custom-dropdown-container')
  if (!container) {
    activeDropdownAllocId.value = null
  }
}

onMounted(() => {
  document.addEventListener('click', closeCustomDropdowns)
})

onBeforeUnmount(() => {
  document.removeEventListener('click', closeCustomDropdowns)
})
const isCurrentWeek = computed(() => {
  return startOfWeekStr.value === forecastStore.getStartOfWeek()
})

function goToCurrentWeek() {
  forecastStore.selectedWeekStart = forecastStore.getStartOfWeek()
}

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
  <div class="px-8 md:px-12 py-10 max-w-5xl mx-auto space-y-4 animate-fade-in" data-testid="work-forecasting">

    <!-- HEADER -->
    <PageHeader overline="Business" title="Workload forecasting" sub="Model your available hours and work time etc" />
    <div class="flex items-center justify-between w-full bg-white border border-line rounded-xl p-1.5 shadow-sm">
      <button @click="forecastStore.changeWeek(-1)"
        class="forecasting-prev-btn px-3 py-1.5 text-xs font-semibold text-ink hover:bg-canvas rounded-lg transition-colors flex items-center gap-1.5">
        ← Prev <span
          class="text-[9px] opacity-80 bg-canvas border border-line/45 px-1 rounded select-none font-sans">⌘2</span>
      </button>
      <div class="flex items-center gap-2">
        <span class="text-xs font-mono font-bold text-ink px-2">
          Week of {{ dayjs(startOfWeekStr).format('MMM D, YYYY') }}
        </span>
        <button v-if="!isCurrentWeek" @click="goToCurrentWeek"
          class="px-2 py-0.5 text-[10px] font-bold text-ink-2 bg-canvas hover:bg-line/45 border border-line rounded-full transition-all flex items-center gap-1">
          Go to Current Week
        </button>
      </div>
      <button @click="forecastStore.changeWeek(1)"
        class="forecasting-next-btn px-3 py-1.5 text-xs font-semibold text-ink hover:bg-canvas rounded-lg transition-colors flex items-center gap-1.5">
        Next → <span
          class="text-[9px] opacity-80 bg-canvas border border-line/45 px-1 rounded select-none font-sans">⌘1</span>
      </button>
    </div>
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-8 ">

      <!-- FORECAST GAUGE DETAILS (LEFT 2 COLS) -->
      <div class="lg:col-span-2 space-y-6">
        <!-- WEEKLY BREAKDOWN CHART -->
        <div class="card p-6 border bg-surface space-y-4 shadow-sm relative overflow-hidden select-none">

          <!-- Header Row -->
          <div class="flex items-center justify-between text-xs font-sans px-1">
            <span class="font-extrabold tracking-wider text-[#111827]">CAPACITY OVERVIEW</span>
            <span class="text-ink-2 font-medium">
              {{ capacity.totalLoad.toFixed(1) }}h allocated / {{ Math.max(0, capacity.remainingHours).toFixed(1) }}h
              remaining
            </span>
          </div>

          <!-- Bar Row -->
          <div class="px-1 py-1">
            <div class="h-3 w-full bg-canvas rounded-full overflow-hidden border border-line relative">
              <div class="h-full bg-emerald-600 rounded-full transition-all duration-500"
                :style="{ width: `${Math.min(100, (capacity.totalLoad / capacity.availableHours) * 100)}%` }"></div>
            </div>
          </div>

          <!-- Bullet Info Row -->
          <div
            class="text-xs text-ink-2 font-sans px-1 flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 leading-none">
            <span class="flex items-center gap-1.5">
              <span class="text-line-2">•</span> Admin Buffer: <span class="text-ink font-normal">{{
                capacity.adminHours.toFixed(1) }}h</span>
            </span>
            <span class="flex items-center gap-1.5">
              <span class="text-line-2">•</span> Meetings: <span class="text-ink font-normal">{{
                capacity.meetingHours.toFixed(1) }}h</span>
            </span>
            <span class="flex items-center gap-1.5">
              <span class="text-line-2">•</span> Tasks: <span class="text-ink font-normal">{{
                capacity.allocatedHours.toFixed(1) }}h</span>
            </span>
            <span class="flex items-center gap-1.5">
              <span class="text-line-2">•</span> Allocations: <span class="text-ink font-normal">{{
                capacity.plannedHours.toFixed(1) }}h</span>
            </span>
            <span class="flex items-center gap-1.5">
              <span class="text-line-2">•</span> Overdue Carryover: <span class="text-ink font-normal">{{
                capacity.overdueHours.toFixed(1) }}h</span>
            </span>
          </div>

        </div>

        <!-- WEEKLY PROJECT HOURS PLANNER -->
        <div class="card p-6 border bg-surface space-y-6 relative z-10">
          <div class="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h3 class="overline text-ink-3">Weekly Day-by-Day Allocation</h3>

            </div>
          </div>

          <!-- Grouped Flat List Container -->
          <div class="divide-y divide-line/45 border border-line rounded-xl overflow-hidden bg-surface">
            <div v-for="day in dayLabels" :key="day.key" class="p-4 space-y-3.5 hover:bg-canvas/5 transition-colors">

              <!-- Header -->
              <div
                class="flex items-center justify-between text-xs font-bold text-ink uppercase tracking-wider select-none">
                <div class="flex items-center gap-2">
                  <span>{{ day.key }} {{ dayjs(day.dateStr).format('M/D') }}</span>
                  <span class="text-ink-3">·</span>
                  <span :class="getHoursColorClass(dailyTotals[day.key])">
                    {{ dailyTotals[day.key].toFixed(1) }}h total
                  </span>
                </div>

                <!-- Aligned Add button to the row of the day on the right side -->
                <button @click="addDayAllocationRow(day.key)"
                  class="text-[10px] font-bold text-ink-3 hover:text-ink transition-colors normal-case tracking-normal select-none">
                  + Add Project
                </button>
              </div>

              <!-- Day Body (If Allocations Exist) -->
              <template v-if="allocations[day.key] && allocations[day.key].length">
                <div class="space-y-2">
                  <div v-for="alloc in allocations[day.key]" :key="alloc.id" class="flex items-center gap-2">

                    <!-- Dropdown project search/select -->
                    <div class="flex-grow min-w-0 relative custom-dropdown-container">
                      <button type="button"
                        class="w-full text-left bg-surface border border-line rounded-xl px-3.5 py-1.5 text-xs font-semibold text-ink flex items-center justify-between cursor-pointer focus:outline-none focus:ring-1 focus:ring-emerald-500 h-[34px] hover:border-line-2 transition-all"
                        @click="toggleAllocDropdown(alloc.id)">
                        <span class="truncate">{{ alloc.projectName || 'Choose a project...' }}</span>
                        <span class="text-ink-3 text-[8px] pointer-events-none">▼</span>
                      </button>

                      <!-- Dropdown list overlay -->
                      <div v-if="activeDropdownAllocId === alloc.id"
                        class="absolute z-50 left-0 right-0 mt-1 bg-surface border border-line rounded-xl shadow-xl max-h-60 overflow-y-auto p-1.5 space-y-0.5 animate-rise-in text-left">
                        <input type="text" v-model="allocSearchQuery" placeholder="Search active tasks..."
                          class="w-full bg-canvas border border-line rounded-lg px-2.5 py-1.5 text-xs outline-none focus:border-emerald-500 font-sans placeholder-ink-3 mb-1"
                          @click.stop autofocus />
                        <ul class="space-y-0.5">
                          <li v-for="opt in filteredSuggestions(allocSearchQuery)" :key="opt"
                            class="px-2.5 py-1.5 text-xs rounded-lg cursor-pointer flex items-center justify-between transition-colors text-ink-2 hover:bg-canvas"
                            @click="alloc.projectName = opt; activeDropdownAllocId = null; allocSearchQuery = ''">
                            <span>{{ opt }}</span>
                          </li>
                          <li v-if="!filteredSuggestions(allocSearchQuery).length"
                            class="px-2 py-3 text-xs text-ink-3 italic text-center font-serif">
                            No active tasks found
                          </li>
                        </ul>
                      </div>
                    </div>

                    <!-- Hours input with suffix h -->
                    <div class="w-20 shrink-0 relative flex items-center">
                      <input type="number" v-model.number="alloc.hours" min="0" max="24" step="0.5"
                        class="w-full bg-surface border border-line rounded-xl px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-emerald-500 text-xs font-semibold text-ink h-[34px] text-center pr-5"
                        placeholder="0.0" />
                      <span
                        class="absolute right-2.5 text-[10px] text-ink-3 font-semibold pointer-events-none select-none">h</span>
                    </div>

                    <!-- Remove allocation button -->
                    <button @click="removeDayAllocation(day.key, alloc.id)"
                      class="p-2 text-ink-3 hover:text-rose-600 rounded-xl transition-colors h-[34px] w-[34px] flex items-center justify-center shrink-0 hover:bg-rose-50 border border-line/45"
                      title="Delete Allocation">
                      <span class="text-xs">×</span>
                    </button>

                  </div>
                </div>
              </template>

              <!-- Day Body (If No Allocations Planned) -->
              <template v-else>
                <div class="flex items-center py-0.5 select-none">
                  <span class="text-xs text-ink-3 font-medium">No allocations planned.</span>
                </div>
              </template>

            </div>
          </div>


        </div>
      </div>

      <!-- EDIT PARAMETERS (RIGHT COL) -->
      <div class="space-y-6">
        <div class="card p-6 border bg-surface space-y-4">
          <h3 class="overline text-ink-3">Capacity Parameters</h3>
          <p class="text-xs text-ink-2 leading-relaxed">Adjust your availability settings for this specific week to
            recalculate indicators.</p>

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

        <div class="space-y-3">
          <!-- Burnout Alert -->
          <div v-if="capacity.burnoutRisk"
            class="card p-4 border border-pri-critical-bd bg-pri-critical-bg flex gap-3 items-start">
            <ShieldAlert class="w-4 h-4 text-pri-critical shrink-0 mt-0.5" />
            <div>
              <h4 class="font-serif text-sm font-semibold text-pri-critical">Burnout Danger Checklist</h4>
              <p class="text-ink-2 mt-1 leading-relaxed">
                Your total schedule load (Meetings + Work scope + Overdue carryover) is over 115% of your available
                capacity. Recommend snoozing low-priority backlog items or pushing delivery deadlines.
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
                Total load exceeds available hours. Consider checking if you can compress admin load or if meeting
                durations are creep-heavy.
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
                You have overdue, non-snoozed active work items. Use the work items menu to snooze, reschedule, or
                check
                them off.
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

    </div>

    <WorkItemPopup v-if="showEditModal" :item="activeEditItem" @close="showEditModal = false" />

  </div>
</template>
