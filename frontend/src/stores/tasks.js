import { defineStore } from "pinia";
import { ref } from "vue";
import { db, newId, now, plain } from "@/db";

export const useTasksStore = defineStore("tasks", () => {
  const items = ref([]);

  const hourWeight = {
    before_hrs: 1,
    "7am": 3,
    "8am": 4,
    "9am": 5,
    "10am": 6,
    "11am": 7,
    "12pm": 8,
    "1pm": 9,
    "2pm": 10,
    "3pm": 11,
    "4pm": 12,
    "5pm": 13,
    "6pm": 14,
    "7pm": 15,
    "8pm": 16,
    after_hr: 18,
  };

  function sortTasks(list) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayTime = today.getTime();

    const isTaskSnoozed = (t) => {
      if (!t?.snoozedUntil) return false;
      const until = new Date(t.snoozedUntil);
      until.setHours(0, 0, 0, 0);
      return until.getTime() >= todayTime;
    };

    list.sort((a, b) => {
      // 1. Snoozed check (snoozed goes to bottom)
      const aSnoozed = isTaskSnoozed(a);
      const bSnoozed = isTaskSnoozed(b);
      if (aSnoozed !== bSnoozed) {
        return aSnoozed ? 1 : -1;
      }

      // 2. Sort by Due Date (no due date goes to top, otherwise early to late)
      if (a.dueDate && b.dueDate) {
        if (a.dueDate !== b.dueDate) {
          return a.dueDate.localeCompare(b.dueDate);
        }
      } else if (a.dueDate) {
        return 1;
      } else if (b.dueDate) {
        return -1;
      }

      // 3. Sort by Scheduled Hour (workHour)
      const weightA = a.workHour ? hourWeight[a.workHour] || 99 : 999;
      const weightB = b.workHour ? hourWeight[b.workHour] || 99 : 999;
      if (weightA !== weightB) {
        return weightA - weightB;
      }

      // 4. Fallback to creation date (newest first)
      return b.createdAt.localeCompare(a.createdAt);
    });
    return list;
  }

  async function load() {
    const raw = await db.tasks.toArray();
    items.value = sortTasks(raw);
  }

  async function add(payload) {
    const task = {
      id: newId(),
      title: payload.title?.trim() || "Untitled task",
      description: payload.description || "",
      projectId: payload.projectId || null,
      goalId: payload.goalId || null,
      dueDate: payload.dueDate || null,
      scheduledDate: payload.scheduledDate || null,
      resurfaceDate: payload.resurfaceDate || null,
      snoozedUntil: null,
      workHour: payload.workHour || null,
      energy: payload.energy || null,
      important: !!payload.important,
      urgent: !!payload.urgent,
      status: "open",
      tags: payload.tags || [],
      completedAt: payload.completedAt || null,
      createdAt: now(),
      updatedAt: now(),
      lastViewedAt: now(),
    };
    await db.tasks.add(task);
    items.value.push(task);
    sortTasks(items.value);
    return task;
  }

  async function update(id, patch) {
    const t = items.value.find((x) => x.id === id);
    if (!t) return;
    // Auto-set completedAt when marking done, clear when reopening
    if (patch.status === "done" && t.status !== "done" && !("completedAt" in patch)) {
      patch = { ...patch, completedAt: new Date().toISOString().slice(0, 10) };
    }
    if (patch.status === "open" && t.status === "done" && !("completedAt" in patch)) {
      patch = { ...patch, completedAt: null };
    }
    Object.assign(t, patch, { updatedAt: now() });
    await db.tasks.put(plain(t));
    sortTasks(items.value);
  }

  async function toggleComplete(id) {
    const t = items.value.find((x) => x.id === id);
    if (!t) return;
    const status = t.status === "done" ? "open" : "done";
    await update(id, { status, completedAt: status === "done" ? now() : null });
  }

  async function remove(id) {
    await db.tasks.delete(id);
    items.value = items.value.filter((t) => t.id !== id);
  }

  async function snooze(id, days = 1) {
    const until = new Date();
    until.setHours(0, 0, 0, 0);
    until.setDate(until.getDate() + days);
    await update(id, { snoozedUntil: until.toISOString() });
  }

  async function markViewed(id) {
    const t = items.value.find((x) => x.id === id);
    if (!t) return;
    t.lastViewedAt = now();
    await db.tasks.put(plain(t));
  }

  return { items, load, add, update, toggleComplete, remove, snooze, markViewed };
});
