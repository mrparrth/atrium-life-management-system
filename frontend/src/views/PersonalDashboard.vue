<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter, RouterLink } from 'vue-router'
import dayjs from 'dayjs'
import { useTasksStore } from '@/stores/tasks'
import { useProjectsStore } from '@/stores/projects'
import { useNotesStore } from '@/stores/notes'
import { useBookmarksStore } from '@/stores/bookmarks'
import { useFinanceStore } from '@/stores/finance'
import { useReviewsStore } from '@/stores/reviews'
import { useYearsStore } from '@/stores/years'
import { useUIStore } from '@/stores/ui'
import { useFollowsStore } from '@/stores/follows'
import { todayFocus, upcomingTasks, staleProjects, memoryResurfacing } from '@/lib/resurface'
import { fromNow } from '@/lib/date'
import { inr } from '@/lib/money'
import { derivePriority } from '@/lib/priority'

import PageHeader from '@/components/PageHeader.vue'
import SectionHeader from '@/components/SectionHeader.vue'
import TaskCard from '@/components/TaskCard.vue'
import EmptyState from '@/components/EmptyState.vue'
import { ArrowRight, FolderKanban, NotebookPen, Bookmark, BookOpen, Compass, PanelRightClose, PanelRightOpen } from 'lucide-vue-next'

const router = useRouter()
const tasks = useTasksStore()
const projects = useProjectsStore()
const notes = useNotesStore()
const bookmarks = useBookmarksStore()
const finance = useFinanceStore()
const reviews = useReviewsStore()
const years = useYearsStore()
const ui = useUIStore()
const follows = useFollowsStore()

const isSidebarCollapsed = ref(localStorage.getItem('dash-sidebar-collapsed') === 'true')

function toggleSidebar() {
  isSidebarCollapsed.value = !isSidebarCollapsed.value
  localStorage.setItem('dash-sidebar-collapsed', isSidebarCollapsed.value.toString())
}

function handleKeydown(e) {
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
  await follows.load()
  window.addEventListener('keydown', handleKeydown, { capture: true })
  // Check for updates every 60 seconds to automatically transition dates and rotate creator inspiration
  timer = setInterval(() => {
    currentDate.value = dayjs()
  }, 60000)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown, { capture: true })
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
      let t = a += 0x6D2B79F5;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
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
  if (h < 5) return 'Late night'
  if (h < 12) return 'Good morning'
  if (h < 18) return 'Good afternoon'
  return 'Good evening'
})

const todayDate = computed(() => currentDate.value.format('dddd, MMMM D'))
const currentYear = computed(() => years.items[0])

