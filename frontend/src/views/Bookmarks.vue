<script setup>
import { ref, computed, nextTick } from 'vue'
import { RouterLink } from 'vue-router'
import { useBookmarksStore } from '@/stores/bookmarks'
import { useUIStore } from '@/stores/ui'
import { useSettingsStore } from '@/stores/settings'
import PageHeader from '@/components/PageHeader.vue'
import SectionHeader from '@/components/SectionHeader.vue'
import EmptyState from '@/components/EmptyState.vue'
import VInput from '@/components/VInput.vue'
import VUrlInput from '@/components/VUrlInput.vue'
import VSelect from '@/components/VSelect.vue'
import VTagSelect from '@/components/VTagSelect.vue'
import VRow from '@/components/VRow.vue'
import VTextarea from '@/components/VTextarea.vue'
import { getTagStyle } from '@/lib/tags'
import { fromNow } from '@/lib/date'
import { Plus, X, Bookmark as BookmarkIcon, Trash2, ExternalLink, FolderOpen, ArrowRight, PenLine, Search, Settings } from 'lucide-vue-next'
import { onKeyStroke } from '@vueuse/core'

const bookmarks = useBookmarksStore()
const ui = useUIStore()
const settingsStore = useSettingsStore()

import { useRoute, useRouter } from 'vue-router'
const route = useRoute()
const router = useRouter()

const showNewBm = ref(false)
const showNewPage = ref(false)
const showEditBm = ref(false)
const editBmId = ref(null)

import { onMounted, watch, onUnmounted } from 'vue'

const q = ref('')
const selectedCategory = ref('')

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

function handleGlobalClick(e) {
  if (categoryDropdownOpen.value && !e.target.closest('.category-select-container-new')) {
    categoryDropdownOpen.value = false
  }
  if (editCategoryDropdownOpen.value && !e.target.closest('.category-select-container-edit')) {
    editCategoryDropdownOpen.value = false
  }
}

function handleQuery() {
  if (route.query.new === 'bookmark') showNewBm.value = true
  if (route.query.new === 'collection') showNewPage.value = true
  if (route.query.new) router.replace({ query: {} })
}

onMounted(async () => {
  handleQuery()
  await settingsStore.load()
  window.addEventListener('click', handleGlobalClick)
})

onUnmounted(() => {
  window.removeEventListener('click', handleGlobalClick)
})

watch(() => route.query, handleQuery)

const favoriteTagsInput = ref('')
const isConfiguringTags = ref(false)

const favoriteTagsList = computed(() => {
  const tagsStr = settingsStore.get('favorite_bookmark_tags', '')
  return tagsStr
    ? tagsStr.split(',').map(t => t.trim().toLowerCase()).filter(Boolean)
    : ['work', 'personal', 'inspiration', 'resource', 'reading']
})

function saveFavoriteTags() {
  const cleaned = favoriteTagsInput.value
    .split(',')
    .map(t => t.trim().toLowerCase())
    .filter(Boolean)
    .join(', ')
  settingsStore.set('favorite_bookmark_tags', cleaned)
  isConfiguringTags.value = false
}

function startConfiguringTags() {
  favoriteTagsInput.value = settingsStore.get('favorite_bookmark_tags', 'work, personal, inspiration, resource, reading')
  isConfiguringTags.value = true
}

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

const newBm = ref({ title: '', url: '', description: '', category: 'work', tags: '', pageId: null })
const newPage = ref({ title: '', description: '', emoji: '◗', tags: '' })
const editBmForm = ref({ title: '', url: '', description: '', category: 'work', tags: '', pageId: null })

const filteredCollections = computed(() => {
  let list = bookmarks.pages
  const query = q.value.trim().toLowerCase()

  if (query) {
    list = list.filter(p => {
      const matchesCollection = (p.title || '').toLowerCase().includes(query) ||
        (p.description || '').toLowerCase().includes(query) ||
        (p.tags || []).some(t => t.toLowerCase().includes(query))
      if (matchesCollection) return true

      return bookmarks.items.some(b => b.pageId === p.id && (
        (b.title || '').toLowerCase().includes(query) ||
        (b.url || '').toLowerCase().includes(query) ||
        (b.description || '').toLowerCase().includes(query) ||
        (b.tags || []).some(t => t.toLowerCase().includes(query)) ||
        (b.category || '').toLowerCase().includes(query)
      ))
    })
  }

  return list
})

