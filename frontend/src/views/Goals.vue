<script setup>
import { ref, computed, watch, nextTick, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { useGoalsStore } from '@/stores/goals'
import { useWishlistStore } from '@/stores/wishlist'
import { useYearsStore } from '@/stores/years'
import { useProjectsStore } from '@/stores/projects'
import { useTasksStore } from '@/stores/tasks'
import { useUIStore } from '@/stores/ui'
import { useSettingsStore } from '@/stores/settings'
import PageHeader from '@/components/PageHeader.vue'
import SectionHeader from '@/components/SectionHeader.vue'
import EmptyState from '@/components/EmptyState.vue'
import VInput from '@/components/VInput.vue'
import VTextarea from '@/components/VTextarea.vue'
import VSelect from '@/components/VSelect.vue'
import VCheckbox from '@/components/VCheckbox.vue'
import VRow from '@/components/VRow.vue'
import VCol from '@/components/VCol.vue'
import VUrlInput from '@/components/VUrlInput.vue'
import DateField from '@/components/DateField.vue'
import dayjs from 'dayjs'
import { Plus, X, Target, Trash2, Folder, CheckSquare, Check, Pencil, ExternalLink, Camera, Laptop, PiggyBank, FileText, Gift, Quote } from 'lucide-vue-next'

const route = useRoute()
const goals = useGoalsStore()
const wishlist = useWishlistStore()
const years = useYearsStore()
const projects = useProjectsStore()
const tasks = useTasksStore()
const ui = useUIStore()
const settingsStore = useSettingsStore()

const favoriteQuote = computed(() => settingsStore.get('favorite_quote', ''))
const favoriteQuoteAuthor = computed(() => settingsStore.get('favorite_quote_author', ''))

onMounted(async () => {
  await settingsStore.load()
  await goals.load()
  await wishlist.load()
  const goalId = route.query.goalId
  if (goalId) {
    router.replace(`/goals/${goalId}`)
  }
  const wishId = route.query.wishId
  if (wishId) {
    const found = wishlist.items.find(w => w.id === wishId)
    if (found) {
      openEditWish(found)
    }
  }
})

const showNew = ref(false)
const selectedGoal = ref(null)

const formattedYears = computed(() => years.items.map(y => ({ id: y.id, label: `${y.year} - ${y.theme}` })))

// Creation form states
const newTitle = ref('')
const newDesc = ref('')
const newYearIds = ref([])
const newUseNumeric = ref(false)
const newTargetNumber = ref(100)
const newAchievedNumber = ref(0)
const newGoalUnit = ref('')
const newImageUrl = ref('')
const newStartDate = ref('')
const newTargetDate = ref('')
const newGoalZoom = ref(100)
const newGoalPositionY = ref(50)
const showCreateYearDropdown = ref(false)
const newYearsLabel = computed(() => {
  if (newYearIds.value.length === 0) return 'Select Years...'
  const selectedYearsList = newYearIds.value
    .map(id => years.items.find(y => y.id === id))
    .filter(Boolean)
    .map(y => y.year)
  if (selectedYearsList.length === years.items.length && years.items.length > 0) return 'All Years'
  return selectedYearsList.join(', ')
})

function toggleNewYear(yid) {
  if (newYearIds.value.includes(yid)) {
    newYearIds.value = newYearIds.value.filter(id => id !== yid)
  } else {
    newYearIds.value.push(yid)
  }
}

// Edit/Detail form states
const editTitle = ref('')
const editDesc = ref('')
const editYearIds = ref([])
const editUseNumeric = ref(false)
const editTargetNumber = ref(0)
const editAchievedNumber = ref(0)
const editImageUrl = ref('')
const editStartDate = ref('')
const editTargetDate = ref('')
const editGoalZoom = ref(100)
const editGoalPositionY = ref(50)
const newTaskTitle = ref('')

function formatDate(dateStr) {
  if (!dateStr) return ''
  return dayjs(dateStr).format('MMM D, YYYY')
}

const isDraggingImage = ref(false)
let dragStartY = 0
let dragStartPercent = 50

function startDrag(e, type) {
  // Prevent text selection while dragging
  e.preventDefault()
  isDraggingImage.value = true
  dragStartY = e.clientY || e.touches?.[0]?.clientY || 0

  if (type === 'new-goal') dragStartPercent = newGoalPositionY.value
  else if (type === 'edit-goal') dragStartPercent = editGoalPositionY.value
  else if (type === 'new-wish') dragStartPercent = newWishPositionY.value
  else if (type === 'edit-wish') dragStartPercent = editWishPositionY.value

  const handleMove = (moveEvent) => {
    if (!isDraggingImage.value) return
    const currentY = moveEvent.clientY || moveEvent.touches?.[0]?.clientY || 0
    const deltaY = currentY - dragStartY

    // Cover container height is 192px (h-48 = 12rem = 192px)
    const containerHeight = 192
    const deltaPercent = (deltaY / containerHeight) * 100

    // Dragging down shifts image down (so position Y percentage should decrease to show top)
    let newY = dragStartPercent - deltaPercent
    newY = Math.max(0, Math.min(100, Math.round(newY)))

    if (type === 'new-goal') newGoalPositionY.value = newY
    else if (type === 'edit-goal') editGoalPositionY.value = newY
    else if (type === 'new-wish') newWishPositionY.value = newY
    else if (type === 'edit-wish') editWishPositionY.value = newY
  }

  const handleUp = () => {
    isDraggingImage.value = false
    window.removeEventListener('mousemove', handleMove)
    window.removeEventListener('mouseup', handleUp)
    window.removeEventListener('touchmove', handleMove)
    window.removeEventListener('touchend', handleUp)
  }

  window.addEventListener('mousemove', handleMove)
  window.addEventListener('mouseup', handleUp)
  window.addEventListener('touchmove', handleMove)
  window.addEventListener('touchend', handleUp)
}

function openDetails(g) {
  selectedGoal.value = g
  editTitle.value = g.title || ''
  editDesc.value = g.description || ''
  editYearIds.value = g.yearIds || (g.yearId ? [g.yearId] : [])
  editUseNumeric.value = g.useNumeric || false
  editGoalUnit.value = g.unit || ''
  editTargetNumber.value = g.targetNumber || 0
  editAchievedNumber.value = g.achievedNumber || 0
  editImageUrl.value = g.imageUrl || ''
  editStartDate.value = g.startDate || ''
  editTargetDate.value = g.targetDate || ''
  editGoalZoom.value = g.imageZoom || 100
  editGoalPositionY.value = g.imagePositionY || 50
  newTaskTitle.value = ''
  goals.markViewed(g.id)
}

function toggleEditYear(yid) {
  if (editYearIds.value.includes(yid)) {
    editYearIds.value = editYearIds.value.filter(id => id !== yid)
  } else {
    editYearIds.value.push(yid)
  }
}

const showEditYearDropdown = ref(false)
const editYearsLabel = computed(() => {
  if (editYearIds.value.length === 0) return 'Select Years...'
  const selectedYearsList = editYearIds.value
    .map(id => years.items.find(y => y.id === id))
    .filter(Boolean)
    .map(y => y.year)
  if (selectedYearsList.length === years.items.length && years.items.length > 0) return 'All Years'
  return selectedYearsList.join(', ')
})

function projectCount(gid) {
  return projects.items.filter(p => p.goalId === gid && p.status !== 'archived').length
}

function yearsOf(g) {
  const ids = g.yearIds || (g.yearId ? [g.yearId] : [])
  return ids.map(id => years.items.find(y => y.id === id)).filter(Boolean)
}

function getGoalProjectsList(gid) {
  return projects.items.filter(p => p.goalId === gid && p.status !== 'archived')
}

function getProjectProgress(proj) {
  const projTasks = tasks.items.filter(t => t.projectId === proj.id)
  const total = projTasks.length
  if (!total) return 0
  const done = projTasks.filter(t => t.status === 'done').length
  return Math.round((done / total) * 100)
}

const goalTasksList = computed(() => {
  if (!selectedGoal.value) return []
  const goalProjIds = projects.items.filter(p => p.goalId === selectedGoal.value.id && p.status !== 'archived').map(p => p.id)
  return tasks.items.filter(t => t.goalId === selectedGoal.value.id || (t.projectId && goalProjIds.includes(t.projectId)))
})

function getGoalTasksCount(gid) {
  const goalProjIds = projects.items.filter(p => p.goalId === gid && p.status !== 'archived').map(p => p.id)
  return tasks.items.filter(t => t.goalId === gid || (t.projectId && goalProjIds.includes(t.projectId))).length
}

// Progress percentage calculations
function getGoalProgress(g) {
  if (!g.useNumeric) {
    return g.achievedNumber || 0
  }
  if (!g.targetNumber) return 0
  return Math.min(100, Math.round(((g.achievedNumber || 0) / g.targetNumber) * 100))
}

const tempCalculatedProgress = computed(() => {
  if (!editUseNumeric.value) {
    return editAchievedNumber.value || 0
  }
  if (!editTargetNumber.value) return 0
  return Math.min(100, Math.round((editAchievedNumber.value / editTargetNumber.value) * 100))
})

async function create() {
  if (!newTitle.value.trim()) return
  await goals.add({
    title: newTitle.value,
    description: newDesc.value,
    yearIds: newYearIds.value,
    yearId: newYearIds.value[0] || null,
    useNumeric: newUseNumeric.value,
    unit: newUseNumeric.value ? newGoalUnit.value : '%',
    targetNumber: newUseNumeric.value ? (Number(newTargetNumber.value) || 0) : 100,
    achievedNumber: Number(newAchievedNumber.value) || 0,
    imageUrl: newImageUrl.value,
    startDate: newStartDate.value,
    targetDate: newTargetDate.value,
    imageZoom: newGoalZoom.value,
    imagePositionY: newGoalPositionY.value
  })
  newTitle.value = ''; newDesc.value = ''; newYearIds.value = []; newUseNumeric.value = false; newTargetNumber.value = 100; newAchievedNumber.value = 0; newGoalUnit.value = ''; newImageUrl.value = ''; newStartDate.value = ''; newTargetDate.value = ''; newGoalZoom.value = 100; newGoalPositionY.value = 50; showNew.value = false
}

async function saveGoalEdits() {
  if (!selectedGoal.value) return
  await goals.update(selectedGoal.value.id, {
    title: editTitle.value.trim() || 'Untitled goal',
    description: editDesc.value,
    yearIds: editYearIds.value,
    yearId: editYearIds.value[0] || null,
    useNumeric: editUseNumeric.value,
    unit: editUseNumeric.value ? editGoalUnit.value : '%',
    targetNumber: editUseNumeric.value ? (Number(editTargetNumber.value) || 0) : 100,
    achievedNumber: Number(editAchievedNumber.value) || 0,
    imageUrl: editImageUrl.value,
    startDate: editStartDate.value,
    targetDate: editTargetDate.value,
    imageZoom: editGoalZoom.value,
    imagePositionY: editGoalPositionY.value
  })
  selectedGoal.value = null
  ui.showToast('Goal updated', 'success')
}

async function addTaskToGoal() {
  if (!newTaskTitle.value.trim() || !selectedGoal.value) return
  await tasks.add({
    title: newTaskTitle.value.trim(),
    goalId: selectedGoal.value.id
  })
  newTaskTitle.value = ''
  ui.showToast('Task added to goal', 'success')
}

async function removeGoal(g) {
  if (!await ui.confirm({ message: `Delete goal "${g.title}"? Linked projects will remain.`, title: 'Delete Goal' })) return
  await goals.remove(g.id)
}

const newTitleInput = ref(null)
const editTitleInput = ref(null)

watch(showNew, (open) => {
  if (open) {
    nextTick(() => {
      newTitleInput.value?.focus()
    })
  }
})

watch(selectedGoal, (goal) => {
  if (goal) {
    nextTick(() => {
      editTitleInput.value?.focus()
    })
  }
})

// Wish List Refs & Logic
const showNewWish = ref(false)
const selectedWish = ref(null)

const newWishTitle = ref('')
const newWishDesc = ref('')
const newWishUrl = ref('')
const newWishImageUrl = ref('')
const newWishGoalId = ref(null)
const newWishUnit = ref('')
const newWishGoal = ref(0)
const newWishCurrent = ref(0)
const newWishPurchased = ref(false)
const newWishZoom = ref(100)
const newWishPositionY = ref(50)
const newWishPrice = ref(null)

const editWishTitle = ref('')
const editWishDesc = ref('')
const editWishUrl = ref('')
const editWishImageUrl = ref('')
const editWishGoalId = ref(null)
const editWishUnit = ref('')
const editWishGoal = ref(0)
const editWishCurrent = ref(0)
const editWishPurchased = ref(false)
const editWishZoom = ref(100)
const editWishPositionY = ref(50)
const editWishPrice = ref(null)

const editGoalUnit = ref('')

function openNewWish() {
  newWishTitle.value = ''
  newWishDesc.value = ''
  newWishUrl.value = ''
  newWishImageUrl.value = ''
  newWishGoalId.value = null
  newWishUnit.value = settingsStore.get('default_spending_currency', '₹')
  newWishGoal.value = 0
  newWishCurrent.value = 0
  newWishPurchased.value = false
  newWishZoom.value = 100
  newWishPositionY.value = 50
  newWishPrice.value = null
  showNewWish.value = true
}

async function createWish() {
  if (!newWishTitle.value.trim()) return
  await wishlist.add({
    title: newWishTitle.value,
    description: newWishDesc.value,
    url: newWishUrl.value,
    imageUrl: newWishImageUrl.value,
    goalId: newWishGoalId.value,
    unit: newWishUnit.value || '',
    goalValue: newWishGoal.value,
    currentValue: newWishCurrent.value,
    purchased: newWishPurchased.value,
    imageZoom: newWishZoom.value,
    imagePositionY: newWishPositionY.value,
    price: newWishPrice.value
  })
  showNewWish.value = false
  ui.showToast('Wish added successfully', 'success')
}

function openEditWish(w) {
  selectedWish.value = w
  editWishTitle.value = w.title || ''
  editWishDesc.value = w.description || ''
  editWishUrl.value = w.url || ''
  editWishImageUrl.value = w.imageUrl || ''
  editWishGoalId.value = w.goalId || null
  editWishUnit.value = w.unit || ''
  editWishGoal.value = w.goalValue || 0
  editWishCurrent.value = w.currentValue || 0
  editWishPurchased.value = w.purchased || false
  editWishZoom.value = w.imageZoom || 100
  editWishPositionY.value = w.imagePositionY || 50
  editWishPrice.value = w.price || null
  wishlist.markViewed(w.id)
}

async function saveWish() {
  if (!selectedWish.value) return
  await wishlist.update(selectedWish.value.id, {
    title: editWishTitle.value,
    description: editWishDesc.value,
    url: editWishUrl.value,
    imageUrl: editWishImageUrl.value,
    goalId: editWishGoalId.value,
    unit: editWishUnit.value || '',
    goalValue: editWishGoal.value,
    currentValue: editWishCurrent.value,
    purchased: editWishPurchased.value,
    imageZoom: editWishZoom.value,
    imagePositionY: editWishPositionY.value,
    price: editWishPrice.value
  })
  selectedWish.value = null
  ui.showToast('Wish updated successfully', 'success')
}

async function toggleWishPurchased(w) {
  await wishlist.update(w.id, {
    purchased: !w.purchased
  })
  ui.showToast(w.purchased ? 'Wish marked active' : 'Wish marked purchased', 'success')
}

async function deleteWish(w) {
  if (await ui.confirm({ message: `Delete wish "${w.title}"?`, title: 'Delete Wish' })) {
    await wishlist.remove(w.id)
    ui.showToast('Wish deleted', 'info')
  }
}

function displayUrl(url) {
  if (!url) return ''
  try {
    const parsed = new URL(url.startsWith('http') ? url : 'https://' + url)
    return parsed.hostname + (parsed.pathname !== '/' ? parsed.pathname : '')
  } catch (e) {
    return url
  }
}

function formatCurrency(val) {
  if (val === undefined || val === null) return '$0'
  return '$' + Number(val).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })
}

