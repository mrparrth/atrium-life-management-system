<script setup>
import { computed, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { useProjectsStore } from '@/stores/projects'
import { useTasksStore } from '@/stores/tasks'
import { useAreasStore } from '@/stores/areas'
import { useGoalsStore } from '@/stores/goals'
import { fromNow } from '@/lib/date'
import { isTaskOpen, staleProjects } from '@/lib/resurface'
import PageHeader from '@/components/PageHeader.vue'
import EmptyState from '@/components/EmptyState.vue'
import { Plus, FolderKanban, X } from 'lucide-vue-next'
import { onKeyStroke } from '@vueuse/core'
import { useUIStore } from '@/stores/ui'

const ui = useUIStore()
const projects = useProjectsStore()
const tasks = useTasksStore()
const areas = useAreasStore()
const goals = useGoalsStore()

import { useRoute, useRouter } from 'vue-router'
const route = useRoute()
const router = useRouter()

const filter = ref('active')
const showNew = ref(false)
const newTitle = ref(''); const newDesc = ref(''); const newArea = ref(null); const newGoal = ref(null)

import { onMounted, watch } from 'vue'

function handleQuery() {
  if (route.query.new) {
    showNew.value = true
    router.replace({ query: {} })
  }
}

onMounted(handleQuery)
watch(() => route.query, handleQuery)

const stale = computed(() => new Set(staleProjects(projects.items, tasks.items).map(p => p.id)))

const filtered = computed(() => {
  if (filter.value === 'all') return projects.items
  return projects.items.filter(p => p.status === filter.value || (filter.value === 'active' && !p.status))
})

function openCount(pid) { return tasks.items.filter(t => t.projectId === pid && isTaskOpen(t)).length }
function areaOf(id) { return areas.items.find(a => a.id === id) }

async function createProject() {
  if (!newTitle.value.trim()) return
  await projects.add({ title: newTitle.value, description: newDesc.value, areaId: newArea.value, goalId: newGoal.value })
  newTitle.value = ''; newDesc.value = ''; newArea.value = null; newGoal.value = null; showNew.value = false
}

async function closeNewProject() {
  if (newTitle.value.trim() || newDesc.value.trim()) {
    if (!await ui.confirm({ title: 'Discard draft?', message: 'You have unsaved changes. Discard them?' })) return
  }
  showNew.value = false
}

onKeyStroke('Escape', (e) => {
  if (showNew.value) {
    e.preventDefault()
    closeNewProject()
  }
})
</script>

<template>
  <div class="px-8 md:px-12 py-10 max-w-6xl mx-auto" data-testid="projects-view">
    <PageHeader overline="PARA · Projects" title="Projects" sub="Things with a finish line.">
      <template #right>
        <button class="btn-primary" @click="showNew = true" data-testid="new-project-btn">
          <Plus class="w-4 h-4" /> New project <span class="kbd ml-1.5 !bg-canvas/20 !border-canvas/10 !text-canvas select-none">⌘1</span>
        </button>
      </template>
    </PageHeader>

    <div class="flex bg-elevated rounded-xl p-1 border border-line text-sm w-fit mb-8">
      <button v-for="f in ['active', 'completed', 'archived', 'all']" :key="f"
        class="px-3 py-1.5 rounded-lg transition-colors"
        :class="filter === f ? 'bg-surface text-ink' : 'text-ink-2 hover:text-ink'" @click="filter = f"
        :data-testid="`project-filter-${f}`">{{ f }}</button>
    </div>

    <div v-if="filtered.length" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
      <RouterLink v-for="p in filtered" :key="p.id" :to="`/projects/${p.id}`"
        class="card p-6 hover:border-line-2 transition-all duration-300 group flex flex-col gap-3"
        :data-testid="`project-card-${p.id}`">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2">
            <FolderKanban class="w-3.5 h-3.5 text-ink-3" /><span class="overline">{{ areaOf(p.areaId)?.name || 'Project'
              }}</span>
          </div>
          <span v-if="stale.has(p.id)"
            class="text-[10px] uppercase tracking-overline text-pri-interruptive">stale</span>
        </div>
        <div>
          <div class="font-serif text-xl text-ink">{{ p.title }}</div>
          <p v-if="p.description" class="text-sm text-ink-2 mt-1.5 line-clamp-2">{{ p.description }}</p>
        </div>
        <div class="mt-auto pt-3 border-t border-line text-xs text-ink-3 flex items-center justify-between">
          <span>{{ openCount(p.id) }} open · {{ p.status }}</span>
          <span>{{ fromNow(p.lastViewedAt) }}</span>
        </div>
      </RouterLink>
    </div>
    <EmptyState v-else title="No projects yet" hint="Start one - even a small one." />

    <!-- New project modal -->
    <div v-if="showNew" class="fixed inset-0 z-50 flex items-start justify-center pt-24 px-4"
      data-testid="new-project-modal">
      <div class="fixed inset-0 bg-ink/40 backdrop-blur-sm animate-fade-in" @click="closeNewProject"></div>
      <form @submit.prevent="createProject" class="relative w-full max-w-lg card p-8 animate-rise-in">
        <button type="button" class="absolute top-4 right-4 btn-ghost !p-1.5" @click="closeNewProject">
          <X class="w-4 h-4" />
        </button>
        <div class="overline">New project</div>
        <h2 class="font-serif text-2xl mt-1 mb-5">A new thread to tend</h2>
        <input v-model="newTitle" placeholder="Project title…" class="input-soft text-lg font-serif mb-3" required
          data-testid="new-project-title" />
        <textarea v-model="newDesc" placeholder="A line of context…" rows="2" class="input-soft resize-none mb-3"
          data-testid="new-project-desc" />
        <div class="grid grid-cols-2 gap-3 mb-5">
          <label class="block"><span class="overline block mb-1">Area</span>
            <select v-model="newArea" class="input-block text-sm">
              <option :value="null">-</option>
              <option v-for="a in areas.items" :key="a.id" :value="a.id">{{ a.name }}</option>
            </select>
          </label>
          <label class="block"><span class="overline block mb-1">Goal</span>
            <select v-model="newGoal" class="input-block text-sm">
              <option :value="null">-</option>
              <option v-for="g in goals.items" :key="g.id" :value="g.id">{{ g.title }}</option>
            </select>
          </label>
        </div>
        <div class="flex justify-end gap-2">
          <button type="button" class="btn-ghost" @click="closeNewProject">Cancel</button>
          <button type="submit" class="btn-primary" data-testid="new-project-save">Create</button>
        </div>
      </form>
    </div>
  </div>
</template>
