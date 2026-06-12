<script setup>
import { computed, ref, watch, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useWorkItemsStore } from '@/stores/workItems'
import { useWorkClientsStore } from '@/stores/workClients'
import { useUIStore } from '@/stores/ui'
import PageHeader from '@/components/PageHeader.vue'
import SectionHeader from '@/components/SectionHeader.vue'
import EmptyState from '@/components/EmptyState.vue'
import WorkItemCard from '@/components/work/WorkItemCard.vue'
import { Plus, CheckCircle, Clock, AlertCircle, Sparkles, X } from 'lucide-vue-next'
import Combobox from '@/components/Combobox.vue'

import dayjs from 'dayjs'

const route = useRoute()
const router = useRouter()

const itemsStore = useWorkItemsStore()
const clientsStore = useWorkClientsStore()
const ui = useUIStore()

const focusedFields = ref({})

const clientOptions = computed(() => {
  const activeClients = clientsStore.items.filter(c => c.status !== 'inactive' || c.id === clientId.value)
  return [
    { key: '', label: '' },
    ...activeClients.map(c => ({ key: c.id, label: c.name }))
  ]
})

const showStatusDropdown = ref(false)

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

function getStatusLabel(statusVal) {
  for (const group of Object.values(statusGroups)) {
    const found = group.find(item => item.key === statusVal)
    if (found) return found.label
  }
  return statusVal
}

function getStatusDotColor(statusVal) {
  const map = {
    waiting_feedback: 'bg-[#7d7975]',
    on_hold: 'bg-amber-500',
    ask_milestone: 'bg-blue-500',
    pending_closure: 'bg-orange-500',
    critical: 'bg-red-500',
    in_progress: 'bg-emerald-500',
    complete: 'bg-[#7d7975]',
    dropped: 'bg-pink-500'
  }
  return map[statusVal] || 'bg-ink-3'
}

const activeTab = ref('active') // active, completed

const showAddDrawer = ref(false)
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

async function createWorkItem() {
  if (!title.value.trim()) return

  await itemsStore.add({
    title: title.value.trim(),
    description: description.value.trim(),
    clientId: clientId.value,
    important: status.value === 'critical',
    urgent: status.value === 'critical',
    dueDate: dueDate.value,
    estimatedHours: estimatedHours.value,
    actualHours: actualHours.value,
    billingType: billingType.value,
    charged: Number(charged.value) || 0,
    driveFolderId: driveFolderId.value.trim(),
    status: status.value
  })

  title.value = ''
  description.value = ''
  clientId.value = ''
  status.value = 'critical'
  showStatusDropdown.value = false
  dueDate.value = dayjs().format('YYYY-MM-DD')
  estimatedHours.value = 0
  actualHours.value = 0
  billingType.value = 'fixed'
  charged.value = 0
  driveFolderId.value = ''
  showAddDrawer.value = false
  ui.showToast('Work item created', 'success')
}

// Group active items by status
const groupedActiveItems = computed(() => {
  const list = itemsStore.items.filter(item => {
    if (itemsStore.isCompleted(item.status)) return false
    if (item.snoozedUntil && new Date(item.snoozedUntil) > new Date()) return false
    return true
  })

  const groups = {
    critical: [],
    in_progress: [],
    waiting_feedback: [],
    on_hold: [],
    ask_milestone: [],
    pending_closure: []
  }

  list.forEach(item => {
    let status = item.status || 'in_progress'
    if (status === 'open' || status === 'todo') {
      status = 'in_progress'
    }

    if (groups[status]) {
      groups[status].push(item)
    } else {
      groups.in_progress.push(item)
    }
  })

  return groups
})

const STATUS_SECTIONS = [
  {
    key: 'critical',
    overline: 'Priority',
    title: 'Critical Deliverables',
    hint: 'High-urgency demands. Attend to these immediately.'
  },
  {
    key: 'in_progress',
    overline: 'Active',
    title: 'In Progress',
    hint: 'Work actively being executed.'
  },
  {
    key: 'waiting_feedback',
    overline: 'Pending',
    title: 'Waiting For Feedback',
    hint: 'Awaiting client review, approvals, or answers.'
  },
  {
    key: 'on_hold',
    overline: 'Paused',
    title: 'On Hold',
    hint: 'Temporarily paused or blocked.'
  },
  {
    key: 'ask_milestone',
    overline: 'Milestones',
    title: 'Ask For Next Milestone',
    hint: 'Ready for milestone sign-off and next phase scope.'
  },
  {
    key: 'pending_closure',
    overline: 'Wrapping Up',
    title: 'Pending Closure',
    hint: 'Final deliverables ready for client sign-off and billing.'
  }
]

