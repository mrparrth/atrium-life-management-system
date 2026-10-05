<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { Calendar, Clock, AlertCircle, ChevronLeft, ChevronRight, Check } from 'lucide-vue-next'
import dayjs from 'dayjs'
import { inFuture } from '@/lib/date'

const props = defineProps({
  open: {
    type: Boolean,
    default: undefined
  },
  modelValue: {
    type: [String, Date],
    default: null
  },
  isOverdue: {
    type: Boolean,
    default: false
  },
  iconType: {
    type: String,
    default: 'calendar' // 'calendar' or 'clock'
  },
  labelPrefix: {
    type: String,
    default: 'Due'
  },
  useInFutureFormat: {
    type: Boolean,
    default: false
  },
  align: {
    type: String,
    default: 'auto' // 'auto', 'left', or 'right'
  }
})

const emit = defineEmits(['update:modelValue', 'update:open', 'change', 'open', 'close'])

const internalOpen = ref(false)
const isOpen = computed({
  get: () => (props.open !== undefined ? props.open : internalOpen.value),
  set: (val) => {
    internalOpen.value = val
    emit('update:open', val)
    if (val) emit('open')
    else emit('close')
  }
})

const pendingDate = ref(null)
const isDirty = ref(false)
const datePickerMonth = ref(dayjs())
const rootEl = ref(null)
const isBottomAligned = ref(true)
const horizontalSide = ref('right')

function updatePlacement() {
  if (rootEl.value) {
    const rect = rootEl.value.getBoundingClientRect()
    const popoverWidth = 275
    const popoverHeight = 290

    // Vertical: Align bottom of calendar to element's bottom if space above allows
    isBottomAligned.value = rect.bottom >= popoverHeight

    // Horizontal: Place on the right side of the element if there is space
    const spaceToRight = window.innerWidth - rect.right
    const spaceToLeft = rect.left

    if (spaceToRight >= popoverWidth + 12) {
      horizontalSide.value = 'right' // left-full ml-2
    } else if (spaceToLeft >= popoverWidth + 12) {
      horizontalSide.value = 'left' // right-full mr-2
    } else if (window.innerWidth - rect.left >= popoverWidth + 12) {
      horizontalSide.value = 'left-flush' // left-0
    } else {
      horizontalSide.value = 'right-flush' // right-0
    }
  }
}

const placementClasses = computed(() => {
  const classes = []
  classes.push(isBottomAligned.value ? 'bottom-0' : 'top-0')

  if (horizontalSide.value === 'right') {
    classes.push('left-full ml-2')
  } else if (horizontalSide.value === 'left') {
    classes.push('right-full mr-2')
  } else if (horizontalSide.value === 'left-flush') {
    classes.push('left-0')
  } else {
    classes.push('right-0')
  }

  return classes.join(' ')
})

watch(isOpen, (val) => {
  if (val) {
    updatePlacement()
  }
})

const displayDate = computed(() => {
  return isOpen.value ? pendingDate.value : props.modelValue
})

const displayLabel = computed(() => {
  if (!displayDate.value) return '+ Due date'
  if (props.useInFutureFormat) {
    const formatted = inFuture(displayDate.value)
    return `${props.labelPrefix} ${formatted}`
  }
  return `${props.labelPrefix} ${dayjs(displayDate.value).format('MMM D')}`
})

function togglePopover() {
  if (isOpen.value) {
    closeAndCommit()
  } else {
    updatePlacement()
    pendingDate.value = props.modelValue || null
    isDirty.value = false
    datePickerMonth.value = dayjs(props.modelValue || undefined)
    isOpen.value = true
  }
}

function closeAndCommit() {
  if (isOpen.value) {
    isOpen.value = false
    if (isDirty.value) {
      const newDate = pendingDate.value
      isDirty.value = false
      emit('update:modelValue', newDate)
      emit('change', newDate)
    }
  }
}

function prevMonth() {
  datePickerMonth.value = datePickerMonth.value.subtract(1, 'month')
}

function nextMonth() {
  datePickerMonth.value = datePickerMonth.value.add(1, 'month')
}

