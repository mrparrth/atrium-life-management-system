<script setup>
import { ref, computed, onMounted, onBeforeUnmount, watch, nextTick } from 'vue'
import dayjs from 'dayjs'
import { useTasksStore } from '@/stores/tasks'
import { useProjectsStore } from '@/stores/projects'
import { useNotesStore } from '@/stores/notes'
import { useBookmarksStore } from '@/stores/bookmarks'
import { useGoalsStore } from '@/stores/goals'
import { useYearsStore } from '@/stores/years'
import { useWishlistStore } from '@/stores/wishlist'
import { useWorkClientsStore } from '@/stores/workClients'
import { useWorkItemsStore } from '@/stores/workItems'
import { useWorkInvoicesStore } from '@/stores/workInvoices'
import { useWorkLeadsStore } from '@/stores/workLeads'
import { useFollowsStore } from '@/stores/follows'
import { useReviewsStore } from '@/stores/reviews'
import { todayFocus, upcomingTasks, staleProjects, memoryResurfacing, isSnoozed } from '@/lib/resurface'
import { isToday, isOverdue } from '@/lib/date'

import { CheckCircle2, Circle, Flame, Sprout, Trophy, Sparkles } from 'lucide-vue-next'

const tasksStore = useTasksStore()
const projectsStore = useProjectsStore()
const notesStore = useNotesStore()
const bookmarksStore = useBookmarksStore()
const goalsStore = useGoalsStore()
const yearsStore = useYearsStore()
const wishlistStore = useWishlistStore()
const workClientsStore = useWorkClientsStore()
const workItemsStore = useWorkItemsStore()
const workInvoicesStore = useWorkInvoicesStore()
const workLeadsStore = useWorkLeadsStore()
const followsStore = useFollowsStore()
const reviewsStore = useReviewsStore()
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
  reviewsStore.load()
  yearsStore.load()
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
  const today = currentDate.value.format('YYYY-MM-DD')
  return tasksStore.items.filter(t => {
    // 1. If it was completed today, it is part of today's focus tasks
    if (t.status === 'done' && isToday(t.completedAt)) {
      return true
    }
    // 2. Otherwise, if it is open/snoozed, it is part of today's tasks if scheduled/due today, overdue, or has no due date
    if (t.status !== 'done') {
      if (t.scheduledDate && t.scheduledDate > today && !isToday(t.scheduledDate)) return false
      if (t.dueDate && t.dueDate > today && !isToday(t.dueDate) && !isToday(t.scheduledDate)) return false
      return !t.dueDate || isToday(t.scheduledDate) || isToday(t.dueDate) || isOverdue(t.dueDate)
    }
    return false
  })
})
const personalTasksTotal = computed(() => personalTasks.value.length)
const personalTasksHandled = computed(() => {
  return personalTasks.value.filter(t => t.status === 'done' || isSnoozed(t)).length
})
const personalScore = computed(() => {
  if (personalTasksTotal.value === 0) return 1
  return personalTasksHandled.value / personalTasksTotal.value
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
  return workItemsStore.items.filter(w => {
    const isCompleted = workItemsStore.isCompleted(w.status)
    // 1. If it was completed today, it is part of today's work tasks
    if (isCompleted && isToday(w.closedDate)) {
      return true
    }
    // 2. Otherwise, if it is open/snoozed, it is part of today's work tasks if due today, overdue, or has no due date
    if (!isCompleted) {
      if (w.dueDate && w.dueDate > today && !isToday(w.dueDate)) return false
      return !w.dueDate || w.dueDate <= today
    }
    return false
  })
})
const workTasksTotal = computed(() => workTasks.value.length)
const workTasksHandled = computed(() => {
  const now = new Date()
  return workTasks.value.filter(w => {
    const isCompleted = workItemsStore.isCompleted(w.status)
    const isSnoozed = w.snoozedUntil && new Date(w.snoozedUntil) > now
    return isCompleted || isSnoozed
  }).length
})
const workTasksScore = computed(() => {
  if (workTasksTotal.value === 0) return 1
  return workTasksHandled.value / workTasksTotal.value
})
// 6. Review Reminders (Optional, does not affect tree score)
const activeReviews = computed(() => {
  const list = []
  const today = currentDate.value
  
  // 1. Daily Review: shows daily
  const hasDaily = reviewsStore.items.some(r => r.type === 'daily' && dayjs(r.date).isSame(today, 'day'))
  list.push({
    id: 'daily',
    label: 'Daily Review',
    completed: hasDaily,
    show: true
  })
  
  // 2. Weekly Review: shows on Friday and continues for 3-4 days (Friday, Saturday, Sunday, Monday)
  const dayOfWeek = today.day()
  const isWeeklyActive = [5, 6, 0, 1].includes(dayOfWeek)
  if (isWeeklyActive) {
    let offset = 0
    if (dayOfWeek === 5) offset = 0
    else if (dayOfWeek === 6) offset = 1
    else if (dayOfWeek === 0) offset = 2
    else if (dayOfWeek === 1) offset = 3
    
    const fridayDate = today.subtract(offset, 'day').startOf('day')
    const mondayDate = fridayDate.add(3, 'day').endOf('day')
    
    const hasWeekly = reviewsStore.items.some(r => {
      if (r.type !== 'weekly') return false
      const d = dayjs(r.date)
      return (d.isSame(fridayDate, 'day') || d.isAfter(fridayDate)) && (d.isSame(mondayDate, 'day') || d.isBefore(mondayDate))
    })
    
    list.push({
      id: 'weekly',
      label: 'Weekly Review',
      completed: hasWeekly,
      show: true
    })
  }
  
  // 3. Monthly Review: shows on 1st of month and continues till 10th (reviews the previous month)
  const dom = today.date()
  const isMonthlyActive = dom >= 1 && dom <= 10
  if (isMonthlyActive) {
    const targetMonth = today.subtract(1, 'month')
    const hasMonthly = reviewsStore.items.some(r => r.type === 'monthly' && dayjs(r.date).isSame(today, 'month'))
    list.push({
      id: 'monthly',
      label: `Monthly Review (${targetMonth.format('MMMM')})`,
      completed: hasMonthly,
      show: true
    })
  }
  
  // 4. Yearly Review: shows starting Jan 1st and continues until completed (reviews the previous year Y-1)
  const targetYear = today.subtract(1, 'year').year()
  const yearExists = yearsStore.items.some(y => y.year === targetYear)
  const hasYearly = reviewsStore.items.some(r => r.type === 'yearly' && dayjs(r.date).year() === today.year())
  if (yearExists && !hasYearly) {
    list.push({
      id: 'yearly',
      label: `Yearly Review (${targetYear})`,
      completed: false,
      show: true
    })
  }
  
  return list.filter(r => r.show)
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

const showConfettiCanvas = ref(false)
const confettiCanvas = ref(null)

function launchConfetti() {
  showConfettiCanvas.value = true
  nextTick(() => {
    const canvas = confettiCanvas.value
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    canvas.width = window.innerWidth
    canvas.height = window.innerHeight
    
    const colors = ['#1b4332', '#2d6a4f', '#40916c', '#52b788', '#74c69d', '#95d5b2', '#b7e4c7', '#d8f3dc']
    const particles = []
    
    for (let i = 0; i < 150; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: canvas.height + Math.random() * 50,
        vx: (Math.random() - 0.5) * 14,
        vy: -Math.random() * 16 - 10,
        r: Math.random() * 5 + 3,
        color: colors[Math.floor(Math.random() * colors.length)],
        rotation: Math.random() * 360,
        rotationSpeed: (Math.random() - 0.5) * 12
      })
    }
    
    function update() {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      let active = false
      
      particles.forEach(p => {
        p.x += p.vx
        p.y += p.vy
        p.vy += 0.35 // gravity
        p.vx *= 0.98 // wind resistance
        p.rotation += p.rotationSpeed
        
        if (p.y < canvas.height + 20) {
          active = true
        }
        
        ctx.save()
        ctx.translate(p.x, p.y)
        ctx.rotate((p.rotation * Math.PI) / 180)
        ctx.fillStyle = p.color
        
        // Draw tiny confetti leaves / squares
        ctx.fillRect(-p.r, -p.r, p.r * 2, p.r * 2)
        ctx.restore()
      })
      
      if (active) {
        requestAnimationFrame(update)
      } else {
        showConfettiCanvas.value = false
      }
    }
    
    update()
  })
}

