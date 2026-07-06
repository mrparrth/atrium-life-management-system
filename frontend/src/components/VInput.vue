<script setup>
import { computed, ref } from 'vue'

defineOptions({
  inheritAttrs: false
})

const props = defineProps({
  modelValue: {
    type: [String, Number],
    default: ''
  },
  type: {
    type: String,
    default: 'text'
  },
  label: {
    type: String,
    required: true
  },
  textarea: {
    type: Boolean,
    default: false
  },
  placeholder: {
    type: String,
    default: ' '
  },
  required: {
    type: Boolean,
    default: false
  },
  id: {
    type: String,
    default: () => `v-input-${Math.random().toString(36).substring(2, 9)}`
  },
  rows: {
    type: [Number, String],
    default: 3
  },
  mono: {
    type: Boolean,
    default: false
  },
  small: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['update:modelValue'])
const inputRef = ref(null)

const inputClass = computed(() => {
  if (props.textarea) {
    return 'v-field-textarea'
  }
  return [
    'v-field-input',
    props.mono ? 'v-field-input--mono' : '',
    props.small ? 'v-field-input--small-text' : ''
  ].filter(Boolean).join(' ')
})

function onInput(e) {
  emit('update:modelValue', e.target.value)
}

defineExpose({
  focus: () => {
    inputRef.value?.focus()
  }
})
</script>

<template>
  <div class="v-field-group">
    <textarea
      v-if="textarea"
      ref="inputRef"
      :id="id"
      :value="modelValue"
      :placeholder="placeholder"
      :required="required"
      :rows="rows"
      class="v-field-textarea"
      v-bind="$attrs"
      @input="onInput"
    ></textarea>
    <input
      v-else
      ref="inputRef"
      :id="id"
      :type="type"
      :value="modelValue"
      :placeholder="placeholder"
      :required="required"
      :class="inputClass"
      v-bind="$attrs"
      @input="onInput"
    />
    <label :for="id" class="v-field-label text-sm">
      {{ label }}
    </label>
  </div>
</template>
