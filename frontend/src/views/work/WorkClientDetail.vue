<script setup>
import { computed, ref, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { useWorkClientsStore } from '@/stores/workClients'
import { useWorkItemsStore } from '@/stores/workItems'
import { useWorkInvoicesStore } from '@/stores/workInvoices'
import { useWorkNotesStore } from '@/stores/workNotes'
import { useWorkMeetingsStore } from '@/stores/workMeetings'
import { useWorkResourcesStore } from '@/stores/workResources'
import { useUIStore } from '@/stores/ui'
import WorkItemCard from '@/components/work/WorkItemCard.vue'
import EmptyState from '@/components/EmptyState.vue'
import { createClientDriveFolder, createClientDriveFolderInParent, extractFolderIdFromUrl } from '@/services/drive'
import ClientPopup from '@/components/work/ClientPopup.vue'
import VTooltip from '@/components/VTooltip.vue'
import VUrlInput from '@/components/VUrlInput.vue'
import VSelect from '@/components/VSelect.vue'

import {
  ArrowLeft, User, FolderKanban, FileText, Receipt,
  Calendar, Settings, Sparkles, Plus, Clock, MessageSquare,
  HardDrive, ExternalLink, Trash2, Star, Link as LinkIcon, Key,
  Eye, EyeOff, Copy, X, Pencil
} from 'lucide-vue-next'
import dayjs from 'dayjs'

const props = defineProps({
  id: { type: String, required: true }
})

const router = useRouter()
const clientsStore = useWorkClientsStore()
const itemsStore = useWorkItemsStore()
const invoicesStore = useWorkInvoicesStore()
const notesStore = useWorkNotesStore()
const meetingsStore = useWorkMeetingsStore()
const resourcesStore = useWorkResourcesStore()
const ui = useUIStore()

const activeTab = ref('overview') // overview, work, notes, invoices, reference, credentials
const TABS = ['overview', 'work', 'notes', 'invoices', 'reference', 'credentials']
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

const clientReferences = computed(() => {
  return resourcesStore.items.filter(r => r.clientId === props.id && r.type === 'url')
})

const clientCredentials = computed(() => {
  return resourcesStore.items.filter(r => r.clientId === props.id && r.type === 'credentials')
})

// Statistics
const totalTrackedHours = computed(() => {
  return clientItems.value.reduce((sum, item) => sum + (item.actualHours || 0), 0)
})

const totalPendingAmount = computed(() => {
  return clientInvoices.value
    .filter(i => i.status !== 'paid')
    .reduce((sum, inv) => sum + (inv.amount - (inv.amountPaid || 0)), 0)
})

const totalChargedAmount = computed(() => {
  return clientItems.value.reduce((sum, item) => sum + (item.charged || 0), 0)
})

const getClientRating = computed(() => {
  const ratedItems = clientItems.value.filter(item => item.rating && item.rating > 0)
  if (ratedItems.length === 0) return 0
  const totalRating = ratedItems.reduce((sum, item) => sum + item.rating, 0)
  return Number((totalRating / ratedItems.length).toFixed(1))
})

// Preferences Edit Form
const isEditingPrefs = ref(false)

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

function startEditPrefs() {
  isEditingPrefs.value = true
}

function handleClientSaved(updated) {
  if (updated && updated.deleted) {
    router.push('/work/clients')
  }
}

async function triggerCreateDriveFolder() {
  if (!client.value) return
  ui.showToast('Connecting to Google Drive...', 'info')
  try {
    const parentFolderUrl = localStorage.getItem('atrium.work.drive_folder_url') || ''
    const parentFolderId = extractFolderIdFromUrl(parentFolderUrl)
    let folderId = ''

    if (parentFolderId) {
      folderId = await createClientDriveFolderInParent(client.value.name, parentFolderId)
    } else {
      const rootDir = localStorage.getItem('atrium.work.drive_root') || 'AtriumWork'
      folderId = await createClientDriveFolder(client.value.name, rootDir)
    }

    await clientsStore.update(props.id, {
      driveFolderId: folderId
    })
    ui.showToast(`Folder created successfully in Google Drive`, 'success')
  } catch (e) {
    ui.showToast(`Failed to create Drive folder: ${e.message}`, 'error')
  }
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
    router.push(`/work/invoices?id=${inv.id}`)
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
    status: 'open',
    dueDate: dayjs().format('YYYY-MM-DD')
  })
  newTaskTitle.value = ''
  ui.showToast('Work item added to scope', 'success')
}

