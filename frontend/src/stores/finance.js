import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { db, newId, now, ensureDefaultCategories, plain } from '@/db'

export const useFinanceStore = defineStore('finance', () => {
  const assets = ref([])
  const snapshots = ref([])
  const cashflow = ref([])
  const categories = ref([])

  async function load() {
    await ensureDefaultCategories()
    assets.value = await db.finance_assets.toArray()
    snapshots.value = (await db.finance_snapshots.toArray()).sort((a, b) => a.date.localeCompare(b.date))
    cashflow.value = await db.finance_cashflow.toArray()
    categories.value = (await db.finance_categories.toArray()).sort((a, b) => a.name.localeCompare(b.name))
  }

  // ───────── Net Worth ─────────
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

  // ───────── Cash flow (normalised to monthly) ─────────
  function monthlyValue(entry) {
    const amt = +entry.amount || 0
    if (entry.recurring === 'yearly') return amt / 12
    if (entry.recurring === 'monthly') return amt
    return 0 // one_time excluded from recurring totals
  }
  const monthlyIncome = computed(() => cashflow.value.filter(e => e.type === 'income').reduce((s, e) => s + monthlyValue(e), 0))
  const monthlyExpenses = computed(() => cashflow.value.filter(e => e.type === 'expense').reduce((s, e) => s + monthlyValue(e), 0))
  const monthlyInvestments = computed(() => cashflow.value.filter(e => e.type === 'investment').reduce((s, e) => s + monthlyValue(e), 0))
  const monthlyNet = computed(() => monthlyIncome.value - monthlyExpenses.value - monthlyInvestments.value)
  const savingsRate = computed(() => {
    if (!monthlyIncome.value) return 0
    return ((monthlyIncome.value - monthlyExpenses.value) / monthlyIncome.value) * 100
  })

  const expenseByCategory = computed(() => {
    const map = {}
    cashflow.value.filter(e => e.type === 'expense').forEach(e => {
      map[e.category || 'other'] = (map[e.category || 'other'] || 0) + monthlyValue(e)
    })
    return map
  })

  // ───────── Projection (assets only) ─────────
  function project(years = 5) {
    const annual = assets.value.filter(a => a.type === 'asset').reduce((acc, a) => {
      const r = (a.growthRate || 0) / 100
      const c = (a.contribution || 0) * 12
      return acc + a.value * Math.pow(1 + r, years) + c * ((Math.pow(1 + r, years) - 1) / (r || 1))
    }, 0)
    return Math.round(annual - totalLiabilities.value)
  }

  // ───────── Assets CRUD ─────────
  async function addAsset(payload) {
    const a = { id: newId(), name: payload.name, type: payload.type || 'asset', category: payload.category || 'cash', value: +payload.value || 0, growthRate: +payload.growthRate || 0, contribution: +payload.contribution || 0, createdAt: now(), updatedAt: now() }
    await db.finance_assets.add(a); assets.value.push(a); return a
  }
  async function updateAsset(id, patch) {
    const a = assets.value.find(x => x.id === id); if (!a) return
    Object.assign(a, patch, { updatedAt: now() })
    await db.finance_assets.put(plain(a))
  }
  async function removeAsset(id) {
    await db.finance_assets.delete(id); assets.value = assets.value.filter(a => a.id !== id)
  }
  async function takeSnapshot() {
    const s = { id: newId(), date: new Date().toISOString().slice(0, 10), netWorth: netWorth.value, createdAt: now() }
    await db.finance_snapshots.add(s); snapshots.value.push(s); return s
  }

  // ───────── Cash flow CRUD ─────────
  async function addCashflow(payload) {
    const c = {
      id: newId(),
      type: payload.type || 'expense',
      name: payload.name || '(untitled)',
      amount: +payload.amount || 0,
      category: payload.category || 'other',
      recurring: payload.recurring || 'monthly',
      date: payload.date || new Date().toISOString().slice(0, 10),
      note: payload.note || '',
      createdAt: now(), updatedAt: now(),
    }
    await db.finance_cashflow.add(c); cashflow.value.push(c); return c
  }
  async function updateCashflow(id, patch) {
    const c = cashflow.value.find(x => x.id === id); if (!c) return
    Object.assign(c, patch, { updatedAt: now() })
    await db.finance_cashflow.put(plain(c))
  }
  async function removeCashflow(id) {
    await db.finance_cashflow.delete(id); cashflow.value = cashflow.value.filter(c => c.id !== id)
  }

  // ───────── Categories CRUD ─────────
  function categoriesForScope(scope) {
    return categories.value.filter(c => c.scope === scope)
  }
  async function addCategory(scope, name) {
    const trimmed = (name || '').trim().toLowerCase().replace(/\s+/g, '_')
    if (!trimmed) return null
    if (categories.value.some(c => c.scope === scope && c.name === trimmed)) return null
    const c = { id: newId(), scope, name: trimmed, createdAt: now() }
    await db.finance_categories.add(c); categories.value.push(c)
    categories.value.sort((a, b) => a.name.localeCompare(b.name))
    return c
  }
  async function removeCategory(id) {
    await db.finance_categories.delete(id)
    categories.value = categories.value.filter(c => c.id !== id)
  }

  return {
    assets, snapshots, cashflow, categories,
    netWorth, totalAssets, totalLiabilities, allocation,
    monthlyIncome, monthlyExpenses, monthlyInvestments, monthlyNet, savingsRate, expenseByCategory,
    project, load,
    addAsset, updateAsset, removeAsset, takeSnapshot,
    addCashflow, updateCashflow, removeCashflow,
    categoriesForScope, addCategory, removeCategory,
  }
})
