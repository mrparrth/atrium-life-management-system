<script setup>
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useBookmarksStore } from '@/stores/bookmarks'
import { useUIStore } from '@/stores/ui'
import PageHeader from '@/components/PageHeader.vue'
import EmptyState from '@/components/EmptyState.vue'
import { fromNow } from '@/lib/date'
import { ArrowLeft, Plus, X, ExternalLink, Trash2, Edit3, Save, Bookmark as BookmarkIcon } from 'lucide-vue-next'

const props = defineProps({ id: String })
const router = useRouter()
const bookmarks = useBookmarksStore()
const ui = useUIStore()

const page = computed(() => bookmarks.pages.find(p => p.id === props.id))
const list = computed(() => bookmarks.bookmarksInPage(props.id))

const showNewBm = ref(false)
const newBm = ref({ title: '', url: '', description: '', tags: '' })

const editing = ref(false)
const draft = ref({ title: '', description: '', emoji: '', tags: '' })

function startEdit() {
  if (!page.value) return
  draft.value = {
    title: page.value.title,
    description: page.value.description || '',
    emoji: page.value.emoji || '◗',
    tags: (page.value.tags || []).join(', '),
  }
  editing.value = true
}
async function saveEdit() {
  await bookmarks.updatePage(props.id, {
    title: draft.value.title.trim() || page.value.title,
    description: draft.value.description,
    emoji: draft.value.emoji || '◗',
    tags: draft.value.tags.split(',').map(t => t.trim()).filter(Boolean),
  })
  editing.value = false
  ui.showToast('Collection updated', 'success')
}

async function createBookmark() {
  if (!newBm.value.url.trim()) return
  await bookmarks.add({
    title: newBm.value.title,
    url: newBm.value.url,
    description: newBm.value.description,
    tags: newBm.value.tags.split(',').map(t => t.trim()).filter(Boolean),
    pageId: props.id,
  })
  newBm.value = { title: '', url: '', description: '', tags: '' }
  showNewBm.value = false
}

async function openBookmark(b) { await bookmarks.markViewed(b.id); window.open(b.url, '_blank') }
async function remove(b) { if (confirm('Remove bookmark?')) await bookmarks.remove(b.id) }
async function detach(b) { await bookmarks.update(b.id, { pageId: null }); ui.showToast('Moved to loose bookmarks', 'success') }
async function removePage() {
  if (!confirm(`Remove "${page.value.title}"? Bookmarks inside will be detached, not deleted.`)) return
  await bookmarks.removePage(props.id)
  router.push('/bookmarks')
}
</script>

