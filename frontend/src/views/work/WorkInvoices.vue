<script setup>
import { computed, ref, watch, nextTick, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useWorkInvoicesStore } from '@/stores/workInvoices'
import { useWorkClientsStore } from '@/stores/workClients'
import { useUIStore } from '@/stores/ui'
import PageHeader from '@/components/PageHeader.vue'
import SectionHeader from '@/components/SectionHeader.vue'
import EmptyState from '@/components/EmptyState.vue'
import { Plus, Receipt, Calendar, Check, Trash, Eye, Edit3, Save, DollarSign, ExternalLink } from 'lucide-vue-next'
import dayjs from 'dayjs'

const invoicesStore = useWorkInvoicesStore()
const clientsStore = useWorkClientsStore()
const ui = useUIStore()

const showAddModal = ref(false)
const showPrintPreview = ref(false)
const previewInvoice = ref(null)
const isEditing = ref(false)
const editInvoiceId = ref(null)

const route = useRoute()
const router = useRouter()
const isExternal = ref(false)
const externalUrl = ref('')
const externalAmount = ref(0)

onMounted(() => {
  if (route.query.new === 'true') {
    openCreateModal()
    if (route.query.clientId) {
      clientId.value = route.query.clientId
    }
  }
})



const clientId = ref('')
const invoiceNumber = ref('')
const billingType = ref('fixed')
const taxRate = ref(18)
const currency = ref('USD') // Default USD
const items = ref([{ description: '', details: '', quantity: 1, rate: 0 }])
const dueDate = ref('')
const status = ref('pending')
const invoiceTitle = ref('Invoice')
const invoiceSubtitle = ref('')
const invoiceDate = ref(dayjs().format('YYYY-MM-DD'))

const currencySymbols = {
  USD: '$',
  GBP: '£',
  INR: '₹'
}

const isEditingInvoiceDoc = ref(false)

const senderName = ref(localStorage.getItem('atrium.sender.name') || 'Partha Sarathi Sahoo')
const senderAddress = ref(localStorage.getItem('atrium.sender.address') || 'Bangalore, Karnataka, India')
const senderEmail = ref(localStorage.getItem('atrium.sender.email') || 'iamparrth@gmail.com')
const senderPhone = ref(localStorage.getItem('atrium.sender.phone') || '+91 82494 86681')
const senderPAN = ref(localStorage.getItem('atrium.sender.pan') || 'ESEPS4917Q')

const isEditingSenderProfile = ref(false)
const isEditingClientProfile = ref(false)

const clientContactName = ref('')
const clientCompanyName = ref('')
const clientAddress = ref('')
const clientEmail = ref('')
const clientPhone = ref('')

const logoSrc = ref(localStorage.getItem('atrium.invoice.logo') || '')

const bankAccountName = ref(localStorage.getItem('atrium.bank.account_name') || 'Partha Sarathi Sahoo')
const bankAccountNumber = ref(localStorage.getItem('atrium.bank.account_number') || '913010056864708')
const bankIFSC = ref(localStorage.getItem('atrium.bank.ifsc') || 'UTIB0000669')
const bankSWIFT = ref(localStorage.getItem('atrium.bank.swift') || 'AXISINBB009')
const bankName = ref(localStorage.getItem('atrium.bank.name') || 'Axis Bank')
const bankMICR = ref(localStorage.getItem('atrium.bank.micr') || '144211502')

const isEditingBankDetails = ref(false)

function saveBankDetails() {
  localStorage.setItem('atrium.bank.account_name', bankAccountName.value)
  localStorage.setItem('atrium.bank.account_number', bankAccountNumber.value)
  localStorage.setItem('atrium.bank.ifsc', bankIFSC.value)
  localStorage.setItem('atrium.bank.swift', bankSWIFT.value)
  localStorage.setItem('atrium.bank.name', bankName.value)
  localStorage.setItem('atrium.bank.micr', bankMICR.value)
  isEditingBankDetails.value = false
  ui.showToast('Bank details saved', 'success')
}

const sigSrc = ref(localStorage.getItem('atrium.invoice.signature') || '')

