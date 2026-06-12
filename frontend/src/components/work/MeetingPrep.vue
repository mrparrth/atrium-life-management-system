<script setup>
import { computed, ref, watch, onUnmounted } from 'vue'
import { useRouter, RouterLink } from 'vue-router'
import { useWorkMeetingsStore } from '@/stores/workMeetings'
import { useWorkClientsStore } from '@/stores/workClients'
import { useWorkItemsStore } from '@/stores/workItems'
import { useWorkResourcesStore } from '@/stores/workResources'
import { useWorkNotesStore } from '@/stores/workNotes'
import { useUIStore } from '@/stores/ui'
import { FileText, Video } from 'lucide-vue-next'
import dayjs from 'dayjs'

const activeDropdownMeetingId = ref(null)
const clientSearchQuery = ref('')
const now = ref(Date.now())

let clockInterval = null

function toggleDropdown(meetingId) {
  if (activeDropdownMeetingId.value === meetingId) {
    activeDropdownMeetingId.value = null
    clientSearchQuery.value = ''
  } else {
    activeDropdownMeetingId.value = meetingId
    clientSearchQuery.value = ''
  }
}

const filteredClients = computed(() => {
  const q = clientSearchQuery.value.toLowerCase().trim()
  const activeClients = clientsStore.items.filter(c => c.status !== 'inactive')
  if (!q) return activeClients
  return activeClients.filter(c => c.name.toLowerCase().includes(q))
})

const router = useRouter()
const meetingsStore = useWorkMeetingsStore()
const clientsStore = useWorkClientsStore()
const itemsStore = useWorkItemsStore()
const resourcesStore = useWorkResourcesStore()
const notesStore = useWorkNotesStore()
const ui = useUIStore()

// All upcoming and recently completed meetings in next 3 days, sorted by status (Live -> Upcoming -> Completed)
const combinedMeetings = computed(() => {
  const threeDaysFromNow = new Date()
  threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3)
  const threeDaysStr = threeDaysFromNow.toISOString()

  const nowMs = now.value
  const oneHourMs = 60 * 60 * 1000

  const eligible = [...meetingsStore.items].filter(m => {
    const endMs = new Date(m.endDateTime || m.startDateTime).getTime()
    const isNotExpired = endMs > nowMs - oneHourMs
    const isWithinThreeDays = m.startDateTime <= threeDaysStr
    return isNotExpired && isWithinThreeDays
  })

  return eligible.sort((a, b) => {
    const endA = new Date(a.endDateTime || a.startDateTime).getTime()
    const startA = new Date(a.startDateTime).getTime()
    const endB = new Date(b.endDateTime || b.startDateTime).getTime()
    const startB = new Date(b.startDateTime).getTime()

    const isLiveA = nowMs >= startA && nowMs < endA
    const isLiveB = nowMs >= startB && nowMs < endB
    const isCompletedA = nowMs >= endA
    const isCompletedB = nowMs >= endB

    // 1. Live/ongoing meetings first
    if (isLiveA && !isLiveB) return -1
    if (!isLiveA && isLiveB) return 1

    // 2. Completed meetings last
    if (isCompletedA && !isCompletedB) return 1
    if (!isCompletedA && isCompletedB) return -1

    // 3. Otherwise (both live, both completed, or both upcoming), sort chronologically
    return a.startDateTime.localeCompare(b.startDateTime)
  }).slice(0, 4)
})

watch(() => combinedMeetings.value.length > 0, (hasEvents) => {
  if (hasEvents) {
    if (!clockInterval) {
      clockInterval = setInterval(() => {
        now.value = Date.now()
      }, 10000)
    }
  } else {
    if (clockInterval) {
      clearInterval(clockInterval)
      clockInterval = null
    }
  }
}, { immediate: true })

onUnmounted(() => {
  if (clockInterval) clearInterval(clockInterval)
})

