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
import WorkItemPopup from '@/components/work/WorkItemPopup.vue'
import { Plus } from 'lucide-vue-next'

const route = useRoute()
const router = useRouter()

const itemsStore = useWorkItemsStore()
const clientsStore = useWorkClientsStore()
const ui = useUIStore()

const activeTab = ref('active') // active, completed
const showAddDrawer = ref(false)
const prefillTitle = ref('')

// Group active items by status
const groupedActiveItems = computed(() => {
  const list = itemsStore.items.filter(item => {
    if (itemsStore.isCompleted(item.status)) return false
    if (item.snoozedUntil) {
      const until = new Date(item.snoozedUntil); until.setHours(0, 0, 0, 0)
      const now = new Date(); now.setHours(0, 0, 0, 0)
      if (until > now) return false
    }
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
    prefillTitle.value = route.query.prefillTitle ? String(route.query.prefillTitle) : ''
    showAddDrawer.value = true
  }
}, { immediate: true })

watch(showAddDrawer, (isOpen) => {
  if (!isOpen && route.query.new === 'true') {
    router.replace({ query: { ...route.query, new: undefined, prefillTitle: undefined } })
  }
  if (!isOpen) {
    prefillTitle.value = ''
  }
})

function handleEscKey(e) {
  if ((e.metaKey || e.ctrlKey) && e.key === '1') {
    if (!showAddDrawer.value) {
      e.preventDefault()
      showAddDrawer.value = true
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
    <WorkItemPopup v-if="showAddDrawer" :prefillTitle="prefillTitle" @close="showAddDrawer = false" />



  </div>
</template>
