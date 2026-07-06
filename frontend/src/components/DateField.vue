<script setup>
import { computed } from 'vue'
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
  }
})

const emit = defineEmits(['update:modelValue'])

const dateVal = computed({
  get: () => props.modelValue || '',
  set: (val) => emit('update:modelValue', val)
})

function setRelativeToToday(days) {
  dateVal.value = dayjs().add(days, 'day').format('YYYY-MM-DD')
}

function setToday() {
  setRelativeToToday(0)
}

function setUpcomingMonday() {
  const todayOfWeek = dayjs().day()
  let diff = (1 - todayOfWeek + 7) % 7
  if (diff === 0) diff = 7
  dateVal.value = dayjs().add(diff, 'day').format('YYYY-MM-DD')
}
</script>

<template>
  <div class="v-field-group block my-1">
    <input type="date" v-model="dateVal" placeholder=" " class="v-field-input text-xs text-ink-2 font-mono" :id="id"
      :data-testid="dataTestid" />
    <label :for="id" class="v-field-label text-xs">{{ label }}</label>
    <div class="flex items-center gap-1 mt-1.5 flex-wrap">
      <button type="button" @click="setToday"
        class="text-[9px] tracking-wider font-semibold text-ink-3 bg-canvas border border-line px-1.5 py-0.5 rounded hover:bg-line transition-all font-mono"
        title="Set to Today">today</button>
      <button type="button" @click="setRelativeToToday(1)"
        class="text-[9px] tracking-wider font-semibold text-ink-3 bg-canvas border border-line px-1.5 py-0.5 rounded hover:bg-line transition-all font-mono"
        title="Add 1 day">T+1D</button>
      <button type="button" @click="setRelativeToToday(2)"
        class="text-[9px] tracking-wider font-semibold text-ink-3 bg-canvas border border-line px-1.5 py-0.5 rounded hover:bg-line transition-all font-mono"
        title="Add 2 days">T+2D</button>
      <button type="button" @click="setRelativeToToday(5)"
        class="text-[9px] tracking-wider font-semibold text-ink-3 bg-canvas border border-line px-1.5 py-0.5 rounded hover:bg-line transition-all font-mono"
        title="Add 5 days">T+5D</button>
      <button type="button" @click="setUpcomingMonday"
        class="text-[9px] tracking-wider font-semibold text-ink-3 bg-canvas border border-line px-1.5 py-0.5 rounded hover:bg-line transition-all font-mono"
        title="Set to Upcoming Monday">Next Mon</button>
    </div>
  </div>
</template>
