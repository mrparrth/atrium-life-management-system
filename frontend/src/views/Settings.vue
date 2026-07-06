<script setup>
import { ref, computed, onMounted } from 'vue'
import { useUIStore } from '@/stores/ui'
import { db } from '@/db'
import VCheckbox from '@/components/VCheckbox.vue'
import VSelect from '@/components/VSelect.vue'
import PageHeader from '@/components/PageHeader.vue'
import SectionHeader from '@/components/SectionHeader.vue'
import { downloadLocalBackup, getClientId, setClientId, connect as driveConnect, backup as driveBackup, restore as driveRestore, disconnect as driveDisconnect, lastBackupAt } from '@/services/drive'
import { fromNow } from '@/lib/date'
import { Cloud, CloudUpload, CloudDownload, Unlink, Save, FileDown, FileUp, Edit3, Loader2, Bell, BellOff, ExternalLink, FolderOpen, ShieldAlert, Check } from 'lucide-vue-next'
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

async function testNotification() {
  await sendDesktopNotification('Test Notification', {
    body: 'This is a test notification from Atrium.'
  })
  ui.showToast('Test notification triggered. Check your OS notification center or Focus settings!', 'info')
}


function refresh() {
  clientIdInput.value = getClientId()
  connected.value = !!localStorage.getItem('atrium.drive.connected')
  lastBackup.value = lastBackupAt()
  isEditingClientId.value = !clientIdInput.value.trim()

  const url = localStorage.getItem('atrium.work.drive_folder_url') || ''
  const root = localStorage.getItem('atrium.work.drive_root') || 'AtriumWork'
  driveFolderInput.value = url || root

  checkOfflineFolder()
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

const driveFolderInput = ref('')
const driveFolderLink = computed(() => {
  const val = driveFolderInput.value.trim()
  if (!val) return ''
  if (val.startsWith('http://') || val.startsWith('https://') || val.includes('drive.google.com')) {
    return val
  }
  return `https://drive.google.com/drive/search?q=${encodeURIComponent(val)}`
})
const defaultCurrencyInput = ref(localStorage.getItem('atrium.work.default_currency') || 'USD')
const syncModeInput = ref(localStorage.getItem('atrium.sync.mode') || 'auto')
const syncIntervalInput = ref(Number(localStorage.getItem('atrium.sync.interval')) || 60)

function saveWorkSettings() {
  const val = driveFolderInput.value.trim()
  if (val.startsWith('http://') || val.startsWith('https://') || val.includes('drive.google.com')) {
    localStorage.setItem('atrium.work.drive_folder_url', val)
    localStorage.setItem('atrium.work.drive_root', '')
  } else {
    localStorage.setItem('atrium.work.drive_root', val || 'AtriumWork')
    localStorage.setItem('atrium.work.drive_folder_url', '')
  }
  localStorage.setItem('atrium.work.default_currency', defaultCurrencyInput.value)
  localStorage.setItem('atrium.sync.mode', syncModeInput.value)
  localStorage.setItem('atrium.sync.interval', String(syncIntervalInput.value))
  ui.showToast('Preferences saved', 'success')
  refresh()
}

import { saveDirectoryHandle, getDirectoryHandle, executeOfflineBackup, verifyPermission } from '@/services/offlineSync'

const offlineEnabled = ref(localStorage.getItem('atrium.offline.enabled') === '1')
const offlineInterval = ref(Number(localStorage.getItem('atrium.offline.interval')) || 1440)
const offlineKeepDays = ref(Number(localStorage.getItem('atrium.offline.keepDays')) || 7)
const offlineFolderName = ref('')
const offlineLastBackup = ref(localStorage.getItem('atrium.offline.lastBackup') || null)
const offlineBusy = ref(false)
const offlineNeedsPermission = ref(false)

async function checkOfflineFolder() {
  const handle = await getDirectoryHandle()
  if (handle) {
    offlineFolderName.value = handle.name
    try {
      const status = await handle.queryPermission({ mode: 'readwrite' })
      offlineNeedsPermission.value = status !== 'granted'
    } catch (e) {
      offlineNeedsPermission.value = true
    }
  } else {
    offlineFolderName.value = ''
    offlineNeedsPermission.value = false
  }
}

async function selectOfflineFolder() {
  try {
    const handle = await window.showDirectoryPicker({
      mode: 'readwrite'
    })
    await saveDirectoryHandle(handle)
    await checkOfflineFolder()
    ui.showToast('Backup directory selected successfully', 'success')
  } catch (e) {
    if (e.name !== 'AbortError') {
      ui.showToast(`Folder selection failed: ${e.message}`, 'error')
    }
  }
}

async function authorizeOfflineFolder() {
  try {
    const handle = await getDirectoryHandle()
    if (!handle) return
    const granted = await verifyPermission(handle, true)
    if (granted) {
      offlineNeedsPermission.value = false
      ui.showToast('Folder permission authorized', 'success')
    } else {
      ui.showToast('Permission not granted', 'warning')
    }
  } catch (e) {
    ui.showToast(`Authorization failed: ${e.message}`, 'error')
  }
}

async function triggerOfflineBackup() {
  offlineBusy.value = true
  try {
    await executeOfflineBackup()
    offlineLastBackup.value = localStorage.getItem('atrium.offline.lastBackup')
    ui.showToast('Offline backup created successfully', 'success')
    await checkOfflineFolder()
  } catch (e) {
    ui.showToast(`Backup failed: ${e.message}`, 'error')
  } finally {
    offlineBusy.value = false
  }
}

function saveOfflineSettings() {
  localStorage.setItem('atrium.offline.enabled', offlineEnabled.value ? '1' : '0')
  localStorage.setItem('atrium.offline.interval', String(offlineInterval.value))
  localStorage.setItem('atrium.offline.keepDays', String(offlineKeepDays.value))
  ui.showToast('Offline backup settings saved', 'success')
}
</script>

<template>
  <div class="px-8 md:px-12 py-10 max-w-3xl mx-auto" data-testid="settings-view">
    <PageHeader overline="Settings" title="Quiet preferences" sub="This system lives in your browser." />

    <SectionHeader overline="Shortcuts" title="Keyboard" />
    <div class="card p-5 mb-10 text-sm space-y-2.5 text-ink-2">
      <div class="flex items-center justify-between"><span>Open command palette</span><span class="flex gap-1"><span
            class="kbd">⌘</span><span class="kbd">K</span></span></div>
      <div class="flex items-center justify-between"><span>Quick capture</span><span class="flex gap-1"><span
            class="kbd">⌘</span><span class="kbd">N</span></span></div>
      <div class="flex items-center justify-between"><span>Switch workspace</span><span class="flex gap-1"><span
            class="kbd">⌥</span><span class="kbd">M</span></span></div>
      <div class="flex items-center justify-between"><span>Close overlay</span><span class="kbd">esc</span></div>
    </div>

    <SectionHeader overline="Appearance" title="Workspace & Theme" />
    <div class="card p-5 mb-10 space-y-4">
      <div class="flex items-center justify-between">
        <div>
          <p class="text-sm font-medium text-ink">Theme Mode</p>
          <p class="text-xs text-ink-3">Adjust the visual color scheme (currently {{ ui.theme }}).</p>
        </div>
        <button class="btn-secondary" @click="ui.toggleTheme" data-testid="settings-toggle-theme">Switch theme</button>
      </div>
      <hr class="border-line/40" />
      <div class="flex items-center justify-between">
        <div>
          <p class="text-sm font-medium text-ink">Show Cross-Workspace Alerts</p>
          <p class="text-xs text-ink-3">Notify me at the top of the screen if I have tasks due today in my other workspace.</p>
        </div>
        <VCheckbox v-model="ui.showWorkspaceAlerts" />
      </div>
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
          <button class="btn-secondary flex items-center gap-1.5" @click="toggleNotifications"
            :disabled="!notificationsSupported">
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
        <div class="v-input-group flex items-center relative">
          <input v-model="driveFolderInput" placeholder=" " id="drive-folder-location" class="pr-12" />
          <label for="drive-folder-location">Google Drive Client Folders Location</label>
          <a v-if="driveFolderLink" :href="driveFolderLink" target="_blank"
            class="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-lg bg-elevated text-ink-2 border border-line hover:bg-blue-600 hover:text-white transition-all flex items-center justify-center"
            title="Open folder in Google Drive">
            <ExternalLink class="w-3.5 h-3.5" />
          </a>
        </div>
        <div>
          <label class="overline block mb-1">Default Billing Currency</label>
          <VSelect v-model="defaultCurrencyInput" :options="[{value: 'USD', label: 'USD ($)'}, {value: 'GBP', label: 'GBP (£)'}, {value: 'INR', label: 'INR (₹)'}]" />
        </div>
      </div>
      <p class="text-xs text-ink-3 leading-relaxed">
        Accepts a Google Drive folder URL (e.g. <code
          class="bg-elevated px-1 py-0.5 rounded text-xs font-mono">https://drive.google.com/drive/folders/...</code>)
        to store client folders inside that existing folder, or a relative folder name/path (e.g. <code
          class="bg-elevated px-1 py-0.5 rounded text-xs font-mono">AtriumWork</code>)
        to create a root folder under that name.
      </p>
      <div class="flex justify-end pt-2 border-t border-line/40">
        <button class="btn-primary" @click="saveWorkSettings">
          <Save class="w-4 h-4" /> Save Work Preferences
        </button>
      </div>
    </div>

    <!-- GOOGLE DRIVE -->
    <SectionHeader overline="Cloud Sync Options" title="Google Drive backup"
      hint="Stores a single JSON in a private app-only folder on your Drive (drive.appdata scope)." />
    <div class="card p-6 mb-10 space-y-4" data-testid="drive-section">
      <div>
        <div class="flex items-center gap-2">
          <div class="v-input-group flex-1">
            <input v-model="clientIdInput" :readonly="!isEditingClientId" placeholder=" " class="font-mono"
              :class="{ '!bg-canvas !text-ink-3 cursor-not-allowed select-none': !isEditingClientId }"
              id="oauth-client-id" data-testid="drive-client-id" />
            <label for="oauth-client-id">OAuth Client ID</label>
          </div>
          <button class="btn-secondary shrink-0 flex items-center justify-center h-12 px-4 self-end mb-1"
            @click="handleClientIdAction" data-testid="drive-save-client-id">
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
          Enable the Drive API and Calendar API (If you want to use calendar feature) on the project.
        </p>
      </div>

      <!-- Sync Mode Configuration -->
      <div v-if="connected" class="pt-4 border-t border-line space-y-4">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label class="overline block mb-1">Sync Execution Mode</label>
            <VSelect v-model="syncModeInput" :options="[{value: 'auto', label: 'Automatic Sync (Background)'}, {value: 'manual', label: 'Manual Sync (Only on request)'}]" />
            <p class="text-[11px] text-ink-3 mt-1.5 leading-relaxed">
              <strong>Automatic:</strong> Runs backup & calendar checks in the background. May prompt Google
              verification
              pop-up if browser blocks third-party verification cookies.<br>
              <strong>Manual:</strong> Disables background calls. Stays quiet until you click a sync or backup action
              button.
            </p>
          </div>
          <div>
            <label class="overline block mb-1" :class="{ 'opacity-40 select-none': syncModeInput !== 'auto' }">Auto-Sync
              Time
              Interval</label>
            <VSelect v-model="syncIntervalInput" :disabled="syncModeInput !== 'auto'" :options="[
              { value: 5, label: 'Every 5 Minutes' },
              { value: 15, label: 'Every 15 Minutes' },
              { value: 30, label: 'Every 30 Minutes' },
              { value: 60, label: 'Every 1 Hour (Recommended)' },
              { value: 180, label: 'Every 3 Hours' }
            ]" />
            <p class="text-[11px] text-ink-3 mt-1.5 leading-relaxed"
              :class="{ 'opacity-40 select-none': syncModeInput !== 'auto' }">
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

    <!-- OFFLINE DIRECTORY BACKUP -->
    <SectionHeader overline="Local Backup" title="Offline folder backup"
      hint="Automatically writes timestamped JSON backups to a directory of your choice using File System Access API." />
    <div class="card p-6 mb-10 space-y-4">
      <div class="flex items-center justify-between flex-wrap gap-4">
        <div>
          <span class="overline block mb-1">Target Directory</span>
          <div class="flex items-center gap-2">
            <span class="text-sm font-medium" :class="offlineFolderName ? 'text-ink' : 'text-ink-3'">
              {{ offlineFolderName || 'No backup directory selected' }}
            </span>
            <!-- Status badges -->
            <span v-if="offlineFolderName && !offlineNeedsPermission"
              class="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-pri-strategic-bg text-pri-strategic border border-pri-strategic-bd">
              <Check class="w-3.5 h-3.5 text-pri-strategic" /> Active
            </span>
            <span v-else-if="offlineFolderName && offlineNeedsPermission"
              class="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-pri-critical-bg text-pri-critical border border-pri-critical-bd">
              <ShieldAlert class="w-3.5 h-3.5 text-pri-critical" /> Permission Required
            </span>
          </div>
        </div>
        <div class="flex items-center gap-2">
          <button v-if="offlineFolderName && offlineNeedsPermission" class="btn-secondary flex items-center gap-1.5"
            @click="authorizeOfflineFolder">
            Authorize Folder
          </button>
          <button class="btn-secondary flex items-center gap-1.5" @click="selectOfflineFolder">
            <FolderOpen class="w-4 h-4" /> {{ offlineFolderName ? 'Change Folder' : 'Select Folder' }}
          </button>
        </div>
      </div>

      <div class="pt-4 border-t border-line space-y-4">
        <div class="flex items-center justify-between">
          <div>
            <label class="text-sm font-medium text-ink">Enable Offline Folder Sync</label>
            <p class="text-xs text-ink-3">Check to automatically run local backup cycles.</p>
          </div>
          <VCheckbox v-model="offlineEnabled" @change="saveOfflineSettings" />
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label class="overline block mb-1">Backup Frequency</label>
            <VSelect v-model="offlineInterval" @change="saveOfflineSettings" :options="[
              { value: 5, label: 'Every 5 Minutes' },
              { value: 15, label: 'Every 15 Minutes' },
              { value: 30, label: 'Every 30 Minutes' },
              { value: 60, label: 'Every 1 Hour' },
              { value: 180, label: 'Every 3 Hours' },
              { value: 720, label: 'Every 12 Hours' },
              { value: 1440, label: 'Every 24 Hours (Recommended)' }
            ]" option-value="value" option-label="label" />
            <p class="text-[11px] text-ink-3 mt-1.5">
              Select how often to write local JSON backup files.
            </p>
          </div>
          <div>
            <label class="overline block mb-1">Retention Policy</label>
            <select v-model="offlineKeepDays" class="input-block text-sm" @change="saveOfflineSettings">
              <option :value="1">Keep 1 Day of Backups</option>
              <option :value="3">Keep 3 Days of Backups</option>
              <option :value="7">Keep 7 Days of Backups (Recommended)</option>
              <option :value="14">Keep 14 Days of Backups</option>
              <option :value="30">Keep 30 Days of Backups</option>
              <option :value="90">Keep 90 Days of Backups</option>
              <option :value="0">Keep Infinite (No Pruning)</option>
            </select>
            <p class="text-[11px] text-ink-3 mt-1.5">
              Old backups matching <code>atrium-backup-*</code> will be cleaned up automatically.
            </p>
          </div>
        </div>
      </div>

      <div class="pt-4 border-t border-line flex items-center justify-between flex-wrap gap-2">
        <button class="btn-primary" :disabled="!offlineFolderName || offlineBusy" @click="triggerOfflineBackup">
          <Loader2 v-if="offlineBusy" class="w-4 h-4 animate-spin" />
          <CloudUpload v-else class="w-4 h-4" />
          Backup Now
        </button>
        <span v-if="offlineLastBackup" class="text-xs text-ink-3">
          last offline backup {{ fromNow(offlineLastBackup) }}
        </span>
      </div>
    </div>

    <SectionHeader overline="Manual Backup" title="Local archive" hint="All data lives in IndexedDB on this device." />
    <div class="card p-5 mb-10 flex flex-wrap items-center gap-2">
      <button class="btn-secondary" @click="exportJson" data-testid="export-json">
        <FileDown class="w-4 h-4" /> Export JSON
      </button>
      <label class="btn-secondary cursor-pointer">
        <FileUp class="w-4 h-4" /> Import JSON
        <input ref="fileInput" type="file" accept="application/json" class="hidden" @change="importJson"
          data-testid="import-json" />
      </label>
      <button class="btn-ghost !text-pri-critical ml-auto" @click="clearAll" data-testid="clear-all">Reset the
        application</button>
    </div>


  </div>
</template>
