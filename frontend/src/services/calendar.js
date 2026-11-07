import { db } from "@/db";
import { sendDesktopNotification } from "@/lib/notifications";
import { isTauriEnv } from "@/services/offlineSync";

/**
 * Normalizes webcal:// or http:// URLs to https://
 */
export function normalizeCalendarUrl(url) {
  if (!url) return "";
  let clean = url.trim();
  if (clean.startsWith("webcal://")) {
    clean = "https://" + clean.slice(9);
  }
  return clean;
}

/**
 * Parses iCalendar (.ics) string format into meeting event objects
 */
export function parseICal(icsText) {
  if (!icsText || typeof icsText !== "string") return [];
  // Unfold folded lines per RFC 5545 (lines beginning with space or tab continue previous line)
  const unfolded = icsText.replace(/\r\n/g, "\n").replace(/\n[ \t]/g, "");
  const lines = unfolded.split("\n");
  const events = [];
  let cur = null;

  for (let line of lines) {
    line = line.trim();
    if (line === "BEGIN:VEVENT") {
      cur = {};
    } else if (line === "END:VEVENT") {
      if (cur && cur.startDateTime) {
        // If no end time, default to start time + 30 mins
        if (!cur.endDateTime) {
          const end = new Date(new Date(cur.startDateTime).getTime() + 30 * 60 * 1000);
          cur.endDateTime = end.toISOString();
        }
        events.push(cur);
      }
      cur = null;
    } else if (cur) {
      const idx = line.indexOf(":");
      if (idx === -1) continue;
      const rawKey = line.slice(0, idx);
      let val = line.slice(idx + 1);
      const key = rawKey.split(";")[0].toUpperCase();

      val = val
        .replace(/\\n/g, "\n")
        .replace(/\\,/g, ",")
        .replace(/\\;/g, ";")
        .replace(/\\\\/g, "\\");

      if (key === "UID") cur.uid = val.trim();
      else if (key === "SUMMARY") cur.title = val.trim();
      else if (key === "DESCRIPTION") cur.description = val.trim();
      else if (key === "LOCATION") cur.location = val.trim();
      else if (key === "URL") cur.url = val.trim();
      else if (key === "DTSTART") cur.startDateTime = parseICalDate(val);
      else if (key === "DTEND") cur.endDateTime = parseICalDate(val);
    }
  }

  return events;
}

/**
 * Parses iCal date strings (UTC, local datetime, or date-only)
 */
function parseICalDate(val) {
  const clean = val.trim();
  if (!clean) return new Date().toISOString();

  // All-day date YYYYMMDD
  if (clean.length === 8 && /^\d{8}$/.test(clean)) {
    const y = clean.slice(0, 4);
    const m = clean.slice(4, 6);
    const d = clean.slice(6, 8);
    return new Date(`${y}-${m}-${d}T00:00:00`).toISOString();
  }

  // DateTime YYYYMMDDTHHMMSS[Z]
  if (clean.includes("T")) {
    const isUtc = clean.endsWith("Z");
    const y = clean.slice(0, 4);
    const m = clean.slice(4, 6);
    const d = clean.slice(6, 8);
    const h = clean.slice(9, 11);
    const min = clean.slice(11, 13);
    const s = clean.slice(13, 15) || "00";
    if (isUtc) {
      return new Date(Date.UTC(+y, +m - 1, +d, +h, +min, +s)).toISOString();
    }
    return new Date(+y, +m - 1, +d, +h, +min, +s).toISOString();
  }

  const parsed = new Date(clean);
  return isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
}

/**
 * Extracts video meeting link (Google Meet, Zoom, Teams) from URL, location, or description
 */
export function extractMeetingLink(event) {
  if (event.url && event.url.startsWith("http")) return event.url;
  if (event.location && event.location.startsWith("http")) return event.location;
  if (event.description) {
    const match = event.description.match(/(https?:\/\/[^\s>"]+)/);
    if (match) return match[0];
  }
  return "";
}

/**
 * Fetches calendar .ics feed from URL and synchronizes events into work_meetings store
 */
export async function syncSubscribedCalendar(feedUrl) {
  const url = normalizeCalendarUrl(feedUrl);
  if (!url) return { count: 0, error: null };

  let icsText = "";
  try {
    // If running in Tauri desktop, we can use fetch natively without CORS issues
    const res = await fetch(url, {
      headers: {
        Accept: "text/calendar, text/plain, */*",
      },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    icsText = await res.text();
  } catch (err) {
    console.warn("Direct calendar fetch failed:", err.message);
    throw new Error(`Failed to download calendar feed: ${err.message}`);
  }

  const parsedEvents = parseICal(icsText);
  if (!parsedEvents.length) {
    return { count: 0, error: null };
  }

  const meetingsStore = (await import("@/stores/workMeetings")).useWorkMeetingsStore();
  await meetingsStore.load();

  // Filter events within reasonable window: from 3 days ago up to 30 days ahead
  const nowMs = Date.now();
  const pastLimit = nowMs - 3 * 24 * 60 * 60 * 1000;
  const futureLimit = nowMs + 30 * 24 * 60 * 60 * 1000;

  const relevant = parsedEvents.filter((e) => {
    const startMs = new Date(e.startDateTime).getTime();
    return startMs >= pastLimit && startMs <= futureLimit;
  });

  let syncedCount = 0;

  for (const item of relevant) {
    const uid = item.uid || `${item.title}_${item.startDateTime}`;
    const meetLink = extractMeetingLink(item);

    const existing = meetingsStore.items.find((m) => m.googleCalendarId === uid);

    if (existing) {
      const timeChanged = existing.startDateTime !== item.startDateTime || existing.endDateTime !== item.endDateTime;
      const detailsChanged =
        existing.title !== (item.title || "Untitled Meeting") ||
        existing.description !== (item.description || "") ||
        existing.meetLink !== meetLink;

      if (timeChanged || detailsChanged) {
        await meetingsStore.update(existing.id, {
          title: item.title || "Untitled Meeting",
          description: item.description || "",
          startDateTime: item.startDateTime,
          endDateTime: item.endDateTime,
          meetLink,
        });

        if (timeChanged) {
          sendDesktopNotification("Meeting Rescheduled", {
            body: `"${item.title || "Untitled"}" has been rescheduled to ${new Date(item.startDateTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} on ${new Date(item.startDateTime).toLocaleDateString()}`,
          });
        }
      }
    } else {
      await meetingsStore.add({
        googleCalendarId: uid,
        title: item.title || "Untitled Meeting",
        description: item.description || "",
        startDateTime: item.startDateTime,
        endDateTime: item.endDateTime,
        meetLink,
      });

      // Notify for new future meetings starting within next 48 hours
      const startMs = new Date(item.startDateTime).getTime();
      if (startMs > nowMs && startMs - nowMs < 48 * 60 * 60 * 1000) {
        sendDesktopNotification("New Meeting Scheduled", {
          body: `${item.title || "Untitled Meeting"} - ${new Date(item.startDateTime).toLocaleDateString()} at ${new Date(item.startDateTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`,
        });
      }
      syncedCount++;
    }
  }

  const nowIso = new Date().toISOString();
  localStorage.setItem("atrium.calendar.lastSync", nowIso);
  await db.settings.update("app", { calendar_last_sync: nowIso });

  return { count: relevant.length, newCount: syncedCount };
}
