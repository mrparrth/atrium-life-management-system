<script setup>
import { ref, computed } from 'vue'
import { useGoalsStore } from '@/stores/goals'
import { useYearsStore } from '@/stores/years'
import { useProjectsStore } from '@/stores/projects'
import { useUIStore } from '@/stores/ui'
import PageHeader from '@/components/PageHeader.vue'
import EmptyState from '@/components/EmptyState.vue'
import { Plus, X, Target, Trash2 } from 'lucide-vue-next'

const goals = useGoalsStore()
const years = useYearsStore()
const projects = useProjectsStore()
const ui = useUIStore()

const showNew = ref(false)
const newTitle = ref(''); const newDesc = ref(''); const newYear = ref(null)

function projectCount(gid) { return projects.items.filter(p => p.goalId === gid && p.status !== 'archived').length }
function yearOf(yid) { return years.items.find(y => y.id === yid) }

async function create() {
  if (!newTitle.value.trim()) return
  await goals.add({ title: newTitle.value, description: newDesc.value, yearId: newYear.value || years.items[0]?.id })
  newTitle.value = ''; newDesc.value = ''; newYear.value = null; showNew.value = false
}
async function removeGoal(g) {
  if (!await ui.confirm({ message: `Delete goal "${g.title}"? Linked projects will remain.`, title: 'Delete Goal' })) return
  await goals.remove(g.id)
}
</script>

<template>
  <div class="px-8 md:px-12 py-10 max-w-5xl mx-auto" data-testid="goals-view">
    <PageHeader overline="Horizon" title="Goals" sub="The few large things this year is for.">
      <template #right><button class="btn-primary" @click="showNew = true" data-testid="new-goal-btn">
          <Plus class="w-4 h-4" /> New goal
        </button></template>
    </PageHeader>

    <div v-if="goals.items.length" class="space-y-4">
      <div v-for="g in goals.items" :key="g.id" class="card p-6 group relative" :data-testid="`goal-card-${g.id}`">
        <button @click="removeGoal(g)"
          class="absolute top-4 right-4 btn-ghost !p-1.5 opacity-0 group-hover:opacity-100 hover:text-pri-critical"
          :data-testid="`goal-delete-${g.id}`" :title="`Delete goal`">
          <Trash2 class="w-4 h-4" />
        </button>
        <div class="flex items-start justify-between gap-4">
          <div class="flex-1 pr-8">
            <div class="flex items-center gap-2 text-ink-3 text-xs">
              <Target class="w-3 h-3" /><span class="overline">{{ yearOf(g.yearId)?.year || '-' }}</span>
            </div>
            <div class="font-serif text-2xl mt-1.5">{{ g.title }}</div>
            <p v-if="g.description" class="text-ink-2 mt-2">{{ g.description }}</p>
          </div>
          <div class="text-right">
            <div class="overline">Projects</div>
            <div class="font-serif text-2xl">{{ projectCount(g.id) }}</div>
          </div>
        </div>
      </div>
    </div>
    <EmptyState v-else title="No goals yet" hint="A goal can be a quiet promise." />

    <div v-if="showNew" class="fixed inset-0 z-50 flex items-start justify-center pt-24 px-4">
      <div class="fixed inset-0 bg-ink/40 backdrop-blur-sm" @click="showNew = false"></div>
      <form @submit.prevent="create" class="relative w-full max-w-md card p-8 animate-rise-in">
        <button type="button" class="absolute top-4 right-4 btn-ghost !p-1.5" @click="showNew = false">
          <X class="w-4 h-4" />
        </button>
        <div class="overline">New goal</div>
        <h2 class="font-serif text-2xl mt-1 mb-5">Something worth pursuing</h2>
        <input v-model="newTitle" placeholder="Goal title…" class="input-soft text-lg font-serif mb-3" required
          data-testid="new-goal-title" />
        <textarea v-model="newDesc" placeholder="Why it matters…" rows="2" class="input-soft resize-none mb-3" />
        <label class="block mb-5">
          <span class="overline block mb-1">Year</span>
          <select v-model="newYear" class="input-block text-sm">
            <option :value="null">-</option>
            <option v-for="y in years.items" :key="y.id" :value="y.id">{{ y.year }} - {{ y.theme }}</option>
          </select>
        </label>
        <div class="flex justify-end gap-2">
          <button type="button" class="btn-ghost" @click="showNew = false">Cancel</button>
          <button type="submit" class="btn-primary" data-testid="new-goal-save">Create</button>
        </div>
      </form>
    </div>
  </div>
</template>
