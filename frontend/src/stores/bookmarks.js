import { defineStore } from 'pinia'
import { ref } from 'vue'
import { db, newId, now } from '@/db'

export const useBookmarksStore = defineStore('bookmarks', () => {
  const items = ref([])
  async function load() { items.value = await db.bookmarks.orderBy('createdAt').reverse().toArray() }
  async function add(payload) {
    const b = { id: newId(), title: payload.title?.trim() || payload.url, url: payload.url, description: payload.description || '', category: payload.category || 'General', tags: payload.tags || [], createdAt: now(), updatedAt: now(), lastViewedAt: now() }
    await db.bookmarks.add(b); items.value.unshift(b); return b
  }
  async function update(id, patch) {
    const b = items.value.find(x => x.id === id); if (!b) return
    Object.assign(b, patch, { updatedAt: now() })
    await db.bookmarks.put({ ...b })
  }
  async function markViewed(id) {
    const b = items.value.find(x => x.id === id); if (!b) return
    b.lastViewedAt = now(); await db.bookmarks.put({ ...b })
  }
  async function remove(id) { await db.bookmarks.delete(id); items.value = items.value.filter(b => b.id !== id) }
  return { items, load, add, update, markViewed, remove }
})
