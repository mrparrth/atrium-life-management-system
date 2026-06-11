<script setup>
import { ref, computed } from 'vue'
import { RouterLink } from 'vue-router'
import { useBookmarksStore } from '@/stores/bookmarks'
import { useUIStore } from '@/stores/ui'
import PageHeader from '@/components/PageHeader.vue'
import SectionHeader from '@/components/SectionHeader.vue'
import EmptyState from '@/components/EmptyState.vue'
import { fromNow } from '@/lib/date'
import { Plus, X, Bookmark as BookmarkIcon, Trash2, ExternalLink, FolderOpen, ArrowRight, PenLine } from 'lucide-vue-next'
import { onKeyStroke } from '@vueuse/core'

const bookmarks = useBookmarksStore()
const ui = useUIStore()

import { useRoute, useRouter } from 'vue-router'
const route = useRoute()
const router = useRouter()

const showNewBm = ref(false)
const showNewPage = ref(false)
const showEditBm = ref(false)
const editBmId = ref(null)

import { onMounted, watch } from 'vue'

function handleQuery() {
  if (route.query.new === 'bookmark') showNewBm.value = true
  if (route.query.new === 'collection') showNewPage.value = true
  if (route.query.new) router.replace({ query: {} })
}

onMounted(handleQuery)
watch(() => route.query, handleQuery)

const newBm = ref({ title: '', url: '', description: '', category: 'General', tags: '', pageId: null })
const newPage = ref({ title: '', description: '', emoji: '◗', tags: '' })
const editBmForm = ref({ title: '', url: '', description: '', tags: '', pageId: null })

const looseBookmarks = computed(() => bookmarks.looseBookmarks())

function tagsToArr(s) { return (s || '').split(',').map(t => t.trim()).filter(Boolean) }
function arrToTags(a) { return (a || []).join(', ') }

async function createBookmark() {
  if (!newBm.value.url.trim()) return
  await bookmarks.add({ ...newBm.value, tags: tagsToArr(newBm.value.tags) })
  newBm.value = { title: '', url: '', description: '', category: 'General', tags: '', pageId: null }
  showNewBm.value = false
}
async function createPage() {
  if (!newPage.value.title.trim()) return
  await bookmarks.addPage({ ...newPage.value, tags: tagsToArr(newPage.value.tags) })
  newPage.value = { title: '', description: '', emoji: '◗', tags: '' }
  showNewPage.value = false
  ui.showToast('Collection created', 'success')
}
async function openBookmark(b) { await bookmarks.markViewed(b.id); window.open(b.url, '_blank') }
async function remove(b) { if (await ui.confirm({ message: 'Remove bookmark?', title: 'Remove Bookmark' })) await bookmarks.remove(b.id) }
async function removePage(p) {
  if (!await ui.confirm({ message: `Remove "${p.title}"? Bookmarks inside it will be detached, not deleted.`, title: 'Remove Collection' })) return
  await bookmarks.removePage(p.id)
}

async function closeNewBookmark() {
  if (newBm.value.url.trim() || newBm.value.title.trim() || newBm.value.description.trim()) {
    if (!await ui.confirm({ title: 'Discard draft?', message: 'You have unsaved changes. Discard them?' })) return
  }
  showNewBm.value = false
}

async function closeNewCollection() {
  if (newPage.value.title.trim() || newPage.value.description.trim()) {
    if (!await ui.confirm({ title: 'Discard draft?', message: 'You have unsaved changes. Discard them?' })) return
  }
  showNewPage.value = false
}

function startEditBookmark(b) {
  editBmId.value = b.id
  editBmForm.value = {
    title: b.title || '',
    url: b.url,
    description: b.description || '',
    tags: arrToTags(b.tags),
    pageId: b.pageId || null
  }
  showEditBm.value = true
}

