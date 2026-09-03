// Google Drive backup via Google Identity Services Token Client.
// Pure-browser, no backend. Scope: drive.appdata (private, app-scoped folder).
//
// Requires: a Google Cloud OAuth 2.0 Client ID (Web) with the app's URL as
// "Authorized JavaScript origins". User pastes this Client ID in Settings.

import { db } from "@/db";
import { sendDesktopNotification } from "@/lib/notifications";

const SCOPE =
  "https://www.googleapis.com/auth/drive.appdata https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/calendar.readonly";
const BACKUP_NAME = "atrium-backup.json";

let tokenClient = null;
let accessToken = null;

function loadGisScript() {
  return new Promise((resolve, reject) => {
    if (window.google?.accounts?.oauth2) return resolve();
    const existing = document.querySelector("script[data-gis]");
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", reject);
      return;
    }
    const s = document.createElement("script");
    s.src = "https://accounts.google.com/gsi/client";
    s.async = true;
    s.defer = true;
    s.dataset.gis = "1";
    s.onload = () => resolve();
    s.onerror = reject;
    document.head.appendChild(s);
  });
}

const DEFAULT_CLIENT_ID = "242665320379-ns0robt8ok06ui80ncgfo17bgr2lr7me.apps.googleusercontent.com";

export function getClientId() {
  return localStorage.getItem("atrium.drive.clientId") || DEFAULT_CLIENT_ID;
}
export function setClientId(id) {
  localStorage.setItem("atrium.drive.clientId", id || "");
  tokenClient = null; // force re-init
}
export function isConnected() {
  return !!localStorage.getItem("atrium.drive.connected");
}
export function lastBackupAt() {
  return localStorage.getItem("atrium.drive.lastBackup") || null;
}

export function checkAndCaptureOAuthRedirect() {
  const full = (window.location.hash || "") + (window.location.search || "");
  if (full.includes("access_token=")) {
    const raw = full.replace(/^[#?]\/?/, "");
    const params = new URLSearchParams(raw);
    const token = params.get("access_token");
    const expiresIn = params.get("expires_in") || "3600";
    if (token) {
      setManualToken(token);
      try {
        const bc = new BroadcastChannel("atrium_oauth_channel");
        bc.postMessage({ type: "oauth_success", token });
        bc.close();
      } catch (e) {}

      window.history.replaceState(null, "", window.location.pathname);
      return true;
    }
  }
  return false;
}

import { isTauriEnv } from "./offlineSync";

let currentScope = null;
let tokenExpiresAt = 0;

export function setManualToken(token) {
  if (!token) return;
  const cleanToken = token.trim();
  accessToken = cleanToken;
  tokenExpiresAt = Date.now() + 3600 * 1000;
  localStorage.setItem("atrium.drive.accessToken", cleanToken);
  localStorage.setItem("atrium.drive.tokenExpiresAt", String(tokenExpiresAt));
  localStorage.setItem("atrium.drive.connected", "1");
}

async function ensureToken({ prompt = "", scope = SCOPE } = {}) {
  if (!accessToken) {
    accessToken = localStorage.getItem("atrium.drive.accessToken");
    tokenExpiresAt = Number(localStorage.getItem("atrium.drive.tokenExpiresAt")) || 0;
    currentScope = localStorage.getItem("atrium.drive.tokenScope");
  }

  if (accessToken && tokenExpiresAt > Date.now() + 60000 && currentScope === scope) {
    return accessToken;
  }

  const clientId = getClientId();
  if (!clientId) throw new Error("Google Client ID not set. Add it in Settings.");

  if (isTauriEnv()) {
    const redirectUri = "atrium://oauth-callback";
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
      `client_id=${encodeURIComponent(clientId)}&` +
      `redirect_uri=${encodeURIComponent(redirectUri)}&` +
      `response_type=token&` +
      `scope=${encodeURIComponent(scope)}` +
      (prompt ? `&prompt=${encodeURIComponent(prompt)}` : "");

    return new Promise(async (resolve, reject) => {
      try {
        const { onOpenUrl } = await import("@tauri-apps/plugin-deep-link");
        const { openUrl } = await import("@tauri-apps/plugin-opener");

        const unsubscribe = await onOpenUrl((urls) => {
          for (const url of urls) {
            if (url.includes("atrium://oauth-callback")) {
              const hash = url.split("#")[1] || url.split("?")[1] || "";
              const params = new URLSearchParams(hash);
              const token = params.get("access_token");
              if (token) {
                setManualToken(token);
                if (typeof unsubscribe === "function") unsubscribe();
                resolve(token);
              }
            }
          }
        });

        await openUrl(authUrl);
      } catch (err) {
        try {
          const { invoke } = await import("@tauri-apps/api/core");
          const { listen } = await import("@tauri-apps/api/event");

          const unlisten = await listen("oauth-token-received", (event) => {
            if (event.payload) {
              setManualToken(event.payload);
              if (unlisten) unlisten();
              resolve(event.payload);
            }
          });

          await invoke("start_native_oauth", { clientId, scope });
        } catch (e) {
          reject(e);
        }
      }
    });
  }

  await loadGisScript();
  return new Promise((resolve, reject) => {
    if (!tokenClient || currentScope !== scope) {
      tokenClient = window.google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: scope,
        callback: () => {},
        error_callback: () => {},
      });
      currentScope = scope;
    }
    tokenClient.callback = (resp) => {
      if (resp.error) return reject(new Error(resp.error));
      if (!resp.access_token) {
        return reject(new Error("Access not granted or popup closed"));
      }
      accessToken = resp.access_token;
      const expiresInSec = Number(resp.expires_in) || 3600;
      tokenExpiresAt = Date.now() + expiresInSec * 1000;
      currentScope = scope;

      localStorage.setItem("atrium.drive.accessToken", accessToken);
      localStorage.setItem("atrium.drive.tokenExpiresAt", String(tokenExpiresAt));
      localStorage.setItem("atrium.drive.tokenScope", scope);
      localStorage.setItem("atrium.drive.connected", "1");

      resolve(accessToken);
    };
    tokenClient.error_callback = async (err) => {
      if (err?.type === "popup_failed_to_open") {
        const redirectUri = window.location.origin;
        const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
          `client_id=${encodeURIComponent(clientId)}&` +
          `redirect_uri=${encodeURIComponent(redirectUri)}&` +
          `response_type=token&` +
          `scope=${encodeURIComponent(scope)}`;
        try {
          const { openUrl } = await import("@tauri-apps/plugin-opener");
          await openUrl(authUrl);
        } catch (e2) {
          window.open(authUrl, "_blank");
        }
        return reject(new Error("Google Sign-In opened in system browser. Complete sign in to connect."));
      }
      reject(new Error(err?.type || "Popup closed or authentication failed"));
    };
    tokenClient.requestAccessToken({ prompt, scope });
  });
}

