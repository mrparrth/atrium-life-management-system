<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter, RouterLink } from 'vue-router'
import dayjs from 'dayjs'
import { useTasksStore } from '@/stores/tasks'
import { useProjectsStore } from '@/stores/projects'
import { useNotesStore } from '@/stores/notes'
import { useBookmarksStore } from '@/stores/bookmarks'
import { useGoalsStore } from '@/stores/goals'
import { useWishlistStore } from '@/stores/wishlist'
import { useFinanceStore } from '@/stores/finance'
import { useReviewsStore } from '@/stores/reviews'
import { useYearsStore } from '@/stores/years'
import { useUIStore } from '@/stores/ui'
import { useFollowsStore, BRAND_SVG_PATHS, getPlatformStyles } from '@/stores/follows'
import { todayFocus, upcomingTasks, staleProjects, memoryResurfacing, getProjectLastTouched } from '@/lib/resurface'
import { fromNow, isToday } from '@/lib/date'
import { inr } from '@/lib/money'
import { derivePriority } from '@/lib/priority'

import { backup as driveBackup } from '@/services/drive'
import PageHeader from '@/components/PageHeader.vue'
import SectionHeader from '@/components/SectionHeader.vue'
import TaskCard from '@/components/TaskCard.vue'
import EmptyState from '@/components/EmptyState.vue'
import { ArrowRight, FolderKanban, NotebookPen, Bookmark, BookOpen, Compass, PanelRightClose, PanelRightOpen, Target, Gift, ShieldAlert, RefreshCw, X } from 'lucide-vue-next'

const router = useRouter()
const tasks = useTasksStore()
const projects = useProjectsStore()
const notes = useNotesStore()
const bookmarks = useBookmarksStore()
const goals = useGoalsStore()
const wishlist = useWishlistStore()
const finance = useFinanceStore()
const reviews = useReviewsStore()
const years = useYearsStore()
const ui = useUIStore()
const follows = useFollowsStore()

const backupAlert = ref(null)
const retryingBackup = ref(false)

function checkBackupStatus() {
  const driveNeedsIntervention = localStorage.getItem('atrium.drive.backupNeedsIntervention') === 'true'
  const offlineNeedsIntervention = localStorage.getItem('atrium.offline.backupNeedsIntervention') === 'true'
  const driveError = localStorage.getItem('atrium.drive.lastBackupError')

  if (driveNeedsIntervention) {
    backupAlert.value = {
      type: 'drive',
      title: 'Google Drive Auto-Backup Failed',
      message: driveError || 'Auto-backup to Google Drive failed multiple times. Manual intervention or re-authentication required.'
    }
  } else if (offlineNeedsIntervention) {
    backupAlert.value = {
      type: 'offline',
      title: 'Local Disk Backup Failed',
      message: 'Automatic backup to your local directory failed. Please check folder permissions in Settings.'
    }
  } else {
    backupAlert.value = null
  }
}

async function retryBackupNow() {
  retryingBackup.value = true
  try {
    await driveBackup()
    ui.showToast('Backup completed successfully!', 'success')
    checkBackupStatus()
  } catch (err) {
    ui.showToast(err.message || 'Backup retry failed', 'error')
  } finally {
    retryingBackup.value = false
  }
}

function dismissBackupAlert() {
  backupAlert.value = null
}

const isSidebarCollapsed = ref(localStorage.getItem('dash-sidebar-collapsed') === 'true')

function toggleSidebar() {
  isSidebarCollapsed.value = !isSidebarCollapsed.value
  localStorage.setItem('dash-sidebar-collapsed', isSidebarCollapsed.value.toString())
}

function handleKeydown(e) {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) return
  if ((e.metaKey || e.ctrlKey) && e.key === '1') {
    e.preventDefault()
    e.stopPropagation()
    toggleSidebar()
  } else if ((e.metaKey || e.ctrlKey) && e.key === '2') {
    e.preventDefault()
    e.stopPropagation()
    openDailyJournal()
  }
}

