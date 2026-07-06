<script setup>
import { onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useUIStore } from '@/stores/ui'
import { useTasksStore } from '@/stores/tasks'
import { useProjectsStore } from '@/stores/projects'
import { useGoalsStore } from '@/stores/goals'
import { useYearsStore } from '@/stores/years'
import { useNotesStore } from '@/stores/notes'
import { useWorkNotesStore } from '@/stores/workNotes'
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
import { autoOfflineBackup } from '@/services/offlineSync'
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
const tasksStore = useTasksStore()
const workItemsStore = useWorkItemsStore()

import { ref, computed } from 'vue'
import { todayFocus } from '@/lib/resurface'
import dayjs from 'dayjs'

const openPersonalTasksCount = computed(() => {
  return todayFocus(tasksStore.items).length
})

const openWorkTasksCount = computed(() => {
  const today = dayjs().format('YYYY-MM-DD')
  const now = new Date(); now.setHours(0, 0, 0, 0)
  return workItemsStore.items.filter(w => {
    if (workItemsStore.isCompleted(w.status)) return false
    if (w.snoozedUntil) {
      const until = new Date(w.snoozedUntil); until.setHours(0, 0, 0, 0)
      if (until > now) return false
    }
    return !w.dueDate || w.dueDate <= today
  }).length
})

const showBanner = computed(() => {
  if (!ui.showWorkspaceAlerts) return false
  if (ui.mode === 'work') {
    return openPersonalTasksCount.value > 0
  } else {
    return openWorkTasksCount.value > 0
  }
})

function dismissBanner() {
  ui.showWorkspaceAlerts = false
}

function switchSpace() {
  ui.mode = ui.mode === 'work' ? 'personal' : 'work'
}


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
    useWorkNotesStore().load(),
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
  setTimeout(() => { autoBackup(); autoOfflineBackup(); }, 5000)
  setInterval(() => { autoBackup(); autoOfflineBackup(); }, 60000) // check every minute, actual backup respects interval setting

  // Check if first run or reset
  const isFirstRun = localStorage.getItem('atrium.initialized') !== 'true'
  if (isFirstRun) {
    localStorage.setItem('atrium.initialized', 'true')
    setTimeout(async () => {
      await ui.confirm({
        title: 'Welcome',
        message: 'Enter your preferences in Settings',
        confirmText: 'Go to Settings',
        cancelText: 'Ignore',
        isDestructive: false
      })
      router.push('/settings')
    }, 1000)
  }

  window.addEventListener('keydown', (e) => {
    const isClientDetail = route.path && route.path.includes('/work/clients/')

    if ((e.metaKey || e.ctrlKey) && e.key === '1') {
      if (isClientDetail) return
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
      if (isClientDetail) return
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
        router.push('/work/items?new=true')
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

  // Auto-reload stores when active/visible or every 5 mins
  async function reloadAllStores() {
    try {
      await Promise.all([
        useYearsStore().load(),
        useGoalsStore().load(),
        useProjectsStore().load(),
        useTasksStore().load(),
        useNotesStore().load(),
        useWorkNotesStore().load(),
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
    } catch (e) {
      console.error('Failed to auto-reload stores:', e)
    }
  }

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      reloadAllStores()
    }
  })
  setInterval(reloadAllStores, 5 * 60 * 1000)
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
    <main class="flex-1 min-w-0 relative flex flex-col">
      <!-- Cross-Workspace Task Alert Banner -->
      <div v-if="showBanner"
        class="w-full bg-surface border-b border-line px-6 py-2.5 flex items-center justify-between text-xs text-ink-2 select-none z-30 animate-fade-in shrink-0">
        <div class="flex items-center gap-2">
          <span class="inline-flex w-1.5 h-1.5 rounded-full bg-pri-strategic animate-pulse"></span>
          <span>
            You have <strong class="text-ink font-semibold">{{ ui.mode === 'work' ? openPersonalTasksCount :
              openWorkTasksCount }}</strong> tasks to complete today in {{ ui.mode === 'work' ? 'PERSONAL' : 'WORK' }}
            space.
          </span>
          <button @click="switchSpace" class="ml-2 text-ink hover:underline font-semibold cursor-pointer">
            Switch context
          </button>
        </div>
        <button @click="dismissBanner"
          class="text-ink-3 hover:text-ink p-1 rounded-lg hover:bg-canvas transition-all cursor-pointer">
          <X class="w-3.5 h-3.5" />
        </button>
      </div>

      <div class="flex-1 min-h-0 relative">
        <router-view v-slot="{ Component }">
          <transition name="fade" mode="out-in">
            <component :is="Component" />
          </transition>
        </router-view>
      </div>
    </main>
    <CommandPalette v-if="ui.commandOpen" />
    <QuickCapture v-if="ui.quickCaptureOpen" />

    <!-- TASK EDIT MODAL -->
    <div v-if="ui.taskEditOpen" class="fixed inset-0 z-40 flex items-center justify-center p-4"
      data-testid="task-edit-overlay">
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
