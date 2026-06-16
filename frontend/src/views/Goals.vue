<script setup>
import { ref, computed, watch, nextTick } from 'vue'
import { useGoalsStore } from '@/stores/goals'
import { useYearsStore } from '@/stores/years'
import { useProjectsStore } from '@/stores/projects'
import { useTasksStore } from '@/stores/tasks'
import { useUIStore } from '@/stores/ui'
import PageHeader from '@/components/PageHeader.vue'
import EmptyState from '@/components/EmptyState.vue'
import { Plus, X, Target, Trash2, Folder, CheckSquare, Check } from 'lucide-vue-next'

const goals = useGoalsStore()
const years = useYearsStore()
const projects = useProjectsStore()
const tasks = useTasksStore()
const ui = useUIStore()

const showNew = ref(false)
const selectedGoal = ref(null)

// Creation form states
const newTitle = ref('')
const newDesc = ref('')
const newYearIds = ref([])
const showCreateYearDropdown = ref(false)
const newYearsLabel = computed(() => {
  if (newYearIds.value.length === 0) return 'Select Years...'
  const selectedYearsList = newYearIds.value
    .map(id => years.items.find(y => y.id === id))
    .filter(Boolean)
    .map(y => y.year)
  if (selectedYearsList.length === years.items.length && years.items.length > 0) return 'All Years'
  return selectedYearsList.join(', ')
})

function toggleNewYear(yid) {
  if (newYearIds.value.includes(yid)) {
    newYearIds.value = newYearIds.value.filter(id => id !== yid)
  } else {
    newYearIds.value.push(yid)
  }
}

// Edit/Detail form states
const editTitle = ref('')
const editDesc = ref('')
const editYearIds = ref([])
const editUseNumeric = ref(false)
const editTargetNumber = ref(0)
const editAchievedNumber = ref(0)
const newTaskTitle = ref('')

function openDetails(g) {
  selectedGoal.value = g
  editTitle.value = g.title || ''
  editDesc.value = g.description || ''
  editYearIds.value = g.yearIds || (g.yearId ? [g.yearId] : [])
  editUseNumeric.value = g.useNumeric || false
  editTargetNumber.value = g.targetNumber || 0
  editAchievedNumber.value = g.achievedNumber || 0
  newTaskTitle.value = ''
}

function toggleEditYear(yid) {
  if (editYearIds.value.includes(yid)) {
    editYearIds.value = editYearIds.value.filter(id => id !== yid)
  } else {
    editYearIds.value.push(yid)
  }
}

const showEditYearDropdown = ref(false)
const editYearsLabel = computed(() => {
  if (editYearIds.value.length === 0) return 'Select Years...'
  const selectedYearsList = editYearIds.value
    .map(id => years.items.find(y => y.id === id))
    .filter(Boolean)
    .map(y => y.year)
  if (selectedYearsList.length === years.items.length && years.items.length > 0) return 'All Years'
  return selectedYearsList.join(', ')
})

function projectCount(gid) {
  return projects.items.filter(p => p.goalId === gid && p.status !== 'archived').length
}

function yearsOf(g) {
  const ids = g.yearIds || (g.yearId ? [g.yearId] : [])
  return ids.map(id => years.items.find(y => y.id === id)).filter(Boolean)
}

function getGoalProjectsList(gid) {
  return projects.items.filter(p => p.goalId === gid && p.status !== 'archived')
}

function getProjectProgress(proj) {
  const projTasks = tasks.items.filter(t => t.projectId === proj.id)
  const total = projTasks.length
  if (!total) return 0
  const done = projTasks.filter(t => t.status === 'done').length
  return Math.round((done / total) * 100)
}

const goalTasksList = computed(() => {
  if (!selectedGoal.value) return []
  const goalProjIds = projects.items.filter(p => p.goalId === selectedGoal.value.id && p.status !== 'archived').map(p => p.id)
  return tasks.items.filter(t => t.goalId === selectedGoal.value.id || (t.projectId && goalProjIds.includes(t.projectId)))
})

// Progress percentage calculations
function getGoalProgress(g) {
  if (g.useNumeric) {
    if (!g.targetNumber) return 0
    return Math.min(100, Math.round(((g.achievedNumber || 0) / g.targetNumber) * 100))
  }
  const goalProjIds = projects.items.filter(p => p.goalId === g.id && p.status !== 'archived').map(p => p.id)
  const goalTasks = tasks.items.filter(t => t.goalId === g.id || (t.projectId && goalProjIds.includes(t.projectId)))
  const total = goalTasks.length
  if (total > 0) {
    const done = goalTasks.filter(t => t.status === 'done').length
    return Math.round((done / total) * 100)
  }
  const projs = projects.items.filter(p => p.goalId === g.id && p.status !== 'archived')
  if (projs.length > 0) {
    const sum = projs.reduce((s, p) => s + getProjectProgress(p), 0)
    return Math.round(sum / projs.length)
  }
  return 0
}

