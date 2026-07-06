<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { Check, X } from 'lucide-vue-next'

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
  <div class="v-field-group relative" ref="container">
    <button 
      type="button" 
      :id="id"
      class="v-field-select text-sm cursor-pointer text-left flex items-center justify-between pr-10"
      :class="[
        isOpen ? 'border-pri-strategic ring-2 ring-pri-strategic/10' : '',
        (modelValue === null || modelValue === undefined || modelValue === '' || (multiple && (!Array.isArray(modelValue) || !modelValue.length)))
          ? 'text-ink-3 font-normal' 
          : 'text-ink font-semibold'
      ]"
      @click="isOpen = !isOpen"
    >
      <span class="truncate">{{ selectedLabel }}</span>
      <div class="absolute right-3.5 top-1/2 -translate-y-1/2 flex items-center gap-1.5 z-10">
        <button
          v-if="clearable && modelValue !== null && modelValue !== undefined && modelValue !== ''"
          type="button"
          class="text-ink-3 hover:text-pri-critical p-0.5 rounded transition-colors cursor-pointer flex items-center justify-center"
          @click.stop="clearSelection"
        >
          <X class="w-3.5 h-3.5" />
        </button>
        <span class="text-[10px] text-ink-3 pointer-events-none">▼</span>
      </div>
    </button>
    <label :for="id" class="v-field-label v-field-label--floating text-xs select-none" :class="{ '!text-pri-strategic': isOpen }">
      {{ label }}
    </label>

    <!-- Dropdown menu -->
    <div v-if="isOpen" 
      class="absolute left-0 right-0 z-50 mt-1.5 bg-surface border border-line rounded-xl shadow-xl overflow-hidden flex flex-col max-h-64 animate-rise-in">
      <!-- Search Input (Only shown if searchable is true) -->
      <div v-if="searchable" class="p-2 border-b border-line shrink-0">
        <input 
          type="text" 
          v-model="search" 
          placeholder="Search options..."
          class="w-full bg-canvas border border-line rounded-lg px-2.5 py-1.5 text-xs outline-none focus:border-pri-strategic font-sans placeholder-ink-3"
          autofocus 
        />
      </div>
      <ul class="overflow-y-auto p-1.5 space-y-0.5 text-left">
        <li
          v-for="(opt, idx) in filteredOptions" 
          :key="idx"
          class="px-2.5 py-1.5 text-xs rounded-lg cursor-pointer flex items-center justify-between transition-colors"
          :class="(props.multiple ? (Array.isArray(modelValue) && modelValue.includes(getOptionVal(opt))) : modelValue === getOptionVal(opt)) ? 'bg-canvas font-semibold text-ink' : 'text-ink-2 hover:bg-canvas'"
          @click="selectOption(opt)"
        >
          <span>{{ getOptionLabel(opt) }}</span>
          <Check v-if="props.multiple ? (Array.isArray(modelValue) && modelValue.includes(getOptionVal(opt))) : modelValue === getOptionVal(opt)" class="w-3.5 h-3.5 text-ink shrink-0 ml-2" />
        </li>
        <li v-if="!filteredOptions.length" class="px-2 py-3 text-xs text-ink-3 italic text-center font-serif">
          No matches found
        </li>
      </ul>
    </div>
  </div>
</template>
