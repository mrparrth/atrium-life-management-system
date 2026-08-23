<script setup>
import { computed, watch, onMounted, onUnmounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useProjectsStore } from '@/stores/projects'
import { useTasksStore } from '@/stores/tasks'
import { useGoalsStore } from '@/stores/goals'
import { useAreasStore } from '@/stores/areas'
import { useUIStore } from '@/stores/ui'
import { isTaskOpen, getProjectLastTouched } from '@/lib/resurface'
import { fromNow, daysSince, formatDate } from '@/lib/date'
import PageHeader from '@/components/PageHeader.vue'
import SectionHeader from '@/components/SectionHeader.vue'
import TaskCard from '@/components/TaskCard.vue'
import EmptyState from '@/components/EmptyState.vue'
import VInput from '@/components/VInput.vue'
import VTextarea from '@/components/VTextarea.vue'
import VSelect from '@/components/VSelect.vue'
import VUrlInput from '@/components/VUrlInput.vue'
import { Archive, CheckCircle2, Trash2, Plus, ArrowLeft, Edit2, Check, X, ExternalLink, Link as LinkIcon } from 'lucide-vue-next'

const props = defineProps({ id: String })
const router = useRouter()
const projects = useProjectsStore()
const tasks = useTasksStore()
const goals = useGoalsStore()
const areas = useAreasStore()
const ui = useUIStore()

const project = computed(() => projects.items.find(p => p.id === props.id))
const projectTasks = computed(() => tasks.items.filter(t => t.projectId === props.id))
const openTasks = computed(() => projectTasks.value.filter(isTaskOpen))
const doneTasks = computed(() => projectTasks.value.filter(t => t.status === 'done'))
const goal = computed(() => goals.items.find(g => g.id === project.value?.goalId))
const area = computed(() => areas.items.find(a => a.id === project.value?.areaId))

const activeTab = ref('overview')
const TABS = ['overview', 'tasks']

// Live Title & Specifications Edit State
const formTitle = ref('')
const isEditingSpecs = ref(false)
const formDescription = ref('')
const formGoalId = ref('')
const formAreaId = ref('')
const formReviewFrequency = ref('14')
const formStatus = ref('active')

// Links & Bookmarks Add State
const showAddLink = ref(false)
const newLinkTitle = ref('')
const newLinkUrl = ref('')

function syncForm() {
  if (!project.value) return
  formTitle.value = project.value.title || ''
  formDescription.value = project.value.description || ''
  formGoalId.value = project.value.goalId || ''
  formAreaId.value = project.value.areaId || ''
  formReviewFrequency.value = project.value.reviewFrequency || '14'
  formStatus.value = project.value.status || 'active'
}

onMounted(async () => {
  window.addEventListener('keydown', handleKeydown)
  await Promise.all([
    projects.load(),
    tasks.load(),
    goals.load(),
    areas.load()
  ])
  if (project.value) {
    projects.markViewed(project.value.id)
    syncForm()
  }
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown)
})

watch(() => props.id, (newId) => {
  if (newId && project.value) {
    projects.markViewed(newId)
    syncForm()
  }
})

watch(() => project.value, (newProj) => {
  if (newProj) {
    syncForm()
  }
}, { deep: true })

