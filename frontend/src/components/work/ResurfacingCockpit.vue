<script setup>
import { computed, ref, watch, onMounted, onBeforeUnmount } from 'vue'
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

const activeSnoozePopoverAlertId = ref(null)

function toggleSnoozePopover(alertId) {
  if (activeSnoozePopoverAlertId.value === alertId) {
    activeSnoozePopoverAlertId.value = null
  } else {
    activeSnoozePopoverAlertId.value = alertId
  }
}

function closeSnoozePopover(e) {
  if (!e.target.closest('.snooze-popover-container')) {
    activeSnoozePopoverAlertId.value = null
  }
}

onMounted(() => {
  document.addEventListener('click', closeSnoozePopover)
})

onBeforeUnmount(() => {
  document.removeEventListener('click', closeSnoozePopover)
})

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
    console.log(c)
    if (c.status === 'inactive' || c.status === 'do_not_follow_up') return
    const hasActiveTask = itemsStore.items.some(item => 
      item.clientId === c.id && !itemsStore.isCompleted(item.status)
    )
    if (hasActiveTask) return
    const key = `client-stale-${c.id}`
    if (isSnoozed(key)) return
    const daysSince = dayjs().diff(dayjs(c.lastInteractionAt), 'day')
    if (daysSince >= 30) {
      list.push({
        id: key,
        type: 'client',
        targetId: c.id,
        title: `${c.name} has gone quiet`,
        description: `No interactions registered for ${daysSince} days. Check in to maintain relationship health.`
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
    if (lead.followUpDate <= today && !['won', 'lost', 'onboarding'].includes(lead.status) && lead.followUpDate) {
      list.push({
        id: key,
        type: 'lead',
        targetId: lead.id,
        title: `Lead follow-up: ${lead.clientName}`,
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

    <div class="grid grid-cols-1 gap-2">
      <div v-for="alert in alerts" :key="alert.id" @click="goToItem(alert)" title="Click to view details"
        class="card py-2 px-3 flex items-center justify-between gap-3 border border-line bg-surface hover:border-line-2 transition-all duration-300 cursor-pointer">

        <div class="flex items-center gap-2.5 min-w-0 flex-1">
          <span class="w-1.5 h-1.5 rounded-full shrink-0"
            :class="alert.type === 'invoice' ? 'bg-pri-critical' : alert.type === 'client' ? 'bg-pri-critical' : 'bg-pri-interruptive'">
          </span>
          <div class="flex flex-col md:flex-row md:items-center gap-1 md:gap-3 min-w-0 flex-1">
            <div class="flex items-center gap-2 shrink-0">
              <h4 class="font-serif text-xs md:text-sm text-ink font-bold truncate">{{ alert.title }}</h4>
              <span class="text-[9px] uppercase tracking-wider text-ink-3 font-bold bg-canvas px-1.5 py-0.5 rounded border border-line/40 shrink-0">{{ alert.type }}</span>
            </div>
            <p class="text-xs text-ink-2 truncate max-w-xl md:border-l md:border-line md:pl-3">{{ alert.description }}</p>
          </div>
        </div>

        <div @click.stop class="flex items-center gap-2 shrink-0 self-center">
          <div v-if="alert.actionText" class="relative group">
            <button @click="alert.action"
              class="btn-ghost !text-xs !py-1 px-2.5 bg-canvas hover:bg-line/40 rounded-lg flex items-center gap-1 text-ink font-medium">
              <Check class="w-3.5 h-3.5" /> {{ alert.actionText }}
            </button>
            <div
              class="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-200 bg-ink text-canvas text-[10px] px-2.5 py-1.5 rounded-lg font-medium shadow-lg whitespace-nowrap z-50">
              Resolve: {{ alert.actionText }}
            </div>
          </div>

          <div class="relative snooze-popover-container">
            <button @click="toggleSnoozePopover(alert.id)"
              class="btn-ghost !p-1.5 hover:bg-canvas text-ink-3 hover:text-ink rounded-lg"
              title="Snooze Alert">
              <EyeOff class="w-3.5 h-3.5" />
            </button>
            
            <!-- Snooze Options Popover -->
            <div v-if="activeSnoozePopoverAlertId === alert.id"
              class="absolute right-0 bottom-full mb-2 bg-surface border border-line rounded-xl shadow-xl p-1.5 min-w-[100px] z-50 flex flex-col space-y-0.5 animate-rise-in text-left">
              <span class="text-[9px] uppercase font-bold text-ink-3 px-2 py-1 select-none">Snooze for:</span>
              <button v-for="days in [1, 3, 7, 14, 30]" :key="days"
                @click="snoozeAlert(alert.id, days); activeSnoozePopoverAlertId = null"
                class="px-2.5 py-1 text-xs text-ink-2 hover:text-ink hover:bg-canvas rounded-lg text-left font-medium transition-colors cursor-pointer w-full">
                {{ days }} {{ days === 1 ? 'day' : 'days' }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
