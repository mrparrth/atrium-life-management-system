<script setup>
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useWorkMeetingsStore } from '@/stores/workMeetings'
import { useWorkClientsStore } from '@/stores/workClients'
import { useWorkItemsStore } from '@/stores/workItems'
import { useWorkInvoicesStore } from '@/stores/workInvoices'
import { useNotesStore } from '@/stores/notes'
import { useUIStore } from '@/stores/ui'
import { Calendar, AlertCircle, FileText, ArrowRight, User } from 'lucide-vue-next'
import dayjs from 'dayjs'

const router = useRouter()
const meetingsStore = useWorkMeetingsStore()
const clientsStore = useWorkClientsStore()
const itemsStore = useWorkItemsStore()
const invoicesStore = useWorkInvoicesStore()
const notesStore = useNotesStore()
const ui = useUIStore()

const activeMeeting = computed(() => meetingsStore.activeMeetingPrep)

const clientInfo = computed(() => {
  if (!activeMeeting.value || !activeMeeting.value.clientId) return null
  return clientsStore.items.find(c => c.id === activeMeeting.value.clientId)
})

const activeTasks = computed(() => {
  if (!activeMeeting.value || !activeMeeting.value.clientId) return []
  return itemsStore.items.filter(t => t.clientId === activeMeeting.value.clientId && !itemsStore.isCompleted(t.status)).slice(0, 3)
})

const pendingInvoices = computed(() => {
  if (!activeMeeting.value || !activeMeeting.value.clientId) return []
  return invoicesStore.items.filter(i => i.clientId === activeMeeting.value.clientId && i.status !== 'paid').slice(0, 2)
})

const timeRemaining = computed(() => {
  if (!activeMeeting.value) return ''
  const diff = dayjs(activeMeeting.value.startDateTime).diff(dayjs(), 'minute')
  if (diff <= 0) return 'Ongoing'
  return `in ${diff} minutes`
})

async function startMeetingNote() {
  if (!activeMeeting.value) return
  
  const today = dayjs().format('YYYY-MM-DD')
  const clientName = clientInfo.value ? clientInfo.value.name : 'Client'
  const title = `Sync — ${clientName} (${today})`
  
  // Check if exists
  const existing = notesStore.items.find(n => n.title === title)
  if (existing) {
    router.push(`/work/notes?id=${existing.id}`)
    return
  }
  
  const body = `## Meeting Prep: ${activeMeeting.value.title}
Date: ${dayjs(activeMeeting.value.startDateTime).format('LLLL')}

### Agenda & Discussion Topics
- 

### Current Action Items Discussed
- [ ] 

### Unresolved Blockers / Revisions
- 

### Related References
- Timezone: ${clientInfo.value?.timezone || 'N/A'}
- Stack: ${clientInfo.value?.technicalStack || 'N/A'}
`
  
  // Since personal and work notes are separate (wait! is notes table shared? The user said "keep work and personal completely separate". So personal tasks and work items are separate. Notes in PARA notes table: the db index.js has notes table which stores work notes or personal notes. Let's make sure we tag notes with "work" tag or keep notes in notes table, or separate table?
  // Wait! In the schema v6 we didn't declare a separate work_notes table. We can keep notes in the v1 `notes` table but associate them with a client, and filter them for Work Mode by checking if clientId exists, or filter by work tag!
  // Let's check db index.js notes: `id, projectId, taskId, goalId, bookmarkId, financeId, createdAt, updatedAt, lastViewedAt`. We can add client relation or tag: work. Wait, Dexie allows storing any fields. So we can add `clientId` to notes. That is elegant!)
  const created = await notesStore.add({ 
    title, 
    body, 
    tags: ['work', clientName.toLowerCase().replace(/\s+/g, '-')],
    clientId: activeMeeting.value.clientId 
  })
  
  ui.showToast('Meeting note initialized', 'success')
  router.push(`/work/notes?id=${created.id}`)
}
</script>

