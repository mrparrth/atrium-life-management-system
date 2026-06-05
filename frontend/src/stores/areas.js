import { defineStore } from 'pinia'
import { ref } from 'vue'
import { db, newId, now } from '@/db'

export const useAreasStore = defineStore('areas', () => {
  const items = ref([])
  async function load() { items.value = await db.areas.toArray() }
  async function add(payload) {
    const a = { id: newId(), name: payload.name, description: payload.description || '', emoji: payload.emoji || '◌', createdAt: now(), updatedAt: now() }
    await db.areas.add(a); items.value.push(a); return a
  }
  async function update(id, patch) {
    const a = items.value.find(x => x.id === id); if (!a) return
    Object.assign(a, patch, { updatedAt: now() })
    await db.areas.put({ ...a })
  }
  async function remove(id) { await db.areas.delete(id); items.value = items.value.filter(a => a.id !== id) }
  return { items, load, add, update, remove }
})
