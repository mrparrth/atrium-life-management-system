import { defineStore } from 'pinia'
import { ref } from 'vue'
import { db } from '@/db'

const SETTINGS_ID = 'app'

export const useSettingsStore = defineStore('settings', () => {
  const _cache = ref({})

  async function load() {
    const row = await db.settings.get(SETTINGS_ID)
    if (row) _cache.value = row
  }

  async function set(key, value) {
    _cache.value[key] = value
    await db.settings.update(SETTINGS_ID, { [key]: value })
    
    // Mirror to localStorage for fast-boot cache if needed
    const keysToCache = {
      theme: 'atrium.theme',
      mode: 'atrium.mode',
      user_name: 'atrium.user_name',
      show_workspace_alerts: 'atrium.show_workspace_alerts',
      initialized: 'atrium.initialized',
      
      // Backup and sync configurations
      drive_last_backup: 'atrium.drive.lastBackup',
      sync_mode: 'atrium.sync.mode',
      sync_interval: 'atrium.sync.interval',
      offline_enabled: 'atrium.offline.enabled',
      offline_interval: 'atrium.offline.interval',
      offline_keep_days: 'atrium.offline.keepDays',
      offline_last_backup: 'atrium.offline.lastBackup'
    };
    if (key in keysToCache) {
      localStorage.setItem(keysToCache[key], typeof value === 'boolean' ? String(value) : value)
    }
  }

  function get(key, fallback = null) {
    return key in _cache.value ? _cache.value[key] : fallback
  }

  return { load, set, get }
})

export async function migrateLocalStorageToSettings(settingsStore) {
  const keysToMigrate = {
    'atrium.theme': 'theme',
    'atrium.mode': 'mode',
    'atrium.user_name': 'user_name',
    'atrium.show_workspace_alerts': 'show_workspace_alerts',
    'atrium.initialized': 'initialized',
    
    // Invoicing & Bank Details (Group 6)
    'atrium.sender.name': 'sender_name',
    'atrium.sender.email': 'sender_email',
    'atrium.sender.phone': 'sender_phone',
    'atrium.sender.pan': 'sender_pan',
    'atrium.sender.address': 'sender_address',
    'atrium.bank.name': 'bank_name',
    'atrium.bank.account_name': 'bank_account_name',
    'atrium.bank.account_number': 'bank_account_number',
    'atrium.bank.ifsc': 'bank_ifsc',
    'atrium.bank.micr': 'bank_micr',
    'atrium.bank.swift': 'bank_swift',
    'atrium.invoice.logo': 'invoice_logo',
    'atrium.invoice.signature': 'invoice_signature',
    'atrium.work.default_currency': 'work_default_currency',
    'atrium.work.drive_folder_url': 'work_drive_folder_url',
    'atrium.work.drive_root': 'work_drive_root',
    
    // Backup & Sync
    'atrium.drive.lastBackup': 'drive_last_backup',
    'atrium.sync.mode': 'sync_mode',
    'atrium.sync.interval': 'sync_interval',
    'atrium.offline.enabled': 'offline_enabled',
    'atrium.offline.interval': 'offline_interval',
    'atrium.offline.keepDays': 'offline_keep_days',
    'atrium.offline.lastBackup': 'offline_last_backup'
  }
  
  let migrated = false
  for (const [localKey, settingsKey] of Object.entries(keysToMigrate)) {
    const val = localStorage.getItem(localKey)
    if (val !== null) {
      let parsed = val
      if (val === 'true') parsed = true
      else if (val === 'false') parsed = false
      
      await settingsStore.set(settingsKey, parsed)
      
      // Remove sensitive invoicing keys completely from localStorage, leave others as fast-boot mirrors
      const keepAsMirror = [
        'atrium.theme', 
        'atrium.mode', 
        'atrium.user_name', 
        'atrium.show_workspace_alerts', 
        'atrium.initialized',
        'atrium.drive.lastBackup',
        'atrium.sync.mode',
        'atrium.sync.interval',
        'atrium.offline.enabled',
        'atrium.offline.interval',
        'atrium.offline.keepDays',
        'atrium.offline.lastBackup'
      ].includes(localKey)
      
      if (!keepAsMirror) {
        localStorage.removeItem(localKey)
      }
      migrated = true
    }
  }
  if (migrated) {
    console.log('Migrated legacy localStorage settings to IndexedDB settings store.')
  }
}