function formatWishValue(val, unit) {
  const defaultSym = settingsStore.get('default_spending_currency', '₹')
  const u = (unit?.trim() || defaultSym)
  if (u === '$' || u === '₹' || u === '€' || u === '£') {
    return `${u}${Number(val).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`
  }
  if (u === '%') {
    return `${val}%`
  }
  return `${Number(val).toLocaleString()} ${u}`
}

function formatGoalProgress(g) {
  if (!g.useNumeric) {
    return `${g.achievedNumber || 0}%`
  }
  const current = g.achievedNumber || 0
  const target = g.targetNumber || 0
  const unit = g.unit?.trim() || ''

  if (unit === '%') {
    return `${current}% / ${target}%`
  }
  if (unit === '$' || unit === '₹' || unit === '€' || unit === '£') {
    return `${unit}${current.toLocaleString()} / ${unit}${target.toLocaleString()}`
  }
  if (unit) {
    return `${current.toLocaleString()} / ${target.toLocaleString()} ${unit}`
  }
  return `${current} / ${target}`
}

function getWishProgress(w) {
  if (w.goalId) {
    const goal = goals.items.find(g => g.id === w.goalId)
    if (goal) {
      return getGoalProgress(goal)
    }
  }
  if (!w.goalValue) return 0
  const pct = (w.currentValue / w.goalValue) * 100
  return Math.round(pct)
}

