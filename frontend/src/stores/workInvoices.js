import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { db, newId, now, plain } from '@/db'

export const useWorkInvoicesStore = defineStore('workInvoices', () => {
  const items = ref([])

  async function load() {
    items.value = await db.work_invoices.toArray()
  }

  async function add(payload) {
    const isExternal = !!payload.isExternal
    const externalUrl = payload.externalUrl || ''
    
    let totalAmount = 0
    let invItems = []
    let taxRate = payload.taxRate !== undefined ? Number(payload.taxRate) : 18

    if (isExternal) {
      totalAmount = Number(payload.amount) || 0
      taxRate = 0
      invItems = [{ description: 'External Invoice Reference', quantity: 1, rate: totalAmount }]
    } else {
      invItems = payload.items || []
      const baseAmount = invItems.reduce((acc, x) => acc + (x.quantity * x.rate), 0)
      const taxAmount = baseAmount * (taxRate / 100)
      totalAmount = baseAmount + taxAmount
    }

    const invoice = {
      id: newId(),
      clientId: payload.clientId || '',
      invoiceNumber: payload.invoiceNumber || `INV-${new Date().getFullYear()}-${String(items.value.length + 1).padStart(3, '0')}`,
      status: payload.status || 'pending', // paid, pending, overdue, partially_paid
      dueDate: payload.dueDate || new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10),
      paidAt: payload.paidAt || null,
      billingType: payload.billingType || 'fixed', // fixed, hourly, retainer, milestone
      taxRate: taxRate,
      items: invItems,
      amount: totalAmount,
      amountPaid: payload.amountPaid !== undefined ? Number(payload.amountPaid) : 0,
      title: payload.title || 'Invoice',
      subtitle: payload.subtitle || '',
      currency: payload.currency || 'USD',
      isExternal: isExternal,
      externalUrl: externalUrl,
      createdAt: payload.createdAt || now(),
      updatedAt: now()
    }
    await db.work_invoices.add(invoice)
    items.value.push(invoice)
    return invoice
  }

  async function update(id, patch) {
    const invoice = items.value.find(x => x.id === id)
    if (!invoice) return
    Object.assign(invoice, patch, { updatedAt: now() })
    
    // Recalculate amount if items changed
    if (patch.items && !invoice.isExternal) {
      const baseAmount = invoice.items.reduce((acc, x) => acc + (x.quantity * x.rate), 0)
      const taxRate = invoice.taxRate !== undefined ? Number(invoice.taxRate) : 18
      const taxAmount = baseAmount * (taxRate / 100)
      invoice.amount = baseAmount + taxAmount
    } else if (invoice.isExternal && patch.amount !== undefined) {
      invoice.amount = Number(patch.amount) || 0
      invoice.items = [{ description: 'External Invoice Reference', quantity: 1, rate: invoice.amount }]
    }

    await db.work_invoices.put(plain(invoice))
  }

  async function remove(id) {
    await db.work_invoices.delete(id)
    items.value = items.value.filter(x => x.id !== id)
  }

  // Summary statistics
  const summary = computed(() => {
    let paid = 0
    let pending = 0
    let overdue = 0
    
    const today = new Date().toISOString().slice(0, 10)

    items.value.forEach(inv => {
      const netValue = inv.amount - inv.amountPaid
      if (inv.status === 'paid') {
        paid += inv.amount
      } else if (inv.status === 'partially_paid') {
        paid += inv.amountPaid
        if (inv.dueDate < today) {
          overdue += netValue
        } else {
          pending += netValue
        }
      } else {
        if (inv.dueDate < today || inv.status === 'overdue') {
          overdue += inv.amount
        } else {
          pending += inv.amount
        }
      }
    })

    return { paid, pending, overdue, totalOutstanding: pending + overdue }
  })

  return { items, load, add, update, remove, summary }
})
