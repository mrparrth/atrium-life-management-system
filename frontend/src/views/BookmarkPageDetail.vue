<script setup>
import { computed, ref, watch, nextTick, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useBookmarksStore } from '@/stores/bookmarks'
import { useUIStore } from '@/stores/ui'
import { useSettingsStore } from '@/stores/settings'
import PageHeader from '@/components/PageHeader.vue'
import EmptyState from '@/components/EmptyState.vue'
import VInput from '@/components/VInput.vue'
import VUrlInput from '@/components/VUrlInput.vue'
import VSelect from '@/components/VSelect.vue'
import VTagSelect from '@/components/VTagSelect.vue'
import VRow from '@/components/VRow.vue'
import VTextarea from '@/components/VTextarea.vue'
import { fromNow } from '@/lib/date'
import { getTagStyle } from '@/lib/tags'
import { ArrowLeft, Plus, X, ExternalLink, Trash2, Edit3, Save, Bookmark as BookmarkIcon, PenLine, Layers } from 'lucide-vue-next'
import { onKeyStroke } from '@vueuse/core'

const props = defineProps({ id: String })
const router = useRouter()
const bookmarks = useBookmarksStore()
const ui = useUIStore()
const settingsStore = useSettingsStore()

const page = computed(() => bookmarks.pages.find(p => p.id === props.id))
const list = computed(() => bookmarks.bookmarksInPage(props.id))

const showNewBm = ref(false)
const newBm = ref({ title: '', url: '', description: '', category: 'work', tags: '' })

const editing = ref(false)
const draft = ref({ title: '', description: '', emoji: '', tags: [] })

const showEditBm = ref(false)
const editBmId = ref(null)
const editBmForm = ref({ title: '', url: '', description: '', category: 'work', tags: '', pageId: null })

const baseCategories = ['work', 'personal', 'inspiration', 'reference', 'reading list']
const categories = computed(() => {
  const customCats = settingsStore.get('bookmarks_custom_categories', [])
  const all = [...baseCategories, ...customCats]
  bookmarks.items.forEach(item => {
    if (item.category && !all.includes(item.category)) {
      all.push(item.category)
    }
  })
  return all
})

const showCustomCategoryPrompt = ref(false)
const newCategoryInputVal = ref('')
const categoryDropdownOpen = ref(false)
const editCategoryDropdownOpen = ref(false)

async function addCustomCategory(newCatName) {
  const clean = newCatName.trim().toLowerCase()
  if (clean && !categories.value.includes(clean)) {
    const current = settingsStore.get('bookmarks_custom_categories', [])
    const updated = [...current, clean]
    await settingsStore.set('bookmarks_custom_categories', updated)
    return clean
  }
  return null
}

function submitCustomCategory() {
  const val = newCategoryInputVal.value.trim()
  if (val) {
    addCustomCategory(val).then(clean => {
      if (clean) {
        if (showNewBm.value) {
          newBm.value.category = clean
        } else if (showEditBm.value) {
          editBmForm.value.category = clean
        }
      }
    })
  }
  showCustomCategoryPrompt.value = false
}

function onCategoryChange(e, type) {
  const val = e.target.value
  if (val === 'custom-add') {
    newCategoryInputVal.value = ''
    showCustomCategoryPrompt.value = true
    if (type === 'new') {
      newBm.value.category = 'work'
    } else {
      editBmForm.value.category = 'work'
    }
  }
}

const favoriteTagsList = computed(() => {
  const tagsStr = settingsStore.get('favorite_bookmark_tags', '')
  return tagsStr
    ? tagsStr.split(',').map(t => t.trim().toLowerCase()).filter(Boolean)
    : ['work', 'personal', 'inspiration', 'resource', 'reading']
})

const tagColorsMap = computed(() => settingsStore.get('bookmark_tag_colors', {}))

function toggleTagInForm(form, tag) {
  const currentTags = form.tags
    ? form.tags.split(',').map(t => t.trim().toLowerCase()).filter(Boolean)
    : []

  if (currentTags.includes(tag)) {
    form.tags = currentTags.filter(t => t !== tag).join(', ')
  } else {
    currentTags.push(tag)
    form.tags = currentTags.join(', ')
  }
}

