<script setup>
import { computed, ref, onUnmounted, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useWorkItemsStore } from '@/stores/workItems'
import { useWorkClientsStore } from '@/stores/workClients'
import { useUIStore } from '@/stores/ui'
import {
  Play, Pause, Clock, AlertCircle, Sparkles, ChevronRight,
  Trash, Calendar, MoreVertical, CheckCircle2, Circle, BellOff, Star, HardDrive, Edit3,
  X, CheckCircle
} from 'lucide-vue-next'
import dayjs from 'dayjs'
import WorkItemPopup from '@/components/work/WorkItemPopup.vue'

const route = useRoute()
const router = useRouter()
const showStatusMenu = ref(false)
const targetCompletedStatus = ref('complete')

const statusGroups = {
  to_do: [
    { key: 'waiting_feedback', label: 'Waiting For Feedback', dotColor: 'bg-[#7d7975]' },
    { key: 'on_hold', label: 'On Hold', dotColor: 'bg-amber-500' },
    { key: 'ask_milestone', label: 'Ask For Next Milestone', dotColor: 'bg-blue-500' },
    { key: 'pending_closure', label: 'Pending Closure', dotColor: 'bg-orange-500' }
  ],
  in_progress: [
    { key: 'critical', label: 'Critical', dotColor: 'bg-red-500' },
    { key: 'in_progress', label: 'In Progress', dotColor: 'bg-emerald-500' }
  ],
  complete: [
    { key: 'complete', label: 'Complete', dotColor: 'bg-[#7d7975]' },
    { key: 'dropped', label: 'Dropped', dotColor: 'bg-pink-500' }
  ]
}

function goToClientPage() {
  if (client.value) {
    router.push(`/work/clients/${client.value.id}`)
  }
}

function updateStatus(statusKey) {
  showStatusMenu.value = false
  if (itemsStore.isCompleted(statusKey)) {
    targetCompletedStatus.value = statusKey
    ratingValue.value = 5
    showRatingModal.value = true
  } else {
    itemsStore.update(props.item.id, { status: statusKey })
    ui.showToast(`Work item status updated to: ${STATUS_MAP[statusKey]?.label}`, 'success')
  }
}

function closeMenus() {
  showStatusMenu.value = false
  showMenu.value = false
}

onMounted(() => {
  window.addEventListener('click', closeMenus)
  window.addEventListener('keydown', handleEscKey)
})

const props = defineProps({
  item: { type: Object, required: true }
})

const itemsStore = useWorkItemsStore()
const clientsStore = useWorkClientsStore()
const ui = useUIStore()

const showMenu = ref(false)
const showEditModal = ref(false)
const showRatingModal = ref(false)
const ratingValue = ref(5)
const timerActive = ref(false)
const secondsElapsed = ref(0)
let timerInterval = null

const client = computed(() => {
  if (!props.item.clientId) return null
  return clientsStore.items.find(c => c.id === props.item.clientId)
})