const currentDate = ref(dayjs())
let timer = null

onMounted(async () => {
  await goals.load()
  await wishlist.load()
  await follows.load()
  checkBackupStatus()
  window.addEventListener('keydown', handleKeydown, { capture: true })
  window.addEventListener('atrium-backup-failed-alert', checkBackupStatus)
  window.addEventListener('atrium-backup-success', checkBackupStatus)
  // Check for updates every 60 seconds to automatically transition dates and rotate creator inspiration
  timer = setInterval(() => {
    currentDate.value = dayjs()
  }, 60000)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown, { capture: true })
  window.removeEventListener('atrium-backup-failed-alert', checkBackupStatus)
  window.removeEventListener('atrium-backup-success', checkBackupStatus)
  if (timer) {
    clearInterval(timer)
  }
})

const resurfacedFollows = computed(() => {
  const items = follows.items
  if (!items || items.length === 0) return []

  const todayStr = currentDate.value.format('YYYY-MM-DD')
  let seed = 0
  for (let i = 0; i < todayStr.length; i++) {
    seed = (seed << 5) - seed + todayStr.charCodeAt(i)
    seed |= 0
  }

  function mulberry32(a) {
    return function () {
      let t = a += 0x6D2B79F5
      t = Math.imul(t ^ (t >>> 15), t | 1)
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296
    }
  }

  const getSeededRandom = mulberry32(seed)

  function pickWeighted(candidates) {
    if (candidates.length === 0) return null
    const totalWeight = candidates.reduce((acc, c) => acc + (c.important ? 2.0 : 1.0), 0)
    let r = getSeededRandom() * totalWeight
    let sum = 0
    for (const c of candidates) {
      sum += (c.important ? 2.0 : 1.0)
      if (sum >= r) return c
    }
    return candidates[candidates.length - 1]
  }

  const first = pickWeighted(items)
  if (!first) return []

  let remaining = items.filter(x => x.id !== first.id)
  let diffCatCandidates = remaining.filter(x => x.category !== first.category)

  let second = null
  if (diffCatCandidates.length > 0) {
    second = pickWeighted(diffCatCandidates)
  } else if (remaining.length > 0) {
    second = pickWeighted(remaining)
  }

  return second ? [first, second] : [first]
})

const greeting = computed(() => {
  const h = currentDate.value.hour()
  let greet = 'Good evening'
  if (h < 5) greet = 'Late night'
  else if (h < 12) greet = 'Good morning'
  else if (h < 18) greet = 'Good afternoon'

  if (ui.userName && ui.userName.trim()) {
    return `${greet}, ${ui.userName.trim()}`
  }
  return greet
})

const todayDate = computed(() => currentDate.value.format('dddd, MMMM D'))
const currentYear = computed(() => years.items[0])

const todayCount = computed(() => {
  // Access currentDate.value so this computed updates reactively
  currentDate.value
  return todayFocus(tasks.items).length
})

const todayUnscheduledCount = computed(() => {
  currentDate.value
  return todayFocus(tasks.items).filter(t => !t.workHour).length
})

const upcomingCount = computed(() => {
  currentDate.value
  return upcomingTasks(tasks.items).length
})

const priorityWeight = {
  backlog: 1,
  interruptive: 2,
  strategic: 3,
  critical: 4
}

const sortedToday = computed(() => {
  currentDate.value
  return todayFocus(tasks.items).slice(0, 5)
})

const sortedUpcoming = computed(() => {
  currentDate.value
  const list = [...upcomingTasks(tasks.items)]
  list.sort((a, b) => {
    if (a.dueDate && b.dueDate) return a.dueDate.localeCompare(b.dueDate)
    if (a.dueDate) return -1
    if (b.dueDate) return 1
    return b.createdAt.localeCompare(a.createdAt)
  })
  return list.slice(0, 5)
})

