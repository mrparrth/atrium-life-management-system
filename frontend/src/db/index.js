import Dexie from 'dexie'
import { nanoid } from 'nanoid'

export const db = new Dexie('atrium_v1')

// v1 schema
db.version(1).stores({
  years: 'id, year, createdAt, updatedAt',
  goals: 'id, yearId, status, createdAt, updatedAt',
  projects: 'id, goalId, areaId, status, lastViewedAt, createdAt, updatedAt',
  tasks: 'id, projectId, goalId, status, important, urgent, dueDate, scheduledDate, resurfaceDate, snoozedUntil, lastViewedAt, createdAt, updatedAt',
  notes: 'id, projectId, taskId, goalId, bookmarkId, financeId, createdAt, updatedAt, lastViewedAt',
  bookmarks: 'id, category, lastViewedAt, resurfaceDate, createdAt, updatedAt',
  areas: 'id, name, createdAt, updatedAt',
  resources: 'id, areaId, type, createdAt, updatedAt',
  finance_assets: 'id, type, category, createdAt, updatedAt',
  finance_snapshots: 'id, date, createdAt',
  reviews: 'id, type, date, createdAt',
  resurfacing_logs: 'id, entityType, entityId, surfacedAt',
  notifications: 'id, createdAt, read',
  archives: 'id, entityType, entityId, archivedAt',
  settings: 'id',
})

// v2 — Cash flow + custom categories (INR)
db.version(2).stores({
  finance_cashflow: 'id, type, category, recurring, date, createdAt, updatedAt',
  finance_categories: 'id, scope, name, createdAt',
})

export function newId() { return nanoid(12) }
export function now() { return new Date().toISOString() }

const DEFAULT_CATEGORIES = [
  // assets
  { scope: 'asset', name: 'cash' },
  { scope: 'asset', name: 'savings' },
  { scope: 'asset', name: 'investments' },
  { scope: 'asset', name: 'retirement' },
  { scope: 'asset', name: 'real_estate' },
  { scope: 'asset', name: 'crypto' },
  { scope: 'asset', name: 'other' },
  // liabilities
  { scope: 'liability', name: 'credit_card' },
  { scope: 'liability', name: 'home_loan' },
  { scope: 'liability', name: 'personal_loan' },
  { scope: 'liability', name: 'other' },
  // income
  { scope: 'income', name: 'salary' },
  { scope: 'income', name: 'freelance' },
  { scope: 'income', name: 'dividend' },
  { scope: 'income', name: 'rental' },
  { scope: 'income', name: 'other' },
  // expenses
  { scope: 'expense', name: 'rent' },
  { scope: 'expense', name: 'groceries' },
  { scope: 'expense', name: 'utilities' },
  { scope: 'expense', name: 'transport' },
  { scope: 'expense', name: 'dining' },
  { scope: 'expense', name: 'subscriptions' },
  { scope: 'expense', name: 'health' },
  { scope: 'expense', name: 'other' },
  // investments (recurring contributions)
  { scope: 'investment', name: 'sip_mutual_fund' },
  { scope: 'investment', name: 'stocks' },
  { scope: 'investment', name: 'ppf' },
  { scope: 'investment', name: 'nps' },
  { scope: 'investment', name: 'fd' },
  { scope: 'investment', name: 'crypto' },
  { scope: 'investment', name: 'other' },
]

// Ensures category catalogue exists; safe to call on every load.
export async function ensureDefaultCategories() {
  const count = await db.finance_categories.count()
  if (count > 0) return
  const ts = now()
  await db.finance_categories.bulkAdd(DEFAULT_CATEGORIES.map(c => ({ id: newId(), ...c, createdAt: ts })))
}

