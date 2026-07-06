<script setup>
import { ref, computed, onMounted, nextTick, watch } from 'vue'
import { useFollowsStore, BRAND_SVG_PATHS, getPlatformStyles } from '@/stores/follows'
import PageHeader from '@/components/PageHeader.vue'
import EmptyState from '@/components/EmptyState.vue'
import { Plus, X, Search, Globe, Trash2, ArrowUpRight, Link, Star, PenLine } from 'lucide-vue-next'

const followsStore = useFollowsStore()

const showModal = ref(false)
const editingItem = ref(null)

// Categories
const baseCategories = ['health', 'freelancing', 'social media', 'webdev', 'Inspiration']
const customCategories = ref([])
const selectedCategory = ref('')

import { useSettingsStore } from '@/stores/settings'
import { useUIStore } from '@/stores/ui'

import VInput from '@/components/VInput.vue'
import VSelect from '@/components/VSelect.vue'
import VTextarea from '@/components/VTextarea.vue'
import VRow from '@/components/VRow.vue'
import VCol from '@/components/VCol.vue'
import VUrlInput from '@/components/VUrlInput.vue'

const settingsStore = useSettingsStore()
const ui = useUIStore()

const categories = computed(() => {
  const customCats = settingsStore.get('follows_custom_categories', [])
  const all = [...baseCategories, ...customCats]
  // Add category values stored in existing items to prevent lock-outs
  followsStore.items.forEach(item => {
    if (item.category && !all.includes(item.category)) {
      all.push(item.category)
    }
  })
  return all
})

// Form state
const form = ref({
  name: '',
  category: 'freelancing',
  reason: '',
  platform: 'x',
  url: '',
  important: false
})

const showCustomCategoryPrompt = ref(false)
const newCategoryInputVal = ref('')
const categoryDropdownOpen = ref(false)

const isValidUrl = computed(() => {
  const url = form.value.url?.trim()
  if (!url) return false
  return url.startsWith('http://') || url.startsWith('https://')
})

// Watch url changes to intelligently detect and update the platform
watch(() => form.value.url, (newUrl) => {
  if (!newUrl) return
  const val = newUrl.trim().toLowerCase()
  if (val.includes('x.com') || val.includes('twitter.com')) {
    form.value.platform = 'x'
  } else if (val.includes('linkedin.com')) {
    form.value.platform = 'linkedin'
  } else if (val.includes('instagram.com')) {
    form.value.platform = 'instagram'
  } else if (val.includes('threads.net')) {
    form.value.platform = 'threads'
  } else if (val.includes('upwork.com')) {
    form.value.platform = 'upwork'
  } else if (val.includes('youtube.com') || val.includes('youtu.be')) {
    form.value.platform = 'youtube'
  }
})

onMounted(async () => {
  await followsStore.load()
})

async function addCustomCategory(newCatName) {
  const clean = newCatName.trim().toLowerCase()
  if (clean && !categories.value.includes(clean)) {
    const current = settingsStore.get('follows_custom_categories', [])
    const updated = [...current, clean]
    await settingsStore.set('follows_custom_categories', updated)
    form.value.category = clean
  }
}

async function removeCustomCategory(cat) {
  const confirmed = await ui.confirm({
    title: 'Delete Category?',
    message: `Are you sure you want to delete the custom category "${cat}"?`
  })
  if (confirmed) {
    const current = settingsStore.get('follows_custom_categories', [])
    const updated = current.filter(c => c !== cat)
    await settingsStore.set('follows_custom_categories', updated)
    if (selectedCategory.value === cat) {
      selectedCategory.value = ''
    }
    // Update any follows items using this category to fallback to 'freelancing'
    const affected = followsStore.items.filter(x => x.category === cat)
    for (const item of affected) {
      await followsStore.update(item.id, { category: 'freelancing' })
    }
  }
}

function handleCategoryChange(e) {
  const val = e.target.value
  if (val === 'custom-add') {
    newCategoryInputVal.value = ''
    showCustomCategoryPrompt.value = true
    form.value.category = 'freelancing'
  }
}

function submitCustomCategory() {
  const val = newCategoryInputVal.value.trim()
  if (val) {
    addCustomCategory(val)
  }
  showCustomCategoryPrompt.value = false
}

const q = ref('')