function handleClientKeydown(e) {
  if (isEditingPrefs.value || showAddNoteModal.value || showAddResourceModal.value) return

  // Alt+1-6 → switch tabs (use e.code for macOS compatibility — e.key gives ¡™£ etc.)
  if (e.altKey && !e.metaKey && !e.ctrlKey && e.code?.startsWith('Digit')) {
    const idx = parseInt(e.code.replace('Digit', '')) - 1
    if (idx >= 0 && idx < TABS.length) {
      e.preventDefault()
      activeTab.value = TABS[idx]
      return
    }
  }

  // Alt+ArrowUp/Down → switch tabs
  if (e.altKey && !e.metaKey && !e.ctrlKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
    const currentIdx = TABS.indexOf(activeTab.value)
    if (currentIdx !== -1) {
      e.preventDefault()
      const step = e.key === 'ArrowUp' ? -1 : 1
      const nextIdx = (currentIdx + step + TABS.length) % TABS.length
      activeTab.value = TABS[nextIdx]
      return
    }
  }

  if ((e.metaKey || e.ctrlKey) && e.key === '1') {
    e.preventDefault()
    startEditPrefs()
  }
  if ((e.metaKey || e.ctrlKey) && e.key === '2') {
    if (client.value?.driveFolderId) {
      e.preventDefault()
      window.open(`https://drive.google.com/drive/folders/${client.value.driveFolderId}`, '_blank')
    }
  }
}

const revealedPasswords = ref({})

const showAddResourceModal = ref(false)
const resourceType = ref('url')
const resourceTitle = ref('')
const resourceUrl = ref('')
const resourceUsername = ref('')
const resourcePassword = ref('')
const resourceNotes = ref('')
const resourceSubType = ref('file')
const editingResourceId = ref(null)

const linkTypeOptions = [
  { value: 'website', label: 'website' },
  { value: 'file', label: 'file' },
  { value: 'folder', label: 'folder' },
  { value: 'doc', label: 'document' }
]

function openAddResourceModal(typeVal) {
  editingResourceId.value = null
  resourceType.value = typeVal
  resourceTitle.value = ''
  resourceUrl.value = ''
  resourceUsername.value = ''
  resourcePassword.value = ''
  resourceNotes.value = ''
  resourceSubType.value = 'file'
  showAddResourceModal.value = true
}

function openEditResourceModal(res) {
  editingResourceId.value = res.id
  resourceType.value = res.type
  resourceTitle.value = res.title
  resourceUrl.value = res.url || ''
  resourceUsername.value = res.username || ''
  resourcePassword.value = res.password || ''
  resourceNotes.value = res.notes || ''
  resourceSubType.value = res.subType || 'website'
  showAddResourceModal.value = true
}

async function submitNewResource() {
  if (!resourceTitle.value.trim()) return

  if (editingResourceId.value) {
    await resourcesStore.update(editingResourceId.value, {
      title: resourceTitle.value.trim(),
      url: resourceUrl.value.trim(),
      username: resourceUsername.value.trim(),
      password: resourcePassword.value.trim(),
      notes: resourceNotes.value.trim(),
      subType: resourceSubType.value
    })
    ui.showToast('Resource updated', 'success')
  } else {
    await resourcesStore.add({
      clientId: props.id,
      type: resourceType.value,
      title: resourceTitle.value.trim(),
      url: resourceUrl.value.trim(),
      username: resourceUsername.value.trim(),
      password: resourcePassword.value.trim(),
      notes: resourceNotes.value.trim(),
      subType: resourceSubType.value
    })
    ui.showToast(`${resourceType.value === 'url' ? 'Reference' : 'Credential'} resource added`, 'success')
  }

  showAddResourceModal.value = false
}

async function deleteResource(id) {
  ui.confirm('Are you sure you want to delete this resource?').then(approved => {
    if (approved) {
      resourcesStore.remove(id)
      ui.showToast('Resource deleted', 'success')
    }
  })
}

function getDomainName(url) {
  if (!url) return ''
  try {
    const parsed = new URL(url)
    return parsed.hostname.replace('www.', '')
  } catch (e) {
    return url
  }
}