<template>
  <div v-if="page" class="px-8 md:px-12 py-10 max-w-4xl mx-auto" data-testid="bookmark-page-detail">
    <button @click="router.back()" class="btn-ghost mb-4 text-sm" data-testid="page-back"><ArrowLeft class="w-3.5 h-3.5" /> Back</button>

    <template v-if="editing">
      <div class="card p-7 mb-8" data-testid="page-edit-card">
        <div class="flex gap-3 mb-3">
          <input v-model="draft.emoji" maxlength="2" class="input-soft text-3xl !w-16 text-center" data-testid="page-edit-emoji" />
          <input v-model="draft.title" class="input-soft flex-1 text-2xl font-serif" data-testid="page-edit-title" />
        </div>
        <textarea v-model="draft.description" rows="2" class="input-soft resize-none mb-3" placeholder="Description…" data-testid="page-edit-desc" />
        <input v-model="draft.tags" placeholder="Tags (comma separated)" class="input-soft mb-4" data-testid="page-edit-tags" />
        <div class="flex justify-end gap-2">
          <button class="btn-ghost" @click="editing = false">Cancel</button>
          <button class="btn-primary" @click="saveEdit" data-testid="page-save"><Save class="w-4 h-4" /> Save</button>
        </div>
      </div>
    </template>
    <template v-else>
      <header class="mb-10 flex items-start justify-between gap-6 flex-wrap">
        <div class="flex items-start gap-5">
          <span class="text-5xl font-serif text-ink-2 leading-none">{{ page.emoji || '◗' }}</span>
          <div>
            <div class="overline">Collection</div>
            <h1 class="font-serif text-4xl md:text-5xl tracking-tight leading-tight mt-1">{{ page.title }}</h1>
            <p v-if="page.description" class="text-ink-2 mt-3 max-w-xl">{{ page.description }}</p>
            <div v-if="page.tags?.length" class="flex flex-wrap gap-1 mt-3">
              <span v-for="t in page.tags" :key="t" class="text-[11px] px-2 py-0.5 rounded-full bg-elevated text-ink-2">{{ t }}</span>
            </div>
          </div>
        </div>
        <div class="flex gap-2">
          <button class="btn-ghost" @click="startEdit" data-testid="page-edit"><Edit3 class="w-4 h-4" /> Edit</button>
          <button class="btn-ghost !text-pri-critical" @click="removePage" data-testid="page-delete"><Trash2 class="w-4 h-4" /></button>
          <button class="btn-primary" @click="showNewBm = true" data-testid="page-add-bookmark"><Plus class="w-4 h-4" /> Add bookmark</button>
        </div>
      </header>
    </template>

    <div v-if="list.length" class="space-y-3" data-testid="page-bookmark-list">
      <div v-for="b in list" :key="b.id" class="card p-5 group hover:border-line-2 transition-all duration-300" :data-testid="`page-bookmark-${b.id}`">
        <div class="flex items-start gap-3">
          <BookmarkIcon class="w-4 h-4 text-ink-3 mt-1 shrink-0" />
          <div class="min-w-0 flex-1">
            <div class="font-serif text-lg leading-snug">{{ b.title }}</div>
            <p class="text-xs text-ink-3 truncate mt-1">{{ b.url }}</p>
            <p v-if="b.description" class="text-sm text-ink-2 mt-2">{{ b.description }}</p>
            <div v-if="b.tags?.length" class="flex flex-wrap gap-1 mt-2">
              <span v-for="t in b.tags" :key="t" class="text-[11px] px-2 py-0.5 rounded-full bg-elevated text-ink-2">{{ t }}</span>
            </div>
            <div class="text-[11px] text-ink-3 mt-3">last opened {{ fromNow(b.lastViewedAt) }}</div>
          </div>
          <div class="opacity-0 group-hover:opacity-100 transition-opacity flex flex-col gap-1">
            <button class="btn-ghost !p-1.5" @click="openBookmark(b)" :data-testid="`page-bm-open-${b.id}`"><ExternalLink class="w-3.5 h-3.5" /></button>
            <button class="btn-ghost !p-1.5 text-xs" @click="detach(b)" :data-testid="`page-bm-detach-${b.id}`" title="Move out of collection">↶</button>
            <button class="btn-ghost !p-1.5 hover:text-pri-critical" @click="remove(b)" :data-testid="`page-bm-delete-${b.id}`"><Trash2 class="w-3.5 h-3.5" /></button>
          </div>
        </div>
      </div>
    </div>
    <EmptyState v-else title="Empty collection" hint="Add a bookmark to begin." />

    <!-- New bookmark modal -->
    <div v-if="showNewBm" class="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4">
      <div class="fixed inset-0 bg-ink/40 backdrop-blur-sm" @click="showNewBm = false"></div>
      <form @submit.prevent="createBookmark" class="relative w-full max-w-md card p-8 animate-rise-in">
        <button type="button" class="absolute top-4 right-4 btn-ghost !p-1.5" @click="showNewBm = false"><X class="w-4 h-4" /></button>
        <div class="overline">Add to {{ page.title }}</div>
        <h2 class="font-serif text-2xl mt-1 mb-5">A new link in this collection</h2>
        <input v-model="newBm.url" type="url" placeholder="https://…" class="input-soft mb-3" required data-testid="page-new-bm-url" />
        <input v-model="newBm.title" placeholder="Title (optional)" class="input-soft mb-3" data-testid="page-new-bm-title" />
        <input v-model="newBm.tags" placeholder="Tags (comma separated)" class="input-soft mb-3" />
        <textarea v-model="newBm.description" placeholder="Why save it?" rows="2" class="input-soft resize-none mb-5"></textarea>
        <div class="flex justify-end gap-2">
          <button type="button" class="btn-ghost" @click="showNewBm = false">Cancel</button>
          <button type="submit" class="btn-primary" data-testid="page-new-bm-save">Save</button>
        </div>
      </form>
    </div>
  </div>
  <EmptyState v-else title="Collection not found" />
</template>
