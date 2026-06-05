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
import { db, seedIfEmpty } from '@/db'

import AppSidebar from '@/components/AppSidebar.vue'
import CommandPalette from '@/components/CommandPalette.vue'
import QuickCapture from '@/components/QuickCapture.vue'
import ToastHost from '@/components/ToastHost.vue'

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
  ])

  window.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault(); ui.openCommand()
    }
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'n') {
      e.preventDefault(); ui.openQuickCapture()
    }
    if (e.key === 'Escape') {
      if (ui.commandOpen) ui.closeCommand()
      if (ui.quickCaptureOpen) ui.closeQuickCapture()
    }
  })
})

watch(() => route.fullPath, () => {
  // close overlays on navigation
  ui.closeCommand(); ui.closeQuickCapture()
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
    <ToastHost />
  </div>
</template>
