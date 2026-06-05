<script setup>
import { computed } from 'vue'
import { derivePriority } from '@/lib/priority'

const props = defineProps({ important: Boolean, urgent: Boolean, compact: { type: Boolean, default: false } })
const p = computed(() => derivePriority(props.important, props.urgent))

const classes = computed(() => {
  const key = p.value.key
  return {
    bg: `bg-pri-${key}-bg`,
    text: `text-pri-${key}`,
    border: `border-pri-${key}-bd`,
    dot: `bg-pri-${key}`,
  }
})
</script>

<template>
  <span v-if="compact" class="inline-flex items-center gap-1.5 text-xs" :data-testid="`priority-badge-${p.key}`">
    <span class="priority-dot" :class="classes.dot"></span>
    <span :class="classes.text" class="font-medium">{{ p.label }}</span>
  </span>
  <span v-else
    class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-[11px] font-medium"
    :class="[classes.bg, classes.text, classes.border]"
    :data-testid="`priority-badge-${p.key}`">
    <span class="priority-dot" :class="classes.dot"></span>
    {{ p.label }}
  </span>
</template>
