<script setup>
import { ref, watch, onMounted, nextTick, computed } from 'vue'
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

// Link Detection logic
const detectedLinks = computed(() => {
  if (!props.modelValue) return []
  const regex = /(https?:\/\/[^\s]+)/gi
  const matches = props.modelValue.match(regex) || []
  const cleaned = matches.map(url => url.replace(/[.,;)]+$/, ''))
  return [...new Set(cleaned)]
})

function getDisplayHost(url) {
  try {
    const host = new URL(url).hostname
    return host.replace(/^www\./, '')
  } catch (e) {
    return 'Open Link'
  }
}

function onTextareaClick(e) {
  const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0
  const modifierPressed = isMac ? e.metaKey : e.ctrlKey
  if (!modifierPressed) return

  const textarea = e.target
  const pos = textarea.selectionStart
  const text = textarea.value
  if (!text) return

  let start = pos
  while (start > 0 && !/\s/.test(text[start - 1])) {
    start--
  }
  let end = pos
  while (end < text.length && !/\s/.test(text[end])) {
    end++
  }

  const clickedWord = text.substring(start, end).replace(/[.,;)]+$/, '')
  if (/^https?:\/\//i.test(clickedWord)) {
    e.preventDefault()
    window.open(clickedWord, '_blank')
  }
}

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
      :style="autogrow ? { overflowY: 'hidden' } : {}" v-bind="$attrs" @input="onInput" @click="onTextareaClick"></textarea>
    <label :for="id" class="v-field-label text-sm select-none">
      {{ label }}
    </label>

    <!-- Detected Links Toolbar -->
    <div v-if="detectedLinks.length" class="flex flex-wrap items-center gap-2 mt-1.5 text-xs text-ink-3">
      <span class="flex items-center gap-1 font-semibold uppercase tracking-wider text-[9px]">
        <ExternalLink class="w-3 h-3 text-ink-3" /> Links:
      </span>
      <a v-for="link in detectedLinks" :key="link" :href="link" target="_blank"
        class="inline-flex items-center gap-1 bg-elevated border border-line hover:border-line-2 px-2 py-0.5 rounded text-xs text-ink hover:text-pri-strategic font-medium transition-all"
        title="Click to open link, or hold Cmd/Ctrl and click inside the textbox directly."
        @click.stop>
        {{ getDisplayHost(link) }} ↗
      </a>
    </div>
  </div>
</template>
