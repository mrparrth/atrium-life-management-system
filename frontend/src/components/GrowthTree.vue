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

    <!-- Tree SVG (Height: 100px) -->
    <div class="w-24 h-24 flex items-center justify-center cursor-pointer transition-transform duration-300 hover:scale-105">
      <svg viewBox="0 0 200 200" class="w-full h-full" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <!-- Clip path for rising color fill -->
          <clipPath :id="`tree-clip-${currentDate.format('YYYYMMDD')}`">
            <rect x="0" :y="200 - (progress * 2)" width="200" height="200" class="transition-all duration-700 ease-out" />
          </clipPath>

          <!-- Leaf template -->
          <g id="leaf">
            <!-- leaf shape -->
            <path d="M0,0 C-8,-8 -8,-20 0,-26 C8,-20 8,-8 0,0 Z" />
            <!-- leaf vein -->
            <path d="M0,0 L0,-24" stroke-width="1.2" stroke-linecap="round" />
          </g>

          <!-- Apple template -->
          <g id="apple">
            <!-- Apple body -->
            <path d="M0,-8 C-10,-8 -14,-4 -14,4 C-14,12 -5,18 0,18 C5,18 14,12 14,4 C14,-4 10,-8 0,-8 Z" />
            <!-- Stem -->
            <path d="M0,-8 Q3,-13 7,-15" fill="none" stroke-width="2" stroke-linecap="round" />
            <!-- Small Leaf on stem -->
            <path d="M3,-11 C6,-13 9,-13 11,-10 C9,-7 6,-7 3,-11 Z" />
          </g>
        </defs>

        <!-- ==================== FILL LAYER (CLIPPED BY PROGRESS) ==================== -->
        <g :clip-path="`url(#tree-clip-${currentDate.format('YYYYMMDD')})`">
          <!-- Trunk Wood Fill -->
          <path d="M85,195 C88,170 88,150 90,125 C92,110 98,105 100,105 C102,105 108,110 110,125 C112,150 112,170 115,195 Z" fill="#8d7053" />
          <!-- Branch Fills -->
          <path d="M88,125 C82,115 75,105 60,95 C45,85 30,75 25,60 L35,55 C40,70 55,80 70,90 C80,98 85,108 88,125 Z" fill="#8d7053" />
          <path d="M112,125 C118,115 125,105 140,95 C155,85 170,75 175,60 L165,55 C160,70 145,80 130,90 C120,98 115,108 112,125 Z" fill="#8d7053" />
          
          <!-- Leaves Green Fill -->
          <g fill="rgb(var(--pri-strategic))" stroke="rgb(var(--pri-strategic))">
            <!-- Use leaves at various coordinates (matching outlines) -->
            <use href="#leaf" x="35" y="65" transform="rotate(-40, 35, 65)" />
            <use href="#leaf" x="25" y="85" transform="rotate(-80, 25, 85)" />
            <use href="#leaf" x="52" y="55" transform="rotate(-20, 52, 55)" />
            <use href="#leaf" x="72" y="45" transform="rotate(-15, 72, 45)" />
            <use href="#leaf" x="100" y="25" transform="rotate(0, 100, 25)" />
            <use href="#leaf" x="128" y="45" transform="rotate(15, 128, 45)" />
            <use href="#leaf" x="148" y="55" transform="rotate(20, 148, 55)" />
            <use href="#leaf" x="165" y="65" transform="rotate(40, 165, 65)" />
            <use href="#leaf" x="175" y="85" transform="rotate(80, 175, 85)" />
            
            <use href="#leaf" x="48" y="95" transform="rotate(-60, 48, 95)" />
            <use href="#leaf" x="65" y="85" transform="rotate(-35, 65, 85)" />
            <use href="#leaf" x="88" y="70" transform="rotate(-10, 88, 70)" />
            <use href="#leaf" x="112" y="70" transform="rotate(10, 112, 70)" />
            <use href="#leaf" x="135" y="85" transform="rotate(35, 135, 85)" />
            <use href="#leaf" x="152" y="95" transform="rotate(60, 152, 95)" />
          </g>

          <!-- Fruits Red/Yellow Fill (Grows to full color when completed) -->
          <g fill="rgb(var(--pri-critical))" stroke="rgb(var(--pri-critical))">
            <!-- Render active apples -->
            <use href="#apple" x="55" y="95" />
            <use href="#apple" x="82" y="68" />
            <use href="#apple" x="118" y="72" />
            <use href="#apple" x="148" y="95" />
            <use href="#apple" x="100" y="42" />
            <use href="#apple" x="70" y="125" />
            <use href="#apple" x="130" y="125" />
          </g>

          <!-- Characters Fill -->
          <!-- Bird Fill -->
          <path d="M145,85 C145,80 152,80 155,83 C158,85 157,89 153,90 C151,90.5 148,89 145,85 Z" fill="#3b82f6" />
          <!-- Worm Fill -->
          <path d="M87,58 Q91,53 95,57" fill="none" stroke="#22c55e" stroke-width="4.5" stroke-linecap="round" />
        </g>

        <!-- ==================== OUTLINE LAYER (ALWAYS VISIBLE LINE ART) ==================== -->
        <g stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" fill="none" class="text-ink">
          <!-- Tree Trunk and Branches Outline -->
          <!-- Trunk Outer Left -->
          <path d="M85,195 C88,170 88,150 90,125 C92,118 90,112 85,108 C78,102 70,98 62,93" />
          <!-- Trunk Outer Right -->
          <path d="M115,195 C112,170 112,150 110,125 C108,118 110,112 115,108 C122,102 130,98 138,93" />
          
          <!-- Left Main Branch Upper Outline -->
          <path d="M62,93 C48,83 32,73 25,60" />
          <!-- Left Main Branch Lower Outline -->
          <path d="M88,125 C82,115 75,105 60,95 C45,85 30,75 25,60" />

          <!-- Right Main Branch Upper Outline -->
          <path d="M138,93 C152,83 168,73 175,60" />
          <!-- Right Main Branch Lower Outline -->
          <path d="M112,125 C118,115 125,105 140,95 C155,85 170,75 175,60" />

          <!-- Center branch splits -->
          <path d="M96,120 C98,105 92,90 85,82" />
          <path d="M104,120 C102,105 108,90 115,82" />

          <!-- Branch details / bark textures -->
          <path d="M98,190 C98,170 102,150 100,130" stroke-width="1.2" opacity="0.4" />
          <path d="M95,175 C94,165 96,155 95,145" stroke-width="1.2" opacity="0.3" />
          <path d="M105,180 C106,170 104,160 105,150" stroke-width="1.2" opacity="0.3" />

          <!-- Leaves Outline -->
          <!-- Use leaves at same coordinates -->
          <use href="#leaf" x="35" y="65" transform="rotate(-40, 35, 65)" />
          <use href="#leaf" x="25" y="85" transform="rotate(-80, 25, 85)" />
          <use href="#leaf" x="52" y="55" transform="rotate(-20, 52, 55)" />
          <use href="#leaf" x="72" y="45" transform="rotate(-15, 72, 45)" />
          <use href="#leaf" x="100" y="25" transform="rotate(0, 100, 25)" />
          <use href="#leaf" x="128" y="45" transform="rotate(15, 128, 45)" />
          <use href="#leaf" x="148" y="55" transform="rotate(20, 148, 55)" />
          <use href="#leaf" x="165" y="65" transform="rotate(40, 165, 65)" />
          <use href="#leaf" x="175" y="85" transform="rotate(80, 175, 85)" />
          
          <use href="#leaf" x="48" y="95" transform="rotate(-60, 48, 95)" />
          <use href="#leaf" x="65" y="85" transform="rotate(-35, 65, 85)" />
          <use href="#leaf" x="88" y="70" transform="rotate(-10, 88, 70)" />
          <use href="#leaf" x="112" y="70" transform="rotate(10, 112, 70)" />
          <use href="#leaf" x="135" y="85" transform="rotate(35, 135, 85)" />
          <use href="#leaf" x="152" y="95" transform="rotate(60, 152, 95)" />

          <!-- Apples Outline -->
          <use href="#apple" x="55" y="95" />
          <use href="#apple" x="82" y="68" />
          <use href="#apple" x="118" y="72" />
          <use href="#apple" x="148" y="95" />
          <use href="#apple" x="100" y="42" />
          <use href="#apple" x="70" y="125" />
          <use href="#apple" x="130" y="125" />

          <!-- Apple Cute Face Overlays -->
          <!-- Apple 1 (55, 95) -->
          <circle cx="51" cy="94" r="0.8" fill="currentColor" />
          <circle cx="59" cy="94" r="0.8" fill="currentColor" />
          <path d="M53,97 Q55,99 57,97" stroke-width="0.8" />

          <!-- Apple 2 (82, 68) -->
          <circle cx="78" cy="67" r="0.8" fill="currentColor" />
          <circle cx="86" cy="67" r="0.8" fill="currentColor" />
          <path d="M80,70 Q82,72 84,70" stroke-width="0.8" />

          <!-- Apple 3 (118, 72) -->
          <circle cx="114" cy="71" r="0.8" fill="currentColor" />
          <circle cx="122" cy="71" r="0.8" fill="currentColor" />
          <path d="M116,74 Q118,76 120,74" stroke-width="0.8" />

          <!-- Apple 4 (148, 95) -->
          <circle cx="144" cy="94" r="0.8" fill="currentColor" />
          <circle cx="152" cy="94" r="0.8" fill="currentColor" />
          <path d="M146,97 Q148,99 150,97" stroke-width="0.8" />

          <!-- Apple 5 (100, 42) -->
          <circle cx="96" cy="41" r="0.8" fill="currentColor" />
          <circle cx="104" cy="41" r="0.8" fill="currentColor" />
          <path d="M98,44 Q100,46 102,44" stroke-width="0.8" />

          <!-- Apple 6 (70, 125) -->
          <circle cx="66" cy="124" r="0.8" fill="currentColor" />
          <circle cx="74" cy="124" r="0.8" fill="currentColor" />
          <path d="M68,127 Q70,129 72,127" stroke-width="0.8" />

          <!-- Apple 7 (130, 125) -->
          <circle cx="126" cy="124" r="0.8" fill="currentColor" />
          <circle cx="134" cy="124" r="0.8" fill="currentColor" />
          <path d="M128,127 Q130,129 132,127" stroke-width="0.8" />

          <!-- ==================== CUTE CHARACTERS OVERLAY ==================== -->
          <!-- 1. Friendly sleeping face on Tree Trunk -->
          <!-- Eyes -->
          <path d="M93,150 Q96,146 99,150" stroke-width="1.2" />
          <path d="M101,150 Q104,146 107,150" stroke-width="1.2" />
          <!-- Cheeks (cute blush lines) -->
          <path d="M91,153 L92,154" stroke-width="1" opacity="0.5" />
          <path d="M109,153 L108,154" stroke-width="1" opacity="0.5" />
          <!-- Mouth -->
          <path d="M98,154 Q100,157 102,154" stroke-width="1.2" />

          <!-- 2. Tiny worm peeping out of Apple 2 (82, 68) -->
          <path d="M87,58 Q91,53 95,57" stroke-width="1.5" />
          <circle cx="89" cy="56" r="0.5" fill="currentColor" />
          <circle cx="92" cy="55" r="0.5" fill="currentColor" />
          <path d="M90,58 Q91,59 92,58" stroke-width="0.5" />

          <!-- 3. Cute sleeping bird on Right Branch (140, 90) -->
          <path d="M145,85 C145,80 152,80 155,83 C158,85 157,89 153,90 C151,90.5 148,89 145,85 Z" stroke-width="1.5" />
          <!-- Beak -->
          <polygon points="155,83 158,83 156,85" fill="currentColor" />
          <!-- Sleeping eye -->
          <path d="M148,84 Q150,82 152,84" stroke-width="0.8" />
        </g>
      </svg>
    </div>
  </div>
</template>

<style scoped>
.btn-ghost {
  @apply hover:bg-canvas hover:text-ink transition-colors cursor-pointer;
}
</style>