// Utility to figure out handle / name from profile URL
function getHandleFromUrl(url, fallback = 'unknown') {
  if (!url) return fallback
  const clean = url.trim().replace(/\/$/, '') // strip trailing slash
  if (!clean.includes('/')) {
    // Just a handle was added
    return clean.startsWith('@') ? clean : '@' + clean
  }
  try {
    const parts = clean.split('/')
    const last = parts[parts.length - 1]
    return last.startsWith('@') ? last : '@' + last
  } catch (_) {
    return fallback
  }
}

// Check if string is a handle or url. If handle, prepend platform domain on save.
function formatPlatformUrl(platform, input) {
  if (!input) return ''
  const val = input.trim()
  if (val.startsWith('http://') || val.startsWith('https://')) {
    return val
  }
  // If it's just a handle, generate the standard profile url
  const cleanHandle = val.replace(/^@/, '')
  if (platform === 'x') return `https://x.com/${cleanHandle}`
  if (platform === 'linkedin') return `https://linkedin.com/in/${cleanHandle}`
  if (platform === 'instagram') return `https://instagram.com/${cleanHandle}`
  if (platform === 'threads') return `https://threads.net/@${cleanHandle}`
  if (platform === 'upwork') return `https://upwork.com/fl/${cleanHandle}`
  if (platform === 'youtube') return `https://youtube.com/@${cleanHandle}`
  return val
}

// Compute primary display handle (usually from first available social URL)
function getPrimaryHandle(item) {
  return getHandleFromUrl(item.url)
}

function getPrimaryPlatform(item) {
  return item.platform || 'x'
}

function hasSocials(item) {
  return !!item.url
}

const filteredItems = computed(() => {
  let items = [...followsStore.items]

  if (selectedCategory.value) {
    items = items.filter(x => x.category === selectedCategory.value)
  }

  const query = q.value.trim().toLowerCase()
  if (query) {
    items = items.filter(x =>
      x.name.toLowerCase().includes(query) ||
      x.reason.toLowerCase().includes(query) ||
      (x.url || '').toLowerCase().includes(query)
    )
  }

  // Sort by name A to Z ascending
  items.sort((a, b) => a.name.localeCompare(b.name))

  return items
})

function openAddModal() {
  editingItem.value = null
  form.value = {
    name: '',
    category: 'freelancing',
    reason: '',
    platform: 'x',
    url: '',
    important: false
  }
  showModal.value = true
  nextTick(() => {
    const el = document.getElementById('follow-name')
    if (el) el.focus()
  })
}

function openEditModal(item) {
  editingItem.value = item

  // Extract correct fields with legacy database records support
  let initialPlatform = item.platform || ''
  let initialUrl = item.url || ''
  if (item.platforms && !initialUrl) {
    const order = ['x', 'linkedin', 'threads', 'instagram', 'upwork']
    for (const k of order) {
      if (item.platforms[k]) {
        initialPlatform = k
        initialUrl = item.platforms[k]
        break
      }
    }
  }

  form.value = {
    name: item.name,
    category: item.category,
    reason: item.reason,
    platform: initialPlatform || 'x',
    url: initialUrl,
    important: !!item.important
  }
  showModal.value = true
  nextTick(() => {
    const el = document.getElementById('follow-name')
    if (el) el.focus()
  })
}

async function save() {
  if (!form.value.name.trim()) return

  // Clean handle values to full urls
  form.value.url = formatPlatformUrl(form.value.platform, form.value.url)

  if (editingItem.value) {
    await followsStore.update(editingItem.value.id, form.value)
  } else {
    await followsStore.add(form.value)
  }
  showModal.value = false
}

async function removeItem(id) {
  const confirmed = await ui.confirm({
    title: 'Remove Contact?',
    message: 'Are you sure you want to remove this person from your list?'
  })
  if (confirmed) {
    await followsStore.remove(id)
  }
}

function handlePillClick(item) {
  if (item.url) {
    window.open(item.url, '_blank')
  } else {
    openEditModal(item)
  }
}

function handleGlobalKeydown(e) {
  if (e.key === 'Escape' && showModal.value) {
    showModal.value = false
  }
  if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && showModal.value) {
    e.preventDefault()
    save()
  }
  if ((e.metaKey || e.ctrlKey) && e.key === '1' && !showModal.value) {
    e.preventDefault()
    openAddModal()
  }
}

function handleGlobalClick(e) {
  if (categoryDropdownOpen.value && !e.target.closest('.category-select-container')) {
    categoryDropdownOpen.value = false
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleGlobalKeydown)
  window.addEventListener('click', handleGlobalClick)
})

