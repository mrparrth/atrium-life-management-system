<script setup>
import { computed, ref, onMounted, onUnmounted } from 'vue'
import { useTasksStore } from '@/stores/tasks'
import { useProjectsStore } from '@/stores/projects'
import { useUIStore } from '@/stores/ui'
import { derivePriority } from '@/lib/priority'
import { inFuture, fromNow } from '@/lib/date'
import { isSnoozed } from '@/lib/resurface'
import PriorityBadge from './PriorityBadge.vue'
import { Calendar, Clock, MoonStar, Trash2, Circle, CheckCircle2, BellOff, MoreVertical, Edit3, AlertCircle } from 'lucide-vue-next'
import dayjs from 'dayjs'

const props = defineProps({
  task: Object,
  showProject: { type: Boolean, default: true },
  compact: { type: Boolean, default: false },
  singleLine: { type: Boolean, default: false }
})
const emit = defineEmits(['open'])

const tasks = useTasksStore()
const projects = useProjectsStore()
const ui = useUIStore()

const showMenu = ref(false)
const showStatusMenu = ref(false)

const project = computed(() => projects.items.find(p => p.id === props.task.projectId))
const priority = computed(() => derivePriority(props.task.important, props.task.urgent))
const isDone = computed(() => props.task.status === 'done')
const snoozed = computed(() => isSnoozed(props.task))
const isOverdue = computed(() => {
  if (isDone.value || !props.task.dueDate) return false
  return dayjs(props.task.dueDate).isBefore(dayjs(), 'day')
})

