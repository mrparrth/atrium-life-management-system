<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useWorkNotesStore } from '@/stores/workNotes'
import { useWorkClientsStore } from '@/stores/workClients'
import { useUIStore } from '@/stores/ui'
import PageHeader from '@/components/PageHeader.vue'
import EmptyState from '@/components/EmptyState.vue'
import { Plus, Trash, Eye, EyeOff, Search, FileText, Check, CornerDownLeft, Sparkles, Archive, HelpCircle } from 'lucide-vue-next'
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
const previewMode = ref(false)
const showMarkdownHelp = ref(false)

const clientFilter = ref('')
const showBackburner = ref(false)

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
**Date**: ${dayjs().format('MMMM D, YYYY')}
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
**Date**: ${dayjs().format('MMMM D, YYYY')}

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
  return workNotes.value.find(n => n.id === selectedNoteId.value) || null
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
    // Update route query
    if (route.query.id !== id) {
      router.replace({ query: { id } })
    }
  }
}

async function createNewNote(templateKey = null, prefillTitle = '') {
  let titleVal = prefillTitle || 'Untitled Note'
  let bodyVal = ''

  if (templateKey && NOTE_TEMPLATES[templateKey]) {
    titleVal = NOTE_TEMPLATES[templateKey].title
    bodyVal = NOTE_TEMPLATES[templateKey].body
  }

  const note = await notesStore.add({
    title: titleVal,
    body: bodyVal,
    tags: ['work'],
    clientId: clientFilter.value || ''
  })
  ui.showToast(templateKey ? 'Document created from template' : 'Blank document created', 'success')
  selectNote(note.id)
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
    ui.showToast('Document deleted', 'success')
    router.replace({ query: {} })
  }
}

const renderedMarkdown = computed(() => {
  return marked.parse(editBody.value || '')
})
</script>

