<script setup>
import { computed, onMounted, onUnmounted, ref, watch, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useNotesStore } from '@/stores/notes'
import { useProjectsStore } from '@/stores/projects'
import { useUIStore } from '@/stores/ui'
import { marked } from 'marked'
import EmptyState from '@/components/EmptyState.vue'
import TiptapEditor from '@/components/TiptapEditor.vue'
import { wikilinkPreprocess, backlinksOf, findWikiTargets, resolveTitle } from '@/lib/wikilinks'
import { ArrowLeft, Trash2, Edit3, Save, Link2 } from 'lucide-vue-next'

const props = defineProps({ id: String })
const route = useRoute()
const router = useRouter()
const notes = useNotesStore()
const projects = useProjectsStore()
const ui = useUIStore()

const isNew = computed(() => props.id === 'new')
const note = computed(() => {
  if (isNew.value) return null
  return notes.items.find(n => n.id === props.id)
})
const editing = ref(false)
const draftTitle = ref('')
const draftBody = ref('')
const titleInputRef = ref(null)

function startEdit() {
  if (!note.value) return
  draftTitle.value = note.value.title
  draftBody.value = note.value.body
  editing.value = true
}

function load() {
  if (isNew.value) {
    editing.value = true
    draftTitle.value = ''
    draftBody.value = ''
    nextTick(() => {
      titleInputRef.value?.focus()
    })
    return
  }
  if (note.value) {
    notes.markViewed(note.value.id)
    draftTitle.value = note.value.title
    draftBody.value = note.value.body
    if (route.query.edit === 'true' || route.query.edit === '1') {
      editing.value = true
    }
  }
}

onMounted(() => {
  load()
  window.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown)
})

watch(() => [props.id, route.query.edit], ([newId, newEdit]) => {
  load()
  if (newEdit === 'true' || newEdit === '1') {
    editing.value = true
  }
})

function handleKeydown(e) {
  if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
    if (editing.value || isNew.value) {
      e.preventDefault()
      save()
    }
  }
}

const html = computed(() => {
  const body = note.value?.body || ''
  return marked.parse(wikilinkPreprocess(body, notes.items))
})
const linkedProject = computed(() => projects.items.find(p => p.id === note.value?.projectId))

const outgoingLinks = computed(() => {
  if (!note.value) return []
  return findWikiTargets(note.value.body).map(title => ({
    title,
    target: resolveTitle(title, notes.items),
  }))
})
const incomingLinks = computed(() => backlinksOf(note.value, notes.items))

async function save() {
  if (isNew.value) {
    const title = draftTitle.value.trim() || 'Untitled'
    const created = await notes.add({ title, body: draftBody.value })
    ui.showToast('Note created', 'success')
    router.replace(`/notes/${created.id}`)
    return
  }
  await notes.update(note.value.id, { title: draftTitle.value, body: draftBody.value })
  editing.value = false
  const query = { ...route.query }
  delete query.edit
  router.replace({ query })
  ui.showToast('Note saved', 'success')
}

async function del() {
  if (isNew.value) {
    router.push('/notes')
    return
  }
  if (await ui.confirm({ message: 'Delete this note?', title: 'Delete Note' })) {
    await notes.remove(props.id)
    router.push('/notes')
  }
}

function onArticleClick(e) {
  const a = e.target.closest('a.wikilink[data-note-id]')
  if (a) {
    e.preventDefault()
    const id = a.getAttribute('data-note-id')
    router.push(`/notes/${id}`)
  }
}
</script>

