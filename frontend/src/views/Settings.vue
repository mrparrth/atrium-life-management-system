<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useUIStore } from '@/stores/ui'
import { useSettingsStore } from '@/stores/settings'
import { db } from '@/db'
import VCheckbox from '@/components/VCheckbox.vue'
import VSelect from '@/components/VSelect.vue'
import VUrlInput from '@/components/VUrlInput.vue'
import PageHeader from '@/components/PageHeader.vue'
import SectionHeader from '@/components/SectionHeader.vue'
import { downloadLocalBackup, getClientId, setClientId, connect as driveConnect, backup as driveBackup, restore as driveRestore, disconnect as driveDisconnect, lastBackupAt } from '@/services/drive'
import { fromNow } from '@/lib/date'
import { Cloud, CloudUpload, CloudDownload, Unlink, Save, FileDown, FileUp, Edit3, Loader2, Bell, BellOff, ExternalLink, FolderOpen, ShieldAlert, Check, Sparkles, Target, Compass, Gift, NotebookPen, Bookmark, Search, Sliders, Brain, Briefcase, HardDrive, Info, Database, Quote } from 'lucide-vue-next'
import { isNotificationSupported, requestNotificationPermission, areNotificationsEnabled, sendDesktopNotification } from '@/lib/notifications'

const ui = useUIStore()
const settings = useSettingsStore()
const origin = location.origin

const searchQuery = ref('')
const activeSection = ref('general')

const tabs = [
  { id: 'general', label: 'General', icon: Sliders },
  { id: 'memory', label: 'Resurfacing Memory', icon: Brain },
  { id: 'work', label: 'Work & Business', icon: Briefcase },
  { id: 'sync', label: 'Sync & Backup', icon: Cloud },
  { id: 'data', label: 'Data & Reset', icon: Database },
  { id: 'about', label: 'About', icon: Info }
]

const clientIdInput = ref('')
const connected = ref(false)
const lastBackup = ref(null)
const busy = ref(false)
const connecting = ref(false)
const backingUp = ref(false)
const restoring = ref(false)
const isEditingClientId = ref(false)
const needsIntervention = ref(false)

const notificationsSupported = ref(isNotificationSupported())
const notificationsEnabled = ref(areNotificationsEnabled())

const confettiDurationVal = ref('20')
const confettiOptions = [
  { id: '0', label: 'Disabled' },
  { id: '5', label: '5 Seconds' },
  { id: '10', label: '10 Seconds' },
  { id: '20', label: '20 Seconds' },
  { id: '30', label: '30 Seconds' }
]

async function saveConfettiDuration() {
  await settings.set('tree_confetti_duration', Number(confettiDurationVal.value))
  ui.showToast(`Confetti duration set to ${confettiDurationVal.value === '0' ? 'Disabled' : confettiDurationVal.value + 's'}`, 'success')
}

function triggerTestConfetti() {
  window.dispatchEvent(new CustomEvent('test-confetti', {
    detail: { duration: Number(confettiDurationVal.value) }
  }))
  ui.showToast(`Triggered test confetti (${confettiDurationVal.value === '0' ? 'Disabled' : confettiDurationVal.value + 's'})`, 'info')
}

const goalSplashDurationVal = ref(String(settings.get('daily_goal_splash_duration', '3')))
const goalSplashOptions = [
  { id: '0', label: 'Disabled' },
  { id: '3', label: '3 Seconds' },
  { id: '5', label: '5 Seconds' },
  { id: '10', label: '10 Seconds' },
  { id: '20', label: '20 Seconds' }
]

async function saveGoalSplashDuration() {
  await settings.set('daily_goal_splash_duration', goalSplashDurationVal.value)
  const isEnabled = goalSplashDurationVal.value !== '0'
  await settings.set('daily_goal_splash_enabled', isEnabled)
  ui.showToast(`Morning Goals Splash set to ${goalSplashDurationVal.value === '0' ? 'Disabled' : goalSplashDurationVal.value + 's'}`, 'success')
}

function triggerTestGoalSplash() {
  window.dispatchEvent(new CustomEvent('atrium-trigger-goals-splash'))
}

const spendingCurrencyInput = ref(settings.get('default_spending_currency', '₹'))
const spendingCurrencyOptions = [
  { id: '₹', label: '₹ (INR)' },
  { id: '$', label: '$ (USD)' },
  { id: '€', label: '€ (EUR)' },
  { id: '£', label: '£ (GBP)' }
]

async function saveSpendingCurrency() {
  await settings.set('default_spending_currency', spendingCurrencyInput.value)
  ui.showToast(`Default spending currency set to ${spendingCurrencyInput.value}`, 'success')
}

const resurfaceGoalIntervalInput = ref(Number(settings.get('resurface_goal_interval', 15)))
const resurfaceWishIntervalInput = ref(Number(settings.get('resurface_wish_interval', 15)))
const resurfaceNoteDaysInput = ref(Number(settings.get('resurface_note_days', 21)))
const resurfaceBookmarkDaysInput = ref(Number(settings.get('resurface_bookmark_days', 30)))
const resurfaceRadarIntervalInput = ref(Number(settings.get('resurface_radar_interval', 7)))

const resurfaceGoalCountInput = ref(Number(settings.get('resurface_goal_count', 1)))
const resurfaceWishCountInput = ref(Number(settings.get('resurface_wish_count', 1)))
const resurfaceNoteCountInput = ref(Number(settings.get('resurface_note_count', 1)))
const resurfaceBookmarkCountInput = ref(Number(settings.get('resurface_bookmark_count', 1)))
const resurfaceRadarCountInput = ref(Number(settings.get('resurface_radar_count', 1)))

