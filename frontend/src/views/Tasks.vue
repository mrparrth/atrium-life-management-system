<script setup>
import { computed, ref } from 'vue'
import { useTasksStore } from '@/stores/tasks'
import { useProjectsStore } from '@/stores/projects'
import { useUIStore } from '@/stores/ui'
import { derivePriority } from '@/lib/priority'
import { isSnoozed, isTaskOpen } from '@/lib/resurface'
import PageHeader from '@/components/PageHeader.vue'
import TaskCard from '@/components/TaskCard.vue'
import EmptyState from '@/components/EmptyState.vue'
import { Plus } from 'lucide-vue-next'

const tasks = useTasksStore()
const projects = useProjectsStore()
const ui = useUIStore()

import { PRIORITY } from "@/lib/priority"

const filter = ref("open"); // open | done | all
const priorityFilter = ref("all");
const projectFilter = ref("all");

const filtered = computed(() => {
  let list = tasks.items
  if (filter.value === 'open') list = list.filter(t => isTaskOpen(t))
  else if (filter.value === 'done') list = list.filter(t => t.status === 'done')
  if (priorityFilter.value !== 'all') list = list.filter(t => derivePriority(t.important, t.urgent).key === priorityFilter.value)
  if (projectFilter.value !== 'all') list = list.filter(t => t.projectId === projectFilter.value)
  return list
})

const groups = computed(() => {
  const g = { critical: [], strategic: [], interruptive: [], backlog: [] }
  for (const t of filtered.value) g[derivePriority(t.important, t.urgent).key].push(t)
  return g
})
</script>

<template>
  <div class="px-8 md:px-12 py-10 max-w-5xl mx-auto" data-testid="tasks-view">
    <PageHeader overline="All tasks" title="Tasks" sub="Grouped quietly by the meaning they carry.">
      <template #right>
        <button class="btn-primary" @click="ui.openQuickCapture" data-testid="tasks-capture-btn">
          <Plus class="w-4 h-4" /> Capture
        </button>
      </template>
    </PageHeader>

    <div class="flex flex-wrap items-center gap-2 mb-8" data-testid="tasks-filters">
      <div class="flex bg-elevated rounded-xl p-1 border border-line text-sm">
        <button v-for="f in ['open', 'done', 'all']" :key="f" :data-testid="`filter-${f}`"
          class="px-3 py-1.5 rounded-lg transition-colors duration-200"
          :class="filter === f ? 'bg-surface text-ink' : 'text-ink-2 hover:text-ink'" @click="filter = f">{{ f
          }}</button>
      </div>
      <select v-model="priorityFilter" class="input-block !w-auto text-sm" data-testid="filter-priority">
        <option value="all">All priorities</option>
        <option v-for="(p, key) in PRIORITY" :key="key" :value="p.key">{{ p.label }}</option>
      </select>
      <select v-model="projectFilter" class="input-block !w-auto text-sm" data-testid="filter-project">
        <option value="all">All projects</option>
        <option v-for="p in projects.items" :key="p.id" :value="p.id">{{ p.title }}</option>
      </select>
    </div>

    <div class="space-y-10">
      <section v-for="(items, key) in groups" :key="key" v-show="items.length" :data-testid="`group-${key}`">
        <div class="flex items-center gap-2 mb-4">
          <span class="priority-dot" :class="`bg-pri-${key}`"></span>
          <h3 class="text-lg font-medium capitalize">{{ key }}</h3>
          <span class="text-ink-3 text-sm">· {{ items.length }}</span>
        </div>
        <div class="space-y-3">
          <TaskCard v-for="t in items" :key="t.id" :task="t" />
        </div>
      </section>
      <EmptyState v-if="!filtered.length" title="Nothing here" hint="Try a different filter, or capture a new task." />
    </div>
  </div>
</template>
