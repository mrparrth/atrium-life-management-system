<script setup>
import { computed, ref, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { useWorkItemsStore } from '@/stores/workItems'
import { useWorkClientsStore } from '@/stores/workClients'
import { useUIStore } from '@/stores/ui'
import { X, CheckCircle2, Star, Clock, Calendar, CheckCircle, ExternalLink } from 'lucide-vue-next'
import dayjs from 'dayjs'
import Combobox from '@/components/Combobox.vue'
import DateField from '@/components/DateField.vue'
import VInput from '@/components/VInput.vue'
import VUrlInput from '@/components/VUrlInput.vue'
import VSelect from '@/components/VSelect.vue'
import VTextarea from '@/components/VTextarea.vue'
import VRow from '@/components/VRow.vue'
import VCol from '@/components/VCol.vue'
import { newId } from '@/db'

const props = defineProps({
  // If editing, pass the work item object. If creating, leave null/undefined.
  item: {
    type: Object,
    default: null
  },
  prefillTitle: {
    type: String,
    default: ''
  }
})

const emit = defineEmits(['close', 'saved'])

const itemsStore = useWorkItemsStore()
const clientsStore = useWorkClientsStore()
const ui = useUIStore()
const router = useRouter()

function goToClientPage() {
  if (clientId.value) {
    emit('close')
    router.push(`/work/clients/${clientId.value}`)
  }
}

const isEdit = computed(() => !!props.item)

// Form states
const title = ref('')
const description = ref('')
const clientId = ref('')
const status = ref('critical')
const dueDate = ref(dayjs().format('YYYY-MM-DD'))
const estimatedHours = ref(0)
const actualHours = ref(0)
const billingType = ref('fixed')
const charged = ref(0)
const driveFolderId = ref('')
const closedDate = ref('')
const rating = ref(null)
const subtasks = ref([])
const enableSubtasks = ref(false)
const newSubtaskTitle = ref('')
const newSubtaskDueDate = ref('')
const newSubtaskTag = ref('')
const showSubtaskControls = ref(false)

const editingSubtaskId = ref(null)
const editingSubtaskTitle = ref('')
const editingSubtaskDueDate = ref('')
const editingSubtaskTag = ref('')

function addSubtask() {
  if (!newSubtaskTitle.value.trim()) return
  const id = newId()
  subtasks.value.push({
    id,
    title: newSubtaskTitle.value.trim(),
    done: false,
    dueDate: newSubtaskDueDate.value || null,
    tag: newSubtaskTag.value.trim() || null
  })
  newSubtaskTitle.value = ''
  newSubtaskDueDate.value = ''
  newSubtaskTag.value = ''
  showSubtaskControls.value = false
}

function removeSubtask(id) {
  subtasks.value = subtasks.value.filter(s => s.id !== id)
}

function startEditSubtask(sub) {
  editingSubtaskId.value = sub.id
  editingSubtaskTitle.value = sub.title
  editingSubtaskDueDate.value = sub.dueDate || ''
  editingSubtaskTag.value = sub.tag || ''
}

function saveEditSubtask(sub) {
  if (!editingSubtaskTitle.value.trim()) return
  sub.title = editingSubtaskTitle.value.trim()
  sub.dueDate = editingSubtaskDueDate.value || null
  sub.tag = editingSubtaskTag.value.trim() || null
  editingSubtaskId.value = null
}

function cancelEditSubtask() {
  editingSubtaskId.value = null
}

const showStatusDropdown = ref(false)
const focusedFields = ref({})
const titleEl = ref(null)

// Predefined Status groups
const statusGroups = {
  to_do: [
    { key: 'waiting_feedback', label: 'Waiting For Feedback', dotColor: 'bg-[#7d7975]' },
    { key: 'on_hold', label: 'On Hold', dotColor: 'bg-amber-500' },
    { key: 'ask_milestone', label: 'Ask For Next Milestone', dotColor: 'bg-blue-500' },
    { key: 'pending_closure', label: 'Pending Closure', dotColor: 'bg-orange-500' }
  ],
  in_progress: [
    { key: 'critical', label: 'Critical', dotColor: 'bg-red-500' },
    { key: 'in_progress', label: 'In Progress', dotColor: 'bg-emerald-500' }
  ],
  complete: [
    { key: 'complete', label: 'Complete', dotColor: 'bg-[#7d7975]' },
    { key: 'dropped', label: 'Dropped', dotColor: 'bg-pink-500' }
  ]
}

const STATUS_MAP = {
  waiting_feedback: { label: 'Waiting For Feedback', color: 'bg-[#7d7975]/10 text-[#7d7975] border-[#7d7975]/20', dotColor: 'bg-[#7d7975]' },
  on_hold: { label: 'On Hold', color: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20', dotColor: 'bg-amber-500' },
  ask_milestone: { label: 'Ask For Next Milestone', color: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20', dotColor: 'bg-blue-500' },
  pending_closure: { label: 'Pending Closure', color: 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20', dotColor: 'bg-orange-500' },
  critical: { label: 'Critical', color: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20', dotColor: 'bg-red-500' },
  in_progress: { label: 'In Progress', color: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-250 dark:border-emerald-500/20', dotColor: 'bg-emerald-500' },
  complete: { label: 'Complete', color: 'bg-[#7d7975]/10 text-[#7d7975] border-[#7d7975]/20', dotColor: 'bg-[#7d7975]' },
  dropped: { label: 'Dropped', color: 'bg-pink-500/10 text-pink-600 dark:text-pink-400 border-pink-500/20', dotColor: 'bg-pink-500' }
}

function getStatusLabel(statusVal) {
  for (const group of Object.values(statusGroups)) {
    const found = group.find(item => item.key === statusVal)
    if (found) return found.label
  }
  return statusVal
}

const clientOptions = computed(() => {
  const activeClients = clientsStore.items.filter(c => {
    return c.status !== 'inactive' || (props.item && c.id === props.item.clientId)
  })
  return [
    { key: '', label: '' },
    ...activeClients.map(c => ({ key: c.id, label: c.name }))
  ]
})

function initForm() {
  if (props.item) {
    title.value = props.item.title || ''
    description.value = props.item.description || ''
    clientId.value = props.item.clientId || ''
    status.value = props.item.status || 'in_progress'
    dueDate.value = props.item.dueDate || ''
    estimatedHours.value = props.item.estimatedHours || 0
    actualHours.value = props.item.actualHours || 0
    billingType.value = props.item.billingType || 'fixed'
    charged.value = props.item.charged || 0
    driveFolderId.value = props.item.driveFolderId || ''
    closedDate.value = props.item.closedDate || ''
    rating.value = props.item.rating || null
    subtasks.value = props.item.subtasks ? JSON.parse(JSON.stringify(props.item.subtasks)) : []
    enableSubtasks.value = props.item.enableSubtasks !== undefined ? props.item.enableSubtasks : (props.item.subtasks && props.item.subtasks.length > 0)
  } else {
    title.value = props.prefillTitle || ''
    description.value = ''
    clientId.value = ''
    status.value = 'critical'
    dueDate.value = dayjs().format('YYYY-MM-DD')
    estimatedHours.value = 0
    actualHours.value = 0
    billingType.value = 'fixed'
    charged.value = 0
    driveFolderId.value = ''
    closedDate.value = ''
    rating.value = null
    subtasks.value = []
    enableSubtasks.value = false
  }
}

watch(() => props.item, initForm, { immediate: true })

async function handleSave() {
  if (!title.value.trim()) return

  const isCritical = status.value === 'critical'

  if (isEdit.value) {
    const isCompleting = itemsStore.isCompleted(status.value) && !itemsStore.isCompleted(props.item.status)
    const isReopening = !itemsStore.isCompleted(status.value) && itemsStore.isCompleted(props.item.status)

    const updatedData = {
      title: title.value.trim(),
      description: description.value.trim(),
      clientId: clientId.value,
      important: isCritical,
      urgent: isCritical,
      estimatedHours: Number(estimatedHours.value) || 0,
      actualHours: Number(actualHours.value) || 0,
      dueDate: dueDate.value,
      billingType: billingType.value,
      charged: Number(charged.value) || 0,
      driveFolderId: driveFolderId.value.trim(),
      status: status.value,
      rating: rating.value || null,
      subtasks: subtasks.value,
      enableSubtasks: enableSubtasks.value,
      ...(!isCompleting && !isReopening ? { closedDate: closedDate.value || null } : {})
    }

    await itemsStore.update(props.item.id, updatedData)

    // Sync client operational score if client exists and rating is updated
    const updatedItem = itemsStore.items.find(x => x.id === props.item.id)
    if (updatedItem && updatedItem.clientId && rating.value) {
      const client = clientsStore.items.find(c => c.id === updatedItem.clientId)
      if (client) {
        // Compute average of rated items
        const clientItems = itemsStore.items.filter(item => item.clientId === client.id)
        const ratedItems = clientItems.filter(item => item.rating && item.rating > 0)
        let newRating = rating.value
        if (ratedItems.length > 0) {
          const totalRating = ratedItems.reduce((sum, item) => sum + item.rating, 0)
          newRating = Number((totalRating / ratedItems.length).toFixed(1))
        }
        await clientsStore.update(client.id, { rating: newRating })
      }
    }

    emit('saved', updatedItem)
    ui.showToast('Work item updated', 'success')
  } else {
    const newItem = await itemsStore.add({
      title: title.value.trim(),
      description: description.value.trim(),
      clientId: clientId.value,
      important: isCritical,
      urgent: isCritical,
      dueDate: dueDate.value,
      estimatedHours: estimatedHours.value,
      actualHours: actualHours.value,
      billingType: billingType.value,
      charged: Number(charged.value) || 0,
      driveFolderId: driveFolderId.value.trim(),
      status: status.value,
      subtasks: subtasks.value,
      enableSubtasks: enableSubtasks.value
    })
    emit('saved', newItem)
    ui.showToast('Work item created', 'success')
  }
  emit('close')
}

function handleEscKey(e) {
  if (e.key === 'Escape') {
    emit('close')
  }
  if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
    e.preventDefault()
    handleSave()
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleEscKey)
  nextTick(() => {
    titleEl.value?.focus()
  })
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleEscKey)
})
</script>

<template>
  <Teleport to="body">
    <div @keydown.window.esc="emit('close')"
      class="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto px-4 py-8">
      <div class="fixed inset-0 bg-ink/40 backdrop-blur-sm" @click.stop="emit('close')"></div>
      <div class="relative w-full card p-6 shadow-xl bg-surface z-50 animate-rise-in animate-duration-300 transition-all duration-300"
        :class="enableSubtasks ? 'max-w-5xl' : 'max-w-2xl'" @click.stop>

        <!-- Header (Compact OS look) -->
        <div class="flex items-center justify-between pb-2.5 border-b border-line/30 shrink-0">
          <div>
            <span class="text-[9px] uppercase tracking-overline text-pri-strategic font-semibold">Workspace OS</span>
            <h2 class="text-lg font-bold text-ink">
              {{ isEdit ? 'Modify Scoped Item' : 'Compose Scoped Item' }}
            </h2>
          </div>
          <button class="btn-ghost !p-1 rounded-lg hover:bg-canvas/50" @click="emit('close')">
            <X class="w-4 h-4 text-ink-3 hover:text-ink" />
          </button>
        </div>

        <!-- Body (2-Column split) -->
        <div class="py-4 flex flex-col md:flex-row gap-6 items-start">
          
          <!-- Left Column: Form Fields -->
          <div class="flex-1 min-w-0 space-y-3.5 w-full">
            <VInput ref="titleEl" v-model="title" label="Task Title *" id="item-title" required />

            <!-- Row 2: Client + Status -->
            <VRow>
              <VCol cols="12" sm="6" class="flex items-end gap-2">
                <div class="flex-grow min-w-0">
                  <VSelect v-model="clientId" label="Client Association" id="item-client"
                    :options="clientsStore.items.filter(c => c.status !== 'inactive' || (item && c.id === item.clientId))"
                    option-value="id" option-label="name" searchable placeholder="---none---" />
                </div>
                <button v-if="clientId" type="button" @click="goToClientPage"
                  class="btn-ghost !p-2.5 rounded-xl border border-line shrink-0 h-[38px] flex items-center justify-center hover:bg-canvas hover:text-pri-strategic hover:border-line-2 transition-all"
                  title="Go to client details">
                  <ExternalLink class="w-4 h-4 text-ink-3 hover:text-pri-strategic" />
                </button>
              </VCol>
              <VCol cols="12" sm="6">
                <VSelect v-model="status" label="Status" id="item-status" :options="[
                  { key: 'critical', label: 'Critical' },
                  { key: 'in_progress', label: 'In Progress' },
                  { key: 'waiting_feedback', label: 'Waiting For Feedback' },
                  { key: 'on_hold', label: 'On Hold' },
                  { key: 'ask_milestone', label: 'Ask For Next Milestone' },
                  { key: 'pending_closure', label: 'Pending Closure' },
                  { key: 'complete', label: 'Complete' },
                  { key: 'dropped', label: 'Dropped' }
                ]" option-value="key" option-label="label" />
              </VCol>
            </VRow>

            <VTextarea v-model="description" label="Scope Description" id="item-desc" autogrow />

            <div class="flex items-center gap-2 py-0.5 select-none">
              <input 
                type="checkbox" 
                v-model="enableSubtasks" 
                id="item-enable-subtasks"
                class="rounded border-line text-pri-strategic focus:ring-pri-strategic cursor-pointer h-4 w-4 bg-surface"
              />
              <label for="item-enable-subtasks" class="text-xs text-ink-2 font-medium cursor-pointer">
                Enable subtasks for this work item
              </label>
            </div>

            <!-- Row 4: Due Date + Est Hours + Charged -->
            <VRow>
              <VCol cols="12" sm="6">
                <DateField v-model="dueDate" label="Due Date" id="item-duedate" />
              </VCol>
              <VCol cols="12" sm="3">
                <VInput type="number" v-model="estimatedHours" min="0" step="0.5" label="Est. Hours" id="item-esthours" />
              </VCol>
              <VCol cols="12" sm="3">
                <VInput type="number" v-model="charged" min="0" label="Charged ($)" id="item-charged" />
              </VCol>
            </VRow>

            <!-- Row 5: Billing Setup + Drive Folder -->
            <VRow>
              <VCol cols="12" sm="6">
                <VSelect v-model="billingType" label="Billing Setup" id="item-billing" :options="[
                  { key: 'fixed', label: 'Fixed-price milestone' },
                  { key: 'hourly', label: 'Hourly/Time-based' },
                  { key: 'retainer', label: 'Retainer inclusion' },
                  { key: 'internal', label: 'Internal / Non-billable' }
                ]" option-value="key" option-label="label" />
              </VCol>
              <VCol cols="12" sm="6">
                <VUrlInput v-model="driveFolderId" label="Drive Folder ID/URL" id="item-drive" />
              </VCol>
            </VRow>

            <!-- Completion & Outcome -->
            <div v-if="isEdit" class="">
              <h3 class="text-[10px] uppercase tracking-wider font-bold text-ink-3 mb-4">Completion & Outcome</h3>

              <div class="grid gap-4 items-start"
                :class="itemsStore.isCompleted(status) ? 'grid-cols-3' : 'grid-cols-1 max-w-xs'">
                <!-- Closed Date -->
                <DateField v-if="itemsStore.isCompleted(status)" v-model="closedDate" label="Closed Date"
                  id="item-closeddate" />

                <!-- Rating -->
                <div v-if="itemsStore.isCompleted(status)" class="v-field-group relative mt-1">
                  <div @focusin="focusedFields.rating = true" @focusout="focusedFields.rating = false"
                    class="w-full bg-surface border border-line rounded-xl px-4 py-2 min-h-[48px] flex items-center justify-center gap-1.5 transition-all"
                    :class="[
                      focusedFields.rating ? 'border-pri-strategic shadow-[0_0_0_2px_rgba(var(--pri-strategic),0.1)]' : '',
                      'cursor-pointer'
                    ]">
                    <button v-for="star in 5" :key="star" type="button" @click="rating = star"
                      class="p-0.5 hover:scale-110 transition-all focus:outline-none cursor-pointer">
                      <Star class="w-4 h-4"
                        :class="star <= (rating || 0) ? 'text-amber-500 fill-amber-500' : 'text-ink-3'" />
                    </button>
                  </div>
                  <label class="v-field-label v-field-label--floating text-xs"
                    :class="focusedFields.rating ? 'v-field-label--floating-focused' : ''"
                    style="color: var(--color-pri-strategic)">
                    Task Feedback Rating
                  </label>
                </div>

                <!-- Tracked Hours Input -->
                <VInput type="number" v-model="actualHours" min="0" step="0.5" label="Tracked Hours" id="item-actualhours" />
              </div>
            </div>
          </div>

          <!-- Right Column: Subtasks Section -->
          <div v-if="enableSubtasks" class="w-full md:w-[380px] shrink-0 md:border-l md:border-line/30 md:pl-6 flex flex-col h-full min-h-[400px]">
            
            <!-- Header & Progress -->
            <div class="flex items-center justify-between mb-3">
              <h3 class="overline text-ink-2 font-bold select-none">
                Subtasks
                <span class="text-ink-3 ml-1 font-mono">
                  ({{ subtasks.filter(s => s.done).length }}/{{ subtasks.length }})
                </span>
              </h3>
              
              <!-- Progress Bar -->
              <div v-if="subtasks.length > 0" class="w-24 bg-line/40 h-1.5 rounded-full overflow-hidden">
                <div class="bg-pri-strategic h-full transition-all duration-300"
                  :style="{ width: (subtasks.filter(s => s.done).length / subtasks.length * 100) + '%' }">
                </div>
              </div>
            </div>

            <!-- Inline Creation Input -->
            <div class="relative mb-4 space-y-2">
              <input 
                v-model="newSubtaskTitle"
                type="text" 
                placeholder="Add a subtask... (Press Enter)"
                @focus="showSubtaskControls = true"
                @keydown.enter.prevent="addSubtask"
                class="w-full bg-surface border border-line/50 rounded-xl px-3.5 py-2 text-xs text-ink outline-none focus:border-pri-strategic/50 focus:ring-2 focus:ring-pri-strategic/10 transition-all font-sans placeholder-ink-3"
              />

              <!-- Expanded inline controls on focus -->
              <div v-if="showSubtaskControls || newSubtaskTitle.trim()" 
                class="flex flex-wrap items-center justify-between gap-2 p-2 bg-canvas/30 border border-line/40 rounded-xl animate-rise-in">
                
                <div class="flex items-center gap-2 flex-grow">
                  <!-- Due Date Picker -->
                  <div class="relative flex items-center">
                    <input 
                      type="date" 
                      v-model="newSubtaskDueDate" 
                      class="bg-surface border border-line rounded-lg px-2 py-1 text-[10px] text-ink outline-none focus:border-pri-strategic/50 cursor-pointer font-sans"
                      title="Due Date"
                    />
                  </div>
                  
                  <!-- Tag Input -->
                  <input 
                    v-model="newSubtaskTag"
                    type="text" 
                    placeholder="Tag / Assignee"
                    class="bg-surface border border-line rounded-lg px-2 py-1 text-[10px] text-ink outline-none focus:border-pri-strategic/50 font-sans w-24"
                  />
                </div>

                <div class="flex items-center gap-1 shrink-0">
                  <button type="button" @click="showSubtaskControls = false; newSubtaskTitle = ''"
                    class="px-2 py-1 text-[10px] text-ink-3 hover:text-ink hover:bg-canvas rounded font-medium">
                    Cancel
                  </button>
                  <button type="button" @click="addSubtask"
                    class="px-2.5 py-1 text-[10px] bg-pri-strategic hover:bg-pri-strategic-hover text-canvas rounded font-bold transition-all shadow-sm">
                    Add
                  </button>
                </div>
              </div>
            </div>

            <!-- Subtask Item List -->
            <div class="flex-1 overflow-y-auto space-y-2 max-h-[420px] pr-1">
              <div v-for="sub in subtasks" :key="sub.id" 
                class="group flex items-start gap-2.5 p-2.5 rounded-xl border border-line/45 bg-surface hover:bg-canvas/5 hover:border-line transition-all duration-200">
                
                <!-- If Editing Subtask -->
                <div v-if="editingSubtaskId === sub.id" class="w-full space-y-2">
                  <input 
                    v-model="editingSubtaskTitle"
                    type="text" 
                    class="w-full bg-surface border border-line rounded-lg px-2.5 py-1.5 text-xs text-ink outline-none focus:border-pri-strategic"
                    @keydown.enter.prevent="saveEditSubtask(sub)"
                    @keydown.esc.prevent="cancelEditSubtask"
                  />
                  <div class="flex items-center justify-between gap-2">
                    <div class="flex items-center gap-2">
                      <input 
                        type="date" 
                        v-model="editingSubtaskDueDate" 
                        class="bg-surface border border-line rounded-lg px-2 py-1 text-[10px] text-ink cursor-pointer"
                      />
                      <input 
                        v-model="editingSubtaskTag"
                        type="text" 
                        placeholder="Tag"
                        class="bg-surface border border-line rounded-lg px-2 py-1 text-[10px] text-ink w-20"
                      />
                    </div>
                    <div class="flex items-center gap-1.5">
                      <button type="button" @click="cancelEditSubtask"
                        class="px-2 py-0.5 text-[10px] text-ink-3 hover:text-ink rounded">
                        Cancel
                      </button>
                      <button type="button" @click="saveEditSubtask(sub)"
                        class="px-2 py-0.5 text-[10px] bg-pri-strategic text-canvas rounded font-bold">
                        Save
                      </button>
                    </div>
                  </div>
                </div>

                <!-- Default Subtask View -->
                <template v-else>
                  <!-- Checkbox -->
                  <input 
                    type="checkbox" 
                    v-model="sub.done" 
                    class="mt-0.5 rounded border-line text-pri-strategic focus:ring-pri-strategic cursor-pointer h-3.5 w-3.5 bg-surface"
                  />
                  
                  <!-- Title and Metadata -->
                  <div class="flex-1 min-w-0">
                    <span 
                      class="text-xs text-ink break-words block leading-tight font-medium"
                      :class="{ 'line-through text-ink-3 font-normal': sub.done }"
                    >
                      {{ sub.title }}
                    </span>
                    
                    <div class="flex flex-wrap items-center gap-1.5 mt-1">
                      <!-- Due Date Badge -->
                      <span v-if="sub.dueDate" 
                        class="inline-flex items-center gap-0.5 text-[9px] font-mono px-1.5 py-0.5 rounded bg-canvas border border-line/45 text-ink-3"
                        :class="{ 'text-pri-critical border-pri-critical-bd bg-pri-critical-bg font-bold': !sub.done && dayjs(sub.dueDate).isBefore(dayjs(), 'day') }"
                      >
                        <Calendar class="w-2.5 h-2.5 shrink-0" />
                        {{ dayjs(sub.dueDate).format('MMM D') }}
                      </span>
                      
                      <!-- Tag Badge -->
                      <span v-if="sub.tag" 
                        class="text-[9px] font-semibold text-pri-strategic bg-pri-strategic-bg/30 border border-pri-strategic-bd/30 px-1.5 py-0.5 rounded-full"
                      >
                        {{ sub.tag }}
                      </span>
                    </div>
                  </div>

                  <!-- Hover Actions -->
                  <div class="opacity-0 group-hover:opacity-100 flex items-center gap-1.5 transition-opacity duration-150 shrink-0 self-start">
                    <button type="button" @click="startEditSubtask(sub)" 
                      class="p-0.5 hover:bg-canvas rounded text-ink-3 hover:text-ink"
                      title="Edit Subtask">
                      <span class="text-[10px] select-none">✏️</span>
                    </button>
                    <button type="button" @click="removeSubtask(sub.id)" 
                      class="p-0.5 hover:bg-canvas rounded text-ink-3 hover:text-pri-critical"
                      title="Delete Subtask">
                      <span class="text-[10px] select-none">❌</span>
                    </button>
                  </div>
                </template>
              </div>

              <!-- Empty State -->
              <div v-if="!subtasks.length" 
                class="py-8 text-center border border-dashed border-line/40 rounded-2xl bg-canvas/10 select-none">
                <p class="text-xs text-ink-3 font-sans">
                  No subtasks added. Type above and press Enter to create one.
                </p>
              </div>
            </div>
          </div>

        </div>

        <!-- Footer for Actions -->
        <div class="pt-4 border-t border-line/30 flex justify-end gap-3 shrink-0">
          <button @click="emit('close')" class="btn-ghost !text-xs !py-1.5 px-3">Cancel</button>
          <button @click="handleSave" class="btn-primary !text-xs !py-1.5 px-4 flex items-center gap-1.5">
            <CheckCircle2 class="w-3.5 h-3.5" />
            <span>{{ isEdit ? 'Save Changes' : 'Add to Scope' }}</span>
            <span class="kbd !bg-canvas/20 !border-canvas/10 !text-canvas select-none text-[9px] ml-1">⌘Enter</span>
          </button>
        </div>

      </div>
    </div>
  </Teleport>
</template>
