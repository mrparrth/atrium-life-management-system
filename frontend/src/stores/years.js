import { defineStore } from 'pinia'
import { ref } from 'vue'
import { db, newId, now, plain } from '@/db'

export const useYearsStore = defineStore('years', () => {
  const items = ref([])
  async function load() { items.value = await db.years.orderBy('year').reverse().toArray() }
  async function add(payload) {
    const y = { id: newId(), year: payload.year || new Date().getFullYear(), title: payload.title || `${payload.year}`, theme: payload.theme || '', createdAt: now(), updatedAt: now() }
    await db.years.add(y); items.value.unshift(y); return y
  }
  async function update(id, patch) {
    const y = items.value.find(x => x.id === id); if (!y) return
    Object.assign(y, patch, { updatedAt: now() })
    await db.years.put(plain(y))
  }
  async function remove(id) { await db.years.delete(id); items.value = items.value.filter(y => y.id !== id) }
  return { items, load, add, update, remove }
})
