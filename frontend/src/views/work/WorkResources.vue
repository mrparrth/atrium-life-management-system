<script setup>
import { computed, ref, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { useWorkResourcesStore } from '@/stores/workResources'
import { useWorkClientsStore } from '@/stores/workClients'
import { useUIStore } from '@/stores/ui'
import Combobox from '@/components/Combobox.vue'
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
              <button @click="deleteResource(res.id)" class="text-ink-3 hover:text-pri-critical p-1">
                <Trash class="w-3.5 h-3.5" />
              </button>
            </div>

            <h4 class="font-serif text-base text-ink font-semibold flex items-center gap-1.5">
              <component :is="res.type === 'url' ? LinkIcon : Key" class="w-4 h-4 text-ink-3 shrink-0" />
              {{ res.title }}
            </h4>

            <p v-if="res.notes" class="text-xs text-ink-2 leading-relaxed">{{ res.notes }}</p>

            <!-- Type Specific UI -->
            <div v-if="res.type === 'url'" class="pt-2">
              <a :href="res.url" target="_blank"
                class="text-xs font-mono text-pri-strategic hover:underline inline-flex items-center gap-1">
                {{ res.url }}
                <ExternalLink class="w-3 h-3" />
              </a>
            </div>

            <div v-else class="space-y-2 pt-2 text-xs font-mono bg-canvas/40 p-3 rounded-xl border border-line">
              <div v-if="res.url" class="pb-1.5 mb-1.5 border-b border-line/40 flex justify-between items-center">
                <span class="text-ink-3 text-[10px]">URL</span>
                <a :href="res.url" target="_blank"
                  class="text-pri-strategic hover:underline inline-flex items-center gap-1 truncate max-w-[200px]">
                  {{ res.url }}
                  <ExternalLink class="w-2.5 h-2.5" />
                </a>
              </div>
              <div class="flex justify-between items-center">
                <span class="text-ink-3 text-[10px]">USER</span>
                <div class="flex items-center gap-1.5">
                  <span class="text-ink font-semibold">{{ res.username }}</span>
                  <button @click="copyToClipboard(res.username)" class="text-ink-3 hover:text-ink">
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
                  <button @click="togglePassword(res.id)" class="text-ink-3 hover:text-ink">
                    <EyeOff v-if="revealedPasswords[res.id]" class="w-3.5 h-3.5" />
                    <Eye v-else class="w-3.5 h-3.5" />
                  </button>
                  <button @click="copyToClipboard(res.password)" class="text-ink-3 hover:text-ink">
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

        <div class="space-y-4 pt-2">
          <div class="grid grid-cols-2 gap-4">
            <div class="v-field-group">
              <input ref="addModalFirstInput" v-model="title" placeholder=" " class="v-field-input" id="resource-title" required />
              <label for="resource-title" class="v-field-label">Resource Title *</label>
            </div>
            <div class="v-field-group">
              <select v-model="type" @focus="focusedFields.type = true" @blur="focusedFields.type = false" class="v-field-select">
                <option value="url">Reference Link</option>
                <option value="credentials">Credentials / Login</option>
              </select>
              <span class="v-field-arrow">▼</span>
              <label :class="['v-field-label', (type || focusedFields.type) ? 'v-field-label--floating' : '', focusedFields.type ? 'v-field-label--floating-focused' : '']">Type</label>
            </div>
          </div>

          <div class="grid grid-cols-2 gap-4">
            <Combobox :options="clientOptions" v-model="clientId" label="Client Workspace" is-field />
            <div class="v-field-group">
              <input v-model="url" placeholder=" " class="v-field-input" id="resource-url" />
              <label for="resource-url" class="v-field-label">URL</label>
            </div>
          </div>

          <div v-if="type === 'credentials'" class="grid grid-cols-2 gap-4">
            <div class="v-field-group">
              <input v-model="username" placeholder=" " class="v-field-input" id="resource-username" />
              <label for="resource-username" class="v-field-label">Username / Key</label>
            </div>
            <div class="v-field-group">
              <input type="text" v-model="password" placeholder=" " class="v-field-input font-mono" id="resource-password" />
              <label for="resource-password" class="v-field-label">Password / Secret</label>
            </div>
          </div>

          <div class="v-field-group">
            <textarea v-model="notes" placeholder=" " class="v-field-input min-h-[80px] resize-none" id="resource-notes"></textarea>
            <label for="resource-notes" class="v-field-label">Notes / Description</label>
          </div>
        </div>

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
