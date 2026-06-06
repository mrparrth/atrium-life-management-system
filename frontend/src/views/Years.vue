<script setup>
import { ref, computed } from 'vue'
import { useYearsStore } from '@/stores/years'
import { useGoalsStore } from '@/stores/goals'
import PageHeader from '@/components/PageHeader.vue'
import EmptyState from '@/components/EmptyState.vue'
import { Plus, X, Trash2 } from 'lucide-vue-next'

const years = useYearsStore()
const goals = useGoalsStore()

const showNew = ref(false)
const newYear = ref(new Date().getFullYear() + 1)
const newTheme = ref('')

function goalCount(yid) { return goals.items.filter(g => g.yearId === yid).length }
async function create() {
  await years.add({ year: +newYear.value, theme: newTheme.value })
  newTheme.value = ''; showNew.value = false
}
async function removeYear(y) {
  if (!confirm(`Delete ${y.year}? Its goals will remain.`)) return
  await years.remove(y.id)
}
</script>

<template>
  <div class="px-8 md:px-12 py-10 max-w-5xl mx-auto" data-testid="years-view">
    <PageHeader overline="Horizon" title="Years" sub="A long, soft view of where the years are pointing.">
      <template #right><button class="btn-primary" @click="showNew = true" data-testid="new-year-btn"><Plus class="w-4 h-4" /> New year</button></template>
    </PageHeader>

    <div v-if="years.items.length" class="space-y-5">
      <div v-for="y in years.items" :key="y.id" class="card p-7 group relative" :data-testid="`year-card-${y.id}`">
        <button
          @click="removeYear(y)"
          class="absolute top-4 right-4 btn-ghost !p-1.5 opacity-0 group-hover:opacity-100 hover:text-pri-critical"
          :data-testid="`year-delete-${y.id}`" :title="`Delete ${y.year}`"
        ><Trash2 class="w-4 h-4" /></button>
        <div class="flex items-baseline gap-6">
          <div class="font-serif text-5xl tracking-tight text-ink-2">{{ y.year }}</div>
          <div>
            <p class="font-serif text-2xl text-ink leading-tight">{{ y.theme || 'Untitled year' }}</p>
            <p class="text-sm text-ink-3 mt-2">{{ goalCount(y.id) }} goal<span v-if="goalCount(y.id) !== 1">s</span></p>
          </div>
        </div>
      </div>
    </div>
    <EmptyState v-else title="No years yet" hint="A year is a quiet container." />

    <div v-if="showNew" class="fixed inset-0 z-50 flex items-start justify-center pt-24 px-4">
      <div class="fixed inset-0 bg-ink/40 backdrop-blur-sm" @click="showNew = false"></div>
      <form @submit.prevent="create" class="relative w-full max-w-md card p-8 animate-rise-in">
        <button type="button" class="absolute top-4 right-4 btn-ghost !p-1.5" @click="showNew = false"><X class="w-4 h-4" /></button>
        <div class="overline">New year</div>
        <h2 class="font-serif text-2xl mt-1 mb-5">A new chapter</h2>
        <input type="number" v-model="newYear" class="input-soft text-3xl font-serif mb-3" required />
        <input v-model="newTheme" placeholder="A theme for the year…" class="input-soft text-lg font-serif mb-5" />
        <div class="flex justify-end gap-2">
          <button type="button" class="btn-ghost" @click="showNew = false">Cancel</button>
          <button type="submit" class="btn-primary">Create</button>
        </div>
      </form>
    </div>
  </div>
</template>