async function saveResurfacingSettings() {
  await settings.set('resurface_goal_interval', Number(resurfaceGoalIntervalInput.value))
  await settings.set('resurface_wish_interval', Number(resurfaceWishIntervalInput.value))
  await settings.set('resurface_note_days', Number(resurfaceNoteDaysInput.value))
  await settings.set('resurface_bookmark_days', Number(resurfaceBookmarkDaysInput.value))
  await settings.set('resurface_radar_interval', Number(resurfaceRadarIntervalInput.value))
  await settings.set('resurface_goal_count', Number(resurfaceGoalCountInput.value))
  await settings.set('resurface_wish_count', Number(resurfaceWishCountInput.value))
  await settings.set('resurface_note_count', Number(resurfaceNoteCountInput.value))
  await settings.set('resurface_bookmark_count', Number(resurfaceBookmarkCountInput.value))
  await settings.set('resurface_radar_count', Number(resurfaceRadarCountInput.value))
  ui.showToast('Resurfacing memory settings updated', 'success')
}

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


const isEditingName = ref(!ui.userName.trim())
const nameInputVal = ref(ui.userName)

const favoriteQuoteVal = ref(settings.get('favorite_quote', ''))
const favoriteQuoteAuthorVal = ref(settings.get('favorite_quote_author', ''))

async function saveFavoriteQuote() {
  await settings.set('favorite_quote', favoriteQuoteVal.value.trim())
  await settings.set('favorite_quote_author', favoriteQuoteAuthorVal.value.trim())
  ui.showToast('Favorite quote saved', 'success')
}

function toggleNameEdit() {
  if (isEditingName.value) {
    ui.userName = nameInputVal.value.trim()
    isEditingName.value = false
    ui.showToast('Greeting name registered', 'success')
  } else {
    isEditingName.value = true
  }
}

