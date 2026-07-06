<script setup>
import { computed } from 'vue'

const props = defineProps({
  cols: { type: [String, Number], default: null },
  sm: { type: [String, Number], default: null },
  md: { type: [String, Number], default: null },
  lg: { type: [String, Number], default: null },
  xl: { type: [String, Number], default: null },
  dense: { type: Boolean, default: false } // Should match parent VRow if dense
})

const sizeClasses = {
  cols: {
    auto: 'w-auto',
    '1': 'w-1/12', '2': 'w-2/12', '3': 'w-3/12', '4': 'w-4/12', '5': 'w-5/12', '6': 'w-6/12',
    '7': 'w-7/12', '8': 'w-8/12', '9': 'w-9/12', '10': 'w-10/12', '11': 'w-11/12', '12': 'w-full'
  },
  sm: {
    auto: 'sm:w-auto',
    '1': 'sm:w-1/12', '2': 'sm:w-2/12', '3': 'sm:w-3/12', '4': 'sm:w-4/12', '5': 'sm:w-5/12', '6': 'sm:w-6/12',
    '7': 'sm:w-7/12', '8': 'sm:w-8/12', '9': 'sm:w-9/12', '10': 'sm:w-10/12', '11': 'sm:w-11/12', '12': 'sm:w-full'
  },
  md: {
    auto: 'md:w-auto',
    '1': 'md:w-1/12', '2': 'md:w-2/12', '3': 'md:w-3/12', '4': 'md:w-4/12', '5': 'md:w-5/12', '6': 'md:w-6/12',
    '7': 'md:w-7/12', '8': 'md:w-8/12', '9': 'md:w-9/12', '10': 'md:w-10/12', '11': 'md:w-11/12', '12': 'md:w-full'
  },
  lg: {
    auto: 'lg:w-auto',
    '1': 'lg:w-1/12', '2': 'lg:w-2/12', '3': 'lg:w-3/12', '4': 'lg:w-4/12', '5': 'lg:w-5/12', '6': 'lg:w-6/12',
    '7': 'lg:w-7/12', '8': 'lg:w-8/12', '9': 'lg:w-9/12', '10': 'lg:w-10/12', '11': 'lg:w-11/12', '12': 'lg:w-full'
  },
  xl: {
    auto: 'xl:w-auto',
    '1': 'xl:w-1/12', '2': 'xl:w-2/12', '3': 'xl:w-3/12', '4': 'xl:w-4/12', '5': 'xl:w-5/12', '6': 'xl:w-6/12',
    '7': 'xl:w-7/12', '8': 'xl:w-8/12', '9': 'xl:w-9/12', '10': 'xl:w-10/12', '11': 'xl:w-11/12', '12': 'xl:w-full'
  }
}

const colClass = computed(() => {
  const hasSize = props.cols || props.sm || props.md || props.lg || props.xl
  const classes = [
    'px-3 py-3 max-w-full shrink-0', // default padding
    !hasSize ? 'w-full flex-1' : '', // default width/grow if no size
    props.dense ? '!px-2 !py-2' : '' // dense override
  ]

  if (hasSize) {
    if (props.cols) classes.push(sizeClasses.cols[props.cols])
    if (props.sm) classes.push(sizeClasses.sm[props.sm])
    if (props.md) classes.push(sizeClasses.md[props.md])
    if (props.lg) classes.push(sizeClasses.lg[props.lg])
    if (props.xl) classes.push(sizeClasses.xl[props.xl])
  }

  return classes.filter(Boolean).join(' ')
})
</script>

<template>
  <div :class="colClass">
    <slot></slot>
  </div>
</template>
