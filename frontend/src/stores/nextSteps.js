import { defineStore } from 'pinia'
import { ref } from 'vue'
import { db, newId, now, plain } from '@/db'

export const useNextStepsStore = defineStore('nextSteps', () => {
  const sections = ref([])

  async function load() {
    let list = await db.next_steps_sections.toArray()
    list.sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    
    // Self-healing migration from v3 flat next_steps
    if (list.length === 0) {
      try {
        const legacyItems = await db.table('next_steps').toArray()
        if (legacyItems && legacyItems.length > 0) {
          // Sort legacy items by their order
          legacyItems.sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
          
          const inboxSection = {
            id: newId(),
            title: 'Inbox next steps',
            notes: '',
            items: legacyItems.map(it => ({
              id: it.id,
              title: it.title,
              done: it.done,
              createdAt: it.createdAt || now(),
              updatedAt: it.updatedAt || now()
            })),
            order: 1,
            createdAt: now(),
            updatedAt: now()
          }
          await db.next_steps_sections.add(inboxSection)
          list = [inboxSection]
          
          // Clear legacy store to avoid repeat migrations
          await db.table('next_steps').clear()
        }
      } catch (err) {
        console.warn('Migration failed or legacy table not found:', err)
      }
    }
    
    // Seed default sections if completely empty
    if (list.length === 0) {
      const defaultSec = {
        id: newId(),
        title: 'General',
        notes: 'A quiet place for miscellaneous notes and checklists.',
        items: [
          { id: newId(), title: 'Explore the life design dashboard', done: false, createdAt: now(), updatedAt: now() },
          { id: newId(), title: 'Set a yearly theme in Years', done: false, createdAt: now(), updatedAt: now() },
        ],
        order: 1,
        createdAt: now(),
        updatedAt: now()
      }
      await db.next_steps_sections.add(defaultSec)
      list = [defaultSec]
    }

    sections.value = list
  }

  async function addSection(title) {
    const trimmed = (title || '').trim()
    const maxOrder = sections.value.reduce((m, x) => Math.max(m, x.order || 0), 0)
    const sec = {
      id: newId(),
      title: trimmed || 'Untitled Section',
      notes: '',
      items: [],
      order: maxOrder + 1,
      createdAt: now(),
      updatedAt: now()
    }
    await db.next_steps_sections.add(sec)
    sections.value.push(sec)
    return sec
  }

  async function removeSection(id) {
    await db.next_steps_sections.delete(id)
    sections.value = sections.value.filter(x => x.id !== id)
  }

  async function renameSection(id, title) {
    const sec = sections.value.find(x => x.id === id)
    if (!sec) return
    sec.title = (title || '').trim() || 'Untitled Section'
    sec.updatedAt = now()
    await db.next_steps_sections.put(plain(sec))
  }

  async function updateNotes(id, notes) {
    const sec = sections.value.find(x => x.id === id)
    if (!sec) return
    sec.notes = notes || ''
    sec.updatedAt = now()
    await db.next_steps_sections.put(plain(sec))
  }

  // ───── Item Operations
  async function addItem(sectionId, itemTitle) {
    const sec = sections.value.find(x => x.id === sectionId)
    if (!sec) return null
    const trimmed = (itemTitle || '').trim()
    if (!trimmed) return null
    
    const item = {
      id: newId(),
      title: trimmed,
      done: false,
      createdAt: now(),
      updatedAt: now()
    }
    sec.items.push(item)
    sec.updatedAt = now()
    await db.next_steps_sections.put(plain(sec))
    return item
  }

  async function toggleItem(sectionId, itemId) {
    const sec = sections.value.find(x => x.id === sectionId)
    if (!sec) return
    const item = sec.items.find(x => x.id === itemId)
    if (!item) return
    item.done = !item.done
    item.updatedAt = now()
    sec.updatedAt = now()
    await db.next_steps_sections.put(plain(sec))
  }

  async function renameItem(sectionId, itemId, newTitle) {
    const sec = sections.value.find(x => x.id === sectionId)
    if (!sec) return
    const item = sec.items.find(x => x.id === itemId)
    if (!item) return
    item.title = (newTitle || '').trim() || item.title
    item.updatedAt = now()
    sec.updatedAt = now()
    await db.next_steps_sections.put(plain(sec))
  }

  async function removeItem(sectionId, itemId) {
    const sec = sections.value.find(x => x.id === sectionId)
    if (!sec) return
    sec.items = sec.items.filter(x => x.id !== itemId)
    sec.updatedAt = now()
    await db.next_steps_sections.put(plain(sec))
  }

  async function clearCompleted(sectionId) {
    const sec = sections.value.find(x => x.id === sectionId)
    if (!sec) return
    sec.items = sec.items.filter(x => !x.done)
    sec.updatedAt = now()
    await db.next_steps_sections.put(plain(sec))
  }

  async function reorderSections(orderedIds) {
    const ts = now()
    sections.value.sort((a, b) => orderedIds.indexOf(a.id) - orderedIds.indexOf(b.id))
    let i = 1
    for (const sec of sections.value) {
      sec.order = i++
      sec.updatedAt = ts
      await db.next_steps_sections.put(plain(sec))
    }
  }

  return {
    sections,
    load,
    addSection,
    removeSection,
    renameSection,
    updateNotes,
    addItem,
    toggleItem,
    renameItem,
    removeItem,
    clearCompleted,
    reorderSections
  }
})
