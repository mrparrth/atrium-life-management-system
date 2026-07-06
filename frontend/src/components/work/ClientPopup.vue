<script setup>
import { ref, computed, watch, nextTick, onMounted, onUnmounted } from 'vue'
import { useWorkClientsStore } from '@/stores/workClients'
import { useUIStore } from '@/stores/ui'
import {
  createClientDriveFolder,
  createClientDriveFolderInParent,
  extractFolderIdFromUrl
} from '@/services/drive'
import {
  X, User, HardDrive, Save, Trash2,
  Globe, Info, Sparkles, ExternalLink, Tag
} from 'lucide-vue-next'
import VInput from '@/components/VInput.vue'
import VSelect from '@/components/VSelect.vue'
import VUrlInput from '@/components/VUrlInput.vue'
import VTextarea from '@/components/VTextarea.vue'
import VRow from '@/components/VRow.vue'
import VCol from '@/components/VCol.vue'
import VCheckbox from '@/components/VCheckbox.vue'
const props = defineProps({
  // If editing, pass the client object. If creating, leave null/undefined.
  client: {
    type: Object,
    default: null
  },
  prefillName: {
    type: String,
    default: ''
  }
})

const emit = defineEmits(['close', 'saved'])

const clientsStore = useWorkClientsStore()
const ui = useUIStore()

const isEdit = computed(() => !!props.client)

// Form states
const name = ref('')
const companyName = ref('')
const address = ref('')
const email = ref('')
const phone = ref('')
const timezone = ref('America/New_York')
const preferredCommunication = ref('Slack')
const pricingSensitivity = ref('Medium')
const relationshipNotes = ref('')
const clientSource = ref('Upwork')
const selectedTags = ref([])
const status = ref('normal')

// Google Drive State
const createDriveFolder = ref(false)
const customDriveUrlOrId = ref('') // Allow pasting custom folder URL or ID directly

// Focus tracking for labels
const focusedFields = ref({})

// Timezone Options
const timezoneOptions = [
  { value: 'Pacific/Honolulu', label: '(GMT-10.0) HST · Honolulu' },
  { value: 'America/Anchorage', label: '(GMT-9.0) AKST · Anchorage' },
  { value: 'America/Los_Angeles', label: '(GMT-8.0) PST · Los Angeles, Seattle' },
  { value: 'America/Denver', label: '(GMT-7.0) MST · Denver, Salt Lake' },
  { value: 'America/Phoenix', label: '(GMT-7.0) MST (No DST) · Phoenix' },
  { value: 'America/Chicago', label: '(GMT-6.0) CST · Chicago, Dallas' },
  { value: 'America/New_York', label: '(GMT-5.0) EST · New York, Miami' },
  { value: 'America/Sao_Paulo', label: '(GMT-3.0) BRT · São Paulo, Rio' },
  { value: 'UTC', label: '(GMT+0.0) UTC' },
  { value: 'Europe/London', label: '(GMT+0.0) GMT/BST · London, Dublin' },
  { value: 'Europe/Paris', label: '(GMT+1.0) CET · Paris, Berlin, Rome' },
  { value: 'Europe/Athens', label: '(GMT+2.0) EET · Athens, Cairo' },
  { value: 'Europe/Moscow', label: '(GMT+3.0) MSK · Moscow, St. Petersburg' },
  { value: 'Asia/Dubai', label: '(GMT+4.0) GST · Dubai, Abu Dhabi' },
  { value: 'Asia/Kolkata', label: '(GMT+5.5) IST · New Delhi, Mumbai' },
  { value: 'Asia/Jakarta', label: '(GMT+7.0) WIB · Jakarta, Bangkok' },
  { value: 'Asia/Singapore', label: '(GMT+8.0) SGT · Singapore' },
  { value: 'Asia/Hong_Kong', label: '(GMT+8.0) HKT · Hong Kong' },
  { value: 'Asia/Tokyo', label: '(GMT+9.0) JST · Tokyo, Osaka' },
  { value: 'Asia/Seoul', label: '(GMT+9.0) KST · Seoul' },
  { value: 'Australia/Sydney', label: '(GMT+10.0) AEST · Sydney, Melbourne' },
  { value: 'Pacific/Auckland', label: '(GMT+12.0) NZST · Auckland, Wellington' }
]

