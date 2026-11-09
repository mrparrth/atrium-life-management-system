<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useProjectsStore } from '@/stores/projects'
import { useTasksStore } from '@/stores/tasks'
import { useUIStore } from '@/stores/ui'
import PageHeader from '@/components/PageHeader.vue'
import SectionHeader from '@/components/SectionHeader.vue'
import EmptyState from '@/components/EmptyState.vue'
import { fromNow } from '@/lib/date'
import {
  FolderKanban,
  CheckCircle2,
  Trash2,
  RotateCcw,
  Search,
  Archive,
  ChevronLeft,
  ChevronRight
} from 'lucide-vue-next'
import dayjs from 'dayjs'

const projects = useProjectsStore()
const tasks = useTasksStore()
const ui = useUIStore()

const activeTab = ref('tasks') // 'tasks' | 'projects'
const searchQuery = ref('')
const currentPage = ref(1)
const itemsPerPage = ref(10)

// Reset to page 1 on tab or search change
watch([activeTab, searchQuery], () => {
  currentPage.value = 1
})

// Tab hotkeys: Alt+1 / Alt+2 and Alt+Up / Alt+Down
const TABS = [
  { id: 'tasks', label: 'Completed Tasks' },
  { id: 'projects', label: 'Archived Projects' }
]

function handleGlobalKeydown(e) {
  if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return
  if (e.altKey && !e.metaKey && !e.ctrlKey && e.code?.startsWith('Digit')) {
    const idx = parseInt(e.code.replace('Digit', '')) - 1
    if (idx >= 0 && idx < TABS.length) {
      e.preventDefault()
      activeTab.value = TABS[idx].id
    }
  }
  if (e.altKey && !e.metaKey && !e.ctrlKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
    const currentIdx = TABS.findIndex(t => t.id === activeTab.value)
    if (currentIdx !== -1) {
      e.preventDefault()
      const step = e.key === 'ArrowUp' ? -1 : 1
      const nextIdx = (currentIdx + step + TABS.length) % TABS.length
      activeTab.value = TABS[nextIdx].id
    }
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleGlobalKeydown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleGlobalKeydown)
})

// ───────── TASKS ─────────
const allCompletedTasks = computed(() => {
  return tasks.items.filter(t => t.status === 'done')
})

const filteredTasks = computed(() => {
  const q = searchQuery.value.trim().toLowerCase()
  let list = allCompletedTasks.value
  if (q) {
    list = list.filter(t => {
      const titleMatch = t.title?.toLowerCase().includes(q)
      const descMatch = t.description?.toLowerCase().includes(q)
      const tagMatch = t.tags?.some(tag => tag.toLowerCase().includes(q))
      const projName = getProjectName(t.projectId)?.toLowerCase()
      const projMatch = projName?.includes(q)
      return titleMatch || descMatch || tagMatch || projMatch
    })
  }
  // Sort latest completed first
  return [...list].sort((a, b) => {
    const da = a.completedAt || a.updatedAt || ''
    const db = b.completedAt || b.updatedAt || ''
    return db.localeCompare(da)
  })
})

const paginatedTasks = computed(() => {
  const start = (currentPage.value - 1) * itemsPerPage.value
  return filteredTasks.value.slice(start, start + itemsPerPage.value)
})

async function reopenTask(t) {
  await tasks.toggleComplete(t.id)
  ui.showToast(`Restored "${t.title}" to active tasks`, 'success')
}

async function deleteTask(t) {
  if (await ui.confirm({ message: `Permanently delete task "${t.title}"?`, title: 'Delete Task' })) {
    await tasks.remove(t.id)
    ui.showToast('Task permanently deleted', 'info')
  }
}

function getProjectName(projectId) {
  if (!projectId) return ''
  const p = projects.items.find(x => x.id === projectId)
  return p ? p.title : ''
}

// ───────── PROJECTS ─────────
const allArchivedProjects = computed(() => {
  return projects.items.filter(p => p.status === 'archived' || p.status === 'completed')
})

const filteredProjects = computed(() => {
  const q = searchQuery.value.trim().toLowerCase()
  let list = allArchivedProjects.value
  if (q) {
    list = list.filter(p => {
      const titleMatch = p.title?.toLowerCase().includes(q)
      const descMatch = p.description?.toLowerCase().includes(q)
      return titleMatch || descMatch
    })
  }
  return [...list].sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''))
})

const paginatedProjects = computed(() => {
  const start = (currentPage.value - 1) * itemsPerPage.value
  return filteredProjects.value.slice(start, start + itemsPerPage.value)
})

async function restoreProject(p) {
  await projects.update(p.id, { status: 'active' })
  ui.showToast(`Restored "${p.title}" to active projects`, 'success')
}

