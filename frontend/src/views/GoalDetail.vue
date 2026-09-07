<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useGoalsStore } from '@/stores/goals'
import { useYearsStore } from '@/stores/years'
import { useProjectsStore } from '@/stores/projects'
import { useTasksStore } from '@/stores/tasks'
import { useUIStore } from '@/stores/ui'
import PageHeader from '@/components/PageHeader.vue'
import SectionHeader from '@/components/SectionHeader.vue'
import EmptyState from '@/components/EmptyState.vue'
import TaskCard from '@/components/TaskCard.vue'
import VInput from '@/components/VInput.vue'
import VTextarea from '@/components/VTextarea.vue'
import VSelect from '@/components/VSelect.vue'
import DateField from '@/components/DateField.vue'
import VUrlInput from '@/components/VUrlInput.vue'
import { ArrowLeft, Trash2, Edit2, X, Check } from 'lucide-vue-next'
import { formatDate, isOverdue } from '@/lib/date'

const props = defineProps({
  id: {
    type: String,
    required: true
  }
})

const route = useRoute()
const router = useRouter()
const goals = useGoalsStore()
const years = useYearsStore()
const projects = useProjectsStore()
const tasks = useTasksStore()
const ui = useUIStore()

const goal = computed(() => goals.items.find(g => g.id === props.id))
const activeTab = ref('summary')

const TABS = ['summary', 'projects', 'tasks']

function handleKeydown(e) {
  const targetTag = e.target?.tagName?.toLowerCase()
  if (targetTag === 'input' || targetTag === 'textarea' || e.target?.isContentEditable) {
    return
  }

  // Alt+1-3 → switch tabs (use e.code for macOS compatibility — e.key gives ¡™£ etc.)
  if (e.altKey && !e.metaKey && !e.ctrlKey && e.code?.startsWith('Digit')) {
    const idx = parseInt(e.code.replace('Digit', '')) - 1
    if (idx >= 0 && idx < TABS.length) {
      e.preventDefault()
      activeTab.value = TABS[idx]
      return
    }
  }

  // Alt+ArrowUp/Down → switch tabs
  if (e.altKey && !e.metaKey && !e.ctrlKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
    const currentIdx = TABS.indexOf(activeTab.value)
    if (currentIdx !== -1) {
      e.preventDefault()
      const step = e.key === 'ArrowUp' ? -1 : 1
      const nextIdx = (currentIdx + step + TABS.length) % TABS.length
      activeTab.value = TABS[nextIdx]
      return
    }
  }
}

// Live Form Reactive State
const formTitle = ref('')
const formDescription = ref('')
const formImageUrl = ref('')
const formStartDate = ref('')
const formTargetDate = ref('')
const formYearIds = ref([])
const formUseNumeric = ref(false)
const formTargetNumber = ref(100)
const formAchievedNumber = ref(0)
const formUnit = ref('')

function syncForm() {
  if (!goal.value) return
  formTitle.value = goal.value.title || ''
  formDescription.value = goal.value.description || ''
  formImageUrl.value = goal.value.imageUrl || ''
  formStartDate.value = goal.value.startDate || ''
  formTargetDate.value = goal.value.targetDate || ''
  formYearIds.value = goal.value.yearIds || (goal.value.yearId ? [goal.value.yearId] : [])
  formUseNumeric.value = goal.value.useNumeric || false
  formTargetNumber.value = goal.value.targetNumber || 100
  formAchievedNumber.value = goal.value.achievedNumber || 0
  formUnit.value = goal.value.unit || ''
}

onMounted(async () => {
  window.addEventListener('keydown', handleKeydown)
  await Promise.all([
    goals.load(),
    years.load(),
    projects.load(),
    tasks.load()
  ])
  if (goal.value) {
    goals.markViewed(goal.value.id)
    syncForm()
  }
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown)
})

watch(() => props.id, (newId) => {
  if (newId) {
    goals.markViewed(newId)
    syncForm()
  }
})

watch(() => goal.value, (newGoal) => {
  if (newGoal) {
    syncForm()
  }
}, { deep: true })

