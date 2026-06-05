<script setup>
import { computed } from 'vue'
import { useRoute, RouterLink } from 'vue-router'
import { useUIStore } from '@/stores/ui'
import {
  LayoutGrid, Sun, Moon, CheckSquare, FolderKanban, Compass,
  BookOpen, Archive, Calendar, Target, NotebookPen, Bookmark,
  Wallet, Sparkles, Settings, Command, Plus, ListChecks
} from 'lucide-vue-next'

const ui = useUIStore()
const route = useRoute()

const sections = computed(() => ([
  {
    label: 'Today',
    items: [
      { to: '/', name: 'Dashboard', icon: LayoutGrid, testid: 'nav-dashboard' },
      { to: '/today', name: 'Today focus', icon: Sparkles, testid: 'nav-today' },
    ],
  },
  {
    label: 'PARA',
    items: [
      { to: '/projects', name: 'Projects', icon: FolderKanban, testid: 'nav-projects' },
      { to: '/areas',    name: 'Areas',    icon: Compass,      testid: 'nav-areas' },
      { to: '/resources',name: 'Resources',icon: BookOpen,     testid: 'nav-resources' },
      { to: '/archives', name: 'Archives', icon: Archive,      testid: 'nav-archives' },
    ],
  },
  {
    label: 'Horizon',
    items: [
      { to: '/years',  name: 'Years',  icon: Calendar, testid: 'nav-years' },
      { to: '/goals',  name: 'Goals',  icon: Target,   testid: 'nav-goals' },
      { to: '/tasks',  name: 'Tasks',  icon: CheckSquare, testid: 'nav-tasks' },
      { to: '/next-steps', name: 'Next steps', icon: ListChecks, testid: 'nav-next-steps' },
    ],
  },
  {
    label: 'Memory',
    items: [
      { to: '/notes',     name: 'Notes',     icon: NotebookPen, testid: 'nav-notes' },
      { to: '/bookmarks', name: 'Bookmarks', icon: Bookmark,    testid: 'nav-bookmarks' },
      { to: '/finance',   name: 'Finance',   icon: Wallet,      testid: 'nav-finance' },
      { to: '/reviews',   name: 'Reviews',   icon: Sparkles,    testid: 'nav-reviews' },
    ],
  },
]))

function isActive(to) { return route.path === to || (to !== '/' && route.path.startsWith(to)) }
</script>

<template>
  <aside class="w-64 shrink-0 hidden md:flex flex-col bg-elevated border-r border-line h-screen sticky top-0" data-testid="sidebar">
    <div class="px-5 pt-6 pb-4 flex items-center justify-between">
      <RouterLink to="/" class="flex items-center gap-2 group" data-testid="brand-link">
        <span class="w-7 h-7 rounded-full bg-ink flex items-center justify-center">
          <span class="w-2 h-2 rounded-full bg-canvas"></span>
        </span>
        <div class="leading-tight">
          <div class="font-serif text-lg tracking-tight">Atrium</div>
          <div class="text-[10px] uppercase tracking-overline text-ink-3">quiet system</div>
        </div>
      </RouterLink>
      <button class="btn-ghost !p-2" @click="ui.toggleTheme" :title="`Switch to ${ui.theme === 'dark' ? 'light' : 'dark'}`" data-testid="theme-toggle">
        <Sun v-if="ui.theme === 'dark'" class="w-4 h-4" />
        <Moon v-else class="w-4 h-4" />
      </button>
    </div>

    <button @click="ui.openCommand" class="mx-4 mb-2 flex items-center justify-between gap-2 px-3 py-2 rounded-xl border border-line bg-surface text-ink-2 hover:text-ink hover:border-line-2 transition-all duration-300" data-testid="command-trigger">
      <span class="flex items-center gap-2 text-sm">
        <Command class="w-3.5 h-3.5" />
        Search & jump…
      </span>
      <span class="flex items-center gap-1">
        <span class="kbd">⌘</span><span class="kbd">K</span>
      </span>
    </button>

    <button @click="ui.openQuickCapture" class="mx-4 mb-4 flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-ink text-canvas hover:opacity-90 transition-opacity duration-300 text-sm font-medium" data-testid="quick-capture-trigger">
      <Plus class="w-3.5 h-3.5" /> Quick capture
    </button>

    <nav class="flex-1 overflow-y-auto px-3 pb-4 space-y-6">
      <div v-for="section in sections" :key="section.label">
        <div class="overline px-3 pb-2">{{ section.label }}</div>
        <ul class="space-y-0.5">
          <li v-for="item in section.items" :key="item.to">
            <RouterLink :to="item.to" :data-testid="item.testid"
              class="flex items-center gap-3 px-3 py-2 rounded-xl text-sm transition-all duration-300"
              :class="isActive(item.to)
                ? 'text-ink font-medium bg-surface border border-line'
                : 'text-ink-2 hover:text-ink hover:bg-surface/60 border border-transparent'">
              <component :is="item.icon" class="w-4 h-4" :class="isActive(item.to) ? 'text-ink' : 'text-ink-3'" />
              <span>{{ item.name }}</span>
            </RouterLink>
          </li>
        </ul>
      </div>
    </nav>

    <div class="px-3 pb-5 pt-2 border-t border-line">
      <RouterLink to="/settings" class="flex items-center gap-3 px-3 py-2 rounded-xl text-sm text-ink-2 hover:text-ink hover:bg-surface/60 transition-all duration-300" data-testid="nav-settings">
        <Settings class="w-4 h-4 text-ink-3" /> Settings
      </RouterLink>
    </div>
  </aside>
</template>
