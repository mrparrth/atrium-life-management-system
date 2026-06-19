<script setup>
import { computed, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter, RouterLink } from 'vue-router'
import { useUIStore } from '@/stores/ui'
import {
  LayoutGrid, Sun, Moon, CheckSquare, FolderKanban, Compass,
  BookOpen, Archive, Calendar, Target, NotebookPen, Bookmark,
  Wallet, Sparkles, Settings, Command, Plus, ListChecks, GitFork,
  TrendingUp, Briefcase, Receipt, BarChart2
} from 'lucide-vue-next'

const ui = useUIStore()
const route = useRoute()
const router = useRouter()

const RAW_SECTIONS_PERSONAL = [
  {
    label: 'Today',
    items: [
      { to: '/', name: 'Dashboard', icon: LayoutGrid, testid: 'nav-dashboard' },
      { to: '/today', name: 'Today focus', icon: Sparkles, testid: 'nav-today' },
      { to: '/next-steps', name: 'Next steps', icon: ListChecks, testid: 'nav-next-steps' },
    ],
  },
  {
    label: 'Horizon',
    items: [
      { to: '/tasks', name: 'Tasks', icon: CheckSquare, testid: 'nav-tasks' },
      { to: '/goals', name: 'Goals', icon: Target, testid: 'nav-goals' },
      { to: '/years', name: 'Years', icon: Calendar, testid: 'nav-years' },
      { to: '/summary', name: 'Summary', icon: TrendingUp, testid: 'nav-summary' },
      { to: '/pipeline', name: 'Pipeline', icon: GitFork, testid: 'nav-pipeline' },
    ],
  },
  {
    label: 'PARA',
    items: [
      { to: '/projects', name: 'Projects', icon: FolderKanban, testid: 'nav-projects' },
      { to: '/areas', name: 'Areas', icon: Compass, testid: 'nav-areas' },
      { to: '/resources', name: 'Resources', icon: BookOpen, testid: 'nav-resources' },
      { to: '/archives', name: 'Archives', icon: Archive, testid: 'nav-archives' },
    ],
  },
  {
    label: 'Memory',
    items: [
      { to: '/notes', name: 'Notes', icon: NotebookPen, testid: 'nav-notes' },
      { to: '/bookmarks', name: 'Bookmarks', icon: Bookmark, testid: 'nav-bookmarks' },
      { to: '/follows', name: 'Follows', icon: Compass, testid: 'nav-follows' },
      { to: '/finance', name: 'Finance', icon: Wallet, testid: 'nav-finance' },
      { to: '/reviews', name: 'Reviews', icon: Sparkles, testid: 'nav-reviews' },
    ],
  },
]

const RAW_SECTIONS_WORK = [
  {
    label: 'Briefing',
    items: [
      { to: '/', name: 'Dashboard', icon: LayoutGrid, testid: 'nav-work-dashboard' },
    ],
  },
  {
    label: 'Operations',
    items: [
      { to: '/work/clients', name: 'Clients', icon: Briefcase, testid: 'nav-work-clients' },
      { to: '/work/items', name: 'Work items', icon: FolderKanban, testid: 'nav-work-items' },
      { to: '/work/notes', name: 'Notes', icon: NotebookPen, testid: 'nav-work-notes' },
      { to: '/work/resources', name: 'Resources', icon: BookOpen, testid: 'nav-work-resources' },
    ],
  },
  {
    label: 'Business',
    items: [
      { to: '/work/leads', name: 'Leads', icon: Target, testid: 'nav-work-leads' },
      { to: '/work/forecasting', name: 'Forecasting', icon: BarChart2, testid: 'nav-work-forecasting' },
      { to: '/work/invoices', name: 'Invoices', icon: Receipt, testid: 'nav-work-invoices' },
      { to: '/work/analytics', name: 'Analytics', icon: TrendingUp, testid: 'nav-work-analytics' },
    ],
  },
  {
    label: 'System',
    items: [
      { to: '/work/archive', name: 'Archive', icon: Archive, testid: 'nav-work-archive' },
    ],
  }
]