const todayOverline = computed(() => {
  const displayed = sortedToday.value.length
  const total = todayCount.value
  if (total === 0) return 'Today'

  let str = `Today · Showing ${displayed} of ${total}`
  if (todayUnscheduledCount.value > 0) {
    str += ` · ${todayUnscheduledCount.value} without assigned time`
  }
  return str
})

const upcomingOverline = computed(() => {
  const displayed = sortedUpcoming.value.length
  const total = upcomingCount.value
  if (total === 0) return 'Coming up'
  return `Coming up · Showing ${displayed} of ${total}`
})
const stale = computed(() => {
  currentDate.value
  return staleProjects(projects.items, tasks.items).slice(0, 3)
})

const memory = computed(() => {
  currentDate.value
  return memoryResurfacing(notes.items, bookmarks.items, goals.items, wishlist.items, currentDate.value)
})

const clickedMemoryItems = ref(new Set(JSON.parse(localStorage.getItem(`atrium.clicked_memory_${dayjs().format('YYYY-MM-DD')}`) || '[]')))
const sortedMemoryItems = ref(new Set(clickedMemoryItems.value))

function markClicked(id) {
  clickedMemoryItems.value.add(id)
  clickedMemoryItems.value = new Set(clickedMemoryItems.value)
  localStorage.setItem(`atrium.clicked_memory_${dayjs().format('YYYY-MM-DD')}`, JSON.stringify([...clickedMemoryItems.value]))
  window.dispatchEvent(new CustomEvent('atrium-memory-clicked', { detail: { id } }))
  
  setTimeout(() => {
    sortedMemoryItems.value.add(id)
    sortedMemoryItems.value = new Set(sortedMemoryItems.value)
  }, 5000)
}

function isItemClicked(item) {
  if (clickedMemoryItems.value.has(item.id)) return true
  if (item.lastViewedAt && isToday(item.lastViewedAt)) return true
  return false
}

function isItemSorted(item) {
  return sortedMemoryItems.value.has(item.id)
}

const resurfacedMemoryList = computed(() => {
  const list = []
  if (memory.value.goal) {
    list.push({ ...memory.value.goal, contentType: 'goal' })
  }
  if (memory.value.wish) {
    list.push({ ...memory.value.wish, contentType: 'wish' })
  }
  if (memory.value.items) {
    memory.value.items.forEach(item => {
      list.push({ ...item, contentType: item.type })
    })
  }

  // Sort: unsorted first, sorted last
  list.sort((a, b) => {
    const aSorted = isItemSorted(a) ? 1 : 0
    const bSorted = isItemSorted(b) ? 1 : 0
    return aSorted - bSorted
  })

  return list
})

async function handleGoalOrWishClick(item) {
  markClicked(item.id)
  if (item.contentType === 'goal') {
    await goals.markViewed(item.id)
    router.push(`/goals/${item.id}`)
  } else {
    await wishlist.markViewed(item.id)
    router.push(`/goals?wishId=${item.id}`)
  }
}

async function handleBookmarkClick(item) {
  markClicked(item.id)
  await bookmarks.markViewed(item.id)
}

const lastWeeklyReview = computed(() => reviews.items.find(r => r.type === 'weekly'))

async function openDailyJournal() {
  const today = dayjs().format('YYYY-MM-DD')
  const yesterday = dayjs().subtract(1, 'day').format('YYYY-MM-DD')
  const title = `Journal - ${today}`
  const existing = notes.items.find(n => n.title === title)
  if (existing) {
    router.push(`/notes/${existing.id}`)
    return
  }
  const body = `[[Journal - ${yesterday}]]

**One small win**


**One tension**


**One curiosity**


**Today's reflection**

`
  const created = await notes.add({ title, body, tags: ['journal'] })
  ui.showToast('Journal opened', 'success')
  router.push(`/notes/${created.id}`)
}
</script>

