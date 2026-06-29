import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { db, newId, now, plain } from '@/db'

export const useWorkLeadsStore = defineStore('workLeads', () => {
  const items = ref([])

  async function load() {
    items.value = await db.work_leads.toArray()
  }

  async function add(payload) {
    const lead = {
      id: newId(),
      title: payload.title || 'Untitled Lead',
      clientName: payload.clientName || 'Direct Client',
      status: payload.status || 'lead', // lead, discovery, proposal_sent, negotiation, won, lost
      estimatedValue: payload.estimatedValue !== undefined ? Number(payload.estimatedValue) : 0,
      expectedHours: payload.expectedHours !== undefined ? Number(payload.expectedHours) : 0,
      probability: payload.probability !== undefined ? Number(payload.probability) : 0.5,
      followUpDate: payload.followUpDate || '',
      statusChangedAt: payload.statusChangedAt || now(),
      relationshipStrength: payload.relationshipStrength !== undefined ? Number(payload.relationshipStrength) : 3, // 1 to 5
      notes: payload.notes || '',
      archived: !!payload.archived,
      createdAt: now(),
      updatedAt: now()
    }
    await db.work_leads.add(lead)
    items.value.push(lead)
    return lead
  }

  async function update(id, patch) {
    const lead = items.value.find(x => x.id === id)
    if (!lead) return

    if (patch.status && patch.status !== lead.status) {
      patch.statusChangedAt = now()
      if (!patch.followUpDate) {
        const twoDaysForward = new Date()
        twoDaysForward.setDate(twoDaysForward.getDate() + 2)
        patch.followUpDate = twoDaysForward.toISOString().slice(0, 10)
      }
    }

    Object.assign(lead, patch, { updatedAt: now() })
    await db.work_leads.put(plain(lead))
  }

  async function remove(id) {
    await db.work_leads.delete(id)
    items.value = items.value.filter(x => x.id !== id)
  }

  // Forecast weights (excludes won, lost, and archived leads from active pipeline calculations)
  const forecast = computed(() => {
    let high = 0
    let medium = 0
    let low = 0

    const activeLeads = items.value.filter(lead => !lead.archived && !['won', 'lost'].includes(lead.status))

    activeLeads.forEach(lead => {
      const val = lead.estimatedValue * lead.probability
      if (lead.probability >= 0.8) {
        high += val
      } else if (lead.probability >= 0.5) {
        medium += val
      } else {
        low += val
      }
    })

    const totalPipeline = activeLeads.reduce((acc, x) => acc + x.estimatedValue, 0)

    return { high, medium, low, total: high + medium + low, totalPipeline }
  })

  return { items, load, add, update, remove, forecast }
})