function handleKeydown(e) {
  const targetTag = e.target?.tagName?.toLowerCase()
  if (targetTag === 'input' || targetTag === 'textarea' || e.target?.isContentEditable) {
    return
  }

  // Alt+1-2 → switch tabs
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

function handleTitleBlur() {
  if (!formTitle.value.trim()) {
    formTitle.value = project.value?.title || 'Untitled Project'
    return
  }
  projects.update(props.id, { title: formTitle.value.trim() })
}

function startEditSpecs() {
  syncForm()
  isEditingSpecs.value = true
}

async function saveSpecs() {
  if (!project.value) return
  await projects.update(props.id, {
    description: formDescription.value,
    goalId: formGoalId.value || null,
    areaId: formAreaId.value || null,
    reviewFrequency: formReviewFrequency.value,
    status: formStatus.value
  })
  isEditingSpecs.value = false
  ui.showToast('Project specifications updated', 'success')
}

// Links / Bookmarks Logic
const projectLinks = computed(() => project.value?.links || [])

async function saveLinks(newLinks) {
  await projects.update(props.id, { links: newLinks })
}

async function addLink() {
  if (!newLinkUrl.value.trim() || !project.value) return
  const url = newLinkUrl.value.trim()
  const title = newLinkTitle.value.trim() || url
  const current = projectLinks.value
  await saveLinks([...current, { id: 'link_' + Date.now(), title, url }])
  newLinkTitle.value = ''
  newLinkUrl.value = ''
  showAddLink.value = false
  ui.showToast('Link added', 'success')
}

async function deleteLink(linkId) {
  if (!project.value) return
  const current = projectLinks.value.filter(l => l.id !== linkId)
  await saveLinks(current)
  ui.showToast('Link removed', 'success')
}

async function toggleTaskDone(task) {
  if (task.status === 'done') {
    await tasks.reopen(task.id)
  } else {
    await tasks.complete(task.id)
  }
}

// Options lists
const goalOptions = computed(() => [
  { id: '', label: 'None (Standalone)' },
  ...goals.items.map(g => ({ id: g.id, label: g.title }))
])

const areaOptions = computed(() => [
  { id: '', label: 'None' },
  ...areas.items.map(a => ({ id: a.id, label: a.name }))
])

const frequencyOptions = [
  { id: '7', label: 'Weekly (7 days)' },
  { id: '14', label: 'Bi-weekly (14 days)' },
  { id: '30', label: 'Monthly (30 days)' },
  { id: '90', label: 'Quarterly (90 days)' },
  { id: '0', label: 'Never' }
]

const statusOptions = [
  { id: 'active', label: 'Active' },
  { id: 'completed', label: 'Completed' },
  { id: 'archived', label: 'Archived' }
]

function getFrequencyLabel(val) {
  const match = frequencyOptions.find(f => f.id === String(val))
  return match ? match.label : 'Bi-weekly (14 days)'
}

// Actions
async function archive() {
  if (await ui.confirm({ message: 'Archive this project?', title: 'Archive Project' })) {
    await projects.archive(props.id)
    router.push('/projects')
  }
}

async function complete() {
  await projects.complete(props.id)
  ui.showToast('Project marked complete', 'success')
}

async function remove() {
  if (await ui.confirm({ message: 'Delete this project?', title: 'Delete Project' })) {
    await projects.remove(props.id)
    router.push('/projects')
  }
}

// Review Log / Comments Flow
const newProgressNote = ref('')
const editingNoteIdx = ref(null)
const editNoteContent = ref('')

async function saveNotesArray(newNotesArray) {
  await projects.update(props.id, { progressNotes: newNotesArray })
  await projects.markViewed(props.id)
}

async function addProgressNote() {
  if (!newProgressNote.value.trim() || !project.value) return
  const currentNotes = project.value.progressNotes || []
  await saveNotesArray([
    { date: new Date().toISOString(), note: newProgressNote.value.trim() },
    ...currentNotes
  ])
  newProgressNote.value = ''
  ui.showToast('Progress note added', 'success')
}

function startEditNote(idx) {
  editingNoteIdx.value = idx
  editNoteContent.value = project.value.progressNotes[idx].note
}

function cancelEditNote() {
  editingNoteIdx.value = null
  editNoteContent.value = ''
}

async function saveEditNote(idx) {
  if (!editNoteContent.value.trim() || !project.value) return
  const currentNotes = [...(project.value.progressNotes || [])]
  currentNotes[idx].note = editNoteContent.value.trim()
  currentNotes[idx].editedAt = new Date().toISOString()
  await saveNotesArray(currentNotes)
  cancelEditNote()
  ui.showToast('Progress note updated', 'success')
}

async function deleteNote(idx) {
  if (!project.value) return
  if (await ui.confirm({ message: 'Delete this update?', title: 'Delete Update' })) {
    const currentNotes = [...(project.value.progressNotes || [])]
    currentNotes.splice(idx, 1)
    await saveNotesArray(currentNotes)
    ui.showToast('Progress note deleted', 'success')
  }
}

const needsReview = computed(() => {
  if (!project.value) return false
  return daysSince(getProjectLastTouched(project.value)) >= 30
})
</script>

<template>
  <div v-if="project" class="px-8 md:px-12 py-10 max-w-5xl mx-auto" data-testid="project-detail">
    <!-- Top Action Bar -->
    <div class="flex justify-between items-center mb-6">
      <button @click="router.back()" class="btn-ghost text-sm flex items-center gap-1.5" data-testid="project-back">
        <ArrowLeft class="w-3.5 h-3.5" /> Back
      </button>
      <div class="flex items-center gap-2">
        <button class="btn-ghost text-xs !py-1.5 !px-3 text-pri-strategic hover:bg-pri-strategic/10 rounded-lg flex items-center gap-1.5" @click="complete" data-testid="project-complete">
          <CheckCircle2 class="w-3.5 h-3.5" /> Complete
        </button>
        <button class="btn-ghost text-xs !py-1.5 !px-3 hover:bg-canvas rounded-lg text-ink-2 flex items-center gap-1.5" @click="archive" data-testid="project-archive">
          <Archive class="w-3.5 h-3.5" /> Archive
        </button>
        <button class="btn-ghost text-xs !py-1.5 !px-3 hover:bg-pri-critical-bg rounded-lg border border-line/45 text-ink-2 hover:text-pri-critical flex items-center gap-1.5" @click="remove" data-testid="project-delete">
          <Trash2 class="w-3.5 h-3.5" /> Delete
        </button>
      </div>
    </div>

    <!-- Review Reminder Banner -->
    <div v-if="needsReview"
      class="p-4 mb-6 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-900 dark:text-amber-300 flex items-start gap-3 shadow-sm">
      <span class="text-base shrink-0">⚠️</span>
      <div class="space-y-1">
        <h4 class="text-sm font-bold text-amber-950 dark:text-amber-200">Review Required</h4>
        <p class="text-xs text-amber-800 dark:text-amber-400 leading-relaxed">This project has not been reviewed or
          touched in over a month (last touched {{ fromNow(getProjectLastTouched(project)) }}). Please add a progress note below under the Review Log to update its status.</p>
      </div>
    </div>

    <!-- Editable Title -->
    <div class="mb-8">
      <span class="text-[10px] uppercase tracking-wider text-ink-3 font-semibold font-mono block mb-1">
        {{ area?.name || 'Project' }}
      </span>
      <input v-model="formTitle" type="text" placeholder="Project Title..."
        class="font-serif text-2xl md:text-3xl font-bold text-ink bg-transparent hover:bg-canvas/50 focus:bg-surface border-b border-transparent focus:border-pri-strategic/50 outline-none transition-all py-1 px-1 -ml-1 rounded-lg w-full"
        @blur="handleTitleBlur" @keydown.enter="$event.target.blur()" />
    </div>

    <!-- Tabs Bar with Keyboard Shortcuts -->
    <div class="flex items-center justify-between border-b border-line mb-8 select-none">
      <div class="flex gap-6 text-sm">
        <button v-for="tab in TABS" :key="tab" @click="activeTab = tab"
          class="pb-3 font-medium capitalize border-b-2 transition-all relative"
          :class="activeTab === tab ? 'border-ink text-ink font-semibold' : 'border-transparent text-ink-3 hover:text-ink'">
          {{ tab }}
          <span v-if="tab === 'tasks' && openTasks.length"
            class="ml-1 text-[10px] bg-canvas border px-1.5 py-0.2 rounded-full font-mono text-ink-2">{{ openTasks.length }}</span>
        </button>
      </div>

      <!-- Tab Keyboard Shortcut Hint -->
      <span class="text-[10px] text-ink-3 pb-3 italic hidden md:inline-block">
        Press <kbd class="kbd !text-[9px] !px-1 !py-0">⌥1</kbd>–<kbd class="kbd !text-[9px] !px-1 !py-0">⌥2</kbd> or <kbd class="kbd !text-[9px] !px-1 !py-0">⌥ Up</kbd>/<kbd class="kbd !text-[9px] !px-1 !py-0">⌥ Down</kbd> to switch tabs
      </span>
    </div>

    <!-- Tab Contents -->

    <!-- OVERVIEW TAB (2-Column Main Grid Layout) -->
    <div v-if="activeTab === 'overview'" class="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-fade-in">
      
      <!-- Left Column (Active Tasks & Links side-by-side, then Review Log below) -->
      <div class="lg:col-span-2 space-y-6">
        
        <!-- Side-by-Side 2-Column Sub-Grid for Active Tasks and Links & Bookmarks -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          <!-- Active Tasks Card (Click opens Task Dialog) -->
          <div class="card p-5 border bg-surface space-y-3 shadow-sm" data-testid="overview-tasks">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2">
                <h4 class="text-sm font-semibold text-ink">Active Tasks</h4>
                <span class="text-[10px] bg-canvas border px-1.5 py-0.2 rounded-full font-mono text-ink-2" v-if="openTasks.length">{{ openTasks.length }}</span>
              </div>
              <button @click="activeTab = 'tasks'" class="text-xs text-pri-strategic hover:underline flex items-center gap-1">
                View All <span class="text-[10px]">➔</span>
              </button>
            </div>

            <!-- Minimal Text Card List -->
            <div v-if="openTasks.length" class="space-y-2">
              <div v-for="t in openTasks.slice(0, 4)" :key="t.id"
                @click="ui.openTaskEdit(t)"
                class="p-2.5 bg-canvas/30 border border-line/60 rounded-xl hover:border-line-2 transition-all flex items-center justify-between cursor-pointer group">
                <div class="flex items-center gap-2.5 min-w-0">
                  <input type="checkbox" :checked="t.status === 'done'" @click.stop="toggleTaskDone(t)"
                    class="rounded accent-ink cursor-pointer shrink-0" />
                  <span class="text-xs font-medium text-ink truncate group-hover:text-pri-strategic transition-colors">
                    {{ t.title }}
                  </span>
                </div>
                <span v-if="t.dueDate" class="text-[9px] font-mono text-ink-3 shrink-0 ml-2">
                  {{ formatDate(t.dueDate) }}
                </span>
              </div>
            </div>
            <p v-else class="text-xs text-ink-3 italic bg-canvas/30 p-3 rounded-xl text-center">No active tasks.</p>
          </div>

          <!-- Project Links & Bookmarks Card -->
          <div class="card p-5 border bg-surface space-y-3 shadow-sm" data-testid="overview-links">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2">
                <h4 class="text-sm font-semibold text-ink">Links & Bookmarks</h4>
                <span class="text-[10px] bg-canvas border px-1.5 py-0.2 rounded-full font-mono text-ink-2" v-if="projectLinks.length">{{ projectLinks.length }}</span>
              </div>
              <button @click="showAddLink = !showAddLink" class="text-xs text-pri-strategic hover:underline flex items-center gap-1">
                <Plus class="w-3.5 h-3.5" /> {{ showAddLink ? 'Cancel' : 'Add Link' }}
              </button>
            </div>

            <!-- Inline Add Link Form -->
            <div v-if="showAddLink" class="card p-3.5 bg-canvas/50 border border-pri-strategic/30 rounded-xl space-y-2.5 animate-fade-in">
              <VInput v-model="newLinkTitle" label="Title (Optional)" id="link-title-input" placeholder="e.g. Figma, GitHub" />
              <VUrlInput v-model="newLinkUrl" label="URL" id="link-url-input" placeholder="https://..." />
              <div class="flex justify-end gap-2 pt-1">
                <button class="btn-ghost py-1 px-3 text-xs" @click="showAddLink = false">Cancel</button>
                <button class="btn-primary py-1 px-3 text-xs" @click="addLink" :disabled="!newLinkUrl.trim()">Save</button>
              </div>
            </div>

            <!-- Compact Links List -->
            <div v-if="projectLinks.length" class="space-y-2">
              <div v-for="link in projectLinks" :key="link.id"
                class="p-2.5 bg-canvas/30 border border-line/60 rounded-lg hover:border-line-2 transition-all flex items-center justify-between group">
                <a :href="link.url" target="_blank" class="flex items-center gap-2 min-w-0 flex-1 pr-2">
                  <LinkIcon class="w-3.5 h-3.5 text-ink-3 shrink-0 group-hover:text-pri-strategic transition-colors" />
                  <span class="text-xs font-medium text-ink truncate group-hover:text-pri-strategic transition-colors">{{ link.title }}</span>
                  <ExternalLink class="w-3 h-3 text-ink-4 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                </a>
                <button @click="deleteLink(link.id)" class="text-ink-4 hover:text-pri-critical opacity-0 group-hover:opacity-100 transition-opacity p-0.5" title="Remove Link">
                  <Trash2 class="w-3 h-3" />
                </button>
              </div>
            </div>
            <!-- Compact Empty State -->
            <div v-else-if="!showAddLink" class="text-xs text-ink-3 italic py-1">
              No links or bookmarks added yet.
            </div>
          </div>
        </div>

        <!-- Review Log (Progress Notes / Comments Feed) -->
        <section class="space-y-3 pt-2">
          <div class="flex items-center justify-between">
            <h4 class="text-sm font-semibold text-ink">Project Notes & Updates</h4>
            <span class="text-[10px] text-ink-3 font-mono">Review Log</span>
          </div>
          
          <!-- Add Update Input -->
          <div class="relative flex items-center">
            <input v-model="newProgressNote" type="text" placeholder="How is this project going?"
              class="w-full bg-surface border border-line/50 rounded-2xl py-3 pl-4 pr-32 text-sm text-ink outline-none focus:border-pri-strategic/50 focus:ring-2 focus:ring-pri-strategic/10 transition-all shadow-sm"
              @keydown.enter="addProgressNote" />
            <button class="absolute right-2 btn-primary py-1.5 px-3 text-xs font-semibold shadow-sm"
              @click="addProgressNote" data-testid="add-progress-note" :disabled="!newProgressNote.trim()"
              :class="{ 'opacity-50 cursor-not-allowed': !newProgressNote.trim() }">
              Add Update
            </button>
          </div>

          <!-- Timeline Feed -->
          <div v-if="project.progressNotes?.length"
            class="space-y-4 relative pl-3 pt-2 before:absolute before:inset-y-0 before:left-[11px] before:w-[2px] before:bg-line/60">
            <div v-for="(log, idx) in project.progressNotes" :key="idx" class="relative pl-6 group">
              <!-- Timeline dot -->
              <div class="absolute left-[-5px] top-1.5 w-3 h-3 rounded-full bg-surface border-2 border-pri-strategic z-10">
              </div>

              <div class="flex items-center justify-between mb-1.5">
                <div class="text-[10px] uppercase tracking-wider text-ink-3 font-mono font-semibold">
                  {{ new Date(log.date).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) }}
                  <span v-if="log.editedAt" class="opacity-50 ml-1">(edited)</span>
                </div>
                <div class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                  <button @click="startEditNote(idx)"
                    class="btn-ghost !p-1 text-ink-3 hover:text-ink hover:bg-canvas rounded" title="Edit">
                    <Edit2 class="w-3.5 h-3.5" />
                  </button>
                  <button @click="deleteNote(idx)"
                    class="btn-ghost !p-1 text-ink-3 hover:text-pri-critical hover:bg-pri-critical-bg rounded"
                    title="Delete">
                    <Trash2 class="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div v-if="editingNoteIdx === idx"
                class="card p-4 bg-canvas/50 border border-pri-strategic/30 animate-fade-in mt-2">
                <VTextarea v-model="editNoteContent" :id="`edit-progress-note-${idx}`" :rows="2" autogrow
                  class="!bg-surface" />
                <div class="mt-3 flex justify-end gap-2">
                  <button class="btn-ghost py-1 px-3 text-xs" @click="cancelEditNote">Cancel</button>
                  <button class="btn-primary py-1 px-3 text-xs" @click="saveEditNote(idx)">Save</button>
                </div>
              </div>

              <div v-else
                class="text-sm text-ink whitespace-pre-wrap leading-relaxed bg-surface rounded-2xl border border-line/40 p-4 shadow-sm hover:shadow-md transition-shadow">
                {{ log.note }}
              </div>
            </div>
          </div>
          <EmptyState v-else title="No updates recorded" hint="Add progress notes to track your milestones." />
        </section>
      </div>

      <!-- Right Profile Sidebar Column (Project Specifications Card) -->
      <div class="space-y-6">
        <div class="card p-5 border bg-surface space-y-4 shadow-sm" data-testid="project-specs-card">
          <div class="flex items-center justify-between pb-2 border-b border-line/40">
            <h3 class="text-sm font-semibold text-ink">Project Specifications</h3>
            <button v-if="!isEditingSpecs" @click="startEditSpecs" class="text-xs text-pri-strategic hover:underline flex items-center gap-1 font-semibold">
              <Edit2 class="w-3 h-3" /> Edit
            </button>
          </div>

          <!-- Display Mode -->
          <div v-if="!isEditingSpecs" class="space-y-3.5 text-xs">
            <div class="space-y-1">
              <span class="text-[10px] uppercase tracking-wider text-ink-3 font-semibold font-mono block">Status</span>
              <span class="inline-block px-2.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border"
                :class="project.status === 'completed' ? 'border-pri-strategic text-pri-strategic bg-pri-strategic/5' : 'border-line text-ink-2 bg-canvas'">
                {{ project.status || 'active' }}
              </span>
            </div>

            <div class="space-y-1">
              <span class="text-[10px] uppercase tracking-wider text-ink-3 font-semibold font-mono block">Linked Goal</span>
              <p class="font-medium text-ink">
                {{ goal?.title || 'None (Standalone)' }}
              </p>
            </div>

            <div class="space-y-1">
              <span class="text-[10px] uppercase tracking-wider text-ink-3 font-semibold font-mono block">Life Area</span>
              <p class="font-medium text-ink">
                {{ area?.name || 'None' }}
              </p>
            </div>

            <div class="space-y-1">
              <span class="text-[10px] uppercase tracking-wider text-ink-3 font-semibold font-mono block">Review Frequency</span>
              <p class="font-medium text-ink">
                {{ getFrequencyLabel(project.reviewFrequency) }}
              </p>
            </div>

            <div class="space-y-1 pt-2 border-t border-line/40">
              <span class="text-[10px] uppercase tracking-wider text-ink-3 font-semibold font-mono block">Last Touched</span>
              <p class="font-medium text-ink">
                {{ fromNow(getProjectLastTouched(project)) }}
              </p>
            </div>

            <div class="space-y-1 pt-2 border-t border-line/40">
              <span class="text-[10px] uppercase tracking-wider text-ink-3 font-semibold font-mono block">Description / Context</span>
              <p v-if="project.description" class="text-ink-2 whitespace-pre-wrap leading-relaxed">
                {{ project.description }}
              </p>
              <span v-else class="text-ink-3 italic">No description provided.</span>
            </div>
          </div>

          <!-- Edit Mode -->
          <div v-else class="space-y-3.5 text-xs animate-fade-in">
            <VSelect v-model="formGoalId" label="Linked Goal" id="edit-goal-select"
              :options="goalOptions" option-value="id" option-label="label" />

            <VSelect v-model="formAreaId" label="Life Area" id="edit-area-select"
              :options="areaOptions" option-value="id" option-label="label" />

            <VSelect v-model="formReviewFrequency" label="Review Frequency" id="edit-review-select"
              :options="frequencyOptions" option-value="id" option-label="label" />

            <VSelect v-model="formStatus" label="Status" id="edit-status-select"
              :options="statusOptions" option-value="id" option-label="label" />

            <VTextarea v-model="formDescription" label="Description / Context" id="edit-description" :rows="3" autogrow />

            <div class="flex justify-end gap-2 pt-2 border-t border-line/40">
              <button class="btn-ghost py-1 px-3 text-xs" @click="isEditingSpecs = false">Cancel</button>
              <button class="btn-primary py-1 px-3 text-xs" @click="saveSpecs">Save Specifications</button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- TASKS TAB -->
    <section v-if="activeTab === 'tasks'" class="animate-fade-in mb-10">
      <SectionHeader :overline="`Tasks${openTasks.length ? `. ${openTasks.length} open` : ''}`" title="Project Tasks">
        <template #right>
          <button class="btn-primary" @click="ui.openQuickCapture" data-testid="project-capture">
            <Plus class="w-4 h-4" />
            Capture
          </button>
        </template>
      </SectionHeader>

      <div v-if="openTasks.length" class="space-y-2 mt-3">
        <TaskCard v-for="t in openTasks" :key="t.id" :task="t" :show-project="false" :single-line="true" />
      </div>

      <div v-if="doneTasks.length" class="mt-6">
        <h5 class="text-xs text-ink-3 uppercase tracking-wider font-semibold mb-3">Completed Tasks</h5>
        <div class="space-y-2 opacity-70">
          <TaskCard v-for="t in doneTasks" :key="t.id" :task="t" :show-project="false" :compact="true" :single-line="true" />
        </div>
      </div>

      <div v-if="!projectTasks.length">
        <EmptyState title="No open tasks" hint="A clean slate." />
      </div>
    </section>
  </div>
  <EmptyState v-else title="Project not found" hint="It may have been removed or archived." />
</template>
