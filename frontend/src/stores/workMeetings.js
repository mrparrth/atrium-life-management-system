import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { db, newId, now, plain } from '@/db'
import { useWorkClientsStore } from './workClients'

export const useWorkMeetingsStore = defineStore('workMeetings', () => {
  const items = ref([])

  async function load() {
    const all = await db.work_meetings.toArray()
    const seen = new Set()
    const unique = []
    const toDelete = []
    
    // Sort to prioritize meetings with Google Calendar ID or linked client, and newer updates
    all.sort((a, b) => {
      if (a.googleCalendarId && !b.googleCalendarId) return -1
      if (!a.googleCalendarId && b.googleCalendarId) return 1
      if (a.clientId && !b.clientId) return -1
      if (!a.clientId && b.clientId) return 1
      return (b.updatedAt || '').localeCompare(a.updatedAt || '')
    })
    
    for (const m of all) {
      const timeMs = new Date(m.startDateTime).getTime()
      const key = `${(m.title || '').trim().toLowerCase()}_${timeMs}`
      if (seen.has(key)) {
        toDelete.push(m.id)
      } else {
        seen.add(key)
        unique.push(m)
      }
    }
    
    if (toDelete.length > 0) {
      await Promise.all(toDelete.map(id => db.work_meetings.delete(id)))
      console.log(`Deduplicated ${toDelete.length} meetings from DB`)
    }
    
    items.value = unique
  }

  async function add(payload) {
    const meeting = {
      id: newId(),
      googleCalendarId: payload.googleCalendarId || '',
      clientId: payload.clientId || '',
      title: payload.title || 'Untitled Sync',
      description: payload.description || '',
      startDateTime: payload.startDateTime || now(),
      endDateTime: payload.endDateTime || now(),
      meetLink: payload.meetLink || '',
      associatedType: payload.associatedType || 'none', // client, work_item, none
      associatedId: payload.associatedId || '',
      createdAt: now(),
      updatedAt: now()
    }
    
    // Auto associate if client name matches in the title
    if (!meeting.clientId && !meeting.associatedId) {
      const clientsStore = useWorkClientsStore()
      const matchedClient = clientsStore.items.find(c => 
        meeting.title.toLowerCase().includes(c.name.toLowerCase())
      )
      if (matchedClient) {
        meeting.clientId = matchedClient.id
        meeting.associatedType = 'client'
        meeting.associatedId = matchedClient.id
      }
    }

    await db.work_meetings.add(meeting)
    items.value.push(meeting)
    return meeting
  }

  async function update(id, patch) {
    const meeting = items.value.find(x => x.id === id)
    if (!meeting) return
    Object.assign(meeting, patch, { updatedAt: now() })
    await db.work_meetings.put(plain(meeting))
  }

  async function remove(id) {
    await db.work_meetings.delete(id)
    items.value = items.value.filter(x => x.id !== id)
  }

  // Returns the next meeting starting in the future, sorted by startDateTime ascending
  const nextMeeting = computed(() => {
    const rightNow = new Date().toISOString()
    const futureMeetings = items.value.filter(m => m.startDateTime > rightNow)
    futureMeetings.sort((a, b) => a.startDateTime.localeCompare(b.startDateTime))
    return futureMeetings[0] || null
  })

  // Returns true if there is a meeting happening soon (within next 30 minutes or currently ongoing)
  const activeMeetingPrep = computed(() => {
    if (!items.value.length) return null
    const nowMs = Date.now()
    const bufferBefore = 30 * 60 * 1000 // 30 minutes prep window
    
    // Find meetings starting soon or already running
    const prepMeetings = items.value.filter(m => {
      const startMs = new Date(m.startDateTime).getTime()
      const endMs = new Date(m.endDateTime).getTime()
      return (startMs - nowMs <= bufferBefore && endMs > nowMs)
    })
    
    prepMeetings.sort((a, b) => a.startDateTime.localeCompare(b.startDateTime))
    return prepMeetings[0] || null
  })

  return { items, load, add, update, remove, nextMeeting, activeMeetingPrep }
})
