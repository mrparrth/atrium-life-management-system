<script setup>
import { ref, computed } from 'vue'
import { useHabitsStore } from '@/stores/habits'
import { useYearsStore } from '@/stores/years'
import { useUIStore } from '@/stores/ui'
import PageHeader from '@/components/PageHeader.vue'
import EmptyState from '@/components/EmptyState.vue'
import { Plus, X, Sparkles, Check, Trash2, Pencil, Calendar, PauseCircle, PlayCircle, RotateCcw } from 'lucide-vue-next'
import dayjs from 'dayjs'

const habitsStore = useHabitsStore()
const yearsStore = useYearsStore()
const ui = useUIStore()

const activeTab = ref('active') // 'active' | 'paused'
const showModal = ref(false)
const editingHabitId = ref(null)

const title = ref('')
const icon = ref('⚡')
const frequency = ref('daily')
const weeklyDays = ref([1, 2, 3, 4, 5])
const selectedYearIds = ref([])

const ICON_OPTIONS = ['⚡', '🔥', '💧', '📚', '🏃', '🧘', '🎯', '🏋️', '🎨', '💻', '🥗', '😴', '🌿', '💊', '✍️', '❤️', '🚀', '🧠', '💰', '✨']

const WEEKDAY_OPTIONS = [
  { day: 1, label: 'M' },
  { day: 2, label: 'T' },
  { day: 3, label: 'W' },
  { day: 4, label: 'T' },
  { day: 5, label: 'F' },
  { day: 6, label: 'S' },
  { day: 0, label: 'S' }
]

const todayStr = computed(() => dayjs().format('YYYY-MM-DD'))

// Past 7 days for weekly mini history dots
const currentWeekDays = computed(() => {
  const days = []
  for (let i = 6; i >= 0; i--) {
    const d = dayjs().subtract(i, 'day')
    days.push({
      dateStr: d.format('YYYY-MM-DD'),
      dayName: d.format('dd').charAt(0),
      isToday: i === 0,
      dateObj: d
    })
  }
  return days
})

const isEditingHabitPaused = computed(() => {
  if (!editingHabitId.value) return false
  const h = habitsStore.items.find(item => item.id === editingHabitId.value)
  return h ? (h.status === 'paused' || h.archived) : false
})

function openNewHabitModal() {
  editingHabitId.value = null
  title.value = ''
  icon.value = '⚡'
  frequency.value = 'daily'
  weeklyDays.value = [1, 2, 3, 4, 5]
  selectedYearIds.value = yearsStore.items[0] ? [yearsStore.items[0].id] : []
  showModal.value = true
}

function openEditHabitModal(h) {
  editingHabitId.value = h.id
  title.value = h.title
  icon.value = h.icon || '⚡'
  frequency.value = h.frequency || 'daily'
  weeklyDays.value = h.weeklyDays ? [...h.weeklyDays] : [1, 2, 3, 4, 5]
  selectedYearIds.value = h.yearIds ? [...h.yearIds] : []
  showModal.value = true
}

function toggleDay(d) {
  if (weeklyDays.value.includes(d)) {
    weeklyDays.value = weeklyDays.value.filter(x => x !== d)
  } else {
    weeklyDays.value.push(d)
  }
}

function toggleYear(yid) {
  if (selectedYearIds.value.includes(yid)) {
    selectedYearIds.value = selectedYearIds.value.filter(id => id !== yid)
  } else {
    // Check 3 habits per year limit
    const existingForYear = habitsStore.getHabitsByYearId(yid)
    if (existingForYear.length >= 3 && !existingForYear.some(h => h.id === editingHabitId.value)) {
      ui.showToast('Maximum 3 core habits allowed per year to maintain focus.', 'warning')
      return
    }
    selectedYearIds.value.push(yid)
  }
}

async function saveHabit() {
  if (!title.value.trim()) return

  if (editingHabitId.value) {
    await habitsStore.updateHabit(editingHabitId.value, {
      title: title.value,
      icon: icon.value,
      frequency: frequency.value,
      weeklyDays: weeklyDays.value,
      yearIds: selectedYearIds.value
    })
    ui.showToast('Habit updated', 'success')
  } else {
    await habitsStore.addHabit({
      title: title.value,
      icon: icon.value,
      frequency: frequency.value,
      weeklyDays: weeklyDays.value,
      yearIds: selectedYearIds.value
    })
    ui.showToast('Habit created', 'success')
  }
  showModal.value = false
}

async function pauseHabit(id) {
  await habitsStore.pauseHabit(id)
  ui.showToast('Habit paused', 'info')
}

async function resumeHabit(id) {
  await habitsStore.resumeHabit(id)
  ui.showToast('Habit resumed', 'success')
}

