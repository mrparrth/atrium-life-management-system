<script setup>
import { computed, watch, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useProjectsStore } from '@/stores/projects'
import { useTasksStore } from '@/stores/tasks'
import { useGoalsStore } from '@/stores/goals'
import { useAreasStore } from '@/stores/areas'
import { useNotesStore } from '@/stores/notes'
import { useUIStore } from '@/stores/ui'
import { isTaskOpen, getProjectLastTouched } from '@/lib/resurface'
import { fromNow } from '@/lib/date'
import PageHeader from '@/components/PageHeader.vue'
import SectionHeader from '@/components/SectionHeader.vue'
import TaskCard from '@/components/TaskCard.vue'
import EmptyState from '@/components/EmptyState.vue'
import VTextarea from '@/components/VTextarea.vue'
import { Archive, CheckCircle2, Trash2, Plus, ArrowLeft, Edit2 } from 'lucide-vue-next'

const props = defineProps({ id: String })
const router = useRouter()
const projects = useProjectsStore()
const tasks = useTasksStore()
const goals = useGoalsStore()
const areas = useAreasStore()
const notes = useNotesStore()
const ui = useUIStore()

const project = computed(() => projects.items.find(p => p.id === props.id))
const projectTasks = computed(() => tasks.items.filter(t => t.projectId === props.id))
const openTasks = computed(() => projectTasks.value.filter(isTaskOpen))
const doneTasks = computed(() => projectTasks.value.filter(t => t.status === 'done'))
const linkedNotes = computed(() => notes.items.filter(n => n.projectId === props.id))
const goal = computed(() => goals.items.find(g => g.id === project.value?.goalId))
const area = computed(() => areas.items.find(a => a.id === project.value?.areaId))

const progress = computed(() => {
  const total = projectTasks.value.length
  if (!total) return 0
  return Math.round((doneTasks.value.length / total) * 100)
})

onMounted(() => { if (project.value) projects.markViewed(project.value.id) })
watch(() => props.id, (id) => { if (id && project.value) projects.markViewed(id) })

async function archive() { if (await ui.confirm({ message: 'Archive this project?', title: 'Archive Project' })) { await projects.archive(props.id); router.push('/projects') } }
async function complete() { await projects.complete(props.id); ui.showToast('Project marked complete', 'success') }
async function remove() { if (await ui.confirm({ message: 'Delete this project?', title: 'Delete Project' })) { await projects.remove(props.id); router.push('/projects') } }

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
</script>

<template>
  <div v-if="project" class="px-8 md:px-12 py-10 max-w-4xl mx-auto" data-testid="project-detail">
    <button @click="router.back()" class="btn-ghost mb-4 text-sm" data-testid="project-back">
      <ArrowLeft class="w-3.5 h-3.5" /> Back
    </button>
    <PageHeader :overline="area?.name || 'Project'" :title="project.title" :sub="project.description">
      <template #right>
        <button class="btn-ghost !text-pri-strategic" @click="complete" data-testid="project-complete">
          <CheckCircle2 class="w-4 h-4" /> Complete
        </button>
        <button class="btn-ghost" @click="archive" data-testid="project-archive">
          <Archive class="w-4 h-4" /> Archive
        </button>
        <button class="btn-ghost !text-pri-critical" @click="remove" data-testid="project-delete">
          <Trash2 class="w-4 h-4" />
        </button>
      </template>
    </PageHeader>

    <div class="card p-6 mb-10" data-testid="project-meta">
      <div class="grid grid-cols-2 md:grid-cols-4 gap-6 text-sm">
        <div>
          <div class="overline mb-1">Progress</div>
          <div class="font-serif text-2xl">{{ progress }}%</div>
        </div>
        <div>
          <div class="overline mb-1">Open</div>
          <div class="font-serif text-2xl">{{ openTasks.length }}</div>
        </div>
        <div>
          <div class="overline mb-1">Done</div>
          <div class="font-serif text-2xl">{{ doneTasks.length }}</div>
        </div>
        <div>
          <div class="overline mb-1">Last touched</div>
          <div class="font-serif text-lg">{{ fromNow(getProjectLastTouched(project)) }}</div>
        </div>
      </div>
      <div class="mt-5 h-1.5 rounded-full bg-elevated overflow-hidden">
        <div class="h-full bg-ink rounded-full transition-all duration-700" :style="{ width: progress + '%' }"></div>
      </div>
      <div v-if="goal" class="mt-5 text-sm text-ink-2">Toward goal: <span class="text-ink font-medium">{{ goal.title
      }}</span></div>
    </div>

    <section class="mb-10">
      <SectionHeader :overline="`Tasks${openTasks.length ? `. ${openTasks.length} open` : ''}`">
        <template #right>
          <button class="btn-primary" @click="ui.openQuickCapture" data-testid="project-capture">
            <Plus class="w-4 h-4" />
            Capture
          </button>
        </template>
      </SectionHeader>
      <div v-if="openTasks.length" class="space-y-2">
        <TaskCard v-for="t in openTasks" :key="t.id" :task="t" :show-project="false" :single-line="true" />
      </div>
      <EmptyState v-else title="No open tasks" hint="A clean slate." />
    </section>

    <section v-if="doneTasks.length" class="mb-10">
      <SectionHeader :overline="`Completed${doneTasks.length ? `. ${doneTasks.length} done` : ''}`" />
      <div class="space-y-2 opacity-70">
        <TaskCard v-for="t in doneTasks" :key="t.id" :task="t" :show-project="false" :compact="true"
          :single-line="true" />
      </div>
    </section>

    <section class="mb-10">
      <SectionHeader overline="Review Log" />
      <div class="relative mb-8 flex items-center">
        <input v-model="newProgressNote" type="text" placeholder="How is this project going?"
          class="w-full bg-surface border border-line/50 rounded-2xl py-3.5 pl-5 pr-32 text-sm text-ink outline-none focus:border-pri-strategic/50 focus:ring-2 focus:ring-pri-strategic/10 transition-all shadow-sm"
          @keydown.enter="addProgressNote" />
        <button class="absolute right-2 btn-primary py-1.5 px-4 text-xs font-semibold shadow-sm"
          @click="addProgressNote" data-testid="add-progress-note" :disabled="!newProgressNote.trim()"
          :class="{ 'opacity-50 cursor-not-allowed': !newProgressNote.trim() }">
          Add Update
        </button>
      </div>

      <div v-if="project.progressNotes?.length"
        class="space-y-6 relative pl-3 before:absolute before:inset-y-0 before:left-[11px] before:w-[2px] before:bg-line/60">
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
    </section>

    <section v-if="linkedNotes.length" class="mb-10">
      <SectionHeader overline="Notes" title="Linked notes" />
      <div class="space-y-3">
        <RouterLink v-for="n in linkedNotes" :key="n.id" :to="`/notes/${n.id}`"
          class="card p-4 block hover:border-line-2 transition-colors duration-300">
          <div class="font-serif text-lg">{{ n.title }}</div>
          <p class="text-sm text-ink-2 mt-1 line-clamp-2">{{ n.body }}</p>
        </RouterLink>
      </div>
    </section>
  </div>
  <EmptyState v-else title="Project not found" hint="It may have been removed or archived." />
</template>
