<script setup>
import { ref, computed } from 'vue'
import { useGoalsStore } from '@/stores/goals'
import { useYearsStore } from '@/stores/years'
import { useProjectsStore } from '@/stores/projects'
import { useTasksStore } from '@/stores/tasks'
import { useUIStore } from '@/stores/ui'
import PageHeader from '@/components/PageHeader.vue'
import EmptyState from '@/components/EmptyState.vue'
import { Plus, X, Target, Trash2 } from 'lucide-vue-next'

const goals = useGoalsStore()
const years = useYearsStore()
const projects = useProjectsStore()
const tasks = useTasksStore()
const ui = useUIStore()

const showNew = ref(false)
const selectedGoal = ref(null)
const newTitle = ref(''); const newDesc = ref(''); const newYear = ref(null)

function projectCount(gid) { return projects.items.filter(p => p.goalId === gid && p.status !== 'archived').length }
function yearOf(yid) { return years.items.find(y => y.id === yid) }
function getGoalProjectsList(gid) { return projects.items.filter(p => p.goalId === gid && p.status !== 'archived') }
function getProjectProgress(proj) {
  const projTasks = tasks.items.filter(t => t.projectId === proj.id)
  const total = projTasks.length
  if (!total) return 0
  const done = projTasks.filter(t => t.status === 'done').length
  return Math.round((done / total) * 100)
}

async function create() {
  if (!newTitle.value.trim()) return
  await goals.add({ title: newTitle.value, description: newDesc.value, yearId: newYear.value })
  newTitle.value = ''; newDesc.value = ''; newYear.value = null; showNew.value = false
}
async function removeGoal(g) {
  if (!await ui.confirm({ message: `Delete goal "${g.title}"? Linked projects will remain.`, title: 'Delete Goal' })) return
  await goals.remove(g.id)
}
</script>

<template>
  <div class="px-8 md:px-12 py-10 max-w-7xl mx-auto" data-testid="goals-view">
    <PageHeader overline="Horizon" title="Goals" sub="The few large things this year is for.">
      <template #right><button class="btn-primary" @click="showNew = true" data-testid="new-goal-btn">
          <Plus class="w-4 h-4" /> New goal <span class="kbd ml-1.5 !bg-canvas/20 !border-canvas/10 !text-canvas select-none">⌘1</span>
        </button></template>
    </PageHeader>

    <div v-if="goals.items.length" class="space-y-4">
      <div v-for="g in goals.items" :key="g.id" @click="selectedGoal = g" class="card p-6 group relative cursor-pointer hover:border-line-2 transition-all duration-300" :data-testid="`goal-card-${g.id}`">
        <button @click.stop="removeGoal(g)"
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

    <!-- Goal Details Modal -->
    <div v-if="selectedGoal" class="fixed inset-0 z-50 flex items-start justify-center pt-24 px-4" data-testid="goal-detail-modal">
      <div class="fixed inset-0 bg-ink/40 backdrop-blur-sm" @click="selectedGoal = null"></div>
      <div class="relative w-full max-w-md card p-8 animate-rise-in shadow-2xl">
        <button type="button" class="absolute top-4 right-4 btn-ghost !p-1.5" @click="selectedGoal = null">
          <X class="w-4 h-4" />
        </button>
        <div class="flex items-center gap-2 text-ink-3 text-xs mb-2">
          <Target class="w-3.5 h-3.5" /><span class="overline">{{ yearOf(selectedGoal.yearId)?.year || '-' }}</span>
        </div>
        <h2 class="font-serif text-3xl text-ink font-medium leading-snug mb-4">{{ selectedGoal.title }}</h2>
        <div class="space-y-4">
          <div v-if="selectedGoal.description">
            <span class="overline text-[10px] text-ink-3 block mb-1">Why it matters</span>
            <p class="text-sm text-ink-2 whitespace-pre-wrap leading-relaxed">{{ selectedGoal.description }}</p>
          </div>
          <div>
            <span class="overline text-[10px] text-ink-3 block mb-2">Linked Projects</span>
            <div v-if="getGoalProjectsList(selectedGoal.id).length" class="space-y-3">
              <div v-for="proj in getGoalProjectsList(selectedGoal.id)" :key="proj.id" class="p-3 bg-canvas/40 rounded-xl border border-line flex flex-col gap-2">
                <div class="flex items-center justify-between gap-3">
                  <RouterLink :to="'/projects/' + proj.id" class="font-serif text-base font-semibold text-ink hover:text-ink-2 hover:underline min-w-0 truncate">
                    {{ proj.title }}
                  </RouterLink>
                  <span class="text-[10px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded border border-line bg-surface text-ink-3">
                    {{ proj.status }}
                  </span>
                </div>
                <div class="flex items-center gap-2">
                  <div class="flex-1 h-1.5 rounded-full bg-elevated overflow-hidden">
                    <div class="h-full bg-ink rounded-full transition-all duration-500" :style="{ width: getProjectProgress(proj) + '%' }"></div>
                  </div>
                  <span class="text-xs font-mono text-ink-2">{{ getProjectProgress(proj) }}%</span>
                </div>
              </div>
            </div>
            <p v-else class="text-sm text-ink-3 italic">No projects linked to this goal yet.</p>
          </div>
        </div>
        <div class="flex justify-end mt-6">
          <button class="btn-ghost" @click="selectedGoal = null">Close</button>
        </div>
      </div>
    </div>
  </div>
</template>
