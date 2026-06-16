<script setup>
import { ref, computed, watch, nextTick } from 'vue'
import { useYearsStore } from '@/stores/years'
import { useGoalsStore } from '@/stores/goals'
import { useProjectsStore } from '@/stores/projects'
import { useFinanceStore } from '@/stores/finance'
import { useUIStore } from '@/stores/ui'
import PageHeader from '@/components/PageHeader.vue'
import EmptyState from '@/components/EmptyState.vue'
import { Plus, X, Trash2, Calendar, TrendingUp, TrendingDown, Landmark, PiggyBank, Briefcase } from 'lucide-vue-next'
import dayjs from 'dayjs'
import { onKeyStroke } from '@vueuse/core'

const years = useYearsStore()
const goals = useGoalsStore()
const projects = useProjectsStore()
const financeStore = useFinanceStore()
const ui = useUIStore()

const showNew = ref(false)
const newYear = ref(new Date().getFullYear() + 1)
const newTheme = ref('')

const selectedYear = ref(null)

function goalCount(yid) { 
  return goals.items.filter(g => g.yearId === yid || (g.yearIds && g.yearIds.includes(yid))).length 
}

function getYearGoals(yid) {
  return goals.items.filter(g => g.yearId === yid || (g.yearIds && g.yearIds.includes(yid)))
}

function getGoalProjects(gid) {
  return projects.items.filter(p => p.goalId === gid)
}

const yearFinanceStats = computed(() => {
  if (!selectedYear.value) return null
  const yrStr = String(selectedYear.value.year)
  
  // Filter cashflow
  const periods = financeStore.cashflowPeriods.filter(p => p.month.startsWith(yrStr))
  let totalIncome = 0
  let totalExpense = 0
  let totalInvestment = 0
  
  periods.forEach(p => {
    const t = financeStore.periodTotals(p)
    totalIncome += t.income
    totalExpense += t.expense
    totalInvestment += t.investment
  })
  
  const saveRate = totalIncome > 0 ? ((totalIncome - totalExpense) / totalIncome) * 100 : 0
  
  // Networth changes
  const logs = financeStore.networthLogs.filter(l => l.date.startsWith(yrStr))
  let nwStart = null
  let nwEnd = null
  let nwChange = 0
  let nwGrowthPct = 0
  
  if (logs.length > 0) {
    // logs are sorted newest first. So logs[0] is latest (end), logs[logs.length-1] is earliest (start)
    nwEnd = financeStore.logTotal(logs[0])
    nwStart = financeStore.logTotal(logs[logs.length - 1])
    nwChange = nwEnd - nwStart
    if (nwStart > 0) {
      nwGrowthPct = (nwChange / nwStart) * 100
    }
  }
  
  return {
    totalIncome,
    totalExpense,
    totalInvestment,
    saveRate,
    nwStart,
    nwEnd,
    nwChange,
    nwGrowthPct,
    hasCashflow: periods.length > 0,
    hasNetworth: logs.length > 0
  }
})

async function saveReflections() {
  if (!selectedYear.value) return
  await years.update(selectedYear.value.id, {
    wins: selectedYear.value.wins || '',
    losses: selectedYear.value.losses || '',
    lessons: selectedYear.value.lessons || ''
  })
  ui.showToast('Yearly reflections saved', 'success')
}

async function create() {
  await years.add({ year: +newYear.value, theme: newTheme.value })
  newTheme.value = ''; showNew.value = false
}

async function removeYear(y) {
  if (!await ui.confirm({ message: `Delete ${y.year}? Its goals will remain.`, title: 'Delete Year' })) return
  await years.remove(y.id)
}

const newYearInput = ref(null)
watch(showNew, (open) => {
  if (open) {
    nextTick(() => {
      newYearInput.value?.focus()
    })
  }
})

onKeyStroke('Escape', (e) => {
  if (showNew.value) {
    e.preventDefault()
    showNew.value = false
  }
})
</script>