const tempCalculatedProgress = computed(() => {
  if (editUseNumeric.value) {
    if (!editTargetNumber.value) return 0
    return Math.min(100, Math.round((editAchievedNumber.value / editTargetNumber.value) * 100))
  }
  if (!selectedGoal.value) return 0
  const goalProjIds = projects.items.filter(p => p.goalId === selectedGoal.value.id && p.status !== 'archived').map(p => p.id)
  const goalTasks = tasks.items.filter(t => t.goalId === selectedGoal.value.id || (t.projectId && goalProjIds.includes(t.projectId)))
  const total = goalTasks.length
  if (total > 0) {
    const done = goalTasks.filter(t => t.status === 'done').length
    return Math.round((done / total) * 100)
  }
  const projs = projects.items.filter(p => p.goalId === selectedGoal.value.id && p.status !== 'archived')
  if (projs.length > 0) {
    const sum = projs.reduce((s, p) => s + getProjectProgress(p), 0)
    return Math.round(sum / projs.length)
  }
  return 0
})

async function create() {
  if (!newTitle.value.trim()) return
  await goals.add({
    title: newTitle.value,
    description: newDesc.value,
    yearIds: newYearIds.value,
    yearId: newYearIds.value[0] || null
  })
  newTitle.value = ''; newDesc.value = ''; newYearIds.value = []; showNew.value = false
}

async function saveGoalEdits() {
  if (!selectedGoal.value) return
  await goals.update(selectedGoal.value.id, {
    title: editTitle.value.trim() || 'Untitled goal',
    description: editDesc.value,
    yearIds: editYearIds.value,
    yearId: editYearIds.value[0] || null,
    useNumeric: editUseNumeric.value,
    targetNumber: Number(editTargetNumber.value) || 0,
    achievedNumber: Number(editAchievedNumber.value) || 0
  })
  selectedGoal.value = goals.items.find(x => x.id === selectedGoal.value.id)
  ui.showToast('Goal updated', 'success')
}

async function addTaskToGoal() {
  if (!newTaskTitle.value.trim() || !selectedGoal.value) return
  await tasks.add({
    title: newTaskTitle.value.trim(),
    goalId: selectedGoal.value.id
  })
  newTaskTitle.value = ''
  ui.showToast('Task added to goal', 'success')
}

async function removeGoal(g) {
  if (!await ui.confirm({ message: `Delete goal "${g.title}"? Linked projects will remain.`, title: 'Delete Goal' })) return
  await goals.remove(g.id)
}

const newTitleInput = ref(null)
const editTitleInput = ref(null)

watch(showNew, (open) => {
  if (open) {
    nextTick(() => {
      newTitleInput.value?.focus()
    })
  }
})

watch(selectedGoal, (goal) => {
  if (goal) {
    nextTick(() => {
      editTitleInput.value?.focus()
    })
  }
})
</script>

