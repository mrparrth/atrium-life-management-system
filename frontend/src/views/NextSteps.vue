<script setup>
import { ref, computed, onMounted, watch, nextTick } from 'vue'
import { useNextStepsStore } from '@/stores/nextSteps'
import { useUIStore } from '@/stores/ui'
import PageHeader from '@/components/PageHeader.vue'
import EmptyState from '@/components/EmptyState.vue'
import { Plus, Trash2, ListChecks, Edit3, GripVertical, X, Sparkles } from 'lucide-vue-next'

const nextSteps = useNextStepsStore()
const ui = useUIStore()

const newSectionTitle = ref('')
const showNewSectionModal = ref(false)
const newSectionInput = ref(null)

watch(showNewSectionModal, (open) => {
  if (open) {
    nextTick(() => {
      newSectionInput.value?.focus()
    })
  }
})

const editingSectionId = ref(null)
const editSectionTitle = ref('')

const editingItemId = ref(null)
const editItemTitle = ref('')
const editingItemSectionId = ref(null)

const newItemTitles = ref({}) // map of sectionId -> title input

onMounted(() => {
  nextSteps.load()
})

async function createSection() {
  const v = newSectionTitle.value.trim()
  await nextSteps.addSection(v || 'New Section')
  newSectionTitle.value = ''
  showNewSectionModal.value = false
  ui.showToast('Section created', 'success')
}

async function deleteSection(sec) {
  if (await ui.confirm({ message: `Delete section "${sec.title}"? This will permanently delete its checklist and notes.`, title: 'Delete Section' })) {
    await nextSteps.removeSection(sec.id)
    ui.showToast('Section deleted', 'info')
  }
}

function startRenameSection(sec) {
  editingSectionId.value = sec.id
  editSectionTitle.value = sec.title
}

async function commitRenameSection(secId) {
  if (editingSectionId.value && editSectionTitle.value.trim()) {
    await nextSteps.renameSection(secId, editSectionTitle.value.trim())
  }
  editingSectionId.value = null
}

// ───── Item Operations
async function createItem(secId) {
  const title = newItemTitles.value[secId] || ''
  const trimmed = title.trim()
  if (!trimmed) return
  await nextSteps.addItem(secId, trimmed)
  newItemTitles.value[secId] = ''
}

function startRenameItem(secId, item) {
  editingItemId.value = item.id
  editingItemSectionId.value = secId
  editItemTitle.value = item.title
}

async function commitRenameItem(secId) {
  if (editingItemId.value && editItemTitle.value.trim()) {
    await nextSteps.renameItem(secId, editingItemId.value, editItemTitle.value.trim())
  }
  editingItemId.value = null
  editingItemSectionId.value = null
}

async function deleteItem(secId, itemId) {
  await nextSteps.removeItem(secId, itemId)
}

async function clearSectionDone(secId) {
  await nextSteps.clearCompleted(secId)
  ui.showToast('Cleared completed items', 'success')
}

// ───── Drag and Drop Sections
const dragId = ref(null)
function onDragStart(id) { dragId.value = id }
async function onDrop(targetId) {
  if (!dragId.value || dragId.value === targetId) return
  const ids = nextSteps.sections.map(s => s.id)
  const from = ids.indexOf(dragId.value)
  const to = ids.indexOf(targetId)
  ids.splice(from, 1)
  ids.splice(to, 0, dragId.value)
  await nextSteps.reorderSections(ids)
  dragId.value = null
}
</script>