<template>
  <div class="px-8 md:px-12 py-10 max-w-5xl mx-auto" data-testid="years-view">
    <PageHeader overline="Horizon" title="Years" sub="A long, soft view of where the years are pointing.">
      <template #right><button class="btn-primary" @click="showNew = true" data-testid="new-year-btn"><Plus class="w-4 h-4" /> New year <span class="kbd ml-1.5 !bg-canvas/20 !border-canvas/10 !text-canvas select-none">⌘1</span></button></template>
    </PageHeader>

    <div v-if="years.items.length" class="space-y-5">
      <div v-for="y in years.items" :key="y.id" 
        class="card p-7 group relative cursor-pointer hover:border-line-2 hover:shadow-sm transition-all duration-300" 
        @click="selectedYear = y"
        :data-testid="`year-card-${y.id}`">
        <button
          @click.stop="removeYear(y)"
          class="absolute top-4 right-4 btn-ghost !p-1.5 opacity-0 group-hover:opacity-100 hover:text-pri-critical"
          :data-testid="`year-delete-${y.id}`" :title="`Delete ${y.year}`"
        ><Trash2 class="w-4 h-4" /></button>
        <div class="flex items-baseline gap-6">
          <div class="font-serif text-5xl tracking-tight text-ink-2">{{ y.year }}</div>
          <div>
            <p class="font-serif text-2xl text-ink leading-tight">{{ y.theme || 'Untitled year' }}</p>
            <p class="text-sm text-ink-3 mt-2">{{ goalCount(y.id) }} goal<span v-if="goalCount(y.id) !== 1">s</span></p>
          </div>
        </div>
      </div>
    </div>
    <EmptyState v-else title="No years yet" hint="A year is a quiet container." />

    <!-- WIDE & TALL YEAR DETAILS MODAL -->
    <div v-if="selectedYear" class="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div class="fixed inset-0 bg-ink/40 backdrop-blur-sm" @click="selectedYear = null"></div>
      <div class="relative w-full max-w-5xl h-[92vh] card p-8 bg-surface shadow-2xl z-50 animate-rise-in flex flex-col justify-between">
        
        <!-- Header -->
        <div class="flex justify-between items-start pb-4 border-b border-line/50 shrink-0">
          <div>
            <span class="overline text-ink-3">Horizon Yearly Summary</span>
            <h2 class="font-serif text-4xl font-bold mt-1 text-ink">{{ selectedYear.year }}</h2>
            <p class="font-serif text-lg text-ink-2 italic mt-1.5">"{{ selectedYear.theme || 'Untitled year' }}"</p>
          </div>
          <button type="button" class="btn-ghost !p-1.5" @click="selectedYear = null">
            <X class="w-5 h-5" />
          </button>
        </div>

        <!-- Split Content (Scrollable Container) -->
        <div class="flex-1 overflow-y-auto min-h-0 py-6">
          <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
            
            <!-- LEFT COLUMN: Goals Focus Checklist -->
            <div class="space-y-6">
              <div class="flex items-center justify-between">
                <span class="text-xs uppercase tracking-wider font-semibold text-ink-3 font-mono">Goals & Projects focus</span>
                <span class="text-xs font-mono font-bold text-ink-2 bg-canvas px-2.5 py-0.5 rounded border border-line">
                  {{ getYearGoals(selectedYear.id).length }} focus areas
                </span>
              </div>

              <div v-if="getYearGoals(selectedYear.id).length" class="space-y-4 max-h-[40vh] overflow-y-auto pr-2">
                <div v-for="goal in getYearGoals(selectedYear.id)" :key="goal.id" class="p-4 bg-canvas/30 rounded-xl border border-line/60 space-y-3">
                  <div class="flex items-start justify-between gap-3">
                    <div class="min-w-0">
                      <h4 class="font-serif text-base font-semibold text-ink leading-snug">{{ goal.title }}</h4>
                      <p v-if="goal.description" class="text-xs text-ink-2 mt-1 leading-relaxed">{{ goal.description }}</p>
                    </div>
                    <span class="text-[9px] uppercase tracking-wider font-bold px-2 py-0.5 rounded border border-line bg-surface"
                      :class="goal.status === 'active' ? 'text-pri-strategic border-pri-strategic-bd bg-pri-strategic-bg/30' : 'text-ink-3'">
                      {{ goal.status }}
                    </span>
                  </div>

                  <!-- Linked Projects -->
                  <div v-if="getGoalProjects(goal.id).length" class="pl-4 border-l-2 border-line/60 space-y-2 mt-2">
                    <div class="text-[9px] uppercase tracking-wider text-ink-3 font-semibold font-sans">Linked Projects:</div>
                    <div v-for="proj in getGoalProjects(goal.id)" :key="proj.id" class="flex justify-between items-center text-xs">
                      <span class="font-medium text-ink-2">{{ proj.title }}</span>
                      <span class="text-[10px] text-ink-3 px-1.5 py-0.25 bg-canvas/60 rounded border text-capitalize">{{ proj.status }}</span>
                    </div>
                  </div>
                  <div v-else class="text-[10px] text-ink-3 italic pl-4">No projects linked to this goal yet.</div>
                </div>
              </div>
              <p v-else class="text-xs text-ink-3 italic text-center py-10 bg-canvas/20 rounded-xl border border-dashed border-line">
                No goals defined for this year.
              </p>
            </div>

            <!-- RIGHT COLUMN: Financial Summary Insights -->
            <div class="space-y-6 border-t md:border-t-0 md:border-l border-line/50 md:pl-8 pt-6 md:pt-0">
              <span class="text-xs uppercase tracking-wider font-semibold text-ink-3 font-mono block">Financial performance</span>

              <div v-if="yearFinanceStats && (yearFinanceStats.hasCashflow || yearFinanceStats.hasNetworth)" class="space-y-5">
                
                <!-- Metrics Grid -->
                <div class="grid grid-cols-2 gap-4">
                  <div class="bg-canvas/40 p-4 rounded-xl border border-line">
                    <span class="text-[9px] uppercase tracking-wider text-ink-3 font-bold block">Annual Income</span>
                    <div class="font-serif text-xl font-bold mt-1 text-ink">₹{{ yearFinanceStats.totalIncome.toLocaleString() }}</div>
                  </div>
                  <div class="bg-canvas/40 p-4 rounded-xl border border-line">
                    <span class="text-[9px] uppercase tracking-wider text-ink-3 font-bold block">Annual Expenses</span>
                    <div class="font-serif text-xl font-bold mt-1 text-ink">₹{{ yearFinanceStats.totalExpense.toLocaleString() }}</div>
                  </div>
                </div>

                <!-- Save Rate Bar Indicator -->
                <div class="p-4 bg-canvas/40 rounded-xl border border-line space-y-2.5">
                  <div class="flex justify-between items-center text-xs font-semibold">
                    <span class="text-ink-2 flex items-center gap-1.5"><PiggyBank class="w-4 h-4 text-ink-3" /> Yearly Save Rate</span>
                    <span :class="yearFinanceStats.saveRate >= 30 ? 'text-pri-strategic font-bold' : yearFinanceStats.saveRate > 10 ? 'text-pri-interruptive' : 'text-pri-critical'">
                      {{ yearFinanceStats.saveRate.toFixed(1) }}%
                    </span>
                  </div>
                  <div class="h-2 w-full bg-line/60 rounded-full overflow-hidden">
                    <div class="h-full rounded-full transition-all duration-500" 
                      :class="yearFinanceStats.saveRate >= 30 ? 'bg-pri-strategic' : yearFinanceStats.saveRate > 10 ? 'bg-pri-interruptive' : 'bg-pri-critical'"
                      :style="{ width: `${Math.max(0, Math.min(100, yearFinanceStats.saveRate))}%` }">
                    </div>
                  </div>
                </div>

                <!-- Net Worth Performance -->
                <div class="p-4 bg-canvas/40 rounded-xl border border-line space-y-4">
                  <div class="text-xs font-semibold text-ink-2 flex items-center gap-1.5"><Landmark class="w-4 h-4 text-ink-3" /> Net Worth Progress</div>
                  
                  <div v-if="yearFinanceStats.hasNetworth" class="space-y-3">
                    <div class="flex justify-between text-xs text-ink-3">
                      <span>Start of Year:</span>
                      <span class="font-mono">₹{{ yearFinanceStats.nwStart.toLocaleString() }}</span>
                    </div>
                    <div class="flex justify-between text-xs text-ink-3">
                      <span>End of Year:</span>
                      <span class="font-mono">₹{{ yearFinanceStats.nwEnd.toLocaleString() }}</span>
                    </div>
                    <div class="flex justify-between items-center pt-2 border-t border-dashed border-line text-sm font-bold">
                      <span class="text-ink-2">Annual Growth:</span>
                      <span class="font-mono flex items-center gap-1.5" :class="yearFinanceStats.nwChange >= 0 ? 'text-pri-strategic' : 'text-pri-critical'">
                        <TrendingUp v-if="yearFinanceStats.nwChange >= 0" class="w-4 h-4" />
                        <TrendingDown v-else class="w-4 h-4" />
                        ₹{{ Math.abs(yearFinanceStats.nwChange).toLocaleString() }}
                        <span class="text-xs font-semibold">({{ yearFinanceStats.nwChange >= 0 ? '+' : '' }}{{ yearFinanceStats.nwGrowthPct.toFixed(1) }}%)</span>
                      </span>
                    </div>
                  </div>
                  <div v-else class="text-[11px] text-ink-3 italic text-center py-2">
                    No Net Worth snapshot logs found for this year.
                  </div>
                </div>

              </div>
              <div v-else class="text-xs text-ink-3 italic text-center py-12 bg-canvas/20 rounded-xl border border-dashed border-line flex flex-col items-center justify-center gap-2">
                <span class="font-medium">No financial transactions tracked for {{ selectedYear.year }}.</span>
                <span>Configure logs in the Finance section to populate annual analytics.</span>
              </div>
            </div>

          </div>

          <!-- Bottom Retrospective Journal -->
          <div class="border-t border-line/60 pt-6 mt-6 space-y-4">
            <h3 class="text-xs uppercase tracking-wider font-semibold text-ink-3 font-mono">Retrospective Journal</h3>
            <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div class="space-y-1.5">
                <label class="block text-xs font-bold text-pri-strategic">🏆 Wins</label>
                <textarea v-model="selectedYear.wins" @blur="saveReflections" rows="4" 
                  placeholder="What went well? Major achievements, goals hit..." 
                  class="w-full text-xs p-3 rounded-xl border border-line bg-canvas/30 focus:bg-white transition-all outline-none resize-none"></textarea>
              </div>
              <div class="space-y-1.5">
                <label class="block text-xs font-bold text-pri-critical">⚠️ Losses & Setbacks</label>
                <textarea v-model="selectedYear.losses" @blur="saveReflections" rows="4" 
                  placeholder="Setbacks, missed milestones, blockers..." 
                  class="w-full text-xs p-3 rounded-xl border border-line bg-canvas/30 focus:bg-white transition-all outline-none resize-none"></textarea>
              </div>
              <div class="space-y-1.5">
                <label class="block text-xs font-bold text-pri-interruptive">💡 Lessons Learned</label>
                <textarea v-model="selectedYear.lessons" @blur="saveReflections" rows="4" 
                  placeholder="Key takeaways, insights for next year..." 
                  class="w-full text-xs p-3 rounded-xl border border-line bg-canvas/30 focus:bg-white transition-all outline-none resize-none"></textarea>
              </div>
            </div>
            <div class="flex justify-between items-center text-[10px] text-ink-3">
              <span>✍️ Edits are auto-saved on click-outside/blur.</span>
            </div>
          </div>
        </div>

        <!-- Footer Actions -->
        <div class="flex justify-end pt-4 border-t border-line/50 shrink-0">
          <button class="btn-primary" @click="selectedYear = null">Close Summary</button>
        </div>

      </div>
    </div>

    <!-- NEW YEAR CREATOR DIALOG -->
    <div v-if="showNew" class="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div class="fixed inset-0 bg-ink/40 backdrop-blur-sm animate-fade-in" @click="showNew = false"></div>
      <form @submit.prevent="create" @keydown.meta.enter.prevent="create" @keydown.ctrl.enter.prevent="create" class="relative w-full max-w-md card p-8 animate-rise-in">
        <button type="button" class="absolute top-4 right-4 btn-ghost !p-1.5" @click="showNew = false"><X class="w-4 h-4" /></button>
        <div class="overline">New year</div>
        <h2 class="font-serif text-2xl mt-1 mb-6">A new chapter</h2>
        
        <div class="v-field-group mb-5">
          <input 
            ref="newYearInput" 
            type="number" 
            v-model="newYear" 
            placeholder=" " 
            class="v-field-input text-lg font-bold font-sans" 
            id="new-year-val" 
            required 
          />
          <label for="new-year-val" class="v-field-label text-base font-semibold">Year *</label>
        </div>

        <div class="v-field-group mb-6">
          <input 
            v-model="newTheme" 
            placeholder=" " 
            class="v-field-input text-base font-sans" 
            id="new-year-theme" 
          />
          <label for="new-year-theme" class="v-field-label text-base font-semibold">A theme for the year</label>
        </div>

        <div class="flex justify-end gap-2">
          <button type="button" class="btn-ghost" @click="showNew = false">Cancel</button>
          <button type="submit" class="btn-primary">
            Create <span class="kbd !bg-canvas/20 !border-canvas/10 !text-canvas select-none text-[9px] ml-1">⌘Enter</span>
          </button>
        </div>
      </form>
    </div>
  </div>
</template>