function getMeetingDisplayState(meeting) {
  const nowMs = now.value
  const startMs = new Date(meeting.startDateTime).getTime()
  const endMs = new Date(meeting.endDateTime).getTime()

  if (nowMs >= endMs) {
    return {
      type: 'COMPLETED',
      label: 'Completed',
      class: 'border-line !bg-pri-strategic-meeting-bg/5 border-l-2 border-l-line/40 opacity-50',
      pillClass: 'bg-canvas border-line text-ink-3',
      metadata: `Ended at ${dayjs(meeting.endDateTime).format('h:mm A')}`,
      cta: 'none'
    }
  }

  const diffMs = startMs - nowMs
  const diffMins = Math.round(diffMs / 60000)

  // LIVE NOW (Ongoing)
  if (diffMins < 0 && nowMs < endMs) {
    const elapsedMins = Math.round((nowMs - startMs) / 60000)
    return {
      type: 'LIVE',
      label: 'LIVE NOW',
      class: '!bg-pri-strategic-meeting-bg border-pri-strategic-bd border-l-4 border-l-pri-critical shadow-sm shadow-pri-strategic/10 font-bold',
      pillClass: 'bg-pri-critical-bg border-pri-critical-bd text-pri-critical font-bold',
      metadata: `Started ${elapsedMins}m ago`,
      cta: 'join'
    }
  }

  // STARTING SOON (<60m)
  if (diffMins < 60) {
    const clientLinks = getClientLinks(meeting.clientId)
    const notesCount = clientLinks?.notes?.length || 0
    const resourcesCount = clientLinks?.resources?.length || 0
    const prepCount = notesCount + resourcesCount
    return {
      type: 'SOON',
      label: `${diffMins}M to go`,
      class: 'border-pri-strategic-bd/70 border-l-4 border-l-pri-interruptive',
      pillClass: 'bg-pri-interruptive-bg border-pri-interruptive-bd text-pri-interruptive whitespace-nowrap',
      metadata: `Starts in ${diffMins}m`,
      cta: 'prep'
    }
  }

  // LATER TODAY (Starts today but >60m)
  const isToday = dayjs(meeting.startDateTime).isSame(dayjs(), 'day')
  if (isToday) {
    const diffHours = Math.round(diffMins / 60)
    return {
      type: 'TODAY',
      label: `${diffHours}H to go`,
      class: '!bg-pri-strategic-meeting-bg/30 border-pri-strategic-bd/40 border-l-4 border-l-ink-3',
      pillClass: 'bg-canvas border-line text-ink-2 whitespace-nowrap',
      metadata: `${dayjs(meeting.startDateTime).format('h:mm A')}`,
      cta: 'ghost'
    }
  }

  // TOMORROW / FUTURE
  const diffDays = Math.round(diffMins / (24 * 60))
  return {
    type: 'FUTURE',
    label: `${diffDays}D to go`,
    class: '!bg-pri-strategic-meeting-bg/15 border-pri-strategic-bd/20 border-l-2 border-l-line/40',
    pillClass: 'bg-canvas border-line text-ink-3 whitespace-nowrap',
    metadata: dayjs(meeting.startDateTime).format('ddd, MMM D [at] h:mm A'),
    cta: 'minimal'
  }
}

function getMeetingDynamicStyle(meeting) {
  const nowMs = now.value
  const startMs = new Date(meeting.startDateTime).getTime()
  const endMs = new Date(meeting.endDateTime).getTime()

  const diffMs = startMs - nowMs
  const diffMins = Math.round(diffMs / 60000)

  // Starting soon (<60m) and hasn't started yet
  if (diffMins >= 0 && diffMins < 60) {
    const x = (60 - diffMins) / 60 // 0 to 1
    const baseline = 0.15
    const opacity = baseline + (1.0 - baseline) * Math.pow(x, 3)
    return {
      backgroundColor: `rgb(var(--pri-strategic-meeting-bg) / ${opacity})`
    }
  }
  return {}
}

function getClientLinks(clientId) {
  if (!clientId) return null
  const clientNotes = notesStore.items.filter(n => n.clientId === clientId)
  const clientResources = resourcesStore.items.filter(r => r.clientId === clientId)
  return {
    notes: clientNotes,
    resources: clientResources
  }
}

async function linkMeetingToClient(meetingId, clientId) {
  if (!clientId) return
  await meetingsStore.update(meetingId, { clientId, associatedType: 'client', associatedId: clientId })
  ui.showToast('Meeting linked to client', 'success')
}

async function selectClient(meetingId, clientId) {
  await linkMeetingToClient(meetingId, clientId)
  activeDropdownMeetingId.value = null
  clientSearchQuery.value = ''
}

function getLinkedTask(meeting) {
  if (meeting.associatedType === 'work_item' && meeting.associatedId) {
    return itemsStore.items.find(t => t.id === meeting.associatedId)
  }
  return null
}

