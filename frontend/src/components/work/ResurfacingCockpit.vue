<script setup>
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useWorkClientsStore } from '@/stores/workClients'
import { useWorkItemsStore } from '@/stores/workItems'
import { useWorkInvoicesStore } from '@/stores/workInvoices'
import { useWorkLeadsStore } from '@/stores/workLeads'
import { useUIStore } from '@/stores/ui'
import { BellRing, ShieldAlert, Check, RefreshCw, Moon, EyeOff } from 'lucide-vue-next'
import dayjs from 'dayjs'
import { sendDesktopNotification } from '@/lib/notifications'


const router = useRouter()
const clientsStore = useWorkClientsStore()
const itemsStore = useWorkItemsStore()
const invoicesStore = useWorkInvoicesStore()
const leadsStore = useWorkLeadsStore()
const ui = useUIStore()

const today = dayjs().format('YYYY-MM-DD')

// We'll store snoozed alerts locally in a ref or localStorage to make this persistent
const snoozedAlerts = ref(JSON.parse(localStorage.getItem('atrium.snoozed_alerts') || '[]'))

function saveSnoozes() {
  localStorage.setItem('atrium.snoozed_alerts', JSON.stringify(snoozedAlerts.value))
}

function snoozeAlert(id, days = 7) {
  const until = dayjs().add(days, 'day').toISOString()
  snoozedAlerts.value.push({ id, until })
  saveSnoozes()
  ui.showToast('Item snoozed from briefing', 'info')
}

function isSnoozed(id) {
  const item = snoozedAlerts.value.find(s => s.id === id)
  if (!item) return false
  if (new Date(item.until) < new Date()) {
    // expired
    snoozedAlerts.value = snoozedAlerts.value.filter(s => s.id !== id)
    saveSnoozes()
    return false
  }
  return true
}

function goToItem(alert) {
  if (alert.type === 'client') {
    router.push(`/work/clients/${alert.targetId}`)
  } else if (alert.type === 'invoice') {
    router.push(`/work/invoices?id=${alert.targetId}`)
  } else if (alert.type === 'work_item') {
    router.push(`/work/items?id=${alert.targetId}`)
  } else if (alert.type === 'lead') {
    router.push(`/work/leads?id=${alert.targetId}`)
  }
}

const alerts = computed(() => {
  const list = []

  // 1. Stale Clients (> 30 days since last interaction)
  clientsStore.items.forEach(c => {
    const key = `client-stale-${c.id}`
    if (isSnoozed(key)) return
    const daysSince = dayjs().diff(dayjs(c.lastInteractionAt), 'day')
    if (daysSince >= 30) {
      list.push({
        id: key,
        type: 'client',
        targetId: c.id,
        title: `${c.name} has gone quiet`,
        description: `No interactions registered for ${daysSince} days. Check in to maintain relationship health.`,
        actionText: 'Mark checked-in',
        action: () => {
          clientsStore.update(c.id, { lastInteractionAt: new Date().toISOString() })
          ui.showToast(`Updated interaction date for ${c.name}`, 'success')
        }
      })
    }
  })

  // 2. Overdue Invoices
  invoicesStore.items.forEach(inv => {
    const key = `invoice-overdue-${inv.id}`
    if (isSnoozed(key)) return
    if (inv.status !== 'paid' && inv.dueDate < today) {
      list.push({
        id: key,
        type: 'invoice',
        targetId: inv.id,
        title: `Outstanding Account: ${inv.invoiceNumber}`,
        description: `Overdue since ${dayjs(inv.dueDate).format('MMM D')}. Total balance outstanding is ${Math.round(inv.amount - inv.amountPaid)}.`,
        actionText: 'Mark Paid',
        action: () => {
          invoicesStore.update(inv.id, { status: 'paid', paidAt: new Date().toISOString() })
          ui.showToast(`Invoice ${inv.invoiceNumber} marked as paid`, 'success')
        }
      })
    }
  })

  // 3. Stale Work Items (untouched for 14 days)
  itemsStore.items.forEach(item => {
    const key = `work-item-stale-${item.id}`
    if (isSnoozed(key)) return
    if (!itemsStore.isCompleted(item.status)) {
      const daysSince = dayjs().diff(dayjs(item.updatedAt), 'day')
      if (daysSince >= 14) {
        list.push({
          id: key,
          type: 'work_item',
          targetId: item.id,
          title: `Untouched work: ${item.title}`,
          description: `Paused for ${daysSince} days. Review if this is still strategic or needs snoozing/archiving.`,
          actionText: 'Touch (mark active)',
          action: () => {
            itemsStore.update(item.id, { updatedAt: new Date().toISOString() })
            ui.showToast('Item bumped to active status', 'success')
          }
        })
      }
    }
  })

  // 4. Stale Leads
  leadsStore.items.forEach(lead => {
    const key = `lead-stale-${lead.id}`
    if (isSnoozed(key)) return
    if (lead.followUpDate <= today) { //!['won', 'lost', 'onboarding'].includes(lead.status) && lead.followUpDate && 
      list.push({
        id: key,
        type: 'lead',
        targetId: lead.id,
        title: `Lead follow-up: ${lead.title}`,
        description: `Follow-up was scheduled for ${dayjs(lead.followUpDate).format('MMM D')} | ${lead.notes ? lead.notes : "Check-in with " + lead.clientName + "."}`,
        actionText: 'Postpone 3d',
        action: () => {
          const nextDate = dayjs().add(3, 'day').format('YYYY-MM-DD')
          leadsStore.update(lead.id, { followUpDate: nextDate })
          ui.showToast('Follow-up postponed by 3 days', 'info')
        }
      })
    }
  })

  return list
})

