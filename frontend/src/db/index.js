import Dexie from "dexie";
import { nanoid } from "nanoid";

export const db = new Dexie("atrium_v1");

// v1 schema
db.version(1).stores({
  years: "id, year, createdAt, updatedAt",
  goals: "id, yearId, status, createdAt, updatedAt",
  projects: "id, goalId, areaId, status, lastViewedAt, createdAt, updatedAt",
  tasks:
    "id, projectId, goalId, status, important, urgent, dueDate, scheduledDate, resurfaceDate, snoozedUntil, lastViewedAt, createdAt, updatedAt",
  notes: "id, projectId, taskId, goalId, bookmarkId, financeId, createdAt, updatedAt, lastViewedAt",
  bookmarks: "id, category, lastViewedAt, resurfaceDate, createdAt, updatedAt",
  areas: "id, name, createdAt, updatedAt",
  resources: "id, areaId, type, createdAt, updatedAt",
  finance_assets: "id, type, category, createdAt, updatedAt",
  finance_snapshots: "id, date, createdAt",
  reviews: "id, type, date, createdAt",
  resurfacing_logs: "id, entityType, entityId, surfacedAt",
  notifications: "id, createdAt, read",
  archives: "id, entityType, entityId, archivedAt",
  settings: "id",
});

// v2 — Cash flow + custom categories (INR)
db.version(2).stores({
  finance_cashflow: "id, type, category, recurring, date, createdAt, updatedAt",
  finance_categories: "id, scope, name, createdAt",
});

// v3 — Next steps checklist + bookmark pages
db.version(3).stores({
  next_steps: "id, order, done, createdAt, updatedAt",
  bookmark_pages: "id, createdAt, updatedAt",
});

// v4 — Net worth logs (dated, multi-category) + Cash flow monthly periods (multi-category)
db.version(4).stores({
  finance_networth_logs: "id, date, createdAt, updatedAt",
  finance_cashflow_periods: "id, month, createdAt, updatedAt",
});

// v5 — Next steps section-based tasks & notes
db.version(5).stores({
  next_steps_sections: "id, order, createdAt, updatedAt",
});

export function newId() {
  return nanoid(12);
}
export function now() {
  return new Date().toISOString();
}
// Strip Vue reactive proxies before passing to Dexie's structured clone.
export function plain(obj) {
  return JSON.parse(JSON.stringify(obj));
}

const DEFAULT_CATEGORIES = [
  // assets
  { scope: "asset", name: "cash", group: "Liquid" },
  { scope: "asset", name: "savings", group: "Liquid" },
  { scope: "asset", name: "investments", group: "Liquid" },
  { scope: "asset", name: "retirement", group: "Fixed" },
  { scope: "asset", name: "real_estate", group: "Fixed" },
  { scope: "asset", name: "crypto", group: "Liquid" },
  { scope: "asset", name: "other", group: "One-Off" },
  // liabilities
  { scope: "liability", name: "credit_card", group: "Short-term" },
  { scope: "liability", name: "home_loan", group: "Long-term" },
  { scope: "liability", name: "personal_loan", group: "Short-term" },
  { scope: "liability", name: "other", group: "One-Off" },
  // income
  { scope: "income", name: "salary", group: "Active" },
  { scope: "income", name: "freelance", group: "Business" },
  { scope: "income", name: "dividend", group: "Passive" },
  { scope: "income", name: "rental", group: "Passive" },
  { scope: "income", name: "other", group: "One-Off" },
  // expenses
  { scope: "expense", name: "rent", group: "Need" },
  { scope: "expense", name: "groceries", group: "Need" },
  { scope: "expense", name: "utilities", group: "Need" },
  { scope: "expense", name: "transport", group: "Need" },
  { scope: "expense", name: "dining", group: "Want" },
  { scope: "expense", name: "subscriptions", group: "Want" },
  { scope: "expense", name: "health", group: "Need" },
  { scope: "expense", name: "other", group: "One-Off" },
  // investments (recurring contributions)
  { scope: "investment", name: "sip_mutual_fund", group: "Equity" },
  { scope: "investment", name: "stocks", group: "Equity" },
  { scope: "investment", name: "ppf", group: "Debt" },
  { scope: "investment", name: "nps", group: "Debt" },
  { scope: "investment", name: "fd", group: "Debt" },
  { scope: "investment", name: "crypto", group: "Equity" },
  { scope: "investment", name: "other", group: "One-Off" },
];

// Ensures category catalogue exists; safe to call on every load.
export async function ensureDefaultCategories() {
  const count = await db.finance_categories.count();
  if (count > 0) return;
  const ts = now();
  await db.finance_categories.bulkAdd(DEFAULT_CATEGORIES.map((c) => ({ id: newId(), ...c, createdAt: ts })));
}

