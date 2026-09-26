<script setup>
import { computed, ref, onUnmounted, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useWorkItemsStore } from '@/stores/workItems'
import { useWorkClientsStore } from '@/stores/workClients'
import { useUIStore } from '@/stores/ui'
import { useSettingsStore } from '@/stores/settings'
import {
  Play, Pause, Clock, AlertCircle, Sparkles, ChevronRight,
  Trash, Calendar, MoreVertical, CheckCircle2, Circle, BellOff, Star, HardDrive, Edit3,
  X, CheckCircle
} from 'lucide-vue-next'
import dayjs from 'dayjs'
import VTooltip from '@/components/VTooltip.vue'
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
const settings = useSettingsStore()

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

const clientInitials = computed(() => {
  if (!client.value || !client.value.name) return ''
  const parts = client.value.name.trim().split(/\s+/)
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase()
  }
  return parts[0].slice(0, 2).toUpperCase()
})

const clientAvatarBg = computed(() => {
  if (!client.value || !client.value.name) return 'bg-[#ff8da1] text-white'
  const name = client.value.name
  const colors = [
    'bg-[#ff8da1] text-white',
    'bg-[#ffbe5b] text-white',
    'bg-[#8b7ff7] text-white',
    'bg-[#4dd0a1] text-white',
    'bg-[#54c3f1] text-white',
    'bg-[#f085e6] text-white'
  ]
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash)
  }
  const index = Math.abs(hash) % colors.length
  return colors[index]
})

const accentBarColor = computed(() => {
  const status = props.item.status || 'in_progress'
  if (itemsStore.isCompleted(status)) return 'bg-neutral-300 dark:bg-neutral-700'
  if (isOverdue.value || status === 'critical' || quadrant.value === 'critical') return 'bg-[#ff3b68]'
  if (status === 'on_hold') return 'bg-[#ff9500]'
  if (status === 'waiting_feedback' || status === 'ask_milestone') return 'bg-[#3478f6]'
  return 'bg-[#10b981]'
})

const cardBgStyle = computed(() => {
  if (itemsStore.isCompleted(props.item.status)) return 'bg-surface/50 opacity-60 border-line/60'
  const status = props.item.status || 'in_progress'
  if (isOverdue.value || status === 'critical' || quadrant.value === 'critical' || status === 'in_progress') {
    return 'bg-[#fff5f7] dark:bg-rose-950/20 border-[#ffe2e8] dark:border-rose-900/40'
  }
  if (status === 'on_hold') {
    return 'bg-[#fffdf5] dark:bg-amber-950/20 border-[#fff3d6] dark:border-amber-900/40'
  }
  return 'bg-surface border-line/70 hover:border-line-2 shadow-2xs'
})