<template>
  <div class="px-8 md:px-12 py-10 max-w-7xl mx-auto" data-testid="goals-view">
    <PageHeader overline="Horizon" title="Goals" sub="The few large things this year is for.">
      <template #right>
        <button class="btn-primary" @click="showNew = true" data-testid="new-goal-btn">
          <Plus class="w-4 h-4" /> New goal <span class="kbd ml-1.5 !bg-canvas/20 !border-canvas/10 !text-canvas select-none">⌘1</span>
        </button>
      </template>
    </PageHeader>

    <div v-if="goals.items.length" class="space-y-4">
      <div v-for="g in goals.items" :key="g.id" @click="openDetails(g)"
        class="card p-6 group cursor-pointer hover:border-line-2 transition-all duration-300"
        :data-testid="`goal-card-${g.id}`">
        <div class="flex items-start justify-between gap-4">
          <div class="flex-1 min-w-0 pr-4">
            <div class="flex items-center gap-2 text-ink-3 text-xs">
              <Target class="w-3 h-3" />
              <span class="overline">{{ yearsOf(g).map(y => y.year).join(', ') || '-' }}</span>
            </div>
            <div class="font-serif text-2xl mt-1.5 truncate">{{ g.title }}</div>
            <p v-if="g.description" class="text-ink-2 mt-2 line-clamp-2 leading-relaxed">{{ g.description }}</p>
          </div>
          <div class="flex items-center gap-4 shrink-0 self-center">
            <div class="text-right">
              <div class="overline text-[10px] text-ink-3">Projects</div>
              <div class="font-serif text-2xl mt-0.5">{{ projectCount(g.id) }}</div>
            </div>
            <div v-if="g.useNumeric" class="text-right border-l border-line/30 pl-4">
              <div class="overline text-[10px] text-ink-3">Progress</div>
              <div class="font-serif text-2xl mt-0.5 text-pri-strategic">{{ getGoalProgress(g) }}%</div>
            </div>
            <div v-else-if="projectCount(g.id) > 0" class="text-right border-l border-line/30 pl-4">
              <div class="overline text-[10px] text-ink-3">Progress</div>
              <div class="font-serif text-2xl mt-0.5 text-ink-2">{{ getGoalProgress(g) }}%</div>
            </div>
            <button @click.stop="removeGoal(g)"
              class="btn-ghost !p-1.5 opacity-0 group-hover:opacity-100 hover:text-pri-critical transition-opacity duration-200"
              :data-testid="`goal-delete-${g.id}`" :title="`Delete goal`">
              <Trash2 class="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
    <EmptyState v-else title="No goals yet" hint="A goal can be a quiet promise." />

    <!-- Create Goal Modal -->
    <div v-if="showNew" @keydown.window.esc="showNew = false" class="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div class="fixed inset-0 bg-ink/40 backdrop-blur-sm animate-fade-in" @click="showNew = false"></div>
      <form @submit.prevent="create" @keydown.meta.enter.prevent="create" @keydown.ctrl.enter.prevent="create" class="relative w-full max-w-md card p-8 animate-rise-in">
        <button type="button" class="absolute top-4 right-4 btn-ghost !p-1.5" @click="showNew = false">
          <X class="w-4 h-4" />
        </button>
        <div class="overline">New goal</div>
        <h2 class="font-serif text-2xl mt-1 mb-5">Something worth pursuing</h2>
        
        <div class="v-field-group mb-4">
          <input ref="newTitleInput" v-model="newTitle" placeholder=" " class="v-field-input text-base font-semibold" id="new-goal-title" required data-testid="new-goal-title" />
          <label for="new-goal-title" class="v-field-label text-sm">Goal Title *</label>
        </div>

        <div class="v-field-group mb-4">
          <textarea v-model="newDesc" placeholder=" " rows="2" class="v-field-input py-3 resize-none font-sans text-xs leading-relaxed" id="new-goal-desc" />
          <label for="new-goal-desc" class="v-field-label text-sm">Why it matters (optional)</label>
        </div>
        
        <div class="v-field-group relative mb-6">
          <button type="button" @click.stop="showCreateYearDropdown = !showCreateYearDropdown"
            class="w-full text-left text-sm bg-surface border border-line rounded-xl px-4 py-3 min-h-[48px] text-ink flex items-center justify-between focus:outline-none focus:border-pri-strategic transition-all cursor-pointer">
            <span class="truncate text-xs font-semibold text-ink-2">{{ newYearsLabel }}</span>
            <span class="text-ink-3 text-[8px] pointer-events-none">▼</span>
          </button>
          
          <label class="v-field-label v-field-label--floating v-field-label--floating-focused"
            style="background-color: rgb(var(--surface)); z-index: 10; padding: 0 4px;">Years Assigned</label>

          <div v-if="showCreateYearDropdown" class="fixed inset-0 z-40" @click.stop="showCreateYearDropdown = false"></div>
          <div v-if="showCreateYearDropdown"
            class="absolute left-0 right-0 top-full mt-1 w-full bg-surface border border-line rounded-xl shadow-lg z-50 p-2 space-y-1 animate-fade-in max-h-48 overflow-y-auto">
            <label v-for="y in years.items" :key="y.id"
              class="flex items-center gap-2 px-2.5 py-1.5 hover:bg-canvas/50 rounded-lg cursor-pointer text-xs text-ink select-none">
              <input type="checkbox" :checked="newYearIds.includes(y.id)" @change="toggleNewYear(y.id)"
                class="rounded border-line text-ink focus:ring-ink/20 cursor-pointer" />
              <span>{{ y.year }} - {{ y.theme }}</span>
            </label>
            <div v-if="!years.items.length" class="text-xs text-ink-3 italic p-2 text-center">
              No years created yet.
            </div>
          </div>
        </div>

        <div class="flex justify-end gap-2">
          <button type="button" class="btn-ghost" @click="showNew = false">Cancel</button>
          <button type="submit" class="btn-primary" data-testid="new-goal-save">
            Create <span class="kbd !bg-canvas/20 !border-canvas/10 !text-canvas select-none text-[9px] ml-1">⌘Enter</span>
          </button>
        </div>
      </form>
    </div>

    <!-- Goal Details Modal (Wider split layout) -->
    <div v-if="selectedGoal" @keydown.window.esc="selectedGoal = null" class="fixed inset-0 z-50 flex items-center justify-center p-4"
      data-testid="goal-detail-modal">
      <div class="fixed inset-0 bg-ink/40 backdrop-blur-sm animate-fade-in" @click="selectedGoal = null"></div>
      <div class="relative w-full max-w-5xl card p-8 animate-rise-in shadow-2xl bg-surface"
        @keydown.meta.enter.prevent="saveGoalEdits" @keydown.ctrl.enter.prevent="saveGoalEdits">
        <button type="button" class="absolute top-4 right-4 btn-ghost !p-1.5" @click="selectedGoal = null">
          <X class="w-4 h-4" />
        </button>

        <div class="grid grid-cols-1 md:grid-cols-5 gap-10">
          <!-- Left Column: Goal parameters -->
          <div class="md:col-span-3 space-y-6">
            <div>
              <span class="overline text-[10px] text-ink-3 block mb-1">Goal details</span>
              <input ref="editTitleInput" v-model="editTitle" placeholder="Title..." class="input-soft text-2xl font-serif font-semibold text-ink" />
            </div>

            <div>
              <span class="overline text-[10px] text-ink-3 block mb-1">Why it matters</span>
              <textarea v-model="editDesc" placeholder="Why it matters..." rows="5" class="input-soft text-sm resize-none text-ink-2" />
            </div>

            <div class="relative">
              <span class="overline text-[10px] text-ink-3 block mb-2">Years Assigned</span>
              <button type="button" @click.stop="showEditYearDropdown = !showEditYearDropdown"
                class="input-soft text-left text-xs text-ink-2 font-semibold flex items-center justify-between w-full focus:outline-none hover:bg-canvas/60 transition-all cursor-pointer">
                <span class="truncate">{{ editYearsLabel }}</span>
                <span class="text-[8px] text-ink-3">▼</span>
              </button>
              <div v-if="showEditYearDropdown" class="fixed inset-0 z-40" @click.stop="showEditYearDropdown = false"></div>
              <div v-if="showEditYearDropdown"
                class="absolute left-0 right-0 top-full mt-1 w-full bg-surface border border-line rounded-xl shadow-lg z-50 p-2 space-y-1 animate-fade-in max-h-48 overflow-y-auto">
                <label v-for="y in years.items" :key="y.id"
                  class="flex items-center gap-2 px-2.5 py-1.5 hover:bg-canvas/50 rounded-lg cursor-pointer text-xs text-ink select-none">
                  <input type="checkbox" :checked="editYearIds.includes(y.id)" @change="toggleEditYear(y.id)"
                    class="rounded border-line text-ink focus:ring-ink/20 cursor-pointer" />
                  <span>{{ y.year }} - {{ y.theme }}</span>
                </label>
                <div v-if="!years.items.length" class="text-xs text-ink-3 italic p-2 text-center">
                  No years created yet.
                </div>
              </div>
            </div>

            <!-- Numeric progress tracking -->
            <div class="space-y-3 pt-2">
              <div class="flex items-center justify-between">
                <span class="text-xs uppercase tracking-wider text-ink-3 font-semibold font-mono">Numeric tracking</span>
                <button type="button"
                  class="w-10 h-6 rounded-full p-1 transition-colors duration-200 focus:outline-none"
                  :class="editUseNumeric ? 'bg-ink' : 'bg-line'"
                  @click="editUseNumeric = !editUseNumeric">
                  <div class="bg-canvas w-4 h-4 rounded-full shadow-md transform transition-transform duration-200"
                    :class="editUseNumeric ? 'translate-x-4' : 'translate-x-0'"></div>
                </button>
              </div>

              <div v-if="editUseNumeric" class="grid grid-cols-2 gap-3 p-3 bg-canvas/30 rounded-xl border border-line/50">
                <div>
                  <label class="overline text-[9px] text-ink-3 block mb-1">Target Number</label>
                  <input type="number" v-model="editTargetNumber" class="input-soft !text-sm" placeholder="e.g. 100" />
                </div>
                <div>
                  <label class="overline text-[9px] text-ink-3 block mb-1">Achieved Number</label>
                  <input type="number" v-model="editAchievedNumber" class="input-soft !text-sm" placeholder="e.g. 45" />
                </div>
              </div>
            </div>

            <div class="flex items-center justify-between border-t border-line/40 pt-4">
              <div class="flex flex-col">
                <span class="overline text-[9px] text-ink-3">Current Progress</span>
                <span class="font-serif text-2xl font-bold mt-0.5 text-pri-strategic">{{ tempCalculatedProgress }}%</span>
              </div>
              <button class="btn-primary !text-xs !py-2 !px-4" @click="saveGoalEdits">
                Save changes <span class="kbd !bg-canvas/20 !border-canvas/10 !text-canvas select-none text-[9px] ml-1">⌘Enter</span>
              </button>
            </div>
          </div>

          <!-- Right Column: Associations -->
          <div class="md:col-span-2 space-y-6 md:border-l md:border-line/40 md:pl-8">
            <!-- Linked Projects -->
            <div>
              <div class="flex items-center gap-1.5 mb-2">
                <Folder class="w-3.5 h-3.5 text-ink-3" />
                <span class="overline text-[10px] text-ink-3">Linked Projects</span>
              </div>
              <div v-if="getGoalProjectsList(selectedGoal.id).length" class="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                <div v-for="proj in getGoalProjectsList(selectedGoal.id)" :key="proj.id"
                  class="p-2.5 bg-canvas/40 rounded-xl border border-line/50 flex flex-col gap-1.5">
                  <div class="flex items-center justify-between gap-2">
                    <RouterLink :to="'/projects/' + proj.id" @click="selectedGoal = null"
                      class="font-serif text-sm font-semibold text-ink hover:text-ink-2 hover:underline min-w-0 truncate">
                      {{ proj.title }}
                    </RouterLink>
                    <span class="text-[9px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded border border-line bg-surface text-ink-3">
                      {{ proj.status }}
                    </span>
                  </div>
                  <div class="flex items-center gap-2">
                    <div class="flex-1 h-1 rounded-full bg-elevated overflow-hidden">
                      <div class="h-full bg-ink rounded-full" :style="{ width: getProjectProgress(proj) + '%' }"></div>
                    </div>
                    <span class="text-[10px] font-mono text-ink-2">{{ getProjectProgress(proj) }}%</span>
                  </div>
                </div>
              </div>
              <p v-else class="text-xs text-ink-3 italic">No linked projects.</p>
            </div>

            <!-- Linked Tasks -->
            <div class="space-y-3">
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-1.5">
                  <CheckSquare class="w-3.5 h-3.5 text-ink-3" />
                  <span class="overline text-[10px] text-ink-3">Linked Tasks</span>
                </div>
                <span class="text-[10px] text-ink-3 font-mono">({{ goalTasksList.length }})</span>
              </div>

              <!-- Tasks List -->
              <div v-if="goalTasksList.length" class="space-y-1.5 max-h-[280px] overflow-y-auto pr-1">
                <div v-for="t in goalTasksList" :key="t.id"
                  class="flex items-center justify-between gap-3 p-2 bg-canvas/30 border border-line/40 rounded-xl hover:bg-canvas/50 transition-colors">
                  <div class="flex items-center gap-2 min-w-0">
                    <button @click="tasks.toggleComplete(t.id)"
                      class="w-4 h-4 rounded border flex items-center justify-center shrink-0 cursor-pointer transition-colors"
                      :class="t.status === 'done' ? 'bg-ink border-ink' : 'border-line hover:border-ink'">
                      <svg v-if="t.status === 'done'" class="w-2.5 h-2.5 text-canvas" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="4">
                        <path d="M5 13l4 4L19 7" />
                      </svg>
                    </button>
                    <span @click="ui.openTaskEdit(t)"
                      class="text-xs truncate cursor-pointer hover:underline"
                      :class="t.status === 'done' ? 'line-through text-ink-3' : 'text-ink-2 hover:text-ink'">
                      {{ t.title }}
                    </span>
                  </div>
                  <span v-if="t.projectId" class="text-[8px] uppercase tracking-wider font-semibold text-ink-3 px-1.5 py-0.5 bg-elevated rounded border border-line shrink-0 max-w-[80px] truncate"
                    :title="projects.items.find(p => p.id === t.projectId)?.title">
                    {{ projects.items.find(p => p.id === t.projectId)?.title }}
                  </span>
                </div>
              </div>
              <p v-else class="text-xs text-ink-3 italic">No linked tasks.</p>

              <!-- Quick Add Task -->
              <form @submit.prevent="addTaskToGoal" class="flex gap-2 pt-1">
                <input v-model="newTaskTitle" placeholder="Add task directly..." class="input-soft !text-xs py-1.5 flex-1" required />
                <button type="submit" class="btn-primary !text-[11px] !py-1 !px-2.5 shrink-0">Add</button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