async function findBackupId(token) {
  const url = `https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&q=${encodeURIComponent(`name='${BACKUP_NAME}' and trashed=false`)}&fields=files(id,name,modifiedTime)`;
  const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!r.ok) throw new Error("Drive list failed");
  const j = await r.json();
  return j.files?.[0]?.id || null;
}

export async function backup() {
  const token = await ensureToken({ prompt: "" });
  const data = await exportAllData();
  const json = JSON.stringify({ schemaVersion: 4, exportedAt: new Date().toISOString(), data }, null, 2);
  const existingId = await findBackupId(token);
  const meta = existingId ? {} : { name: BACKUP_NAME, parents: ["appDataFolder"] };
  const boundary = "-------atrium" + Math.random().toString(36).slice(2);
  const body = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(meta)}\r\n--${boundary}\r\nContent-Type: application/json\r\n\r\n${json}\r\n--${boundary}--`;
  const url = existingId
    ? `https://www.googleapis.com/upload/drive/v3/files/${existingId}?uploadType=multipart`
    : `https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart`;
  const r = await fetch(url, {
    method: existingId ? "PATCH" : "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": `multipart/related; boundary=${boundary}`,
    },
    body,
  });
  if (!r.ok) throw new Error(`Drive upload failed (${r.status})`);
  const nowStr = new Date().toISOString();
  localStorage.setItem("atrium.drive.lastBackup", nowStr);
  await db.settings.update("app", { drive_last_backup: nowStr });
  localStorage.setItem("atrium.drive.backupFailedAttempts", "0");
  localStorage.removeItem("atrium.drive.backupNeedsIntervention");
  localStorage.removeItem("atrium.drive.lastBackupError");
  window.dispatchEvent(new CustomEvent('atrium-backup-success'));
  return await r.json();
}

