<script setup>
defineProps({ overline: String, title: String, hint: String })
</script>

<template>
  <div class="flex items-end justify-between gap-3 mb-4">
    <div>
      <div v-if="overline" class="overline">{{ overline }}</div>
      <!-- <h2 class="font-serif text-2xl tracking-tight mt-1">{{ title }}</h2> -->
      <!-- <p v-if="hint" class="text-sm text-ink-2 mt-1">{{ hint }}</p> -->
    </div>
    <div>
      <slot name="right" />
    </div>
  </div>
</template>
