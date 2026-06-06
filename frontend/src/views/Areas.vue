<script setup>
import { ref, computed } from 'vue'
import { useAreasStore } from '@/stores/areas'
import { useProjectsStore } from '@/stores/projects'
import { useUIStore } from '@/stores/ui'
import PageHeader from '@/components/PageHeader.vue'
import EmptyState from '@/components/EmptyState.vue'
import { Plus, X, Trash2 } from 'lucide-vue-next'

const areas = useAreasStore()
const projects = useProjectsStore()
const ui = useUIStore()

const showNew = ref(false)
const newName = ref(''); const newDesc = ref('')

function projectCount(aid) { return projects.items.filter(p => p.areaId === aid && p.status !== 'archived').length }

async function create() {
  if (!newName.value.trim()) return
  await areas.add({ name: newName.value, description: newDesc.value })
  newName.value = ''; newDesc.value = ''; showNew.value = false
}
async function removeArea(a) {
  if (!await ui.confirm({ message: `Delete area "${a.name}"? Linked projects will remain.`, title: 'Delete Area' })) return
  await areas.remove(a.id)
}
</script>

<template>
  <div class="px-8 md:px-12 py-10 max-w-5xl mx-auto" data-testid="areas-view">
    <PageHeader overline="PARA · Areas" title="Areas of focus" sub="Standards to maintain, not finish.">
      <template #right><button class="btn-primary" @click="showNew = true" data-testid="new-area-btn"><Plus class="w-4 h-4" /> New area</button></template>
    </PageHeader>

    <div v-if="areas.items.length" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
      <div v-for="a in areas.items" :key="a.id" class="card p-6 hover:border-line-2 transition-all duration-300 group relative" :data-testid="`area-card-${a.id}`">
        <button
          @click="removeArea(a)"
          class="absolute top-4 right-4 btn-ghost !p-1.5 opacity-0 group-hover:opacity-100 hover:text-pri-critical"
          :data-testid="`area-delete-${a.id}`" :title="`Delete area`"
        ><Trash2 class="w-4 h-4" /></button>
        <div class="flex items-baseline gap-3">
          <span class="text-2xl font-serif text-ink-3">{{ a.emoji || '◌' }}</span>
          <div>
            <div class="font-serif text-xl">{{ a.name }}</div>
            <p v-if="a.description" class="text-sm text-ink-2 mt-1">{{ a.description }}</p>
          </div>
        </div>
        <div class="mt-5 pt-3 border-t border-line text-xs text-ink-3">{{ projectCount(a.id) }} active project<span v-if="projectCount(a.id) !== 1">s</span></div>
      </div>
    </div>
    <EmptyState v-else title="No areas yet" hint="Areas are the parts of life worth maintaining." />

    <div v-if="showNew" class="fixed inset-0 z-50 flex items-start justify-center pt-24 px-4">
      <div class="fixed inset-0 bg-ink/40 backdrop-blur-sm" @click="showNew = false"></div>
      <form @submit.prevent="create" class="relative w-full max-w-md card p-8 animate-rise-in">
        <button type="button" class="absolute top-4 right-4 btn-ghost !p-1.5" @click="showNew = false"><X class="w-4 h-4" /></button>
        <div class="overline">New area</div>
        <h2 class="font-serif text-2xl mt-1 mb-5">A part of life to tend</h2>
        <input v-model="newName" placeholder="Area name…" class="input-soft text-lg font-serif mb-3" required data-testid="new-area-name" />
        <textarea v-model="newDesc" placeholder="Why it matters…" rows="2" class="input-soft resize-none mb-5" />
        <div class="flex justify-end gap-2">
          <button type="button" class="btn-ghost" @click="showNew = false">Cancel</button>
          <button type="submit" class="btn-primary" data-testid="new-area-save">Create</button>
        </div>
      </form>
    </div>
  </div>
</template>
