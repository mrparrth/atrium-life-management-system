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

export function getClientId() {
  return localStorage.getItem("atrium.drive.clientId") || "";
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

let currentScope = null;
let tokenExpiresAt = 0;

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
  await loadGisScript();
  return new Promise((resolve, reject) => {
    if (!tokenClient || currentScope !== scope) {
      tokenClient = window.google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: scope,
        callback: () => {}, // overridden per-request
        error_callback: () => {}, // overridden per-request
      });
      currentScope = scope;
    }
    tokenClient.callback = (resp) => {
      if (resp.error) return reject(new Error(resp.error));
      accessToken = resp.access_token;
      const expiresInSec = Number(resp.expires_in) || 3600;
      tokenExpiresAt = Date.now() + expiresInSec * 1000;
      currentScope = scope;

      localStorage.setItem("atrium.drive.accessToken", accessToken);
      localStorage.setItem("atrium.drive.tokenExpiresAt", String(tokenExpiresAt));
      localStorage.setItem("atrium.drive.tokenScope", scope);

      resolve(accessToken);
    };
    tokenClient.error_callback = (err) => {
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
  localStorage.setItem("atrium.drive.lastBackup", new Date().toISOString());
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
  return true;
}

export function disconnect() {
  localStorage.removeItem("atrium.drive.connected");
  localStorage.removeItem("atrium.drive.lastBackup");
  localStorage.removeItem("atrium.drive.accessToken");
  localStorage.removeItem("atrium.drive.tokenExpiresAt");
  localStorage.removeItem("atrium.drive.tokenScope");
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
  "bookmark_pages",
  "next_steps",
  "finance_networth_logs",
  "finance_cashflow_periods",
  "finance_categories",
  "reviews",
  "settings",
];

export async function exportAllData() {
  const data = {};
  for (const t of TABLES) data[t] = await db.table(t).toArray();
  return data;
}

export async function importAllData(data) {
  for (const t of TABLES) {
    if (!Array.isArray(data[t])) continue;
    await db.table(t).clear();
    if (data[t].length) await db.table(t).bulkAdd(data[t]);
  }
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

export async function autoBackup() {
  if (!isConnected()) return;
  const mode = localStorage.getItem("atrium.sync.mode") || "auto";
  if (mode === "manual") return;

  const last = lastBackupAt();
  const intervalMin = Number(localStorage.getItem("atrium.sync.interval")) || 60;
  if (last && Date.now() - new Date(last).getTime() < intervalMin * 60000) return;

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
      localStorage.setItem("atrium.drive.lastBackup", new Date().toISOString());
      console.log("Hourly auto-backup completed successfully");
    }
  } catch (e) {
    console.warn("Silent hourly auto-backup skipped:", e.message);
  }
}

export async function syncGoogleCalendar({ force = false } = {}) {
  if (!isConnected()) return;
  const mode = localStorage.getItem("atrium.sync.mode") || "auto";
  if (mode === "manual" && !force) return;

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

      console.log("hasGuests:", hasGuests, "isMeetingKeyword:", isMeetingKeyword, "isSlashFormat:", isSlashFormat, item.summary);
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
        const detailsChanged = existing.title !== item.summary ||
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
              body: `"${item.summary || "Untitled"}" has been rescheduled to ${new Date(start).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})} on ${new Date(start).toLocaleDateString()}`
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
            body: `${item.summary || "Untitled Meeting"} - ${new Date(start).toLocaleDateString()} at ${new Date(start).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`
          });
        }
      }
    }
  } catch (e) {
    console.warn("Google Calendar sync failed/skipped:", e.message);
  }
}