// Seed helper — only runs once if DB is empty
export async function seedIfEmpty() {
  const tasksCount = await db.tasks.count()
  await ensureDefaultCategories()
  if (tasksCount > 0) return

  const year = { id: newId(), year: new Date().getFullYear(), title: `${new Date().getFullYear()}`, theme: 'A year of intentional depth', createdAt: now(), updatedAt: now() }
  await db.years.add(year)

  const areaWellbeing = { id: newId(), name: 'Wellbeing', description: 'Health, sleep, energy', emoji: '◌', createdAt: now(), updatedAt: now() }
  const areaCraft = { id: newId(), name: 'Craft', description: 'Work, learning, creative output', emoji: '◐', createdAt: now(), updatedAt: now() }
  const areaRelations = { id: newId(), name: 'Relationships', description: 'People I want to keep close', emoji: '◑', createdAt: now(), updatedAt: now() }
  await db.areas.bulkAdd([areaWellbeing, areaCraft, areaRelations])

  const goal1 = { id: newId(), yearId: year.id, title: 'Build a calmer creative practice', description: 'Make space for deep work, less noise.', status: 'active', createdAt: now(), updatedAt: now() }
  const goal2 = { id: newId(), yearId: year.id, title: 'Reach financial clarity', description: 'Understand my net worth & direction.', status: 'active', createdAt: now(), updatedAt: now() }
  await db.goals.bulkAdd([goal1, goal2])

  const proj1 = { id: newId(), goalId: goal1.id, areaId: areaCraft.id, title: 'Weekly writing ritual', description: 'A gentle Sunday writing session.', status: 'active', lastViewedAt: now(), createdAt: now(), updatedAt: now() }
  const proj2 = { id: newId(), goalId: goal2.id, areaId: areaCraft.id, title: 'Net worth ledger', description: 'Track assets quarterly.', status: 'active', lastViewedAt: now(), createdAt: now(), updatedAt: now() }
  const proj3 = { id: newId(), goalId: goal1.id, areaId: areaWellbeing.id, title: 'Morning walk practice', description: 'A 30-minute walk before work.', status: 'active', lastViewedAt: new Date(Date.now() - 12 * 86400000).toISOString(), createdAt: now(), updatedAt: now() }
  await db.projects.bulkAdd([proj1, proj2, proj3])

  const todayISO = new Date().toISOString().slice(0, 10)
  const tasks = [
    { id: newId(), projectId: proj1.id, goalId: goal1.id, title: 'Outline the next essay', description: 'Loose bullet points, nothing precious.', important: true, urgent: false, status: 'open', scheduledDate: todayISO, tags: ['writing'], createdAt: now(), updatedAt: now(), lastViewedAt: now() },
    { id: newId(), projectId: proj2.id, goalId: goal2.id, title: 'List all liquid assets', description: '', important: true, urgent: true, status: 'open', dueDate: todayISO, tags: ['finance'], createdAt: now(), updatedAt: now(), lastViewedAt: now() },
    { id: newId(), projectId: proj3.id, goalId: goal1.id, title: 'Walk after breakfast', description: '', important: false, urgent: true, status: 'open', scheduledDate: todayISO, tags: ['health'], createdAt: now(), updatedAt: now(), lastViewedAt: now() },
    { id: newId(), projectId: proj1.id, goalId: goal1.id, title: 'Read for 30 minutes', description: '', important: false, urgent: false, status: 'open', tags: ['reading'], createdAt: now(), updatedAt: now(), lastViewedAt: now() },
    { id: newId(), projectId: proj2.id, goalId: goal2.id, title: 'Research index fund allocations', description: 'Compare 3-fund vs target date.', important: true, urgent: false, status: 'open', resurfaceDate: new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10), tags: ['research'], createdAt: now(), updatedAt: now(), lastViewedAt: new Date(Date.now() - 9 * 86400000).toISOString() },
  ]
  await db.tasks.bulkAdd(tasks)

  await db.notes.bulkAdd([
    { id: newId(), title: 'On slowness', body: 'A reminder: the unhurried mind sees more.\n\nNothing is being chased today.', tags: ['reflection'], createdAt: now(), updatedAt: now(), lastViewedAt: now() },
    { id: newId(), title: 'Reading list — winter', body: '- The Order of Time, Carlo Rovelli\n- Four Thousand Weeks\n- A Pattern Language', tags: ['reading'], projectId: proj1.id, createdAt: now(), updatedAt: now(), lastViewedAt: new Date(Date.now() - 20 * 86400000).toISOString() },
  ])

  await db.bookmarks.bulkAdd([
    { id: newId(), title: 'Calm Technology — Amber Case', url: 'https://calmtech.com/', category: 'Inspiration', tags: ['design'], description: 'Principles of calm tech.', createdAt: now(), updatedAt: now(), lastViewedAt: now() },
    { id: newId(), title: 'The PARA Method', url: 'https://fortelabs.com/blog/para/', category: 'Method', tags: ['productivity'], description: '', createdAt: now(), updatedAt: now(), lastViewedAt: new Date(Date.now() - 40 * 86400000).toISOString() },
  ])

  // INR-based seed values
  const assets = [
    { id: newId(), name: 'Savings account', type: 'asset', category: 'savings', value: 240000, growthRate: 3, createdAt: now(), updatedAt: now() },
    { id: newId(), name: 'Mutual fund portfolio', type: 'asset', category: 'investments', value: 850000, growthRate: 12, createdAt: now(), updatedAt: now() },
    { id: newId(), name: 'EPF', type: 'asset', category: 'retirement', value: 620000, growthRate: 8, contribution: 12000, createdAt: now(), updatedAt: now() },
    { id: newId(), name: 'Bitcoin', type: 'asset', category: 'crypto', value: 95000, growthRate: 15, createdAt: now(), updatedAt: now() },
    { id: newId(), name: 'Credit card', type: 'liability', category: 'credit_card', value: 18000, createdAt: now(), updatedAt: now() },
  ]
  await db.finance_assets.bulkAdd(assets)

  // Cash flow seed (monthly recurring)
  const cashflow = [
    { id: newId(), type: 'income', name: 'Salary', amount: 180000, category: 'salary', recurring: 'monthly', date: todayISO, createdAt: now(), updatedAt: now() },
    { id: newId(), type: 'income', name: 'Freelance', amount: 25000, category: 'freelance', recurring: 'monthly', date: todayISO, createdAt: now(), updatedAt: now() },
    { id: newId(), type: 'expense', name: 'Rent', amount: 45000, category: 'rent', recurring: 'monthly', date: todayISO, createdAt: now(), updatedAt: now() },
    { id: newId(), type: 'expense', name: 'Groceries', amount: 18000, category: 'groceries', recurring: 'monthly', date: todayISO, createdAt: now(), updatedAt: now() },
    { id: newId(), type: 'expense', name: 'Utilities', amount: 5500, category: 'utilities', recurring: 'monthly', date: todayISO, createdAt: now(), updatedAt: now() },
    { id: newId(), type: 'expense', name: 'Subscriptions', amount: 3200, category: 'subscriptions', recurring: 'monthly', date: todayISO, createdAt: now(), updatedAt: now() },
    { id: newId(), type: 'investment', name: 'Equity SIP', amount: 25000, category: 'sip_mutual_fund', recurring: 'monthly', date: todayISO, createdAt: now(), updatedAt: now() },
    { id: newId(), type: 'investment', name: 'PPF', amount: 12500, category: 'ppf', recurring: 'monthly', date: todayISO, createdAt: now(), updatedAt: now() },
  ]
  await db.finance_cashflow.bulkAdd(cashflow)

  // Six monthly snapshots — gentle climb
  const months = 6
  const baseTotal = 1500000
  const snaps = []
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(); d.setMonth(d.getMonth() - i); d.setDate(1)
    snaps.push({ id: newId(), date: d.toISOString().slice(0, 10), netWorth: baseTotal + (months - i) * 45000 + Math.round(Math.sin(i) * 12000), createdAt: now() })
  }
  await db.finance_snapshots.bulkAdd(snaps)

  await db.settings.put({ id: 'app', theme: 'light', firstRun: false, lastDailyReview: null, lastWeeklyReview: null })
}