async function refresh() {
  await settings.load()
  clientIdInput.value = getClientId()
  connected.value = !!localStorage.getItem('atrium.drive.connected')
  lastBackup.value = lastBackupAt()
  isEditingClientId.value = !clientIdInput.value.trim()
  needsIntervention.value = localStorage.getItem('atrium.drive.backupNeedsIntervention') === 'true'

  const url = settings.get('work_drive_folder_url', '')
  const root = settings.get('work_drive_root', 'AtriumWork')
  driveFolderInput.value = url || root

  confettiDurationVal.value = String(settings.get('tree_confetti_duration', 20))
  spendingCurrencyInput.value = settings.get('default_spending_currency', '₹')
  favoriteQuoteVal.value = settings.get('favorite_quote', '')
  favoriteQuoteAuthorVal.value = settings.get('favorite_quote_author', '')
  resurfaceGoalIntervalInput.value = Number(settings.get('resurface_goal_interval', 15))
  resurfaceWishIntervalInput.value = Number(settings.get('resurface_wish_interval', 15))
  resurfaceNoteDaysInput.value = Number(settings.get('resurface_note_days', 21))
  resurfaceBookmarkDaysInput.value = Number(settings.get('resurface_bookmark_days', 30))
  resurfaceRadarIntervalInput.value = Number(settings.get('resurface_radar_interval', 7))
  resurfaceGoalCountInput.value = Number(settings.get('resurface_goal_count', 1))
  resurfaceWishCountInput.value = Number(settings.get('resurface_wish_count', 1))
  resurfaceNoteCountInput.value = Number(settings.get('resurface_note_count', 1))
  resurfaceBookmarkCountInput.value = Number(settings.get('resurface_bookmark_count', 1))
  resurfaceRadarCountInput.value = Number(settings.get('resurface_radar_count', 1))
  offlineEnabled.value = Boolean(settings.get('offline_enabled', false))
  offlineInterval.value = Number(settings.get('offline_interval', 1440))
  offlineKeepDays.value = Number(settings.get('offline_keep_days', 7))
  checkOfflineFolder()
  nameInputVal.value = ui.userName
  if (!ui.userName.trim()) {
    isEditingName.value = true
  }
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
  localStorage.removeItem('atrium.initialized')
  localStorage.removeItem('atrium.user_name')
  localStorage.removeItem('atrium.use_name_in_greeting')
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
const defaultCurrencyInput = ref(settings.get('work_default_currency', 'USD'))
const syncModeInput = ref(settings.get('sync_mode', 'auto'))
const syncIntervalInput = ref(Number(settings.get('sync_interval', 60)))

function saveWorkSettings() {
  const val = driveFolderInput.value.trim()
  if (val.startsWith('http://') || val.startsWith('https://') || val.includes('drive.google.com')) {
    settings.set('work_drive_folder_url', val)
    settings.set('work_drive_root', '')
  } else {
    settings.set('work_drive_root', val || 'AtriumWork')
    settings.set('work_drive_folder_url', '')
  }
  settings.set('work_default_currency', defaultCurrencyInput.value)
  settings.set('sync_mode', syncModeInput.value)
  settings.set('sync_interval', String(syncIntervalInput.value))
  ui.showToast('Preferences saved', 'success')
  refresh()
}

import { saveDirectoryHandle, getDirectoryHandle, executeOfflineBackup, verifyPermission, isTauriEnv } from '@/services/offlineSync'

const offlineEnabled = ref(Boolean(settings.get('offline_enabled', false)))
const offlineInterval = ref(Number(settings.get('offline_interval', 1440)))
const offlineKeepDays = ref(Number(settings.get('offline_keep_days', 7)))
const offlineFolderName = ref('')
const offlineLastBackup = ref(settings.get('offline_last_backup', null))
const offlineBusy = ref(false)
const offlineNeedsPermission = ref(false)

async function checkOfflineFolder() {
  const handle = await getDirectoryHandle()
  if (handle) {
    if (typeof handle === 'string') {
      offlineFolderName.value = handle
      offlineNeedsPermission.value = false
    } else {
      offlineFolderName.value = handle.name
      try {
        const status = await handle.queryPermission({ mode: 'readwrite' })
        offlineNeedsPermission.value = status !== 'granted'
      } catch (e) {
        offlineNeedsPermission.value = true
      }
    }
  } else {
    offlineFolderName.value = ''
    offlineNeedsPermission.value = false
  }
}

async function selectOfflineFolder() {
  try {
    if (isTauriEnv()) {
      const { open } = await import('@tauri-apps/plugin-dialog')
      const selected = await open({
        directory: true,
        multiple: false,
        title: 'Select Offline Backup Directory'
      })
      if (selected) {
        const folderPath = Array.isArray(selected) ? selected[0] : selected
        await saveDirectoryHandle(folderPath)
        await checkOfflineFolder()
        ui.showToast('Backup directory selected successfully', 'success')
      }
      return
    }

    if (typeof window.showDirectoryPicker === 'function') {
      const handle = await window.showDirectoryPicker({
        mode: 'readwrite'
      })
      await saveDirectoryHandle(handle)
      await checkOfflineFolder()
      ui.showToast('Backup directory selected successfully', 'success')
      return
    }

    ui.showToast('Automatic folder sync is supported in Chrome, Edge, or the Atrium Mac app.', 'info')
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

function matchesSearch(text) {
  if (!searchQuery.value.trim()) return true
  return text.toLowerCase().includes(searchQuery.value.trim().toLowerCase())
}
</script>

<template>
  <div class="px-6 md:px-12 py-10 max-w-6xl mx-auto" data-testid="settings-view">
    <!-- Top Header Bar with Search -->
    <div class="flex items-center justify-between gap-4 flex-wrap pb-6 border-b border-line">
      <div>
        <h1 class="text-2xl font-serif font-medium text-ink">Settings</h1>
        <p class="text-xs text-ink-3 mt-1">Customize your Atrium experience</p>
      </div>
      <div class="relative w-full sm:w-72">
        <Search class="w-4 h-4 text-ink-3 absolute left-3 top-3" />
        <input v-model="searchQuery" placeholder="Search settings..."
          class="w-full bg-surface border border-line rounded-xl pl-9 pr-4 py-2 text-sm text-ink outline-none focus:border-pri-strategic/50 focus:ring-2 focus:ring-pri-strategic/10 transition-all" />
      </div>
    </div>

    <!-- 2-Column Sidebar Layout -->
    <div class="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start mt-8">
      <!-- Left Sidebar Navigation -->
      <aside class="lg:col-span-3 lg:sticky lg:top-8 space-y-1">
        <button v-for="tab in tabs" :key="tab.id" @click="activeSection = tab.id"
          class="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm transition-all duration-200 text-left font-normal"
          :class="[
            activeSection === tab.id && !searchQuery.trim()
              ? 'bg-pri-strategic/10 text-pri-strategic font-medium'
              : 'text-ink-2 hover:bg-surface/80 hover:text-ink'
          ]">
          <component :is="tab.icon" class="w-4 h-4 shrink-0"
            :class="activeSection === tab.id && !searchQuery.trim() ? 'text-pri-strategic' : 'text-ink-3'" />
          <span>{{ tab.label }}</span>
        </button>
      </aside>

      <!-- Right Main Content Panel -->
      <main class="lg:col-span-9 space-y-8">
        <!-- 1. GENERAL -->
        <section
          v-if="(activeSection === 'general' || searchQuery.trim()) && matchesSearch('general appearance user name greeting confetti splash currency shortcuts notifications desktop alerts')"
          id="sec-general" class="space-y-6">
          <SectionHeader overline="General" title="Appearance & Experience"
            hint="Configure your greeting name, celebrations, spending currency, and notifications." />

          <div class="card p-6 space-y-4">
            <div class="flex items-center gap-4 flex-wrap md:flex-nowrap">
              <div class="shrink-0 min-w-[280px]">
                <p class="text-sm text-ink">Greeting Name</p>
                <p class="text-xs text-ink-3">Used to greet you across your personal dashboard</p>
              </div>
              <div class="flex-grow flex items-center gap-2 w-full">
                <input v-model="nameInputVal" :disabled="!isEditingName" placeholder="Your name" id="settings-user-name"
                  data-testid="settings-user-name"
                  class="flex-grow bg-surface border border-line rounded-xl px-4 py-2.5 text-sm text-ink outline-none focus:border-pri-strategic/50 focus:ring-2 focus:ring-pri-strategic/10 transition-all disabled:opacity-60 disabled:cursor-not-allowed" />
                <button type="button" class="btn-secondary !p-3 shrink-0" @click="toggleNameEdit"
                  data-testid="settings-toggle-name-edit" :title="isEditingName ? 'Register name' : 'Edit name'">
                  <Check v-if="isEditingName" class="w-4 h-4 text-pri-strategic" />
                  <Edit3 v-else class="w-4 h-4" />
                </button>
              </div>
            </div>

            <hr class="border-line/40" />

            <div class="flex items-center justify-between gap-4 flex-wrap sm:flex-nowrap">
              <div>
                <p class="text-sm text-ink">Growth Tree Confetti Celebration</p>
                <p class="text-xs text-ink-3">Duration of continuous confetti burst when daily tree progress reaches
                  100%.</p>
              </div>
              <div class="flex items-center gap-2 shrink-0">
                <button @click="triggerTestConfetti"
                  class="btn-ghost !text-xs !py-2 px-3 font-semibold text-amber-600 dark:text-amber-400"
                  title="Test confetti burst animation">
                  <Sparkles class="w-3.5 h-3.5 inline mr-1" /> Test
                </button>
                <VSelect v-model="confettiDurationVal" id="settings-confetti-duration" :options="confettiOptions"
                  option-value="id" option-label="label" @change="saveConfettiDuration" class="!w-36" />
              </div>
            </div>

            <hr class="border-line/40" />

            <div class="flex items-center justify-between gap-4 flex-wrap sm:flex-nowrap">
              <div>
                <p class="text-sm text-ink">Daily Morning Goals Splash Screen</p>
                <p class="text-xs text-ink-3">Show a full-screen affirmation of active goals when opening the app each
                  morning.</p>
              </div>
              <div class="flex items-center gap-2 shrink-0">
                <button @click="triggerTestGoalSplash"
                  class="btn-ghost !text-xs !py-2 px-3 font-semibold text-emerald-600 dark:text-emerald-400"
                  title="Test morning goals splash screen">
                  <Sparkles class="w-3.5 h-3.5 inline mr-1" /> Test
                </button>
                <VSelect v-model="goalSplashDurationVal" id="settings-goal-splash-duration" :options="goalSplashOptions"
                  option-value="id" option-label="label" @change="saveGoalSplashDuration" class="!w-36" />
              </div>
            </div>

            <hr class="border-line/40" />

            <div class="flex items-center justify-between gap-4 flex-wrap sm:flex-nowrap">
              <div>
                <p class="text-sm text-ink">Default Personal Spending Currency</p>
                <p class="text-xs text-ink-3">Default currency symbol used across personal space (e.g. Wish List items).
                </p>
              </div>
              <div class="flex items-center gap-2 shrink-0">
                <VSelect v-model="spendingCurrencyInput" id="settings-spending-currency"
                  :options="spendingCurrencyOptions" option-value="id" option-label="label"
                  @change="saveSpendingCurrency" class="!w-36" />
              </div>
            </div>

            <hr class="border-line/40" />

            <div class="flex items-center justify-between gap-4 flex-wrap sm:flex-nowrap">
              <div>
                <p class="text-sm text-ink">Show Cross-Workspace Alerts</p>
                <p class="text-xs text-ink-3">Notify me at the top of the screen if I have tasks due today in my other
                  workspace.</p>
              </div>
              <VCheckbox v-model="ui.showWorkspaceAlerts" class="shrink-0" />
            </div>
            <hr class="border-line/40" />

            <div class="flex items-center justify-between gap-4 flex-wrap sm:flex-nowrap">
              <div>
                <p class="text-sm text-ink ">Desktop System Notifications</p>
                <p class="text-xs text-ink-3">Receive browser alerts for strategic briefings, due dates, and reminders.
                  This feature is untested and will not work unless deployed to a server</p>
              </div>
              <div class="flex items-center gap-3 shrink-0">
                <button v-if="notificationsEnabled" @click="testNotification"
                  class="btn-ghost !text-xs !py-1.5 px-3">Test Alert</button>
                <button @click="toggleNotifications" class="btn-secondary !py-2 px-4 flex items-center gap-2 text-xs">
                  <Bell v-if="!notificationsEnabled" class="w-3.5 h-3.5" />
                  <BellOff v-else class="w-3.5 h-3.5" />
                  <span>{{ notificationsEnabled ? 'Disable' : 'Enable' }}</span>
                </button>
              </div>
            </div>

          </div>

          <!-- Favorite Quote Card -->
          <div class="card p-6 space-y-4">
            <div>
              <div class="flex items-center gap-2 text-pri-strategic font-medium text-sm mb-1">
                <Quote class="w-4 h-4" />
                <span>Favorite Quote & Motto</span>
              </div>
              <p class="text-xs text-ink-3">This quote will be displayed on your morning goals splash screen and at the
                top of your Goals screen.</p>
            </div>

            <div class="space-y-3">
              <div>
                <label class="block text-xs font-semibold text-ink-2 uppercase tracking-wider mb-1.5">Quote</label>
                <textarea v-model="favoriteQuoteVal" rows="2"
                  placeholder="e.g. The secret of getting ahead is getting started."
                  class="w-full bg-surface border border-line rounded-xl px-4 py-2.5 text-sm text-ink outline-none focus:border-pri-strategic/50 focus:ring-2 focus:ring-pri-strategic/10 transition-all font-sans placeholder-ink-3/50 resize-none"></textarea>
              </div>

              <div class="flex items-center gap-3 flex-wrap sm:flex-nowrap">
                <div class="flex-grow w-full">
                  <label class="block text-xs font-semibold text-ink-2 uppercase tracking-wider mb-1.5">Author / Said
                    By</label>
                  <input v-model="favoriteQuoteAuthorVal" placeholder="e.g. Mark Twain"
                    class="w-full bg-surface border border-line rounded-xl px-4 py-2.5 text-sm text-ink outline-none focus:border-pri-strategic/50 focus:ring-2 focus:ring-pri-strategic/10 transition-all placeholder-ink-3/50" />
                </div>
                <button type="button" class="btn-primary shrink-0 self-end py-2.5 px-5 text-xs font-semibold"
                  @click="saveFavoriteQuote">
                  Save Quote
                </button>
              </div>
            </div>
          </div>

          <!-- Shortcuts Overview Card -->
          <div class="card p-5 text-sm space-y-2.5 text-ink-2">
            <div class="text-xs font-mono uppercase tracking-wider text-ink-3 mb-2 font-semibold">Keyboard Shortcuts
            </div>
            <div class="flex items-center justify-between"><span>Open command palette</span><span
                class="flex gap-1"><span class="kbd">⌘</span><span class="kbd">K</span></span></div>
            <div class="flex items-center justify-between"><span>Quick capture</span><span class="flex gap-1"><span
                  class="kbd">⌘</span><span class="kbd">N</span></span></div>
            <div class="flex items-center justify-between"><span>Switch workspace</span><span class="flex gap-1"><span
                  class="kbd">⌥</span><span class="kbd">M</span></span></div>
            <div class="flex items-center justify-between"><span>Close overlay</span><span class="kbd">esc</span></div>
          </div>
        </section>

        <!-- 2. RESURFACING MEMORY -->
        <section
          v-if="(activeSection === 'memory' || searchQuery.trim()) && matchesSearch('memory resurfacing goals radar wish notes bookmarks cadence limit')"
          id="sec-memory" class="space-y-6">
          <SectionHeader overline="Memory Engine" title="Resurfacing Memory Settings"
            hint="Configure daily item limits and resurfacing cadence for gentle personal memory rotation." />

          <div class="card p-6 overflow-x-auto">
            <!-- Tip Callout -->
            <div
              class="mb-5 p-3.5 bg-pri-strategic/5 border border-pri-strategic/20 rounded-xl flex items-start gap-3 text-xs text-ink-2">
              <Sparkles class="w-4 h-4 text-pri-strategic shrink-0 mt-0.5" />
              <p>
                <strong class="font-medium text-ink">Daily Limit</strong> sets how many items appear on your sidebar
                today.
                <strong class="font-medium text-ink">Cadence</strong> sets the minimum rest days before the same item
                can resurface again.
              </p>
            </div>

            <table class="w-full text-left text-sm border-collapse">
              <thead>
                <tr class="border-b border-line text-xs font-mono uppercase tracking-wider text-ink-3">
                  <th class="pb-3 font-semibold min-w-[200px]">Memory Category</th>
                  <th class="pb-3 font-semibold text-center w-44">Daily Limit</th>
                  <th class="pb-3 font-semibold text-right w-52">Cadence / Threshold</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-line/40 text-ink">
                <!-- Goals -->
                <tr>
                  <td class="py-4 pr-4">
                    <div class="flex items-center gap-2">
                      <Target class="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                      <span class="text-sm font-normal text-ink">Goals & Aspirations</span>
                    </div>
                    <p class="text-xs text-ink-3 mt-0.5 pl-6">Active strategic goals</p>
                  </td>
                  <td class="py-4 px-2 text-center">
                    <div class="inline-flex items-center gap-1.5 justify-center">
                      <input type="number" min="0" max="20" v-model.number="resurfaceGoalCountInput"
                        @change="saveResurfacingSettings"
                        class="w-20 bg-surface border border-line rounded-xl px-3 py-1.5 text-center text-sm font-mono text-ink outline-none focus:border-pri-strategic/50 focus:ring-2 focus:ring-pri-strategic/10" />
                      <span class="text-xs text-ink-3">/ day</span>
                    </div>
                  </td>
                  <td class="py-4 pl-4 text-right">
                    <div class="inline-flex items-center justify-end gap-1.5">
                      <span class="text-xs text-ink-3">Every</span>
                      <input type="number" min="1" max="365" v-model.number="resurfaceGoalIntervalInput"
                        @change="saveResurfacingSettings"
                        class="w-20 bg-surface border border-line rounded-xl px-3 py-1.5 text-center text-sm font-mono text-ink outline-none focus:border-pri-strategic/50 focus:ring-2 focus:ring-pri-strategic/10" />
                      <span class="text-xs text-ink-3">days</span>
                    </div>
                  </td>
                </tr>

                <!-- Radar -->
                <tr>
                  <td class="py-4 pr-4">
                    <div class="flex items-center gap-2">
                      <Compass class="w-4 h-4 text-amber-500 shrink-0" />
                      <span class="text-sm font-normal text-ink">Radar (Creators & Feeds)</span>
                    </div>
                    <p class="text-xs text-ink-3 mt-0.5 pl-6">Inspiration & creator channels</p>
                  </td>
                  <td class="py-4 px-2 text-center">
                    <div class="inline-flex items-center gap-1.5 justify-center">
                      <input type="number" min="0" max="20" v-model.number="resurfaceRadarCountInput"
                        @change="saveResurfacingSettings"
                        class="w-20 bg-surface border border-line rounded-xl px-3 py-1.5 text-center text-sm font-mono text-ink outline-none focus:border-pri-strategic/50 focus:ring-2 focus:ring-pri-strategic/10" />
                      <span class="text-xs text-ink-3">/ day</span>
                    </div>
                  </td>
                  <td class="py-4 pl-4 text-right">
                    <div class="inline-flex items-center justify-end gap-1.5">
                      <span class="text-xs text-ink-3">Every</span>
                      <input type="number" min="1" max="365" v-model.number="resurfaceRadarIntervalInput"
                        @change="saveResurfacingSettings"
                        class="w-20 bg-surface border border-line rounded-xl px-3 py-1.5 text-center text-sm font-mono text-ink outline-none focus:border-pri-strategic/50 focus:ring-2 focus:ring-pri-strategic/10" />
                      <span class="text-xs text-ink-3">days</span>
                    </div>
                  </td>
                </tr>

                <!-- Wish List -->
                <tr>
                  <td class="py-4 pr-4">
                    <div class="flex items-center gap-2">
                      <Gift class="w-4 h-4 text-pink-500 shrink-0" />
                      <span class="text-sm font-normal text-ink">Wish List Items</span>
                    </div>
                    <p class="text-xs text-ink-3 mt-0.5 pl-6">Active personal wishlist items</p>
                  </td>
                  <td class="py-4 px-2 text-center">
                    <div class="inline-flex items-center gap-1.5 justify-center">
                      <input type="number" min="0" max="20" v-model.number="resurfaceWishCountInput"
                        @change="saveResurfacingSettings"
                        class="w-20 bg-surface border border-line rounded-xl px-3 py-1.5 text-center text-sm font-mono text-ink outline-none focus:border-pri-strategic/50 focus:ring-2 focus:ring-pri-strategic/10" />
                      <span class="text-xs text-ink-3">/ day</span>
                    </div>
                  </td>
                  <td class="py-4 pl-4 text-right">
                    <div class="inline-flex items-center justify-end gap-1.5">
                      <span class="text-xs text-ink-3">Every</span>
                      <input type="number" min="1" max="365" v-model.number="resurfaceWishIntervalInput"
                        @change="saveResurfacingSettings"
                        class="w-20 bg-surface border border-line rounded-xl px-3 py-1.5 text-center text-sm font-mono text-ink outline-none focus:border-pri-strategic/50 focus:ring-2 focus:ring-pri-strategic/10" />
                      <span class="text-xs text-ink-3">days</span>
                    </div>
                  </td>
                </tr>

                <!-- Personal Notes -->
                <tr>
                  <td class="py-4 pr-4">
                    <div class="flex items-center gap-2">
                      <NotebookPen class="w-4 h-4 text-blue-500 shrink-0" />
                      <span class="text-sm font-normal text-ink">Personal Notes</span>
                    </div>
                    <p class="text-xs text-ink-3 mt-0.5 pl-6">Saved notes & context docs</p>
                  </td>
                  <td class="py-4 px-2 text-center">
                    <div class="inline-flex items-center gap-1.5 justify-center">
                      <input type="number" min="0" max="20" v-model.number="resurfaceNoteCountInput"
                        @change="saveResurfacingSettings"
                        class="w-20 bg-surface border border-line rounded-xl px-3 py-1.5 text-center text-sm font-mono text-ink outline-none focus:border-pri-strategic/50 focus:ring-2 focus:ring-pri-strategic/10" />
                      <span class="text-xs text-ink-3">/ day</span>
                    </div>
                  </td>
                  <td class="py-4 pl-4 text-right">
                    <div class="inline-flex items-center justify-end gap-1.5">
                      <span class="text-xs text-ink-3">Unviewed for</span>
                      <input type="number" min="1" max="365" v-model.number="resurfaceNoteDaysInput"
                        @change="saveResurfacingSettings"
                        class="w-20 bg-surface border border-line rounded-xl px-3 py-1.5 text-center text-sm font-mono text-ink outline-none focus:border-pri-strategic/50 focus:ring-2 focus:ring-pri-strategic/10" />
                      <span class="text-xs text-ink-3">days</span>
                    </div>
                  </td>
                </tr>

                <!-- Web Bookmarks -->
                <tr>
                  <td class="py-4 pr-4">
                    <div class="flex items-center gap-2">
                      <Bookmark class="w-4 h-4 text-purple-500 shrink-0" />
                      <span class="text-sm font-normal text-ink">Web Bookmarks</span>
                    </div>
                    <p class="text-xs text-ink-3 mt-0.5 pl-6">Saved links & reading list</p>
                  </td>
                  <td class="py-4 px-2 text-center">
                    <div class="inline-flex items-center gap-1.5 justify-center">
                      <input type="number" min="0" max="20" v-model.number="resurfaceBookmarkCountInput"
                        @change="saveResurfacingSettings"
                        class="w-20 bg-surface border border-line rounded-xl px-3 py-1.5 text-center text-sm font-mono text-ink outline-none focus:border-pri-strategic/50 focus:ring-2 focus:ring-pri-strategic/10" />
                      <span class="text-xs text-ink-3">/ day</span>
                    </div>
                  </td>
                  <td class="py-4 pl-4 text-right">
                    <div class="inline-flex items-center justify-end gap-1.5">
                      <span class="text-xs text-ink-3">Unviewed for</span>
                      <input type="number" min="1" max="365" v-model.number="resurfaceBookmarkDaysInput"
                        @change="saveResurfacingSettings"
                        class="w-20 bg-surface border border-line rounded-xl px-3 py-1.5 text-center text-sm font-mono text-ink outline-none focus:border-pri-strategic/50 focus:ring-2 focus:ring-pri-strategic/10" />
                      <span class="text-xs text-ink-3">days</span>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <!-- 3. WORK & BUSINESS -->
        <section
          v-if="(activeSection === 'work' || searchQuery.trim()) && matchesSearch('work business drive billing folder currency clients sync')"
          id="sec-work" class="space-y-6">
          <SectionHeader overline="Work Workspace" title="Work & Client Preferences"
            hint="Configure default billing currency, Drive root directory, and work sync mode." />

          <div class="card p-6 space-y-4">
            <div class="flex items-center justify-between gap-4 flex-wrap sm:flex-nowrap">
              <div class="shrink-0 max-w-xs">
                <p class="text-sm text-ink font-medium">Work Drive Folder URL or Name</p>
                <p class="text-xs text-ink-3 mt-0.5 leading-relaxed">Paste a Google Drive folder link or folder name for
                  client files.</p>
              </div>
              <div class="flex-grow flex items-center gap-2 max-w-md w-full">
                <VUrlInput v-model="driveFolderInput" placeholder="https://drive.google.com/drive/folders/..."
                  class="w-full" />
              </div>
            </div>

            <hr class="border-line/40" />

            <div class="flex items-center justify-between gap-4 flex-wrap sm:flex-nowrap">
              <div>
                <p class="text-sm text-ink font-medium">Default Work Billing Currency</p>
                <p class="text-xs text-ink-3 mt-0.5 leading-relaxed">Default currency for client invoices, leads, and
                  work items.</p>
              </div>
              <div class="w-36 shrink-0">
                <VSelect v-model="defaultCurrencyInput" id="settings-work-currency"
                  :options="[{ id: 'USD', label: 'USD ($)' }, { id: 'INR', label: 'INR (₹)' }, { id: 'EUR', label: 'EUR (€)' }, { id: 'GBP', label: 'GBP (£)' }]"
                  option-value="id" option-label="label" @change="saveWorkSettings" />
              </div>
            </div>

            <hr class="border-line/40" />

            <div class="flex justify-end">
              <button @click="saveWorkSettings" class="btn-primary !py-2 px-4 text-xs flex items-center gap-1.5">
                <Save class="w-3.5 h-3.5" /> Save Work Preferences
              </button>
            </div>
          </div>
        </section>

        <!-- 4. SYNC & BACKUP -->
        <section
          v-if="(activeSection === 'sync' || searchQuery.trim()) && matchesSearch('sync cloud backup google drive client id restore offline disk folder')"
          id="sec-sync" class="space-y-6">
          <SectionHeader overline="Data Synchronization" title="Sync & Backup"
            hint="Manage Google Drive cloud sync and offline disk backup schedules." />

          <!-- Google Drive Sync Card -->
          <div class="card p-6 space-y-6">
            <div v-if="needsIntervention"
              class="p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl flex items-start gap-3 text-xs text-amber-600 dark:text-amber-400">
              <ShieldAlert class="w-4 h-4 shrink-0 mt-0.5" />
              <div>
                <p class="font-semibold">Re-authorization required</p>
                <p class="mt-0.5">Google Drive session expired. Please reconnect below to resume automatic sync.</p>
              </div>
            </div>

            <!-- OAuth Client ID -->
            <div>
              <p class="text-sm text-ink font-medium">Google OAuth Client ID</p>
              <p class="text-xs text-ink-3 mt-1 leading-relaxed">
                Create a Web OAuth Client in <a href="https://console.cloud.google.com/apis/credentials" target="_blank"
                  class="underline decoration-line-2 underline-offset-2 hover:text-ink">Google Cloud Console</a>.
                Add <code
                  class="bg-surface border border-line px-1.5 py-0.5 rounded text-xs font-mono">{{ origin }}</code> as
                an Authorized JavaScript origin.
                Enable the Drive API and Calendar API (If you want to use calendar feature) on the project.
              </p>
              <div class="flex items-center gap-2 mt-3">
                <input v-model="clientIdInput" :disabled="!isEditingClientId"
                  placeholder="Enter your Google OAuth Client ID"
                  class="flex-grow bg-surface border border-line rounded-xl px-4 py-2.5 text-sm text-ink font-mono outline-none focus:border-pri-strategic/50 focus:ring-2 focus:ring-pri-strategic/10 transition-all disabled:opacity-60" />
                <button type="button"
                  class="btn-secondary !py-2.5 px-4 text-xs flex items-center gap-1.5 shrink-0 h-[42px]"
                  @click="handleClientIdAction">
                  <Check v-if="isEditingClientId" class="w-3.5 h-3.5 text-pri-strategic" />
                  <Edit3 v-else class="w-3.5 h-3.5" />
                  <span>{{ isEditingClientId ? 'Save ID' : 'Edit ID' }}</span>
                </button>
              </div>
            </div>

            <hr class="border-line/40" />

            <!-- Connection Actions -->
            <div class="flex items-center justify-between gap-4 flex-wrap">
              <div>
                <p class="text-sm text-ink font-medium">Drive Connection Status</p>
                <p class="text-xs text-ink-3">
                  <span v-if="connected"
                    class="text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5 mt-0.5">
                    <Check class="w-3.5 h-3.5" /> Connected · Last synced {{ lastBackup ? fromNow(lastBackup) : 'never'
                    }}
                  </span>
                  <span v-else class="text-ink-3 mt-0.5 block">Not connected</span>
                </p>
              </div>
              <div class="flex items-center gap-2 flex-wrap">
                <button v-if="!connected" @click="connect" :disabled="busy || !clientIdInput.trim()"
                  class="btn-primary !py-2 px-4 text-xs flex items-center gap-1.5">
                  <Loader2 v-if="connecting" class="w-3.5 h-3.5 animate-spin" />
                  <Cloud v-else class="w-3.5 h-3.5" />
                  <span>Connect Drive</span>
                </button>
                <template v-else>
                  <button @click="disconnect" :disabled="busy"
                    class="btn-ghost !py-2 px-3 text-xs text-red-500 hover:text-red-600 flex items-center gap-1.5">
                    <Unlink class="w-3.5 h-3.5" /> Disconnect
                  </button>
                  <button @click="backup" :disabled="busy"
                    class="btn-secondary !py-2 px-3 text-xs flex items-center gap-1.5">
                    <CloudUpload class="w-3.5 h-3.5" /> Backup Now
                  </button>
                  <button @click="restore" :disabled="busy"
                    class="btn-secondary !py-2 px-3 text-xs flex items-center gap-1.5">
                    <CloudDownload class="w-3.5 h-3.5" /> Restore
                  </button>
                </template>
              </div>
            </div>
          </div>

          <!-- Offline Disk Backup Card inside Sync & Backup -->
          <div class="card p-6 space-y-4">
            <div class="flex items-center justify-between">
              <div>
                <p class="text-sm text-ink font-medium">Automatic Offline Disk Backups</p>
                <p class="text-xs text-ink-3">Keep regular timestamped JSON snapshots in a local folder on your
                  computer.</p>
              </div>
              <VCheckbox v-model="offlineEnabled" @change="saveOfflineSettings" />
            </div>

            <hr class="border-line/40" />

            <div class="space-y-3">
              <div class="flex items-center justify-between gap-4 flex-wrap">
                <div>
                  <p class="text-sm text-ink font-medium">Backup Target Folder</p>
                  <p class="text-xs text-ink-3 mt-0.5 leading-relaxed">Selected directory for local offline backups.</p>
                </div>
                <div class="flex items-center gap-2 flex-wrap shrink-0">
                  <button @click="selectOfflineFolder"
                    class="btn-secondary !py-2 px-3 text-xs flex items-center gap-1.5 shrink-0 h-[38px]">
                    <FolderOpen class="w-3.5 h-3.5" /> {{ offlineFolderName ? 'Change Folder' : 'Select Folder' }}
                  </button>
                  <button v-if="offlineNeedsPermission" @click="authorizeOfflineFolder"
                    class="btn-secondary !py-2 px-3 text-xs text-amber-600 border-amber-500/30 bg-amber-500/10 flex items-center gap-1.5 shrink-0 h-[38px]">
                    <ShieldAlert class="w-3.5 h-3.5" /> Authorize Access
                  </button>
                </div>
              </div>
              <input v-model="offlineFolderName" placeholder="No backup directory selected" readonly
                class="w-full bg-canvas/30 border border-line rounded-xl px-4 py-2 text-xs font-mono text-ink-2 outline-none select-none" />
            </div>

            <hr class="border-line/40" />

            <div class="flex items-center justify-between gap-4 flex-wrap">
              <div>
                <p class="text-sm text-ink font-medium">Last Offline Backup</p>
                <p class="text-xs text-ink-3">
                  {{ offlineLastBackup ? fromNow(offlineLastBackup) : 'No offline backups created yet' }}</p>
              </div>
              <button @click="triggerOfflineBackup" :disabled="offlineBusy || !offlineFolderName"
                class="btn-secondary !py-2 px-3 text-xs flex items-center gap-1.5">
                <Loader2 v-if="offlineBusy" class="w-3.5 h-3.5 animate-spin" />
                <Save v-else class="w-3.5 h-3.5" /> Trigger Offline Backup
              </button>
            </div>
          </div>
        </section>

        <!-- 5. DATA & RESET -->
        <section
          v-if="(activeSection === 'data' || searchQuery.trim()) && matchesSearch('data reset export import json erase clear indexeddb privacy')"
          id="sec-data" class="space-y-6">
          <SectionHeader overline="Data Operations" title="Data & Reset"
            hint="Export or import manual JSON backups and manage local app data reset." />

          <!-- Manual JSON File Export/Import Card -->
          <div class="card p-6 space-y-4">
            <div class="flex items-center justify-between gap-4 flex-wrap">
              <div>
                <p class="text-sm text-ink font-medium">Local Data Backup (JSON)</p>
                <p class="text-xs text-ink-3">Download a 100% complete JSON backup file or restore from a previous
                  export.</p>
              </div>
              <div class="flex items-center gap-2">
                <button @click="exportJson" class="btn-secondary !py-2 px-3 text-xs flex items-center gap-1.5">
                  <FileDown class="w-3.5 h-3.5" /> Export JSON
                </button>
                <button @click="fileInput.click()" class="btn-secondary !py-2 px-3 text-xs flex items-center gap-1.5">
                  <FileUp class="w-3.5 h-3.5" /> Import JSON
                </button>
                <input ref="fileInput" type="file" accept=".json" class="hidden" @change="importJson" />
              </div>
            </div>
          </div>

          <!-- Erase All Data Card -->
          <div class="card p-6 space-y-4 border-red-500/20">
            <div class="flex items-center justify-between">
              <div>
                <p class="text-sm text-ink text-red-600 dark:text-red-400 font-medium">Erase All Local Data</p>
                <p class="text-xs text-ink-3">Permanently delete all tasks, notes, goals, and history. A backup will be
                  downloaded automatically first.</p>
              </div>
              <button @click="clearAll"
                class="btn-ghost !text-xs !py-2 px-4 text-red-600 hover:bg-red-500/10 border border-red-500/20 rounded-xl">
                Clear All Data
              </button>
            </div>
          </div>
        </section>

        <!-- 6. ABOUT -->
        <section
          v-if="(activeSection === 'about' || searchQuery.trim()) && matchesSearch('about system version indexeddb dexie browser storage')"
          id="sec-about" class="space-y-6">
          <SectionHeader overline="System Info" title="About Atrium Life System"
            hint="Local-first personal operating environment." />

          <div class="card p-6 space-y-3 text-sm text-ink-2">
            <div class="flex items-center justify-between"><span>App Version</span><span
                class="font-mono text-xs font-semibold text-ink">v2.4.0 (PWA)</span></div>
            <div class="flex items-center justify-between"><span>Storage Engine</span><span
                class="font-mono text-xs text-ink-3">Dexie IndexedDB (36 tables)</span></div>
            <div class="flex items-center justify-between"><span>Architecture</span><span
                class="font-mono text-xs text-ink-3">100% Client-Side Local Browser</span></div>
            <hr class="border-line/40 my-2" />
            <p class="text-xs text-ink-3 leading-relaxed">
              Atrium is a private, zero-tracking personal operating environment. All your goals, tasks, notes,
              bookmarks, and
              finance records remain encrypted and stored locally in your browser.
            </p>
          </div>
        </section>
      </main>
    </div>
  </div>
</template>
