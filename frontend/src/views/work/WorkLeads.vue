<script setup>
import { computed, ref } from 'vue'
import { useWorkLeadsStore } from '@/stores/workLeads'
import { useUIStore } from '@/stores/ui'
import PageHeader from '@/components/PageHeader.vue'
import SectionHeader from '@/components/SectionHeader.vue'
import EmptyState from '@/components/EmptyState.vue'
import { Plus, Target, DollarSign, Calendar, MessageSquare, Trash } from 'lucide-vue-next'
import dayjs from 'dayjs'

const leadsStore = useWorkLeadsStore()
const ui = useUIStore()

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

function updateStage(leadId, nextStage) {
  leadsStore.update(leadId, { status: nextStage })
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
</script>

<template>
  <div class="px-8 md:px-12 py-10 max-w-7xl mx-auto space-y-8 animate-fade-in" data-testid="work-leads">
    
    <!-- HEADER -->
    <PageHeader overline="Business" title="Leads funnel" sub="Track opportunities, discovery stages, and weighted forecasts without corporate CRM clutter.">
      <template #right>
        <button @click="showAddModal = true" class="btn-primary">
          <Plus class="w-4 h-4" /> Create Lead
        </button>
      </template>
    </PageHeader>

    <!-- PIPELINE FORECAST BRIEFING -->
    <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
      <div class="card p-4 bg-surface/50 border border-line">
        <div class="overline text-ink-3">Total Estimated Pipeline</div>
        <div class="font-serif text-2xl font-bold mt-1 text-ink">
          ₹{{ leadsStore.items.reduce((acc, x) => acc + x.estimatedValue, 0).toLocaleString() }}
        </div>
      </div>
      <div class="card p-4 bg-surface/50 border border-line">
        <div class="overline text-pri-strategic">High Confidence Forecast (P >= 80%)</div>
        <div class="font-serif text-2xl font-bold mt-1 text-pri-strategic">
          ₹{{ Math.round(leadsStore.forecast.high).toLocaleString() }}
        </div>
      </div>
      <div class="card p-4 bg-surface/50 border border-line">
        <div class="overline text-pri-interruptive">Medium Confidence Forecast (P >= 50%)</div>
        <div class="font-serif text-2xl font-bold mt-1 text-pri-interruptive">
          ₹{{ Math.round(leadsStore.forecast.medium).toLocaleString() }}
        </div>
      </div>
      <div class="card p-4 bg-surface/50 border border-line">
        <div class="overline text-ink-3">Total Weighted Opportunity</div>
        <div class="font-serif text-2xl font-bold mt-1 text-ink">
          ₹{{ Math.round(leadsStore.forecast.total).toLocaleString() }}
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
            <span class="text-[10px] text-ink-3 font-semibold uppercase tracking-wider">₹{{ getStageTotalValue(stage.key).toLocaleString() }}</span>
          </div>
          <span class="text-xs font-mono font-medium px-2 py-0.5 rounded-full bg-canvas border text-ink-2">
            {{ getLeadsByStage(stage.key).length }}
          </span>
        </div>

        <!-- Column Cards Container -->
        <div class="flex-1 overflow-y-auto space-y-3 pr-1">
          <div v-for="lead in getLeadsByStage(stage.key)" :key="lead.id"
            class="card p-4 bg-surface border border-line hover:border-line-2 hover:shadow-sm transition-all duration-300 relative group/card">
            
            <div class="space-y-1">
              <div class="text-[10px] uppercase font-semibold tracking-wider text-ink-3">{{ lead.clientName }}</div>
              <h4 class="font-medium text-ink text-sm leading-snug">{{ lead.title }}</h4>
            </div>

            <!-- Value / Probability -->
            <div class="mt-4 flex items-center justify-between text-xs border-t border-line/40 pt-3">
              <span class="font-serif font-bold text-ink">₹{{ lead.estimatedValue.toLocaleString() }}</span>
              <span class="text-[10px] bg-canvas border px-2 py-0.5 rounded font-mono font-semibold text-ink-2">
                {{ Math.round(lead.probability * 100) }}% prob
              </span>
            </div>

            <!-- Follow-up date / notes -->
            <div class="mt-3 flex justify-between items-center text-[10px] text-ink-3">
              <span v-if="lead.followUpDate" class="flex items-center gap-1 text-pri-interruptive">
                <Calendar class="w-3.5 h-3.5" /> {{ dayjs(lead.followUpDate).format('MMM D') }}
              </span>
              <span v-else class="italic">No follow-up set</span>
            </div>
            
            <!-- Quick actions -->
            <div class="mt-3 pt-2 border-t border-line/30 flex justify-between gap-2 items-center opacity-0 group-hover/card:opacity-100 transition-opacity">
              <!-- Select drop stage switcher -->
              <select :value="lead.status" @change="updateStage(lead.id, $event.target.value)" 
                class="text-[10px] bg-canvas border rounded px-1.5 py-0.5 text-ink-2 focus:outline-none">
                <option v-for="stg in stages" :key="stg.key" :value="stg.key">{{ stg.name }}</option>
                <option value="lost">Lost</option>
              </select>
              
              <button @click="deleteLead(lead.id)" class="text-ink-3 hover:text-pri-critical p-1 rounded" title="Delete Opportunity">
                <Trash class="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <div v-if="!getLeadsByStage(stage.key).length" class="h-24 flex items-center justify-center border border-dashed border-line rounded-xl text-[11px] text-ink-3 italic">
            Column empty
          </div>
        </div>
      </div>
    </div>

    <!-- CREATE LEAD DIALOG -->
    <div v-if="showAddModal" @keydown.window.esc="showAddModal = false" class="fixed inset-0 z-40 flex items-start justify-center pt-24 px-4">
      <div class="fixed inset-0 bg-ink/40 backdrop-blur-sm" @click="showAddModal = false"></div>
      <div class="relative w-full max-w-lg card p-8 shadow-xl bg-surface z-50 animate-rise-in space-y-6">
        <div>
          <div class="overline">New Sales Lead</div>
          <h2 class="font-serif text-2xl mt-1">Add sales opportunity</h2>
        </div>

        <div class="space-y-4">
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-xs font-semibold text-ink-2 mb-1">Opportunity Title</label>
              <input v-model="title" placeholder="e.g. Website Overhaul" class="input-block text-sm" />
            </div>
            <div>
              <label class="block text-xs font-semibold text-ink-2 mb-1">Prospect Name</label>
              <input v-model="clientName" placeholder="e.g. Alpha Design" class="input-block text-sm" />
            </div>
          </div>

          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-xs font-semibold text-ink-2 mb-1">Est. Deal Value (₹)</label>
              <input type="number" v-model="value" min="0" class="input-block text-sm" />
            </div>
            <div>
              <label class="block text-xs font-semibold text-ink-2 mb-1">Expected Scoped Hours</label>
              <input type="number" v-model="hours" min="0" class="input-block text-sm" />
            </div>
          </div>

          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-xs font-semibold text-ink-2 mb-1">Probability ({{ probability }}%)</label>
              <input type="range" v-model="probability" min="10" max="100" step="5" class="w-full h-1 bg-line rounded-lg appearance-none cursor-pointer accent-ink" />
            </div>
            <div>
              <label class="block text-xs font-semibold text-ink-2 mb-1">Follow-up Target Date</label>
              <input type="date" v-model="followUpDate" class="input-block text-sm text-ink-2" />
            </div>
          </div>

          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-xs font-semibold text-ink-2 mb-1">Initial Stage</label>
              <select v-model="status" class="input-block text-sm">
                <option v-for="stg in stages" :key="stg.key" :value="stg.key">{{ stg.name }}</option>
              </select>
            </div>
          </div>

          <div>
            <label class="block text-xs font-semibold text-ink-2 mb-1">Opportunity Notes</label>
            <textarea v-model="notes" rows="3" placeholder="Timeline requirements, references, next actions..." class="input-block text-sm resize-none"></textarea>
          </div>
        </div>

        <div class="flex justify-end gap-3 pt-2">
          <button @click="showAddModal = false" class="btn-ghost">Cancel</button>
          <button @click="createLead" class="btn-primary">Add Opportunity</button>
        </div>
      </div>
    </div>

  </div>
</template>
