<script setup>
defineProps({ overline: String, title: String, hint: String })
</script>

<template>
  <div class="flex items-center justify-between gap-3 mb-2">
    <div>
      <div v-if="overline" class="overline">{{ overline }}</div>
      <h3 v-if="title" class="font-serif text-2xl tracking-tight mt-1">{{ title }}</h3>
      <p v-if="hint" class="text-sm text-ink-2 mt-1">{{ hint }}</p>
    </div>
    <div>
      <slot name="right" />
    </div>
  </div>
</template>
