<script setup>
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useBookmarksStore } from '@/stores/bookmarks'
import { useUIStore } from '@/stores/ui'
import PageHeader from '@/components/PageHeader.vue'
import EmptyState from '@/components/EmptyState.vue'
import { fromNow } from '@/lib/date'
import { ArrowLeft, Plus, X, ExternalLink, Trash2, Edit3, Save, Bookmark as BookmarkIcon, PenLine } from 'lucide-vue-next'
import { onKeyStroke } from '@vueuse/core'

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

const showEditBm = ref(false)
const editBmId = ref(null)
const editBmForm = ref({ title: '', url: '', description: '', tags: '', pageId: null })

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
async function remove(b) { if (await ui.confirm({ message: 'Remove bookmark?', title: 'Remove Bookmark' })) await bookmarks.remove(b.id) }
async function detach(b) { await bookmarks.update(b.id, { pageId: null }); ui.showToast('Moved to loose bookmarks', 'success') }
async function removePage() {
  if (!await ui.confirm({ message: `Remove "${page.value.title}"? Bookmarks inside will be detached, not deleted.`, title: 'Remove Collection' })) return
  await bookmarks.removePage(props.id)
  router.push('/bookmarks')
}

function startEditBookmark(b) {
  editBmId.value = b.id
  editBmForm.value = {
    title: b.title || '',
    url: b.url,
    description: b.description || '',
    tags: (b.tags || []).join(', '),
    pageId: b.pageId || null
  }
  showEditBm.value = true
}

async function saveBookmarkEdit() {
  if (!editBmForm.value.url.trim()) return
  const tagsArr = editBmForm.value.tags.split(',').map(t => t.trim()).filter(Boolean)
  await bookmarks.update(editBmId.value, {
    ...editBmForm.value,
    tags: tagsArr
  })
  showEditBm.value = false
  ui.showToast('Bookmark updated', 'success')
}

async function closeEditBookmark() {
  const original = bookmarks.bookmarks.find(b => b.id === editBmId.value)
  if (original) {
    const isModified = editBmForm.value.url.trim() !== (original.url || '') ||
      editBmForm.value.title.trim() !== (original.title || '') ||
      editBmForm.value.description.trim() !== (original.description || '') ||
      editBmForm.value.tags.trim() !== (original.tags || []).join(', ') ||
      editBmForm.value.pageId !== (original.pageId || null)
    if (isModified) {
      if (!await ui.confirm({ title: 'Discard changes?', message: 'You have unsaved changes. Discard them?' })) return
    }
  }
  showEditBm.value = false
}

const searchQuery = ref('')
const selectedTagFilter = ref('')

const allTagsInCollection = computed(() => {
  const tags = new Set()
  list.value.forEach(b => {
    if (b.tags) b.tags.forEach(t => tags.add(t))
  })
  return Array.from(tags)
})

const filteredList = computed(() => {
  let res = list.value
  const q = searchQuery.value.trim().toLowerCase()
  if (q) {
    res = res.filter(b => 
      (b.title || '').toLowerCase().includes(q) ||
      (b.url || '').toLowerCase().includes(q) ||
      (b.description || '').toLowerCase().includes(q) ||
      (b.tags || []).some(t => t.toLowerCase().includes(q))
    )
  }
  const tag = selectedTagFilter.value
  if (tag) {
    res = res.filter(b => (b.tags || []).includes(tag))
  }
  return res
})

function toggleTagFilter(tag) {
  if (selectedTagFilter.value === tag) {
    selectedTagFilter.value = ''
  } else {
    selectedTagFilter.value = tag
  }
}

onKeyStroke('Escape', (e) => {
  if (showNewBm.value) {
    e.preventDefault()
    showNewBm.value = false
  } else if (showEditBm.value) {
    e.preventDefault()
    closeEditBookmark()
  } else if (editing.value) {
    e.preventDefault()
    editing.value = false
  }
})
</script>

