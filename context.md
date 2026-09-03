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
- UX: Restructured the Probability button group inside the sales opportunity modals to match the standard notched outline height (`48px`) and floating label style of the adjacent `DateField` input, achieving pixel-perfect vertical alignment.

### 7. Goals & Wish List Unified Grid Layout
- **Stacked Sections**: Goals and Wishes are separated into independent, full-width vertical stacked sections styled with standard `<SectionHeader>` components.
- **Conic Progress Borders**: Replaced all internal progress bars, gauges, and task counts with a thin card border mapping progress percentage via a CSS `conic-gradient`.
- **Dual Tracking Modes**: Supports Direct % mode (native range slider, database target forced to 100) and Target-based mode (achieved, target, unit). Switches dynamically default the target to 100 if achieved is non-zero to avoid division errors.
- **Wishlist Ready Alerts & Green Outlines**: Wishes reaching 100% progress render a solid green border (`rgb(var(--pri-strategic))`) and display a "Can be purchased now" check icon badge inside the card.
- **Modal Cover Banners**: Modals render a dynamic, padded cover photo banner at the top if `imageUrl` is defined (styled to sit cleanly inside the modal layout without overlapping the close button).
- **Minimalist Palette & Metadata**: Stripped descriptions (from wishes), task/project counts, and header badges (Goal/Wish chips) for a monochromatic aesthetic.

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

### August 9, 2026
- OVERHAUL: Restructured Goals & Wishes page into vertical stacked sections using standardized SectionHeaders.
- FEATURE: Implemented conic-gradient progress card borders, zero-progress rendering guards, and 100%+ green completion borders with "Can be purchased now" badge alerts.
- FEATURE: Integrated Direct % mode (range slider input, target=100) and Target-based tracking (achieved/target/unit inputs, target auto-defaults to 100 on toggle with non-zero progress).
- FEATURE: Added dynamic, padded modal cover banner image previews for goal and wishlist modals.
- UX: Removed card checkboxes, task/project counts, text summaries, and headers' Goal/Wish pills to enforce a premium, monochromatic look.
- UX: Widened wishlist modals to `max-w-lg` and resolved the goal edit modal dismiss bug after clicking save changes.
- DOCS: Synchronized context.md and walkthrough.md to document the goals/wishlist overhaul.

### 8. Resurfacing Memory Sidebar Overhaul
- **Unified Selection Pool**: Combined notes and bookmarks into a unified candidate pool. Selected exactly 2 notes/bookmarks per day.
- **Goals & Wishes Resurfacing**: Separates Goals and Wishlist items into two independent daily resurfacing card spots (up to one Goal and one Wishlist card per day).
- **Viewed State & Cooldown Tracking**: Implemented `lastViewedAt` fields and `markViewed` function in Goals and Wishlist pinia stores. Opening a modal or clicking a resurfaced bookmark updates this database field.
- **Seeded Daily Randomness**: Used mulberry32 daily seeded generator to keep selection stable across refresh cycles within a given day.
- **15-Day Snooze-Shield Cooldown**: Enforces a strict cooldown. Items viewed < 15 days ago are prioritized at `0.0001` (lowest priority). Candidates are sorted descending by days since last viewed.

### August 10, 2026
- FEATURE: Overhauled memoryResurfacing helper to select up to one Goal and one Wishlist card independently each day, alongside exactly 2 Note/Bookmarks, ensuring selections remain fixed/stable all day even if items are clicked.
- FEATURE: Added `lastViewedAt` attributes and `markViewed` Dexie database handlers in Goals and Wishlist stores.
- FEATURE: Implemented a 15-day minimum snooze cooldown with a descending age priority sorter for next resurface selection.
- UX: Unified daily memory items in the sidebar into a sorted list (`resurfacedMemoryList`) so clicked items immediately gray out and shift to the bottom instead of disappearing.
- UX: Styled the resurfaced Goal card in the sidebar to render the "Goal" text and lucide icon at the top, and a glowing, high-contrast lowercase `"remember what you are working towards"` subscript at the bottom.
- UX: Added a tall-and-thin 3D faceted green Plumbob bipyramid SVG diamond indicator with specular highlight overlays, positioned absolutely at the top-right of the daily resurfaced Goal card.
- UX: Enabled dashboard deep-linking (`/goals?goalId=XYZ` and `/goals?wishId=XYZ`) to automatically trigger edit modals when resurfaced items are clicked.
- UX: Replaced the native browser confirm() popup for wish deletions on the Goals & Wishes page with the custom, promise-based confirm modal.
- FEATURE: Changed task creation defaults inside the TaskComposer and tasks store so that new tasks default to Priority 2 (important = true, urgent = false, strategic).
- UX: Replaced the task composer priority dropdown with two checkboxes (Important and Urgent) shown side-by-side, plus a dynamic computed priority chip positioned at the top-right in the Priority card header.

