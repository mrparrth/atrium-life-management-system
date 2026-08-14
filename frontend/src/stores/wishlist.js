import { defineStore } from 'pinia'
import { ref } from 'vue'
import { db, newId, now, plain } from '@/db'

export const useWishlistStore = defineStore('wishlist', () => {
  const items = ref([])

  async function load() {
    items.value = await db.wishlist.orderBy('createdAt').reverse().toArray()
  }

  async function add(payload) {
    const item = {
      id: newId(),
      title: payload.title?.trim() || 'Untitled wish',
      description: payload.description || '',
      url: payload.url?.trim() || '',
      imageUrl: payload.imageUrl || '',
      goalId: payload.goalId || null,
      unit: payload.unit || '',
      goalValue: Number(payload.goalValue) || 0,
      currentValue: Number(payload.currentValue) || 0,
      price: (payload.price !== undefined && payload.price !== null && payload.price !== '') ? Number(payload.price) : null,
      status: payload.status || 'active',
      createdAt: now(),
      updatedAt: now(),
      lastViewedAt: now()
    }
    await db.wishlist.add(item)
    items.value.unshift(item)
    return item
  }

  async function update(id, patch) {
    const item = items.value.find(x => x.id === id)
    if (!item) return
    Object.assign(item, patch, { updatedAt: now() })
    await db.wishlist.put(plain(item))
  }

  async function markViewed(id) {
    const item = items.value.find(x => x.id === id); if (!item) return
    item.lastViewedAt = now(); await db.wishlist.put(plain(item))
  }

  async function remove(id) {
    await db.wishlist.delete(id)
    items.value = items.value.filter(x => x.id !== id)
  }

  return { items, load, add, update, markViewed, remove }
})
