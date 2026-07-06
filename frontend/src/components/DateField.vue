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

function adjustDate(days) {
  const current = dateVal.value ? dayjs(dateVal.value) : dayjs()
  dateVal.value = current.add(days, 'day').format('YYYY-MM-DD')
}

function setToday() {
  dateVal.value = dayjs().format('YYYY-MM-DD')
}

function clearDate() {
  dateVal.value = ''
}
</script>

<template>
  <div class="v-field-group block my-1">
    <input type="date" v-model="dateVal" placeholder=" " class="v-field-input text-xs text-ink-2 font-mono" :id="id"
      :data-testid="dataTestid" />
    <label :for="id" class="v-field-label text-xs">{{ label }}</label>
    <div class="flex items-center gap-1 mt-1.5 flex-wrap">
      <button type="button" @click="setToday"
        class="text-[9px] uppercase tracking-wider font-semibold text-ink-3 bg-canvas border border-line px-1.5 py-0.5 rounded hover:bg-line transition-all font-mono"
        title="Set to Today">Today</button>
      <button type="button" @click="adjustDate(-1)"
        class="text-[9px] uppercase tracking-wider font-semibold text-ink-3 bg-canvas border border-line px-1.5 py-0.5 rounded hover:bg-line transition-all font-mono"
        title="Subtract 1 day">-1D</button>
      <button type="button" @click="adjustDate(1)"
        class="text-[9px] uppercase tracking-wider font-semibold text-ink-3 bg-canvas border border-line px-1.5 py-0.5 rounded hover:bg-line transition-all font-mono"
        title="Add 1 day">+1D</button>
      <button type="button" @click="adjustDate(5)"
        class="text-[9px] uppercase tracking-wider font-semibold text-ink-3 bg-canvas border border-line px-1.5 py-0.5 rounded hover:bg-line transition-all font-mono"
        title="Add 5 days">+5D</button>
      <button type="button" @click="adjustDate(10)"
        class="text-[9px] uppercase tracking-wider font-semibold text-ink-3 bg-canvas border border-line px-1.5 py-0.5 rounded hover:bg-line transition-all font-mono"
        title="Add 10 days">+10D</button>
      <button type="button" @click="clearDate"
        class="text-[9px] uppercase tracking-wider font-semibold text-ink-3 hover:text-ink ml-auto transition-all">Clear</button>
    </div>
  </div>
</template>
