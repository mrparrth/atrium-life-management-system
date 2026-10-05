<script setup>
import { computed, ref, onUnmounted, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useWorkItemsStore } from '@/stores/workItems'
import { useWorkClientsStore } from '@/stores/workClients'
import { useUIStore } from '@/stores/ui'
import { useSettingsStore } from '@/stores/settings'
import {
  Play, Pause, Clock, AlertCircle, Sparkles, ChevronRight, ChevronLeft,
  Trash, Calendar, MoreVertical, CheckCircle2, Circle, BellOff, Star, HardDrive, Edit3,
  X, CheckCircle, Check
} from 'lucide-vue-next'
import dayjs from 'dayjs'
import VTooltip from '@/components/VTooltip.vue'
import WorkItemPopup from '@/components/work/WorkItemPopup.vue'
import DueDatePicker from '@/components/DueDatePicker.vue'
import { createClientDriveFolder, createClientDriveFolderInParent } from '@/services/drive'
import drivePresentIcon from '@/assets/icons/drive-present.png'
import driveAddIcon from '@/assets/icons/drive-add.png'

const route = useRoute()
const router = useRouter()
const showStatusMenu = ref(false)
const showDatePicker = ref(false)
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

async function updateDueDate(newDate) {
  await itemsStore.update(props.item.id, { dueDate: newDate })
  if (newDate) {
    ui.showToast(`Due date updated to ${dayjs(newDate).format('MMM D, YYYY')}`, 'success')
  } else {
    ui.showToast('Due date cleared', 'info')
  }
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

const clientInitials = computed(() => {
  if (!client.value || !client.value.name) return ''
  const parts = client.value.name.trim().split(/\s+/)
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase()
  }
  return client.value.name.substring(0, 2).toUpperCase()
})

const clientAvatarBg = computed(() => {
  if (!client.value) return 'bg-canvas text-ink-3 border-line'
  const status = props.item.status || 'in_progress'
  if (isOverdue.value || status === 'critical') return 'bg-rose-500/20 text-rose-700 dark:text-rose-300 border-rose-500/30'
  if (status === 'on_hold' || status === 'pending_closure') return 'bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-500/30'
  return 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-500/30'
})

