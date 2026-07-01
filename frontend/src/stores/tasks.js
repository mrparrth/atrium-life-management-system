import { defineStore } from 'pinia'
import { ref } from 'vue'
import { db, newId, now, plain } from '@/db'

export const useTasksStore = defineStore('tasks', () => {
  const items = ref([])

  function sortTasks(list) {
    list.sort((a, b) => {
      if (a.dueDate && b.dueDate) {
        return a.dueDate.localeCompare(b.dueDate)
      }
      if (a.dueDate) return -1
      if (b.dueDate) return 1
      return b.createdAt.localeCompare(a.createdAt)
    })
    return list
  }

  async function load() { 
    const raw = await db.tasks.toArray()
    items.value = sortTasks(raw)
  }

  async function add(payload) {
    const task = {
      id: newId(),
      title: payload.title?.trim() || 'Untitled task',
      description: payload.description || '',
      projectId: payload.projectId || null,
      goalId: payload.goalId || null,
      dueDate: payload.dueDate || null,
      scheduledDate: payload.scheduledDate || null,
      resurfaceDate: payload.resurfaceDate || null,
      snoozedUntil: null,
      energy: payload.energy || null,
      important: !!payload.important,
      urgent: !!payload.urgent,
      status: 'open',
      tags: payload.tags || [],
      completedAt: payload.completedAt || null,
      createdAt: now(),
      updatedAt: now(),
      lastViewedAt: now(),
    }
    await db.tasks.add(task)
    items.value.push(task)
    sortTasks(items.value)
    return task
  }

  async function update(id, patch) {
    const t = items.value.find(x => x.id === id)
    if (!t) return
    // Auto-set completedAt when marking done, clear when reopening
    if (patch.status === 'done' && t.status !== 'done' && !('completedAt' in patch)) {
      patch = { ...patch, completedAt: new Date().toISOString().slice(0, 10) }
    }
    if (patch.status === 'open' && t.status === 'done' && !('completedAt' in patch)) {
      patch = { ...patch, completedAt: null }
    }
    Object.assign(t, patch, { updatedAt: now() })
    await db.tasks.put(plain(t))
    sortTasks(items.value)
  }

  async function toggleComplete(id) {
    const t = items.value.find(x => x.id === id)
    if (!t) return
    const status = (t.status === 'done') ? 'open' : 'done'
    await update(id, { status, completedAt: status === 'done' ? now() : null })
  }

  async function remove(id) {
    await db.tasks.delete(id)
    items.value = items.value.filter(t => t.id !== id)
  }

  async function snooze(id, days = 1) {
    const until = new Date(); until.setDate(until.getDate() + days)
    await update(id, { snoozedUntil: until.toISOString() })
  }

  async function markViewed(id) {
    const t = items.value.find(x => x.id === id)
    if (!t) return
    t.lastViewedAt = now()
    await db.tasks.put(plain(t))
  }

  return { items, load, add, update, toggleComplete, remove, snooze, markViewed }
})
