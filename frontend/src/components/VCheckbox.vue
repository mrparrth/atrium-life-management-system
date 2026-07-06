<script setup>
import { computed } from 'vue'

defineOptions({
  inheritAttrs: false
})

const props = defineProps({
  modelValue: {
    type: Boolean,
    default: false
  },
  label: {
    type: String,
    required: false
  },
  id: {
    type: String,
    default: () => `v-checkbox-${Math.random().toString(36).substring(2, 9)}`
  }
})

const emit = defineEmits(['update:modelValue'])

function onChange(e) {
  emit('update:modelValue', e.target.checked)
}
</script>

<template>
  <div class="flex items-center gap-2">
    <input
      type="checkbox"
      :id="id"
      :checked="modelValue"
      @change="onChange"
      class="w-4 h-4 rounded border-line text-pri-strategic focus:ring-pri-strategic focus:ring-offset-canvas bg-canvas transition-colors cursor-pointer"
      v-bind="$attrs"
    />
    <label v-if="label" :for="id" class="text-sm text-ink-2 select-none cursor-pointer font-medium leading-none">
      {{ label }}
    </label>
  </div>
</template>