<template>
  <div class="px-8 md:px-12 py-10 max-w-7xl mx-auto animate-fade-in" data-testid="next-steps-view">
    <PageHeader overline="Horizon" title="Next steps" sub="A quiet space for local checklists and notes.">
      <template #right>
        <button class="btn-primary text-sm" @click="showNewSectionModal = true" data-testid="ns-add-section-btn">
          <Plus class="w-4 h-4" /> Add section <span class="kbd ml-1.5 !bg-canvas/20 !border-canvas/10 !text-canvas select-none">⌘1</span>
        </button>
      </template>
    </PageHeader>

    <div v-if="nextSteps.sections.length" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" data-testid="ns-sections-grid">
      <div 
        v-for="sec in nextSteps.sections" 
        :key="sec.id" 
        draggable="true"
        @dragstart="onDragStart(sec.id)"
        @dragover.prevent
        @drop.prevent="onDrop(sec.id)"
        class="card p-6 flex flex-col hover:border-line-2 transition-all duration-300 group"
        :class="{ 'ring-2 ring-line-2': dragId === sec.id }"
        :data-testid="`ns-section-${sec.id}`"
      >
        <!-- Section Header -->
        <div class="flex items-start justify-between gap-3 mb-4">
          <div class="flex-1 min-w-0 flex items-center gap-2">
            <GripVertical class="w-4 h-4 text-ink-3/45 cursor-grab shrink-0" />
            <template v-if="editingSectionId === sec.id">
              <input 
                v-model="editSectionTitle"
                @keydown.enter="commitRenameSection(sec.id)"
                @keydown.esc="editingSectionId = null"
                @blur="commitRenameSection(sec.id)"
                class="bg-transparent border-b border-line-2 font-serif text-lg text-ink font-medium w-full focus:outline-none"
                autofocus
                :data-testid="`ns-section-rename-input-${sec.id}`"
              />
            </template>
            <template v-else>
              <h3 
                @dblclick="startRenameSection(sec)"
                class="font-serif text-lg text-ink font-medium leading-snug cursor-text truncate hover:text-ink-2"
                :title="`Double click to rename`"
                :data-testid="`ns-section-title-${sec.id}`"
              >
                {{ sec.title }}
              </h3>
            </template>
          </div>
          <div class="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 shrink-0">
            <button @click="startRenameSection(sec)" class="btn-ghost !p-1.5" title="Rename section"><Edit3 class="w-3.5 h-3.5" /></button>
            <button @click="deleteSection(sec)" class="btn-ghost !p-1.5 hover:text-pri-critical" title="Delete section" :data-testid="`ns-section-delete-${sec.id}`"><Trash2 class="w-3.5 h-3.5" /></button>
          </div>
        </div>

        <!-- Checklist items -->
        <div class="space-y-2 mb-4 flex-1">
          <div 
            v-for="it in sec.items" 
            :key="it.id"
            class="flex items-center gap-2.5 px-1.5 py-1.5 rounded-lg hover:bg-elevated/40 transition-colors group/item"
            :class="{ 'opacity-55': it.done }"
            :data-testid="`ns-item-${it.id}`"
          >
            <input
              type="checkbox"
              :checked="it.done"
              @change="nextSteps.toggleItem(sec.id, it.id)"
              class="ns-checkbox shrink-0"
              :id="`ns-item-cb-${it.id}`"
              :data-testid="`ns-item-toggle-${it.id}`"
            />

            <div class="flex-1 min-w-0">
              <template v-if="editingItemId === it.id && editingItemSectionId === sec.id">
                <input 
                  v-model="editItemTitle"
                  @keydown.enter="commitRenameItem(sec.id)"
                  @keydown.esc="editingItemId = null"
                  @blur="commitRenameItem(sec.id)"
                  class="bg-transparent border-b border-line-2 text-sm text-ink w-full focus:outline-none"
                  autofocus
                />
              </template>
              <template v-else>
                <label 
                  :for="`ns-item-cb-${it.id}`"
                  @dblclick.prevent="startRenameItem(sec.id, it)"
                  class="text-sm cursor-pointer break-words block select-none"
                  :class="{ 'line-through text-ink-3': it.done }"
                >{{ it.title }}</label>
              </template>
            </div>

            <button 
              @click="deleteItem(sec.id, it.id)" 
              class="opacity-0 group-hover/item:opacity-100 hover:text-pri-critical transition-opacity ml-auto"
              :data-testid="`ns-item-delete-${it.id}`"
            >
              <X class="w-3 h-3 text-ink-3" />
            </button>
          </div>

          <!-- Add Item Input -->
          <form @submit.prevent="createItem(sec.id)" class="flex items-center gap-2 mt-2 pt-2 border-t border-line/40">
            <Plus class="w-3.5 h-3.5 text-ink-3 shrink-0" />
            <input 
              v-model="newItemTitles[sec.id]"
              placeholder="Add next step…"
              class="bg-transparent text-xs text-ink placeholder:text-ink-3 flex-1 focus:outline-none py-1"
              :data-testid="`ns-item-add-input-${sec.id}`"
            />
          </form>
        </div>

        <!-- Section Notes -->
        <div class="border-t border-dashed border-line pt-3 mt-auto">
          <span class="overline text-[10px] block mb-1">Section Notes</span>
          <textarea
            v-model="sec.notes"
            @input="nextSteps.updateNotes(sec.id, sec.notes)"
            placeholder="Earthy, private logs..."
            rows="3"
            class="w-full bg-elevated/30 hover:bg-elevated/50 focus:bg-elevated/70 border border-line/50 rounded-xl p-2.5 text-xs text-ink placeholder:text-ink-3 outline-none resize-none transition-all duration-300 font-sans"
            :data-testid="`ns-section-notes-${sec.id}`"
          ></textarea>
        </div>

        <!-- Section footer actions -->
        <div class="flex items-center justify-between mt-3 text-[10px] text-ink-3 font-mono border-t border-line/30 pt-2 select-none">
          <span>{{ sec.items.filter(x => !x.done).length }} open · {{ sec.items.filter(x => x.done).length }} done</span>
          <button 
            v-if="sec.items.some(x => x.done)" 
            @click="clearSectionDone(sec.id)" 
            class="hover:text-ink transition-colors flex items-center gap-1"
            :data-testid="`ns-section-clear-done-${sec.id}`"
          >
            Clear completed
          </button>
        </div>
      </div>
    </div>
    
    <EmptyState v-else title="Checklist is empty" hint="Create a new section above to start organizing." />

    <!-- Create Section Dialog Modal -->
    <div v-if="showNewSectionModal" @keydown.window.esc="showNewSectionModal = false" class="fixed inset-0 z-50 flex items-center justify-center p-4" data-testid="new-section-modal">
      <div class="fixed inset-0 bg-ink/40 backdrop-blur-sm animate-fade-in" @click="showNewSectionModal = false"></div>
      <form @submit.prevent="createSection" @keydown.meta.enter.prevent="createSection" @keydown.ctrl.enter.prevent="createSection" class="relative w-full max-w-md card p-6 shadow-2xl shadow-black/20 animate-rise-in">
        <button type="button" class="absolute top-4 right-4 btn-ghost !p-1.5" @click="showNewSectionModal = false"><X class="w-4 h-4" /></button>
        <div class="overline">Horizon</div>
        <h2 class="font-serif text-2xl mt-1 mb-5">Create a next steps section</h2>
        <div class="v-field-group mb-5">
          <input 
            ref="newSectionInput"
            v-model="newSectionTitle" 
            placeholder=" " 
            class="v-field-input text-lg font-bold font-sans" 
            id="new-section-title"
            required 
            data-testid="new-section-title-input" 
          />
          <label for="new-section-title" class="v-field-label text-base font-semibold">Section Name *</label>
        </div>
        <div class="flex justify-end gap-2">
          <button type="button" class="btn-ghost" @click="showNewSectionModal = false">Cancel</button>
          <button type="submit" class="btn-primary" data-testid="new-section-save-btn">
            Create section <span class="kbd !bg-canvas/20 !border-canvas/10 !text-canvas select-none text-[9px] ml-1">⌘Enter</span>
          </button>
        </div>
      </form>
    </div>
  </div>
</template>

<style scoped>
.ns-checkbox {
  appearance: none;
  -webkit-appearance: none;
  width: 1.0625rem;  /* 17px — slightly larger than before for easier clicking */
  height: 1.0625rem;
  border-radius: 0.3rem;
  border: 2px solid var(--color-line-2, #888);
  background: transparent;
  cursor: pointer;
  position: relative;
  transition: background 0.18s ease, border-color 0.18s ease, transform 0.12s ease;
  flex-shrink: 0;
}

.ns-checkbox:hover {
  border-color: var(--color-ink-2, #555);
}

.ns-checkbox:checked {
  background: var(--color-ink, #1a1a1a);
  border-color: var(--color-ink, #1a1a1a);
}

.ns-checkbox:checked::after {
  content: '';
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  /* SVG checkmark encoded inline */
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 12 12' fill='none' stroke='white' stroke-width='2.2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='2,6 5,9 10,3'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: center;
  background-size: 70%;
}

.ns-checkbox:active {
  transform: scale(0.88);
}

.ns-checkbox:focus-visible {
  outline: 2px solid var(--color-pri-strategic, #6366f1);
  outline-offset: 2px;
}
</style>
