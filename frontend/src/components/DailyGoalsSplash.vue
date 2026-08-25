<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import dayjs from 'dayjs'
import { useGoalsStore } from '@/stores/goals'
import { useSettingsStore } from '@/stores/settings'
import { Sparkles, Target } from 'lucide-vue-next'

const goalsStore = useGoalsStore()
const settingsStore = useSettingsStore()

const visible = ref(false)
const isFadingOut = ref(false)
let autoDismissTimer = null

const activeGoals = computed(() => {
  return goalsStore.items.filter(g => g.status !== 'archived' && g.status !== 'completed').slice(0, 4)
})

function triggerSplash(force = false) {
  const durationSec = Number(settingsStore.get('daily_goal_splash_duration', 3))
  const enabled = settingsStore.get('daily_goal_splash_enabled', true) && (durationSec > 0 || force)
  if (!enabled && !force) return

  const activeCount = goalsStore.items.filter(g => g.status !== 'archived' && g.status !== 'completed').length
  if (activeCount === 0 && !force) return

  const todayStr = dayjs().format('YYYY-MM-DD')
  const lastSplashDate = localStorage.getItem('atrium.last_daily_goal_splash_date')

  if (!force && lastSplashDate === todayStr) return

  if (!force) {
    localStorage.setItem('atrium.last_daily_goal_splash_date', todayStr)
  }

  isFadingOut.value = false
  visible.value = true

  const activeDuration = (durationSec === 0 ? 3 : durationSec) * 1000

  if (autoDismissTimer) clearTimeout(autoDismissTimer)
  autoDismissTimer = setTimeout(() => {
    dismiss()
  }, activeDuration)
}

function dismiss() {
  if (isFadingOut.value) return
  isFadingOut.value = true
  setTimeout(() => {
    visible.value = false
    isFadingOut.value = false
  }, 700)
}

function handleKeydown() {
  if (visible.value) {
    dismiss()
  }
}

onMounted(async () => {
  await goalsStore.load()
  await settingsStore.load()

  setTimeout(() => {
    triggerSplash(false)
  }, 400)

  window.addEventListener('atrium-trigger-goals-splash', () => triggerSplash(true))
  window.addEventListener('keydown', handleKeydown)
})

onBeforeUnmount(() => {
  if (autoDismissTimer) clearTimeout(autoDismissTimer)
  window.removeEventListener('atrium-trigger-goals-splash', () => triggerSplash(true))
  window.removeEventListener('keydown', handleKeydown)
})
</script>

<template>
  <Transition name="splash-fade">
    <div
      v-if="visible"
      class="fixed inset-0 z-[9999] flex flex-col items-center justify-center p-6 md:p-12 bg-surface/98 backdrop-blur-2xl text-ink select-none cursor-pointer transition-all duration-700"
      :class="{ 'opacity-0 scale-98 pointer-events-none': isFadingOut }"
      @click="dismiss"
      data-testid="daily-goals-splash"
    >
      <!-- Background subtle gradient glow -->
      <div class="absolute inset-0 bg-radial from-emerald-500/10 via-transparent to-transparent opacity-60 pointer-events-none"></div>

      <!-- Top Header Badge -->
      <div class="relative z-10 flex flex-col items-center text-center max-w-2xl space-y-3 mb-8 animate-rise-in">
        <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-mono font-semibold uppercase tracking-wider">
          <Sparkles class="w-3.5 h-3.5" />
          <span>Daily Morning Focus</span>
        </div>

        <h1 class="font-serif italic text-3xl md:text-5xl text-ink font-normal tracking-tight leading-tight">
          Remember what you are working towards
        </h1>
        <p class="text-xs md:text-sm text-ink-3 tracking-wide">
          Keep your primary aspirations aligned with today's focus.
        </p>
      </div>

      <!-- Active Goals Clean Minimal List -->
      <div v-if="activeGoals.length" class="relative z-10 w-full max-w-2xl space-y-3 mb-10 animate-fade-in">
        <div
          v-for="goal in activeGoals"
          :key="goal.id"
          class="flex items-center justify-between gap-4 py-3 border-b border-line/30 last:border-0"
        >
          <div class="flex items-center gap-3 min-w-0">
            <span class="w-2 h-2 rounded-full bg-emerald-500 shrink-0"></span>
            <span class="font-serif text-xl md:text-2xl text-ink font-normal truncate">
              {{ goal.title }}
            </span>
          </div>

          <span class="text-xs md:text-sm font-mono font-semibold text-ink-3 shrink-0">
            <template v-if="goal.useNumeric">
              {{ goal.achievedNumber }} / {{ goal.targetNumber }} {{ goal.unit }}
            </template>
            <template v-else>
              {{ goal.targetNumber > 0 ? Math.round((goal.achievedNumber / goal.targetNumber) * 100) : 0 }}%
            </template>
          </span>
        </div>
      </div>

      <!-- Dismiss hint at bottom -->
      <div class="relative z-10 text-[11px] text-ink-3 font-mono tracking-wider animate-pulse flex items-center gap-2">
        <span>Click anywhere or press any key to dismiss</span>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.splash-fade-enter-active,
.splash-fade-leave-active {
  transition: opacity 0.7s cubic-bezier(0.16, 1, 0.3, 1), transform 0.7s cubic-bezier(0.16, 1, 0.3, 1);
}
.splash-fade-enter-from,
.splash-fade-leave-to {
  opacity: 0;
  transform: scale(0.98);
}
</style>
