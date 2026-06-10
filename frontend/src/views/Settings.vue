<script setup>
import { ref, computed, onMounted } from 'vue'
import { useUIStore } from '@/stores/ui'
import { db } from '@/db'
import PageHeader from '@/components/PageHeader.vue'
import SectionHeader from '@/components/SectionHeader.vue'
import { downloadLocalBackup, getClientId, setClientId, connect as driveConnect, backup as driveBackup, restore as driveRestore, disconnect as driveDisconnect, lastBackupAt } from '@/services/drive'
import { fromNow } from '@/lib/date'
import { Cloud, CloudUpload, CloudDownload, Unlink, Save, FileDown, FileUp, Edit3, Loader2, Bell, BellOff } from 'lucide-vue-next'
import { isNotificationSupported, requestNotificationPermission, areNotificationsEnabled, sendDesktopNotification } from '@/lib/notifications'

const ui = useUIStore()
const origin = location.origin

const clientIdInput = ref('')
const connected = ref(false)
const lastBackup = ref(null)
const busy = ref(false)
const connecting = ref(false)
const backingUp = ref(false)
const restoring = ref(false)
const isEditingClientId = ref(false)

const notificationsSupported = ref(isNotificationSupported())
const notificationsEnabled = ref(areNotificationsEnabled())

async function toggleNotifications() {
  if (notificationsEnabled.value) {
    localStorage.setItem('atrium.notifications.enabled', 'false')
    notificationsEnabled.value = false
    ui.showToast('Desktop notifications disabled', 'info')
  } else {
    const perm = await requestNotificationPermission()
    if (perm === 'granted') {
      notificationsEnabled.value = true
      ui.showToast('Desktop notifications enabled', 'success')
      sendDesktopNotification('Notifications Enabled', {
        body: 'You will now receive desktop alerts for strategic briefings and reminders.'
      })
    } else {
      ui.showToast('Permission denied for notifications', 'warning')
    }
  }
}

function testNotification() {
  sendDesktopNotification('Test Notification', {
    body: 'This is a test notification from Atrium.'
  })
}


function refresh() {
  clientIdInput.value = getClientId()
  connected.value = !!localStorage.getItem('atrium.drive.connected')
  lastBackup.value = lastBackupAt()
  isEditingClientId.value = !clientIdInput.value.trim()
}
onMounted(refresh)

function handleClientIdAction() {
  if (isEditingClientId.value) {
    setClientId(clientIdInput.value.trim())
    ui.showToast('Client ID saved', 'success')
    isEditingClientId.value = false
    refresh()
  } else {
    isEditingClientId.value = true
  }
}

async function connect() {
  busy.value = true
  connecting.value = true
  try { await driveConnect(); ui.showToast('Drive connected', 'success'); refresh() }
  catch (e) { ui.showToast(`Connect failed: ${e.message}`, 'error') }
  finally { busy.value = false; connecting.value = false }
}
async function backup() {
  busy.value = true
  backingUp.value = true
  try { await driveBackup(); ui.showToast('Backed up to Drive', 'success'); refresh() }
  catch (e) { ui.showToast(`Backup failed: ${e.message}`, 'error') }
  finally { busy.value = false; backingUp.value = false }
}
async function restore() {
  if (!await ui.confirm({ message: 'Replace ALL local data with the Drive backup? This cannot be undone.', title: 'Restore Backup' })) return
  busy.value = true
  restoring.value = true
  try { await driveRestore(); ui.showToast('Restored - reloading…', 'success'); setTimeout(() => location.reload(), 800) }
  catch (e) { ui.showToast(`Restore failed: ${e.message}`, 'error') }
  finally { busy.value = false; restoring.value = false }
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
  for (const t of db.tables) {
    if (t.name === 'settings') continue
    await t.clear()
  }
  location.reload()
}

const driveRootInput = ref(localStorage.getItem('atrium.work.drive_root') || '')
const defaultCurrencyInput = ref(localStorage.getItem('atrium.work.default_currency') || 'USD')
const syncModeInput = ref(localStorage.getItem('atrium.sync.mode') || 'auto')
const syncIntervalInput = ref(Number(localStorage.getItem('atrium.sync.interval')) || 60)

