<script setup>
import { computed, ref, watch, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useWorkLeadsStore } from '@/stores/workLeads'
import { useWorkClientsStore } from '@/stores/workClients'
import { useUIStore } from '@/stores/ui'
import PageHeader from '@/components/PageHeader.vue'
import SectionHeader from '@/components/SectionHeader.vue'
import EmptyState from '@/components/EmptyState.vue'
import { Plus, Target, DollarSign, Calendar, MessageSquare, Trash, Briefcase } from 'lucide-vue-next'
import dayjs from 'dayjs'

const route = useRoute()
const router = useRouter()

const leadsStore = useWorkLeadsStore()
const clientsStore = useWorkClientsStore()
const ui = useUIStore()

const focusedFields = ref({})

const showAddModal = ref(false)
const title = ref('')
const clientName = ref('')
const value = ref(0)
const hours = ref(0)
const probability = ref(50)
const followUpDate = ref('')
const notes = ref('')
const status = ref('lead')

async function createLead() {
  if (!title.value.trim() || !clientName.value.trim()) return

  await leadsStore.add({
    title: title.value.trim(),
    clientName: clientName.value.trim(),
    status: status.value,
    estimatedValue: value.value,
    expectedHours: hours.value,
    probability: probability.value / 100,
    followUpDate: followUpDate.value,
    notes: notes.value
  })

  title.value = ''
  clientName.value = ''
  value.value = 0
  hours.value = 0
  probability.value = 50
  followUpDate.value = ''
  notes.value = ''
  showAddModal.value = false
  ui.showToast('Lead added to pipeline', 'success')
}

const stages = [
  { key: 'lead', name: 'Lead' },
  { key: 'discovery', name: 'Discovery' },
  { key: 'proposal_sent', name: 'Proposal Sent' },
  { key: 'negotiation', name: 'Negotiation' },
  { key: 'won', name: 'Won' },
  { key: 'onboarding', name: 'Onboarding' }
]

function getLeadsByStage(stageKey) {
  return leadsStore.items.filter(lead => lead.status === stageKey)
}

function getStageTotalValue(stageKey) {
  const list = getLeadsByStage(stageKey)
  return list.reduce((acc, lead) => acc + lead.estimatedValue, 0)
}

async function updateStage(leadId, nextStage) {
  await leadsStore.update(leadId, { status: nextStage })
  ui.showToast(`Lead moved to ${nextStage.replace('_', ' ')}`, 'success')
}

function deleteLead(id) {
  ui.confirm('Are you sure you want to delete this lead?').then(approved => {
    if (approved) {
      leadsStore.remove(id)
      ui.showToast('Lead removed', 'success')
    }
  })
}

async function convertToClient(lead) {
  const existingClient = clientsStore.items.find(c => c.name.toLowerCase() === lead.clientName.toLowerCase())
  if (existingClient) {
    ui.showToast('Client workspace already exists with this name', 'warning')
    return
  }

  await clientsStore.add({
    name: lead.clientName,
    status: 'prospect',
    relationshipNotes: lead.notes || `Converted from sales lead: ${lead.title}`,
    clientSource: 'Referral'
  })

  await leadsStore.update(lead.id, { status: 'won' })
  ui.showToast(`Successfully converted ${lead.clientName} to Client Workspace!`, 'success')
}

const showEditModal = ref(false)
const editLead = ref(null)
const editForm = ref({
  title: '',
  clientName: '',
  estimatedValue: 0,
  expectedHours: 0,
  probability: 50,
  followUpDate: '',
  notes: '',
  status: 'lead'
})

function loadLeadForEdit(lead) {
  editLead.value = lead
  editForm.value = {
    title: lead.title || '',
    clientName: lead.clientName || '',
    estimatedValue: lead.estimatedValue || 0,
    expectedHours: lead.expectedHours || 0,
    probability: Math.round((lead.probability || 0.5) * 100),
    followUpDate: lead.followUpDate || '',
    notes: lead.notes || '',
    status: lead.status || 'lead'
  }
  showEditModal.value = true
}

async function saveLeadEdit() {
  if (!editLead.value) return
  await leadsStore.update(editLead.value.id, {
    title: editForm.value.title.trim(),
    clientName: editForm.value.clientName.trim(),
    estimatedValue: Number(editForm.value.estimatedValue) || 0,
    expectedHours: Number(editForm.value.expectedHours) || 0,
    probability: editForm.value.probability / 100,
    followUpDate: editForm.value.followUpDate,
    notes: editForm.value.notes.trim(),
    status: editForm.value.status
  })
  showEditModal.value = false
  ui.showToast('Lead opportunity updated', 'success')
}