const STATUS_MAP = {
  waiting_feedback: { label: 'Waiting For Feedback', color: 'bg-[#7d7975]/10 text-[#7d7975] border-[#7d7975]/20', dotColor: 'bg-[#7d7975]' },
  on_hold: { label: 'On Hold', color: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20', dotColor: 'bg-amber-500' },
  ask_milestone: { label: 'Ask For Next Milestone', color: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20', dotColor: 'bg-blue-500' },
  pending_closure: { label: 'Pending Closure', color: 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20', dotColor: 'bg-orange-500' },
  critical: { label: 'Critical', color: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20', dotColor: 'bg-red-500' },
  in_progress: { label: 'In Progress', color: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20', dotColor: 'bg-emerald-500' },
  complete: { label: 'Complete', color: 'bg-[#7d7975]/10 text-[#7d7975] border-[#7d7975]/20', dotColor: 'bg-[#7d7975]' },
  dropped: { label: 'Dropped', color: 'bg-pink-500/10 text-pink-600 dark:text-pink-400 border-pink-500/20', dotColor: 'bg-pink-500' }
}

const statusStyle = computed(() => {
  const status = props.item.status || 'in_progress'
  if (status === 'done' || status === 'completed') return STATUS_MAP.complete
  if (status === 'open' || status === 'todo') return STATUS_MAP.in_progress
  return STATUS_MAP[status] || { label: status, color: 'bg-canvas text-ink-2 border-line', dotColor: 'bg-ink-3' }
})

const clientLocalTime = computed(() => {
  if (!client.value || !client.value.timezone) return ''
  try {
    return new Intl.DateTimeFormat('en-US', {
      timeZone: client.value.timezone,
      hour: 'numeric',
      minute: 'numeric',
      hour12: true
    }).format(new Date())
  } catch (e) {
    return ''
  }
})

const quadrant = computed(() => itemsStore.getQuadrant(props.item))

const priorityClass = computed(() => {
  switch (quadrant.value) {
    case 'critical':
      return 'bg-pri-critical-bg text-pri-critical border-pri-critical-bd'
    case 'strategic':
      return 'bg-pri-strategic-bg text-pri-strategic border-pri-strategic-bd'
    case 'interruptive':
      return 'bg-pri-interruptive-bg text-pri-interruptive border-pri-interruptive-bd'
    default:
      return 'bg-pri-backlog-bg text-pri-backlog border-pri-backlog-bd'
  }
})

const isOverran = computed(() => {
  return props.item.estimatedHours > 0 && props.item.actualHours > props.item.estimatedHours
})

const isOverdue = computed(() => {
  if (itemsStore.isCompleted(props.item.status) || !props.item.dueDate) return false
  return dayjs(props.item.dueDate).isBefore(dayjs(), 'day')
})

const driveFolderUrl = computed(() => {
  if (props.item.driveFolderId) {
    return `https://drive.google.com/drive/folders/${props.item.driveFolderId}`
  }
  // Try fallback to client drive folder
  if (client.value?.driveFolderId) {
    return `https://drive.google.com/drive/folders/${client.value.driveFolderId}`
  }
  return null
})

function toggleStatus() {
  const isDone = itemsStore.isCompleted(props.item.status)
  const nextStatus = isDone ? 'in_progress' : 'complete'

  if (nextStatus === 'complete') {
    targetCompletedStatus.value = 'complete'
    showRatingModal.value = true
  } else {
    itemsStore.update(props.item.id, { status: nextStatus })
    ui.showToast(`Work item marked as ${nextStatus}`, 'success')
  }
}

async function submitRating() {
  await itemsStore.update(props.item.id, {
    status: targetCompletedStatus.value,
    rating: ratingValue.value
  })

  if (client.value) {
    await clientsStore.update(client.value.id, {
      rating: ratingValue.value
    })
  }

  showRatingModal.value = false
  ui.showToast(`Task completed! Rated: ${ratingValue.value} stars`, 'success')
}

function skipRating() {
  itemsStore.update(props.item.id, { status: targetCompletedStatus.value })
  showRatingModal.value = false
  ui.showToast(`Task marked as complete`, 'success')
}

// Timer Logic
function toggleTimer() {
  if (timerActive.value) {
    // Stop
    clearInterval(timerInterval)
    timerActive.value = false

    // Save to DB (convert seconds to hours)
    const addedHrs = secondsElapsed.value / 3600
    const newActual = Number((props.item.actualHours + addedHrs).toFixed(2))
    itemsStore.update(props.item.id, { actualHours: newActual })

    ui.showToast(`Tracked ${Math.round(secondsElapsed.value / 60)}m of work`, 'success')
    secondsElapsed.value = 0
  } else {
    // Start
    timerActive.value = true
    secondsElapsed.value = 0
    timerInterval = setInterval(() => {
      secondsElapsed.value++
    }, 1000)

    // Automatically set status to in_progress if not already
    if (props.item.status === 'open') {
      itemsStore.update(props.item.id, { status: 'in_progress' })
    }
  }
}

const formattedTrackingTime = computed(() => {
  const hrs = Math.floor(secondsElapsed.value / 3600)
  const mins = Math.floor((secondsElapsed.value % 3600) / 60)
  const secs = secondsElapsed.value % 60
  return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
})

function snooze(days) {
  const date = dayjs().add(days, 'day').format('YYYY-MM-DD')
  itemsStore.update(props.item.id, { snoozedUntil: date })
  ui.showToast(`Snoozed until ${dayjs(date).format('MMM D')}`, 'info')
  showMenu.value = false
}

function oneClickSnooze() {
  // One click snooze defaults to tomorrow (1 day)
  snooze(1)
}

function deleteItem() {
  ui.confirm({
    title: 'Delete Work Item',
    message: `Are you sure you want to delete "${props.item.title}"?`,
    confirmText: 'Delete',
    isDestructive: true
  }).then(approved => {
    if (approved) {
      itemsStore.remove(props.item.id)
      ui.showToast('Item deleted', 'success')
    }
  })
}

async function triggerLinkDriveFolder() {
  const rootDir = localStorage.getItem('atrium.work.drive_root') || 'AtriumWork'
  const mockFolderId = `mock-task-drive-${Date.now()}`
  await itemsStore.update(props.item.id, {
    driveFolderId: mockFolderId
  })
  ui.showToast(`Simulated task folder initialized at "${rootDir}/${props.item.title}"`, 'success')
}

onUnmounted(() => {
  window.removeEventListener('click', closeMenus)
  window.removeEventListener('keydown', handleEscKey)
  if (timerInterval) clearInterval(timerInterval)
})

function handleEscKey(e) {
  if (e.key === 'Escape') {
    if (showEditModal.value) showEditModal.value = false
    if (showRatingModal.value) showRatingModal.value = false
  }
}

watch(() => route.query.id, (newId) => {
  if (newId === props.item.id) {
    showEditModal.value = true
  } else if (showEditModal.value && newId !== props.item.id) {
    showEditModal.value = false
  }
}, { immediate: true })

watch(showEditModal, (isOpen) => {
  if (!isOpen && route.query.id === props.item.id) {
    router.replace({ query: { ...route.query, id: undefined } })
  }
})
</script>

<template>
  <div class="card p-4 flex items-center justify-between gap-4 border transition-all duration-300 hover:shadow-sm"
    :class="[itemsStore.isCompleted(props.item.status) ? 'opacity-60' : '', timerActive ? 'border-pri-strategic shadow-md shadow-pri-strategic/5' : '', isOverdue ? '!bg-rose-50 !border-rose-400 dark:!bg-rose-950/30 dark:!border-rose-400' : '']"
    data-testid="work-item-card">

    <div class="flex items-start gap-3 flex-1 min-w-0">
      <!-- Clickable Title & Details for Edit Modal -->
      <div class="min-w-0 flex-1 cursor-pointer" @click="showEditModal = true">
        <div class="flex items-center gap-2 flex-wrap mb-1">
          <!-- Client Tag -->
          <span v-if="client" @click.stop="goToClientPage"
            class="text-[10px] uppercase tracking-wider font-semibold text-ink-3 bg-canvas border border-line px-2 py-0.5 rounded-full hover:bg-line/60 hover:text-ink transition-all cursor-pointer"
            title="Go to client details">
            {{ client.name }} <template v-if="clientLocalTime">· {{ clientLocalTime }} Local</template>
          </span>
          <!-- Status Tag with Dropdown Menu (Rightmost in labels list) -->
          <div class="relative inline-block">
            <button @click.stop="showStatusMenu = !showStatusMenu"
              class="text-[10px] font-semibold px-2 py-0.5 rounded-full border flex items-center gap-1.5 hover:opacity-85 transition-all cursor-pointer"
              :class="statusStyle.color" title="Change status">
              <span class="w-1.5 h-1.5 rounded-full" :class="statusStyle.dotColor"></span>
              {{ statusStyle.label }}
            </button>

            <!-- Status Dropdown Menu -->
            <div v-if="showStatusMenu"
              class="absolute left-0 top-6 w-48 rounded-xl bg-surface border border-line p-1 shadow-lg z-30 animate-rise-in font-sans">
              <div class="overline px-2.5 py-1">Change status</div>

              <!-- To-do Group -->
              <div class="text-[9px] uppercase tracking-wider text-ink-3 font-bold px-2.5 py-1">To-do</div>
              <button v-for="st in statusGroups.to_do" :key="st.key" @click.stop="updateStatus(st.key)"
                class="w-full text-left text-xs text-ink hover:bg-canvas px-3 py-1.5 rounded-lg flex items-center gap-2">
                <span class="w-1.5 h-1.5 rounded-full" :class="st.dotColor"></span>
                {{ st.label }}
              </button>

              <!-- In Progress Group -->
              <div
                class="text-[9px] uppercase tracking-wider text-ink-3 font-bold px-2.5 py-1 border-t border-line/40 mt-1">
                In
                progress</div>
              <button v-for="st in statusGroups.in_progress" :key="st.key" @click.stop="updateStatus(st.key)"
                class="w-full text-left text-xs text-ink hover:bg-canvas px-3 py-1.5 rounded-lg flex items-center gap-2">
                <span class="w-1.5 h-1.5 rounded-full" :class="st.dotColor"></span>
                {{ st.label }}
              </button>

              <!-- Complete Group -->
              <div
                class="text-[9px] uppercase tracking-wider text-ink-3 font-bold px-2.5 py-1 border-t border-line/40 mt-1">
                Complete</div>
              <button v-for="st in statusGroups.complete" :key="st.key" @click.stop="updateStatus(st.key)"
                class="w-full text-left text-xs text-ink hover:bg-canvas px-3 py-1.5 rounded-lg flex items-center gap-2">
                <span class="w-1.5 h-1.5 rounded-full" :class="st.dotColor"></span>
                {{ st.label }}
              </button>
            </div>
          </div>

          <!-- Consolidated Client Tags Badge (Placed after status) -->
          <span v-if="client && client.tags && client.tags.length"
            class="text-[10px] font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-2 py-0.5 rounded-full">
            {{ client.tags.map(t => '#' + t).join(' ') }}
          </span>
        </div>

        <h4 class="font-medium text-ink text-sm leading-snug"
          :class="{ 'line-through text-ink-3': itemsStore.isCompleted(props.item.status) }">
          {{ props.item.title }}
        </h4>
        <p v-if="props.item.description" class="text-xs text-ink-2 mt-1 line-clamp-1">
          {{ props.item.description }}
        </p>

        <!-- Metrics & Meta -->
        <div class="flex items-center gap-4 text-[11px] text-ink-3 mt-2 flex-wrap">
          <span v-if="props.item.dueDate" class="flex items-center gap-1 text-ink-2 font-medium" :class="{ 'text-pri-critical font-bold': isOverdue }">
            <AlertCircle v-if="isOverdue" class="w-3.5 h-3.5 text-pri-critical shrink-0" />
            <Calendar v-else class="w-3.5 h-3.5" /> Due {{ dayjs(props.item.dueDate).format('MMM D') }}
          </span>
          <!-- Closed date badge for completed items -->
          <span v-if="itemsStore.isCompleted(props.item.status)"
            class="flex items-center gap-1 text-pri-strategic font-semibold">
            <CheckCircle2 class="w-3.5 h-3.5" /> Closed {{ dayjs(props.item.closedDate ||
              props.item.updatedAt).format('MMM D, YYYY') }}
          </span>
          <span class="flex items-center gap-1" :class="isOverran ? 'text-pri-critical font-medium' : ''">
            <Clock class="w-3.5 h-3.5" />
            {{ props.item.actualHours }}h tracked / {{ props.item.estimatedHours || '-' }}h est
            <span v-if="isOverran"
              class="text-[9px] px-1 rounded bg-pri-critical-bg text-pri-critical border border-pri-critical-bd shrink-0">Creep</span>
          </span>
          <span v-if="props.item.snoozedUntil && !dayjs(props.item.snoozedUntil).isBefore(dayjs(), 'day')" class="italic text-pri-interruptive">
            Snoozed until {{ dayjs(props.item.snoozedUntil).format('MMM D') }}
          </span>

          <!-- Drive Folder Link -->
          <div @click.stop class="inline-flex items-center">
            <a v-if="driveFolderUrl" :href="driveFolderUrl" target="_blank"
              class="text-[10px] text-pri-strategic hover:underline flex items-center gap-1 bg-pri-strategic-bg/20 border border-pri-strategic-bd/20 px-2 py-0.5 rounded">
              <HardDrive class="w-3 h-3" /> Folder
            </a>
            <button v-else-if="!itemsStore.isCompleted(props.item.status)" @click="triggerLinkDriveFolder"
              class="text-[10px] text-ink-3 hover:text-ink flex items-center gap-0.5">
              + Link Drive
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Actions / Timer -->
    <div class="flex items-center gap-2 shrink-0">
      <!-- Checkbox / Mark Done -->
      <button @click.stop="toggleStatus"
        class="text-ink-3 hover:text-ink shrink-0 transition-colors mr-1 cursor-pointer">
        <CheckCircle2 v-if="itemsStore.isCompleted(props.item.status)"
          class="w-5 h-5 text-pri-strategic fill-pri-strategic-bg" />
        <Circle v-else class="w-5 h-5" />
      </button>

      <!-- Live Timer UI -->
      <div v-if="timerActive"
        class="flex items-center gap-2 bg-pri-strategic-bg border border-pri-strategic-bd text-pri-strategic px-2.5 py-1 rounded-xl text-xs font-semibold font-mono shadow-sm">
        <span class="w-2 h-2 rounded-full bg-pri-strategic animate-pulse"></span>
        {{ formattedTrackingTime }}
      </div>

      <!-- Play button -->
      <button v-if="!itemsStore.isCompleted(props.item.status)" @click.stop="toggleTimer"
        class="p-2 rounded-xl border border-line bg-surface transition-all shadow-sm"
        :class="timerActive ? 'text-pri-critical border-pri-critical-bd hover:bg-pri-critical-bg/20' : 'text-pri-strategic hover:bg-canvas'"
        title="Track time on this task">
        <Pause v-if="timerActive" class="w-4 h-4 fill-current" />
        <Play v-else class="w-4 h-4 fill-current" />
      </button>

      <!-- Easy One-Click Snooze Button -->
      <button v-if="!itemsStore.isCompleted(props.item.status)" @click.stop="oneClickSnooze"
        class="p-2 rounded-xl border border-line bg-surface text-ink-3 hover:text-pri-interruptive hover:bg-canvas transition-all shadow-sm"
        title="Snooze until tomorrow">
        <BellOff class="w-4 h-4" />
      </button>

      <!-- Snooze / Delete Menu -->
      <div class="relative">
        <button @click.stop="showMenu = !showMenu" class="btn-ghost !p-2">
          <MoreVertical class="w-4 h-4 text-ink-3" />
        </button>

        <div v-if="showMenu"
          class="absolute right-0 top-10 w-40 rounded-xl bg-surface border border-line p-1 shadow-lg z-30 animate-rise-in">
          <div class="overline px-2.5 py-1">Snooze options</div>
          <button @click.stop="snooze(1)"
            class="w-full text-left text-xs text-ink hover:bg-canvas px-3 py-1.5 rounded-lg">Tomorrow</button>
          <button @click.stop="snooze(3)"
            class="w-full text-left text-xs text-ink hover:bg-canvas px-3 py-1.5 rounded-lg">3
            Days</button>
          <button @click.stop="snooze(7)"
            class="w-full text-left text-xs text-ink hover:bg-canvas px-3 py-1.5 rounded-lg">1
            Week</button>
          <div class="border-t border-line my-1"></div>
          <button @click.stop="showEditModal = true"
            class="w-full text-left text-xs text-ink hover:bg-canvas px-3 py-1.5 rounded-lg flex items-center gap-1.5">
            <Edit3 class="w-3.5 h-3.5 text-ink-3" /> Edit Details
          </button>
          <button @click.stop="deleteItem"
            class="w-full text-left text-xs text-pri-critical hover:bg-pri-critical-bg/30 px-3 py-1.5 rounded-lg flex items-center gap-1.5">
            <Trash class="w-3.5 h-3.5" /> Delete
          </button>
        </div>
      </div>
    </div>

    <!-- Rating modal upon closing a task -->
    <Teleport to="body">
      <div v-if="showRatingModal" @keydown.window.esc="skipRating"
        class="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div class="fixed inset-0 bg-ink/40 backdrop-blur-sm animate-fade-in" @click="skipRating"></div>
        <div class="relative w-full max-w-sm card p-6 shadow-xl bg-surface z-50 animate-rise-in space-y-4"
          @keydown.enter="submitRating">
          <div class="text-center">
            <div class="overline text-pri-strategic">Feedback Loop</div>
            <h3 class="font-serif text-lg font-bold mt-1">Rate this task or client relationship</h3>
            <p class="text-xs text-ink-3 mt-1">Record feedback to evaluate premium rates and client relations.</p>
          </div>

          <div class="flex justify-center gap-2 py-4">
            <button v-for="star in 5" :key="star" @click="ratingValue = star"
              class="p-1 hover:scale-110 transition-transform">
              <Star class="w-8 h-8" :class="star <= ratingValue ? 'text-amber-500 fill-amber-500' : 'text-ink-3'" />
            </button>
          </div>

          <div class="flex gap-2">
            <button @click="skipRating" class="flex-1 btn-ghost text-xs">Skip Feedback</button>
            <button @click="submitRating" class="flex-1 btn-primary text-xs flex items-center justify-center gap-1">
              Confirm Done <span class="kbd !bg-canvas/20 !border-canvas/10 !text-canvas select-none text-[9px]">↵</span>
            </button>
          </div>
        </div>
      </div>
    </Teleport>

    <WorkItemPopup v-if="showEditModal" :item="props.item" @close="showEditModal = false" />
  </div>
</template>
