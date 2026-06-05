import { defineStore } from 'pinia'
import { ref } from 'vue'
import { db, newId, now } from '@/db'

export const useProjectsStore = defineStore('projects', () => {
  const items = ref([])

  async function load() { items.value = await db.projects.orderBy('createdAt').reverse().toArray() }

  async function add(payload) {
    const p = {
      id: newId(),
      title: payload.title?.trim() || 'Untitled project',
      description: payload.description || '',
      goalId: payload.goalId || null,
      areaId: payload.areaId || null,
      status: 'active',
      lastViewedAt: now(),
      createdAt: now(),
      updatedAt: now(),
    }
    await db.projects.add(p)
    items.value.unshift(p)
    return p
  }
  async function update(id, patch) {
    const p = items.value.find(x => x.id === id); if (!p) return
    Object.assign(p, patch, { updatedAt: now() })
    await db.projects.put({ ...p })
  }
  async function markViewed(id) {
    const p = items.value.find(x => x.id === id); if (!p) return
    p.lastViewedAt = now(); await db.projects.put({ ...p })
  }
  async function archive(id) { await update(id, { status: 'archived' }) }
  async function complete(id) { await update(id, { status: 'completed' }) }
  async function remove(id) { await db.projects.delete(id); items.value = items.value.filter(p => p.id !== id) }

  return { items, load, add, update, markViewed, archive, complete, remove }
})
