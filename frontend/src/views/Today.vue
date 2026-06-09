<script setup>
import { computed } from 'vue'
import dayjs from 'dayjs'
import { useTasksStore } from '@/stores/tasks'
import { todayFocus } from '@/lib/resurface'
import PageHeader from '@/components/PageHeader.vue'
import TaskCard from '@/components/TaskCard.vue'
import EmptyState from '@/components/EmptyState.vue'
import { useUIStore } from '@/stores/ui'
import { Plus } from 'lucide-vue-next'

const tasks = useTasksStore()
const ui = useUIStore()
const list = computed(() => todayFocus(tasks.items))
const today = computed(() => dayjs().format('dddd, MMMM D'))
</script>

<template>
  <div class="px-8 md:px-12 py-10 max-w-3xl mx-auto" data-testid="today-view">
    <PageHeader :overline="today" title="Today focus" sub="A few quiet things to attend to.">
      <template #right>
        <button class="btn-primary" @click="ui.openQuickCapture" data-testid="today-capture">
          <Plus class="w-4 h-4" /> Capture
        </button>
      </template>
    </PageHeader>
    <div v-if="list.length" class="space-y-3">
      <TaskCard v-for="t in list" :key="t.id" :task="t" />
    </div>
    <EmptyState v-else title="An open day" hint="Nothing scheduled. Let it be - or capture something gentle." />
  </div>
</template>
