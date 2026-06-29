<script setup>
import { ref, watch } from 'vue'
import { useTasksStore } from '@/stores/tasks'
import { useProjectsStore } from '@/stores/projects'
import { useUIStore } from '@/stores/ui'
import { X, Plus } from 'lucide-vue-next'
import PriorityBadge from './PriorityBadge.vue'
import dayjs from 'dayjs'
import DateField from './DateField.vue'

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
const important = ref(props.initialTask?.important || false)
const urgent = ref(props.initialTask?.urgent || false)
const completedAt = ref(props.initialTask?.completedAt || '')
const isDone = ref(props.initialTask?.status === 'done')
const status = ref(props.initialTask?.status || 'open')
const titleEl = ref(null)
const focusedFields = ref({})

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



async function save() {
  if (!title.value.trim()) return
  const payload = {
    title: title.value, description: description.value,
    projectId: projectId.value || null,
    scheduledDate: scheduledDate.value || null,
    dueDate: dueDate.value || null,
    important: important.value, urgent: urgent.value,
    status: status.value,
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
}
</script>

<template>
  <form @submit.prevent="save" @keydown.meta.enter.prevent="save" @keydown.ctrl.enter.prevent="save" class="space-y-5" data-testid="task-composer">
    <div class="v-field-group">
      <input ref="titleEl" v-model="title" placeholder=" "
        class="v-field-input text-lg font-bold font-sans" id="task-title" data-testid="task-title-input" required />
      <label for="task-title" class="v-field-label text-base font-semibold">What needs to be remembered… *</label>
    </div>

    <div class="v-field-group">
      <textarea v-model="description" placeholder=" " rows="2"
        class="v-field-input h-16 py-2 resize-none font-sans text-xs leading-relaxed" id="task-desc" data-testid="task-description-input" />
      <label for="task-desc" class="v-field-label text-xs">A little context (optional)</label>
    </div>

    <div class="flex flex-wrap items-center gap-3">
      <label class="flex items-center gap-2 cursor-pointer select-none" data-testid="important-label">
        <input type="checkbox" v-model="important" class="checkbox" data-testid="task-important-checkbox" />
        <span class="text-sm text-ink-2">Important</span>
      </label>
      <label class="flex items-center gap-2 cursor-pointer select-none" data-testid="urgent-label">
        <input type="checkbox" v-model="urgent" class="checkbox" data-testid="task-urgent-checkbox" />
        <span class="text-sm text-ink-2">Urgent</span>
      </label>
      <div class="ml-auto">
        <PriorityBadge :important="important" :urgent="urgent" />
      </div>
    </div>

    <div class="grid grid-cols-2 gap-4">
      <DateField v-model="scheduledDate" label="Scheduled Date" id="task-scheduled" dataTestid="task-scheduled-input" />
      <DateField v-model="dueDate" label="Due Date" id="task-due" dataTestid="task-due-input" />
    </div>

    <!-- Closed Date — only visible when editing a completed task -->
    <div v-if="isDone" class="v-field-group">
      <input type="date" v-model="completedAt" placeholder=" " class="v-field-input text-xs font-mono text-pri-strategic" id="task-closed" data-testid="task-closed-date-input" />
      <label for="task-closed" class="v-field-label text-xs" style="color: var(--color-pri-strategic)">Closed Date</label>
    </div>

    <div class="v-field-group">
      <label class="block text-[10px] uppercase text-ink-3 mb-1.5 font-bold">Status</label>
      <div class="relative">
        <select v-model="status" class="w-full bg-surface border border-line rounded-lg px-3 py-2.5 text-xs select-none min-h-[48px] focus:outline-none focus:border-pri-strategic text-ink font-semibold appearance-none cursor-pointer" data-testid="task-status-select">
          <option value="open">Yet to start</option>
          <option value="in_progress">In progress</option>
          <option value="done">Complete</option>
        </select>
        <span class="absolute right-3.5 top-1/2 -translate-y-1/2 text-[10px] text-ink-3 pointer-events-none">▼</span>
      </div>
    </div>

    <div class="v-field-group">
      <label class="block text-[10px] uppercase text-ink-3 mb-1.5 font-bold">Project</label>
      <div class="relative">
        <select v-model="projectId" class="w-full bg-surface border border-line rounded-lg px-3 py-2.5 text-xs select-none min-h-[48px] focus:outline-none focus:border-pri-strategic text-ink font-semibold appearance-none cursor-pointer" data-testid="task-project-select">
          <option :value="null">- none -</option>
          <option v-for="p in projects.items.filter(p => p.status === 'active')" :key="p.id" :value="p.id">{{ p.title }}</option>
        </select>
        <span class="absolute right-3.5 top-1/2 -translate-y-1/2 text-[10px] text-ink-3 pointer-events-none">▼</span>
      </div>
    </div>

    <div class="flex items-center justify-end gap-2 pt-2">
      <button type="button" class="btn-ghost" @click="$emit('close')" data-testid="task-cancel">Cancel</button>
      <button type="submit" class="btn-primary" data-testid="task-save">
        <template v-if="initialTask">
          Save changes <span class="kbd !bg-canvas/20 !border-canvas/10 !text-canvas select-none text-[9px] ml-1">⌘Enter</span>
        </template>
        <template v-else>
          <Plus class="w-4 h-4" /> Capture <span class="kbd !bg-canvas/20 !border-canvas/10 !text-canvas select-none text-[9px] ml-1">⌘Enter</span>
        </template>
      </button>
    </div>
  </form>
</template>