// Track which alerts have already generated a desktop notification
const notifiedAlerts = ref(JSON.parse(localStorage.getItem('atrium.notified_alerts') || '[]'))

function saveNotifiedAlerts() {
  localStorage.setItem('atrium.notified_alerts', JSON.stringify(notifiedAlerts.value))
}

watch(alerts, (newAlerts) => {
  newAlerts.forEach(alert => {
    if (!notifiedAlerts.value.includes(alert.id)) {
      sendDesktopNotification(alert.title, {
        body: alert.description
      })
      notifiedAlerts.value.push(alert.id)
    }
  })

  // Clean up IDs that are no longer active alerts so they can notify again in future if they re-occur
  const currentIds = newAlerts.map(a => a.id)
  notifiedAlerts.value = notifiedAlerts.value.filter(id => currentIds.includes(id))
  saveNotifiedAlerts()
}, { immediate: true })
</script>

<template>
  <div v-if="alerts.length" class="space-y-4">
    <div class="flex items-center gap-2 mb-2">
      <BellRing class="w-4 h-4 text-pri-interruptive" />
      <h3 class="overline text-ink-2">Strategic Briefing Alerts</h3>
    </div>

    <div class="grid grid-cols-1 gap-3">
      <div v-for="alert in alerts" :key="alert.id" @click="goToItem(alert)"
        title="Click to view details"
        class="card p-4 flex items-start justify-between gap-4 border border-line bg-surface hover:border-line-2 transition-all duration-300 cursor-pointer">

        <div class="space-y-1">
          <div class="flex items-center gap-2">
            <span class="w-1.5 h-1.5 rounded-full shrink-0"
              :class="alert.type === 'invoice' ? 'bg-pri-critical' : alert.type === 'client' ? 'bg-pri-critical' : 'bg-pri-interruptive'">
            </span>
            <span class="text-xs uppercase tracking-wider text-ink-3 font-semibold">{{ alert.type }}</span>
          </div>
          <h4 class="font-serif text-base text-ink font-semibold mt-1">{{ alert.title }}</h4>
          <p class="text-xs text-ink-2 leading-relaxed max-w-xl">{{ alert.description }}</p>
        </div>

        <div @click.stop class="flex items-center gap-2 shrink-0 self-center">
          <div class="relative group">
            <button @click="alert.action"
              class="btn-ghost !text-xs !py-1 px-2.5 bg-canvas hover:bg-line/40 rounded-lg flex items-center gap-1 text-ink font-medium">
              <Check class="w-3.5 h-3.5" /> {{ alert.actionText }}
            </button>
            <div class="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-200 bg-ink text-canvas text-[10px] px-2.5 py-1.5 rounded-lg font-medium shadow-lg whitespace-nowrap z-50">
              Resolve: {{ alert.actionText }}
            </div>
          </div>

          <div class="relative group">
            <button @click="snoozeAlert(alert.id)"
              class="btn-ghost !p-1.5 hover:bg-canvas text-ink-3 hover:text-ink rounded-lg">
              <EyeOff class="w-3.5 h-3.5" />
            </button>
            <div class="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-200 bg-ink text-canvas text-[10px] px-2.5 py-1.5 rounded-lg font-medium shadow-lg whitespace-nowrap z-50">
              Snooze for 7 days
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