async function pauseFromModal() {
  if (editingHabitId.value) {
    await habitsStore.pauseHabit(editingHabitId.value)
    ui.showToast('Habit paused', 'info')
    showModal.value = false
  }
}

async function resumeFromModal() {
  if (editingHabitId.value) {
    await habitsStore.resumeHabit(editingHabitId.value)
    ui.showToast('Habit resumed', 'success')
    showModal.value = false
  }
}

async function deleteHabit(id) {
  if (confirm('Are you sure you want to delete this habit?')) {
    await habitsStore.deleteHabit(id)
    ui.showToast('Habit deleted', 'info')
  }
}
</script>

<template>
  <div class="px-8 md:px-12 py-10 max-w-7xl mx-auto" data-testid="habits-view">
    <PageHeader overline="Track" title="Habits" sub="Daily and weekly rituals building long-term momentum.">
      <template #right>
        <button class="btn-primary" @click="openNewHabitModal" data-testid="habits-new-btn">
          <Plus class="w-4 h-4" /> New habit
        </button>
      </template>
    </PageHeader>

    <!-- Tab Filter Controls -->
    <div class="flex items-center gap-2 mb-8 border-b border-line/40 pb-3">
      <button @click="activeTab = 'active'"
        class="px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-2 cursor-pointer"
        :class="activeTab === 'active'
          ? 'bg-surface text-ink border border-line shadow-sm'
          : 'text-ink-3 hover:text-ink hover:bg-surface/50'">
        <span>Active</span>
        <span class="px-1.5 py-0.5 rounded-md text-[10px] font-mono"
          :class="activeTab === 'active' ? 'bg-canvas text-ink-2' : 'bg-surface-2 text-ink-3'">
          {{ habitsStore.activeHabits.length }}
        </span>
      </button>

      <button @click="activeTab = 'paused'"
        class="px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-2 cursor-pointer"
        :class="activeTab === 'paused'
          ? 'bg-surface text-ink border border-line shadow-sm'
          : 'text-ink-3 hover:text-ink hover:bg-surface/50'">
        <span>Paused</span>
        <span class="px-1.5 py-0.5 rounded-md text-[10px] font-mono"
          :class="activeTab === 'paused' ? 'bg-canvas text-ink-2' : 'bg-surface-2 text-ink-3'">
          {{ habitsStore.pausedHabits.length }}
        </span>
      </button>
    </div>

    <!-- Active Habits Grid -->
    <template v-if="activeTab === 'active'">
      <div v-if="habitsStore.activeHabits.length" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div v-for="habit in habitsStore.activeHabits" :key="habit.id"
          @click="openEditHabitModal(habit)"
          class="card p-6 space-y-4 relative group bg-surface/70 hover:border-line-2 transition-all cursor-pointer select-none">

          <!-- Header & Title -->
          <div class="flex items-start justify-between gap-3">
            <div class="space-y-1 min-w-0 flex-1">
              <h3 class="font-serif text-lg font-normal text-ink leading-snug truncate flex items-center gap-2">
                <span>{{ habit.icon || '⚡' }}</span>
                <span class="truncate">{{ habit.title }}</span>
              </h3>
            </div>

            <div class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button @click.stop="pauseHabit(habit.id)"
                class="p-1.5 text-ink-3 hover:text-amber-500 rounded hover:bg-canvas transition-colors" title="Pause habit (Moved on)">
                <PauseCircle class="w-3.5 h-3.5" />
              </button>
              <button @click.stop="openEditHabitModal(habit)"
                class="p-1.5 text-ink-3 hover:text-ink rounded hover:bg-canvas transition-colors" title="Edit habit">
                <Pencil class="w-3.5 h-3.5" />
              </button>
              <button @click.stop="deleteHabit(habit.id)"
                class="p-1.5 text-ink-3 hover:text-red-500 rounded hover:bg-canvas transition-colors"
                title="Delete habit">
                <Trash2 class="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <!-- Today Check-in Action Button -->
          <div class="pt-2">
            <button @click.stop="habitsStore.toggleHabitLog(habit.id, todayStr)"
              class="w-full py-2.5 px-4 rounded-xl border flex items-center justify-center gap-2 text-xs font-semibold transition-all duration-200 cursor-pointer select-none"
              :class="[
                habitsStore.isCompletedOn(habit.id, todayStr)
                  ? 'bg-emerald-500 border-emerald-500 text-canvas shadow-sm'
                  : 'bg-canvas/50 border-line hover:border-line-2 text-ink hover:bg-surface'
              ]">
              <Check class="w-4 h-4 stroke-[3]" />
              <span>{{ habitsStore.isCompletedOn(habit.id, todayStr) ? 'Completed Today' : 'Mark Done Today' }}</span>
            </button>
          </div>

          <!-- Past 7 Days Completion Heatmap Bar -->
          <div class="pt-3 border-t border-line/40 space-y-2">
            <div class="flex items-center justify-between text-[11px] font-mono text-ink-3">
              <span>Last 7 Days</span>
              <span>
                {{currentWeekDays.filter(d => habitsStore.isCompletedOn(habit.id, d.dateStr)).length}}/7
              </span>
            </div>

            <div class="flex items-center justify-between gap-1.5">
              <div v-for="d in currentWeekDays" :key="d.dateStr"
                class="flex-1 flex flex-col items-center gap-1 cursor-pointer"
                @click.stop="habitsStore.toggleHabitLog(habit.id, d.dateStr)"
                :title="`${d.dateStr}: ${habitsStore.isCompletedOn(habit.id, d.dateStr) ? 'Completed' : 'Not completed'}`">
                <div class="w-full h-7 rounded-lg border flex items-center justify-center transition-all" :class="[
                  habitsStore.isCompletedOn(habit.id, d.dateStr)
                    ? 'bg-emerald-500 border-emerald-500 text-canvas'
                    : habitsStore.isHabitDueOn(habit, d.dateObj)
                      ? 'bg-canvas border-line text-ink-3 hover:border-line-2'
                      : 'bg-canvas/20 border-line/30 text-ink-3/30'
                ]">
                  <Check v-if="habitsStore.isCompletedOn(habit.id, d.dateStr)" class="w-3 h-3 stroke-[3]" />
                  <span v-else class="text-[9px] font-mono font-bold">{{ d.dayName }}</span>
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>

      <EmptyState v-else title="No active habits"
        hint="Create core daily or weekly rituals to build long-term momentum." />
    </template>

    <!-- Paused Habits Grid -->
    <template v-else-if="activeTab === 'paused'">
      <div v-if="habitsStore.pausedHabits.length" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div v-for="habit in habitsStore.pausedHabits" :key="habit.id"
          @click="openEditHabitModal(habit)"
          class="card p-6 space-y-4 relative group bg-surface/40 hover:bg-surface/70 border-line/50 hover:border-line-2 transition-all cursor-pointer select-none">

          <!-- Header & Title -->
          <div class="flex items-start justify-between gap-3">
            <div class="space-y-1 min-w-0 flex-1">
              <div class="flex items-center gap-2">
                <h3 class="font-serif text-lg font-normal text-ink/80 leading-snug truncate flex items-center gap-2">
                  <span>{{ habit.icon || '⚡' }}</span>
                  <span class="truncate">{{ habit.title }}</span>
                </h3>
                <span class="px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 shrink-0">
                  Paused
                </span>
              </div>
              <p class="text-xs text-ink-3 font-mono">
                Stopped on {{ habitsStore.getHabitStoppedDateText(habit) || 'N/A' }} • Used for {{ habitsStore.getHabitDurationText(habit) }}
              </p>
            </div>

            <div class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
              <button @click.stop="resumeHabit(habit.id)"
                class="p-1.5 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 rounded transition-colors" title="Resume habit">
                <RotateCcw class="w-3.5 h-3.5" />
              </button>
              <button @click.stop="openEditHabitModal(habit)"
                class="p-1.5 text-ink-3 hover:text-ink rounded hover:bg-canvas transition-colors" title="Edit habit">
                <Pencil class="w-3.5 h-3.5" />
              </button>
              <button @click.stop="deleteHabit(habit.id)"
                class="p-1.5 text-ink-3 hover:text-red-500 rounded hover:bg-canvas transition-colors"
                title="Delete habit">
                <Trash2 class="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <!-- Resume Action Button -->
          <div class="pt-2">
            <button @click.stop="resumeHabit(habit.id)"
              class="w-full py-2 px-4 rounded-xl border border-line bg-canvas/40 hover:bg-emerald-500/10 hover:border-emerald-500/30 text-ink-2 hover:text-emerald-600 dark:hover:text-emerald-400 flex items-center justify-center gap-2 text-xs font-semibold transition-all duration-200 cursor-pointer">
              <RotateCcw class="w-3.5 h-3.5" />
              <span>Resume Habit</span>
            </button>
          </div>
        </div>
      </div>

      <EmptyState v-else title="No paused habits"
        hint="Habits you pause or move on from will be stored here with their duration." />
    </template>

    <!-- Create / Edit Habit Modal -->
    <div v-if="showModal" class="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div class="fixed inset-0 bg-ink/40 backdrop-blur-sm animate-fade-in" @click="showModal = false"></div>
      <form @submit.prevent="saveHabit"
        @keydown.meta.enter.prevent="saveHabit"
        @keydown.ctrl.enter.prevent="saveHabit"
        class="relative w-full max-w-md card p-8 animate-rise-in space-y-5">
        <button type="button" class="absolute top-4 right-4 btn-ghost !p-1.5" @click="showModal = false">
          <X class="w-4 h-4" />
        </button>

        <div>
          <div class="overline">Ritual</div>
          <h2 class="font-serif text-2xl mt-1">{{ editingHabitId ? 'Edit habit' : 'New habit' }}</h2>
        </div>

        <div class="v-field-group">
          <input v-model="title" placeholder=" " class="v-field-input text-base font-sans" id="modal-habit-title"
            required autofocus />
          <label for="modal-habit-title" class="v-field-label text-base font-semibold">Habit Title *</label>
        </div>

        <!-- Icon Selector -->
        <div class="space-y-2">
          <label class="block text-xs font-semibold text-ink-2 uppercase tracking-wider">Habit Icon</label>
          <div class="flex flex-wrap gap-2 p-2 bg-surface rounded-xl border border-line max-h-28 overflow-y-auto">
            <button v-for="ic in ICON_OPTIONS" :key="ic" type="button" @click="icon = ic"
              class="w-8 h-8 rounded-lg text-base flex items-center justify-center transition-all cursor-pointer select-none"
              :class="icon === ic ? 'bg-canvas border border-line-2 shadow-sm scale-110' : 'hover:bg-canvas/50'">
              {{ ic }}
            </button>
          </div>
        </div>

        <!-- Frequency -->
        <div class="space-y-2">
          <label class="block text-xs font-semibold text-ink-2 uppercase tracking-wider">Frequency</label>
          <div class="flex bg-elevated rounded-xl p-1 border border-line text-sm">
            <button type="button" @click="frequency = 'daily'"
              class="flex-1 py-1.5 rounded-lg text-xs font-semibold transition-colors"
              :class="frequency === 'daily' ? 'bg-surface text-ink shadow-sm' : 'text-ink-3 hover:text-ink'">
              Daily
            </button>
            <button type="button" @click="frequency = 'weekly'"
              class="flex-1 py-1.5 rounded-lg text-xs font-semibold transition-colors"
              :class="frequency === 'weekly' ? 'bg-surface text-ink shadow-sm' : 'text-ink-3 hover:text-ink'">
              Weekly
            </button>
          </div>
        </div>

        <!-- Weekly Days Selector -->
        <div v-if="frequency === 'weekly'" class="space-y-2 pt-1">
          <label class="block text-xs font-semibold text-ink-2 uppercase tracking-wider">Repeat on Days</label>
          <div class="flex items-center justify-between gap-1.5">
            <button v-for="opt in WEEKDAY_OPTIONS" :key="opt.day" type="button" @click="toggleDay(opt.day)"
              class="w-9 h-9 rounded-xl border text-xs font-bold font-mono transition-all cursor-pointer" :class="weeklyDays.includes(opt.day)
                ? 'bg-pri-strategic border-pri-strategic text-canvas shadow-sm'
                : 'bg-surface border-line text-ink-3 hover:border-line-2'">
              {{ opt.label }}
            </button>
          </div>
        </div>

        <!-- Year Link Selection -->
        <div v-if="yearsStore.items.length" class="space-y-2 pt-1">
          <div class="flex items-center justify-between">
            <label class="block text-xs font-semibold text-ink-2 uppercase tracking-wider">Link to Years (Max
              3/year)</label>
          </div>
          <div class="flex flex-wrap gap-2">
            <button v-for="y in yearsStore.items" :key="y.id" type="button" @click="toggleYear(y.id)"
              class="px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer" :class="selectedYearIds.includes(y.id)
                ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-600 dark:text-emerald-400'
                : 'bg-surface border-line text-ink-3 hover:border-line-2'">
              {{ y.year }}
            </button>
          </div>
        </div>

        <div class="flex items-center justify-between gap-2 pt-3 border-t border-line/40">
          <div>
            <button type="button" v-if="editingHabitId && !isEditingHabitPaused" class="btn-ghost !text-amber-600 dark:!text-amber-400 !px-2.5" @click="pauseFromModal">
              Pause habit
            </button>
            <button type="button" v-else-if="editingHabitId && isEditingHabitPaused" class="btn-ghost !text-emerald-600 dark:!text-emerald-400 !px-2.5" @click="resumeFromModal">
              Resume habit
            </button>
          </div>
          <div class="flex items-center gap-2">
            <button type="button" class="btn-ghost" @click="showModal = false">Cancel</button>
            <button type="submit" class="btn-primary">
              <span>{{ editingHabitId ? 'Save changes' : 'Create habit' }}</span>
              <span class="kbd !bg-canvas/20 !border-canvas/10 !text-canvas select-none text-[9px] ml-1.5">⌘Enter</span>
            </button>
          </div>
        </div>
      </form>
    </div>
  </div>
</template>

