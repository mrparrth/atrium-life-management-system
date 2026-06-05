<script setup>
import { ref, computed } from 'vue'
import { RouterLink } from 'vue-router'
import { useNotesStore } from '@/stores/notes'
import PageHeader from '@/components/PageHeader.vue'
import EmptyState from '@/components/EmptyState.vue'
import { fromNow } from '@/lib/date'
import { Plus, X, Search } from 'lucide-vue-next'

const notes = useNotesStore()
const showNew = ref(false)
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
</script>

<template>
  <div class="px-8 md:px-12 py-10 max-w-5xl mx-auto" data-testid="notes-view">
    <PageHeader overline="Memory" title="Notes" sub="Loose thoughts and longer reflections.">
      <template #right><button class="btn-primary" @click="showNew = true" data-testid="new-note-btn"><Plus class="w-4 h-4" /> New note</button></template>
    </PageHeader>

    <div class="card px-4 py-2.5 mb-8 flex items-center gap-3">
      <Search class="w-4 h-4 text-ink-3" />
      <input v-model="q" class="bg-transparent outline-none flex-1 text-sm" placeholder="Search notes…" data-testid="notes-search" />
    </div>

    <div v-if="filtered.length" class="grid grid-cols-1 md:grid-cols-2 gap-4">
      <RouterLink v-for="n in filtered" :key="n.id" :to="`/notes/${n.id}`" class="card p-5 hover:border-line-2 transition-all duration-300" :data-testid="`note-card-${n.id}`">
        <div class="overline">{{ fromNow(n.updatedAt) }}</div>
        <div class="font-serif text-xl mt-1.5">{{ n.title }}</div>
        <p class="text-sm text-ink-2 mt-2 line-clamp-3 whitespace-pre-line">{{ n.body }}</p>
        <div v-if="n.tags && n.tags.length" class="mt-3 flex flex-wrap gap-1.5">
          <span v-for="t in n.tags" :key="t" class="text-[11px] text-ink-3">· {{ t }}</span>
        </div>
      </RouterLink>
    </div>
    <EmptyState v-else title="No notes" hint="Begin writing what you'd otherwise forget." />

    <div v-if="showNew" class="fixed inset-0 z-50 flex items-start justify-center pt-24 px-4">
      <div class="fixed inset-0 bg-ink/40 backdrop-blur-sm" @click="showNew = false"></div>
      <form @submit.prevent="create" class="relative w-full max-w-xl card p-8 animate-rise-in">
        <button type="button" class="absolute top-4 right-4 btn-ghost !p-1.5" @click="showNew = false"><X class="w-4 h-4" /></button>
        <div class="overline">New note</div>
        <h2 class="font-serif text-2xl mt-1 mb-5">A page of your own</h2>
        <input v-model="newTitle" placeholder="Title…" class="input-soft text-lg font-serif mb-3" required data-testid="new-note-title" />
        <textarea v-model="newBody" placeholder="Write freely. Markdown welcome." rows="6" class="input-soft resize-none mb-5" data-testid="new-note-body" />
        <div class="flex justify-end gap-2">
          <button type="button" class="btn-ghost" @click="showNew = false">Cancel</button>
          <button type="submit" class="btn-primary" data-testid="new-note-save">Save</button>
        </div>
      </form>
    </div>
  </div>
</template>
