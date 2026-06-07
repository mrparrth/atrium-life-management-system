<script setup>
import { useUIStore } from '@/stores/ui'
import PersonalDashboard from './PersonalDashboard.vue'
import WorkDashboard from './work/WorkDashboard.vue'

const ui = useUIStore()
</script>

<template>
  <transition name="fade" mode="out-in">
    <PersonalDashboard v-if="ui.mode === 'personal'" />
    <WorkDashboard v-else />
  </transition>
</template>
