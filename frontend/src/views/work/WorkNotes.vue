<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useWorkNotesStore } from '@/stores/workNotes'
import { useWorkClientsStore } from '@/stores/workClients'
import { useUIStore } from '@/stores/ui'
import PageHeader from '@/components/PageHeader.vue'
import EmptyState from '@/components/EmptyState.vue'
import { Plus, Trash, Search, FileText, Check, Save, CornerDownLeft, Sparkles, Archive, HelpCircle, Edit3, Eye, BookmarkPlus } from 'lucide-vue-next'
import dayjs from 'dayjs'
import { marked } from 'marked'
import MarkdownHelpModal from '@/components/MarkdownHelpModal.vue'
import TiptapEditor from '@/components/TiptapEditor.vue'

const route = useRoute()
const router = useRouter()
const notesStore = useWorkNotesStore()
const clientsStore = useWorkClientsStore()
const ui = useUIStore()

const q = ref('')
const selectedNoteId = ref(null)
const editTitle = ref('')
const editBody = ref('')
const editClientId = ref('')
const isEditing = ref(false)
const showMarkdownHelp = ref(false)

const clientFilter = ref('')
const showBackburner = ref(false)
const customTemplates = ref([])

function loadCustomTemplates() {
  try {
    const raw = localStorage.getItem('atrium.custom_work_templates')
    customTemplates.value = raw ? JSON.parse(raw) : []
  } catch (e) {
    customTemplates.value = []
  }
}

function saveAsCustomTemplate() {
  if (!activeNote.value) return
  const titleVal = (editTitle.value || activeNote.value.title || 'Untitled Template').trim()
  const bodyVal = editBody.value || activeNote.value.body || ''

  if (!titleVal) return

  const newTpl = {
    id: `custom_${Date.now()}`,
    title: titleVal,
    body: bodyVal
  }

  const existingIdx = customTemplates.value.findIndex(t => t.title.toLowerCase() === titleVal.toLowerCase())
  if (existingIdx > -1) {
    customTemplates.value[existingIdx] = newTpl
  } else {
    customTemplates.value.push(newTpl)
  }

  localStorage.setItem('atrium.custom_work_templates', JSON.stringify(customTemplates.value))
  ui.showToast(`Saved "${titleVal}" as custom template`, 'success')
}

const activeClients = computed(() => {
  return clientsStore.items.filter(c => {
    return c.status !== 'inactive' || c.id === editClientId.value
  })
})

// Prebuilt note templates
const NOTE_TEMPLATES = {
  meeting: {
    title: 'Meeting Summary',
    body: `## Meeting Summary: [Topic]
**Participants**: 

### Key Discussion Points
- 

### Decisions Made
- 

### Immediate Action Items
- [ ] [Action 1]
- [ ] [Action 2]
`
  },
  kickoff: {
    title: 'Project Kickoff Checklist',
    body: `# Project Kickoff: [Project Name]

### Scope & Deliverables
- 

### Technical Specifications
- Stack: 
- Hosting / Servers: 

### Milestones & Timelines
1. Discovery - 
2. Initial Draft - 
3. Final Delivery - 
`
  }
}

// All notes in this store are work notes
const workNotes = computed(() => notesStore.items)

const filteredNotes = computed(() => {
  // 1. Backburner check
  let list = workNotes.value.filter(n => {
    const isBackburner = n.tags && n.tags.includes('backburner')
    return showBackburner.value ? isBackburner : !isBackburner
  })

  // 2. Client filter
  if (clientFilter.value) {
    list = list.filter(n => n.clientId === clientFilter.value)
  }

  // 3. Search query filter
  const term = q.value.trim().toLowerCase()
  if (!term) return list
  return list.filter(n =>
    n.title.toLowerCase().includes(term) ||
    (n.body || '').toLowerCase().includes(term)
  )
})

const activeNote = computed(() => {
  return workNotes.value.find(n => n.id === selectedNoteId.value)
})

