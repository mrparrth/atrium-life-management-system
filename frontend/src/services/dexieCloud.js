import Dexie from "dexie";
import { dexieCloud } from "dexie-cloud-addon";
import { db as localDb } from "@/db";
import { ref } from "vue";

export const cloudUrl = ref(localStorage.getItem("atrium.dexieCloud.url") || "");
export const cloudUser = ref(null);
export const cloudSyncState = ref("offline"); // offline | connecting | in-sync | syncing | error
export const isConfigured = ref(!!localStorage.getItem("atrium.dexieCloud.url"));
export const cloudError = ref(null);

let cloudDbInstance = null;

/**
 * Returns the full stores schema definition identical to atrium_v1.
 */
export function getAppSchema() {
  return {
    years: "id, year, createdAt, updatedAt",
    goals: "id, yearId, status, createdAt, updatedAt",
    projects: "id, goalId, areaId, status, lastViewedAt, createdAt, updatedAt",
    tasks: "id, projectId, goalId, status, important, urgent, dueDate, scheduledDate, resurfaceDate, snoozedUntil, lastViewedAt, createdAt, updatedAt",
    notes: "id, projectId, taskId, goalId, bookmarkId, financeId, createdAt, updatedAt, lastViewedAt",
    bookmarks: "id, category, lastViewedAt, resurfaceDate, createdAt, updatedAt",
    areas: "id, name, createdAt, updatedAt",
    resources: "id, areaId, type, createdAt, updatedAt",
    finance_assets: "id, type, category, createdAt, updatedAt",
    finance_snapshots: "id, date, createdAt",
    reviews: "id, type, date, createdAt",
    resurfacing_logs: "id, entityType, entityId, surfacedAt",
    notifications: "id, createdAt, read",
    archives: "id, entityType, entityId, archivedAt",
    settings: "id",
    finance_cashflow: "id, type, category, recurring, date, createdAt, updatedAt",
    finance_categories: "id, scope, name, createdAt, [scope+name]",
    next_steps: "id, order, done, createdAt, updatedAt",
    bookmark_pages: "id, createdAt, updatedAt",
    finance_networth_logs: "id, date, createdAt, updatedAt",
    finance_cashflow_periods: "id, month, createdAt, updatedAt",
    next_steps_sections: "id, order, createdAt, updatedAt",
    work_clients: "id, name, status, lastInteractionAt, createdAt, updatedAt",
    work_items: "id, clientId, status, important, urgent, dueDate, resurfaceDate, snoozedUntil, charged, createdAt, updatedAt",
    work_leads: "id, status, followUpDate, createdAt, updatedAt",
    work_invoices: "id, clientId, status, invoiceNumber, dueDate, createdAt, updatedAt",
    work_meetings: "id, googleCalendarId, clientId, startDateTime, endDateTime, associatedType, associatedId, createdAt, updatedAt",
    work_capacity: "id, weekStartDate, createdAt, updatedAt",
    work_templates: "id, name, type, createdAt, updatedAt",
    work_communication_logs: "id, clientId, channel, date, createdAt",
    work_resources: "id, clientId, type, title, createdAt",
    work_notes: "id, clientId, title, createdAt, updatedAt, lastViewedAt",
    finance_subscriptions: "id, name, status, billingPeriod, nextRenewal, category",
    finance_content_pipeline: "id, status, pillar, type, publishDate, noteId, createdAt",
    follows: "id, name, username, category, createdAt",
    wishlist: "id, title, goalValue, currentValue, url, description, status, createdAt",
    habits: "id, title, frequency, createdAt, updatedAt",
    habit_logs: "id, habitId, date, completed, createdAt"
  };
}

/**
 * Creates or retrieves the cloud-enabled Dexie instance.
 */
