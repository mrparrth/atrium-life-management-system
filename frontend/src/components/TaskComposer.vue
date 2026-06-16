<script setup>
import { ref, watch } from 'vue'
import { useTasksStore } from '@/stores/tasks'
import { useProjectsStore } from '@/stores/projects'
import { useUIStore } from '@/stores/ui'
import { X, Plus } from 'lucide-vue-next'
import PriorityBadge from './PriorityBadge.vue'
import dayjs from 'dayjs'

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

function adjustDueDate(days) {
  const current = dueDate.value ? dayjs(dueDate.value) : dayjs()
  dueDate.value = current.add(days, 'day').format('YYYY-MM-DD')
}

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
      <div class="v-field-group">
        <input type="date" v-model="scheduledDate" placeholder=" " class="v-field-input text-xs text-ink-2 font-mono" id="task-scheduled" data-testid="task-scheduled-input" />
        <label for="task-scheduled" class="v-field-label text-xs">Scheduled Date</label>
      </div>
      <div class="v-field-group block">
        <input type="date" v-model="dueDate" placeholder=" " class="v-field-input text-xs text-ink-2 font-mono" id="task-due" data-testid="task-due-input" />
        <label for="task-due" class="v-field-label text-xs">Due Date</label>
        <div class="flex items-center gap-1 mt-1.5 flex-wrap">
          <button type="button" @click="adjustDueDate(-1)" class="text-[9px] uppercase tracking-wider font-semibold text-ink-3 bg-canvas border border-line px-1.5 py-0.5 rounded hover:bg-line transition-all font-mono" title="Subtract 1 day">-1d</button>
          <button type="button" @click="adjustDueDate(1)" class="text-[9px] uppercase tracking-wider font-semibold text-ink-3 bg-canvas border border-line px-1.5 py-0.5 rounded hover:bg-line transition-all font-mono" title="Add 1 day">+1d</button>
          <button type="button" @click="adjustDueDate(5)" class="text-[9px] uppercase tracking-wider font-semibold text-ink-3 bg-canvas border border-line px-1.5 py-0.5 rounded hover:bg-line transition-all font-mono" title="Add 5 days">+5d</button>
          <button type="button" @click="adjustDueDate(10)" class="text-[9px] uppercase tracking-wider font-semibold text-ink-3 bg-canvas border border-line px-1.5 py-0.5 rounded hover:bg-line transition-all font-mono" title="Add 10 days">+10d</button>
          <button type="button" @click="dueDate = ''" class="text-[9px] uppercase tracking-wider font-semibold text-ink-3 hover:text-ink ml-auto transition-all">Clear</button>
        </div>
      </div>
    </div>

    <!-- Closed Date — only visible when editing a completed task -->
    <div v-if="isDone" class="v-field-group">
      <input type="date" v-model="completedAt" placeholder=" " class="v-field-input text-xs font-mono text-pri-strategic" id="task-closed" data-testid="task-closed-date-input" />
      <label for="task-closed" class="v-field-label text-xs" style="color: var(--color-pri-strategic)">Closed Date</label>
    </div>

    <div class="v-field-group">
      <select v-model="status" @focus="focusedFields.status = true"
        @blur="focusedFields.status = false" class="v-field-select text-xs font-semibold" data-testid="task-status-select">
        <option value="open">Yet to start</option>
        <option value="in_progress">In progress</option>
        <option value="done">Complete</option>
      </select>
      <span class="v-field-arrow">▼</span>
      <label
        :class="['v-field-label text-xs font-semibold', (status || focusedFields.status) ? 'v-field-label--floating' : '', focusedFields.status ? 'v-field-label--floating-focused' : '']">Status</label>
    </div>

    <div class="v-field-group">
      <select v-model="projectId" @focus="focusedFields.projectId = true"
        @blur="focusedFields.projectId = false" class="v-field-select text-xs font-semibold" data-testid="task-project-select">
        <option :value="null">- none -</option>
        <option v-for="p in projects.items.filter(p => p.status === 'active')" :key="p.id" :value="p.id">{{ p.title }}
        </option>
      </select>
      <span class="v-field-arrow">▼</span>
      <label
        :class="['v-field-label text-xs font-semibold', (projectId !== null || focusedFields.projectId) ? 'v-field-label--floating' : '', focusedFields.projectId ? 'v-field-label--floating-focused' : '']">Project</label>
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
