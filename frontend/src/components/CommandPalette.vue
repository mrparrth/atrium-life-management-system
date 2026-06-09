<script setup>
import { computed, ref, watch, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useUIStore } from '@/stores/ui'
import { useTasksStore } from '@/stores/tasks'
import { useProjectsStore } from '@/stores/projects'
import { useNotesStore } from '@/stores/notes'
import { useBookmarksStore } from '@/stores/bookmarks'
import { useGoalsStore } from '@/stores/goals'
import { Search, ArrowRight, FolderKanban, CheckSquare, NotebookPen, Bookmark, Target, Plus, X } from 'lucide-vue-next'

const ui = useUIStore()
const router = useRouter()
const q = ref('')
const inputEl = ref(null)
const activeIdx = ref(0)

onMounted(() => inputEl.value?.focus())

const tasks = useTasksStore()
const projects = useProjectsStore()
const notes = useNotesStore()
const bookmarks = useBookmarksStore()
const goals = useGoalsStore()

import { useWorkClientsStore } from '@/stores/workClients'
import { useWorkItemsStore } from '@/stores/workItems'
import { useWorkInvoicesStore } from '@/stores/workInvoices'

const workClients = useWorkClientsStore()
const workItems = useWorkItemsStore()
const workInvoices = useWorkInvoicesStore()

const navItemsPersonal = [
  { type: 'nav', label: 'Dashboard', to: '/', icon: 'home' },
  { type: 'nav', label: 'Today focus', to: '/today', icon: 'home' },
  { type: 'nav', label: 'Tasks', to: '/tasks', icon: 'task' },
  { type: 'nav', label: 'Projects', to: '/projects', icon: 'project' },
  { type: 'nav', label: 'Areas', to: '/areas', icon: 'home' },
  { type: 'nav', label: 'Resources', to: '/resources', icon: 'home' },
  { type: 'nav', label: 'Archives', to: '/archives', icon: 'home' },
  { type: 'nav', label: 'Goals', to: '/goals', icon: 'goal' },
  { type: 'nav', label: 'Years', to: '/years', icon: 'home' },
  { type: 'nav', label: 'Notes', to: '/notes', icon: 'note' },
  { type: 'nav', label: 'Bookmarks', to: '/bookmarks', icon: 'bookmark' },
  { type: 'nav', label: 'Finance', to: '/finance', icon: 'home' },
  { type: 'nav', label: 'Reviews', to: '/reviews', icon: 'home' },
]

const navItemsWork = [
  { type: 'nav', label: 'Dashboard Briefing', to: '/', icon: 'home' },
  { type: 'nav', label: 'Clients Directory', to: '/work/clients', icon: 'home' },
  { type: 'nav', label: 'Work Items Scope', to: '/work/items', icon: 'task' },
  { type: 'nav', label: 'Leads Pipeline', to: '/work/leads', icon: 'goal' },
  { type: 'nav', label: 'Forecasting Capacity', to: '/work/forecasting', icon: 'home' },
  { type: 'nav', label: 'Invoices Ledger', to: '/work/invoices', icon: 'note' },
  { type: 'nav', label: 'Analytics Intel', to: '/work/analytics', icon: 'project' },
  { type: 'nav', label: 'Notes Memory', to: '/work/notes', icon: 'note' },
  { type: 'nav', label: 'Workflow SOPs', to: '/work/resources', icon: 'home' },
]

const extraNavPersonal = [
  { type: 'nav', label: 'View Networth', action: () => { ui.closeCommand(); router.push('/finance?tab=networth') }, icon: 'wallet' },
  { type: 'nav', label: 'View CashFlow', action: () => { ui.closeCommand(); router.push('/finance?tab=cashflow') }, icon: 'wallet' },
  { type: 'nav', label: 'Modify Categories', action: () => { ui.closeCommand(); router.push('/finance?tab=categories') }, icon: 'wallet' },
  { type: 'nav', label: 'Year Summary', action: () => { ui.closeCommand(); router.push('/summary?tab=yearly') }, icon: 'goal' },
  { type: 'nav', label: 'YoY summary', action: () => { ui.closeCommand(); router.push('/summary?tab=yoy') }, icon: 'goal' },
]

const extraNavWork = [
  { type: 'nav', label: 'Client Revenue Margins', action: () => { ui.closeCommand(); router.push('/work/analytics') }, icon: 'wallet' },
  { type: 'nav', label: 'Archived Contracts', action: () => { ui.closeCommand(); router.push('/work/archive') }, icon: 'home' },
]

