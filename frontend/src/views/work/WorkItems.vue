<script setup>
import { computed, ref, watch, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useWorkItemsStore } from '@/stores/workItems'
import { useWorkClientsStore } from '@/stores/workClients'
import { useUIStore } from '@/stores/ui'
import PageHeader from '@/components/PageHeader.vue'
import SectionHeader from '@/components/SectionHeader.vue'
import EmptyState from '@/components/EmptyState.vue'
import WorkItemCard from '@/components/work/WorkItemCard.vue'
import WorkItemPopup from '@/components/work/WorkItemPopup.vue'
import { Plus } from 'lucide-vue-next'

const route = useRoute()
const router = useRouter()

const itemsStore = useWorkItemsStore()
const clientsStore = useWorkClientsStore()
const ui = useUIStore()

const activeTab = ref('due_date') // active, due_date, completed
const showAddDrawer = ref(false)
const prefillTitle = ref('')

// Group active items by status
const groupedActiveItems = computed(() => {
  const list = itemsStore.items.filter(item => {
    return !itemsStore.isCompleted(item.status)
  })

  const groups = {
    critical: [],
    in_progress: [],
    waiting_feedback: [],
    on_hold: [],
    ask_milestone: [],
    pending_closure: []
  }

  list.forEach(item => {
    let status = item.status || 'in_progress'
    if (status === 'open' || status === 'todo') {
      status = 'in_progress'
    }

    if (groups[status]) {
      groups[status].push(item)
    } else {
      groups.in_progress.push(item)
    }
  })

  console.log(groups)

  return groups
})

const activeItemsCount = computed(() => {
  return itemsStore.items.filter(item => !itemsStore.isCompleted(item.status)).length
})

const itemsByDueDate = computed(() => {
  const activeList = itemsStore.items.filter(item => !itemsStore.isCompleted(item.status))
  const today = dayjs().startOf('day')

  // Calculate the end of the current week (Sunday).
  // In dayjs, day() returns 0 for Sunday, 1 for Monday, etc.
  const currentDay = today.day()
  const daysToSunday = currentDay === 0 ? 0 : 7 - currentDay
  const endOfWeek = today.add(daysToSunday, 'day').endOf('day')

  const groups = {
    overdue: [],
    today: [],
    this_week: [],
    upcoming: [],
    no_due_date: []
  }

  const getEffectiveDate = (item) => {
    let effectiveDate = ''
    if (item.dueDate) {
      effectiveDate = item.dueDate
    }
    if (item.snoozedUntil) {
      const snoozeDate = dayjs(item.snoozedUntil).format('YYYY-MM-DD')
      if (!effectiveDate || snoozeDate > effectiveDate) {
        effectiveDate = snoozeDate
      }
    }
    return effectiveDate
  }

  activeList.forEach(item => {
    const effDate = getEffectiveDate(item)
    if (!effDate) {
      groups.no_due_date.push(item)
    } else {
      const due = dayjs(effDate).startOf('day')
      if (due.isBefore(today)) {
        groups.overdue.push(item)
      } else if (due.isSame(today, 'day')) {
        groups.today.push(item)
      } else if (due.isAfter(today) && (due.isBefore(endOfWeek) || due.isSame(endOfWeek, 'day'))) {
        groups.this_week.push(item)
      } else {
        groups.upcoming.push(item)
      }
    }
  })

  // Sort sections using the effective date
  groups.overdue.sort((a, b) => getEffectiveDate(a).localeCompare(getEffectiveDate(b)))
  groups.today.sort((a, b) => getEffectiveDate(a).localeCompare(getEffectiveDate(b)))
  groups.this_week.sort((a, b) => getEffectiveDate(a).localeCompare(getEffectiveDate(b)))
  groups.upcoming.sort((a, b) => getEffectiveDate(a).localeCompare(getEffectiveDate(b)))
  groups.no_due_date.sort((a, b) => dayjs(b.updatedAt || b.createdAt).diff(dayjs(a.updatedAt || a.createdAt)))

  return groups
})

const DUE_DATE_SECTIONS = [
  {
    key: 'overdue',
    overline: 'Action Needed',
    title: 'Overdue Deliverables',
  },
  {
    key: 'today',
    overline: 'Focus Today',
    title: 'Due Today',
  },
  {
    key: 'this_week',
    overline: 'This Week',
    title: 'Due This Week',
  },
  {
    key: 'upcoming',
    overline: 'Ahead',
    title: 'Upcoming Scope',
  },
  {
    key: 'no_due_date',
    overline: 'Backlog',
    title: 'No Due Date Set',
  }
]

import dayjs from 'dayjs'

const STATUS_SECTIONS = [
  {
    key: 'critical',
    overline: 'Priority',
    title: 'Critical Deliverables',
  },
  {
    key: 'in_progress',
    overline: 'Active',
    title: 'In Progress',
  },
  {
    key: 'waiting_feedback',
    overline: 'Pending',
    title: 'Waiting For Feedback',
  },
  {
    key: 'on_hold',
    overline: 'Paused',
    title: 'On Hold',
  },
  {
    key: 'ask_milestone',
    overline: 'Milestones',
    title: 'Ask For Next Milestone',
  },
  {
    key: 'pending_closure',
    overline: 'Wrapping Up',
    title: 'Pending Closure',
  }
]

const completedItems = computed(() => {
  return itemsStore.items.filter(item => itemsStore.isCompleted(item.status))
})

