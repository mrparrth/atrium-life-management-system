<script setup>
import { computed } from 'vue'
import { useWorkAnalyticsStore } from '@/stores/workAnalytics'
import PageHeader from '@/components/PageHeader.vue'
import SectionHeader from '@/components/SectionHeader.vue'
import { 
  TrendingUp, BarChart2, AlertCircle, Clock, Zap, 
  HelpCircle, ChevronRight, Activity 
} from 'lucide-vue-next'

const analyticsStore = useWorkAnalyticsStore()

const revenueSeries = computed(() => analyticsStore.monthlyRevenueSeries)
const maxRevenue = computed(() => {
  const vals = revenueSeries.value.map(s => s.value)
  return Math.max(1, ...vals)
})

const clientProfitability = computed(() => {
  return [...analyticsStore.clientProfitability].sort((a, b) => b.hourlyYield - a.hourlyYield)
})

const focusStats = computed(() => analyticsStore.focusFragmentation)
const overruns = computed(() => analyticsStore.scopeCreepAlerts)
</script>

<template>
  <div class="px-8 md:px-12 py-10 max-w-5xl mx-auto space-y-10 animate-fade-in" data-testid="work-analytics">
    
    <!-- HEADER -->
    <PageHeader overline="Intelligence" title="Operational analytics" sub="Quiet, strategic insights into client profitability, focus fragmentation, and project margins.">
    </PageHeader>

    <!-- REVENUE TREND GRAPH (CUSTOM COLUMN CHART) -->
    <div class="card p-6 border bg-surface space-y-6">
      <div class="flex items-center justify-between">
        <div>
          <h3 class="font-serif text-lg font-bold text-ink">Receivables Revenue Trend</h3>
          <span class="text-[10px] text-ink-3 uppercase tracking-wider font-semibold">Rolling six-month invoiced total</span>
        </div>
        <TrendingUp class="w-5 h-5 text-pri-strategic" />
      </div>

      <!-- Graph -->
      <div class="h-48 flex items-end gap-6 pt-4 px-2 select-none border-b border-line">
        <div v-for="s in revenueSeries" :key="s.key" class="flex-1 flex flex-col items-center h-full justify-end group">
          <!-- Tooltip on hover -->
          <div class="opacity-0 group-hover:opacity-100 transition-opacity bg-ink text-canvas text-[10px] px-2 py-1 rounded-md mb-2 font-mono font-semibold shadow-md">
            ₹{{ s.value.toLocaleString() }}
          </div>
          <!-- Bar -->
          <div class="w-full rounded-t-lg bg-line group-hover:bg-line-2 transition-all duration-300"
            :style="{ height: `${Math.max(4, (s.value / maxRevenue) * 100)}%` }">
          </div>
          <!-- Label -->
          <span class="text-[10px] text-ink-3 font-semibold mt-2 select-none uppercase tracking-wider">{{ s.label }}</span>
        </div>
      </div>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
      <!-- CLIENT PROFITABILITY (LEFT 2 COLS) -->
      <div class="lg:col-span-2 space-y-6">
        <div class="card p-6 border bg-surface space-y-4">
          <h3 class="font-serif text-lg font-bold text-ink">Client Yield Analysis</h3>
          <p class="text-xs text-ink-2 leading-relaxed">Calculated by dividing client invoiced subtotal by actual hours spent. Highlights the true financial output per hour of work.</p>
          
          <div class="overflow-x-auto pt-2">
            <table class="w-full text-left border-collapse text-xs">
              <thead>
                <tr class="bg-canvas border-b border-line text-ink-3 uppercase tracking-wider text-[10px] font-semibold">
                  <th class="p-3">Client</th>
                  <th class="p-3 text-center">Tracked Hours</th>
                  <th class="p-3 text-right">Invoiced Amount</th>
                  <th class="p-3 text-right">Yield Rate</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="c in clientProfitability" :key="c.id" class="border-b border-line/60 last:border-0 hover:bg-canvas/20">
                  <td class="p-3 font-semibold text-ink">{{ c.name }}</td>
                  <td class="p-3 text-center text-ink-2 font-mono">{{ c.totalHours.toFixed(1) }}h</td>
                  <td class="p-3 text-right text-ink-2">₹{{ c.totalInvoiced.toLocaleString() }}</td>
                  <td class="p-3 text-right font-serif font-bold"
                    :class="c.hourlyYield >= 3000 ? 'text-pri-strategic' : c.hourlyYield > 0 && c.hourlyYield < 2000 ? 'text-pri-critical' : 'text-ink'">
                    ₹{{ c.hourlyYield }}/hr
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- SCOPE OVERRUNS -->
        <div class="card p-6 border bg-surface space-y-4">
          <h3 class="font-serif text-lg font-bold text-ink">Scoped Overruns Tracker</h3>
          <p class="text-xs text-ink-2 leading-relaxed">Work items where actual hours exceeded estimated parameters. Helps review sizing accuracy.</p>
          
          <ul v-if="overruns.length" class="space-y-3">
            <li v-for="item in overruns" :key="item.id" class="bg-canvas/50 border border-line p-3.5 rounded-xl text-xs flex justify-between items-center gap-4">
              <div class="min-w-0">
                <div class="font-medium text-ink truncate">{{ item.title }}</div>
                <div class="text-[10px] text-ink-3 mt-0.5">Client: {{ item.clientName }} · Estimated: {{ item.estimatedHours }}h</div>
              </div>
              <div class="text-right shrink-0">
                <div class="font-semibold text-pri-critical">+{{ item.overrun.toFixed(1) }}h overrun</div>
                <div class="text-[10px] text-ink-3 mt-0.5">Tracked: {{ item.actualHours }}h ({{ item.percent }}%)</div>
              </div>
            </li>
          </ul>
          <p v-else class="text-xs text-ink-3 italic">All items are tracking within estimated parameters.</p>
        </div>
      </div>

      <!-- FOCUS FRAGMENTATION (RIGHT COL) -->
      <div class="space-y-6">
        
        <!-- FOCUS LEVEL CARD -->
        <div class="card p-6 border bg-surface space-y-4">
          <div class="overline text-ink-3 flex items-center gap-1.5"><Activity class="w-3.5 h-3.5" /> Context Switches</div>
          <h3 class="font-serif text-xl font-bold text-ink">Focus Fragmentation</h3>
          
          <div class="py-2 flex items-center justify-center">
            <!-- Semi circular or radial indicator simulation -->
            <div class="text-center">
              <div class="text-4xl font-serif font-bold text-ink">{{ focusStats.activeClientsCount }}</div>
              <div class="text-[10px] uppercase font-semibold text-ink-3 tracking-wider mt-1">Active Client Scopes</div>
            </div>
          </div>
          
          <div class="pt-3 border-t border-line text-xs space-y-2">
            <span class="px-2 py-0.5 rounded text-[10px] font-bold border block text-center"
              :class="focusStats.risk === 'high' ? 'bg-pri-critical-bg text-pri-critical border-pri-critical-bd animate-pulse' : focusStats.risk === 'medium' ? 'bg-pri-interruptive-bg text-pri-interruptive border-pri-interruptive-bd' : 'bg-pri-strategic-bg text-pri-strategic border-pri-strategic-bd'">
              {{ focusStats.risk.toUpperCase() }} FRAGMENTATION
            </span>
            <p class="text-xs text-ink-2 leading-relaxed text-center">{{ focusStats.message }}</p>
          </div>
        </div>

        <!-- Strategic suggestion -->
        <div class="card p-6 bg-pri-strategic-bg/30 border border-pri-strategic-bd/50 space-y-3">
          <span class="overline text-pri-strategic font-bold flex items-center gap-1.5"><Clock class="w-3.5 h-3.5" /> Freelancer Sustainability</span>
          <p class="text-xs text-ink-2 leading-relaxed">
            "Sustaining an independent business is not about maximizing short-term hourly output, but maintaining stable margins and calm attention boundaries."
          </p>
        </div>
      </div>
    </div>

  </div>
</template>
