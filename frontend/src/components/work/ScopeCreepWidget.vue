<script setup>
import { computed } from 'vue'
import { useWorkAnalyticsStore } from '@/stores/workAnalytics'
import { AlertTriangle, TrendingDown, Clock, ArrowUpRight } from 'lucide-vue-next'

const analyticsStore = useWorkAnalyticsStore()

const overruns = computed(() => analyticsStore.scopeCreepAlerts.slice(0, 3))
const unprofitableClients = computed(() => {
  // Find clients whose hourly yield is below a target (e.g. 2000 INR or standard)
  // Let's filter clients who have tracked hours but low yield
  return analyticsStore.clientProfitability
    .filter(c => c.totalHours > 0 && c.hourlyYield > 0)
    .sort((a, b) => a.hourlyYield - b.hourlyYield)
    .slice(0, 2)
})
</script>

<template>
  <div v-if="overruns.length || unprofitableClients.length" class="space-y-4">
    <div class="flex items-center gap-2 mb-2">
      <AlertTriangle class="w-4 h-4 text-pri-critical" />
      <h3 class="overline text-ink-2">Scope & Profitability Intelligence</h3>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
      <!-- Active Scope Creep Alerts -->
      <div v-if="overruns.length" class="card p-5 bg-surface border border-line flex flex-col justify-between">
        <div>
          <div class="flex items-center justify-between mb-3">
            <span class="overline text-pri-critical font-semibold">Overrun Warning</span>
            <AlertTriangle class="w-4 h-4 text-pri-critical" />
          </div>
          <h4 class="font-serif text-lg text-ink font-semibold">Active Scope Creep</h4>
          <p class="text-xs text-ink-2 mt-1 leading-relaxed">The following items have exceeded their estimated hours.
            Consider pausing to adjust estimates or invoicing additional requests.</p>

          <ul class="mt-4 space-y-3">
            <li v-for="item in overruns" :key="item.id"
              class="text-xs border-b border-line/60 pb-2 last:border-0 last:pb-0">
              <div class="flex justify-between font-medium text-ink">
                <span class="truncate pr-2">{{ item.title }}</span>
                <span class="text-pri-critical shrink-0">+{{ item.overrun.toFixed(1) }}h ({{ item.percent }}%)</span>
              </div>
              <div class="text-[10px] text-ink-3 mt-0.5">Client: {{ item.clientName }} · Tracked: {{ item.actualHours
                }}h / Est: {{ item.estimatedHours }}h</div>
            </li>
          </ul>
        </div>
      </div>

      <!-- Unprofitable Client Alerts -->
      <div v-if="unprofitableClients.length"
        class="card p-5 bg-surface border border-line flex flex-col justify-between">
        <div>
          <div class="flex items-center justify-between mb-3">
            <span class="overline text-pri-interruptive font-semibold">Margin Check</span>
            <TrendingDown class="w-4 h-4 text-pri-interruptive" />
          </div>
          <h4 class="font-serif text-lg text-ink font-semibold">Low-Yield Accounts</h4>
          <p class="text-xs text-ink-2 mt-1 leading-relaxed">Calculated by dividing base invoiced amount by actual
            tracked hours. Lower yield suggests high revision overhead or underpriced scopes.</p>

          <ul class="mt-4 space-y-3">
            <li v-for="c in unprofitableClients" :key="c.id"
              class="text-xs border-b border-line/60 pb-2 last:border-0 last:pb-0">
              <div class="flex justify-between font-medium text-ink">
                <span>{{ c.name }}</span>
                <span class="text-pri-interruptive font-semibold">${{ c.hourlyYield }}/hr</span>
              </div>
              <div class="text-[10px] text-ink-3 mt-0.5">Tracked: {{ c.totalHours }}h · Creep items: {{
                c.scopeCreepCount }} / {{ c.itemsCount }}</div>
            </li>
          </ul>
        </div>
      </div>
    </div>
  </div>
</template>
