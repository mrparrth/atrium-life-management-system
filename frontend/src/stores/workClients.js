import { defineStore } from 'pinia'
import { ref } from 'vue'
import { db, newId, now, plain } from '@/db'

export const useWorkClientsStore = defineStore('workClients', () => {
  const items = ref([])

  const STATUS_MAP = {
    important: { label: 'Important', color: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20' },
    normal: { label: 'Normal', color: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20' },
    do_not_follow_up: { label: 'Do Not Follow Up', color: 'bg-ink-3/10 text-ink-2 border-line' },
    recently_active: { label: 'Recently Active', color: 'bg-[#7d7975]/10 text-[#7d7975] border-[#7d7975]/20' },
    prospect: { label: 'Prospect', color: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20' },
    inactive: { label: 'Inactive', color: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20' }
  }

  function getStatusStyle(status) {
    const s = status || 'normal'
    if (s === 'active') return STATUS_MAP.normal
    return STATUS_MAP[s] || STATUS_MAP.normal
  }

  async function load() {
    items.value = await db.work_clients.toArray()
  }

  async function add(payload) {
    const c = {
      id: newId(),
      name: payload.name || 'Untitled Client',
      status: payload.status || 'normal',
      timezone: payload.timezone || 'GMT',
      preferredCommunication: payload.preferredCommunication || 'Email',
      technicalStack: payload.technicalStack || '',
      pricingSensitivity: payload.pricingSensitivity || 'Medium',
      workflowPreference: payload.workflowPreference || '',
      meetingPreference: payload.meetingPreference || '',
      relationshipNotes: payload.relationshipNotes || '',
      lastInteractionAt: payload.lastInteractionAt || now(),
      tags: payload.tags || [],
      techSavvy: payload.techSavvy !== undefined ? payload.techSavvy : false,
      upchargePercentage: payload.upchargePercentage !== undefined ? Number(payload.upchargePercentage) : 0,
      clientSource: payload.clientSource || '',
      rating: payload.rating !== undefined ? payload.rating : null, // client score (1-5)
      driveFolderId: payload.driveFolderId || '',
      createdAt: now(),
      updatedAt: now()
    }
    await db.work_clients.add(c)
    items.value.push(c)
    return c
  }

  async function update(id, patch) {
    const c = items.value.find(x => x.id === id)
    if (!c) return
    Object.assign(c, patch, { updatedAt: now() })
    await db.work_clients.put(plain(c))
  }

  async function remove(id) {
    await db.work_clients.delete(id)
    items.value = items.value.filter(x => x.id !== id)
  }

  return { items, load, add, update, remove, STATUS_MAP, getStatusStyle }
})

