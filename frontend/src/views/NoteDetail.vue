<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useNotesStore } from '@/stores/notes'
import { useProjectsStore } from '@/stores/projects'
import { useUIStore } from '@/stores/ui'
import { marked } from 'marked'
import EmptyState from '@/components/EmptyState.vue'
import TiptapEditor from '@/components/TiptapEditor.vue'
import { wikilinkPreprocess, backlinksOf, findWikiTargets, resolveTitle } from '@/lib/wikilinks'
import { ArrowLeft, Trash2, Edit3, Save, Link2 } from 'lucide-vue-next'

const props = defineProps({ id: String })
const router = useRouter()
const notes = useNotesStore()
const projects = useProjectsStore()
const ui = useUIStore()

const note = computed(() => notes.items.find(n => n.id === props.id))
const editing = ref(false)
const draftTitle = ref('')
const draftBody = ref('')

function startEdit() {
  if (!note.value) return
  draftTitle.value = note.value.title
  draftBody.value = note.value.body
  editing.value = true
}

function load() {
  if (note.value) {
    notes.markViewed(note.value.id)
    draftTitle.value = note.value.title
    draftBody.value = note.value.body
  }
}

onMounted(load)
watch(() => props.id, load)

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
  await notes.update(note.value.id, { title: draftTitle.value, body: draftBody.value })
  editing.value = false
}

async function del() {
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
  <div>
    <div v-if="note" class="px-8 md:px-12 py-10 max-w-4xl mx-auto transition-all duration-300" data-testid="note-detail">
      <button @click="router.back()" class="btn-ghost mb-4 text-sm">
        <ArrowLeft class="w-3.5 h-3.5" /> Back
      </button>
      <div class="flex items-center justify-end gap-2 mb-4">
        <button v-if="!editing" class="btn-ghost" @click="startEdit" data-testid="note-edit">
          <Edit3 class="w-4 h-4" /> Edit
        </button>
        <button v-else class="btn-primary" @click="save" data-testid="note-save">
          <Save class="w-4 h-4" /> Save
        </button>
        <button class="btn-ghost !text-pri-critical" @click="del" data-testid="note-delete">
          <Trash2 class="w-4 h-4" />
        </button>
      </div>

      <template v-if="editing">
        <input v-model="draftTitle" class="input-soft text-4xl font-serif mb-6" />
        <TiptapEditor v-model="draftBody" />
      </template>

      <template v-else>
        <h1 class="font-serif text-4xl md:text-5xl tracking-tight leading-none mb-3">{{ note.title }}</h1>
        <div v-if="linkedProject" class="text-sm text-ink-2 mb-6">Linked to <RouterLink
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
