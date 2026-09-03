import { db } from "@/db";
import { exportAllData } from "@/services/drive";

export function isTauriEnv() {
  return Boolean(window.__TAURI_INTERNALS__ || window.__TAURI__);
}

export async function saveDirectoryHandle(handle) {
  const existing = (await db.settings.get("app")) || { id: "app" };
  if (typeof handle === "string") {
    existing.tauriFolderPath = handle;
  } else {
    existing.directoryHandle = handle;
  }
  await db.settings.put(existing);
}

export async function getDirectoryHandle() {
  const row = await db.settings.get("app");
  if (row?.tauriFolderPath) {
    return row.tauriFolderPath;
  }
  return row?.directoryHandle || null;
}

export async function verifyPermission(handle, readWrite = true) {
  if (typeof handle === "string") {
    return true;
  }
  if (!handle || typeof handle.queryPermission !== "function") return false;
  const opts = {};
  if (readWrite) opts.mode = "readwrite";
  if ((await handle.queryPermission(opts)) === "granted") {
    return true;
  }
  if ((await handle.requestPermission(opts)) === "granted") {
    return true;
  }
  return false;
}

export async function executeOfflineBackup() {
  const handle = await getDirectoryHandle();
  if (!handle) throw new Error("No offline backup folder selected. Select one in Settings.");

  const fileName = `atrium-backup-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
  const data = await exportAllData();
  const payload = {
    schemaVersion: 4,
    exportedAt: new Date().toISOString(),
    data,
  };
  const jsonString = JSON.stringify(payload, null, 2);

  if (typeof handle === "string" || isTauriEnv()) {
    const pathStr = typeof handle === "string" ? handle : String(handle);
    const { writeTextFile } = await import("@tauri-apps/plugin-fs");
    const filePath = pathStr.endsWith("/") ? `${pathStr}${fileName}` : `${pathStr}/${fileName}`;
    await writeTextFile(filePath, jsonString);
  } else {
    const hasPerm = await verifyPermission(handle, true);
    if (!hasPerm) throw new Error("Permission denied to write to the selected folder.");

    const fileHandle = await handle.getFileHandle(fileName, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(jsonString);
    await writable.close();
  }

  const nowStr = new Date().toISOString();
  localStorage.setItem("atrium.offline.lastBackup", nowStr);
  await db.settings.update("app", { offline_last_backup: nowStr });

  return true;
}

export async function autoOfflineBackup() {
  const enabled = localStorage.getItem("atrium.offline.enabled") === "1";
  if (!enabled) return;

  const intervalMin = Number(localStorage.getItem("atrium.offline.interval")) || 60;
  const last = localStorage.getItem("atrium.offline.lastBackup");
  const now = Date.now();

  if (last && now - new Date(last).getTime() < intervalMin * 60000) return;

  const handle = await getDirectoryHandle();
  if (!handle) return;

  try {
    const fileName = `atrium-backup-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
    const data = await exportAllData();
    const payload = {
      schemaVersion: 4,
      exportedAt: new Date().toISOString(),
      data,
    };
    const jsonString = JSON.stringify(payload, null, 2);

    if (typeof handle === "string" || isTauriEnv()) {
      const pathStr = typeof handle === "string" ? handle : String(handle);
      const { writeTextFile } = await import("@tauri-apps/plugin-fs");
      const filePath = pathStr.endsWith("/") ? `${pathStr}${fileName}` : `${pathStr}/${fileName}`;
      await writeTextFile(filePath, jsonString);
    } else {
      const hasPerm = (await handle.queryPermission({ mode: "readwrite" })) === "granted";
      if (!hasPerm) return;

      const fileHandle = await handle.getFileHandle(fileName, { create: true });
      const writable = await fileHandle.createWritable();
      await writable.write(jsonString);
      await writable.close();
    }

    const nowStr = new Date().toISOString();
    localStorage.setItem("atrium.offline.lastBackup", nowStr);
    await db.settings.update("app", { offline_last_backup: nowStr });
  } catch (e) {
    console.warn("Offline auto-backup execution failed:", e.message);
  }
}
