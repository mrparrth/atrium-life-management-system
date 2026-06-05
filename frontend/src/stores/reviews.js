import { defineStore } from 'pinia'
import { ref } from 'vue'
import { db, newId, now } from '@/db'

export const useReviewsStore = defineStore('reviews', () => {
  const items = ref([])
  async function load() { items.value = (await db.reviews.toArray()).sort((a, b) => b.date.localeCompare(a.date)) }
  async function add(payload) {
    const r = { id: newId(), type: payload.type, date: payload.date || new Date().toISOString().slice(0, 10), wins: payload.wins || '', challenges: payload.challenges || '', gratitude: payload.gratitude || '', nextFocus: payload.nextFocus || '', createdAt: now() }
    await db.reviews.add(r); items.value.unshift(r); return r
  }
  async function remove(id) { await db.reviews.delete(id); items.value = items.value.filter(r => r.id !== id) }
  return { items, load, add, remove }
})