### August 11, 2026
- FEATURE: Strict once-in-15-days goal and wishlist item selections. If an item was viewed within the last 15 days (excluding today), it is completely omitted from the candidates pool.
- UX: Added a 4-second transition delay (`setTimeout`) for moving clicked daily memory items to the bottom of the sidebar list, keeping them grayed out instantly to avoid sudden layout shifts.

### August 12, 2026
- UX: Redesigned the Reference Links tab in WorkClientDetail.vue. Created a clean flex header with a bold `"Reference Links"` h3 heading on the left and the Add Link button floating on the right to match Billing Ledger. Reduced card container width to max-w-3xl, and configured card clicks to open the edit resource modal. Introduced separate external link action icons (`ExternalLink`) to open the resource URL. Simplified categories and badges to website, file, folder, and document chips, and updated card titles to font-normal with a 2-line clamp. Integrated VUrlInput and VSelect form controls positioned side-by-side inside the Add/Edit resource modal, where the URL input spans 3/4ths of the width and Link Type spans 1/4th.
- UX: Updated tab switcher keyboard helper tips to display Option + Arrow Up/Down (`⌥↑`/`⌥↓`) next to Option + number switch options.
- UX: Restructured the Overview tab of WorkClientDetail.vue. Moved the Client Memory Profile block to the right sidebar column, removed the calendar logs block, and populated the main area with active deliverables, recent documents, and recent references.
- UX: Improved the DateField component calendar popover. Changed click-outside event listeners to capture-phase (`true`) to guarantee closing on outside clicks, and added a "Next Mon" button to programmatically set the target date to the upcoming Monday.
- UX: Added the "By Due Date" tab to WorkItems.vue sorting active tasks by date criteria. Cleaned up redundant hint text descriptions from status/due date section headers, and renamed the first tab header to "By Priority".
- UX: Fixed tomorrow's tasks filter in WorkDashboard.vue to correctly display tasks that are due tomorrow or are active tomorrow (snoozed until tomorrow's date).

### August 23, 2026
- FEATURE: Built dedicated Goal Detail page (`GoalDetail.vue`) at route `/goals/:id` with zero-layout-shift Live Form controls (title, description, start/target dates, assigned years, image URL, tracking mode) auto-saving to indexedDB. Integrated Review Log comments feed and tab navigation (`Summary`, `Projects`, `Tasks`).
- OVERHAUL: Redesigned Project Detail page (`ProjectDetail.vue`) to match Work Clients 2-column layout. Placed Project Specifications in a 1/3 right sidebar card with an Edit toggle button; placed Active Tasks (minimal text cards triggering task edit dialog on click), Links & Bookmarks, and Review Log updates in the 2/3 main column.
- FEATURE: Integrated universal tab keyboard shortcuts (`Alt+1-N`, `Alt+Up/Down`) and shortcut hint badges (`Press ⌥1–⌥N or ⌥ Up/⌥ Down to switch`) across Goal Detail and Project Detail pages.
- FEATURE: Fixed Memory Resurfacing item retention in `resurface.js`. Retained items viewed today inside today's selection pool so clicking a resurfaced bookmark/note turns it grey without spawning new unclicked items.
- UX: Implemented a 5-second delayed smooth sliding transition (`<TransitionGroup name="flip-list">` with 1.2s CSS move transitions) for greyed-out resurfaced memory items on `PersonalDashboard.vue`.
- FEATURE: Refined Growth Tree handled task criteria to evaluate maximum of `dueDate` and `snoozedUntil`. Rescheduled or snoozed tasks updated today to future dates count as handled today; items still due today do not.
- DOCS: Synchronized context.md and walkthrough.md.