function handleGlobalClick(e) {
  if (categoryDropdownOpen.value && !e.target.closest('.category-select-container-new')) {
    categoryDropdownOpen.value = false
  }
  if (editCategoryDropdownOpen.value && !e.target.closest('.category-select-container-edit')) {
    editCategoryDropdownOpen.value = false
  }
}

onMounted(async () => {
  await settingsStore.load()
  window.addEventListener('click', handleGlobalClick)
})

onUnmounted(() => {
  window.removeEventListener('click', handleGlobalClick)
})

function startEdit() {
  if (!page.value) return
  draft.value = {
    title: page.value.title,
    description: page.value.description || '',
    emoji: page.value.emoji || '◗',
    tags: page.value.tags || [],
  }
  editing.value = true
}
async function saveEdit() {
  await bookmarks.updatePage(props.id, {
    title: draft.value.title.trim() || page.value.title,
    description: draft.value.description,
    emoji: draft.value.emoji || '◗',
    tags: draft.value.tags,
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
    category: newBm.value.category,
    tags: newBm.value.tags.split(',').map(t => t.trim()).filter(Boolean),
    pageId: props.id,
  })
  newBm.value = { title: '', url: '', description: '', category: 'work', tags: '' }
  showNewBm.value = false
}

async function openBookmark(b) { await bookmarks.markViewed(b.id); window.open(b.url, '_blank') }
async function remove(b) { if (await ui.confirm({ message: 'Remove bookmark?', title: 'Remove Bookmark' })) await bookmarks.remove(b.id) }
async function detach(b) { await bookmarks.update(b.id, { pageId: null }); ui.showToast('Moved to loose bookmarks', 'success') }
async function removePage() {
  if (!await ui.confirm({ message: `Remove "${page.value.title}"? Bookmarks inside it will be detached, not deleted.`, title: 'Remove Collection' })) return
  await bookmarks.removePage(props.id)
  router.push('/bookmarks')
}