// Live Computed Progress
const computedProgress = computed(() => {
  if (formUseNumeric.value) {
    if (!formTargetNumber.value || formTargetNumber.value === 0) return 0
    const pct = (formAchievedNumber.value / formTargetNumber.value) * 100
    return Math.min(Math.round(pct), 100)
  }
  return Number(formAchievedNumber.value) || 0
})

// Auto-Save helper for any field patch
async function autoSaveField(patch) {
  if (!goal.value) return
  await goals.update(goal.value.id, patch)
}

function handleTitleBlur() {
  if (!formTitle.value.trim()) {
    formTitle.value = goal.value?.title || 'Untitled goal'
    return
  }
  autoSaveField({ title: formTitle.value.trim() })
}

function handleDescriptionBlur() {
  autoSaveField({ description: formDescription.value })
}

function handleImageUrlBlur() {
  autoSaveField({ imageUrl: formImageUrl.value })
}

function handleStartDateChange(val) {
  formStartDate.value = val || ''
  autoSaveField({ startDate: formStartDate.value })
}

function handleTargetDateChange(val) {
  formTargetDate.value = val || ''
  autoSaveField({ targetDate: formTargetDate.value })
}

function handleYearsChange(val) {
  const ids = Array.isArray(val) ? val : []
  formYearIds.value = ids
  autoSaveField({
    yearIds: ids,
    yearId: ids[0] || null
  })
}

function toggleTrackingMode(useNum) {
  formUseNumeric.value = useNum
  if (useNum && (!formTargetNumber.value || formTargetNumber.value === 0)) {
    formTargetNumber.value = 100
  }
  autoSaveProgressSettings()
}

function autoSaveProgressSettings() {
  autoSaveField({
    useNumeric: formUseNumeric.value,
    targetNumber: formUseNumeric.value ? (Number(formTargetNumber.value) || 0) : 100,
    achievedNumber: Number(formAchievedNumber.value) || 0,
    unit: formUseNumeric.value ? formUnit.value : '%'
  })
}

// Linked Projects & Tasks
const linkedProjects = computed(() => {
  if (!goal.value) return []
  return projects.items.filter(p => p.goalId === goal.value.id && p.status !== 'archived')
})

const linkedTasks = computed(() => {
  if (!goal.value) return []
  const projIds = linkedProjects.value.map(p => p.id)
  return tasks.items.filter(t => t.goalId === goal.value.id || (t.projectId && projIds.includes(t.projectId)))
})

const openTasks = computed(() => linkedTasks.value.filter(t => t.status !== 'done'))
const doneTasks = computed(() => linkedTasks.value.filter(t => t.status === 'done'))

const formattedYears = computed(() => years.items.map(y => ({ id: y.id, label: `${y.year} - ${y.theme}` })))

async function removeGoal() {
  if (!goal.value) return
  if (await ui.confirm({ message: 'Delete this goal? All linkages will remain but lose their goal association.', title: 'Delete Goal' })) {
    await goals.remove(goal.value.id)
    router.push('/goals')
    ui.showToast('Goal deleted', 'success')
  }
}

// Banner position dragging logic
let dragStartPercent = 50
let dragStartY = 0
let isDragging = ref(false)

function startDrag(e) {
  if (!goal.value) return
  isDragging.value = true
  dragStartY = e.clientY || (e.touches && e.touches[0].clientY)
  dragStartPercent = goal.value.imagePositionY || 50

  window.addEventListener('mousemove', handleMove)
  window.addEventListener('mouseup', handleUp)
  window.addEventListener('touchmove', handleMove)
  window.addEventListener('touchend', handleUp)
}

function handleMove(e) {
  if (!isDragging.value || !goal.value) return
  const currentY = e.clientY || (e.touches && e.touches[0].clientY)
  const diffY = currentY - dragStartY
  const newY = Math.max(0, Math.min(100, Math.round(dragStartPercent + diffY * 0.25)))
  goals.update(goal.value.id, { imagePositionY: newY })
}

