import { createRouter, createWebHashHistory } from 'vue-router'

const routes = [
  { path: '/', name: 'landing', component: () => import('@/views/Landing.vue') },
  { path: '/dashboard', name: 'dashboard', component: () => import('@/views/Dashboard.vue') },
  { path: '/today', name: 'today', component: () => import('@/views/Today.vue') },
  { path: '/tasks', name: 'tasks', component: () => import('@/views/Tasks.vue') },
  { path: '/next-steps', name: 'next-steps', component: () => import('@/views/NextSteps.vue') },
  { path: '/projects', name: 'projects', component: () => import('@/views/Projects.vue') },
  { path: '/projects/:id', name: 'project', component: () => import('@/views/ProjectDetail.vue'), props: true },
  { path: '/archives', name: 'archives', component: () => import('@/views/Archives.vue') },
  { path: '/years', name: 'years', component: () => import('@/views/Years.vue') },
  { path: '/goals', name: 'goals', component: () => import('@/views/Goals.vue') },
  { path: '/goals/:id', name: 'goal', component: () => import('@/views/GoalDetail.vue'), props: true },
  { path: '/notes', name: 'notes', component: () => import('@/views/Notes.vue') },
  { path: '/notes/graph', name: 'note-graph', component: () => import('@/views/NoteGraph.vue') },
  { path: '/notes/new', name: 'note-new', component: () => import('@/views/NoteDetail.vue'), props: { id: 'new' } },
  { path: '/notes/:id', name: 'note', component: () => import('@/views/NoteDetail.vue'), props: true },
  { path: '/bookmarks', name: 'bookmarks', component: () => import('@/views/Bookmarks.vue') },
  { path: '/bookmarks/page/:id', name: 'bookmark-page', component: () => import('@/views/BookmarkPageDetail.vue'), props: true },
  { path: '/finance', name: 'finance', component: () => import('@/views/Finance.vue') },
  { path: '/reviews', name: 'reviews', component: () => import('@/views/Reviews.vue') },
  { path: '/settings', name: 'settings', component: () => import('@/views/Settings.vue') },
  { path: '/summary', name: 'summary', component: () => import('@/views/Summary.vue') },
  { path: '/habits', name: 'habits', component: () => import('@/views/Habits.vue') },
  { path: '/radar', name: 'radar', component: () => import('@/views/Follows.vue') },
  
  // Work Mode Routes
  { path: '/work/clients', name: 'work-clients', component: () => import('@/views/work/WorkClients.vue') },
  { path: '/work/clients/:id', name: 'work-client-detail', component: () => import('@/views/work/WorkClientDetail.vue'), props: true },
  { path: '/work/items', name: 'work-items', component: () => import('@/views/work/WorkItems.vue') },
  { path: '/work/leads', name: 'work-leads', component: () => import('@/views/work/WorkLeads.vue') },
  { path: '/work/forecasting', name: 'work-forecasting', component: () => import('@/views/work/WorkForecasting.vue') },
  { path: '/work/invoices', name: 'work-invoices', component: () => import('@/views/work/WorkInvoices.vue') },
  { path: '/work/analytics', name: 'work-analytics', component: () => import('@/views/work/WorkAnalytics.vue') },
  { path: '/work/notes', name: 'work-notes', component: () => import('@/views/work/WorkNotes.vue') },
  { path: '/work/resources', name: 'work-resources', component: () => import('@/views/work/WorkResources.vue') },
  { path: '/work/archive', name: 'work-archive', component: () => import('@/views/work/WorkArchive.vue') },
]

const router = createRouter({
  history: createWebHashHistory(),
  routes,
  scrollBehavior() { return { top: 0 } },
})

// Navigation Guard:
// Desktop (Tauri) & installed standalone PWAs open straight to the Dashboard.
// Web browsers visiting '/' always see the Landing Page with choices to download or launch.
router.beforeEach((to, from, next) => {
  // Ensure the page title is always cleanly set to "Atrium"
  if (typeof document !== 'undefined') {
    document.title = 'Atrium'
  }

  if (to.path === '/') {
    const isDesktop = typeof window !== 'undefined' && (
      Boolean(window.__TAURI_INTERNALS__ || window.__TAURI__ || window.__TAURI_IPC__ || window.__TAURI_METADATA__)
    )
    const isStandalone = typeof window !== 'undefined' && (
      window.matchMedia('(display-mode: standalone)').matches ||
      window.navigator?.standalone === true
    )

    // Only skip landing if we are running as an installed desktop or mobile app
    if (isDesktop || isStandalone) {
      return next('/dashboard')
    }
  }
  next()
})

export default router
