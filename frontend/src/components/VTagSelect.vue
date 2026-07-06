<script setup>
import { computed, ref, nextTick } from 'vue'
import { useSettingsStore } from '@/stores/settings'
import { getTagStyle } from '@/lib/tags'

const props = defineProps({
  modelValue: {
    type: [String, Array],
    default: ''
  },
  availableTags: {
    type: Array,
    default: () => []
  },
  label: {
    type: String,
    default: 'Tags'
  },
  id: {
    type: String,
    default: () => `v-tag-select-${Math.random().toString(36).substring(2, 9)}`
  }
})

const emit = defineEmits(['update:modelValue'])

const settingsStore = useSettingsStore()

const isAdding = ref(false)
const newTagInput = ref('')
const inputRef = ref(null)

const tagColorsMap = computed(() => {
  return settingsStore.get('bookmark_tag_colors', {})
})

// Normalize modelValue — accepts either an Array or a comma-separated String
const isArrayMode = computed(() => Array.isArray(props.modelValue))

const currentTagsList = computed(() => {
  if (isArrayMode.value) {
    return (props.modelValue || []).filter(Boolean)
  }
  return props.modelValue
    ? props.modelValue.split(',').map(t => t.trim()).filter(Boolean)
    : []
})

const sortedChips = computed(() => {
  const currentLower = currentTagsList.value.map(t => t.toLowerCase())
  
  const uniqueTags = new Set([
    ...props.availableTags.map(t => t.trim()),
    ...currentTagsList.value
  ])
  
  return Array.from(uniqueTags).sort((a, b) => {
    const aSelected = currentLower.includes(a.toLowerCase())
    const bSelected = currentLower.includes(b.toLowerCase())
    
    if (aSelected && !bSelected) return -1
    if (!aSelected && bSelected) return 1
    
    return a.localeCompare(b, undefined, { sensitivity: 'base' })
  })
})

function emitTags(tags) {
  emit('update:modelValue', isArrayMode.value ? tags : tags.join(', '))
}

function toggleTag(tag) {
  const tags = [...currentTagsList.value]
  const lowerTag = tag.toLowerCase()
  const idx = tags.findIndex(t => t.toLowerCase() === lowerTag)
  
  if (idx >= 0) {
    tags.splice(idx, 1)
  } else {
    tags.push(tag)
  }
  
  emitTags(tags)
}

function isSelected(tag) {
  return currentTagsList.value.map(t => t.toLowerCase()).includes(tag.toLowerCase())
}

function startAdd() {
  isAdding.value = true
  newTagInput.value = ''
  nextTick(() => {
    if (inputRef.value) {
      inputRef.value.focus()
    }
  })
}

function submitNewTag() {
  const val = newTagInput.value.trim()
  if (val) {
    const tags = [...currentTagsList.value]
    if (!tags.map(t => t.toLowerCase()).includes(val.toLowerCase())) {
      tags.push(val)
      emitTags(tags)
    }
  }
  isAdding.value = false
  newTagInput.value = ''
}
</script>

<template>
  <div class="space-y-1 text-left pb-2">
    <!-- Label -->
    <div class="text-[10px] font-bold uppercase tracking-wider text-ink-3 mb-1 px-1">
      {{ label }}
    </div>
    
    <!-- Tag chips container -->
    <div class="flex flex-wrap gap-1.5 px-1 py-0.5 items-center">
      <button
        v-for="tag in sortedChips"
        :key="tag"
        type="button"
        @click="toggleTag(tag)"
        class="text-xs font-semibold px-3 py-1 rounded-xl transition-all cursor-pointer border select-none"
        :class="isSelected(tag) 
          ? '' 
          : 'bg-canvas text-ink-3 border-line opacity-60 hover:opacity-100 hover:bg-canvas-2'"
        :style="isSelected(tag) ? getTagStyle(tag, tagColorsMap) : {}"
      >
        #{{ tag }}
      </button>

      <!-- Inline Add Tag Input / Button Chip -->
      <div v-if="isAdding" class="flex items-center">
        <input
          ref="inputRef"
          v-model="newTagInput"
          type="text"
          class="text-xs font-semibold px-2 py-1 rounded-xl border border-pri-strategic bg-surface text-ink outline-none w-24"
          placeholder="new tag..."
          @keyup.enter="submitNewTag"
          @blur="submitNewTag"
        />
      </div>
      <button
        v-else
        type="button"
        @click="startAdd"
        class="text-xs font-semibold px-3 py-1 rounded-xl transition-all cursor-pointer border border-dashed border-line text-ink-3 hover:text-pri-strategic hover:border-pri-strategic/50 bg-transparent flex items-center gap-1"
      >
        + Add
      </button>
    </div>
  </div>
</template>
