import { daysSince, isOverdue, isToday, isWithinDays } from "./date";

// Thresholds for "gentle" resurfacing
export const RESURFACE = {
  taskIgnoredDays: 7, // a task not touched in N days
  projectStaleDays: 14, // project untouched
  goalStaleDays: 30,
  noteResurfaceDays: 21,
  bookmarkResurfaceDays: 30,
};

export function isSnoozed(task) {
  if (!task?.snoozedUntil) return false;
  const until = new Date(task.snoozedUntil); until.setHours(0, 0, 0, 0);
  const now = new Date(); now.setHours(0, 0, 0, 0);
  return until > now;
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

export function todayFocus(tasks) {
  // tasks scheduled today, due today, overdue, open, not snoozed, OR tasks with no due date
  const filtered = tasks.filter(
    (t) => isTaskOpen(t) && !isSnoozed(t) && (!t.dueDate || isToday(t.scheduledDate) || isToday(t.dueDate) || isOverdue(t.dueDate)),
  );
  return sortTodayFocus(filtered);
}

export function upcomingTasks(tasks) {
  return tasks.filter(
    (t) =>
      isTaskOpen(t) &&
      !isSnoozed(t) &&
      t.dueDate &&
      !isToday(t.scheduledDate) &&
      !isToday(t.dueDate) &&
      (isWithinDays(t.scheduledDate, 7) || isWithinDays(t.dueDate, 7)),
  );
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

export function staleProjects(projects, tasks) {
  return projects
    .filter(
      (p) => {
        if (p.status === "archived" || p.status === "completed") return false;
        if (p.reviewFrequency === "0") return false;
        const threshold = p.reviewFrequency ? Number(p.reviewFrequency) : RESURFACE.projectStaleDays;
        return daysSince(getProjectLastTouched(p)) >= threshold;
      }
    )
    .map((p) => ({ ...p, openTaskCount: tasks.filter((t) => t.projectId === p.id && isTaskOpen(t)).length }));
}

export function memoryResurfacing(notes, bookmarks, goals, wishlist, currentDate) {
  const currentDateStr = currentDate ? currentDate.format('YYYY-MM-DD') : new Date().toISOString().split('T')[0];

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

  function selectFromPool(pool, count) {
    if (!pool || pool.length === 0) return [];
    
    const poolWithPriority = pool.map(item => {
      let D = daysSince(item.lastViewedAt);
      if (item.lastViewedAt && isToday(item.lastViewedAt)) {
        D = Infinity;
      }
      const priority = D >= 15 ? D : D * 0.0001;
      return { item, D, priority };
    });

    poolWithPriority.sort((a, b) => b.priority - a.priority);

    const candidates = poolWithPriority.slice(0, 8);
    const chosen = [];
    const tempCandidates = [...candidates];

    while (chosen.length < count && tempCandidates.length > 0) {
      const idx = Math.floor(randGen() * tempCandidates.length);
      chosen.push(tempCandidates.splice(idx, 1)[0].item);
    }
    return chosen;
  }

  // 1. Goal & Wish List Resurfacing (max 1 of each per day)
  const activeGoals = (goals || []).filter(g => g.status !== 'completed' && g.status !== 'archived');
  const goalList = selectFromPool(activeGoals.map(g => ({ ...g, type: 'goal' })), 1);
  const goal = goalList.length > 0 ? goalList[0] : null;

  const activeWishes = (wishlist || []).filter(w => w.status === 'active' && !w.purchased);
  const wishList = selectFromPool(activeWishes.map(w => ({ ...w, type: 'wish' })), 1);
  const wish = wishList.length > 0 ? wishList[0] : null;

  // 2. Note / Bookmark Resurfacing (exactly 2 note/bookmarks in a day)
  const notesAndBookmarksPool = [
    ...(notes || []).map(n => ({ ...n, type: 'note' })),
    ...(bookmarks || []).map(b => ({ ...b, type: 'bookmark' }))
  ];

  const items = selectFromPool(notesAndBookmarksPool, 2);

  return { goal, wish, items };
}

export function criticalCount(tasks) {
  return tasks.filter((t) => isTaskOpen(t) && !isSnoozed(t) && t.important && t.urgent).length;
}
