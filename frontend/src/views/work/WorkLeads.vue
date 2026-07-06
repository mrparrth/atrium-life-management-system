<script setup>
import { computed, ref, watch, nextTick, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useWorkLeadsStore } from '@/stores/workLeads'
import { useWorkClientsStore } from '@/stores/workClients'
import { useUIStore } from '@/stores/ui'
import PageHeader from '@/components/PageHeader.vue'
import SectionHeader from '@/components/SectionHeader.vue'
import EmptyState from '@/components/EmptyState.vue'
import ClientPopup from '@/components/work/ClientPopup.vue'
import { Plus, Target, DollarSign, Calendar, MessageSquare, Trash, Briefcase, Archive, ArchiveRestore, MoreHorizontal } from 'lucide-vue-next'
import dayjs from 'dayjs'
import DateField from '@/components/DateField.vue'
import VInput from '@/components/VInput.vue'
import VSelect from '@/components/VSelect.vue'
import VTextarea from '@/components/VTextarea.vue'
import VCheckbox from '@/components/VCheckbox.vue'
import VRow from '@/components/VRow.vue'
import VCol from '@/components/VCol.vue'

const route = useRoute()
const router = useRouter()

const leadsStore = useWorkLeadsStore()
const clientsStore = useWorkClientsStore()
const ui = useUIStore()

const focusedFields = ref({})

const showAddModal = ref(false)
const addModalFirstInput = ref(null)

// Toggles for empty columns and archived leads (persisted in localStorage)
const showEmptyColumns = ref(localStorage.getItem('leads-show-empty-columns') !== 'false')
const showArchivedLeads = ref(localStorage.getItem('leads-show-archived') === 'true')

watch(showEmptyColumns, (val) => {
  localStorage.setItem('leads-show-empty-columns', val.toString())
})
watch(showArchivedLeads, (val) => {
  localStorage.setItem('leads-show-archived', val.toString())
})

// Onboarding Client Popup States
const showClientPopup = ref(false)
const prefillClientName = ref('')
const onboardingLeadId = ref(null)

watch(showAddModal, (val) => {
  if (val) nextTick(() => addModalFirstInput.value?.focus())
})
const title = ref('')
const clientName = ref('')
const value = ref(0)
const hours = ref(0)
const probability = ref('mid') // 'low', 'mid', 'high'
const followUpDate = ref(new Date().toISOString().slice(0, 10))
const notes = ref('')
const status = ref('lead')

const probMap = { low: 0.2, mid: 0.5, high: 0.8 }

function openAddModalForStage(stageKey) {
  status.value = stageKey
  showAddModal.value = true
}

async function createLead() {
  const missing = []
  if (!clientName.value.trim()) missing.push('Prospect Name')
  if (missing.length) {
    ui.showToast(`Please fill in: ${missing.join(', ')}`, 'warning')
    return
  }

  await leadsStore.add({
    title: title.value.trim(),
    clientName: clientName.value.trim(),
    status: status.value,
    estimatedValue: value.value,
    expectedHours: hours.value,
    probability: probMap[probability.value] || 0.5,
    followUpDate: followUpDate.value,
    notes: notes.value,
    archived: false
  })

  title.value = ''
  clientName.value = ''
  value.value = 0
  hours.value = 0
  probability.value = 'mid'
  followUpDate.value = new Date().toISOString().slice(0, 10)
  notes.value = ''
  showAddModal.value = false
  ui.showToast('Lead added to pipeline', 'success')
}

const stages = [
  { key: 'lead', name: 'Lead', color: 'border-l-slate-400' },
  { key: 'discovery', name: 'Discovery', color: 'border-l-blue-400' },
  { key: 'proposal_sent', name: 'Proposal Sent', color: 'border-l-violet-400' },
  { key: 'negotiation', name: 'Negotiation', color: 'border-l-amber-500' },
  { key: 'won', name: 'Won', color: 'border-l-emerald-500' },
  { key: 'lost', name: 'Lost', color: 'border-l-rose-500' }
]

const visibleStages = computed(() => {
  if (showEmptyColumns.value) return stages
  return stages.filter(stage => getLeadsByStage(stage.key).length > 0)
})