const usedShortcuts = new Set()
function assignShortcut(name) {
  for (let i = 0; i < name.length; i++) {
    const char = name[i].toLowerCase()
    if (char.match(/[a-z]/) && !usedShortcuts.has(char)) {
      usedShortcuts.add(char)
      return { char, index: i }
    }
  }
  return null
}

const sections = computed(() => {
  usedShortcuts.clear()
  const raw = ui.mode === 'work' ? RAW_SECTIONS_WORK : RAW_SECTIONS_PERSONAL
  return raw.map(section => ({
    ...section,
    items: section.items.map(item => ({
      ...item,
      shortcut: assignShortcut(item.name)
    }))
  }))
})

const settingsItem = computed(() => {
  return { to: '/settings', name: 'Settings', shortcut: null }
})

function getHighlightedName(name, shortcut) {
  if (!shortcut) return [{ text: name, highlight: false }]
  return [
    { text: name.slice(0, shortcut.index), highlight: false },
    { text: name[shortcut.index], highlight: true },
    { text: name.slice(shortcut.index + 1), highlight: false }
  ]
}

function isActive(to) { return route.path === to || (to !== '/' && route.path.startsWith(to)) }

function handleKeydown(e) {
  if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName) || e.target.isContentEditable) return
  if (e.metaKey || e.ctrlKey || e.altKey) return

  const key = e.key.toLowerCase()
  if (settingsItem.value.shortcut?.char === key) {
    e.preventDefault(); router.push(settingsItem.value.to)
    return
  }

  for (const section of sections.value) {
    for (const item of section.items) {
      if (item.shortcut?.char === key) {
        e.preventDefault()
        router.push(item.to)
        return
      }
    }
  }
}

function handleQuickCaptureClick() {
  if (ui.mode === 'work') {
    router.push('/work/items?new=true')
  } else {
    ui.openQuickCapture()
  }
}

onMounted(() => window.addEventListener('keydown', handleKeydown))
onUnmounted(() => window.removeEventListener('keydown', handleKeydown))
</script>

