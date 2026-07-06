<script setup>
import { ref, computed, watch, nextTick } from 'vue'
import { useAreasStore } from '@/stores/areas'
import { useProjectsStore } from '@/stores/projects'
import { useTasksStore } from '@/stores/tasks'
import { useUIStore } from '@/stores/ui'
import PageHeader from '@/components/PageHeader.vue'
import EmptyState from '@/components/EmptyState.vue'
import { Plus, X, Trash2 } from 'lucide-vue-next'
import VInput from '@/components/VInput.vue'
import VTextarea from '@/components/VTextarea.vue'

const areas = useAreasStore()
const projects = useProjectsStore()
const tasks = useTasksStore()
const ui = useUIStore()

const showNew = ref(false)
const selectedArea = ref(null)
const newName = ref(''); const newDesc = ref('')

function projectCount(aid) { return projects.items.filter(p => p.areaId === aid && p.status !== 'archived').length }
function getAreaProjectsList(aid) { return projects.items.filter(p => p.areaId === aid && p.status !== 'archived') }
function getProjectProgress(proj) {
  const projTasks = tasks.items.filter(t => t.projectId === proj.id)
  const total = projTasks.length
  if (!total) return 0
  const done = projTasks.filter(t => t.status === 'done').length
  return Math.round((done / total) * 100)
}

async function create() {
  if (!newName.value.trim()) return
  await areas.add({ name: newName.value, description: newDesc.value })
  newName.value = ''; newDesc.value = ''; showNew.value = false
}
async function removeArea(a) {
  if (!await ui.confirm({ message: `Delete area "${a.name}"? Linked projects will remain.`, title: 'Delete Area' })) return
  await areas.remove(a.id)
}

const newNameInput = ref(null)
watch(showNew, (open) => {
  if (open) {
    nextTick(() => {
      newNameInput.value?.focus()
    })
  }
})
</script>

