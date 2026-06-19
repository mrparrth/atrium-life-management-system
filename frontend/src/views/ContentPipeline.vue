<script setup>
import { ref, computed, onMounted } from 'vue'
import { usePipelineStore } from '@/stores/pipeline'
import { useNotesStore } from '@/stores/notes'
import { useUIStore } from '@/stores/ui'
import PageHeader from '@/components/PageHeader.vue'
import EmptyState from '@/components/EmptyState.vue'
import { Plus, X, Search, GitFork, ArrowUpRight, Check, Trash2, Calendar, Link } from 'lucide-vue-next'

const pipelineStore = usePipelineStore()
const notesStore = useNotesStore()
const ui = useUIStore()

const showModal = ref(false)
const editingItem = ref(null)

// Form fields
const form = ref({
  title: '',
  status: 'idea',
  pillar: 'Design',
  type: 'Growth',
  platform: 'LinkedIn',
  publishDate: '',
  noteId: '',
  snippet: '',
  url: ''
})

const pillars = ['Design', 'Freelance', 'Development', 'Career', 'Reflection', 'Marketing']
const postTypes = ['Growth', 'Authority', 'Connection', 'Conversion']
const statuses = [
  { value: 'idea', label: 'Inbox/Idea' },
  { value: 'active', label: 'Active Draft' },
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'published', label: 'Published' },
  { value: 'dropped', label: 'Dropped' }
]
const platforms = ['LinkedIn', 'X', 'Threads', 'Instagram', 'Upwork', 'Medium', 'YouTube']

onMounted(async () => {
  await pipelineStore.load()
  await notesStore.load()
})

// Search query
const q = ref('')

const filteredItems = computed(() => {
  const query = q.value.trim().toLowerCase()
  if (!query) return pipelineStore.items
  return pipelineStore.items.filter(item => 
    item.title.toLowerCase().includes(query) ||
    (item.snippet || '').toLowerCase().includes(query) ||
    item.pillar.toLowerCase().includes(query) ||
    item.type.toLowerCase().includes(query)
  )
})

// Grouped items
const groupedItems = computed(() => {
  const groups = {
    idea: [],
    active: [],
    scheduled: [],
    published: [],
    dropped: []
  }
  filteredItems.value.forEach(item => {
    if (groups[item.status]) {
      groups[item.status].push(item)
    } else {
      groups.idea.push(item)
    }
  })
  return groups
})

// Distribution stats
const stats = computed(() => {
  const counts = { Growth: 0, Authority: 0, Connection: 0, Conversion: 0 }
  pipelineStore.items.forEach(item => {
    if (counts[item.type] !== undefined && item.status !== 'dropped') {
      counts[item.type]++
    }
  })
  return counts
})

// Notes lookup
const notesList = computed(() => notesStore.items)
function getNoteTitle(noteId) {
  const note = notesStore.items.find(n => n.id === noteId)
  return note ? note.title : 'Unknown Note'
}

function openAddModal() {
  editingItem.value = null
  form.value = {
    title: '',
    status: 'idea',
    pillar: 'Design',
    type: 'Growth',
    platform: 'LinkedIn',
    publishDate: '',
    noteId: '',
    snippet: '',
    url: ''
  }
  showModal.value = true
}

function openEditModal(item) {
  editingItem.value = item
  form.value = { ...item }
  showModal.value = true
}

async function save() {
  if (!form.value.title.trim()) return
  if (editingItem.value) {
    await pipelineStore.update(editingItem.value.id, form.value)
  } else {
    await pipelineStore.add(form.value)
  }
  showModal.value = false
}

async function removeItem(id) {
  const confirmed = await ui.confirm({
    title: 'Delete Plan?',
    message: 'Are you sure you want to delete this plan?'
  })
  if (confirmed) {
    await pipelineStore.remove(id)
  }
}
</script>

