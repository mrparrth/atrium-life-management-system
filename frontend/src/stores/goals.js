import { defineStore } from 'pinia'
import { ref } from 'vue'
import { db, newId, now } from '@/db'

export const useGoalsStore = defineStore('goals', () => {
  const items = ref([])
  async function load() { items.value = await db.goals.orderBy('createdAt').reverse().toArray() }
  async function add(payload) {
    const g = { id: newId(), title: payload.title?.trim() || 'Untitled goal', description: payload.description || '', yearId: payload.yearId || null, status: 'active', createdAt: now(), updatedAt: now() }
    await db.goals.add(g); items.value.unshift(g); return g
  }
  async function update(id, patch) {
    const g = items.value.find(x => x.id === id); if (!g) return
    Object.assign(g, patch, { updatedAt: now() })
    await db.goals.put({ ...g })
  }
  async function remove(id) { await db.goals.delete(id); items.value = items.value.filter(g => g.id !== id) }
  return { items, load, add, update, remove }
})
