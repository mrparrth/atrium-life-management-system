<script setup>
import { computed } from 'vue'
import { Line } from 'vue-chartjs'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js'
import { inr, inrCompact } from '@/lib/money'

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
)

const props = defineProps({
  data: { type: Array, default: () => [] }, // Array of { label: String, value: Number }
  series: { type: Array, default: () => [] }, // Array of { name: String, color: String, data: [{label, value}] }
  height: { type: Number, default: 220 },
  color: { type: String, default: '#5A7353' } // Strategic green default
})

const activeSeries = computed(() => {
  if (props.series && props.series.length > 0) return props.series
  if (props.data && props.data.length > 0) return [{ name: 'Value', color: props.color, data: props.data }]
  return []
})

function parseLabel(label) {
  if (!label) return 0
  const str = String(label).trim()
  
  // Case 1: Pure year (e.g., "2020")
  if (/^\d{4}$/.test(str)) {
    return new Date(parseInt(str, 10), 0, 1).getTime()
  }
  
  // Case 2: Standard short date string like "Dec 2020", "Mar 2021"
  const parsed = Date.parse(`1 ${str}`)
  if (!isNaN(parsed)) {
    return parsed
  }
  
  // Case 3: ISO like "2020-12" or similar
  const parsedISO = Date.parse(str)
  if (!isNaN(parsedISO)) {
    return parsedISO
  }
  
  return 0
}

function hexToRgba(hex, alpha) {
  if (!hex || !hex.startsWith('#')) return hex
  const clean = hex.replace('#', '')
  let r, g, b
  if (clean.length === 3) {
    r = parseInt(clean[0] + clean[0], 16)
    g = parseInt(clean[1] + clean[1], 16)
    b = parseInt(clean[2] + clean[2], 16)
  } else {
    r = parseInt(clean.slice(0, 2), 16)
    g = parseInt(clean.slice(2, 4), 16)
    b = parseInt(clean.slice(4, 6), 16)
  }
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

const chartData = computed(() => {
  return {
    datasets: activeSeries.value.map(s => ({
      label: s.name,
      data: s.data.map(d => ({
        x: parseLabel(d.label),
        y: d.value
      })),
      borderColor: s.color || props.color,
      backgroundColor: hexToRgba(s.color || props.color, 0.08),
      fill: activeSeries.value.length === 1,
      tension: 0.35,
      borderWidth: 2.5,
      pointRadius: 3.5,
      pointHoverRadius: 6,
      pointBackgroundColor: s.color || props.color,
      pointHoverBackgroundColor: '#F9F8F6',
      pointHoverBorderColor: s.color || props.color,
      pointHoverBorderWidth: 2,
    }))
  }
})

const chartOptions = computed(() => {
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: activeSeries.value.length > 1,
        position: 'top',
        labels: {
          color: 'var(--color-ink-2, #8E8D8A)',
          font: { family: 'sans-serif', size: 11, weight: '500' },
          boxWidth: 8,
          boxHeight: 8,
          usePointStyle: true,
          pointStyle: 'circle',
          padding: 15
        }
      },
      tooltip: {
        mode: 'index',
        intersect: false,
        backgroundColor: 'rgba(30, 30, 30, 0.95)',
        titleColor: '#A5A5A5',
        bodyColor: '#F9F8F6',
        titleFont: { family: 'sans-serif', size: 10, weight: 'bold' },
        bodyFont: { family: 'serif', size: 12 },
        padding: 10,
        cornerRadius: 8,
        borderColor: 'rgba(255,255,255,0.1)',
        borderWidth: 1,
        callbacks: {
          title: function (context) {
            if (!context.length) return ''
            const value = context[0].parsed.x
            const d = new Date(value)
            if (isNaN(d.getTime())) return ''
            const allYears = activeSeries.value.every(s => 
              s.data.every(d => /^\d{4}$/.test(String(d.label).trim()))
            )
            if (allYears) {
              return d.getFullYear().toString()
            }
            return d.toLocaleString('en-US', { month: 'short', year: 'numeric' })
          },
          label: function (context) {
            const label = context.dataset.label || ''
            const val = context.raw.y !== undefined ? context.raw.y : context.raw
            return ` ${label}: ${inr(val)}`
          },
          labelTextColor: function () {
            return '#F9F8F6'
          }
        }
      }
    },
    scales: {
      x: {
        type: 'linear',
        grid: {
          display: false
        },
        ticks: {
          color: 'var(--color-ink-3, #8E8D8A)',
          font: { family: 'monospace', size: 10 },
          callback: function (value) {
            const d = new Date(value)
            if (isNaN(d.getTime())) return value
            const allYears = activeSeries.value.every(s => 
              s.data.every(d => /^\d{4}$/.test(String(d.label).trim()))
            )
            if (allYears) {
              return d.getFullYear().toString()
            }
            return d.toLocaleString('en-US', { month: 'short', year: 'numeric' })
          }
        }
      },
      y: {
        grid: {
          display: false
        },
        border: {
          display: false
        },
        ticks: {
          color: 'var(--color-ink-3, #8E8D8A)',
          font: { family: 'monospace', size: 10 },
          callback: function (value) {
            return inrCompact(value)
          }
        }
      }
    },
    interaction: {
      mode: 'nearest',
      axis: 'x',
      intersect: false
    }
  }
})
</script>

<template>
  <div class="relative w-full" :style="{ height: `${height}px` }">
    <div v-if="!activeSeries.length || !activeSeries[0].data.length" 
      class="flex items-center justify-center border border-dashed border-line rounded-xl text-ink-3 font-serif italic h-full">
      No data logged for this view yet.
    </div>
    <div v-else class="w-full h-full">
      <Line :data="chartData" :options="chartOptions" />
    </div>
  </div>
</template>