<template>
  <div class="flex-1 min-h-full flex flex-col">
    <div v-if="note || isNew" class="px-6 md:px-10 pt-3 pb-8 max-w-4xl w-full mx-auto flex-1 flex flex-col transition-all duration-300" data-testid="note-detail">
      <div class="flex items-center justify-between gap-2 mb-3 shrink-0">
        <button @click="router.push('/notes')" class="btn-ghost text-xs">
          <ArrowLeft class="w-3.5 h-3.5" /> Back
        </button>
        <div class="flex items-center gap-2">
          <button v-if="isNew" class="btn-ghost text-xs" @click="router.push('/notes')">
            Cancel
          </button>
          <button v-if="!editing && !isNew" class="btn-ghost" @click="startEdit" data-testid="note-edit">
            <Edit3 class="w-4 h-4" /> Edit
          </button>
          <button v-else class="btn-primary" @click="save" data-testid="note-save">
            <Save class="w-4 h-4" /> Save
            <span class="kbd !bg-canvas/20 !border-canvas/10 !text-canvas select-none text-[9px] ml-1">⌘Enter</span>
          </button>
          <button v-if="!isNew" class="btn-ghost !text-pri-critical" @click="del" data-testid="note-delete" title="Delete note">
            <Trash2 class="w-4 h-4" />
          </button>
        </div>
      </div>

      <div v-if="editing || isNew" class="flex-1 flex flex-col min-h-0">
        <input
          ref="titleInputRef"
          v-model="draftTitle"
          placeholder="Note title..."
          autocomplete="off"
          autocorrect="off"
          autocapitalize="off"
          spellcheck="false"
          class="w-full shrink-0 bg-transparent font-serif text-2xl md:text-3xl font-medium text-ink focus:outline-none placeholder:text-ink-3/40 mb-4 pb-1 border-b border-transparent focus:border-line-2 transition-colors"
          data-testid="note-title-input"
        />
        <TiptapEditor v-model="draftBody" heightClass="flex-1 min-h-[450px]" class="flex-1 flex flex-col min-h-0" />
      </div>

      <template v-else>
        <h1 @click="startEdit" class="font-serif text-2xl md:text-3xl font-medium tracking-tight leading-tight mb-3 cursor-pointer hover:text-pri-strategic transition-colors" title="Click to edit title">{{ note.title }}</h1>
        <div v-if="linkedProject" class="text-sm text-ink-2 mb-4">Linked to <RouterLink
            :to="`/projects/${linkedProject.id}`" class="text-ink underline decoration-line-2 underline-offset-4">{{
              linkedProject.title }}</RouterLink>
        </div>
        <article class="prose-soft" v-html="html" @click="onArticleClick" data-testid="note-rendered"></article>

        <!-- Backlinks panel -->
        <section v-if="outgoingLinks.length || incomingLinks.length" class="mt-12 pt-8 border-t border-line"
          data-testid="backlinks-panel">
          <div v-if="incomingLinks.length" class="mb-8">
            <div class="overline mb-3 flex items-center gap-2">
              <Link2 class="w-3 h-3" /> Linked from
            </div>
            <div class="space-y-2" data-testid="incoming-links">
              <RouterLink v-for="n in incomingLinks" :key="n.id" :to="`/notes/${n.id}`"
                class="card px-4 py-3 block hover:border-line-2 transition-colors duration-300"
                :data-testid="`incoming-${n.id}`">
                <div class="font-serif text-base">{{ n.title }}</div>
                <p class="text-xs text-ink-3 mt-1 line-clamp-1">{{ n.body }}</p>
              </RouterLink>
            </div>
          </div>
          <div v-if="outgoingLinks.length">
            <div class="overline mb-3 flex items-center gap-2">
              <Link2 class="w-3 h-3" /> Links to
            </div>
            <div class="flex flex-wrap gap-2" data-testid="outgoing-links">
              <RouterLink v-for="(l, i) in outgoingLinks.filter(l => l.target)" :key="l.target.id + i"
                :to="`/notes/${l.target.id}`"
                class="px-3 py-1.5 rounded-full bg-elevated border border-line text-sm hover:border-line-2 transition-colors duration-300"
                :data-testid="`outgoing-${l.target.id}`">
                {{ l.title }}
              </RouterLink>
              <span v-for="(l, i) in outgoingLinks.filter(l => !l.target)" :key="'m' + i"
                class="px-3 py-1.5 rounded-full border border-dashed border-line text-sm text-ink-3 italic"
                :data-testid="`outgoing-missing-${i}`" :title="`No note titled “${l.title}”`">
                {{ l.title }}
              </span>
            </div>
          </div>
        </section>
      </template>
    </div>
    <EmptyState v-else title="Note not found" />
  </div>
</template>

<style scoped>
:deep(.wikilink) {
  background: rgb(var(--elevated));
  border: 1px solid rgb(var(--line));
  padding: 0 0.4em;
  border-radius: 999px;
  text-decoration: none;
  color: rgb(var(--ink));
  font-size: 0.95em;
  transition: border-color 0.2s ease;
}

:deep(.wikilink:hover) {
  border-color: rgb(var(--line-2));
}

:deep(.wikilink-missing) {
  border-style: dashed;
  color: rgb(var(--ink-3));
  font-style: italic;
  cursor: not-allowed;
}
</style>
