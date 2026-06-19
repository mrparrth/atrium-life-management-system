<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import { ChevronDown, Check } from 'lucide-vue-next'

const props = defineProps({
  options: { type: Array, required: true }, // Array of { key, label }
  modelValue: { type: [String, Array], default: '' },
  placeholder: { type: String, default: 'Select...' },
  isField: { type: Boolean, default: false },
  label: { type: String, default: '' },
  required: { type: Boolean, default: false },
  multiple: { type: Boolean, default: false }
})

const emit = defineEmits(['update:modelValue'])

const isOpen = ref(false)
const search = ref('')
const container = ref(null)

const selectedLabel = computed(() => {
  if (props.multiple) {
    if (!props.modelValue || !props.modelValue.length) return ''
    const selectedOpts = props.options.filter(o => props.modelValue.includes(o.key))
    if (selectedOpts.length <= 2) {
      return selectedOpts.map(o => o.label).join(', ')
    }
    return `${selectedOpts.length} selected`
  } else {
    const opt = props.options.find(o => o.key === props.modelValue)
    return opt ? opt.label : ''
  }
})

watch(() => props.modelValue, () => {
  if (!props.multiple) {
    search.value = ''
  }
})

const filteredOptions = computed(() => {
  if (!search.value) return props.options
  const s = search.value.toLowerCase()
  return props.options.filter(o => {
    if (o.isSeparator) return false
    return o.label && o.label.toLowerCase().includes(s)
  })
})

function isOptionSelected(opt) {
  if (props.multiple) {
    return Array.isArray(props.modelValue) && props.modelValue.includes(opt.key)
  }
  return props.modelValue === opt.key
}

function selectOption(opt) {
  if (props.multiple) {
    const newVal = Array.isArray(props.modelValue) ? [...props.modelValue] : []
    const idx = newVal.indexOf(opt.key)
    if (idx >= 0) {
      newVal.splice(idx, 1)
    } else {
      newVal.push(opt.key)
    }
    emit('update:modelValue', newVal)
  } else {
    emit('update:modelValue', opt.key)
    isOpen.value = false
    search.value = ''
  }
}

function selectAll() {
  const allKeys = props.options.filter(o => !o.isSeparator).map(o => o.key)
  emit('update:modelValue', allKeys)
}

function clearAll() {
  emit('update:modelValue', [])
}

function onClickOutside(e) {
  if (container.value && !container.value.contains(e.target)) {
    isOpen.value = false
  }
}

onMounted(() => document.addEventListener('mousedown', onClickOutside))
onBeforeUnmount(() => document.removeEventListener('mousedown', onClickOutside))
</script>

<template>
  <div :class="isField ? 'v-field-group relative w-full' : 'relative w-64'" ref="container">
    <!-- Notched Field Variant -->
    <template v-if="isField">
      <button type="button" class="v-field-input text-left flex items-center justify-between"
        :class="{ 'border-pri-strategic ring-2 ring-pri-strategic/10': isOpen }" @click="isOpen = !isOpen">
        <span class="truncate text-sm"
          :class="modelValue && (multiple ? modelValue.length : modelValue) ? 'text-ink font-medium' : 'text-ink-3'">
          {{ selectedLabel || ' ' }}
        </span>
        <span class="v-field-arrow">▼</span>
      </button>
      <label
        :class="['v-field-label', (modelValue && (multiple ? modelValue.length : modelValue) || isOpen) ? 'v-field-label--floating' : '', isOpen ? 'v-field-label--floating-focused' : '']">
        {{ label }} <span v-if="required" class="text-pri-critical">*</span>
      </label>
    </template>

    <!-- Standard Selector Variant -->
    <template v-else>
      <button type="button"
        class="w-full bg-surface border border-line hover:border-line-2 transition-colors rounded-xl px-3 py-2 text-xs outline-none focus:border-line-2 font-serif flex items-center justify-between text-left"
        @click="isOpen = !isOpen">
        <span class="truncate"
          :class="modelValue && (multiple ? modelValue.length : modelValue) ? 'text-ink' : 'text-ink-3'">
          {{ selectedLabel || placeholder }}
        </span>
        <ChevronDown class="w-3.5 h-3.5 text-ink-3 shrink-0 ml-2" />
      </button>
    </template>

    <!-- Shared Dropdown List -->
    <div v-if="isOpen"
      class="absolute z-50 w-full mt-1.5 bg-surface border border-line rounded-xl shadow-xl overflow-hidden flex flex-col max-h-[580px]">
      <div class="p-2 border-b border-line shrink-0">
        <input type="text" v-model="search" placeholder="Search..."
          class="w-full bg-elevated/50 border border-transparent rounded-lg px-2.5 py-1.5 text-xs outline-none focus:border-line-2 focus:bg-elevated font-sans placeholder-ink-3"
          autofocus />
      </div>
      <!-- Select All & Clear Toolbar for Multi-select -->
      <div v-if="multiple"
        class="px-3 py-1.5 border-b border-line/50 flex items-center justify-between text-[10px] uppercase font-semibold tracking-wider text-ink-3 bg-canvas/20 shrink-0 select-none">
        <button type="button" class="hover:text-ink transition-colors cursor-pointer" @click="selectAll">
          Select All
        </button>
        <button type="button" class="hover:text-ink transition-colors cursor-pointer" @click="clearAll">
          Clear
        </button>
      </div>
      <ul class="overflow-y-auto p-1.5 space-y-0.5">
        <template v-for="(opt, idx) in filteredOptions" :key="opt.key || idx">
          <li v-if="opt.isSeparator" class="my-1.5 border-t border-line"></li>
          <li v-else
            class="px-2.5 py-1.5 text-xs rounded-lg cursor-pointer flex items-center justify-between transition-colors"
            :class="isOptionSelected(opt) ? 'bg-elevated/80 font-medium text-ink' : 'text-ink-2 hover:bg-elevated/50 hover:text-ink'"
            @click="selectOption(opt)">
            <span class="truncate">{{ opt.label }}</span>
            <Check v-if="isOptionSelected(opt)" class="w-3.5 h-3.5 text-ink shrink-0 ml-2" />
          </li>
        </template>
        <li v-if="!filteredOptions.length" class="px-2 py-3 text-xs text-ink-3 italic text-center font-serif">
          No matches found.
        </li>
      </ul>
    </div>
  </div>
</template>