function handleUp() {
  isDragging.value = false
  window.removeEventListener('mousemove', handleMove)
  window.removeEventListener('mouseup', handleUp)
  window.removeEventListener('touchmove', handleMove)
  window.removeEventListener('touchend', handleUp)
}

// Review Log / Comments Flow
const newComment = ref('')
const editingCommentIdx = ref(null)
const editCommentContent = ref('')

async function saveCommentsArray(newCommentsArray) {
  await goals.update(props.id, { progressNotes: newCommentsArray })
  await goals.markViewed(props.id)
}

async function addComment() {
  if (!newComment.value.trim() || !goal.value) return
  const currentNotes = goal.value.progressNotes || []
  await saveCommentsArray([
    { date: new Date().toISOString(), note: newComment.value.trim() },
    ...currentNotes
  ])
  newComment.value = ''
  ui.showToast('Comment added', 'success')
}

function startEditComment(idx) {
  editingCommentIdx.value = idx
  editCommentContent.value = goal.value.progressNotes[idx].note
}

function cancelEditComment() {
  editingCommentIdx.value = null
  editCommentContent.value = ''
}

async function saveEditComment(idx) {
  if (!editCommentContent.value.trim() || !goal.value) return
  const currentNotes = [...(goal.value.progressNotes || [])]
  currentNotes[idx].note = editCommentContent.value.trim()
  currentNotes[idx].editedAt = new Date().toISOString()
  await saveCommentsArray(currentNotes)
  cancelEditComment()
  ui.showToast('Comment updated', 'success')
}

async function deleteComment(idx) {
  if (!goal.value) return
  if (await ui.confirm({ message: 'Delete this comment update?', title: 'Delete Comment' })) {
    const currentNotes = [...(goal.value.progressNotes || [])]
    currentNotes.splice(idx, 1)
    await saveCommentsArray(currentNotes)
    ui.showToast('Comment deleted', 'success')
  }
}

// Goal Helpers
function cleanImageUrl(url) {
  if (!url) return ''
  return url.replace(/\/cache\/[^/]+/gi, '')
}

function yearsOf(g) {
  const ids = g.yearIds || (g.yearId ? [g.yearId] : [])
  return ids.map(id => years.items.find(y => y.id === id)).filter(Boolean)
}

function getProjectProgress(proj) {
  const projTasks = tasks.items.filter(t => t.projectId === proj.id)
  if (projTasks.length === 0) return 0
  const done = projTasks.filter(t => t.status === 'done').length
  return Math.round((done / projTasks.length) * 100)
}
</script>

