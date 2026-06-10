<script setup>
import { X, HelpCircle } from 'lucide-vue-next'

defineProps({
  isOpen: Boolean
})

defineEmits(['close'])

const cheatSheet = [
  {
    title: 'Headers',
    items: [
      { label: 'Heading 1', syntax: '# Title', result: 'Title (Large)' },
      { label: 'Heading 2', syntax: '## Subtitle', result: 'Subtitle (Medium)' },
      { label: 'Heading 3', syntax: '### Section', result: 'Section (Small)' }
    ]
  },
  {
    title: 'Text Style',
    items: [
      { label: 'Bold', syntax: '**text**', result: 'bold text' },
      { label: 'Italic', syntax: '*text*', result: 'italic text' },
      { label: 'Strikethrough', syntax: '~~text~~', result: 'strikethrough' },
      { label: 'Inline Code', syntax: '`code`', result: 'monospace text' }
    ]
  },
  {
    title: 'Lists & Blocks',
    items: [
      { label: 'Bullet List', syntax: '- Item', result: '• Bulleted item' },
      { label: 'Numbered List', syntax: '1. Item', result: '1. Numbered item' },
      { label: 'Task List', syntax: '- [ ] Task', result: '☐ Unchecked box' },
      { label: 'Completed Task', syntax: '- [x] Done', result: '☑ Checked box' },
      { label: 'Quote', syntax: '> text', result: 'Indented blockquote' }
    ]
  },
  {
    title: 'Links & References',
    items: [
      { label: 'External Link', syntax: '[Google](https://google.com)', result: 'Clickable link' },
      { label: 'Note Link', syntax: '[[Note Title]]', result: 'Links to another note' }
    ]
  }
]
</script>

<template>
  <Transition name="fade">
    <div v-if="isOpen" class="fixed inset-0 z-50 flex items-center justify-center p-4">
      <!-- Backdrop -->
      <div class="fixed inset-0 bg-ink/40 backdrop-blur-sm transition-opacity" @click="$emit('close')"></div>
      
      <!-- Modal Content -->
      <div class="relative w-full max-w-xl bg-surface border border-line rounded-2xl shadow-xl shadow-black/15 overflow-hidden animate-rise-in max-h-[85vh] flex flex-col">
        <!-- Header -->
        <div class="px-6 py-4 border-b border-line flex items-center justify-between bg-canvas/30 shrink-0">
          <div class="flex items-center gap-2">
            <HelpCircle class="w-5 h-5 text-pri-strategic" />
            <h3 class="font-serif text-lg font-bold text-ink">Markdown Guide</h3>
          </div>
          <button @click="$emit('close')" class="btn-ghost !p-1.5 rounded-lg text-ink-3 hover:text-ink">
            <X class="w-4 h-4" />
          </button>
        </div>

        <!-- Body -->
        <div class="p-6 overflow-y-auto space-y-6">
          <p class="text-xs text-ink-2 leading-relaxed">
            Format your notes as you type using standard Markdown tags. 
            Wiki-links (<code>[[Note Name]]</code>) allow you to link notes together dynamically.
          </p>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div v-for="section in cheatSheet" :key="section.title" class="space-y-3">
              <h4 class="overline text-xs text-ink-3 font-bold border-b border-line/50 pb-1">{{ section.title }}</h4>
              <div class="space-y-2.5">
                <div v-for="item in section.items" :key="item.label" class="flex flex-col gap-0.5">
                  <div class="flex justify-between text-xs font-medium">
                    <span class="text-ink-2">{{ item.label }}</span>
                    <code class="bg-canvas/60 px-1.5 py-0.5 rounded text-[10px] text-pri-strategic font-mono font-bold select-all">{{ item.syntax }}</code>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Footer -->
        <div class="px-6 py-4 border-t border-line bg-canvas/20 shrink-0 flex justify-end">
          <button @click="$emit('close')" class="btn-primary !py-1.5 px-4 text-xs font-semibold">Got it</button>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
