import { defineStore } from 'pinia'
import { ref } from 'vue'
import { db, newId, now, plain } from '@/db'

export const useWorkResourcesStore = defineStore('workResources', () => {
  const items = ref([])

  async function load() {
    items.value = await db.work_resources.toArray()
  }

  async function add(payload) {
    const res = {
      id: newId(),
      clientId: payload.clientId || '',
      type: payload.type || 'url', // url, credentials
      title: payload.title || 'Untitled Resource',
      url: payload.url || '',
      username: payload.username || '',
      password: payload.password || '',
      notes: payload.notes || '',
      createdAt: now(),
      updatedAt: now()
    }
    await db.work_resources.add(res)
    items.value.push(res)
    return res
  }

  async function update(id, patch) {
    const res = items.value.find(x => x.id === id)
    if (!res) return
    Object.assign(res, patch, { updatedAt: now() })
    await db.work_resources.put(plain(res))
  }

  async function remove(id) {
    await db.work_resources.delete(id)
    items.value = items.value.filter(x => x.id !== id)
  }

  return { items, load, add, update, remove }
})