<template>
  <div v-if="goal" class="px-8 md:px-12 py-10 max-w-4xl mx-auto" data-testid="goal-detail">
    <!-- Top Action Bar -->
    <div class="flex justify-between items-center mb-6">
      <button @click="router.back()" class="btn-ghost text-sm flex items-center gap-1.5" data-testid="goal-back">
        <ArrowLeft class="w-3.5 h-3.5" /> Back
      </button>
      <div class="flex items-center gap-2">
        <button
          class="btn-ghost text-xs !py-1.5 !px-3 hover:bg-pri-critical-bg rounded-lg border border-line/45 text-ink-2 hover:text-pri-critical flex items-center gap-1.5"
          @click="removeGoal" data-testid="goal-delete">
          <Trash2 class="w-3.5 h-3.5" /> Delete Goal
        </button>
      </div>
    </div>

    <!-- Banner image if available -->
    <div v-if="formImageUrl"
      class="w-full h-56 overflow-hidden rounded-2xl border border-line mb-6 relative bg-canvas flex items-center justify-center cursor-ns-resize group select-none shadow-sm"
      @mousedown="startDrag($event)" @touchstart="startDrag($event)">
      <img :src="cleanImageUrl(formImageUrl)" class="w-full h-full object-cover pointer-events-none select-none"
        :style="{ objectPosition: `center ${goal.imagePositionY || 50}%` }" />
      <div
        class="absolute bottom-0 inset-x-0 bg-ink/70 py-1.5 text-center text-[10px] text-surface font-semibold opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none">
        Drag image up/down to reposition
      </div>
    </div>

    <!-- Live In-Place Editable Title -->
    <div class="mb-8">
      <span class="text-[10px] uppercase tracking-wider text-ink-3 font-semibold font-mono block mb-1">
        {{yearsOf(goal).map(y => y.year).join(', ') || 'Goal'}}
      </span>
      <input v-model="formTitle" type="text" placeholder="Goal Title..."
        class="text-2xl md:text-3xl font-semibold text-ink bg-transparent hover:bg-canvas/50 focus:bg-surface border-b border-transparent focus:border-pri-strategic/50 outline-none transition-all py-1 px-1 -ml-1 rounded-lg w-full"
        @blur="handleTitleBlur" @keydown.enter="$event.target.blur()" />
    </div>



    <!-- Tabs Bar -->
    <div class="flex items-center justify-between border-b border-line mb-8 select-none">
      <div class="flex gap-6 text-sm">
        <button v-for="tab in ['summary', 'projects', 'tasks']" :key="tab" @click="activeTab = tab"
          class="pb-3 font-medium capitalize border-b-2 transition-all relative"
          :class="activeTab === tab ? 'border-ink text-ink font-semibold' : 'border-transparent text-ink-3 hover:text-ink'">
          {{ tab }}
          <span v-if="tab === 'projects' && linkedProjects.length"
            class="ml-1 text-[10px] bg-canvas border px-1.5 py-0.2 rounded-full font-mono text-ink-2">{{
              linkedProjects.length }}</span>
          <span v-if="tab === 'tasks' && openTasks.length"
            class="ml-1 text-[10px] bg-canvas border px-1.5 py-0.2 rounded-full font-mono text-ink-2">{{ openTasks.length
            }}</span>
        </button>
      </div>

      <!-- Tab Keyboard Shortcut Hint -->
      <span class="text-[10px] text-ink-3 pb-3 italic hidden md:inline-block">
        Press <kbd class="kbd !text-[9px] !px-1 !py-0">⌥1</kbd>–<kbd class="kbd !text-[9px] !px-1 !py-0">⌥3</kbd> or <kbd class="kbd !text-[9px] !px-1 !py-0">⌥ Up</kbd>/<kbd class="kbd !text-[9px] !px-1 !py-0">⌥ Down</kbd> to switch
      </span>
    </div>

    <!-- Tab Contents -->

    <!-- Summary (Home view) -->
    <div v-if="activeTab === 'summary'" class="space-y-8 animate-fade-in">

      <!-- Live In-Place Goal Specifications Form Card -->
      <div class="card p-6 space-y-6 rounded-2xl shadow-sm border border-line/50" data-testid="goal-specs">
        <div class="flex items-center justify-between">
          <h4 class="text-xs uppercase tracking-wider text-ink-3 font-semibold font-mono">Goal Specifications</h4>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
          <!-- Row 1: Start Date & Target Date -->
          <DateField v-model="formStartDate" label="Start Date" id="spec-start-date"
            @update:modelValue="handleStartDateChange" />

          <DateField v-model="formTargetDate" label="Target Date" id="spec-target-date"
            @update:modelValue="handleTargetDateChange" />

          <!-- Row 2: Years Assigned & Cover Image URL -->
          <VSelect v-model="formYearIds" label="Years Assigned" id="spec-years" :options="formattedYears"
            option-value="id" option-label="label" multiple @update:modelValue="handleYearsChange" />

          <VUrlInput v-model="formImageUrl" label="Cover Image URL" id="spec-image-url" @blur="handleImageUrlBlur"
            @keydown.enter="$event.target.blur()" />
        </div>

        <!-- Tracking Mode & Values Box -->
        <div class="bg-canvas/30 rounded-xl border border-line/50 p-4 space-y-4">
          <span class="text-[10px] uppercase tracking-wider text-ink-3 font-semibold font-mono block">Tracking Mode &
            Target Parameters</span>

          <div class="flex border border-line rounded-lg p-0.5 bg-canvas/50 w-full max-w-md">
            <button type="button" class="flex-1 text-center py-1.5 text-xs font-semibold rounded-md transition-all"
              :class="!formUseNumeric ? 'bg-surface text-ink shadow-sm border border-line-2/45' : 'text-ink-3 hover:text-ink'"
              @click="toggleTrackingMode(false)">
              Direct Percentage (%)
            </button>
            <button type="button" class="flex-1 text-center py-1.5 text-xs font-semibold rounded-md transition-all"
              :class="formUseNumeric ? 'bg-surface text-ink shadow-sm border border-line-2/45' : 'text-ink-3 hover:text-ink'"
              @click="toggleTrackingMode(true)">
              Target-based
            </button>
          </div>

          <!-- Target-based In-Place Inputs -->
          <div v-if="formUseNumeric" class="grid grid-cols-1 md:grid-cols-3 gap-3">
            <VInput type="number" v-model.number="formAchievedNumber" label="Achieved Number" id="spec-achieved"
              @blur="autoSaveProgressSettings" @keydown.enter="$event.target.blur()" />
            <VInput type="number" v-model.number="formTargetNumber" label="Target Number" id="spec-target"
              @blur="autoSaveProgressSettings" @keydown.enter="$event.target.blur()" />
            <VInput v-model="formUnit" label="Unit (e.g. km, books)" id="spec-unit" @blur="autoSaveProgressSettings"
              @keydown.enter="$event.target.blur()" />
          </div>

          <!-- Direct % In-Place Slider -->
          <div v-else class="space-y-2 max-w-md">
            <div class="flex justify-between text-xs font-mono text-ink-2">
              <span>Achieved Progress</span>
              <span class="font-bold text-ink">{{ formAchievedNumber }}%</span>
            </div>
            <input type="range" v-model.number="formAchievedNumber" min="0" max="100"
              class="w-full accent-ink bg-elevated rounded-lg appearance-none h-1.5 cursor-pointer"
              @change="autoSaveProgressSettings" />
          </div>
        </div>

        <!-- Description / Why It Matters -->
        <div>
          <VTextarea v-model="formDescription" label="Why it matters / Description" id="spec-description" :rows="3"
            autogrow @blur="handleDescriptionBlur" />
        </div>
      </div>

      <!-- Comments Feed (Home Page of Goal) -->
      <section class="mb-10">
        <SectionHeader overline="Review Log" />

        <!-- Add Comment Form -->
        <div class="relative mb-8 mt-3 flex items-center">
          <input v-model="newComment" type="text" placeholder="How is this goal coming along?"
            class="w-full bg-surface border border-line/50 rounded-2xl py-3.5 pl-5 pr-32 text-sm text-ink outline-none focus:border-pri-strategic/50 focus:ring-2 focus:ring-pri-strategic/10 transition-all shadow-sm"
            @keydown.enter="addComment" />
          <button class="absolute right-2 btn-primary py-1.5 px-4 text-xs font-semibold shadow-sm" @click="addComment"
            data-testid="add-goal-comment" :disabled="!newComment.trim()"
            :class="{ 'opacity-55 cursor-not-allowed': !newComment.trim() }">
            Add Update
          </button>
        </div>

        <!-- Comments Feed -->
        <div v-if="goal.progressNotes?.length"
          class="space-y-6 relative pl-3 before:absolute before:inset-y-0 before:left-[11px] before:w-[2px] before:bg-line/60">
          <div v-for="(log, idx) in goal.progressNotes" :key="idx" class="relative pl-6 group">
            <!-- Timeline dot -->
            <div
              class="absolute left-[-5px] top-1.5 w-3 h-3 rounded-full bg-surface border-2 border-pri-strategic z-10">
            </div>

            <div class="flex items-center justify-between mb-1.5">
              <div class="text-[10px] uppercase tracking-wider text-ink-3 font-mono font-semibold">
                {{ new Date(log.date).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) }}
                <span v-if="log.editedAt" class="opacity-50 ml-1">(edited)</span>
              </div>
              <div class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                <button @click="startEditComment(idx)"
                  class="btn-ghost !p-1 text-ink-3 hover:text-ink hover:bg-canvas rounded" title="Edit">
                  <Edit2 class="w-3.5 h-3.5" />
                </button>
                <button @click="deleteComment(idx)"
                  class="btn-ghost !p-1 text-ink-3 hover:text-pri-critical hover:bg-pri-critical-bg rounded"
                  title="Delete">
                  <Trash2 class="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <!-- Edit mode -->
            <div v-if="editingCommentIdx === idx"
              class="card p-4 bg-canvas/50 border border-pri-strategic/30 animate-fade-in mt-2">
              <VTextarea v-model="editCommentContent" :id="`edit-goal-comment-${idx}`" :rows="2" autogrow
                class="!bg-surface" />
              <div class="mt-3 flex justify-end gap-2">
                <button class="btn-ghost py-1 px-3 text-xs" @click="cancelEditComment">Cancel</button>
                <button class="btn-primary py-1 px-3 text-xs" @click="saveEditComment(idx)">Save</button>
              </div>
            </div>

            <!-- Display mode -->
            <div v-else
              class="text-sm text-ink whitespace-pre-wrap leading-relaxed bg-surface rounded-2xl border border-line/40 p-4 shadow-sm hover:shadow-md transition-shadow">
              {{ log.note }}
            </div>
          </div>
        </div>
        <EmptyState v-else title="No updates recorded" hint="Add progress notes to track your milestones." />
      </section>
    </div>

    <!-- Projects Tab -->
    <section v-if="activeTab === 'projects'" class="animate-fade-in mb-10">
      <div v-if="linkedProjects.length" class="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
        <RouterLink v-for="proj in linkedProjects" :key="proj.id" :to="`/projects/${proj.id}`"
          class="card p-5 hover:border-line-2 hover:bg-canvas/20 transition-all duration-300 flex flex-col justify-between cursor-pointer">
          <div>
            <div class="flex justify-between items-start mb-2">
              <h4 class="font-serif text-base font-bold text-ink leading-tight">{{ proj.title }}</h4>
              <span class="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border"
                :class="proj.status === 'completed' ? 'border-pri-strategic text-pri-strategic bg-pri-strategic/5' : 'border-line text-ink-2 bg-canvas'">
                {{ proj.status }}
              </span>
            </div>
            <p v-if="proj.description" class="text-xs text-ink-2 line-clamp-2 leading-relaxed mb-4">
              {{ proj.description }}
            </p>
          </div>
          <div>
            <div class="flex justify-between text-[10px] text-ink-3 font-mono font-medium mb-1">
              <span>Progress</span>
              <span>{{ getProjectProgress(proj) }}%</span>
            </div>
            <div class="w-full h-1 bg-elevated rounded-full overflow-hidden">
              <div class="h-full bg-ink transition-all duration-500" :style="{ width: getProjectProgress(proj) + '%' }">
              </div>
            </div>
          </div>
        </RouterLink>
      </div>
      <EmptyState v-else title="No projects linked" hint="Link projects to this goal inside Projects page." />
    </section>

    <!-- Tasks Tab -->
    <section v-if="activeTab === 'tasks'" class="animate-fade-in mb-10">

      <!-- Open Tasks -->
      <div v-if="openTasks.length" class="space-y-2 mt-3">
        <TaskCard v-for="t in openTasks" :key="t.id" :task="t" :show-project="true" :single-line="true" />
      </div>

      <!-- Completed Tasks -->
      <div v-if="doneTasks.length" class="mt-6">
        <h5 class="text-xs text-ink-3 uppercase tracking-wider font-semibold mb-3">Completed Tasks</h5>
        <div class="space-y-2 opacity-70">
          <TaskCard v-for="t in doneTasks" :key="t.id" :task="t" :show-project="true" :compact="true"
            :single-line="true" />
        </div>
      </div>

      <div v-if="!linkedTasks.length">
        <EmptyState title="No tasks linked" hint="Tasks created in linked projects will show up here." />
      </div>
    </section>
  </div>
</template>
