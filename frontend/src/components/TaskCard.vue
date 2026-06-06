<script setup>
import { computed } from 'vue'
import { useTasksStore } from '@/stores/tasks'
import { useProjectsStore } from '@/stores/projects'
import { useUIStore } from '@/stores/ui'
import { derivePriority } from '@/lib/priority'
import { inFuture, fromNow } from '@/lib/date'
import { isSnoozed } from '@/lib/resurface'
import PriorityBadge from './PriorityBadge.vue'
import { Calendar, Clock, MoonStar, Trash2 } from 'lucide-vue-next'

const props = defineProps({ task: Object, showProject: { type: Boolean, default: true }, compact: { type: Boolean, default: false } })
const emit = defineEmits(['open'])

const tasks = useTasksStore()
const projects = useProjectsStore()
const ui = useUIStore()


const project = computed(() => projects.items.find(p => p.id === props.task.projectId))
const priority = computed(() => derivePriority(props.task.important, props.task.urgent))
const isDone = computed(() => props.task.status === 'done')
const snoozed = computed(() => isSnoozed(props.task))

function toggle() { tasks.toggleComplete(props.task.id) }
function snooze1d() { tasks.snooze(props.task.id, 1) }
async function del() { if (await ui.confirm({ message: 'Remove this task?', title: 'Remove Task' })) tasks.remove(props.task.id) }
</script>

<template>
  <div class="group card p-4 hover:border-line-2 transition-all duration-300 animate-fade-in"
    :class="{ 'opacity-50': snoozed }" :data-testid="`task-card-${task.id}`">
    <div class="flex items-start gap-3">
      <button @click.stop="toggle"
        class="mt-1 w-5 h-5 rounded-md border-2 transition-all duration-300 flex items-center justify-center shrink-0"
        :class="isDone ? 'bg-ink border-ink' : 'border-line-2 hover:border-ink-2'"
        :data-testid="`task-toggle-${task.id}`" :aria-label="isDone ? 'Mark incomplete' : 'Mark complete'">
        <svg v-if="isDone" class="w-3 h-3 text-canvas" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          stroke-width="3">
          <path d="M5 13l4 4L19 7" />
        </svg>
      </button>

      <div class="flex-1 min-w-0 cursor-pointer" @click="emit('open', task)">
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0">
            <div class="text-[15px] leading-snug" :class="{ 'line-through text-ink-3': isDone, 'text-ink': !isDone }">
              {{ task.title }}
            </div>
            <p v-if="task.description && !compact" class="text-sm text-ink-2 mt-1 line-clamp-2">{{ task.description }}
            </p>
          </div>
          <PriorityBadge :important="task.important" :urgent="task.urgent" :compact="true" />
        </div>

        <div class="flex flex-wrap items-center gap-x-4 gap-y-1.5 mt-3 text-xs text-ink-3">
          <span v-if="showProject && project" class="inline-flex items-center gap-1">
            <span class="w-1 h-1 rounded-full bg-ink-3"></span>
            {{ project.title }}
          </span>
          <span v-if="task.scheduledDate" class="inline-flex items-center gap-1">
            <Calendar class="w-3 h-3" /> {{ inFuture(task.scheduledDate) }}
          </span>
          <span v-if="task.dueDate" class="inline-flex items-center gap-1">
            <Clock class="w-3 h-3" /> due {{ inFuture(task.dueDate) }}
          </span>
          <span v-if="snoozed" class="inline-flex items-center gap-1">
            <MoonStar class="w-3 h-3" /> snoozed
          </span>
          <span v-if="task.tags && task.tags.length" class="inline-flex items-center gap-1">
            <template v-for="t in task.tags" :key="t">·{{ t }}</template>
          </span>
        </div>
      </div>

      <div class="opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center gap-1">
        <button @click.stop="snooze1d" class="btn-ghost !p-1.5" title="Snooze 1 day"
          :data-testid="`task-snooze-${task.id}`">
          <MoonStar class="w-3.5 h-3.5" />
        </button>
        <button @click.stop="del" class="btn-ghost !p-1.5 hover:text-pri-critical" title="Delete"
          :data-testid="`task-delete-${task.id}`">
          <Trash2 class="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  </div>
</template>
