<script setup>
import { ref, watch } from 'vue'
import { useTasksStore } from '@/stores/tasks'
import { useProjectsStore } from '@/stores/projects'
import { useUIStore } from '@/stores/ui'
import { X, Plus } from 'lucide-vue-next'
import PriorityBadge from './PriorityBadge.vue'
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
  <form @submit.prevent="save" @keydown.meta.enter.prevent="save" @keydown.ctrl.enter.prevent="save" class="space-y-5"
    data-testid="task-composer">
    <VInput ref="titleEl" v-model="title" label="What needs to be remembered… *" id="task-title"
      data-testid="task-title-input" required />

    <VTextarea v-model="description" label="A little context (optional)" id="task-desc"
      data-testid="task-description-input" autogrow />

    <div class="flex flex-wrap items-center justify-end gap-5 ms-1">
      <VCheckbox v-model="important" label="Important" data-testid="task-important-checkbox" />
      <VCheckbox v-model="urgent" label="Urgent" data-testid="task-urgent-checkbox" />
      <div class="ml-2">
        <PriorityBadge :important="important" :urgent="urgent" />
      </div>
    </div>

    <div class="grid grid-cols-2 gap-4">
      <DateField v-model="scheduledDate" label="Scheduled Date" id="task-scheduled" dataTestid="task-scheduled-input" />
      <DateField v-model="dueDate" label="Due Date" id="task-due" dataTestid="task-due-input" />
    </div>

    <!-- Closed Date — only visible when editing a completed task -->
    <DateField v-if="isDone" v-model="completedAt" label="Closed Date" id="task-closed"
      dataTestid="task-closed-date-input" />

    <div class="grid grid-cols-2 gap-4">
      <VSelect v-model="status" label="Status" id="task-status" data-testid="task-status-select" :options="[
        { key: 'open', label: 'Yet to start' },
        { key: 'in_progress', label: 'In progress' },
        { key: 'done', label: 'Complete' }
      ]" option-value="key" option-label="label" />

      <VSelect v-model="projectId" label="Project" id="task-project" data-testid="task-project-select"
        :options="projects.items.filter(p => p.status === 'active')" option-value="id" option-label="title" searchable
        placeholder="---none---" />

    </div>

    <div class="flex items-center justify-end gap-2 pt-2">
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
  </form>
</template>
