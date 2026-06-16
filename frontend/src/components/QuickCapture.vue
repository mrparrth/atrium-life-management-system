<script setup>
import { useUIStore } from '@/stores/ui'
import TaskComposer from './TaskComposer.vue'
import { X } from 'lucide-vue-next'
const ui = useUIStore()
</script>

<template>
  <div class="fixed inset-0 z-40 flex items-center justify-center p-4" data-testid="quick-capture-overlay">
    <div class="fixed inset-0 bg-ink/40 backdrop-blur-sm animate-fade-in" @click="ui.closeQuickCapture"></div>
    <div class="relative w-full max-w-xl card p-8 shadow-xl shadow-black/10 animate-rise-in">
      <button class="absolute top-4 right-4 btn-ghost !p-1.5" @click="ui.closeQuickCapture" data-testid="quick-capture-close">
        <X class="w-4 h-4" />
      </button>
      <div class="mb-5">
        <div class="overline">Quick capture</div>
        <h2 class="font-serif text-2xl mt-1">Add to your quiet system</h2>
      </div>
      <TaskComposer @close="ui.closeQuickCapture" />
    </div>
  </div>
</template>
