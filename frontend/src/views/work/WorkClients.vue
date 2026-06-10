<script setup>
import { computed, ref, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useWorkClientsStore } from '@/stores/workClients'
import { useWorkItemsStore } from '@/stores/workItems'
import { useUIStore } from '@/stores/ui'
import { createClientDriveFolder } from '@/services/drive'
import PageHeader from '@/components/PageHeader.vue'
import SectionHeader from '@/components/SectionHeader.vue'
import EmptyState from '@/components/EmptyState.vue'
import {
  Plus, User, Heart, MessageSquare, Clock, ArrowRight,
  ShieldAlert, Star, HardDrive, Search, LayoutGrid, List,
  SlidersHorizontal, ArrowUpDown
} from 'lucide-vue-next'
import dayjs from 'dayjs'

const router = useRouter()
const clientsStore = useWorkClientsStore()
const ui = useUIStore()

const showAddModal = ref(false)
const clientName = ref('')
const clientCompanyName = ref('')
const clientAddress = ref('')
const clientEmail = ref('')
const clientPhone = ref('')
const clientTimezone = ref('America/Los_Angeles')
const clientComm = ref('Slack')
const clientSensitivity = ref('Medium')
const clientSource = ref('Upwork')
const clientTagsString = ref('')
const clientTechSavvy = ref(false)
const clientUpcharge = ref(0)
const createDriveFolder = ref(false)
const clientStatus = ref('normal')
const focusedFields = ref({})


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

