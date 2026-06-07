import { defineStore } from 'pinia'
import { ref } from 'vue'
import { db, newId, now, plain } from '@/db'
import { useWorkItemsStore } from './workItems'

export const useWorkTemplatesStore = defineStore('workTemplates', () => {
  const items = ref([])

  async function load() {
    items.value = await db.work_templates.toArray()
  }

  async function add(payload) {
    const t = {
      id: newId(),
      name: payload.name || 'Untitled Template',
      type: payload.type || 'checklist',
      items: payload.items || [], // array of strings
      createdAt: now(),
      updatedAt: now()
    }
    await db.work_templates.add(t)
    items.value.push(t)
    return t
  }

  async function remove(id) {
    await db.work_templates.delete(id)
    items.value = items.value.filter(x => x.id !== id)
  }

  // Seeding action to spawn tasks for a client based on a checklist template
  async function instantiateChecklist(templateId, clientId) {
    const template = items.value.find(x => x.id === templateId)
    if (!template || template.type !== 'checklist') return

    const itemsStore = useWorkItemsStore()
    const spawnedItems = []

    for (const itemTitle of template.items) {
      const spawned = await itemsStore.add({
        clientId: clientId,
        title: itemTitle,
        description: `Generated from template "${template.name}"`,
        status: 'open',
        important: false,
        urgent: false,
        billingType: 'fixed'
      })
      spawnedItems.push(spawned)
    }

    return spawnedItems
  }

  return { items, load, add, remove, instantiateChecklist }
})