async function saveBookmarkEdit() {
  if (!editBmForm.value.url.trim()) return
  await bookmarks.update(editBmId.value, {
    ...editBmForm.value,
    tags: tagsToArr(editBmForm.value.tags)
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
                       editBmForm.value.tags.trim() !== arrToTags(original.tags) ||
                       editBmForm.value.pageId !== (original.pageId || null)
    if (isModified) {
      if (!await ui.confirm({ title: 'Discard changes?', message: 'You have unsaved changes. Discard them?' })) return
    }
  }
  showEditBm.value = false
}

onKeyStroke('Escape', (e) => {
  if (showNewBm.value) {
    e.preventDefault()
    closeNewBookmark()
  } else if (showNewPage.value) {
    e.preventDefault()
    closeNewCollection()
  } else if (showEditBm.value) {
    e.preventDefault()
    closeEditBookmark()
  }
})
</script>

<template>
  <div class="px-8 md:px-12 py-10 max-w-6xl mx-auto" data-testid="bookmarks-view">
    <PageHeader overline="Memory" title="Bookmarks"
      sub="Pages worth returning to - grouped into collections, or kept loose.">
      <template #right>
        <button class="btn-secondary" @click="showNewPage = true" data-testid="new-page-btn">
          <FolderOpen class="w-4 h-4" /> New collection <span class="kbd ml-1.5 font-sans select-none bg-elevated border-line text-ink-2">⌘2</span>
        </button>
        <button class="btn-primary" @click="showNewBm = true" data-testid="new-bookmark-btn">
          <Plus class="w-4 h-4" /> Add bookmark <span class="kbd ml-1.5 !bg-canvas/20 !border-canvas/10 !text-canvas select-none">⌘1</span>
        </button>
      </template>
    </PageHeader>

    <!-- COLLECTIONS -->
    <SectionHeader v-if="bookmarks.pages.length" overline="Collections" :title="`${bookmarks.pages.length} pages`"
      hint="Curated groups of related bookmarks." />
    <div v-if="bookmarks.pages.length" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 mb-12">
      <RouterLink v-for="p in bookmarks.pages" :key="p.id" :to="`/bookmarks/page/${p.id}`"
        class="card p-6 hover:border-line-2 transition-all duration-300 group flex flex-col gap-3"
        :data-testid="`bookmark-page-card-${p.id}`">
        <div class="flex items-start justify-between">
          <span class="text-3xl font-serif text-ink-2">{{ p.emoji || '◗' }}</span>
          <button @click.prevent="removePage(p)"
            class="btn-ghost !p-1.5 opacity-0 group-hover:opacity-100 hover:text-pri-critical"
            :data-testid="`bookmark-page-delete-${p.id}`">
            <Trash2 class="w-3.5 h-3.5" />
          </button>
        </div>
        <div>
          <div class="font-serif text-xl">{{ p.title }}</div>
          <p v-if="p.description" class="text-sm text-ink-2 mt-1 line-clamp-2">{{ p.description }}</p>
        </div>
        <div v-if="p.tags?.length" class="flex flex-wrap gap-1">
          <span v-for="t in p.tags" :key="t" class="text-[11px] px-2 py-0.5 rounded-full bg-elevated text-ink-2">{{ t
            }}</span>
        </div>
        <div class="mt-auto pt-3 border-t border-line text-xs text-ink-3 flex items-center justify-between">
          <span>{{ bookmarks.bookmarksInPage(p.id).length }} bookmark<span
              v-if="bookmarks.bookmarksInPage(p.id).length !== 1">s</span></span>
          <ArrowRight class="w-3 h-3" />
        </div>
      </RouterLink>
    </div>

    <!-- LOOSE BOOKMARKS -->
    <SectionHeader overline="Loose" :title="`${looseBookmarks.length} unfiled`"
      hint="Bookmarks not yet in a collection." />
    <div v-if="looseBookmarks.length" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
      <div v-for="b in looseBookmarks" :key="b.id"
        class="card p-4 group hover:border-line-2 hover:bg-canvas/20 transition-all duration-300 flex flex-col justify-between" :data-testid="`bookmark-card-${b.id}`">
        <div class="flex items-start justify-between gap-2 min-w-0">
          <div class="min-w-0 flex-1 space-y-1.5">
            <div class="font-serif text-base font-semibold text-ink leading-tight flex items-center gap-1.5">
              <BookmarkIcon class="w-3.5 h-3.5 text-ink-3 shrink-0" />
              <span class="truncate" :title="b.title || b.url">{{ b.title || b.url }}</span>
            </div>
            <p v-if="b.description" class="text-xs text-ink-2 line-clamp-1 leading-normal">{{ b.description }}</p>
            
            <div class="flex items-center gap-2 flex-wrap min-w-0">
              <a :href="b.url" target="_blank" @click.prevent="openBookmark(b)" 
                class="text-[10px] text-ink-3 hover:text-pri-strategic truncate hover:underline flex-1 min-w-0">
                {{ b.url }}
              </a>
              <div v-if="b.tags?.length" class="flex flex-wrap gap-1 shrink-0">
                <span v-for="t in b.tags" :key="t" 
                  class="text-[10px] font-medium px-2 py-0.5 rounded bg-line/60 text-ink-2 border border-line/30 select-none">
                  #{{ t }}
                </span>
              </div>
            </div>
            
            <div class="text-[10px] text-ink-3/70 leading-none">opened {{ fromNow(b.lastViewedAt) }}</div>
          </div>
          
          <div class="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5 shrink-0 self-start">
            <button class="btn-ghost !p-1" @click="openBookmark(b)" :data-testid="`bookmark-open-${b.id}`" title="Open Link">
              <ExternalLink class="w-3 h-3" />
            </button>
            <button class="btn-ghost !p-1" @click="startEditBookmark(b)" :data-testid="`bookmark-edit-${b.id}`" title="Edit">
              <PenLine class="w-3 h-3" />
            </button>
            <button class="btn-ghost !p-1 hover:text-pri-critical" @click="remove(b)" :data-testid="`bookmark-delete-${b.id}`" title="Delete">
              <Trash2 class="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>
    </div>
    <EmptyState v-else title="No loose bookmarks" hint="Every link has a home." />

    <!-- NEW BOOKMARK -->
    <div v-if="showNewBm" class="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4">
      <div class="fixed inset-0 bg-ink/40 backdrop-blur-sm" @click="closeNewBookmark"></div>
      <form @submit.prevent="createBookmark" class="relative w-full max-w-md card p-8 animate-rise-in">
        <button type="button" class="absolute top-4 right-4 btn-ghost !p-1.5" @click="closeNewBookmark">
          <X class="w-4 h-4" />
        </button>
        <div class="overline">New bookmark</div>
        <h2 class="font-serif text-2xl mt-1 mb-5">Preserve this</h2>
        <input v-model="newBm.url" type="url" placeholder="https://…" class="input-soft mb-3" required
          data-testid="new-bookmark-url" />
        <input v-model="newBm.title" placeholder="Title (optional)" class="input-soft mb-3"
          data-testid="new-bookmark-title" />
        <input v-model="newBm.tags" placeholder="Tags (comma separated)" class="input-soft mb-3"
          data-testid="new-bookmark-tags" />
        <label class="block mb-3"><span class="overline block mb-1">Collection</span>
          <select v-model="newBm.pageId" class="input-block text-sm" data-testid="new-bookmark-page">
            <option :value="null">- none (loose) -</option>
            <option v-for="p in bookmarks.pages" :key="p.id" :value="p.id">{{ p.emoji }} {{ p.title }}</option>
          </select>
        </label>
        <textarea v-model="newBm.description" placeholder="Why save it?" rows="2"
          class="input-soft resize-none mb-5"></textarea>
        <div class="flex justify-end gap-2">
          <button type="button" class="btn-ghost" @click="closeNewBookmark">Cancel</button>
          <button type="submit" class="btn-primary" data-testid="new-bookmark-save">Save</button>
        </div>
      </form>
    </div>

    <!-- EDIT BOOKMARK -->
    <div v-if="showEditBm" class="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4" data-testid="edit-bookmark-modal">
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

    <!-- NEW COLLECTION -->
    <div v-if="showNewPage" class="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4"
      data-testid="new-page-modal">
      <div class="fixed inset-0 bg-ink/40 backdrop-blur-sm" @click="closeNewCollection"></div>
      <form @submit.prevent="createPage" class="relative w-full max-w-md card p-8 animate-rise-in">
        <button type="button" class="absolute top-4 right-4 btn-ghost !p-1.5" @click="closeNewCollection">
          <X class="w-4 h-4" />
        </button>
        <div class="overline">New collection</div>
        <h2 class="font-serif text-2xl mt-1 mb-5">A page of related links</h2>
        <div class="flex gap-3 mb-3">
          <input v-model="newPage.emoji" maxlength="2" class="input-soft text-2xl !w-16 text-center"
            data-testid="new-page-emoji" />
          <input v-model="newPage.title" placeholder="Collection title…" class="input-soft flex-1 text-lg font-serif"
            required data-testid="new-page-title" />
        </div>
        <textarea v-model="newPage.description" placeholder="What's this collection for?" rows="2"
          class="input-soft resize-none mb-3" data-testid="new-page-desc"></textarea>
        <input v-model="newPage.tags" placeholder="Tags (comma separated)" class="input-soft mb-5"
          data-testid="new-page-tags" />
        <div class="flex justify-end gap-2">
          <button type="button" class="btn-ghost" @click="closeNewCollection">Cancel</button>
          <button type="submit" class="btn-primary" data-testid="new-page-save">Create</button>
        </div>
      </form>
    </div>
  </div>
</template>
