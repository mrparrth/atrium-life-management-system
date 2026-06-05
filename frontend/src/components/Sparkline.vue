<script setup>
import { computed } from 'vue'
const props = defineProps({ data: { type: Array, required: true }, height: { type: Number, default: 60 }, color: { type: String, default: 'currentColor' } })
const path = computed(() => {
  const d = props.data
  if (!d.length) return ''
  const w = 200, h = props.height
  const min = Math.min(...d), max = Math.max(...d)
  const range = (max - min) || 1
  return d.map((v, i) => {
    const x = (i / (d.length - 1)) * w
    const y = h - ((v - min) / range) * (h - 4) - 2
    return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`
  }).join(' ')
})
const area = computed(() => {
  if (!path.value) return ''
  return `${path.value} L 200,${props.height} L 0,${props.height} Z`
})
</script>

<template>
  <svg viewBox="0 0 200 60" :height="height" preserveAspectRatio="none" class="w-full">
    <defs>
      <linearGradient :id="`grad-${color}`" x1="0" x2="0" y1="0" y2="1">
        <stop offset="0%" :stop-color="color" stop-opacity="0.18" />
        <stop offset="100%" :stop-color="color" stop-opacity="0" />
      </linearGradient>
    </defs>
    <path :d="area" :fill="`url(#grad-${color})`" />
    <path :d="path" :stroke="color" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round" />
  </svg>
</template>
