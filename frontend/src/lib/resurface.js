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

export function todayFocus(tasks) {
  // tasks scheduled today or due today, not snoozed, open
  return tasks.filter(
    (t) => isTaskOpen(t) && !isSnoozed(t) && (isToday(t.scheduledDate) || isToday(t.dueDate) || isOverdue(t.dueDate)),
  );
}

export function upcomingTasks(tasks) {
  return tasks.filter(
    (t) =>
      isTaskOpen(t) &&
      !isSnoozed(t) &&
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

export function staleProjects(projects, tasks) {
  return projects
    .filter(
      (p) =>
        p.status !== "archived" && p.status !== "completed" && daysSince(p.lastViewedAt) >= RESURFACE.projectStaleDays,
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