### August 24, 2026
- FEATURE: Added auto-backup failure alert banners to `WorkDashboard.vue` and `PersonalDashboard.vue` with real-time window event listeners, retry action triggers, and settings route links.
- OVERHAUL: Modularized Growth Tree component into `GrowthTree.vue` (widget button & popover) and `GrowthTreeConfetti.vue` (full-screen canvas particle celebration engine).
- FEATURE: Implemented pure canvas confetti particle text assembly. Confetti leaves spray upward from dual bottom-corner cannons, arc through the air, and smoothly magnetize/lerp into position to form `"X Day Streak!"` out of the confetti blocks without HTML text overlays.
- FEATURE: Added a 3-second extra hold duration for assembled confetti text before fading out cleanly.
- ARCHITECTURE: Exported `DEFAULT_SETTINGS` dictionary in `settings.js` to seed initial defaults automatically into IndexedDB (`db.settings`) on first boot and provide central fallback values across the application.
- UX: Updated `VSelect.vue` to make the `label` prop optional. Unified `Sync Execution Mode`, `Auto-Sync Time Interval`, `Backup Frequency`, and `Retention Policy` under clean custom `<VSelect>` dropdowns without floating cutout text.
- UX: Enabled instant auto-saving (`@change`) for all backup & sync settings in `Settings.vue`, removing redundant manual save buttons. Integrated `<VUrlInput>` for Google Drive Client Folders Location.
- UX: Removed auto-linked task rows from the time allocation planner in `WorkForecasting.vue`, leaving daily allocations 100% manually user-managed via `+ Add Project`.
- UX: Prefixed project allocation dropdown options with their associated Client Name (`[Client Name] - [Task Title]`).
- DOCS: Synchronized context.md and walkthrough.md.

### September 3, 2026
- FEATURE: Migrated all application settings (user theme, workspace mode, user name, invoicing sender profile, bank details, and backup parameters) into IndexedDB (`db.settings`). Used `localStorage` strictly as a fast-boot cache mirror to eliminate initial theme flash.
- FEATURE: Expanded database backup and restore engine in `drive.js` to cover all 36 active IndexedDB tables, ensuring full backup completeness across work mode deliverables, client cards, meetings, follows, subscriptions, and wishlist items. Added automatic settings cache re-sync on database restore.
- UX: Overhauled Reference Link cards in `WorkClientDetail.vue` by removing text badges (`WEBSITE`/`FILE`/`FOLDER`) in favor of brand-colored type icons (`Globe`, `Folder`, `FileText`). Positioned action buttons in the top-right corner with smooth hover fade-ins and added details padding to prevent title text wrapping.
- UX: Redesigned Credentials Vault cards in `WorkClientDetail.vue` and `WorkResources.vue` by eliminating nested inner rounded container boxes. Replaced titles with clean sans-serif typography accompanied by an inline amber `Vault` key badge, and left-aligned `URL`, `USER`, and `PASS` fields next to fixed-width high-contrast labels to prevent URL truncation.
- FEATURE: Refactored Growth Tree progress formula in `GrowthTree.vue`. Assigned fixed 20% weights to Memory Resurfacing and Drifting Projects, and a 60% weight to a unified Tasks pool combining Personal Tasks, Work Tasks, and Work Briefing Alerts (counting as 1 task unit total, where 1 task = 1 task unit).
- UX: Enabled direct click-to-edit functionality on Subscription and Fixed Cost cards in `FinanceSubscriptions.vue` (`@click="openEditModal(sub)"` with `cursor-pointer`). Prevented menu event bubbling on kebab dropdown triggers and fixed the title tooltip parameter binding.
- DESKTOP: Configured Tauri 2.0 native macOS desktop bundle (`src-tauri/`) with `com.atrium.app` identifier, 1280x840 default window dimensions, and added `npm run tauri:dev` / `npm run tauri:build` scripts to `package.json`.
- DESKTOP: Processed `public/atrium-icon.png` via Tauri icon generator (`npx tauri icon`) to generate native macOS `icon.icns` and high-resolution bundle icons for the `.app` and `.dmg` installers.
- DOCS: Updated context.md checkpoint log.
