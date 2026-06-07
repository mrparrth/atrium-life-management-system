<script setup>
import { onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useUIStore } from '@/stores/ui'
import { useTasksStore } from '@/stores/tasks'
import { useProjectsStore } from '@/stores/projects'
import { useGoalsStore } from '@/stores/goals'
import { useYearsStore } from '@/stores/years'
import { useNotesStore } from '@/stores/notes'
import { useBookmarksStore } from '@/stores/bookmarks'
import { useFinanceStore } from '@/stores/finance'
import { useAreasStore } from '@/stores/areas'
import { useReviewsStore } from '@/stores/reviews'
import { useNextStepsStore } from '@/stores/nextSteps'
import { db, seedIfEmpty } from '@/db'
import { backup as driveBackup, isConnected, lastBackupAt } from '@/services/drive'

import AppSidebar from '@/components/AppSidebar.vue'
import CommandPalette from '@/components/CommandPalette.vue'
import QuickCapture from '@/components/QuickCapture.vue'
import TaskComposer from '@/components/TaskComposer.vue'
import ConfirmDialog from '@/components/ConfirmDialog.vue'
import ToastHost from '@/components/ToastHost.vue'
import { X } from 'lucide-vue-next'

const ui = useUIStore()
const route = useRoute()


onMounted(async () => {
  await db.open()
  await seedIfEmpty()
  await Promise.all([
    useYearsStore().load(),
    useGoalsStore().load(),
    useProjectsStore().load(),
    useTasksStore().load(),
    useNotesStore().load(),
    useBookmarksStore().load(),
    useFinanceStore().load(),
    useAreasStore().load(),
    useReviewsStore().load(),
    useNextStepsStore().load(),
  ])

  window.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault(); ui.closeQuickCapture(); ui.openCommand()
    }
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'n') {
      e.preventDefault(); ui.closeCommand(); ui.openQuickCapture()
    }
    if (e.key === 'Escape') {
      if (ui.commandOpen) ui.closeCommand()
      if (ui.quickCaptureOpen) ui.closeQuickCapture()
      if (ui.taskEditOpen) ui.closeTaskEdit()
    }
  })

  // Auto backup check
  function checkAutoBackup() {
    if (!isConnected()) return
    const last = lastBackupAt()
    const today = new Date().toISOString().slice(0, 10)
    const lastDate = last ? new Date(last).toISOString().slice(0, 10) : null

    if (today !== lastDate) {
      driveBackup().catch(err => console.error("Auto-backup failed:", err))
    }
  }

  checkAutoBackup()
  setInterval(checkAutoBackup, 1000 * 60 * 60) // Check every hour
})

watch(() => route.fullPath, () => {
  // close overlays on navigation
  ui.closeCommand(); ui.closeQuickCapture(); ui.closeTaskEdit()
})
</script>

<template>
  <div class="min-h-screen bg-canvas text-ink flex" data-testid="app-root">
    <AppSidebar />
    <main class="flex-1 min-w-0 relative">
      <router-view v-slot="{ Component }">
        <transition name="fade" mode="out-in">
          <component :is="Component" />
        </transition>
      </router-view>
    </main>
    <CommandPalette v-if="ui.commandOpen" />
    <QuickCapture v-if="ui.quickCaptureOpen" />

    <!-- TASK EDIT MODAL -->
    <div v-if="ui.taskEditOpen" class="fixed inset-0 z-40 flex items-start justify-center pt-24 px-4" data-testid="task-edit-overlay">
      <div class="fixed inset-0 bg-ink/40 backdrop-blur-sm animate-fade-in" @click="ui.closeTaskEdit"></div>
      <div class="relative w-full max-w-xl card p-8 shadow-xl shadow-black/10 animate-rise-in">
        <button class="absolute top-4 right-4 btn-ghost !p-1.5" @click="ui.closeTaskEdit" data-testid="task-edit-close">
          <X class="w-4 h-4" />
        </button>
        <div class="mb-5">
          <div class="overline">Edit task</div>
          <h2 class="font-serif text-2xl mt-1">Make adjustments</h2>
        </div>
        <TaskComposer :initial-task="ui.taskToEdit" @close="ui.closeTaskEdit" />
      </div>
    </div>

    <ConfirmDialog v-if="ui.confirmState" />
    <ToastHost />
  </div>
</template>
