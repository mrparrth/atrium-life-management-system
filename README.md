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
- **Context Filtering**: Task scopes, notes, search panels, and quick capture capture inputs dynamically update to isolate work metadata from personal backlogs.

### 2. Work Deliverables & Task Tracker
- **Status Pipeline**: Tasks are tracked via a direct status tag system (**Waiting for Feedback**, **On Hold**, **Ask for Next Milestone**, **Pending Closure**, **Critical**, and **In Progress**).
- **Client Local Time Integration**: Work item cards dynamically compute and render target clients' active local times (e.g. `Client · 11:45 AM Local`) to coordinate healthy communication windows.
- **Drive Link Integration**: One-click Google Drive directory attachments linked directly to specific task deliverables.
- **Client Workspace Filtering**: Client association dropdowns throughout the app (tasks, resources, notes, invoices, etc.) only display active and "do not follow up" clients. Inactive clients are hidden from these selectors; if a client is not visible, navigate to their profile in the Client Directory and make them active (e.g. change status to normal, prospect, or important) first.

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
