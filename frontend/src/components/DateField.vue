<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-vue-next'
import dayjs from 'dayjs'

const props = defineProps({
  modelValue: {
    type: String,
    default: ''
  },
  label: {
    type: String,
    required: true
  },
  id: {
    type: String,
    required: true
  },
  dataTestid: {
    type: String,
    default: ''
  },
  popoverPosition: {
    type: String,
    default: 'bottom'
  }
})

const emit = defineEmits(['update:modelValue'])

const dateVal = computed({
  get: () => props.modelValue || '',
  set: (val) => emit('update:modelValue', val)
})

const showHelpers = ref(false)
const currentMonth = ref(dayjs(dateVal.value || undefined))
const dateFieldEl = ref(null)

watch(() => props.modelValue, (val) => {
  if (val) {
    currentMonth.value = dayjs(val)
  }
})

watch(showHelpers, (open) => {
  if (open) {
    currentMonth.value = dayjs(dateVal.value || undefined)
  }
})

const formattedDate = computed(() => {
  if (!dateVal.value) return 'No date set'
  return dayjs(dateVal.value).format('MMM D, YYYY')
})

function setRelativeToToday(days) {
  const base = dateVal.value ? dayjs(dateVal.value) : dayjs()
  const target = base.add(days, 'day')
  dateVal.value = target.format('YYYY-MM-DD')
  currentMonth.value = target
}

function setToday() {
  const target = dayjs()
  dateVal.value = target.format('YYYY-MM-DD')
  currentMonth.value = target
}

function clearDate() {
  dateVal.value = ''
}

const daysOfWeek = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

const calendarDays = computed(() => {
  const startOfMonth = currentMonth.value.startOf('month')
  const endOfMonth = currentMonth.value.endOf('month')
  
  const days = []
  
  const startDayOfWeek = startOfMonth.day()
  for (let i = startDayOfWeek - 1; i >= 0; i--) {
    days.push({
      date: startOfMonth.subtract(i + 1, 'day'),
      isCurrentMonth: false
    })
  }
  
  const totalDays = endOfMonth.date()
  for (let i = 1; i <= totalDays; i++) {
    days.push({
      date: startOfMonth.date(i),
      isCurrentMonth: true
    })
  }
  
  const remaining = 42 - days.length
  for (let i = 1; i <= remaining; i++) {
    days.push({
      date: endOfMonth.add(i, 'day'),
      isCurrentMonth: false
    })
  }
  
  return days
})

function prevMonth() {
  currentMonth.value = currentMonth.value.subtract(1, 'month')
}

function nextMonth() {
  currentMonth.value = currentMonth.value.add(1, 'month')
}

function selectDay(day) {
  dateVal.value = day.date.format('YYYY-MM-DD')
  showHelpers.value = false
}

function isSelected(day) {
  if (!dateVal.value) return false
  return day.date.format('YYYY-MM-DD') === dateVal.value
}

function isToday(day) {
  return day.date.format('YYYY-MM-DD') === dayjs().format('YYYY-MM-DD')
}

function closeHelpers(e) {
  if (dateFieldEl.value && !dateFieldEl.value.contains(e.target)) {
    showHelpers.value = false
  }
}

onMounted(() => {
  window.addEventListener('click', closeHelpers)
})

onUnmounted(() => {
  window.removeEventListener('click', closeHelpers)
})
</script>

<template>
  <div ref="dateFieldEl" class="my-1.5 relative">
    <div class="v-field-group relative cursor-pointer" @click="showHelpers = !showHelpers">
      <div class="v-field-input text-xs text-ink flex items-center justify-between min-h-[38px] select-none pr-8 bg-surface border border-line rounded-xl" :data-testid="dataTestid">
        <span class="font-medium" :class="{ 'text-ink-3 font-normal': !dateVal }">
          {{ formattedDate }}
        </span>
        <Calendar class="w-3.5 h-3.5 text-ink-3 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
      </div>
      <label :for="id" class="v-field-label text-xs !bg-surface">{{ label }}</label>
    </div>

    <div v-if="showHelpers"
      class="absolute w-[280px] bg-surface border border-line rounded-2xl p-4 shadow-xl z-40 animate-rise-in font-sans left-0 md:left-full md:ml-3 md:bottom-0 md:top-auto"
      :class="[popoverPosition === 'top' ? 'bottom-full mb-2 md:mb-0' : 'top-full mt-1.5 md:mt-0']">
      
      <div class="flex items-center justify-between mb-3.5">
        <button type="button" @click.stop="prevMonth"
          class="p-1.5 hover:bg-canvas rounded-lg text-ink-3 hover:text-ink transition-colors">
          <ChevronLeft class="w-4 h-4" />
        </button>
        <span class="text-xs font-bold text-ink uppercase tracking-wider select-none">
          {{ currentMonth.format('MMMM YYYY') }}
        </span>
        <button type="button" @click.stop="nextMonth"
          class="p-1.5 hover:bg-canvas rounded-lg text-ink-3 hover:text-ink transition-colors">
          <ChevronRight class="w-4 h-4" />
        </button>
      </div>

      <div class="grid grid-cols-7 gap-1 text-center mb-1 select-none">
        <span v-for="d in daysOfWeek" :key="d" class="text-[10px] font-bold text-ink-3 uppercase">
          {{ d }}
        </span>
      </div>

      <div class="grid grid-cols-7 gap-1 text-center mb-3 select-none">
        <button v-for="day in calendarDays" :key="day.date.format('YYYY-MM-DD')"
          type="button"
          @click.stop="selectDay(day)"
          class="text-xs py-1.5 rounded-lg transition-all font-medium flex items-center justify-center relative cursor-pointer"
          :class="[
            day.isCurrentMonth ? 'text-ink font-semibold' : 'text-ink-3/40 font-normal',
            isSelected(day) ? 'bg-pri-strategic !text-canvas font-bold' : 'hover:bg-canvas',
            isToday(day) && !isSelected(day) ? 'border border-pri-strategic-bd/50 text-pri-strategic font-bold' : ''
          ]">
          {{ day.date.date() }}
        </button>
      </div>

      <div class="border-t border-line/35 pt-3 flex flex-wrap gap-1.5 justify-between items-center select-none">
        <div class="flex gap-1">
          <button type="button" @click.stop="setToday"
            class="text-[9px] font-bold text-ink-3 hover:text-ink hover:bg-canvas border border-line/50 px-2 py-1 rounded-lg uppercase transition-colors"
            title="Set to Today">Today</button>
          <button type="button" @click.stop="setRelativeToToday(1)"
            class="text-[9px] font-bold text-ink-3 hover:text-ink hover:bg-canvas border border-line/50 px-2 py-1 rounded-lg uppercase transition-colors"
            title="Add 1 day">+1D</button>
          <button type="button" @click.stop="setRelativeToToday(7)"
            class="text-[9px] font-bold text-ink-3 hover:text-ink hover:bg-canvas border border-line/50 px-2 py-1 rounded-lg uppercase transition-colors"
            title="Add 7 days">+7D</button>
        </div>
        <button type="button" @click.stop="clearDate"
          class="text-[9px] font-bold text-pri-critical hover:bg-pri-critical-bg/20 px-2 py-1 rounded-lg uppercase transition-colors"
          title="Clear date">Clear</button>
      </div>

    </div>
  </div>
</template>
