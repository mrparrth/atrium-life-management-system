import { defineStore } from "pinia";
import { ref } from "vue";
import { db } from "@/db";

const SETTINGS_ID = "app";

export const DEFAULT_SETTINGS = {
  theme: "light",
  mode: "personal",
  user_name: "",
  show_workspace_alerts: true,
  initialized: true,
  tree_confetti_duration: 10,
  work_default_currency: "USD",
  work_drive_root: "AtriumWork",
  work_drive_folder_url: "",
  sync_mode: "auto",
  sync_interval: 60,
  offline_enabled: false,
  offline_interval: 1440,
  offline_keep_days: 7,
  sender_name: "",
  sender_email: "",
  sender_phone: "",
  sender_pan: "",
  sender_address: "",
  bank_name: "",
  bank_account_name: "",
  bank_account_number: "",
  bank_ifsc: "",
  bank_swift: "",
  bank_micr: "",
  financeStartMonth: "01",
  clientsViewMode: "grid",
  clientsSortBy: "updatedAt",
  daily_goal_splash_enabled: true,
  daily_goal_splash_duration: "3",
};

export const useSettingsStore = defineStore("settings", () => {
  const _cache = ref({});

  async function load() {
    const row = await db.settings.get(SETTINGS_ID);
    if (row) {
      _cache.value = { ...DEFAULT_SETTINGS, ...row };
    } else {
      _cache.value = { ...DEFAULT_SETTINGS };
      await db.settings.put({ id: SETTINGS_ID, ...DEFAULT_SETTINGS });
    }
  }

  async function set(key, value) {
    _cache.value[key] = value;
    const existing = await db.settings.get(SETTINGS_ID);
    if (existing) {
      await db.settings.update(SETTINGS_ID, { [key]: value });
    } else {
      await db.settings.put({ id: SETTINGS_ID, ...DEFAULT_SETTINGS, [key]: value });
    }

    // Mirror to localStorage for fast-boot cache if needed
    const keysToCache = {
      theme: "atrium.theme",
      mode: "atrium.mode",
      user_name: "atrium.user_name",
      show_workspace_alerts: "atrium.show_workspace_alerts",
      initialized: "atrium.initialized",
      tree_confetti_duration: "atrium.tree_confetti_duration",

      // Backup and sync configurations
      drive_last_backup: "atrium.drive.lastBackup",
      sync_mode: "atrium.sync.mode",
      sync_interval: "atrium.sync.interval",
      offline_enabled: "atrium.offline.enabled",
      offline_interval: "atrium.offline.interval",
      offline_keep_days: "atrium.offline.keepDays",
      offline_last_backup: "atrium.offline.lastBackup",
    };
    if (key in keysToCache) {
      localStorage.setItem(keysToCache[key], typeof value === "boolean" ? String(value) : String(value));
    }
  }

  function get(key, fallback = null) {
    if (key in _cache.value) return _cache.value[key];
    if (key in DEFAULT_SETTINGS) return DEFAULT_SETTINGS[key];
    // Check localStorage fallback for fast-boot cache keys
    const keysToCache = {
      tree_confetti_duration: "atrium.tree_confetti_duration",
    };
    if (keysToCache[key] && localStorage.getItem(keysToCache[key]) !== null) {
      const stored = localStorage.getItem(keysToCache[key]);
      return isNaN(Number(stored)) ? stored : Number(stored);
    }
    return fallback;
  }

  return { load, set, get };
});

export async function migrateLocalStorageToSettings(settingsStore) {
  const keysToMigrate = {
    "atrium.theme": "theme",
    "atrium.mode": "mode",
    "atrium.user_name": "user_name",
    "atrium.show_workspace_alerts": "show_workspace_alerts",
    "atrium.initialized": "initialized",
    "atrium.tree_confetti_duration": "tree_confetti_duration",

    // Invoicing & Bank Details (Group 6)
    "atrium.sender.name": "sender_name",
    "atrium.sender.email": "sender_email",
    "atrium.sender.phone": "sender_phone",
    "atrium.sender.pan": "sender_pan",
    "atrium.sender.address": "sender_address",
    "atrium.bank.name": "bank_name",
    "atrium.bank.account_name": "bank_account_name",
    "atrium.bank.account_number": "bank_account_number",
    "atrium.bank.ifsc": "bank_ifsc",
    "atrium.bank.micr": "bank_micr",
    "atrium.bank.swift": "bank_swift",
    "atrium.invoice.logo": "invoice_logo",
    "atrium.invoice.signature": "invoice_signature",
    "atrium.work.default_currency": "work_default_currency",
    "atrium.work.drive_folder_url": "work_drive_folder_url",
    "atrium.work.drive_root": "work_drive_root",

    // Backup & Sync
    "atrium.drive.lastBackup": "drive_last_backup",
    "atrium.sync.mode": "sync_mode",
    "atrium.sync.interval": "sync_interval",
    "atrium.offline.enabled": "offline_enabled",
    "atrium.offline.interval": "offline_interval",
    "atrium.offline.keepDays": "offline_keep_days",
    "atrium.offline.lastBackup": "offline_last_backup",
  };

  let migrated = false;
  for (const [localKey, settingsKey] of Object.entries(keysToMigrate)) {
    const val = localStorage.getItem(localKey);
    if (val !== null) {
      const booleanKeys = ["show_workspace_alerts", "initialized", "offline_enabled"];
      let parsed = val;
      if (booleanKeys.includes(settingsKey)) {
        parsed = val === "true" || val === "1" || val === 1 || val === true;
      } else if (val === "true") parsed = true;
      else if (val === "false") parsed = false;
      else if (!isNaN(Number(val)) && val.trim() !== "") parsed = Number(val);

      await settingsStore.set(settingsKey, parsed);

      // Remove sensitive invoicing keys completely from localStorage, leave others as fast-boot mirrors
      const keepAsMirror = [
        "atrium.theme",
        "atrium.mode",
        "atrium.user_name",
        "atrium.show_workspace_alerts",
        "atrium.initialized",
        "atrium.tree_confetti_duration",
        "atrium.drive.lastBackup",
        "atrium.sync.mode",
        "atrium.sync.interval",
        "atrium.offline.enabled",
        "atrium.offline.interval",
        "atrium.offline.keepDays",
        "atrium.offline.lastBackup",
      ].includes(localKey);

      if (!keepAsMirror) {
        localStorage.removeItem(localKey);
      }
      migrated = true;
    }
  }
  if (migrated) {
    console.log("Migrated legacy localStorage settings to IndexedDB settings store.");
  }
}