export async function restore() {
  const token = await ensureToken({ prompt: "" });
  const id = await findBackupId(token);
  if (!id) throw new Error("No backup found in Drive");
  const r = await fetch(`https://www.googleapis.com/drive/v3/files/${id}?alt=media`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!r.ok) throw new Error("Drive download failed");
  const payload = await r.json();
  if (!payload?.data) throw new Error("Invalid backup payload");
  await importAllData(payload.data);
  return true;
}

export async function connect() {
  // Force consent prompt to verify scope grant
  await ensureToken({ prompt: "consent" });
  localStorage.setItem("atrium.drive.connected", "1");
  localStorage.setItem("atrium.drive.backupFailedAttempts", "0");
  localStorage.removeItem("atrium.drive.backupNeedsIntervention");
  return true;
}

export function disconnect() {
  localStorage.removeItem("atrium.drive.connected");
  localStorage.removeItem("atrium.drive.lastBackup");
  localStorage.removeItem("atrium.drive.accessToken");
  localStorage.removeItem("atrium.drive.tokenExpiresAt");
  localStorage.removeItem("atrium.drive.tokenScope");
  localStorage.removeItem("atrium.drive.backupFailedAttempts");
  localStorage.removeItem("atrium.drive.backupNeedsIntervention");
  accessToken = null;
  tokenExpiresAt = 0;
  currentScope = null;
  tokenClient = null;
}

// ─── Local JSON export/import ────────────────────────────────────────
const TABLES = [
  "years",
  "goals",
  "projects",
  "tasks",
  "notes",
  "bookmarks",
  "areas",
  "resources",
  "finance_assets",
  "finance_snapshots",
  "reviews",
  "resurfacing_logs",
  "notifications",
  "archives",
  "settings",
  "finance_cashflow",
  "finance_categories",
  "next_steps",
  "bookmark_pages",
  "finance_networth_logs",
  "finance_cashflow_periods",
  "next_steps_sections",
  "work_clients",
  "work_items",
  "work_leads",
  "work_invoices",
  "work_meetings",
  "work_capacity",
  "work_templates",
  "work_communication_logs",
  "work_resources",
  "work_notes",
  "finance_subscriptions",
  "finance_content_pipeline",
  "follows",
  "wishlist"
];

export async function exportAllData() {
  const data = {};
  const { DEFAULT_SETTINGS } = await import('@/stores/settings');
  const tableNames = db.tables.map(t => t.name);
  for (const t of tableNames) {
    if (t === 'settings') {
      const rows = await db.table('settings').toArray();
      data.settings = rows.map(r => r.id === 'app' ? { ...DEFAULT_SETTINGS, ...r } : r);
    } else {
      data[t] = await db.table(t).toArray();
    }
  }
  return data;
}

export async function syncSettingsToLocalStorage() {
  const row = await db.settings.get("app");
  if (!row) return;
  
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
  
  for (const [settingsKey, localKey] of Object.entries(keysToCache)) {
    if (settingsKey in row) {
      const val = row[settingsKey];
      localStorage.setItem(localKey, typeof val === 'boolean' ? String(val) : val);
    }
  }
}

export async function importAllData(data) {
  const tableNames = db.tables.map(t => t.name);
  for (const t of tableNames) {
    if (!Array.isArray(data[t])) continue;
    await db.table(t).clear();
    if (data[t].length) await db.table(t).bulkAdd(data[t]);
  }
  await syncSettingsToLocalStorage();
}

