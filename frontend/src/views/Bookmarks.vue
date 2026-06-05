<script setup>
import { ref, computed } from 'vue'
import { useBookmarksStore } from '@/stores/bookmarks'
import PageHeader from '@/components/PageHeader.vue'
import EmptyState from '@/components/EmptyState.vue'
import { fromNow } from '@/lib/date'
import { Plus, X, Bookmark as BookmarkIcon, Trash2, ExternalLink } from 'lucide-vue-next'

const bookmarks = useBookmarksStore()
const showNew = ref(false)
const newTitle = ref(''); const newUrl = ref(''); const newCat = ref('General'); const newDesc = ref('')

const grouped = computed(() => {
  const map = {}
  for (const b of bookmarks.items) {
    const k = b.category || 'General'
    if (!map[k]) map[k] = []
    map[k].push(b)
  }
  return map
})

async function create() {
  if (!newUrl.value.trim()) return
  await bookmarks.add({ title: newTitle.value || newUrl.value, url: newUrl.value, category: newCat.value, description: newDesc.value })
  newTitle.value = ''; newUrl.value = ''; newDesc.value = ''; newCat.value = 'General'; showNew.value = false
}
async function open(b) { await bookmarks.markViewed(b.id); window.open(b.url, '_blank') }
async function remove(b) { if (confirm('Remove bookmark?')) await bookmarks.remove(b.id) }
</script>

<template>
  <div class="px-8 md:px-12 py-10 max-w-5xl mx-auto" data-testid="bookmarks-view">
    <PageHeader overline="Memory" title="Bookmarks" sub="Pages worth returning to.">
      <template #right><button class="btn-primary" @click="showNew = true" data-testid="new-bookmark-btn"><Plus class="w-4 h-4" /> Add bookmark</button></template>
    </PageHeader>

    <div v-if="Object.keys(grouped).length">
      <section v-for="(items, cat) in grouped" :key="cat" class="mb-10">
        <div class="overline mb-3">{{ cat }}</div>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div v-for="b in items" :key="b.id" class="card p-5 group hover:border-line-2 transition-all duration-300" :data-testid="`bookmark-card-${b.id}`">
            <div class="flex items-start gap-3">
              <BookmarkIcon class="w-4 h-4 text-ink-3 mt-1 shrink-0" />
              <div class="min-w-0 flex-1">
                <div class="font-serif text-lg leading-snug">{{ b.title }}</div>
                <p class="text-xs text-ink-3 truncate mt-1">{{ b.url }}</p>
                <p v-if="b.description" class="text-sm text-ink-2 mt-2">{{ b.description }}</p>
                <div class="text-[11px] text-ink-3 mt-3">last opened {{ fromNow(b.lastViewedAt) }}</div>
              </div>
              <div class="opacity-0 group-hover:opacity-100 transition-opacity flex flex-col gap-1">
                <button class="btn-ghost !p-1.5" @click="open(b)" :data-testid="`bookmark-open-${b.id}`"><ExternalLink class="w-3.5 h-3.5" /></button>
                <button class="btn-ghost !p-1.5 hover:text-pri-critical" @click="remove(b)" :data-testid="`bookmark-delete-${b.id}`"><Trash2 class="w-3.5 h-3.5" /></button>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
    <EmptyState v-else title="No bookmarks yet" hint="Save a link worth remembering." />

    <div v-if="showNew" class="fixed inset-0 z-50 flex items-start justify-center pt-24 px-4">
      <div class="fixed inset-0 bg-ink/40 backdrop-blur-sm" @click="showNew = false"></div>
      <form @submit.prevent="create" class="relative w-full max-w-md card p-8 animate-rise-in">
        <button type="button" class="absolute top-4 right-4 btn-ghost !p-1.5" @click="showNew = false"><X class="w-4 h-4" /></button>
        <div class="overline">New bookmark</div>
        <h2 class="font-serif text-2xl mt-1 mb-5">Preserve this</h2>
        <input v-model="newUrl" type="url" placeholder="https://…" class="input-soft mb-3" required data-testid="new-bookmark-url" />
        <input v-model="newTitle" placeholder="Title (optional)" class="input-soft mb-3" data-testid="new-bookmark-title" />
        <input v-model="newCat" placeholder="Category" class="input-soft mb-3" />
        <textarea v-model="newDesc" placeholder="Why save it?" rows="2" class="input-soft resize-none mb-5"></textarea>
        <div class="flex justify-end gap-2">
          <button type="button" class="btn-ghost" @click="showNew = false">Cancel</button>
          <button type="submit" class="btn-primary" data-testid="new-bookmark-save">Save</button>
        </div>
      </form>
    </div>
  </div>
</template>