function getLeadsByStage(stageKey) {
  return leadsStore.items.filter(lead => {
    if (lead.status !== stageKey) return false
    if (!showArchivedLeads.value && lead.archived) return false
    return true
  })
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

function onboardLead(lead) {
  prefillClientName.value = lead.clientName
  onboardingLeadId.value = lead.id
  showClientPopup.value = true
}

async function handleClientCreated(client) {
  if (onboardingLeadId.value) {
    await leadsStore.update(onboardingLeadId.value, {
      status: 'won',
      archived: true
    })
    ui.showToast(`Lead onboarded successfully and client "${client.name}" created!`, 'success')
    onboardingLeadId.value = null
  }
}

async function toggleArchiveLead(lead) {
  const nextVal = !lead.archived
  await leadsStore.update(lead.id, { archived: nextVal })
  ui.showToast(nextVal ? 'Lead archived' : 'Lead restored', 'success')
}

const showEditModal = ref(false)
const editLead = ref(null)
const editForm = ref({
  title: '',
  clientName: '',
  estimatedValue: 0,
  expectedHours: 0,
  probability: 'mid',
  followUpDate: '',
  notes: '',
  status: 'lead',
  archived: false
})

function loadLeadForEdit(lead) {
  editLead.value = lead
  editForm.value = {
    title: lead.title || '',
    clientName: lead.clientName || '',
    estimatedValue: lead.estimatedValue || 0,
    expectedHours: lead.expectedHours || 0,
    probability: lead.probability >= 0.8 ? 'high' : lead.probability >= 0.5 ? 'mid' : 'low',
    followUpDate: lead.followUpDate || '',
    notes: lead.notes || '',
    status: lead.status || 'lead',
    archived: !!lead.archived
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
    probability: probMap[editForm.value.probability] || 0.5,
    followUpDate: editForm.value.followUpDate,
    notes: editForm.value.notes.trim(),
    status: editForm.value.status,
    archived: !!editForm.value.archived
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

const editModalFirstInput = ref(null)
watch(showEditModal, (isOpen) => {
  if (isOpen) {
    nextTick(() => {
      editModalFirstInput.value?.focus()
    })
  } else if (route.query.id) {
    router.replace({ query: { ...route.query, id: undefined } })
  }
})

const activeDropdownLeadId = ref(null)

function toggleDropdown(leadId) {
  if (activeDropdownLeadId.value === leadId) {
    activeDropdownLeadId.value = null
  } else {
    activeDropdownLeadId.value = leadId
  }
}

function closeDropdowns() {
  activeDropdownLeadId.value = null
}

function handleEscKey(e) {
  if (e.key === 'Escape') {
    if (showAddModal.value) showAddModal.value = false
    if (showEditModal.value) showEditModal.value = false
    if (showClientPopup.value) showClientPopup.value = false
    activeDropdownLeadId.value = null
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleEscKey)
  document.addEventListener('click', closeDropdowns)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleEscKey)
  document.removeEventListener('click', closeDropdowns)
})
</script>

<template>
  <div class="px-10 py-8 max-w-7xl mx-auto space-y-7 animate-fade-in" data-testid="work-leads">

    <!-- HEADER -->
    <PageHeader overline="Business" title="Leads funnel" sub="Great opportunities deserve great follow-through">
      <template #right>
        <button @click="showAddModal = true" class="btn-primary">
          <Plus class="w-4 h-4" /> Create Lead <span
            class="kbd ml-1.5 !bg-canvas/20 !border-canvas/10 !text-canvas select-none">⌘1</span>
        </button>
      </template>
    </PageHeader>

    <!-- METRICS & FILTERS ROW -->
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4">
      <!-- Estimated Pipeline -->
      <div class="bg-surface border border-[#ECE8E2] rounded-xl p-4 flex flex-col justify-between min-h-[84px]">
        <div class="font-serif text-3xl font-extrabold text-ink leading-tight">
          ${{ Math.round(leadsStore.forecast.totalPipeline).toLocaleString() }}
        </div>
        <div class="text-[10px] font-semibold text-ink-3 uppercase tracking-wider mt-1">Estimated Pipeline</div>
      </div>
      <!-- High Confidence -->
      <div class="bg-surface border border-[#ECE8E2] rounded-xl p-4 flex flex-col justify-between min-h-[84px]">
        <div class="font-serif text-3xl font-extrabold text-pri-strategic leading-tight">
          ${{ Math.round(leadsStore.forecast.high).toLocaleString() }}
        </div>
        <div class="text-[10px] font-semibold text-ink-3 uppercase tracking-wider mt-1">High Confidence</div>
      </div>
      <!-- Medium Confidence -->
      <div class="bg-surface border border-[#ECE8E2] rounded-xl p-4 flex flex-col justify-between min-h-[84px]">
        <div class="font-serif text-3xl font-extrabold text-pri-interruptive leading-tight">
          ${{ Math.round(leadsStore.forecast.medium).toLocaleString() }}
        </div>
        <div class="text-[10px] font-semibold text-ink-3 uppercase tracking-wider mt-1">Medium Confidence</div>
      </div>
      <!-- Low Confidence -->
      <div class="bg-surface border border-[#ECE8E2] rounded-xl p-4 flex flex-col justify-between min-h-[84px]">
        <div class="font-serif text-3xl font-extrabold text-ink-3 leading-tight">
          ${{ Math.round(leadsStore.forecast.low).toLocaleString() }}
        </div>
        <div class="text-[10px] font-semibold text-ink-3 uppercase tracking-wider mt-1">Low Confidence</div>
      </div>
      <!-- Weighted Opportunity -->
      <div class="bg-surface border border-[#ECE8E2] rounded-xl p-4 flex flex-col justify-between min-h-[84px]">
        <div class="font-serif text-3xl font-extrabold text-ink leading-tight">
          ${{ Math.round(leadsStore.forecast.total).toLocaleString() }}
        </div>
        <div class="text-[10px] font-semibold text-ink-3 uppercase tracking-wider mt-1">Weighted Forecast</div>
      </div>
      <!-- Filters Card -->
      <div class="bg-surface border border-[#ECE8E2] rounded-xl p-4 flex flex-col justify-center gap-3 min-h-[84px]">
        <div class="flex items-center justify-between">
          <label class="text-xs font-semibold text-ink uppercase tracking-wider">Show empty columns</label>
          <VCheckbox v-model="showEmptyColumns" />
        </div>
        <div class="flex items-center justify-between">
          <label class="text-xs font-semibold text-ink uppercase tracking-wider">Show archived leads</label>
          <VCheckbox v-model="showArchivedLeads" />
        </div>
      </div>
    </div>

    <!-- PIPELINE COLUMNS BOARD -->
    <div class="flex gap-4 overflow-x-auto pb-6 snap-x">
      <div v-for="stage in visibleStages" :key="stage.key"
        class="w-80 shrink-0 select-none flex flex-col h-[640px] bg-canvas/60 rounded-2xl border border-line/50 p-2 snap-start">

        <!-- Column Header -->
        <div
          class="flex items-center justify-between p-3.5 mb-4 bg-surface border border-[#ECE8E2] border-l-4 rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.02)]"
          :class="stage.color">
          <div class="flex flex-col gap-1">
            <h3 class="font-serif text-sm font-semibold text-ink leading-none">{{ stage.name }}</h3>
            <span class="text-[10px] text-ink-3 font-semibold font-mono leading-none">
              {{ getLeadsByStage(stage.key).length }} {{ getLeadsByStage(stage.key).length === 1 ? 'lead' : 'leads' }} ·
              ${{ getStageTotalValue(stage.key).toLocaleString() }}
            </span>
          </div>
          <button @click.stop="openAddModalForStage(stage.key)"
            class="p-1 hover:bg-canvas border border-[#ECE8E2] rounded-lg text-ink-2 hover:text-ink transition-all shadow-sm shrink-0"
            title="Add lead to this stage">
            <Plus class="w-3.5 h-3.5" />
          </button>
        </div>

        <!-- Column Cards Container -->
        <div class="flex-1 overflow-y-auto space-y-3 pr-1">
          <div v-for="lead in getLeadsByStage(stage.key)" :key="lead.id" @click="loadLeadForEdit(lead)"
            class="p-[18px] border border-[#ECE8E2] rounded-[14px] shadow-[0_3px_10px_rgba(0,0,0,0.05)] transition-all duration-300 relative group/card cursor-pointer"
            :class="lead.archived ? 'opacity-70 bg-surface/50' : 'bg-surface'">

            <div class="flex items-start justify-between gap-3">
              <h4 class="font-serif text-base font-bold text-ink leading-snug truncate">{{ lead.clientName }}</h4>

              <!-- Action Dropdown Trigger -->
              <div @click.stop class="relative inline-block text-left shrink-0">
                <button @click="toggleDropdown(lead.id)"
                  class="text-ink-3 hover:text-ink p-1 rounded-lg hover:bg-canvas transition-colors"
                  title="Manage Lead">
                  <MoreHorizontal class="w-4 h-4" />
                </button>

                <!-- Dropdown Menu -->
                <div v-if="activeDropdownLeadId === lead.id"
                  class="absolute right-0 mt-1 w-48 bg-surface border border-[#ECE8E2] rounded-xl shadow-lg py-1.5 z-20 animate-fade-in">

                  <!-- Onboard Lead -->
                  <button v-if="lead.status !== 'won'" @click="onboardLead(lead); activeDropdownLeadId = null"
                    class="w-full text-left px-3 py-2 text-xs text-pri-strategic hover:bg-canvas font-semibold flex items-center gap-2">
                    <Briefcase class="w-3.5 h-3.5" />
                    <span>Onboard Client</span>
                  </button>

                  <!-- Stage Selection Header -->
                  <div
                    class="px-3 py-1 text-[9px] uppercase font-bold text-ink-3 tracking-wider border-t border-line/30 mt-1">
                    Move to Stage</div>
                  <button v-for="stg in stages" :key="stg.key"
                    @click="updateStage(lead.id, stg.key); activeDropdownLeadId = null"
                    class="w-full text-left px-5 py-1.5 text-xs text-ink-2 hover:bg-canvas flex items-center justify-between"
                    :class="{ 'font-bold text-ink bg-canvas/30': lead.status === stg.key }">
                    <span>{{ stg.name }}</span>
                    <span v-if="lead.status === stg.key" class="text-[9px]">✓</span>
                  </button>
                  <button @click="updateStage(lead.id, 'lost'); activeDropdownLeadId = null"
                    class="w-full text-left px-5 py-1.5 text-xs text-ink-2 hover:bg-canvas flex items-center justify-between"
                    :class="{ 'font-bold text-ink bg-canvas/30': lead.status === 'lost' }">
                    <span>Lost</span>
                    <span v-if="lead.status === 'lost'" class="text-[9px]">✓</span>
                  </button>

                  <div class="border-t border-line/30 my-1"></div>

                  <!-- Archive / Restore -->
                  <button @click="toggleArchiveLead(lead); activeDropdownLeadId = null"
                    class="w-full text-left px-3 py-2 text-xs text-ink-2 hover:bg-canvas flex items-center gap-2">
                    <ArchiveRestore v-if="lead.archived" class="w-3.5 h-3.5" />
                    <Archive v-else class="w-3.5 h-3.5" />
                    <span>{{ lead.archived ? 'Restore Lead' : 'Archive Lead' }}</span>
                  </button>

                  <!-- Delete -->
                  <button @click="deleteLead(lead.id); activeDropdownLeadId = null"
                    class="w-full text-left px-3 py-2 text-xs text-pri-critical hover:bg-pri-critical-bg font-semibold flex items-center gap-2">
                    <Trash class="w-3.5 h-3.5" />
                    <span>Delete Lead</span>
                  </button>
                </div>
              </div>
            </div>

            <!-- Value / Probability Badge -->
            <div class="mt-4 flex items-center justify-between text-xs">
              <span class="font-serif font-extrabold text-ink text-sm">${{ lead.estimatedValue.toLocaleString()
                }}</span>

              <!-- Visually prominent probability badge -->
              <span class="text-[10px] border px-2 py-0.5 rounded font-mono font-bold flex items-center gap-1" :class="[
                lead.probability >= 0.8 ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' :
                  lead.probability >= 0.5 ? 'bg-amber-500/10 text-amber-600 border-amber-500/20' :
                    'bg-rose-500/10 text-rose-600 border-rose-500/20'
              ]">
                <span>{{ lead.probability >= 0.8 ? '🟢 High' : lead.probability >= 0.5 ? '🟡 Mid' : '🔴 Low' }}</span>
              </span>
            </div>

            <!-- Follow-up date -->
            <div class="mt-3 flex items-center justify-between text-[11px] text-ink-3">
              <span v-if="lead.followUpDate" class="flex items-center gap-1 font-semibold text-pri-interruptive">
                <Calendar class="w-3.5 h-3.5" /> Follow-up {{ dayjs(lead.followUpDate).format('MMM D') }}
              </span>
              <span v-else class="italic opacity-60">No follow-up set</span>

              <span v-if="lead.archived"
                class="text-[8px] bg-canvas border border-[#ECE8E2] px-1.5 py-0.5 rounded uppercase tracking-wider font-semibold">Archived</span>
            </div>
          </div>
        </div>

        <!-- Reduced empty column box -->
        <div v-if="!getLeadsByStage(stage.key).length"
          class="py-4 text-center border-t border-dashed border-line/30 text-[11px] text-ink-3 italic font-semibold">
          Empty
        </div>
      </div>
    </div>

    <!-- CREATE LEAD DIALOG -->
    <div v-if="showAddModal" @keydown.window.esc="showAddModal = false"
      class="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div class="fixed inset-0 bg-ink/40 backdrop-blur-sm animate-fade-in" @click="showAddModal = false"></div>
      <div class="relative w-full max-w-xl card p-8 shadow-xl bg-surface z-50 animate-rise-in space-y-6"
        @keydown.meta.enter.prevent="createLead" @keydown.ctrl.enter.prevent="createLead">
        <div>
          <div class="overline">New Sales Lead</div>
          <h2 class="font-serif text-2xl mt-1">Add sales opportunity</h2>
        </div>

        <div>
          <VRow>
            <VCol cols="12" sm="6">
              <VInput v-model="clientName" label="Prospect Name *" id="lead-client" required />
            </VCol>
            <VCol cols="12" sm="6">
              <VSelect v-model="status" label="Initial Stage" id="lead-status" :options="stages" option-value="key"
                option-label="name" />
            </VCol>
          </VRow>

          <VRow>
            <VCol cols="12" sm="6">
              <VInput type="number" v-model="value" min="0" label="Est. Deal Value ($)" id="lead-value" />
            </VCol>
            <VCol cols="12" sm="6">
              <VInput type="number" v-model="hours" min="0" label="Expected Scoped Hours" id="lead-hours" />
            </VCol>
          </VRow>

          <VRow class="items-center">
            <VCol cols="12" sm="6">
              <div class="py-1">
                <label
                  class="block text-[10px] text-ink-3 uppercase tracking-wider mb-1 font-semibold">Probability</label>
                <div class="flex gap-2 flex-wrap mt-1">
                  <button v-for="opt in ['low', 'mid', 'high']" :key="opt" type="button"
                    class="px-4 py-1.5 rounded-lg border text-xs capitalize transition-all font-medium"
                    :class="probability === opt ? 'bg-pri-strategic text-white border-pri-strategic shadow-sm' : 'bg-surface text-ink-2 border-line hover:border-line-2'"
                    @click="probability = opt">
                    {{ opt }}
                  </button>
                </div>
              </div>
            </VCol>
            <VCol cols="12" sm="6">
              <DateField v-model="followUpDate" label="Follow-up Target Date" id="lead-followup" />
            </VCol>
          </VRow>

          <VTextarea v-model="notes" label="Opportunity Notes" id="lead-notes" autogrow />
        </div>

        <div class="flex justify-end gap-3 pt-2">
          <button @click="showAddModal = false" class="btn-ghost">Cancel</button>
          <button @click="createLead" class="btn-primary">
            Add Lead <span
              class="kbd !bg-canvas/20 !border-canvas/10 !text-canvas select-none text-[9px] ml-1">⌘Enter</span>
          </button>
        </div>
      </div>
    </div>

    <!-- EDIT LEAD DIALOG -->
    <div v-if="showEditModal" @keydown.window.esc="showEditModal = false"
      class="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div class="fixed inset-0 bg-ink/40 backdrop-blur-sm animate-fade-in" @click="showEditModal = false"></div>
      <div class="relative w-full max-w-xl card p-8 shadow-xl bg-surface z-50 animate-rise-in space-y-6"
        @keydown.meta.enter.prevent="saveLeadEdit" @keydown.ctrl.enter.prevent="saveLeadEdit">
        <div class="flex items-start justify-between">
          <div>
            <div class="overline">Modify Sales Lead</div>
            <h2 class="font-serif text-2xl mt-1">Edit opportunity</h2>
          </div>
          <label
            class="flex items-center gap-2 cursor-pointer select-none text-xs font-semibold text-ink-3 uppercase tracking-wider hover:text-ink transition-colors mt-4"
            data-testid="edit-lead-archive">
            <input type="checkbox" v-model="editForm.archived"
              class="rounded border-line text-pri-strategic focus:ring-pri-strategic" />
            <span>Archive Lead</span>
          </label>
        </div>

        <div class="pt-2">
          <VRow>
            <VCol cols="12" sm="6">
              <VInput v-model="editForm.clientName" label="Prospect Name *" id="edit-lead-client" required />
            </VCol>
            <VCol cols="12" sm="6">
              <VSelect v-model="editForm.status" label="Pipeline Stage" id="edit-lead-status" :options="stages"
                option-value="key" option-label="name" />
            </VCol>
          </VRow>

          <VRow>
            <VCol cols="12" sm="6">
              <VInput type="number" v-model="editForm.estimatedValue" min="0" label="Est. Deal Value ($)"
                id="edit-lead-value" />
            </VCol>
            <VCol cols="12" sm="6">
              <VInput type="number" v-model="editForm.expectedHours" min="0" label="Expected Scoped Hours"
                id="edit-lead-hours" />
            </VCol>
          </VRow>

          <VRow class="items-center">
            <VCol cols="12" sm="6">
              <div class="py-1">
                <label
                  class="block text-[10px] text-ink-3 uppercase tracking-wider mb-1 font-semibold">Probability</label>
                <div class="flex gap-2 flex-wrap mt-1">
                  <button v-for="opt in ['low', 'mid', 'high']" :key="opt" type="button"
                    class="px-4 py-1.5 rounded-lg border text-xs capitalize transition-all font-medium"
                    :class="editForm.probability === opt ? 'bg-pri-strategic text-white border-pri-strategic shadow-sm' : 'bg-surface text-ink-2 border-line hover:border-line-2'"
                    @click="editForm.probability = opt">
                    {{ opt }}
                  </button>
                </div>
              </div>
            </VCol>
            <VCol cols="12" sm="6">
              <DateField v-model="editForm.followUpDate" label="Follow-up Target Date" id="edit-lead-followup" />
            </VCol>
          </VRow>


          <VTextarea v-model="editForm.notes" label="Opportunity Notes" id="edit-lead-notes" autogrow />
        </div>

        <div class="flex justify-end gap-3 pt-2">
          <button @click="showEditModal = false" class="btn-ghost">Cancel</button>
          <button @click="saveLeadEdit" class="btn-primary">
            Save Changes <span
              class="kbd !bg-canvas/20 !border-canvas/10 !text-canvas select-none text-[9px] ml-1">⌘Enter</span>
          </button>
        </div>
      </div>
    </div>

    <!-- CLIENT ONBOARDING POPUP -->
    <ClientPopup v-if="showClientPopup" :prefillName="prefillClientName" @close="showClientPopup = false"
      @saved="handleClientCreated" />

  </div>
</template>
