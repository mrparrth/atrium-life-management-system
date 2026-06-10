<script setup>
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import { useProjectsStore } from '@/stores/projects'
import { useTasksStore } from '@/stores/tasks'
import { useUIStore } from '@/stores/ui'
import PageHeader from '@/components/PageHeader.vue'
import EmptyState from '@/components/EmptyState.vue'
import { fromNow } from '@/lib/date'
import { FolderKanban, Trash2 } from 'lucide-vue-next'

const projects = useProjectsStore()
const tasks = useTasksStore()
const ui = useUIStore()

const archived = computed(() => projects.items.filter(p => p.status === 'archived' || p.status === 'completed'))
const completedTasks = computed(() => tasks.items.filter(t => t.status === 'done'))

async function restoreProject(p) { await projects.update(p.id, { status: 'active' }) }
async function deleteProject(p) { if (await ui.confirm({ message: 'Permanently delete this project?', title: 'Delete Project' })) await projects.remove(p.id) }
</script>

<template>
  <div class="px-8 md:px-12 py-10 max-w-7xl mx-auto" data-testid="archives-view">
    <PageHeader overline="PARA · Archives" title="Archives" sub="What was once active, gently set aside." />

    <h3 class="overline mb-3">Projects</h3>
    <div v-if="archived.length" class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-10">
      <div v-for="p in archived" :key="p.id" class="card p-5 opacity-80">
        <div class="flex items-center gap-2">
          <FolderKanban class="w-3.5 h-3.5 text-ink-3" /><span class="overline">{{ p.status }}</span>
        </div>
        <div class="font-serif text-lg mt-1.5">{{ p.title }}</div>
        <p class="text-sm text-ink-2 line-clamp-2 mt-1">{{ p.description }}</p>
        <div class="flex items-center justify-between mt-4 pt-3 border-t border-line text-xs">
          <span class="text-ink-3">{{ fromNow(p.updatedAt) }}</span>
          <div class="flex items-center gap-2">
            <button class="btn-ghost text-xs" @click="restoreProject(p)"
              :data-testid="`restore-${p.id}`">Restore</button>
            <button class="btn-ghost text-xs !text-pri-critical" @click="deleteProject(p)"
              :data-testid="`delete-${p.id}`">
              <Trash2 class="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>
    </div>
    <EmptyState v-else title="No archived projects" />

    <h3 class="overline mb-3 mt-10">Completed tasks · {{ completedTasks.length }}</h3>
    <div v-if="completedTasks.length" class="card divide-y divide-line">
      <div v-for="t in completedTasks.slice(0, 30)" :key="t.id" class="p-4 flex items-center justify-between gap-3">
        <span class="text-ink-2 line-through">{{ t.title }}</span>
        <span class="text-xs text-ink-3">{{ fromNow(t.completedAt || t.updatedAt) }}</span>
      </div>
    </div>
    <EmptyState v-else title="No completed tasks" />
  </div>
</template>