// Predefined Tags with user-friendly readable labels (no custom tags allowed)
const tagOptions = [
  { key: 'tech-savvy', label: 'Tech Savvy' },
  { key: 'tech-noob', label: 'Tech Noob' },
  { key: 'slow-communication', label: 'Slow Comm' },
  { key: 'slow-payer', label: 'Slow Payer' },
  { key: 'high-priority', label: 'High Priority' },
  { key: 'scope-creeper', label: 'Scope Creeper' },
  { key: 'friendly', label: 'Friendly' },
  { key: 'demanding', label: 'Demanding' },
  { key: 'agency', label: 'Agency' },
  { key: 'startup', label: 'Startup' },
  { key: 'clear-brief', label: 'Clear Brief' }
]

// Focus ref for the first input
const firstInputRef = ref(null)

// Initialize form
function initForm() {
  if (props.client) {
    name.value = props.client.name || ''
    companyName.value = props.client.companyName || ''
    address.value = props.client.address || ''
    email.value = props.client.email || ''
    phone.value = props.client.phone || ''
    timezone.value = props.client.timezone || 'America/New_York'
    preferredCommunication.value = props.client.preferredCommunication || 'Slack'
    pricingSensitivity.value = props.client.pricingSensitivity || 'Medium'
    relationshipNotes.value = props.client.relationshipNotes || ''
    clientSource.value = props.client.clientSource || 'Upwork'
    selectedTags.value = props.client.tags ? [...props.client.tags] : []
    status.value = props.client.status || 'normal'

    // If they have a folder ID, show the link or ID
    customDriveUrlOrId.value = props.client.driveFolderId
      ? `https://drive.google.com/drive/folders/${props.client.driveFolderId}`
      : ''
    createDriveFolder.value = false
  } else {
    name.value = props.prefillName || ''
    companyName.value = ''
    address.value = ''
    email.value = ''
    phone.value = ''
    timezone.value = 'America/New_York'
    preferredCommunication.value = 'Slack'
    pricingSensitivity.value = 'Medium'
    relationshipNotes.value = ''
    clientSource.value = 'Upwork'
    selectedTags.value = []
    status.value = 'normal'
    customDriveUrlOrId.value = ''
    createDriveFolder.value = false
  }

  nextTick(() => {
    firstInputRef.value?.focus()
  })
}

// Watch client prop to reinit when it changes
watch(() => props.client, initForm, { immediate: true })

// Timezone helpers
function formatTimezoneShort(tzValue) {
  const option = timezoneOptions.find(o => o.value === tzValue)
  return option ? option.label.split('·')[0].trim() : tzValue
}

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

// Chip toggler
function toggleTag(tagKey) {
  if (selectedTags.value.includes(tagKey)) {
    selectedTags.value = selectedTags.value.filter(t => t !== tagKey)
  } else {
    selectedTags.value.push(tagKey)
  }
}

// Open folder in browser
function openDriveFolder() {
  if (!customDriveUrlOrId.value.trim()) return
  const val = customDriveUrlOrId.value.trim()
  if (val.startsWith('http://') || val.startsWith('https://')) {
    window.open(val, '_blank')
  } else {
    window.open(`https://drive.google.com/drive/folders/${val}`, '_blank')
  }
}

// Save action
async function saveClient() {
  if (!name.value.trim()) {
    ui.showToast('Please fill in: Client Contact Name', 'warning')
    return
  }

  // Extract Drive Folder ID if user pasted custom Drive URL or ID
  let folderId = ''
  if (!createDriveFolder.value && customDriveUrlOrId.value.trim()) {
    const extracted = extractFolderIdFromUrl(customDriveUrlOrId.value)
    folderId = extracted || customDriveUrlOrId.value.trim()
  }

  // Check if Drive folder creation was selected (only if folderId not already set)
  if (!folderId && createDriveFolder.value) {
    ui.showToast('Connecting to Google Drive...', 'info')
    try {
      const parentFolderUrl = localStorage.getItem('atrium.work.drive_folder_url') || ''
      const parentFolderId = extractFolderIdFromUrl(parentFolderUrl)

      if (parentFolderId) {
        folderId = await createClientDriveFolderInParent(name.value.trim(), parentFolderId)
      } else {
        const rootDir = localStorage.getItem('atrium.work.drive_root') || 'AtriumWork'
        folderId = await createClientDriveFolder(name.value.trim(), rootDir)
      }
    } catch (e) {
      ui.showToast(`Failed to create Drive folder: ${e.message}`, 'error')
    }
  }

  const payload = {
    name: name.value.trim(),
    companyName: companyName.value.trim(),
    address: address.value.trim(),
    email: email.value.trim(),
    phone: phone.value.trim(),
    timezone: timezone.value,
    preferredCommunication: preferredCommunication.value,
    pricingSensitivity: pricingSensitivity.value,
    relationshipNotes: relationshipNotes.value.trim(),
    tags: [...selectedTags.value],
    clientSource: clientSource.value.trim(),
    driveFolderId: folderId,
    status: status.value
  }

  try {
    let savedClient = null
    if (isEdit.value) {
      await clientsStore.update(props.client.id, payload)
      savedClient = { ...props.client, ...payload }
      ui.showToast('Client profile updated', 'success')
    } else {
      savedClient = await clientsStore.add(payload)
      ui.showToast('Client workspace created', 'success')
    }
    emit('saved', savedClient)
    emit('close')
  } catch (err) {
    ui.showToast(`Error saving client: ${err.message}`, 'error')
  }
}

