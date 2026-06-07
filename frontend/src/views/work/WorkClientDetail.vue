<script setup>
import { computed, ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useWorkClientsStore } from '@/stores/workClients'
import { useWorkItemsStore } from '@/stores/workItems'
import { useWorkInvoicesStore } from '@/stores/workInvoices'
import { useNotesStore } from '@/stores/notes'
import { useWorkMeetingsStore } from '@/stores/workMeetings'
import { useUIStore } from '@/stores/ui'
import WorkItemCard from '@/components/work/WorkItemCard.vue'
import EmptyState from '@/components/EmptyState.vue'

import {
  ArrowLeft, User, FolderKanban, FileText, Receipt,
  Calendar, Settings, Sparkles, Plus, Clock, MessageSquare,
  HardDrive, ExternalLink
} from 'lucide-vue-next'
import dayjs from 'dayjs'

const props = defineProps({
  id: { type: String, required: true }
})

const router = useRouter()
const clientsStore = useWorkClientsStore()
const itemsStore = useWorkItemsStore()
const invoicesStore = useWorkInvoicesStore()
const notesStore = useNotesStore()
const meetingsStore = useWorkMeetingsStore()
const ui = useUIStore()

const activeTab = ref('overview') // overview, work, notes, invoices
const showAddNoteModal = ref(false)
const newNoteTitle = ref('')

const client = computed(() => {
  return clientsStore.items.find(c => c.id === props.id)
})

// Client filtered data
const clientItems = computed(() => {
  return itemsStore.items.filter(item => item.clientId === props.id)
})

const openItems = computed(() => {
  return clientItems.value.filter(item => !itemsStore.isCompleted(item.status))
})

const completedItems = computed(() => {
  return clientItems.value.filter(item => itemsStore.isCompleted(item.status))
})

const clientNotes = computed(() => {
  return notesStore.items.filter(note => note.clientId === props.id || (note.tags && note.tags.includes(client.value?.name.toLowerCase())))
})

const clientInvoices = computed(() => {
  return invoicesStore.items.filter(inv => inv.clientId === props.id)
})

const clientMeetings = computed(() => {
  return meetingsStore.items.filter(m => m.clientId === props.id)
})

// Statistics
const totalTrackedHours = computed(() => {
  return clientItems.value.reduce((sum, item) => sum + (item.actualHours || 0), 0)
})

const totalPendingAmount = computed(() => {
  return clientInvoices.value
    .filter(i => i.status !== 'paid')
    .reduce((sum, inv) => sum + (inv.amount - inv.amountPaid), 0)
})

const totalChargedAmount = computed(() => {
  return clientItems.value.reduce((sum, item) => sum + (item.charged || 0), 0)
})

// Preferences Edit Form
const isEditingPrefs = ref(false)
const editForm = ref({
  timezone: '',
  preferredCommunication: '',
  technicalStack: '',
  pricingSensitivity: '',
  meetingPreference: '',
  relationshipNotes: '',
  clientSource: '',
  upchargePercentage: 0,
  techSavvy: false,
  tagsString: '',
  status: ''
})

const predefinedTagOptions = [
  'tech-savvy', 'slow-communication', 'slow-payer',
  'high-priority', 'scope-creeper', 'friendly',
  'demanding', 'agency', 'startup', 'clear-brief'
]

