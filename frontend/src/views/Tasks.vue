<script setup>
import { computed, ref } from 'vue'
import { useTasksStore } from '@/stores/tasks'
import { useProjectsStore } from '@/stores/projects'
import { useUIStore } from '@/stores/ui'
import { derivePriority, PRIORITY } from '@/lib/priority'
import { isTaskOpen, toLocalDateStr } from '@/lib/resurface'
import PageHeader from '@/components/PageHeader.vue'
import TaskCard from '@/components/TaskCard.vue'
import EmptyState from '@/components/EmptyState.vue'
import { Plus, ChevronDown, ChevronRight, CheckCheck } from 'lucide-vue-next'
import dayjs from 'dayjs'

const tasks = useTasksStore()
const projects = useProjectsStore()
const ui = useUIStore()

const priorityFilter = ref("all")
const projectFilter = ref("all")
const showCompleted = ref(false)

const getTaskEffectiveDate = (t) => {
  let date = toLocalDateStr(t.dueDate) || toLocalDateStr(t.scheduledDate) || ''
  if (t.snoozedUntil) {
    const snoozeStr = toLocalDateStr(t.snoozedUntil)
    if (!date || snoozeStr > date) date = snoozeStr
  }
  return date
}

const dateGroups = computed(() => {
  const openTasks = tasks.items.filter(t => isTaskOpen(t))
  
  let list = openTasks
  if (priorityFilter.value !== 'all') {
    list = list.filter(t => derivePriority(t.important, t.urgent).key === priorityFilter.value)
  }
  if (projectFilter.value !== 'all') {
    list = list.filter(t => t.projectId === projectFilter.value)
  }

  const today = dayjs().startOf('day')
  const endOfWeek = dayjs().endOf('week')

  const groups = [
    { key: 'overdue', label: 'Overdue', dotClass: 'bg-red-500', items: [] },
    { key: 'today', label: 'Due Today', dotClass: 'bg-emerald-500', items: [] },
    { key: 'this_week', label: 'This Week', dotClass: 'bg-amber-500', items: [] },
    { key: 'upcoming', label: 'Upcoming', dotClass: 'bg-blue-500', items: [] },
    { key: 'no_due_date', label: 'No Due Date', dotClass: 'bg-slate-400', items: [] },
  ]

  list.forEach(t => {
    const effDate = getTaskEffectiveDate(t)
    if (!effDate) {
      groups.find(g => g.key === 'no_due_date').items.push(t)
    } else {
      const due = dayjs(effDate).startOf('day')
      if (due.isBefore(today)) {
        groups.find(g => g.key === 'overdue').items.push(t)
      } else if (due.isSame(today, 'day')) {
        groups.find(g => g.key === 'today').items.push(t)
      } else if (due.isAfter(today) && (due.isBefore(endOfWeek) || due.isSame(endOfWeek, 'day'))) {
        groups.find(g => g.key === 'this_week').items.push(t)
      } else {
        groups.find(g => g.key === 'upcoming').items.push(t)
      }
    }
  })

  return groups.filter(g => g.items.length > 0)
})

const completedTasks = computed(() => {
  return tasks.items.filter(t => t.status === 'done')
})

const totalOpenCount = computed(() => {
  return tasks.items.filter(t => isTaskOpen(t)).length
})
</script>

<template>
  <div class="px-8 md:px-12 py-10 max-w-7xl mx-auto" data-testid="tasks-view">
    <PageHeader overline="Action" title="Tasks" sub="Organized by schedule and effective due dates.">
      <template #right>
        <button class="btn-primary" @click="ui.openQuickCapture" data-testid="tasks-capture-btn">
          <Plus class="w-4 h-4" /> Capture <span class="kbd ml-1.5 !bg-canvas/20 !border-canvas/10 !text-canvas select-none">⌘1</span>
        </button>
      </template>
    </PageHeader>

    <!-- Filters Bar -->
    <div class="flex flex-wrap items-center gap-3 mb-8" data-testid="tasks-filters">
      <select v-model="priorityFilter" class="input-block !w-auto text-sm" data-testid="filter-priority">
        <option value="all">All priorities</option>
        <option v-for="(p, key) in PRIORITY" :key="key" :value="p.key">{{ p.label }}</option>
      </select>
      <select v-model="projectFilter" class="input-block !w-auto text-sm" data-testid="filter-project">
        <option value="all">All projects</option>
        <option v-for="p in projects.items" :key="p.id" :value="p.id">{{ p.title }}</option>
      </select>

      <span class="text-xs text-ink-3 font-mono ml-auto">
        {{ totalOpenCount }} open task{{ totalOpenCount === 1 ? '' : 's' }}
      </span>
    </div>

    <!-- Date Grouped Task Lists -->
    <div class="space-y-10">
      <section v-for="group in dateGroups" :key="group.key" :data-testid="`group-${group.key}`">
        <div class="flex items-center gap-2 mb-4">
          <span class="w-2 h-2 rounded-full shrink-0" :class="group.dotClass"></span>
          <h3 class="text-lg font-medium">{{ group.label }}</h3>
          <span class="text-ink-3 text-sm">· {{ group.items.length }}</span>
        </div>
        <div class="space-y-2">
          <TaskCard v-for="t in group.items" :key="t.id" :task="t" :single-line="true" />
        </div>
      </section>

      <EmptyState v-if="!dateGroups.length" title="No open tasks" hint="You are all caught up! Capture a new task whenever needed." />

      <!-- Optional Completed Tasks Accordion -->
      <div v-if="completedTasks.length" class="pt-8 border-t border-line/40">
        <button @click="showCompleted = !showCompleted" class="flex items-center gap-2 text-xs font-mono font-semibold uppercase tracking-wider text-ink-3 hover:text-ink transition-colors">
          <component :is="showCompleted ? ChevronDown : ChevronRight" class="w-4 h-4" />
          <CheckCheck class="w-3.5 h-3.5 text-emerald-500" />
          <span>Completed Tasks ({{ completedTasks.length }})</span>
        </button>

        <div v-if="showCompleted" class="mt-4 space-y-2">
          <TaskCard v-for="t in completedTasks" :key="t.id" :task="t" :single-line="true" />
        </div>
      </div>
    </div>
  </div>
</template>