watch([() => leadsStore.items, () => route.query.id], ([items, id]) => {
  if (id && items && items.length) {
    const lead = items.find(x => x.id === id)
    if (lead) {
      loadLeadForEdit(lead)
    }
  }
}, { immediate: true })

watch(showEditModal, (isOpen) => {
  if (!isOpen && route.query.id) {
    router.replace({ query: { ...route.query, id: undefined } })
  }
})

function handleEscKey(e) {
  if (e.key === 'Escape') {
    if (showAddModal.value) showAddModal.value = false
    if (showEditModal.value) showEditModal.value = false
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
  <div class="px-8 md:px-12 py-10 max-w-7xl mx-auto space-y-8 animate-fade-in" data-testid="work-leads">

    <!-- HEADER -->
    <PageHeader overline="Business" title="Leads funnel" sub="Great opportunities deserve great follow-through">
      <template #right>
        <button @click="showAddModal = true" class="btn-primary">
          <Plus class="w-4 h-4" /> Create Lead <span class="kbd ml-1.5 !bg-canvas/20 !border-canvas/10 !text-canvas select-none">⌘1</span>
        </button>
      </template>
    </PageHeader>

    <!-- PIPELINE FORECAST BRIEFING -->
    <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
      <div class="card p-4 bg-surface/50 border border-line">
        <div class="overline text-ink-3">Total Estimated Pipeline</div>
        <div class="font-serif text-2xl font-bold mt-1 text-ink">
          ${{leadsStore.items.reduce((acc, x) => acc + x.estimatedValue, 0).toLocaleString()}}
        </div>
      </div>
      <div class="card p-4 bg-surface/50 border border-line">
        <div class="overline text-pri-strategic">High Confidence Forecast (P >= 80%)</div>
        <div class="font-serif text-2xl font-bold mt-1 text-pri-strategic">
          ${{ Math.round(leadsStore.forecast.high).toLocaleString() }}
        </div>
      </div>
      <div class="card p-4 bg-surface/50 border border-line">
        <div class="overline text-pri-interruptive">Medium Confidence Forecast (P >= 50%)</div>
        <div class="font-serif text-2xl font-bold mt-1 text-pri-interruptive">
          ${{ Math.round(leadsStore.forecast.medium).toLocaleString() }}
        </div>
      </div>
      <div class="card p-4 bg-surface/50 border border-line">
        <div class="overline text-ink-3">Total Weighted Opportunity</div>
        <div class="font-serif text-2xl font-bold mt-1 text-ink">
          ${{ Math.round(leadsStore.forecast.total).toLocaleString() }}
        </div>
      </div>
    </div>

    <!-- PIPELINE COLUMNS BOARD -->
    <div class="flex gap-4 overflow-x-auto pb-6 -mx-8 px-8 snap-x">
      <div v-for="stage in stages" :key="stage.key"
        class="w-80 shrink-0 select-none flex flex-col h-[600px] bg-canvas/30 rounded-2xl border border-line/60 p-4 snap-start">

        <!-- Column Header -->
        <div class="flex items-center justify-between pb-3 mb-4 border-b border-line/50">
          <div>
            <h3 class="font-serif text-sm font-semibold text-ink">{{ stage.name }}</h3>
            <span class="text-[10px] text-ink-3 font-semibold uppercase tracking-wider">${{
              getStageTotalValue(stage.key).toLocaleString() }}</span>
          </div>
          <span class="text-xs font-mono font-medium px-2 py-0.5 rounded-full bg-canvas border text-ink-2">
            {{ getLeadsByStage(stage.key).length }}
          </span>
        </div>

        <!-- Column Cards Container -->
        <div class="flex-1 overflow-y-auto space-y-3 pr-1">
          <div v-for="lead in getLeadsByStage(stage.key)" :key="lead.id"
            @click="loadLeadForEdit(lead)"
            class="card p-4 bg-surface border border-line hover:border-line-2 hover:shadow-sm transition-all duration-300 relative group/card cursor-pointer">

            <div class="space-y-1">
              <div class="text-[10px] uppercase font-semibold tracking-wider text-ink-3">{{ lead.clientName }}</div>
              <h4 class="font-medium text-ink text-sm leading-snug">{{ lead.title }}</h4>
            </div>

            <!-- Value / Probability -->
            <div class="mt-4 flex items-center justify-between text-xs border-t border-line/40 pt-3">
              <span class="font-serif font-bold text-ink">${{ lead.estimatedValue.toLocaleString() }}</span>
              <span class="text-[10px] bg-canvas border px-2 py-0.5 rounded font-mono font-semibold text-ink-2">
                {{ Math.round(lead.probability * 100) }}% prob
              </span>
            </div>

            <!-- Follow-up date / notes -->
            <div class="mt-3 flex flex-col gap-1 text-[10px] text-ink-3">
              <span v-if="lead.followUpDate" class="flex items-center gap-1 text-pri-interruptive font-semibold">
                <Calendar class="w-3.5 h-3.5" /> Follow Up: {{ dayjs(lead.followUpDate).format('MMM D, YYYY') }}
              </span>
              <span v-else class="italic">No follow-up set</span>

              <span v-if="lead.statusChangedAt" class="text-[9px] text-ink-3 opacity-80">
                Status updated: {{ dayjs(lead.statusChangedAt).format('MMM D, h:mm A') }}
              </span>
            </div>

            <!-- Quick actions -->
            <div @click.stop
              class="mt-3 pt-2 border-t border-line/30 flex justify-between gap-2 items-center opacity-0 group-hover/card:opacity-100 transition-opacity">
              <!-- Select drop stage switcher -->
              <select :value="lead.status" @change="updateStage(lead.id, $event.target.value)"
                class="text-[10px] bg-canvas border rounded px-1.5 py-0.5 text-ink-2 focus:outline-none">
                <option v-for="stg in stages" :key="stg.key" :value="stg.key">{{ stg.name }}</option>
                <option value="lost">Lost</option>
              </select>

              <div class="flex items-center gap-1.5">
                <button v-if="lead.status !== 'won' && lead.status !== 'onboarding'"
                  class="text-[10px] text-pri-strategic hover:underline flex items-center gap-0.5"
                  @click="convertToClient(lead)" title="Convert to Workspace Client">
                  <Briefcase class="w-3 h-3" /> Convert
                </button>
                <button @click="deleteLead(lead.id)" class="text-ink-3 hover:text-pri-critical p-1 rounded"
                  title="Delete Opportunity">
                  <Trash class="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>

          <div v-if="!getLeadsByStage(stage.key).length"
            class="h-24 flex items-center justify-center border border-dashed border-line rounded-xl text-[11px] text-ink-3 italic">
            Column empty
          </div>
        </div>
      </div>
    </div>

    <!-- CREATE LEAD DIALOG -->
    <div v-if="showAddModal" @keydown.window.esc="showAddModal = false"
      class="fixed inset-0 z-40 flex items-start justify-center pt-24 px-4">
      <div class="fixed inset-0 bg-ink/40 backdrop-blur-sm" @click="showAddModal = false"></div>
      <div class="relative w-full max-w-lg card p-8 shadow-xl bg-surface z-50 animate-rise-in space-y-6">
        <div>
          <div class="overline">New Sales Lead</div>
          <h2 class="font-serif text-2xl mt-1">Add sales opportunity</h2>
        </div>

        <div class="space-y-4 pt-2">
          <div class="grid grid-cols-2 gap-4">
            <div class="v-field-group">
              <input v-model="title" placeholder=" " class="v-field-input" id="lead-title" required />
              <label for="lead-title" class="v-field-label">Opportunity Title *</label>
            </div>
            <div class="v-field-group">
              <input v-model="clientName" placeholder=" " class="v-field-input" id="lead-client" required />
              <label for="lead-client" class="v-field-label">Prospect Name *</label>
            </div>
          </div>

          <div class="grid grid-cols-2 gap-4">
            <div class="v-field-group">
              <input type="number" v-model="value" min="0" placeholder=" " class="v-field-input" id="lead-value" />
              <label for="lead-value" class="v-field-label">Est. Deal Value ($)</label>
            </div>
            <div class="v-field-group">
              <input type="number" v-model="hours" min="0" placeholder=" " class="v-field-input" id="lead-hours" />
              <label for="lead-hours" class="v-field-label">Expected Scoped Hours</label>
            </div>
          </div>

          <div class="grid grid-cols-2 gap-4 items-center">
            <div class="py-1">
              <label class="block text-[10px] text-ink-3 uppercase tracking-wider mb-1 font-semibold">Probability ({{ probability }}%)</label>
              <input type="range" v-model="probability" min="10" max="100" step="5"
                class="w-full h-1 bg-line rounded-lg appearance-none cursor-pointer accent-ink" />
            </div>
            <div class="v-field-group">
              <input type="date" v-model="followUpDate" placeholder=" " class="v-field-input text-ink-2" id="lead-followup" />
              <label for="lead-followup" class="v-field-label">Follow-up Target Date</label>
            </div>
          </div>

          <div class="grid grid-cols-2 gap-4">
            <div class="v-field-group">
              <select v-model="status" @focus="focusedFields.status = true" @blur="focusedFields.status = false" class="v-field-select">
                <option v-for="stg in stages" :key="stg.key" :value="stg.key">{{ stg.name }}</option>
              </select>
              <span class="v-field-arrow">▼</span>
              <label :class="['v-field-label', (status || focusedFields.status) ? 'v-field-label--floating' : '', focusedFields.status ? 'v-field-label--floating-focused' : '']">Initial Stage</label>
            </div>
          </div>

          <div class="v-field-group">
            <textarea v-model="notes" placeholder=" " class="v-field-input min-h-[80px] resize-none" id="lead-notes"></textarea>
            <label for="lead-notes" class="v-field-label">Opportunity Notes</label>
          </div>
        </div>

        <div class="flex justify-end gap-3 pt-2">
          <button @click="showAddModal = false" class="btn-ghost">Cancel</button>
          <button @click="createLead" class="btn-primary">Add Opportunity</button>
        </div>
      </div>
    </div>

    <!-- EDIT LEAD DIALOG -->
    <div v-if="showEditModal" @keydown.window.esc="showEditModal = false"
      class="fixed inset-0 z-40 flex items-start justify-center pt-24 px-4">
      <div class="fixed inset-0 bg-ink/40 backdrop-blur-sm" @click="showEditModal = false"></div>
      <div class="relative w-full max-w-lg card p-8 shadow-xl bg-surface z-50 animate-rise-in space-y-6">
        <div>
          <div class="overline">Modify Sales Lead</div>
          <h2 class="font-serif text-2xl mt-1">Edit opportunity</h2>
        </div>

        <div class="space-y-4 pt-2">
          <div class="grid grid-cols-2 gap-4">
            <div class="v-field-group">
              <input v-model="editForm.title" placeholder=" " class="v-field-input" id="edit-lead-title" required />
              <label for="edit-lead-title" class="v-field-label">Opportunity Title *</label>
            </div>
            <div class="v-field-group">
              <input v-model="editForm.clientName" placeholder=" " class="v-field-input" id="edit-lead-client" required />
              <label for="edit-lead-client" class="v-field-label">Prospect Name *</label>
            </div>
          </div>

          <div class="grid grid-cols-2 gap-4">
            <div class="v-field-group">
              <input type="number" v-model="editForm.estimatedValue" min="0" placeholder=" " class="v-field-input" id="edit-lead-value" />
              <label for="edit-lead-value" class="v-field-label">Est. Deal Value ($)</label>
            </div>
            <div class="v-field-group">
              <input type="number" v-model="editForm.expectedHours" min="0" placeholder=" " class="v-field-input" id="edit-lead-hours" />
              <label for="edit-lead-hours" class="v-field-label">Expected Scoped Hours</label>
            </div>
          </div>

          <div class="grid grid-cols-2 gap-4 items-center">
            <div class="py-1">
              <label class="block text-[10px] text-ink-3 uppercase tracking-wider mb-1 font-semibold">Probability ({{ editForm.probability }}%)</label>
              <input type="range" v-model="editForm.probability" min="10" max="100" step="5"
                class="w-full h-1 bg-line rounded-lg appearance-none cursor-pointer accent-ink" />
            </div>
            <div class="v-field-group">
              <input type="date" v-model="editForm.followUpDate" placeholder=" " class="v-field-input text-ink-2 font-mono" id="edit-lead-followup" />
              <label for="edit-lead-followup" class="v-field-label">Follow-up Target Date</label>
            </div>
          </div>

          <div class="grid grid-cols-2 gap-4">
            <div class="v-field-group">
              <select v-model="editForm.status" @focus="focusedFields.editStatus = true" @blur="focusedFields.editStatus = false" class="v-field-select font-semibold">
                <option v-for="stg in stages" :key="stg.key" :value="stg.key">{{ stg.name }}</option>
                <option value="lost">Lost</option>
              </select>
              <span class="v-field-arrow">▼</span>
              <label :class="['v-field-label', (editForm.status || focusedFields.editStatus) ? 'v-field-label--floating' : '', focusedFields.editStatus ? 'v-field-label--floating-focused' : '']">Pipeline Stage</label>
            </div>
          </div>

          <div class="v-field-group">
            <textarea v-model="editForm.notes" placeholder=" " class="v-field-input min-h-[80px] resize-none" id="edit-lead-notes"></textarea>
            <label for="edit-lead-notes" class="v-field-label">Opportunity Notes</label>
          </div>
        </div>

        <div class="flex justify-end gap-3 pt-2">
          <button @click="showEditModal = false" class="btn-ghost">Cancel</button>
          <button @click="saveLeadEdit" class="btn-primary">Save Changes</button>
        </div>
      </div>
    </div>

  </div>
</template>