function getWishProgressText(w) {
  if (w.goalId) {
    const goal = goals.items.find(g => g.id === w.goalId)
    if (goal) {
      return formatGoalProgress(goal)
    }
    return ''
  }
  if (!w.goalValue) return ''
  const current = w.currentValue || 0
  const target = w.goalValue || 0
  const unit = w.unit || ''
  if (unit === '$' || unit === '₹' || unit === '€' || unit === '£') {
    return `${unit}${current.toLocaleString()} / ${unit}${target.toLocaleString()}`
  }
  if (unit) {
    return `${current.toLocaleString()} / ${target.toLocaleString()} ${unit}`
  }
  return `${current} / ${target}`
}

function cleanImageUrl(url) {
  if (!url) return ''
  // Clean Magento /product/cache/<hash>/ path segment to get the original high-resolution image
  return url.replace(/\/cache\/[^/]+/gi, '')
}

function formatWishPrice(w) {
  if (w.price === undefined || w.price === null || w.price === '') return ''
  const defaultSym = settingsStore.get('default_spending_currency', '₹')
  const unit = (w.unit || (w.goalId ? goals.items.find(g => g.id === w.goalId)?.unit : '') || defaultSym).trim()
  if (unit === '$' || unit === '₹' || unit === '€' || unit === '£' || unit === 'INR' || unit === 'USD') {
    const sym = unit === 'INR' ? '₹' : unit === 'USD' ? '$' : unit === 'EUR' ? '€' : unit === 'GBP' ? '£' : unit
    return `${sym}${Number(w.price).toLocaleString()}`
  }
  if (unit) {
    return `${Number(w.price).toLocaleString()} ${unit}`
  }
  return `${defaultSym}${Number(w.price).toLocaleString()}`
}

function daysLeftInYear() {
  const now = new Date()
  const end = new Date(now.getFullYear(), 12, 0) // Dec 31
  const diff = end - now
  return Math.ceil(diff / (1000 * 60 * 60 * 24))
}

function getGoalIcon(g) {
  const t = g.title.toLowerCase()
  if (t.includes('financial') || t.includes('money') || t.includes('worth') || t.includes('clarity') || t.includes('budget') || t.includes('wealth')) return Target
  if (t.includes('content') || t.includes('photo') || t.includes('video') || t.includes('pieces') || t.includes('write') || t.includes('create')) return Camera
  if (t.includes('task') || t.includes('work') || t.includes('project') || t.includes('code') || t.includes('program')) return CheckSquare
  return Target
}