watch(progress, (newVal, oldVal) => {
  updateStreak()
  if (newVal === 100 && (oldVal === undefined || oldVal < 100)) {
    launchConfetti()
  }
})
</script>

<template>
  <div class="fixed bottom-6 right-6 z-40 flex flex-col items-center group select-none">
    <!-- Confetti Canvas -->
    <Teleport to="body">
      <canvas v-if="showConfettiCanvas" ref="confettiCanvas" class="fixed inset-0 pointer-events-none z-[9999]"></canvas>
    </Teleport>

    <!-- Popover on Hover -->
    <div class="absolute bottom-[110px] right-0 w-80 p-5 bg-surface border border-line rounded-2xl shadow-xl opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-all duration-300 transform translate-y-2 group-hover:translate-y-0 z-50 text-left flex flex-col gap-3.5">
      <!-- Popover Header -->
      <div class="flex items-center justify-between border-b border-line pb-2.5">
        <div class="flex items-center gap-2">
          <Sprout class="w-4 h-4 text-pri-strategic animate-pulse -translate-y-[1px]" />
          <span class="font-serif text-sm font-bold text-ink leading-none">Tree of Daily Growth</span>
        </div>
        <div class="flex items-center gap-1 text-amber-600 dark:text-amber-400 font-semibold text-xs font-mono leading-none">
          <Flame class="w-3.5 h-3.5 fill-current -translate-y-[1px]" />
          <span class="leading-none">{{ streakCount }}d streak</span>
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
            <p class="text-[10px] text-ink-3 mt-0.5">{{ personalTasksHandled }}/{{ personalTasksTotal }} handled today</p>
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
            <p class="text-[10px] text-ink-3 mt-0.5">{{ workTasksHandled }}/{{ workTasksTotal }} handled today</p>
          </div>
        </div>

        <!-- Review Reminders (Optional) -->
        <div v-if="activeReviews.length" class="flex items-start gap-2.5 border-t border-line/35 pt-2.5 mt-0.5">
          <Sparkles class="w-4 h-4 text-ink-3 shrink-0 mt-0.5" />
          <div class="min-w-0 flex-1">
            <div class="font-semibold text-ink-2 flex items-center gap-1.5">
              <span>Review Reminders</span>
              <span class="text-[9px] uppercase tracking-wider px-1 py-0.5 bg-line text-ink-3 rounded font-bold scale-90 origin-left">Optional</span>
            </div>
            <div class="flex flex-col gap-1 mt-1.5">
              <div v-for="rev in activeReviews" :key="rev.id" class="flex items-center gap-1.5">
                <CheckCircle2 v-if="rev.completed" class="w-3.5 h-3.5 text-pri-strategic shrink-0" />
                <Circle v-else class="w-3.5 h-3.5 text-ink-3 shrink-0" />
                <span class="text-[10px]" :class="rev.completed ? 'text-ink-3 line-through font-normal' : 'text-ink-2 font-medium'">
                  {{ rev.label }}
                </span>
              </div>
            </div>
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

    <!-- Tree Image Mask Wrapper (Height: 100px) -->
    <div 
      class="w-24 h-24 flex items-center justify-center cursor-pointer transition-transform duration-300 hover:scale-105 relative select-none pointer-events-none"
      :style="{
        maskImage: 'url(/progress-tree.svg)',
        webkitMaskImage: 'url(/progress-tree.svg)',
        maskSize: 'contain',
        webkitMaskSize: 'contain',
        maskRepeat: 'no-repeat',
        webkitMaskRepeat: 'no-repeat',
        maskPosition: 'center',
        webkitMaskPosition: 'center'
      }"
    >
      <!-- Base faint gray outline (always visible under the green) -->
      <div 
        class="absolute inset-0 transition-all duration-300"
        :class="ui.theme === 'dark' ? 'bg-white/10' : 'bg-ink/10'"
      ></div>

      <!-- Solid Green Fill (representing progress completed, rising from bottom to top) -->
      <div 
        class="absolute inset-x-0 bottom-0 bg-[#1b4332] dark:bg-[#2d6a4f] transition-all duration-500 ease-out"
        :style="{ height: `${progress}%` }"
      ></div>
    </div>

    <!-- Streak Display below the tree (in grey) -->
    <div v-if="streakCount > 0" class="text-[10px] text-ink-3 font-semibold mt-1 font-mono tracking-wide flex items-center gap-0.5">
      <Flame class="w-3 h-3 fill-current text-ink-3" />
      <span>{{ streakCount }}d streak</span>
    </div>
  </div>
</template>

<style scoped>
.btn-ghost {
  @apply hover:bg-canvas hover:text-ink transition-colors cursor-pointer;
}
</style>
