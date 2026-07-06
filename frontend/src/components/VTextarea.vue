<script setup>
import { ref, watch, onMounted, nextTick } from 'vue'

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
    default: () => `v-textarea-${Math.random().toString(36).substring(2, 9)}`
  },
  rows: {
    type: [Number, String],
    default: 3
  },
  autogrow: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['update:modelValue'])

const textareaRef = ref(null)

function grow() {
  const el = textareaRef.value
  if (!el) return
  el.style.height = 'auto'
  el.style.height = `${el.scrollHeight}px`
}

function onInput(e) {
  emit('update:modelValue', e.target.value)
  if (props.autogrow) {
    nextTick(grow)
  }
}

watch(() => props.modelValue, () => {
  if (props.autogrow) {
    nextTick(grow)
  }
})

onMounted(() => {
  if (props.autogrow) {
    nextTick(grow)
  }
})
</script>

<template>
  <div class="v-field-group">
    <textarea ref="textareaRef" :id="id" :value="modelValue" :placeholder="placeholder" :required="required"
      :rows="rows" class="v-field-textarea text-sm text-ink" :class="{ 'resize-none': autogrow }"
      :style="autogrow ? { overflowY: 'hidden' } : {}" v-bind="$attrs" @input="onInput"></textarea>
    <label :for="id" class="v-field-label text-sm select-none">
      {{ label }}
    </label>
  </div>
</template>
