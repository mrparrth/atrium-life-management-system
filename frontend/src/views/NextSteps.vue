<script setup>
import { ref, computed } from 'vue'
import { useNextStepsStore } from '@/stores/nextSteps'
import { useUIStore } from '@/stores/ui'
import PageHeader from '@/components/PageHeader.vue'
import EmptyState from '@/components/EmptyState.vue'
import { Plus, Trash2, Check, ListChecks, Edit3, GripVertical } from 'lucide-vue-next'

const nextSteps = useNextStepsStore()
const ui = useUIStore()

const newTitle = ref('')
const newInput = ref(null)
const editingId = ref(null)
const editTitle = ref('')

const remaining = computed(() => nextSteps.items.filter(i => !i.done).length)
const doneCount = computed(() => nextSteps.items.filter(i => i.done).length)

async function addItem() {
  const v = newTitle.value.trim()
  if (!v) return
  await nextSteps.add(v)
  newTitle.value = ''
  newInput.value?.focus()
}

function startEdit(item) {
  editingId.value = item.id
  editTitle.value = item.title
}
async function commitEdit() {
  if (editingId.value && editTitle.value.trim()) await nextSteps.rename(editingId.value, editTitle.value)
  editingId.value = null; editTitle.value = ''
}
function cancelEdit() { editingId.value = null; editTitle.value = '' }

async function removeItem(id) { await nextSteps.remove(id) }
async function toggle(id) { await nextSteps.toggle(id) }
async function clearDone() {
  if (!doneCount.value) return
  if (!confirm(`Remove ${doneCount.value} completed item${doneCount.value>1?'s':''}?`)) return
  await nextSteps.clearCompleted()
  ui.showToast('Cleared completed', 'success')
}

// Drag and drop reorder (HTML5)
const dragId = ref(null)
function onDragStart(id) { dragId.value = id }
async function onDrop(targetId) {
  if (!dragId.value || dragId.value === targetId) return
  const ids = nextSteps.items.map(i => i.id)
  const from = ids.indexOf(dragId.value)
  const to = ids.indexOf(targetId)
  ids.splice(from, 1); ids.splice(to, 0, dragId.value)
  await nextSteps.reorder(ids)
  dragId.value = null
}
</script>

<template>
  <div class="px-8 md:px-12 py-10 max-w-3xl mx-auto" data-testid="next-steps-view">
    <PageHeader overline="Horizon" title="Next steps" sub="A quiet checklist for the loose ends.">
      <template #right>
        <button v-if="doneCount" class="btn-ghost text-sm" @click="clearDone" data-testid="ns-clear-done"><Trash2 class="w-3.5 h-3.5" /> Clear completed</button>
      </template>
    </PageHeader>

    <form @submit.prevent="addItem" class="card p-3 mb-6 flex items-center gap-2" data-testid="ns-add-form">
      <ListChecks class="w-4 h-4 text-ink-3 ml-2" />
      <input
        ref="newInput"
        v-model="newTitle"
        placeholder="Add a next step…"
        class="flex-1 bg-transparent outline-none text-ink placeholder:text-ink-3 px-1 py-2"
        data-testid="ns-input"
      />
      <button type="submit" class="btn-primary text-sm" data-testid="ns-add-btn"><Plus class="w-4 h-4" /> Add</button>
    </form>

    <div v-if="nextSteps.items.length" class="card divide-y divide-line" data-testid="ns-list">
      <div
        v-for="it in nextSteps.items"
        :key="it.id"
        :draggable="editingId !== it.id"
        @dragstart="onDragStart(it.id)"
        @dragover.prevent
        @drop.prevent="onDrop(it.id)"
        class="group flex items-center gap-3 p-3 transition-colors duration-200 hover:bg-elevated/40"
        :class="{ 'opacity-50': it.done, 'ring-1 ring-line-2': dragId === it.id }"
        :data-testid="`ns-item-${it.id}`"
      >
        <GripVertical class="w-3.5 h-3.5 text-ink-3/40 cursor-grab" />
        <button
          @click="toggle(it.id)"
          class="w-5 h-5 rounded-md border-2 transition-all duration-300 flex items-center justify-center shrink-0"
          :class="it.done ? 'bg-ink border-ink' : 'border-line-2 hover:border-ink-2'"
          :data-testid="`ns-toggle-${it.id}`"
        >
          <Check v-if="it.done" class="w-3 h-3 text-canvas" stroke-width="3" />
        </button>

        <template v-if="editingId === it.id">
          <input
            v-model="editTitle"
            @keydown.enter="commitEdit"
            @keydown.esc="cancelEdit"
            @blur="commitEdit"
            class="flex-1 bg-transparent outline-none text-ink border-b border-line-2 py-1"
            :data-testid="`ns-edit-input-${it.id}`"
            autofocus
          />
        </template>
        <template v-else>
          <span
            class="flex-1 text-[15px] cursor-text"
            :class="{ 'line-through text-ink-3': it.done }"
            @dblclick="startEdit(it)"
          >{{ it.title }}</span>
        </template>

        <button v-if="editingId !== it.id" @click="startEdit(it)" class="btn-ghost !p-1.5 opacity-0 group-hover:opacity-100" :data-testid="`ns-edit-${it.id}`"><Edit3 class="w-3.5 h-3.5" /></button>
        <button @click="removeItem(it.id)" class="btn-ghost !p-1.5 opacity-0 group-hover:opacity-100 hover:text-pri-critical" :data-testid="`ns-delete-${it.id}`"><Trash2 class="w-3.5 h-3.5" /></button>
      </div>
    </div>
    <EmptyState v-else title="A quiet list" hint="Add one small thing above." />

    <div v-if="nextSteps.items.length" class="text-xs text-ink-3 mt-4 flex items-center gap-3" data-testid="ns-stats">
      <span>{{ remaining }} remaining</span>
      <span>·</span>
      <span>{{ doneCount }} done</span>
    </div>
  </div>
</template>