const formattedTags = computed(() => {
  const tagsSet = new Set()
  if (client.value && Array.isArray(client.value.tags)) {
    client.value.tags.forEach(t => tagsSet.add(t.replace(/^#/, '')))
  }
  if (props.item.tags) {
    if (Array.isArray(props.item.tags)) {
      props.item.tags.forEach(t => tagsSet.add(t.replace(/^#/, '')))
    } else if (typeof props.item.tags === 'string') {
      props.item.tags.split(',').forEach(t => {
        const clean = t.trim().replace(/^#/, '')
        if (clean) tagsSet.add(clean)
      })
    }
  }
  return Array.from(tagsSet)
})

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
  if (itemsStore.isCompleted(props.item.status)) return false
  
  const due = props.item.dueDate ? dayjs(props.item.dueDate) : null
  const snooze = props.item.snoozedUntil ? dayjs(props.item.snoozedUntil) : null
  
  if (!due && !snooze) return false
  
  let targetDate
  if (due && snooze) {
    targetDate = due.isAfter(snooze) ? due : snooze
  } else {
    targetDate = due || snooze
  }
  
  return targetDate.isBefore(dayjs(), 'day')
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
  const rootDir = settings.get('work_drive_root', 'AtriumWork')
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
  <div class="relative rounded-2xl p-4 md:p-4.5 border transition-all duration-300 hover:shadow-xs"
    :class="[cardBgStyle, timerActive ? 'border-pri-strategic shadow-md shadow-pri-strategic/5' : '', (showMenu || showStatusMenu) ? 'z-30' : '']"
    data-testid="work-item-card">

    <!-- FAR LEFT VERTICAL ACCENT STRIPE -->
    <div class="absolute inset-0 rounded-2xl overflow-hidden pointer-events-none">
      <div class="absolute left-0 top-0 bottom-0 w-1" :class="accentBarColor"></div>
    </div>

    <div class="pl-1.5 space-y-2">
      <!-- TOP METADATA ROW: CLIENT, TIME, STATUS, TAGS, DUE DATE, FOLDER LINK -->
      <div class="flex items-center justify-between gap-3 text-xs flex-wrap sm:flex-nowrap">
        <!-- LEFT: CLIENT AVATAR, NAME, TIME, STATUS PILL & TAGS -->
        <div class="flex items-center gap-2 flex-wrap min-w-0">
          <!-- Client Circle Avatar & Name -->
          <div v-if="client" @click.stop="goToClientPage"
            class="flex items-center gap-1.5 cursor-pointer group shrink-0"
            title="Go to client details">
            <span class="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-semibold shrink-0 shadow-2xs opacity-90"
              :class="clientAvatarBg">
              {{ clientInitials }}
            </span>
            <span class="text-[11px] font-medium uppercase tracking-wider text-ink-3 group-hover:text-ink-2 transition-colors">
              {{ client.name }}
            </span>
            <span v-if="clientLocalTime" class="text-[11px] text-ink-3/80">
              · {{ clientLocalTime }} LOCAL
            </span>
          </div>

          <span v-if="client" class="text-line-2 text-xs select-none">|</span>

          <!-- Status Dropdown Pill -->
          <div class="relative inline-block shrink-0">
            <button @click.stop="showStatusMenu = !showStatusMenu"
              class="text-[11px] font-medium px-2.5 py-0.5 rounded-full border flex items-center gap-1.5 hover:opacity-85 transition-all cursor-pointer"
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
              <div class="text-[9px] uppercase tracking-wider text-ink-3 font-bold px-2.5 py-1 border-t border-line/40 mt-1">In progress</div>
              <button v-for="st in statusGroups.in_progress" :key="st.key" @click.stop="updateStatus(st.key)"
                class="w-full text-left text-xs text-ink hover:bg-canvas px-3 py-1.5 rounded-lg flex items-center gap-2">
                <span class="w-1.5 h-1.5 rounded-full" :class="st.dotColor"></span>
                {{ st.label }}
              </button>

              <!-- Complete Group -->
              <div class="text-[9px] uppercase tracking-wider text-ink-3 font-bold px-2.5 py-1 border-t border-line/40 mt-1">Complete</div>
              <button v-for="st in statusGroups.complete" :key="st.key" @click.stop="updateStatus(st.key)"
                class="w-full text-left text-xs text-ink hover:bg-canvas px-3 py-1.5 rounded-lg flex items-center gap-2">
                <span class="w-1.5 h-1.5 rounded-full" :class="st.dotColor"></span>
                {{ st.label }}
              </button>
            </div>
          </div>

          <!-- Hashtag Tag Pills -->
          <template v-if="formattedTags.length">
            <span v-for="tag in formattedTags" :key="tag"
              class="text-[11px] font-medium text-indigo-600 dark:text-indigo-300 bg-[#eeebff] dark:bg-indigo-950/40 border border-[#dcd6ff] dark:border-indigo-800/40 px-2.5 py-0.5 rounded-full">
              #{{ tag }}
            </span>
          </template>
        </div>

        <!-- RIGHT: DUE DATE & DRIVE FOLDER LINK -->
        <div class="flex items-center gap-2.5 shrink-0 text-[11px]">
          <!-- Due Date Alert -->
          <span v-if="props.item.dueDate" class="flex items-center gap-1 font-semibold"
            :class="isOverdue ? 'text-rose-600 dark:text-rose-400' : 'text-rose-500/90 dark:text-rose-400/90'">
            <AlertCircle class="w-3.5 h-3.5 text-rose-500 shrink-0" />
            Due {{ dayjs(props.item.dueDate).format('MMM D') }}
          </span>

          <!-- Closed Date Badge -->
          <span v-if="itemsStore.isCompleted(props.item.status)" class="flex items-center gap-1 text-pri-strategic font-semibold">
            <CheckCircle2 class="w-3.5 h-3.5" /> Closed {{ dayjs(props.item.closedDate || props.item.updatedAt).format('MMM D') }}
          </span>

          <span v-if="props.item.dueDate || itemsStore.isCompleted(props.item.status)" class="text-line-2 text-xs select-none">|</span>

          <!-- Drive Folder Link -->
          <div @click.stop class="inline-flex items-center">
            <a v-if="driveFolderUrl" :href="driveFolderUrl" target="_blank"
              class="text-[11px] text-ink-2 hover:text-ink flex items-center gap-1 font-medium transition-colors">
              <HardDrive class="w-3.5 h-3.5 text-ink-3" /> Folder
            </a>
            <button v-else-if="!itemsStore.isCompleted(props.item.status)" @click="triggerLinkDriveFolder"
              class="text-[11px] text-ink-3 hover:text-ink flex items-center gap-1 font-medium transition-colors">
              + Link Drive
            </button>
          </div>
        </div>
      </div>

      <!-- BOTTOM ROW: TASK TITLE, DESCRIPTION & RIGHT ACTION BUTTONS -->
      <div class="flex items-start justify-between gap-4">
        <!-- Title & Description (Clickable to Edit) -->
        <div class="min-w-0 flex-1 cursor-pointer" @click="showEditModal = true">
          <h4 class="font-semibold text-base text-ink leading-snug font-sans"
            :class="{ 'line-through text-ink-3': itemsStore.isCompleted(props.item.status) }">
            {{ props.item.title }}
          </h4>
          <p v-if="props.item.description" class="text-xs text-ink-3 mt-0.5 line-clamp-1 leading-snug">
            {{ props.item.description }}
          </p>
        </div>

        <!-- Action Icons Group -->
        <div class="flex items-center gap-1.5 shrink-0 pt-0.5">
          <!-- Circle Mark Done Button -->
          <VTooltip :text="itemsStore.isCompleted(props.item.status) ? 'Mark incomplete' : 'Mark complete'">
            <button @click.stop="toggleStatus"
              class="p-1 text-ink-3 hover:text-ink flex items-center justify-center cursor-pointer transition-colors shrink-0">
              <CheckCircle2 v-if="itemsStore.isCompleted(props.item.status)" class="w-5 h-5 text-pri-strategic fill-pri-strategic-bg" />
              <Circle v-else class="w-5 h-5" />
            </button>
          </VTooltip>

          <!-- Easy Snooze Bell Button -->
          <VTooltip v-if="!itemsStore.isCompleted(props.item.status)" text="Snooze until tomorrow">
            <button @click.stop="oneClickSnooze"
              class="w-7 h-7 rounded-lg border border-line bg-surface/80 text-ink-3 hover:text-pri-interruptive hover:bg-canvas transition-all shadow-2xs flex items-center justify-center cursor-pointer shrink-0">
              <BellOff class="w-3.5 h-3.5" />
            </button>
          </VTooltip>

          <!-- More Options (Three Dots) -->
          <div class="relative shrink-0">
            <VTooltip text="More options" position="top-right">
              <button @click.stop="showMenu = !showMenu"
                class="p-1 text-ink-3 hover:text-ink flex items-center justify-center cursor-pointer transition-colors shrink-0">
                <MoreVertical class="w-5 h-5" />
              </button>
            </VTooltip>

            <div v-if="showMenu"
              class="absolute right-0 top-9 w-40 rounded-xl bg-surface border border-line p-1 shadow-lg z-30 animate-rise-in font-sans">
              <div class="overline px-2.5 py-1">Snooze options</div>
              <button @click.stop="snooze(1)" class="w-full text-left text-xs text-ink hover:bg-canvas px-3 py-1.5 rounded-lg">Tomorrow</button>
              <button @click.stop="snooze(3)" class="w-full text-left text-xs text-ink hover:bg-canvas px-3 py-1.5 rounded-lg">3 Days</button>
              <button @click.stop="snooze(7)" class="w-full text-left text-xs text-ink hover:bg-canvas px-3 py-1.5 rounded-lg">1 Week</button>
              <div class="border-t border-line my-1"></div>
              <button @click.stop="showEditModal = true" class="w-full text-left text-xs text-ink hover:bg-canvas px-3 py-1.5 rounded-lg flex items-center gap-1.5">
                <Edit3 class="w-3.5 h-3.5 text-ink-3" /> Edit Details
              </button>
              <button @click.stop="deleteItem" class="w-full text-left text-xs text-pri-critical hover:bg-pri-critical-bg/30 px-3 py-1.5 rounded-lg flex items-center gap-1.5">
                <Trash class="w-3.5 h-3.5" /> Delete
              </button>
            </div>
          </div>
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
