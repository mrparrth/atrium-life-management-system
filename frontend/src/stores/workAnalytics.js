import { defineStore } from 'pinia'
import { computed } from 'vue'
import { useWorkClientsStore } from './workClients'
import { useWorkItemsStore } from './workItems'
import { useWorkInvoicesStore } from './workInvoices'

export const useWorkAnalyticsStore = defineStore('workAnalytics', () => {
  const clientsStore = useWorkClientsStore()
  const itemsStore = useWorkItemsStore()
  const invoicesStore = useWorkInvoicesStore()

  // Calculate profitability and hours for each client
  const clientProfitability = computed(() => {
    return clientsStore.items.map(client => {
      // 1. Total hours tracked for this client
      const clientItems = itemsStore.items.filter(item => item.clientId === client.id)
      const totalHours = clientItems.reduce((acc, x) => acc + (x.actualHours || 0), 0)

      // 2. Total invoiced amount (excluding taxes for true earnings calculation, or simple total)
      // Let's use the subtotal before taxes if possible, or just amount.
      // Since amount is pre-calculated with taxes, let's use the base items total if possible
      const clientInvoices = invoicesStore.items.filter(inv => inv.clientId === client.id)
      const totalInvoiced = clientInvoices.reduce((acc, inv) => {
        const base = inv.items.reduce((sum, item) => sum + (item.quantity * item.rate), 0)
        return acc + base
      }, 0)

      // 3. Hourly yield
      const hourlyYield = totalHours > 0 ? Math.round(totalInvoiced / totalHours) : 0

      // 4. Scope creep count (items where actual hours exceed estimated hours)
      const scopeCreepItems = clientItems.filter(item => item.estimatedHours > 0 && item.actualHours > item.estimatedHours)

      return {
        id: client.id,
        name: client.name,
        totalHours,
        totalInvoiced,
        hourlyYield,
        scopeCreepCount: scopeCreepItems.length,
        itemsCount: clientItems.length
      }
    })
  })

  // Scope creep highlights (all work items exceeding estimates)
  const scopeCreepAlerts = computed(() => {
    return itemsStore.items
      .filter(item => !itemsStore.isCompleted(item.status) && item.estimatedHours > 0 && item.actualHours > item.estimatedHours)
      .map(item => {
        const client = clientsStore.items.find(c => c.id === item.clientId)
        const overrun = item.actualHours - item.estimatedHours
        const percent = Math.round((overrun / item.estimatedHours) * 100)
        return {
          id: item.id,
          title: item.title,
          clientName: client ? client.name : 'Standalone',
          estimatedHours: item.estimatedHours,
          actualHours: item.actualHours,
          overrun,
          percent
        }
      })
  })

  // Focus fragmentation: how many active clients have in-progress or open items currently?
  const focusFragmentation = computed(() => {
    const activeClientIds = new Set()
    itemsStore.items.forEach(item => {
      if (item.status === 'in_progress' && item.clientId) {
        activeClientIds.add(item.clientId)
      }
    })
    
    const count = activeClientIds.size
    let risk = 'calm'
    let message = 'Your focus is well-concentrated.'
    
    if (count >= 4) {
      risk = 'high'
      message = 'High context switching danger. Concentrating on too many clients.'
    } else if (count === 3) {
      risk = 'medium'
      message = 'Moderate context switching load.'
    }

    return { activeClientsCount: count, risk, message }
  })

  // Monthly revenue trends for the last 6 months
  const monthlyRevenueSeries = computed(() => {
    const months = {}
    const today = new Date()
    
    // Initialize last 6 months
    for (let i = 5; i >= 0; i--) {
      const d = new Date(today.getFullYear(), today.getMonth() - i, 1)
      const key = d.toISOString().slice(0, 7) // YYYY-MM
      months[key] = 0
    }

    invoicesStore.items.forEach(inv => {
      // Use paidAt date if paid, else invoice due date/creation date
      const dateStr = inv.paidAt || inv.dueDate || inv.createdAt
      if (dateStr) {
        const key = dateStr.slice(0, 7)
        if (months[key] !== undefined) {
          // Use base items amount (excluding tax if possible)
          const base = inv.items.reduce((sum, item) => sum + (item.quantity * item.rate), 0)
          months[key] += base
        }
      }
    })

    return Object.keys(months).map(key => {
      const [year, month] = key.split('-')
      const date = new Date(Number(year), Number(month) - 1, 1)
      const label = date.toLocaleString('default', { month: 'short' })
      return {
        key,
        label,
        value: months[key]
      }
    })
  })

  return { clientProfitability, scopeCreepAlerts, focusFragmentation, monthlyRevenueSeries }
})
