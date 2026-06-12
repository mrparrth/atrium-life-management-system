import { defineStore } from 'pinia'
import { ref } from 'vue'
import { db } from '@/db'

const SETTINGS_ID = 'app'

export const useSettingsStore = defineStore('settings', () => {
  const _cache = ref({})

  async function load() {
    const row = await db.settings.get(SETTINGS_ID)
    if (row) _cache.value = row
  }

  async function set(key, value) {
    _cache.value[key] = value
    await db.settings.update(SETTINGS_ID, { [key]: value })
  }

  function get(key, fallback = null) {
    return key in _cache.value ? _cache.value[key] : fallback
  }

  return { load, set, get }
})
