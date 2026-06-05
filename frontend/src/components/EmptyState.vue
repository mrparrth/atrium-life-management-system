<script setup>
defineProps({ title: String, hint: String })
</script>

<template>
  <div class="card p-10 text-center" data-testid="empty-state">
    <div class="mx-auto w-12 h-12 rounded-full bg-elevated flex items-center justify-center mb-4">
      <span class="w-2 h-2 rounded-full bg-ink-3"></span>
    </div>
    <p class="font-serif text-xl text-ink">{{ title }}</p>
    <p v-if="hint" class="text-sm text-ink-2 mt-2">{{ hint }}</p>
    <slot />
  </div>
</template>