function startEditBookmark(b) {
  editBmId.value = b.id
  editBmForm.value = {
    title: b.title || '',
    url: b.url,
    description: b.description || '',
    category: b.category || 'work',
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
  const original = bookmarks.items.find(b => b.id === editBmId.value)
  if (original) {
    const isModified = editBmForm.value.url.trim() !== (original.url || '') ||
      editBmForm.value.title.trim() !== (original.title || '') ||
      editBmForm.value.description.trim() !== (original.description || '') ||
      editBmForm.value.tags.trim() !== (original.tags || []).join(', ') ||
      editBmForm.value.pageId !== (original.pageId || null) ||
      editBmForm.value.category !== (original.category || 'work')
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

const newBmUrlInput = ref(null)
const editBmUrlInput = ref(null)

watch(showNewBm, (open) => {
  if (open) {
    nextTick(() => {
      newBmUrlInput.value?.focus()
    })
  }
})

watch(showEditBm, (open) => {
  if (open) {
    nextTick(() => {
      editBmUrlInput.value?.focus()
    })
  }
})

// ── Bulk import ──────────────────────────────────────────────
const showBulkModal = ref(false)
const bulkText = ref('')
const bulkLoading = ref(false)
const bulkTextareaRef = ref(null)

watch(showBulkModal, (open) => {
  if (open) {
    bulkText.value = ''
    nextTick(() => bulkTextareaRef.value?.focus())
  }
})

function parseBulkEntries(raw) {
  const urlRegex = /https?:\/\/[^\s,;|→]+/g
  const results = []

  const lines = raw.split(/\n/).map(s => s.trim()).filter(Boolean)

  for (const line of lines) {
    const urls = [...line.matchAll(urlRegex)].map(m => m[0])
    if (!urls.length) {
      // Maybe comma/semicolon separated plain URLs within a single line
      continue
    }
    if (urls.length === 1) {
      const url = urls[0]
      // Strip the URL and any separator chars → | : – — from the remainder
      const title = line
        .replace(url, '')
        .replace(/[→|:–—]+/g, '')
        .trim()
      results.push({ url, title })
    } else {
      // Multiple URLs on same line — no title for any
      for (const url of urls) results.push({ url, title: '' })
    }
  }

  // Fallback: if line-split found nothing, try splitting on comma/semicolon/whitespace
  if (!results.length) {
    raw.split(/[\n,;]+|\s+/).map(s => s.trim()).forEach(s => {
      try { if (s && new URL(s)) results.push({ url: s, title: '' }) } catch { }
    })
  }

  return results
}

async function submitBulk() {
  const entries = parseBulkEntries(bulkText.value)
  if (!entries.length) return
  bulkLoading.value = true
  const added = []
  for (const { url, title } of entries) {
    const bm = await bookmarks.add({ url, title, description: '', tags: [], pageId: props.id })
    if (bm) added.push(bm)
  }
  bulkLoading.value = false
  showBulkModal.value = false
  ui.showToast(`Added ${added.length} bookmark${added.length !== 1 ? 's' : ''}`, 'success')
  if (added.length > 0) startEditBookmark(added[0])
}
</script>

<template>
  <div v-if="page" class="px-8 md:px-12 py-10 max-w-7xl mx-auto" data-testid="bookmark-page-detail">
    <button @click="router.back()" class="btn-ghost mb-4 text-sm" data-testid="page-back">
      <ArrowLeft class="w-3.5 h-3.5" /> Back
    </button>

    <template v-if="editing">
      <div class="card overflow-hidden mb-6" data-testid="page-edit-card">
        <!-- Row 1: Icon + Title + Actions -->
        <div class="flex items-center gap-3 px-4 py-3">
          <div style="width: 52px; flex-shrink: 0">
            <VInput v-model="draft.emoji" label="Icon" id="page-edit-emoji" data-testid="page-edit-emoji"
              maxlength="2" />
          </div>
          <div class="flex-1">
            <VInput v-model="draft.title" label="Title" id="page-edit-title" data-testid="page-edit-title" />
          </div>
          <div class="flex gap-2 shrink-0">
            <button class="btn-ghost text-sm" @click="editing = false">Cancel</button>
            <button class="btn-primary text-sm" @click="saveEdit" data-testid="page-save">
              <Save class="w-3.5 h-3.5" /> Save
            </button>
          </div>
        </div>
        <!-- Row 2: Description | Tags -->
        <div class="flex">
          <div class="flex-1 px-4 py-3">
            <VTextarea v-model="draft.description" label="Description" id="page-edit-desc" data-testid="page-edit-desc"
              :rows="1" autogrow />
          </div>
          <div class="flex-1 px-4 py-3">
            <VTagSelect v-model="draft.tags" :available-tags="favoriteTagsList" label="Collection Tags"
              id="page-edit-tags" data-testid="page-edit-tags" />
          </div>
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
                class="text-[11px] font-semibold px-2 py-0.5 rounded-xl border select-none" :style="getTagStyle(t, tagColorsMap)">#{{
                t }}</span>
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
          <button class="btn-ghost" @click="showBulkModal = true" data-testid="page-bulk-add">
            <Layers class="w-4 h-4" /> Add in bulk
          </button>
          <button class="btn-primary" @click="showNewBm = true" data-testid="page-add-bookmark">
            <Plus class="w-4 h-4" /> Add bookmark <span
              class="kbd ml-1.5 !bg-canvas/20 !border-canvas/10 !text-canvas select-none">⌘1</span>
          </button>
        </div>
      </header>
    </template>

    <!-- SINGLE-LINE LIST VIEW -->
    <div v-if="filteredList.length" class="card divide-y divide-line/60" data-testid="page-bookmark-list">
      <div v-for="b in filteredList" :key="b.id"
        class="py-2 px-4 hover:bg-canvas/40 transition-all duration-300 flex items-center justify-between gap-4 cursor-pointer"
        :data-testid="`page-bookmark-${b.id}`" @click.self="startEditBookmark(b)">
        <div class="flex items-start gap-3 min-w-0 flex-1">
          <BookmarkIcon class="w-3.5 h-3.5 text-ink-3 shrink-0 mt-0.5" />
          <span class="font-serif text-sm font-normal text-ink truncate max-w-[200px] sm:max-w-[300px] shrink-0"
            :title="b.description ? `${b.title || b.url} — ${b.description}` : (b.title || b.url)">
            {{ b.title || b.url }}
          </span>
          <span class="text-ink-3/40 shrink-0 text-xs mt-0.5">|</span>
          <a :href="b.url" target="_blank" @click.prevent="openBookmark(b)"
            class="text-[11px] text-ink-3 hover:text-pri-strategic truncate hover:underline flex-1 min-w-0 mt-0.5">
            {{ b.url }}
          </a>
          <div v-if="b.tags?.length" class="flex gap-1 shrink-0">
            <span v-for="t in b.tags" :key="t"
              class="text-[9px] font-medium px-1.5 py-0.2 rounded-xl select-none border" :style="getTagStyle(t, tagColorsMap)">
              #{{ t }}
            </span>
          </div>
        </div>

        <div class="flex items-center gap-3 shrink-0">
          <div class="text-[10px] text-ink-3/60 select-none">opened {{ fromNow(b.lastViewedAt) }}</div>
          <div class="flex items-center gap-2">
            <button class="group/btn relative btn-ghost !p-1.5" @click="openBookmark(b)"
              :data-testid="`page-bm-open-${b.id}`">
              <ExternalLink class="w-3.5 h-3.5" />
              <span class="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover/btn:block z-40 px-2 py-1 text-[10px] font-semibold bg-ink text-canvas rounded-lg shadow-md whitespace-nowrap select-none border border-canvas/10">
                Open link
              </span>
            </button>
            <button class="group/btn relative btn-ghost !p-1.5" @click="startEditBookmark(b)"
              :data-testid="`page-bm-edit-${b.id}`">
              <PenLine class="w-3.5 h-3.5" />
              <span class="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover/btn:block z-40 px-2 py-1 text-[10px] font-semibold bg-ink text-canvas rounded-lg shadow-md whitespace-nowrap select-none border border-canvas/10">
                Edit
              </span>
            </button>
            <button class="group/btn relative btn-ghost !p-1.5 text-xs leading-none" @click="detach(b)"
              :data-testid="`page-bm-detach-${b.id}`">
              ↶
              <span class="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover/btn:block z-40 px-2 py-1 text-[10px] font-semibold bg-ink text-canvas rounded-lg shadow-md whitespace-nowrap select-none border border-canvas/10">
                Move out
              </span>
            </button>
            <button class="group/btn relative btn-ghost !p-1.5 hover:text-pri-critical" @click="remove(b)"
              :data-testid="`page-bm-delete-${b.id}`">
              <Trash2 class="w-3.5 h-3.5" />
              <span class="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover/btn:block z-40 px-2 py-1 text-[10px] font-semibold bg-ink text-canvas rounded-lg shadow-md whitespace-nowrap select-none border border-canvas/10">
                Delete
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
    <div v-else-if="list.length" class="text-center py-8 text-ink-3 text-sm card p-6">No bookmarks match the
      search/filters.
    </div>
    <EmptyState v-else title="Empty collection" hint="Add a bookmark to begin." />

    <!-- Bulk import modal -->
    <div v-if="showBulkModal" class="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div class="fixed inset-0 bg-ink/40 backdrop-blur-sm animate-fade-in" @click="showBulkModal = false"></div>
      <div class="relative w-full max-w-xl card p-8 animate-rise-in">
        <button type="button" class="absolute top-4 right-4 btn-ghost !p-1.5" @click="showBulkModal = false">
          <X class="w-4 h-4" />
        </button>
        <div class="overline">Bulk import</div>
        <h2 class="font-serif text-2xl mt-1 mb-1">Add multiple links</h2>
        <p class="text-ink-3 text-xs mb-4">
          One entry per line. Supports <code class="bg-elevated px-1 rounded text-ink-2">Title → URL</code>,
          <code class="bg-elevated px-1 rounded text-ink-2">Title | URL</code>, or bare URLs.
          Multiple URLs on one line are split by comma or semicolon.
        </p>
        <textarea ref="bulkTextareaRef" v-model="bulkText" rows="7"
          class="v-field-input resize-none w-full text-sm font-mono mb-4"
          placeholder="Web design → https://curated.design&#10;Landing pages | https://onepagelove.com&#10;https://example.com, https://another.com" />
        <!-- Live preview -->
        <div v-if="parseBulkEntries(bulkText).length" class="mb-4 border border-line rounded-xl overflow-hidden">
          <div class="bg-elevated px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-ink-3">
            Preview — {{ parseBulkEntries(bulkText).length }} entr{{ parseBulkEntries(bulkText).length !== 1 ? 'ies' :
            'y'
            }} detected
          </div>
          <div class="divide-y divide-line/60 max-h-40 overflow-y-auto">
            <div v-for="(entry, i) in parseBulkEntries(bulkText)" :key="i" class="flex items-center gap-3 px-3 py-2">
              <span v-if="entry.title" class="text-xs font-semibold text-ink shrink-0 max-w-[160px] truncate">{{
                entry.title
                }}</span>
              <span v-else class="text-[10px] text-ink-3 italic shrink-0">no title</span>
              <span class="text-ink-3/40 text-xs shrink-0">→</span>
              <span class="text-[11px] text-ink-3 truncate min-w-0">{{ entry.url }}</span>
            </div>
          </div>
        </div>
        <div class="flex items-center justify-between">
          <span class="text-xs text-ink-3" v-if="!parseBulkEntries(bulkText).length">No valid URLs detected yet</span>
          <span v-else></span>
          <div class="flex gap-2">
            <button class="btn-ghost" @click="showBulkModal = false">Cancel</button>
            <button class="btn-primary" :disabled="!parseBulkEntries(bulkText).length || bulkLoading"
              @click="submitBulk">
              <Layers class="w-4 h-4" />
              {{ bulkLoading ? 'Adding…' : `Add ${parseBulkEntries(bulkText).length}
              link${parseBulkEntries(bulkText).length
              !== 1 ? 's' : ''}` }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- New bookmark modal -->
    <div v-if="showNewBm" class="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div class="fixed inset-0 bg-ink/40 backdrop-blur-sm animate-fade-in" @click="showNewBm = false"></div>
      <form @submit.prevent="createBookmark" @keydown.meta.enter.prevent="createBookmark"
        @keydown.ctrl.enter.prevent="createBookmark"
        class="relative w-full max-w-md card p-8 animate-rise-in max-h-[90vh] overflow-y-auto">
        <button type="button" class="absolute top-4 right-4 btn-ghost !p-1.5" @click="showNewBm = false">
          <X class="w-4 h-4" />
        </button>
        <div class="overline">Add to {{ page.title }}</div>
        <h2 class="font-serif text-2xl mt-1 mb-5">A new link in this collection</h2>
        <div class="space-y-4">
          <VUrlInput ref="newBmUrlInput" v-model="newBm.url" label="URL *" id="page-new-bookmark-url" required
            data-testid="page-new-bm-url" />

          <VInput v-model="newBm.title" label="Title (optional)" id="page-new-bookmark-title"
            data-testid="page-new-bm-title" />

          <VTagSelect v-model="newBm.tags" :available-tags="favoriteTagsList" label="Tags (comma separated, optional)"
            id="page-new-bookmark-tags" />



          <VTextarea v-model="newBm.description" label="Why save it? (optional)" id="page-new-bookmark-desc" />
        </div>
        <div class="flex justify-end gap-2">
          <button type="button" class="btn-ghost" @click="showNewBm = false">Cancel</button>
          <button type="submit" class="btn-primary" data-testid="page-new-bm-save">
            Save <span
              class="kbd !bg-canvas/20 !border-canvas/10 !text-canvas select-none text-[9px] ml-1">⌘Enter</span>
          </button>
        </div>
      </form>
    </div>

    <!-- Edit bookmark modal -->
    <div v-if="showEditBm" class="fixed inset-0 z-50 flex items-center justify-center p-4"
      data-testid="edit-bookmark-modal">
      <div class="fixed inset-0 bg-ink/40 backdrop-blur-sm animate-fade-in" @click="closeEditBookmark"></div>
      <form @submit.prevent="saveBookmarkEdit" @keydown.meta.enter.prevent="saveBookmarkEdit"
        @keydown.ctrl.enter.prevent="saveBookmarkEdit"
        class="relative w-full max-w-md card p-8 animate-rise-in max-h-[90vh] overflow-y-auto">
        <button type="button" class="absolute top-4 right-4 btn-ghost !p-1.5" @click="closeEditBookmark">
          <X class="w-4 h-4" />
        </button>
        <div class="overline">Edit bookmark</div>
        <h2 class="font-serif text-2xl mt-1 mb-5">Update bookmark</h2>
        <div class="space-y-4">
          <VUrlInput ref="editBmUrlInput" v-model="editBmForm.url" label="URL *" id="page-edit-bookmark-url" required
            data-testid="edit-bookmark-url" />

          <VInput v-model="editBmForm.title" label="Title (optional)" id="page-edit-bookmark-title"
            data-testid="edit-bookmark-title" />

          <VTagSelect v-model="editBmForm.tags" :available-tags="favoriteTagsList"
            label="Tags (comma separated, optional)" id="page-edit-bookmark-tags" data-testid="edit-bookmark-tags" />

          <VSelect v-model="editBmForm.pageId" label="Collection" id="page-edit-bookmark-page"
            :options="bookmarks.pages" option-value="id" searchable placeholder="---none---"
            data-testid="page-edit-bookmark-page" />

          <VTextarea v-model="editBmForm.description" label="Why save it? (optional)" id="page-edit-bookmark-desc"
            data-testid="edit-bookmark-description" />
        </div>
        <div class="flex justify-end gap-2 mt-6">
          <button type="button" class="btn-ghost" @click="closeEditBookmark">Cancel</button>
          <button type="submit" class="btn-primary" data-testid="edit-bookmark-save">
            Save <span
              class="kbd !bg-canvas/20 !border-canvas/10 !text-canvas select-none text-[9px] ml-1">⌘Enter</span>
          </button>
        </div>
      </form>
    </div>

    <!-- Custom Category Prompt Dialog (Premium Design Overlay) -->
    <div v-if="showCustomCategoryPrompt" class="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div class="fixed inset-0 bg-ink/40 backdrop-blur-sm" @click="showCustomCategoryPrompt = false"></div>
      <div class="relative w-full max-w-sm card p-6 shadow-xl animate-rise-in">
        <button type="button" class="absolute top-4 right-4 btn-ghost !p-1.5" @click="showCustomCategoryPrompt = false">
          <X class="w-4 h-4" />
        </button>
        <div class="overline">New Category</div>
        <h3 class="font-serif text-lg font-semibold mt-1 mb-4">Add Custom Category</h3>

        <div class="v-field-group mb-4 text-left">
          <input v-model="newCategoryInputVal" placeholder=" " class="v-field-input text-sm" id="new-custom-cat-detail"
            required @keydown.enter.prevent="submitCustomCategory" />
          <label for="new-custom-cat-detail" class="v-field-label text-xs">Category Name</label>
        </div>

        <div class="flex justify-end gap-2">
          <button type="button" class="btn-ghost text-xs" @click="showCustomCategoryPrompt = false">Cancel</button>
          <button type="button" class="btn-primary text-xs" @click="submitCustomCategory">Add Category</button>
        </div>
      </div>
    </div>
  </div>
  <EmptyState v-else title="Collection not found" />
</template>
