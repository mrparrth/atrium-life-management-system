<script setup>
import { computed } from 'vue'

const props = defineProps({
  dense: {
    type: Boolean,
    default: false
  },
  align: {
    type: String,
    default: 'start'
  },
  justify: {
    type: String,
    default: 'start'
  }
})

const rowClass = computed(() => {
  return [
    'flex flex-wrap',
    props.dense ? '-mx-2' : '-mx-3',
    `items-${props.align}`,
    `justify-${props.justify}`
  ].filter(Boolean).join(' ')
})
</script>

<template>
  <div :class="rowClass">
    <slot></slot>
  </div>
</template>
