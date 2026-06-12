import { defineStore } from 'pinia'
import { ref } from 'vue'
import { db, newId, now, plain } from '@/db'

export const useWorkItemsStore = defineStore('workItems', () => {
  const items = ref([])

  async function load() {
    items.value = await db.work_items.toArray()
  }

  async function add(payload) {
    const item = {
      id: newId(),
      clientId: payload.clientId || '',
      title: payload.title || 'Untitled Work Item',
      description: payload.description || '',
      status: payload.status || 'open',
      important: payload.important !== false && payload.important !== undefined ? payload.important : false,
      urgent: payload.urgent !== false && payload.urgent !== undefined ? payload.urgent : false,
      dueDate: payload.dueDate || '',
      estimatedHours: payload.estimatedHours !== undefined ? Number(payload.estimatedHours) : 0,
      actualHours: payload.actualHours !== undefined ? Number(payload.actualHours) : 0,
      billingType: payload.billingType || 'fixed', // fixed, hourly, none
      charged: payload.charged !== undefined ? Number(payload.charged) : 0,
      resurfaceDate: payload.resurfaceDate || null,
      snoozedUntil: payload.snoozedUntil || null,
      subtasks: payload.subtasks || [], // [{ id, title, done }]
      closedDate: payload.closedDate || null,
      createdAt: now(),
      updatedAt: now()
    }
    await db.work_items.add(item)
    items.value.push(item)
    return item
  }

  async function update(id, patch) {
    const item = items.value.find(x => x.id === id)
    if (!item) return
    // Auto-set closedDate when transitioning to a completed status (unless explicitly provided)
    if (patch.status && isCompleted(patch.status) && !isCompleted(item.status) && !('closedDate' in patch)) {
      patch = { ...patch, closedDate: new Date().toISOString().slice(0, 10) }
    }
    // Clear closedDate when reopening
    if (patch.status && !isCompleted(patch.status) && isCompleted(item.status) && !('closedDate' in patch)) {
      patch = { ...patch, closedDate: null }
    }
    Object.assign(item, patch, { updatedAt: now() })
    await db.work_items.put(plain(item))
  }

  async function remove(id) {
    await db.work_items.delete(id)
    items.value = items.value.filter(x => x.id !== id)
  }

  function getQuadrant(item) {
    if (item.important && item.urgent) return 'critical'
    if (item.important && !item.urgent) return 'strategic'
    if (!item.important && item.urgent) return 'interruptive'
    return 'backlog'
  }

  function isCompleted(status) {
    return ['done', 'completed', 'complete', 'dropped'].includes(status)
  }

  return { items, load, add, update, remove, getQuadrant, isCompleted }
})
