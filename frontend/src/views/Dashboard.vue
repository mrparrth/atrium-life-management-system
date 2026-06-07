<script setup>
import { computed } from 'vue'
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
import { todayFocus, upcomingTasks, recentlyIgnored, momentumOpportunities, staleProjects, memoryResurfacing, criticalCount, isTaskOpen } from '@/lib/resurface'
import { fromNow } from '@/lib/date'
import { inr } from '@/lib/money'

import PageHeader from '@/components/PageHeader.vue'
import SectionHeader from '@/components/SectionHeader.vue'
import TaskCard from '@/components/TaskCard.vue'
import EmptyState from '@/components/EmptyState.vue'
import Sparkline from '@/components/Sparkline.vue'
import { ArrowRight, Plus, FolderKanban, NotebookPen, Bookmark, Wallet, Calendar as CalIcon, BookOpen } from 'lucide-vue-next'

const router = useRouter()
const tasks = useTasksStore()
const projects = useProjectsStore()
const notes = useNotesStore()
const bookmarks = useBookmarksStore()
const finance = useFinanceStore()
const reviews = useReviewsStore()
const years = useYearsStore()
const ui = useUIStore()

const greeting = computed(() => {
  const h = new Date().getHours()
  if (h < 5) return 'Late night'
  if (h < 12) return 'Good morning'
  if (h < 18) return 'Good afternoon'
  return 'Good evening'
})

const todayDate = computed(() => dayjs().format('dddd, MMMM D'))
const currentYear = computed(() => years.items[0])

const focus = computed(() => todayFocus(tasks.items).slice(0, 5))
const needsAttention = computed(() => tasks.items.filter(t => isTaskOpen(t) && t.important && t.urgent).slice(0, 3))
const ignored = computed(() => recentlyIgnored(tasks.items).slice(0, 3))
const upcoming = computed(() => upcomingTasks(tasks.items).slice(0, 4))
const momentum = computed(() => momentumOpportunities(tasks.items).slice(0, 3))
const stale = computed(() => staleProjects(projects.items, tasks.items).slice(0, 3))
const memory = computed(() => memoryResurfacing(notes.items, bookmarks.items))

const sparkData = computed(() => finance.networthSeries.map(s => s.value))
const netWorthFormatted = computed(() => inr(finance.currentNetWorth ?? 0))

const projection5y = computed(() => {
  const current = finance.currentNetWorth || 0
  if (!finance.cashflowPeriods.length && current === 0) return '—'

  let totalSaved = 0
  finance.cashflowPeriods.forEach(p => {
    const t = finance.periodTotals(p)
    totalSaved += (t.net + t.investment)
  })
  const avgMonthlySaved = finance.cashflowPeriods.length ? (totalSaved / finance.cashflowPeriods.length) : 0

  // 5% annual return assumption
  const monthlyReturn = 0.05 / 12
  const months = 60

  let futureValue = current
  for (let i = 0; i < months; i++) {
    futureValue = futureValue * (1 + monthlyReturn) + avgMonthlySaved
  }

  return inr(Math.round(futureValue))
})

const lastWeeklyReview = computed(() => reviews.items.find(r => r.type === 'weekly'))

