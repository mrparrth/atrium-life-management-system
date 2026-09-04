import { defineStore } from 'pinia'
import { db, newId, now, plain } from '@/db'
import dayjs from 'dayjs'

export const useHabitsStore = defineStore('habits', {
  state: () => ({
    items: [],
    logs: [],
    loaded: false
  }),

  getters: {
    activeHabits: (state) => state.items.filter(h => !h.archived && h.status !== 'paused'),
    pausedHabits: (state) => state.items.filter(h => h.archived || h.status === 'paused'),
    
    getHabitsByYearId: (state) => (yearId) => {
      return state.items.filter(h => !h.archived && h.status !== 'paused' && h.yearIds && h.yearIds.includes(yearId))
    }
  },

  actions: {
    async load() {
      try {
        const [habitsData, logsData] = await Promise.all([
          db.habits.toArray(),
          db.habit_logs.toArray()
        ])
        this.items = habitsData || []
        this.logs = logsData || []
        this.loaded = true
      } catch (e) {
        console.error('Failed to load habits:', e)
      }
    },

    async addHabit({ title, frequency = 'daily', weeklyDays = [1, 2, 3, 4, 5], yearIds = [], icon = '⚡' }) {
      const item = {
        id: newId(),
        title: title.trim(),
        icon: icon || '⚡',
        frequency, // 'daily' | 'weekly'
        weeklyDays: Array.isArray(weeklyDays) ? weeklyDays : [1, 2, 3, 4, 5], // 0=Sun, 1=Mon, ..., 6=Sat
        yearIds: Array.isArray(yearIds) ? yearIds : [],
        archived: false,
        status: 'active',
        createdAt: now(),
        updatedAt: now()
      }
      await db.habits.add(plain(item))
      this.items.push(item)
      return item
    },

    async updateHabit(id, patch) {
      const idx = this.items.findIndex(h => h.id === id)
      if (idx === -1) return
      const updated = {
        ...this.items[idx],
        ...patch,
        updatedAt: now()
      }
      await db.habits.put(plain(updated))
      this.items[idx] = updated
      return updated
    },

    async pauseHabit(id) {
      const pauseDate = now()
      return await this.updateHabit(id, {
        status: 'paused',
        archived: true,
        pausedAt: pauseDate
      })
    },

    async resumeHabit(id) {
      return await this.updateHabit(id, {
        status: 'active',
        archived: false,
        pausedAt: null
      })
    },

    getHabitDurationText(habit) {
      if (!habit) return ''
      const start = dayjs(habit.createdAt || now())
      const end = habit.pausedAt ? dayjs(habit.pausedAt) : dayjs()
      const days = Math.max(1, end.diff(start, 'day'))
      if (days < 30) {
        return `${days} ${days === 1 ? 'day' : 'days'}`
      }
      const months = Math.max(1, Math.round(end.diff(start, 'month', true)))
      return `${months} ${months === 1 ? 'month' : 'months'}`
    },

    getHabitStoppedDateText(habit) {
      if (!habit || !habit.pausedAt) return ''
      return dayjs(habit.pausedAt).format('MMM D, YYYY')
    },

    async deleteHabit(id) {
      await db.habits.delete(id)
      const logsToDelete = this.logs.filter(l => l.habitId === id).map(l => l.id)
      if (logsToDelete.length) {
        await db.habit_logs.bulkDelete(logsToDelete)
      }
      this.items = this.items.filter(h => h.id !== id)
      this.logs = this.logs.filter(l => l.habitId !== id)
    },

    isHabitDueOn(habit, dateInput) {
      const d = dayjs(dateInput)
      if (!d.isValid()) return false
      if (habit.frequency === 'daily') return true
      if (habit.frequency === 'weekly') {
        const dayOfWeek = d.day() // 0=Sun, 1=Mon...
        return Array.isArray(habit.weeklyDays) && habit.weeklyDays.includes(dayOfWeek)
      }
      return true
    },

    isCompletedOn(habitId, dateStr) {
      const targetDate = dayjs(dateStr).format('YYYY-MM-DD')
      const log = this.logs.find(l => l.habitId === habitId && l.date === targetDate)
      return !!(log && log.completed)
    },

    async toggleHabitLog(habitId, dateStr = dayjs().format('YYYY-MM-DD')) {
      const targetDate = dayjs(dateStr).format('YYYY-MM-DD')
      const existingIdx = this.logs.findIndex(l => l.habitId === habitId && l.date === targetDate)

      if (existingIdx !== -1) {
        const currentLog = this.logs[existingIdx]
        const newCompleted = !currentLog.completed
        const updated = { ...currentLog, completed: newCompleted }
        await db.habit_logs.put(plain(updated))
        this.logs[existingIdx] = updated
        return newCompleted
      } else {
        const newLog = {
          id: newId(),
          habitId,
          date: targetDate,
          completed: true,
          createdAt: now()
        }
        await db.habit_logs.add(plain(newLog))
        this.logs.push(newLog)
        return true
      }
    },

    getYearHabitStats(yearObj) {
      if (!yearObj || !yearObj.id) return { totalHabits: 0, completionRate: 0, completedCount: 0, expectedCount: 0 }

      const linkedHabits = this.items.filter(h => !h.archived && h.yearIds && h.yearIds.includes(yearObj.id))
      if (!linkedHabits.length) {
        return { totalHabits: 0, completionRate: 0, completedCount: 0, expectedCount: 0 }
      }

      const yearNum = Number(yearObj.year)
      const startDate = dayjs(`${yearNum}-01-01`)
      const endDate = dayjs().year() === yearNum ? dayjs() : dayjs(`${yearNum}-12-31`)
      
      let expectedCount = 0
      let completedCount = 0

      let curr = startDate
      while (curr.isBefore(endDate) || curr.isSame(endDate, 'day')) {
        const dateStr = curr.format('YYYY-MM-DD')
        linkedHabits.forEach(h => {
          if (this.isHabitDueOn(h, curr)) {
            expectedCount++
            if (this.isCompletedOn(h.id, dateStr)) {
              completedCount++
            }
          }
        })
        curr = curr.add(1, 'day')
      }

      const rate = expectedCount > 0 ? Math.round((completedCount / expectedCount) * 100) : 0
      return {
        totalHabits: linkedHabits.length,
        completionRate: rate,
        completedCount,
        expectedCount
      }
    }
  }
})