const timezoneOptions = [
  { value: 'Pacific/Honolulu', label: '(GMT-10.0) Hawaii Time (HST)' },
  { value: 'America/Anchorage', label: '(GMT-9.0) Alaska Time (AKST)' },
  { value: 'America/Los_Angeles', label: '(GMT-8.0) US Pacific Time (PST)' },
  { value: 'America/Denver', label: '(GMT-7.0) US Mountain Time (MST)' },
  { value: 'America/Phoenix', label: '(GMT-7.0) US Mountain Time (MST, No DST)' },
  { value: 'America/Chicago', label: '(GMT-6.0) US Central Time (CST)' },
  { value: 'America/New_York', label: '(GMT-5.0) US Eastern Time (EST)' },
  { value: 'America/Sao_Paulo', label: '(GMT-3.0) Brazil Time (BRT)' },
  { value: 'UTC', label: '(GMT+0.0) UTC/GMT' },
  { value: 'Europe/London', label: '(GMT+0.0) London Time (GMT/BST)' },
  { value: 'Europe/Paris', label: '(GMT+1.0) Central European Time (CET)' },
  { value: 'Europe/Athens', label: '(GMT+2.0) Eastern European Time (EET)' },
  { value: 'Europe/Moscow', label: '(GMT+3.0) Moscow Time (MSK)' },
  { value: 'Asia/Dubai', label: '(GMT+4.0) Gulf Standard Time (GST)' },
  { value: 'Asia/Kolkata', label: '(GMT+5.5) India Standard Time (IST)' },
  { value: 'Asia/Jakarta', label: '(GMT+7.0) Western Indonesia Time (WIB)' },
  { value: 'Asia/Singapore', label: '(GMT+8.0) Singapore Time (SGT)' },
  { value: 'Asia/Hong_Kong', label: '(GMT+8.0) Hong Kong Time (HKT)' },
  { value: 'Asia/Tokyo', label: '(GMT+9.0) Japan Standard Time (JST)' },
  { value: 'Asia/Seoul', label: '(GMT+9.0) Korea Standard Time (KST)' },
  { value: 'Australia/Sydney', label: '(GMT+10.0) Australia Eastern Time (AEST)' },
  { value: 'Pacific/Auckland', label: '(GMT+12.0) New Zealand Time (NZST)' }
]

function getClientLocalTime(tzName) {
  if (!tzName) return ''
  try {
    return new Intl.DateTimeFormat('en-US', {
      timeZone: tzName,
      hour: 'numeric',
      minute: 'numeric',
      hour12: true
    }).format(new Date())
  } catch (e) {
    return ''
  }
}

function togglePredefinedTagInEdit(tag) {
  let currentTags = editForm.value.tagsString
    ? editForm.value.tagsString.split(',').map(t => t.trim()).filter(Boolean)
    : []
  if (currentTags.includes(tag)) {
    currentTags = currentTags.filter(t => t !== tag)
  } else {
    currentTags.push(tag)
  }
  editForm.value.tagsString = currentTags.join(', ')
}

function startEditPrefs() {
  if (!client.value) return
  editForm.value = {
    timezone: client.value.timezone || '',
    preferredCommunication: client.value.preferredCommunication || 'Slack',
    technicalStack: client.value.technicalStack || '',
    pricingSensitivity: client.value.pricingSensitivity || 'Medium',
    meetingPreference: client.value.meetingPreference || '',
    relationshipNotes: client.value.relationshipNotes || '',
    clientSource: client.value.clientSource || '',
    upchargePercentage: client.value.upchargePercentage || 0,
    techSavvy: !!client.value.techSavvy,
    tagsString: client.value.tags ? client.value.tags.join(', ') : '',
    status: client.value.status || 'normal'
  }
  isEditingPrefs.value = true
}

async function savePrefs() {
  const parsedTags = editForm.value.tagsString
    ? editForm.value.tagsString.split(',').map(t => t.trim().toLowerCase()).filter(Boolean)
    : []

  await clientsStore.update(props.id, {
    timezone: editForm.value.timezone,
    preferredCommunication: editForm.value.preferredCommunication,
    technicalStack: editForm.value.technicalStack,
    pricingSensitivity: editForm.value.pricingSensitivity,
    meetingPreference: editForm.value.meetingPreference,
    relationshipNotes: editForm.value.relationshipNotes,
    clientSource: editForm.value.clientSource,
    upchargePercentage: Number(editForm.value.upchargePercentage) || 0,
    techSavvy: editForm.value.techSavvy,
    tags: parsedTags,
    status: editForm.value.status
  })
  isEditingPrefs.value = false
  ui.showToast('Workspace settings saved', 'success')
}

async function triggerCreateDriveFolder() {
  if (!client.value) return
  const rootDir = localStorage.getItem('atrium.work.drive_root') || 'AtriumWork'
  const simulatedId = `mock-drive-folder-${Date.now()}`
  await clientsStore.update(props.id, {
    driveFolderId: simulatedId
  })
  ui.showToast(`Folder created: "${rootDir}/${client.value.name}"`, 'success')
}

// Add note modal actions
function openAddNoteModal() {
  newNoteTitle.value = ''
  showAddNoteModal.value = true
}

async function submitNewNote() {
  if (!newNoteTitle.value.trim()) return
  const created = await notesStore.add({
    title: newNoteTitle.value.trim(),
    body: 'Start typing here...',
    tags: ['work', client.value.name.toLowerCase()],
    clientId: props.id
  })
  showAddNoteModal.value = false
  ui.showToast('Note created', 'success')
  router.push(`/work/notes?id=${created.id}`)
}

