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

export async function pruneOldBackups(handle, keepDays) {
  if (!keepDays || keepDays <= 0) return;
  const cutoffTime = Date.now() - keepDays * 24 * 60 * 60 * 1000;

  try {
    if (typeof handle === "string" || isTauriEnv()) {
      const pathStr = typeof handle === "string" ? handle : String(handle);
      const { readDir, remove } = await import("@tauri-apps/plugin-fs");
      const entries = await readDir(pathStr);
      for (const entry of entries) {
        if (!entry.name || !entry.name.startsWith("atrium-backup-") || !entry.name.endsWith(".json")) continue;
        const datePart = entry.name.replace("atrium-backup-", "").replace(".json", "");
        const match = datePart.match(/(\d{4}-\d{2}-\d{2})T(\d{2})-(\d{2})-(\d{2})/);
        if (match) {
          const dateStr = `${match[1]}T${match[2]}:${match[3]}:${match[4]}`;
          const dateVal = new Date(dateStr).getTime();
          if (!isNaN(dateVal) && dateVal < cutoffTime) {
            const filePath = pathStr.endsWith("/") ? `${pathStr}${entry.name}` : `${pathStr}/${entry.name}`;
            await remove(filePath);
            console.log(`[OfflineSync] Pruned old backup (Tauri): ${entry.name}`);
          }
        }
      }
    } else if (handle && typeof handle.values === "function") {
      for await (const entry of handle.values()) {
        if (entry.kind !== "file") continue;
        if (!entry.name.startsWith("atrium-backup-") || !entry.name.endsWith(".json")) continue;
        const datePart = entry.name.replace("atrium-backup-", "").replace(".json", "");
        const match = datePart.match(/(\d{4}-\d{2}-\d{2})T(\d{2})-(\d{2})-(\d{2})/);
        if (match) {
          const dateStr = `${match[1]}T${match[2]}:${match[3]}:${match[4]}`;
          const dateVal = new Date(dateStr).getTime();
          if (!isNaN(dateVal) && dateVal < cutoffTime) {
            await handle.removeEntry(entry.name);
            console.log(`[OfflineSync] Pruned old backup (Web): ${entry.name}`);
          }
        }
      }
    }
  } catch (err) {
    console.warn("[OfflineSync] Prune old backups encountered an issue:", err.message);
  }
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
  localStorage.removeItem("atrium.offline.backupNeedsIntervention");
  await db.settings.update("app", { offline_last_backup: nowStr });

  const appRow = await db.settings.get("app");
  const keepDays = Number(localStorage.getItem("atrium.offline.keepDays")) || appRow?.offline_keep_days || 7;
  await pruneOldBackups(handle, keepDays);

  window.dispatchEvent(new CustomEvent("atrium-offline-backup-success", { detail: { timestamp: nowStr } }));

  return true;
}

export async function autoOfflineBackup() {
  const localVal = localStorage.getItem("atrium.offline.enabled");
  const appRow = await db.settings.get("app");

  let isEnabled = false;
  if (localVal === "1" || localVal === "true") {
    isEnabled = true;
  } else if (localVal === "0" || localVal === "false") {
    isEnabled = false;
  } else if (appRow && typeof appRow.offline_enabled === "boolean") {
    isEnabled = appRow.offline_enabled;
    localStorage.setItem("atrium.offline.enabled", isEnabled ? "1" : "0");
  }

  if (!isEnabled) return;

  const intervalMin =
    Number(localStorage.getItem("atrium.offline.interval")) ||
    appRow?.offline_interval ||
    1440;

  const last =
    localStorage.getItem("atrium.offline.lastBackup") ||
    appRow?.offline_last_backup ||
    null;

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
      const perm = await handle.queryPermission({ mode: "readwrite" });
      if (perm !== "granted") {
        console.warn("[OfflineSync] Folder permission requires user interaction. Flagging intervention.");
        localStorage.setItem("atrium.offline.backupNeedsIntervention", "true");
        window.dispatchEvent(new CustomEvent("atrium-offline-backup-needs-intervention"));
        return;
      }

      const fileHandle = await handle.getFileHandle(fileName, { create: true });
      const writable = await fileHandle.createWritable();
      await writable.write(jsonString);
      await writable.close();
    }

    const nowStr = new Date().toISOString();
    localStorage.setItem("atrium.offline.lastBackup", nowStr);
    localStorage.removeItem("atrium.offline.backupNeedsIntervention");
    await db.settings.update("app", { offline_last_backup: nowStr });

    const keepDays = Number(localStorage.getItem("atrium.offline.keepDays")) || appRow?.offline_keep_days || 7;
    await pruneOldBackups(handle, keepDays);

    window.dispatchEvent(new CustomEvent("atrium-offline-backup-success", { detail: { timestamp: nowStr } }));
  } catch (e) {
    console.warn("Offline auto-backup execution failed:", e.message);
    localStorage.setItem("atrium.offline.backupNeedsIntervention", "true");
    window.dispatchEvent(new CustomEvent("atrium-offline-backup-needs-intervention"));
  }
}