const todayCount = computed(() => {
  // Access currentDate.value so this computed updates reactively
  currentDate.value
  return todayFocus(tasks.items).length
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
  const list = [...todayFocus(tasks.items)]
  list.sort((a, b) => {
    if (a.dueDate && b.dueDate) return a.dueDate.localeCompare(b.dueDate)
    if (a.dueDate) return -1
    if (b.dueDate) return 1
    return b.createdAt.localeCompare(a.createdAt)
  })
  return list.slice(0, 5)
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

const stale = computed(() => {
  currentDate.value
  return staleProjects(projects.items, tasks.items).slice(0, 3)
})

const memory = computed(() => {
  currentDate.value
  return memoryResurfacing(notes.items, bookmarks.items)
})

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

`
  const created = await notes.add({ title, body, tags: ['journal'] })
  ui.showToast('Journal opened', 'success')
  router.push(`/notes/${created.id}`)
}
</script>

<template>
  <div class="px-8 md:px-12 py-10 max-w-7xl mx-auto" data-testid="dashboard">
    <PageHeader :overline="todayDate" :title="`${greeting}.`"
      :sub="currentYear?.theme || 'A quiet system for the things that matter.'">
      <template #right>
        <button class="btn-ghost" @click="openDailyJournal" data-testid="dash-journal-btn">
          <BookOpen class="w-4 h-4" /> Journal <span class="kbd ml-1.5 select-none">⌘2</span>
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
        <section data-testid="section-today-focus">
          <SectionHeader overline="Today" title="Today focus"
            :hint="sortedToday.length ? 'A few quiet things to attend to.' : 'Nothing scheduled - the day is open.'">
            <template #right>
              <RouterLink to="/today" class="btn-ghost text-sm">Open today ({{ todayCount }})
                <ArrowRight class="w-3 h-3 ml-1" />
              </RouterLink>
            </template>
          </SectionHeader>
          <div v-if="sortedToday.length" class="space-y-3">
            <TaskCard v-for="t in sortedToday" :key="t.id" :task="t" :single-line="true" :show-project="false" />
          </div>
          <EmptyState v-else title="An open day" hint="Capture something gentle to begin." />
        </section>

        <!-- COMING UP -->
        <section data-testid="section-upcoming">
          <SectionHeader overline="Coming up" title="Coming up"
            :hint="sortedUpcoming.length ? 'The next seven days.' : 'A clear horizon.'">
            <template #right>
              <RouterLink to="/tasks" class="btn-ghost text-sm">All tasks ({{ upcomingCount }})
                <ArrowRight class="w-3 h-3 ml-1" />
              </RouterLink>
            </template>
          </SectionHeader>
          <div v-if="sortedUpcoming.length" class="space-y-3">
            <TaskCard v-for="t in sortedUpcoming" :key="t.id" :task="t" :single-line="true" :show-project="false" />
          </div>
          <EmptyState v-else title="A clear horizon" hint="Plan when ready." />
        </section>

        <!-- STALE PROJECTS -->
        <section data-testid="section-stale">
          <SectionHeader overline="Drifting" title="Stale projects" hint="Quietly paused - return when you're ready.">
            <template #right>
              <RouterLink to="/projects" class="btn-ghost text-sm">All projects
                <ArrowRight class="w-3 h-3" />
              </RouterLink>
            </template>
          </SectionHeader>
          <div v-if="stale.length" class="grid grid-cols-1 md:grid-cols-3 gap-4">
            <RouterLink v-for="p in stale" :key="p.id" :to="`/projects/${p.id}`"
              class="card p-5 hover:border-line-2 transition-all duration-300 group"
              :data-testid="`stale-project-${p.id}`">
              <div class="flex items-center gap-2 mb-3">
                <FolderKanban class="w-3.5 h-3.5 text-ink-3" /><span class="overline">Project</span>
              </div>
              <div class="font-serif text-xl text-ink mb-1">{{ p.title }}</div>
              <p v-if="p.description" class="text-sm text-ink-2 line-clamp-2">{{ p.description }}</p>
              <div class="mt-4 text-xs text-ink-3">last touched {{ fromNow(p.lastViewedAt) }} · {{ p.openTaskCount }}
                open
                task<template v-if="p.openTaskCount !== 1">s</template></div>
            </RouterLink>
          </div>
          <EmptyState v-else title="Everything is in motion" hint="No project has gone quiet." />
        </section>

        <!-- WEEKLY REFLECTION -->
        <section data-testid="section-reflection">
          <SectionHeader overline="Weekly reflection" title="Pause" hint="A small ritual at the close of the week." />
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
          <SectionHeader overline="Memory" title="Resurfacing" hint="Worth revisiting.">
            <template #right>
              <button class="btn-ghost !p-1.5" @click="toggleSidebar" title="Collapse sidebar"
                data-testid="dash-collapse-sidebar-inner-btn">
                <PanelRightClose class="w-4 h-4" />
              </button>
            </template>
          </SectionHeader>
          <div class="space-y-4 mt-5">
            <!-- Daily Inspiration Creator Follow Resurfacing -->
            <a v-for="rf in resurfacedFollows" :key="rf.id" :href="rf.url" target="_blank"
              class="card p-4 block hover:border-line-2 transition-all duration-300 bg-amber-500/5 hover:!border-amber-500/50"
              :class="rf.important ? 'border-amber-500 ring-1 ring-amber-500' : 'border-amber-500/20'"
              :data-testid="`resurface-follow-${rf.id}`">
              <div class="flex items-center gap-2">
                <Compass class="w-3.5 h-3.5 text-amber-500 fill-amber-500/20" />
                <span
                  class="overline text-amber-600 dark:text-amber-400 font-semibold tracking-wider flex items-center gap-1.5">
                  <span>Creator Inspiration</span>
                </span>
              </div>
              <div class="font-serif text-lg mt-1.5 flex items-center gap-1.5">
                <span>{{ rf.name }}</span>
                <span class="text-xs text-ink-3 font-normal font-sans">({{ rf.platform }})</span>
              </div>
              <p v-if="rf.reason" class="text-sm text-ink-2 mt-1 line-clamp-3 leading-relaxed">{{
                rf.reason }}</p>
            </a>

            <!-- Notes (up to 3) -->
            <RouterLink v-for="n in memory.notes.slice(0, 3)" :key="n.id" :to="`/notes/${n.id}`"
              class="card p-4 block hover:border-line-2 transition-all duration-300"
              :data-testid="`resurface-note-${n.id}`">
              <div class="flex items-center gap-2">
                <NotebookPen class="w-3.5 h-3.5 text-ink-3" /><span class="overline">Note · {{ fromNow(n.lastViewedAt)
                  }}</span>
              </div>
              <div class="font-serif text-lg mt-1.5 leading-snug">{{ n.title }}</div>
              <p class="text-sm text-ink-2 mt-1 line-clamp-2 leading-relaxed">{{ n.body }}</p>
            </RouterLink>

            <!-- Bookmarks (up to 3) -->
            <a v-for="b in memory.bookmarks.slice(0, 3)" :key="b.id" :href="b.url" target="_blank"
              class="card p-4 block hover:border-line-2 transition-all duration-300"
              :data-testid="`resurface-bookmark-${b.id}`">
              <div class="flex items-center gap-2">
                <Bookmark class="w-3.5 h-3.5 text-ink-3" /><span class="overline">Bookmark · {{ fromNow(b.lastViewedAt)
                  }}</span>
              </div>
              <div class="font-serif text-lg mt-1.5 leading-snug">{{ b.title }}</div>
              <p class="text-sm text-ink-2 mt-1 truncate">{{ b.url }}</p>
            </a>

            <EmptyState v-if="!memory.notes.length && !memory.bookmarks.length && !resurfacedFollows.length"
              title="Memory is fresh" hint="Nothing to resurface yet." />
          </div>
        </section>
      </div>
    </div>
  </div>
</template>
