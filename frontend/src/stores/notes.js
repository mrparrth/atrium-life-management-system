import { defineStore } from 'pinia'
import { ref } from 'vue'
import { db, newId, now } from '@/db'

export const useNotesStore = defineStore('notes', () => {
  const items = ref([])
  async function load() { items.value = await db.notes.orderBy('updatedAt').reverse().toArray() }
  async function add(payload) {
    const n = { id: newId(), title: payload.title?.trim() || 'Untitled note', body: payload.body || '', tags: payload.tags || [], projectId: payload.projectId || null, taskId: payload.taskId || null, goalId: payload.goalId || null, bookmarkId: payload.bookmarkId || null, createdAt: now(), updatedAt: now(), lastViewedAt: now() }
    await db.notes.add(n); items.value.unshift(n); return n
  }
  async function update(id, patch) {
    const n = items.value.find(x => x.id === id); if (!n) return
    Object.assign(n, patch, { updatedAt: now() })
    await db.notes.put({ ...n })
  }
  async function markViewed(id) {
    const n = items.value.find(x => x.id === id); if (!n) return
    n.lastViewedAt = now(); await db.notes.put({ ...n })
  }
  async function remove(id) { await db.notes.delete(id); items.value = items.value.filter(n => n.id !== id) }
  return { items, load, add, update, markViewed, remove }
})
