<script setup>
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useWorkItemsStore } from '@/stores/workItems'
import { useWorkClientsStore } from '@/stores/workClients'
import { useUIStore } from '@/stores/ui'
import PageHeader from '@/components/PageHeader.vue'
import SectionHeader from '@/components/SectionHeader.vue'
import EmptyState from '@/components/EmptyState.vue'
import WorkItemCard from '@/components/work/WorkItemCard.vue'
import { Plus, CheckCircle, Clock, AlertCircle, Sparkles } from 'lucide-vue-next'

const route = useRoute()
const router = useRouter()

const itemsStore = useWorkItemsStore()
const clientsStore = useWorkClientsStore()
const ui = useUIStore()

const activeTab = ref('active') // active, completed

const showAddDrawer = ref(false)
const title = ref('')
const description = ref('')
const clientId = ref('')
const isImportant = ref(false)
const isUrgent = ref(false)
const dueDate = ref('')
const estimatedHours = ref(0)
const billingType = ref('fixed')
const charged = ref(0)

async function createWorkItem() {
  if (!title.value.trim()) return
  
  await itemsStore.add({
    title: title.value.trim(),
    description: description.value.trim(),
    clientId: clientId.value,
    important: isImportant.value,
    urgent: isUrgent.value,
    dueDate: dueDate.value,
    estimatedHours: estimatedHours.value,
    billingType: billingType.value,
    charged: Number(charged.value) || 0
  })

  title.value = ''
  description.value = ''
  clientId.value = ''
  isImportant.value = false
  isUrgent.value = false
  dueDate.value = ''
  estimatedHours.value = 0
  billingType.value = 'fixed'
  charged.value = 0
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

const showEditDrawer = ref(false)
const editItem = ref(null)
const editForm = ref({
  title: '',
  description: '',
  clientId: '',
  important: false,
  urgent: false,
  estimatedHours: 0,
  actualHours: 0,
  dueDate: '',
  billingType: 'fixed',
  charged: 0,
  driveFolderId: '',
  status: 'in_progress'
})

function loadItemForEdit(item) {
  editItem.value = item
  editForm.value = {
    title: item.title || '',
    description: item.description || '',
    clientId: item.clientId || '',
    important: !!item.important,
    urgent: !!item.urgent,
    estimatedHours: item.estimatedHours || 0,
    actualHours: item.actualHours || 0,
    dueDate: item.dueDate || '',
    billingType: item.billingType || 'fixed',
    charged: item.charged || 0,
    driveFolderId: item.driveFolderId || '',
    status: item.status || 'in_progress'
  }
  showEditDrawer.value = true
}

async function saveEdit() {
  if (!editItem.value) return
  await itemsStore.update(editItem.value.id, {
    title: editForm.value.title.trim(),
    description: editForm.value.description.trim(),
    clientId: editForm.value.clientId,
    important: editForm.value.important,
    urgent: editForm.value.urgent,
    estimatedHours: Number(editForm.value.estimatedHours) || 0,
    actualHours: Number(editForm.value.actualHours) || 0,
    dueDate: editForm.value.dueDate,
    billingType: editForm.value.billingType,
    charged: Number(editForm.value.charged) || 0,
    driveFolderId: editForm.value.driveFolderId.trim(),
    status: editForm.value.status
  })
  showEditDrawer.value = false
  ui.showToast('Work item updated', 'success')
}

watch([() => itemsStore.items, () => route.query.id], ([items, id]) => {
  if (id && items && items.length) {
    const item = items.find(x => x.id === id)
    if (item) {
      loadItemForEdit(item)
    }
  }
}, { immediate: true })

watch(showEditDrawer, (isOpen) => {
  if (!isOpen && route.query.id) {
    router.replace({ query: { ...route.query, id: undefined } })
  }
})
</script>

<template>
  <div class="px-8 md:px-12 py-10 max-w-5xl mx-auto space-y-8" data-testid="work-items">
    
    <!-- HEADER -->
    <PageHeader overline="Execution" title="Work scope" sub="Frictionless tasking and time tracking without rigid hierarchy constraints.">
      <template #right>
        <button @click="showAddDrawer = true" class="btn-primary">
          <Plus class="w-4 h-4" /> Create Work Item
        </button>
      </template>
    </PageHeader>

    <!-- TABS -->
    <div class="flex border-b border-line gap-6 text-sm font-medium">
      <button @click="activeTab = 'active'" class="pb-3 border-b-2"
        :class="activeTab === 'active' ? 'border-ink text-ink font-semibold' : 'border-transparent text-ink-3 hover:text-ink-2'">
        Active Scope ({{ Object.values(groupedActiveItems).reduce((sum, list) => sum + list.length, 0) }})
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
        <EmptyState title="All scopes clear" hint="Add tasks using the quick composer or click 'Create Work Item' above." />
      </div>
    </div>

    <!-- COMPLETED VIEW -->
    <div v-else class="space-y-3 animate-fade-in">
      <div v-if="completedItems.length" class="space-y-2.5">
        <WorkItemCard v-for="item in completedItems" :key="item.id" :item="item" />
      </div>
      <EmptyState v-else title="Nothing archived yet" hint="Complete your active tasks to build momentum." />
    </div>

    <!-- QUICK ADD DRAWER -->
    <div v-if="showAddDrawer" @keydown.window.esc="showAddDrawer = false" class="fixed inset-0 z-40 flex items-start justify-center pt-24 px-4">
      <div class="fixed inset-0 bg-ink/40 backdrop-blur-sm" @click="showAddDrawer = false"></div>
      <div class="relative w-full max-w-lg card p-8 shadow-xl bg-surface z-50 animate-rise-in space-y-6">
        <div>
          <div class="overline">New Scoped Item</div>
          <h2 class="font-serif text-2xl mt-1">Compose work item</h2>
        </div>

        <div class="space-y-4">
          <div>
            <label class="block text-xs font-semibold text-ink-2 mb-1">Title</label>
            <input v-model="title" placeholder="Describe the deliverable..." class="input-block text-sm" />
          </div>

          <div>
            <label class="block text-xs font-semibold text-ink-2 mb-1">Client Association</label>
            <select v-model="clientId" class="input-block text-sm">
              <option value="">No Client (Standalone task)</option>
              <option v-for="c in clientsStore.items" :key="c.id" :value="c.id">{{ c.name }}</option>
            </select>
          </div>

          <div class="grid grid-cols-2 gap-4">
            <!-- Urgent Checkbox -->
            <label class="flex items-center gap-2.5 p-3 rounded-xl border border-line bg-canvas/40 cursor-pointer select-none">
              <input type="checkbox" v-model="isUrgent" class="w-4 h-4 rounded border-line text-ink focus:ring-0" />
              <div class="text-xs">
                <span class="font-semibold block">Urgent</span>
                <span class="text-[10px] text-ink-3">Requires swift action</span>
              </div>
            </label>

            <!-- Important Checkbox -->
            <label class="flex items-center gap-2.5 p-3 rounded-xl border border-line bg-canvas/40 cursor-pointer select-none">
              <input type="checkbox" v-model="isImportant" class="w-4 h-4 rounded border-line text-ink focus:ring-0" />
              <div class="text-xs">
                <span class="font-semibold block">Important</span>
                <span class="text-[10px] text-ink-3">High strategic impact</span>
              </div>
            </label>
          </div>

          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-xs font-semibold text-ink-2 mb-1">Due Date</label>
              <input type="date" v-model="dueDate" class="input-block text-sm text-ink-2" />
            </div>
            <div>
              <label class="block text-xs font-semibold text-ink-2 mb-1">Est. Hours</label>
              <input type="number" v-model="estimatedHours" min="0" step="0.5" class="input-block text-sm" />
            </div>
          </div>

          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-xs font-semibold text-ink-2 mb-1">Billing Setup</label>
              <select v-model="billingType" class="input-block text-sm">
                <option value="fixed">Fixed-price milestone</option>
                <option value="hourly">Hourly Contract</option>
                <option value="none">Non-billable (admin)</option>
              </select>
            </div>
            <div>
              <label class="block text-xs font-semibold text-ink-2 mb-1">Charged ($)</label>
              <input type="number" v-model="charged" min="0" step="1" class="input-block text-sm" placeholder="e.g. 500" />
            </div>
          </div>

          <div>
            <label class="block text-xs font-semibold text-ink-2 mb-1">Additional description (optional)</label>
            <textarea v-model="description" rows="2" placeholder="Sub-tasks, references, notes..." class="input-block text-sm resize-none"></textarea>
          </div>
        </div>

        <div class="flex justify-end gap-3 pt-2">
          <button @click="showAddDrawer = false" class="btn-ghost">Cancel</button>
          <button @click="createWorkItem" class="btn-primary">Add to Scope</button>
        </div>
      </div>
    </div>

    <!-- QUICK EDIT DRAWER -->
    <div v-if="showEditDrawer" @keydown.window.esc="showEditDrawer = false" class="fixed inset-0 z-40 flex items-start justify-center pt-24 px-4">
      <div class="fixed inset-0 bg-ink/40 backdrop-blur-sm" @click="showEditDrawer = false"></div>
      <div class="relative w-full max-w-lg card p-8 shadow-xl bg-surface z-50 animate-rise-in space-y-6">
        <div>
          <div class="overline">Modify Work Item</div>
          <h2 class="font-serif text-2xl mt-1">Edit Details</h2>
        </div>

        <div class="space-y-4">
          <div>
            <label class="block text-xs font-semibold text-ink-2 mb-1">Title</label>
            <input v-model="editForm.title" placeholder="Describe the deliverable..." class="input-block text-sm" />
          </div>

          <div>
            <label class="block text-xs font-semibold text-ink-2 mb-1">Client Association</label>
            <select v-model="editForm.clientId" class="input-block text-sm">
              <option value="">No Client (Standalone task)</option>
              <option v-for="c in clientsStore.items" :key="c.id" :value="c.id">{{ c.name }}</option>
            </select>
          </div>

          <div>
            <label class="block text-xs font-semibold text-ink-2 mb-1">Status</label>
            <select v-model="editForm.status" class="input-block text-sm font-semibold">
              <optgroup label="To-do">
                <option value="waiting_feedback">Waiting For Feedback</option>
                <option value="on_hold">On Hold</option>
                <option value="ask_milestone">Ask For Next Milestone</option>
                <option value="pending_closure">Pending Closure</option>
              </optgroup>
              <optgroup label="In progress">
                <option value="critical">Critical</option>
                <option value="in_progress">In Progress</option>
              </optgroup>
              <optgroup label="Complete">
                <option value="complete">Complete</option>
                <option value="dropped">Dropped</option>
              </optgroup>
            </select>
          </div>

          <div class="grid grid-cols-3 gap-4">
            <div>
              <label class="block text-xs font-semibold text-ink-2 mb-1">Due Date</label>
              <input type="date" v-model="editForm.dueDate" class="input-block text-sm text-ink-2 font-mono" />
            </div>
            <div>
              <label class="block text-xs font-semibold text-ink-2 mb-1">Est. Hours</label>
              <input type="number" v-model="editForm.estimatedHours" min="0" step="0.5" class="input-block text-sm" />
            </div>
            <div>
              <label class="block text-xs font-semibold text-ink-2 mb-1">Actual Tracked</label>
              <input type="number" v-model="editForm.actualHours" min="0" step="0.5" class="input-block text-sm" />
            </div>
          </div>

          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-xs font-semibold text-ink-2 mb-1">Billing Setup</label>
              <select v-model="editForm.billingType" class="input-block text-sm">
                <option value="fixed">Fixed-price milestone</option>
                <option value="hourly">Hourly Contract</option>
                <option value="none">Non-billable (admin)</option>
              </select>
            </div>
            <div>
              <label class="block text-xs font-semibold text-ink-2 mb-1">Charged ($)</label>
              <input type="number" v-model="editForm.charged" min="0" step="1" class="input-block text-sm" placeholder="e.g. 500" />
            </div>
          </div>

          <div>
            <label class="block text-xs font-semibold text-ink-2 mb-1">Google Drive Folder ID/URL</label>
            <input v-model="editForm.driveFolderId" placeholder="e.g. mock-drive-folder-123" class="input-block text-sm font-mono" />
          </div>

          <div>
            <label class="block text-xs font-semibold text-ink-2 mb-1">Additional description (optional)</label>
            <textarea v-model="editForm.description" rows="2" placeholder="Sub-tasks, references, notes..." class="input-block text-sm resize-none"></textarea>
          </div>
        </div>

        <div class="flex justify-end gap-3 pt-2">
          <button @click="showEditDrawer = false" class="btn-ghost">Cancel</button>
          <button @click="saveEdit" class="btn-primary">Save Changes</button>
        </div>
      </div>
    </div>

  </div>
</template>