const quickActionsPersonal = [
  { type: 'action', label: 'Quick capture a task', kbd: '⌘N', action: () => { ui.closeCommand(); ui.openQuickCapture() } },
  { type: 'action', label: 'New Project', action: () => { ui.closeCommand(); router.push('/projects?new=1') } },
  { type: 'action', label: 'New Note', action: () => { ui.closeCommand(); router.push('/notes?new=1') } },
  { type: 'action', label: 'New Bookmark', action: () => { ui.closeCommand(); router.push('/bookmarks?new=bookmark') } },
]

const quickActionsWork = [
  { type: 'action', label: 'New Client Profile', action: () => { ui.closeCommand(); router.push('/work/clients') } },
  { type: 'action', label: 'Add Work Item', action: () => { ui.closeCommand(); router.push('/work/items') } },
  { type: 'action', label: 'Draft Invoice', action: () => { ui.closeCommand(); router.push('/work/invoices') } },
  { type: 'action', label: 'Capture Workspace Note', action: () => { ui.closeCommand(); router.push('/work/notes') } },
]

const results = computed(() => {
  const term = q.value.trim().toLowerCase()
  const mode = ui.mode
  const isWork = mode === 'work'

  if (!term) {
    return [
      { group: 'Quick actions', items: isWork ? quickActionsWork : quickActionsPersonal },
      { group: 'Jump to', items: isWork ? extraNavWork : extraNavPersonal }
    ]
  }

  const match = (s) => (s || '').toLowerCase().includes(term)

  const activeNavItems = isWork ? navItemsWork : navItemsPersonal
  const activeExtraNav = isWork ? extraNavWork : extraNavPersonal
  const activeQuickActions = isWork ? quickActionsWork : quickActionsPersonal

  const nav = [...activeNavItems, ...activeExtraNav].filter(n => match(n.label))
  const qa = activeQuickActions.filter(a => match(a.label))

  if (isWork) {
    const clients = workClients.items.filter(c => match(c.name) || match(c.relationshipNotes)).slice(0, 6).map(c => ({ type: 'project', label: c.name, to: `/work/clients/${c.id}`, item: c }))
    const items = workItems.items.filter(i => match(i.title) || match(i.description)).slice(0, 8).map(i => ({ type: 'task', label: i.title, to: `/work/items`, item: i }))
    const invoices = workInvoices.items.filter(inv => match(inv.invoiceNumber)).slice(0, 6).map(inv => ({ type: 'bookmark', label: inv.invoiceNumber, to: `/work/invoices`, item: inv }))
    const wNotes = notes.items.filter(n => (n.tags?.includes('work') || n.clientId) && (match(n.title) || match(n.body))).slice(0, 6).map(n => ({ type: 'note', label: n.title, to: `/work/notes?id=${n.id}`, item: n }))

    const groups = []
    if (qa.length) groups.push({ group: 'Quick actions', items: qa })
    if (nav.length) groups.push({ group: 'Jump to', items: nav })
    if (clients.length) groups.push({ group: 'Clients Workspaces', items: clients })
    if (items.length) groups.push({ group: 'Work Items Scope', items: items })
    if (invoices.length) groups.push({ group: 'Invoices Billing', items: invoices })
    if (wNotes.length) groups.push({ group: 'Work Notes', items: wNotes })
    return groups
  } else {
    const t = tasks.items.filter(t => match(t.title) || match(t.description)).slice(0, 8).map(t => ({ type: 'task', label: t.title, to: `/tasks`, item: t }))
    const p = projects.items.filter(p => match(p.title) || match(p.description)).slice(0, 6).map(p => ({ type: 'project', label: p.title, to: `/projects/${p.id}`, item: p }))
    const n = notes.items.filter(n => match(n.title) || match(n.body)).slice(0, 6).map(n => ({ type: 'note', label: n.title, to: `/notes/${n.id}`, item: n }))
    const b = bookmarks.items.filter(b => match(b.title) || match(b.url)).slice(0, 6).map(b => ({ type: 'bookmark', label: b.title, url: b.url, item: b }))
    const g = goals.items.filter(g => match(g.title)).slice(0, 4).map(g => ({ type: 'goal', label: g.title, to: '/goals', item: g }))

    const groups = []
    if (qa.length) groups.push({ group: 'Quick actions', items: qa })
    if (nav.length) groups.push({ group: 'Jump to', items: nav })
    if (t.length) groups.push({ group: 'Tasks', items: t })
    if (p.length) groups.push({ group: 'Projects', items: p })
    if (n.length) groups.push({ group: 'Notes', items: n })
    if (b.length) groups.push({ group: 'Bookmarks', items: b })
    if (g.length) groups.push({ group: 'Goals', items: g })
    return groups
  }
})

