import { defineStore } from 'pinia'
import { ref } from 'vue'
import { db, newId, now, plain } from '@/db'

export const useBookmarksStore = defineStore('bookmarks', () => {
  const items = ref([])
  const pages = ref([])

  async function load() {
    items.value = await db.bookmarks.orderBy('createdAt').reverse().toArray()
    pages.value = await db.bookmark_pages.orderBy('createdAt').reverse().toArray()
  }

  async function add(payload) {
    const b = {
      id: newId(),
      title: payload.title?.trim() || payload.url,
      url: payload.url,
      description: payload.description || '',
      category: payload.category || 'General',
      tags: payload.tags || [],
      pageId: payload.pageId || null,
      createdAt: now(), updatedAt: now(), lastViewedAt: now(),
    }
    await db.bookmarks.add(b); items.value.unshift(b); return b
  }
  async function update(id, patch) {
    const b = items.value.find(x => x.id === id); if (!b) return
    Object.assign(b, patch, { updatedAt: now() })
    await db.bookmarks.put(plain(b))
  }
  async function markViewed(id) {
    const b = items.value.find(x => x.id === id); if (!b) return
    b.lastViewedAt = now(); await db.bookmarks.put(plain(b))
  }
  async function remove(id) { await db.bookmarks.delete(id); items.value = items.value.filter(b => b.id !== id) }

  async function addPage(payload) {
    const p = {
      id: newId(),
      title: payload.title?.trim() || 'Untitled collection',
      description: payload.description || '',
      emoji: payload.emoji || '◗',
      tags: payload.tags || [],
      createdAt: now(), updatedAt: now(),
    }
    await db.bookmark_pages.add(p); pages.value.unshift(p); return p
  }
  async function updatePage(id, patch) {
    const p = pages.value.find(x => x.id === id); if (!p) return
    Object.assign(p, patch, { updatedAt: now() })
    await db.bookmark_pages.put(plain(p))
  }
  async function removePage(id) {
    const toDetach = items.value.filter(b => b.pageId === id)
    for (const b of toDetach) { b.pageId = null; await db.bookmarks.put(plain(b)) }
    await db.bookmark_pages.delete(id)
    pages.value = pages.value.filter(p => p.id !== id)
  }

  function bookmarksInPage(pageId) { return items.value.filter(b => b.pageId === pageId) }
  function looseBookmarks() { return items.value.filter(b => !b.pageId) }

  return { items, pages, load, add, update, markViewed, remove, addPage, updatePage, removePage, bookmarksInPage, looseBookmarks }
})
