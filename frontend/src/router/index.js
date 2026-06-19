import { createRouter, createWebHashHistory } from 'vue-router'

const routes = [
  { path: '/', name: 'dashboard', component: () => import('@/views/Dashboard.vue') },
  { path: '/today', name: 'today', component: () => import('@/views/Today.vue') },
  { path: '/tasks', name: 'tasks', component: () => import('@/views/Tasks.vue') },
  { path: '/next-steps', name: 'next-steps', component: () => import('@/views/NextSteps.vue') },
  { path: '/projects', name: 'projects', component: () => import('@/views/Projects.vue') },
  { path: '/projects/:id', name: 'project', component: () => import('@/views/ProjectDetail.vue'), props: true },
  { path: '/areas', name: 'areas', component: () => import('@/views/Areas.vue') },
  { path: '/resources', name: 'resources', component: () => import('@/views/Resources.vue') },
  { path: '/archives', name: 'archives', component: () => import('@/views/Archives.vue') },
  { path: '/years', name: 'years', component: () => import('@/views/Years.vue') },
  { path: '/goals', name: 'goals', component: () => import('@/views/Goals.vue') },
  { path: '/notes', name: 'notes', component: () => import('@/views/Notes.vue') },
  { path: '/notes/graph', name: 'note-graph', component: () => import('@/views/NoteGraph.vue') },
  { path: '/notes/:id', name: 'note', component: () => import('@/views/NoteDetail.vue'), props: true },
  { path: '/bookmarks', name: 'bookmarks', component: () => import('@/views/Bookmarks.vue') },
  { path: '/bookmarks/page/:id', name: 'bookmark-page', component: () => import('@/views/BookmarkPageDetail.vue'), props: true },
  { path: '/finance', name: 'finance', component: () => import('@/views/Finance.vue') },
  { path: '/reviews', name: 'reviews', component: () => import('@/views/Reviews.vue') },
  { path: '/settings', name: 'settings', component: () => import('@/views/Settings.vue') },
  { path: '/summary', name: 'summary', component: () => import('@/views/Summary.vue') },
  { path: '/pipeline', name: 'pipeline', component: () => import('@/views/ContentPipeline.vue') },
  { path: '/follows', name: 'follows', component: () => import('@/views/Follows.vue') },
  
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

export default router
