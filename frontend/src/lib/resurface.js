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
      (p) =>
        p.status !== "archived" && 
        p.status !== "completed" && 
        daysSince(getProjectLastTouched(p)) >= RESURFACE.projectStaleDays,
    )
    .map((p) => ({ ...p, openTaskCount: tasks.filter((t) => t.projectId === p.id && isTaskOpen(t)).length }));
}

export function memoryResurfacing(notes, bookmarks) {
  const staleNotes = notes.filter((n) => daysSince(n.lastViewedAt) >= RESURFACE.noteResurfaceDays);
  const staleBookmarks = bookmarks.filter((b) => daysSince(b.lastViewedAt) >= RESURFACE.bookmarkResurfaceDays);
  return { notes: staleNotes, bookmarks: staleBookmarks };
}

export function criticalCount(tasks) {
  return tasks.filter((t) => isTaskOpen(t) && !isSnoozed(t) && t.important && t.urgent).length;
}