// Sync note selection to route query
function handleRouteNote() {
  const queryId = route.query.id
  if (queryId && workNotes.value.some(n => n.id === queryId)) {
    selectNote(queryId)
  } else if (filteredNotes.value.length > 0 && !selectedNoteId.value) {
    selectNote(filteredNotes.value[0].id)
  }
}

onMounted(async () => {
  loadCustomTemplates()
  if (route.query.new === 'true') {
    const prefillTitle = route.query.prefillTitle ? String(route.query.prefillTitle) : ''
    router.replace({ query: { ...route.query, new: undefined, prefillTitle: undefined } })
    await createNewNote(null, prefillTitle)
  } else {
    handleRouteNote()
  }
})

watch(() => filteredNotes.value.length, () => {
  if (route.query.new !== 'true') {
    handleRouteNote()
  }
})

watch(() => route.query.new, async (newVal) => {
  if (newVal === 'true') {
    const prefillTitle = route.query.prefillTitle ? String(route.query.prefillTitle) : ''
    router.replace({ query: { ...route.query, new: undefined, prefillTitle: undefined } })
    await createNewNote(null, prefillTitle)
  }
})

watch(() => route.query.id, (newId) => {
  if (newId && newId !== selectedNoteId.value) {
    selectNote(newId)
  }
})

function selectNote(id) {
  selectedNoteId.value = id
  const note = workNotes.value.find(n => n.id === id)
  if (note) {
    editTitle.value = note.title
    editBody.value = note.body || ''
    editClientId.value = note.clientId || ''
    isEditing.value = false
    // Update route query
    if (route.query.id !== id) {
      router.replace({ query: { id } })
    }
  }
}

async function createNewNote(templateKey = null, prefillTitle = '') {
  let titleVal = prefillTitle || 'Untitled Note'
  let bodyVal = ''

  if (templateKey) {
    if (NOTE_TEMPLATES[templateKey]) {
      titleVal = NOTE_TEMPLATES[templateKey].title
      bodyVal = NOTE_TEMPLATES[templateKey].body
    } else if (templateKey.startsWith('custom_')) {
      const custom = customTemplates.value.find(t => t.id === templateKey)
      if (custom) {
        titleVal = custom.title
        bodyVal = custom.body
      }
    }
  }

  const note = await notesStore.add({
    title: titleVal,
    body: bodyVal,
    tags: ['work'],
    clientId: clientFilter.value || ''
  })
  ui.showToast(templateKey ? 'Document created from template' : 'Blank document created', 'success')
  selectNote(note.id)
  isEditing.value = true
}

async function saveNoteChanges() {
  if (!selectedNoteId.value || !activeNote.value) return

  // Preserve existing tags, ensuring 'work' tag is present
  const tagsList = [...(activeNote.value.tags || [])]
  if (!tagsList.includes('work')) {
    tagsList.push('work')
  }

  await notesStore.update(selectedNoteId.value, {
    title: editTitle.value,
    body: editBody.value,
    clientId: editClientId.value,
    tags: tagsList
  })
  isEditing.value = false
  ui.showToast('Document saved', 'success')
}

async function toggleBackburner() {
  if (!activeNote.value) return

  const tagsList = [...(activeNote.value.tags || [])]
  const idx = tagsList.indexOf('backburner')

  if (idx > -1) {
    tagsList.splice(idx, 1)
    ui.showToast('Document moved to Active', 'success')
  } else {
    tagsList.push('backburner')
    ui.showToast('Document moved to Backburner', 'success')
  }

  await notesStore.update(selectedNoteId.value, { tags: tagsList })

  // Clear selection to force list reload
  selectedNoteId.value = null
  router.replace({ query: {} })
}

async function deleteNote() {
  if (!selectedNoteId.value) return
  const approved = await ui.confirm('Are you sure you want to delete this document?')
  if (approved) {
    await notesStore.remove(selectedNoteId.value)
    selectedNoteId.value = null
    editTitle.value = ''
    editBody.value = ''
    editClientId.value = ''
    isEditing.value = false
    ui.showToast('Document deleted', 'success')
    router.replace({ query: {} })
  }
}

