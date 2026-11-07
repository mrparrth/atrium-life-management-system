<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { useNotesStore } from '@/stores/notes'
import PageHeader from '@/components/PageHeader.vue'
import EmptyState from '@/components/EmptyState.vue'
import { fromNow } from '@/lib/date'
import { Plus, Search } from 'lucide-vue-next'
import dayjs from 'dayjs'

const route = useRoute()
const router = useRouter()
const notes = useNotesStore()
const q = ref('')

function handleQuery() {
  if (route.query.new) {
    router.replace({ query: {} })
    router.push('/notes/new')
  }
}

function handleGlobalKeydown(e) {
  if ((e.metaKey || e.ctrlKey) && e.key === '1') {
    e.preventDefault()
    router.push('/notes/new')
  }
}

onMounted(() => {
  handleQuery()
  window.addEventListener('keydown', handleGlobalKeydown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleGlobalKeydown)
})

watch(() => route.query, handleQuery)

const filtered = computed(() => {
  const term = q.value.trim().toLowerCase()
  if (!term) return notes.items
  return notes.items.filter(n => n.title.toLowerCase().includes(term) || (n.body || '').toLowerCase().includes(term))
})

function formatPreview(body) {
  if (!body) return 'Empty note...'
  return body
    .replace(/^#+\s+/gm, '')
    .replace(/\r\n/g, '\n')
    .replace(/\n\s*\n/g, '\n')
    .trim()
}
</script>

<template>
  <div class="px-6 md:px-10 pt-3 pb-8 max-w-7xl mx-auto" data-testid="notes-view">
    <PageHeader overline="Memory" title="Notes" sub="Loose thoughts and longer reflections.">
      <template #right>
        <button class="btn-primary" @click="router.push('/notes/new')" data-testid="new-note-btn">
          <Plus class="w-4 h-4" /> New note
          <span class="kbd ml-1.5 !bg-canvas/20 !border-canvas/10 !text-canvas select-none">⌘1</span>
        </button>
      </template>
    </PageHeader>

    <div class="card px-4 py-2.5 mb-8 flex items-center gap-3">
      <Search class="w-4 h-4 text-ink-3" />
      <input v-model="q" class="bg-transparent outline-none flex-1 text-sm" placeholder="Search notes…"
        data-testid="notes-search" />
    </div>

    <!-- Notes Grid: 3 columns (less wide) with clear 'Updated ...' timestamp on the right -->
    <div v-if="filtered.length" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      <RouterLink v-for="n in filtered" :key="n.id" :to="`/notes/${n.id}`"
        class="card p-4 sm:p-5 hover:border-line-2 hover:shadow-sm transition-all duration-300 flex flex-col justify-between group cursor-pointer"
        :data-testid="`note-card-${n.id}`">
        <div>
          <!-- Header: Title on Left | Update Date on Right -->
          <div class="flex items-start justify-between gap-3 mb-2">
            <h3 class="font-serif text-[15px] font-medium text-ink line-clamp-1 leading-snug group-hover:text-pri-strategic transition-colors flex-1 min-w-0">
              {{ n.title || 'Untitled Note' }}
            </h3>
            <span class="text-[10px] text-ink-3 uppercase tracking-wider font-mono shrink-0 whitespace-nowrap pt-0.5"
              :title="`Last updated: ${dayjs(n.updatedAt || n.createdAt).format('MMM D, YYYY h:mm A')}`">
              Updated {{ fromNow(n.updatedAt || n.createdAt) }}
            </span>
          </div>

          <p class="text-xs text-ink-2 line-clamp-3 leading-snug break-words whitespace-pre-line">
            {{ formatPreview(n.body) }}
          </p>
        </div>

        <div v-if="n.tags && n.tags.length" class="mt-3 pt-2 border-t border-line/30 flex flex-wrap gap-1.5">
          <span v-for="t in n.tags" :key="t" class="text-[10px] text-ink-3 bg-canvas border border-line/50 px-1.5 py-0.5 rounded">
            #{{ t }}
          </span>
        </div>
      </RouterLink>
    </div>
    <EmptyState v-else title="No notes" hint="Begin writing what you'd otherwise forget." />
  </div>
</template>