const flatItems = computed(() => results.value.flatMap(g => g.items))
watch(q, () => { activeIdx.value = 0 })

function iconFor(type) {
  return { task: CheckSquare, project: FolderKanban, note: NotebookPen, bookmark: Bookmark, goal: Target, nav: ArrowRight, action: Plus }[type] || ArrowRight
}

function run(item) {
  if (item.action) return item.action()
  if (item.to) { router.push(item.to); ui.closeCommand(); return }
  if (item.url) { window.open(item.url, '_blank'); ui.closeCommand(); return }
}

function onKey(e) {
  if (e.key === 'ArrowDown') { e.preventDefault(); activeIdx.value = Math.min(flatItems.value.length - 1, activeIdx.value + 1) }
  if (e.key === 'ArrowUp') { e.preventDefault(); activeIdx.value = Math.max(0, activeIdx.value - 1) }
  if (e.key === 'Enter') { e.preventDefault(); const item = flatItems.value[activeIdx.value]; if (item) run(item) }

  if (e.metaKey && !e.shiftKey && !e.altKey && !e.ctrlKey) {
    const num = parseInt(e.key)
    if (!isNaN(num)) {
      e.preventDefault()
      const index = num === 0 ? 9 : num - 1
      const item = flatItems.value[index]
      if (item) run(item)
    }
  }
}
</script>

<template>
  <div class="fixed inset-0 z-50 flex items-start justify-center pt-[12vh] px-4" data-testid="command-palette">
    <div class="fixed inset-0 bg-ink/40 backdrop-blur-sm animate-fade-in" @click="ui.closeCommand"></div>
    <div class="relative w-full max-w-2xl card overflow-hidden shadow-2xl shadow-black/20 animate-rise-in">
      <div class="flex items-center gap-3 px-5 py-4 border-b border-line">
        <Search class="w-4 h-4 text-ink-3" />
        <input ref="inputEl" v-model="q" @keydown="onKey" placeholder="Search tasks, projects, notes, bookmarks…"
          class="flex-1 bg-transparent outline-none text-ink placeholder:text-ink-3 text-base"
          data-testid="command-input" />
        <button class="btn-ghost !p-1.5" @click="ui.closeCommand" data-testid="command-close">
          <X class="w-4 h-4" />
        </button>
      </div>

      <div class="max-h-[60vh] overflow-y-auto px-2 py-2">
        <template v-if="flatItems.length">
          <div v-for="group in results" :key="group.group" class="mb-2">
            <div class="overline px-3 py-2">{{ group.group }}</div>
            <ul>
              <li v-for="(item, i) in group.items" :key="(item.to || item.label) + i" :class="[
                'flex items-center justify-between gap-3 px-3 py-2 rounded-xl cursor-pointer text-sm transition-colors duration-200',
                flatItems.indexOf(item) === activeIdx ? 'bg-elevated text-ink' : 'text-ink-2 hover:bg-elevated/60'
              ]" @mouseenter="activeIdx = flatItems.indexOf(item)" @click="run(item)"
                :data-testid="`command-result-${item.type}`">
                <span class="flex items-center gap-3 min-w-0">
                  <component :is="iconFor(item.type)" class="w-4 h-4 text-ink-3 shrink-0" />
                  <span class="truncate">{{ item.label }}</span>
                </span>
                <div class="flex items-center gap-2 shrink-0">
                  <span v-if="item.kbd" class="kbd">{{ item.kbd }}</span>
                  <span v-else-if="flatItems.indexOf(item) < 10" class="kbd text-ink-3">⌘{{ flatItems.indexOf(item) ===
                    9 ? 0 : flatItems.indexOf(item) + 1 }}</span>
                </div>
              </li>
            </ul>
          </div>
        </template>
        <div v-else class="px-5 py-10 text-center text-ink-3 text-sm font-serif italic">Nothing here yet - try a
          different word.
        </div>
      </div>

      <div class="px-4 py-2.5 border-t border-line flex items-center gap-4 text-[11px] text-ink-3">
        <span class="flex items-center gap-1.5"><span class="kbd">↑</span><span class="kbd">↓</span> navigate</span>
        <span class="flex items-center gap-1.5"><span class="kbd">↵</span> select</span>
        <span class="flex items-center gap-1.5 ml-auto"><span class="kbd">esc</span> close</span>
      </div>
    </div>
  </div>
</template>
