<script setup>
import { ref, computed, onMounted, onBeforeUnmount, watch, nextTick } from 'vue'
import * as Icons from 'lucide-vue-next'

const { Check, X } = Icons

defineOptions({
  inheritAttrs: false
})

const props = defineProps({
  modelValue: {
    type: [String, Number, Object],
    default: null
  },
  label: {
    type: String,
    required: true
  },
  options: {
    type: Array,
    default: () => []
  },
  optionValue: {
    type: String,
    default: null
  },
  optionLabel: {
    type: String,
    default: null
  },
  id: {
    type: String,
    default: () => `v-select-${Math.random().toString(36).substring(2, 9)}`
  },
  required: {
    type: Boolean,
    default: false
  },
  searchable: {
    type: Boolean,
    default: false
  },
  multiple: {
    type: Boolean,
    default: false
  },
  clearable: {
    type: Boolean,
    default: false
  },
  placeholder: {
    type: String,
    default: '---none---'
  },
  prependIcon: {
    type: String,
    default: null
  },
  rounded: {
    type: String,
    default: ''
  },
  variant: {
    type: String,
    default: 'default' // 'default' | 'compact'
  },
  disabled: {
    type: Boolean,
    default: false
  },
  iconOnly: {
    type: Boolean,
    default: false
  },
  hideArrow: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['update:modelValue'])

const isOpen = ref(false)
const search = ref('')
const container = ref(null)

function getOptionVal(opt) {
  if (opt === null) return null
  if (typeof opt === 'object') {
    const valKey = props.optionValue || 'value'
    if (opt[valKey] !== undefined) {
      return opt[valKey]
    }
    return opt.id !== undefined ? opt.id : opt
  }
  return opt
}

function getOptionLabel(opt) {
  if (opt === null) return props.placeholder
  if (typeof opt === 'object') {
    const labelKey = props.optionLabel || 'label'
    if (opt[labelKey] !== undefined) {
      return opt[labelKey]
    }
    if (opt.emoji !== undefined && opt.title !== undefined) {
      return `${opt.emoji} ${opt.title}`
    }
    return opt.title || opt.name || opt.value || opt
  }
  return opt
}

// Searchable custom select functionality
const selectedLabel = computed(() => {
  if (props.multiple) {
    if (!Array.isArray(props.modelValue) || !props.modelValue.length) return props.placeholder
    return props.modelValue.map(val => {
      const match = props.options.find(o => getOptionVal(o) === val)
      return match ? getOptionLabel(match) : val
    }).join(', ')
  }
  if (props.modelValue === null || props.modelValue === undefined || props.modelValue === '') {
    return props.placeholder
  }
  const match = props.options.find(o => getOptionVal(o) === props.modelValue)
  return match ? getOptionLabel(match) : props.placeholder
})

const filteredOptions = computed(() => {
  if (!search.value) return props.options
  const q = search.value.toLowerCase()
  return props.options.filter(o =>
    getOptionLabel(o).toLowerCase().includes(q)
  )
})

function selectOption(opt) {
  const val = getOptionVal(opt)
  if (props.multiple) {
    const current = Array.isArray(props.modelValue) ? [...props.modelValue] : []
    const idx = current.indexOf(val)
    if (idx > -1) {
      current.splice(idx, 1)
    } else {
      current.push(val)
    }
    emit('update:modelValue', current)
  } else {
    emit('update:modelValue', val)
    isOpen.value = false
    search.value = ''
  }
}

function clearSelection() {
  emit('update:modelValue', null)
}

const dropdownStyle = ref({})
const dropdownRef = ref(null)

function calculatePosition() {
  if (!container.value || !dropdownRef.value) return

  const containerRect = container.value.getBoundingClientRect()
  const dropdownHeight = dropdownRef.value.offsetHeight
  const viewportHeight = window.innerHeight
  const screenMargin = 12

  // Default placement is below the button
  let viewportTop = containerRect.bottom + 6

  // If it overflows the bottom, check if placing it above fits better
  if (viewportTop + dropdownHeight > viewportHeight - screenMargin) {
    const spaceAbove = containerRect.top - screenMargin
    const spaceBelow = viewportHeight - containerRect.bottom - screenMargin

    if (spaceAbove > spaceBelow) {
      viewportTop = containerRect.top - 6 - dropdownHeight
    }
  }

  // Clamp viewportTop so the dropdown stays completely within screen bounds
  const minTop = screenMargin
  const maxTop = Math.max(screenMargin, viewportHeight - dropdownHeight - screenMargin)
  viewportTop = Math.max(minTop, Math.min(maxTop, viewportTop))

  // Convert viewport-relative Y coordinate to container-relative absolute top style
  const relativeTop = viewportTop - containerRect.top

  dropdownStyle.value = {
    top: `${relativeTop}px`,
    bottom: 'auto'
  }
}

watch(isOpen, async (open) => {
  if (open) {
    await nextTick()
    calculatePosition()
  } else {
    dropdownStyle.value = {}
  }
})

function onClickOutside(e) {
  if (container.value && !container.value.contains(e.target)) {
    isOpen.value = false
  }
}

onMounted(() => {
  document.addEventListener('mousedown', onClickOutside)
})

onBeforeUnmount(() => {
  document.removeEventListener('mousedown', onClickOutside)
})
</script>

<template>
  <!-- Unified Custom Dropdown Component -->
  <div :class="variant === 'compact' ? 'inline-block relative' : 'v-field-group relative'" ref="container" @click.stop>
    <button type="button" :id="id" :disabled="disabled"
      class="cursor-pointer text-left flex items-center justify-between transition-all" :class="[
        variant === 'compact'
          ? (iconOnly && (modelValue === null || modelValue === undefined || modelValue === ''))
            ? 'w-6 h-6 p-0 flex items-center justify-center bg-canvas border border-line hover:border-line-2'
            : `h-6 py-0 pl-1.5 text-[10px] bg-canvas border border-line hover:border-line-2 font-mono ${hideArrow ? 'pr-1.5' : 'pr-5'}`
          : `v-field-select text-sm ${hideArrow ? 'pr-4' : 'pr-10'}`,
        isOpen ? 'border-pri-strategic ring-2 ring-pri-strategic/10' : '',
        disabled ? 'opacity-60 cursor-not-allowed pointer-events-none' : '',
        (modelValue === null || modelValue === undefined || modelValue === '' || (multiple && (!Array.isArray(modelValue) || !modelValue.length)))
          ? 'text-ink-3 font-normal'
          : 'text-ink',
        rounded || ((variant === 'compact' && !(iconOnly && (modelValue === null || modelValue === undefined || modelValue === ''))) ? 'rounded-md' : 'rounded-lg')
      ]" @click="!disabled && (isOpen = !isOpen)">
      <div class="flex items-center gap-1.5 min-w-0"
        :class="{ 'justify-center w-full': iconOnly && (modelValue === null || modelValue === undefined || modelValue === '') }">
        <component :is="Icons[prependIcon]" v-if="prependIcon && Icons[prependIcon]"
          class="w-3.5 h-3.5 text-ink-3 shrink-0" />
        <span v-if="!iconOnly || (modelValue !== null && modelValue !== undefined && modelValue !== '')"
          class="truncate">
          {{ selectedLabel }}
        </span>
      </div>
      <div
        v-if="(!iconOnly || (modelValue !== null && modelValue !== undefined && modelValue !== '')) && (!hideArrow || (clearable && modelValue !== null && modelValue !== undefined && modelValue !== ''))"
        class="absolute top-1/2 -translate-y-1/2 flex items-center gap-1.5 z-10"
        :class="variant === 'compact' ? 'right-1.5' : 'right-3.5'">
        <button v-if="clearable && modelValue !== null && modelValue !== undefined && modelValue !== ''" type="button"
          class="text-ink-3 hover:text-pri-critical p-0.5 rounded transition-colors cursor-pointer flex items-center justify-center"
          @click.stop="clearSelection">
          <X class="w-3.5 h-3.5" />
        </button>
        <span v-if="!hideArrow" class="text-ink-3 pointer-events-none"
          :class="variant === 'compact' ? 'text-[6px]' : 'text-[10px]'">▼</span>
      </div>
    </button>
    <label v-if="variant !== 'compact'" :for="id" class="v-field-label v-field-label--floating text-xs select-none"
      :class="{ '!text-pri-strategic': isOpen }">
      {{ label }}
    </label>

    <!-- Dropdown menu -->
    <div v-if="isOpen" ref="dropdownRef"
      class="absolute z-50 bg-surface border border-line rounded-xl shadow-xl overflow-hidden flex flex-col max-h-[500px] animate-rise-in"
      :class="variant === 'compact' ? 'right-0 w-32' : 'left-0 right-0'" :style="dropdownStyle">
      <!-- Search Input (Only shown if searchable is true) -->
      <div v-if="searchable" class="p-2 border-b border-line shrink-0">
        <input type="text" v-model="search" placeholder="Search options..."
          class="w-full bg-canvas border border-line rounded-lg px-2.5 py-1.5 text-xs outline-none focus:border-pri-strategic font-sans placeholder-ink-3"
          autofocus />
      </div>
      <ul class="overflow-y-auto p-1.5 space-y-0.5 text-left">
        <li v-for="(opt, idx) in filteredOptions" :key="idx"
          class="px-2.5 py-1.5 text-xs rounded-lg cursor-pointer flex items-center justify-between transition-colors"
          :class="(props.multiple ? (Array.isArray(modelValue) && modelValue.includes(getOptionVal(opt))) : modelValue === getOptionVal(opt)) ? 'bg-canvas font-semibold text-ink' : 'text-ink-2 hover:bg-canvas'"
          @click="selectOption(opt)">
          <span>{{ getOptionLabel(opt) }}</span>
          <Check
            v-if="props.multiple ? (Array.isArray(modelValue) && modelValue.includes(getOptionVal(opt))) : modelValue === getOptionVal(opt)"
            class="w-3.5 h-3.5 text-ink shrink-0 ml-2" />
        </li>
        <li v-if="!filteredOptions.length" class="px-2 py-3 text-xs text-ink-3 italic text-center font-serif">
          No matches found
        </li>
      </ul>
    </div>
  </div>
</template>