function handleSigUpload(event) {
  const file = event.target.files[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = (e) => {
    sigSrc.value = e.target.result
    localStorage.setItem('atrium.invoice.signature', e.target.result)
  }
  reader.readAsDataURL(file)
}

function removeSig() {
  sigSrc.value = ''
  localStorage.removeItem('atrium.invoice.signature')
}

function getClientById(cId) {
  return clientsStore.items.find(x => x.id === cId) || {}
}

watch(clientId, (newId) => {
  const c = clientsStore.items.find(x => x.id === newId)
  if (c) {
    clientContactName.value = c.name || ''
    clientCompanyName.value = c.companyName || c.name || ''
    clientAddress.value = c.address || ''
    clientEmail.value = c.email || ''
    clientPhone.value = c.phone || ''
  } else {
    clientContactName.value = ''
    clientCompanyName.value = ''
    clientAddress.value = ''
    clientEmail.value = ''
    clientPhone.value = ''
  }
})

function handleLogoUpload(event) {
  const file = event.target.files[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = (e) => {
    logoSrc.value = e.target.result
    localStorage.setItem('atrium.invoice.logo', e.target.result)
  }
  reader.readAsDataURL(file)
}

function removeLogo() {
  logoSrc.value = ''
  localStorage.removeItem('atrium.invoice.logo')
}

function saveSenderProfile() {
  localStorage.setItem('atrium.sender.name', senderName.value)
  localStorage.setItem('atrium.sender.address', senderAddress.value)
  localStorage.setItem('atrium.sender.email', senderEmail.value)
  localStorage.setItem('atrium.sender.phone', senderPhone.value)
  localStorage.setItem('atrium.sender.pan', senderPAN.value)
  isEditingSenderProfile.value = false
  ui.showToast('Sender profile updated', 'success')
}

async function saveClientProfile() {
  if (!clientId.value) return
  await clientsStore.update(clientId.value, {
    name: clientContactName.value,
    companyName: clientCompanyName.value,
    address: clientAddress.value,
    email: clientEmail.value,
    phone: clientPhone.value
  })
  isEditingClientProfile.value = false
  ui.showToast('Client profile saved', 'success')
}

function autoGrowTextarea(event) {
  const el = event.target
  el.style.height = 'auto'
  el.style.height = `${el.scrollHeight}px`
}

function triggerAutoGrowAll() {
  nextTick(() => {
    const textareas = document.querySelectorAll('textarea')
    textareas.forEach(el => {
      el.style.height = 'auto'
      el.style.height = `${el.scrollHeight}px`
    })
  })
}

function openCreateModal() {
  isEditing.value = false
  clientId.value = ''
  // Generate invoice number format: INV-YYYY-NNN
  const year = new Date().getFullYear()
  const nextNum = String(invoicesStore.items.length + 1).padStart(3, '0')
  invoiceNumber.value = `INV-${year}-${nextNum}`
  
  billingType.value = 'fixed'
  taxRate.value = 18
  currency.value = 'USD'
  items.value = [{ description: '', details: '', quantity: 1, rate: 0 }]
  dueDate.value = dayjs().add(14, 'day').format('YYYY-MM-DD')
  status.value = 'pending'
  invoiceTitle.value = 'Invoice'
  invoiceSubtitle.value = ''
  invoiceDate.value = dayjs().format('YYYY-MM-DD')
  
  clientContactName.value = ''
  clientCompanyName.value = ''
  clientAddress.value = ''
  clientEmail.value = ''
  clientPhone.value = ''
  
  isExternal.value = false
  externalUrl.value = ''
  externalAmount.value = 0
  
  showAddModal.value = true
  triggerAutoGrowAll()
}

async function saveDocField(inv) {
  // Recalculate amounts
  const baseAmount = inv.items.reduce((acc, x) => acc + (Number(x.quantity) * Number(x.rate)), 0)
  const taxAmount = baseAmount * (Number(inv.taxRate) / 100)
  const totalAmount = baseAmount + taxAmount
  
  // Save to store
  await invoicesStore.update(inv.id, {
    invoiceNumber: inv.invoiceNumber,
    clientId: inv.clientId,
    dueDate: inv.dueDate,
    status: inv.status,
    taxRate: Number(inv.taxRate),
    currency: inv.currency,
    title: inv.title,
    subtitle: inv.subtitle,
    items: inv.items.map(x => ({
      description: x.description,
      details: x.details || '',
      quantity: Number(x.quantity),
      rate: Number(x.rate),
      amount: Number(x.quantity) * Number(x.rate)
    })),
    amount: totalAmount
  })
}

function addDocItemRow(inv) {
  inv.items.push({ description: 'New Item', details: '', quantity: 1, rate: 0, amount: 0 })
  saveDocField(inv)
}

function removeDocItemRow(inv, idx) {
  if (inv.items.length > 1) {
    inv.items.splice(idx, 1)
    saveDocField(inv)
  }
}

function getClientName(cId) {
  const c = clientsStore.items.find(x => x.id === cId)
  return c ? c.name : 'Standalone'
}

function addItemRow() {
  items.value.push({ description: '', details: '', quantity: 1, rate: 0 })
}

function removeItemRow(index) {
  if (items.value.length > 1) {
    items.value.splice(index, 1)
  }
}

async function draftInvoice() {
  if (!clientId.value) return
  
  if (isExternal.value) {
    await invoicesStore.add({
      clientId: clientId.value,
      invoiceNumber: invoiceNumber.value || undefined,
      currency: currency.value,
      title: invoiceTitle.value,
      createdAt: invoiceDate.value ? new Date(invoiceDate.value).getTime() : Date.now(),
      dueDate: dueDate.value,
      status: status.value,
      isExternal: true,
      externalUrl: externalUrl.value,
      amount: Number(externalAmount.value) || 0
    })
  } else {
    await invoicesStore.add({
      clientId: clientId.value,
      invoiceNumber: invoiceNumber.value || undefined,
      billingType: billingType.value,
      taxRate: taxRate.value,
      currency: currency.value,
      title: invoiceTitle.value,
      subtitle: invoiceSubtitle.value,
      createdAt: invoiceDate.value ? new Date(invoiceDate.value).getTime() : Date.now(),
      items: items.value.map(x => ({
        description: x.description,
        details: x.details || '',
        quantity: Number(x.quantity),
        rate: Number(x.rate),
        amount: Number(x.quantity * x.rate)
      })),
      dueDate: dueDate.value,
      status: status.value
    })
  }

  clientId.value = ''
  invoiceNumber.value = ''
  billingType.value = 'fixed'
  taxRate.value = 18
  currency.value = 'USD'
  items.value = [{ description: '', details: '', quantity: 1, rate: 0 }]
  dueDate.value = ''
  status.value = 'pending'
  invoiceTitle.value = 'Invoice'
  invoiceSubtitle.value = ''
  invoiceDate.value = dayjs().format('YYYY-MM-DD')
  isExternal.value = false
  externalUrl.value = ''
  externalAmount.value = 0
  showAddModal.value = false
  ui.showToast('Invoice created', 'success')
}

// Edit Mode
function loadInvoiceForEdit(inv) {
  editInvoiceId.value = inv.id
  clientId.value = inv.clientId
  invoiceNumber.value = inv.invoiceNumber
  billingType.value = inv.billingType || 'fixed'
  taxRate.value = inv.taxRate || 18
  currency.value = inv.currency || 'USD'
  items.value = (inv.items || []).map(x => ({
    description: x.description || '',
    details: x.details || '',
    quantity: x.quantity || 1,
    rate: x.rate || 0
  }))
  dueDate.value = inv.dueDate
  status.value = inv.status
  invoiceTitle.value = inv.title || 'Invoice'
  invoiceSubtitle.value = inv.subtitle || ''
  invoiceDate.value = inv.createdAt ? dayjs(inv.createdAt).format('YYYY-MM-DD') : dayjs().format('YYYY-MM-DD')
  
  isExternal.value = inv.isExternal || false
  externalUrl.value = inv.externalUrl || ''
  externalAmount.value = inv.amount || 0
  
  const c = clientsStore.items.find(x => x.id === inv.clientId)
  if (c) {
    clientContactName.value = c.name || ''
    clientCompanyName.value = c.companyName || c.name || ''
    clientAddress.value = c.address || ''
    clientEmail.value = c.email || ''
    clientPhone.value = c.phone || ''
  }
  
  isEditing.value = true
  showAddModal.value = true
  triggerAutoGrowAll()
}

async function saveInvoiceEdits() {
  if (!editInvoiceId.value) return
  
  if (isExternal.value) {
    await invoicesStore.update(editInvoiceId.value, {
      clientId: clientId.value,
      invoiceNumber: invoiceNumber.value,
      currency: currency.value,
      title: invoiceTitle.value,
      createdAt: invoiceDate.value ? new Date(invoiceDate.value).getTime() : Date.now(),
      dueDate: dueDate.value,
      status: status.value,
      isExternal: true,
      externalUrl: externalUrl.value,
      amount: Number(externalAmount.value) || 0
    })
  } else {
    const invItems = items.value.map(x => ({
      description: x.description,
      details: x.details || '',
      quantity: Number(x.quantity),
      rate: Number(x.rate),
      amount: Number(x.quantity * x.rate)
    }))

    const baseAmount = invItems.reduce((acc, x) => acc + x.amount, 0)
    const taxAmount = baseAmount * (taxRate.value / 100)
    const totalAmount = baseAmount + taxAmount

    await invoicesStore.update(editInvoiceId.value, {
      clientId: clientId.value,
      invoiceNumber: invoiceNumber.value,
      billingType: billingType.value,
      taxRate: taxRate.value,
      currency: currency.value,
      title: invoiceTitle.value,
      subtitle: invoiceSubtitle.value,
      createdAt: invoiceDate.value ? new Date(invoiceDate.value).getTime() : Date.now(),
      items: invItems,
      dueDate: dueDate.value,
      status: status.value,
      amount: totalAmount
    })
  }

  isEditing.value = false
  editInvoiceId.value = null
  showAddModal.value = false
  isExternal.value = false
  externalUrl.value = ''
  externalAmount.value = 0
  ui.showToast('Invoice details saved', 'success')
}

function updateInvoiceStatus(id, nextStatus) {
  const patch = { status: nextStatus }
  if (nextStatus === 'paid') {
    patch.paidAt = new Date().toISOString()
  } else {
    patch.paidAt = null
  }
  invoicesStore.update(id, patch)
  ui.showToast(`Invoice status updated to ${nextStatus}`, 'success')
}

function deleteInvoice(id) {
  ui.confirm('Are you sure you want to delete this invoice record?').then(approved => {
    if (approved) {
      invoicesStore.remove(id)
      ui.showToast('Invoice record removed', 'success')
    }
  })
}

function printInvoice(inv) {
  previewInvoice.value = inv
  clientId.value = inv.clientId
  const c = clientsStore.items.find(x => x.id === inv.clientId)
  if (c) {
    clientContactName.value = c.name || ''
    clientCompanyName.value = c.companyName || c.name || ''
    clientAddress.value = c.address || ''
    clientEmail.value = c.email || ''
    clientPhone.value = c.phone || ''
  }
  showPrintPreview.value = true
  triggerAutoGrowAll()
}

function triggerPrint() {
  window.print()
}

function formatMoney(amount, currencyCode = 'USD') {
  const symbol = currencySymbols[currencyCode] || '$'
  return `${symbol}${Math.round(amount).toLocaleString()}`
}

function getSenderInitials() {
  return "PS"
}

function getClientComm(cId) {
  const c = clientsStore.items.find(x => x.id === cId)
  return c ? c.preferredCommunication : 'Email'
}

function getClientTimezone(cId) {
  const c = clientsStore.items.find(x => x.id === cId)
  return c ? c.timezone : 'GMT'
}

function statusBadgeClass(s) {
  switch(s) {
    case 'paid':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900/50'
    case 'overdue':
      return 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/20 dark:text-rose-400 dark:border-rose-900/50'
    case 'partially_paid':
      return 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/20 dark:text-sky-400 dark:border-sky-900/50'
    default: // pending
      return 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/20 dark:text-amber-400 dark:border-amber-900/50'
  }
}

const summary = computed(() => {
  // Aggregate totals by currency
  let totalPaidUSD = 0
  let totalPendingUSD = 0
  let totalOverdueUSD = 0

  invoicesStore.items.forEach(inv => {
    const cur = inv.currency || 'USD'
    // Convert to default USD representation for basic dashboard counts, or just display in raw USD
    if (cur === 'USD') {
      if (inv.status === 'paid') totalPaidUSD += inv.amount
      else if (inv.dueDate < dayjs().format('YYYY-MM-DD')) totalOverdueUSD += inv.amount
      else totalPendingUSD += inv.amount
    }
  })

  return {
    paid: totalPaidUSD,
    pending: totalPendingUSD,
    overdue: totalOverdueUSD
  }
})

watch([() => invoicesStore.items, () => route.query.id], ([items, id]) => {
  if (id && items && items.length) {
    const inv = items.find(x => x.id === id)
    if (inv) {
      loadInvoiceForEdit(inv)
    }
  }
}, { immediate: true })

watch(showAddModal, (isOpen) => {
  if (!isOpen && route.query.id) {
    router.replace({ query: { ...route.query, id: undefined } })
  }
})
</script>

<template>
  <div class="px-8 md:px-12 py-10 max-w-5xl mx-auto space-y-8 animate-fade-in" data-testid="work-invoices">
    
    <!-- HEADER -->
    <PageHeader overline="Business" title="Invoices Ledger" sub="Generate editable bills, select multi-currency contract parameters, and print PDF logs.">
      <template #right>
        <button @click="openCreateModal()" class="btn-primary">
          <Plus class="w-4 h-4" /> Create Invoice
        </button>
      </template>
    </PageHeader>

    <!-- METRICS CARDS (USD Default Indicators) -->
    <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
      <div class="card p-5 border bg-surface/50">
        <div class="overline text-pri-strategic">Total Paid Accounts (USD)</div>
        <div class="font-serif text-2xl font-bold mt-1 text-pri-strategic">{{ formatMoney(summary.paid, 'USD') }}</div>
      </div>
      <div class="card p-5 border bg-surface/50">
        <div class="overline text-pri-interruptive">Total Pending Accounts (USD)</div>
        <div class="font-serif text-2xl font-bold mt-1 text-pri-interruptive">{{ formatMoney(summary.pending, 'USD') }}</div>
      </div>
      <div class="card p-5 border bg-surface/50">
        <div class="overline text-pri-critical">Total Overdue Receivables (USD)</div>
        <div class="font-serif text-2xl font-bold mt-1 text-pri-critical">{{ formatMoney(summary.overdue, 'USD') }}</div>
      </div>
    </div>

    <!-- LEDGER TABLE -->
    <section>
      <div v-if="invoicesStore.items.length" class="card overflow-hidden border bg-surface">
        <table class="w-full text-left border-collapse text-xs">
          <thead>
            <tr class="bg-canvas border-b border-line text-ink-3 uppercase tracking-wider text-[10px] font-semibold">
              <th class="p-4">Invoice #</th>
              <th class="p-4">Client</th>
              <th class="p-4">Status</th>
              <th class="p-4">Due Date</th>
              <th class="p-4 text-right">Amount</th>
              <th class="p-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="inv in invoicesStore.items" :key="inv.id" 
              class="border-b border-line last:border-0 hover:bg-canvas/30 transition-colors">
              <td class="p-4 font-mono font-semibold text-ink">
                <template v-if="inv.isExternal && inv.externalUrl">
                  <a :href="inv.externalUrl" target="_blank" class="text-pri-strategic hover:underline inline-flex items-center gap-1">
                    ext_{{ inv.invoiceNumber }} <ExternalLink class="w-3 h-3" />
                  </a>
                </template>
                <template v-else>
                  {{ inv.invoiceNumber }}
                </template>
              </td>
              <td class="p-4 text-ink-2">{{ getClientName(inv.clientId) }}</td>
              <td class="p-4">
                <span class="px-2.5 py-0.5 rounded text-[9px] uppercase font-bold border"
                  :class="inv.status === 'paid' ? 'bg-pri-strategic-bg border-pri-strategic-bd text-pri-strategic' : inv.status === 'overdue' ? 'bg-pri-critical-bg border-pri-critical-bd text-pri-critical' : 'bg-pri-interruptive-bg border-pri-interruptive-bd text-pri-interruptive'">
                  {{ inv.status }}
                </span>
              </td>
              <td class="p-4 text-ink-2">{{ dayjs(inv.dueDate).format('MMM D, YYYY') }}</td>
              <td class="p-4 text-right text-ink font-semibold">{{ formatMoney(inv.amount, inv.currency) }}</td>
              <td class="p-4 text-right">
                <div class="flex items-center justify-end gap-2">
                  <!-- Status dropdown -->
                  <select :value="inv.status" @change="updateInvoiceStatus(inv.id, $event.target.value)" 
                    class="bg-canvas border rounded p-1 text-[10px] text-ink-2 focus:outline-none">
                    <option value="pending">Pending</option>
                    <option value="paid">Paid</option>
                    <option value="overdue">Overdue</option>
                    <option value="partially_paid">Partially Paid</option>
                  </select>
                  
                  <button @click="loadInvoiceForEdit(inv)" class="text-ink-3 hover:text-ink p-1 rounded" title="Edit Invoice Details">
                    <Edit3 class="w-3.5 h-3.5" />
                  </button>
                  <a v-if="inv.isExternal && inv.externalUrl" :href="inv.externalUrl" target="_blank" class="text-pri-strategic hover:opacity-80 p-1 rounded inline-flex items-center justify-center" title="Open External Invoice Link">
                    <ExternalLink class="w-3.5 h-3.5" />
                  </a>
                  <button v-else-if="!inv.isExternal" @click="printInvoice(inv)" class="text-ink-3 hover:text-ink p-1 rounded" title="View Print Layout">
                    <Eye class="w-3.5 h-3.5" />
                  </button>
                  <button @click="deleteInvoice(inv.id)" class="text-ink-3 hover:text-pri-critical p-1 rounded" title="Delete Invoice">
                    <Trash class="w-3.5 h-3.5" />
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <EmptyState v-else title="Invoice ledger clear" hint="Add your first client invoice using the billing composer." />
    </section>

    <!-- CREATE / EDIT INVOICE DIALOG -->
    <div v-if="showAddModal" @keydown.window.esc="showAddModal = false" class="fixed inset-0 z-40 flex items-start justify-center pt-10 px-4 overflow-y-auto pb-12">
      <div class="fixed inset-0 bg-ink/40 backdrop-blur-sm" @click="showAddModal = false"></div>
      <div class="relative w-full max-w-4xl bg-[#f4f8f4] text-ink card p-10 shadow-2xl z-50 animate-rise-in space-y-8 my-auto max-h-[95vh] overflow-y-auto border-emerald-100/50">
        <!-- Watermark Background -->
        <div class="absolute inset-0 pointer-events-none flex items-center justify-center overflow-hidden opacity-[0.03] select-none">
          <svg viewBox="0 0 100 100" class="w-[500px] h-[500px] text-[#1b8a4a] fill-current">
            <path d="M50 5 C50 35 65 50 95 50 C65 50 50 65 50 95 C50 65 35 50 5 50 C35 50 50 35 50 5 Z" />
          </svg>
        </div>

        <!-- Top Colored Accent Bar -->
        <div class="h-2 w-full bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 absolute top-0 left-0 rounded-t-2xl"></div>
        
        <!-- Document Title / Subtitle Edit -->
        <div class="text-center space-y-1.5 pt-4 relative z-10">
          <input v-model="invoiceTitle" placeholder="Invoice Title (e.g. Project Phase)" class="font-serif text-2xl font-bold text-center w-full focus:outline-none border-b border-transparent hover:border-emerald-300 focus:border-emerald-500 pb-1 text-ink bg-transparent" />
          <input v-model="invoiceSubtitle" placeholder="+ Add Subtitle" class="text-xs text-ink-3 text-center w-full focus:outline-none border-b border-transparent hover:border-emerald-300 focus:border-emerald-500 pb-0.5 bg-transparent" />
        </div>

        <!-- Invoice Type Toggle -->
        <div class="flex justify-center items-center gap-6 bg-white/70 border border-emerald-100/50 backdrop-blur-sm px-5 py-3 rounded-2xl text-xs font-sans relative z-10 shadow-sm max-w-md mx-auto">
          <span class="text-ink-2 font-semibold">Invoice Type:</span>
          <div class="flex items-center gap-4">
            <label class="inline-flex items-center gap-1.5 cursor-pointer">
              <input type="radio" :value="false" v-model="isExternal" class="text-[#1b8a4a] focus:ring-emerald-500" />
              <span class="font-medium text-ink">Standard Invoice</span>
            </label>
            <label class="inline-flex items-center gap-1.5 cursor-pointer">
              <input type="radio" :value="true" v-model="isExternal" class="text-[#1b8a4a] focus:ring-emerald-500" />
              <span class="font-medium text-ink">External URL Invoice</span>
            </label>
          </div>
        </div>

        <!-- Top Metadata & Logo Section -->
        <div class="flex justify-between items-start gap-8 flex-wrap relative z-10">
          <!-- Left side: dates & invoice # -->
          <div class="space-y-3 flex-1 min-w-[280px]">
            <div class="flex items-center gap-3">
              <span class="text-xs font-semibold text-ink-2 w-28">Invoice No:</span>
              <input v-model="invoiceNumber" placeholder="e.g. 00037" class="font-mono text-sm px-2.5 py-1.5 bg-white border border-emerald-100 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 w-40 text-ink shadow-sm" />
            </div>
            <div class="flex items-center gap-3">
              <span class="text-xs font-semibold text-ink-2 w-28">Invoice Date:</span>
              <input type="date" v-model="invoiceDate" class="text-sm px-2.5 py-1.5 bg-white border border-emerald-100 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 w-40 text-ink shadow-sm" />
            </div>
            <div class="flex items-center gap-3">
              <span class="text-xs font-semibold text-ink-2 w-28">Due Date:</span>
              <input type="date" v-model="dueDate" class="text-sm px-2.5 py-1.5 bg-white border border-emerald-100 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 w-40 text-ink shadow-sm" />
            </div>
          </div>
          
          <!-- Right side: Logo block -->
          <div v-if="!isExternal" class="relative group border-2 border-dashed border-emerald-200 hover:border-emerald-400 bg-white/70 rounded-2xl flex flex-col items-center justify-center p-4 w-36 h-36 shrink-0 select-none text-center shadow-sm">
            <img v-if="logoSrc" :src="logoSrc" class="max-w-full max-h-20 object-contain rounded-lg" />
            <div v-else class="flex flex-col items-center justify-center">
              <svg viewBox="0 0 100 100" class="w-14 h-14 text-[#1b8a4a] fill-current mb-1">
                <path d="M50 5 C50 35 65 50 95 50 C65 50 50 65 50 95 C50 65 35 50 5 50 C35 50 50 35 50 5 Z" />
              </svg>
            </div>
            <div class="flex gap-2.5 mt-2 text-[10px] font-bold">
              <label class="text-[#1b8a4a] hover:text-emerald-800 cursor-pointer flex items-center gap-0.5">
                <Edit3 class="w-2.5 h-2.5" /> Change
                <input type="file" accept="image/*" class="hidden" @change="handleLogoUpload" />
              </label>
              <button v-if="logoSrc" @click="removeLogo" class="text-rose-600 hover:text-rose-800 flex items-center gap-0.5">
                <Trash class="w-2.5 h-2.5" /> Remove
              </button>
            </div>
          </div>
        </div>

        <!-- Billed By / Billed To Section -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-8 relative z-10">
          <!-- Billed By -->
          <div v-if="!isExternal" class="bg-white/80 border border-emerald-100/50 backdrop-blur-sm rounded-2xl p-5 shadow-sm space-y-3">
            <div v-if="isEditingSenderProfile" class="space-y-2">
              <span class="text-[9px] uppercase tracking-wider text-[#1b8a4a] font-bold block">Edit Your Details</span>
              <input v-model="senderName" class="w-full text-xs font-bold bg-canvas border border-line rounded px-2.5 py-1.5 focus:outline-none focus:border-emerald-500" placeholder="Your Name" />
              <input v-model="senderAddress" class="w-full text-[11px] bg-canvas border border-line rounded px-2.5 py-1.5 focus:outline-none focus:border-emerald-500" placeholder="Address" />
              <input v-model="senderEmail" class="w-full text-[11px] bg-canvas border border-line rounded px-2.5 py-1.5 focus:outline-none focus:border-emerald-500" placeholder="Email" />
              <input v-model="senderPhone" class="w-full text-[11px] bg-canvas border border-line rounded px-2.5 py-1.5 focus:outline-none focus:border-emerald-500" placeholder="Phone" />
              <input v-model="senderPAN" class="w-full text-[11px] bg-canvas border border-line rounded px-2.5 py-1.5 focus:outline-none focus:border-emerald-500" placeholder="PAN/GSTIN" />
              <div class="flex gap-2 justify-end mt-1">
                <button @click="isEditingSenderProfile = false" class="text-[10px] px-2.5 py-1 bg-zinc-200 rounded-lg text-zinc-700 font-medium hover:bg-zinc-300">Cancel</button>
                <button @click="saveSenderProfile" class="text-[10px] px-2.5 py-1 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700">Save</button>
              </div>
            </div>
            <div v-else class="space-y-1.5">
              <div class="flex items-center justify-between">
                <span class="text-[9px] uppercase tracking-wider text-[#1b8a4a] font-bold">Billed By (Your Details)</span>
                <button @click="isEditingSenderProfile = true" class="text-[#1b8a4a] hover:text-emerald-800 text-[10px] flex items-center gap-0.5 font-semibold font-sans">
                  <Edit3 class="w-2.5 h-2.5" /> Edit
                </button>
              </div>
              <div class="text-xs font-bold text-ink">{{ senderName }}</div>
              <div class="text-[11px] text-ink-2 space-y-0.5 font-sans leading-relaxed">
                <p>{{ senderAddress }}</p>
                <p>{{ senderEmail }}</p>
                <p>{{ senderPhone }}</p>
                <p class="text-[9px] text-ink-3">PAN/GSTIN: {{ senderPAN }}</p>
              </div>
            </div>
          </div>
          
          <!-- Billed To -->
          <div class="bg-white/80 border border-emerald-100/50 backdrop-blur-sm rounded-2xl p-5 shadow-sm space-y-3" :class="isExternal ? 'md:col-span-2' : ''">
            <span class="text-[9px] uppercase tracking-wider text-[#1b8a4a] font-bold block">Billed To (Client's Details)</span>
            <select v-model="clientId" class="w-full text-xs font-semibold bg-white border border-emerald-100 rounded-xl px-2.5 py-1.5 focus:outline-none focus:border-emerald-500 mb-2">
              <option value="">Select Client Workspace...</option>
              <option v-for="c in clientsStore.items" :key="c.id" :value="c.id">{{ c.name }}</option>
            </select>
            
            <div v-if="clientId && !isExternal">
              <div v-if="isEditingClientProfile" class="space-y-2 mt-2">
                <input v-model="clientCompanyName" class="w-full text-xs font-bold bg-canvas border border-line rounded px-2.5 py-1.5 focus:outline-none focus:border-emerald-500" placeholder="Company Name" />
                <input v-model="clientContactName" class="w-full text-[11px] bg-canvas border border-line rounded px-2.5 py-1.5 focus:outline-none focus:border-emerald-500" placeholder="Contact Name" />
                <input v-model="clientAddress" class="w-full text-[11px] bg-canvas border border-line rounded px-2.5 py-1.5 focus:outline-none focus:border-emerald-500" placeholder="Address" />
                <input v-model="clientEmail" class="w-full text-[11px] bg-canvas border border-line rounded px-2.5 py-1.5 focus:outline-none focus:border-emerald-500" placeholder="Email" />
                <input v-model="clientPhone" class="w-full text-[11px] bg-canvas border border-line rounded px-2.5 py-1.5 focus:outline-none focus:border-emerald-500" placeholder="Phone" />
                <div class="flex gap-2 justify-end mt-1">
                  <button @click="isEditingClientProfile = false" class="text-[10px] px-2.5 py-1 bg-zinc-200 rounded-lg text-zinc-700 font-medium hover:bg-zinc-300">Cancel</button>
                  <button @click="saveClientProfile" class="text-[10px] px-2.5 py-1 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700">Save</button>
                </div>
              </div>
              <div v-else class="space-y-1.5">
                <div class="flex items-center justify-between">
                  <span class="text-xs font-bold text-ink">{{ clientCompanyName || clientContactName }}</span>
                  <button @click="isEditingClientProfile = true" class="text-[#1b8a4a] hover:text-emerald-800 text-[10px] flex items-center gap-0.5 font-semibold font-sans">
                    <Edit3 class="w-2.5 h-2.5" /> Edit
                  </button>
                </div>
                <div v-if="clientCompanyName && clientContactName" class="text-[10px] text-ink-3 font-sans">Attn: {{ clientContactName }}</div>
                <div class="text-[11px] text-ink-2 space-y-0.5 font-sans leading-relaxed">
                  <p>{{ clientAddress }}</p>
                  <p>{{ clientEmail }}</p>
                  <p>{{ clientPhone }}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Mid Bar: Currency & Tax Setup -->
        <div class="flex items-center gap-6 bg-white/70 border border-emerald-100/50 backdrop-blur-sm px-4 py-3 rounded-2xl text-xs font-sans relative z-10 shadow-sm">
          <div class="flex items-center gap-2">
            <span class="text-ink-2 font-semibold">Currency:</span>
            <select v-model="currency" class="bg-white border border-emerald-100 rounded-lg px-2.5 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500">
              <option value="USD">USD ($)</option>
              <option value="GBP">GBP (£)</option>
              <option value="INR">INR (₹)</option>
            </select>
          </div>
          <div v-if="!isExternal" class="flex items-center gap-2">
            <span class="text-ink-2 font-semibold">Tax Rate (%):</span>
            <input type="number" v-model="taxRate" class="w-16 bg-white border border-emerald-100 rounded-lg px-2 py-1 text-xs text-center focus:outline-none focus:ring-1 focus:ring-emerald-500 font-mono" />
          </div>
        </div>

        <!-- External Invoice Fields -->
        <div v-if="isExternal" class="grid grid-cols-1 md:grid-cols-2 gap-6 bg-white/80 border border-emerald-100/50 backdrop-blur-sm p-6 rounded-2xl relative z-10 shadow-sm">
          <div>
            <label class="block text-xs font-semibold text-ink-2 mb-1.5">External Invoice URL</label>
            <input v-model="externalUrl" placeholder="https://..." class="w-full bg-white border border-emerald-100 rounded-lg px-3 py-2 text-xs text-ink focus:outline-none focus:ring-1 focus:ring-emerald-500 font-mono" />
          </div>
          <div>
            <label class="block text-xs font-semibold text-ink-2 mb-1.5">Invoice Amount</label>
            <div class="flex items-center bg-white border border-emerald-100 rounded-lg px-3 py-1 focus-within:ring-1 focus-within:ring-emerald-500">
              <span class="text-ink-3 mr-1.5 font-mono">{{ currencySymbols[currency] || '$' }}</span>
              <input type="number" v-model.number="externalAmount" class="w-full bg-transparent focus:outline-none font-mono text-ink font-semibold py-1 text-xs" />
            </div>
          </div>
        </div>

        <!-- Table and Line Items -->
        <div v-if="!isExternal" class="space-y-4 relative z-10">
          <!-- Purple Table Header Bar -->
          <div class="bg-[#8b5cf6] text-white py-2.5 px-4 rounded-xl flex justify-between font-bold text-[10px] uppercase tracking-wider shadow-sm">
            <span>Item Description</span>
            <span>Rate</span>
          </div>

          <!-- Items Rows -->
          <div class="space-y-4">
            <div v-for="(item, idx) in items" :key="idx" class="border border-emerald-100/50 rounded-2xl p-4 bg-white/80 backdrop-blur-sm space-y-3 relative hover:border-emerald-300 transition-colors shadow-sm font-sans">
              <button @click="removeItemRow(idx)" class="absolute top-3 right-3 text-ink-3 hover:text-pri-critical shrink-0 p-1 rounded-lg" title="Remove Item">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
              </button>
              
              <div class="flex items-start gap-3 w-full">
                <!-- Line number -->
                <span class="text-xs font-bold text-[#1b8a4a] mt-1.5 font-mono shrink-0">{{ idx + 1 }}.</span>
                
                <div class="flex-1 space-y-3 min-w-0 pr-8">
                  <!-- Item title -->
                  <input v-model="item.description" placeholder="Item Name (e.g. Miscellaneous)" class="w-full border-b border-emerald-100 hover:border-emerald-300 focus:border-emerald-500 py-0.5 font-semibold text-sm focus:outline-none text-ink bg-transparent" />
                  <!-- Item details multi-line -->
                  <textarea v-model="item.details" rows="2" @input="autoGrowTextarea" placeholder="Detail description (e.g. 28 March - Adjusting the matching logic...)" class="w-full text-xs text-ink-2 bg-canvas/30 border border-emerald-100/50 rounded-lg p-2 focus:outline-none focus:border-emerald-500 placeholder:text-ink-3"></textarea>
                </div>
              </div>

              <!-- Qty and Rate alignment -->
              <div class="flex flex-wrap items-center gap-6 pl-7 pt-2 border-t border-dashed border-emerald-100/30 text-xs text-ink-2">
                <div class="flex items-center gap-2">
                  <span class="text-ink-3">Quantity</span>
                  <input type="number" v-model="item.quantity" class="w-16 px-2.5 py-1 text-center bg-white border border-emerald-100 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 font-mono text-ink font-medium shadow-sm" />
                </div>
                <div class="flex items-center gap-2">
                  <span class="text-ink-3">Unit Rate</span>
                  <div class="flex items-center bg-white border border-emerald-100 rounded-lg px-2.5 py-1 focus-within:ring-1 focus-within:ring-emerald-500 shadow-sm">
                    <span class="text-ink-3 mr-1 font-mono">{{ currencySymbols[currency] || '$' }}</span>
                    <input type="number" v-model="item.rate" class="w-24 text-right bg-transparent focus:outline-none font-mono text-ink font-semibold" />
                  </div>
                </div>
                <div class="ml-auto flex items-center gap-2 text-ink font-semibold">
                  <span class="text-ink-3 text-[10px] uppercase tracking-wider font-bold">Line Total</span>
                  <span class="font-mono text-sm text-[#1b8a4a]">{{ formatMoney(item.quantity * item.rate, currency) }}</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Add Line Item button -->
          <button @click="addItemRow" class="w-full py-3 border border-dashed border-emerald-200 hover:border-emerald-500 rounded-2xl text-xs font-bold text-[#1b8a4a] hover:bg-white/60 transition-all flex items-center justify-center gap-1.5 shadow-sm">
            <Plus class="w-4 h-4" /> Add Line Item
          </button>
        </div>

        <!-- Totals Card and Details -->
        <div v-if="!isExternal" class="flex justify-end pt-2 relative z-10">
          <div class="w-72 bg-white/80 border border-emerald-100/50 backdrop-blur-sm p-5 rounded-2xl space-y-3 shadow-sm font-sans">
            <div class="flex justify-between text-xs text-ink-2">
              <span class="text-ink-3">Subtotal</span>
              <span class="font-mono font-medium">{{ formatMoney(items.reduce((sum, x) => sum + (x.quantity * x.rate), 0), currency) }}</span>
            </div>
            <div v-if="taxRate > 0" class="flex justify-between text-xs text-ink-2">
              <span class="text-ink-3">Tax ({{ taxRate }}%)</span>
              <span class="font-mono font-medium">{{ formatMoney(items.reduce((sum, x) => sum + (x.quantity * x.rate), 0) * (taxRate / 100), currency) }}</span>
            </div>
            <div class="flex justify-between items-center pt-3 border-t border-emerald-100/20 text-sm font-bold bg-[#8b5cf6] text-white -mx-5 -mb-5 p-4 rounded-b-2xl shadow-sm">
              <span class="uppercase tracking-wider text-[10px] font-black">Total ({{ currency }})</span>
              <span class="font-mono text-lg font-black">{{ formatMoney(items.reduce((sum, x) => sum + (x.quantity * x.rate), 0) * (1 + taxRate / 100), currency) }}</span>
            </div>
          </div>
        </div>

        <!-- Dialog Action Buttons -->
        <div class="flex justify-end gap-3 border-t border-emerald-100/30 pt-4 relative z-10">
          <button @click="showAddModal = false" class="btn-secondary">Cancel</button>
          <button @click="isEditing ? saveInvoiceEdits() : draftInvoice()" class="btn-primary">
            {{ isEditing ? 'Save Changes' : 'Save Invoice' }}
          </button>
        </div>
      </div>
    </div>

    <!-- INVOICE PRINT PREVIEW MOCK (PREMIUM OBSIDIAN/ARC STYLE) -->
    <div v-if="showPrintPreview" @keydown.window.esc="showPrintPreview = false; isEditingInvoiceDoc = false" class="fixed inset-0 z-40 flex items-start justify-center pt-16 px-4 overflow-y-auto pb-12">
      <div class="fixed inset-0 bg-ink/40 backdrop-blur-sm" @click="showPrintPreview = false; isEditingInvoiceDoc = false"></div>
      <div class="relative w-full max-w-3xl bg-[#f4f8f4] text-ink card p-10 shadow-2xl z-50 animate-rise-in space-y-8 my-auto max-h-[90vh] overflow-y-auto print:p-0 print:shadow-none print:bg-transparent print:border-0 border-emerald-100/50">
        <!-- Watermark Background -->
        <div class="absolute inset-0 pointer-events-none flex items-center justify-center overflow-hidden opacity-[0.03] select-none">
          <svg viewBox="0 0 100 100" class="w-[500px] h-[500px] text-[#1b8a4a] fill-current">
            <path d="M50 5 C50 35 65 50 95 50 C65 50 50 65 50 95 C50 65 35 50 5 50 C35 50 50 35 50 5 Z" />
          </svg>
        </div>

        <!-- Top Colored Accent Bar -->
        <div class="h-2 w-full bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 absolute top-0 left-0 rounded-t-2xl print:hidden"></div>
        <!-- Print Header Actions -->
        <div class="flex justify-between items-center border-b border-emerald-100/30 pb-4 print:hidden relative z-10">
          <div class="overline text-emerald-800">Premium Billing View</div>
          <div class="flex gap-2">
            <button @click="isEditingInvoiceDoc = !isEditingInvoiceDoc" class="btn-secondary !py-1 px-3 text-xs flex items-center gap-1">
              <Edit3 class="w-3.5 h-3.5" />
              {{ isEditingInvoiceDoc ? 'Finish Editing' : 'Edit Invoice Doc' }}
            </button>
            <button @click="triggerPrint" class="btn-primary !py-1 px-3 text-xs" :disabled="isEditingInvoiceDoc">Print / PDF Export</button>
            <button @click="showPrintPreview = false; isEditingInvoiceDoc = false" class="btn-ghost !py-1 px-3 text-xs">Close</button>
          </div>
        </div>

        <!-- Printable Bill Layout -->
        <div v-if="previewInvoice" class="space-y-8 text-ink text-sm font-sans pt-4 relative z-10">
          <!-- Top Row: Logo & Invoice details -->
          <div class="flex justify-between items-start">
            <div class="flex items-center gap-3">
              <div class="relative group w-16 h-16 border border-emerald-100 rounded-xl flex items-center justify-center p-1 bg-white shadow-sm select-none">
                <img v-if="logoSrc" :src="logoSrc" class="max-w-full max-h-full object-contain rounded-lg" />
                <svg v-else viewBox="0 0 100 100" class="w-10 h-10 text-[#1b8a4a] fill-current">
                  <path d="M50 5 C50 35 65 50 95 50 C65 50 50 65 50 95 C50 65 35 50 5 50 C35 50 50 35 50 5 Z" />
                </svg>
                <label v-if="isEditingInvoiceDoc" class="absolute -bottom-2 -right-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-full p-1 shadow-md cursor-pointer print:hidden">
                  <Edit3 class="w-3 h-3" />
                  <input type="file" accept="image/*" class="hidden" @change="handleLogoUpload" />
                </label>
              </div>
              <div>
                <div class="font-serif text-xl font-extrabold tracking-tight text-ink">{{ senderName }}</div>
                <p class="text-[10px] text-ink-2 font-bold uppercase tracking-wider">Freelance Engineering</p>
              </div>
            </div>
            
            <div class="text-right space-y-1">
              <h1 class="text-3xl font-extrabold tracking-wider text-[#1b8a4a] uppercase">INVOICE</h1>
              <div class="flex items-center justify-end gap-1.5 font-mono text-xs text-ink-2">
                <div v-if="isEditingInvoiceDoc" class="flex items-center gap-1">
                  <input v-model="previewInvoice.invoiceNumber" @change="saveDocField(previewInvoice)" class="text-right font-mono font-semibold text-xs bg-white border border-emerald-100 rounded px-1.5 py-0.5 focus:outline-none w-28" />
                  <select v-model="previewInvoice.currency" @change="saveDocField(previewInvoice)" class="text-right text-[10px] bg-white border border-emerald-100 rounded px-1.5 py-0.5 focus:outline-none font-semibold">
                    <option value="USD">USD ($)</option>
                    <option value="GBP">GBP (£)</option>
                    <option value="INR">INR (₹)</option>
                  </select>
                </div>
                <template v-else>
                  <span class="font-bold text-ink">#{{ previewInvoice.invoiceNumber }}</span>
                  <span :class="statusBadgeClass(previewInvoice.status)" class="px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase tracking-wider border">
                    {{ previewInvoice.status }}
                  </span>
                </template>
              </div>
            </div>
          </div>

          <!-- Billed By / Billed To Section -->
          <div class="grid grid-cols-1 md:grid-cols-2 gap-8 p-5 bg-white/80 border border-emerald-100/50 backdrop-blur-sm rounded-2xl shadow-sm">
            <!-- Billed By -->
            <div class="space-y-1.5">
              <div class="flex items-center justify-between">
                <span class="text-[9px] uppercase tracking-wider text-[#1b8a4a] font-bold">Billed By</span>
                <button v-if="isEditingInvoiceDoc && !isEditingSenderProfile" @click="isEditingSenderProfile = true" class="text-[#1b8a4a] hover:text-emerald-800 text-[10px] flex items-center gap-0.5 font-semibold print:hidden">
                  <Edit3 class="w-2.5 h-2.5" /> Edit
                </button>
              </div>
              <div v-if="isEditingSenderProfile" class="space-y-2 mt-2 print:hidden text-left">
                <input v-model="senderName" class="w-full text-xs font-bold bg-canvas border border-line rounded px-2 py-1" />
                <input v-model="senderAddress" class="w-full text-[11px] bg-canvas border border-line rounded px-2 py-1" />
                <input v-model="senderEmail" class="w-full text-[11px] bg-canvas border border-line rounded px-2 py-1" />
                <input v-model="senderPhone" class="w-full text-[11px] bg-canvas border border-line rounded px-2 py-1" />
                <input v-model="senderPAN" class="w-full text-[11px] bg-canvas border border-line rounded px-2 py-1" />
                <button @click="saveSenderProfile" class="text-[9px] bg-emerald-600 text-white rounded px-2 py-1 flex ml-auto">Save</button>
              </div>
              <div v-else>
                <div class="text-xs font-bold text-ink">{{ senderName }}</div>
                <div class="text-[11px] text-ink-2 space-y-0.5 font-sans leading-relaxed">
                  <p>{{ senderAddress }}</p>
                  <p>{{ senderEmail }}</p>
                  <p>{{ senderPhone }}</p>
                  <p class="text-[9px] text-ink-3">PAN/GSTIN: {{ senderPAN }}</p>
                </div>
              </div>
            </div>
            
            <!-- Billed To -->
            <div class="space-y-1.5 text-right md:text-left">
              <div class="flex items-center justify-between">
                <span class="text-[9px] uppercase tracking-wider text-[#1b8a4a] font-bold">Billed To</span>
                <div class="flex gap-2">
                  <select v-if="isEditingInvoiceDoc" v-model="previewInvoice.clientId" @change="saveDocField(previewInvoice)" class="text-[10px] font-semibold bg-white border border-emerald-100 rounded px-1.5 py-0.5 focus:outline-none print:hidden">
                    <option v-for="c in clientsStore.items" :key="c.id" :value="c.id">{{ c.name }}</option>
                  </select>
                  <button v-if="isEditingInvoiceDoc && !isEditingClientProfile && previewInvoice.clientId" @click="isEditingClientProfile = true" class="text-[#1b8a4a] hover:text-emerald-800 text-[10px] flex items-center gap-0.5 font-semibold print:hidden">
                    <Edit3 class="w-2.5 h-2.5" /> Edit
                  </button>
                </div>
              </div>
              <div v-if="isEditingClientProfile && isEditingInvoiceDoc" class="space-y-2 mt-2 text-left print:hidden">
                <input v-model="clientCompanyName" class="w-full text-xs font-bold bg-canvas border border-line rounded px-2 py-1" />
                <input v-model="clientContactName" class="w-full text-[11px] bg-canvas border border-line rounded px-2 py-1" />
                <input v-model="clientAddress" class="w-full text-[11px] bg-canvas border border-line rounded px-2 py-1" />
                <input v-model="clientEmail" class="w-full text-[11px] bg-canvas border border-line rounded px-2 py-1" />
                <input v-model="clientPhone" class="w-full text-[11px] bg-canvas border border-line rounded px-2 py-1" />
                <button @click="saveClientProfile" class="text-[9px] bg-emerald-600 text-white rounded px-2 py-1 flex ml-auto">Save</button>
              </div>
              <div v-else>
                <div class="text-xs font-bold text-ink">
                  {{ getClientById(previewInvoice.clientId).companyName || getClientById(previewInvoice.clientId).name || 'Standalone' }}
                </div>
                <div v-if="getClientById(previewInvoice.clientId).companyName && getClientById(previewInvoice.clientId).name" class="text-[10px] text-ink-3">
                  Attn: {{ getClientById(previewInvoice.clientId).name }}
                </div>
                <div class="text-[11px] text-ink-2 space-y-0.5 leading-relaxed font-sans">
                  <p>{{ getClientById(previewInvoice.clientId).address }}</p>
                  <p>{{ getClientById(previewInvoice.clientId).email }}</p>
                  <p>{{ getClientById(previewInvoice.clientId).phone }}</p>
                </div>
              </div>
            </div>
          </div>

          <!-- Schedule Dates Bar -->
          <div class="grid grid-cols-3 gap-4 border-t border-b border-emerald-100/30 py-4 text-[11px] font-sans">
            <div>
              <span class="text-[9px] uppercase tracking-wider text-ink-3 block mb-0.5">Invoice Date</span>
              <span class="font-semibold text-ink">{{ dayjs(previewInvoice.createdAt).format('MMMM D, YYYY') }}</span>
            </div>
            <div>
              <span class="text-[9px] uppercase tracking-wider text-ink-3 block mb-0.5">Due Date</span>
              <div v-if="isEditingInvoiceDoc">
                <input type="date" v-model="previewInvoice.dueDate" @change="saveDocField(previewInvoice)" class="bg-white border border-emerald-100 rounded px-1.5 py-0.5 focus:outline-none font-mono text-[10px]" />
              </div>
              <span v-else class="font-semibold text-ink">{{ dayjs(previewInvoice.dueDate).format('MMMM D, YYYY') }}</span>
            </div>
            <div class="text-right">
              <span class="text-[9px] uppercase tracking-wider text-ink-3 block mb-0.5">Due Schedule Status</span>
              <div v-if="isEditingInvoiceDoc">
                <select v-model="previewInvoice.status" @change="saveDocField(previewInvoice)" class="bg-white border border-emerald-100 rounded px-1.5 py-0.5 text-[10px] focus:outline-none">
                  <option value="pending">Pending</option>
                  <option value="paid">Paid</option>
                  <option value="overdue">Overdue</option>
                  <option value="partially_paid">Partially Paid</option>
                </select>
              </div>
              <span v-else class="font-bold text-emerald-700 uppercase tracking-wide text-xs">{{ previewInvoice.status }}</span>
            </div>
          </div>

          <!-- Items Table -->
          <table class="w-full text-left border-collapse text-xs bg-white/80 backdrop-blur-sm rounded-2xl overflow-hidden border border-emerald-100/50 shadow-sm">
            <thead>
              <tr class="bg-[#8b5cf6] text-white uppercase tracking-wider text-[10px] font-bold print:bg-[#8b5cf6] print:text-white">
                <th class="p-4 rounded-tl-2xl">Item</th>
                <th class="p-4 text-right w-32 rounded-tr-2xl">Rate</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-emerald-100/30">
              <tr v-for="(item, idx) in previewInvoice.items" :key="idx" class="hover:bg-emerald-50/10 transition-colors">
                <td class="p-4 font-medium text-ink">
                  <div v-if="isEditingInvoiceDoc" class="space-y-1.5 text-left">
                    <input v-model="item.description" @change="saveDocField(previewInvoice)" class="w-full bg-canvas border border-line rounded-lg px-3 py-1.5 text-xs font-semibold focus:outline-none focus:border-emerald-500" placeholder="Item Name..." />
                    <textarea v-model="item.details" @change="saveDocField(previewInvoice)" rows="2" @input="autoGrowTextarea" class="w-full bg-canvas border border-line rounded-lg px-3 py-1.5 text-[11px] text-ink-2 focus:outline-none focus:border-emerald-500 font-sans" placeholder="Item details/notes..."></textarea>
                  </div>
                  <div v-else class="space-y-1">
                    <div class="font-bold text-sm text-ink flex items-start gap-1.5">
                      <span class="text-emerald-700 font-mono">{{ idx + 1 }}.</span>
                      <span>{{ item.description }}</span>
                    </div>
                    <div v-if="item.details" class="text-[11px] text-ink-2 pl-4 leading-relaxed font-sans whitespace-pre-line">
                      {{ item.details }}
                    </div>
                  </div>
                </td>
                <td class="p-4 text-right text-ink font-semibold font-mono text-sm align-top">
                  <div v-if="isEditingInvoiceDoc" class="flex flex-col items-end gap-2 text-right">
                    <div class="flex items-center gap-1.5">
                      <span class="text-ink-3">Qty:</span>
                      <input type="number" v-model="item.quantity" @change="saveDocField(previewInvoice)" class="w-12 text-center bg-canvas border border-line rounded py-0.5 focus:outline-none font-mono text-xs" />
                    </div>
                    <div class="flex items-center gap-1.5">
                      <span class="text-ink-3">Rate:</span>
                      <input type="number" v-model="item.rate" @change="saveDocField(previewInvoice)" class="w-20 text-right bg-canvas border border-line rounded py-0.5 focus:outline-none font-mono text-xs" />
                    </div>
                    <div class="font-bold text-[#1b8a4a] mt-1">
                      {{ formatMoney(item.quantity * item.rate, previewInvoice.currency) }}
                    </div>
                  </div>
                  <div v-else class="pt-0.5 font-bold text-[#1b8a4a]">
                    {{ formatMoney(item.quantity * item.rate, previewInvoice.currency) }}
                  </div>
                </td>
              </tr>
              
              <!-- Add Row button inside table if editing -->
              <tr v-if="isEditingInvoiceDoc" class="bg-emerald-50/5">
                <td colspan="2" class="p-3 text-center">
                  <button @click="addDocItemRow(previewInvoice)" class="text-xs text-emerald-700 hover:text-emerald-950 font-bold flex items-center gap-1.5 mx-auto">
                    <Plus class="w-4 h-4" /> Add Line Item
                  </button>
                </td>
              </tr>
            </tbody>
          </table>

          <!-- Bottom Columns: Bank details on left, Totals & Signature on right -->
          <div class="grid grid-cols-1 md:grid-cols-12 gap-8 pt-4">
            <!-- Left: Bank Details Box -->
            <div class="md:col-span-7 bg-white/80 border border-emerald-100/50 backdrop-blur-sm p-5 rounded-2xl shadow-sm space-y-3 relative">
              <div class="flex items-center justify-between">
                <span class="text-[10px] uppercase tracking-wider text-[#1b8a4a] font-bold">Bank Details</span>
                <button v-if="!isEditingBankDetails" @click="isEditingBankDetails = true" class="text-[#1b8a4a] hover:text-emerald-800 text-[10px] flex items-center gap-0.5 font-semibold print:hidden">
                  <Edit3 class="w-2.5 h-2.5" /> Edit
                </button>
              </div>
              
              <div v-if="isEditingBankDetails" class="space-y-2 text-xs print:hidden text-left">
                <input v-model="bankAccountName" class="w-full bg-canvas border border-line rounded px-2 py-1" placeholder="Account Name" />
                <input v-model="bankAccountNumber" class="w-full bg-canvas border border-line rounded px-2 py-1" placeholder="Account Number" />
                <input v-model="bankIFSC" class="w-full bg-canvas border border-line rounded px-2 py-1" placeholder="IFSC" />
                <input v-model="bankSWIFT" class="w-full bg-canvas border border-line rounded px-2 py-1" placeholder="SWIFT Code" />
                <input v-model="bankName" class="w-full bg-canvas border border-line rounded px-2 py-1" placeholder="Bank" />
                <input v-model="bankMICR" class="w-full bg-canvas border border-line rounded px-2 py-1" placeholder="MICR" />
                <button @click="saveBankDetails" class="text-[9px] bg-emerald-600 text-white rounded px-2 py-1 flex ml-auto">Save</button>
              </div>
              <div v-else class="grid grid-cols-3 gap-y-1.5 gap-x-2 text-[11px] leading-relaxed text-left">
                <span class="text-ink-3 font-semibold">Account Name</span>
                <span class="col-span-2 text-ink-2">{{ bankAccountName }}</span>
                <span class="text-ink-3 font-semibold">Account Number</span>
                <span class="col-span-2 text-ink-2 font-mono">{{ bankAccountNumber }}</span>
                <span class="text-ink-3 font-semibold">IFSC</span>
                <span class="col-span-2 text-ink-2 font-mono">{{ bankIFSC }}</span>
                <span class="text-ink-3 font-semibold">SWIFT Code</span>
                <span class="col-span-2 text-ink-2 font-mono">{{ bankSWIFT }}</span>
                <span class="text-ink-3 font-semibold">Bank</span>
                <span class="col-span-2 text-ink-2">{{ bankName }}</span>
                <span class="text-ink-3 font-semibold">MICR</span>
                <span class="col-span-2 text-ink-2 font-mono">{{ bankMICR }}</span>
              </div>
            </div>
            
            <!-- Right: Totals and Signature -->
            <div class="md:col-span-5 flex flex-col justify-between space-y-6">
              <!-- Grand Total Summary Box -->
              <div class="bg-white/80 border border-emerald-100/50 backdrop-blur-sm p-5 rounded-2xl space-y-3 shadow-sm">
                <div class="flex justify-between text-xs text-ink-2">
                  <span class="text-ink-3">Subtotal</span>
                  <span class="font-mono font-medium">{{ formatMoney(previewInvoice.items.reduce((sum, x) => sum + (x.quantity * x.rate), 0), previewInvoice.currency) }}</span>
                </div>
                <!-- Hide Tax Row in Final View, show only when editing -->
                <div v-if="isEditingInvoiceDoc" class="flex justify-between text-xs text-ink-2 text-left">
                  <span class="flex items-center gap-1 text-ink-3">
                    Tax (<input type="number" v-model="previewInvoice.taxRate" @change="saveDocField(previewInvoice)" class="w-10 text-center bg-white border border-emerald-100 rounded focus:outline-none" />%)
                  </span>
                  <span class="font-mono font-medium">{{ formatMoney(previewInvoice.items.reduce((sum, x) => sum + (x.quantity * x.rate), 0) * (previewInvoice.taxRate / 100), previewInvoice.currency) }}</span>
                </div>
                <div class="flex justify-between items-center pt-3 border-t border-emerald-100/20 text-sm font-bold bg-[#8b5cf6] text-white -mx-5 -mb-5 p-4 rounded-b-2xl shadow-sm">
                  <span class="uppercase tracking-wider text-[10px] font-black">Total</span>
                  <span class="font-mono text-lg font-black">{{ formatMoney(previewInvoice.amount, previewInvoice.currency) }}</span>
                </div>
              </div>

              <!-- Signature block -->
              <div class="flex flex-col items-center justify-center space-y-1.5 self-center md:self-end pr-4 text-center">
                <div class="relative group w-36 h-12 flex items-center justify-center select-none">
                  <img v-if="sigSrc" :src="sigSrc" class="max-w-full max-h-full object-contain" />
                  <div v-else class="w-full h-full flex items-center justify-center">
                    <svg viewBox="0 0 150 50" class="w-full h-full text-indigo-700/80 stroke-current fill-none stroke-[2.5] stroke-linecap-round stroke-linejoin-round">
                      <path d="M 10 35 C 20 20, 30 15, 35 25 C 40 35, 45 40, 50 30 C 60 15, 70 10, 75 25 C 80 35, 85 45, 90 20 C 100 5, 110 10, 115 30 C 120 40, 130 35, 140 25" />
                      <path d="M 20 42 C 40 40, 90 38, 130 35" />
                    </svg>
                  </div>
                  <label v-if="isEditingInvoiceDoc" class="absolute -bottom-1 -right-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-full p-1 shadow-md cursor-pointer print:hidden">
                    <Edit3 class="w-2.5 h-2.5" />
                    <input type="file" accept="image/*" class="hidden" @change="handleSigUpload" />
                  </label>
                  <button v-if="isEditingInvoiceDoc && sigSrc" @click="removeSig" class="absolute -top-1 -right-1 bg-rose-600 hover:bg-rose-700 text-white rounded-full p-1 shadow-md print:hidden">
                    <Trash class="w-2.5 h-2.5" />
                  </button>
                </div>
                <div class="w-36 border-t border-ink-3 my-0.5"></div>
                <span class="text-[10px] text-ink-3 uppercase tracking-wider font-semibold">Authorized Signatory</span>
              </div>
            </div>
          </div>

          <!-- Bottom Footer -->
          <div class="text-center text-[10px] text-ink-3 pt-6 border-t border-emerald-100/30">
            For any enquiry, reach out via email at <span class="text-ink font-semibold">{{ senderEmail }}</span>, call on <span class="text-ink font-semibold">{{ senderPhone }}</span>
          </div>
        </div>
      </div>
    </div>

  </div>
</template>
