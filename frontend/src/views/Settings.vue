<script setup>
import { ref, computed, onMounted } from 'vue'
import { useUIStore } from '@/stores/ui'
import { db } from '@/db'
import PageHeader from '@/components/PageHeader.vue'
import SectionHeader from '@/components/SectionHeader.vue'
import { downloadLocalBackup, getClientId, setClientId, connect as driveConnect, backup as driveBackup, restore as driveRestore, disconnect as driveDisconnect, lastBackupAt } from '@/services/drive'
import { fromNow } from '@/lib/date'
import { Cloud, CloudUpload, CloudDownload, Unlink, Save, FileDown, FileUp } from 'lucide-vue-next'

const ui = useUIStore()
const origin = location.origin

const clientIdInput = ref('')
const connected = ref(false)
const lastBackup = ref(null)
const busy = ref(false)

function refresh() {
  clientIdInput.value = getClientId()
  connected.value = !!localStorage.getItem('atrium.drive.connected')
  lastBackup.value = lastBackupAt()
}
onMounted(refresh)

function saveClientId() {
  setClientId(clientIdInput.value.trim())
  ui.showToast('Client ID saved', 'success')
  refresh()
}

async function connect() {
  busy.value = true
  try { await driveConnect(); ui.showToast('Drive connected', 'success'); refresh() }
  catch (e) { ui.showToast(`Connect failed: ${e.message}`, 'error') }
  finally { busy.value = false }
}
async function backup() {
  busy.value = true
  try { await driveBackup(); ui.showToast('Backed up to Drive', 'success'); refresh() }
  catch (e) { ui.showToast(`Backup failed: ${e.message}`, 'error') }
  finally { busy.value = false }
}
async function restore() {
  if (!await ui.confirm({ message: 'Replace ALL local data with the Drive backup? This cannot be undone.', title: 'Restore Backup' })) return
  busy.value = true
  try { await driveRestore(); ui.showToast('Restored - reloading…', 'success'); setTimeout(() => location.reload(), 800) }
  catch (e) { ui.showToast(`Restore failed: ${e.message}`, 'error') }
  finally { busy.value = false }
}
async function disconnect() {
  if (!await ui.confirm({ message: 'Disconnect Drive from this device?', title: 'Disconnect Drive' })) return
  driveDisconnect(); refresh(); ui.showToast('Disconnected', 'success')
}

async function exportJson() { await downloadLocalBackup(); ui.showToast('Exported', 'success') }

const fileInput = ref(null)
async function importJson(e) {
  const file = e.target.files?.[0]
  if (!file) return
  if (!await ui.confirm({ message: 'Replace ALL local data with this file?', title: 'Import JSON' })) return
  const text = await file.text()
  try {
    const payload = JSON.parse(text)
    const data = payload?.data || payload
    const { importAllData } = await import('@/services/drive')
    await importAllData(data)
    ui.showToast('Imported - reloading…', 'success')
    setTimeout(() => location.reload(), 700)
  } catch (err) { ui.showToast(`Import failed: ${err.message}`, 'error') }
}

async function clearAll() {
  if (!await ui.confirm({ message: 'Permanently erase all local data? A backup will be downloaded first.', title: 'Erase Data' })) return
  await downloadLocalBackup()
  for (const t of db.tables) await t.clear()
  location.reload()
}

const driveRootInput = ref(localStorage.getItem('atrium.work.drive_root') || '')
const defaultCurrencyInput = ref(localStorage.getItem('atrium.work.default_currency') || 'USD')

