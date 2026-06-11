import { defineStore } from 'pinia'
import { ref } from 'vue'
import { db, newId, now, plain } from '@/db'

export const useWorkNotesStore = defineStore('workNotes', () => {
  const items = ref([])
  async function load() { 
    items.value = await db.work_notes.orderBy('updatedAt').reverse().toArray() 
  }
  async function add(payload) {
    const n = { 
      id: newId(), 
      clientId: payload.clientId || '', 
      title: payload.title?.trim() || 'Untitled Note', 
      body: payload.body || '', 
      tags: payload.tags || ['work'], 
      createdAt: now(), 
      updatedAt: now(), 
      lastViewedAt: now() 
    }
    await db.work_notes.add(n)
    items.value.unshift(n)
    return n
  }
  async function update(id, patch) {
    const n = items.value.find(x => x.id === id)
    if (!n) return
    Object.assign(n, patch, { updatedAt: now() })
    await db.work_notes.put(plain(n))
  }
  async function markViewed(id) {
    const n = items.value.find(x => x.id === id)
    if (!n) return
    n.lastViewedAt = now()
    await db.work_notes.put(plain(n))
  }
  async function remove(id) { 
    await db.work_notes.delete(id)
    items.value = items.value.filter(n => n.id !== id) 
  }
  return { items, load, add, update, markViewed, remove }
})