<template>
  <div class="px-8 md:px-12 py-10 max-w-7xl mx-auto" data-testid="dashboard">
    <!-- BACKUP FAILURE ALERT BANNER -->
    <div v-if="backupAlert"
      class="p-4 mb-6 bg-red-500/10 border border-red-500/30 rounded-2xl flex items-center justify-between gap-4 text-xs text-red-900 dark:text-red-200 shadow-sm animate-fade-in"
      data-testid="dash-backup-alert">
      
      <div class="flex items-center gap-3 min-w-0">
        <div class="w-8 h-8 rounded-xl bg-red-500/20 border border-red-500/30 flex items-center justify-center text-red-600 dark:text-red-400 shrink-0">
          <ShieldAlert class="w-4 h-4" />
        </div>
        <div class="min-w-0">
          <h4 class="font-bold text-red-700 dark:text-red-300 text-xs flex items-center gap-2">
            {{ backupAlert.title }}
          </h4>
          <p class="text-red-800/80 dark:text-red-200/80 mt-0.5 leading-snug truncate sm:whitespace-normal">
            {{ backupAlert.message }}
          </p>
        </div>
      </div>

      <div class="flex items-center gap-2 shrink-0">
        <button @click="retryBackupNow" :disabled="retryingBackup"
          class="btn-secondary !py-1.5 !px-3 text-xs !bg-red-500/20 !border-red-500/40 text-red-700 dark:text-red-200 hover:!bg-red-500/30 flex items-center gap-1.5"
          data-testid="dash-retry-backup-btn">
          <RefreshCw class="w-3.5 h-3.5" :class="{ 'animate-spin': retryingBackup }" />
          <span>{{ retryingBackup ? 'Backing up...' : 'Retry Backup' }}</span>
        </button>

        <RouterLink to="/settings"
          class="btn-primary !py-1.5 !px-3 text-xs flex items-center gap-1"
          data-testid="dash-fix-backup-settings-btn">
          Fix in Settings <ArrowRight class="w-3.5 h-3.5" />
        </RouterLink>

        <button @click="dismissBackupAlert" class="text-red-700/60 dark:text-red-300/60 hover:text-red-700 dark:hover:text-red-200 p-1"
          title="Dismiss alert">
          <X class="w-4 h-4" />
        </button>
      </div>
    </div>

    <PageHeader :overline="todayDate" :title="`${greeting}.`" :sub="'Clear today. Start tomorrow lighter.'">
      <template #right>
        <button class="btn-ghost" @click="openDailyJournal" title="Open or create today's daily journal entry"
          data-testid="dash-journal-btn">
          <BookOpen class="w-4 h-4" /> Today's Journal <span class="kbd ml-1.5 select-none">⌘2</span>
        </button>

        <button class="btn-ghost" @click="toggleSidebar" data-testid="dash-toggle-sidebar-btn">
          <PanelRightOpen v-if="isSidebarCollapsed" class="w-4 h-4" />
          <PanelRightClose v-else class="w-4 h-4" />
          <span>{{ isSidebarCollapsed ? 'Show Memory' : 'Hide Memory' }}</span>
          <span class="kbd ml-1.5 select-none">⌘1</span>
        </button>
      </template>
    </PageHeader>

    <!-- 70/30 Layout split on desktop screens -->
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-10 items-start">
      <!-- Left Column (70%): Task planning and execution -->
      <div :class="[isSidebarCollapsed ? 'lg:col-span-3' : 'lg:col-span-2', 'space-y-6 transition-all duration-300']">
        <!-- TODAY FOCUS -->
        <section data-testid="section-today-focus" class="mt-4">
          <SectionHeader :overline="todayOverline" />
          <div v-if="sortedToday.length" class="space-y-3">
            <TaskCard v-for="t in sortedToday" :key="t.id" :task="t" :single-line="true" :show-project="false"
              priority-numeric />
          </div>
          <EmptyState v-else title="An open day" hint="Capture something gentle to begin." />
        </section>

        <!-- COMING UP -->
        <section data-testid="section-upcoming">
          <SectionHeader :overline="upcomingOverline" />
          <div v-if="sortedUpcoming.length" class="space-y-3">
            <TaskCard v-for="t in sortedUpcoming.slice(0, 2)" :key="t.id" :task="t" :single-line="true"
              :show-project="false" priority-numeric />
          </div>
          <EmptyState v-else title="A clear horizon" hint="Plan when ready." />
        </section>

        <!-- STALE PROJECTS -->
        <section data-testid="section-stale">
          <SectionHeader overline="Drifting" hint="These projects are drifting. Time to review them to move forward."
            :show-all-link="false" />
          <div v-if="stale.length" class="grid grid-cols-1 md:grid-cols-3 gap-4">
            <RouterLink v-for="p in stale" :key="p.id" :to="`/projects/${p.id}`"
              class="card p-5 hover:border-line-2 transition-all duration-300 group"
              :data-testid="`stale-project-${p.id}`">
              <div class="flex items-center gap-2 mb-3">
                <FolderKanban class="w-3.5 h-3.5 text-ink-3" /><span class="overline">Project</span>
              </div>
              <div class="font-serif text-xl text-ink mb-1">{{ p.title }}</div>
              <p v-if="p.description" class="text-sm text-ink-2 line-clamp-2">{{ p.description }}</p>
              <div class="mt-4 text-xs text-ink-3">last touched {{ fromNow(getProjectLastTouched(p)) }} · {{
                p.openTaskCount
              }}
                open
                task<template v-if="p.openTaskCount !== 1">s</template></div>
            </RouterLink>
          </div>
          <EmptyState v-else title="Everything is in motion" hint="No project has gone quiet." />
        </section>

        <!-- WEEKLY REFLECTION -->
        <section data-testid="section-reflection">
          <SectionHeader overline="Weekly reflection" />
          <div class="card p-8 flex items-center justify-between gap-6 flex-wrap">
            <div>
              <div class="font-serif text-2xl">What did this week make of me?</div>
              <p class="text-ink-2 mt-2 max-w-md">A quiet review keeps the system honest. Three minutes is enough.</p>
              <p v-if="lastWeeklyReview" class="text-xs text-ink-3 mt-3">Last reflection {{
                fromNow(lastWeeklyReview.createdAt)
              }}</p>
            </div>
            <RouterLink to="/reviews" class="btn-primary" data-testid="open-reviews">Open reviews</RouterLink>
          </div>
        </section>
      </div>

      <!-- Right Column (30%): Sticky Memory Resurfacing sidebar -->
      <div v-if="!isSidebarCollapsed" class="lg:sticky lg:top-8 space-y-6">
        <section data-testid="section-memory" class="p-6 bg-surface/30 border border-line rounded-2xl">
          <SectionHeader overline="Resurfacing Memory">
            <template #right>
              <button class="btn-ghost !p-1.5" @click="toggleSidebar" title="Collapse sidebar"
                data-testid="dash-collapse-sidebar-inner-btn">
                <PanelRightClose class="w-4 h-4" />
              </button>
            </template>
          </SectionHeader>
          <div class="space-y-4 mt-5">
            <!-- Daily Inspiration Creator Follow Resurfacing -->
            <a v-for="rf in resurfacedFollows" :key="rf.id" :href="rf.url" target="_blank" @click="markClicked(rf.id)"
              class="card p-4 block hover:border-line-2 transition-all duration-300 bg-amber-500/5 hover:!border-amber-500/50"
              :class="[
                clickedMemoryItems.has(rf.id) ? '!bg-canvas/50 dark:!bg-canvas/20 !border-line/30 !opacity-55' : '',
                rf.important && !clickedMemoryItems.has(rf.id) ? 'border-amber-500 ring-1 ring-amber-500' : 'border-amber-500/20'
              ]" :data-testid="`resurface-follow-${rf.id}`">
              <div class="flex items-center justify-between gap-2 flex-wrap">
                <div class="flex items-center gap-2">
                  <Compass class="w-3.5 h-3.5"
                    :class="clickedMemoryItems.has(rf.id) ? 'text-ink-3 fill-ink-3/10' : 'text-amber-500 fill-amber-500/20'" />
                  <span class="overline font-semibold tracking-wider flex items-center gap-1.5"
                    :class="clickedMemoryItems.has(rf.id) ? 'text-ink-3' : 'text-amber-600 dark:text-amber-400'">
                    <span>Radar</span>
                  </span>
                </div>
                <span v-if="rf.category"
                  class="text-[9px] uppercase tracking-wider font-semibold border px-1.5 py-0.5 rounded-full capitalize"
                  :class="clickedMemoryItems.has(rf.id) ? 'text-ink-3 bg-canvas/30 border-line/30' : 'text-amber-600 dark:text-amber-400 bg-amber-500/10 border-amber-500/20'">
                  {{ rf.category }}
                </span>
              </div>
              <div class="font-serif text-lg mt-1.5 flex items-center gap-1.5">
                <span>{{ rf.name }}</span>
                <span v-if="rf.platform"
                  class="w-5 h-5 rounded-full border flex items-center justify-center shrink-0 transition-all ml-1"
                  :class="getPlatformStyles(rf.platform)" :title="rf.platform.toUpperCase()">
                  <svg v-if="BRAND_SVG_PATHS[rf.platform]" class="w-2 h-2 fill-current" viewBox="0 0 24 24"
                    xmlns="http://www.w3.org/2000/svg">
                    <path :d="BRAND_SVG_PATHS[rf.platform]" />
                  </svg>
                  <span v-else class="text-[8px] font-sans font-semibold uppercase">{{ rf.platform }}</span>
                </span>
              </div>
              <p v-if="rf.reason" class="text-sm text-ink-2 mt-1 line-clamp-3 leading-relaxed">{{
                rf.reason }}</p>
            </a>

            <!-- Unified Daily Resurfaced Memory List (Sorted: unclicked first, clicked/grayed last smoothly after 5s) -->
            <TransitionGroup name="flip-list" tag="div" class="space-y-4">
              <template v-for="item in resurfacedMemoryList" :key="item.id">
                <!-- Goal Item -->
                <div v-if="item.contentType === 'goal'" @click="handleGoalOrWishClick(item)"
                  class="card p-4 block hover:border-line-2 transition-all duration-300 cursor-pointer relative"
                  :class="isItemClicked(item) ? '!bg-canvas/50 dark:!bg-canvas/20 !border-line/30 !opacity-55' : ''"
                  data-testid="resurface-goal">
                  <!-- Glowing Green Diamond in Top-Right -->
                  <div class="absolute top-4 right-4 flex items-center justify-center">
                    <svg viewBox="0 0 100 170" class="w-3.5 h-6 animate-pulse"
                      :style="isItemClicked(item) ? 'opacity: 0.35; filter: grayscale(1);' : 'filter: drop-shadow(0 0 5px rgba(16, 185, 129, 0.8));'">
                      <!-- Top facets -->
                      <polygon points="50,5 10,85 37,85" fill="#bef264" /> <!-- Left Top -->
                      <polygon points="50,5 37,85 63,85" fill="#a3e635" /> <!-- Center Top -->
                      <polygon points="50,5 63,85 90,85" fill="#65a30d" /> <!-- Right Top -->

                      <!-- Bottom facets -->
                      <polygon points="50,165 10,85 37,85" fill="#84cc16" /> <!-- Left Bottom -->
                      <polygon points="50,165 37,85 63,85" fill="#65a30d" /> <!-- Center Bottom -->
                      <polygon points="50,165 63,85 90,85" fill="#3f6212" /> <!-- Right Bottom -->

                      <!-- Glossy white sheen highlight overlays -->
                      <polygon points="50,5 10,85 37,85" fill="#ffffff" opacity="0.35" />
                      <polygon points="50,5 37,85 50,85" fill="#ffffff" opacity="0.2" />
                    </svg>
                  </div>
                  <div class="flex items-center gap-2 text-ink-3">
                    <Target class="w-3.5 h-3.5" />
                    <span class="overline font-semibold select-none">Goal</span>
                  </div>
                  <div class="font-serif text-lg mt-1.5 leading-snug">{{ item.title }}</div>
                  <div class="text-[11px] text-ink-2 mt-2 select-none"
                    style="text-shadow: 0 0 8px rgba(var(--ink), 0.35); font-weight: 500;">
                    Remember what you are working towards
                  </div>
                </div>

                <!-- Wish Item -->
                <div v-else-if="item.contentType === 'wish'" @click="handleGoalOrWishClick(item)"
                  class="card p-4 block hover:border-line-2 transition-all duration-300 cursor-pointer relative"
                  :class="isItemClicked(item) ? '!bg-canvas/50 dark:!bg-canvas/20 !border-line/30 !opacity-55' : ''"
                  data-testid="resurface-wish">
                  <div class="flex items-center gap-2 text-ink-3">
                    <Gift class="w-3.5 h-3.5" />
                    <span class="overline font-semibold select-none">Wishlist</span>
                  </div>
                  <div class="font-serif text-lg mt-1.5 leading-snug">{{ item.title }}</div>
                  <p v-if="item.description" class="text-sm text-ink-2 mt-1 line-clamp-2 leading-relaxed">
                    {{ item.description }}
                  </p>
                </div>

                <!-- Note Item -->
                <RouterLink v-else-if="item.contentType === 'note'" :to="`/notes/${item.id}`"
                  @click="markClicked(item.id)" class="card p-4 block hover:border-line-2 transition-all duration-300"
                  :class="isItemClicked(item) ? '!bg-canvas/50 dark:!bg-canvas/20 !border-line/30 !opacity-55' : ''"
                  :data-testid="`resurface-note-${item.id}`">
                  <div class="flex items-center gap-2">
                    <NotebookPen class="w-3.5 h-3.5 text-ink-3" />
                    <span class="overline">Note · {{ fromNow(item.lastViewedAt) }}</span>
                  </div>
                  <div class="font-serif text-lg mt-1.5 leading-snug">{{ item.title }}</div>
                  <p class="text-sm text-ink-2 mt-1 line-clamp-2 leading-relaxed">{{ item.body }}</p>
                </RouterLink>

                <!-- Bookmark Item -->
                <a v-else-if="item.contentType === 'bookmark'" :href="item.url" target="_blank"
                  @click="handleBookmarkClick(item)"
                  class="card p-4 block hover:border-line-2 transition-all duration-300"
                  :class="isItemClicked(item) ? '!bg-canvas/50 dark:!bg-canvas/20 !border-line/30 !opacity-55' : ''"
                  :data-testid="`resurface-bookmark-${item.id}`">
                  <div class="flex items-center justify-between gap-2 flex-wrap">
                    <div class="flex items-center gap-2">
                      <Bookmark class="w-3.5 h-3.5 text-ink-3" />
                      <span class="overline">Bookmark · {{ fromNow(item.lastViewedAt) }}</span>
                    </div>
                    <span v-if="item.category"
                      class="text-[9px] uppercase tracking-wider text-ink-3 font-semibold bg-canvas border border-line px-1.5 py-0.5 rounded-full capitalize">
                      {{ item.category }}
                    </span>
                  </div>
                  <div class="font-serif text-lg mt-1.5 leading-snug">{{ item.title }}</div>
                  <p class="text-sm text-ink-2 mt-1 truncate">{{ item.url }}</p>
                </a>
              </template>
            </TransitionGroup>

            <EmptyState v-if="!memory.goal && !memory.wish && !memory.items.length && !resurfacedFollows.length"
              title="Memory is fresh" hint="Nothing to resurface yet." />
          </div>
        </section>
      </div>
    </div>
  </div>
</template>

<style scoped>
.flip-list-move {
  transition: transform 1.2s cubic-bezier(0.4, 0, 0.2, 1);
}
</style>