watch(() => route.query.new, (isNew) => {
  if (isNew === 'true') {
    prefillTitle.value = route.query.prefillTitle ? String(route.query.prefillTitle) : ''
    showAddDrawer.value = true
  }
}, { immediate: true })

watch(showAddDrawer, (isOpen) => {
  if (!isOpen && route.query.new === 'true') {
    router.replace({ query: { ...route.query, new: undefined, prefillTitle: undefined } })
  }
  if (!isOpen) {
    prefillTitle.value = ''
  }
})

function handleEscKey(e) {
  if ((e.metaKey || e.ctrlKey) && e.key === '1') {
    if (!showAddDrawer.value) {
      e.preventDefault()
      showAddDrawer.value = true
    }
  }
  if (e.altKey && !e.metaKey && !e.ctrlKey && e.code?.startsWith('Digit')) {
    const idx = parseInt(e.code.replace('Digit', '')) - 1
    const TABS = ['active', 'due_date', 'completed']
    if (idx >= 0 && idx < TABS.length) {
      e.preventDefault()
      activeTab.value = TABS[idx]
      return
    }
  }
  if (e.altKey && !e.metaKey && !e.ctrlKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
    const TABS = ['active', 'due_date', 'completed']
    const currentIdx = TABS.indexOf(activeTab.value)
    if (currentIdx !== -1) {
      e.preventDefault()
      const step = e.key === 'ArrowUp' ? -1 : 1
      const nextIdx = (currentIdx + step + TABS.length) % TABS.length
      activeTab.value = TABS[nextIdx]
      return
    }
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleEscKey)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleEscKey)
})
</script>

<template>
  <div class="px-8 md:px-12 py-10 max-w-5xl mx-auto space-y-8" data-testid="work-items">

    <!-- HEADER -->
    <PageHeader overline="Execution" title="Work scope"
      sub="Frictionless tasking and time tracking without rigid hierarchy constraints.">
      <template #right>
        <button @click="showAddDrawer = true" class="btn-primary">
          <Plus class="w-4 h-4" /> Create Work Item <span
            class="kbd ml-1.5 !bg-canvas/20 !border-canvas/10 !text-canvas select-none">⌘1</span>
        </button>
      </template>
    </PageHeader>

    <!-- TABS -->
    <div class="flex border-b border-line gap-6 text-sm font-medium">
      <button @click="activeTab = 'active'" class="pb-3 border-b-2"
        :class="activeTab === 'active' ? 'border-ink text-ink font-semibold' : 'border-transparent text-ink-3 hover:text-ink-2'">
        By Priority ({{ activeItemsCount }})
      </button>
      <button @click="activeTab = 'due_date'" class="pb-3 border-b-2"
        :class="activeTab === 'due_date' ? 'border-ink text-ink font-semibold' : 'border-transparent text-ink-3 hover:text-ink-2'">
        By Due Date ({{ activeItemsCount }})
      </button>
      <button @click="activeTab = 'completed'" class="pb-3 border-b-2"
        :class="activeTab === 'completed' ? 'border-ink text-ink font-semibold' : 'border-transparent text-ink-3 hover:text-ink-2'">
        Completed ({{ completedItems.length }})
      </button>
    </div>

    <!-- ACTIVE ITEMS VIEW -->
    <div v-if="activeTab === 'active'" class="space-y-8 animate-fade-in">
      <template v-for="sec in STATUS_SECTIONS" :key="sec.key">
        <div v-if="groupedActiveItems[sec.key] && groupedActiveItems[sec.key].length" class="space-y-3">
          <SectionHeader :overline="sec.overline" :title="sec.title" :hint="sec.hint" />
          <div class="space-y-2.5">
            <WorkItemCard v-for="item in groupedActiveItems[sec.key]" :key="item.id" :item="item" />
          </div>
        </div>
      </template>

      <!-- Empty state check -->
      <div v-if="Object.values(groupedActiveItems).every(list => !list.length)">
        <EmptyState title="All scopes clear"
          hint="Add tasks using the quick composer or click 'Create Work Item' above." />
      </div>
    </div>

    <!-- BY DUE DATE VIEW -->
    <div v-else-if="activeTab === 'due_date'" class="space-y-8 animate-fade-in">
      <template v-for="sec in DUE_DATE_SECTIONS" :key="sec.key">
        <div v-if="itemsByDueDate[sec.key] && itemsByDueDate[sec.key].length" class="space-y-3">
          <SectionHeader :overline="sec.overline" :title="sec.title" :hint="sec.hint" />
          <div class="space-y-2.5">
            <WorkItemCard v-for="item in itemsByDueDate[sec.key]" :key="item.id" :item="item" />
          </div>
        </div>
      </template>

      <!-- Empty state check -->
      <div v-if="Object.values(itemsByDueDate).every(list => !list.length)">
        <EmptyState title="All clear" hint="No active tasks. Create a new work item to begin." />
      </div>
    </div>

    <!-- COMPLETED VIEW -->
    <div v-else class="space-y-3 animate-fade-in">
      <div v-if="completedItems.length" class="space-y-2.5">
        <WorkItemCard v-for="item in completedItems" :key="item.id" :item="item" />
      </div>
      <EmptyState v-else title="Nothing archived yet" hint="Complete your active tasks to build momentum." />
    </div>

    <!-- QUICK ADD DRAWER (OS composition style) -->
    <WorkItemPopup v-if="showAddDrawer" :prefillTitle="prefillTitle" @close="showAddDrawer = false" />



  </div>
</template>
