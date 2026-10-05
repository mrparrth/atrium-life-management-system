<script setup>
defineProps({
  text: {
    type: String,
    default: ''
  },
  position: {
    type: String,
    default: 'top' // 'top', 'bottom', 'left', 'right'
  },
  contentClass: {
    type: String,
    default: ''
  }
})
</script>

<template>
  <div class="group relative inline-flex items-center">
    <!-- Trigger Element Slot -->
    <slot />

    <!-- Tooltip Element -->
    <div 
      class="absolute hidden group-hover:block bg-ink text-canvas text-[10px] px-2.5 py-1.5 rounded-lg shadow-xl whitespace-pre-wrap w-max max-w-[280px] z-[99] font-sans font-normal leading-normal select-text pointer-events-none animate-rise-in"
      :class="[
        position === 'top' && 'bottom-full left-1/2 -translate-x-1/2 mb-2',
        position === 'top-right' && 'bottom-full right-0 mb-2',
        position === 'top-left' && 'bottom-full left-0 mb-2',
        position === 'bottom' && 'top-full left-1/2 -translate-x-1/2 mt-2',
        position === 'bottom-right' && 'top-full right-0 mt-2',
        position === 'bottom-left' && 'top-full left-0 mt-2',
        position === 'left' && 'right-full top-1/2 -translate-y-1/2 mr-2',
        position === 'right' && 'left-full top-1/2 -translate-y-1/2 ml-2',
        contentClass
      ]"
    >
      <slot name="content">{{ text }}</slot>
    </div>
  </div>
</template>