// Daily journal — creates or opens today's journal note pre-filled with yesterday link + prompts
async function openDailyJournal() {
  const today = dayjs().format('YYYY-MM-DD')
  const yesterday = dayjs().subtract(1, 'day').format('YYYY-MM-DD')
  const title = `Journal — ${today}`
  const existing = notes.items.find(n => n.title === title)
  if (existing) {
    router.push(`/notes/${existing.id}`)
    return
  }
  const body = `[[Journal — ${yesterday}]]

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
  <div class="px-8 md:px-12 py-10 max-w-6xl mx-auto" data-testid="dashboard">
    <PageHeader :overline="todayDate" :title="`${greeting}.`"
      :sub="currentYear?.theme || 'A quiet system for the things that matter.'">
      <template #right>
        <button class="btn-ghost" @click="openDailyJournal" data-testid="dash-journal-btn">
          <BookOpen class="w-4 h-4" /> Journal
        </button>
        <button class="btn-secondary" @click="ui.openCommand" data-testid="dash-search-btn">
          Search
          <span class="ml-1 kbd">⌘K</span>
        </button>
        <button class="btn-primary" @click="ui.openQuickCapture" data-testid="dash-capture-btn">
          <Plus class="w-4 h-4" /> Capture
        </button>
      </template>
    </PageHeader>

    <!-- TODAY FOCUS -->
    <section class="mb-12" data-testid="section-today-focus">
      <SectionHeader overline="Today" title="Today focus"
        :hint="focus.length ? 'A few quiet things to attend to.' : 'Nothing scheduled — the day is open.'">
        <template #right>
          <RouterLink to="/today" class="btn-ghost text-sm">Open today
            <ArrowRight class="w-3 h-3" />
          </RouterLink>
        </template>
      </SectionHeader>
      <div v-if="focus.length" class="space-y-3">
        <TaskCard v-for="t in focus" :key="t.id" :task="t" />
      </div>
      <EmptyState v-else title="An open day" hint="Capture something gentle to begin." />
    </section>

    <!-- TWO COLUMN -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-10 mb-12">
      <!-- Needs attention -->
      <section data-testid="section-needs-attention">
        <SectionHeader overline="Now" title="Needs attention" hint="Critical items — gently surfaced." />
        <div v-if="needsAttention.length" class="space-y-3">
          <TaskCard v-for="t in needsAttention" :key="t.id" :task="t" />
        </div>
        <EmptyState v-else title="Nothing critical" hint="A calm moment." />
      </section>

      <!-- Recently ignored -->
      <section data-testid="section-recently-ignored">
        <SectionHeader overline="Resurfaced" title="Recently ignored"
          hint="Untouched for a while — still worthwhile?" />
        <div v-if="ignored.length" class="space-y-3">
          <TaskCard v-for="t in ignored" :key="t.id" :task="t" />
        </div>
        <EmptyState v-else title="All current" hint="You're keeping up." />
      </section>
    </div>

    <!-- MOMENTUM & UPCOMING -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-10 mb-12">
      <section data-testid="section-momentum">
        <SectionHeader overline="Strategic" title="Momentum opportunities"
          hint="Important, not urgent. The good kind of work." />
        <div v-if="momentum.length" class="space-y-3">
          <TaskCard v-for="t in momentum" :key="t.id" :task="t" />
        </div>
        <EmptyState v-else title="No strategic threads yet" hint="Plant one." />
      </section>

      <section data-testid="section-upcoming">
        <SectionHeader overline="Coming up" title="Upcoming" hint="The next seven days." />
        <div v-if="upcoming.length" class="space-y-3">
          <TaskCard v-for="t in upcoming" :key="t.id" :task="t" />
        </div>
        <EmptyState v-else title="A clear horizon" hint="Plan when ready." />
      </section>
    </div>

    <!-- STALE PROJECTS -->
    <section class="mb-12" data-testid="section-stale">
      <SectionHeader overline="Drifting" title="Stale projects" hint="Quietly paused — return when you're ready.">
        <template #right>
          <RouterLink to="/projects" class="btn-ghost text-sm">All projects
            <ArrowRight class="w-3 h-3" />
          </RouterLink>
        </template>
      </SectionHeader>
      <div v-if="stale.length" class="grid grid-cols-1 md:grid-cols-3 gap-4">
        <RouterLink v-for="p in stale" :key="p.id" :to="`/projects/${p.id}`"
          class="card p-5 hover:border-line-2 transition-all duration-300 group" :data-testid="`stale-project-${p.id}`">
          <div class="flex items-center gap-2 mb-3">
            <FolderKanban class="w-3.5 h-3.5 text-ink-3" /><span class="overline">Project</span>
          </div>
          <div class="font-serif text-xl text-ink mb-1">{{ p.title }}</div>
          <p v-if="p.description" class="text-sm text-ink-2 line-clamp-2">{{ p.description }}</p>
          <div class="mt-4 text-xs text-ink-3">last touched {{ fromNow(p.lastViewedAt) }} · {{ p.openTaskCount }} open
            task<template v-if="p.openTaskCount !== 1">s</template></div>
        </RouterLink>
      </div>
      <EmptyState v-else title="Everything is in motion" hint="No project has gone quiet." />
    </section>

    <!-- MEMORY & FINANCE -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-10 mb-12">
      <section data-testid="section-memory">
        <SectionHeader overline="Memory" title="Resurfacing" hint="Notes and bookmarks worth revisiting." />
        <div class="space-y-3">
          <RouterLink v-for="n in memory.notes.slice(0, 2)" :key="n.id" :to="`/notes/${n.id}`"
            class="card p-4 block hover:border-line-2 transition-all duration-300"
            :data-testid="`resurface-note-${n.id}`">
            <div class="flex items-center gap-2">
              <NotebookPen class="w-3.5 h-3.5 text-ink-3" /><span class="overline">Note · {{ fromNow(n.lastViewedAt)
                }}</span>
            </div>
            <div class="font-serif text-lg mt-1.5">{{ n.title }}</div>
            <p class="text-sm text-ink-2 mt-1 line-clamp-2">{{ n.body }}</p>
          </RouterLink>
          <a v-for="b in memory.bookmarks.slice(0, 2)" :key="b.id" :href="b.url" target="_blank"
            class="card p-4 block hover:border-line-2 transition-all duration-300"
            :data-testid="`resurface-bookmark-${b.id}`">
            <div class="flex items-center gap-2">
              <Bookmark class="w-3.5 h-3.5 text-ink-3" /><span class="overline">Bookmark · {{ fromNow(b.lastViewedAt)
                }}</span>
            </div>
            <div class="font-serif text-lg mt-1.5">{{ b.title }}</div>
            <p class="text-sm text-ink-2 mt-1 truncate">{{ b.url }}</p>
          </a>
          <EmptyState v-if="!memory.notes.length && !memory.bookmarks.length" title="Memory is fresh"
            hint="Nothing to resurface yet." />
        </div>
      </section>
    </div>

    <!-- WEEKLY REFLECTION -->
    <section class="mb-16" data-testid="section-reflection">
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
</template>
<!-- btn-primary" data-testid="open-reviews">Open reviews</RouterLink>
      </div>
    </section>
  </div>
</template> -->
