import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { db, newId, now, plain, ensureDefaultCategories, DEFAULT_CATEGORIES } from '@/db'

export const useFinanceStore = defineStore('finance', () => {
  const networthLogs = ref([])      // [{ id, date, entries:[{category,type,value}], note, createdAt, updatedAt }]
  const cashflowPeriods = ref([])   // [{ id, month: 'YYYY-MM', entries:[{category,type,value}], note, createdAt, updatedAt }]
  const categories = ref([])        // [{ id, scope:'asset'|'liability'|'income'|'expense'|'investment', name }]
  const subscriptions = ref([])     // [{ id, name, cost, currency, billingPeriod, nextRenewal, category, status, createdAt, updatedAt }]

  async function load() {
    await ensureDefaultCategories()
    networthLogs.value = (await db.finance_networth_logs.toArray()).sort((a, b) => b.date.localeCompare(a.date))
    cashflowPeriods.value = (await db.finance_cashflow_periods.toArray()).sort((a, b) => b.month.localeCompare(a.month))
    
    let cats = await db.finance_categories.toArray()
    let migrated = false
    const fallbackGroup = { asset: 'Liquid', liability: 'Short-term', income: 'Active', expense: 'Need', investment: 'Equity' }
    for (const c of cats) {
      if (!c.group) {
        c.group = fallbackGroup[c.scope] || 'One-Off'
        await db.finance_categories.put(plain(c))
        migrated = true
      }
    }
    if (migrated) cats = await db.finance_categories.toArray()
    categories.value = cats.sort((a, b) => a.name.localeCompare(b.name))

    if (db.finance_subscriptions) {
      subscriptions.value = await db.finance_subscriptions.toArray()
    }
  }

  // ───── Net worth helpers
  function logTotal(log) {
    if (!log) return 0
    return (log.entries || []).reduce((s, e) => s + (e.type === 'asset' ? +e.value : -+e.value), 0)
  }
  function logAssets(log) { return (log?.entries || []).filter(e => e.type === 'asset').reduce((s, e) => s + +e.value, 0) }
  function logLiabilities(log) { return (log?.entries || []).filter(e => e.type === 'liability').reduce((s, e) => s + +e.value, 0) }

  const latestNetworth = computed(() => networthLogs.value[0] || null)
  const currentNetWorth = computed(() => logTotal(latestNetworth.value))
  const networthSeries = computed(() => [...networthLogs.value].reverse().map(l => ({ date: l.date, value: logTotal(l) })))

  const allocation = computed(() => {
    const log = latestNetworth.value
    if (!log) return []
    const total = logAssets(log) || 1
    const map = {}
    log.entries.filter(e => e.type === 'asset').forEach(e => {
      map[e.category] = (map[e.category] || 0) + +e.value
    })
    return Object.entries(map).map(([k, v]) => ({ key: k, value: v, pct: (v / total) * 100 })).sort((a, b) => b.value - a.value)
  })

  // ───── Cash flow helpers
  function periodTotals(p) {
    if (!p) return { income: 0, expense: 0, investment: 0, net: 0 }
    const i = (p.entries || []).filter(e => e.type === 'income').reduce((s, e) => s + +e.value, 0)
    const x = (p.entries || []).filter(e => e.type === 'expense').reduce((s, e) => s + +e.value, 0)
    const v = (p.entries || []).filter(e => e.type === 'investment').reduce((s, e) => s + +e.value, 0)
    return { income: i, expense: x, investment: v, net: i - x - v }
  }

  const latestCashflow = computed(() => cashflowPeriods.value[0] || null)
  const cashflowSeries = computed(() => [...cashflowPeriods.value].reverse().map(p => ({ month: p.month, ...periodTotals(p) })))
  const expenseBreakdownLatest = computed(() => {
    const p = latestCashflow.value
    if (!p) return []
    const expenses = (p.entries || []).filter(e => e.type === 'expense')
    const total = expenses.reduce((s, e) => s + +e.value, 0) || 1
    return expenses.map(e => ({ key: e.category, value: +e.value, pct: (+e.value / total) * 100 })).sort((a, b) => b.value - a.value)
  })

  // ───── Net worth log CRUD
  async function addNetworthLog(payload) {
    const log = {
      id: newId(),
      date: payload.date || new Date().toISOString().slice(0, 7),
      entries: (payload.entries || []).filter(e => +e.value !== 0).map(e => ({ category: e.category, type: e.type, value: +e.value })),
      note: payload.note || '',
      createdAt: now(), updatedAt: now(),
    }
    await db.finance_networth_logs.add(log)
    networthLogs.value.unshift(log)
    networthLogs.value.sort((a, b) => b.date.localeCompare(a.date))
    return log
  }
  async function updateNetworthLog(id, patch) {
    const l = networthLogs.value.find(x => x.id === id); if (!l) return
    Object.assign(l, patch, { updatedAt: now() })
    await db.finance_networth_logs.put(plain(l))
    networthLogs.value.sort((a, b) => b.date.localeCompare(a.date))
  }
  async function removeNetworthLog(id) {
    await db.finance_networth_logs.delete(id)
    networthLogs.value = networthLogs.value.filter(l => l.id !== id)
  }

  // ───── Cash flow period CRUD
  async function addCashflowPeriod(payload) {
    const p = {
      id: newId(),
      month: payload.month || new Date().toISOString().slice(0, 7),
      entries: (payload.entries || []).filter(e => +e.value !== 0).map(e => ({ category: e.category, type: e.type, value: +e.value })),
      note: payload.note || '',
      createdAt: now(), updatedAt: now(),
    }
    await db.finance_cashflow_periods.add(p)
    cashflowPeriods.value.unshift(p)
    cashflowPeriods.value.sort((a, b) => b.month.localeCompare(a.month))
    return p
  }
  async function updateCashflowPeriod(id, patch) {
    const p = cashflowPeriods.value.find(x => x.id === id); if (!p) return
    Object.assign(p, patch, { updatedAt: now() })
    await db.finance_cashflow_periods.put(plain(p))
    cashflowPeriods.value.sort((a, b) => b.month.localeCompare(a.month))
  }
  async function removeCashflowPeriod(id) {
    await db.finance_cashflow_periods.delete(id)
    cashflowPeriods.value = cashflowPeriods.value.filter(p => p.id !== id)
  }

  // ───── Categories CRUD
  function categoriesForScope(scope) { return categories.value.filter(c => c.scope === scope) }
  
  function visibleCategoriesForScope(scope, initialRecord = null) {
    const list = categories.value.filter(c => c.scope === scope)
    if (!initialRecord) {
      return list.filter(c => !c.archived)
    }
    const activeCats = new Set((initialRecord.entries || []).map(e => e.category))
    return list.filter(c => !c.archived || activeCats.has(c.name))
  }

  async function addCategory(scope, name, group = 'One-Off') {
    const trimmed = (name || '').trim().toLowerCase().replace(/\s+/g, '_')
    if (!trimmed) return null
    if (categories.value.some(c => c.scope === scope && c.name === trimmed)) return null
    const c = { id: newId(), scope, name: trimmed, group, archived: false, createdAt: now() }
    await db.finance_categories.add(c)
    categories.value.push(c)
    categories.value.sort((a, b) => a.name.localeCompare(b.name))
    return c
  }

  async function renameCategory(id, name) {
    const trimmed = (name || '').trim().toLowerCase().replace(/\s+/g, '_')
    if (!trimmed) return false
    const c = categories.value.find(x => x.id === id)
    if (!c) return false
    if (c.name === trimmed) return true
    
    if (categories.value.some(x => x.scope === c.scope && x.name === trimmed)) return false
    
    const oldName = c.name
    c.name = trimmed
    await db.finance_categories.put(plain(c))
    
    // Propagate rename to networthLogs
    const typeFilter = c.scope === 'asset' ? 'asset' : c.scope === 'liability' ? 'liability' : ''
    if (typeFilter) {
      for (const log of networthLogs.value) {
        let changed = false
        for (const e of log.entries || []) {
          if (e.type === typeFilter && e.category === oldName) {
            e.category = trimmed
            changed = true
          }
        }
        if (changed) {
          await db.finance_networth_logs.put(plain(log))
        }
      }
    }
    
    // Propagate rename to cashflowPeriods
    for (const p of cashflowPeriods.value) {
      let changed = false
      for (const e of p.entries || []) {
        if (e.type === c.scope && e.category === oldName) {
          e.category = trimmed
          changed = true
        }
      }
      if (changed) {
        await db.finance_cashflow_periods.put(plain(p))
      }
    }
    
    categories.value.sort((a, b) => a.name.localeCompare(b.name))
    return true
  }

  async function toggleArchiveCategory(id) {
    const c = categories.value.find(x => x.id === id)
    if (!c) return
    c.archived = !c.archived
    await db.finance_categories.put(plain(c))
  }

  async function removeCategory(id) {
    await db.finance_categories.delete(id)
    categories.value = categories.value.filter(c => c.id !== id)
  }

  async function resetCategories() {
    const currentCats = await db.finance_categories.toArray()
    const ts = now()

    const catsToInsert = DEFAULT_CATEGORIES.map((preset) => {
      const existing = currentCats.find(
        (x) => x.name === preset.name && x.scope === preset.scope
      )
      if (existing) {
        return {
          ...existing,
          group: preset.group, // Revert group to preset definition
          archived: false      // Unarchive preset categories
        }
      } else {
        return {
          id: newId(),
          scope: preset.scope,
          name: preset.name,
          group: preset.group,
          archived: false,
          defaultValue: 0,
          budgets: {},
          createdAt: ts
        }
      }
    })

    await db.finance_categories.clear()
    await db.finance_categories.bulkAdd(plain(catsToInsert))
    categories.value = catsToInsert.sort((a, b) => a.name.localeCompare(b.name))
  }

  async function updateCategoryBudget(id, year, amount) {
    const c = categories.value.find(x => x.id === id)
    if (!c) return
    if (!c.budgets) c.budgets = {}
    c.budgets[year] = amount ? +amount : 0
    if (String(year) === String(new Date().getFullYear())) {
      c.yearlyBudget = c.budgets[year]
    }
    await db.finance_categories.put(plain(c))
  }

  async function updateCategoryGroup(id, group) {
    const c = categories.value.find(x => x.id === id)
    if (!c) return false
    c.group = (group || '').trim() || 'One-Off'
    await db.finance_categories.put(plain(c))
    return true
  }

  async function updateCategoryDefaultValue(id, value) {
    const c = categories.value.find(x => x.id === id)
    if (!c) return false
    c.defaultValue = value ? +value : 0
    await db.finance_categories.put(plain(c))
    return true
  }

  async function addSubscription(payload) {
    const item = {
      id: newId(),
      name: payload.name || 'New Subscription',
      cost: payload.cost ? +payload.cost : 0,
      currency: payload.currency || 'INR',
      billingPeriod: payload.billingPeriod || 'monthly',
      nextRenewal: payload.nextRenewal || new Date().toISOString().slice(0, 10),
      category: payload.category || '',
      status: payload.status || 'active',
      createdAt: now(),
      updatedAt: now()
    }
    await db.finance_subscriptions.add(plain(item))
    subscriptions.value.push(item)
    return item
  }

  async function updateSubscription(id, patch) {
    const sub = subscriptions.value.find(x => x.id === id); if (!sub) return
    Object.assign(sub, patch, { updatedAt: now() })
    await db.finance_subscriptions.put(plain(sub))
  }

  async function removeSubscription(id) {
    await db.finance_subscriptions.delete(id)
    subscriptions.value = subscriptions.value.filter(x => x.id !== id)
  }

  return {
    networthLogs, cashflowPeriods, categories, subscriptions,
    latestNetworth, currentNetWorth, networthSeries, allocation,
    latestCashflow, cashflowSeries, expenseBreakdownLatest,
    logTotal, logAssets, logLiabilities, periodTotals,
    load,
    addNetworthLog, updateNetworthLog, removeNetworthLog,
    addCashflowPeriod, updateCashflowPeriod, removeCashflowPeriod,
    categoriesForScope, visibleCategoriesForScope, addCategory, renameCategory, toggleArchiveCategory, removeCategory,
    updateCategoryBudget, resetCategories, updateCategoryGroup, updateCategoryDefaultValue,
    addSubscription, updateSubscription, removeSubscription,
  }
})