function saveWorkSettings() {
  localStorage.setItem('atrium.work.drive_root', driveRootInput.value.trim())
  localStorage.setItem('atrium.work.default_currency', defaultCurrencyInput.value)
  ui.showToast('Work preferences saved', 'success')
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

    <!-- WORK WORKSPACE SETTINGS -->
    <SectionHeader overline="Work Operations" title="Work Cockpit Preferences" />
    <div class="card p-6 mb-10 space-y-4">
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label class="overline block mb-1">Google Drive Root Folder</label>
          <input v-model="driveRootInput" placeholder="e.g. My Drive/AtriumWork" class="input-block text-sm" />
        </div>
        <div>
          <label class="overline block mb-1">Default Billing Currency</label>
          <select v-model="defaultCurrencyInput" class="input-block text-sm">
            <option value="USD">USD ($)</option>
            <option value="GBP">GBP (£)</option>
            <option value="INR">INR (₹)</option>
          </select>
        </div>
      </div>
      <div class="flex justify-end pt-2 border-t border-line/40">
        <button class="btn-primary" @click="saveWorkSettings">
          <Save class="w-4 h-4" /> Save Work Preferences
        </button>
      </div>
    </div>

    <!-- GOOGLE DRIVE -->
    <SectionHeader overline="Optional sync" title="Google Drive backup"
      hint="Stores a single JSON in a private app-only folder on your Drive (drive.appdata scope)." />
    <div class="card p-6 mb-10 space-y-4" data-testid="drive-section">
      <div>
        <label class="overline block mb-1">OAuth Client ID</label>
        <div class="flex gap-2">
          <input v-model="clientIdInput" placeholder="xxxxx.apps.googleusercontent.com"
            class="input-block text-sm font-mono" data-testid="drive-client-id" />
          <button class="btn-secondary" @click="saveClientId" data-testid="drive-save-client-id">
            <Save class="w-4 h-4" /> Save
          </button>
        </div>
        <p class="text-xs text-ink-3 mt-2">
          Create a Web OAuth Client in <a href="https://console.cloud.google.com/apis/credentials" target="_blank"
            class="underline decoration-line-2 underline-offset-2">Google Cloud Console</a>.
          Add <code class="bg-elevated px-1.5 py-0.5 rounded text-xs">{{ origin }}</code> as an Authorized JavaScript
          origin.
          Enable the Drive API on the project.
        </p>
      </div>

      <div class="pt-4 border-t border-line flex flex-wrap items-center gap-2">
        <button v-if="!connected" class="btn-primary" :disabled="!clientIdInput || busy" @click="connect"
          data-testid="drive-connect">
          <Cloud class="w-4 h-4" /> Connect Drive
        </button>
        <template v-else>
          <button class="btn-primary" :disabled="busy" @click="backup" data-testid="drive-backup">
            <CloudUpload class="w-4 h-4" /> Back up now
          </button>
          <button class="btn-secondary" :disabled="busy" @click="restore" data-testid="drive-restore">
            <CloudDownload class="w-4 h-4" /> Restore
          </button>
          <button class="btn-ghost" :disabled="busy" @click="disconnect" data-testid="drive-disconnect">
            <Unlink class="w-4 h-4" /> Disconnect
          </button>
        </template>
        <span v-if="lastBackup" class="text-xs text-ink-3 ml-auto">last backup {{ fromNow(lastBackup) }}</span>
      </div>
    </div>

    <SectionHeader overline="Data" title="Local archive" hint="All data lives in IndexedDB on this device." />
    <div class="card p-5 mb-10 flex flex-wrap items-center gap-2">
      <button class="btn-secondary" @click="exportJson" data-testid="export-json">
        <FileDown class="w-4 h-4" /> Export JSON
      </button>
      <label class="btn-secondary cursor-pointer">
        <FileUp class="w-4 h-4" /> Import JSON
        <input ref="fileInput" type="file" accept="application/json" class="hidden" @change="importJson"
          data-testid="import-json" />
      </label>
      <button class="btn-ghost !text-pri-critical ml-auto" @click="clearAll" data-testid="clear-all">Erase all local
        data</button>
    </div>

    <SectionHeader overline="Shortcuts" title="Keyboard" />
    <div class="card p-5 text-sm space-y-2.5 text-ink-2">
      <div class="flex items-center justify-between"><span>Open command palette</span><span class="flex gap-1"><span
            class="kbd">⌘</span><span class="kbd">K</span></span></div>
      <div class="flex items-center justify-between"><span>Quick capture</span><span class="flex gap-1"><span
            class="kbd">⌘</span><span class="kbd">N</span></span></div>
      <div class="flex items-center justify-between"><span>Close overlay</span><span class="kbd">esc</span></div>
    </div>
  </div>
</template>
