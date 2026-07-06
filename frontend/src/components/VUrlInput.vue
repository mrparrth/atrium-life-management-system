<script setup>
import { computed } from 'vue'
import { ExternalLink } from 'lucide-vue-next'

defineOptions({
  inheritAttrs: false
})

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
    default: () => `v-url-${Math.random().toString(36).substring(2, 9)}`
  },
  required: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['update:modelValue'])

function onInput(e) {
  emit('update:modelValue', e.target.value)
}

function openUrl() {
  if (!props.modelValue) return
  let target = props.modelValue.trim()
  if (!/^https?:\/\//i.test(target)) {
    target = 'https://' + target
  }
  window.open(target, '_blank', 'noopener,noreferrer')
}
</script>

<template>
  <div class="v-field-group relative">
    <input
      :id="id"
      type="url"
      :value="modelValue"
      placeholder=" "
      :required="required"
      class="v-field-input v-field-input--mono pr-14"
      v-bind="$attrs"
      @input="onInput"
    />
    <label :for="id" class="v-field-label text-sm">
      {{ label }}
    </label>
    
    <button
      v-if="modelValue && modelValue.trim()"
      type="button"
      @click="openUrl"
      class="absolute right-3.5 top-1/2 -translate-y-1/2 w-7 h-7 rounded-lg border border-line bg-canvas hover:bg-surface flex items-center justify-center transition-all shadow-sm hover:border-line-2 cursor-pointer"
      title="Open link in new tab"
    >
      <ExternalLink class="w-3.5 h-3.5 text-ink-2 hover:text-pri-strategic" />
    </button>
  </div>
</template>
