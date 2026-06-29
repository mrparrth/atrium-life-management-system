<script setup>
import { ref, computed, nextTick } from 'vue'
import { RouterLink } from 'vue-router'
import { useNotesStore } from '@/stores/notes'
import PageHeader from '@/components/PageHeader.vue'
import EmptyState from '@/components/EmptyState.vue'
import { fromNow } from '@/lib/date'
import { Plus, X, Search, HelpCircle } from 'lucide-vue-next'
import { onKeyStroke } from '@vueuse/core'
import { useUIStore } from '@/stores/ui'
import MarkdownHelpModal from '@/components/MarkdownHelpModal.vue'
import TiptapEditor from '@/components/TiptapEditor.vue'

const ui = useUIStore()

import { useRoute, useRouter } from 'vue-router'
const route = useRoute()
const router = useRouter()

const notes = useNotesStore()
const showNew = ref(false)
const showHelp = ref(false)

import { onMounted, watch } from 'vue'

function handleQuery() {
  if (route.query.new) {
    showNew.value = true
    router.replace({ query: {} })
  }
}

onMounted(handleQuery)
watch(() => route.query, handleQuery)

const newTitle = ref(''); const newBody = ref('')
const q = ref('')
const filtered = computed(() => {
  const term = q.value.trim().toLowerCase()
  if (!term) return notes.items
  return notes.items.filter(n => n.title.toLowerCase().includes(term) || (n.body || '').toLowerCase().includes(term))
})
async function create() {
  if (!newTitle.value.trim()) return
  const n = await notes.add({ title: newTitle.value, body: newBody.value })
  newTitle.value = ''; newBody.value = ''; showNew.value = false
}

async function closeNewNote() {
  if (newTitle.value.trim() || newBody.value.trim()) {
    if (!await ui.confirm({ title: 'Discard draft?', message: 'You have unsaved changes. Discard them?' })) return
  }
  showNew.value = false
}

onKeyStroke('Escape', (e) => {
  if (showNew.value) {
    e.preventDefault()
    closeNewNote()
  }
})

const newTitleInput = ref(null)

watch(showNew, (open) => {
  if (open) {
    nextTick(() => {
      newTitleInput.value?.focus()
    })
  }
})
</script>

<template>
  <div class="px-8 md:px-12 py-10 max-w-7xl mx-auto" data-testid="notes-view">
    <PageHeader overline="Memory" title="Notes" sub="Loose thoughts and longer reflections.">
      <template #right><button class="btn-primary" @click="showNew = true" data-testid="new-note-btn">
          <Plus class="w-4 h-4" /> New note <span class="kbd ml-1.5 !bg-canvas/20 !border-canvas/10 !text-canvas select-none">⌘1</span>
        </button></template>
    </PageHeader>

    <div class="card px-4 py-2.5 mb-8 flex items-center gap-3">
      <Search class="w-4 h-4 text-ink-3" />
      <input v-model="q" class="bg-transparent outline-none flex-1 text-sm" placeholder="Search notes…"
        data-testid="notes-search" />
    </div>

    <div v-if="filtered.length" class="grid grid-cols-1 md:grid-cols-2 gap-4">
      <RouterLink v-for="n in filtered" :key="n.id" :to="`/notes/${n.id}`"
        class="card p-5 hover:border-line-2 transition-all duration-300" :data-testid="`note-card-${n.id}`">
        <div class="overline">{{ fromNow(n.updatedAt) }}</div>
        <div class="font-serif text-xl mt-1.5">{{ n.title }}</div>
        <p class="text-sm text-ink-2 mt-2 line-clamp-3 whitespace-pre-line">{{ n.body }}</p>
        <div v-if="n.tags && n.tags.length" class="mt-3 flex flex-wrap gap-1.5">
          <span v-for="t in n.tags" :key="t" class="text-[11px] text-ink-3">· {{ t }}</span>
        </div>
      </RouterLink>
    </div>
    <EmptyState v-else title="No notes" hint="Begin writing what you'd otherwise forget." />

    <div v-if="showNew" @keydown.window.esc="closeNewNote" class="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div class="fixed inset-0 bg-ink/40 backdrop-blur-sm animate-fade-in" @click="closeNewNote"></div>
      <form @submit.prevent="create" @keydown.meta.enter.prevent="create" @keydown.ctrl.enter.prevent="create" class="relative w-full max-w-5xl h-[85vh] flex flex-col card p-8 animate-rise-in">
        <button type="button" class="absolute top-4 right-4 btn-ghost !p-1.5" @click="closeNewNote">
          <X class="w-4 h-4" />
        </button>
        <div class="overline">New note</div>
        <h2 class="font-serif text-2xl mt-1 mb-5">A page of your own</h2>
        
        <div class="v-field-group mb-4 shrink-0">
          <input ref="newTitleInput" v-model="newTitle" placeholder=" " class="v-field-input text-base font-semibold" id="new-note-title" required data-testid="new-note-title" />
          <label for="new-note-title" class="v-field-label text-sm">Title *</label>
        </div>

        <div class="flex-1 min-h-0 mb-4 flex flex-col">
          <TiptapEditor v-model="newBody" heightClass="h-full min-h-[300px]" />
        </div>

        <div class="flex justify-between items-center shrink-0">
          <button type="button" @click="showHelp = true" class="text-[11px] text-ink-3 hover:text-ink flex items-center gap-1 transition-colors">
            <HelpCircle class="w-3.5 h-3.5" /> Markdown Guide
          </button>
          <div class="flex justify-end gap-2">
            <button type="button" class="btn-ghost" @click="closeNewNote">Cancel</button>
            <button type="submit" class="btn-primary" data-testid="new-note-save">
              Save <span class="kbd !bg-canvas/20 !border-canvas/10 !text-canvas select-none text-[9px] ml-1">⌘Enter</span>
            </button>
          </div>
        </div>
      </form>
    </div>

    <!-- Markdown help overlay -->
    <MarkdownHelpModal :isOpen="showHelp" @close="showHelp = false" />
  </div>
</template>