const statusGroups = {
  open: { key: 'open', label: 'Yet to start', color: 'bg-canvas text-ink-2 border-line', dotColor: 'bg-ink-3' },
  in_progress: { key: 'in_progress', label: 'In progress', color: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-250 dark:border-emerald-500/20', dotColor: 'bg-emerald-500' },
  done: { key: 'done', label: 'Complete', color: 'bg-[#7d7975]/10 text-[#7d7975] border-[#7d7975]/20', dotColor: 'bg-[#7d7975]' }
}

const statusStyle = computed(() => {
  const s = props.task.status || 'open'
  return statusGroups[s] || statusGroups.open
})

function toggle() { tasks.toggleComplete(props.task.id) }
function snooze1d() { tasks.snooze(props.task.id, 1) }
function snooze(days) {
  tasks.snooze(props.task.id, days)
  showMenu.value = false
}
async function del() {
  if (await ui.confirm({ message: 'Remove this task?', title: 'Remove Task' })) {
    tasks.remove(props.task.id)
    showMenu.value = false
  }
}

async function updateStatus(statusKey) {
  showStatusMenu.value = false
  const patch = { status: statusKey }
  if (statusKey === 'done') {
    patch.completedAt = new Date().toISOString().slice(0, 10)
  } else {
    patch.completedAt = null
  }
  await tasks.update(props.task.id, patch)
  ui.showToast(`Status updated to: ${statusGroups[statusKey].label}`, 'success')
}

function closeMenus() {
  showMenu.value = false
  showStatusMenu.value = false
}

onMounted(() => {
  window.addEventListener('click', closeMenus)
})

onUnmounted(() => {
  window.removeEventListener('click', closeMenus)
})
</script>

<template>
  <div v-if="!singleLine" class="card p-4 flex items-center justify-between gap-4 border transition-all duration-300 hover:shadow-sm"
    :class="[isDone || snoozed ? 'opacity-60' : '', isOverdue ? '!bg-rose-50 !border-rose-400 dark:!bg-rose-950/30 dark:!border-rose-400' : '']"
    :data-testid="`task-card-${task.id}`">

    <div class="flex items-start gap-3 flex-1 min-w-0">
      <!-- Clickable Title & Details for Edit Modal -->
      <div class="min-w-0 flex-1 cursor-pointer" @click="ui.openTaskEdit(task); emit('open', task)">
        <div class="flex items-center gap-2 flex-wrap mb-1">
          <!-- Project Tag -->
          <span v-if="showProject && project"
            class="text-[10px] uppercase tracking-wider font-semibold text-ink-3 bg-canvas border border-line px-2 py-0.5 rounded-full"
            data-testid="task-project-tag">
            {{ project.title }}
          </span>
          <!-- Status Tag with Dropdown Menu -->
          <div class="relative inline-block">
            <button @click.stop="showStatusMenu = !showStatusMenu"
              class="text-[10px] font-semibold px-2 py-0.5 rounded-full border flex items-center gap-1.5 hover:opacity-85 transition-all cursor-pointer"
              :class="statusStyle.color" title="Change status">
              <span class="w-1.5 h-1.5 rounded-full" :class="statusStyle.dotColor"></span>
              {{ statusStyle.label }}
            </button>

            <!-- Status Dropdown Menu -->
            <div v-if="showStatusMenu"
              class="absolute left-0 top-6 w-36 rounded-xl bg-surface border border-line p-1 shadow-lg z-30 animate-rise-in font-sans">
              <div class="overline px-2.5 py-1">Change status</div>
              <button @click.stop="updateStatus('open')"
                class="w-full text-left text-xs text-ink hover:bg-canvas px-3 py-1.5 rounded-lg flex items-center gap-2">
                <span class="w-1.5 h-1.5 rounded-full bg-ink-3"></span>
                Yet to start
              </button>
              <button @click.stop="updateStatus('in_progress')"
                class="w-full text-left text-xs text-ink hover:bg-canvas px-3 py-1.5 rounded-lg flex items-center gap-2">
                <span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                In progress
              </button>
              <button @click.stop="updateStatus('done')"
                class="w-full text-left text-xs text-ink hover:bg-canvas px-3 py-1.5 rounded-lg flex items-center gap-2">
                <span class="w-1.5 h-1.5 rounded-full bg-[#7d7975]"></span>
                Complete
              </button>
            </div>
          </div>
          <!-- Priority Badge -->
          <PriorityBadge :important="task.important" :urgent="task.urgent" :compact="false" />
        </div>

        <h4 class="font-medium text-ink text-sm leading-snug"
          :class="{ 'line-through text-ink-3': isDone }">
          {{ task.title }}
        </h4>
        
        <p v-if="task.description && !compact" class="text-xs text-ink-2 mt-1 line-clamp-1">
          {{ task.description }}
        </p>

        <!-- Metrics & Meta -->
        <div class="flex items-center gap-4 text-[11px] text-ink-3 mt-2 flex-wrap">
          <span v-if="task.scheduledDate" class="flex items-center gap-1 text-ink-2 font-medium">
            <Calendar class="w-3.5 h-3.5" /> {{ inFuture(task.scheduledDate) }}
          </span>
          <span v-if="task.dueDate" class="flex items-center gap-1 text-ink-2 font-medium" :class="{ 'text-pri-critical font-bold': isOverdue }">
            <AlertCircle v-if="isOverdue" class="w-3.5 h-3.5 text-pri-critical shrink-0" />
            <Clock v-else class="w-3.5 h-3.5" /> due {{ inFuture(task.dueDate) }}
          </span>
          <!-- Closed date for completed tasks -->
          <span v-if="isDone && task.completedAt" class="flex items-center gap-1 text-pri-strategic font-semibold">
            <CheckCircle2 class="w-3.5 h-3.5" /> Closed {{ dayjs(task.completedAt).format('MMM D, YYYY') }}
          </span>
          <span v-if="snoozed" class="italic text-pri-interruptive">
            snoozed
          </span>
          <span v-if="task.tags && task.tags.length" class="inline-flex items-center gap-1">
            <template v-for="t in task.tags" :key="t">·{{ t }}</template>
          </span>
        </div>
      </div>
    </div>

    <!-- Actions -->
    <div class="flex items-center gap-2 shrink-0">
      <!-- Checkbox / Mark Done -->
      <div class="relative group">
        <button @click.stop="toggle"
          class="text-ink-3 hover:text-ink shrink-0 transition-colors mr-1 cursor-pointer flex items-center justify-center"
          :data-testid="`task-toggle-${task.id}`" 
          :aria-label="isDone ? 'Mark incomplete' : 'Mark complete'">
          <CheckCircle2 v-if="isDone" class="w-5 h-5 text-pri-strategic fill-pri-strategic-bg" />
          <Circle v-else class="w-5 h-5" />
        </button>
        <div class="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-ink text-surface text-[10px] rounded font-medium opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-200 whitespace-nowrap z-30 shadow-md">
          {{ isDone ? 'Mark incomplete' : 'Mark complete' }}
        </div>
      </div>

      <!-- Easy One-Click Snooze Button -->
      <div class="relative group" v-if="!isDone">
        <button @click.stop="snooze1d"
          class="p-2 rounded-xl border border-line bg-surface text-ink-3 hover:text-pri-interruptive hover:bg-canvas transition-all shadow-sm flex items-center justify-center"
          :data-testid="`task-snooze-${task.id}`">
          <BellOff class="w-4 h-4" />
        </button>
        <div class="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-ink text-surface text-[10px] rounded font-medium opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-200 whitespace-nowrap z-30 shadow-md">
          Snooze task (1 day)
        </div>
      </div>

      <!-- Snooze / Delete Menu -->
      <div class="relative">
        <button @click.stop="showMenu = !showMenu" class="btn-ghost !p-2" data-testid="task-menu-btn">
          <MoreVertical class="w-4 h-4 text-ink-3" />
        </button>

        <div v-if="showMenu"
          class="absolute right-0 top-10 w-40 rounded-xl bg-surface border border-line p-1 shadow-lg z-30 animate-rise-in font-sans">
          <div class="overline px-2.5 py-1">Snooze options</div>
          <button @click.stop="snooze(1)"
            class="w-full text-left text-xs text-ink hover:bg-canvas px-3 py-1.5 rounded-lg">Tomorrow</button>
          <button @click.stop="snooze(3)"
            class="w-full text-left text-xs text-ink hover:bg-canvas px-3 py-1.5 rounded-lg">3 Days</button>
          <button @click.stop="snooze(7)"
            class="w-full text-left text-xs text-ink hover:bg-canvas px-3 py-1.5 rounded-lg">1 Week</button>
          <div class="border-t border-line my-1"></div>
          <button @click.stop="ui.openTaskEdit(task); emit('open', task); showMenu = false"
            class="w-full text-left text-xs text-ink hover:bg-canvas px-3 py-1.5 rounded-lg flex items-center gap-1.5">
            <Edit3 class="w-3.5 h-3.5 text-ink-3" /> Edit Details
          </button>
          <button @click.stop="del"
            class="w-full text-left text-xs text-pri-critical hover:bg-pri-critical-bg/30 px-3 py-1.5 rounded-lg flex items-center gap-1.5"
            :data-testid="`task-delete-${task.id}`">
            <Trash2 class="w-3.5 h-3.5" /> Delete
          </button>
        </div>
      </div>
    </div>
  </div>

  <div v-else class="card py-1.5 px-4 flex items-center justify-between gap-4 border transition-all duration-300 hover:shadow-sm"
    :class="[isDone || snoozed ? 'opacity-60' : '', isOverdue ? '!bg-rose-50 !border-rose-400 dark:!bg-rose-950/30 dark:!border-rose-400' : '']"
    :data-testid="`task-card-${task.id}`">

    <div class="flex items-center gap-3 flex-1 min-w-0">
      <!-- Clickable Title & Details for Edit Modal -->
      <div class="min-w-0 flex-1 flex items-center gap-3 cursor-pointer" @click="ui.openTaskEdit(task); emit('open', task)">
        
        <!-- Labels row inline -->
        <div class="flex items-center gap-2 shrink-0">
          <!-- Project Tag -->
          <span v-if="showProject && project"
            class="text-[10px] uppercase tracking-wider font-semibold text-ink-3 bg-canvas border border-line px-2 py-0.5 rounded-full"
            data-testid="task-project-tag">
            {{ project.title }}
          </span>
          <!-- Status Tag with Dropdown Menu -->
          <div class="relative inline-block">
            <button @click.stop="showStatusMenu = !showStatusMenu"
              class="text-[10px] font-semibold px-2 py-0.5 rounded-full border flex items-center gap-1.5 hover:opacity-85 transition-all cursor-pointer"
              :class="statusStyle.color" title="Change status">
              <span class="w-1.5 h-1.5 rounded-full" :class="statusStyle.dotColor"></span>
              {{ statusStyle.label }}
            </button>

            <!-- Status Dropdown Menu -->
            <div v-if="showStatusMenu"
              class="absolute left-0 top-6 w-36 rounded-xl bg-surface border border-line p-1 shadow-lg z-30 animate-rise-in font-sans">
              <div class="overline px-2.5 py-1">Change status</div>
              <button @click.stop="updateStatus('open')"
                class="w-full text-left text-xs text-ink hover:bg-canvas px-3 py-1.5 rounded-lg flex items-center gap-2">
                <span class="w-1.5 h-1.5 rounded-full bg-ink-3"></span>
                Yet to start
              </button>
              <button @click.stop="updateStatus('in_progress')"
                class="w-full text-left text-xs text-ink hover:bg-canvas px-3 py-1.5 rounded-lg flex items-center gap-2">
                <span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                In progress
              </button>
              <button @click.stop="updateStatus('done')"
                class="w-full text-left text-xs text-ink hover:bg-canvas px-3 py-1.5 rounded-lg flex items-center gap-2">
                <span class="w-1.5 h-1.5 rounded-full bg-[#7d7975]"></span>
                Complete
              </button>
            </div>
          </div>
          <!-- Priority Badge -->
          <PriorityBadge :important="task.important" :urgent="task.urgent" :compact="false" />
        </div>

        <!-- Title -->
        <h4 class="font-medium text-ink text-sm leading-snug truncate"
          :class="{ 'line-through text-ink-3': isDone }">
          {{ task.title }}
        </h4>

        <!-- Description (subtle inline if exists) -->
        <span v-if="task.description && !compact" class="text-xs text-ink-3 truncate hidden md:inline max-w-[200px]">
          — {{ task.description }}
        </span>

        <!-- Metrics & Meta (inline right-aligned in main area) -->
        <div class="flex items-center gap-3 text-[11px] text-ink-3 shrink-0 ml-auto mr-2">
          <span v-if="task.scheduledDate" class="flex items-center gap-1 font-medium">
            <Calendar class="w-3.5 h-3.5" /> {{ inFuture(task.scheduledDate) }}
          </span>
          <span v-if="task.dueDate" class="flex items-center gap-1 font-medium" :class="isOverdue ? 'text-pri-critical font-bold' : 'text-ink-3'">
            <AlertCircle v-if="isOverdue" class="w-3.5 h-3.5 text-pri-critical shrink-0" />
            <Clock v-else class="w-3.5 h-3.5" /> due {{ inFuture(task.dueDate) }}
          </span>
          <!-- Closed date for completed tasks -->
          <span v-if="isDone && task.completedAt" class="flex items-center gap-1 text-pri-strategic font-semibold">
            <CheckCircle2 class="w-3.5 h-3.5" /> Closed {{ dayjs(task.completedAt).format('MMM D') }}
          </span>
          <span v-if="snoozed" class="italic text-pri-interruptive">
            snoozed
          </span>
          <span v-if="task.tags && task.tags.length" class="inline-flex items-center gap-1">
            <template v-for="t in task.tags" :key="t">·{{ t }}</template>
          </span>
        </div>

      </div>
    </div>

    <!-- Actions -->
    <div class="flex items-center gap-2 shrink-0">
      <!-- Checkbox / Mark Done -->
      <div class="relative group">
        <button @click.stop="toggle"
          class="text-ink-3 hover:text-ink shrink-0 transition-colors mr-1 cursor-pointer flex items-center justify-center"
          :data-testid="`task-toggle-${task.id}`" 
          :aria-label="isDone ? 'Mark incomplete' : 'Mark complete'">
          <CheckCircle2 v-if="isDone" class="w-5 h-5 text-pri-strategic fill-pri-strategic-bg" />
          <Circle v-else class="w-5 h-5" />
        </button>
        <div class="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-ink text-surface text-[10px] rounded font-medium opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-200 whitespace-nowrap z-30 shadow-md">
          {{ isDone ? 'Mark incomplete' : 'Mark complete' }}
        </div>
      </div>

      <!-- Easy One-Click Snooze Button -->
      <div class="relative group" v-if="!isDone">
        <button @click.stop="snooze1d"
          class="p-1 rounded-lg border border-line bg-surface text-ink-3 hover:text-pri-interruptive hover:bg-canvas transition-all shadow-sm flex items-center justify-center"
          :data-testid="`task-snooze-${task.id}`">
          <BellOff class="w-3.5 h-3.5" />
        </button>
        <div class="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-ink text-surface text-[10px] rounded font-medium opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-200 whitespace-nowrap z-30 shadow-md">
          Snooze task (1 day)
        </div>
      </div>

      <!-- Snooze / Delete Menu -->
      <div class="relative">
        <button @click.stop="showMenu = !showMenu" class="btn-ghost !p-1.5" data-testid="task-menu-btn">
          <MoreVertical class="w-3.5 h-3.5 text-ink-3" />
        </button>

        <div v-if="showMenu"
          class="absolute right-0 top-8 w-40 rounded-xl bg-surface border border-line p-1 shadow-lg z-30 animate-rise-in font-sans">
          <div class="overline px-2.5 py-1">Snooze options</div>
          <button @click.stop="snooze(1)"
            class="w-full text-left text-xs text-ink hover:bg-canvas px-3 py-1.5 rounded-lg">Tomorrow</button>
          <button @click.stop="snooze(3)"
            class="w-full text-left text-xs text-ink hover:bg-canvas px-3 py-1.5 rounded-lg">3 Days</button>
          <button @click.stop="snooze(7)"
            class="w-full text-left text-xs text-ink hover:bg-canvas px-3 py-1.5 rounded-lg">1 Week</button>
          <div class="border-t border-line my-1"></div>
          <button @click.stop="ui.openTaskEdit(task); emit('open', task); showMenu = false"
            class="w-full text-left text-xs text-ink hover:bg-canvas px-3 py-1.5 rounded-lg flex items-center gap-1.5">
            <Edit3 class="w-3.5 h-3.5 text-ink-3" /> Edit Details
          </button>
          <button @click.stop="del"
            class="w-full text-left text-xs text-pri-critical hover:bg-pri-critical-bg/30 px-3 py-1.5 rounded-lg flex items-center gap-1.5"
            :data-testid="`task-delete-${task.id}`">
            <Trash2 class="w-3.5 h-3.5" /> Delete
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