const filteredLooseBookmarks = computed(() => {
  let list = bookmarks.looseBookmarks()

  if (selectedCategory.value) {
    list = list.filter(x => x.category === selectedCategory.value)
  }

  const query = q.value.trim().toLowerCase()
  if (query) {
    list = list.filter(b =>
      (b.title || '').toLowerCase().includes(query) ||
      (b.url || '').toLowerCase().includes(query) ||
      (b.description || '').toLowerCase().includes(query) ||
      (b.tags || []).some(t => t.toLowerCase().includes(query)) ||
      (b.category || '').toLowerCase().includes(query)
    )
  }

  return list
})

const allMatchingBookmarks = computed(() => {
  const query = q.value.trim().toLowerCase()
  if (!query) return []
  let list = bookmarks.items

  if (selectedCategory.value) {
    list = list.filter(x => x.category === selectedCategory.value)
  }

  return list.filter(b =>
    (b.title || '').toLowerCase().includes(query) ||
    (b.url || '').toLowerCase().includes(query) ||
    (b.description || '').toLowerCase().includes(query) ||
    (b.tags || []).some(t => t.toLowerCase().includes(query)) ||
    (b.category || '').toLowerCase().includes(query)
  )
})

function tagsToArr(s) { return (s || '').split(',').map(t => t.trim()).filter(Boolean) }
function arrToTags(a) { return (a || []).join(', ') }

