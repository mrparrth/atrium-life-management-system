<script setup>
import { computed, ref, watch } from 'vue'
import { inr, inrCompact } from '@/lib/money'

const props = defineProps({
  data: { type: Array, default: () => [] }, // Array of { label: String, value: Number }
  series: { type: Array, default: () => [] }, // Array of { name: String, color: String, data: [{label, value}] }
  height: { type: Number, default: 220 },
  color: { type: String, default: '#5A7353' } // Strategic green default
})

const container = ref(null)
const hoverIdx = ref(null)
const mouseX = ref(0)
const mouseY = ref(0)

const width = 500 // fixed internal coordinates for SVG grid
const svgHeight = computed(() => props.height)

const activeSeries = computed(() => {
  if (props.series && props.series.length > 0) return props.series
  if (props.data && props.data.length > 0) return [{ name: 'Value', color: props.color, data: props.data }]
  return []
})

const minMax = computed(() => {
  let min = Infinity
  let max = -Infinity
  let hasData = false
  
  activeSeries.value.forEach(s => {
    s.data.forEach(d => {
      hasData = true
      if (d.value < min) min = d.value
      if (d.value > max) max = d.value
    })
  })
  
  if (!hasData) return { min: 0, max: 0, range: 1 }
  const pad = (max - min) * 0.1 || 1
  return {
    min: Math.max(0, min - pad),
    max: max + pad,
    range: (max - min) * 1.2 || 1
  }
})

const seriesPoints = computed(() => {
  const { min, max } = minMax.value
  const range = (max - min) || 1
  
  return activeSeries.value.map(s => {
    const pts = s.data.map((item, i) => {
      const x = (i / (s.data.length - 1 || 1)) * (width - 40) + 20
      const y = svgHeight.value - ((item.value - min) / range) * (svgHeight.value - 40) - 20
      return { x, y, label: item.label, value: item.value }
    })
    
    const path = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')
    let areaPath = ''
    if (pts.length > 1) {
      const firstX = pts[0].x
      const lastX = pts[pts.length - 1].x
      areaPath = `${path} L ${lastX.toFixed(1)},${svgHeight.value} L ${firstX.toFixed(1)},${svgHeight.value} Z`
    }
    
    return { name: s.name, color: s.color, pts, path, areaPath }
  })
})

const gridLines = computed(() => {
  const { min, max } = minMax.value
  const count = 3
  const lines = []
  for (let i = 0; i <= count; i++) {
    const val = min + (i / count) * (max - min)
    const y = svgHeight.value - (i / count) * (svgHeight.value - 40) - 20
    lines.push({ y, val })
  }
  return lines
})

function onMouseMove(e) {
  if (!container.value || !seriesPoints.value.length) return
  const firstSeriesPts = seriesPoints.value[0].pts
  if (!firstSeriesPts.length) return
  
  const rect = container.value.getBoundingClientRect()
  const clientX = e.clientX - rect.left
  const pctX = clientX / rect.width
  const svgX = pctX * width
  
  let closestIdx = 0
  let minDist = Infinity
  firstSeriesPts.forEach((p, idx) => {
    const dist = Math.abs(p.x - svgX)
    if (dist < minDist) {
      minDist = dist
      closestIdx = idx
    }
  })
  
  hoverIdx.value = closestIdx
  mouseX.value = (firstSeriesPts[closestIdx].x / width) * rect.width
  mouseY.value = (firstSeriesPts[closestIdx].y / svgHeight.value) * rect.height
}

function onMouseLeave() {
  hoverIdx.value = null
}

const xLabels = computed(() => {
  if (!seriesPoints.value.length || !seriesPoints.value[0].pts.length) return []
  const pts = seriesPoints.value[0].pts
  const labels = [pts[0].label]
  if (pts.length > 2) labels.push(pts[Math.floor(pts.length / 2)].label)
  if (pts.length > 1) labels.push(pts[pts.length - 1].label)
  return labels
})
</script>