function saveWorkSettings() {
  localStorage.setItem('atrium.work.drive_root', driveRootInput.value.trim())
  localStorage.setItem('atrium.work.default_currency', defaultCurrencyInput.value)
  localStorage.setItem('atrium.sync.mode', syncModeInput.value)
  localStorage.setItem('atrium.sync.interval', String(syncIntervalInput.value))
  ui.showToast('Preferences saved', 'success')
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

    <SectionHeader overline="Notifications" title="Desktop Alerts" />
    <div class="card p-5 mb-10 space-y-4">
      <div class="flex items-center justify-between">
        <div>
          <p class="text-sm font-medium text-ink">Enable Desktop Notifications</p>
          <p class="text-xs text-ink-3">Receive real-time alerts for strategic briefings and schedule warnings.</p>
        </div>
        <div class="flex items-center gap-2">
          <button v-if="notificationsEnabled" @click="testNotification" class="btn-ghost !text-xs !py-1.5 px-3">
            Send Test
          </button>
          <button class="btn-secondary flex items-center gap-1.5" @click="toggleNotifications" :disabled="!notificationsSupported">
            <template v-if="!notificationsSupported">
              Unsupported
            </template>
            <template v-else-if="notificationsEnabled">
              <BellOff class="w-3.5 h-3.5" /> Disable
            </template>
            <template v-else>
              <Bell class="w-3.5 h-3.5" /> Enable
            </template>
          </button>
        </div>
      </div>
    </div>

    <!-- WORK WORKSPACE SETTINGS -->
    <SectionHeader overline="Work Operations" title="Work Cockpit Preferences" />
    <div class="card p-6 mb-10 space-y-4">
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div class="v-input-group">
          <input v-model="driveRootInput" placeholder=" " id="drive-root-folder" />
          <label for="drive-root-folder">Google Drive Root Folder</label>
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
        <div class="flex items-center gap-2">
          <div class="v-input-group flex-1">
            <input v-model="clientIdInput" :readonly="!isEditingClientId" placeholder=" " class="font-mono" :class="{'!bg-canvas !text-ink-3 cursor-not-allowed select-none': !isEditingClientId}" id="oauth-client-id" data-testid="drive-client-id" />
            <label for="oauth-client-id">OAuth Client ID</label>
          </div>
          <button class="btn-secondary shrink-0 flex items-center justify-center h-12 px-4 self-end mb-1" @click="handleClientIdAction" data-testid="drive-save-client-id">
            <Save v-if="isEditingClientId" class="w-4 h-4" />
            <Edit3 v-else class="w-4 h-4" />
            <span class="ml-1">{{ isEditingClientId ? 'Save' : 'Edit' }}</span>
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

      <!-- Sync Mode Configuration -->
      <div v-if="connected" class="pt-4 border-t border-line space-y-4">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label class="overline block mb-1">Sync Execution Mode</label>
            <select v-model="syncModeInput" class="input-block text-sm" data-testid="sync-mode-select">
              <option value="auto">Automatic Sync (Background)</option>
              <option value="manual">Manual Sync (Only on request)</option>
            </select>
            <p class="text-[11px] text-ink-3 mt-1.5 leading-relaxed">
              <strong>Automatic:</strong> Runs backup & calendar checks in the background. May prompt Google verification pop-up if browser blocks third-party verification cookies.<br>
              <strong>Manual:</strong> Disables background calls. Stays quiet until you click a sync or backup action button.
            </p>
          </div>
          <div>
            <label class="overline block mb-1" :class="{'opacity-40 select-none': syncModeInput !== 'auto'}">Auto-Sync Time Interval</label>
            <select v-model="syncIntervalInput" :disabled="syncModeInput !== 'auto'" class="input-block text-sm" :class="{'opacity-40 cursor-not-allowed': syncModeInput !== 'auto'}" data-testid="sync-interval-select">
              <option :value="5">Every 5 Minutes</option>
              <option :value="15">Every 15 Minutes</option>
              <option :value="30">Every 30 Minutes</option>
              <option :value="60">Every 1 Hour (Recommended)</option>
              <option :value="180">Every 3 Hours</option>
            </select>
            <p class="text-[11px] text-ink-3 mt-1.5 leading-relaxed" :class="{'opacity-40 select-none': syncModeInput !== 'auto'}">
              Set how frequently the system silently updates backups and calendar events.
            </p>
          </div>
        </div>
        <div class="flex justify-end pt-2">
          <button class="btn-secondary !text-xs !py-1.5" @click="saveWorkSettings" data-testid="save-sync-settings">
            <Save class="w-3.5 h-3.5" /> Save Sync Settings
          </button>
        </div>
      </div>

      <div class="pt-4 border-t border-line flex flex-wrap items-center gap-2">
        <button v-if="!connected" class="btn-primary" :disabled="!clientIdInput || busy" @click="connect"
          data-testid="drive-connect">
          <Loader2 v-if="connecting" class="w-4 h-4 animate-spin" />
          <Cloud v-else class="w-4 h-4" />
          {{ connecting ? 'Connecting...' : 'Connect Drive' }}
        </button>
        <template v-else>
          <button class="btn-primary" :disabled="busy" @click="backup" data-testid="drive-backup">
            <Loader2 v-if="backingUp" class="w-4 h-4 animate-spin" />
            <CloudUpload v-else class="w-4 h-4" />
            {{ backingUp ? 'Backing up...' : 'Back up now' }}
          </button>
          <button class="btn-secondary" :disabled="busy" @click="restore" data-testid="drive-restore">
            <Loader2 v-if="restoring" class="w-4 h-4 animate-spin" />
            <CloudDownload v-else class="w-4 h-4" />
            {{ restoring ? 'Restoring...' : 'Restore' }}
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