<template>
  <div v-if="activeMeeting" 
    class="mb-8 p-6 rounded-2xl border border-pri-strategic-bd bg-pri-strategic-bg/50 backdrop-blur-md relative overflow-hidden animate-rise-in">
    <div class="absolute -right-16 -top-16 w-40 h-40 bg-pri-strategic/5 rounded-full blur-2xl"></div>
    
    <div class="flex items-start gap-4">
      <div class="p-2.5 rounded-xl bg-pri-strategic-bd text-pri-strategic shrink-0 mt-0.5 shadow-sm">
        <Calendar class="w-5 h-5" />
      </div>
      
      <div class="flex-1 min-w-0">
        <div class="flex items-center gap-2 mb-1 flex-wrap">
          <span class="overline text-pri-strategic font-semibold">Upcoming Briefing</span>
          <span class="w-1.5 h-1.5 rounded-full bg-pri-strategic"></span>
          <span class="text-xs text-pri-strategic font-medium">{{ timeRemaining }}</span>
        </div>
        
        <h3 class="font-serif text-xl text-ink font-semibold truncate">{{ activeMeeting.title }}</h3>
        
        <div class="mt-4 grid grid-cols-1 md:grid-cols-3 gap-6 text-sm">
          <!-- Client Context -->
          <div v-if="clientInfo" class="space-y-1.5 bg-surface/40 p-3.5 rounded-xl border border-line/40">
            <div class="overline text-ink-3 flex items-center gap-1.5">
              <User class="w-3.5 h-3.5" /> Client Profile
            </div>
            <div class="font-medium text-ink">{{ clientInfo.name }}</div>
            <div class="text-xs text-ink-2">Comm: {{ clientInfo.preferredCommunication }} · {{ clientInfo.timezone }}</div>
            <div class="text-[11px] text-ink-3 truncate mt-1">Tech: {{ clientInfo.technicalStack || 'None specified' }}</div>
          </div>
          
          <!-- Outstanding items -->
          <div class="space-y-1.5 bg-surface/40 p-3.5 rounded-xl border border-line/40">
            <div class="overline text-ink-3">Active Items</div>
            <ul v-if="activeTasks.length" class="space-y-1">
              <li v-for="t in activeTasks" :key="t.id" class="text-xs text-ink truncate flex items-center gap-1.5">
                <span class="w-1 h-1 rounded-full shrink-0" :class="t.important ? 'bg-pri-critical' : 'bg-ink-3'"></span>
                {{ t.title }}
              </li>
            </ul>
            <div v-else class="text-xs text-ink-3 italic">No active work items.</div>
          </div>
          
          <!-- Financial context -->
          <div class="space-y-1.5 bg-surface/40 p-3.5 rounded-xl border border-line/40">
            <div class="overline text-ink-3">Unpaid Accounts</div>
            <ul v-if="pendingInvoices.length" class="space-y-1">
              <li v-for="i in pendingInvoices" :key="i.id" class="text-xs text-ink flex items-center justify-between gap-1.5">
                <span class="truncate">{{ i.invoiceNumber }}</span>
                <span class="font-medium shrink-0" :class="i.status === 'overdue' ? 'text-pri-critical font-semibold' : 'text-pri-interruptive'">
                  {{ i.status === 'overdue' ? 'Overdue' : 'Pending' }}
                </span>
              </li>
            </ul>
            <div v-else class="text-xs text-ink-3 italic">All clear. No pending invoices.</div>
          </div>
        </div>
        
        <div class="mt-4 flex items-center gap-3">
          <button @click="startMeetingNote" class="btn-primary !py-1.5 !px-3.5 text-xs">
            <FileText class="w-3.5 h-3.5" /> Prep meeting note
          </button>
          <button v-if="clientInfo" @click="router.push(`/work/clients/${clientInfo.id}`)" class="btn-ghost !py-1.5 !px-3.5 text-xs flex items-center gap-1">
            Open workspace <ArrowRight class="w-3 h-3" />
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
