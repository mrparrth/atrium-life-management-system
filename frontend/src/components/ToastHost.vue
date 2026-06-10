<script setup>
import { useUIStore } from '@/stores/ui'
import { CheckCircle2, AlertCircle, Info, AlertTriangle, X } from 'lucide-vue-next'

const ui = useUIStore()
</script>

<template>
  <div class="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex flex-col gap-3 max-w-sm w-full px-4 pointer-events-none" data-testid="toast-host">
    <transition-group name="toast-list">
      <div v-for="t in ui.toasts" :key="t.id"
        class="pointer-events-auto flex items-center justify-between gap-3 px-4 py-3.5 rounded-xl border shadow-lg backdrop-blur-md transition-all duration-300"
        :class="{
          'bg-pri-strategic-bg/90 border-pri-strategic-bd/50 text-ink': t.type === 'success',
          'bg-pri-critical-bg/90 border-pri-critical-bd/50 text-pri-critical': t.type === 'error',
          'bg-pri-interruptive-bg/90 border-pri-interruptive-bd/50 text-pri-interruptive': t.type === 'warning',
          'bg-surface/90 border-line text-ink-2': t.type === 'info',
        }"
        data-testid="toast"
      >
        <div class="flex items-center gap-2.5">
          <CheckCircle2 v-if="t.type === 'success'" class="w-4 h-4 text-pri-strategic shrink-0" />
          <AlertTriangle v-else-if="t.type === 'warning'" class="w-4 h-4 text-pri-interruptive shrink-0" />
          <AlertCircle v-else-if="t.type === 'error'" class="w-4 h-4 text-pri-critical shrink-0" />
          <Info v-else class="w-4 h-4 text-ink-3 shrink-0" />
          <span class="text-xs font-semibold leading-relaxed">{{ t.msg }}</span>
        </div>
        <button @click="ui.removeToast(t.id)" class="text-ink-3 hover:text-ink transition-colors p-1 rounded-lg hover:bg-canvas/30 shrink-0">
          <X class="w-3.5 h-3.5" />
        </button>
      </div>
    </transition-group>
  </div>
</template>

<style scoped>
.toast-list-enter-from {
  opacity: 0;
  transform: translateY(16px) scale(0.95);
}
.toast-list-leave-to {
  opacity: 0;
  transform: translateY(-8px) scale(0.95);
}
.toast-list-enter-active,
.toast-list-leave-active {
  transition: all 0.3s ease;
}
.toast-list-leave-active {
  position: absolute;
}
</style>