const renderedMarkdown = computed(() => {
  return marked.parse(editBody.value || '')
})
</script>

<template>
  <div class="px-6 md:px-10 py-6 max-w-[1600px] mx-auto h-[calc(100vh-60px)] flex flex-col space-y-4" data-testid="work-notes">

    <!-- COMPACT HEADER ROW -->
    <div class="flex items-center justify-between gap-4 pb-3 border-b border-line/50 shrink-0">
      <div class="flex items-center gap-3">
        <h1 class="font-serif text-2xl md:text-3xl text-ink font-bold tracking-tight">Context Notes</h1>
        <span class="px-2 py-0.5 rounded-full bg-surface border border-line text-ink-3 text-xs font-mono font-semibold">
          {{ workNotes.length }}
        </span>
      </div>

      <div class="flex items-center gap-2.5">
        <select @change="createNewNote($event.target.value); $event.target.value = ''"
          class="text-xs bg-surface border border-line rounded-xl px-3 py-2 text-ink-2 focus:outline-none font-medium cursor-pointer hover:border-line-2 transition-colors">
          <option value="">Choose template...</option>
          <optgroup label="Default Templates">
            <option value="meeting">Meeting Summary</option>
            <option value="kickoff">Project Kickoff Checklist</option>
          </optgroup>
          <optgroup v-if="customTemplates.length" label="Custom Templates">
            <option v-for="t in customTemplates" :key="t.id" :value="t.id">{{ t.title }}</option>
          </optgroup>
        </select>
        <button @click="createNewNote()" class="btn-primary !py-2 !px-3.5 text-xs flex items-center gap-1.5 shadow-sm">
          <Plus class="w-3.5 h-3.5" /> New Document
        </button>
      </div>
    </div>

    <!-- SPLIT WORKSPACE CONTAINER -->
    <div class="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12 gap-5">

      <!-- LEFT: FILE LIST SIDEBAR (3 COLS) -->
      <div class="lg:col-span-3 flex flex-col min-h-0 space-y-3">
        <!-- Search & Filter Controls -->
        <div class="space-y-2">
          <div class="card px-3 py-1.5 flex items-center gap-2 bg-surface/80">
            <Search class="w-3.5 h-3.5 text-ink-3" />
            <input v-model="q" placeholder="Filter documents…" class="bg-transparent outline-none text-xs flex-1 text-ink placeholder:text-ink-3" />
          </div>

          <div class="flex items-center gap-2">
            <select v-model="clientFilter"
              class="flex-1 text-xs bg-surface border border-line rounded-xl px-2 py-1.5 text-ink-2 focus:outline-none cursor-pointer">
              <option value="">All Clients</option>
              <option v-for="c in clientsStore.items" :key="c.id" :value="c.id">{{ c.name }}</option>
            </select>

            <button @click="showBackburner = !showBackburner"
              class="px-2.5 py-1.5 rounded-xl text-xs font-semibold border flex items-center gap-1 shrink-0 transition-colors"
              :class="showBackburner ? 'bg-pri-interruptive-bg border-pri-interruptive-bd text-pri-interruptive' : 'bg-surface border-line text-ink-2 hover:bg-canvas'">
              <Archive class="w-3.5 h-3.5" /> Backburner
            </button>
          </div>
        </div>

        <!-- Scrollable List -->
        <div class="flex-1 overflow-y-auto space-y-1.5 pr-1">
          <div v-for="n in filteredNotes" :key="n.id" @click="selectNote(n.id)"
            class="p-3 rounded-xl border cursor-pointer transition-all duration-200"
            :class="selectedNoteId === n.id ? 'bg-surface border-line-2 shadow-sm' : 'bg-surface/40 border-line/60 hover:border-line-2 hover:bg-surface'">

            <div class="flex items-center justify-between gap-2 text-[10px] text-ink-3 font-mono font-medium">
              <span>{{ dayjs(n.updatedAt).format('MMM D, YYYY') }}</span>
              <span v-if="n.clientId" class="text-pri-strategic font-semibold px-1.5 py-0.2 rounded bg-emerald-500/10 border border-emerald-500/20 truncate max-w-[100px]">
                {{ clientsStore.items.find(c => c.id === n.clientId)?.name || 'Client' }}
              </span>
            </div>

            <h4 class="text-sm text-ink font-medium mt-1 truncate">{{ n.title || 'Untitled Note' }}</h4>
            <p class="text-xs text-ink-3 mt-0.5 line-clamp-1 leading-snug">{{ (n.body || '').replace(/^[#\s*>-]+/, '') || 'Empty document.' }}</p>
          </div>

          <div v-if="!filteredNotes.length" class="text-center py-12 text-xs text-ink-3 italic">
            No documents found.
          </div>
        </div>
      </div>

      <!-- RIGHT: FULL-HEIGHT CANVAS (9 COLS) -->
      <div class="lg:col-span-9 flex flex-col min-h-0 card bg-surface p-5 md:p-6 border border-line shadow-sm">
        <div v-if="activeNote" class="flex-1 flex flex-col min-h-0 space-y-3">

          <!-- Integrated Top Bar (Title & Actions Inline) -->
          <div class="flex items-center justify-between gap-4 pb-3 border-b border-line/50 flex-wrap sm:flex-nowrap">
            <!-- Document Title (Edit mode vs View mode) -->
            <div class="flex-1 min-w-[200px] flex items-center gap-3">
              <input v-if="isEditing" v-model="editTitle" placeholder="Document title…"
                class="w-full bg-transparent font-serif text-2xl md:text-3xl font-bold text-ink focus:outline-none placeholder:text-ink-3/40" />
              <div v-else class="flex items-center gap-3 min-w-0">
                <h2 class="font-serif text-2xl md:text-3xl font-bold text-ink truncate">
                  {{ activeNote.title || 'Untitled Note' }}
                </h2>
                <span v-if="activeNote.clientId"
                  class="text-xs px-2.5 py-1 rounded-xl bg-canvas/80 border border-line text-ink-2 font-medium shrink-0">
                  {{ clientsStore.items.find(c => c.id === activeNote.clientId)?.name }}
                </span>
              </div>
            </div>

            <div class="flex items-center gap-2 shrink-0">
              <!-- Inline Client Selector Pill (Edit mode only) -->
              <div v-if="isEditing" class="flex items-center gap-1.5 text-xs bg-canvas/60 border border-line rounded-xl px-2.5 py-1">
                <span class="text-[10px] font-mono uppercase font-bold text-ink-3">Client</span>
                <select v-model="editClientId" class="bg-transparent text-xs text-ink font-medium focus:outline-none cursor-pointer">
                  <option value="">None (Standalone)</option>
                  <option v-for="c in activeClients" :key="c.id" :value="c.id">{{ c.name }}</option>
                </select>
              </div>

              <!-- Icon Actions Group -->
              <div class="flex items-center gap-1">
                <!-- Edit / View Mode Toggle Icon -->
                <button @click="isEditing = !isEditing"
                  class="p-2 transition-colors rounded-xl shrink-0 relative group"
                  :class="isEditing ? 'text-pri-strategic bg-canvas' : 'text-ink-3/70 hover:text-ink hover:bg-canvas'"
                  :title="isEditing ? 'Switch to View Mode' : 'Edit Document'">
                  <Edit3 v-if="!isEditing" class="w-4 h-4" />
                  <Eye v-else class="w-4 h-4" />
                  <span class="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 hidden group-hover:block z-30 px-2 py-1 text-[10px] font-semibold bg-ink text-canvas rounded-lg shadow-md whitespace-nowrap pointer-events-none select-none border border-canvas/10">
                    {{ isEditing ? 'Switch to View Mode' : 'Edit Document' }}
                  </span>
                </button>

                <!-- Backburner / Archive toggle icon -->
                <button @click="toggleBackburner"
                  class="p-2 text-ink-3/70 hover:text-ink hover:bg-canvas transition-colors rounded-xl shrink-0 relative group"
                  :title="activeNote.tags?.includes('backburner') ? 'Move to Active' : 'Move to Backburner'">
                  <Archive class="w-4 h-4" :class="{ 'text-amber-600/80 dark:text-amber-400/80': activeNote.tags?.includes('backburner') }" />
                  <span class="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 hidden group-hover:block z-30 px-2 py-1 text-[10px] font-semibold bg-ink text-canvas rounded-lg shadow-md whitespace-nowrap pointer-events-none select-none border border-canvas/10">
                    {{ activeNote.tags?.includes('backburner') ? 'Move to Active' : 'Move to Backburner' }}
                  </span>
                </button>

                <!-- Save icon (Edit mode or click to save) -->
                <button @click="saveNoteChanges"
                  class="p-2 text-emerald-700/65 dark:text-emerald-400/65 hover:text-emerald-700 dark:hover:text-emerald-300 hover:bg-canvas transition-colors rounded-xl shrink-0 relative group"
                  title="Save changes">
                  <Save class="w-4 h-4" />
                  <span class="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 hidden group-hover:block z-30 px-2 py-1 text-[10px] font-semibold bg-ink text-canvas rounded-lg shadow-md whitespace-nowrap pointer-events-none select-none border border-canvas/10">
                    Save Document
                  </span>
                </button>

                <!-- Save as Template icon button -->
                <button @click="saveAsCustomTemplate"
                  class="p-2 text-sky-700/65 dark:text-sky-400/65 hover:text-sky-700 dark:hover:text-sky-300 hover:bg-canvas transition-colors rounded-xl shrink-0 relative group"
                  title="Save as custom template">
                  <BookmarkPlus class="w-4 h-4" />
                  <span class="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 hidden group-hover:block z-30 px-2 py-1 text-[10px] font-semibold bg-ink text-canvas rounded-lg shadow-md whitespace-nowrap pointer-events-none select-none border border-canvas/10">
                    Save as Template
                  </span>
                </button>

                <!-- Delete icon -->
                <button @click="deleteNote"
                  class="p-2 text-rose-700/65 dark:text-rose-400/65 hover:text-rose-700 dark:hover:text-rose-300 hover:bg-canvas transition-colors rounded-xl shrink-0 relative group"
                  title="Delete note">
                  <Trash class="w-4 h-4" />
                  <span class="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 hidden group-hover:block z-30 px-2 py-1 text-[10px] font-semibold bg-ink text-canvas rounded-lg shadow-md whitespace-nowrap pointer-events-none select-none border border-canvas/10">
                    Delete Document
                  </span>
                </button>
              </div>
            </div>
          </div>

          <!-- Document Canvas (View Mode HTML vs Edit Mode Tiptap Editor) -->
          <div class="flex-1 min-h-0 flex flex-col pt-1">
            <div v-if="!isEditing"
              class="prose-soft flex-1 overflow-y-auto pr-2 leading-relaxed text-ink text-sm md:text-base space-y-3 select-text"
              v-html="renderedMarkdown"></div>
            <TiptapEditor v-else v-model="editBody" heightClass="h-full flex-1 min-h-[400px]" />
          </div>

          <!-- Compact Word Count Footer -->
          <div class="text-[10px] text-ink-3 font-mono flex justify-between pt-2 border-t border-line/40 items-center">
            <span>{{ editBody.trim() ? editBody.trim().split(/\s+/).length : 0 }} words</span>
            <span class="flex items-center gap-1.5">
              <span class="w-1.5 h-1.5 rounded-full" :class="isEditing ? 'bg-amber-500' : 'bg-emerald-500'"></span>
              <span>{{ isEditing ? 'Editing Mode' : 'View Mode' }}</span>
            </span>
          </div>

        </div>

        <div v-else class="flex-1 flex flex-col items-center justify-center text-ink-3 italic text-xs py-12">
          Select a note from the left or create a new document to start drafting.
        </div>
      </div>

    </div>

    <!-- Markdown help overlay -->
    <MarkdownHelpModal :isOpen="showMarkdownHelp" @close="showMarkdownHelp = false" />
  </div>
</template>
