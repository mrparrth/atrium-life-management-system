<script setup>
import { computed } from 'vue'
import { useUIStore } from '@/stores/ui'
import { CheckCircle2, AlertCircle, Info } from 'lucide-vue-next'

const ui = useUIStore()
const t = computed(() => ui.toast)
</script>

<template>
  <transition name="fade">
    <div v-if="t" class="fixed bottom-6 left-1/2 -translate-x-1/2 z-50" data-testid="toast">
      <div class="flex items-center gap-3 px-5 py-3 rounded-2xl bg-ink text-canvas shadow-lg shadow-black/10 border border-ink/30">
        <CheckCircle2 v-if="t.type === 'success'" class="w-4 h-4" />
        <AlertCircle v-else-if="t.type === 'error'" class="w-4 h-4" />
        <Info v-else class="w-4 h-4" />
        <span class="text-sm">{{ t.msg }}</span>
      </div>
    </div>
  </transition>
</template>