async function createBookmark() {
  if (!newBm.value.url.trim()) return
  await bookmarks.add({ ...newBm.value, tags: tagsToArr(newBm.value.tags) })
  newBm.value = { title: '', url: '', description: '', category: 'work', tags: '', pageId: null }
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
    pageId: b.pageId || null,
    category: b.category || 'work'
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
  const original = bookmarks.items.find(b => b.id === editBmId.value)
  if (original) {
    const isModified = editBmForm.value.url.trim() !== (original.url || '') ||
      editBmForm.value.title.trim() !== (original.title || '') ||
      editBmForm.value.description.trim() !== (original.description || '') ||
      editBmForm.value.tags.trim() !== arrToTags(original.tags) ||
      editBmForm.value.pageId !== (original.pageId || null) ||
      editBmForm.value.category !== (original.category || 'work')
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

const newBmUrlInput = ref(null)
const editBmUrlInput = ref(null)
const newPageEmojiInput = ref(null)

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

watch(showNewPage, (open) => {
  if (open) {
    nextTick(() => {
      newPageEmojiInput.value?.focus()
    })
  }
})

const focusedFields = ref({})
</script>

<template>
  <div class="px-8 md:px-12 py-10 max-w-7xl mx-auto" data-testid="bookmarks-view">
    <PageHeader overline="Memory" title="Bookmarks"
      sub="Pages worth returning to - grouped into collections, or kept loose.">
      <template #right>
        <button class="btn-secondary" @click="showNewPage = true" data-testid="new-page-btn">
          <FolderOpen class="w-4 h-4" /> New collection <span
            class="kbd ml-1.5 font-sans select-none bg-elevated border-line text-ink-2">⌘2</span>
        </button>
        <button class="btn-primary" @click="showNewBm = true" data-testid="new-bookmark-btn">
          <Plus class="w-4 h-4" /> Add bookmark <span
            class="kbd ml-1.5 !bg-canvas/20 !border-canvas/10 !text-canvas select-none">⌘1</span>
        </button>
      </template>
    </PageHeader>

    <!-- Filters row: Favorite tags left, Search right -->
    <div class="flex flex-col md:flex-row gap-4 mb-8 items-center justify-between">
      <!-- Left side: Favorite tags -->
      <div class="flex items-center gap-2 flex-wrap shrink-0 relative">
        <span class="text-xs uppercase font-bold tracking-wider text-ink-3">Favorite tags:</span>
        <button v-for="tag in favoriteTagsList" :key="tag"
          @click="q = q.includes(tag) ? q.replace(new RegExp('#?' + tag, 'i'), '').trim() : (q + ' #' + tag).trim()"
          class="text-xs font-semibold px-2.5 py-1 rounded transition-all cursor-pointer border" :class="q.toLowerCase().includes(tag)
            ? 'bg-pri-strategic/10 text-pri-strategic border-pri-strategic/30'
            : 'bg-surface text-ink-2 border-line hover:border-line-2'">
          #{{ tag }}
        </button>

        <div class="relative inline-block">
          <button @click="startConfiguringTags"
            class="btn-ghost !p-1.5 hover:text-pri-strategic ml-1 flex items-center justify-center rounded-lg border border-transparent hover:border-line"
            title="Edit Favorite Tags">
            <Settings class="w-3.5 h-3.5 text-ink-3" />
          </button>

          <!-- Popover Configurator -->
          <div v-if="isConfiguringTags"
            class="absolute left-1/2 -translate-x-1/2 mt-2 w-96 card p-4 shadow-xl border border-line z-50 animate-rise-in text-left bg-surface">
            <div class="text-[10px] font-bold uppercase tracking-wider text-ink-3 mb-2">Configure Favorite Tags</div>
            <input v-model="favoriteTagsInput"
              class="w-full bg-canvas border border-line rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:border-pri-strategic mb-4"
              placeholder="comma, separated, tags" @keyup.enter="saveFavoriteTags" />
            <div class="flex justify-end gap-1.5">
              <button type="button" @click="isConfiguringTags = false"
                class="btn-ghost text-[10px] !py-1 !px-2.5">Cancel</button>
              <button type="button" @click="saveFavoriteTags"
                class="btn-primary text-[10px] !py-1 !px-2.5">Save</button>
            </div>
          </div>
        </div>
      </div>

      <!-- Right side: Search bookmarks -->
      <div class="card px-4 py-2 flex items-center gap-3 flex-1 md:max-w-md w-full">
        <Search class="w-4 h-4 text-ink-3" />
        <input v-model="q" class="bg-transparent outline-none flex-1 text-sm"
          placeholder="Search bookmarks by title, description or tag…" />
      </div>
    </div>

    <!-- SEARCH RESULTS VIEW -->
    <template v-if="q.trim()">
      <SectionHeader overline="Search Results" :title="`Found ${allMatchingBookmarks.length} bookmarks`" />
      <div v-if="allMatchingBookmarks.length" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mb-12">
        <div v-for="b in allMatchingBookmarks" :key="b.id"
          class="card p-4 group hover:border-line-2 hover:bg-canvas/20 transition-all duration-300 flex flex-col justify-between cursor-pointer"
          :data-testid="`bookmark-card-${b.id}`" @click="startEditBookmark(b)">
          <div class="flex items-start justify-between gap-2 min-w-0">
            <div class="min-w-0 flex-1 space-y-1.5">
              <div class="font-serif text-base font-normal text-ink leading-tight flex items-start gap-1.5">
                <BookmarkIcon class="w-3.5 h-3.5 text-ink-3 shrink-0 mt-0.5" />
                <span class="truncate" :title="b.title || b.url">{{ b.title || b.url }}</span>
              </div>
              <p v-if="b.description" class="text-xs text-ink-2 line-clamp-1 leading-normal">{{ b.description }}</p>

              <div class="flex items-center gap-2 flex-wrap min-w-0">
                <a :href="b.url" target="_blank" @click.stop.prevent="openBookmark(b)"
                  class="text-[10px] text-ink-3 hover:text-pri-strategic truncate hover:underline flex-1 min-w-0">
                  {{ b.url }}
                </a>
                <div v-if="b.tags?.length" class="flex flex-wrap gap-1 shrink-0" @click.stop>
                  <span v-for="t in b.tags" :key="t"
                    class="text-[10px] font-medium px-2 py-0.5 rounded-xl select-none border"
                    :style="getTagStyle(t, tagColorsMap)">
                    #{{ t }}
                  </span>
                </div>
              </div>

              <div class="text-[10px] text-ink-3/70 leading-none">opened {{ fromNow(b.lastViewedAt) }}</div>
            </div>

            <div
              class="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5 shrink-0 self-start"
              @click.stop>
              <button class="btn-ghost !p-1" @click="openBookmark(b)" :data-testid="`bookmark-open-${b.id}`"
                title="Open Link">
                <ExternalLink class="w-3 h-3" />
              </button>
              <button class="btn-ghost !p-1" @click="startEditBookmark(b)" :data-testid="`bookmark-edit-${b.id}`"
                title="Edit">
                <PenLine class="w-3 h-3" />
              </button>
              <button class="btn-ghost !p-1 hover:text-pri-critical" @click="remove(b)"
                :data-testid="`bookmark-delete-${b.id}`" title="Delete">
                <Trash2 class="w-3 h-3" />
              </button>
            </div>
          </div>
        </div>
      </div>
      <EmptyState v-else title="No bookmarks match search" hint="Try searching for another keyword." />

      <SectionHeader overline="Collections" :title="`Found ${filteredCollections.length} collections`" />
      <div v-if="filteredCollections.length" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 mb-12">
        <RouterLink v-for="p in filteredCollections" :key="p.id" :to="`/bookmarks/page/${p.id}`"
          class="card p-3 hover:border-line-2 transition-all duration-300 group flex items-center gap-3.5"
          :data-testid="`bookmark-page-card-${p.id}`">
          <!-- Left side: Emoji icon -->
          <div
            class="w-10 h-10 rounded-xl bg-canvas flex items-center justify-center text-xl shadow-sm border border-line/30 shrink-0">
            {{ p.emoji || '◌' }}
          </div>
          <!-- Middle: Info stack -->
          <div class="flex-1 min-w-0">
            <div class="flex items-baseline justify-between gap-2">
              <h3
                class="font-serif text-sm text-ink font-normal truncate leading-tight group-hover:text-pri-strategic transition-colors">
                {{ p.title }}</h3>
              <span
                class="text-[9px] text-ink-3 font-semibold shrink-0 bg-canvas/60 px-1.5 py-0.5 rounded border border-line/20">
                {{bookmarks.items.filter(x => x.pageId === p.id).length}} items
              </span>
            </div>
            <p v-if="p.description" class="text-xs text-ink-3 truncate mt-0.5 leading-normal">{{ p.description }}</p>
          </div>
          <!-- Hover arrow indicator -->
          <div class="opacity-0 group-hover:opacity-100 transition-opacity text-ink-3 pr-0.5">
            <ArrowRight class="w-3.5 h-3.5" />
          </div>
        </RouterLink>
      </div>
      <EmptyState v-else title="No collections match search" hint="Try adjusting your filter terms." />
    </template>

    <template v-else>
      <!-- COLLECTIONS -->
      <SectionHeader v-if="filteredCollections.length" overline="Collections" />
      <div v-if="filteredCollections.length" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 mb-12">
        <RouterLink v-for="p in filteredCollections" :key="p.id" :to="`/bookmarks/page/${p.id}`"
          class="card p-3 hover:border-line-2 transition-all duration-300 group flex items-center gap-3.5"
          :data-testid="`bookmark-page-card-${p.id}`">
          <!-- Left side: Emoji icon -->
          <div
            class="w-10 h-10 rounded-xl bg-canvas flex items-center justify-center text-xl shadow-sm border border-line/30 shrink-0">
            {{ p.emoji || '◌' }}
          </div>
          <!-- Middle: Info stack -->
          <div class="flex-1 min-w-0">
            <div class="flex items-baseline justify-between gap-2">
              <h3
                class="font-serif text-sm text-ink font-normal truncate leading-tight group-hover:text-pri-strategic transition-colors">
                {{ p.title }}</h3>
              <span
                class="text-[9px] text-ink-3 font-semibold shrink-0 bg-canvas/60 px-1.5 py-0.5 rounded border border-line/20">
                {{bookmarks.items.filter(x => x.pageId === p.id).length}} items
              </span>
            </div>
            <p v-if="p.description" class="text-xs text-ink-3 truncate mt-0.5 leading-normal">{{ p.description }}</p>
          </div>
          <!-- Hover arrow indicator -->
          <div class="opacity-0 group-hover:opacity-100 transition-opacity text-ink-3 pr-0.5">
            <ArrowRight class="w-3.5 h-3.5" />
          </div>
        </RouterLink>
      </div>

      <!-- LOOSE BOOKMARKS -->
      <SectionHeader overline="Loose" />
      <div v-if="filteredLooseBookmarks.length" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        <div v-for="b in filteredLooseBookmarks" :key="b.id"
          class="card p-4 group hover:border-line-2 hover:bg-canvas/20 transition-all duration-300 flex flex-col justify-between cursor-pointer"
          :data-testid="`bookmark-card-${b.id}`" @click="startEditBookmark(b)">
          <div class="flex items-start justify-between gap-2 min-w-0">
            <div class="min-w-0 flex-1 space-y-1.5">
              <div class="font-serif text-base font-normal text-ink leading-tight flex items-start gap-1.5">
                <BookmarkIcon class="w-3.5 h-3.5 text-ink-3 shrink-0 mt-0.5" />
                <span class="truncate" :title="b.title || b.url">{{ b.title || b.url }}</span>
              </div>
              <p v-if="b.description" class="text-xs text-ink-2 line-clamp-1 leading-normal">{{ b.description }}</p>

              <div class="flex items-center gap-2 flex-wrap min-w-0">
                <a :href="b.url" target="_blank" @click.stop.prevent="openBookmark(b)"
                  class="text-[10px] text-ink-3 hover:text-pri-strategic truncate hover:underline flex-1 min-w-0">
                  {{ b.url }}
                </a>
                <div v-if="b.tags?.length" class="flex flex-wrap gap-1 shrink-0" @click.stop>
                  <span v-for="t in b.tags" :key="t"
                    class="text-[10px] font-medium px-2 py-0.5 rounded-xl select-none border"
                    :style="getTagStyle(t, tagColorsMap)">
                    #{{ t }}
                  </span>
                </div>
              </div>

              <div class="text-[10px] text-ink-3/70 leading-none">opened {{ fromNow(b.lastViewedAt) }}</div>
            </div>

            <div
              class="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5 shrink-0 self-start"
              @click.stop>
              <button class="btn-ghost !p-1" @click="openBookmark(b)" :data-testid="`bookmark-open-${b.id}`"
                title="Open Link">
                <ExternalLink class="w-3 h-3" />
              </button>
              <button class="btn-ghost !p-1" @click="startEditBookmark(b)" :data-testid="`bookmark-edit-${b.id}`"
                title="Edit">
                <PenLine class="w-3 h-3" />
              </button>
              <button class="btn-ghost !p-1 hover:text-pri-critical" @click="remove(b)"
                :data-testid="`bookmark-delete-${b.id}`" title="Delete">
                <Trash2 class="w-3 h-3" />
              </button>
            </div>
          </div>
        </div>
      </div>
      <EmptyState v-else title="No loose bookmarks" hint="Every link has a home." />
    </template>

    <!-- NEW BOOKMARK -->
    <div v-if="showNewBm" @keydown.window.esc="closeNewBookmark"
      class="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4">
      <div class="fixed inset-0 bg-ink/40 backdrop-blur-sm animate-fade-in" @click="closeNewBookmark"></div>
      <form @submit.prevent="createBookmark" @keydown.meta.enter.prevent="createBookmark"
        @keydown.ctrl.enter.prevent="createBookmark"
        class="relative w-full max-w-md card p-8 animate-rise-in overflow-visible my-auto">
        <button type="button" class="absolute top-4 right-4 btn-ghost !p-1.5" @click="closeNewBookmark">
          <X class="w-4 h-4" />
        </button>
        <div class="overline">New bookmark</div>
        <h2 class="font-serif text-2xl mt-1 mb-5">Preserve this</h2>

        <div class="space-y-4">
          <VUrlInput ref="newBmUrlInput" v-model="newBm.url" label="URL *" id="new-bookmark-url" required
            data-testid="new-bookmark-url" />

          <VInput v-model="newBm.title" label="Title (optional)" id="new-bookmark-title"
            data-testid="new-bookmark-title" />

          <VTagSelect v-model="newBm.tags" :available-tags="favoriteTagsList" label="Tags (comma separated, optional)"
            id="new-bookmark-tags" data-testid="new-bookmark-tags" />

          <VSelect v-model="newBm.pageId" label="Collection" id="new-bookmark-page" :options="bookmarks.pages"
            option-value="id" searchable placeholder="---none---" data-testid="new-bookmark-page" />

          <VTextarea v-model="newBm.description" label="Why save it? (optional)" id="new-bookmark-desc" />
        </div>

        <div class="flex justify-end gap-2">
          <button type="button" class="btn-ghost" @click="closeNewBookmark">Cancel</button>
          <button type="submit" class="btn-primary" data-testid="new-bookmark-save">
            Save <span
              class="kbd !bg-canvas/20 !border-canvas/10 !text-canvas select-none text-[9px] ml-1">⌘Enter</span>
          </button>
        </div>
      </form>
    </div>

    <!-- EDIT BOOKMARK -->
    <div v-if="showEditBm" @keydown.window.esc="closeEditBookmark"
      class="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4" data-testid="edit-bookmark-modal">
      <div class="fixed inset-0 bg-ink/40 backdrop-blur-sm animate-fade-in" @click="closeEditBookmark"></div>
      <form @submit.prevent="saveBookmarkEdit" @keydown.meta.enter.prevent="saveBookmarkEdit"
        @keydown.ctrl.enter.prevent="saveBookmarkEdit"
        class="relative w-full max-w-md card p-8 animate-rise-in overflow-visible my-auto">
        <button type="button" class="absolute top-4 right-4 btn-ghost !p-1.5" @click="closeEditBookmark">
          <X class="w-4 h-4" />
        </button>
        <div class="overline">Edit bookmark</div>
        <h2 class="font-serif text-2xl mt-1 mb-5">Update bookmark</h2>

        <div class="space-y-4">
          <VUrlInput ref="editBmUrlInput" v-model="editBmForm.url" label="URL *" id="edit-bookmark-url" required
            data-testid="edit-bookmark-url" />

          <VInput v-model="editBmForm.title" label="Title (optional)" id="edit-bookmark-title"
            data-testid="edit-bookmark-title" />

          <VTagSelect v-model="editBmForm.tags" :available-tags="favoriteTagsList"
            label="Tags (comma separated, optional)" id="edit-bookmark-tags" data-testid="edit-bookmark-tags" />

          <VSelect v-model="editBmForm.pageId" label="Collection" id="edit-bookmark-page" :options="bookmarks.pages"
            option-value="id" searchable placeholder="---none---" data-testid="edit-bookmark-page" />

          <VTextarea v-model="editBmForm.description" label="Why save it? (optional)" id="edit-bookmark-desc"
            data-testid="edit-bookmark-description" />
        </div>

        <div class="flex justify-end gap-2">
          <button type="button" class="btn-ghost" @click="closeEditBookmark">Cancel</button>
          <button type="submit" class="btn-primary" data-testid="edit-bookmark-save">
            Save <span
              class="kbd !bg-canvas/20 !border-canvas/10 !text-canvas select-none text-[9px] ml-1">⌘Enter</span>
          </button>
        </div>
      </form>
    </div>

    <!-- NEW COLLECTION -->
    <div v-if="showNewPage" @keydown.window.esc="closeNewCollection"
      class="fixed inset-0 z-50 flex items-center justify-center p-4" data-testid="new-page-modal">
      <div class="fixed inset-0 bg-ink/40 backdrop-blur-sm animate-fade-in" @click="closeNewCollection"></div>
      <form @submit.prevent="createPage" @keydown.meta.enter.prevent="createPage"
        @keydown.ctrl.enter.prevent="createPage" class="relative w-full max-w-md card p-8 animate-rise-in">
        <button type="button" class="absolute top-4 right-4 btn-ghost !p-1.5" @click="closeNewCollection">
          <X class="w-4 h-4" />
        </button>
        <div class="overline">New collection</div>
        <h2 class="font-serif text-2xl mt-1 mb-5">A page of related links</h2>

        <div class="flex flex-wrap -mx-2 mb-4">
          <div class="px-2 py-2 w-1/4 sm:w-1/6 shrink-0">
            <VInput ref="newPageEmojiInput" v-model="newPage.emoji" label="Emoji" id="new-page-emoji"
              data-testid="new-page-emoji" maxlength="2" class="text-center font-bold text-lg" />
            <div class="text-[9px] text-ink-3 mt-1 text-center whitespace-nowrap">
              <a href="https://emojipedia.org/" target="_blank" class="hover:underline hover:text-pri-strategic">find
                emojis
                ↗</a>
            </div>
          </div>
          <div class="px-2 py-2 w-3/4 sm:w-5/6 shrink-0">
            <VInput v-model="newPage.title" label="Collection Title *" id="new-page-title" data-testid="new-page-title"
              required />
          </div>

          <div class="px-2 py-2 w-full shrink-0">
            <VTextarea v-model="newPage.description" label="What's this collection for? (optional)" id="new-page-desc"
              data-testid="new-page-desc" :rows="2" />
          </div>

          <div class="px-2 py-2 w-full shrink-0 mb-2">
            <VTagSelect v-model="newPage.tags" :available-tags="favoriteTagsList" label="Collection Tags (optional)"
              id="new-page-tags" data-testid="new-page-tags" />
          </div>
        </div>

        <div class="flex justify-end gap-2">
          <button type="button" class="btn-ghost" @click="closeNewCollection">Cancel</button>
          <button type="submit" class="btn-primary" data-testid="new-page-save">
            Create <span
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

        <div class="mb-4">
          <VInput v-model="newCategoryInputVal" label="Category Name" id="new-custom-cat" required
            @keydown.enter.prevent="submitCustomCategory" />
        </div>

        <div class="flex justify-end gap-2">
          <button type="button" class="btn-ghost text-xs" @click="showCustomCategoryPrompt = false">Cancel</button>
          <button type="button" class="btn-primary text-xs" @click="submitCustomCategory">Add Category</button>
        </div>
      </div>
    </div>
  </div>
</template>