<template>
  <div class="px-8 md:px-12 py-10 max-w-7xl mx-auto" data-testid="pipeline-view">
    <PageHeader overline="Horizon" title="Content Pipeline" sub="Design your creator output, track strategy distribution, and plan posts.">
      <template #right>
        <button class="btn-primary" @click="openAddModal" data-testid="add-pipeline-btn">
          <Plus class="w-4 h-4" /> New Plan
        </button>
      </template>
    </PageHeader>

    <!-- Strategy Distribution Indicators -->
    <div class="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
      <div v-for="type in postTypes" :key="type" class="card p-5 relative overflow-hidden flex flex-col justify-between">
        <div>
          <span class="text-xs font-semibold tracking-overline uppercase text-ink-3">{{ type }}</span>
          <div class="font-serif text-3xl mt-1.5 font-bold" data-testid="stat-count">{{ stats[type] }}</div>
        </div>
        <div class="mt-4 text-[11px] text-ink-3">
          <span v-if="type === 'Growth'">Reach & audience acquisition</span>
          <span v-else-if="type === 'Authority'">Niche expertise & templates</span>
          <span v-else-if="type === 'Connection'">Personal stories & vulnerability</span>
          <span v-else-if="type === 'Conversion'">Offerings, bookings & CTA</span>
        </div>
      </div>
    </div>

    <!-- Search filter -->
    <div class="card px-4 py-2.5 mb-8 flex items-center gap-3">
      <Search class="w-4 h-4 text-ink-3" />
      <input v-model="q" class="bg-transparent outline-none flex-1 text-sm" placeholder="Filter pipeline by title, pillar, type…" />
    </div>

    <!-- Lists Grouped by Status -->
    <div class="space-y-10">
      <div v-for="statusOpt in statuses" :key="statusOpt.value">
        <div v-if="groupedItems[statusOpt.value]?.length" class="space-y-3">
          <h3 class="text-sm font-semibold uppercase tracking-wider text-ink-3 flex items-center gap-2">
            <span>{{ statusOpt.label }}</span>
            <span class="px-2 py-0.5 rounded-full bg-surface text-xs border border-line text-ink-2">
              {{ groupedItems[statusOpt.value].length }}
            </span>
          </h3>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div v-for="item in groupedItems[statusOpt.value]" :key="item.id" 
              class="card p-5 hover:border-line-2 transition-all duration-300 flex flex-col justify-between"
              @click="openEditModal(item)">
              <div>
                <div class="flex items-start justify-between gap-2">
                  <div class="flex flex-wrap gap-1.5">
                    <span class="text-[10px] px-2 py-0.5 rounded-full bg-surface font-medium border border-line text-ink-2">
                      {{ item.pillar }}
                    </span>
                    <span class="text-[10px] px-2 py-0.5 rounded-full bg-pri-strategic/10 font-medium text-pri-strategic">
                      {{ item.type }}
                    </span>
                    <span class="text-[10px] px-2 py-0.5 rounded-full bg-ink/5 font-medium text-ink-2">
                      {{ item.platform }}
                    </span>
                  </div>
                  <button @click.stop="removeItem(item.id)" class="text-ink-3 hover:text-pri-interruptive transition-colors p-1" title="Delete plan">
                    <Trash2 class="w-3.5 h-3.5" />
                  </button>
                </div>

                <div class="font-serif text-lg mt-3 font-semibold">{{ item.title }}</div>
                <p v-if="item.snippet" class="text-xs text-ink-2 mt-2 line-clamp-2">{{ item.snippet }}</p>
              </div>

              <!-- Meta Footer -->
              <div class="mt-5 pt-3 border-t border-line flex flex-wrap items-center justify-between gap-3 text-[11px] text-ink-3">
                <div class="flex items-center gap-1.5">
                  <Calendar class="w-3 h-3" />
                  <span>{{ item.publishDate || 'No date set' }}</span>
                </div>
                <div class="flex items-center gap-3">
                  <RouterLink v-if="item.noteId" :to="`/notes/${item.noteId}`" @click.stop class="flex items-center gap-1 hover:text-ink transition-colors">
                    <Link class="w-3 h-3" />
                    <span>{{ getNoteTitle(item.noteId) }}</span>
                  </RouterLink>
                  <a v-if="item.url" :href="item.url" target="_blank" @click.stop class="flex items-center gap-1 hover:text-ink transition-colors">
                    <ArrowUpRight class="w-3 h-3" />
                    <span>Reference</span>
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <EmptyState v-if="!filteredItems.length" title="No pipeline ideas" hint="Start drafting your creative pipeline using custom pillars and tactics." />
    </div>

    <!-- Modal Form (Create/Edit) -->
    <div v-if="showModal" @keydown.window.esc="showModal = false" class="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div class="fixed inset-0 bg-ink/40 backdrop-blur-sm animate-fade-in" @click="showModal = false"></div>
      <form @submit.prevent="save" class="relative w-full max-w-xl card p-8 animate-rise-in max-h-[90vh] overflow-y-auto">
        <button type="button" class="absolute top-4 right-4 btn-ghost !p-1.5" @click="showModal = false">
          <X class="w-4 h-4" />
        </button>
        <div class="overline">{{ editingItem ? 'Modify Plan' : 'Add Content Plan' }}</div>
        <h2 class="font-serif text-2xl mt-1 mb-5">{{ editingItem ? 'Update details' : 'Draft new concept' }}</h2>

        <div class="v-field-group mb-4">
          <input v-model="form.title" placeholder=" " class="v-field-input text-base font-semibold" id="plan-title" required />
          <label for="plan-title" class="v-field-label text-sm">Post Title / Hook *</label>
        </div>

        <div class="grid grid-cols-2 gap-4 mb-4">
          <div>
            <label class="block text-xs uppercase tracking-wider text-ink-3 mb-1.5">Topic Pillar</label>
            <select v-model="form.pillar" class="w-full bg-surface border border-line rounded-lg px-3 py-2 text-sm">
              <option v-for="p in pillars" :key="p" :value="p">{{ p }}</option>
            </select>
          </div>
          <div>
            <label class="block text-xs uppercase tracking-wider text-ink-3 mb-1.5">Post Strategy Type</label>
            <select v-model="form.type" class="w-full bg-surface border border-line rounded-lg px-3 py-2 text-sm">
              <option v-for="t in postTypes" :key="t" :value="t">{{ t }}</option>
            </select>
          </div>
        </div>

        <div class="grid grid-cols-2 gap-4 mb-4">
          <div>
            <label class="block text-xs uppercase tracking-wider text-ink-3 mb-1.5">Target Platform</label>
            <select v-model="form.platform" class="w-full bg-surface border border-line rounded-lg px-3 py-2 text-sm">
              <option v-for="p in platforms" :key="p" :value="p">{{ p }}</option>
            </select>
          </div>
          <div>
            <label class="block text-xs uppercase tracking-wider text-ink-3 mb-1.5">Status</label>
            <select v-model="form.status" class="w-full bg-surface border border-line rounded-lg px-3 py-2 text-sm">
              <option v-for="s in statuses" :key="s.value" :value="s.value">{{ s.label }}</option>
            </select>
          </div>
        </div>

        <div class="grid grid-cols-2 gap-4 mb-4">
          <div>
            <label class="block text-xs uppercase tracking-wider text-ink-3 mb-1.5">Target Publish Date</label>
            <input type="date" v-model="form.publishDate" class="w-full bg-surface border border-line rounded-lg px-3 py-2 text-sm" />
          </div>
          <div>
            <label class="block text-xs uppercase tracking-wider text-ink-3 mb-1.5">Linked Note</label>
            <select v-model="form.noteId" class="w-full bg-surface border border-line rounded-lg px-3 py-2 text-sm">
              <option value="">No note linked</option>
              <option v-for="n in notesList" :key="n.id" :value="n.id">{{ n.title }}</option>
            </select>
          </div>
        </div>

        <div class="v-field-group mb-4">
          <textarea v-model="form.snippet" placeholder=" " rows="3" class="v-field-input py-2 resize-none font-sans text-xs leading-relaxed" id="plan-snippet" />
          <label for="plan-snippet" class="v-field-label text-sm">Hook Snippet / Outline / Rationale</label>
        </div>

        <div class="v-field-group mb-6">
          <input v-model="form.url" placeholder=" " class="v-field-input text-xs" id="plan-url" />
          <label for="plan-url" class="v-field-label text-sm">Reference Link / URL</label>
        </div>

        <div class="flex justify-end gap-2">
          <button type="button" class="btn-ghost" @click="showModal = false">Cancel</button>
          <button type="submit" class="btn-primary">Save changes</button>
        </div>
      </form>
    </div>
  </div>
</template>
