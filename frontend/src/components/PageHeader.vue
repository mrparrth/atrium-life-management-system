<script setup>
defineProps({ overline: String, title: String, sub: String, count: [Number, String] })
</script>

<template>
  <header class="mb-8 flex items-end justify-between gap-4 flex-wrap">
    <div>
      <div v-if="overline" class="overline mb-2">{{ overline }}</div>
      <h1 class="font-serif text-4xl md:text-5xl tracking-tight leading-none">{{ title }}</h1>
      <p v-if="sub" class="text-ink-2 mt-3 max-w-xl">{{ sub }}</p>
    </div>
    <div v-if="$slots.right || count != null" class="flex items-center gap-3">
      <span v-if="count != null" class="text-ink-3 font-serif text-2xl">{{ count }}</span>
      <slot name="right" />
    </div>
  </header>
</template>
