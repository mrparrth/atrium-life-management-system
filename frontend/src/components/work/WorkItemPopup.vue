<script setup>
import { computed, ref, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { useWorkItemsStore } from '@/stores/workItems'
import { useWorkClientsStore } from '@/stores/workClients'
import { useUIStore } from '@/stores/ui'
import { X, CheckCircle2, Star, Clock, Calendar, CheckCircle } from 'lucide-vue-next'
import dayjs from 'dayjs'
import Combobox from '@/components/Combobox.vue'

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
      status: status.value
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
      <div
        class="relative w-full max-w-2xl card p-6 shadow-xl bg-surface z-50 animate-rise-in max-h-[90vh] flex flex-col"
        @click.stop>

        <!-- Header (Compact OS look) -->
        <div class="flex items-center justify-between pb-2.5 border-b border-line/30 shrink-0">
          <div>
            <span class="text-[9px] uppercase tracking-overline text-pri-strategic font-semibold">Workspace OS</span>
            <h2 class="font-serif text-lg font-bold text-ink">
              {{ isEdit ? 'Modify Scoped Item' : 'Compose Scoped Item' }}
            </h2>
          </div>
          <button class="btn-ghost !p-1 rounded-lg hover:bg-canvas/50" @click="emit('close')">
            <X class="w-4 h-4 text-ink-3 hover:text-ink" />
          </button>
        </div>

        <!-- Body (Tight Spacing, Floating Dropdowns) -->
        <div class="flex-1 overflow-y-visible py-4 space-y-3.5 pr-1">

          <!-- Row 1: Title -->
          <div class="v-field-group">
            <input ref="titleEl" v-model="title" placeholder=" " class="v-field-input text-lg font-bold" id="item-title" required />
            <label for="item-title" class="v-field-label text-base font-semibold">Task Title *</label>
          </div>

          <!-- Row 2: Client + Status -->
          <div class="grid grid-cols-2 gap-4">
            <Combobox :options="clientOptions" v-model="clientId" label="Client Association" is-field />

            <div class="v-field-group relative">
              <button type="button" @click.stop="showStatusDropdown = !showStatusDropdown"
                class="w-full text-left text-sm bg-surface border border-line rounded-xl px-4 py-3 min-h-[48px] text-ink flex items-center justify-between focus:outline-none focus:border-pri-strategic transition-all cursor-pointer">
                <div class="flex items-center gap-2 font-semibold">
                  <span class="w-2.5 h-2.5 rounded-full" :class="STATUS_MAP[status]?.dotColor || 'bg-ink-3'"></span>
                  <span class="text-xs">{{ getStatusLabel(status) }}</span>
                </div>
                <span class="text-ink-3 text-[8px] pointer-events-none">▼</span>
              </button>

              <!-- Floating label -->
              <label class="v-field-label v-field-label--floating v-field-label--floating-focused"
                style="background-color: rgb(var(--surface)); z-index: 10; padding: 0 4px;">Status</label>

              <!-- Click catcher -->
              <div v-if="showStatusDropdown" class="fixed inset-0 z-40" @click.stop="showStatusDropdown = false">
              </div>

              <!-- Custom Popover Menu -->
              <div v-if="showStatusDropdown"
                class="absolute left-0 right-0 mt-1 rounded-xl bg-surface border border-line p-1 shadow-lg z-50 animate-rise-in font-sans max-h-60 overflow-y-auto">

                <!-- To-do Group -->
                <div class="text-[9px] uppercase tracking-wider text-ink-3 font-bold px-2.5 py-1">To-do</div>
                <button v-for="st in statusGroups.to_do" :key="st.key" type="button"
                  @click.stop="status = st.key; showStatusDropdown = false"
                  class="w-full text-left text-xs text-ink hover:bg-canvas px-3 py-1.5 rounded-lg flex items-center gap-2 transition-colors cursor-pointer">
                  <span class="w-1.5 h-1.5 rounded-full" :class="st.dotColor"></span>
                  {{ st.label }}
                </button>

                <!-- In Progress Group -->
                <div
                  class="text-[9px] uppercase tracking-wider text-ink-3 font-bold px-2.5 py-1 border-t border-line/40 mt-1">
                  In progress</div>
                <button v-for="st in statusGroups.in_progress" :key="st.key" type="button"
                  @click.stop="status = st.key; showStatusDropdown = false"
                  class="w-full text-left text-xs text-ink hover:bg-canvas px-3 py-1.5 rounded-lg flex items-center gap-2 transition-colors cursor-pointer">
                  <span class="w-1.5 h-1.5 rounded-full" :class="st.dotColor"></span>
                  {{ st.label }}
                </button>

                <!-- Complete Group -->
                <div
                  class="text-[9px] uppercase tracking-wider text-ink-3 font-bold px-2.5 py-1 border-t border-line/40 mt-1">
                  Complete</div>
                <button v-for="st in statusGroups.complete" :key="st.key" type="button"
                  @click.stop="status = st.key; showStatusDropdown = false"
                  class="w-full text-left text-xs text-ink hover:bg-canvas px-3 py-1.5 rounded-lg flex items-center gap-2 transition-colors cursor-pointer">
                  <span class="w-1.5 h-1.5 rounded-full" :class="st.dotColor"></span>
                  {{ st.label }}
                </button>
              </div>
            </div>
          </div>

          <!-- Row 3: Scope Description -->
          <div class="v-field-group">
            <textarea v-model="description" placeholder=" "
              class="v-field-input h-14 py-2 resize-none font-sans text-xs leading-relaxed" id="item-desc"></textarea>
            <label for="item-desc" class="v-field-label text-xs">Scope Description</label>
          </div>

          <!-- Row 4: Due Date + Est Hours + Charged -->
          <div class="grid grid-cols-3 gap-4">
            <div class="v-field-group">
              <input type="date" v-model="dueDate" placeholder=" " class="v-field-input text-xs text-ink-2 font-mono"
                id="item-duedate" />
              <label for="item-duedate" class="v-field-label text-xs">Due Date</label>
            </div>

            <div class="v-field-group">
              <input type="number" v-model="estimatedHours" min="0" step="0.5" placeholder=" "
                class="v-field-input text-xs" id="item-esthours" />
              <label for="item-esthours" class="v-field-label text-xs">Est. Hours</label>
            </div>

            <div class="v-field-group">
              <input type="number" v-model="charged" min="0" step="1" placeholder=" " class="v-field-input text-xs"
                id="item-charged" />
              <label for="item-charged" class="v-field-label text-xs">Charged ($)</label>
            </div>
          </div>

          <!-- Row 5: Billing Type + Drive Folder URL -->
          <div class="grid grid-cols-2 gap-4">
            <div class="v-field-group">
              <select v-model="billingType" @focus="focusedFields.billingType = true"
                @blur="focusedFields.billingType = false" class="v-field-select text-xs">
                <option value="fixed">Fixed-price milestone</option>
                <option value="hourly">Hourly Contract</option>
                <option value="none">Non-billable (admin)</option>
              </select>
              <span class="v-field-arrow">▼</span>
              <label
                :class="['v-field-label text-xs', (billingType || focusedFields.billingType) ? 'v-field-label--floating' : '', focusedFields.billingType ? 'v-field-label--floating-focused' : '']">Billing
                Setup</label>
            </div>

            <div class="v-field-group">
              <input v-model="driveFolderId" placeholder=" " class="v-field-input text-xs font-mono text-ink-3"
                id="item-drive" />
              <label for="item-drive" class="v-field-label text-xs text-ink-3">Drive Folder ID/URL</label>
            </div>
          </div>

          <!-- Separator Line -->
          <hr v-if="isEdit" class="border-line/30 my-4" />

          <!-- Completion & Outcome -->
          <div v-if="isEdit" class="space-y-3">
            <h3 class="text-[10px] uppercase tracking-wider font-bold text-ink-3">Completion & Outcome</h3>

            <div class="grid gap-4 items-center"
              :class="itemsStore.isCompleted(status) ? 'grid-cols-3' : 'grid-cols-1 max-w-xs'">
              <!-- Closed Date -->
              <div v-if="itemsStore.isCompleted(status)" class="v-field-group">
                <input type="date" v-model="closedDate" placeholder=" "
                  class="v-field-input font-mono text-xs text-pri-strategic" id="item-closeddate" />
                <label for="item-closeddate" class="v-field-label v-field-label--floating text-xs"
                  style="color: var(--color-pri-strategic)">Closed Date</label>
              </div>

              <!-- Rating -->
              <div v-if="itemsStore.isCompleted(status)" class="v-field-group relative">
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

              <!-- Tracked Hours -->
              <div class="v-field-group">
                <div
                  class="w-full bg-canvas/30 border border-line rounded-xl px-4 py-3 min-h-[48px] text-ink-2 font-mono text-xs flex items-center justify-between">
                  <span>{{ actualHours }} hours</span>
                  <Clock class="w-3.5 h-3.5 text-ink-3 shrink-0" />
                </div>
                <label class="v-field-label v-field-label--floating text-xs">Tracked Hours</label>
              </div>
            </div>
          </div>

        </div>

        <!-- Sticky Footer for Actions -->
        <div class="pt-3 border-t border-line/30 flex justify-end gap-3 bg-surface z-10 shrink-0">
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
