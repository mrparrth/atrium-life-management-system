import { daysSince, isOverdue, isToday, isWithinDays } from "./date";

// Thresholds for "gentle" resurfacing
export const RESURFACE = {
  taskIgnoredDays: 7, // a task not touched in N days
  projectStaleDays: 14, // project untouched
  goalStaleDays: 30,
  noteResurfaceDays: 21,
  bookmarkResurfaceDays: 30,
};

export function toLocalDateStr(val) {
  if (!val) return null;
  if (typeof val === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(val)) return val;
  const d = new Date(val);
  if (isNaN(d.getTime())) return null;
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function isSnoozed(task) {
  if (!task?.snoozedUntil) return false;
  const snoozeDate = toLocalDateStr(task.snoozedUntil);
  const today = toLocalDateStr(new Date());
  return snoozeDate > today;
}

export function isTaskOpen(task) {
  return task.status === "open" || task.status === "in_progress" || !task.status;
}

const hourWeight = {
  'before_hrs': 1,
  '6am': 2, '7am': 3, '8am': 4, '9am': 5, '10am': 6, '11am': 7,
  '12pm': 8, '1pm': 9, '2pm': 10, '3pm': 11, '4pm': 12, '5pm': 13,
  '6pm': 14, '7pm': 15, '8pm': 16, '9pm': 17,
  'after_hr': 18
}

function sortTodayFocus(list) {
  list.sort((a, b) => {
    // 1. Snoozed check (snoozed goes to bottom)
    const aSnoozed = isSnoozed(a);
    const bSnoozed = isSnoozed(b);
    if (aSnoozed !== bSnoozed) {
      return aSnoozed ? 1 : -1;
    }

    // 2. No due date check (no due date goes to the absolute top)
    const aNoDue = !a.dueDate;
    const bNoDue = !b.dueDate;
    if (aNoDue !== bNoDue) {
      return aNoDue ? -1 : 1;
    }

    // 3. Sort by Scheduled Hour (time of day)
    const weightA = a.workHour ? hourWeight[a.workHour] || 99 : 999;
    const weightB = b.workHour ? hourWeight[b.workHour] || 99 : 999;
    if (weightA !== weightB) {
      return weightA - weightB;
    }

    // 4. Sort by Due Date (early to late)
    if (a.dueDate && b.dueDate) {
      if (a.dueDate !== b.dueDate) {
        return a.dueDate.localeCompare(b.dueDate);
      }
    }

    // 5. Fallback to creation date (newest first)
    return b.createdAt.localeCompare(a.createdAt);
  });
  return list;
}

export function getTaskEffectiveDate(t, todayStr) {
  const due = toLocalDateStr(t?.dueDate);
  const scheduled = toLocalDateStr(t?.scheduledDate);
  const snoozed = toLocalDateStr(t?.snoozedUntil);

  const dates = [due, scheduled, snoozed].filter(Boolean);
  if (dates.length === 0) return null;

  dates.sort();
  return dates[dates.length - 1]; // Whichever is later!
}

export function isTaskActiveToday(t, todayStr) {
  const today = todayStr || toLocalDateStr(new Date());

  if (t?.status === 'done') {
    return isToday(t.completedAt);
  }

  const effectiveDate = getTaskEffectiveDate(t, today);

  // If no date at all, it's active today
  if (!effectiveDate) return true;

  // If effective date (the highest of due, scheduled, snoozed) is in the future (> today), it is NOT active today
  if (effectiveDate > today) return false;

  // If effective date is today or past (<= today), it IS active today
  return true;
}

export function isTaskHandledToday(t, todayStr) {
  const today = todayStr || toLocalDateStr(new Date());

  if (t?.status === 'done') {
    return isToday(t.completedAt);
  }

  if (t?.snoozedUntil) {
    const snoozeDate = toLocalDateStr(t.snoozedUntil);
    if (snoozeDate > today) {
      return true;
    }
  }

  if (t?.updatedAt && isToday(t.updatedAt)) {
    const effectiveDate = getTaskEffectiveDate(t, today);
    if (effectiveDate && effectiveDate > today) {
      return true;
    }
  }

  return false;
}

export function todayFocus(tasks) {
  const filtered = tasks.filter(
    (t) => isTaskOpen(t) && isTaskActiveToday(t)
  );
  return sortTodayFocus(filtered);
}

export function upcomingTasks(tasks) {
  const today = toLocalDateStr(new Date());
  return tasks.filter((t) => {
    if (!isTaskOpen(t)) return false;
    const effectiveDate = getTaskEffectiveDate(t, today);
    if (!effectiveDate) return false;
    return effectiveDate > today && isWithinDays(effectiveDate, 7);
  });
}

export function recentlyIgnored(tasks) {
  // open tasks not viewed in 7+ days, no scheduled date today
  return tasks.filter(
    (t) =>
      isTaskOpen(t) &&
      !isSnoozed(t) &&
      daysSince(t.lastViewedAt) >= RESURFACE.taskIgnoredDays &&
      !isToday(t.scheduledDate),
  );
}

export function momentumOpportunities(tasks) {
  // strategic (important, not urgent), open, not snoozed - gently nudge
  return tasks.filter((t) => isTaskOpen(t) && !isSnoozed(t) && t.important && !t.urgent);
}

export function getProjectLastTouched(project) {
  if (project.progressNotes && project.progressNotes.length > 0) {
    const dates = project.progressNotes.map(n => new Date(n.date).getTime()).filter(Boolean);
    if (dates.length > 0) {
      return new Date(Math.max(...dates)).toISOString();
    }
  }
  return project.createdAt;
}

export function staleProjects(projects, tasks, customStaleDays = null) {
  return projects
    .filter(
      (p) => {
        if (p.status === "archived" || p.status === "completed") return false;
        if (p.reviewFrequency === "0") return false;
        const threshold = p.reviewFrequency ? Number(p.reviewFrequency) : (customStaleDays || RESURFACE.projectStaleDays);
        return daysSince(getProjectLastTouched(p)) >= threshold;
      }
    )
    .map((p) => ({ ...p, openTaskCount: tasks.filter((t) => t.projectId === p.id && isTaskOpen(t)).length }));
}

export function memoryResurfacing(notes, bookmarks, goals, wishlist, currentDate, customConfig = {}) {
  const currentDateStr = currentDate ? currentDate.format('YYYY-MM-DD') : new Date().toISOString().split('T')[0];

  const goalInterval = Number(customConfig.resurface_goal_interval || RESURFACE.goalStaleDays || 15);
  const wishInterval = Number(customConfig.resurface_wish_interval || 15);
  const noteDays = Number(customConfig.resurface_note_days || RESURFACE.noteResurfaceDays || 21);
  const bookmarkDays = Number(customConfig.resurface_bookmark_days || RESURFACE.bookmarkResurfaceDays || 30);

  const goalCount = customConfig.resurface_goal_count !== undefined ? Number(customConfig.resurface_goal_count) : 1;
  const wishCount = customConfig.resurface_wish_count !== undefined ? Number(customConfig.resurface_wish_count) : 1;
  const noteCount = customConfig.resurface_note_count !== undefined ? Number(customConfig.resurface_note_count) : 1;
  const bookmarkCount = customConfig.resurface_bookmark_count !== undefined ? Number(customConfig.resurface_bookmark_count) : 1;

  function hashString(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = (hash << 5) - hash + str.charCodeAt(i);
      hash |= 0;
    }
    return hash;
  }

  function mulberry32(a) {
    return function () {
      let t = a += 0x6D2B79F5;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }
  }

  const seed = hashString(currentDateStr);
  const randGen = mulberry32(seed);

  function selectFromPool(pool, count, minInterval = 15, strict = false) {
    if (!pool || pool.length === 0 || count <= 0) return [];
    
    // Items viewed today were resurfaced and clicked today!
    // They MUST remain in today's chosen set so they stay in the list (turned grey).
    const viewedToday = pool.filter(item => item.lastViewedAt && isToday(item.lastViewedAt));
    const chosen = viewedToday.slice(0, count);

    if (chosen.length >= count) {
      return chosen;
    }

    const chosenIds = new Set(chosen.map(i => i.id));
    let unviewedPool = pool.filter(item => !chosenIds.has(item.id));

    let poolWithPriority = unviewedPool.map(item => {
      const D = daysSince(item.lastViewedAt);
      const threshold = item.minDays || minInterval;
      const priority = D >= threshold ? D : D * 0.0001;
      return { item, D, priority, threshold };
    });

    if (strict) {
      poolWithPriority = poolWithPriority.filter(p => p.D >= p.threshold);
    }

    if (poolWithPriority.length === 0) return chosen;

    poolWithPriority.sort((a, b) => b.priority - a.priority);

    const candidates = poolWithPriority.slice(0, 8);
    const tempCandidates = [...candidates];

    while (chosen.length < count && tempCandidates.length > 0) {
      const idx = Math.floor(randGen() * tempCandidates.length);
      chosen.push(tempCandidates.splice(idx, 1)[0].item);
    }
    return chosen;
  }

  // 1. Goal & Wish List Resurfacing
  const activeGoals = (goals || []).filter(g => g.status !== 'completed' && g.status !== 'archived');
  const goalsResurfaced = selectFromPool(activeGoals.map(g => ({ ...g, type: 'goal', minDays: goalInterval })), goalCount, goalInterval, true);
  const goal = goalsResurfaced.length > 0 ? goalsResurfaced[0] : null;

  const activeWishes = (wishlist || []).filter(w => w.status === 'active' && !w.purchased);
  const wishesResurfaced = selectFromPool(activeWishes.map(w => ({ ...w, type: 'wish', minDays: wishInterval })), wishCount, wishInterval, true);
  const wish = wishesResurfaced.length > 0 ? wishesResurfaced[0] : null;

  // 2. Note / Bookmark Resurfacing
  const notesPool = (notes || []).map(n => ({ ...n, type: 'note', minDays: noteDays }));
  const noteItems = selectFromPool(notesPool, noteCount, noteDays);

  const bookmarksPool = (bookmarks || []).map(b => ({ ...b, type: 'bookmark', minDays: bookmarkDays }));
  const bookmarkItems = selectFromPool(bookmarksPool, bookmarkCount, bookmarkDays);

  const items = [...noteItems, ...bookmarkItems];

  return { goal, goals: goalsResurfaced, wish, wishes: wishesResurfaced, items };
}

export function criticalCount(tasks) {
  return tasks.filter((t) => isTaskOpen(t) && !isSnoozed(t) && t.important && t.urgent).length;
}