function getSubtypeConfig(subType) {
  switch (subType) {
    case 'sheet':
      return { label: 'Google Sheet', colorClass: 'bg-green-500/10 border-green-500/20 text-green-600 dark:text-green-400' }
    case 'doc':
      return { label: 'Google Doc', colorClass: 'bg-blue-500/10 border-blue-500/20 text-blue-600 dark:text-blue-400' }
    case 'folder':
      return { label: 'Drive Folder', colorClass: 'bg-amber-500/10 border-amber-500/20 text-amber-600 dark:text-amber-400' }
    case 'design':
      return { label: 'Figma / Design', colorClass: 'bg-purple-500/10 border-purple-500/20 text-purple-600 dark:text-purple-400' }
    case 'github':
      return { label: 'GitHub / Repo', colorClass: 'bg-slate-500/10 border-slate-500/20 text-slate-600 dark:text-slate-400' }
    case 'link':
    default:
      return { label: 'General Link', colorClass: 'bg-teal-500/10 border-teal-500/20 text-teal-600 dark:text-teal-400' }
  }
}

function getSubtypeIcon(subType) {
  switch (subType) {
    case 'sheet':
    case 'doc':
      return FileText
    case 'folder':
      return FolderKanban
    case 'design':
      return Sparkles
    default:
      return LinkIcon
  }
}


function togglePassword(id) {
  revealedPasswords.value[id] = !revealedPasswords.value[id]
}

function copyToClipboard(text, msg = 'Copied') {
  navigator.clipboard.writeText(text)
  ui.showToast(msg, 'success')
}

function deleteClient() {
  ui.confirm(`Are you sure you want to delete client "${client.value?.name}"? All associated data will remain but the workspace profile will be removed.`).then(async approved => {
    if (approved) {
      await clientsStore.remove(props.id)
      ui.showToast('Client deleted', 'success')
      router.push('/work/clients')
    }
  })
}

const nowMs = ref(Date.now())
let clockInterval = null

const clientLocalTimeText = computed(() => {
  const _ = nowMs.value
  if (!client.value || !client.value.timezone) return ''
  return getClientLocalTime(client.value.timezone)
})

onMounted(() => {
  window.addEventListener('keydown', handleClientKeydown)
  clockInterval = setInterval(() => {
    nowMs.value = Date.now()
  }, 10000)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleClientKeydown)
  if (clockInterval) clearInterval(clockInterval)
})

const addNoteFirstInput = ref(null)
const addResourceFirstInput = ref(null)

watch(showAddNoteModal, (open) => {
  if (open) {
    nextTick(() => {
      addNoteFirstInput.value?.focus()
    })
  }
})

watch(showAddResourceModal, (open) => {
  if (open) {
    nextTick(() => {
      addResourceFirstInput.value?.focus()
    })
  }
})
</script>

