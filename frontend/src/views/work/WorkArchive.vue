<script setup>
import { ref, computed, watch } from 'vue'
import { useWorkItemsStore } from '@/stores/workItems'
import { useWorkLeadsStore } from '@/stores/workLeads'
import { useWorkClientsStore } from '@/stores/workClients'
import PageHeader from '@/components/PageHeader.vue'
import SectionHeader from '@/components/SectionHeader.vue'
import EmptyState from '@/components/EmptyState.vue'
import { Archive, CheckCircle2 } from 'lucide-vue-next'
import dayjs from 'dayjs'

const itemsStore = useWorkItemsStore()
const leadsStore = useWorkLeadsStore()
const clientsStore = useWorkClientsStore()

const activeTab = ref('tasks')
const currentPage = ref(1)
const itemsPerPage = 15

watch(activeTab, () => {
  currentPage.value = 1
})

const completedItems = computed(() => {
  return itemsStore.items.filter(item => itemsStore.isCompleted(item.status))
})

const inactiveLeads = computed(() => {
  return leadsStore.items.filter(lead => ['won', 'lost'].includes(lead.status))
})

const paginatedTasks = computed(() => {
  const start = (currentPage.value - 1) * itemsPerPage
  return completedItems.value.slice(start, start + itemsPerPage)
})

const paginatedLeads = computed(() => {
  const start = (currentPage.value - 1) * itemsPerPage
  return inactiveLeads.value.slice(start, start + itemsPerPage)
})

const totalPages = computed(() => {
  const total = activeTab.value === 'tasks' ? completedItems.value.length : inactiveLeads.value.length
  return Math.ceil(total / itemsPerPage) || 1
})

function getClientName(clientId) {
  const c = clientsStore.items.find(x => x.id === clientId)
  return c ? c.name : ''
}
</script>

<template>
  <div class="px-8 md:px-12 py-10 max-w-4xl mx-auto space-y-6 animate-fade-in" data-testid="work-archive">

    <!-- HEADER -->
    <PageHeader overline="System" title="Work archives"
      sub="Review historical scopes, completed deliverables, and closed sales pipeline leads.">
      <template #right>
        <span
          class="text-xs text-ink-3 font-semibold uppercase tracking-wider bg-canvas border px-3 py-1.5 rounded-xl flex items-center gap-1.5">
          <Archive class="w-4 h-4" /> Operations Archive
        </span>
      </template>
    </PageHeader>

    <!-- TAB STRIP -->
    <div class="flex gap-1 p-1 bg-canvas border border-line/60 rounded-xl w-fit">
      <button 
        type="button"
        class="px-4 py-1.5 rounded-lg text-xs font-semibold uppercase tracking-wider transition-all"
        :class="activeTab === 'tasks' ? 'bg-surface text-ink border border-line/45 shadow-sm font-bold' : 'text-ink-3 hover:text-ink'"
        @click="activeTab = 'tasks'"
      >
        Tasks ({{ completedItems.length }})
      </button>
      <button 
        type="button"
        class="px-4 py-1.5 rounded-lg text-xs font-semibold uppercase tracking-wider transition-all"
        :class="activeTab === 'leads' ? 'bg-surface text-ink border border-line/45 shadow-sm font-bold' : 'text-ink-3 hover:text-ink'"
        @click="activeTab = 'leads'"
      >
        Leads ({{ inactiveLeads.length }})
      </button>
    </div>

    <!-- DETAILS CONTENT CONTAINER -->
    <div class="pt-2">
      <!-- TASKS ARCHIVE -->
      <div v-if="activeTab === 'tasks'" class="space-y-4">
        <SectionHeader overline="Completed Tasks" />
        <div v-if="completedItems.length" class="space-y-1.5">
          <div v-for="item in paginatedTasks" :key="item.id" 
            class="flex items-center justify-between py-2.5 px-4 bg-surface hover:bg-canvas border border-line/40 rounded-xl transition-all text-sm group">
            <div class="flex items-center gap-3 truncate">
              <CheckCircle2 class="w-4 h-4 text-pri-strategic shrink-0" />
              <span class="font-medium text-ink truncate">{{ item.title }}</span>
              <span v-if="getClientName(item.clientId)" class="text-xs text-ink-3 truncate">
                · {{ getClientName(item.clientId) }}
              </span>
            </div>
            <div class="flex items-center gap-4 shrink-0 text-xs text-ink-3">
              <span>{{ item.actualHours }}h tracked</span>
              <span>{{ dayjs(item.closedDate || item.updatedAt).format('MMM D, YYYY') }}</span>
            </div>
          </div>
        </div>
        <EmptyState v-else title="Archive empty"
          hint="Deliverables appear here once marked done on the focus scopes page." />
      </div>

      <!-- LEADS ARCHIVE -->
      <div v-else class="space-y-4">
        <SectionHeader overline="Closed Deals" />
        <div v-if="inactiveLeads.length" class="space-y-1.5">
          <div v-for="lead in paginatedLeads" :key="lead.id" 
            class="flex items-center justify-between py-2.5 px-4 bg-surface hover:bg-canvas border border-line/40 rounded-xl transition-all text-sm group">
            <div class="flex items-center gap-3 truncate">
              <span class="shrink-0 text-[10px] px-2 py-0.5 rounded font-mono font-bold border uppercase tracking-wider"
                :class="lead.status === 'won' ? 'bg-pri-strategic-bg border-pri-strategic-bd text-pri-strategic' : 'bg-pri-backlog-bg border-pri-backlog-bd text-pri-backlog'">
                {{ lead.status }}
              </span>
              <span class="font-medium text-ink truncate">{{ lead.title }}</span>
              <span class="text-xs text-ink-3 truncate">· {{ lead.clientName }}</span>
            </div>
            <div class="flex items-center gap-4 shrink-0 text-xs text-ink-3">
              <span>${{ lead.estimatedValue.toLocaleString() }}</span>
              <span>Closed {{ dayjs(lead.updatedAt).format('MMM D, YYYY') }}</span>
            </div>
          </div>
        </div>
        <EmptyState v-else title="No closed pipeline records"
          hint="Opportunities will show here when updated to closed states." />
      </div>

      <!-- PAGINATION CONTROLS -->
      <div v-if="totalPages > 1" class="flex items-center justify-between pt-5 border-t border-line/40 mt-5 text-xs">
        <span class="text-ink-3">
          Showing {{ (currentPage - 1) * itemsPerPage + 1 }} to {{ Math.min(currentPage * itemsPerPage, activeTab === 'tasks' ? completedItems.length : inactiveLeads.length) }} of {{ activeTab === 'tasks' ? completedItems.length : inactiveLeads.length }} entries
        </span>
        <div class="flex gap-2">
          <button 
            type="button" 
            class="btn-secondary !py-1.5 !px-3 disabled:opacity-40 disabled:cursor-not-allowed" 
            :disabled="currentPage === 1" 
            @click="currentPage--"
          >
            Previous
          </button>
          <span class="flex items-center px-1 font-semibold text-ink">Page {{ currentPage }} of {{ totalPages }}</span>
          <button 
            type="button" 
            class="btn-secondary !py-1.5 !px-3 disabled:opacity-40 disabled:cursor-not-allowed" 
            :disabled="currentPage === totalPages" 
            @click="currentPage++"
          >
            Next
          </button>
        </div>
      </div>

    </div>

  </div>
</template>
