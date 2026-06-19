import { defineStore } from 'pinia'
import { ref } from 'vue'
import { db, newId, now, plain } from '@/db'

export const usePipelineStore = defineStore('pipeline', () => {
  const items = ref([])

  async function load() {
    items.value = await db.finance_content_pipeline.orderBy('createdAt').reverse().toArray()
  }

  async function add(payload) {
    const p = {
      id: newId(),
      title: payload.title?.trim() || 'Untitled Post Idea',
      status: payload.status || 'idea', // idea, active, scheduled, published, dropped
      pillar: payload.pillar || 'General',
      type: payload.type || 'Growth', // Growth, Authority, Connection, Conversion
      platform: payload.platform || 'LinkedIn',
      publishDate: payload.publishDate || '',
      noteId: payload.noteId || '',
      snippet: payload.snippet || '',
      url: payload.url || '',
      createdAt: now()
    }
    await db.finance_content_pipeline.add(p)
    items.value.unshift(p)
    return p
  }

  async function update(id, patch) {
    const p = items.value.find(x => x.id === id)
    if (!p) return
    Object.assign(p, patch)
    await db.finance_content_pipeline.put(plain(p))
  }

  async function remove(id) {
    await db.finance_content_pipeline.delete(id)
    items.value = items.value.filter(x => x.id !== id)
  }

  return { items, load, add, update, remove }
})