<template>
  <div v-if="client" class="px-8 md:px-12 py-10 max-w-5xl mx-auto space-y-8 animate-fade-in"
    data-testid="work-client-detail">

    <!-- BACK & HEADER -->
    <div class="space-y-4">
      <button @click="router.push('/work/clients')" class="btn-ghost !p-1 -ml-2 text-ink-3 hover:text-ink">
        <ArrowLeft class="w-4 h-4" /> Clients directory
      </button>

      <div class="flex items-center justify-between gap-6 flex-wrap">
        <div>
          <h1 class="font-serif text-3xl font-bold text-ink flex items-center gap-2">
            {{ client.name }}
            <span v-if="getClientRating"
              class="text-xs font-bold px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-600 border border-amber-500/20 flex items-center gap-0.5 shrink-0"
              title="Operational Score (Calculated from completed tasks ratio)">
              <Star class="w-3.5 h-3.5 fill-current" /> {{ getClientRating }}
            </span>
            <span v-if="clientLocalTimeText"
              class="text-xs font-semibold px-1.5 py-0.5 rounded bg-canvas border border-line text-ink-2 flex items-center gap-1 shrink-0"
              title="Client's local time">
              <Clock class="w-3.5 h-3.5 text-ink-3" /> {{ clientLocalTimeText }} Local
            </span>
          </h1>
        </div>

        <div class="flex items-center gap-2 flex-wrap">
          <!-- Delete Client (moved to left) -->
          <VTooltip text="Delete Client" position="bottom">
            <button @click="deleteClient"
              class="w-9 h-9 flex items-center justify-center rounded-xl border border-line bg-surface/50 text-pri-critical hover:bg-pri-critical-bg transition-all shrink-0">
              <Trash2 class="w-4 h-4" />
            </button>
          </VTooltip>

          <!-- Vertical Separator -->
          <div class="h-6 w-[1px] bg-line shrink-0 mx-1"></div>

          <!-- Google Drive Folder Header Utility Button (in the middle) -->
          <VTooltip v-if="client.driveFolderId" text="Open Google Drive folder (⌘2)" position="bottom">
            <a :href="`https://drive.google.com/drive/folders/${client.driveFolderId}`"
              target="_blank"
              class="w-9 h-9 flex items-center justify-center rounded-xl border border-line bg-surface/50 text-ink-2 hover:text-ink hover:bg-surface transition-all shrink-0">
              <svg viewBox="0 0 24 24" class="w-4 h-4 shrink-0" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                <title>Google Drive</title>
                <path d="M12.01 1.485c-2.082 0-3.754.02-3.743.047.01.02 1.708 3.001 3.774 6.62l3.76 6.574h3.76c2.081 0 3.753-.02 3.742-.047-.005-.02-1.708-3.001-3.775-6.62l-3.76-6.574zm-4.76 1.73a789.828 789.861 0 0 0-3.63 6.319L0 15.868l1.89 3.298 1.885 3.297 3.62-6.335 3.618-6.33-1.88-3.287C8.1 4.704 7.255 3.22 7.25 3.214zm2.259 12.653-.203.348c-.114.198-.96 1.672-1.88 3.287a423.93 423.948 0 0 1-1.698 2.97c-.01.026 3.24.042 7.222.042h7.244l1.796-3.157c.992-1.734 1.85-3.23 1.906-3.323l.104-.167h-7.249z"/>
              </svg>
            </a>
          </VTooltip>
          <VTooltip v-else text="Initialize Google Drive folder" position="bottom">
            <button @click="triggerCreateDriveFolder"
              class="w-9 h-9 flex items-center justify-center rounded-xl border border-dashed border-line bg-surface/30 text-ink-3 hover:text-ink hover:bg-surface transition-all shrink-0">
              <svg viewBox="0 0 24 24" class="w-4 h-4 shrink-0" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                <title>Google Drive</title>
                <path d="M12.01 1.485c-2.082 0-3.754.02-3.743.047.01.02 1.708 3.001 3.774 6.62l3.76 6.574h3.76c2.081 0 3.753-.02 3.742-.047-.005-.02-1.708-3.001-3.775-6.62l-3.76-6.574zm-4.76 1.73a789.828 789.861 0 0 0-3.63 6.319L0 15.868l1.89 3.298 1.885 3.297 3.62-6.335 3.618-6.33-1.88-3.287C8.1 4.704 7.255 3.22 7.25 3.214zm2.259 12.653-.203.348c-.114.198-.96 1.672-1.88 3.287a423.93 423.948 0 0 1-1.698 2.97c-.01.026 3.24.042 7.222.042h7.244l1.796-3.157c.992-1.734 1.85-3.23 1.906-3.323l.104-.167h-7.249z"/>
              </svg>
            </button>
          </VTooltip>

          <!-- Edit Profile (Pencil Icon) -->
          <VTooltip text="Edit Profile (⌘1)" position="bottom">
            <button @click="startEditPrefs"
              class="w-9 h-9 flex items-center justify-center rounded-xl border border-line bg-surface/50 text-ink-2 hover:text-ink hover:bg-surface transition-all shrink-0">
              <Pencil class="w-4 h-4" />
            </button>
          </VTooltip>
          
          <VTooltip v-if="activeTab === 'work'" text="Add Task" position="bottom">
            <button @click="newTaskTitle = ''; ui.showToast('Use quick composer below', 'info')"
              class="w-9 h-9 flex items-center justify-center rounded-xl border border-line bg-surface/50 text-pri-strategic hover:bg-surface hover:text-pri-strategic transition-all shrink-0">
              <Plus class="w-4 h-4" />
            </button>
          </VTooltip>
        </div>
      </div>
    </div>

    <!-- QUICK STATS -->
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <div class="card py-1.5 px-3 border bg-surface/50 flex items-center justify-between gap-2.5">
        <div class="flex items-center gap-1.5 text-ink-3 min-w-0">
          <Clock class="w-3.5 h-3.5 text-ink-3 shrink-0" />
          <span class="overline text-[9px] tracking-wider truncate">Hours</span>
        </div>
        <span class="font-serif text-lg font-bold shrink-0"
          :class="totalTrackedHours > 0 ? 'text-ink' : 'text-ink-3'">{{ totalTrackedHours.toFixed(1) }}h</span>
      </div>
      <div class="card py-1.5 px-3 border bg-surface/50 flex items-center justify-between gap-2.5">
        <div class="flex items-center gap-1.5 text-ink-3 min-w-0">
          <Receipt class="w-3.5 h-3.5 text-ink-3 shrink-0" />
          <span class="overline text-[9px] tracking-wider truncate">Receivables</span>
        </div>
        <span class="font-serif text-lg font-bold shrink-0"
          :class="totalPendingAmount > 0 ? 'text-ink' : 'text-ink-3'">${{ totalPendingAmount.toLocaleString() }}</span>
      </div>
      <div class="card py-1.5 px-3 border bg-surface/50 flex items-center justify-between gap-2.5">
        <div class="flex items-center gap-1.5 min-w-0"
          :class="totalChargedAmount > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-ink-3'">
          <span class="text-xs font-black font-mono shrink-0">$</span>
          <span class="overline text-[9px] tracking-wider truncate font-semibold">Charges</span>
        </div>
        <span class="font-serif text-lg font-bold shrink-0"
          :class="totalChargedAmount > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-ink-3'">${{
            totalChargedAmount.toLocaleString() }}</span>
      </div>
      <div class="card py-1.5 px-3 border bg-surface/50 flex items-center justify-between gap-2.5">
        <div class="flex items-center gap-1.5 text-ink-3 min-w-0">
          <FolderKanban class="w-3.5 h-3.5 text-ink-3 shrink-0" />
          <span class="overline text-[9px] tracking-wider truncate">Scope</span>
        </div>
        <span class="font-serif text-lg font-bold shrink-0" :class="openItems.length > 0 ? 'text-ink' : 'text-ink-3'">{{
          openItems.length }} active</span>
      </div>
    </div>

    <!-- TAB NAVIGATION -->
    <div class="border-b border-line flex items-center justify-between flex-wrap gap-2">
      <div class="flex gap-6 text-sm font-medium flex-wrap">
        <button v-for="(tab, i) in TABS" :key="tab" @click="activeTab = tab"
          class="pb-3 capitalize transition-all border-b-2 flex items-center gap-1.5"
          :class="activeTab === tab ? 'border-ink text-ink font-semibold' : 'border-transparent text-ink-3 hover:text-ink-2'">
          {{ tab }}
        </button>
      </div>
      <span class="text-[10px] text-ink-3 pb-3 select-none italic">Press <kbd
          class="kbd !text-[9px] !px-1 !py-0">⌥1</kbd>–<kbd class="kbd !text-[9px] !px-1 !py-0">⌥6</kbd> to switch
        tabs</span>
    </div>

    <!-- OVERVIEW TAB -->
    <div v-if="activeTab === 'overview'" class="grid grid-cols-1 lg:grid-cols-3 gap-8">

      <!-- Preferences / Settings View -->
      <!-- Preferences / Settings View -->
      <div class="lg:col-span-2 space-y-6">
        <div class="card p-6 border bg-surface space-y-6">
          <div class="flex items-center justify-between">
            <h3 class="font-serif text-xl font-bold text-ink">Client Memory Profile</h3>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
            <div class="space-y-1">
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
                <span v-if="getClientLocalTime(client.timezone)"
                  class="ml-1.5 text-[10px] bg-pri-strategic-bg text-pri-strategic px-1.5 py-0.5 rounded border border-pri-strategic-bd/50 font-normal">
                  Their Time: {{ getClientLocalTime(client.timezone) }}
                </span>
              </p>
            </div>
            <div class="space-y-1">
              <span class="text-xs uppercase tracking-overline text-ink-3">Communication Channel</span>
              <p class="font-medium text-ink">{{ client.preferredCommunication || 'Not specified' }}</p>
            </div>
            <div class="space-y-1">
              <span class="text-xs uppercase tracking-overline text-ink-3">Pricing Sensitivity</span>
              <p class="font-medium text-ink">{{ client.pricingSensitivity || 'Not specified' }}</p>
            </div>
            <div class="space-y-1">
              <span class="text-xs uppercase tracking-overline text-ink-3">Source</span>
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
            <p class="text-sm text-ink-2 leading-relaxed whitespace-pre-line">
              {{ client.relationshipNotes || `No notes added yet.` }}</p>
          </div>
        </div>
      </div>

      <!-- Sidebar Column -->
      <div class="space-y-6">
        <!-- Associated Calendar Logs -->
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
                <span v-if="inv.isExternal">ext_{{ inv.invoiceNumber }}</span>
                <span v-else>{{ inv.invoiceNumber }}</span>
                <ExternalLink v-if="inv.isExternal" class="w-3 h-3 text-pri-strategic shrink-0" />
              </td>
              <td class="p-4">
                <span class="px-2 py-0.5 rounded text-[9px] uppercase font-bold border"
                  :class="inv.status === 'paid' ? 'bg-pri-strategic-bg border-pri-strategic-bd text-pri-strategic' : inv.status === 'overdue' ? 'bg-pri-critical-bg border-pri-critical-bd text-pri-critical' : 'bg-pri-interruptive-bg border-pri-interruptive-bd text-pri-interruptive'">
                  {{ inv.status }}
                </span>
              </td>
              <td class="p-4 text-ink-2">{{ dayjs(inv.dueDate).format('MMM D, YYYY') }}</td>
              <td class="p-4 text-right text-ink font-medium">${{ inv.amount.toLocaleString() }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <EmptyState v-else title="Zero billing records"
        hint="Generate a direct invoice or retainer log to track receivables." />
    </div>

    <!-- REFERENCE TAB -->
    <div v-else-if="activeTab === 'reference'" class="space-y-6">
      <div class="flex items-center justify-between">
        <h3 class="font-serif text-lg font-semibold text-ink">Reference Links</h3>
        <button @click="openAddResourceModal('url')" class="btn-secondary !py-1 px-3 text-xs flex items-center gap-1">
          <Plus class="w-3.5 h-3.5" /> Add Link
        </button>
      </div>

      <div v-if="clientReferences.length" class="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-5xl">
        <div v-for="res in clientReferences" :key="res.id"
          @click="openEditResourceModal(res)"
          class="card p-4 border bg-surface flex items-center justify-between hover:border-line-2 hover:bg-canvas/5 transition-all duration-300 relative group cursor-pointer">
          <div class="flex items-center gap-3.5 min-w-0 flex-1">
            <!-- Icon container representing the link/resource -->
            <div class="w-10 h-10 rounded-xl bg-canvas flex items-center justify-center shrink-0 border border-line/40 group-hover:border-pri-strategic/30 transition-all">
              <component :is="getSubtypeIcon(res.subType || 'website')" class="w-5 h-5 text-ink-3 group-hover:text-pri-strategic transition-colors" />
            </div>
            
            <!-- Details: Title & Domain -->
            <div class="min-w-0 flex-1">
              <h4 class="text-sm font-sans font-normal text-ink line-clamp-2 leading-relaxed group-hover:text-pri-strategic transition-colors">
                {{ res.title }}
              </h4>
              <p v-if="res.notes" class="text-xs text-ink-2 mt-0.5 line-clamp-1 leading-normal">{{ res.notes }}</p>
              <div v-if="res.url" class="text-[11px] font-mono text-ink-3 mt-1.5 flex items-center gap-2 select-none flex-wrap">
                <!-- Subtype Badge -->
                <span class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider border shrink-0"
                  :class="getSubtypeConfig(res.subType || 'website').colorClass">
                  {{ getSubtypeConfig(res.subType || 'website').label }}
                </span>
                <span class="text-ink-4">•</span>
                <span>{{ getDomainName(res.url) }}</span>
              </div>
            </div>
          </div>

          <!-- Actions: Open link & Trash -->
          <div class="flex items-center gap-1.5 shrink-0 ml-3">
            <a v-if="res.url" :href="res.url" target="_blank" @click.stop
              class="text-ink-3 hover:text-pri-strategic p-2 rounded-xl hover:bg-canvas transition-all shrink-0">
              <ExternalLink class="w-4 h-4" />
            </a>
            <button @click.prevent.stop="deleteResource(res.id)" 
              class="text-ink-3 hover:text-pri-critical p-2 rounded-xl hover:bg-canvas transition-all shrink-0 md:opacity-0 group-hover:opacity-100 focus:opacity-100">
              <Trash2 class="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
      <EmptyState v-else title="No reference links" hint="Link references by clicking 'Add Link' above." />
    </div>

    <!-- CREDENTIALS TAB -->
    <div v-else-if="activeTab === 'credentials'" class="space-y-6">
      <div class="flex items-center justify-between">
        <h3 class="font-serif text-lg font-semibold text-ink">Credentials Vault</h3>
        <button @click="openAddResourceModal('credentials')"
          class="btn-secondary !py-1 px-3 text-xs flex items-center gap-1">
          <Plus class="w-3.5 h-3.5" /> Add Credential
        </button>
      </div>

      <div v-if="clientCredentials.length" class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div v-for="res in clientCredentials" :key="res.id"
          @click="openEditResourceModal(res)"
          class="card p-5 border bg-surface flex flex-col justify-between hover:border-line-2 transition-all duration-300 cursor-pointer">
          <div class="space-y-2">
            <div class="flex justify-between items-start">
              <span
                class="text-[9px] uppercase tracking-wider font-bold text-ink-3 bg-canvas border px-2 py-0.5 rounded">
                Account/Key
              </span>
              <button @click.stop="deleteResource(res.id)" class="text-ink-3 hover:text-pri-critical p-1">
                <Trash2 class="w-3.5 h-3.5" />
              </button>
            </div>

            <h4 class="font-serif text-base text-ink font-semibold flex items-center gap-1.5">
              <Key class="w-4 h-4 text-ink-3 shrink-0" />
              {{ res.title }}
            </h4>

            <p v-if="res.notes" class="text-xs text-ink-2 leading-relaxed">{{ res.notes }}</p>

            <div class="space-y-2 pt-2 text-xs font-mono bg-canvas/40 p-3 rounded-xl border border-line" @click.stop>
              <div v-if="res.url" class="pb-1.5 mb-1.5 border-b border-line/40 flex justify-between items-center">
                <span class="text-ink-3 text-[10px]">URL</span>
                <a :href="res.url" target="_blank" @click.stop
                  class="text-pri-strategic hover:underline inline-flex items-center gap-1 truncate max-w-[200px]">
                  {{ res.url }}
                  <ExternalLink class="w-2.5 h-2.5" />
                </a>
              </div>
              <div class="flex justify-between items-center">
                <span class="text-ink-3 text-[10px]">USER</span>
                <div class="flex items-center gap-1.5">
                  <span class="text-ink font-semibold">{{ res.username }}</span>
                  <button @click.stop="copyToClipboard(res.username)" class="text-ink-3 hover:text-ink">
                    <Copy class="w-3 h-3" />
                  </button>
                </div>
              </div>
              <div class="flex justify-between items-center border-t border-line/40 pt-1.5">
                <span class="text-ink-3 text-[10px]">PASS</span>
                <div class="flex items-center gap-1.5">
                  <span class="text-ink font-semibold">
                    {{ revealedPasswords[res.id] ? res.password : '••••••••' }}
                  </span>
                  <button @click.stop="togglePassword(res.id)" class="text-ink-3 hover:text-ink">
                    <EyeOff v-if="revealedPasswords[res.id]" class="w-3.5 h-3.5" />
                    <Eye v-else class="w-3.5 h-3.5" />
                  </button>
                  <button @click.stop="copyToClipboard(res.password)" class="text-ink-3 hover:text-ink">
                    <Copy class="w-3 h-3" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <EmptyState v-else title="No credentials stored"
        hint="Securely log access details by clicking 'Add Credential' above." />
    </div>

    <!-- EDIT CLIENT POPUP -->
    <ClientPopup v-if="isEditingPrefs" :client="client" @close="isEditingPrefs = false" @saved="handleClientSaved" />

    <!-- ADD NOTE MODAL -->
    <div v-if="showAddNoteModal" @keydown.window.esc="showAddNoteModal = false"
      class="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div class="fixed inset-0 bg-ink/40 backdrop-blur-sm animate-fade-in" @click="showAddNoteModal = false"></div>
      <div class="relative w-full max-w-md card p-8 shadow-xl bg-surface z-50 animate-rise-in space-y-6"
        @keydown.meta.enter.prevent="submitNewNote" @keydown.ctrl.enter.prevent="submitNewNote">
        <div>
          <div class="overline">New Document</div>
          <h2 class="font-serif text-2xl mt-1">Create document</h2>
        </div>

        <div class="space-y-4">
          <div>
            <label class="block text-xs font-semibold text-ink-2 mb-1">Document Title</label>
            <input ref="addNoteFirstInput" v-model="newNoteTitle" placeholder="e.g. Project onboarding or Kickoff notes"
              class="input-block text-sm focus:ring-1 focus:ring-emerald-500" @keyup.enter="submitNewNote" />
          </div>
        </div>

        <div class="flex justify-end gap-3 pt-2">
          <button @click="showAddNoteModal = false" class="btn-ghost">Cancel</button>
          <button @click="submitNewNote" class="btn-primary">
            Create Document <span
              class="kbd !bg-canvas/20 !border-canvas/10 !text-canvas select-none text-[9px] ml-1">⌘Enter</span>
          </button>
        </div>
      </div>
    </div>

    <!-- ADD RESOURCE MODAL -->
    <div v-if="showAddResourceModal" @keydown.window.esc="showAddResourceModal = false"
      class="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div class="fixed inset-0 bg-ink/40 backdrop-blur-sm animate-fade-in" @click="showAddResourceModal = false"></div>
      <div class="relative w-full max-w-lg card p-8 shadow-xl bg-surface z-50 animate-rise-in space-y-6"
        @keydown.meta.enter.prevent="submitNewResource" @keydown.ctrl.enter.prevent="submitNewResource">
        <div>
          <div class="overline">{{ editingResourceId ? 'Edit Resource' : 'New Vault Resource' }}</div>
          <h2 class="font-serif text-2xl mt-1">
            {{ editingResourceId ? (resourceType === 'url' ? 'Edit Reference Link' : 'Edit Credential') : (resourceType === 'url' ? 'Add Reference Link' : 'Add Credential') }}
          </h2>
        </div>

        <div class="space-y-4">
          <!-- Title -->
          <div class="v-field-group">
            <input ref="addResourceFirstInput" type="text" v-model="resourceTitle" placeholder=" "
              class="v-field-input text-sm" id="resource-title" />
            <label for="resource-title" class="v-field-label text-xs">Title/System Name</label>
          </div>

          <!-- URL & Link Type (side-by-side for URL resource, URL full-width for credentials) -->
          <div v-if="resourceType === 'url'" class="grid grid-cols-4 gap-4">
            <div class="col-span-3">
              <VUrlInput v-model="resourceUrl" label="URL/Folder Link" id="resource-url" />
            </div>
            <div class="col-span-1">
              <VSelect v-model="resourceSubType" label="Link Type" id="resource-subtype"
                :options="linkTypeOptions" option-value="value" option-label="label" />
            </div>
          </div>
          <VUrlInput v-else v-model="resourceUrl" label="URL/Folder Link" id="resource-url" />

          <!-- Credential specific fields -->
          <div v-if="resourceType === 'credentials'" class="grid grid-cols-2 gap-4">
            <div class="v-field-group">
              <input type="text" v-model="resourceUsername" placeholder=" " class="v-field-input text-sm"
                id="resource-username" />
              <label for="resource-username" class="v-field-label text-xs">Username/Email</label>
            </div>
            <div class="v-field-group">
              <input type="text" v-model="resourcePassword" placeholder=" " class="v-field-input font-mono text-sm"
                id="resource-password" />
              <label for="resource-password" class="v-field-label text-xs">Password</label>
            </div>
          </div>

          <!-- Notes -->
          <div class="v-field-group">
            <textarea v-model="resourceNotes" placeholder=" " class="v-field-input min-h-[80px] resize-none text-sm"
              id="resource-notes"></textarea>
            <label for="resource-notes" class="v-field-label text-xs">Description/Notes (optional)</label>
          </div>
        </div>

        <div class="flex justify-end gap-3 pt-2">
          <button @click="showAddResourceModal = false" class="btn-ghost">Cancel</button>
          <button @click="submitNewResource" class="btn-primary">
            {{ editingResourceId ? 'Save Changes' : 'Add Resource' }} <span
              class="kbd !bg-canvas/20 !border-canvas/10 !text-canvas select-none text-[9px] ml-1">⌘Enter</span>
          </button>
        </div>
      </div>
    </div>

  </div>
</template>