const datePickerDays = computed(() => {
  const startOfMonth = datePickerMonth.value.startOf('month')
  const endOfMonth = datePickerMonth.value.endOf('month')
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

function isSelected(day) {
  if (!displayDate.value) return false
  return day.date.format('YYYY-MM-DD') === dayjs(displayDate.value).format('YYYY-MM-DD')
}

function isToday(day) {
  return day.date.format('YYYY-MM-DD') === dayjs().format('YYYY-MM-DD')
}

function selectDate(dateStr) {
  pendingDate.value = dateStr
  isDirty.value = true
  if (dateStr) {
    datePickerMonth.value = dayjs(dateStr)
  }
}

function setToday() {
  selectDate(dayjs().format('YYYY-MM-DD'))
}

function addDays(days) {
  const base = pendingDate.value ? dayjs(pendingDate.value) : dayjs()
  selectDate(base.add(days, 'day').format('YYYY-MM-DD'))
}

function clearDate() {
  selectDate(null)
}

function handleOutsideClick(e) {
  if (isOpen.value && rootEl.value && !rootEl.value.contains(e.target)) {
    closeAndCommit()
  }
}

function handleEscKey(e) {
  if (isOpen.value && e.key === 'Escape') {
    pendingDate.value = props.modelValue || null
    isDirty.value = false
    isOpen.value = false
  }
}

onMounted(() => {
  window.addEventListener('click', handleOutsideClick, true)
  window.addEventListener('keydown', handleEscKey)
})

onUnmounted(() => {
  window.removeEventListener('click', handleOutsideClick, true)
  window.removeEventListener('keydown', handleEscKey)
})
</script>

<template>
  <div ref="rootEl" class="relative inline-block" :class="{ 'date-picker-open z-50': isOpen }" :data-state="isOpen ? 'open' : 'closed'" @click.stop>
    <!-- Due Date Trigger Button -->
    <button type="button" @click="togglePopover"
      class="flex items-center gap-1 text-[11px] font-medium shrink-0 px-1.5 py-0.5 rounded-md hover:bg-canvas transition-colors cursor-pointer"
      :class="displayDate ? (props.isOverdue ? 'text-pri-critical font-bold' : 'text-ink-2 hover:text-ink') : 'text-ink-3 hover:text-ink border border-dashed border-line'"
      :title="displayDate ? 'Click to change due date' : 'Click to set due date'">
      <AlertCircle v-if="displayDate && props.isOverdue" class="w-3.5 h-3.5 text-pri-critical shrink-0" />
      <Clock v-else-if="props.iconType === 'clock'" class="w-3.5 h-3.5 shrink-0" />
      <Calendar v-else class="w-3.5 h-3.5 shrink-0" />
      <span>{{ displayLabel }}</span>
    </button>

    <!-- Calendar Popover Menu -->
    <div v-if="isOpen"
      class="absolute w-[270px] bg-surface border border-line rounded-2xl p-3 shadow-xl z-50 animate-rise-in font-sans select-none"
      :class="placementClasses"
      @click.stop>
      <!-- Month & Navigation -->
      <div class="flex items-center justify-between mb-2">
        <button type="button" @click.stop="prevMonth"
          class="p-1 hover:bg-canvas rounded-lg text-ink-3 hover:text-ink transition-colors cursor-pointer">
          <ChevronLeft class="w-4 h-4" />
        </button>
        <span class="text-xs font-bold text-ink uppercase tracking-wider">
          {{ datePickerMonth.format('MMMM YYYY') }}
        </span>
        <button type="button" @click.stop="nextMonth"
          class="p-1 hover:bg-canvas rounded-lg text-ink-3 hover:text-ink transition-colors cursor-pointer">
          <ChevronRight class="w-4 h-4" />
        </button>
      </div>

      <!-- Days of week -->
      <div class="grid grid-cols-7 gap-1 text-center mb-1">
        <span v-for="d in ['S','M','T','W','T','F','S']" :key="d" class="text-[10px] font-bold text-ink-3 uppercase">
          {{ d }}
        </span>
      </div>

      <!-- Calendar Days Grid -->
      <div class="grid grid-cols-7 gap-1 text-center mb-2">
        <button v-for="day in datePickerDays" :key="day.date.format('YYYY-MM-DD')"
          type="button"
          @click.stop="selectDate(day.date.format('YYYY-MM-DD'))"
          class="text-xs py-1 rounded-lg transition-all font-medium flex items-center justify-center cursor-pointer"
          :class="[
            day.isCurrentMonth ? 'text-ink font-semibold' : 'text-ink-3/40 font-normal',
            isSelected(day) ? 'bg-pri-strategic !text-canvas font-bold' : 'hover:bg-canvas',
            isToday(day) && !isSelected(day) ? 'border border-pri-strategic-bd/50 text-pri-strategic font-bold' : ''
          ]">
          {{ day.date.date() }}
        </button>
      </div>

      <!-- Quick Presets / Clear / Confirm Footer -->
      <div class="border-t border-line/40 pt-2 flex items-center justify-between gap-1 flex-wrap">
        <div class="flex items-center gap-1">
          <button type="button" @click.stop="setToday"
            class="text-[9px] font-bold text-ink-3 hover:text-ink hover:bg-canvas border border-line/50 px-1.5 py-0.5 rounded uppercase cursor-pointer">
            Today
          </button>
          <button type="button" @click.stop="addDays(1)"
            class="text-[9px] font-bold text-ink-3 hover:text-ink hover:bg-canvas border border-line/50 px-1.5 py-0.5 rounded uppercase cursor-pointer">
            +1D
          </button>
          <button type="button" @click.stop="addDays(7)"
            class="text-[9px] font-bold text-ink-3 hover:text-ink hover:bg-canvas border border-line/50 px-1.5 py-0.5 rounded uppercase cursor-pointer">
            +7D
          </button>
        </div>
        <div class="flex items-center gap-1.5">
          <button type="button" @click.stop="clearDate"
            class="text-[9px] font-bold text-pri-critical hover:bg-pri-critical-bg/20 px-1.5 py-0.5 rounded uppercase cursor-pointer">
            Clear
          </button>
          <button type="button" @click.stop="closeAndCommit"
            class="p-1 rounded-lg bg-pri-strategic text-canvas hover:opacity-90 transition-all cursor-pointer flex items-center justify-center"
            title="Confirm date">
            <Check class="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
