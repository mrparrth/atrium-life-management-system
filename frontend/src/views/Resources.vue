<script setup>
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import { useNotesStore } from '@/stores/notes'
import { useBookmarksStore } from '@/stores/bookmarks'
import PageHeader from '@/components/PageHeader.vue'
import SectionHeader from '@/components/SectionHeader.vue'
import EmptyState from '@/components/EmptyState.vue'
import { NotebookPen, Bookmark } from 'lucide-vue-next'

const notes = useNotesStore()
const bookmarks = useBookmarksStore()
const unlinkedNotes = computed(() => notes.items.filter(n => !n.projectId && !n.taskId))
</script>

<template>
  <div class="px-8 md:px-12 py-10 max-w-5xl mx-auto" data-testid="resources-view">
    <PageHeader overline="PARA · Resources" title="Resources" sub="Reference material for future selves." />

    <SectionHeader overline="Notes" :title="`${unlinkedNotes.length} unlinked`" hint="Notes living independently." />
    <div v-if="unlinkedNotes.length" class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-10">
      <RouterLink v-for="n in unlinkedNotes" :key="n.id" :to="`/notes/${n.id}`" class="card p-5 hover:border-line-2 transition-colors duration-300">
        <div class="flex items-center gap-2"><NotebookPen class="w-3.5 h-3.5 text-ink-3" /><span class="overline">Note</span></div>
        <div class="font-serif text-lg mt-1.5">{{ n.title }}</div>
        <p class="text-sm text-ink-2 mt-1.5 line-clamp-2">{{ n.body }}</p>
      </RouterLink>
    </div>
    <EmptyState v-else title="No standalone notes" hint="All notes are linked to something." />

    <SectionHeader overline="Bookmarks" :title="`${bookmarks.items.length} saved`" hint="Pages worth returning to." />
    <div v-if="bookmarks.items.length" class="grid grid-cols-1 md:grid-cols-2 gap-4">
      <a v-for="b in bookmarks.items" :key="b.id" :href="b.url" target="_blank" class="card p-5 hover:border-line-2 transition-colors duration-300 block">
        <div class="flex items-center gap-2"><Bookmark class="w-3.5 h-3.5 text-ink-3" /><span class="overline">{{ b.category }}</span></div>
        <div class="font-serif text-lg mt-1.5">{{ b.title }}</div>
        <p class="text-xs text-ink-3 mt-1 truncate">{{ b.url }}</p>
      </a>
    </div>
    <EmptyState v-else title="No bookmarks yet" />
  </div>
</template>
