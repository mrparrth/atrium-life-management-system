<script setup>
import { computed } from 'vue'
import { useWorkItemsStore } from '@/stores/workItems'
import { useWorkLeadsStore } from '@/stores/workLeads'
import PageHeader from '@/components/PageHeader.vue'
import SectionHeader from '@/components/SectionHeader.vue'
import EmptyState from '@/components/EmptyState.vue'
import WorkItemCard from '@/components/work/WorkItemCard.vue'
import { Archive, ArrowRight, FolderKanban } from 'lucide-vue-next'
import dayjs from 'dayjs'

const itemsStore = useWorkItemsStore()
const leadsStore = useWorkLeadsStore()

const completedItems = computed(() => {
  return itemsStore.items.filter(item => itemsStore.isCompleted(item.status))
})

const inactiveLeads = computed(() => {
  return leadsStore.items.filter(lead => ['won', 'lost'].includes(lead.status))
})
</script>

<template>
  <div class="px-8 md:px-12 py-10 max-w-4xl mx-auto space-y-10 animate-fade-in" data-testid="work-archive">
    
    <!-- HEADER -->
    <PageHeader overline="System" title="Work archives" sub="Review historical scopes, completed deliverables, and closed sales pipeline leads.">
      <template #right>
        <span class="text-xs text-ink-3 font-semibold uppercase tracking-wider bg-canvas border px-3 py-1.5 rounded-xl flex items-center gap-1.5">
          <Archive class="w-4 h-4" /> Operations Archive
        </span>
      </template>
    </PageHeader>

    <!-- COMPLETED WORK ITEMS -->
    <section class="space-y-4">
      <SectionHeader overline="Completed" title="Historical Scopes" hint="Completed deliverables and scoped tasks." />
      <div v-if="completedItems.length" class="space-y-3">
        <WorkItemCard v-for="item in completedItems" :key="item.id" :item="item" />
      </div>
      <EmptyState v-else title="Archive empty" hint="Deliverables appear here once marked done on the focus scopes page." />
    </section>

    <!-- CLOSED PIPELINE LEADS -->
    <section class="space-y-4 border-t border-line/60 pt-8">
      <SectionHeader overline="Deals" title="Closed Pipeline Opportunities" hint="Leads marked as Won or Lost." />
      <div v-if="inactiveLeads.length" class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div v-for="lead in inactiveLeads" :key="lead.id"
          class="card p-5 bg-surface border border-line flex flex-col justify-between">
          <div>
            <div class="flex items-center justify-between mb-3">
              <span class="overline text-ink-3">{{ lead.clientName }}</span>
              <span class="text-[9px] uppercase font-bold tracking-overline px-2 py-0.5 rounded border"
                :class="lead.status === 'won' ? 'bg-pri-strategic-bg border-pri-strategic-bd text-pri-strategic' : 'bg-pri-backlog-bg border-pri-backlog-bd text-pri-backlog'">
                {{ lead.status }}
              </span>
            </div>
            <h4 class="font-serif text-lg font-bold text-ink">{{ lead.title }}</h4>
            <p v-if="lead.notes" class="text-xs text-ink-2 mt-1.5 line-clamp-2 leading-relaxed">{{ lead.notes }}</p>
          </div>

          <div class="mt-4 pt-3 border-t border-line/40 flex justify-between text-xs text-ink-3">
            <span>Invoiced Val: ₹{{ lead.estimatedValue.toLocaleString() }}</span>
            <span>Closed {{ dayjs(lead.updatedAt).format('MMM D, YYYY') }}</span>
          </div>
        </div>
      </div>
      <EmptyState v-else title="No closed pipeline records" hint="Opportunities will show here when updated to closed states." />
    </section>

  </div>
</template>