export function getCloudDb(targetUrl = cloudUrl.value) {
  if (!targetUrl || !targetUrl.trim()) return null;
  if (cloudDbInstance && cloudDbInstance.cloud?.options?.databaseUrl === targetUrl.trim()) {
    return cloudDbInstance;
  }

  const cleanUrl = targetUrl.trim();
  const instance = new Dexie("atrium_cloud", { addons: [dexieCloud] });
  instance.version(1).stores(getAppSchema());
  instance.cloud.configure({
    databaseUrl: cleanUrl,
    requireAuth: false
  });

  if (instance.cloud.currentUser?.subscribe) {
    instance.cloud.currentUser.subscribe((user) => {
      cloudUser.value = user || null;
    });
  }

  if (instance.cloud.syncState?.subscribe) {
    instance.cloud.syncState.subscribe((state) => {
      if (state?.status) cloudSyncState.value = state.status;
      if (state?.error) {
        cloudError.value = state.error.message || String(state.error);
      } else {
        cloudError.value = null;
      }
    });
  }

  cloudDbInstance = instance;
  return instance;
}

/**
 * Initializes Dexie Cloud state on app startup if a URL was previously configured.
 */
export function initDexieCloud() {
  const savedUrl = localStorage.getItem("atrium.dexieCloud.url");
  if (savedUrl) {
    try {
      getCloudDb(savedUrl);
      isConfigured.value = true;
    } catch (e) {
      console.warn("Failed to initialize Dexie Cloud on startup:", e);
    }
  }
}

/**
 * Safe auto-migration: copies all existing records from the local atrium_v1 DB
 * into the cloud-synced database without deleting or modifying the local DB.
 */
export async function migrateLocalDataToCloud(targetCloudDb) {
  if (!targetCloudDb) return;
  const tables = localDb.tables.map(t => t.name);

  for (const tableName of tables) {
    try {
      const records = await localDb.table(tableName).toArray();
      if (!records || records.length === 0) continue;

      const cloudTable = targetCloudDb.table(tableName);
      if (!cloudTable) continue;

      // Only add records that do not already exist in the target cloud DB
      const existingCount = await cloudTable.count();
      if (existingCount === 0) {
        await cloudTable.bulkAdd(records);
      } else {
        await cloudTable.bulkPut(records);
      }
    } catch (e) {
      console.warn(`[dexie-cloud] Migration note for table ${tableName}:`, e.message || e);
    }
  }
}

/**
 * Signs into Dexie Cloud with the specified database URL.
 * Automatically provisions the cloud instance and seeds existing local records.
 */
export async function loginCloudWithUrl(url) {
  if (!url || !url.trim()) {
    throw new Error("Please enter a valid Dexie Cloud database URL (e.g. https://<db-id>.dexie.cloud)");
  }

  const cleanUrl = url.trim();
  localStorage.setItem("atrium.dexieCloud.url", cleanUrl);
  cloudUrl.value = cleanUrl;
  isConfigured.value = true;
  cloudError.value = null;

  const instance = getCloudDb(cleanUrl);
  if (!instance) throw new Error("Could not instantiate Dexie Cloud database.");

  // Open and migrate existing data
  await instance.open();
  await migrateLocalDataToCloud(instance);

  // Trigger login workflow (displays default Dexie Cloud OTP / Social prompt modal)
  return await instance.cloud.login();
}

/**
 * Signs out of the current Dexie Cloud user account.
 */
export async function logoutCloud() {
  if (!cloudDbInstance) return;
  await cloudDbInstance.cloud.logout();
  cloudUser.value = null;
}

/**
 * Triggers an immediate cloud synchronization pass.
 */
export async function syncNow() {
  if (!cloudDbInstance) {
    if (cloudUrl.value) getCloudDb(cloudUrl.value);
  }
  if (!cloudDbInstance) throw new Error("Dexie Cloud is not configured.");
  await cloudDbInstance.cloud.sync();
}

/**
 * Disconnects Dexie Cloud and clears configuration.
 */
export async function disconnectCloud() {
  if (cloudDbInstance) {
    try {
      await cloudDbInstance.cloud.logout();
      cloudDbInstance.close();
    } catch (e) {
      // ignore
    }
    cloudDbInstance = null;
  }

  localStorage.removeItem("atrium.dexieCloud.url");
  cloudUrl.value = "";
  cloudUser.value = null;
  isConfigured.value = false;
  cloudSyncState.value = "offline";
  cloudError.value = null;
}
