import { defineStore } from 'pinia'
import { ref } from 'vue'
import { db, newId, now, plain } from '@/db'
import { useSettingsStore } from '@/stores/settings'

export const useWishlistStore = defineStore('wishlist', () => {
  const items = ref([])

  async function load() {
    items.value = await db.wishlist.orderBy('createdAt').reverse().toArray()
    try {
      const settingsStore = useSettingsStore()
      await settingsStore.load()
      const defaultSym = settingsStore.get('default_spending_currency', '₹')
      if (defaultSym && defaultSym !== '$') {
        for (const item of items.value) {
          if (!item.unit || item.unit === '$' || item.unit === 'USD') {
            item.unit = defaultSym
            await db.wishlist.put(plain(item))
          }
        }
      }
    } catch (e) {
      console.warn('Failed to migrate wishlist currency:', e)
    }
  }

  async function add(payload) {
    const settingsStore = useSettingsStore()
    const defaultSym = settingsStore.get('default_spending_currency', '₹')
    const item = {
      id: newId(),
      title: payload.title?.trim() || 'Untitled wish',
      description: payload.description || '',
      url: payload.url?.trim() || '',
      imageUrl: payload.imageUrl || '',
      goalId: payload.goalId || null,
      unit: payload.unit || defaultSym || '',
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
