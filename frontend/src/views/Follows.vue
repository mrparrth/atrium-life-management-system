<script setup>
import { ref, computed, onMounted } from 'vue'
import { useFollowsStore } from '@/stores/follows'
import PageHeader from '@/components/PageHeader.vue'
import EmptyState from '@/components/EmptyState.vue'
import { Plus, X, Search, Globe, Trash2, ArrowUpRight, Link, Star, PenLine } from 'lucide-vue-next'

const followsStore = useFollowsStore()

const showModal = ref(false)
const editingItem = ref(null)

// Categories
const baseCategories = ['health', 'freelancing', 'social media', 'webdev', 'Inspiration']
const customCategories = ref([])
const newCustomCategory = ref('')
const selectedCategory = ref('')

import { useSettingsStore } from '@/stores/settings'
import { useUIStore } from '@/stores/ui'
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

// Brand logos path variables (using simple SVG structures for clean styling)
const BRAND_SVG_PATHS = {
  x: "M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z",
  linkedin: "M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452z",
  instagram: "M12 2.163c3.204 0 3.584.012 4.85.07 1.166.052 1.798.243 2.219.406.567.22.97.483 1.393.906.423.423.686.826.906 1.393.163.42.354 1.053.406 2.219.058 1.266.07 1.646.07 4.85s-.012 3.584-.07 4.85c-.052 1.166-.243 1.798-.406 2.219-.22.567-.483.97-.906 1.393-.423.423-.826.686-1.393.906-.42.163-1.053.354-2.219.406-1.266.058-1.646.07-4.85.07s-3.584-.012-4.85-.07c-1.166-.052-1.798-.243-2.219-.406-.567-.22-.97-.483-1.393-.906-.423-.423-.686-.826-.906-1.393-.163-.42-.354-1.053-.406-2.219-.058-1.266-.07-1.646-.07-4.85s.012-3.584.07-4.85c.052-1.166.243-1.798.406-2.219.22-.567.483-.97.906-1.393.423-.423.826-.686 1.393-.906.42-.163 1.053-.354 2.219-.406.84-.037 1.177-.05 3.584-.05h.066zm0 2.163c-3.14 0-3.518.012-4.757.068-1.147.053-1.77.247-2.185.407-.55.213-.943.467-1.357.882-.413.414-.668.807-.881 1.357-.16.415-.353 1.038-.407 2.185-.056 1.239-.068 1.617-.068 4.757s.012 3.518.068 4.757c.053 1.147.247 1.77.407 2.185.213.55.467.943.882 1.357.414.413.807.668 1.357.881.415.16 1.038.353 2.185.407 1.239.056 1.617.068 4.757.068s3.518-.012 4.757-.068c1.147-.053 1.77-.247 2.185-.407.55-.213.943-.467 1.357-.882.413-.414.668-.807.881-1.357.16-.415.353-1.038.407-2.185.056-1.239.068-1.617.068-4.757s-.012-3.518-.068-4.757c-.053-1.147-.247-1.77-.407-2.185-.213-.55-.467-.943-.882-1.357-.414-.413-.807-.668-1.357-.881-.415-.16-1.038-.353-2.185-.407-1.239-.056-1.617-.068-4.757-.068z",
  threads: "M12.186 24h-.007c-3.581-.024-6.334-1.205-8.184-3.509C2.35 18.44 1.5 15.586 1.472 12.01v-.017c.03-3.579.879-6.43 2.525-8.482C5.845 1.205 8.6.024 12.18 0h.014c2.746.02 5.043.725 6.826 2.098c1.677 1.29 2.858 3.13 3.509 5.467l-2.04.569c-1.104-3.96-3.898-5.984-8.304-6.015c-2.91.022-5.11.936-6.54 2.717C4.307 6.504 3.616 8.914 3.589 12c.027 3.086.718 5.496 2.057 7.164c1.43 1.783 3.631 2.698 6.54 2.717c2.623-.02 4.358-.631 5.8-2.045c1.647-1.613 1.618-3.593 1.09-4.798c-.31-.71-.873-1.3-1.634-1.75c-.192 1.352-.622 2.446-1.284 3.272c-.886 1.102-2.14 1.704-3.73 1.79c-1.202.065-2.361-.218-3.259-.801c-1.063-.689-1.685-1.74-1.752-2.964c-.065-1.19.408-2.285 1.33-3.082c.88-.76 2.119-1.207 3.583-1.291a14 14 0 0 1 3.02.142c-.126-.742-.375-1.332-.75-1.757c-.513-.586-1.308-.883-2.359-.89h-.029c-.844 0-1.992.232-2.721 1.32l-1.757-1.18c.98-1.454 2.568-2.256 4.478-2.256h.044c3.194.02 5.097 1.975 5.287 5.388q.163.07.321.142c1.49.7 2.58 1.761 3.154 3.07c.797 1.82.871 4.79-1.548 7.158c-1.85 1.81-4.094 2.628-7.277 2.65Zm1.003-11.69q-.362 0-.739.021c-1.836.103-2.98.946-2.916 2.143c.067 1.256 1.452 1.839 2.784 1.767c1.224-.065 2.818-.543 3.086-3.71a10.5 10.5 0 0 0-2.215-.221",
  upwork: "M18.561 13.158c-1.102 0-2.135-.467-3.074-1.227l.228-1.076l.008-.042c.207-1.143.849-3.06 2.839-3.06a2.705 2.705 0 0 1 2.703 2.703a2.707 2.707 0 0 1-2.704 2.702m0-8.14c-2.539 0-4.51 1.649-5.31 4.366c-1.22-1.834-2.148-4.036-2.687-5.892H7.828v7.112a2.55 2.55 0 0 1-2.547 2.548a2.55 2.55 0 0 1-2.545-2.548V3.492H0v7.112c0 2.914 2.37 5.303 5.281 5.303c2.913 0 5.283-2.389 5.283-5.303v-1.19c.529 1.107 1.182 2.229 1.974 3.221l-1.673 7.873h2.797l1.213-5.71c1.063.679 2.285 1.109 3.686 1.109c3 0 5.439-2.452 5.439-5.45c0-3-2.439-5.439-5.439-5.439"
}

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

