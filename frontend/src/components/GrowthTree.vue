<script setup>
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue'
import dayjs from 'dayjs'
import { useTasksStore } from '@/stores/tasks'
import { useProjectsStore } from '@/stores/projects'
import { useNotesStore } from '@/stores/notes'
import { useBookmarksStore } from '@/stores/bookmarks'
import { useGoalsStore } from '@/stores/goals'
import { useWishlistStore } from '@/stores/wishlist'
import { useWorkClientsStore } from '@/stores/workClients'
import { useWorkItemsStore } from '@/stores/workItems'
import { useWorkInvoicesStore } from '@/stores/workInvoices'
import { useWorkLeadsStore } from '@/stores/workLeads'
import { useFollowsStore } from '@/stores/follows'
import { todayFocus, upcomingTasks, staleProjects, memoryResurfacing } from '@/lib/resurface'
import { isToday } from '@/lib/date'

import { CheckCircle2, Circle, Flame, Sprout, Trophy } from 'lucide-vue-next'

const tasksStore = useTasksStore()
const projectsStore = useProjectsStore()
const notesStore = useNotesStore()
const bookmarksStore = useBookmarksStore()
const goalsStore = useGoalsStore()
const wishlistStore = useWishlistStore()
const workClientsStore = useWorkClientsStore()
const workItemsStore = useWorkItemsStore()
const workInvoicesStore = useWorkInvoicesStore()
const workLeadsStore = useWorkLeadsStore()
const followsStore = useFollowsStore()
import { useUIStore } from '@/stores/ui'
const ui = useUIStore()

const currentDate = ref(dayjs())
let clockTimer = null

const clickedSetLocal = ref(new Set())

function syncClickedMemory() {
  const todayStr = currentDate.value.format('YYYY-MM-DD')
  clickedSetLocal.value = new Set(JSON.parse(localStorage.getItem(`atrium.clicked_memory_${todayStr}`) || '[]'))
}

onMounted(() => {
  clockTimer = setInterval(() => {
    currentDate.value = dayjs()
  }, 30000)
  syncClickedMemory()
  updateStreak()
  window.addEventListener('atrium-memory-clicked', syncClickedMemory)
})

onBeforeUnmount(() => {
  if (clockTimer) clearInterval(clockTimer)
  window.removeEventListener('atrium-memory-clicked', syncClickedMemory)
})

watch(currentDate, () => {
  syncClickedMemory()
})

// 1. Personal Today Focus Tasks
const personalTasks = computed(() => {
  currentDate.value
  return todayFocus(tasksStore.items)
})
const personalTasksTotal = computed(() => personalTasks.value.length)
const personalTasksCompleted = computed(() => personalTasks.value.filter(t => t.done).length)
const personalScore = computed(() => {
  if (personalTasksTotal.value === 0) return 1
  return personalTasksCompleted.value / personalTasksTotal.value
})

// 2. Drifting Projects
const staleProjectsList = computed(() => {
  currentDate.value
  return staleProjects(projectsStore.items, tasksStore.items)
})
const driftingScore = computed(() => {
  return staleProjectsList.value.length === 0 ? 1 : 0
})