const completedItems = computed(() => {
  return itemsStore.items.filter(item => itemsStore.isCompleted(item.status))
})

watch(() => route.query.new, (isNew) => {
  if (isNew === 'true') {
    showAddDrawer.value = true
  }
}, { immediate: true })

watch(showAddDrawer, (isOpen) => {
  if (!isOpen && route.query.new === 'true') {
    router.replace({ query: { ...route.query, new: undefined } })
  }
})

function handleEscKey(e) {
  if (e.key === 'Escape' && showAddDrawer.value) {
    showAddDrawer.value = false
  }
  if ((e.metaKey || e.ctrlKey) && e.key === '1') {
    if (!showAddDrawer.value) {
      e.preventDefault()
      showAddDrawer.value = true
    }
  }
  if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
    if (showAddDrawer.value) {
      e.preventDefault()
      createWorkItem()
    }
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleEscKey)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleEscKey)
})
</script>

<template>
  <div class="px-8 md:px-12 py-10 max-w-5xl mx-auto space-y-8" data-testid="work-items">

    <!-- HEADER -->
    <PageHeader overline="Execution" title="Work scope"
      sub="Frictionless tasking and time tracking without rigid hierarchy constraints.">
      <template #right>
        <button @click="showAddDrawer = true" class="btn-primary">
          <Plus class="w-4 h-4" /> Create Work Item <span
            class="kbd ml-1.5 !bg-canvas/20 !border-canvas/10 !text-canvas select-none">⌘1</span>
        </button>
      </template>
    </PageHeader>

    <!-- TABS -->
    <div class="flex border-b border-line gap-6 text-sm font-medium">
      <button @click="activeTab = 'active'" class="pb-3 border-b-2"
        :class="activeTab === 'active' ? 'border-ink text-ink font-semibold' : 'border-transparent text-ink-3 hover:text-ink-2'">
        Active Scope ({{Object.values(groupedActiveItems).reduce((sum, list) => sum + list.length, 0)}})
      </button>
      <button @click="activeTab = 'completed'" class="pb-3 border-b-2"
        :class="activeTab === 'completed' ? 'border-ink text-ink font-semibold' : 'border-transparent text-ink-3 hover:text-ink-2'">
        Completed ({{ completedItems.length }})
      </button>
    </div>

    <!-- ACTIVE ITEMS VIEW -->
    <div v-if="activeTab === 'active'" class="space-y-8 animate-fade-in">
      <template v-for="sec in STATUS_SECTIONS" :key="sec.key">
        <div v-if="groupedActiveItems[sec.key] && groupedActiveItems[sec.key].length" class="space-y-3">
          <SectionHeader :overline="sec.overline" :title="sec.title" :hint="sec.hint" />
          <div class="space-y-2.5">
            <WorkItemCard v-for="item in groupedActiveItems[sec.key]" :key="item.id" :item="item" />
          </div>
        </div>
      </template>

      <!-- Empty state check -->
      <div v-if="Object.values(groupedActiveItems).every(list => !list.length)">
        <EmptyState title="All scopes clear"
          hint="Add tasks using the quick composer or click 'Create Work Item' above." />
      </div>
    </div>

    <!-- COMPLETED VIEW -->
    <div v-else class="space-y-3 animate-fade-in">
      <div v-if="completedItems.length" class="space-y-2.5">
        <WorkItemCard v-for="item in completedItems" :key="item.id" :item="item" />
      </div>
      <EmptyState v-else title="Nothing archived yet" hint="Complete your active tasks to build momentum." />
    </div>

    <!-- QUICK ADD DRAWER (OS composition style) -->
    <div v-if="showAddDrawer" @keydown.window.esc="showAddDrawer = false"
      class="fixed inset-0 z-40 flex items-center justify-center overflow-y-auto px-4 py-8">
      <div class="fixed inset-0 bg-ink/40 backdrop-blur-sm" @click="showAddDrawer = false"></div>
      <div
        class="relative w-full max-w-2xl card p-6 shadow-xl bg-surface z-50 animate-rise-in max-h-[90vh] flex flex-col">

        <!-- Header (Compact OS look) -->
        <div class="flex items-center justify-between pb-2.5 border-b border-line/30 shrink-0">
          <div>
            <span class="text-[9px] uppercase tracking-overline text-pri-strategic font-semibold">Workspace OS</span>
            <h2 class="font-serif text-lg font-bold text-ink">Compose Scoped Item</h2>
          </div>
          <button class="btn-ghost !p-1 rounded-lg hover:bg-canvas/50" @click="showAddDrawer = false">
            <X class="w-4 h-4 text-ink-3 hover:text-ink" />
          </button>
        </div>

        <!-- Body (Tight Spacing, Floating Dropdowns) -->
        <div class="flex-1 overflow-y-visible py-4 space-y-3.5 pr-1">

          <!-- Row 1: Title -->
          <div class="v-field-group">
            <input v-model="title" placeholder=" " class="v-field-input text-lg font-bold" id="item-title" required />
            <label for="item-title" class="v-field-label text-base font-semibold">Task Title *</label>
          </div>

          <!-- Row 2: Client + Status -->
          <div class="grid grid-cols-2 gap-4">
            <Combobox :options="clientOptions" v-model="clientId" label="Client Association" is-field />

            <div class="v-field-group relative">
              <button type="button" @click.stop="showStatusDropdown = !showStatusDropdown"
                class="w-full text-left text-sm bg-surface border border-line rounded-xl px-4 py-3 min-h-[48px] text-ink flex items-center justify-between focus:outline-none focus:border-pri-strategic transition-all cursor-pointer">
                <div class="flex items-center gap-2 font-semibold">
                  <span class="w-2.5 h-2.5 rounded-full" :class="getStatusDotColor(status)"></span>
                  <span class="text-xs">{{ getStatusLabel(status) }}</span>
                </div>
                <span class="text-ink-3 text-[8px] pointer-events-none">▼</span>
              </button>

              <!-- Floating label -->
              <label class="v-field-label v-field-label--floating v-field-label--floating-focused"
                style="background-color: rgb(var(--surface)); z-index: 10; padding: 0 4px;">Status</label>

              <!-- Click catcher -->
              <div v-if="showStatusDropdown" class="fixed inset-0 z-40" @click.stop="showStatusDropdown = false"></div>

              <!-- Custom Popover Menu -->
              <div v-if="showStatusDropdown"
                class="absolute left-0 right-0 mt-1 rounded-xl bg-surface border border-line p-1 shadow-lg z-50 animate-rise-in font-sans max-h-60 overflow-y-auto">
                <div class="overline px-2.5 py-1 text-[9px] text-ink-3 tracking-wider font-bold">Select status</div>

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
          <hr class="border-line/30 my-4" />

          <!-- Log Initial Tracked Hours (Row 6) -->
          <div class="flex justify-end">
            <div
              class="flex items-center gap-2 bg-canvas/20 px-2.5 py-1 rounded-xl border border-line/20 h-[48px] w-48 shrink-0">
              <Clock class="w-3.5 h-3.5 text-ink-3 shrink-0" />
              <div class="flex-1 flex items-center justify-between min-w-0">
                <span class="text-[9px] uppercase font-semibold text-ink-3 truncate">Tracked Hours</span>
                <input type="number" v-model="actualHours" min="0" step="0.5"
                  class="w-10 bg-transparent border-0 text-right text-xs font-medium text-ink-2 focus:ring-0 p-0" />
              </div>
            </div>
          </div>

        </div>

        <!-- Sticky Footer for Actions -->
        <div class="pt-3 border-t border-line/30 flex justify-end gap-3 bg-surface z-10 shrink-0">
          <button @click="showAddDrawer = false" class="btn-ghost !text-xs !py-1.5 px-3">Cancel</button>
          <button @click="createWorkItem" class="btn-primary !text-xs !py-1.5 px-4 flex items-center gap-1.5">
            <CheckCircle class="w-3.5 h-3.5" />
            <span>Add to Scope</span>
            <span class="kbd !bg-canvas/20 !border-canvas/10 !text-canvas select-none text-[9px] ml-1">⌘Enter</span>
          </button>
        </div>

      </div>
    </div>



  </div>
</template>