const accentBarClass = computed(() => {
  if (itemsStore.isCompleted(props.item.status)) return 'bg-ink-3/40'
  if (isOverdue.value || props.item.status === 'critical') return 'bg-rose-500'
  if (props.item.status === 'on_hold' || props.item.status === 'pending_closure' || props.item.status === 'waiting_feedback') return 'bg-amber-500'
  if (props.item.status === 'in_progress') return 'bg-emerald-500'
  return 'bg-emerald-500'
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
  ui.showToast('Connecting to Google Drive...', 'info')
  try {
    let folderId
    if (client.value?.driveFolderId) {
      folderId = await createClientDriveFolderInParent(props.item.title, client.value.driveFolderId)
    } else {
      const rootDir = settings.get('work_drive_root', 'AtriumWork')
      folderId = await createClientDriveFolder(props.item.title, rootDir)
    }
    await itemsStore.update(props.item.id, { driveFolderId: folderId })
    ui.showToast(`Drive folder created: "${props.item.title}"`, 'success')
  } catch (e) {
    ui.showToast(`Failed to create Drive folder: ${e.message}`, 'error')
  }
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
  <div
    class="card !p-0 flex items-stretch rounded-2xl border transition-all duration-300 hover:shadow-sm relative overflow-visible has-[.date-picker-open]:!z-40"
    :class="[
      (showDatePicker || showStatusMenu || showMenu) ? '!z-40' : 'z-10',
      itemsStore.isCompleted(props.item.status) ? 'opacity-60 bg-surface/40 border-line/60' :
        isOverdue ? '!bg-rose-50/50 !border-rose-300 dark:!bg-rose-950/20 dark:!border-rose-800/50' :
          (props.item.status === 'on_hold' || props.item.status === 'pending_closure') ? '!bg-amber-50/50 !border-amber-300 dark:!bg-amber-950/20 dark:!border-amber-800/50' :
            'bg-surface border-line hover:border-line-2'
    ]" data-testid="work-item-card">

    <!-- Inner Background Clip for Left Accent Strip (so it never sticks out of card border) -->
    <div class="absolute inset-0 rounded-2xl overflow-hidden pointer-events-none">
      <div class="w-1.5 h-full" :class="accentBarClass"></div>
    </div>

    <!-- Layout Spacer for Left Accent Strip -->
    <div class="w-1.5 shrink-0 self-stretch pointer-events-none"></div>

    <!-- Main Card Content Area (2 Distinct Rows) -->
    <div class="p-3.5 md:p-4 flex-1 min-w-0 flex flex-col justify-between space-y-1.5 cursor-pointer relative z-10"
      @click="showEditModal = true">

      <!-- ROW 1: Client Name & Tags on Left | Status & Drive Link on Right -->
      <div class="flex items-center justify-between gap-2 flex-wrap min-w-0">
        <!-- Left group: Avatar + Client Name/Time + Tags -->
        <div class="flex items-center gap-2 flex-wrap min-w-0">
          <!-- Client Initials Avatar Circle -->
          <span v-if="client" @click.stop="goToClientPage"
            class="w-5 h-5 rounded-full text-[9px] font-bold shrink-0 flex items-center justify-center border transition-transform hover:scale-105"
            :class="clientAvatarBg" title="Go to client details">
            {{ clientInitials }}
          </span>

          <!-- Client Name & Local Time Tag -->
          <span v-if="client" @click.stop="goToClientPage"
            class="text-[10px] uppercase tracking-wider font-semibold text-ink-3 hover:text-ink transition-all cursor-pointer"
            title="Go to client details">
            {{ client.name }} <template v-if="clientLocalTime">· {{ clientLocalTime }} LOCAL</template>
          </span>

          <!-- Separator if client exists and tags exist -->
          <span v-if="client && client.tags && client.tags.length" class="text-line-2 text-xs select-none">|</span>

          <!-- Individual Client Tag Badges -->
          <template v-if="client && client.tags && client.tags.length">
            <span v-for="tag in client.tags" :key="tag"
              class="text-[10px] font-medium text-indigo-600/75 dark:text-indigo-300/80 bg-indigo-500/[0.05] dark:bg-indigo-400/10 border border-indigo-500/15 dark:border-indigo-400/20 px-2 py-0.5 rounded-full">
              #{{ tag }}
            </span>
          </template>
        </div>

        <!-- Right group: Status Dropdown & Due Date Badge -->
        <div class="flex items-center gap-2 text-[11px] text-ink-3 shrink-0">
          <!-- Status Tag with Dropdown Menu -->
          <div class="relative inline-block">
            <button @click.stop="showStatusMenu = !showStatusMenu"
              class="text-[10px] font-semibold px-2.5 py-0.5 rounded-full border flex items-center gap-1.5 hover:opacity-85 transition-all cursor-pointer"
              :class="statusStyle.color" title="Change status">
              <span class="w-1.5 h-1.5 rounded-full" :class="statusStyle.dotColor"></span>
              {{ statusStyle.label }}
            </button>

            <!-- Status Dropdown Menu -->
            <div v-if="showStatusMenu"
              class="absolute right-0 top-6 w-48 rounded-xl bg-surface border border-line p-1 shadow-lg z-30 animate-rise-in font-sans">
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
                In progress</div>
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

          <!-- Due Date Badge with Interactive Calendar Popover -->
          <DueDatePicker
            v-model:open="showDatePicker"
            :modelValue="props.item.dueDate"
            :isOverdue="isOverdue"
            iconType="calendar"
            labelPrefix="Due"
            @update:modelValue="updateDueDate" />
        </div>
      </div>

      <!-- ROW 2 (Slightly Taller Height): Title on Left | Action Buttons (Drive, Snooze, Menu) on Right -->
      <div class="flex items-center justify-between gap-4 min-w-0">
        <!-- Left: Title + Description -->
        <div class="min-w-0 flex-1 space-y-0.5">
          <div class="flex items-center gap-2.5 flex-wrap">
            <h4 class="font-medium text-ink text-sm leading-snug"
              :class="{ 'line-through text-ink-3': itemsStore.isCompleted(props.item.status) }">
              {{ props.item.title }}
            </h4>

            <!-- Closed date badge next to title -->
            <span v-if="itemsStore.isCompleted(props.item.status)"
              class="flex items-center gap-1 text-[11px] text-pri-strategic font-semibold shrink-0">
              <CheckCircle2 class="w-3.5 h-3.5" /> Closed {{ dayjs(props.item.closedDate ||
                props.item.updatedAt).format('MMM D, YYYY') }}
            </span>
          </div>

          <p v-if="props.item.description" class="text-xs text-ink-2 mt-1 line-clamp-1">
            {{ props.item.description }}
          </p>
        </div>

        <!-- Right: Action Buttons (Checkmark, Google Drive Icon, Snooze, Menu) -->
        <div class="flex items-center gap-2 shrink-0 self-center" @click.stop>
          <!-- Google Drive Icon Button (Matching User Uploaded Icons, Transparent Vector SVG) -->
          <VTooltip v-if="driveFolderUrl" text="Open Google Drive folder" position="top-right">
            <a :href="driveFolderUrl" target="_blank"
              class="p-2 rounded-xl border border-line bg-surface text-ink-3 hover:text-ink hover:bg-canvas transition-all shadow-sm flex items-center justify-center cursor-pointer shrink-0"
              title="Open Google Drive folder">
              <svg viewBox="0 0 24 24" class="w-4 h-4 shrink-0 fill-current text-ink-2 hover:text-ink transition-colors"
                xmlns="http://www.w3.org/2000/svg">
                <path
                  d="M12.01 1.485c-2.082 0-3.754.02-3.743.047.01.02 1.708 3.001 3.774 6.62l3.76 6.574h3.76c2.081 0 3.753-.02 3.742-.047-.005-.02-1.708-3.001-3.775-6.62l-3.76-6.574zm-4.76 1.73a789.828 789.861 0 0 0-3.63 6.319L0 15.868l1.89 3.298 1.885 3.297 3.62-6.335 3.618-6.33-1.88-3.287C8.1 4.704 7.255 3.22 7.25 3.214zm2.259 12.653-.203.348c-.114.198-.96 1.672-1.88 3.287a423.93 423.948 0 0 1-1.698 2.97c-.01.026 3.24.042 7.222.042h7.244l1.796-3.157c.992-1.734 1.85-3.23 1.906-3.323l.104-.167h-7.249z" />
              </svg>
            </a>
          </VTooltip>
          <VTooltip v-else-if="!itemsStore.isCompleted(props.item.status)" text="Generate Google Drive folder"
            position="top-right">
            <button @click="triggerLinkDriveFolder"
              class="p-2 rounded-xl border border-dashed border-line bg-surface text-ink-3 hover:text-ink hover:bg-canvas transition-all shadow-sm flex items-center justify-center cursor-pointer shrink-0"
              title="Generate Google Drive folder">
              <span class="relative flex items-center justify-center">
                <svg viewBox="0 0 24 24"
                  class="w-4 h-4 shrink-0 fill-none stroke-current text-ink-3 hover:text-ink transition-colors"
                  stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" xmlns="http://www.w3.org/2000/svg">
                  <path
                    d="M12.01 1.485c-2.082 0-3.754.02-3.743.047.01.02 1.708 3.001 3.774 6.62l3.76 6.574h3.76c2.081 0 3.753-.02 3.742-.047-.005-.02-1.708-3.001-3.775-6.62l-3.76-6.574zm-4.76 1.73a789.828 789.861 0 0 0-3.63 6.319L0 15.868l1.89 3.298 1.885 3.297 3.62-6.335 3.618-6.33-1.88-3.287C8.1 4.704 7.255 3.22 7.25 3.214zm2.259 12.653-.203.348c-.114.198-.96 1.672-1.88 3.287a423.93 423.948 0 0 1-1.698 2.97c-.01.026 3.24.042 7.222.042h7.244l1.796-3.157c.992-1.734 1.85-3.23 1.906-3.323l.104-.167h-7.249z" />
                </svg>
                <span
                  class="absolute -top-2 -right-2 text-[10px] font-extrabold text-pri-strategic bg-surface rounded-full w-3.5 h-3.5 flex items-center justify-center leading-none border border-pri-strategic/40 shadow-xs select-none">+</span>
              </span>
            </button>
          </VTooltip>

          <!-- Easy One-Click Snooze Button -->
          <VTooltip v-if="!itemsStore.isCompleted(props.item.status)" text="Snooze until tomorrow">
            <button @click.stop="oneClickSnooze"
              class="p-2 rounded-xl border border-line bg-surface text-ink-3 hover:text-pri-interruptive hover:bg-canvas transition-all shadow-sm flex items-center justify-center cursor-pointer shrink-0">
              <BellOff class="w-4 h-4" />
            </button>
          </VTooltip>

          <!-- More Options (Three Dots) -->
          <div class="relative shrink-0">
            <VTooltip text="More options" position="top-right">
              <button @click.stop="showMenu = !showMenu"
                class="btn-ghost !p-2 text-ink-3 hover:text-ink cursor-pointer">
                <MoreVertical class="w-4 h-4" />
              </button>
            </VTooltip>

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
              Confirm Done <span
                class="kbd !bg-canvas/20 !border-canvas/10 !text-canvas select-none text-[9px]">↵</span>
            </button>
          </div>
        </div>
      </div>
    </Teleport>

    <WorkItemPopup v-if="showEditModal" :item="props.item" @close="showEditModal = false" />
  </div>
</template>
