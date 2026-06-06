// Google Drive backup via Google Identity Services Token Client.
// Pure-browser, no backend. Scope: drive.appdata (private, app-scoped folder).
//
// Requires: a Google Cloud OAuth 2.0 Client ID (Web) with the app's URL as
// "Authorized JavaScript origins". User pastes this Client ID in Settings.

import { db } from "@/db";

const SCOPE = "https://www.googleapis.com/auth/drive.appdata";
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

async function ensureToken({ prompt = "" } = {}) {
  const clientId = getClientId();
  if (!clientId) throw new Error("Google Client ID not set. Add it in Settings.");
  await loadGisScript();
  return new Promise((resolve, reject) => {
    if (!tokenClient) {
      tokenClient = window.google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: SCOPE,
        callback: () => {}, // overridden per-request
        error_callback: () => {}, // overridden per-request
      });
    }
    tokenClient.callback = (resp) => {
      if (resp.error) return reject(new Error(resp.error));
      accessToken = resp.access_token;
      resolve(accessToken);
    };
    tokenClient.error_callback = (err) => {
      reject(new Error(err?.type || "Popup closed or authentication failed"));
    };
    tokenClient.requestAccessToken({ prompt });
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
  accessToken = null;
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
