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

// v6 — Work Mode integration
db.version(6).stores({
  work_clients: "id, name, status, lastInteractionAt, createdAt, updatedAt",
  work_items: "id, clientId, status, important, urgent, dueDate, resurfaceDate, snoozedUntil, charged, createdAt, updatedAt",
  work_leads: "id, status, followUpDate, createdAt, updatedAt",
  work_invoices: "id, clientId, status, invoiceNumber, dueDate, createdAt, updatedAt",
  work_meetings: "id, googleCalendarId, clientId, startDateTime, endDateTime, associatedType, associatedId, createdAt, updatedAt",
  work_capacity: "id, weekStartDate, createdAt, updatedAt",
  work_templates: "id, name, type, createdAt, updatedAt",
  work_communication_logs: "id, clientId, channel, date, createdAt"
});

// v7 — Work Resources (credentials and URLs)
db.version(7).stores({
  work_resources: "id, clientId, type, title, createdAt"
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

export const DEFAULT_CATEGORIES = [
  // assets
  { scope: "asset", name: "cash", group: "Liquid" },
  { scope: "asset", name: "savings", group: "Liquid" },
  { scope: "asset", name: "fixed_deposits", group: "Fixed" },
  { scope: "asset", name: "investments", group: "Liquid" },
  { scope: "asset", name: "real_estate", group: "Fixed" },
  { scope: "asset", name: "jewellery", group: "Fixed" },
  // liabilities
  { scope: "liability", name: "credit_card", group: "Short-term" },
  { scope: "liability", name: "home_loan", group: "Long-term" },
  { scope: "liability", name: "personal_loan", group: "Short-term" },
  { scope: "liability", name: "unpaid_taxes", group: "Short-term" },
  // income
  { scope: "income", name: "upwork", group: "Active" },
  { scope: "income", name: "direct_client", group: "Active" },
  { scope: "income", name: "dividend", group: "Passive" },
  { scope: "income", name: "interest", group: "Passive" },
  { scope: "income", name: "rental", group: "Passive" },
  { scope: "income", name: "others", group: "One-Off" },
  // expenses
  { scope: "expense", name: "rent", group: "Need" },
  { scope: "expense", name: "food_and_groceries", group: "Need" },
  { scope: "expense", name: "household", group: "Need" },
  { scope: "expense", name: "baby", group: "Need" },
  { scope: "expense", name: "commute/fuel", group: "Need" },
  { scope: "expense", name: "medical_&_healthcare", group: "Need" },
  { scope: "expense", name: "utility", group: "Need" },
  { scope: "expense", name: "eat_out", group: "Want" },
  { scope: "expense", name: "gift", group: "Want" },
  { scope: "expense", name: "cosmetics/salon", group: "Want" },
  { scope: "expense", name: "travel", group: "Want" },
  { scope: "expense", name: "personal", group: "Want" },
  { scope: "expense", name: "wearables", group: "Want" },
  { scope: "expense", name: "subscriptions", group: "Want" },
  { scope: "expense", name: "one-off", group: "Want" },
  { scope: "expense", name: "education", group: "Business" },
  { scope: "expense", name: "paid_help", group: "Business" },
  { scope: "expense", name: "business_expenses", group: "Business" },

  // investments (recurring contributions)
  { scope: "investment", name: "mutual_fund", group: "Equity" },
  { scope: "investment", name: "stocks", group: "Equity" },
  { scope: "investment", name: "fixed_deposits", group: "Debt" },
  { scope: "investment", name: "real_estate", group: "Real Estate" },
  { scope: "investment", name: "jewellery", group: "Bullion" },
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
        { category: "mutual_fund", type: "investment", value: 25000 },
        { category: "ppf", type: "investment", value: 12500 },
      ],
      note: "",
      createdAt: now(),
      updatedAt: now(),
    });
  }
  await db.finance_cashflow_periods.bulkAdd(cashflowPeriods);

  // Seed Work Mode Tables
  const clientAcmeId = newId();
  const clientNexusId = newId();
  const clientEchoId = newId();

  const clients = [
    {
      id: clientAcmeId,
      name: "Acme Corp",
      status: "active",
      timezone: "GMT-5",
      preferredCommunication: "Slack",
      technicalStack: "React, Node.js, PostgreSQL",
      pricingSensitivity: "Low",
      workflowPreference: "Weekly sprints",
      meetingPreference: "Tuesdays 10 AM",
      relationshipNotes: "Enjoys modern designs. Prefers crisp summaries over long paragraphs. Very stable funding.",
      lastInteractionAt: new Date(Date.now() - 2 * 86400000).toISOString(),
      createdAt: now(),
      updatedAt: now(),
    },
    {
      id: clientNexusId,
      name: "Nexus Ltd",
      status: "active",
      timezone: "GMT+2",
      preferredCommunication: "Email",
      technicalStack: "Vue 3, Firebase, Tailwind",
      pricingSensitivity: "Medium",
      workflowPreference: "Milestone-based",
      meetingPreference: "Thursdays 3 PM",
      relationshipNotes: "Tech-savvy clients. Detail-oriented. Prefers formal documentation.",
      lastInteractionAt: new Date(Date.now() - 10 * 86400000).toISOString(),
      createdAt: now(),
      updatedAt: now(),
    },
    {
      id: clientEchoId,
      name: "Echo Design",
      status: "active",
      timezone: "GMT+5.5",
      preferredCommunication: "WhatsApp",
      technicalStack: "Webflow, Shopify",
      pricingSensitivity: "High",
      workflowPreference: "Ad-hoc requests",
      meetingPreference: "Fridays 11 AM",
      relationshipNotes: "Stale communication. Tends to scope-drift. Good pay but high management cost.",
      lastInteractionAt: new Date(Date.now() - 40 * 86400000).toISOString(),
      createdAt: now(),
      updatedAt: now(),
    },
  ];
  await db.work_clients.bulkAdd(clients);

  const workItems = [
    {
      id: newId(),
      clientId: clientAcmeId,
      title: "Figma Rebrand Landing Page",
      description: "Produce high-fidelity desktop and mobile redesign for the marketing homepage.",
      status: "in_progress",
      important: true,
      urgent: true,
      dueDate: new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10),
      estimatedHours: 25,
      actualHours: 27.5,
      billingType: "fixed",
      charged: 1250,
      tags: ["design", "branding"],
      resurfaceDate: null,
      snoozedUntil: null,
      subtasks: [
        { id: newId(), title: "Hero layout draft", done: true },
        { id: newId(), title: "Mobile layout responsiveness", done: false },
      ],
      createdAt: now(),
      updatedAt: now(),
    },
    {
      id: newId(),
      clientId: clientAcmeId,
      title: "CI/CD Pipeline Setup",
      description: "Configure GitHub actions to build, test, and deploy code to staging environment automatically.",
      status: "open",
      important: false,
      urgent: true,
      dueDate: new Date(Date.now() + 1 * 86400000).toISOString().slice(0, 10),
      estimatedHours: 8,
      actualHours: 0,
      billingType: "hourly",
      charged: 400,
      tags: ["devops"],
      resurfaceDate: null,
      snoozedUntil: null,
      createdAt: now(),
      updatedAt: now(),
    },
    {
      id: newId(),
      clientId: clientNexusId,
      title: "UX Workflow Audit",
      description: "Map and analyze the user onboarding checklist and checkout flow to find drops in funnel conversion.",
      status: "open",
      important: true,
      urgent: false,
      dueDate: new Date(Date.now() + 8 * 86400000).toISOString().slice(0, 10),
      estimatedHours: 15,
      actualHours: 4,
      billingType: "hourly",
      charged: 750,
      tags: ["ux-audit"],
      resurfaceDate: null,
      snoozedUntil: null,
      createdAt: now(),
      updatedAt: now(),
    },
    {
      id: newId(),
      clientId: clientNexusId,
      title: "Footer Polish & SEO links",
      description: "Clean up the links list and fix alignment issues on standard viewport sizes.",
      status: "done",
      important: false,
      urgent: false,
      dueDate: new Date(Date.now() - 2 * 86400000).toISOString().slice(0, 10),
      estimatedHours: 2,
      actualHours: 1.5,
      billingType: "hourly",
      charged: 150,
      tags: ["development"],
      resurfaceDate: null,
      snoozedUntil: null,
      createdAt: now(),
      updatedAt: now(),
    },
    {
      id: newId(),
      clientId: "", // Standalone task
      title: "Renew developer domain portfolio",
      description: "Go to Namecheap and pay the yearly invoice for top three client-facing domains.",
      status: "open",
      important: false,
      urgent: false,
      dueDate: new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10),
      estimatedHours: 1,
      actualHours: 0,
      billingType: "none",
      charged: 50,
      tags: ["admin"],
      resurfaceDate: null,
      snoozedUntil: null,
      createdAt: now(),
      updatedAt: now(),
    },
  ];
  await db.work_items.bulkAdd(workItems);

  const leads = [
    {
      id: newId(),
      title: "Beta Mobile App UI",
      clientName: "Alpha Retailers",
      status: "discovery",
      estimatedValue: 120000,
      expectedHours: 40,
      probability: 0.5,
      followUpDate: new Date(Date.now() + 1 * 86400000).toISOString().slice(0, 10),
      relationshipStrength: 4,
      notes: "Met them at a local meetup. Eager to launch MVP. Timeframe: Q3.",
      createdAt: now(),
      updatedAt: now(),
    },
    {
      id: newId(),
      title: "Portal Optimization Phase 2",
      clientName: "Acme Corp",
      status: "proposal_sent",
      estimatedValue: 85000,
      expectedHours: 25,
      probability: 0.8,
      followUpDate: new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10),
      relationshipStrength: 5,
      notes: "Proposal sent yesterday. Discussed with CTO, they are pleased with phase 1.",
      createdAt: now(),
      updatedAt: now(),
    },
  ];
  await db.work_leads.bulkAdd(leads);

  const invoices = [
    {
      id: newId(),
      clientId: clientAcmeId,
      invoiceNumber: "INV-2026-001",
      status: "paid",
      dueDate: new Date(Date.now() - 10 * 86400000).toISOString().slice(0, 10),
      paidAt: new Date(Date.now() - 9 * 86400000).toISOString().slice(0, 10),
      billingType: "fixed",
      taxRate: 18,
      items: [
        { description: "Homepage Design Layouts", quantity: 1, rate: 80000, amount: 80000 },
      ],
      amount: 94400, // 80000 + 18% tax
      createdAt: now(),
      updatedAt: now(),
    },
    {
      id: newId(),
      clientId: clientAcmeId,
      invoiceNumber: "INV-2026-002",
      status: "pending",
      dueDate: new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10),
      billingType: "fixed",
      taxRate: 18,
      items: [
        { description: "Development Phase 1 Kickoff", quantity: 1, rate: 65000, amount: 65000 },
      ],
      amount: 76700,
      createdAt: now(),
      updatedAt: now(),
    },
    {
      id: newId(),
      clientId: clientEchoId,
      invoiceNumber: "INV-2026-003",
      status: "overdue",
      dueDate: new Date(Date.now() - 15 * 86400000).toISOString().slice(0, 10),
      billingType: "fixed",
      taxRate: 0,
      items: [
        { description: "Shopify Store Re-config", quantity: 1, rate: 45000, amount: 45000 },
      ],
      amount: 45000,
      createdAt: now(),
      updatedAt: now(),
    },
  ];
  await db.work_invoices.bulkAdd(invoices);

  // Setup meeting 30 mins from now to display the "Meeting Prep Cockpit" widget!
  const prepMeetingTime = new Date(Date.now() + 20 * 60 * 1000); // 20 minutes from now
  const meetings = [
    {
      id: newId(),
      googleCalendarId: "mock-cal-1",
      clientId: clientAcmeId,
      title: "Acme Corp Sprint Prep & Scope Alignment",
      description: "Aligning on homepage feedback and scope check.",
      startDateTime: prepMeetingTime.toISOString(),
      endDateTime: new Date(prepMeetingTime.getTime() + 45 * 60 * 1000).toISOString(),
      associatedType: "client",
      associatedId: clientAcmeId,
      createdAt: now(),
      updatedAt: now(),
    },
    {
      id: newId(),
      googleCalendarId: "mock-cal-2",
      clientId: clientNexusId,
      title: "Nexus Weekly Checkin",
      description: "Brief recap of milestone progress.",
      startDateTime: new Date(Date.now() + 25 * 3600 * 1000).toISOString(), // Tomorrow
      endDateTime: new Date(Date.now() + 26 * 3600 * 1000).toISOString(),
      associatedType: "client",
      associatedId: clientNexusId,
      createdAt: now(),
      updatedAt: now(),
    },
  ];
  await db.work_meetings.bulkAdd(meetings);

  // Seed weekly capacity configs (current week & next week)
  const dStart = new Date();
  dStart.setDate(dStart.getDate() - dStart.getDay()); // Sunday start
  const capacity = [
    {
      id: newId(),
      weekStartDate: dStart.toISOString().slice(0, 10),
      availableHours: 40,
      adminLoadPercent: 10,
      createdAt: now(),
      updatedAt: now(),
    },
  ];
  await db.work_capacity.bulkAdd(capacity);

  const templates = [
    {
      id: newId(),
      name: "New Client Onboarding",
      type: "checklist",
      items: [
        "Create shared Slack channel",
        "Sign master services agreement (MSA)",
        "Request GitHub repository access",
        "Draft invoice kickoff billing",
      ],
      createdAt: now(),
      updatedAt: now(),
    },
  ];
  await db.work_templates.bulkAdd(templates);

  const logs = [
    {
      id: newId(),
      clientId: clientAcmeId,
      channel: "Slack",
      date: new Date(Date.now() - 2 * 86400000).toISOString(),
      notes: "Agreed to proceed with Figma designs and confirmed staging deployments.",
      createdAt: now(),
    },
  ];
  await db.work_communication_logs.bulkAdd(logs);

  await db.settings.put({ id: "app", theme: "light", firstRun: false, lastDailyReview: null, lastWeeklyReview: null });
}

