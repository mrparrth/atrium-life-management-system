<script setup>
import { computed, ref, watch, onMounted, onUnmounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useWorkClientsStore } from '@/stores/workClients'
import { useWorkItemsStore } from '@/stores/workItems'
import { useUIStore } from '@/stores/ui'
import { useSettingsStore } from '@/stores/settings'
import PageHeader from '@/components/PageHeader.vue'
import EmptyState from '@/components/EmptyState.vue'
import ClientPopup from '@/components/work/ClientPopup.vue'
import {
  Plus, User, MessageSquare, Star, Search, LayoutGrid, List,
  SlidersHorizontal
} from 'lucide-vue-next'
import dayjs from 'dayjs'

const router = useRouter()
const clientsStore = useWorkClientsStore()
const ui = useUIStore()
const settings = useSettingsStore()

const showAddModal = ref(false)

const route = useRoute()
const prefillName = ref('')

watch(() => route.query.new, (newVal) => {
  if (newVal === 'true') {
    prefillName.value = route.query.prefillName ? String(route.query.prefillName) : ''
    showAddModal.value = true
    router.replace({ query: { ...route.query, new: undefined, prefillName: undefined } })
  }
}, { immediate: true })

watch(showAddModal, (isOpen) => {
  if (!isOpen) {
    prefillName.value = ''
  }
})

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

const itemsStore = useWorkItemsStore()

function handleGlobalKeydown(e) {
  if (e.key === 'Escape') {
    showAddModal.value = false
  }
}

onMounted(async () => {
  await clientsStore.load()
  await itemsStore.load()
  await settings.load()
  viewMode.value = settings.get('clientsViewMode', 'grid')
  sortBy.value = settings.get('clientsSortBy', 'updatedAt')
  statusFilters.value = settings.get('clientsStatusFilters', ['important', 'normal', 'recently_active', 'prospect'])
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

function getClientRating(client) {
  const clientItems = itemsStore.items.filter(item => item.clientId === client.id)
  const ratedItems = clientItems.filter(item => item.rating && item.rating > 0)
  if (ratedItems.length === 0) return 0
  const totalRating = ratedItems.reduce((sum, item) => sum + item.rating, 0)
  return Number((totalRating / ratedItems.length).toFixed(1))
}

const COMPLETED_STATUSES = ['done', 'completed', 'complete', 'dropped']

function getClientTaskCounts(client) {
  const clientItems = itemsStore.items.filter(item => item.clientId === client.id)
  const completed = clientItems.filter(item => COMPLETED_STATUSES.includes(item.status)).length
  const active = clientItems.length - completed
  return { active, completed, total: clientItems.length }
}

const searchQuery = ref('')
const sortBy = ref('updatedAt')
const viewMode = ref('grid') // 'grid' | 'list' — loaded from DB on mount

// Multi-select status filtering
const statusFilters = ref(['important', 'normal', 'recently_active', 'prospect'])
const showStatusFilterDropdown = ref(false)

const isAllSelected = computed(() => {
  return statusFilters.value.length === Object.keys(clientsStore.STATUS_MAP).length
})

function toggleAllStatuses() {
  if (isAllSelected.value) {
    statusFilters.value = []
  } else {
    statusFilters.value = Object.keys(clientsStore.STATUS_MAP)
  }
}

function toggleStatusFilter(key) {
  const idx = statusFilters.value.indexOf(key)
  if (idx > -1) {
    statusFilters.value.splice(idx, 1)
  } else {
    statusFilters.value.push(key)
  }
}

const selectedStatusLabel = computed(() => {
  const len = statusFilters.value.length
  const total = Object.keys(clientsStore.STATUS_MAP).length
  if (len === total) return 'All Statuses'
  if (len === 0) return 'None Selected'
  if (len === 1) return clientsStore.STATUS_MAP[statusFilters.value[0]]?.label || statusFilters.value[0]
  return `${len} Selected`
})

// Settings Watchers
watch(sortBy, async (newVal) => {
  await settings.set('clientsSortBy', newVal)
})

watch(statusFilters, async (newVal) => {
  await settings.set('clientsStatusFilters', newVal)
}, { deep: true })

const filteredClients = computed(() => {
  let list = [...clientsStore.items]

  // Apply search
  if (searchQuery.value.trim()) {
    const q = searchQuery.value.toLowerCase().trim()
    list = list.filter(c => c.name.toLowerCase().includes(q) || (c.companyName && c.companyName.toLowerCase().includes(q)))
  }

  // Apply status filters
  list = list.filter(c => {
    const s = c.status === 'active' ? 'normal' : (c.status || 'normal')
    return statusFilters.value.includes(s)
  })

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
      return getClientRating(b) - getClientRating(a)
    }
    return 0
  })

  return list
})