<template>
  <aside class="w-64 shrink-0 hidden md:flex flex-col bg-elevated border-r border-line h-screen sticky top-0"
    data-testid="sidebar">
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

      <!-- Pill sliding switch for Work/Personal Mode -->
      <div
        class="flex items-center bg-canvas border border-line-2 rounded-full p-1 relative cursor-pointer select-none shadow-[inset_0_2px_4px_rgba(0,0,0,0.15)] hover:border-ink-3 transition-colors"
        @click="ui.toggleMode" :title="`Switch to ${ui.mode === 'work' ? 'Personal' : 'Work'} Mode`"
        data-testid="mode-toggle">
        <!-- Sliding background block (tactile 3D thumb) -->
        <div
          class="absolute top-1 bottom-1 left-1 w-[calc(50%-4px)] bg-gradient-to-b from-ink/90 to-ink rounded-full transition-all duration-300 transform shadow-[0_3px_6px_rgba(0,0,0,0.35),_0_1px_3px_rgba(0,0,0,0.2),_inset_0_1.5px_0_rgba(255,255,255,0.25)] border border-black/50"
          :class="ui.mode === 'work' ? 'translate-x-[100%]' : 'translate-x-0'"></div>

        <!-- Personal Icon (Sparkles) -->
        <div class="relative z-10 flex items-center justify-center w-7 h-7 rounded-full transition-colors duration-300"
          :class="ui.mode === 'personal' ? 'text-canvas' : 'text-ink-3 hover:text-ink-2'">
          <Sparkles class="w-3.5 h-3.5" />
        </div>

        <!-- Work Icon (Briefcase) -->
        <div class="relative z-10 flex items-center justify-center w-7 h-7 rounded-full transition-colors duration-300"
          :class="ui.mode === 'work' ? 'text-canvas' : 'text-ink-3 hover:text-ink-2'">
          <Briefcase class="w-3.5 h-3.5" />
        </div>
      </div>
    </div>

    <!-- THEME TOGGLE (FLOATING BOTTOM RIGHT) -->
    <Teleport to="body">
      <button
        class="fixed bottom-6 right-6 z-50 p-2.5 rounded-full border border-line bg-surface/90 text-ink shadow-lg backdrop-blur-sm cursor-pointer hover:border-line-2 transition-colors flex items-center justify-center"
        @click="ui.toggleTheme" :title="`Switch to ${ui.theme === 'dark' ? 'light' : 'dark'}`"
        data-testid="theme-toggle">
        <Sun v-if="ui.theme === 'dark'" class="w-4 h-4 text-pri-interruptive" />
        <Moon v-else class="w-4 h-4 text-pri-strategic" />
      </button>
    </Teleport>

    <button @click="ui.openCommand"
      class="mx-4 mb-2 flex items-center justify-between gap-2 px-3 py-2 rounded-xl border border-line bg-surface text-ink-2 hover:text-ink hover:border-line-2 transition-all duration-300"
      data-testid="command-trigger">
      <span class="flex items-center gap-2 text-sm">
        <Command class="w-3.5 h-3.5" />
        Search & jump…
      </span>
      <span class="flex items-center gap-1">
        <span class="kbd">⌘</span><span class="kbd">K</span>
      </span>
    </button>

    <button @click="handleQuickCaptureClick"
      class="mx-4 mb-4 flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-ink text-canvas hover:opacity-90 transition-opacity duration-300 text-sm font-medium"
      data-testid="quick-capture-trigger">
      <span class="flex items-center gap-2">
        <Plus class="w-3.5 h-3.5" />
        {{ ui.mode === 'work' ? 'New task' : 'Quick capture' }}
      </span>
      <span class="flex items-center gap-1">
        <span class="kbd !bg-canvas/20 !border-canvas/10 !text-canvas">⌘</span>
        <span class="kbd !bg-canvas/20 !border-canvas/10 !text-canvas">N</span>
      </span>
    </button>

    <nav class="flex-1 overflow-y-auto px-3 pb-4 space-y-6">
      <div v-for="section in sections" :key="section.label">
        <div class="overline px-3 pb-2">{{ section.label }}</div>
        <ul class="space-y-0.5">
          <li v-for="item in section.items" :key="item.to">
            <RouterLink :to="item.to" :data-testid="item.testid"
              class="flex items-center gap-3 px-3 py-2 rounded-xl text-sm transition-all duration-300" :class="isActive(item.to)
                ? 'text-ink font-medium bg-surface border border-line'
                : 'text-ink-2 hover:text-ink hover:bg-surface/60 border border-transparent'">
              <component :is="item.icon" class="w-4 h-4" :class="isActive(item.to) ? 'text-ink' : 'text-ink-3'" />
              <span>
                <span v-for="(part, i) in getHighlightedName(item.name, item.shortcut)" :key="i"
                  :class="{ 'underline decoration-ink/40 underline-offset-2': part.highlight }">{{ part.text }}</span>
              </span>
            </RouterLink>
          </li>
        </ul>
      </div>
    </nav>

    <div class="px-3 pb-5 pt-2 border-t border-line">
      <RouterLink to="/settings"
        class="flex items-center gap-3 px-3 py-2 rounded-xl text-sm text-ink-2 hover:text-ink hover:bg-surface/60 transition-all duration-300"
        data-testid="nav-settings">
        <Settings class="w-4 h-4 text-ink-3" />
        <span>
          <span v-for="(part, i) in getHighlightedName(settingsItem.name, settingsItem.shortcut)" :key="i"
            :class="{ 'underline decoration-ink/40 underline-offset-2': part.highlight }">{{ part.text }}</span>
        </span>
      </RouterLink>
    </div>
  </aside>
</template>
