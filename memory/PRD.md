# Atrium — Premium Local-First Life Management App

## Original problem statement
Build a premium local-first life management web application (Vue 3 + Vite + Pinia + Dexie.js + TailwindCSS). Calm, reflective, intelligently organized — combining Tiago Forte PARA methodology with progressive disclosure, intelligent resurfacing, and long-term life tracking. Inspired by Linear, Reflect Notes, Arc, Sunsama, Anytype, Obsidian — but more emotionally calming.

## User choices
- Tech stack: **Vue 3 + Vite + Pinia + Dexie.js** (replaced React template)
- AI: **Deferred** to a later iteration
- Scope: **Full breadth, MVP depth** (Years/Goals/Projects/Tasks + PARA + Notes + Bookmarks + Finance + Resurfacing + Reviews + Command Palette)
- Auth: **Single-user, no login** (pure local-first)
- Design: Design agent decided — "Organic & Earthy" calm aesthetic with Newsreader (serif) + Manrope (sans) typography

## Architecture
- **Frontend only.** No backend used by the app. Backend FastAPI service runs but is unreferenced.
- **Storage:** IndexedDB via Dexie.js (db name: `atrium_v1`). 14 tables: years, goals, projects, tasks, notes, bookmarks, areas, resources, finance_assets, finance_snapshots, reviews, resurfacing_logs, notifications, archives, settings.
- **State:** 10 Pinia stores (`ui`, `tasks`, `projects`, `goals`, `years`, `notes`, `bookmarks`, `finance`, `areas`, `reviews`).
- **Routing:** Vue Router with hash history (16 routes).
- **Resurfacing engine:** `src/lib/resurface.js` — todayFocus, recentlyIgnored, momentumOpportunities, staleProjects, memoryResurfacing.
- **Priority derivation:** Important + Urgent checkboxes → Critical / Strategic / Interruptive / Backlog.

## What's been implemented (2026-02-05)
- Dashboard with progressive-disclosure sections: Today focus, Needs attention, Recently ignored, Upcoming, Momentum opportunities, Stale projects, Memory resurfacing, Finance snapshot, Weekly reflection.
- Tasks view with priority grouping (Critical/Strategic/Interruptive/Backlog) + filters (status, priority, project).
- Today focus view.
- PARA: Projects (list + detail with progress, completion, archive, delete), Areas, Resources, Archives.
- Horizon: Years, Goals.
- Notes (list + markdown detail/edit), Bookmarks (categorised), Finance (net worth, allocation bars, projections, snapshots, holdings), Reviews (daily/weekly/monthly/yearly with wins/challenges/gratitude/next-focus).
- Command palette (⌘K) with search across tasks/projects/notes/bookmarks/goals + jump-to navigation.
- Quick capture overlay (⌘N) with live priority preview.
- Theme toggle (light/dark) — CSS variables, persistent.
- Settings: JSON export, erase all, shortcut reference.
- Auto-seeded sample data on first run.
- 15/16 testing scenarios pass (testing_agent_v3 iteration_1).

## Iteration 2 — Finance overhaul (2026-02-05)
- All currency display switched to **INR (₹)** using `Intl.NumberFormat('en-IN')` (lakh/crore separators); projections use compact L / Cr.
- Dexie schema bumped to **v2** with `finance_cashflow` and `finance_categories` tables (auto-upgrade safe).
- Finance page split into **4 tabs**: Overview, Net worth, Cash flow, Categories.
- **Cash flow** tracking: income / expense / investment entries; recurring=monthly|yearly|one-time; yearly amounts normalised /12 in totals; one-time excluded from monthly KPIs.
- **KPIs**: monthly income, expenses, invested, net, savings rate %.
- **Expense breakdown** chart by category.
- **Custom categories**: add/remove per scope (asset / liability / income / expense / investment); duplicate guard; new categories propagate instantly to modal dropdowns.
- Sparkline gradient bug fixed (stable unique id per instance).
- **15/15 scenarios PASS** in testing_agent_v3 iteration_2.

## Backlog (next iterations)
- **P1 — AI assistance**: task decomposition, stale-project detection, emotional workload detection, schedule balancing, insight generation (Claude Sonnet 4.5 via Universal Key).
- **P1 — Backlinks / [[wiki-links]]** in notes; graph view of relationships.
- **P1 — Snooze UI**: choose duration (1d / 1w / "next month") rather than fixed 1d.
- **P2 — Drag-and-drop** between priority groups; reordering inside groups.
- **P2 — Recurring tasks** (daily/weekly templates).
- **P2 — Energy level** field surfacing in the composer.
- **P2 — Notifications** UI (in-app, non-aggressive).
- **P2 — Optional cloud sync** (e.g., via WebDAV or signed S3) without breaking local-first behavior.
- **P3 — PWA installability** + offline manifest.
- **P3 — Charts library upgrade** for richer finance visualisations.