function getLinkedNote(meeting) {
  if (!meeting.clientId) return null
  const c = clientsStore.items.find(cl => cl.id === meeting.clientId)
  const clientName = c ? c.name : 'Client'
  const meetingDate = dayjs(meeting.startDateTime).format('YYYY-MM-DD')
  const title = `Sync - ${clientName} (${meetingDate})`
  return notesStore.items.find(n => n.title === title || (n.clientId === meeting.clientId && n.title.includes(meetingDate)))
}

async function startMeetingNote(meeting) {
  if (!meeting) return

  const meetingDate = dayjs(meeting.startDateTime).format('YYYY-MM-DD')
  let clientName = 'Client'
  const c = clientsStore.items.find(cl => cl.id === meeting.clientId)
  if (c) clientName = c.name

  const title = `Sync - ${clientName} (${meetingDate})`

  const existing = notesStore.items.find(n => n.title === title)
  if (existing) {
    router.push(`/work/notes?id=${existing.id}`)
    return
  }

  const body = `## Meeting Prep: ${meeting.title}
Date: ${dayjs(meeting.startDateTime).format('LLLL')}

### Agenda & Discussion Topics
- 

### Current Action Items Discussed
- [ ] 

### Unresolved Blockers / Revisions
- 

### Related References
- Timezone: ${c?.timezone || 'N/A'}
- Stack: ${c?.technicalStack || 'N/A'}
`

  const created = await notesStore.add({
    title,
    body,
    tags: ['work', clientName.toLowerCase().replace(/\s+/g, '-')],
    clientId: meeting.clientId
  })

  ui.showToast('Meeting note initialized', 'success')
  router.push(`/work/notes?id=${created.id}`)
}
</script>