<template>
  <div class="relative w-full" ref="container" @mousemove="onMouseMove" @mouseleave="onMouseLeave">
    <div v-if="!activeSeries.length || !activeSeries[0].data.length" class="flex items-center justify-center h-48 border border-dashed border-line rounded-xl text-ink-3 font-serif italic">
      No data logged for this view yet.
    </div>
    
    <template v-else>
      <div class="absolute left-2 top-0 bottom-0 pointer-events-none flex flex-col justify-between text-[10px] text-ink-3 py-4 font-mono select-none z-10">
        <span v-for="line in [...gridLines].reverse()" :key="line.val">{{ inrCompact(line.val) }}</span>
      </div>

      <svg :viewBox="`0 0 ${width} ${svgHeight}`" class="w-full overflow-visible" preserveAspectRatio="none">
        <defs>
          <linearGradient v-for="(s, i) in seriesPoints" :key="`grad-${i}`" :id="`chart-grad-${i}`" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" :stop-color="s.color" stop-opacity="0.12" />
            <stop offset="100%" :stop-color="s.color" stop-opacity="0.00" />
          </linearGradient>
        </defs>

        <g stroke="currentColor" class="text-line/60" stroke-width="1">
          <line v-for="line in gridLines" :key="line.y" x1="10" :y1="line.y" :x2="width - 10" :y2="line.y" stroke-dasharray="3,3" />
        </g>

        <!-- Area Fills (only for single series to avoid muddying) -->
        <path v-if="seriesPoints.length === 1" :d="seriesPoints[0].areaPath" fill="url(#chart-grad-0)" />

        <!-- Line Paths -->
        <path v-for="(s, i) in seriesPoints" :key="`path-${i}`" :d="s.path" :stroke="s.color" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round" />

        <!-- Static dots for all series -->
        <g v-for="(s, i) in seriesPoints" :key="`dots-${i}`" :fill="s.color">
          <circle 
            v-for="(p, idx) in s.pts" 
            :key="idx" 
            :cx="p.x" 
            :cy="p.y" 
            :r="hoverIdx === idx ? 5 : (seriesPoints.length === 1 ? 3 : 2)" 
            class="transition-all duration-150"
            :stroke="hoverIdx === idx ? '#F9F8F6' : 'none'"
            stroke-width="1.5"
          />
        </g>
      </svg>

      <!-- Tooltip -->
      <div 
        v-if="hoverIdx !== null" 
        class="absolute pointer-events-none bg-surface/95 dark:bg-elevated/95 backdrop-blur border border-line-2 px-3 py-2 rounded-xl shadow-lg z-20 text-xs flex flex-col gap-1.5 transition-all duration-100 min-w-[140px]"
        :style="{ 
          left: `${Math.min(mouseX + 16, container.getBoundingClientRect().width - 160)}px`, 
          top: `${Math.max(mouseY - 45, 10)}px` 
        }"
      >
        <div class="overline text-[10px] text-ink-3 border-b border-line pb-1 mb-0.5">{{ seriesPoints[0].pts[hoverIdx].label }}</div>
        <div v-for="(s, i) in seriesPoints" :key="`tt-${i}`" class="flex justify-between items-baseline gap-3">
          <div class="flex items-center gap-1.5">
            <div class="w-2 h-2 rounded-full" :style="{ backgroundColor: s.color }"></div>
            <span class="text-ink-2 truncate max-w-[80px]" :title="s.name">{{ s.name }}</span>
          </div>
          <span class="font-mono font-medium text-ink">{{ inr(s.pts[hoverIdx].value) }}</span>
        </div>
      </div>

      <!-- X-axis labels -->
      <div class="flex justify-between text-[10px] text-ink-3 mt-1.5 px-4 font-mono select-none">
        <span v-for="(lbl, i) in xLabels" :key="i">{{ lbl }}</span>
      </div>
    </template>
  </div>
</template>
