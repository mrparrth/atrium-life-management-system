<script setup>
import { ref, computed } from 'vue'
import { useReviewsStore } from '@/stores/reviews'
import { useUIStore } from '@/stores/ui'
import PageHeader from '@/components/PageHeader.vue'
import SectionHeader from '@/components/SectionHeader.vue'
import EmptyState from '@/components/EmptyState.vue'
import { fromNow } from '@/lib/date'
import { Plus, X, Sparkles, Trash2 } from 'lucide-vue-next'

const reviews = useReviewsStore()
const ui = useUIStore()
const type = ref('weekly')
const showNew = ref(false)
const form = ref({ type: 'weekly', wins: '', challenges: '', gratitude: '', nextFocus: '' })

const grouped = computed(() => ({
  daily: reviews.items.filter(r => r.type === 'daily'),
  weekly: reviews.items.filter(r => r.type === 'weekly'),
  monthly: reviews.items.filter(r => r.type === 'monthly'),
  yearly: reviews.items.filter(r => r.type === 'yearly'),
}))

function startReview(t) { form.value = { type: t, wins: '', challenges: '', gratitude: '', nextFocus: '' }; showNew.value = true }
async function save() {
  await reviews.add(form.value); ui.showToast('Reflection saved', 'success'); showNew.value = false
}
async function remove(id) { if (confirm('Delete reflection?')) await reviews.remove(id) }
</script>

<template>
  <div class="px-8 md:px-12 py-10 max-w-4xl mx-auto" data-testid="reviews-view">
    <PageHeader overline="Reflection" title="Reviews" sub="Daily, weekly, monthly, yearly — gentle rituals." />

    <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
      <button v-for="t in ['daily','weekly','monthly','yearly']" :key="t"
              class="card p-5 text-left hover:border-line-2 transition-all duration-300 group"
              @click="startReview(t)" :data-testid="`start-${t}-review`">
        <Sparkles class="w-4 h-4 text-ink-3 mb-2" />
        <div class="font-serif text-lg capitalize">{{ t }}</div>
        <div class="text-xs text-ink-3 mt-1">{{ grouped[t].length }} past</div>
      </button>
    </div>

    <template v-for="(items, t) in grouped" :key="t">
      <section v-if="items.length" class="mb-10">
        <SectionHeader :overline="t" :title="`${items.length} reflection${items.length>1?'s':''}`" />
        <div class="space-y-4">
          <div v-for="r in items" :key="r.id" class="card p-6 group" :data-testid="`review-${r.id}`">
            <div class="flex items-center justify-between mb-3">
              <span class="overline">{{ r.date }}</span>
              <button class="btn-ghost !p-1.5 opacity-0 group-hover:opacity-100 hover:text-pri-critical" @click="remove(r.id)"><Trash2 class="w-3.5 h-3.5" /></button>
            </div>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div v-if="r.wins"><div class="overline mb-1">Wins</div><p class="text-ink-2 whitespace-pre-line">{{ r.wins }}</p></div>
              <div v-if="r.challenges"><div class="overline mb-1">Challenges</div><p class="text-ink-2 whitespace-pre-line">{{ r.challenges }}</p></div>
              <div v-if="r.gratitude"><div class="overline mb-1">Gratitude</div><p class="text-ink-2 whitespace-pre-line">{{ r.gratitude }}</p></div>
              <div v-if="r.nextFocus"><div class="overline mb-1">Next focus</div><p class="text-ink-2 whitespace-pre-line">{{ r.nextFocus }}</p></div>
            </div>
          </div>
        </div>
      </section>
    </template>
    <EmptyState v-if="!reviews.items.length" title="No reflections yet" hint="A short pause is enough." />

    <div v-if="showNew" class="fixed inset-0 z-50 flex items-start justify-center pt-12 px-4">
      <div class="fixed inset-0 bg-ink/40 backdrop-blur-sm" @click="showNew = false"></div>
      <form @submit.prevent="save" class="relative w-full max-w-2xl card p-8 animate-rise-in max-h-[85vh] overflow-y-auto">
        <button type="button" class="absolute top-4 right-4 btn-ghost !p-1.5" @click="showNew = false"><X class="w-4 h-4" /></button>
        <div class="overline capitalize">{{ form.type }} reflection</div>
        <h2 class="font-serif text-3xl mt-1 mb-6">A quiet look back</h2>
        <div class="space-y-5">
          <label class="block"><span class="overline block mb-1">Wins</span>
            <textarea v-model="form.wins" rows="2" class="input-block resize-none" placeholder="Small or large." data-testid="review-wins"></textarea>
          </label>
          <label class="block"><span class="overline block mb-1">Challenges</span>
            <textarea v-model="form.challenges" rows="2" class="input-block resize-none" placeholder="What was hard?" data-testid="review-challenges"></textarea>
          </label>
          <label class="block"><span class="overline block mb-1">Gratitude</span>
            <textarea v-model="form.gratitude" rows="2" class="input-block resize-none" placeholder="What lifted you?" data-testid="review-gratitude"></textarea>
          </label>
          <label class="block"><span class="overline block mb-1">Next focus</span>
            <textarea v-model="form.nextFocus" rows="2" class="input-block resize-none" placeholder="A gentle direction." data-testid="review-next"></textarea>
          </label>
        </div>
        <div class="flex justify-end gap-2 mt-6">
          <button type="button" class="btn-ghost" @click="showNew = false">Cancel</button>
          <button type="submit" class="btn-primary" data-testid="review-save">Save reflection</button>
        </div>
      </form>
    </div>
  </div>
</template>
