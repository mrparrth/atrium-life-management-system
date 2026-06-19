<script setup>
import { computed } from 'vue'
import { Doughnut } from 'vue-chartjs'
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js'
import { inr } from '@/lib/money'

ChartJS.register(ArcElement, Tooltip, Legend)

const props = defineProps({
  data: {
    type: Array,
    required: true, // Array of { key: String, label: String, value: Number, pct: Number }
  },
  theme: {
    type: String,
    default: 'strategic' // 'strategic', 'critical', 'mixed'
  }
})

// Palette mapping
const palettes = {
  strategic: [
    'rgba(90, 115, 83, 0.85)',
    'rgba(115, 140, 108, 0.85)',
    'rgba(140, 166, 133, 0.85)',
    'rgba(166, 191, 159, 0.85)',
    'rgba(191, 217, 184, 0.85)',
    'rgba(217, 242, 210, 0.85)',
  ],
  critical: [
    'rgba(169, 74, 74, 0.85)',
    'rgba(196, 100, 100, 0.85)',
    'rgba(222, 126, 126, 0.85)',
    'rgba(247, 153, 153, 153, 0.85)',
    'rgba(255, 180, 180, 0.85)',
    'rgba(255, 207, 207, 0.85)',
  ],
  mixed: [
    'rgba(90, 115, 83, 0.85)',
    'rgba(169, 74, 74, 0.85)',
    'rgba(158, 132, 87, 0.85)',
    'rgba(74, 139, 169, 0.85)',
    'rgba(143, 119, 176, 0.85)',
    'rgba(196, 138, 94, 0.85)',
  ]
}

const chartData = computed(() => {
  const colors = palettes[props.theme] || palettes.mixed
  return {
    labels: props.data.map(item => (item.key || '').replace(/_/g, ' ')),
    datasets: [
      {
        data: props.data.map(item => item.value),
        backgroundColor: props.data.map((_, i) => colors[i % colors.length]),
        borderColor: '#F9F8F6',
        borderWidth: 2,
        hoverOffset: 4,
      }
    ]
  }
})

const total = computed(() => props.data.reduce((s, e) => s + e.value, 0))

const chartOptions = computed(() => {
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false
      },
      tooltip: {
        callbacks: {
          label: function (context) {
            const val = context.raw
            const pct = total.value > 0 ? ((val / total.value) * 100).toFixed(0) : 0
            return ` ${inr(val)} (${pct}%)`
          }
        },
        backgroundColor: 'rgba(30, 30, 30, 0.9)',
        titleFont: { family: 'serif', size: 13 },
        bodyFont: { family: 'sans-serif', size: 12 },
        padding: 10,
        cornerRadius: 8,
      }
    },
    cutout: '65%'
  }
})
</script>

<template>
  <div class="flex flex-col md:flex-row items-center gap-8 py-2">
    <!-- Chart Canvas -->
    <div class="relative w-44 h-44 shrink-0">
      <Doughnut :data="chartData" :options="chartOptions" />
      <div class="absolute inset-0 flex flex-col items-center justify-center pointer-events-none select-none">
        <span class="overline text-[9px] text-ink-3">Total</span>
        <span class="font-serif text-lg font-semibold text-ink mt-0.5 leading-none">{{ inr(total) }}</span>
      </div>
    </div>

    <!-- Customized Legend -->
    <div class="flex-1 w-full space-y-3">
      <div v-for="(item, i) in props.data" :key="item.key" class="flex items-center justify-between text-sm">
        <div class="flex items-center gap-2 min-w-0">
          <div 
            class="w-2.5 h-2.5 rounded-full shrink-0" 
            :style="{ backgroundColor: (palettes[props.theme] || palettes.mixed)[i % (palettes[props.theme] || palettes.mixed).length] }"
          ></div>
          <span class="capitalize text-ink-2 truncate">{{ (item.key || '').replace(/_/g, ' ') }}</span>
        </div>
        <span class="font-mono text-ink font-medium shrink-0 ml-4">
          {{ inr(item.value) }} <span class="text-ink-3 text-xs font-sans">({{ item.pct.toFixed(0) }}%)</span>
        </span>
      </div>
    </div>
  </div>
</template>