async function deleteProject(p) {
  if (await ui.confirm({ message: `Permanently delete project "${p.title}"?`, title: 'Delete Project' })) {
    await projects.remove(p.id)
    ui.showToast('Project deleted', 'info')
  }
}

// ───────── TOTALS & PAGINATION ─────────
const activeTotalCount = computed(() => {
  return activeTab.value === 'tasks' ? filteredTasks.value.length : filteredProjects.value.length
})

const totalPages = computed(() => {
  return Math.max(1, Math.ceil(activeTotalCount.value / itemsPerPage.value))
})
</script>

<template>
  <div class="w-full px-8 md:px-12 py-10 max-w-7xl mx-auto space-y-6 animate-fade-in" data-testid="archives-view">
    <!-- Header -->
    <PageHeader overline="PARA · Archives" title="Archives" sub="Historical records, completed actions, and preserved projects.">
      <template #right>
        <span
          class="text-xs text-ink-3 font-semibold uppercase tracking-wider bg-canvas border border-line px-3 py-1.5 rounded-xl flex items-center gap-1.5">
          <Archive class="w-4 h-4 text-ink-3" /> Historical Archive
        </span>
      </template>
    </PageHeader>

    <!-- Controls Row: Tabs + Search Input -->
    <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
      <!-- Tabs Strip -->
      <div class="flex gap-1 p-1 bg-elevated border border-line rounded-2xl w-fit" data-testid="archive-tabs">
        <button
          type="button"
          class="px-4 py-2 rounded-xl text-xs font-semibold uppercase tracking-wider transition-all duration-200"
          :class="activeTab === 'tasks' ? 'bg-surface text-ink border border-line/60 shadow-sm' : 'text-ink-2 hover:text-ink'"
          @click="activeTab = 'tasks'"
          data-testid="archive-tab-tasks"
        >
          Tasks ({{ allCompletedTasks.length }})
        </button>
        <button
          type="button"
          class="px-4 py-2 rounded-xl text-xs font-semibold uppercase tracking-wider transition-all duration-200"
          :class="activeTab === 'projects' ? 'bg-surface text-ink border border-line/60 shadow-sm' : 'text-ink-2 hover:text-ink'"
          @click="activeTab = 'projects'"
          data-testid="archive-tab-projects"
        >
          Projects ({{ allArchivedProjects.length }})
        </button>
      </div>

      <!-- Search Input -->
      <div class="card px-3.5 py-2 flex items-center gap-2.5 w-full md:w-80" data-testid="archive-search-container">
        <Search class="w-4 h-4 text-ink-3 shrink-0" />
        <input
          v-model="searchQuery"
          type="text"
          class="bg-transparent outline-none flex-1 text-sm text-ink placeholder:text-ink-3/60"
          :placeholder="activeTab === 'tasks' ? 'Search completed tasks, tags...' : 'Search archived projects...'"
          data-testid="archive-search-input"
        />
        <button
          v-if="searchQuery"
          class="text-xs text-ink-3 hover:text-ink"
          @click="searchQuery = ''"
          title="Clear search"
        >
          ✕
        </button>
      </div>
    </div>

    <!-- Tab 1: Tasks -->
    <div v-if="activeTab === 'tasks'" class="space-y-4" data-testid="archive-tasks-section">
      <div v-if="filteredTasks.length" class="card divide-y divide-line overflow-hidden">
        <div
          v-for="t in paginatedTasks"
          :key="t.id"
          class="py-2.5 px-4 flex items-center justify-between gap-3 hover:bg-canvas/50 transition-colors group"
          :data-testid="`archive-task-row-${t.id}`"
        >
          <!-- Left side: Check icon & Title -->
          <div class="flex items-center gap-2.5 min-w-0 flex-1">
            <CheckCircle2 class="w-3.5 h-3.5 text-pri-strategic shrink-0" />
            <div class="min-w-0 flex-1 flex items-center gap-2.5 flex-wrap">
              <span class="text-xs font-medium text-ink-2 line-through truncate">
                {{ t.title }}
              </span>
              <span v-if="getProjectName(t.projectId)" class="text-[11px] text-ink-3 font-medium shrink-0">
                · {{ getProjectName(t.projectId) }}
              </span>
              <span v-if="t.tags && t.tags.length" class="inline-flex items-center gap-1 shrink-0">
                <span v-for="tag in t.tags" :key="tag" class="text-[9px] bg-canvas border border-line px-1.5 py-0.2 rounded text-ink-3">
                  #{{ tag }}
                </span>
              </span>
            </div>
          </div>

          <!-- Right side: Timestamp & Actions -->
          <div class="flex items-center gap-3 shrink-0 text-xs">
            <span class="text-ink-3 text-[11px] hidden sm:inline" :title="t.completedAt || t.updatedAt">
              Closed {{ fromNow(t.completedAt || t.updatedAt) }}
            </span>
            <div class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                class="btn-ghost !py-0.5 !px-2 text-xs flex items-center gap-1"
                @click="reopenTask(t)"
                title="Restore to open tasks"
                :data-testid="`reopen-task-${t.id}`"
              >
                <RotateCcw class="w-3 h-3" />
                <span class="hidden md:inline">Reopen</span>
              </button>
              <button
                class="btn-ghost !p-1 text-xs hover:text-pri-critical"
                @click="deleteTask(t)"
                title="Permanently delete"
                :data-testid="`delete-task-${t.id}`"
              >
                <Trash2 class="w-3 h-3" />
              </button>
            </div>
          </div>
        </div>
      </div>
      <EmptyState
        v-else
        :title="searchQuery ? 'No matching tasks found' : 'No completed tasks yet'"
        :hint="searchQuery ? 'Try adjusting your search query.' : 'When you finish tasks, they will be archived here.'"
      />
    </div>

    <!-- Tab 2: Projects -->
    <div v-else-if="activeTab === 'projects'" class="space-y-4" data-testid="archive-projects-section">
      <div v-if="filteredProjects.length" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        <div
          v-for="p in paginatedProjects"
          :key="p.id"
          class="card p-5 hover:border-line-2 transition-all flex flex-col justify-between"
          :data-testid="`archive-project-card-${p.id}`"
        >
          <div>
            <div class="flex items-center justify-between gap-2 mb-2">
              <div class="flex items-center gap-2">
                <FolderKanban class="w-3.5 h-3.5 text-ink-3" />
                <span class="overline capitalize">{{ p.status }}</span>
              </div>
              <span class="text-[10px] text-ink-3">{{ fromNow(p.updatedAt) }}</span>
            </div>
            <h4 class="font-serif text-lg text-ink font-medium leading-snug">{{ p.title }}</h4>
            <p v-if="p.description" class="text-xs text-ink-2 line-clamp-2 mt-1.5">
              {{ p.description }}
            </p>
          </div>

          <div class="flex items-center justify-between mt-4 pt-3 border-t border-line text-xs">
            <span class="text-ink-3 text-[11px] font-mono">
              {{ p.createdAt ? dayjs(p.createdAt).format('MMM YYYY') : '' }}
            </span>
            <div class="flex items-center gap-1.5">
              <button
                class="btn-secondary !py-1 !px-2.5 text-xs flex items-center gap-1"
                @click="restoreProject(p)"
                :data-testid="`restore-${p.id}`"
              >
                <RotateCcw class="w-3 h-3" /> Restore
              </button>
              <button
                class="btn-ghost !p-1.5 text-xs hover:text-pri-critical"
                @click="deleteProject(p)"
                :data-testid="`delete-${p.id}`"
                title="Permanently delete project"
              >
                <Trash2 class="w-3 h-3" />
              </button>
            </div>
          </div>
        </div>
      </div>
      <EmptyState
        v-else
        :title="searchQuery ? 'No matching projects found' : 'No archived projects'"
        :hint="searchQuery ? 'Try adjusting your search query.' : 'Projects you archive or complete will be safely stored here.'"
      />
    </div>

    <!-- Pagination Controls (shows when total items exceed itemsPerPage) -->
    <div
      v-if="totalPages > 1"
      class="flex flex-col sm:flex-row items-center justify-between gap-3 pt-6 border-t border-line text-xs"
      data-testid="archive-pagination"
    >
      <span class="text-ink-3">
        Showing {{ (currentPage - 1) * itemsPerPage + 1 }} to {{ Math.min(currentPage * itemsPerPage, activeTotalCount) }} of {{ activeTotalCount }} {{ activeTab }}
      </span>

      <div class="flex items-center gap-2">
        <button
          type="button"
          class="btn-secondary !py-1.5 !px-3 flex items-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed"
          :disabled="currentPage === 1"
          @click="currentPage--"
          data-testid="archive-page-prev"
        >
          <ChevronLeft class="w-3.5 h-3.5" /> Previous
        </button>

        <span class="px-2 font-semibold text-ink">
          Page {{ currentPage }} of {{ totalPages }}
        </span>

        <button
          type="button"
          class="btn-secondary !py-1.5 !px-3 flex items-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed"
          :disabled="currentPage === totalPages"
          @click="currentPage++"
          data-testid="archive-page-next"
        >
          Next <ChevronRight class="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  </div>
</template>
