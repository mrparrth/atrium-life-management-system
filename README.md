# Atrium - A Quiet Life & Work Management System

Atrium is a premium, local-first life design and professional management system built to emphasize clarity, focus, and deliberate planning. It seamlessly bridges the boundary between **Personal Reflection** and **Work Deliverables** through an intuitive floating interface.

---

## 🏛 Project Architecture

The workspace is organized as a monorepo split into standard client-server directories:

- **`frontend/`**: The core interactive interface built with **Vue 3**, **Vite**, **Vuetify** (for standard dialogue overlays and forms), and **Tailwind CSS** (for responsive layouts, grid structures, and typography).
- **`backend/`**: Express API server serving configurations and potential database syncing operations.
- **`tests/`**: End-to-end automation scripts and functional validation modules.

---

## 🌟 Core Modules & Features

### 1. Dual Work/Personal Modes
- **Seamless Toggling**: An interactive floating mode toggle fixed at the bottom right allows instantaneous swaps between personal reflections and professional workspaces.
- **Context Filtering**: Task scopes, notes, search panels, and quick capture inputs dynamically update to isolate work metadata from personal backlogs.

### 2. Work Deliverables & Task Tracker
- **Status Pipeline**: Tasks are tracked via a direct status tag system (**Waiting for Feedback**, **On Hold**, **Ask for Next Milestone**, **Pending Closure**, **Critical**, and **In Progress**).
- **Client Local Time Integration**: Work item cards dynamically compute and render target clients' active local times (e.g. `Client · 11:45 AM Local`) to coordinate healthy communication windows.
- **Drive Link Integration**: Monochromatic, size-uniform Google Drive SVG utility buttons reside in the header actions bar, featuring dashed border layouts for unlinked states (Initialize Folder) and solid borders for linked states (Open Folder) to keep assets accessible while saving sidebar space.
- **Client Workspace Filtering**: Client association dropdowns throughout the app (tasks, resources, notes, invoices, etc.) only display active and "do not follow up" clients. Inactive clients are hidden from these selectors; if a client is not visible, navigate to their profile in the Client Directory and make them active (e.g. change status to normal, prospect, or important) first.
- **Compact Profile KPI Cards**: The top of the Client Profile features compact horizontal stats (Hours, Receivables, Charges, Scope) with strict color hierarchies: zero values are dimmed, non-zero values use neutral primary text, and positive task charges show in green. All toolbar buttons have smooth rich hover tooltips (`VTooltip`).

### 3. Sales Funnel & Opportunities Funnel
- **Sales board**: Track potential opportunities across standard stages (Lead, Discovery, Proposal Sent, Negotiation, Won, Lost, Onboarding) defaulting to USD (`$`) indicators.
- **Smart Follow-Ups**: Shifting a prospect's pipeline stage automatically advances the recommended follow-up target date by **2 days** (while keeping manual date adjustments active).
- **Update Logs**: Tracks and displays exact timestamps of when a lead's stage was last updated.
- **Client Conversion**: A single action button converts active prospects into formal Client Workspaces instantly.

### 4. Billing & Invoices Ledger
- **Flexible Formats**: Supports Standard milestone billing and External URL invoices (represented by third-party checkout software).
- **PDF Print Engine**: Render clean print sheets for invoices without dev borders.
- **Multi-Currency Defaults**: Manage tax structures and currencies ($ Default, £, ₹) with live receivables balance updates.

### 5. Workload Capacity Forecasting
- **Deep Work Buffers**: Model target availability, administrative overhead margins, and active calendar meetings.
- **Burnout Alerts**: Diagnostics warning when expected task durations exceed weekly capacity.

### 6. Finance Subscriptions & Fixed Obligations Redesign
- **Obligation Classification**: Replaced the Want/Need parameters with Subscriptions (`SUB`) and Fixed Obligations (`FIXED`) type tags, including full database compatibility adapters.
- **Compact Outflow Banner**: Consolidated metrics into a single horizontal banner showing Monthly Outflow, Yearly Outflow, and Active commitments, complete with hover tooltips for subscription vs. fixed cost breakdowns.
- **Tab Badges & Actions**: Filter tabs dynamically show active commitment counts (e.g. `All Commitments (7)`). Editing, deletion, and pause/resume commands are tucked away inside a tidy actions kebab dropdown.

### 7. Chronological Cashflow Navigation
- **Arrow Switching**: Move between adjacent cashflow logging periods using previous/next arrow navigation buttons inside the edit form.
- **Auto-Save on Transition**: Automatically commits any unsaved changes when navigating between months, and prompts to discard changes on close only if values or period notes are actually dirty.

### 8. Universal Keyboard Tab Navigation
- **Alt + Arrow Gestures**: Cycles through tab interfaces using **`Alt + ArrowUp`** and **`Alt + ArrowDown`** (as well as **`Alt + Number`** keys) across all major dashboard views (Finance, Client Profile sections, Work Deliverables, Resources, Archives, and Summary horizons).

---

## 🚀 Getting Started

### Prerequisites
Make sure you have Node.js (v18+) and npm installed.

### Installation
Clone the repository and install dependencies in the frontend directory:
```bash
cd frontend
npm install
```

### Running the App
1. **Development Server**:
   Start the local hot-reload dev server:
   ```bash
   npm run dev
   ```
2. **Production Build**:
   Compile and minify the app, generating PWA service workers:
   ```bash
   npm run build
   ```
3. **Local Preview**:
   Serve the built production assets locally (ideal for testing PWA installability prompts):
   ```bash
   npm run preview
   ```

---

## 📱 Progressive Web App (PWA)

Atrium runs as a fully installable Progressive Web App. To see the download option in your browser:
- Access the app on a secure context (`https://`) or a valid local domain (`http://localhost` / `http://127.0.0.1`).
- Ensure all configured manifest assets are cached properly (a hard refresh `Cmd + Shift + R` forces Chrome to pull updated manifest logs).
- Access the PWA launcher directly from your OS Applications folder once installed.
