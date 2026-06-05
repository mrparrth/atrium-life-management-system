<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useNotesStore } from '@/stores/notes'
import { useProjectsStore } from '@/stores/projects'
import { marked } from 'marked'
import EmptyState from '@/components/EmptyState.vue'
import { ArrowLeft, Trash2, Edit3, Save } from 'lucide-vue-next'

const props = defineProps({ id: String })
const router = useRouter()
const notes = useNotesStore()
const projects = useProjectsStore()
const note = computed(() => notes.items.find(n => n.id === props.id))
const editing = ref(false)
const draftTitle = ref(''); const draftBody = ref('')

onMounted(() => { if (note.value) { notes.markViewed(note.value.id); draftTitle.value = note.value.title; draftBody.value = note.value.body } })
watch(() => props.id, () => { if (note.value) { notes.markViewed(note.value.id); draftTitle.value = note.value.title; draftBody.value = note.value.body } })

const html = computed(() => marked.parse(note.value?.body || ''))
const linkedProject = computed(() => projects.items.find(p => p.id === note.value?.projectId))

async function save() { await notes.update(note.value.id, { title: draftTitle.value, body: draftBody.value }); editing.value = false }
async function del() { if (confirm('Delete this note?')) { await notes.remove(props.id); router.push('/notes') } }
</script>

<template>
  <div v-if="note" class="px-8 md:px-12 py-10 max-w-3xl mx-auto" data-testid="note-detail">
    <button @click="router.back()" class="btn-ghost mb-4 text-sm"><ArrowLeft class="w-3.5 h-3.5" /> Back</button>
    <div class="flex items-center justify-end gap-2 mb-4">
      <button v-if="!editing" class="btn-ghost" @click="editing = true" data-testid="note-edit"><Edit3 class="w-4 h-4" /> Edit</button>
      <button v-else class="btn-primary" @click="save" data-testid="note-save"><Save class="w-4 h-4" /> Save</button>
      <button class="btn-ghost !text-pri-critical" @click="del" data-testid="note-delete"><Trash2 class="w-4 h-4" /></button>
    </div>

    <template v-if="editing">
      <input v-model="draftTitle" class="input-soft text-4xl font-serif mb-6" />
      <textarea v-model="draftBody" rows="20" class="input-block leading-relaxed resize-none w-full font-sans" data-testid="note-body-input"></textarea>
    </template>
    <template v-else>
      <h1 class="font-serif text-4xl md:text-5xl tracking-tight leading-none mb-3">{{ note.title }}</h1>
      <div v-if="linkedProject" class="text-sm text-ink-2 mb-6">Linked to <RouterLink :to="`/projects/${linkedProject.id}`" class="text-ink underline decoration-line-2 underline-offset-4">{{ linkedProject.title }}</RouterLink></div>
      <article class="prose-soft" v-html="html"></article>
    </template>
  </div>
  <EmptyState v-else title="Note not found" />
</template>
