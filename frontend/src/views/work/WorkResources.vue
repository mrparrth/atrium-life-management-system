<script setup>
import { computed, ref, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { useWorkResourcesStore } from '@/stores/workResources'
import { useWorkClientsStore } from '@/stores/workClients'
import { useUIStore } from '@/stores/ui'
import Combobox from '@/components/Combobox.vue'
import VInput from '@/components/VInput.vue'
import VTextarea from '@/components/VTextarea.vue'
import VSelect from '@/components/VSelect.vue'
import VUrlInput from '@/components/VUrlInput.vue'
import VRow from '@/components/VRow.vue'
import VCol from '@/components/VCol.vue'
import PageHeader from '@/components/PageHeader.vue'
import SectionHeader from '@/components/SectionHeader.vue'
import EmptyState from '@/components/EmptyState.vue'
import { Plus, Link as LinkIcon, Key, Eye, EyeOff, Copy, Trash, ExternalLink } from 'lucide-vue-next'

const resourcesStore = useWorkResourcesStore()
const clientsStore = useWorkClientsStore()
const ui = useUIStore()

const focusedFields = ref({})

const clientOptions = computed(() => {
  const activeClients = clientsStore.items.filter(c => c.status !== 'inactive')
  return [
    { key: '', label: 'Global Resource' },
    ...activeClients.map(c => ({ key: c.id, label: c.name }))
  ]
})

const typeOptions = [
  { key: 'url', label: 'Reference Link' },
  { key: 'credentials', label: 'Credentials / Login' }
]

function handleGlobalKeydown(e) {
  if (e.key === 'Escape') {
    showAddModal.value = false
  }
  if ((e.metaKey || e.ctrlKey) && e.key === '1') {
    if (!showAddModal.value) {
      e.preventDefault()
      showAddModal.value = true
      type.value = activeTab.value
    }
  }
  if (e.altKey && !e.metaKey && !e.ctrlKey && e.code?.startsWith('Digit')) {
    const idx = parseInt(e.code.replace('Digit', '')) - 1
    const TABS = ['url', 'credentials']
    if (idx >= 0 && idx < TABS.length) {
      e.preventDefault()
      activeTab.value = TABS[idx]
      return
    }
  }
  if (e.altKey && !e.metaKey && !e.ctrlKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
    const TABS = ['url', 'credentials']
    const currentIdx = TABS.indexOf(activeTab.value)
    if (currentIdx !== -1) {
      e.preventDefault()
      const step = e.key === 'ArrowUp' ? -1 : 1
      const nextIdx = (currentIdx + step + TABS.length) % TABS.length
      activeTab.value = TABS[nextIdx]
      return
    }
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleGlobalKeydown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleGlobalKeydown)
})

const activeTab = ref('url') // url, credentials
const clientFilter = ref('')

const showAddModal = ref(false)
const addModalFirstInput = ref(null)
watch(showAddModal, (open) => {
  if (open) {
    nextTick(() => {
      addModalFirstInput.value?.focus()
    })
  }
})
const title = ref('')
const type = ref('url')
const url = ref('')
const username = ref('')
const password = ref('')
const notes = ref('')
const clientId = ref('')

const revealedPasswords = ref({}) // tracks which credential IDs are visible

const filteredResources = computed(() => {
  let list = resourcesStore.items.filter(r => r.type === activeTab.value)
  if (clientFilter.value) {
    list = list.filter(r => r.clientId === clientFilter.value)
  }
  return list
})

function getClientName(cId) {
  const c = clientsStore.items.find(x => x.id === cId)
  return c ? c.name : 'Global'
}

async function createResource() {
  if (!title.value.trim()) return

  await resourcesStore.add({
    clientId: clientId.value,
    type: type.value,
    title: title.value.trim(),
    url: url.value.trim(),
    username: username.value.trim(),
    password: password.value.trim(),
    notes: notes.value.trim()
  })

  title.value = ''
  url.value = ''
  username.value = ''
  password.value = ''
  notes.value = ''
  clientId.value = ''
  showAddModal.value = false
  ui.showToast('Resource added to vault', 'success')
}

function copyToClipboard(text, msg = 'Copied') {
  navigator.clipboard.writeText(text)
  ui.showToast(msg, 'success')
}

function togglePassword(id) {
  revealedPasswords.value[id] = !revealedPasswords.value[id]
}