<template>
  <div class="px-8 md:px-12 py-10 max-w-7xl mx-auto" data-testid="areas-view">
    <PageHeader overline="PARA · Areas" title="Areas of focus" sub="Standards to maintain, not finish.">
      <template #right><button class="btn-primary" @click="showNew = true" data-testid="new-area-btn">
          <Plus class="w-4 h-4" /> New area <span class="kbd ml-1.5 !bg-canvas/20 !border-canvas/10 !text-canvas select-none">⌘1</span>
        </button></template>
    </PageHeader>

    <div v-if="areas.items.length" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
      <div v-for="a in areas.items" :key="a.id"
        @click="selectedArea = a"
        class="card p-6 hover:border-line-2 cursor-pointer transition-all duration-300 group relative"
        :data-testid="`area-card-${a.id}`">
        <button @click.stop="removeArea(a)"
          class="absolute top-4 right-4 btn-ghost !p-1.5 opacity-0 group-hover:opacity-100 hover:text-pri-critical"
          :data-testid="`area-delete-${a.id}`" :title="`Delete area`">
          <Trash2 class="w-4 h-4" />
        </button>
        <div class="flex items-baseline gap-3">
          <span class="text-2xl font-serif text-ink-3">{{ a.emoji || '◌' }}</span>
          <div>
            <div class="font-serif text-xl">{{ a.name }}</div>
            <p v-if="a.description" class="text-sm text-ink-2 mt-1">{{ a.description }}</p>
          </div>
        </div>
        <div class="mt-5 pt-3 border-t border-line text-xs text-ink-3">{{ projectCount(a.id) }} active project<span
            v-if="projectCount(a.id) !== 1">s</span></div>
      </div>
    </div>
    <EmptyState v-else title="No areas yet" hint="Areas are the parts of life worth maintaining." />

    <div v-if="showNew" @keydown.window.esc="showNew = false" class="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div class="fixed inset-0 bg-ink/40 backdrop-blur-sm animate-fade-in" @click="showNew = false"></div>
      <form @submit.prevent="create" @keydown.meta.enter.prevent="create" @keydown.ctrl.enter.prevent="create" class="relative w-full max-w-md card p-8 animate-rise-in">
        <button type="button" class="absolute top-4 right-4 btn-ghost !p-1.5" @click="showNew = false">
          <X class="w-4 h-4" />
        </button>
        <div class="overline">New area</div>
        <h2 class="font-serif text-2xl mt-1 mb-5">A part of life to tend</h2>
        <div class="mb-4">
          <VInput ref="newNameInput" v-model="newName" label="Area Name *" id="new-area-name" required
            data-testid="new-area-name" />
        </div>
        <div class="mb-6">
          <VTextarea v-model="newDesc" label="Why it matters (optional)" id="new-area-desc" :rows="2" />
        </div>
        <div class="flex justify-end gap-2">
          <button type="button" class="btn-ghost" @click="showNew = false">Cancel</button>
          <button type="submit" class="btn-primary" data-testid="new-area-save">
            Create <span class="kbd !bg-canvas/20 !border-canvas/10 !text-canvas select-none text-[9px] ml-1">⌘Enter</span>
          </button>
        </div>
      </form>
    </div>

    <!-- Area Details Modal -->
    <div v-if="selectedArea" @keydown.window.esc="selectedArea = null" class="fixed inset-0 z-50 flex items-start justify-center pt-24 px-4" data-testid="area-detail-modal">
      <div class="fixed inset-0 bg-ink/40 backdrop-blur-sm" @click="selectedArea = null"></div>
      <div class="relative w-full max-w-md card p-8 animate-rise-in shadow-2xl">
        <button type="button" class="absolute top-4 right-4 btn-ghost !p-1.5" @click="selectedArea = null">
          <X class="w-4 h-4" />
        </button>
        <div class="flex items-center gap-2 text-ink-3 text-xs mb-2">
          <span class="text-2xl font-serif text-ink-3">{{ selectedArea.emoji || '◌' }}</span>
          <span class="overline">Area of focus</span>
        </div>
        <h2 class="font-serif text-3xl text-ink font-medium leading-snug mb-4">{{ selectedArea.name }}</h2>
        <div class="space-y-4">
          <div v-if="selectedArea.description">
            <span class="overline text-[10px] text-ink-3 block mb-1">Description</span>
            <p class="text-sm text-ink-2 whitespace-pre-wrap leading-relaxed">{{ selectedArea.description }}</p>
          </div>
          <div>
            <span class="overline text-[10px] text-ink-3 block mb-2">Linked Projects</span>
            <div v-if="getAreaProjectsList(selectedArea.id).length" class="space-y-3">
              <div v-for="proj in getAreaProjectsList(selectedArea.id)" :key="proj.id" class="p-3 bg-canvas/40 rounded-xl border border-line flex flex-col gap-2">
                <div class="flex items-center justify-between gap-3">
                  <RouterLink :to="'/projects/' + proj.id" class="font-serif text-base font-semibold text-ink hover:text-ink-2 hover:underline min-w-0 truncate">
                    {{ proj.title }}
                  </RouterLink>
                  <span class="text-[10px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded border border-line bg-surface text-ink-3">
                    {{ proj.status }}
                  </span>
                </div>
                <div class="flex items-center gap-2">
                  <div class="flex-1 h-1.5 rounded-full bg-elevated overflow-hidden">
                    <div class="h-full bg-ink rounded-full transition-all duration-500" :style="{ width: getProjectProgress(proj) + '%' }"></div>
                  </div>
                  <span class="text-xs font-mono text-ink-2">{{ getProjectProgress(proj) }}%</span>
                </div>
              </div>
            </div>
            <p v-else class="text-sm text-ink-3 italic">No projects linked to this area yet.</p>
          </div>
        </div>
        <div class="flex justify-end mt-6">
          <button class="btn-ghost" @click="selectedArea = null">Close</button>
        </div>
      </div>
    </div>
  </div>
</template>
