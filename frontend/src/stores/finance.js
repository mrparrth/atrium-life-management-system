import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { db, newId, now } from '@/db'

export const useFinanceStore = defineStore('finance', () => {
  const assets = ref([])
  const snapshots = ref([])

  async function load() {
    assets.value = await db.finance_assets.toArray()
    snapshots.value = (await db.finance_snapshots.toArray()).sort((a, b) => a.date.localeCompare(b.date))
  }

  const netWorth = computed(() =>
    assets.value.reduce((sum, a) => sum + (a.type === 'asset' ? +a.value : -+a.value), 0)
  )
  const totalAssets = computed(() => assets.value.filter(a => a.type === 'asset').reduce((s, a) => s + +a.value, 0))
  const totalLiabilities = computed(() => assets.value.filter(a => a.type === 'liability').reduce((s, a) => s + +a.value, 0))

  const allocation = computed(() => {
    const map = {}
    assets.value.filter(a => a.type === 'asset').forEach(a => {
      map[a.category] = (map[a.category] || 0) + +a.value
    })
    return map
  })

  function project(years = 5) {
    const annual = assets.value.filter(a => a.type === 'asset').reduce((acc, a) => {
      const r = (a.growthRate || 0) / 100
      const c = (a.contribution || 0) * 12
      return acc + a.value * Math.pow(1 + r, years) + c * ((Math.pow(1 + r, years) - 1) / (r || 1))
    }, 0)
    const liab = totalLiabilities.value
    return Math.round(annual - liab)
  }

  async function addAsset(payload) {
    const a = { id: newId(), name: payload.name, type: payload.type || 'asset', category: payload.category || 'cash', value: +payload.value || 0, growthRate: +payload.growthRate || 0, contribution: +payload.contribution || 0, createdAt: now(), updatedAt: now() }
    await db.finance_assets.add(a); assets.value.push(a); return a
  }
  async function updateAsset(id, patch) {
    const a = assets.value.find(x => x.id === id); if (!a) return
    Object.assign(a, patch, { updatedAt: now() })
    await db.finance_assets.put({ ...a })
  }
  async function removeAsset(id) {
    await db.finance_assets.delete(id); assets.value = assets.value.filter(a => a.id !== id)
  }
  async function takeSnapshot() {
    const s = { id: newId(), date: new Date().toISOString().slice(0, 10), netWorth: netWorth.value, createdAt: now() }
    await db.finance_snapshots.add(s); snapshots.value.push(s); return s
  }

  return { assets, snapshots, netWorth, totalAssets, totalLiabilities, allocation, project, load, addAsset, updateAsset, removeAsset, takeSnapshot }
})
