<script setup>
import { computed, ref, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { useFinanceStore } from '@/stores/finance'
import { useUIStore } from '@/stores/ui'
import { useSettingsStore } from '@/stores/settings'
import SectionHeader from '@/components/SectionHeader.vue'
import VSelect from '@/components/VSelect.vue'
import VCheckbox from '@/components/VCheckbox.vue'
import { DEFAULT_CATEGORIES } from '@/db'
import { inr } from '@/lib/money'
import { Plus, Trash2, Edit3, X, RotateCcw, Check, ChevronDown, Archive } from 'lucide-vue-next'

const finance = useFinanceStore()
const ui = useUIStore()
const settings = useSettingsStore()

const startMonth = computed({
  get: () => settings.get('financeStartMonth', '01'),
  set: (val) => settings.set('financeStartMonth', val)
})

// Categories settings
const showAddCatForm = ref(false)
const addCatNameInput = ref(null)
watch(showAddCatForm, (open) => {
  if (open) {
    nextTick(() => {
      addCatNameInput.value?.focus()
    })
  }
})
const addCatScope = ref('')
const addCatName = ref('')
const addCatGroup = ref('')
const addCatDefaultValue = ref('')

const showOnlyActive = ref(true)

function filteredCategoriesForScope(scope) {
  const all = finance.categoriesForScope(scope)
  if (showOnlyActive.value) {
    return all.filter(c => !c.archived)
  }
  return all
}

function scopeLabel(scope) {
  const labels = {
    asset: 'Asset',
    liability: 'Liability',
    income: 'Income',
    expense: 'Expense',
    investment: 'Investment'
  }
  return labels[scope]?.toLowerCase() || scope
}

function openAddCatPopup(scope) {
  addCatScope.value = scope
  addCatName.value = ''
  addCatGroup.value = existingGroupsForScope(scope)[0] || ''
  addCatDefaultValue.value = ''
  showAddCatForm.value = true
}

async function submitAddCat() {
  const r = await finance.addCategory(addCatScope.value, addCatName.value, addCatGroup.value)
  if (!r) { ui.showToast('Category exists or empty', 'error'); return }
  if (addCatDefaultValue.value !== '') {
    await finance.updateCategoryDefaultValue(r.id, +addCatDefaultValue.value)
  }
  addCatName.value = ''
  addCatDefaultValue.value = ''
  showAddCatForm.value = false
  ui.showToast('Category added', 'success')
}

const showGroupSuggestions = ref(false)
const groupContainer = ref(null)

// Custom dropdown suggestions for editing inline category rows
const activeRowGroupDropdownId = ref(null)
const rowGroupContainer = ref(null)

function toggleRowGroupDropdown(id) {
  activeRowGroupDropdownId.value = activeRowGroupDropdownId.value === id ? null : id
}

function selectRowGroup(g) {
  editingCategoryGroup.value = g
  activeRowGroupDropdownId.value = null
}

function handleGroupOutside(e) {
  if (groupContainer.value && !groupContainer.value.contains(e.target)) {
    showGroupSuggestions.value = false
  }
  if (rowGroupContainer.value) {
    const containers = Array.isArray(rowGroupContainer.value) ? rowGroupContainer.value : [rowGroupContainer.value]
    const clickedInside = containers.some(el => el && el.contains(e.target))
    if (!clickedInside) {
      activeRowGroupDropdownId.value = null
    }
  }
}

function selectGroup(g) {
  addCatGroup.value = g
  showGroupSuggestions.value = false
}

async function removeCategoryFn(c) {
  if (await ui.confirm({ message: `Remove "${label(c.name)}" from ${c.scope}?`, title: 'Remove Category' })) await finance.removeCategory(c.id)
}

const editingCategoryId = ref(null)
const editingCategoryName = ref('')
const editingCategoryGroup = ref('')
const editingCategoryDefaultValue = ref(0)

function startEditCategory(c) {
  editingCategoryId.value = c.id
  editingCategoryName.value = label(c.name)
  editingCategoryGroup.value = c.group || ''
  editingCategoryDefaultValue.value = c.defaultValue || 0
}

async function saveEditCategory(c) {
  const nameClean = editingCategoryName.value.trim()
  const groupClean = editingCategoryGroup.value.trim()
  const defaultValueClean = +editingCategoryDefaultValue.value || 0

  if (!nameClean) {
    ui.showToast('Name cannot be empty', 'error')
    return
  }

  // 1. If name changed, rename
  if (nameClean.toLowerCase().replace(/\s+/g, '_') !== c.name) {
    const success = await finance.renameCategory(c.id, nameClean)
    if (!success) {
      ui.showToast('Category name exists in this scope', 'error')
      return
    }
  }

  // 2. If group changed, update group
  if (groupClean !== c.group) {
    await finance.updateCategoryGroup(c.id, groupClean)
  }

  // 3. If default value changed, update default value
  if (defaultValueClean !== (c.defaultValue || 0)) {
    await finance.updateCategoryDefaultValue(c.id, defaultValueClean)
  }

  editingCategoryId.value = null
  ui.showToast('Changes saved', 'success')
}
const existingGroupsForScope = (scope) => {
  const groupsSet = new Set()
  // Add currently configured ones
  finance.categories.filter(c => c.scope === scope).forEach(c => {
    if (c.group) groupsSet.add(c.group)
  })
  return Array.from(groupsSet).sort()
}

async function archiveCategoryFn(c) {
  await finance.toggleArchiveCategory(c.id)
  ui.showToast(c.archived ? 'Category archived' : 'Category restored', 'success')
}

async function resetCategoriesFn() {
  const confirmed = await ui.confirm({
    title: 'Reset Categories & Groups',
    message: 'WARNING: This will permanently erase ALL custom categories and groups you have configured, resetting them to the default presets. Any budgets linked to custom categories will also be deleted. This action is absolute and cannot be undone. Are you sure you want to proceed?'
  })
  if (!confirmed) return
  await finance.resetCategories()
  ui.showToast('Categories reset to presets', 'success')
}

function label(s) { return (s || '').replace(/_/g, ' ') }

onMounted(() => {
  document.addEventListener('mousedown', handleGroupOutside)
})

onUnmounted(() => {
  document.removeEventListener('mousedown', handleGroupOutside)
})
</script>

<template>
  <div>
    <SectionHeader overline="Configuration"
      hint="Net worth categories (asset, liability) and cash flow categories (income, expense, investment) are managed here." />

    <!-- General Settings Card -->
    <div class="card p-6 mb-8 space-y-4">
      <h3 class="overline text-ink-3">General Settings</h3>
      <div class="grid grid-cols-1 md:grid-cols-3 gap-8 items-stretch">
        <div>
          <label class="overline block mb-1">Fiscal Year Starts</label>
          <p class="text-xs text-ink-3 mb-3 leading-relaxed">
            Define which month starts your financial year. This aligns the month columns and comparison windows in the
            Annual Summary.
          </p>
          <VSelect v-model="startMonth" :options="[
            { value: '01', label: 'January' },
            { value: '02', label: 'February' },
            { value: '03', label: 'March' },
            { value: '04', label: 'April' },
            { value: '05', label: 'May' },
            { value: '06', label: 'June' },
            { value: '07', label: 'July' },
            { value: '08', label: 'August' },
            { value: '09', label: 'September' },
            { value: '10', label: 'October' },
            { value: '11', label: 'November' },
            { value: '12', label: 'December' }
          ]" data-testid="settings-start-month" />
        </div>
        <div class="border-t md:border-t-0 md:border-l border-line pt-6 md:pt-0 md:pl-8 flex flex-col justify-between">
          <div>
            <label class="overline block mb-1">Category Filter</label>
            <p class="text-xs text-ink-3 mb-3 leading-relaxed">
              Toggle category list visibility in settings. Archived categories are hidden from forms but can be managed
              here.
            </p>
          </div>
          <div class="flex items-center gap-2 mb-1">
            <VCheckbox v-model="showOnlyActive" label="Show active categories only" />
          </div>
        </div>
        <div class="border-t md:border-t-0 md:border-l border-line pt-6 md:pt-0 md:pl-8 flex flex-col justify-between">
          <div>
            <label class="overline block mb-1 text-pri-critical font-semibold">Reset Categories & Budgets</label>
            <p class="text-xs text-ink-2 mb-4 leading-relaxed">
              Restore the default system presets. <span class="text-pri-critical font-semibold">WARNING: This will
                permanently delete all custom categories, custom groups, and custom category budgets you have
                created.</span> This action is destructive and cannot be undone.
            </p>
          </div>
          <div>
            <button @click="resetCategoriesFn"
              class="inline-flex items-center justify-center gap-1.5 bg-pri-critical text-canvas border border-pri-critical rounded-xl px-4 py-2 text-xs font-semibold hover:opacity-90 transition-all duration-300 shadow-sm"
              data-testid="reset-categories-btn">
              <RotateCcw class="w-3.5 h-3.5" /> Reset to presets
            </button>
          </div>
        </div>
      </div>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
      <!-- Net Worth Column -->
      <div class="space-y-8">
        <div class="overline text-ink-3 tracking-wider mb-2 font-mono">Net Worth Categories</div>
        <div v-for="scopeInfo in [
          { label: 'Assets', scope: 'asset' },
          { label: 'Liabilities', scope: 'liability' }
        ]" :key="scopeInfo.scope" class="card p-6" :data-testid="`category-group-${scopeInfo.scope}`">
          <div class="flex items-center justify-between mb-4 pb-2 border-b border-line">
            <h3 class="font-serif text-lg font-bold text-ink">{{ scopeInfo.label }}</h3>
            <div class="flex items-center gap-2">
              <span class="text-xs text-ink-3 font-mono bg-elevated px-2 py-0.5 rounded border border-line">
                {{ finance.categoriesForScope(scopeInfo.scope).length }} categories
              </span>
              <button @click="openAddCatPopup(scopeInfo.scope)"
                class="btn-ghost !p-1 hover:bg-elevated hover:text-ink transition-all duration-200 rounded-lg animate-fade-in"
                :data-testid="`add-category-btn-${scopeInfo.scope}`" title="Add category">
                <Plus class="w-4 h-4 text-ink-2" />
              </button>
            </div>
          </div>

          <div class="overflow-x-auto min-h-[260px]">
            <table class="w-full text-sm text-left border-collapse">
              <thead>
                <tr class="border-b border-line pb-2 text-ink-3 uppercase text-[10px] tracking-wider">
                  <th class="py-2 px-1 w-1/3">Category Name</th>
                  <th class="py-2 px-1 w-1/4">Group / Type</th>
                  <th class="py-2 px-1 w-1/4">Default</th>
                  <th class="py-2 px-1 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="c in filteredCategoriesForScope(scopeInfo.scope)" :key="c.id"
                  class="border-b border-line/40 hover:bg-canvas/30 transition-colors group"
                  :class="c.archived ? 'opacity-70 bg-elevated/40 border-dashed' : ''"
                  :data-testid="`category-${scopeInfo.scope}-${c.name}`">

                  <!-- Category Name -->
                  <td class="py-3 px-1">
                    <template v-if="editingCategoryId === c.id">
                      <input v-model="editingCategoryName" @keydown.enter="saveEditCategory(c)"
                        @keydown.esc="editingCategoryId = null"
                        class="bg-canvas border border-line rounded px-2.5 py-1.5 text-sm outline-none focus:border-line-2 w-full font-sans text-ink"
                        autofocus />
                    </template>
                    <template v-else>
                      <span :class="c.archived ? 'line-through text-ink-3' : 'text-ink'" class="capitalize font-medium">
                        {{ label(c.name) }}
                      </span>
                    </template>
                  </td>

                  <!-- Group / Type -->
                  <td class="py-3 px-1">
                    <template v-if="editingCategoryId === c.id">
                      <div class="relative" ref="rowGroupContainer">
                        <button type="button" @click="toggleRowGroupDropdown(c.id)"
                          class="bg-canvas border border-line rounded px-2.5 py-1.5 text-sm outline-none focus:border-line-2 w-full font-sans text-ink text-left flex items-center justify-between transition-all select-none">
                          <span class="truncate pr-2">{{ editingCategoryGroup || 'One-Off' }}</span>
                          <ChevronDown class="w-3.5 h-3.5 text-ink-3 shrink-0" />
                        </button>

                        <!-- Custom Popover Dropdown -->
                        <div v-if="activeRowGroupDropdownId === c.id"
                          class="absolute z-50 left-0 right-0 mt-1 bg-surface border border-line rounded-xl shadow-xl overflow-hidden max-h-60 overflow-y-auto animate-rise-in min-w-[180px]">
                          <div class="p-1 space-y-0.5">
                            <button v-for="g in existingGroupsForScope(scopeInfo.scope)" :key="g" type="button"
                              @click="selectRowGroup(g)"
                              class="w-full text-left px-2.5 py-1.5 text-xs rounded-lg transition-colors text-ink-2 hover:bg-elevated/70 hover:text-ink flex items-center justify-between"
                              :class="editingCategoryGroup === g ? 'bg-elevated/50 text-ink font-medium' : ''">
                              <span>{{ g }}</span>
                              <Check v-if="editingCategoryGroup === g" class="w-3 h-3 text-ink shrink-0" />
                            </button>

                            <div class="border-t border-line/40 my-1"></div>

                            <div class="p-1.5 space-y-1" @click.stop>
                              <div class="text-[9px] uppercase tracking-wider text-ink-3 font-mono">Custom group:</div>
                              <input v-model="editingCategoryGroup"
                                @keydown.enter.prevent="activeRowGroupDropdownId = null"
                                @keydown.esc="editingCategoryId = null" placeholder="Press enter to apply"
                                autocomplete="off"
                                class="bg-canvas border border-line rounded px-2 py-1.5 text-xs outline-none focus:border-line-2 w-full font-sans text-ink" />
                            </div>
                          </div>
                        </div>
                      </div>
                    </template>
                    <template v-else>
                      <span
                        class="inline-block text-[10px] font-mono uppercase tracking-wider text-ink-2 bg-elevated border border-line rounded px-2 py-0.5">
                        {{ c.group || 'One-Off' }}
                      </span>
                    </template>
                  </td>

                  <!-- Default Value -->
                  <td class="py-3 px-1">
                    <template v-if="editingCategoryId === c.id">
                      <input type="number" v-model.number="editingCategoryDefaultValue"
                        @keydown.enter="saveEditCategory(c)" @keydown.esc="editingCategoryId = null"
                        class="bg-canvas border border-line rounded px-2.5 py-1.5 text-sm outline-none focus:border-line-2 w-full font-mono text-ink text-right"
                        placeholder="0" />
                    </template>
                    <template v-else>
                      <span class="font-mono text-xs text-ink-2">
                        {{ c.defaultValue ? inr(c.defaultValue) : '—' }}
                      </span>
                    </template>
                  </td>

                  <!-- Actions -->
                  <td class="py-3 px-1 text-right">
                    <div class="flex items-center justify-end gap-1">
                      <template v-if="editingCategoryId === c.id">
                        <button @click="saveEditCategory(c)"
                          class="btn-ghost !p-1.5 text-pri-strategic hover:bg-pri-strategic/10" title="Save changes">
                          <Check class="w-4 h-4" />
                        </button>
                        <button @click="editingCategoryId = null"
                          class="btn-ghost !p-1.5 hover:text-pri-critical hover:bg-pri-critical/10" title="Cancel">
                          <X class="w-4 h-4" />
                        </button>
                      </template>
                      <template v-else>
                        <button @click="startEditCategory(c)"
                          class="btn-ghost !p-1.5 opacity-0 group-hover:opacity-100 focus:opacity-100 hover:bg-elevated text-ink-3 hover:text-ink transition-all duration-200"
                          title="Edit Category">
                          <Edit3 class="w-4 h-4" />
                        </button>
                        <button @click="archiveCategoryFn(c)"
                          class="btn-ghost !p-1.5 opacity-0 group-hover:opacity-100 focus:opacity-100 hover:bg-elevated transition-all duration-200"
                          :class="c.archived ? 'text-pri-strategic hover:text-pri-strategic hover:opacity-100' : 'text-ink-3 hover:text-pri-interruptive'"
                          :title="c.archived ? 'Restore category' : 'Archive category'">
                          <Archive class="w-4 h-4" />
                        </button>
                        <button @click="removeCategoryFn(c)"
                          class="btn-ghost !p-1.5 opacity-0 group-hover:opacity-100 focus:opacity-100 hover:bg-elevated hover:text-pri-critical text-ink-3 transition-all duration-200"
                          :data-testid="`category-remove-${c.id}`" :title="`Remove ${c.name}`">
                          <Trash2 class="w-4 h-4" />
                        </button>
                      </template>
                    </div>
                  </td>
                </tr>
                <tr v-if="!finance.categoriesForScope(scopeInfo.scope).length">
                  <td colspan="3" class="py-4 text-center text-ink-3 italic">
                    No categories in this scope yet.
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- Cash Flow Column -->
      <div class="space-y-8">
        <div class="overline text-ink-3 tracking-wider mb-2 font-mono">Cash Flow Categories</div>
        <div v-for="scopeInfo in [
          { label: 'Income', scope: 'income' },
          { label: 'Investments', scope: 'investment' },
          { label: 'Expenses', scope: 'expense' }
        ]" :key="scopeInfo.scope" class="card p-6" :data-testid="`category-group-${scopeInfo.scope}`">
          <div class="flex items-center justify-between mb-4 pb-2 border-b border-line">
            <h3 class="font-serif text-lg font-bold text-ink">{{ scopeInfo.label }}</h3>
            <div class="flex items-center gap-2">
              <span class="text-xs text-ink-3 font-mono bg-elevated px-2 py-0.5 rounded border border-line">
                {{ finance.categoriesForScope(scopeInfo.scope).length }} categories
              </span>
              <button @click="openAddCatPopup(scopeInfo.scope)"
                class="btn-ghost !p-1 hover:bg-elevated hover:text-ink transition-all duration-200 rounded-lg animate-fade-in"
                :data-testid="`add-category-btn-${scopeInfo.scope}`" title="Add category">
                <Plus class="w-4 h-4 text-ink-2" />
              </button>
            </div>
          </div>

          <div class="overflow-x-auto min-h-[260px]">
            <table class="w-full text-sm text-left border-collapse">
              <thead>
                <tr class="border-b border-line pb-2 text-ink-3 uppercase text-[10px] tracking-wider">
                  <th class="py-2 px-1 w-1/3">Category Name</th>
                  <th class="py-2 px-1 w-1/4">Group / Type</th>
                  <th class="py-2 px-1 w-1/4">Default</th>
                  <th class="py-2 px-1 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="c in filteredCategoriesForScope(scopeInfo.scope)" :key="c.id"
                  class="border-b border-line/40 hover:bg-canvas/30 transition-colors group"
                  :class="c.archived ? 'opacity-70 bg-elevated/40 border-dashed' : ''"
                  :data-testid="`category-${scopeInfo.scope}-${c.name}`">

                  <!-- Category Name -->
                  <td class="py-3 px-1">
                    <template v-if="editingCategoryId === c.id">
                      <input v-model="editingCategoryName" @keydown.enter="saveEditCategory(c)"
                        @keydown.esc="editingCategoryId = null"
                        class="bg-canvas border border-line rounded px-2.5 py-1.5 text-sm outline-none focus:border-line-2 w-full font-sans text-ink"
                        autofocus />
                    </template>
                    <template v-else>
                      <span :class="c.archived ? 'line-through text-ink-3' : 'text-ink'" class="capitalize font-medium">
                        {{ label(c.name) }}
                      </span>
                    </template>
                  </td>

                  <!-- Group / Type -->
                  <td class="py-3 px-1">
                    <template v-if="editingCategoryId === c.id">
                      <div class="relative" ref="rowGroupContainer">
                        <button type="button" @click="toggleRowGroupDropdown(c.id)"
                          class="bg-canvas border border-line rounded px-2.5 py-1.5 text-sm outline-none focus:border-line-2 w-full font-sans text-ink text-left flex items-center justify-between transition-all select-none">
                          <span class="truncate pr-2">{{ editingCategoryGroup || 'One-Off' }}</span>
                          <ChevronDown class="w-3.5 h-3.5 text-ink-3 shrink-0" />
                        </button>

                        <!-- Custom Popover Dropdown -->
                        <div v-if="activeRowGroupDropdownId === c.id"
                          class="absolute z-50 left-0 right-0 mt-1 bg-surface border border-line rounded-xl shadow-xl overflow-hidden max-h-60 overflow-y-auto animate-rise-in min-w-[180px]">
                          <div class="p-1 space-y-0.5">
                            <button v-for="g in existingGroupsForScope(scopeInfo.scope)" :key="g" type="button"
                              @click="selectRowGroup(g)"
                              class="w-full text-left px-2.5 py-1.5 text-xs rounded-lg transition-colors text-ink-2 hover:bg-elevated/70 hover:text-ink flex items-center justify-between"
                              :class="editingCategoryGroup === g ? 'bg-elevated/50 text-ink font-medium' : ''">
                              <span>{{ g }}</span>
                              <Check v-if="editingCategoryGroup === g" class="w-3 h-3 text-ink shrink-0" />
                            </button>

                            <div class="border-t border-line/40 my-1"></div>

                            <div class="p-1.5 space-y-1" @click.stop>
                              <div class="text-[9px] uppercase tracking-wider text-ink-3 font-mono">Custom group:</div>
                              <input v-model="editingCategoryGroup"
                                @keydown.enter.prevent="activeRowGroupDropdownId = null"
                                @keydown.esc="editingCategoryId = null" placeholder="Press enter to apply"
                                autocomplete="off"
                                class="bg-canvas border border-line rounded px-2 py-1.5 text-xs outline-none focus:border-line-2 w-full font-sans text-ink" />
                            </div>
                          </div>
                        </div>
                      </div>
                    </template>
                    <template v-else>
                      <span
                        class="inline-block text-[10px] font-mono uppercase tracking-wider text-ink-2 bg-elevated border border-line rounded px-2 py-0.5">
                        {{ c.group || 'One-Off' }}
                      </span>
                    </template>
                  </td>

                  <!-- Default Value -->
                  <td class="py-3 px-1">
                    <template v-if="editingCategoryId === c.id">
                      <input type="number" v-model.number="editingCategoryDefaultValue"
                        @keydown.enter="saveEditCategory(c)" @keydown.esc="editingCategoryId = null"
                        class="bg-canvas border border-line rounded px-2.5 py-1.5 text-sm outline-none focus:border-line-2 w-full font-mono text-ink text-right"
                        placeholder="0" />
                    </template>
                    <template v-else>
                      <span class="font-mono text-xs text-ink-2">
                        {{ c.defaultValue ? inr(c.defaultValue) : '—' }}
                      </span>
                    </template>
                  </td>

                  <!-- Actions -->
                  <td class="py-3 px-1 text-right">
                    <div class="flex items-center justify-end gap-1">
                      <template v-if="editingCategoryId === c.id">
                        <button @click="saveEditCategory(c)"
                          class="btn-ghost !p-1.5 text-pri-strategic hover:bg-pri-strategic/10" title="Save changes">
                          <Check class="w-4 h-4" />
                        </button>
                        <button @click="editingCategoryId = null"
                          class="btn-ghost !p-1.5 hover:text-pri-critical hover:bg-pri-critical/10" title="Cancel">
                          <X class="w-4 h-4" />
                        </button>
                      </template>
                      <template v-else>
                        <button @click="startEditCategory(c)"
                          class="btn-ghost !p-1.5 opacity-0 group-hover:opacity-100 focus:opacity-100 hover:bg-elevated text-ink-3 hover:text-ink transition-all duration-200"
                          title="Edit Category">
                          <Edit3 class="w-4 h-4" />
                        </button>
                        <button @click="archiveCategoryFn(c)"
                          class="btn-ghost !p-1.5 opacity-0 group-hover:opacity-100 focus:opacity-100 hover:bg-elevated transition-all duration-200"
                          :class="c.archived ? 'text-pri-strategic hover:text-pri-strategic hover:opacity-100' : 'text-ink-3 hover:text-pri-interruptive'"
                          :title="c.archived ? 'Restore category' : 'Archive category'">
                          <Archive class="w-4 h-4" />
                        </button>
                        <button @click="removeCategoryFn(c)"
                          class="btn-ghost !p-1.5 opacity-0 group-hover:opacity-100 focus:opacity-100 hover:bg-elevated hover:text-pri-critical text-ink-3 transition-all duration-200"
                          :data-testid="`category-remove-${c.id}`" :title="`Remove ${c.name}`">
                          <Trash2 class="w-4 h-4" />
                        </button>
                      </template>
                    </div>
                  </td>
                </tr>
                <tr v-if="!finance.categoriesForScope(scopeInfo.scope).length">
                  <td colspan="3" class="py-4 text-center text-ink-3 italic">
                    No categories in this scope yet.
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>

    <!-- Add Category Popup Modal -->
    <div v-if="showAddCatForm" @keydown.window.esc="showAddCatForm = false"
      class="fixed inset-0 z-50 flex items-center justify-center p-4" data-testid="add-category-modal">
      <div class="fixed inset-0 bg-ink/30 backdrop-blur-sm animate-fade-in" @click="showAddCatForm = false"></div>
      <form @submit.prevent="submitAddCat" @keydown.meta.enter.prevent="submitAddCat"
        @keydown.ctrl.enter.prevent="submitAddCat"
        class="relative w-full max-w-sm card p-6 animate-rise-in shadow-2xl bg-surface">
        <button type="button" class="absolute top-4 right-4 btn-ghost !p-1.5" @click="showAddCatForm = false"
          data-testid="close-add-category-modal">
          <X class="w-4 h-4 text-ink-3 hover:text-ink" />
        </button>
        <h3 class="font-serif text-xl text-ink font-medium leading-none mb-6">Add a {{ scopeLabel(addCatScope) }}
          category
        </h3>

        <div class="space-y-4 mb-6">
          <div class="relative" ref="groupContainer">
            <label class="text-[10px] uppercase tracking-wider text-ink-3 block mb-1 font-mono">Group / Type</label>
            <button type="button" @click="showGroupSuggestions = !showGroupSuggestions"
              class="bg-canvas border border-line rounded-xl px-3 py-2 text-sm text-ink text-left flex items-center justify-between w-full font-sans select-none outline-none focus:border-line-2"
              data-testid="new-category-group-modal-btn">
              <span class="truncate pr-2">{{ addCatGroup || 'One-Off' }}</span>
              <ChevronDown class="w-3.5 h-3.5 text-ink-3 shrink-0" />
            </button>

            <!-- Custom Suggestions Popover -->
            <div v-if="showGroupSuggestions"
              class="absolute z-50 left-0 right-0 mt-1.5 bg-surface border border-line rounded-xl shadow-xl overflow-hidden max-h-56 overflow-y-auto animate-rise-in">
              <div class="p-1 space-y-0.5">
                <button v-for="g in existingGroupsForScope(addCatScope)" :key="g" type="button" @click="selectGroup(g)"
                  class="w-full text-left px-2.5 py-1.5 text-xs rounded-lg transition-colors text-ink-2 hover:bg-elevated/70 hover:text-ink flex items-center justify-between"
                  :class="addCatGroup === g ? 'bg-elevated/50 text-ink font-medium' : ''">
                  <span>{{ g }}</span>
                  <Check v-if="addCatGroup === g" class="w-3 h-3 text-ink shrink-0" />
                </button>

                <div class="border-t border-line/40 my-1"></div>

                <div class="p-1.5 space-y-1" @click.stop>
                  <div class="text-[9px] uppercase tracking-wider text-ink-3 font-mono">Custom group:</div>
                  <input v-model="addCatGroup" @keydown.enter.prevent="showGroupSuggestions = false"
                    placeholder="Type new group" autocomplete="off"
                    class="bg-canvas border border-line rounded px-2 py-1.5 text-xs outline-none focus:border-line-2 w-full font-sans text-ink" />
                </div>
              </div>
            </div>
          </div>

          <div>
            <label class="text-[10px] uppercase tracking-wider text-ink-3 block mb-1 font-mono">Category Name</label>
            <input ref="addCatNameInput" v-model="addCatName" placeholder="e.g. gold, school_fees"
              class="input-soft !text-sm text-ink" required data-testid="new-category-name-modal" />
          </div>

          <div>
            <label class="text-[10px] uppercase tracking-wider text-ink-3 block mb-1 font-mono">Default Value</label>
            <input type="number" v-model.number="addCatDefaultValue" placeholder="e.g. 5000"
              class="input-soft !text-sm text-ink" data-testid="new-category-default-value-modal" />
          </div>
        </div>

        <div class="flex justify-end gap-2">
          <button type="button" class="btn-ghost !text-xs !py-1.5 !px-3" @click="showAddCatForm = false">Cancel</button>
          <button type="submit" class="btn-primary !text-xs !py-1.5 !px-3" data-testid="new-category-save-modal">
            Add Category <span
              class="kbd !bg-canvas/20 !border-canvas/10 !text-canvas select-none text-[9px] ml-1">⌘Enter</span>
          </button>
        </div>
      </form>
    </div>
  </div>
</template>
