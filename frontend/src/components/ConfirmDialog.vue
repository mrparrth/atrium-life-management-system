<script setup>
import { onMounted, ref } from 'vue'
import { useUIStore } from '@/stores/ui'
import { X, AlertTriangle } from 'lucide-vue-next'

const ui = useUIStore()
const confirmBtn = ref(null)

onMounted(() => {
  confirmBtn.value?.focus()
})

function onKey(e) {
  if (e.key === 'Escape') {
    ui.confirmState.resolve(false)
  }
}
</script>

<template>
  <div class="fixed inset-0 z-50 flex items-center justify-center p-4" data-testid="confirm-dialog-overlay" @keydown.window="onKey">
    <div class="fixed inset-0 bg-ink/40 backdrop-blur-sm animate-fade-in" @click="ui.confirmState.resolve(false)"></div>
    <div class="relative w-full max-w-md card p-6 shadow-2xl shadow-black/20 animate-rise-in" role="dialog" aria-modal="true" data-testid="confirm-dialog">
      <button class="absolute top-4 right-4 btn-ghost !p-1.5" @click="ui.confirmState.resolve(false)" data-testid="confirm-close">
        <X class="w-4 h-4" />
      </button>
      
      <div class="flex items-start gap-4 mt-2">
        <div class="p-2 rounded-xl bg-pri-critical-bg border border-pri-critical-bd text-pri-critical shrink-0">
          <AlertTriangle class="w-5 h-5" />
        </div>
        <div class="flex-1 min-w-0">
          <h3 class="font-serif text-xl text-ink font-medium leading-snug">{{ ui.confirmState.title }}</h3>
          <p class="text-sm text-ink-2 mt-2 leading-relaxed">{{ ui.confirmState.message }}</p>
        </div>
      </div>

      <div class="flex items-center justify-end gap-3 mt-6">
        <button class="btn-secondary" @click="ui.confirmState.resolve(false)" data-testid="confirm-cancel-btn">
          {{ ui.confirmState.cancelText }}
        </button>
        <button 
          ref="confirmBtn" 
          :class="[
            'btn-primary', 
            ui.confirmState.isDestructive ? '!bg-pri-critical !text-pri-critical-bg hover:opacity-90' : ''
          ]" 
          @click="ui.confirmState.resolve(true)"
          data-testid="confirm-confirm-btn"
        >
          {{ ui.confirmState.confirmText }}
        </button>
      </div>
    </div>
  </div>
</template>