// Delete action (only for edit mode)
async function confirmDelete() {
  if (!props.client) return
  const confirmed = await ui.confirm({
    title: 'Delete Client Workspace',
    message: `Are you sure you want to permanently delete the workspace for "${props.client.name}"? This will not delete Google Drive files.`,
    confirmText: 'Delete Workspace',
    isDestructive: true
  })

  if (confirmed) {
    await clientsStore.remove(props.client.id)
    ui.showToast('Client workspace deleted', 'success')
    emit('saved', { id: props.client.id, deleted: true })
    emit('close')
  }
}

function handleKeydown(e) {
  if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
    e.preventDefault()
    saveClient()
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleKeydown)
  nextTick(() => {
    firstInputRef.value?.focus()
  })
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown)
})
</script>

<template>
  <Teleport to="body">
    <div class="fixed inset-0 z-40 flex items-center justify-center overflow-y-auto px-4 py-8"
      @keydown.window.esc="emit('close')">
      <!-- Backdrop -->
      <div class="fixed inset-0 bg-ink/40 backdrop-blur-sm animate-fade-in" @click="emit('close')"></div>

      <!-- Modal Card -->
      <div
        class="relative w-full max-w-5xl card p-8 shadow-xl bg-surface z-50 animate-rise-in overflow-visible my-auto space-y-2">
        <!-- Header -->
        <div class="flex items-start justify-between">
          <div>
            <span
              class="text-xs uppercase tracking-overline text-pri-strategic flex items-center gap-1.5 font-semibold">
              <Sparkles class="w-3.5 h-3.5" />
              {{ isEdit ? 'Client Operating System' : 'New Operational Hub' }}
            </span>
            <h2 class="font-serif text-2xl mt-1 text-ink font-bold">
              {{ isEdit ? 'Edit Client Profile' : 'Create Client Workspace' }}
            </h2>
            <p class="text-xs text-ink-3 mt-1">
              Configure contact parameters, strategic pricing metadata, and Google Drive directories.
            </p>
          </div>
          <button class="btn-ghost !p-1.5 rounded-xl hover:bg-canvas/50" @click="emit('close')">
            <X class="w-5 h-5 text-ink-3 hover:text-ink" />
          </button>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-5 gap-8">
          <!-- Main Workspace (lg:col-span-3) -->
          <div class="lg:col-span-3 space-y-4">

            <!-- Identity -->
            <VRow>
              <VCol cols="12" sm="6">
                <VInput ref="firstInputRef" v-model="name" label="Client Contact Name *" id="client-name" required />
              </VCol>
              <VCol cols="12" sm="6">
                <VInput v-model="companyName" label="Company / Workspace Name" id="client-company" />
              </VCol>
            </VRow>

            <!-- Workspace Status & Timezone Row (1/3 & 2/3 split) -->
            <VRow>
              <VCol cols="12" sm="4">
                <VSelect v-model="status" label="Workspace Status" id="client-status"
                  :options="Object.entries(clientsStore.STATUS_MAP).map(([key, val]) => ({ key, label: val.label }))"
                  option-value="key" option-label="label" />
              </VCol>

              <VCol cols="12" sm="8">
                <VSelect v-model="timezone" label="Timezone" id="client-timezone" :options="timezoneOptions"
                  option-value="value" option-label="label" searchable />
                <div v-if="getClientLocalTime(timezone)" class="text-[10px] text-pri-strategic font-semibold pl-3 mt-1">
                  local time - {{ getClientLocalTime(timezone) }}
                </div>
              </VCol>
            </VRow>

            <!-- Tags Directly Below Notes & Address -->
            <div class="space-y-2">
              <span class="block text-xs font-semibold text-ink-2">Client Tags (Click to toggle)</span>
              <div class="flex flex-wrap gap-1.5">
                <button v-for="t in tagOptions" :key="t.key" @click="toggleTag(t.key)" type="button"
                  class="text-xs px-3 py-1.5 rounded-xl border transition-all duration-200 select-none cursor-pointer"
                  :class="selectedTags.includes(t.key)
                    ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 font-semibold'
                    : 'bg-canvas text-ink-3 border-line hover:text-ink hover:border-line-2'">
                  {{ t.label }}
                </button>
              </div>
            </div>

            <VRow>
              <VCol cols="12" sm="6">
                <VTextarea v-model="relationshipNotes" label="Relationship Notes" id="client-notes" rows="6" />
              </VCol>
              <VCol cols="12" sm="6">
                <VTextarea v-model="address" label="Billing Address" id="client-address" rows="6" />
              </VCol>
            </VRow>

          </div>

          <!-- Sidebar / Operations & Secondary (lg:col-span-2) -->
          <div class="lg:col-span-2 space-y-4">

            <!-- Contact Section (Compact & Secondary) (Moved above Google Drive Connection) -->
            <div class="bg-canvas/15 p-4 rounded-2xl border border-line/25">
              <VRow>
                <VCol cols="12">
                  <div class="flex items-center gap-1.5 text-ink-3">
                    <Globe class="w-4 h-4 text-ink-3" />
                    <span class="text-[10px] font-semibold uppercase tracking-wider">Contact Channels</span>
                  </div>
                </VCol>

                <VCol cols="12">
                  <VInput v-model="email" type="email" label="Email Address" id="client-email" />
                </VCol>
                <VCol cols="12">
                  <VInput v-model="phone" label="Phone Number" id="client-phone" />
                </VCol>

                <VCol cols="12">
                  <VSelect v-model="pricingSensitivity" label="Pricing Sensitivity" id="client-pricing" :options="[
                    { key: 'Low', label: 'Low (Value-driven)' },
                    { key: 'Medium', label: 'Medium (Budget-aware)' },
                    { key: 'High', label: 'High (Cost-focused)' }
                  ]" option-value="key" option-label="label" />
                </VCol>

                <VCol cols="12" sm="6">
                  <VSelect v-model="preferredCommunication" label="Preferred Comm" id="client-preferred-comm" :options="[
                    { value: 'Slack', label: 'Slack' },
                    { value: 'Email', label: 'Email' },
                    { value: 'WhatsApp', label: 'WhatsApp' },
                    { value: 'Teams', label: 'Microsoft Teams' },
                    { value: 'Other', label: 'Other' }
                  ]" />
                </VCol>
                <VCol cols="12" sm="6">
                  <VSelect v-model="clientSource" label="Acquisition Source" id="client-source" :options="[
                    { value: 'Upwork', label: 'Upwork' },
                    { value: 'Referral', label: 'Referral' },
                    { value: 'Cold Email', label: 'Cold Email' },
                    { value: 'LinkedIn', label: 'LinkedIn' },
                    { value: 'Twitter/X', label: 'Twitter/X' },
                    { value: 'Other', label: 'Other' }
                  ]" />
                </VCol>
              </VRow>
            </div>

            <!-- Google Drive Directory Integration -->
            <div class="bg-canvas/30 p-4 rounded-2xl border border-line/45">
              <VRow dense>
                <VCol cols="12">
                  <div class="flex items-center gap-1.5 text-ink-3">
                    <HardDrive class="w-4 h-4 text-pri-strategic" />
                    <span class="text-[10px] font-semibold uppercase tracking-wider">Google Drive Connection</span>
                  </div>
                </VCol>

                <!-- Switch for Auto-generate -->
                <VCol cols="12" class="flex items-center pt-2">
                  <VCheckbox v-model="createDriveFolder" label="Auto-generate folder" />
                </VCol>

                <!-- Custom Folder Input -->
                <VCol cols="12" v-if="!createDriveFolder" class="pt-2">
                  <VUrlInput v-model="customDriveUrlOrId" label="Drive Folder URL or ID" id="client-drive-url" />
                </VCol>
              </VRow>
            </div>

          </div>
        </div>

        <!-- Action Buttons -->
        <div class="flex justify-between items-center pt-4 border-t border-line">
          <div>
            <button v-if="isEdit" @click="confirmDelete"
              class="btn-ghost !text-pri-critical hover:bg-pri-critical-bg font-semibold flex items-center gap-1.5">
              <Trash2 class="w-4 h-4" /> Delete Client
            </button>
          </div>
          <div class="flex gap-3">
            <button @click="emit('close')" class="btn-secondary">
              Cancel
            </button>
            <button @click="saveClient" class="btn-primary flex items-center gap-1.5">
              <Save class="w-4 h-4" />
              <span>{{ isEdit ? 'Save Changes' : 'Create Workspace' }}</span>
              <span class="kbd !bg-canvas/20 !border-canvas/10 !text-canvas select-none ml-1.5">⌘Enter</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>