function deleteResource(id) {
  ui.confirm('Are you sure you want to delete this resource?').then(approved => {
    if (approved) {
      resourcesStore.remove(id)
      ui.showToast('Resource deleted', 'success')
    }
  })
}
</script>

<template>
  <div class="px-8 md:px-12 py-10 max-w-7xl mx-auto space-y-8 animate-fade-in" data-testid="work-resources">

    <!-- HEADER -->
    <PageHeader overline="Operations" title="Resource vault"
      sub="Store deployment credentials, project repositories, staging URLs, and templates safely.">
      <template #right>
        <button @click="showAddModal = true; type = activeTab" class="btn-primary">
          <Plus class="w-4 h-4" /> Add Resource <span class="kbd ml-1.5 !bg-canvas/20 !border-canvas/10 !text-canvas select-none">⌘1</span>
        </button>
      </template>
    </PageHeader>

    <!-- FILTER AND TABS -->
    <div class="flex flex-wrap items-center justify-between gap-4 border-b border-line pb-2">
      <!-- Tabs -->
      <div class="flex gap-6 text-sm font-medium">
        <button @click="activeTab = 'url'" class="pb-3 border-b-2 capitalize"
          :class="activeTab === 'url' ? 'border-ink text-ink font-semibold' : 'border-transparent text-ink-3 hover:text-ink-2'">
          Reference Links
        </button>
        <button @click="activeTab = 'credentials'" class="pb-3 border-b-2 capitalize"
          :class="activeTab === 'credentials' ? 'border-ink text-ink font-semibold' : 'border-transparent text-ink-3 hover:text-ink-2'">
          Credentials Vault
        </button>
      </div>

      <!-- Client filter dropdown -->
      <div class="w-48">
        <select v-model="clientFilter"
          class="w-full text-xs bg-surface border border-line rounded-lg px-2.5 py-1.5 text-ink-2 focus:outline-none">
          <option value="">All Workspaces</option>
          <option v-for="c in clientsStore.items" :key="c.id" :value="c.id">{{ c.name }}</option>
        </select>
      </div>
    </div>

    <!-- RESOURCES LIST -->
    <div class="space-y-4">
      <div v-if="filteredResources.length" class="grid grid-cols-1 md:grid-cols-2 gap-4">

        <!-- URL link card -->
        <div v-for="res in filteredResources" :key="res.id"
          class="card p-5 border bg-surface flex flex-col justify-between hover:border-line-2 transition-all duration-300">

          <div class="space-y-2">
            <div class="flex justify-between items-start">
              <span
                class="text-[9px] uppercase tracking-wider font-bold text-ink-3 bg-canvas border px-2 py-0.5 rounded">
                {{ getClientName(res.clientId) }}
              </span>
              <button @click="deleteResource(res.id)" class="text-ink-2 hover:text-pri-critical p-1 transition-colors shrink-0">
                <Trash class="w-3.5 h-3.5" />
              </button>
            </div>

            <div class="flex items-center gap-2 flex-wrap min-w-0">
              <h4 class="font-sans text-sm text-ink font-semibold truncate">
                {{ res.title }}
              </h4>
              <span v-if="res.type === 'credentials'" class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 select-none shrink-0">
                <Key class="w-2.5 h-2.5" /> Vault
              </span>
              <span v-else class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-teal-500/10 border border-teal-500/20 text-teal-600 dark:text-teal-400 select-none shrink-0">
                <LinkIcon class="w-2.5 h-2.5" /> Link
              </span>
            </div>

            <p v-if="res.notes" class="text-xs text-ink-2 leading-relaxed">{{ res.notes }}</p>

            <!-- Type Specific UI -->
            <div v-if="res.type === 'url'" class="pt-2">
              <a :href="res.url" target="_blank"
                class="text-xs font-mono text-pri-strategic hover:underline inline-flex items-center gap-1">
                {{ res.url }}
                <ExternalLink class="w-3 h-3" />
              </a>
            </div>

            <div v-else class="space-y-2.5 text-xs font-mono pt-1" @click.stop>
              <!-- URL Row -->
              <div v-if="res.url" class="flex items-center gap-4 text-xs font-mono pt-2.5 border-t border-line/50 first:border-t-0 first:pt-0">
                <span class="text-ink-2 font-semibold w-12 shrink-0 select-none text-[10px] tracking-wider">URL</span>
                <a :href="res.url" target="_blank"
                  class="text-pri-strategic hover:underline inline-flex items-center gap-1 truncate flex-1 min-w-0">
                  {{ res.url }}
                  <ExternalLink class="w-2.5 h-2.5 shrink-0" />
                </a>
              </div>

              <!-- USER Row -->
              <div class="flex items-center gap-4 text-xs font-mono pt-2.5 border-t border-line/50 first:border-t-0 first:pt-0">
                <span class="text-ink-2 font-semibold w-12 shrink-0 select-none text-[10px] tracking-wider">USER</span>
                <div class="flex items-center gap-1.5 min-w-0 flex-1">
                  <span class="text-ink font-semibold truncate">{{ res.username }}</span>
                  <button @click="copyToClipboard(res.username)" class="text-ink-2 hover:text-ink shrink-0">
                    <Copy class="w-3 h-3" />
                  </button>
                </div>
              </div>

              <!-- PASS Row -->
              <div class="flex items-center gap-4 text-xs font-mono pt-2.5 border-t border-line/50 first:border-t-0 first:pt-0">
                <span class="text-ink-2 font-semibold w-12 shrink-0 select-none text-[10px] tracking-wider">PASS</span>
                <div class="flex items-center gap-1.5 min-w-0 flex-1">
                  <span class="text-ink font-semibold truncate">
                    {{ revealedPasswords[res.id] ? res.password : '••••••••' }}
                  </span>
                  <button @click="togglePassword(res.id)" class="text-ink-2 hover:text-ink shrink-0">
                    <EyeOff v-if="revealedPasswords[res.id]" class="w-3.5 h-3.5" />
                    <Eye v-else class="w-3.5 h-3.5" />
                  </button>
                  <button @click="copyToClipboard(res.password)" class="text-ink-2 hover:text-ink shrink-0">
                    <Copy class="w-3 h-3" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

      </div>

      <EmptyState v-else title="Resource empty"
        hint="Create a new link or login reference inside this workspace context." />
    </div>

    <!-- ADD RESOURCE MODAL -->
    <div v-if="showAddModal" @keydown.window.esc="showAddModal = false"
      class="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div class="fixed inset-0 bg-ink/40 backdrop-blur-sm animate-fade-in" @click="showAddModal = false"></div>
      <div class="relative w-full max-w-lg card p-8 shadow-xl bg-surface z-50 animate-rise-in space-y-6"
        @keydown.meta.enter.prevent="createResource" @keydown.ctrl.enter.prevent="createResource">
        <div>
          <div class="overline">New Vault Resource</div>
          <h2 class="font-serif text-2xl mt-1">Add details</h2>
        </div>

        <VRow dense class="mb-4">
          <VCol cols="12" sm="6" dense>
            <VInput
              ref="addModalFirstInput"
              v-model="title"
              label="Resource Title *"
              id="resource-title"
              required
            />
          </VCol>

          <VCol cols="12" sm="6" dense>
            <VSelect
              v-model="type"
              label="Type"
              id="resource-type"
              :options="typeOptions"
              option-value="key"
              option-label="label"
            />
          </VCol>

          <VCol cols="12" sm="6" dense>
            <Combobox :options="clientOptions" v-model="clientId" label="Client Workspace" is-field />
          </VCol>

          <VCol cols="12" sm="6" dense>
            <VUrlInput
              v-model="url"
              label="URL"
              id="resource-url"
            />
          </VCol>

          <template v-if="type === 'credentials'">
            <VCol cols="12" sm="6" dense>
              <VInput
                v-model="username"
                label="Username / Key"
                id="resource-username"
              />
            </VCol>
            <VCol cols="12" sm="6" dense>
              <VInput
                v-model="password"
                label="Password / Secret"
                id="resource-password"
                mono
              />
            </VCol>
          </template>

          <VCol cols="12" dense>
            <VTextarea
              v-model="notes"
              label="Notes / Description"
              id="resource-notes"
              :rows="3"
            />
          </VCol>
        </VRow>

        <div class="flex justify-end gap-3 pt-2">
          <button @click="showAddModal = false" class="btn-ghost">Cancel</button>
          <button @click="createResource" class="btn-primary">
            Add to Vault <span class="kbd !bg-canvas/20 !border-canvas/10 !text-canvas select-none text-[9px] ml-1">⌘Enter</span>
          </button>
        </div>
      </div>
    </div>

  </div>
</template>
