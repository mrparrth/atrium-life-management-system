<script setup>
import { ref, watch, computed, onMounted, onUnmounted } from 'vue'
import { useTasksStore } from '@/stores/tasks'
import { useProjectsStore } from '@/stores/projects'
import { useUIStore } from '@/stores/ui'
import { X, Plus, CheckCheck } from 'lucide-vue-next'
import { derivePriority } from '@/lib/priority'
import dayjs from 'dayjs'
import DateField from './DateField.vue'
import VInput from './VInput.vue'
import VTextarea from './VTextarea.vue'
import VRow from '@/components/VRow.vue'
import VSelect from './VSelect.vue'
import VCheckbox from './VCheckbox.vue'

const props = defineProps({ defaultProjectId: { type: String, default: null }, initialTask: { type: Object, default: null } })
const emit = defineEmits(['close', 'created', 'updated'])

const tasks = useTasksStore()
const projects = useProjectsStore()
const ui = useUIStore()

const title = ref(props.initialTask?.title || '')
const description = ref(props.initialTask?.description || '')
const projectId = ref(props.initialTask?.projectId || props.defaultProjectId)
const scheduledDate = ref(props.initialTask?.scheduledDate || '')
const dueDate = ref(props.initialTask?.dueDate || dayjs().format('YYYY-MM-DD'))
const important = ref(props.initialTask ? props.initialTask.important : true)
const urgent = ref(props.initialTask?.urgent || false)
const completedAt = ref(props.initialTask?.completedAt || '')
const isDone = ref(props.initialTask?.status === 'done')
const status = ref(props.initialTask?.status || 'open')
const titleEl = ref(null)
const focusedFields = ref({})

const enableSubtasks = ref(props.initialTask?.enableSubtasks || (props.initialTask?.subtasks && props.initialTask.subtasks.length > 0) || false)
const subtasks = ref(props.initialTask?.subtasks ? JSON.parse(JSON.stringify(props.initialTask.subtasks)) : [])
const newSubtaskTitle = ref('')

function handleKeydown(e) {
  if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
    e.preventDefault()
    save()
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown)
})

function addSubtask() {
  if (!newSubtaskTitle.value.trim()) return
  subtasks.value.push({
    id: Math.random().toString(36).slice(2, 9),
    title: newSubtaskTitle.value.trim(),
    done: false
  })
  newSubtaskTitle.value = ''
}

function removeSubtask(id) {
  subtasks.value = subtasks.value.filter(s => s.id !== id)
}

const computedPriority = computed(() => {
  return derivePriority(important.value, urgent.value)
})

watch(titleEl, el => el?.focus())

watch(status, (newVal) => {
  isDone.value = (newVal === 'done')
  if (newVal === 'done') {
    if (!completedAt.value) {
      completedAt.value = new Date().toISOString().slice(0, 10)
    }
  } else {
    completedAt.value = ''
  }
})

const isSaving = ref(false)

async function save() {
  if (isSaving.value) return
  if (!title.value.trim()) return
  isSaving.value = true

  try {
    const payload = {
      title: title.value, description: description.value,
      projectId: projectId.value || null,
      scheduledDate: scheduledDate.value || null,
      dueDate: dueDate.value || null,
      important: important.value, urgent: urgent.value,
      status: status.value,
      enableSubtasks: enableSubtasks.value,
      subtasks: enableSubtasks.value ? subtasks.value : []
    }

    if (props.initialTask) {
      // Include completedAt if editing a done task
      if (isDone.value) payload.completedAt = completedAt.value || null
      await tasks.update(props.initialTask.id, payload)
      ui.showToast('Task updated', 'success')
      emit('updated', props.initialTask.id)
    } else {
      if (isDone.value) payload.completedAt = completedAt.value || null
      const t = await tasks.add(payload)
      ui.showToast('Task captured', 'success')
      emit('created', t)
    }
    emit('close')
  } finally {
    isSaving.value = false
  }
}