export function downloadLocalBackup() {
  return exportAllData().then((data) => {
    const blob = new Blob([JSON.stringify({ schemaVersion: 4, exportedAt: new Date().toISOString(), data }, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `atrium-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  });
}

async function findFolderByName(token, name, parentId = "root") {
  const q = `name='${name.replace(/'/g, "\\'")}' and mimeType='application/vnd.google-apps.folder' and '${parentId}' in parents and trashed=false`;
  const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,name)`;
  const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!r.ok) throw new Error(`Failed to search folder "${name}"`);
  const j = await r.json();
  return j.files?.[0]?.id || null;
}

async function createFolder(token, name, parentId = "root") {
  const url = "https://www.googleapis.com/drive/v3/files";
  const metadata = {
    name: name,
    mimeType: "application/vnd.google-apps.folder",
    parents: [parentId],
  };
  const r = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(metadata),
  });
  if (!r.ok) throw new Error(`Failed to create folder "${name}"`);
  const j = await r.json();
  return j.id;
}

export async function createClientDriveFolder(clientName, rootPathConfig) {
  const scope = "https://www.googleapis.com/auth/drive.file";
  const token = await ensureToken({ prompt: "", scope });

  const parts = (rootPathConfig || "AtriumWork")
    .split("/")
    .map((p) => p.trim())
    .filter(Boolean);

  let currentParentId = "root";
  for (const part of parts) {
    let folderId = await findFolderByName(token, part, currentParentId);
    if (!folderId) {
      folderId = await createFolder(token, part, currentParentId);
    }
    currentParentId = folderId;
  }

  let clientFolderId = await findFolderByName(token, clientName, currentParentId);
  if (!clientFolderId) {
    clientFolderId = await createFolder(token, clientName, currentParentId);
  }

  return clientFolderId;
}

/**
 * Create (or find) a client subfolder inside an already-known parent folder ID.
 * Use this when the user has pasted an existing Drive folder URL in Settings —
 * the parent folder ID comes from that URL so we skip name-based root traversal.
 * Uses the broader drive scope so we can write inside user-owned folders.
 */
export async function createClientDriveFolderInParent(clientName, parentFolderId) {
  const scope = "https://www.googleapis.com/auth/drive";
  const token = await ensureToken({ prompt: "", scope });

  let clientFolderId = await findFolderByName(token, clientName, parentFolderId);
  if (!clientFolderId) {
    clientFolderId = await createFolder(token, clientName, parentFolderId);
  }

  return clientFolderId;
}

/**
 * Extract a folder ID from a Google Drive folder URL.
 * Supports:
 *   https://drive.google.com/drive/folders/FOLDER_ID
 *   https://drive.google.com/drive/u/0/folders/FOLDER_ID
 * Or a bare folder ID string.
 */
export function extractFolderIdFromUrl(url) {
  if (!url) return null;
  const trimmed = url.trim();
  const match = trimmed.match(/\/folders\/([a-zA-Z0-9_-]+)/);
  if (match) return match[1];
  // Treat bare alphanumeric string as a direct folder ID
  if (/^[a-zA-Z0-9_-]{20,}$/.test(trimmed)) return trimmed;
  return null;
}

export async function autoBackup() {
  if (!isConnected()) return;
  const mode = localStorage.getItem("atrium.sync.mode") || "auto";
  if (mode === "manual") return;

  const last = lastBackupAt();
  const lastAttempt = localStorage.getItem("atrium.drive.lastBackupAttempt");
  const now = Date.now();
  const intervalMin = Number(localStorage.getItem("atrium.sync.interval")) || 60;

  if (last && now - new Date(last).getTime() < intervalMin * 60000) return;

  // Throttle failed attempts: wait at least 15 minutes between backup attempts
  if (lastAttempt && now - new Date(lastAttempt).getTime() < 15 * 60000) return;

  // Short-circuit if manual intervention is required
  if (localStorage.getItem("atrium.drive.backupNeedsIntervention") === "true") return;

  localStorage.setItem("atrium.drive.lastBackupAttempt", new Date().toISOString());

  try {
    const token = await ensureToken({ prompt: "none", scope: SCOPE });
    const data = await exportAllData();
    const json = JSON.stringify({ schemaVersion: 4, exportedAt: new Date().toISOString(), data }, null, 2);
    const existingId = await findBackupId(token);
    const meta = existingId ? {} : { name: BACKUP_NAME, parents: ["appDataFolder"] };
    const boundary = "-------atrium" + Math.random().toString(36).slice(2);
    const body = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(meta)}\r\n--${boundary}\r\nContent-Type: application/json\r\n\r\n${json}\r\n--${boundary}--`;
    const url = existingId
      ? `https://www.googleapis.com/upload/drive/v3/files/${existingId}?uploadType=multipart`
      : `https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart`;
    const r = await fetch(url, {
      method: existingId ? "PATCH" : "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": `multipart/related; boundary=${boundary}`,
      },
      body,
    });
    if (r.ok) {
      const nowStr = new Date().toISOString();
      localStorage.setItem("atrium.drive.lastBackup", nowStr);
      await db.settings.update("app", { drive_last_backup: nowStr });
      localStorage.setItem("atrium.drive.backupFailedAttempts", "0");
      localStorage.removeItem("atrium.drive.backupNeedsIntervention");
      localStorage.removeItem("atrium.drive.lastBackupError");
      window.dispatchEvent(new CustomEvent('atrium-backup-success'));
      console.log("Hourly auto-backup completed successfully");
    } else {
      throw new Error(`Upload returned status ${r.status}`);
    }
  } catch (e) {
    const attempts = Number(localStorage.getItem("atrium.drive.backupFailedAttempts") || 0) + 1;
    localStorage.setItem("atrium.drive.backupFailedAttempts", String(attempts));
    console.warn(`Silent hourly auto-backup skipped (attempt ${attempts}):`, e.message);

    if (attempts >= 3) {
      localStorage.setItem("atrium.drive.backupNeedsIntervention", "true");
      localStorage.setItem("atrium.drive.lastBackupError", e.message || "Unknown error");
      window.dispatchEvent(new CustomEvent('atrium-backup-failed-alert', { detail: { message: e.message } }));
    }
  }
}

