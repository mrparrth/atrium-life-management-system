<script setup>
import { computed, ref } from 'vue'
import { useWorkResourcesStore } from '@/stores/workResources'
import { useWorkClientsStore } from '@/stores/workClients'
import { useUIStore } from '@/stores/ui'
import PageHeader from '@/components/PageHeader.vue'
import SectionHeader from '@/components/SectionHeader.vue'
import EmptyState from '@/components/EmptyState.vue'
import { Plus, Link as LinkIcon, Key, Eye, EyeOff, Copy, Trash, ExternalLink } from 'lucide-vue-next'

const resourcesStore = useWorkResourcesStore()
const clientsStore = useWorkClientsStore()
const ui = useUIStore()

const activeTab = ref('url') // url, credentials
const clientFilter = ref('')

const showAddModal = ref(false)
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
  <div class="px-8 md:px-12 py-10 max-w-5xl mx-auto space-y-8 animate-fade-in" data-testid="work-resources">
    
    <!-- HEADER -->
    <PageHeader overline="Operations" title="Resource vault" sub="Store deployment credentials, project repositories, staging URLs, and templates safely.">
      <template #right>
        <button @click="showAddModal = true; type = activeTab" class="btn-primary">
          <Plus class="w-4 h-4" /> Add Resource
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
        <select v-model="clientFilter" class="w-full text-xs bg-surface border border-line rounded-lg px-2.5 py-1.5 text-ink-2 focus:outline-none">
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
              <span class="text-[9px] uppercase tracking-wider font-bold text-ink-3 bg-canvas border px-2 py-0.5 rounded">
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
              <a :href="res.url" target="_blank" class="text-xs font-mono text-pri-strategic hover:underline inline-flex items-center gap-1">
                {{ res.url }} <ExternalLink class="w-3 h-3" />
              </a>
            </div>

            <div v-else class="space-y-2 pt-2 text-xs font-mono bg-canvas/40 p-3 rounded-xl border border-line">
              <div v-if="res.url" class="pb-1.5 mb-1.5 border-b border-line/40 flex justify-between items-center">
                <span class="text-ink-3 text-[10px]">URL</span>
                <a :href="res.url" target="_blank" class="text-pri-strategic hover:underline inline-flex items-center gap-1 truncate max-w-[200px]">
                  {{ res.url }} <ExternalLink class="w-2.5 h-2.5" />
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

      <EmptyState v-else title="Resource empty" hint="Create a new link or login reference inside this workspace context." />
    </div>

    <!-- ADD RESOURCE MODAL -->
    <div v-if="showAddModal" @keydown.window.esc="showAddModal = false" class="fixed inset-0 z-40 flex items-start justify-center pt-24 px-4">
      <div class="fixed inset-0 bg-ink/40 backdrop-blur-sm" @click="showAddModal = false"></div>
      <div class="relative w-full max-w-lg card p-8 shadow-xl bg-surface z-50 animate-rise-in space-y-6">
        <div>
          <div class="overline">New Vault Resource</div>
          <h2 class="font-serif text-2xl mt-1">Add details</h2>
        </div>

        <div class="space-y-4">
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-xs font-semibold text-ink-2 mb-1">Resource Title</label>
              <input v-model="title" placeholder="e.g. AWS Dashboard or Git Repo" class="input-block text-sm" />
            </div>
            <div>
              <label class="block text-xs font-semibold text-ink-2 mb-1">Type</label>
              <select v-model="type" class="input-block text-sm">
                <option value="url">Reference Link</option>
                <option value="credentials">Credentials / Login</option>
              </select>
            </div>
          </div>

          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-xs font-semibold text-ink-2 mb-1">Client Workspace</label>
              <select v-model="clientId" class="input-block text-sm">
                <option value="">Global Resource</option>
                <option v-for="c in clientsStore.items" :key="c.id" :value="c.id">{{ c.name }}</option>
              </select>
            </div>
            <div>
              <label class="block text-xs font-semibold text-ink-2 mb-1">URL</label>
              <input v-model="url" placeholder="https://..." class="input-block text-sm" />
            </div>
          </div>

          <div v-if="type === 'credentials'" class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-xs font-semibold text-ink-2 mb-1">Username / Key</label>
              <input v-model="username" placeholder="e.g. admin or api-key" class="input-block text-sm" />
            </div>
            <div>
              <label class="block text-xs font-semibold text-ink-2 mb-1">Password / Secret</label>
              <input type="text" v-model="password" placeholder="••••••••" class="input-block text-sm font-mono" />
            </div>
          </div>

          <div>
            <label class="block text-xs font-semibold text-ink-2 mb-1">Notes / Description</label>
            <textarea v-model="notes" rows="3" placeholder="Server details, port settings, notes..." class="input-block text-sm resize-none"></textarea>
          </div>
        </div>

        <div class="flex justify-end gap-3 pt-2">
          <button @click="showAddModal = false" class="btn-ghost">Cancel</button>
          <button @click="createResource" class="btn-primary">Add to Vault</button>
        </div>
      </div>
    </div>

  </div>
</template>
