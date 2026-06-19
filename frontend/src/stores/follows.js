import { defineStore } from 'pinia'
import { ref } from 'vue'
import { db, newId, now, plain } from '@/db'

export const useFollowsStore = defineStore('follows', () => {
  const items = ref([])

  async function load() {
    const data = await db.follows.orderBy('createdAt').reverse().toArray()
    items.value = data.map(item => {
      // Migrate legacy platforms object to single platform and url if needed
      if (item.platforms && !item.url) {
        const order = ['x', 'linkedin', 'threads', 'instagram', 'upwork']
        for (const k of order) {
          if (item.platforms[k]) {
            item.platform = k
            item.url = item.platforms[k]
            break
          }
        }
      }
      return item
    })
  }

  async function add(payload) {
    const f = {
      id: newId(),
      name: payload.name?.trim() || 'Anonymous',
      username: payload.username?.trim() || '',
      category: payload.category || 'General',
      reason: payload.reason || '',
      platform: payload.platform || '',
      url: payload.url || '',
      important: !!payload.important,
      createdAt: now()
    }
    await db.follows.add(plain(f))
    items.value.unshift(f)
    return f
  }

  async function update(id, patch) {
    const f = items.value.find(x => x.id === id)
    if (!f) return
    Object.assign(f, patch)
    await db.follows.put(plain(f))
  }

  async function remove(id) {
    await db.follows.delete(id)
    items.value = items.value.filter(x => x.id !== id)
  }

  return { items, load, add, update, remove }
})