// Redirect to draft invoice creator
function createQuickInvoice() {
  router.push(`/work/invoices?new=true&clientId=${props.id}`)
}

function handleInvoiceClick(inv) {
  if (inv.isExternal && inv.externalUrl) {
    window.open(inv.externalUrl, '_blank')
  } else {
    router.push('/work/invoices')
  }
}

// Add Task
const newTaskTitle = ref('')
async function addNewTask() {
  if (!newTaskTitle.value.trim()) return
  await itemsStore.add({
    title: newTaskTitle.value.trim(),
    clientId: props.id,
    important: false,
    urgent: false,
    status: 'open'
  })
  newTaskTitle.value = ''
  ui.showToast('Work item added to scope', 'success')
}
</script>

<template>
  <div v-if="client" class="px-8 md:px-12 py-10 max-w-5xl mx-auto space-y-8 animate-fade-in"
    data-testid="work-client-detail">

    <!-- BACK & HEADER -->
    <div class="space-y-4">
      <button @click="router.push('/work/clients')" class="btn-ghost !p-1 -ml-2 text-ink-3 hover:text-ink">
        <ArrowLeft class="w-4 h-4" /> Clients directory
      </button>

      <div class="flex items-start justify-between gap-6 flex-wrap">
        <div>
          <span class="overline text-ink-3">Workspace Dashboard</span>
          <h1 class="font-serif text-3xl font-bold text-ink mt-1">{{ client.name }}</h1>
        </div>

        <div class="flex gap-2">
          <button @click="startEditPrefs" class="btn-secondary">
            <Settings class="w-4 h-4" /> Preferences
          </button>
          <button v-if="activeTab === 'work'"
            @click="newTaskTitle = ''; ui.showToast('Use quick composer below', 'info')" class="btn-primary">
            <Plus class="w-4 h-4" /> Add Task
          </button>
        </div>
      </div>
    </div>

    <!-- QUICK STATS -->
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <div class="card p-4 border bg-surface/50">
        <div class="overline text-ink-3 flex items-center gap-1.5">
          <Clock class="w-3.5 h-3.5" /> Total Hours Tracked
        </div>
        <div class="font-serif text-2xl font-bold mt-1 text-ink">{{ totalTrackedHours.toFixed(1) }}h</div>
      </div>
      <div class="card p-4 border bg-surface/50">
        <div class="overline text-ink-3 flex items-center gap-1.5">
          <Receipt class="w-3.5 h-3.5" /> Receivables Balance
        </div>
        <div class="font-serif text-2xl font-bold mt-1 text-pri-interruptive">₹{{ totalPendingAmount.toLocaleString() }}
        </div>
      </div>
      <div class="card p-4 border bg-surface/50">
        <div class="overline text-ink-3 flex items-center gap-1.5 font-semibold text-emerald-600 dark:text-emerald-400">
          <span class="text-xs font-bold font-mono">$</span> Total Task Charges
        </div>
        <div class="font-serif text-2xl font-bold mt-1 text-emerald-600 dark:text-emerald-400">${{ totalChargedAmount.toLocaleString() }}</div>
      </div>
      <div class="card p-4 border bg-surface/50">
        <div class="overline text-ink-3 flex items-center gap-1.5">
          <FolderKanban class="w-3.5 h-3.5" /> Active Scope Items
        </div>
        <div class="font-serif text-2xl font-bold mt-1 text-ink">{{ openItems.length }} active</div>
      </div>
    </div>

    <!-- TAB NAVIGATION -->
    <div class="border-b border-line flex gap-6 text-sm font-medium">
      <button v-for="tab in ['overview', 'work', 'notes', 'invoices']" :key="tab" @click="activeTab = tab"
        class="pb-3 capitalize transition-all border-b-2"
        :class="activeTab === tab ? 'border-ink text-ink font-semibold' : 'border-transparent text-ink-3 hover:text-ink-2'">
        {{ tab }}
      </button>
    </div>

    <!-- OVERVIEW TAB -->
    <div v-if="activeTab === 'overview'" class="grid grid-cols-1 lg:grid-cols-3 gap-8">

      <!-- Preferences / Settings View -->
      <!-- Preferences / Settings View -->
      <div class="lg:col-span-2 space-y-6">
        <div class="card p-6 border bg-surface space-y-6">
          <div class="flex items-center justify-between">
            <h3 class="font-serif text-xl font-bold text-ink">Client Memory Profile</h3>
            <button @click="startEditPrefs" class="btn-ghost !text-xs !py-1 px-2.5">Edit Profile</button>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
            <div class="space-y-1 col-span-2">
              <span class="text-xs uppercase tracking-overline text-ink-3">Client Status</span>
              <p class="font-medium text-ink">
                <span class="inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold border"
                  :class="clientsStore.getStatusStyle(client.status).color">
                  {{ clientsStore.getStatusStyle(client.status).label }}
                </span>
              </p>
            </div>

            <div class="space-y-1">
              <span class="text-xs uppercase tracking-overline text-ink-3">Timezone</span>
              <p class="font-medium text-ink">
                {{ client.timezone || 'Not specified' }}
                <span v-if="getClientLocalTime(client.timezone)" class="ml-1.5 text-[10px] bg-pri-strategic-bg text-pri-strategic px-1.5 py-0.5 rounded border border-pri-strategic-bd/50 font-normal">
                  Their Time: {{ getClientLocalTime(client.timezone) }}
                </span>
              </p>
            </div>
            <div class="space-y-1">
              <span class="text-xs uppercase tracking-overline text-ink-3">Communication Channel</span>
              <p class="font-medium text-ink">{{ client.preferredCommunication || 'Not specified' }}</p>
            </div>
            <div class="space-y-1">
              <span class="text-xs uppercase tracking-overline text-ink-3">Technical Stack</span>
              <p class="font-medium text-ink">
                {{ client.technicalStack || 'Not specified' }}
                <span v-if="client.techSavvy"
                  class="ml-1 text-[10px] bg-pri-strategic-bg text-pri-strategic px-1.5 py-0.5 rounded border border-pri-strategic-bd/50 font-normal">Tech-savvy</span>
              </p>
            </div>
            <div class="space-y-1">
              <span class="text-xs uppercase tracking-overline text-ink-3">Pricing Sensitivity & Upcharges</span>
              <p class="font-medium text-ink">
                {{ client.pricingSensitivity || 'Not specified' }}
                <span v-if="client.upchargePercentage > 0"
                  class="ml-1 text-[10px] bg-pri-critical-bg text-pri-critical px-1.5 py-0.5 rounded border border-pri-critical-bd/50 font-normal">+{{
                    client.upchargePercentage }}% Upcharge</span>
              </p>
            </div>
            <div class="space-y-1">
              <span class="text-xs uppercase tracking-overline text-ink-3">Meeting Schedule Preference</span>
              <p class="font-medium text-ink">{{ client.meetingPreference || 'Not specified' }}</p>
            </div>
            <div class="space-y-1">
              <span class="text-xs uppercase tracking-overline text-ink-3">Acquisition Source</span>
              <p class="font-medium text-ink">{{ client.clientSource || 'Not specified' }}</p>
            </div>
          </div>

          <div v-if="client.tags && client.tags.length" class="pt-4 border-t border-line space-y-2">
            <span class="text-xs uppercase tracking-overline text-ink-3 block">Tags</span>
            <div class="flex flex-wrap gap-1.5">
              <span v-for="tag in client.tags" :key="tag"
                class="text-xs text-ink-2 bg-canvas px-2.5 py-1 rounded-lg border border-line">
                #{{ tag }}
              </span>
            </div>
          </div>

          <div class="pt-4 border-t border-line space-y-2">
            <span class="text-xs uppercase tracking-overline text-ink-3 block">Relationship Details</span>
            <p class="text-sm text-ink-2 leading-relaxed whitespace-pre-line">{{ client.relationshipNotes || 'No notes added yet.' }}</p>
          </div>
        </div>

        <!-- Sync Calendar overview -->
        <div class="card p-6 border bg-surface">
          <h3 class="font-serif text-lg font-semibold text-ink mb-4">Associated Calendar Logs</h3>
          <ul v-if="clientMeetings.length" class="space-y-3">
            <li v-for="m in clientMeetings" :key="m.id"
              class="text-xs flex justify-between items-center bg-canvas p-2.5 rounded-xl border border-line">
              <div class="min-w-0">
                <div class="font-medium text-ink truncate">{{ m.title }}</div>
                <div class="text-[10px] text-ink-3 mt-0.5">{{ dayjs(m.startDateTime).format('MMM D, YYYY · h:mm A') }}
                </div>
              </div>
              <span class="text-[10px] bg-surface border px-2 py-0.5 rounded text-ink-2 shrink-0">Synced</span>
            </li>
          </ul>
          <p v-else class="text-xs text-ink-3 italic">No meetings synced with keywords matching this client.</p>
        </div>
      </div>

      <!-- Quick sidebar suggestions & Google Drive links -->
      <div class="space-y-6">
        <!-- Google Drive Widget -->
        <div class="card p-6 border bg-surface space-y-4">
          <h3 class="font-serif text-lg font-semibold text-ink flex items-center gap-2">
            <HardDrive class="w-5 h-5 text-ink-2" /> Google Drive Link
          </h3>
          <div v-if="client.driveFolderId" class="space-y-3">
            <p class="text-xs text-ink-2">Client has a workspace folder linked to this directory context.</p>
            <a :href="`https://drive.google.com/drive/folders/${client.driveFolderId}`" target="_blank"
              class="w-full btn-secondary text-center text-xs block py-2">
              Open Client Folder
            </a>
          </div>
          <div v-else class="space-y-3">
            <p class="text-xs text-ink-3 italic">No Google Drive folder is currently linked to this client workspace.
            </p>
            <button @click="triggerCreateDriveFolder"
              class="w-full btn-primary text-xs flex justify-center items-center gap-1.5">
              <Plus class="w-3.5 h-3.5" /> Initialize Client Folder
            </button>
          </div>
        </div>

        <div class="card p-6 bg-pri-strategic-bg/30 border border-pri-strategic-bd/50 space-y-3">
          <span class="overline text-pri-strategic font-bold flex items-center gap-1.5">
            <Sparkles class="w-3.5 h-3.5" /> Workspace Suggestion
          </span>
          <p class="text-xs text-ink-2 leading-relaxed">
            "Avoid scope creep by logging actual design revisions vs estimates." Check your active work checklist
            weekly.
          </p>
        </div>
      </div>
    </div>

    <!-- WORK ITEMS TAB -->
    <div v-else-if="activeTab === 'work'" class="space-y-6">
      <div class="flex items-center justify-between">
        <h3 class="font-serif text-lg font-semibold text-ink">Scoped Deliverables</h3>
        <span class="text-xs text-ink-3">{{ openItems.length }} active, {{ completedItems.length }} complete</span>
      </div>

      <!-- Quick Item Add -->
      <div class="card p-4 border border-line bg-canvas/30 flex gap-2">
        <input v-model="newTaskTitle" @keyup.enter="addNewTask" placeholder="Type a work item title..."
          class="input-block text-sm bg-surface" />
        <button @click="addNewTask" class="btn-primary shrink-0">Add Scoped Task</button>
      </div>

      <div class="space-y-6">
        <!-- Open Tasks -->
        <div class="space-y-3">
          <h4 class="overline text-ink-3">Active Items</h4>
          <div v-if="openItems.length" class="space-y-3">
            <WorkItemCard v-for="item in openItems" :key="item.id" :item="item" />
          </div>
          <p v-else class="text-xs text-ink-3 italic pl-1">No active scoped items.</p>
        </div>

        <!-- Done Tasks -->
        <div class="space-y-3 pt-4 border-t border-line/60">
          <h4 class="overline text-ink-3">Completed Items</h4>
          <div v-if="completedItems.length" class="space-y-3">
            <WorkItemCard v-for="item in completedItems" :key="item.id" :item="item" />
          </div>
          <p v-else class="text-xs text-ink-3 italic pl-1">No completed items in scope.</p>
        </div>
      </div>
    </div>

    <!-- NOTES TAB -->
    <div v-else-if="activeTab === 'notes'" class="space-y-6">
      <div class="flex items-center justify-between">
        <h3 class="font-serif text-lg font-semibold text-ink">Context Documents & Briefings</h3>
        <button @click="openAddNoteModal" class="btn-secondary !py-1 px-3 text-xs">
          <Plus class="w-3.5 h-3.5" /> Add Document
        </button>
      </div>

      <div v-if="clientNotes.length" class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div v-for="n in clientNotes" :key="n.id" @click="router.push(`/work/notes?id=${n.id}`)"
          class="card p-4 border bg-surface hover:border-line-2 cursor-pointer transition-all duration-300">
          <div class="flex items-center gap-2">
            <FileText class="w-4 h-4 text-ink-3" />
            <span class="overline text-ink-3">Note · updated {{ dayjs(n.updatedAt).format('MMM D') }}</span>
          </div>
          <h4 class="font-serif text-lg text-ink font-semibold mt-2">{{ n.title }}</h4>
          <p class="text-xs text-ink-2 mt-1 line-clamp-3 leading-relaxed">{{ n.body }}</p>
        </div>
      </div>
      <EmptyState v-else title="No notes linked"
        hint="Link notes by writing client name inside brackets or selecting this client context." />
    </div>

    <!-- INVOICES TAB -->
    <div v-else-if="activeTab === 'invoices'" class="space-y-6">
      <div class="flex items-center justify-between">
        <h3 class="font-serif text-lg font-semibold text-ink">Billing Ledger</h3>
        <button @click="createQuickInvoice" class="btn-secondary !py-1 px-3 text-xs">
          <Plus class="w-3.5 h-3.5" /> Draft Invoice
        </button>
      </div>

      <div v-if="clientInvoices.length" class="card overflow-hidden border">
        <table class="w-full text-left border-collapse text-xs">
          <thead>
            <tr class="bg-canvas border-b border-line text-ink-3 uppercase tracking-wider text-[10px] font-semibold">
              <th class="p-4">Invoice #</th>
              <th class="p-4">Status</th>
              <th class="p-4">Due Date</th>
              <th class="p-4 text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="inv in clientInvoices" :key="inv.id" @click="handleInvoiceClick(inv)"
              class="border-b border-line last:border-0 hover:bg-canvas/40 cursor-pointer transition-colors">
              <td class="p-4 font-semibold text-ink flex items-center gap-1.5">
                {{ inv.invoiceNumber }}
                <ExternalLink v-if="inv.isExternal" class="w-3 h-3 text-pri-strategic shrink-0" />
              </td>
              <td class="p-4">
                <span class="px-2 py-0.5 rounded text-[9px] uppercase font-bold border"
                  :class="inv.status === 'paid' ? 'bg-pri-strategic-bg border-pri-strategic-bd text-pri-strategic' : inv.status === 'overdue' ? 'bg-pri-critical-bg border-pri-critical-bd text-pri-critical' : 'bg-pri-interruptive-bg border-pri-interruptive-bd text-pri-interruptive'">
                  {{ inv.status }}
                </span>
              </td>
              <td class="p-4 text-ink-2">{{ dayjs(inv.dueDate).format('MMM D, YYYY') }}</td>
              <td class="p-4 text-right text-ink font-medium">₹{{ inv.amount.toLocaleString() }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <EmptyState v-else title="Zero billing records"
        hint="Generate a direct invoice or retainer log to track receivables." />
    </div>

    <!-- PREFERENCES EDIT DIALOG -->
    <div v-if="isEditingPrefs" @keydown.window.esc="isEditingPrefs = false" class="fixed inset-0 z-40 flex items-start justify-center pt-24 px-4">
      <div class="fixed inset-0 bg-ink/40 backdrop-blur-sm" @click="isEditingPrefs = false"></div>
      <div class="relative w-full max-w-lg card p-8 shadow-xl bg-surface z-50 animate-rise-in space-y-6">
        <div>
          <div class="overline">Edit Workspace Settings</div>
          <h2 class="font-serif text-2xl mt-1">Adjust preferences</h2>
        </div>

        <div class="space-y-4">
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-xs font-semibold text-ink-2 mb-1">Timezone</label>
              <select v-model="editForm.timezone" class="input-block text-sm">
                <option v-for="tz in timezoneOptions" :key="tz.value" :value="tz.value">
                  {{ tz.label }}
                </option>
              </select>
              <span v-if="getClientLocalTime(editForm.timezone)" class="text-[10px] text-pri-strategic mt-1 block font-medium">
                Their Local Time: {{ getClientLocalTime(editForm.timezone) }}
              </span>
            </div>
            <div>
              <label class="block text-xs font-semibold text-ink-2 mb-1">Preferred Communication</label>
              <select v-model="editForm.preferredCommunication" class="input-block text-sm">
                <option value="Slack">Slack</option>
                <option value="Email">Email</option>
                <option value="WhatsApp">WhatsApp</option>
                <option value="Teams">Microsoft Teams</option>
              </select>
            </div>
          </div>

          <div class="grid grid-cols-3 gap-4">
            <div>
              <label class="block text-xs font-semibold text-ink-2 mb-1">Technical Stack</label>
              <input v-model="editForm.technicalStack" class="input-block text-sm" />
            </div>
            <div>
              <label class="block text-xs font-semibold text-ink-2 mb-1">Pricing Sensitivity</label>
              <select v-model="editForm.pricingSensitivity" class="input-block text-sm">
                <option value="Low">Low (Value-driven)</option>
                <option value="Medium">Medium (Budget-aware)</option>
                <option value="High">High (Cost-focused)</option>
              </select>
            </div>
            <div>
              <label class="block text-xs font-semibold text-ink-2 mb-1">Client Status</label>
              <select v-model="editForm.status" class="input-block text-sm font-semibold">
                <option v-for="(val, key) in clientsStore.STATUS_MAP" :key="key" :value="key">
                  {{ val.label }}
                </option>
              </select>
            </div>
          </div>

          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-xs font-semibold text-ink-2 mb-1">Acquisition Source</label>
              <select v-model="editForm.clientSource" class="input-block text-sm">
                <option value="Upwork">Upwork</option>
                <option value="Referral">Referral</option>
                <option value="Cold Email">Cold Email</option>
                <option value="LinkedIn">LinkedIn</option>
                <option value="Twitter/X">Twitter/X</option>
                <option value="Other">Other</option>
              </select>
            </div>
            <div>
              <label class="block text-xs font-semibold text-ink-2 mb-1">Upcharge %</label>
              <input type="number" v-model="editForm.upchargePercentage" class="input-block text-sm" />
            </div>
          </div>

          <div>
            <label class="block text-xs font-semibold text-ink-2 mb-1">Client Tags (comma separated)</label>
            <input v-model="editForm.tagsString" class="input-block text-sm" placeholder="e.g. agency, direct" />
            <div class="flex flex-wrap gap-1.5 mt-2">
              <button v-for="tag in predefinedTagOptions" :key="tag" @click="togglePredefinedTagInEdit(tag)"
                type="button" class="text-[10px] px-2 py-0.5 rounded-full border transition-all" :class="editForm.tagsString.split(',').map(t => t.trim()).includes(tag)
                  ? 'bg-pri-strategic-bg text-pri-strategic border-pri-strategic-bd font-semibold'
                  : 'bg-canvas text-ink-3 border-line hover:text-ink hover:border-line-2'">
                {{ tag }}
              </button>
            </div>
          </div>

          <div>
            <label class="block text-xs font-semibold text-ink-2 mb-1">Meeting Schedule Preference</label>
            <input v-model="editForm.meetingPreference" class="input-block text-sm" />
          </div>

          <div>
            <label class="block text-xs font-semibold text-ink-2 mb-1">Relationship Context</label>
            <textarea v-model="editForm.relationshipNotes" rows="3" class="input-block text-sm resize-none"></textarea>
          </div>
        </div>

        <div class="flex justify-end gap-3 pt-2">
          <button @click="isEditingPrefs = false" class="btn-ghost">Cancel</button>
          <button @click="savePrefs" class="btn-primary">Save Changes</button>
        </div>
      </div>
    </div>

    <!-- ADD NOTE MODAL -->
    <div v-if="showAddNoteModal" @keydown.window.esc="showAddNoteModal = false" class="fixed inset-0 z-40 flex items-start justify-center pt-24 px-4">
      <div class="fixed inset-0 bg-ink/40 backdrop-blur-sm" @click="showAddNoteModal = false"></div>
      <div class="relative w-full max-w-md card p-8 shadow-xl bg-surface z-50 animate-rise-in space-y-6">
        <div>
          <div class="overline">New Document</div>
          <h2 class="font-serif text-2xl mt-1">Create document</h2>
        </div>

        <div class="space-y-4">
          <div>
            <label class="block text-xs font-semibold text-ink-2 mb-1">Document Title</label>
            <input v-model="newNoteTitle" placeholder="e.g. Project onboarding or Kickoff notes" class="input-block text-sm focus:ring-1 focus:ring-emerald-500" @keyup.enter="submitNewNote" />
          </div>
        </div>

        <div class="flex justify-end gap-3 pt-2">
          <button @click="showAddNoteModal = false" class="btn-ghost">Cancel</button>
          <button @click="submitNewNote" class="btn-primary">Create Document</button>
        </div>
      </div>
    </div>

  </div>
</template>