// 3. Resurfacing Memory Clicks
const memory = computed(() => {
  currentDate.value
  return memoryResurfacing(notesStore.items, bookmarksStore.items, goalsStore.items, wishlistStore.items, currentDate.value)
})
const resurfacedFollows = computed(() => {
  const items = followsStore.items
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

const memoryList = computed(() => {
  const list = []
  if (memory.value.goal) list.push({ ...memory.value.goal, contentType: 'goal' })
  if (memory.value.wish) list.push({ ...memory.value.wish, contentType: 'wish' })
  if (memory.value.items) {
    memory.value.items.forEach(item => {
      list.push({ ...item, contentType: item.type })
    })
  }
  resurfacedFollows.value.forEach(f => {
    list.push({ ...f, contentType: 'follow' })
  })
  return list
})

const clickedMemoryList = computed(() => {
  return memoryList.value.filter(item => {
    if (clickedSetLocal.value.has(item.id)) return true
    if (item.lastViewedAt && isToday(item.lastViewedAt)) return true
    return false
  })
})

const memoryTotalCount = computed(() => memoryList.value.length)
const memoryClickedCount = computed(() => clickedMemoryList.value.length)
const memoryScore = computed(() => {
  if (memoryTotalCount.value === 0) return 1
  return memoryClickedCount.value / memoryTotalCount.value
})

// 4. Work Board Strategic Alerts
const workAlertsCount = computed(() => {
  let count = 0
  const today = currentDate.value.format('YYYY-MM-DD')
  const snoozedAlerts = JSON.parse(localStorage.getItem('atrium.snoozed_alerts') || '[]')
  
  function isSnoozed(id) {
    const item = snoozedAlerts.find(s => s.id === id)
    if (!item) return false
    return new Date(item.until) >= new Date()
  }

  // 1. Stale Clients
  workClientsStore.items.forEach(c => {
    if (c.status === 'inactive' || c.status === 'do_not_follow_up') return
    const hasActiveTask = workItemsStore.items.some(item => 
      item.clientId === c.id && !workItemsStore.isCompleted(item.status)
    )
    if (hasActiveTask) return
    const key = `client-stale-${c.id}`
    if (isSnoozed(key)) return
    const daysSince = currentDate.value.diff(dayjs(c.lastInteractionAt), 'day')
    if (daysSince >= 30) count++
  })

  // 2. Overdue Invoices
  workInvoicesStore.items.forEach(inv => {
    const key = `invoice-overdue-${inv.id}`
    if (isSnoozed(key)) return
    if (inv.status !== 'paid' && inv.dueDate < today) count++
  })

  // 3. Stale Work Items
  workItemsStore.items.forEach(item => {
    const key = `work-item-stale-${item.id}`
    if (isSnoozed(key)) return
    if (!workItemsStore.isCompleted(item.status)) {
      const daysSince = currentDate.value.diff(dayjs(item.updatedAt), 'day')
      if (daysSince >= 14) count++
    }
  })

  // 4. Stale Leads
  workLeadsStore.items.forEach(lead => {
    const key = `lead-stale-${lead.id}`
    if (isSnoozed(key)) return
    if (lead.followUpDate <= today && !['won', 'lost', 'onboarding'].includes(lead.status) && lead.followUpDate) {
      count++
    }
  })

  return count
})
const workBriefingScore = computed(() => {
  return workAlertsCount.value === 0 ? 1 : 0
})

// 5. Work Board Today Operational Tasks
const workTasks = computed(() => {
  const today = currentDate.value.format('YYYY-MM-DD')
  const now = new Date(); now.setHours(0, 0, 0, 0)
  return workItemsStore.items.filter(w => {
    if (w.snoozedUntil) {
      const until = new Date(w.snoozedUntil); until.setHours(0, 0, 0, 0)
      if (until > now) return false
    }
    return !w.dueDate || w.dueDate <= today
  })
})
const workTasksTotal = computed(() => workTasks.value.length)
const workTasksCompleted = computed(() => workTasks.value.filter(w => workItemsStore.isCompleted(w.status)).length)
const workTasksScore = computed(() => {
  if (workTasksTotal.value === 0) return 1
  return workTasksCompleted.value / workTasksTotal.value
})

// Overall combined progress score (0 to 100)
const progress = computed(() => {
  const avg = (personalScore.value + driftingScore.value + memoryScore.value + workBriefingScore.value + workTasksScore.value) / 5
  return Math.round(avg * 100)
})

// Streak Persistence
const streakCount = ref(Number(localStorage.getItem('atrium.tree_streak_count') || 0))
const lastStreakDate = ref(localStorage.getItem('atrium.tree_streak_last_date') || '')

function updateStreak() {
  const today = currentDate.value.format('YYYY-MM-DD')
  if (progress.value === 100) {
    if (lastStreakDate.value === today) return
    const yesterday = currentDate.value.subtract(1, 'day').format('YYYY-MM-DD')
    if (lastStreakDate.value === yesterday) {
      streakCount.value += 1
    } else {
      streakCount.value = 1
    }
    lastStreakDate.value = today
    localStorage.setItem('atrium.tree_streak_count', streakCount.value.toString())
    localStorage.setItem('atrium.tree_streak_last_date', today)
  } else {
    const yesterday = currentDate.value.subtract(1, 'day').format('YYYY-MM-DD')
    if (lastStreakDate.value && lastStreakDate.value !== yesterday && lastStreakDate.value !== today) {
      streakCount.value = 0
      localStorage.setItem('atrium.tree_streak_count', '0')
    }
  }
}

watch(progress, () => {
  updateStreak()
})
</script>

<template>
  <div class="fixed bottom-6 right-6 z-40 flex flex-col items-center group select-none">
    <!-- Popover on Hover -->
    <div class="absolute bottom-[110px] right-0 w-80 p-5 bg-surface border border-line rounded-2xl shadow-xl opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-all duration-300 transform translate-y-2 group-hover:translate-y-0 z-50 text-left flex flex-col gap-3.5">
      <!-- Popover Header -->
      <div class="flex items-center justify-between border-b border-line pb-2.5">
        <div class="flex items-center gap-2">
          <Sprout class="w-4 h-4 text-pri-strategic animate-pulse" />
          <span class="font-serif text-sm font-bold text-ink">Tree of Daily Growth</span>
        </div>
        <div class="flex items-center gap-1 text-amber-600 dark:text-amber-400 font-semibold text-xs font-mono">
          <Flame class="w-3.5 h-3.5 fill-current" />
          <span>{{ streakCount }}d streak</span>
        </div>
      </div>

      <!-- Progress bar -->
      <div class="flex flex-col gap-1">
        <div class="flex justify-between text-xs text-ink-2 font-medium">
          <span>Overall Growth</span>
          <span class="font-mono font-bold">{{ progress }}%</span>
        </div>
        <div class="w-full h-1.5 bg-canvas border border-line rounded-full overflow-hidden">
          <div class="h-full bg-pri-strategic transition-all duration-500" :style="{ width: `${progress}%` }"></div>
        </div>
      </div>

      <!-- Checklist -->
      <div class="flex flex-col gap-2.5 text-xs border-t border-line/45 pt-3">
        <!-- Personal Tasks -->
        <div class="flex items-start gap-2.5">
          <CheckCircle2 v-if="personalScore >= 1" class="w-4 h-4 text-pri-strategic shrink-0 mt-0.5" />
          <Circle v-else class="w-4 h-4 text-ink-3 shrink-0 mt-0.5" />
          <div class="min-w-0 flex-1">
            <div class="font-semibold" :class="personalScore >= 1 ? 'text-ink font-bold' : 'text-ink-2'">Today's Focus Tasks</div>
            <p class="text-[10px] text-ink-3 mt-0.5">{{ personalTasksCompleted }}/{{ personalTasksTotal }} completed today</p>
          </div>
        </div>

        <!-- Drifting Projects -->
        <div class="flex items-start gap-2.5">
          <CheckCircle2 v-if="driftingScore >= 1" class="w-4 h-4 text-pri-strategic shrink-0 mt-0.5" />
          <Circle v-else class="w-4 h-4 text-ink-3 shrink-0 mt-0.5" />
          <div class="min-w-0 flex-1">
            <div class="font-semibold" :class="driftingScore >= 1 ? 'text-ink font-bold' : 'text-ink-2'">Drifting Projects</div>
            <p class="text-[10px] text-ink-3 mt-0.5">{{ staleProjectsList.length === 0 ? 'No drifting projects need review' : `${staleProjectsList.length} projects need to be touched` }}</p>
          </div>
        </div>

        <!-- Resurfacing Memory -->
        <div class="flex items-start gap-2.5">
          <CheckCircle2 v-if="memoryScore >= 1" class="w-4 h-4 text-pri-strategic shrink-0 mt-0.5" />
          <Circle v-else class="w-4 h-4 text-ink-3 shrink-0 mt-0.5" />
          <div class="min-w-0 flex-1">
            <div class="font-semibold" :class="memoryScore >= 1 ? 'text-ink font-bold' : 'text-ink-2'">Memory Resurfacing</div>
            <p class="text-[10px] text-ink-3 mt-0.5">{{ memoryClickedCount }}/{{ memoryTotalCount }} clicked/viewed today</p>
          </div>
        </div>

        <!-- Work Briefing Alerts -->
        <div class="flex items-start gap-2.5">
          <CheckCircle2 v-if="workBriefingScore >= 1" class="w-4 h-4 text-pri-strategic shrink-0 mt-0.5" />
          <Circle v-else class="w-4 h-4 text-ink-3 shrink-0 mt-0.5" />
          <div class="min-w-0 flex-1">
            <div class="font-semibold" :class="workBriefingScore >= 1 ? 'text-ink font-bold' : 'text-ink-2'">Work Briefing Alerts</div>
            <p class="text-[10px] text-ink-3 mt-0.5">{{ workAlertsCount === 0 ? 'No active strategic alerts' : `${workAlertsCount} alerts need attention` }}</p>
          </div>
        </div>

        <!-- Work Tasks -->
        <div class="flex items-start gap-2.5">
          <CheckCircle2 v-if="workTasksScore >= 1" class="w-4 h-4 text-pri-strategic shrink-0 mt-0.5" />
          <Circle v-else class="w-4 h-4 text-ink-3 shrink-0 mt-0.5" />
          <div class="min-w-0 flex-1">
            <div class="font-semibold" :class="workTasksScore >= 1 ? 'text-ink font-bold' : 'text-ink-2'">Today's Work Tasks</div>
            <p class="text-[10px] text-ink-3 mt-0.5">{{ workTasksCompleted }}/{{ workTasksTotal }} completed today</p>
          </div>
        </div>
      </div>

      <!-- Action Guide -->
      <div class="border-t border-line/45 pt-2.5 text-[10px] text-ink-2 bg-canvas/30 p-2.5 rounded-lg border border-line/20">
        <span class="font-bold text-ink uppercase tracking-wider block mb-1">Growth Guidelines:</span>
        <ul class="list-disc pl-3.5 space-y-0.5 text-ink-3">
          <li v-if="personalScore < 1">Complete your remaining personal tasks.</li>
          <li v-if="driftingScore < 1">Touch drifting projects on the dashboard.</li>
          <li v-if="memoryScore < 1">Click all resurfaced memory items.</li>
          <li v-if="workBriefingScore < 1">Resolve work briefing alerts on the work board.</li>
          <li v-if="workTasksScore < 1">Complete today's operational work tasks.</li>
          <li v-if="progress >= 100" class="text-pri-strategic font-semibold list-none -ml-3.5 flex items-center gap-1.5 animate-pulse">
            <Trophy class="w-3.5 h-3.5 text-amber-500 fill-amber-500/20" /> All complete! The tree is bearing fruit.
          </li>
        </ul>
      </div>
    </div>

    <!-- Tree Image Wrapper (Height: 100px) -->
    <div class="w-24 h-24 flex items-center justify-center cursor-pointer transition-transform duration-300 hover:scale-105 relative select-none pointer-events-none">
      <!-- Watercolor Fills Layer (visible behind transparent regions of the SVG) -->
      <div 
        class="absolute inset-0 transition-all duration-700 ease-out overflow-hidden" 
        :style="{ clipPath: `inset(${100 - progress}% 0px 0px 0px)` }"
      >
        <!-- Trunk base color block (brownish) -->
        <div class="absolute bottom-1 left-[43%] right-[43%] top-[38%] bg-amber-800/80 rounded-full blur-[2px]"></div>
        
        <!-- Leaves canopy color block (green) -->
        <div class="absolute top-[6%] left-[6%] right-[6%] bottom-[28%] bg-pri-strategic/90 rounded-full blur-[8px]"></div>
        
        <!-- Bouncing Fruits (Red/Yellow circles, only visible when progress grows) -->
        <!-- Coordinates carefully mapped to the apples inside the sketch -->
        <!-- Left apples -->
        <div class="absolute w-3 h-3 bg-pri-critical rounded-full blur-[1px] left-[13%] top-[37%] animate-pulse"></div>
        <div class="absolute w-3 h-3 bg-pri-critical rounded-full blur-[1px] left-[20%] top-[42%] animate-pulse"></div>
        
        <!-- Middle apples -->
        <div class="absolute w-3.5 h-3.5 bg-pri-critical rounded-full blur-[1px] left-[32%] top-[25%] animate-pulse"></div>
        <div class="absolute w-3.5 h-3.5 bg-pri-critical rounded-full blur-[1px] left-[52%] top-[30%] animate-pulse"></div>
        
        <!-- Right apples -->
        <div class="absolute w-3 h-3 bg-pri-critical rounded-full blur-[1px] left-[70%] top-[39%] animate-pulse"></div>
        <div class="absolute w-3 h-3 bg-pri-critical rounded-full blur-[1px] left-[70%] top-[57%] animate-pulse"></div>
        <div class="absolute w-3.5 h-3.5 bg-pri-critical rounded-full blur-[1px] left-[22%] top-[60%] animate-pulse"></div>
      </div>

      <!-- The Tree Sketch Outline Image (Renders on top) -->
      <!-- In light mode, renders the black outline vector. In dark mode, inverts it to a white outline vector. -->
      <img 
        src="/progress-tree.svg" 
        class="w-full h-full object-contain absolute inset-0 transition-all duration-300"
        :class="ui.theme === 'dark' ? 'invert brightness-[1.8]' : ''"
        :style="{ opacity: progress === 0 ? '0.15' : '0.95' }"
      />
    </div>
  </div>
</template>

<style scoped>
.btn-ghost {
  @apply hover:bg-canvas hover:text-ink transition-colors cursor-pointer;
}
</style>