function getWishFallbackIcon(w) {
  const t = w.title.toLowerCase()
  if (t.includes('laptop') || t.includes('computer') || t.includes('macbook') || t.includes('pc') || t.includes('screen') || t.includes('monitor') || t.includes('keyboard')) return Laptop
  if (t.includes('save') || t.includes('fund') || t.includes('piggy') || t.includes('bank') || t.includes('money') || t.includes('wealth')) return PiggyBank
  if (t.includes('paper') || t.includes('book') || t.includes('read') || t.includes('notes') || t.includes('journal')) return FileText
  return Gift
}
</script>

<template>
  <div class="px-8 md:px-12 py-10 max-w-7xl mx-auto" data-testid="goals-view">
    <PageHeader overline="Horizon" title="Goals & Wishes" sub="The few large things this year is for." />

    <!-- Action Bar -->
    <div class="card p-4 mb-8 bg-surface/50 border border-line flex items-center justify-between gap-3 flex-wrap sm:flex-nowrap">
      <div v-if="favoriteQuote" class="flex items-center gap-2.5 min-w-0">
        <Quote class="w-4 h-4 text-pri-strategic shrink-0" />
        <span class="text-xs text-ink font-serif italic tracking-tight line-clamp-1">
          “{{ favoriteQuote }}”
          <span v-if="favoriteQuoteAuthor" class="font-sans font-semibold text-ink-3 uppercase text-[10px] not-italic ml-1">— {{ favoriteQuoteAuthor }}</span>
        </span>
      </div>
      <span v-else class="text-xs text-ink-3">Manage your long-term roadmap and aspirations.</span>
      <span class="px-2.5 py-1 text-[11px] font-mono font-bold bg-canvas border border-line rounded-lg text-ink-3 shrink-0">
        {{ daysLeftInYear() }} days left this year
      </span>
    </div>

    <!-- Goals Stacked Section -->
    <div class="mb-12">
      <SectionHeader overline="Aspirations" title="Goals" class="mb-5">
        <template #right>
          <button class="btn-primary !py-2 !px-4 !text-xs flex items-center gap-1.5" @click="showNew = true"
            data-testid="new-goal-btn">
            <Plus class="w-3.5 h-3.5" /> New goal
          </button>
        </template>
      </SectionHeader>

      <div v-if="goals.items.length" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div v-for="g in goals.items" :key="g.id" @click="$router.push(`/goals/${g.id}`)"
          class="relative p-[1.5px] rounded-2xl overflow-hidden group cursor-pointer transition-all duration-300 bg-line hover:bg-line-2"
          :data-testid="`goal-card-${g.id}`">

          <!-- Monochromatic Conic Gradient Progress Border -->
          <div v-if="getGoalProgress(g) > 0" class="absolute inset-0 pointer-events-none transition-all duration-500"
            :style="{ background: `conic-gradient(rgb(var(--ink)) ${getGoalProgress(g)}%, rgb(var(--line)) 0)` }"></div>

          <!-- Inner Card Content Area -->
          <div class="relative bg-surface rounded-[14px] p-5 flex flex-col gap-2 h-full z-1">
            <div class="flex items-start gap-4 min-w-0 h-full">
              <!-- Left decorative thumbnail or icon wrapper (Vertically Centered) -->
              <div class="relative shrink-0 self-center my-auto">
                <img v-if="g.imageUrl" :src="cleanImageUrl(g.imageUrl)"
                  class="w-24 h-24 rounded-2xl object-cover border border-line bg-canvas shrink-0"
                  :style="{ objectPosition: `center ${g.imagePositionY || 50}%` }" @error="g.imageUrl = ''" />
                <div v-else
                  class="w-24 h-24 rounded-2xl bg-canvas border border-line flex flex-col items-center justify-center text-ink-2 relative overflow-hidden">
                  <component :is="getGoalIcon(g)" class="w-8 h-8 stroke-[1.25]" />
                  <span v-if="g.useNumeric && g.targetNumber"
                    class="absolute bottom-1.5 text-[9px] font-mono font-bold bg-ink/5 px-1.5 py-0.5 rounded border border-line/10">
                    {{ g.targetNumber }}+
                  </span>
                </div>
                <!-- Year Overlay Badge -->
                <span
                  class="absolute -top-1.5 -left-1.5 px-1.5 py-0.5 text-[8px] font-mono font-bold bg-ink text-surface rounded-md border border-line/10 shadow-sm select-none z-10">
                  {{yearsOf(g).map(y => y.year).join(', ') || '2026'}}
                </span>
              </div>

              <!-- Middle details -->
              <div class="min-w-0 flex-1">
                <h4 class="font-serif text-base font-bold text-ink leading-snug break-words">
                  {{ g.title }}
                </h4>
                <p v-if="g.description" class="text-xs text-ink-2 mt-2 line-clamp-2 leading-relaxed">
                  {{ g.description }}
                </p>
                <div v-if="g.startDate || g.targetDate"
                  class="flex flex-wrap items-center gap-3 mt-3 text-[10px] font-mono text-ink-3 font-semibold select-none">
                  <span v-if="g.startDate"
                    class="inline-flex items-center gap-1 bg-canvas border border-line px-1.5 py-0.5 rounded text-ink-2">
                    <span class="text-[8px] uppercase tracking-wider text-ink-3">Start</span> {{ formatDate(g.startDate)
                    }}
                  </span>
                  <span v-if="g.targetDate"
                    class="inline-flex items-center gap-1 bg-canvas border border-line px-1.5 py-0.5 rounded text-ink-2">
                    <span class="text-[8px] uppercase tracking-wider text-ink-3">Target</span> {{
                      formatDate(g.targetDate) }}
                  </span>
                </div>
              </div>
            </div>

            <!-- Top Right Goal Actions -->
            <div
              class="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center gap-1 z-10 bg-surface pl-1.5 py-0.5 rounded">
              <button @click.stop="openDetails(g)" class="btn-ghost !p-1 hover:text-ink transition-colors"
                title="Edit goal">
                <Pencil class="w-3.5 h-3.5" />
              </button>
              <button @click.stop="removeGoal(g)" class="btn-ghost !p-1 hover:text-pri-critical transition-colors"
                title="Delete goal" :data-testid="`goal-delete-${g.id}`">
                <Trash2 class="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

        </div>
      </div>
      <EmptyState v-else title="No goals yet" hint="A goal can be a quiet promise." />
    </div>

    <!-- Wish List Stacked Section -->
    <div>
      <SectionHeader overline="Desires" title="Goal Linked Wish List" class="mb-5">
        <template #right>
          <button class="btn-primary !py-2 !px-4 !text-xs flex items-center gap-1.5" @click="openNewWish">
            <Plus class="w-3.5 h-3.5" /> New wish
          </button>
        </template>
      </SectionHeader>

      <div v-if="wishlist.items.length" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div v-for="w in wishlist.items" :key="w.id" @click="openEditWish(w)"
          class="relative p-[1.5px] rounded-2xl overflow-hidden group cursor-pointer transition-all duration-300 bg-line hover:bg-line-2"
          :class="{ 'opacity-55': w.purchased }" :data-testid="`wish-card-${w.id}`">

          <!-- Monochromatic or Green Progress Border -->
          <div v-if="getWishProgress(w) > 0" class="absolute inset-0 pointer-events-none transition-all duration-500"
            :style="{
              background: getWishProgress(w) >= 100
                ? 'rgb(var(--pri-strategic))'
                : `conic-gradient(rgb(var(--ink)) ${getWishProgress(w)}%, rgb(var(--line)) 0)`
            }"></div>

          <!-- Inner Card Content Area -->
          <div class="relative bg-surface rounded-[14px] overflow-hidden flex flex-col h-full z-1">
            <!-- Cover image at the top -->
            <div v-if="w.imageUrl" class="w-full h-36 border-b border-line bg-canvas overflow-hidden relative shrink-0">
              <img :src="cleanImageUrl(w.imageUrl)" class="w-full h-full object-cover"
                :style="{ objectPosition: `center ${w.imagePositionY || 50}%` }" @error="w.imageUrl = ''" />
            </div>
            <div v-else
              class="w-full h-36 border-b border-line bg-canvas/30 flex items-center justify-center text-ink-3 shrink-0">
              <component :is="getWishFallbackIcon(w)" class="w-10 h-10 stroke-[1.25]" />
            </div>

            <!-- Content Area below cover -->
            <div class="p-5 flex-1 flex flex-col justify-center min-w-0">
              <div class="flex items-baseline justify-between gap-3 min-w-0">
                <h4 class="font-serif text-base font-semibold text-ink leading-snug break-words"
                  :class="{ 'line-through text-ink-3': w.purchased }">{{ w.title }}</h4>
                <span v-if="w.price"
                  class="text-xs font-mono font-bold text-ink shrink-0 select-none bg-canvas px-1.5 py-0.5 rounded border border-line">
                  {{ formatWishPrice(w) }}
                </span>
              </div>
              <p v-if="w.description" class="text-xs text-ink-2 mt-1.5 line-clamp-2 leading-relaxed">
                {{ w.description }}
              </p>
              <!-- URL Link with ExternalIcon -->
              <div v-if="w.url" class="flex flex-wrap items-center gap-2 mt-2">
                <a :href="w.url.startsWith('http') ? w.url : 'https://' + w.url" target="_blank" @click.stop
                  class="inline-flex items-center gap-0.5 text-[11px] text-ink-2 hover:underline font-medium truncate max-w-full">
                  <span>{{ displayUrl(w.url) }}</span>
                  <ExternalLink class="w-2.5 h-2.5 shrink-0" />
                </a>
              </div>
              <!-- Can be purchased now label -->
              <div v-if="getWishProgress(w) >= 100"
                class="flex items-center gap-1 text-[11px] font-bold text-pri-strategic mt-2">
                <Check class="w-3.5 h-3.5 stroke-[2.5]" />
                <span>Can be purchased now</span>
              </div>
            </div>

            <!-- Top Right Wish Actions -->
            <div
              class="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center gap-1 z-10 bg-surface pl-1.5 py-0.5 rounded">
              <button @click.stop="openEditWish(w)" class="btn-ghost !p-1 hover:text-ink transition-colors"
                title="Edit wish">
                <Pencil class="w-3.5 h-3.5" />
              </button>
              <button @click.stop="deleteWish(w)" class="btn-ghost !p-1 hover:text-pri-critical transition-colors"
                title="Delete wish">
                <Trash2 class="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

        </div>
      </div>
      <EmptyState v-else title="No items in wish list" hint="Add things you are planning for or saving towards." />
    </div>

    <!-- Create Goal Modal -->
    <div v-if="showNew" @keydown.window.esc="showNew = false"
      class="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div class="fixed inset-0 bg-ink/40 backdrop-blur-sm animate-fade-in" @click="showNew = false"></div>
      <form @submit.prevent="create" @keydown.meta.enter.prevent="create" @keydown.ctrl.enter.prevent="create"
        class="relative w-full max-w-md card p-8 animate-rise-in">
        <!-- Banner Image if available -->
        <div v-if="newImageUrl"
          class="w-full h-48 overflow-hidden rounded-xl border border-line mb-6 relative bg-canvas flex items-center justify-center cursor-ns-resize group select-none"
          @mousedown="startDrag($event, 'new-goal')" @touchstart="startDrag($event, 'new-goal')">
          <img :src="cleanImageUrl(newImageUrl)" class="w-full h-full object-cover pointer-events-none select-none"
            :style="{ objectPosition: `center ${newGoalPositionY || 50}%` }" />
          <div
            class="absolute bottom-0 inset-x-0 bg-ink/70 py-1.5 text-center text-[10px] text-surface font-semibold opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none">
            Drag image up/down to reposition
          </div>
        </div>

        <button type="button" class="absolute top-4 right-4 btn-ghost !p-1.5" @click="showNew = false">
          <X class="w-4 h-4" />
        </button>
        <div class="overline">New goal</div>
        <h2 class="font-serif text-2xl mt-1 mb-5">Something worth pursuing</h2>

        <VRow dense class="mb-4">
          <VCol cols="12" dense>
            <VInput ref="newTitleInput" v-model="newTitle" label="Goal Title" id="new-goal-title" required
              class="font-semibold" data-testid="new-goal-title" />
          </VCol>

          <VCol cols="12" dense>
            <VTextarea v-model="newDesc" label="Why it matters (optional)" id="new-goal-desc" :rows="2" />
          </VCol>

          <VCol cols="12" dense>
            <VInput v-model="newImageUrl" label="Image URL (optional)" id="new-goal-image" />
          </VCol>

          <VCol cols="6" dense>
            <DateField v-model="newStartDate" label="Start Date (optional)" id="new-goal-start-date" />
          </VCol>
          <VCol cols="6" dense>
            <DateField v-model="newTargetDate" label="Target Date (optional)" id="new-goal-target-date" />
          </VCol>

          <!-- Tracking Mode Segmented Control -->
          <VCol cols="12" dense class="pt-2">
            <div class="bg-canvas/30 rounded-xl border border-line/50 p-4">
              <span
                class="text-[10px] uppercase tracking-wider text-ink-3 font-semibold font-mono block mb-2.5">Tracking
                Mode</span>
              <div class="flex border border-line rounded-lg p-0.5 bg-canvas/50 w-full mb-4">
                <button type="button" class="flex-1 text-center py-1.5 text-xs font-semibold rounded-md transition-all"
                  :class="!newUseNumeric ? 'bg-surface text-ink shadow-sm border border-line-2/45' : 'text-ink-3 hover:text-ink'"
                  @click="newUseNumeric = false">
                  Direct %
                </button>
                <button type="button" class="flex-1 text-center py-1.5 text-xs font-semibold rounded-md transition-all"
                  :class="newUseNumeric ? 'bg-surface text-ink shadow-sm border border-line-2/45' : 'text-ink-3 hover:text-ink'"
                  @click="newUseNumeric = true; if (newAchievedNumber !== 0 && (!newTargetNumber || newTargetNumber === 0)) newTargetNumber = 100">
                  Target-based
                </button>
              </div>

              <!-- If Target-based (newUseNumeric is true) -->
              <div v-if="newUseNumeric" class="grid grid-cols-3 gap-3 mt-2">
                <VInput type="number" v-slot="{ inputProps }" v-model.number="newTargetNumber" label="Target"
                  id="new-goal-target" />
                <VInput type="number" v-slot="{ inputProps }" v-model.number="newAchievedNumber" label="Achieved"
                  id="new-goal-achieved" />
                <VInput v-model="newGoalUnit" label="Unit" id="new-goal-unit" />
              </div>

              <!-- If Direct % (newUseNumeric is false) -->
              <div v-else class="mt-2 space-y-2">
                <div class="flex justify-between text-xs font-mono text-ink-2">
                  <span>Progress</span>
                  <span class="font-bold text-ink">{{ newAchievedNumber }}%</span>
                </div>
                <input type="range" v-model.number="newAchievedNumber" min="0" max="100"
                  class="w-full accent-ink bg-elevated rounded-lg appearance-none h-1.5 cursor-pointer" />
              </div>
            </div>
          </VCol>

          <VCol cols="12" dense>
            <VSelect v-model="newYearIds" label="Years Assigned" id="new-goal-years" :options="formattedYears"
              option-value="id" option-label="label" multiple />
          </VCol>
        </VRow>

        <div class="flex justify-end gap-2">
          <button type="button" class="btn-ghost" @click="showNew = false">Cancel</button>
          <button type="submit" class="btn-primary" data-testid="new-goal-save">
            Create <span
              class="kbd !bg-canvas/20 !border-canvas/10 !text-canvas select-none text-[9px] ml-1">⌘Enter</span>
          </button>
        </div>
      </form>
    </div>

    <!-- Goal Details Modal (Wider split layout) -->
    <div v-if="selectedGoal" @keydown.window.esc="selectedGoal = null"
      class="fixed inset-0 z-50 flex items-center justify-center p-4" data-testid="goal-detail-modal">
      <div class="fixed inset-0 bg-ink/40 backdrop-blur-sm animate-fade-in" @click="selectedGoal = null"></div>
      <div class="relative w-full max-w-5xl card p-8 animate-rise-in shadow-2xl bg-surface"
        @keydown.meta.enter.prevent="saveGoalEdits" @keydown.ctrl.enter.prevent="saveGoalEdits">
        <!-- Banner Image if available -->
        <div v-if="editImageUrl"
          class="w-full h-56 overflow-hidden rounded-xl border border-line mb-6 relative bg-canvas flex items-center justify-center cursor-ns-resize group select-none"
          @mousedown="startDrag($event, 'edit-goal')" @touchstart="startDrag($event, 'edit-goal')">
          <img :src="cleanImageUrl(editImageUrl)" class="w-full h-full object-cover pointer-events-none select-none"
            :style="{ objectPosition: `center ${editGoalPositionY || 50}%` }" />
          <div
            class="absolute bottom-0 inset-x-0 bg-ink/70 py-1.5 text-center text-[10px] text-surface font-semibold opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none">
            Drag image up/down to reposition
          </div>
        </div>

        <button type="button" class="absolute top-4 right-4 btn-ghost !p-1.5" @click="selectedGoal = null">
          <X class="w-4 h-4" />
        </button>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-10">
          <!-- Left Column: Goal parameters -->
          <div class="space-y-6 md:pr-4">
            <h2 class="font-serif text-2xl font-bold text-ink mb-2">Edit Goal</h2>
            <VInput ref="editTitleInput" v-model="editTitle" label="Goal Details" id="goal-details-title"
              class="font-serif text-lg" />
            <VTextarea v-model="editDesc" label="Why it matters" id="goal-details-desc" :rows="4" />

            <VInput v-model="editImageUrl" label="Image URL (optional)" id="goal-details-image" />

            <div class="grid grid-cols-2 gap-4">
              <DateField v-model="editStartDate" label="Start Date (optional)" id="goal-start-date" />
              <DateField v-model="editTargetDate" label="Target Date (optional)" id="goal-target-date" />
            </div>

            <VSelect v-model="editYearIds" label="Years Assigned" id="goal-years" :options="formattedYears"
              option-value="id" option-label="label" multiple />

            <!-- Tracking Mode Segmented Control -->
            <div class="bg-canvas/30 rounded-xl border border-line/50 p-4">
              <span
                class="text-[10px] uppercase tracking-wider text-ink-3 font-semibold font-mono block mb-2.5">Tracking
                Mode</span>
              <div class="flex border border-line rounded-lg p-0.5 bg-canvas/50 w-full mb-4">
                <button type="button" class="flex-1 text-center py-1.5 text-xs font-semibold rounded-md transition-all"
                  :class="!editUseNumeric ? 'bg-surface text-ink shadow-sm border border-line-2/45' : 'text-ink-3 hover:text-ink'"
                  @click="editUseNumeric = false">
                  Direct %
                </button>
                <button type="button" class="flex-1 text-center py-1.5 text-xs font-semibold rounded-md transition-all"
                  :class="editUseNumeric ? 'bg-surface text-ink shadow-sm border border-line-2/45' : 'text-ink-3 hover:text-ink'"
                  @click="editUseNumeric = true; if (editAchievedNumber !== 0 && (!editTargetNumber || editTargetNumber === 0)) editTargetNumber = 100">
                  Target-based
                </button>
              </div>

              <!-- If Target-based (editUseNumeric is true) -->
              <div v-if="editUseNumeric" class="grid grid-cols-3 gap-3 mt-2">
                <VInput type="number" v-slot="{ inputProps }" v-model.number="editTargetNumber" label="Target"
                  id="goal-target" />
                <VInput type="number" v-slot="{ inputProps }" v-model.number="editAchievedNumber" label="Achieved"
                  id="goal-achieved" />
                <VInput v-model="editGoalUnit" label="Unit" id="goal-unit" />
              </div>

              <!-- If Direct % (editUseNumeric is false) -->
              <div v-else class="mt-2 space-y-2">
                <div class="flex justify-between text-xs font-mono text-ink-2">
                  <span>Progress</span>
                  <span class="font-bold text-ink">{{ editAchievedNumber }}%</span>
                </div>
                <input type="range" v-model.number="editAchievedNumber" min="0" max="100"
                  class="w-full accent-ink bg-elevated rounded-lg appearance-none h-1.5 cursor-pointer" />
              </div>
            </div>

            <div class="flex items-center justify-between border-t border-line/40 pt-4">
              <div class="flex flex-col">
                <span class="overline text-[9px] text-ink-3">Current Progress</span>
                <div class="flex items-baseline gap-2 mt-0.5">
                  <span class="font-serif text-xl font-bold text-pri-strategic">
                    {{ formatGoalProgress({
                      achievedNumber: editAchievedNumber, targetNumber: editTargetNumber, unit:
                        editGoalUnit, useNumeric: editUseNumeric
                    }) }}
                  </span>
                  <span v-if="editUseNumeric" class="text-[10px] text-ink-3 font-mono">({{ tempCalculatedProgress
                  }}%)</span>
                </div>
              </div>
              <button class="btn-primary !text-xs !py-2 !px-4" @click="saveGoalEdits">
                Save changes <span
                  class="kbd !bg-canvas/20 !border-canvas/10 !text-canvas select-none text-[9px] ml-1">⌘Enter</span>
              </button>
            </div>
          </div>

          <!-- Right Column: Associations -->
          <div class="space-y-6 md:border-l md:border-line/40 md:pl-8">
            <!-- Linked Projects -->
            <div>
              <div class="flex items-center gap-1.5 mb-2">
                <Folder class="w-3.5 h-3.5 text-ink-3" />
                <span class="overline text-[10px] text-ink-3">Linked Projects</span>
              </div>
              <div v-if="getGoalProjectsList(selectedGoal.id).length"
                class="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                <div v-for="proj in getGoalProjectsList(selectedGoal.id)" :key="proj.id"
                  class="p-2.5 bg-canvas/40 rounded-xl border border-line/50 flex flex-col gap-1.5">
                  <div class="flex items-center justify-between gap-2">
                    <RouterLink :to="'/projects/' + proj.id" @click="selectedGoal = null"
                      class="font-serif text-sm font-semibold text-ink hover:text-ink-2 hover:underline min-w-0 truncate">
                      {{ proj.title }}
                    </RouterLink>
                    <span
                      class="text-[9px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded border border-line bg-surface text-ink-3">
                      {{ proj.status }}
                    </span>
                  </div>
                  <div class="flex items-center gap-2">
                    <div class="flex-1 h-1 rounded-full bg-elevated overflow-hidden">
                      <div class="h-full bg-ink rounded-full" :style="{ width: getProjectProgress(proj) + '%' }"></div>
                    </div>
                    <span class="text-[10px] font-mono text-ink-2">{{ getProjectProgress(proj) }}%</span>
                  </div>
                </div>
              </div>
              <p v-else class="text-xs text-ink-3 italic">No linked projects.</p>
            </div>

            <!-- Linked Tasks -->
            <div class="space-y-3">
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-1.5">
                  <CheckSquare class="w-3.5 h-3.5 text-ink-3" />
                  <span class="overline text-[10px] text-ink-3">Linked Tasks</span>
                </div>
                <span class="text-[10px] text-ink-3 font-mono">({{ goalTasksList.length }})</span>
              </div>

              <!-- Tasks List -->
              <div v-if="goalTasksList.length" class="space-y-1.5 max-h-[280px] overflow-y-auto pr-1">
                <div v-for="t in goalTasksList" :key="t.id"
                  class="flex items-center justify-between gap-3 p-2 bg-canvas/30 border border-line/40 rounded-xl hover:bg-canvas/50 transition-colors">
                  <div class="flex items-center gap-2 min-w-0">
                    <VCheckbox :modelValue="t.status === 'done'" @update:modelValue="tasks.toggleComplete(t.id)"
                      class="shrink-0" />
                    <span @click="ui.openTaskEdit(t)" class="text-xs truncate cursor-pointer hover:underline"
                      :class="t.status === 'done' ? 'line-through text-ink-3' : 'text-ink-2 hover:text-ink'">
                      {{ t.title }}
                    </span>
                  </div>
                  <span v-if="t.projectId"
                    class="text-[8px] uppercase tracking-wider font-semibold text-ink-3 px-1.5 py-0.5 bg-elevated rounded border border-line shrink-0 max-w-[80px] truncate"
                    :title="projects.items.find(p => p.id === t.projectId)?.title">
                    {{projects.items.find(p => p.id === t.projectId)?.title}}
                  </span>
                </div>
              </div>
              <p v-else class="text-xs text-ink-3 italic">No linked tasks.</p>

              <!-- Quick Add Task -->
              <form @submit.prevent="addTaskToGoal" class="flex gap-2 pt-1">
                <input v-model="newTaskTitle" class="input-soft !text-xs py-1.5 flex-1" required />
                <button type="submit" class="btn-primary !text-[11px] !py-1 !px-2.5 shrink-0">Add</button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Create Wish Modal -->
    <div v-if="showNewWish" @keydown.window.esc="showNewWish = false"
      class="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div class="fixed inset-0 bg-ink/40 backdrop-blur-sm animate-fade-in" @click="showNewWish = false"></div>
      <form @submit.prevent="createWish" @keydown.meta.enter.prevent="createWish" @keydown.ctrl.prevent="createWish"
        class="relative w-full max-w-lg card p-8 animate-rise-in animate-rise-in overflow-hidden">
        <!-- Banner Image if available -->
        <div v-if="newWishImageUrl"
          class="w-full h-48 overflow-hidden rounded-xl border border-line mb-6 relative bg-canvas flex items-center justify-center cursor-ns-resize group select-none"
          @mousedown="startDrag($event, 'new-wish')" @touchstart="startDrag($event, 'new-wish')">
          <img :src="cleanImageUrl(newWishImageUrl)"
            class="w-full h-full object-cover relative pointer-events-none select-none"
            :style="{ objectPosition: `center ${newWishPositionY || 50}%` }" />
          <div
            class="absolute bottom-0 inset-x-0 bg-ink/70 py-1.5 text-center text-[10px] text-surface font-semibold opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none">
            Drag image up/down to reposition
          </div>
        </div>

        <button type="button" class="absolute top-4 right-4 btn-ghost !p-1.5" @click="showNewWish = false">
          <X class="w-4 h-4" />
        </button>
        <div class="overline">New wish</div>
        <h2 class="font-serif text-2xl mt-1 mb-5">Add to your list</h2>

        <VRow dense class="mb-4">
          <VCol cols="12" dense>
            <VInput v-model="newWishTitle" label="Item Name" id="new-wish-title" required class="font-semibold" />
          </VCol>
          <VCol cols="12" dense>
            <VTextarea v-model="newWishDesc" label="Description / notes (optional)" id="new-wish-desc" :rows="2" />
          </VCol>
          <VCol cols="12" dense>
            <VUrlInput v-model="newWishUrl" label="Product Link / URL (optional)" id="new-wish-url" />
          </VCol>
          <VCol cols="12" dense>
            <VUrlInput v-model="newWishImageUrl" label="Image URL (optional)" id="new-wish-image" />
          </VCol>
          <VCol cols="12" dense>
            <VInput v-model.number="newWishPrice" label="Price (optional)" id="new-wish-price" type="number" step="any"
              min="0" />
          </VCol>
          <VCol cols="12" dense>
            <VSelect v-model="newWishGoalId" label="Link to Goal (optional)" id="new-wish-goal-id"
              :options="goals.items" option-value="id" option-label="title" />
          </VCol>

          <!-- Conditionally render savings details if NOT linked to a goal -->
          <template v-if="!newWishGoalId">
            <VCol cols="4" dense>
              <VInput v-model="newWishUnit" label="Unit / Symbol" id="new-wish-unit" />
            </VCol>
            <VCol cols="4" dense>
              <VInput v-model.number="newWishGoal" label="Goal Value" id="new-wish-goal" type="number" step="any"
                min="0" required />
            </VCol>
            <VCol cols="4" dense>
              <VInput v-model.number="newWishCurrent" label="Current Value" id="new-wish-current" type="number"
                step="any" min="0" required />
            </VCol>
          </template>
          <template v-else>
            <VCol cols="12" dense class="text-[11px] text-ink-3 italic bg-canvas/35 p-3 rounded-lg border border-line">
              Savings progress and units are dynamically linked to the selected goal.
            </VCol>
          </template>

          <VCol cols="12" dense class="pt-2">
            <div class="flex items-center gap-2 py-1">
              <VCheckbox v-model="newWishPurchased" id="new-wish-purchased" />
              <label for="new-wish-purchased" class="text-xs font-semibold text-ink-2 select-none cursor-pointer">Mark
                as
                Purchased</label>
            </div>
          </VCol>
        </VRow>

        <div class="flex items-center justify-end gap-3 pt-3 border-t border-line/35">
          <button type="button" class="btn-ghost !text-xs !py-2 !px-4" @click="showNewWish = false">Cancel</button>
          <button type="submit" class="btn-primary !text-xs !py-2 !px-4">Add wish</button>
        </div>
      </form>
    </div>

    <!-- Edit Wish Modal -->
    <div v-if="selectedWish" @keydown.window.esc="selectedWish = null"
      class="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div class="fixed inset-0 bg-ink/40 backdrop-blur-sm animate-fade-in" @click="selectedWish = null"></div>
      <form @submit.prevent="saveWish" @keydown.meta.enter.prevent="saveWish" @keydown.ctrl.prevent="saveWish"
        class="relative w-full max-w-lg card p-8 animate-rise-in overflow-hidden">
        <!-- Banner Image if available -->
        <div v-if="editWishImageUrl"
          class="w-full h-48 overflow-hidden rounded-xl border border-line mb-6 relative bg-canvas flex items-center justify-center cursor-ns-resize group select-none"
          @mousedown="startDrag($event, 'edit-wish')" @touchstart="startDrag($event, 'edit-wish')">
          <img :src="cleanImageUrl(editWishImageUrl)"
            class="w-full h-full object-cover relative pointer-events-none select-none"
            :style="{ objectPosition: `center ${editWishPositionY || 50}%` }" />
          <div
            class="absolute bottom-0 inset-x-0 bg-ink/70 py-1.5 text-center text-[10px] text-surface font-semibold opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none">
            Drag image up/down to reposition
          </div>
        </div>

        <button type="button" class="absolute top-4 right-4 btn-ghost !p-1.5" @click="selectedWish = null">
          <X class="w-4 h-4" />
        </button>
        <div class="overline">Edit wish</div>
        <h2 class="font-serif text-2xl mt-1 mb-5">Update wishlist item</h2>

        <VRow dense class="mb-4">
          <VCol cols="12" dense>
            <VInput v-model="editWishTitle" label="Item Name" id="edit-wish-title" required class="font-semibold" />
          </VCol>
          <VCol cols="12" dense>
            <VTextarea v-model="editWishDesc" label="Description / notes (optional)" id="edit-wish-desc" :rows="2" />
          </VCol>
          <VCol cols="12" dense>
            <VUrlInput v-model="editWishUrl" label="Product Link / URL (optional)" id="edit-wish-url" />
          </VCol>
          <VCol cols="12" dense>
            <VUrlInput v-model="editWishImageUrl" label="Image URL (optional)" id="edit-wish-image" />
          </VCol>
          <VCol cols="12" dense>
            <VInput v-model.number="editWishPrice" label="Price (optional)" id="edit-wish-price" type="number"
              step="any" min="0" />
          </VCol>
          <VCol cols="12" dense>
            <VSelect v-model="editWishGoalId" label="Link to Goal (optional)" id="edit-wish-goal-id"
              :options="goals.items" option-value="id" option-label="title" />
          </VCol>

          <!-- Conditionally render savings details if NOT linked to a goal -->
          <template v-if="!editWishGoalId">
            <VCol cols="4" dense>
              <VInput v-model="editWishUnit" label="Unit / Symbol" id="edit-wish-unit" />
            </VCol>
            <VCol cols="4" dense>
              <VInput v-model.number="editWishGoal" label="Goal Value" id="edit-wish-goal" type="number" step="any"
                min="0" required />
            </VCol>
            <VCol cols="4" dense>
              <VInput v-model.number="editWishCurrent" label="Current Value" id="edit-wish-current" type="number"
                step="any" min="0" required />
            </VCol>
          </template>
          <template v-else>
            <VCol cols="12" dense class="text-[11px] text-ink-3 italic bg-canvas/35 p-3 rounded-lg border border-line">
              Savings progress and units are dynamically linked to the selected goal.
            </VCol>
          </template>

          <VCol cols="12" dense class="pt-2">
            <div class="flex items-center gap-2 py-1">
              <VCheckbox v-model="editWishPurchased" id="edit-wish-purchased" />
              <label for="edit-wish-purchased" class="text-xs font-semibold text-ink-2 select-none cursor-pointer">Mark
                as
                Purchased</label>
            </div>
          </VCol>
        </VRow>

        <div class="flex items-center justify-end gap-3 pt-3 border-t border-line/35">
          <button type="button" class="btn-ghost !text-xs !py-2 !px-4" @click="selectedWish = null">Cancel</button>
          <button type="submit" class="btn-primary !text-xs !py-2 !px-4">Save changes</button>
        </div>
      </form>
    </div>
  </div>
</template>
