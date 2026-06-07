<script setup>
import { ref, watch } from 'vue'
import { useTasksStore } from '@/stores/tasks'
import { useProjectsStore } from '@/stores/projects'
import { useUIStore } from '@/stores/ui'
import { X, Plus } from 'lucide-vue-next'
import PriorityBadge from './PriorityBadge.vue'

const props = defineProps({ defaultProjectId: { type: String, default: null }, initialTask: { type: Object, default: null } })
const emit = defineEmits(['close', 'created', 'updated'])

const tasks = useTasksStore()
const projects = useProjectsStore()
const ui = useUIStore()

const title = ref(props.initialTask?.title || '')
const description = ref(props.initialTask?.description || '')
const projectId = ref(props.initialTask?.projectId || props.defaultProjectId)
const scheduledDate = ref(props.initialTask?.scheduledDate || '')
const dueDate = ref(props.initialTask?.dueDate || '')
const important = ref(props.initialTask?.important || false)
const urgent = ref(props.initialTask?.urgent || false)
const titleEl = ref(null)

watch(titleEl, el => el?.focus())

async function save() {
  if (!title.value.trim()) return
  const payload = {
    title: title.value, description: description.value,
    projectId: projectId.value || null,
    scheduledDate: scheduledDate.value || null,
    dueDate: dueDate.value || null,
    important: important.value, urgent: urgent.value,
  }
  
  if (props.initialTask) {
    await tasks.update(props.initialTask.id, payload)
    ui.showToast('Task updated', 'success')
    emit('updated', props.initialTask.id)
  } else {
    const t = await tasks.add(payload)
    ui.showToast('Task captured', 'success')
    emit('created', t)
  }
  emit('close')
}
</script>

<template>
  <form @submit.prevent="save" class="space-y-5" data-testid="task-composer">
    <input ref="titleEl" v-model="title" placeholder="What needs to be remembered…"
      class="input-soft text-xl font-serif" data-testid="task-title-input" required />
    <textarea v-model="description" placeholder="A little context (optional)" rows="2"
      class="input-soft resize-none text-base" data-testid="task-description-input" />

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
      <label class="block">
        <span class="overline block mb-1">Scheduled</span>
        <input type="date" v-model="scheduledDate" class="input-block text-sm" data-testid="task-scheduled-input" />
      </label>
      <label class="block">
        <span class="overline block mb-1">Due</span>
        <input type="date" v-model="dueDate" class="input-block text-sm" data-testid="task-due-input" />
      </label>
    </div>

    <label class="block">
      <span class="overline block mb-1">Project</span>
      <select v-model="projectId" class="input-block text-sm" data-testid="task-project-select">
        <option :value="null">— none —</option>
        <option v-for="p in projects.items.filter(p => p.status === 'active')" :key="p.id" :value="p.id">{{ p.title }}
        </option>
      </select>
    </label>

    <div class="flex items-center justify-end gap-2 pt-2">
      <button type="button" class="btn-ghost" @click="$emit('close')" data-testid="task-cancel">Cancel</button>
      <button type="submit" class="btn-primary" data-testid="task-save">
        <template v-if="initialTask">Save changes</template>
        <template v-else><Plus class="w-4 h-4" /> Capture</template>
      </button>
    </div>
  </form>
</template>
