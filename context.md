# Atrium - Project Context & Session Progress

Atrium is a local-first personal dashboard and workspace client. It implements Personal Reflection modules (Finance logging, personal projects, life architecture) and Professional workspace modules (scoped deliverables, client directory, invoices, deep capacity planning).

---

## 🏛 Tech Stack & Architecture

- **Frontend**: Vue 3, Vite, Pinia stores, Dexie (IndexedDB client wrapper), Tailwind CSS.
- **Backend**: Node/Express API configurations (google authentication, backup synchronizations).
- **Desktop/Mobile**: Installable Progressive Web App (PWA).

---

## 🌟 Architectural Decisions & Patterns

### 1. Unified State Context
Personal vs. Work mode toggles enforce local filtering of reactive data (notes, tasks, search, quick capture) without database segmentation.

### 2. Personal Finance Subscriptions & Fixed Obligations
- Retired Want/Need spend categorization parameters.
- Replaced with Subscriptions (`SUB`) and Fixed Obligations (`FIXED`) type tags.
- Form fields default dynamically based on active filter views.

### 3. Chronological Cashflow Logging
- Logging forms support sequential arrow-based period switching.
- Auto-saves dirty inputs on navigation transitions and prompts to discard changes on close only if period attributes or notes are modified.

### 4. Keyboard Navigation Shortcuts
- Support for `Alt + ArrowUp` and `Alt + ArrowDown` gestures to cycle tabs natively in all primary dashboard views (Finance, Client Profile sections, Deliverables, Resources, Archives, and Yearly Summaries).

### 5. Client Workspace UX Optimization
- **Compact KPI Bar**: Scaled down padding (`py-1.5 px-3`) and typography (`text-[9px]` for labels and `text-lg` for figures) to display Hours, Receivables, Charges, and Active Scope in a tight horizontal row.
- **KPI Color Hierarchies**: Zero metrics use dimmed `text-ink-3`. Active metrics use primary `text-ink`. Positive charges show in green.
- **Sidebar Restructuring**: Removed the static suggestions card completely. Repositioned the synced calendar meetings card into the right sidebar column for visual balance.
- **Toolbar Actions**: Moved Google Drive link tools to the top toolbar header actions strip. Icons are uniform, monochromatic `w-4 h-4` SVG shapes wrapped inside custom `VTooltip` blocks. Shows a dashed border indicator for unlinked (Initialize Folder) folders and a solid border for linked (Open Folder) folders.

### 6. Cloud Backup Suspense & Manual Intervention
- Tracks consecutive silent backup failures via `atrium.drive.backupFailedAttempts`.
- If failures reach 3, triggers a throttled toast alert event and sets `atrium.drive.backupNeedsIntervention = true` in storage.
- Auto-sync checks (`autoBackup` and `syncGoogleCalendar`) short-circuit immediately if the intervention flag is active.
- Successful manual backups or connection settings clear the failure count and remove the intervention flag.

---

## 📅 Session Checkpoint Log

### July 22, 2026
- OVERHAUL: Overhauled Finance Subscriptions view to introduce compact stats banner, hover breakdowns, filter count badges, and kebab menus.
- FEATURE: Added prev/next chronological arrows with auto-save to Cashflow form.
- FEATURE: Integrated universal `Alt + Up/Down` arrow tab switching shortcuts.
- UX: Compacted Client detail KPI card row, restructured sidebar logs, deleted static suggestion callout.
- UX: Moved Google Drive utility folder action to toolbar header, using monochromatic icons and custom VTooltip hover wrappers.
- DOCS: Synchronized README.md and context.md to reflect all new systems.

### July 25, 2026
- FEATURE: Added cloud backup failure threshold throttling (3 attempts) and background suspense flag (`backupNeedsIntervention`).
- FEATURE: Removed hourly `checkAutoBackup` script from `App.vue` to prevent Google Auth popups from spamming.
- UX: Created a critical re-authorization warning banner in the Google Drive settings section.

### July 27, 2026
- UX: Displayed Monthly Outflow breakdown sub-labels (Subs/Fixed) directly inline inside braces next to the primary outflow metric on the compact banner.
- UX: Converted commitment cards to a monochromatic black and white palette, replacing the emoji calendar with a Lucide Calendar icon and replacing colored day badges (indigo/orange/red) with neutral borders and text formatting.

### July 31, 2026
- FEATURE: Fixed dialog autofocus for Prospect Name inputs in both Add and Edit sales lead modals by binding the missing ref handlers.
- UX: Restructured the Probability button group inside the sales opportunity modals to match the standard notched outline height (`48px`) and floating label style of the adjacent `DateField` input, achieving pixel-perfect vertical alignment.
