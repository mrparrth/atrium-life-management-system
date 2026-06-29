import { db } from "@/db";
import { exportAllData } from "@/services/drive";

export async function saveDirectoryHandle(handle) {
  const existing = (await db.settings.get("app")) || { id: "app" };
  existing.directoryHandle = handle;
  await db.settings.put(existing);
}

export async function getDirectoryHandle() {
  const row = await db.settings.get("app");
  return row?.directoryHandle || null;
}

export async function verifyPermission(handle, readWrite = true) {
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

export async function pruneOldBackups(directoryHandle, keepDays) {
  if (!keepDays || keepDays <= 0) return;
  const cutoffTime = Date.now() - keepDays * 24 * 60 * 60 * 1000;
  try {
    for await (const entry of directoryHandle.values()) {
      if (entry.kind !== "file") continue;
      if (!entry.name.startsWith("atrium-backup-") || !entry.name.endsWith(".json")) continue;
      try {
        const datePart = entry.name.replace("atrium-backup-", "").replace(".json", "");
        const regex = /(\d{4}-\d{2}-\d{2})T(\d{2})-(\d{2})-(\d{2})/;
        const match = datePart.match(regex);
        if (match) {
          const dateStr = `${match[1]}T${match[2]}:${match[3]}:${match[4]}`;
          const dateVal = new Date(dateStr).getTime();
          if (!isNaN(dateVal) && dateVal < cutoffTime) {
            await directoryHandle.removeEntry(entry.name);
            console.log(`Pruned old offline backup: ${entry.name}`);
          }
        }
      } catch (err) {
        console.warn("Failed to parse offline backup file name:", entry.name, err);
      }
    }
  } catch (e) {
    console.warn("Pruning old offline backups failed:", e.message);
  }
}

export async function executeOfflineBackup() {
  const handle = await getDirectoryHandle();
  if (!handle) throw new Error("No offline backup folder selected. Select one in Settings.");

  const hasPerm = await verifyPermission(handle, true);
  if (!hasPerm) throw new Error("Permission denied to write to the selected folder.");

  const fileName = `atrium-backup-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
  const fileHandle = await handle.getFileHandle(fileName, { create: true });
  const writable = await fileHandle.createWritable();
  const data = await exportAllData();
  const payload = {
    schemaVersion: 4,
    exportedAt: new Date().toISOString(),
    data,
  };
  await writable.write(JSON.stringify(payload, null, 2));
  await writable.close();

  localStorage.setItem("atrium.offline.lastBackup", new Date().toISOString());
  
  const keepDays = Number(localStorage.getItem("atrium.offline.keepDays")) || 7;
  await pruneOldBackups(handle, keepDays);
  
  return true;
}

export async function autoOfflineBackup() {
  const enabled = localStorage.getItem("atrium.offline.enabled") === "1";
  if (!enabled) return;

  const intervalMin = Number(localStorage.getItem("atrium.offline.interval")) || 60;
  const keepDays = Number(localStorage.getItem("atrium.offline.keepDays")) || 7;
  const last = localStorage.getItem("atrium.offline.lastBackup");
  const now = Date.now();

  if (last && now - new Date(last).getTime() < intervalMin * 60000) return;

  const handle = await getDirectoryHandle();
  if (!handle) return;

  // Background auto-backup should NOT prompt permissions (which blocks user experience).
  // Only execute if already granted.
  const hasPerm = (await handle.queryPermission({ mode: "readwrite" })) === "granted";
  if (!hasPerm) {
    console.warn("Offline auto-backup skipped: Permission not active.");
    return;
  }

  try {
    const fileName = `atrium-backup-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
    const fileHandle = await handle.getFileHandle(fileName, { create: true });
    const writable = await fileHandle.createWritable();
    const data = await exportAllData();
    const payload = {
      schemaVersion: 4,
      exportedAt: new Date().toISOString(),
      data,
    };
    await writable.write(JSON.stringify(payload, null, 2));
    await writable.close();

    localStorage.setItem("atrium.offline.lastBackup", new Date().toISOString());
    await pruneOldBackups(handle, keepDays);
    console.log("Offline background backup complete.");
  } catch (e) {
    console.warn("Offline auto-backup execution failed:", e.message);
  }
}