<template>
  <div class="px-8 md:px-12 pt-8 pb-4 max-w-7xl mx-auto h-[calc(100vh-40px)] flex flex-col" data-testid="work-notes">

    <!-- HEADER -->
    <PageHeader overline="Memory" title="Context Notes"
      sub="Store onboarding logs, project briefs, deployment procedures, and meeting minutes.">
      <template #right>
        <div class="flex items-center gap-2">
          <!-- Template selector dropdown -->
          <select @change="createNewNote($event.target.value); $event.target.value = ''"
            class="text-xs bg-surface border border-line rounded-xl px-3 py-2 text-ink focus:outline-none font-medium">
            <option value="">Choose note template...</option>
            <option value="meeting">Meeting Summary</option>
            <option value="kickoff">Project Kickoff Checklist</option>
          </select>
          <button @click="createNewNote()" class="btn-primary">
            <Plus class="w-4 h-4" /> New Document
          </button>
        </div>
      </template>
    </PageHeader>

    <!-- SPLIT WORKSPACE CONTAINER -->
    <div class="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6 border-t border-line/60 pt-6">

      <!-- LEFT: FILE LIST SIDEBAR -->
      <div class="flex flex-col min-h-0 space-y-4">
        <!-- Search bar -->
        <div class="card px-3 py-2 flex items-center gap-2.5 bg-surface/50">
          <Search class="w-4 h-4 text-ink-3" />
          <input v-model="q" placeholder="Filter documents…" class="bg-transparent outline-none text-xs flex-1" />
        </div>

        <!-- Filter widgets -->
        <div class="flex gap-2 flex-wrap">
          <!-- Client Filter dropdown -->
          <div class="flex-1 min-w-[120px]">
            <select v-model="clientFilter"
              class="w-full text-xs bg-surface border border-line rounded-lg px-2.5 py-1.5 text-ink-2 focus:outline-none">
              <option value="">All Clients</option>
              <option v-for="c in clientsStore.items" :key="c.id" :value="c.id">{{ c.name }}</option>
            </select>
          </div>
          <!-- Backburner status toggle -->
          <button @click="showBackburner = !showBackburner"
            class="px-2.5 py-1.5 rounded-lg text-xs font-semibold border flex items-center gap-1.5"
            :class="showBackburner ? 'bg-pri-interruptive-bg border-pri-interruptive-bd text-pri-interruptive' : 'bg-surface border-line text-ink-2 hover:bg-canvas'">
            <Archive class="w-3.5 h-3.5" /> Backburner
          </button>
        </div>

        <!-- Scrollable List -->
        <div class="flex-1 overflow-y-auto space-y-2 pr-1">
          <div v-for="n in filteredNotes" :key="n.id" @click="selectNote(n.id)"
            class="card p-4 border cursor-pointer transition-all duration-300"
            :class="selectedNoteId === n.id ? 'bg-surface border-line-2 shadow-sm' : 'bg-surface/40 border-line hover:border-line-2'">

            <div
              class="flex items-center justify-between gap-2 text-[10px] text-ink-3 font-semibold uppercase tracking-wider">
              <span class="truncate">{{ dayjs(n.updatedAt).format('MMM D, YYYY') }}</span>
              <span v-if="n.clientId" class="text-pri-strategic">Workspace Linked</span>
            </div>

            <h4 class="font-serif text-base text-ink font-semibold mt-2 truncate">{{ n.title || 'Untitled Note' }}</h4>
            <p class="text-xs text-ink-2 mt-1 line-clamp-2 leading-relaxed">{{ n.body || 'Empty document.' }}</p>
          </div>

          <div v-if="!filteredNotes.length" class="text-center py-12 text-xs text-ink-3 italic">
            No documents found.
          </div>
        </div>
      </div>

      <!-- RIGHT: SPLIT EDITOR WRITER (2 COLS) -->
      <div class="lg:col-span-2 flex flex-col min-h-0 card bg-surface p-6 border border-line">
        <div v-if="activeNote" class="flex-1 flex flex-col min-h-0 space-y-4">

          <!-- Editor Title & Actions -->
          <div class="flex items-start justify-between gap-4 border-b border-line pb-4 flex-wrap">
            <div class="flex-1 min-w-[200px]">
              <input v-model="editTitle" placeholder="Document title…"
                class="w-full bg-transparent font-serif text-2xl font-bold text-ink focus:outline-none placeholder:text-ink-3" />
            </div>

            <div class="flex items-center gap-2">
              <button @click="previewMode = !previewMode" class="relative group btn-ghost !p-2 shrink-0">
                <EyeOff v-if="previewMode" class="w-4 h-4" />
                <Eye v-else class="w-4 h-4" />
                <span class="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 hidden group-hover:block z-30 px-2 py-1 text-[10px] font-semibold bg-ink text-canvas rounded-lg shadow-md whitespace-nowrap pointer-events-none select-none border border-canvas/10">
                  {{ previewMode ? 'Edit Mode' : 'Preview Mode' }}
                  <span class="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-ink"></span>
                </span>
              </button>
              <button @click="toggleBackburner" class="btn-ghost !py-1 px-3 text-xs flex items-center gap-1">
                <Archive class="w-3.5 h-3.5 text-ink-3" />
                {{ activeNote.tags?.includes('backburner') ? 'Make Active' : 'Backburner' }}
              </button>
              <button @click="saveNoteChanges" class="btn-secondary !py-1 px-3 text-xs flex items-center gap-1">
                <Check class="w-3.5 h-3.5" /> Save
              </button>
              <button @click="deleteNote" class="relative group text-ink-3 hover:text-pri-critical p-2 rounded shrink-0">
                <Trash class="w-4 h-4" />
                <span class="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 hidden group-hover:block z-30 px-2 py-1 text-[10px] font-semibold bg-ink text-canvas rounded-lg shadow-md whitespace-nowrap pointer-events-none select-none border border-canvas/10">
                  Delete Note
                  <span class="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-ink"></span>
                </span>
              </button>
            </div>
          </div>

          <!-- Metadata Associations (Timezone, workspace) -->
          <div class="text-xs bg-canvas/40 p-3 rounded-xl border border-line">
            <div class="flex items-center gap-2 max-w-sm">
              <span class="text-[10px] uppercase font-semibold text-ink-3 w-16">Client</span>
              <select v-model="editClientId" class="bg-surface border rounded px-2 py-1 flex-1 focus:outline-none">
                <option value="">None (Standalone)</option>
                <option v-for="c in activeClients" :key="c.id" :value="c.id">{{ c.name }}</option>
              </select>
            </div>
          </div>

          <!-- Writer Editor Textarea or Markdown Preview -->
          <div class="flex-1 min-h-0 flex flex-col">
            <div v-if="previewMode"
              class="h-full overflow-y-auto prose-soft bg-canvas/20 border border-line rounded-xl p-4"
              v-html="renderedMarkdown">
            </div>
            <TiptapEditor v-else v-model="editBody" heightClass="h-full min-h-[300px]" />
          </div>

          <!-- Bottom keyboard helper -->
          <div class="text-[10px] text-ink-3 flex justify-between pt-2 border-t border-line/40 items-center">
            <span>Word count: {{editBody.split(/\s+/).filter(x => x.length > 0).length}} words</span>
            <button @click="showMarkdownHelp = true" class="text-ink-3 hover:text-ink transition-colors flex items-center gap-1 font-semibold">
              <HelpCircle class="w-3.5 h-3.5" /> Markdown Guide
            </button>
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
