<script setup>
import { computed } from 'vue'
import { derivePriority } from '@/lib/priority'

const props = defineProps({
  important: Boolean,
  urgent: Boolean,
  compact: { type: Boolean, default: false },
  numeric: { type: Boolean, default: false }
})
const p = computed(() => derivePriority(props.important, props.urgent))

const classes = computed(() => {
  const key = p.value.key
  if (key === 'critical') {
    return {
      bg: 'bg-pri-critical-bg',
      text: 'text-pri-critical',
      border: 'border-pri-critical-bd',
      dot: 'bg-pri-critical',
    }
  } else if (key === 'strategic') {
    return {
      bg: 'bg-pri-strategic-bg',
      text: 'text-pri-strategic',
      border: 'border-pri-strategic-bd',
      dot: 'bg-pri-strategic',
    }
  } else if (key === 'interruptive') {
    return {
      bg: 'bg-pri-interruptive-bg',
      text: 'text-pri-interruptive',
      border: 'border-pri-interruptive-bd',
      dot: 'bg-pri-interruptive',
    }
  } else {
    // backlog (Low)
    return {
      bg: 'bg-pri-backlog-bg',
      text: 'text-pri-backlog',
      border: 'border-pri-backlog-bd',
      dot: 'bg-pri-backlog',
    }
  }
})
</script>

<template>
  <span v-if="compact" class="inline-flex items-center gap-1.5 text-xs justify-start" :class="numeric ? 'w-auto' : 'w-[104px]'" :data-testid="`priority-badge-${p.key}`">
    <span class="priority-dot shrink-0" :class="classes.dot"></span>
    <span :class="classes.text" class="font-medium truncate">{{ numeric ? p.label.charAt(0) : p.label }}</span>
  </span>
  <span v-else
    class="inline-flex items-center gap-1.5 py-0.5 rounded-full border text-[11px] font-medium justify-start"
    :class="[classes.bg, classes.text, classes.border, numeric ? 'w-auto px-2' : 'w-[104px] px-2.5']"
    :data-testid="`priority-badge-${p.key}`">
    <span class="priority-dot shrink-0" :class="classes.dot"></span>
    <span class="truncate">{{ numeric ? p.label.charAt(0) : p.label }}</span>
  </span>
</template>
