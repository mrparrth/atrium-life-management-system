<script setup>
import { useUIStore } from '@/stores/ui'
import { db } from '@/db'
import PageHeader from '@/components/PageHeader.vue'
import SectionHeader from '@/components/SectionHeader.vue'

const ui = useUIStore()

async function exportData() {
  const data = {
    years: await db.years.toArray(),
    goals: await db.goals.toArray(),
    projects: await db.projects.toArray(),
    tasks: await db.tasks.toArray(),
    notes: await db.notes.toArray(),
    bookmarks: await db.bookmarks.toArray(),
    areas: await db.areas.toArray(),
    finance_assets: await db.finance_assets.toArray(),
    finance_snapshots: await db.finance_snapshots.toArray(),
    reviews: await db.reviews.toArray(),
  }
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = `atrium-export-${new Date().toISOString().slice(0,10)}.json`; a.click()
  URL.revokeObjectURL(url)
  ui.showToast('Exported', 'success')
}

async function clearAll() {
  if (!confirm('Permanently erase all local data? This cannot be undone.')) return
  for (const t of db.tables) await t.clear()
  location.reload()
}
</script>

<template>
  <div class="px-8 md:px-12 py-10 max-w-3xl mx-auto" data-testid="settings-view">
    <PageHeader overline="Settings" title="Quiet preferences" sub="This system lives in your browser." />

    <SectionHeader overline="Appearance" title="Theme" />
    <div class="card p-5 mb-10 flex items-center justify-between">
      <p class="text-sm text-ink-2">Currently {{ ui.theme }}</p>
      <button class="btn-secondary" @click="ui.toggleTheme" data-testid="settings-toggle-theme">Switch theme</button>
    </div>

    <SectionHeader overline="Data" title="Your local archive" hint="All data lives in IndexedDB on this device." />
    <div class="card p-5 mb-10 space-y-3">
      <button class="btn-secondary" @click="exportData" data-testid="export-json">Export JSON</button>
      <button class="btn-ghost !text-pri-critical block" @click="clearAll" data-testid="clear-all">Erase all local data</button>
    </div>

    <SectionHeader overline="Shortcuts" title="Keyboard" />
    <div class="card p-5 text-sm space-y-2.5 text-ink-2">
      <div class="flex items-center justify-between"><span>Open command palette</span><span class="flex gap-1"><span class="kbd">⌘</span><span class="kbd">K</span></span></div>
      <div class="flex items-center justify-between"><span>Quick capture</span><span class="flex gap-1"><span class="kbd">⌘</span><span class="kbd">N</span></span></div>
      <div class="flex items-center justify-between"><span>Close overlay</span><span class="kbd">esc</span></div>
    </div>
  </div>
</template>
