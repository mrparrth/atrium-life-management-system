import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { db, newId, now, plain } from '@/db'
import { useWorkItemsStore } from './workItems'
import { useWorkMeetingsStore } from './workMeetings'

export const useWorkForecastStore = defineStore('workForecast', () => {
  const capacityRecords = ref([])
  const defaultCapacity = ref({
    availableHours: 40,
    adminLoadPercent: 10
  })

  async function load() {
    capacityRecords.value = await db.work_capacity.toArray()
  }

  function getStartOfWeek(date = new Date()) {
    const d = new Date(date)
    const day = d.getDay()
    // Monday start: if Sunday (0) diff is 6, else day - 1
    const diff = day === 0 ? 6 : day - 1
    d.setDate(d.getDate() - diff)
    return d.toISOString().slice(0, 10)
  }

  const selectedWeekStart = ref(getStartOfWeek())

  function changeWeek(offsetWeeks) {
    const d = new Date(selectedWeekStart.value)
    d.setDate(d.getDate() + offsetWeeks * 7)
    selectedWeekStart.value = d.toISOString().slice(0, 10)
  }

  async function updateCapacity(weekStartDate, patch) {
    let rec = capacityRecords.value.find(c => c.weekStartDate === weekStartDate)
    if (rec) {
      Object.assign(rec, patch, { updatedAt: now() })
      await db.work_capacity.put(plain(rec))
    } else {
      rec = {
        id: newId(),
        weekStartDate,
        availableHours: patch.availableHours !== undefined ? Number(patch.availableHours) : 40,
        adminLoadPercent: patch.adminLoadPercent !== undefined ? Number(patch.adminLoadPercent) : 10,
        allocations: patch.allocations || [],
        createdAt: now(),
        updatedAt: now()
      }
      await db.work_capacity.add(rec)
      capacityRecords.value.push(rec)
    }
    return rec
  }

  async function saveAllocations(weekStartDate, allocations) {
    let rec = capacityRecords.value.find(c => c.weekStartDate === weekStartDate)
    if (rec) {
      rec.allocations = plain(allocations)
      rec.updatedAt = now()
      await db.work_capacity.put(plain(rec))
    } else {
      rec = {
        id: newId(),
        weekStartDate,
        availableHours: defaultCapacity.value.availableHours,
        adminLoadPercent: defaultCapacity.value.adminLoadPercent,
        allocations: plain(allocations),
        createdAt: now(),
        updatedAt: now()
      }
      await db.work_capacity.add(rec)
      capacityRecords.value.push(rec)
    }
  }

  function getWeeklyCapacity(weekStartDate) {
    const rec = capacityRecords.value.find(c => c.weekStartDate === weekStartDate)
    return rec || {
      weekStartDate,
      availableHours: defaultCapacity.value.availableHours,
      adminLoadPercent: defaultCapacity.value.adminLoadPercent,
      allocations: { Mon: [], Tue: [], Wed: [], Thu: [], Fri: [], Sat: [], Sun: [] }
    }
  }

  const currentWeekStats = computed(() => {
    const startStr = selectedWeekStart.value
    const startObj = new Date(startStr)
    const endObj = new Date(startObj.getTime() + 7 * 86400000)
    const endStr = endObj.toISOString().slice(0, 10)

    const capacitySpec = getWeeklyCapacity(startStr)
    const adminHours = capacitySpec.availableHours * (capacitySpec.adminLoadPercent / 100)

    const meetingsStore = useWorkMeetingsStore()
    let meetingHours = 0
    meetingsStore.items.forEach(m => {
      if (m.startDateTime >= startStr && m.startDateTime < endStr) {
        const durHrs = (new Date(m.endDateTime).getTime() - new Date(m.startDateTime).getTime()) / (1000 * 60 * 60)
        meetingHours += durHrs
      }
    })

    const itemsStore = useWorkItemsStore()
    let allocatedHours = 0
    let overdueHours = 0
    const todayStr = new Date().toISOString().slice(0, 10)

    itemsStore.items.forEach(item => {
      if (!itemsStore.isCompleted(item.status)) {
        const remaining = Math.max(0, item.estimatedHours - item.actualHours) || item.estimatedHours
        if (item.dueDate && item.dueDate >= startStr && item.dueDate < endStr) {
          allocatedHours += remaining
        } else if (item.dueDate && item.dueDate < startStr) {
          overdueHours += remaining
        }
      }
    })

    let plannedHours = 0
    if (capacitySpec.allocations) {
      if (typeof capacitySpec.allocations === 'object' && !Array.isArray(capacitySpec.allocations)) {
        Object.values(capacitySpec.allocations).forEach(dayList => {
          if (Array.isArray(dayList)) {
            dayList.forEach(entry => {
              plannedHours += Number(entry.hours) || 0
            })
          }
        })
      } else if (Array.isArray(capacitySpec.allocations)) {
        capacitySpec.allocations.forEach(alloc => {
          plannedHours += Object.values(alloc.days).reduce((sum, val) => sum + (Number(val) || 0), 0)
        })
      }
    }

    const totalLoad = adminHours + meetingHours + Math.max(allocatedHours, plannedHours) + overdueHours
    const remainingHours = capacitySpec.availableHours - totalLoad
    
    const burnoutRisk = totalLoad > capacitySpec.availableHours * 1.15
    const overloadRisk = totalLoad > capacitySpec.availableHours
    const slippingDeadlines = itemsStore.items.some(item => 
      !itemsStore.isCompleted(item.status) && 
      item.dueDate && 
      item.dueDate < todayStr && 
      !item.snoozedUntil
    )

    return {
      availableHours: capacitySpec.availableHours,
      adminHours,
      meetingHours,
      allocatedHours,
      overdueHours,
      plannedHours,
      totalLoad,
      remainingHours,
      burnoutRisk,
      overloadRisk,
      slippingDeadlines
    }
  })

  return { capacityRecords, load, updateCapacity, getStartOfWeek, getWeeklyCapacity, currentWeekStats, selectedWeekStart, changeWeek, saveAllocations, newId }
})