async function toggleCompleteAndSave() {
  status.value = isDone.value ? 'open' : 'done'
  isDone.value = (status.value === 'done')
  if (status.value === 'done') {
    completedAt.value = new Date().toISOString().slice(0, 10)
  } else {
    completedAt.value = ''
  }
  await save()
}
</script>

<template>
  <form @submit.prevent="save" class="space-y-5 relative" data-testid="task-composer">

    <!-- 2-Column Grid -->
    <div class="flex flex-col md:flex-row gap-6 items-start">
      <!-- Left Column (Primary Input) -->
      <div class="flex-1 space-y-4 w-full">
        <VInput ref="titleEl" v-model="title" label="What needs to be remembered… *" id="task-title"
          data-testid="task-title-input" required />

        <VTextarea v-model="description" label="A little context (optional)" id="task-desc"
          data-testid="task-description-input" autogrow />

        <!-- Subtasks Section -->
        <div class="border border-line/50 rounded-2xl p-4 bg-canvas/10 space-y-3">
          <div class="flex items-center justify-between">
            <label class="text-xs font-bold uppercase tracking-wider text-ink-2 select-none flex items-center gap-2">
              <span>Subtasks Checklist</span>
              <span v-if="enableSubtasks && subtasks.length > 0" class="font-mono text-[10px] text-ink-3">
                ({{subtasks.filter(s => s.done).length}}/{{ subtasks.length }})
              </span>
            </label>
            <VCheckbox v-model="enableSubtasks" label="Enable subtasks" id="task-enable-subtasks" />
          </div>

          <div v-if="enableSubtasks" class="space-y-3 pt-3 border-t border-line/35">
            <!-- New Subtask Input -->
            <div class="flex gap-2">
              <input v-model="newSubtaskTitle" type="text" placeholder="Add subtask... (Press Enter)"
                @keydown.enter.prevent="addSubtask"
                class="flex-1 bg-surface border border-line rounded-xl px-3.5 py-2 text-xs text-ink outline-none focus:border-pri-strategic/50 focus:ring-2 focus:ring-pri-strategic/10 font-sans" />
              <button type="button" @click="addSubtask"
                class="btn-secondary !py-1.5 !px-3 text-xs flex items-center justify-center shrink-0">
                <Plus class="w-3.5 h-3.5" />
              </button>
            </div>

            <!-- Subtask List -->
            <div v-if="subtasks.length > 0" class="space-y-2 max-h-48 overflow-y-auto pr-1">
              <div v-for="sub in subtasks" :key="sub.id"
                class="flex items-center justify-between gap-2.5 p-2 rounded-xl border border-line/45 bg-surface hover:bg-canvas/5 transition-colors">

                <div class="flex items-center gap-2 flex-1 min-w-0">
                  <input type="checkbox" v-model="sub.done"
                    class="rounded border-line text-pri-strategic focus:ring-pri-strategic cursor-pointer h-3.5 w-3.5" />
                  <input v-model="sub.title" type="text"
                    class="bg-transparent border-0 border-b border-transparent focus:border-line focus:ring-0 p-0 text-xs text-ink font-medium w-full truncate focus:truncate-none outline-none"
                    :class="{ 'line-through text-ink-3': sub.done }" />
                </div>

                <button type="button" @click="removeSubtask(sub.id)"
                  class="text-ink-3 hover:text-pri-critical p-1 rounded transition-colors shrink-0">
                  <X class="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Right Column (Metadata Sidebar) -->
      <div class="w-full md:w-[280px] space-y-4 shrink-0 bg-canvas/5 border border-line/40 rounded-2xl p-4">
        <!-- Status Selector -->
        <VSelect v-model="status" label="Status" id="task-status" data-testid="task-status-select" :options="[
          { key: 'open', label: 'Yet to start' },
          { key: 'in_progress', label: 'In progress' },
          { key: 'done', label: 'Complete' }
        ]" option-value="key" option-label="label" />

        <!-- Project Selector -->
        <VSelect v-model="projectId" label="Project" id="task-project" data-testid="task-project-select"
          :options="projects.items.filter(p => p.status === 'active')" option-value="id" option-label="title" searchable
          placeholder="---none---" />

        <!-- Priority parameters (2 checkbox system) -->
        <div class="card p-3 space-y-2 bg-canvas/10 border border-line/50 rounded-2xl"
          data-testid="task-priority-checkboxes">
          <div class="flex items-center justify-between">
            <div class="text-xs font-bold uppercase tracking-wider text-ink-2 select-none">Priority</div>
            <!-- Derived Priority Chip in Header -->
            <span
              class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold capitalize border select-none"
              :class="[
                computedPriority.key === 'critical' ? 'bg-red-500/10 border-red-500/20 text-red-600 dark:text-red-400' : '',
                computedPriority.key === 'strategic' ? 'bg-amber-500/10 border-amber-500/20 text-amber-600 dark:text-amber-400' : '',
                computedPriority.key === 'interruptive' ? 'bg-blue-500/10 border-blue-500/20 text-blue-600 dark:text-blue-400' : '',
                computedPriority.key === 'backlog' ? 'bg-slate-500/10 border-slate-500/20 text-slate-600 dark:text-slate-400' : ''
              ]">
              <span class="w-1.5 h-1.5 rounded-full shrink-0" :class="[
                computedPriority.key === 'critical' ? 'bg-red-500' : '',
                computedPriority.key === 'strategic' ? 'bg-amber-500' : '',
                computedPriority.key === 'interruptive' ? 'bg-blue-500' : '',
                computedPriority.key === 'backlog' ? 'bg-slate-500' : ''
              ]"></span>
              {{ computedPriority.label }}
            </span>
          </div>
          <div class="space-y-1 pt-3 border-t border-line/35">
            <!-- Checkboxes side-by-side -->
            <div class="flex items-center gap-6">
              <VCheckbox v-model="important" label="Important" id="task-important"
                data-testid="task-important-checkbox" />
              <VCheckbox v-model="urgent" label="Urgent" id="task-urgent" data-testid="task-urgent-checkbox" />
            </div>
          </div>
        </div>

        <!-- Scheduled & Due Dates -->
        <DateField v-model="scheduledDate" label="Scheduled Date" id="task-scheduled"
          dataTestid="task-scheduled-input" />

        <DateField v-model="dueDate" label="Due Date" id="task-due" dataTestid="task-due-input" popoverPosition="top" />

        <!-- Closed Date — only visible when editing a completed task -->
        <DateField v-if="isDone" v-model="completedAt" label="Closed Date" id="task-closed"
          dataTestid="task-closed-date-input" popoverPosition="top" />
      </div>
    </div>

    <!-- Actions -->
    <div class="flex items-center justify-between gap-2 pt-2 border-t border-line/35">
      <div>
        <button v-if="initialTask" type="button"
          class="btn-secondary !py-1.5 !px-3 text-xs flex items-center gap-1.5 select-none"
          @click="toggleCompleteAndSave">
          <CheckCheck class="w-4 h-4" />
          <span>{{ isDone ? 'Mark Incomplete' : 'Mark Complete' }}</span>
        </button>
      </div>

      <div class="flex items-center gap-2">
        <button type="button" class="btn-ghost" @click="$emit('close')" data-testid="task-cancel">Cancel</button>
        <button type="submit" class="btn-primary" data-testid="task-save">
          <template v-if="initialTask">
            Save changes <span
              class="kbd !bg-canvas/20 !border-canvas/10 !text-canvas select-none text-[9px] ml-1">⌘Enter</span>
          </template>
          <template v-else>
            <Plus class="w-4 h-4" /> Capture <span
              class="kbd !bg-canvas/20 !border-canvas/10 !text-canvas select-none text-[9px] ml-1">⌘Enter</span>
          </template>
        </button>
      </div>
    </div>
  </form>
</template>