<template>
  <div v-if="page" class="px-8 md:px-12 py-10 max-w-7xl mx-auto" data-testid="bookmark-page-detail">
    <button @click="router.back()" class="btn-ghost mb-4 text-sm" data-testid="page-back">
      <ArrowLeft class="w-3.5 h-3.5" /> Back
    </button>

    <template v-if="editing">
      <div class="card p-7 mb-8" data-testid="page-edit-card">
        <div class="flex gap-3 mb-3">
          <input v-model="draft.emoji" maxlength="2" class="input-soft text-3xl !w-16 text-center"
            data-testid="page-edit-emoji" />
          <input v-model="draft.title" class="input-soft flex-1 text-2xl font-serif" data-testid="page-edit-title" />
        </div>
        <textarea v-model="draft.description" rows="2" class="input-soft resize-none mb-3" placeholder="Description…"
          data-testid="page-edit-desc" />
        <input v-model="draft.tags" placeholder="Tags (comma separated)" class="input-soft mb-4"
          data-testid="page-edit-tags" />
        <div class="flex justify-end gap-2">
          <button class="btn-ghost" @click="editing = false">Cancel</button>
          <button class="btn-primary" @click="saveEdit" data-testid="page-save">
            <Save class="w-4 h-4" /> Save
          </button>
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
              <span v-for="t in page.tags" :key="t"
                class="text-[11px] px-2 py-0.5 rounded-full bg-elevated text-ink-2">{{ t }}</span>
            </div>
          </div>
        </div>
        <div class="flex gap-2">
          <button class="btn-ghost" @click="startEdit" data-testid="page-edit">
            <Edit3 class="w-4 h-4" /> Edit
          </button>
          <button class="btn-ghost !text-pri-critical" @click="removePage" data-testid="page-delete">
            <Trash2 class="w-4 h-4" />
          </button>
          <button class="btn-primary" @click="showNewBm = true" data-testid="page-add-bookmark">
            <Plus class="w-4 h-4" /> Add bookmark <span class="kbd ml-1.5 !bg-canvas/20 !border-canvas/10 !text-canvas select-none">⌘1</span>
          </button>
        </div>
      </header>
    </template>

    <!-- FILTER BAR -->
    <div v-if="list.length" class="mb-4 flex flex-wrap gap-3 items-center justify-between" data-testid="bm-filter-bar">
      <input v-model="searchQuery" placeholder="Search in collection..." 
        class="input-soft max-w-xs !py-1.5 !px-3 text-xs" data-testid="bm-filter-search" />
      <div v-if="allTagsInCollection.length" class="flex flex-wrap gap-1 items-center">
        <span class="text-[10px] overline text-ink-3 mr-1">Tags:</span>
        <button v-for="t in allTagsInCollection" :key="t" 
          @click="toggleTagFilter(t)"
          class="text-[10px] px-2 py-0.5 rounded transition-all select-none"
          :class="selectedTagFilter === t ? 'bg-ink text-canvas border border-ink' : 'bg-elevated hover:bg-line text-ink-2 border border-line/40'">
          #{{ t }}
        </button>
      </div>
    </div>

    <!-- SINGLE-LINE LIST VIEW -->
    <div v-if="filteredList.length" class="card divide-y divide-line/60 overflow-hidden" data-testid="page-bookmark-list">
      <div v-for="b in filteredList" :key="b.id" 
        class="py-2 px-4 hover:bg-canvas/40 group transition-all duration-300 flex items-center justify-between gap-4"
        :data-testid="`page-bookmark-${b.id}`">
        <div class="flex items-center gap-3 min-w-0 flex-1">
          <BookmarkIcon class="w-3.5 h-3.5 text-ink-3 shrink-0" />
          <span class="font-serif text-sm font-medium text-ink truncate max-w-[200px] sm:max-w-[300px] shrink-0" 
            :title="b.description ? `${b.title || b.url} — ${b.description}` : (b.title || b.url)">
            {{ b.title || b.url }}
          </span>
          <span class="text-ink-3/40 shrink-0 text-xs">|</span>
          <a :href="b.url" target="_blank" @click.prevent="openBookmark(b)" 
            class="text-[11px] text-ink-3 hover:text-pri-strategic truncate hover:underline flex-1 min-w-0">
            {{ b.url }}
          </a>
          <div v-if="b.tags?.length" class="flex gap-1 shrink-0">
            <span v-for="t in b.tags" :key="t" 
              class="text-[9px] font-medium px-1.5 py-0.2 rounded bg-line/60 text-ink-2 border border-line/30 select-none">
              #{{ t }}
            </span>
          </div>
        </div>
        
        <div class="flex items-center gap-3 shrink-0">
          <div class="text-[10px] text-ink-3/60 select-none">opened {{ fromNow(b.lastViewedAt) }}</div>
          <div class="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5">
            <button class="relative group btn-ghost !p-1" @click="openBookmark(b)" :data-testid="`page-bm-open-${b.id}`">
              <ExternalLink class="w-3.5 h-3.5" />
              <span class="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 hidden group-hover:block z-30 px-2 py-1 text-[10px] font-semibold bg-ink text-canvas rounded-lg shadow-md whitespace-nowrap pointer-events-none select-none border border-canvas/10">
                Open Link
                <span class="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-ink"></span>
              </span>
            </button>
            <button class="relative group btn-ghost !p-1" @click="startEditBookmark(b)" :data-testid="`page-bm-edit-${b.id}`">
              <PenLine class="w-3.5 h-3.5" />
              <span class="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 hidden group-hover:block z-30 px-2 py-1 text-[10px] font-semibold bg-ink text-canvas rounded-lg shadow-md whitespace-nowrap pointer-events-none select-none border border-canvas/10">
                Edit
                <span class="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-ink"></span>
              </span>
            </button>
            <button class="relative group btn-ghost !p-1 text-xs" @click="detach(b)" :data-testid="`page-bm-detach-${b.id}`">
              ↶
              <span class="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 hidden group-hover:block z-30 px-2 py-1 text-[10px] font-semibold bg-ink text-canvas rounded-lg shadow-md whitespace-nowrap pointer-events-none select-none border border-canvas/10">
                Move out of collection
                <span class="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-ink"></span>
              </span>
            </button>
            <button class="relative group btn-ghost !p-1 hover:text-pri-critical" @click="remove(b)" :data-testid="`page-bm-delete-${b.id}`">
              <Trash2 class="w-3.5 h-3.5" />
              <span class="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 hidden group-hover:block z-30 px-2 py-1 text-[10px] font-semibold bg-ink text-canvas rounded-lg shadow-md whitespace-nowrap pointer-events-none select-none border border-canvas/10">
                Delete
                <span class="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-ink"></span>
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
    <div v-else-if="list.length" class="text-center py-8 text-ink-3 text-sm card p-6">No bookmarks match the search/filters.</div>
    <EmptyState v-else title="Empty collection" hint="Add a bookmark to begin." />

    <!-- New bookmark modal -->
    <div v-if="showNewBm" class="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4">
      <div class="fixed inset-0 bg-ink/40 backdrop-blur-sm" @click="showNewBm = false"></div>
      <form @submit.prevent="createBookmark" class="relative w-full max-w-md card p-8 animate-rise-in">
        <button type="button" class="absolute top-4 right-4 btn-ghost !p-1.5" @click="showNewBm = false">
          <X class="w-4 h-4" />
        </button>
        <div class="overline">Add to {{ page.title }}</div>
        <h2 class="font-serif text-2xl mt-1 mb-5">A new link in this collection</h2>
        <input v-model="newBm.url" type="url" placeholder="https://…" class="input-soft mb-3" required
          data-testid="page-new-bm-url" />
        <input v-model="newBm.title" placeholder="Title (optional)" class="input-soft mb-3"
          data-testid="page-new-bm-title" />
        <input v-model="newBm.tags" placeholder="Tags (comma separated)" class="input-soft mb-3" />
        <textarea v-model="newBm.description" placeholder="Why save it?" rows="2"
          class="input-soft resize-none mb-5"></textarea>
        <div class="flex justify-end gap-2">
          <button type="button" class="btn-ghost" @click="showNewBm = false">Cancel</button>
          <button type="submit" class="btn-primary" data-testid="page-new-bm-save">Save</button>
        </div>
      </form>
    </div>

    <!-- Edit bookmark modal -->
    <div v-if="showEditBm" class="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4"
      data-testid="edit-bookmark-modal">
      <div class="fixed inset-0 bg-ink/40 backdrop-blur-sm" @click="closeEditBookmark"></div>
      <form @submit.prevent="saveBookmarkEdit" class="relative w-full max-w-md card p-8 animate-rise-in">
        <button type="button" class="absolute top-4 right-4 btn-ghost !p-1.5" @click="closeEditBookmark">
          <X class="w-4 h-4" />
        </button>
        <div class="overline">Edit bookmark</div>
        <h2 class="font-serif text-2xl mt-1 mb-5">Update bookmark</h2>
        <input v-model="editBmForm.url" type="url" placeholder="https://…" class="input-soft mb-3" required
          data-testid="edit-bookmark-url" />
        <input v-model="editBmForm.title" placeholder="Title (optional)" class="input-soft mb-3"
          data-testid="edit-bookmark-title" />
        <input v-model="editBmForm.tags" placeholder="Tags (comma separated)" class="input-soft mb-3"
          data-testid="edit-bookmark-tags" />
        <label class="block mb-3"><span class="overline block mb-1">Collection</span>
          <select v-model="editBmForm.pageId" class="input-block text-sm" data-testid="edit-bookmark-page">
            <option :value="null">- none (loose) -</option>
            <option v-for="p in bookmarks.pages" :key="p.id" :value="p.id">{{ p.emoji }} {{ p.title }}</option>
          </select>
        </label>
        <textarea v-model="editBmForm.description" placeholder="Why save it?" rows="2"
          class="input-soft resize-none mb-5" data-testid="edit-bookmark-description"></textarea>
        <div class="flex justify-end gap-2">
          <button type="button" class="btn-ghost" @click="closeEditBookmark">Cancel</button>
          <button type="submit" class="btn-primary" data-testid="edit-bookmark-save">Save</button>
        </div>
      </form>
    </div>
  </div>
  <EmptyState v-else title="Collection not found" />
</template>