function onUrlInput() {
  const url = form.value.url?.trim()
  if (!url) return

  // Intelligent platform detection based on typed or pasted URL
  const val = url.toLowerCase()
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
  }
}

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
  if (e.target.value === 'ADD_NEW') {
    newCategoryInputVal.value = ''
    showCustomCategoryPrompt.value = true
    // Temporarily reset value so they can select it again if they cancel
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
  let items = followsStore.items

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
</script>

<template>
  <div class="px-8 md:px-12 py-10 max-w-7xl mx-auto" data-testid="follows-view">
    <PageHeader overline="Memory" title="Follows"
      sub="Network directory of inspiring creators, designers, and strategists. Learn from the best.">
      <template #right>
        <button class="btn-primary" @click="openAddModal" data-testid="add-follows-btn">
          <Plus class="w-4 h-4" /> Add Person
        </button>
      </template>
    </PageHeader>

    <!-- Filters and Categories -->
    <div class="flex flex-col md:flex-row gap-4 mb-8">
      <div class="card px-4 py-2.5 flex items-center gap-3 md:w-[400px] shrink-0">
        <Search class="w-4 h-4 text-ink-3" />
        <input v-model="q" class="bg-transparent outline-none flex-1 text-sm"
          placeholder="Search profiles by name, takeaways or links…" />
      </div>

      <div class="flex-1 flex gap-2 overflow-x-auto pb-2 md:pb-0 items-center">
        <button class="px-4 py-2 rounded-full text-xs font-semibold border transition-all capitalize"
          :class="!selectedCategory ? 'bg-ink text-canvas border-ink' : 'bg-surface text-ink-2 border-line hover:border-line-2'"
          @click="selectedCategory = ''">
          All categories
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
          class="w-6 h-6 rounded-full bg-canvas border border-line hover:border-line-2 text-ink-2 hover:text-ink flex items-center justify-center shrink-0 transition-all"
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
          <span class="font-serif text-sm font-semibold text-ink leading-tight flex items-center gap-1">
            <span>{{ item.name }}</span>
            <Star v-if="item.important" class="w-3 h-3 fill-amber-500 text-amber-500 shrink-0" />
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
    <EmptyState v-else title="No follows tracked"
      hint="Add creators and developers you seek alignment or insights from." />

    <!-- Add/Edit Modal (Scoped Esc handling on form itself rather than window prevents event handler unmount warnings) -->
    <div v-if="showModal" class="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div class="fixed inset-0 bg-ink/40 backdrop-blur-sm" @click="showModal = false"></div>
      <form @submit.prevent="save" @keydown.esc="showModal = false"
        class="relative w-full max-w-xl card p-8 animate-rise-in max-h-[90vh] overflow-y-auto">
        <button type="button" class="absolute top-4 right-4 btn-ghost !p-1.5" @click="showModal = false">
          <X class="w-4 h-4" />
        </button>
        <div class="overline">{{ editingItem ? 'Modify Follow' : 'Add Person' }}</div>
        <h2 class="font-serif text-2xl mt-1 mb-5">{{ editingItem ? 'Update details' : 'Track new creator' }}</h2>

        <!-- Important toggle option -->
        <div class="flex items-center gap-2 mb-5 px-1">
          <button type="button" @click="form.important = !form.important"
            class="flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-semibold transition-all select-none"
            :class="form.important ? 'border-amber-400 bg-amber-500/10 text-amber-600 dark:text-amber-400' : 'border-line bg-surface text-ink-2 hover:border-line-2'">
            <Star class="w-3.5 h-3.5" :class="form.important ? 'fill-amber-500 text-amber-500' : ''" />
            <span>{{ form.important ? 'Important Contact' : 'Mark as Important' }}</span>
          </button>
        </div>

        <!-- Name and Category side-by-side -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 items-end mb-4">
          <div class="v-field-group">
            <input v-model="form.name" placeholder=" " class="v-field-input text-base font-semibold" id="follow-name"
              required />
            <label for="follow-name" class="v-field-label text-sm">Full Name *</label>
          </div>

          <div class="v-field-group">
            <div class="flex-1 relative">
              <!-- Custom select trigger block -->
              <div @click="categoryDropdownOpen = !categoryDropdownOpen"
                class="v-field-select text-sm capitalize flex items-center justify-between border border-line rounded-lg px-3 py-2.5 bg-surface cursor-pointer min-h-[48px] select-none">
                <span>{{ form.category || 'Select category...' }}</span>
                <span class="text-xs text-ink-3">▼</span>
              </div>
              <label class="v-field-label v-field-label--floating text-xs">Category</label>

              <!-- Custom select dropdown list popover -->
              <div v-if="categoryDropdownOpen"
                class="absolute left-0 right-0 mt-1 bg-surface border border-line rounded-xl shadow-xl z-50 max-h-72 overflow-y-auto p-1.5 space-y-0.5">
                <div v-for="cat in categories" :key="cat"
                  class="flex items-center justify-between px-3 py-2 rounded-lg text-sm hover:bg-canvas transition-colors cursor-pointer capitalize"
                  @click="form.category = cat; categoryDropdownOpen = false">
                  <span>{{ cat }}</span>
                  <button v-if="!baseCategories.includes(cat)" type="button" @click.stop="removeCustomCategory(cat)"
                    class="p-1 rounded text-ink-3 hover:text-pri-interruptive hover:bg-pri-critical-bg transition-colors"
                    title="Delete category">
                    <X class="w-3.5 h-3.5" />
                  </button>
                </div>
                <div class="border-t border-line my-1"></div>
                <div
                  class="px-3 py-2 rounded-lg text-sm hover:bg-canvas transition-colors cursor-pointer text-pri-strategic font-medium flex items-center gap-1.5"
                  @click="newCategoryInputVal = ''; showCustomCategoryPrompt = true; categoryDropdownOpen = false">
                  <Plus class="w-3.5 h-3.5" /> Add Custom Category...
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Platform link Builder -->
        <div class="p-4 bg-canvas/60 border border-line rounded-xl mb-4">

          <div class="flex gap-3 mb-3">
            <div class="w-1/3">
              <label class="block text-[10px] uppercase text-ink-3 mb-1">Platform</label>
              <select v-model="form.platform"
                class="w-full bg-surface border border-line rounded-lg px-2.5 py-2 text-xs select-none">
                <option value="x">X / Twitter</option>
                <option value="linkedin">LinkedIn</option>
                <option value="instagram">Instagram</option>
                <option value="threads">Threads</option>
                <option value="upwork">Upwork</option>
              </select>
            </div>

            <div class="flex-1 relative flex items-end">
              <div class="w-full relative">
                <input v-model="form.url" placeholder="URL or handle (e.g. @username)"
                  class="w-full bg-surface border border-line rounded-lg pl-3 pr-8 py-2 text-xs" @input="onUrlInput" />
                <!-- External Link Icon next to the text box if valid url -->
                <a v-if="isValidUrl" :href="form.url" target="_blank"
                  class="absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-3 hover:text-ink transition-colors"
                  title="Open link in browser">
                  <ArrowUpRight class="w-3.5 h-3.5" />
                </a>
              </div>
            </div>
          </div>
        </div>

        <!-- Reason / Note field positioned at the very end -->
        <div class="v-field-group mb-6">
          <textarea v-model="form.reason" placeholder=" " rows="4"
            class="v-field-input py-2 resize-none font-sans text-xs leading-relaxed" id="follow-reason" />
          <label for="follow-reason" class="v-field-label text-sm">Reason for following / Insights & Lessons</label>
        </div>

        <div class="flex justify-end gap-2">
          <button type="button" class="btn-ghost" @click="showModal = false">Cancel</button>
          <button type="submit" class="btn-primary">Save changes</button>
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

        <div class="v-field-group mb-4">
          <input v-model="newCategoryInputVal" placeholder=" " class="v-field-input text-sm" id="new-custom-cat"
            required @keydown.enter.prevent="submitCustomCategory" />
          <label for="new-custom-cat" class="v-field-label text-xs">Category Name</label>
        </div>

        <div class="flex justify-end gap-2">
          <button type="button" class="btn-ghost text-xs" @click="showCustomCategoryPrompt = false">Cancel</button>
          <button type="button" class="btn-primary text-xs" @click="submitCustomCategory">Add Category</button>
        </div>
      </div>
    </div>
  </div>
</template>