function formatTimezoneShort(tzValue) {
  const option = timezoneOptions.find(o => o.value === tzValue)
  if (option) {
    return option.label.split('·')[0].trim()
  }
  return tzValue
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

const predefinedTagOptions = [
  'tech-savvy', 'slow-communication', 'slow-payer',
  'high-priority', 'scope-creeper', 'friendly',
  'demanding', 'agency', 'startup', 'clear-brief'
]

const surchargeTagOptions = [
  '10%', '20%', '30%', '40%', '50%', '75%', '100%'
]

function togglePredefinedTag(tag) {
  let currentTags = clientTagsString.value
    ? clientTagsString.value.split(',').map(t => t.trim()).filter(Boolean)
    : []
  if (currentTags.includes(tag)) {
    currentTags = currentTags.filter(t => t !== tag)
  } else {
    if (tag.endsWith('%')) {
      currentTags = currentTags.filter(t => !t.endsWith('%'))
    }
    currentTags.push(tag)
  }
  clientTagsString.value = currentTags.join(', ')
}

function addPredefinedTagFromDropdown(event) {
  const tag = event.target.value
  if (!tag) return
  togglePredefinedTag(tag)
  event.target.value = ''
}

async function createClient() {
  if (!clientCompanyName.value.trim()) return

  // Parse tags
  const tags = clientTagsString.value
    ? clientTagsString.value.split(',').map(t => t.trim().toLowerCase()).filter(Boolean)
    : []

  // Extract upcharge percentage from tags ending in %
  let upcharge = 0
  for (const tag of tags) {
    if (tag.endsWith('%')) {
      const val = parseInt(tag.slice(0, -1), 10)
      if (!isNaN(val)) {
        upcharge = val
        break
      }
    }
  }

  // Check if Drive folder creation was selected
  let folderId = ''
  if (createDriveFolder.value) {
    const rootDir = localStorage.getItem('atrium.work.drive_root') || 'AtriumWork'
    ui.showToast('Connecting to Google Drive...', 'info')
    try {
      folderId = await createClientDriveFolder(clientName.value.trim(), rootDir)
    } catch (e) {
      ui.showToast(`Failed to create Drive folder: ${e.message}`, 'error')
    }
  }

  const created = await clientsStore.add({
    name: clientName.value.trim(),
    companyName: clientCompanyName.value.trim(),
    address: clientAddress.value.trim(),
    email: clientEmail.value.trim(),
    phone: clientPhone.value.trim(),
    timezone: clientTimezone.value,
    preferredCommunication: clientComm.value,
    technicalStack: '',
    pricingSensitivity: clientSensitivity.value,
    relationshipNotes: '',
    tags,
    techSavvy: clientTechSavvy.value,
    upchargePercentage: upcharge,
    clientSource: clientSource.value.trim(),
    driveFolderId: folderId,
    status: clientStatus.value
  })

  clientName.value = ''
  clientCompanyName.value = ''
  clientAddress.value = ''
  clientEmail.value = ''
  clientPhone.value = ''
  clientTagsString.value = ''
  clientTechSavvy.value = false
  clientUpcharge.value = 0
  createDriveFolder.value = false
  clientStatus.value = 'normal'
  showAddModal.value = false
  ui.showToast('Client workspace created', 'success')
  if (created && created.id) {
    router.push(`/work/clients/${created.id}`)
  }
}

function autoGrowTextarea(event) {
  const el = event.target
  el.style.height = 'auto'
  el.style.height = `${el.scrollHeight}px`
}

const itemsStore = useWorkItemsStore()

function handleGlobalKeydown(e) {
  if (e.key === 'Escape') {
    showAddModal.value = false
  }
}

onMounted(async () => {
  await clientsStore.load()
  await itemsStore.load()
  window.addEventListener('keydown', handleGlobalKeydown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleGlobalKeydown)
})

function getHealthStatus(client) {
  const diff = dayjs().diff(dayjs(client.lastInteractionAt), 'day')
  if (diff >= 45) return { label: 'Danger', class: 'bg-pri-critical-bg text-pri-critical border-pri-critical-bd' }
  if (diff >= 30) return { label: 'Stale', class: 'bg-pri-interruptive-bg text-pri-interruptive border-pri-interruptive-bd' }
  return { label: 'Healthy', class: 'bg-pri-strategic-bg text-pri-strategic border-pri-strategic-bd' }
}

function getClientTotalCharged(client) {
  return itemsStore.items
    .filter(item => item.clientId === client.id)
    .reduce((sum, item) => sum + (item.charged || 0), 0)
}

const searchQuery = ref('')
const statusFilter = ref('all')
const sortBy = ref('updatedAt')
const viewMode = ref('grid') // 'grid' | 'list'

const filteredClients = computed(() => {
  let list = [...clientsStore.items]

  // Apply search
  if (searchQuery.value.trim()) {
    const q = searchQuery.value.toLowerCase().trim()
    list = list.filter(c => c.name.toLowerCase().includes(q) || (c.companyName && c.companyName.toLowerCase().includes(q)))
  }

  // Apply status filter
  if (statusFilter.value !== 'all') {
    list = list.filter(c => {
      const s = c.status === 'active' ? 'normal' : (c.status || 'normal')
      return s === statusFilter.value
    })
  }

  // Apply sorting
  list.sort((a, b) => {
    if (sortBy.value === 'updatedAt') {
      return b.updatedAt.localeCompare(a.updatedAt)
    }
    if (sortBy.value === 'name_asc') {
      return a.name.localeCompare(b.name)
    }
    if (sortBy.value === 'name_desc') {
      return b.name.localeCompare(a.name)
    }
    if (sortBy.value === 'cost_desc') {
      return getClientTotalCharged(b) - getClientTotalCharged(a)
    }
    if (sortBy.value === 'rating_desc') {
      return (b.rating || 0) - (a.rating || 0)
    }
    return 0
  })

  return list
})
</script>

<template>
  <div class="px-8 md:px-12 py-10 max-w-6xl mx-auto space-y-8" data-testid="work-clients">
    <PageHeader overline="Operations" title="Clients"
      sub="Your relationship hubs, operational workspaces, and memory system.">
      <template #right>
        <button @click="showAddModal = true" class="btn-primary">
          <Plus class="w-4 h-4" /> Create Client <span
            class="kbd ml-1.5 !bg-canvas/20 !border-canvas/10 !text-canvas select-none">⌘1</span>
        </button>
      </template>
    </PageHeader>

    <!-- FILTER & SORT TOOLBAR -->
    <div
      class="flex flex-col md:flex-row gap-4 items-stretch md:items-center justify-between bg-surface border border-line p-4 rounded-2xl shadow-sm">
      <!-- Search Input -->
      <div class="relative flex-1">
        <span class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-ink-3">
          <Search class="w-4 h-4" />
        </span>
        <input v-model="searchQuery" placeholder="Search clients or company..."
          class="input-block !pl-10 text-sm bg-canvas/30" />
      </div>

      <!-- Filters & Sorting Controls -->
      <div class="flex items-center gap-3 flex-wrap">
        <!-- Status Filter select -->
        <div class="flex items-center gap-1.5">
          <span class="text-xs text-ink-3 font-medium hidden sm:inline">Status:</span>
          <select v-model="statusFilter"
            class="bg-canvas border border-line rounded-xl px-3 py-1.5 text-xs text-ink-2 font-semibold focus:outline-none cursor-pointer">
            <option value="all">All Statuses</option>
            <option v-for="(val, key) in clientsStore.STATUS_MAP" :key="key" :value="key">
              {{ val.label }}
            </option>
          </select>
        </div>

        <!-- Sort By select -->
        <div class="flex items-center gap-1.5">
          <span class="text-xs text-ink-3 font-medium hidden sm:inline">
            <SlidersHorizontal class="w-3.5 h-3.5 inline mr-0.5" /> Sort:
          </span>
          <select v-model="sortBy"
            class="bg-canvas border border-line rounded-xl px-3 py-1.5 text-xs text-ink-2 font-semibold focus:outline-none cursor-pointer">
            <option value="updatedAt">Last Updated</option>
            <option value="name_asc">Name (A-Z)</option>
            <option value="name_desc">Name (Z-A)</option>
            <option value="cost_desc">Scope Value (Cost)</option>
            <option value="rating_desc">Client Rating</option>
          </select>
        </div>

        <!-- Divider -->
        <div class="h-6 w-px bg-line/85 mx-1 hidden sm:block"></div>

        <!-- View Mode Toggle -->
        <div class="flex items-center bg-canvas border border-line p-0.5 rounded-xl">
          <button @click="viewMode = 'grid'" class="p-1.5 rounded-lg transition-all"
            :class="viewMode === 'grid' ? 'bg-surface shadow-sm text-pri-strategic' : 'text-ink-3 hover:text-ink'">
            <LayoutGrid class="w-4 h-4" />
          </button>
          <button @click="viewMode = 'list'" class="p-1.5 rounded-lg transition-all"
            :class="viewMode === 'list' ? 'bg-surface shadow-sm text-pri-strategic' : 'text-ink-3 hover:text-ink'">
            <List class="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>

    <section>
      <div v-if="filteredClients.length">
        <!-- Grid View -->
        <div v-if="viewMode === 'grid'" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 animate-fade-in">
          <div v-for="client in filteredClients" :key="client.id" @click="router.push(`/work/clients/${client.id}`)"
            class="card p-5 border hover:border-line-2 cursor-pointer transition-all duration-300 flex flex-col justify-between group">
            <div>
              <div class="flex items-center justify-between gap-2 mb-2.5">
                <span class="text-xs uppercase tracking-overline text-ink-3 flex items-center gap-1">
                  <User class="w-3.5 h-3.5" /> {{ client.clientSource || '' }}
                </span>
                <div class="flex items-center gap-1.5">
                  <span v-if="client.upchargePercentage > 0"
                    class="text-[9px] font-bold px-1.5 py-0.5 rounded bg-pri-critical-bg text-pri-critical border border-pri-critical-bd shrink-0">
                    +{{ client.upchargePercentage }}% Upcharge
                  </span>
                  <span v-if="client.rating"
                    class="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-600 border border-amber-500/20 flex items-center gap-0.5 shrink-0">
                    <Star class="w-2.5 h-2.5 fill-current" /> {{ client.rating }}
                  </span>
                  <span class="text-[9px] uppercase tracking-overline font-bold px-2 py-0.5 rounded border shrink-0"
                    :class="clientsStore.getStatusStyle(client.status).color">
                    {{ clientsStore.getStatusStyle(client.status).label }}
                  </span>
                  <span class="text-[9px] uppercase tracking-overline font-bold px-2 py-0.5 rounded border shrink-0"
                    :class="getHealthStatus(client).class">
                    {{ getHealthStatus(client).label }}
                  </span>
                </div>
              </div>

              <h3
                class="font-serif text-lg font-semibold text-ink group-hover:text-ink transition-colors flex items-center justify-between gap-4">
                <span class="flex items-center gap-1.5 flex-wrap">
                  {{ client.name }}
                  <span v-if="client.techSavvy"
                    class="text-[9px] bg-pri-strategic-bg text-pri-strategic px-1.5 py-0.5 rounded-full border border-pri-strategic-bd/50 font-sans font-normal">Tech-savvy</span>
                </span>
                <span class="font-bold text-emerald-600 dark:text-emerald-400 font-mono text-sm shrink-0"
                  title="Total Task Scope Charges">
                  ${{ getClientTotalCharged(client).toLocaleString() }}
                </span>
              </h3>

              <p v-if="client.relationshipNotes" class="text-xs text-ink-2 mt-1 line-clamp-2 leading-relaxed">
                {{ client.relationshipNotes }}
              </p>

              <div v-if="client.tags && client.tags.length" class="flex flex-wrap gap-1 mt-2.5">
                <span v-for="tag in client.tags" :key="tag"
                  class="text-[9px] text-ink-3 bg-canvas px-1.5 py-0.5 rounded border">
                  #{{ tag }}
                </span>
              </div>
            </div>

            <div class="mt-4 pt-3 border-t border-line/40 flex items-center justify-between text-xs text-ink-3">
              <span class="flex items-center gap-1.5">
                <MessageSquare class="w-3.5 h-3.5 text-ink-3 shrink-0" /> {{ client.preferredCommunication }} · {{
                  client.timezone }}
                <span v-if="getClientLocalTime(client.timezone)"
                  class="text-[10px] text-pri-strategic font-semibold ml-0.5">
                  ({{ getClientLocalTime(client.timezone) }})
                </span>
              </span>
            </div>
          </div>
        </div>

        <!-- List View -->
        <div v-else class="card overflow-hidden border bg-surface animate-fade-in">
          <table class="w-full text-left border-collapse text-xs">
            <thead>
              <tr class="bg-canvas border-b border-line text-ink-3 uppercase tracking-wider text-[10px] font-semibold">
                <th class="p-4">Client Contact Name</th>
                <th class="p-4">Workspace / Company</th>
                <th class="p-4">Status</th>
                <th class="p-4">Health</th>
                <th class="p-4">Source</th>
                <th class="p-4 text-right">Scope Value</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="client in filteredClients" :key="client.id" @click="router.push(`/work/clients/${client.id}`)"
                class="border-b border-line last:border-0 hover:bg-canvas/40 cursor-pointer transition-colors">
                <td class="p-4 font-semibold text-ink flex items-center gap-2">
                  <User class="w-3.5 h-3.5 text-ink-3" />
                  {{ client.name }}
                  <span v-if="client.rating"
                    class="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-600 border border-amber-500/20 flex items-center gap-0.5 shrink-0 animate-fade-in">
                    <Star class="w-2.5 h-2.5 fill-current" /> {{ client.rating }}
                  </span>
                </td>
                <td class="p-4 text-ink-2 font-medium">{{ client.companyName || '-' }}</td>
                <td class="p-4">
                  <span class="px-2 py-0.5 rounded text-[9px] uppercase font-bold border"
                    :class="clientsStore.getStatusStyle(client.status).color">
                    {{ clientsStore.getStatusStyle(client.status).label }}
                  </span>
                </td>
                <td class="p-4">
                  <span class="px-2 py-0.5 rounded text-[9px] uppercase font-bold border"
                    :class="getHealthStatus(client).class">
                    {{ getHealthStatus(client).label }}
                  </span>
                </td>
                <td class="p-4 text-ink-3 font-mono text-[10px]">{{ client.clientSource || '-' }}</td>
                <td class="p-4 text-right text-ink font-semibold font-mono">${{
                  getClientTotalCharged(client).toLocaleString() }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <EmptyState v-else title="No clients match filters"
        hint="Try adjusting your status filters, search query, or create a new client." />
    </section>

    <!-- CREATE CLIENT MODAL -->
    <div v-if="showAddModal" @keydown.window.esc="showAddModal = false"
      class="fixed inset-0 z-40 flex items-center justify-center overflow-y-auto px-4">
      <div class="fixed inset-0 bg-ink/40 backdrop-blur-sm" @click="showAddModal = false"></div>
      <div class="relative w-full max-w-3xl card p-8 shadow-xl bg-surface z-50 animate-rise-in space-y-6">
        <div>
          <h2 class="font-serif text-2xl text-ink">Create Client Workspace</h2>
          <p class="text-xs text-ink-3 mt-1">Set up a new client workspace, communication hubs, and operational
            integrations.</p>
        </div>

        <div class="space-y-6">
          <!-- [ Basic Information ] -->
          <div class="space-y-3">
            <h3
              class="text-xs uppercase tracking-overline text-pri-strategic font-semibold border-b border-line pb-1.5">[
              Basic Information ]</h3>
            <div class="grid grid-cols-2 gap-4 items-start">
              <div class="v-field-group">
                <input v-model="clientName" placeholder=" " class="v-field-input" required />
                <label class="v-field-label">Client Contact Name *</label>
              </div>
              <div class="space-y-1">
                <div class="v-field-group">
                  <select v-model="clientTimezone" @focus="focusedFields.timezone = true"
                    @blur="focusedFields.timezone = false" class="v-field-select">
                    <option v-for="tz in timezoneOptions" :key="tz.value" :value="tz.value">
                      {{ tz.label }}
                    </option>
                  </select>
                  <span class="v-field-arrow">▼</span>
                  <label
                    :class="['v-field-label', (clientTimezone || focusedFields.timezone) ? 'v-field-label--floating' : '', focusedFields.timezone ? 'v-field-label--floating-focused' : '']">Timezone</label>
                </div>
                <div v-if="getClientLocalTime(clientTimezone)"
                  class="text-[10px] text-pri-strategic font-semibold pl-3.5">
                  {{ formatTimezoneShort(clientTimezone) }} · {{ getClientLocalTime(clientTimezone) }} local
                </div>
              </div>
            </div>
            <div class="grid grid-cols-2 gap-4 items-start">
              <div class="v-field-group">
                <input v-model="clientCompanyName" placeholder=" " class="v-field-input" />
                <label class="v-field-label">Company / Workspace Name</label>
              </div>
              <div class="v-field-group">
                <select v-model="clientStatus" @focus="focusedFields.status = true" @blur="focusedFields.status = false"
                  class="v-field-select font-semibold">
                  <option v-for="(val, key) in clientsStore.STATUS_MAP" :key="key" :value="key">
                    {{ val.label }}
                  </option>
                </select>
                <span class="v-field-arrow">▼</span>
                <label
                  :class="['v-field-label', (clientStatus || focusedFields.status) ? 'v-field-label--floating' : '', focusedFields.status ? 'v-field-label--floating-focused' : '']">Client
                  Status</label>
              </div>
            </div>
          </div>

          <!-- [ Contact ] -->
          <div class="space-y-3">
            <h3
              class="text-xs uppercase tracking-overline text-pri-strategic font-semibold border-b border-line pb-1.5">[
              Contact ]</h3>
            <div class="grid grid-cols-3 gap-4 items-start">
              <div class="v-field-group">
                <input v-model="clientEmail" placeholder=" " class="v-field-input" />
                <label class="v-field-label">Email</label>
              </div>
              <div class="v-field-group">
                <input v-model="clientPhone" placeholder=" " class="v-field-input" />
                <label class="v-field-label">Phone</label>
              </div>
              <div class="v-field-group">
                <select v-model="clientComm" @focus="focusedFields.comm = true" @blur="focusedFields.comm = false"
                  class="v-field-select">
                  <option value="Slack">Slack</option>
                  <option value="Email">Email</option>
                  <option value="WhatsApp">WhatsApp</option>
                  <option value="Teams">Microsoft Teams</option>
                </select>
                <span class="v-field-arrow">▼</span>
                <label
                  :class="['v-field-label', (clientComm || focusedFields.comm) ? 'v-field-label--floating' : '', focusedFields.comm ? 'v-field-label--floating-focused' : '']">Preferred
                  Communication</label>
              </div>
            </div>
            <div class="v-field-group">
              <input v-model="clientAddress" placeholder=" " class="v-field-input" />
              <label class="v-field-label">Billing Address</label>
            </div>
          </div>

          <!-- [ Business Context ] -->
          <div class="space-y-3">
            <h3
              class="text-xs uppercase tracking-overline text-pri-strategic font-semibold border-b border-line pb-1.5">[
              Business Context ]</h3>
            <div class="grid grid-cols-2 gap-4 items-start">
              <div class="v-field-group">
                <select v-model="clientSource" @focus="focusedFields.source = true" @blur="focusedFields.source = false"
                  class="v-field-select">
                  <option value="Upwork">Upwork</option>
                  <option value="Referral">Referral</option>
                  <option value="Cold Email">Cold Email</option>
                  <option value="LinkedIn">LinkedIn</option>
                  <option value="Twitter/X">Twitter/X</option>
                  <option value="Other">Other</option>
                </select>
                <span class="v-field-arrow">▼</span>
                <label
                  :class="['v-field-label', (clientSource || focusedFields.source) ? 'v-field-label--floating' : '', focusedFields.source ? 'v-field-label--floating-focused' : '']">Acquisition
                  Source</label>
              </div>
              <div class="v-field-group">
                <select v-model="clientSensitivity" @focus="focusedFields.sensitivity = true"
                  @blur="focusedFields.sensitivity = false" class="v-field-select">
                  <option value="Low">Low (Value-driven)</option>
                  <option value="Medium">Medium (Budget-aware)</option>
                  <option value="High">High (Cost-focused)</option>
                </select>
                <span class="v-field-arrow">▼</span>
                <label
                  :class="['v-field-label', (clientSensitivity || focusedFields.sensitivity) ? 'v-field-label--floating' : '', focusedFields.sensitivity ? 'v-field-label--floating-focused' : '']">Pricing
                  Sensitivity</label>
              </div>
            </div>
            <div class="v-field-group">
              <input v-model="clientTagsString" placeholder=" " class="v-field-input" />
              <label class="v-field-label">Client Tags (comma separated)</label>
            </div>

            <div class="grid grid-cols-2 gap-4 items-start pt-1">
              <div class="v-field-group">
                <select @change="addPredefinedTagFromDropdown" @focus="focusedFields.stdTags = true"
                  @blur="focusedFields.stdTags = false" class="v-field-select text-xs cursor-pointer">
                  <option value="">-- Add standard tag --</option>
                  <option v-for="tag in predefinedTagOptions" :key="tag" :value="tag">{{ tag }}</option>
                </select>
                <span class="v-field-arrow">▼</span>
                <label
                  :class="['v-field-label', focusedFields.stdTags ? 'v-field-label--floating text-pri-strategic' : 'v-field-label--floating']">Standard
                  Tags</label>
              </div>

              <div>
                <label class="block text-[10px] text-ink-3 uppercase tracking-wider mb-1 font-semibold">Surcharge
                  Suffix</label>
                <div class="flex flex-wrap gap-1">
                  <button v-for="tag in surchargeTagOptions" :key="tag" @click="togglePredefinedTag(`surcharge-${tag}`)"
                    type="button" class="text-[10px] px-2 py-1 rounded-lg border transition-all" :class="clientTagsString.split(',').map(t => t.trim()).includes(tag)
                      ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 font-semibold'
                      : 'bg-canvas text-ink-3 border-line hover:text-ink hover:border-line-2'">
                    {{ tag }}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between pt-4 border-t border-line gap-4">
          <label class="flex items-center gap-2 text-xs font-semibold text-ink-2 cursor-pointer select-none">
            <input type="checkbox" v-model="createDriveFolder"
              class="rounded border-line text-pri-strategic focus:ring-pri-strategic" />
            <span class="flex items-center gap-1.5">
              <HardDrive class="w-3.5 h-3.5 text-ink-3" /> Create Google Drive folder
            </span>
          </label>
          <div class="flex justify-end gap-3">
            <button @click="showAddModal = false" class="btn-ghost">Cancel</button>
            <button @click="createClient" class="btn-primary">Create Workspace</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
