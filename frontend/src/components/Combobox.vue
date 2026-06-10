<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import { ChevronDown, Check } from 'lucide-vue-next'

const props = defineProps({
  options: { type: Array, required: true }, // Array of { key, label }
  modelValue: { type: String, default: '' },
  placeholder: { type: String, default: 'Select...' },
  isField: { type: Boolean, default: false },
  label: { type: String, default: '' },
  required: { type: Boolean, default: false }
})

const emit = defineEmits(['update:modelValue'])

const isOpen = ref(false)
const search = ref('')
const container = ref(null)

const selectedLabel = computed(() => {
  const opt = props.options.find(o => o.key === props.modelValue)
  return opt ? opt.label : ''
})

watch(() => props.modelValue, () => {
  search.value = ''
})

const filteredOptions = computed(() => {
  if (!search.value) return props.options
  const s = search.value.toLowerCase()
  return props.options.filter(o => o.label.toLowerCase().includes(s))
})

function selectOption(opt) {
  emit('update:modelValue', opt.key)
  isOpen.value = false
  search.value = ''
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
      <button 
        type="button" 
        class="v-field-input text-left flex items-center justify-between"
        :class="{ 'border-pri-strategic ring-2 ring-pri-strategic/10': isOpen }"
        @click="isOpen = !isOpen"
      >
        <span class="truncate text-sm" :class="modelValue ? 'text-ink font-medium' : 'text-ink-3'">
          {{ selectedLabel || ' ' }}
        </span>
        <span class="v-field-arrow">▼</span>
      </button>
      <label 
        :class="['v-field-label', (modelValue || isOpen) ? 'v-field-label--floating' : '', isOpen ? 'v-field-label--floating-focused' : '']"
      >
        {{ label }} <span v-if="required" class="text-pri-critical">*</span>
      </label>
    </template>

    <!-- Standard Selector Variant -->
    <template v-else>
      <button 
        type="button" 
        class="w-full bg-surface border border-line hover:border-line-2 transition-colors rounded-xl px-3 py-2 text-xs outline-none focus:border-line-2 font-serif flex items-center justify-between text-left"
        @click="isOpen = !isOpen"
      >
        <span class="truncate" :class="modelValue ? 'text-ink' : 'text-ink-3'">
          {{ selectedLabel || placeholder }}
        </span>
        <ChevronDown class="w-3.5 h-3.5 text-ink-3 shrink-0 ml-2" />
      </button>
    </template>

    <!-- Shared Dropdown List -->
    <div 
      v-if="isOpen" 
      class="absolute z-50 w-full mt-1.5 bg-surface border border-line rounded-xl shadow-xl overflow-hidden flex flex-col max-h-72"
    >
      <div class="p-2 border-b border-line shrink-0">
        <input 
          type="text" 
          v-model="search" 
          placeholder="Search..." 
          class="w-full bg-elevated/50 border border-transparent rounded-lg px-2.5 py-1.5 text-xs outline-none focus:border-line-2 focus:bg-elevated font-sans placeholder-ink-3"
          autofocus
        />
      </div>
      <ul class="overflow-y-auto p-1.5 space-y-0.5">
        <template v-for="(opt, idx) in filteredOptions" :key="opt.key || idx">
          <li v-if="opt.isSeparator" class="my-1.5 border-t border-line"></li>
          <li v-else
            class="px-2.5 py-1.5 text-xs rounded-lg cursor-pointer flex items-center justify-between transition-colors"
            :class="modelValue === opt.key ? 'bg-elevated/80 font-medium text-ink' : 'text-ink-2 hover:bg-elevated/50 hover:text-ink'"
            @click="selectOption(opt)"
          >
            <span class="truncate">{{ opt.label }}</span>
            <Check v-if="modelValue === opt.key" class="w-3 h-3 text-ink shrink-0 ml-2" />
          </li>
        </template>
        <li v-if="!filteredOptions.length" class="px-2 py-3 text-xs text-ink-3 italic text-center font-serif">
          No matches found.
        </li>
      </ul>
    </div>
  </div>
</template>
