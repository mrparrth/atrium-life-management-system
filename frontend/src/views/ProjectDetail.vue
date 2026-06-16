<script setup>
import { computed, watch, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useProjectsStore } from '@/stores/projects'
import { useTasksStore } from '@/stores/tasks'
import { useGoalsStore } from '@/stores/goals'
import { useAreasStore } from '@/stores/areas'
import { useNotesStore } from '@/stores/notes'
import { useUIStore } from '@/stores/ui'
import { isTaskOpen } from '@/lib/resurface'
import { fromNow } from '@/lib/date'
import PageHeader from '@/components/PageHeader.vue'
import SectionHeader from '@/components/SectionHeader.vue'
import TaskCard from '@/components/TaskCard.vue'
import EmptyState from '@/components/EmptyState.vue'
import { Archive, CheckCircle2, Trash2, Plus, ArrowLeft } from 'lucide-vue-next'

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
</script>

<template>
  <div v-if="project" class="px-8 md:px-12 py-10 max-w-4xl mx-auto" data-testid="project-detail">
    <button @click="router.back()" class="btn-ghost mb-4 text-sm" data-testid="project-back"><ArrowLeft class="w-3.5 h-3.5" /> Back</button>
    <PageHeader :overline="area?.name || 'Project'" :title="project.title" :sub="project.description">
      <template #right>
        <button class="btn-ghost !text-pri-strategic" @click="complete" data-testid="project-complete"><CheckCircle2 class="w-4 h-4" /> Complete</button>
        <button class="btn-ghost" @click="archive" data-testid="project-archive"><Archive class="w-4 h-4" /> Archive</button>
        <button class="btn-ghost !text-pri-critical" @click="remove" data-testid="project-delete"><Trash2 class="w-4 h-4" /></button>
      </template>
    </PageHeader>

    <div class="card p-6 mb-10" data-testid="project-meta">
      <div class="grid grid-cols-2 md:grid-cols-4 gap-6 text-sm">
        <div><div class="overline mb-1">Progress</div><div class="font-serif text-2xl">{{ progress }}%</div></div>
        <div><div class="overline mb-1">Open</div><div class="font-serif text-2xl">{{ openTasks.length }}</div></div>
        <div><div class="overline mb-1">Done</div><div class="font-serif text-2xl">{{ doneTasks.length }}</div></div>
        <div><div class="overline mb-1">Last touched</div><div class="font-serif text-lg">{{ fromNow(project.lastViewedAt) }}</div></div>
      </div>
      <div class="mt-5 h-1.5 rounded-full bg-elevated overflow-hidden">
        <div class="h-full bg-ink rounded-full transition-all duration-700" :style="{ width: progress + '%' }"></div>
      </div>
      <div v-if="goal" class="mt-5 text-sm text-ink-2">Toward goal: <span class="text-ink font-medium">{{ goal.title }}</span></div>
    </div>

    <section class="mb-10">
      <SectionHeader overline="Tasks" :title="`${openTasks.length} open`">
        <template #right><button class="btn-primary" @click="ui.openQuickCapture" data-testid="project-capture"><Plus class="w-4 h-4" /> Capture</button></template>
      </SectionHeader>
      <div v-if="openTasks.length" class="space-y-2">
        <TaskCard v-for="t in openTasks" :key="t.id" :task="t" :show-project="false" :single-line="true" />
      </div>
      <EmptyState v-else title="No open tasks" hint="A clean slate." />
    </section>

    <section v-if="doneTasks.length" class="mb-10">
      <SectionHeader overline="Completed" :title="`${doneTasks.length} done`" />
      <div class="space-y-2 opacity-70">
        <TaskCard v-for="t in doneTasks" :key="t.id" :task="t" :show-project="false" :compact="true" :single-line="true" />
      </div>
    </section>

    <section v-if="linkedNotes.length" class="mb-10">
      <SectionHeader overline="Notes" title="Linked notes" />
      <div class="space-y-3">
        <RouterLink v-for="n in linkedNotes" :key="n.id" :to="`/notes/${n.id}`" class="card p-4 block hover:border-line-2 transition-colors duration-300">
          <div class="font-serif text-lg">{{ n.title }}</div>
          <p class="text-sm text-ink-2 mt-1 line-clamp-2">{{ n.body }}</p>
        </RouterLink>
      </div>
    </section>
  </div>
  <EmptyState v-else title="Project not found" hint="It may have been removed or archived." />
</template>