import { onUnmounted } from 'vue'
onUnmounted(() => {
  window.removeEventListener('keydown', handleGlobalKeydown)
  window.removeEventListener('click', handleGlobalClick)
})
</script>

<template>
  <div class="px-8 md:px-12 py-10 max-w-7xl mx-auto" data-testid="follows-view">
    <PageHeader overline="Memory" title="Radar"
      sub="Network directory of inspiring creators, designers, and strategists.">
      <template #right>
        <button class="btn-primary" @click="openAddModal" data-testid="add-follows-btn">
          <Plus class="w-4 h-4" /> Add Person <span
            class="kbd ml-1.5 !bg-canvas/20 !border-canvas/10 !text-canvas select-none">⌘1</span>
        </button>
      </template>
    </PageHeader>

    <!-- Filters and Categories -->
    <div class="flex flex-col md:flex-row md:items-center gap-4 mb-8">
      <div class="card px-4 py-2.5 flex items-center gap-3 md:w-[400px] shrink-0">
        <Search class="w-4 h-4 text-ink-3" />
        <input v-model="q" class="bg-transparent outline-none flex-1 text-sm"
          placeholder="Search profiles by name, takeaways or links…" />
      </div>

      <div class="flex-1 flex gap-2 items-center">
        <span
          class="text-[10px] text-ink-3 uppercase tracking-wider font-semibold mr-1.5 shrink-0 select-none">Categories:</span>
        <button class="px-4 py-2 rounded-full text-xs font-semibold border transition-all capitalize"
          :class="!selectedCategory ? 'bg-ink text-canvas border-ink' : 'bg-surface text-ink-2 border-line hover:border-line-2'"
          @click="selectedCategory = ''">
          All
        </button>
        <div v-for="cat in categories" :key="cat" class="relative group/cat flex items-center">
          <button
            class="px-4 py-2 rounded-full text-xs font-semibold border transition-all whitespace-nowrap capitalize flex items-center gap-1.5"
            :class="selectedCategory === cat ? 'bg-ink text-canvas border-ink' : 'bg-surface text-ink-2 border-line hover:border-line-2'"
            @click="selectedCategory = cat">
            {{ cat }}
          </button>
          <!-- Display delete button on custom categories -->
          <button v-if="!baseCategories.includes(cat)" type="button" @click.stop="removeCustomCategory(cat)"
            class="absolute -top-1 -right-1 p-0.5 rounded-full bg-pri-interruptive text-canvas hover:opacity-90 opacity-0 group-hover/cat:opacity-100 transition-opacity shadow-sm"
            title="Delete category">
            <X class="w-2.5 h-2.5" />
          </button>
        </div>
      </div>
    </div>

    <!-- Pill View of Follow Profiles -->
    <div v-if="filteredItems.length" class="flex flex-wrap gap-2.5">
      <div v-for="item in filteredItems" :key="item.id"
        class="card !rounded-full pl-3.5 pr-2.5 py-1.5 transition-all duration-300 flex items-center gap-3 cursor-pointer select-none"
        :class="item.important ? '!border-amber-400 bg-amber-500/5 dark:bg-amber-500/10 hover:!border-amber-500 hover:shadow-sm hover:shadow-amber-500/10' : 'hover:border-line-2 hover:bg-canvas/50'"
        @click="handlePillClick(item)">

        <!-- Primary Platform Icon Link -->
        <a v-if="getPrimaryPlatform(item) && item.url" :href="item.url" target="_blank" @click.stop
          class="w-6 h-6 rounded-full border flex items-center justify-center shrink-0 transition-all"
          :class="getPlatformStyles(getPrimaryPlatform(item))"
          :title="`Open ${getPrimaryPlatform(item).toUpperCase()} Profile`">
          <svg v-if="BRAND_SVG_PATHS[getPrimaryPlatform(item)]" class="w-2.5 h-2.5 fill-current" viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg">
            <path :d="BRAND_SVG_PATHS[getPrimaryPlatform(item)]" />
          </svg>
        </a>
        <div v-else
          class="w-6 h-6 rounded-full bg-canvas border border-line flex items-center justify-center shrink-0 text-ink-3">
          <Globe class="w-3 h-3" />
        </div>

        <!-- Info -->
        <div class="flex flex-col">
          <span class="font-serif text-sm text-ink leading-tight flex items-center gap-1.5 flex-wrap">
            <span>{{ item.name }}</span>
            <span v-if="item.category"
              class="text-[9px] uppercase tracking-wider text-ink-3 font-semibold bg-canvas px-1.5 py-0.5 rounded-full border capitalize">
              {{ item.category }}
            </span>
          </span>
          <span v-if="getPrimaryHandle(item)" class="text-[10px] text-ink-3 leading-tight">{{ getPrimaryHandle(item)
            }}</span>
        </div>

        <!-- Action buttons on the right of the pill -->
        <div class="flex items-center gap-1 border-l border-line pl-2 ml-1">
          <button @click.stop="openEditModal(item)" class="text-ink-3 hover:text-ink transition-colors p-1"
            title="Edit details">
            <PenLine class="w-3.5 h-3.5" />
          </button>
          <button @click.stop="removeItem(item.id)" class="text-ink-3 hover:text-pri-interruptive transition-colors p-1"
            title="Remove contact">
            <X class="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
    <EmptyState v-else title="No radar sources tracked"
      hint="Add creators and developers you seek alignment or insights from." />

    <!-- Add/Edit Modal (Scoped Esc handling on form itself rather than window prevents event handler unmount warnings) -->
    <div v-if="showModal" class="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4">
      <div class="fixed inset-0 bg-ink/40 backdrop-blur-sm" @click="showModal = false"></div>
      <form @submit.prevent="save" @keydown.esc="showModal = false"
        class="relative w-full max-w-xl card p-8 animate-rise-in overflow-visible my-auto">
        <button type="button" class="absolute top-4 right-4 btn-ghost !p-1.5" @click="showModal = false">
          <X class="w-4 h-4" />
        </button>
        <div class="overline">{{ editingItem ? 'Modify Follow' : 'Add Person' }}</div>

        <!-- Header row with Title and Star toggle button inline -->
        <div class="flex items-center justify-between mt-1 mb-5 gap-4">
          <h2 class="font-serif text-2xl m-0">{{ editingItem ? 'Update details' : 'Track new creator' }}</h2>
          <button type="button" @click="form.important = !form.important"
            class="flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-semibold transition-all select-none shrink-0"
            :class="form.important ? 'border-amber-400 bg-amber-500/10 text-amber-600 dark:text-amber-400' : 'border-line bg-surface text-ink-2 hover:border-line-2'">
            <Star class="w-3.5 h-3.5" :class="form.important ? 'fill-amber-500 text-amber-500' : ''" />
            <span>{{ form.important ? 'Important' : 'Important' }}</span>
          </button>
        </div>

        <!-- Name and Category side-by-side -->
        <VRow>
          <VCol cols="12" sm="7">
            <VInput v-model="form.name" label="Name" id="follow-name" required />
          </VCol>

          <VCol cols="12" sm="5">
            <VSelect v-model="form.category" label="Category" id="follow-category" :options="categories" searchable
              @change="handleCategoryChange">
              <option value="custom-add">+ Add Custom Category...</option>
            </VSelect>
          </VCol>
        </VRow>

        <!-- Username and Platform side-by-side -->
        <VRow>
          <VCol cols="12" sm="7">
            <VUrlInput v-model="form.url" label="Username/Url" id="follow-url" />
          </VCol>

          <VCol cols="12" sm="5">
            <VSelect v-model="form.platform" label="Platform" id="follow-platform" :options="[
              { value: 'youtube', label: 'Youtube' },
              { value: 'linkedin', label: 'LinkedIn' },
              { value: 'instagram', label: 'Instagram' },
              { value: 'upwork', label: 'Upwork' },
              { value: 'x', label: 'X / Twitter' },
              { value: 'other', label: 'Others' },
            ]" option-value="value" option-label="label" />
          </VCol>
        </VRow>

        <!-- Reason / Note field positioned at the very end -->
        <VTextarea v-model="form.reason" label="Reason for following" id="follow-reason" autogrow />

        <div class="flex justify-end gap-3">
          <button type="button" class="btn-ghost" @click="showModal = false">Cancel</button>
          <button type="submit" class="btn-primary">
            Save changes <span class="kbd ml-1.5 !bg-canvas/20 !border-canvas/10 !text-canvas select-none">⌘↵</span>
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

        <VInput v-model="newCategoryInputVal" label="Category Name" id="new-custom-cat" required class="mb-4"
          @keydown.enter.prevent="submitCustomCategory" />

        <div class="flex justify-end gap-2">
          <button type="button" class="btn-ghost text-xs" @click="showCustomCategoryPrompt = false">Cancel</button>
          <button type="button" class="btn-primary text-xs" @click="submitCustomCategory">Add Category</button>
        </div>
      </div>
    </div>
  </div>
</template>