// Seed helper — only runs once if DB is empty
export async function seedIfEmpty() {
  await ensureDefaultCategories();
  
  const appSettings = await db.settings.get("app");
  if (appSettings) return;


  const year = {
    id: newId(),
    year: new Date().getFullYear(),
    title: `${new Date().getFullYear()}`,
    theme: "A year to reorganize",
    createdAt: now(),
    updatedAt: now(),
  };
  await db.years.add(year);

  const areaWellbeing = {
    id: newId(),
    name: "Wellbeing",
    description: "Health, sleep, energy",
    emoji: "◌",
    createdAt: now(),
    updatedAt: now(),
  };
  const areaCraft = {
    id: newId(),
    name: "Craft",
    description: "Work, learning, creative output",
    emoji: "◐",
    createdAt: now(),
    updatedAt: now(),
  };
  const areaSocial = {
    id: newId(),
    name: "Social",
    description: "Friends, family, community",
    emoji: "◑",
    createdAt: now(),
    updatedAt: now(),
  };
  await db.areas.bulkAdd([areaWellbeing, areaCraft, areaSocial]);

  const goal1 = {
    id: newId(),
    yearId: year.id,
    title: "I have posted 300 pieces of content across social media",
    description: "Create more, consume less.",
    status: "active",
    createdAt: now(),
    updatedAt: now(),
  };
  const goal2 = {
    id: newId(),
    yearId: year.id,
    title: "Reach financial clarity",
    description: "Understand my net worth & direction.",
    status: "active",
    createdAt: now(),
    updatedAt: now(),
  };
  await db.goals.bulkAdd([goal1, goal2]);

  const proj1 = {
    id: newId(),
    goalId: goal1.id,
    areaId: areaCraft.id,
    title: "Content Creation",
    description: "Posting daily on social media.",
    status: "active",
    lastViewedAt: now(),
    createdAt: now(),
    updatedAt: now(),
  };
  const proj2 = {
    id: newId(),
    goalId: goal2.id,
    areaId: areaCraft.id,
    title: "The learning project",
    description: "Weekly practice to learn something new.",
    status: "active",
    lastViewedAt: now(),
    createdAt: now(),
    updatedAt: now(),
  };
  await db.projects.bulkAdd([proj1, proj2]);

  const todayISO = new Date().toISOString().slice(0, 10);
  const tasks = [
    {
      id: newId(),
      projectId: proj2.id,
      goalId: goal2.id,
      title: "Jot down all expenses and assets",
      description: "",
      important: true,
      urgent: true,
      status: "open",
      dueDate: todayISO,
      tags: ["finance"],
      createdAt: now(),
      updatedAt: now(),
      lastViewedAt: now(),
    },
  ];
  await db.tasks.bulkAdd(tasks);

  await db.notes.bulkAdd([
    {
      id: newId(),
      title: "On slowness",
      body: "A reminder: the unhurried mind sees more.\n\nNothing is being chased today.",
      tags: ["reflection"],
      createdAt: now(),
      updatedAt: now(),
      lastViewedAt: now(),
    },
    {
      id: newId(),
      title: "Reading list — winter",
      body: "- The Order of Time, Carlo Rovelli\n- Four Thousand Weeks\n- A Pattern Language",
      tags: ["reading"],
      projectId: proj1.id,
      createdAt: now(),
      updatedAt: now(),
      lastViewedAt: new Date(Date.now() - 20 * 86400000).toISOString(),
    },
  ]);

  await db.bookmarks.bulkAdd([
    {
      id: newId(),
      title: "Calm Technology — Amber Case",
      url: "https://calmtech.com/",
      category: "Inspiration",
      tags: ["design"],
      description: "Principles of calm tech.",
      createdAt: now(),
      updatedAt: now(),
      lastViewedAt: now(),
    },
    {
      id: newId(),
      title: "The PARA Method",
      url: "https://fortelabs.com/blog/para/",
      category: "Method",
      tags: ["productivity"],
      description: "",
      createdAt: now(),
      updatedAt: now(),
      lastViewedAt: new Date(Date.now() - 40 * 86400000).toISOString(),
    },
  ]);

  // INR-based seed: 3 historical net worth logs
  const networthLogs = [];
  for (let i = 2; i >= 0; i--) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    d.setDate(1);
    const drift = (2 - i) * 45000;
    networthLogs.push({
      id: newId(),
      date: d.toISOString().slice(0, 10),
      entries: [
        { category: "savings", type: "asset", value: 240000 + drift / 4 },
        { category: "investments", type: "asset", value: 850000 + drift },
        { category: "retirement", type: "asset", value: 620000 + drift / 2 },
        { category: "crypto", type: "asset", value: 95000 + drift / 6 },
        { category: "credit_card", type: "liability", value: 18000 },
      ],
      note: "",
      createdAt: now(),
      updatedAt: now(),
    });
  }
  await db.finance_networth_logs.bulkAdd(networthLogs);

  // 3 monthly cash-flow periods
  const cashflowPeriods = [];
  for (let i = 2; i >= 0; i--) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    const month = d.toISOString().slice(0, 7);
    cashflowPeriods.push({
      id: newId(),
      month,
      entries: [
        { category: "salary", type: "income", value: 180000 },
        { category: "freelance", type: "income", value: 25000 },
        { category: "rent", type: "expense", value: 45000 },
        { category: "groceries", type: "expense", value: 18000 },
        { category: "utilities", type: "expense", value: 5500 },
        { category: "subscriptions", type: "expense", value: 3200 },
        { category: "sip_mutual_fund", type: "investment", value: 25000 },
        { category: "ppf", type: "investment", value: 12500 },
      ],
      note: "",
      createdAt: now(),
      updatedAt: now(),
    });
  }
  await db.finance_cashflow_periods.bulkAdd(cashflowPeriods);

  await db.settings.put({ id: "app", theme: "light", firstRun: false, lastDailyReview: null, lastWeeklyReview: null });
}
