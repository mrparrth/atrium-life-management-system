<script setup>
import { onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
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
import { useWorkClientsStore } from '@/stores/workClients'
import { useWorkItemsStore } from '@/stores/workItems'
import { useWorkLeadsStore } from '@/stores/workLeads'
import { useWorkInvoicesStore } from '@/stores/workInvoices'
import { useWorkMeetingsStore } from '@/stores/workMeetings'
import { useWorkForecastStore } from '@/stores/workForecast'
import { useWorkTemplatesStore } from '@/stores/workTemplates'
import { useWorkResourcesStore } from '@/stores/workResources'
import { db, seedIfEmpty } from '@/db'
import { backup as driveBackup, isConnected, lastBackupAt, autoBackup } from '@/services/drive'
import { initNotificationsOnLoad } from '@/lib/notifications'


import AppSidebar from '@/components/AppSidebar.vue'
import CommandPalette from '@/components/CommandPalette.vue'
import QuickCapture from '@/components/QuickCapture.vue'
import TaskComposer from '@/components/TaskComposer.vue'
import ConfirmDialog from '@/components/ConfirmDialog.vue'
import ToastHost from '@/components/ToastHost.vue'
import { X } from 'lucide-vue-next'

const ui = useUIStore()
const route = useRoute()
const router = useRouter()


onMounted(async () => {
  initNotificationsOnLoad()
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
    useWorkClientsStore().load(),
    useWorkItemsStore().load(),
    useWorkLeadsStore().load(),
    useWorkInvoicesStore().load(),
    useWorkMeetingsStore().load(),
    useWorkForecastStore().load(),
    useWorkTemplatesStore().load(),
    useWorkResourcesStore().load(),
  ])

  // Dynamic periodic auto-backup check (runs silent checks in the background)
  setTimeout(() => autoBackup(), 5000)
  setInterval(() => autoBackup(), 60000) // check every minute, actual backup respects interval setting

  window.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === '1') {
      const forecastNext = document.querySelector('.forecasting-next-btn')
      if (forecastNext) {
        e.preventDefault()
        forecastNext.click()
      } else {
        const btn = document.querySelector('.btn-primary')
        if (btn) {
          e.preventDefault()
          btn.click()
        }
      }
    }
    if ((e.metaKey || e.ctrlKey) && e.key === '2') {
      const forecastPrev = document.querySelector('.forecasting-prev-btn')
      if (forecastPrev) {
        e.preventDefault()
        forecastPrev.click()
      } else {
        const btn = document.querySelector('.btn-secondary')
        if (btn) {
          e.preventDefault()
          btn.click()
        } else {
          const input = document.querySelector('input:not([type="hidden"]):not([type="checkbox"]):not([type="radio"]), textarea')
          if (input) {
            e.preventDefault()
            input.focus()
          }
        }
      }
    }
    if ((e.metaKey || e.ctrlKey) && e.key === '3') {
      const quickInput = document.querySelector('.dashboard-quick-input')
      if (quickInput) {
        e.preventDefault()
        quickInput.focus()
      } else {
        const btn = document.querySelector('.btn-tertiary')
        if (btn) {
          e.preventDefault()
          btn.click()
        }
      }
    }
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault(); ui.closeQuickCapture(); ui.openCommand()
    }
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'n') {
      e.preventDefault();
      ui.closeCommand();
      if (ui.mode === 'work') {
        router.push('/work/notes?new=true')
      } else {
        ui.openQuickCapture()
      }
    }
    if (e.altKey && (e.code === 'KeyM' || e.code === 'KeyW')) {
      e.preventDefault();
      ui.toggleMode();
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

// Sync and preserve active routes per mode
watch(() => route.fullPath, (newPath) => {
  if (!newPath) return

  // Close overlays on navigation
  ui.closeCommand()
  ui.closeQuickCapture()
  ui.closeTaskEdit()

  // Avoid tracking or setting mode on shared settings page
  if (newPath.startsWith('/settings')) {
    return
  }

  // Detect mode based on route path
  if (newPath.startsWith('/work')) {
    if (ui.mode !== 'work') {
      ui.mode = 'work'
      localStorage.setItem('atrium.mode', 'work')
    }
    localStorage.setItem('atrium.last_path.work', newPath)
  } else if (newPath === '/') {
    // Shared root dashboard path - track for the currently active mode
    if (ui.mode === 'work') {
      localStorage.setItem('atrium.last_path.work', newPath)
    } else {
      localStorage.setItem('atrium.last_path.personal', newPath)
    }
  } else {
    // All other routes are personal context
    if (ui.mode !== 'personal') {
      ui.mode = 'personal'
      localStorage.setItem('atrium.mode', 'personal')
    }
    localStorage.setItem('atrium.last_path.personal', newPath)
  }
}, { immediate: true })

// Redirect to last tab when mode is switched (e.g. from the sidebar toggle)
watch(() => ui.mode, (newMode) => {
  const targetPath = newMode === 'work'
    ? (localStorage.getItem('atrium.last_path.work') || '/')
    : (localStorage.getItem('atrium.last_path.personal') || '/')

  if (route.fullPath !== targetPath) {
    router.push(targetPath)
  }
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