const handleKeyDown = (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key === '1') {
    e.preventDefault()
    showAddModal.value = true
  }
}

function handleClientSaved(created) {
  if (created && created.id && !created.deleted) {
    router.push(`/work/clients/${created.id}`)
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleKeyDown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeyDown)
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
        <div class="flex items-center gap-1.5 relative">
          <span class="text-xs text-ink-3 font-medium hidden sm:inline">Statuses:</span>
          <button type="button" @click.stop="showStatusFilterDropdown = !showStatusFilterDropdown"
            class="bg-canvas border border-line rounded-xl px-3 py-1.5 text-xs text-ink-2 font-semibold flex items-center gap-1.5 focus:outline-none hover:bg-canvas/60 transition-all cursor-pointer">
            <span class="text-pri-strategic font-bold">
              {{ selectedStatusLabel }}
            </span>
            <span class="text-[8px] text-ink-3">▼</span>
          </button>

          <!-- Dropdown Backdrop -->
          <div v-if="showStatusFilterDropdown" class="fixed inset-0 z-40"
            @click.stop="showStatusFilterDropdown = false">
          </div>

          <!-- Dropdown Content -->
          <div v-if="showStatusFilterDropdown"
            class="absolute right-0 top-full mt-1.5 w-56 bg-surface border border-line rounded-xl shadow-lg z-50 p-2 space-y-1 animate-fade-in">
            <label
              class="flex items-center gap-2 px-2 py-1.5 hover:bg-canvas/50 rounded-lg cursor-pointer text-xs font-semibold text-ink select-none">
              <input type="checkbox" :checked="isAllSelected" @change="toggleAllStatuses"
                class="rounded border-line text-pri-strategic focus:ring-pri-strategic/20 cursor-pointer" />
              <span>All Statuses</span>
            </label>
            <hr class="border-line/45 my-1" />
            <label v-for="(val, key) in clientsStore.STATUS_MAP" :key="key"
              class="flex items-center gap-2 px-2 py-1.5 hover:bg-canvas/50 rounded-lg cursor-pointer text-xs text-ink-2 select-none">
              <input type="checkbox" :checked="statusFilters.includes(key)" @change="toggleStatusFilter(key)"
                class="rounded border-line text-pri-strategic focus:ring-pri-strategic/20 cursor-pointer" />
              <span class="px-1.5 py-0.5 rounded text-[10px] font-bold border shrink-0" :class="val.color">
                {{ val.label }}
              </span>
            </label>
          </div>
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
          <button @click="viewMode = 'grid'; settings.set('clientsViewMode', 'grid')"
            class="p-1.5 rounded-lg transition-all"
            :class="viewMode === 'grid' ? 'bg-surface shadow-sm text-pri-strategic' : 'text-ink-3 hover:text-ink'">
            <LayoutGrid class="w-4 h-4" />
          </button>
          <button @click="viewMode = 'list'; settings.set('clientsViewMode', 'list')"
            class="p-1.5 rounded-lg transition-all"
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
            class="card p-4 border border-line/60 hover:border-line cursor-pointer transition-all duration-200 flex flex-col justify-between group hover:shadow-md hover:-translate-y-px"
            :class="client.status === 'important' ? 'border-l-2 border-l-emerald-500/50' : ''">
            <div>
              <div class="flex items-center justify-between gap-2 mb-1.5">
                <span class="text-[10px] uppercase tracking-overline text-ink-3 flex items-center gap-1">
                  <User class="w-3 h-3 text-ink-2" /> {{ client.clientSource || '' }}
                </span>
                <div class="flex items-center gap-1.5">
                  <span v-if="getClientRating(client)"
                    class="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-600 border border-amber-500/20 flex items-center gap-0.5 shrink-0">
                    <Star class="w-2.5 h-2.5 fill-current" /> {{ getClientRating(client) }}
                  </span>
                  <span class="text-[9px] uppercase tracking-overline font-bold px-2 py-0.5 rounded border shrink-0"
                    :class="clientsStore.getStatusStyle(client.status).color">
                    {{ clientsStore.getStatusStyle(client.status).label }}
                  </span>
                </div>
              </div>

              <h3
                class="font-serif text-base font-semibold text-ink group-hover:text-ink transition-colors flex items-center justify-between gap-3">
                <span class="flex items-center gap-1.5 flex-wrap leading-snug">
                  {{ client.name }}
                </span>
                <span class="font-extrabold text-emerald-600 dark:text-emerald-400 font-mono text-sm shrink-0"
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

            <div class="mt-3 pt-2.5 border-t border-line/30 flex items-center justify-between gap-2">
              <span class="flex items-center gap-1 text-ink-2 min-w-0">
                <MessageSquare class="w-3 h-3 text-ink-2 shrink-0" />
                <span class="text-[10px] text-ink-3 truncate">{{ client.timezone }}</span>
                <span v-if="getClientLocalTime(client.timezone)"
                  class="text-[10px] text-pri-strategic font-semibold shrink-0">
                  ({{ getClientLocalTime(client.timezone) }})
                </span>
              </span>
              <!-- Task Counts -->
              <span class="flex items-center gap-1 shrink-0">
                <span v-if="getClientTaskCounts(client).active > 0"
                  class="inline-flex items-center gap-0.5 text-[9px] font-semibold px-1.5 py-0.5 rounded border bg-blue-500/8 text-blue-500/80 border-blue-500/15">
                  <span class="w-1 h-1 rounded-full bg-blue-400/70 inline-block"></span>
                  {{ getClientTaskCounts(client).active }} active
                </span>
                <span v-if="getClientTaskCounts(client).completed > 0"
                  class="inline-flex items-center gap-0.5 text-[9px] font-semibold px-1.5 py-0.5 rounded border bg-emerald-500/8 text-emerald-600/70 border-emerald-500/15">
                  <span class="w-1 h-1 rounded-full bg-emerald-400/70 inline-block"></span>
                  {{ getClientTaskCounts(client).completed }} done
                </span>
                <span v-if="getClientTaskCounts(client).total === 0" class="text-[9px] text-ink-3/60 italic">no tasks</span>
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
                <th class="p-4">Tasks</th>
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
                  <span v-if="getClientRating(client)"
                    class="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-600 border border-amber-500/20 flex items-center gap-0.5 shrink-0 animate-fade-in">
                    <Star class="w-2.5 h-2.5 fill-current" /> {{ getClientRating(client) }}
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
                <td class="p-4">
                  <span class="flex items-center gap-1.5">
                    <span v-if="getClientTaskCounts(client).active > 0"
                      class="inline-flex items-center gap-0.5 text-[9px] font-bold px-1.5 py-0.5 rounded border bg-blue-500/10 text-blue-600 border-blue-500/20">
                      <span class="w-1.5 h-1.5 rounded-full bg-blue-500 inline-block"></span>
                      {{ getClientTaskCounts(client).active }}
                    </span>
                    <span v-if="getClientTaskCounts(client).completed > 0"
                      class="inline-flex items-center gap-0.5 text-[9px] font-bold px-1.5 py-0.5 rounded border bg-emerald-500/10 text-emerald-600 border-emerald-500/20">
                      <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block"></span>
                      {{ getClientTaskCounts(client).completed }}
                    </span>
                    <span v-if="getClientTaskCounts(client).total === 0" class="text-[9px] text-ink-3">—</span>
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

    <!-- CREATE CLIENT POPUP -->
    <ClientPopup v-if="showAddModal" :prefillName="prefillName" @close="showAddModal = false" @saved="handleClientSaved" />
  </div>
</template>
