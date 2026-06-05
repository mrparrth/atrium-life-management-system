import { defineStore } from 'pinia'
import { ref } from 'vue'
import { db, newId, now } from '@/db'

export const useNextStepsStore = defineStore('nextSteps', () => {
  const items = ref([])

  async function load() {
    items.value = (await db.next_steps.toArray()).sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
  }

  async function add(title) {
    const trimmed = (title || '').trim()
    if (!trimmed) return null
    const maxOrder = items.value.reduce((m, x) => Math.max(m, x.order || 0), 0)
    const it = { id: newId(), title: trimmed, done: false, order: maxOrder + 1, createdAt: now(), updatedAt: now() }
    await db.next_steps.add(it)
    items.value.push(it)
    return it
  }

  async function toggle(id) {
    const it = items.value.find(x => x.id === id)
    if (!it) return
    it.done = !it.done
    it.updatedAt = now()
    if (it.done) it.completedAt = now()
    await db.next_steps.put({ ...it })
  }

  async function rename(id, title) {
    const it = items.value.find(x => x.id === id); if (!it) return
    it.title = title.trim() || it.title
    it.updatedAt = now()
    await db.next_steps.put({ ...it })
  }

  async function remove(id) {
    await db.next_steps.delete(id)
    items.value = items.value.filter(x => x.id !== id)
  }

  async function clearCompleted() {
    const done = items.value.filter(x => x.done)
    await Promise.all(done.map(d => db.next_steps.delete(d.id)))
    items.value = items.value.filter(x => !x.done)
  }

  async function reorder(orderedIds) {
    const ts = now()
    items.value.sort((a, b) => orderedIds.indexOf(a.id) - orderedIds.indexOf(b.id))
    let i = 1
    for (const it of items.value) {
      it.order = i++; it.updatedAt = ts
      await db.next_steps.put({ ...it })
    }
  }

  return { items, load, add, toggle, rename, remove, clearCompleted, reorder }
})