export async function syncGoogleCalendar({ force = false } = {}) {
  if (!isConnected()) return;
  const mode = localStorage.getItem("atrium.sync.mode") || "auto";
  if (mode === "manual" && !force) return;

  // Short-circuit silent sync if manual intervention is required
  if (!force && localStorage.getItem("atrium.drive.backupNeedsIntervention") === "true") return;

  try {
    const token = await ensureToken({ prompt: "none", scope: SCOPE });

    // Fetch events from today to 7 days in the future
    const timeMin = new Date();
    timeMin.setHours(0, 0, 0, 0);
    const timeMax = new Date();
    timeMax.setDate(timeMax.getDate() + 7);

    const url = `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${encodeURIComponent(timeMin.toISOString())}&timeMax=${encodeURIComponent(timeMax.toISOString())}&singleEvents=true&orderBy=startTime`;

    const r = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!r.ok) throw new Error(`Calendar fetch failed (${r.status})`);
    const j = await r.json();
    const events = j.items || [];
    console.log("events", events);

    const meetingsStore = (await import("@/stores/workMeetings")).useWorkMeetingsStore();
    await meetingsStore.load();

    for (const item of events) {
      const start = item.start?.dateTime || item.start?.date;
      const end = item.end?.dateTime || item.end?.date;
      if (!start) continue;

      // Filter: only bring in meetings where there are other guests OR contains meeting/sync keywords OR name slash name format (e.g. "Sara / Partha")
      const attendees = item.attendees || [];
      const hasGuests = attendees.some((a) => !a.self);
      const titleLower = (item.summary || "").toLowerCase();
      const descLower = (item.description || "").toLowerCase();
      const isMeetingKeyword = titleLower.includes("meeting") || titleLower.includes("sync");
      const isSlashFormat = /\w+\s*\/\s*\w+/.test(titleLower);

      if (!hasGuests && !isMeetingKeyword && !isSlashFormat) continue;

      let meetLink = item.hangoutLink || (item.location && item.location.includes("http") ? item.location : "");
      if (!meetLink && item.description) {
        const urlRegex = /(https?:\/\/[^\s>"]+)/g;
        const match = item.description.match(urlRegex);
        if (match) {
          meetLink = match[0];
        }
      }
      const existing = meetingsStore.items.find((m) => m.googleCalendarId === item.id);
      if (existing) {
        const timeChanged = existing.startDateTime !== start || existing.endDateTime !== end;
        const detailsChanged =
          existing.title !== item.summary ||
          existing.description !== (item.description || "") ||
          existing.meetLink !== meetLink;

        if (timeChanged || detailsChanged) {
          await meetingsStore.update(existing.id, {
            title: item.summary || "Untitled Meeting",
            description: item.description || "",
            startDateTime: start,
            endDateTime: end,
            meetLink,
          });

          if (timeChanged) {
            sendDesktopNotification("Meeting Rescheduled", {
              body: `"${item.summary || "Untitled"}" has been rescheduled to ${new Date(start).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} on ${new Date(start).toLocaleDateString()}`,
            });
          }
        }
      } else {
        await meetingsStore.add({
          googleCalendarId: item.id,
          title: item.summary || "Untitled Meeting",
          description: item.description || "",
          startDateTime: start,
          endDateTime: end,
          meetLink,
        });

        // Notify for new future meetings
        if (new Date(start) > new Date()) {
          sendDesktopNotification("New Meeting Scheduled", {
            body: `${item.summary || "Untitled Meeting"} - ${new Date(start).toLocaleDateString()} at ${new Date(start).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`,
          });
        }
      }
    }
  } catch (e) {
    console.warn("Google Calendar sync failed/skipped:", e.message);
  }
}