<template>
  <section v-if="combinedMeetings.length" class="space-y-4">
    <div class="flex items-center justify-between">
      <div class="leading-snug">
        <div class="overline">Schedule</div>
      </div>
    </div>

    <div class="flex flex-col gap-2.5 animate-fade-in">
      <div v-for="meeting in combinedMeetings" :key="meeting.id"
        class="card !p-2.5 !px-4 border flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-all duration-300 hover:border-line-2"
        :class="getMeetingDisplayState(meeting).class" :style="getMeetingDynamicStyle(meeting)">

        <!-- LEFT: STATUS RAIL & DETAILS -->
        <div class="flex items-center gap-3 min-w-0 flex-1">
          <!-- Countdown Pill / Badge -->
          <span
            class="text-[9px] font-extrabold uppercase tracking-wider px-2.5 py-0.5 rounded-full border shrink-0 select-none flex items-center justify-center gap-1 w-[84px] text-center"
            :class="getMeetingDisplayState(meeting).pillClass">
            <span v-if="getMeetingDisplayState(meeting).type === 'LIVE'"
              class="w-1.5 h-1.5 rounded-full bg-pri-critical animate-pulse shrink-0"></span>
            {{ getMeetingDisplayState(meeting).label }}
          </span>

          <!-- Details inline -->
          <div class="min-w-0 flex flex-wrap items-center gap-x-2.5 gap-y-0.5">
            <h4 class="font-serif text-sm truncate text-ink" :title="meeting.title">
              {{ meeting.title }}
            </h4>

            <span class="text-ink-3 text-[11px] font-medium hidden sm:inline">•</span>

            <!-- Smarter Context Indicator / Metadata -->
            <span class="text-[11px] text-ink-2 shrink-0">
              {{ getMeetingDisplayState(meeting).metadata }}
            </span>

            <!-- Client Context Link -->
            <div v-if="meeting.clientId" class="flex items-center gap-1.5 text-[10px] text-ink-3">
              <span class="text-ink-3 font-medium">•</span>
              <RouterLink :to="`/work/clients/${meeting.clientId}`"
                class="hover:underline text-pri-strategic font-bold truncate">
                {{clientsStore.items.find(c => c.id === meeting.clientId)?.name || 'Client'}}
              </RouterLink>
              <span v-for="tag in (clientsStore.items.find(c => c.id === meeting.clientId)?.tags || []).slice(0, 2)"
                :key="tag" class="px-1 py-0.2 text-[8px] bg-canvas border border-line rounded text-ink-3 tracking-wide">
                #{{ tag }}
              </span>
            </div>

            <!-- Task Context Link -->
            <div v-if="getLinkedTask(meeting)" class="flex items-center gap-2 text-[10px] text-ink-3">
              <span class="text-ink-3 font-medium">•</span>
              <span class="text-ink truncate" :title="getLinkedTask(meeting).title">
                📌 {{ getLinkedTask(meeting).title }}
              </span>
            </div>
            <div class="flex items-center gap-1.5 text-[10px] relative" v-else>
              <span class="text-ink-3 font-medium">•</span>

              <!-- Smart Combobox Container -->
              <div class="relative" v-if="!meeting.clientId">
                <button @click.stop="toggleDropdown(meeting.id)" type="button"
                  class="text-[9px] bg-canvas/60 border border-line rounded px-2 py-0.5 focus:outline-none hover:border-line-2 transition-colors cursor-pointer text-ink-2 font-medium flex items-center gap-1">
                  <span>Link Client</span>
                  <span class="text-[7px] text-ink-3">▼</span>
                </button>

                <!-- Click-outside catcher -->
                <div v-if="activeDropdownMeetingId === meeting.id" class="fixed inset-0 z-10"
                  @click.stop="activeDropdownMeetingId = null"></div>

                <!-- Dropdown panel -->
                <div v-if="activeDropdownMeetingId === meeting.id"
                  class="absolute left-0 mt-1 w-44 bg-surface border border-line rounded-lg shadow-lg z-20 p-1.5 space-y-1">
                  <input v-model="clientSearchQuery" placeholder="Search client..."
                    class="w-full text-[10px] bg-canvas border border-line rounded px-1.5 py-0.5 focus:outline-none focus:border-line-2"
                    @click.stop />
                  <div class="max-h-28 overflow-y-auto space-y-0.5">
                    <button v-for="c in filteredClients" :key="c.id" @click.stop="selectClient(meeting.id, c.id)"
                      type="button"
                      class="w-full text-left text-[10px] px-2 py-1 rounded hover:bg-canvas text-ink transition-colors block truncate">
                      {{ c.name }}
                    </button>
                    <div v-if="filteredClients.length === 0" class="text-[9px] text-ink-3 px-2 py-1">
                      No matches found
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- RIGHT: ACTION CTAS -->
        <div class="flex items-center gap-2 shrink-0 self-end sm:self-center">
          <!-- PAST/COMPLETED MEETINGS: Only show View Note if linked -->
          <template v-if="getMeetingDisplayState(meeting).type === 'COMPLETED'">
            <button v-if="getLinkedNote(meeting)" @click="startMeetingNote(meeting)"
              class="btn-ghost !text-[10px] !py-1 !px-2.5 flex items-center gap-1 hover:bg-canvas">
              <FileText class="w-3.5 h-3.5" /> View Note
            </button>
          </template>

          <!-- LIVE AND FUTURE MEETINGS: Show Join Call (if link exists) and Prep Brief -->
          <template v-else>
            <!-- Join Call link -->
            <template v-if="meeting.meetLink">
              <a v-if="getMeetingDisplayState(meeting).type !== 'COMPLETED' && meeting.meetLink"
                :href="meeting.meetLink" target="_blank"
                class="btn-primary !text-[10px] !py-1 !px-2.5 flex items-center gap-1 shadow-sm !bg-pri-strategic hover:!bg-pri-strategic/90 !border-pri-strategic-bd text-white select-none">
                <Video class="w-3.5 h-3.5" /> Join Call
              </a>
            </template>

            <!-- Prep Brief button -->
            <button v-if="getMeetingDisplayState(meeting).type !== 'COMPLETED'" @click="startMeetingNote(meeting)"
              class="btn-secondary !text-[10px] !py-1 !px-2.5 flex items-center gap-1 border border-pri-interruptive-bd hover:bg-pri-interruptive-bg/10 text-pri-interruptive">
              <FileText class="w-3.5 h-3.5" /> Prep Brief
            </button>
            <button v-else @click="startMeetingNote(meeting)"
              class="btn-ghost !text-[10px] !py-1 !px-2.5 flex items-center gap-1 hover:bg-canvas text-ink-2 hover:text-ink">
              <FileText class="w-3.5 h-3.5" /> Prep Brief
            </button>
          </template>
        </div>
      </div>
    </div>
  </section>
</template>
