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

const props = defineProps({
  // If editing, pass the client object. If creating, leave null/undefined.
  client: {
    type: Object,
    default: null
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
    name.value = ''
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
        class="relative w-full max-w-5xl card p-8 shadow-xl bg-surface z-50 animate-rise-in max-h-[90vh] overflow-y-auto space-y-6">
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
          <div class="lg:col-span-3 space-y-6">

            <!-- Identity -->
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div class="v-field-group">
                <input ref="firstInputRef" v-model="name" placeholder=" " class="v-field-input text-base font-medium"
                  required />
                <label class="v-field-label">Client Contact Name *</label>
              </div>

              <div class="v-field-group">
                <input v-model="companyName" placeholder=" " class="v-field-input" />
                <label class="v-field-label">Company / Workspace Name</label>
              </div>
            </div>

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
            <!-- Notes & Billing Address (Side-by-side, equal height) -->
            <div class="grid grid-cols-1 md:grid-cols-4 gap-4 items-start">
              <!-- Relationship Context (Large & Central) -->
              <div class="v-field-group md:col-span-2">
                <textarea v-model="relationshipNotes" placeholder=" "
                  class="v-field-input min-h-[200px] lg:min-h-[280px] py-3 resize-y font-sans leading-relaxed"></textarea>
                <label class="v-field-label">Operational Memory & Relationship Notes</label>
              </div>

              <!-- Billing Address (Enlarged to match notes height) -->
              <div class="v-field-group md:col-span-2">
                <textarea v-model="address" placeholder=" "
                  class="v-field-input min-h-[200px] lg:min-h-[280px] py-3 resize-y font-sans leading-relaxed"></textarea>
                <label class="v-field-label">Billing Address</label>
              </div>
            </div>

          </div>

          <!-- Sidebar / Operations & Secondary (lg:col-span-2) -->
          <div class="lg:col-span-2 space-y-6">

            <!-- Primary Controls Panel (Status, Timezone, Pricing) -->
            <div class="space-y-4">
              <div class="grid grid-cols-2 gap-4">
                <!-- Workspace Status -->
                <div class="v-field-group">
                  <select v-model="status" @focus="focusedFields.status = true" @blur="focusedFields.status = false"
                    class="v-field-select font-semibold">
                    <option v-for="(val, key) in clientsStore.STATUS_MAP" :key="key" :value="key">
                      {{ val.label }}
                    </option>
                  </select>
                  <span class="v-field-arrow">▼</span>
                  <label
                    :class="['v-field-label', (status || focusedFields.status) ? 'v-field-label--floating' : '', focusedFields.status ? 'v-field-label--floating-focused' : '']">Workspace
                    Status</label>
                </div>

                <!-- Pricing Sensitivity -->
                <div class="v-field-group">
                  <select v-model="pricingSensitivity" @focus="focusedFields.sensitivity = true"
                    @blur="focusedFields.sensitivity = false" class="v-field-select">
                    <option value="Low">Low (Value-driven)</option>
                    <option value="Medium">Medium (Budget-aware)</option>
                    <option value="High">High (Cost-focused)</option>
                  </select>
                  <span class="v-field-arrow">▼</span>
                  <label
                    :class="['v-field-label', (pricingSensitivity || focusedFields.sensitivity) ? 'v-field-label--floating' : '', focusedFields.sensitivity ? 'v-field-label--floating-focused' : '']">Pricing
                    Sensitivity</label>
                </div>
              </div>

              <!-- Timezone -->
              <div class="space-y-1">
                <div class="v-field-group">
                  <select v-model="timezone" @focus="focusedFields.timezone = true"
                    @blur="focusedFields.timezone = false" class="v-field-select">
                    <option v-for="tz in timezoneOptions" :key="tz.value" :value="tz.value">
                      {{ tz.label }}
                    </option>
                  </select>
                  <span class="v-field-arrow">▼</span>
                  <label
                    :class="['v-field-label', (timezone || focusedFields.timezone) ? 'v-field-label--floating' : '', focusedFields.timezone ? 'v-field-label--floating-focused' : '']">Timezone</label>
                </div>
                <div v-if="getClientLocalTime(timezone)" class="text-[10px] text-pri-strategic font-semibold pl-3">
                  local time - {{ getClientLocalTime(timezone) }}
                </div>
              </div>
            </div>

            <!-- Google Drive Directory Integration -->
            <div class="space-y-3 bg-canvas/30 p-4 rounded-2xl border border-line/45">
              <div class="flex items-center gap-1.5 text-ink-3">
                <HardDrive class="w-4 h-4 text-pri-strategic" />
                <span class="text-[10px] font-semibold uppercase tracking-wider">Google Drive Connection</span>
              </div>

              <!-- Switch for Auto-generate -->
              <div class="flex items-center">
                <label class="relative inline-flex items-center cursor-pointer select-none">
                  <input type="checkbox" v-model="createDriveFolder" class="sr-only peer" />
                  <div
                    class="w-9 h-5 bg-canvas border border-line rounded-full peer peer-checked:after:translate-x-4 after:content-[''] after:absolute after:top-[4px] after:left-[4px] after:bg-ink-3 peer-checked:after:bg-pri-strategic after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-pri-strategic/10 peer-checked:border-pri-strategic/30">
                  </div>
                  <span class="ml-3 text-xs font-semibold text-ink-2">Auto-generate folder</span>
                </label>
              </div>

              <!-- Custom Folder Input -->
              <div v-if="!createDriveFolder" class="relative v-field-group">
                <input v-model="customDriveUrlOrId" placeholder=" " class="v-field-input pr-10 text-xs" />
                <label class="v-field-label text-xs">Drive Folder URL or ID</label>
                <button v-if="customDriveUrlOrId.trim()" type="button" @click="openDriveFolder"
                  class="absolute right-3 top-1/2 -translate-y-1/2 btn-ghost !p-2 text-pri-strategic hover:text-pri-strategic-hover flex items-center justify-center cursor-pointer"
                  title="Open folder in browser">
                  <ExternalLink class="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <!-- Contact Section (Compact & Secondary) -->
            <div class="bg-canvas/15 p-4 rounded-2xl border border-line/25 space-y-4">
              <div class="flex items-center gap-1.5 text-ink-3">
                <Globe class="w-4 h-4 text-ink-3" />
                <span class="text-[10px] font-semibold uppercase tracking-wider">Contact Channels</span>
              </div>

              <div class="grid grid-cols-2 gap-4">
                <div class="v-field-group">
                  <input v-model="email" type="email" placeholder=" " class="v-field-input text-xs" />
                  <label class="v-field-label text-xs">Email Address</label>
                </div>

                <div class="v-field-group">
                  <input v-model="phone" placeholder=" " class="v-field-input text-xs" />
                  <label class="v-field-label text-xs">Phone Number</label>
                </div>
              </div>

              <div class="grid grid-cols-2 gap-4">
                <!-- Preferred Comm -->
                <div class="v-field-group">
                  <select v-model="preferredCommunication" @focus="focusedFields.comm = true"
                    @blur="focusedFields.comm = false" class="v-field-select text-xs">
                    <option value="Slack">Slack</option>
                    <option value="Email">Email</option>
                    <option value="WhatsApp">WhatsApp</option>
                    <option value="Teams">Microsoft Teams</option>
                    <option value="Other">Other</option>
                  </select>
                  <span class="v-field-arrow">▼</span>
                  <label
                    :class="['v-field-label text-xs', (preferredCommunication || focusedFields.comm) ? 'v-field-label--floating' : '', focusedFields.comm ? 'v-field-label--floating-focused' : '']">Preferred
                    Comm</label>
                </div>

                <!-- Acquisition Source -->
                <div class="v-field-group">
                  <select v-model="clientSource" @focus="focusedFields.source = true"
                    @blur="focusedFields.source = false" class="v-field-select text-xs">
                    <option value="Upwork">Upwork</option>
                    <option value="Referral">Referral</option>
                    <option value="Cold Email">Cold Email</option>
                    <option value="LinkedIn">LinkedIn</option>
                    <option value="Twitter/X">Twitter/X</option>
                    <option value="Other">Other</option>
                  </select>
                  <span class="v-field-arrow">▼</span>
                  <label
                    :class="['v-field-label text-xs', (clientSource || focusedFields.source) ? 'v-field-label--floating' : '', focusedFields.source ? 'v-field-label--floating-focused' : '']">Acquisition
                    Source</label>
                </div>
              </div>
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
