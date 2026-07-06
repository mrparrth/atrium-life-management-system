<script setup>
import { ref, shallowRef, watch, onMounted, onUnmounted, nextTick, computed } from 'vue'
import { Editor, EditorContent } from '@tiptap/vue-3'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import TurndownService from 'turndown'
import { marked } from 'marked'
import { Heading1, Heading2, Heading3, List, ListOrdered, CheckSquare, Quote, Code, Minus, Link2, HelpCircle } from 'lucide-vue-next'
import { useNotesStore } from '@/stores/notes'

const props = defineProps({
  modelValue: {
    type: String,
    default: ''
  },
  placeholder: {
    type: String,
    default: 'Write freely. Type / for commands, [[ to link notes...'
  },
  heightClass: {
    type: String,
    default: 'h-[calc(100vh-260px)] min-h-[500px]'
  }
})

const emit = defineEmits(['update:modelValue'])

const notesStore = useNotesStore()
const editor = shallowRef(null)
let isInternalUpdate = false

// Dropdown State
const showSlashMenu = ref(false)
const slashQuery = ref('')
const slashIdx = ref(0)
const slashRange = ref({ from: 0, to: 0 })

const showWikiMenu = ref(false)
const wikiQuery = ref('')
const wikiIdx = ref(0)
const wikiRange = ref({ from: 0, to: 0 })

const dropdownPos = ref({ top: 0, left: 0 })
const showHelpModal = ref(false)

// HTML -> Markdown conversion
const turndown = new TurndownService({
  headingStyle: 'atx',
  codeBlockStyle: 'fenced'
})

// Custom turndown rules for task lists
turndown.addRule('taskList', {
  filter: (node) => node.nodeName === 'LI' && node.getAttribute('data-type') === 'taskItem',
  replacement: (content, node) => {
    const checkbox = node.querySelector('input[type="checkbox"]')
    const checked = checkbox && checkbox.checked ? 'x' : ' '
    return `- [${checked}] ${content.trim()}\n`
  }
})

// Slash Commands definition
const COMMANDS = [
  { label: 'Heading 1', icon: Heading1, action: (editor, range) => editor.chain().focus().deleteRange(range).toggleHeading({ level: 1 }).run() },
  { label: 'Heading 2', icon: Heading2, action: (editor, range) => editor.chain().focus().deleteRange(range).toggleHeading({ level: 2 }).run() },
  { label: 'Heading 3', icon: Heading3, action: (editor, range) => editor.chain().focus().deleteRange(range).toggleHeading({ level: 3 }).run() },
  { label: 'Bullet List', icon: List, action: (editor, range) => editor.chain().focus().deleteRange(range).toggleBulletList().run() },
  { label: 'Numbered List', icon: ListOrdered, action: (editor, range) => editor.chain().focus().deleteRange(range).toggleOrderedList().run() },
  { label: 'Todo List', icon: CheckSquare, action: (editor, range) => editor.chain().focus().deleteRange(range).toggleTaskList().run() },
  { label: 'Blockquote', icon: Quote, action: (editor, range) => editor.chain().focus().deleteRange(range).toggleBlockquote().run() },
  { label: 'Code Block', icon: Code, action: (editor, range) => editor.chain().focus().deleteRange(range).toggleCodeBlock().run() },
  { label: 'Divider', icon: Minus, action: (editor, range) => editor.chain().focus().deleteRange(range).setHorizontalRule().run() }
]

const filteredCommands = computed(() => {
  const q = slashQuery.value.toLowerCase().trim()
  if (!q) return COMMANDS
  return COMMANDS.filter(cmd => cmd.label.toLowerCase().includes(q))
})

const wikiSuggestions = computed(() => {
  const q = wikiQuery.value.toLowerCase().trim()
  return notesStore.items
    .filter(n => !q || (n.title || '').toLowerCase().includes(q))
    .slice(0, 8)
})

const checkMenus = () => {
  if (!editor.value) return
  const { state } = editor.value
  const { selection } = state
  const { $from } = selection
  const textBefore = $from.parent.textBetween(0, $from.parentOffset)

  // 1. Check for wiki-links: [[query
  const lastDoubleOpen = textBefore.lastIndexOf('[[')
  if (lastDoubleOpen !== -1) {
    const query = textBefore.slice(lastDoubleOpen + 2)
    if (!query.includes(']') && !query.includes('\n')) {
      showWikiMenu.value = true
      wikiQuery.value = query
      wikiIdx.value = 0
      wikiRange.value = {
        from: $from.pos - query.length - 2,
        to: $from.pos
      }
      positionDropdown()
      showSlashMenu.value = false
      return
    }
  }
  showWikiMenu.value = false

  // 2. Check for slash command: /query
  const lastSlash = textBefore.lastIndexOf('/')
  if (lastSlash !== -1) {
    const query = textBefore.slice(lastSlash + 1)
    const charBefore = lastSlash > 0 ? textBefore[lastSlash - 1] : ' '
    if ((/\s/.test(charBefore) || charBefore === '') && !query.includes(' ') && !query.includes('\n')) {
      showSlashMenu.value = true
      slashQuery.value = query
      slashIdx.value = 0
      slashRange.value = {
        from: $from.pos - query.length - 1,
        to: $from.pos
      }
      positionDropdown()
      return
    }
  }
  showSlashMenu.value = false
}

const positionDropdown = () => {
  nextTick(() => {
    if (!editor.value) return
    const { view } = editor.value
    const { selection } = view.state
    try {
      const coords = view.coordsAtPos(selection.from)
      const editorEl = view.dom
      const editorRect = editorEl.getBoundingClientRect()
      dropdownPos.value = {
        top: coords.bottom - editorRect.top + editorEl.scrollTop + 12,
        left: coords.left - editorRect.left + editorEl.scrollLeft
      }
    } catch (e) {
      dropdownPos.value = { top: 0, left: 0 }
    }
  })
}

// Confirm Actions
const runCommand = (cmd) => {
  cmd.action(editor.value, slashRange.value)
  showSlashMenu.value = false
}

const runWikiLink = (note) => {
  editor.value.chain().focus().deleteRange(wikiRange.value).insertContent(`[[${note.title}]]`).run()
  showWikiMenu.value = false
}

const handleSlashKeydown = (event) => {
  const list = filteredCommands.value
  if (!list.length) return
  if (event.key === 'ArrowDown') {
    slashIdx.value = (slashIdx.value + 1) % list.length
  } else if (event.key === 'ArrowUp') {
    slashIdx.value = (slashIdx.value - 1 + list.length) % list.length
  } else if (event.key === 'Enter') {
    runCommand(list[slashIdx.value])
  } else if (event.key === 'Escape') {
    showSlashMenu.value = false
  }
}

const handleWikiKeydown = (event) => {
  const list = wikiSuggestions.value
  if (!list.length) return
  if (event.key === 'ArrowDown') {
    wikiIdx.value = (wikiIdx.value + 1) % list.length
  } else if (event.key === 'ArrowUp') {
    wikiIdx.value = (wikiIdx.value - 1 + list.length) % list.length
  } else if (event.key === 'Enter') {
    runWikiLink(list[wikiIdx.value])
  } else if (event.key === 'Escape') {
    showWikiMenu.value = false
  }
}

onMounted(() => {
  editor.value = new Editor({
    extensions: [
      StarterKit,
      Placeholder.configure({
        placeholder: props.placeholder,
        emptyNodeClass: 'my-placeholder'
      }),
      TaskList,
      TaskItem.configure({
        nested: true,
        HTMLAttributes: {
          class: 'flex items-start gap-2.5 my-1.5'
        }
      })
    ],
    editorProps: {
      attributes: {
        class: 'focus:outline-none min-h-[400px] h-full outline-none max-w-none text-ink prose-soft'
      },
      handleKeyDown(view, event) {
        if (showSlashMenu.value) {
          if (['ArrowDown', 'ArrowUp', 'Enter', 'Escape'].includes(event.key)) {
            event.preventDefault()
            event.stopPropagation()
            handleSlashKeydown(event)
            return true
          }
        }
        if (showWikiMenu.value) {
          if (['ArrowDown', 'ArrowUp', 'Enter', 'Escape'].includes(event.key)) {
            event.preventDefault()
            event.stopPropagation()
            handleWikiKeydown(event)
            return true
          }
        }
        return false
      }
    },
    content: marked.parse(props.modelValue || ''),
    onUpdate({ editor }) {
      checkMenus()
      const html = editor.getHTML()
      const markdown = turndown.turndown(html)
      isInternalUpdate = true
      emit('update:modelValue', markdown)
      nextTick(() => {
        isInternalUpdate = false
      })
    },
    onSelectionUpdate() {
      checkMenus()
    }
  })

  window.addEventListener('click', handleOutsideClick)
})

const handleOutsideClick = (e) => {
  const isInside = e.target.closest('[data-testid="slash-commands-menu"]') ||
    e.target.closest('[data-testid="wiki-links-menu"]') ||
    e.target.closest('.editor-content')
  if (!isInside) {
    showSlashMenu.value = false
    showWikiMenu.value = false
  }
}

watch(() => props.modelValue, (newVal) => {
  if (!editor.value) return
  if (isInternalUpdate) {
    isInternalUpdate = false
    return
  }
  // If the user is currently typing, the editor is the source of truth. Bypassing prevents cursor jumping.
  if (editor.value.isFocused) return
  const currentHTML = editor.value.getHTML()
  const expectedHTML = marked.parse(newVal || '')
  if (currentHTML !== expectedHTML) {
    editor.value.commands.setContent(expectedHTML, false)
  }
})

onUnmounted(() => {
  window.removeEventListener('click', handleOutsideClick)
  if (editor.value) {
    editor.value.destroy()
  }
})
</script>

<template>
  <div @click="editor?.commands.focus()"
    :class="['relative w-full border border-line bg-surface/30 rounded-2xl p-6 flex flex-col transition-all focus-within:border-pri-strategic focus-within:bg-surface/50', heightClass]">

    <!-- Help Button -->
    <button @click.stop="showHelpModal = true" type="button"
      class="absolute top-3.5 right-3.5 w-6 h-6 rounded-full flex items-center justify-center border border-line bg-surface text-ink-3 hover:text-ink hover:bg-canvas hover:border-line-2 shadow-sm transition-all cursor-pointer z-10"
      title="Formatting Help">
      <HelpCircle class="w-3.5 h-3.5" />
    </button>

    <EditorContent :editor="editor" class="editor-content flex-1 overflow-y-auto" />

    <!-- Slash command popup -->
    <div v-if="showSlashMenu && filteredCommands.length"
      class="absolute z-50 card overflow-hidden shadow-2xl border border-line bg-surface/95 backdrop-blur-md w-72 animate-rise-in"
      :style="{ top: dropdownPos.top + 'px', left: dropdownPos.left + 'px' }" data-testid="slash-commands-menu">
      <div class="overline px-3.5 py-2 border-b border-line text-ink-3">Blocks & Formatting</div>
      <ul class="max-h-[450px] overflow-y-auto p-1.5 space-y-0.5">
        <li v-for="(cmd, i) in filteredCommands" :key="cmd.label">
          <button @click.prevent="runCommand(cmd)"
            class="w-full text-left px-3 py-2 rounded-xl text-sm flex items-center gap-3 transition-all cursor-pointer"
            :class="i === slashIdx ? 'bg-ink text-canvas font-medium' : 'text-ink-2 hover:bg-elevated hover:text-ink'"
            @mouseenter="slashIdx = i">
            <component :is="cmd.icon" class="w-4 h-4 shrink-0" :class="i === slashIdx ? 'text-canvas' : 'text-ink-3'" />
            <div class="leading-tight">
              <div>{{ cmd.label }}</div>
              <div class="text-[10px] opacity-75 font-normal mt-0.5">{{ cmd.desc }}</div>
            </div>
          </button>
        </li>
      </ul>
      <div class="px-3.5 py-1.5 border-t border-line text-[10px] text-ink-3 flex items-center gap-3">
        <span><span class="kbd">↑</span><span class="kbd">↓</span> Navigate</span>
        <span><span class="kbd">↵</span> Select</span>
      </div>
    </div>

    <!-- Wiki link popup -->
    <div v-if="showWikiMenu && wikiSuggestions.length"
      class="absolute z-50 card overflow-hidden shadow-2xl border border-line bg-surface/95 backdrop-blur-md w-72 animate-rise-in"
      :style="{ top: dropdownPos.top + 'px', left: dropdownPos.left + 'px' }" data-testid="wiki-links-menu">
      <div class="overline px-3.5 py-2 border-b border-line text-ink-3">Link Note</div>
      <ul class="max-h-60 overflow-y-auto p-1.5 space-y-0.5">
        <li v-for="(note, i) in wikiSuggestions" :key="note.id">
          <button @click.prevent="runWikiLink(note)"
            class="w-full text-left px-3 py-2 rounded-xl text-sm flex items-center gap-3 transition-all cursor-pointer"
            :class="i === wikiIdx ? 'bg-ink text-canvas font-medium' : 'text-ink-2 hover:bg-elevated hover:text-ink'"
            @mouseenter="wikiIdx = i">
            <Link2 class="w-4 h-4 shrink-0" :class="i === wikiIdx ? 'text-canvas' : 'text-ink-3'" />
            <span class="truncate">{{ note.title }}</span>
          </button>
        </li>
      </ul>
      <div class="px-3.5 py-1.5 border-t border-line text-[10px] text-ink-3 flex items-center gap-3">
        <span><span class="kbd">↑</span><span class="kbd">↓</span> Navigate</span>
        <span><span class="kbd">↵</span> Select</span>
      </div>
    </div>

    <!-- Help Modal Overlay -->
    <div v-if="showHelpModal" class="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div class="fixed inset-0 bg-ink/40 backdrop-blur-sm" @click="showHelpModal = false"></div>
      <div
        class="bg-surface border border-line rounded-2xl p-6 max-w-md w-full shadow-2xl relative z-10 animate-rise-in font-sans">
        <div class="flex items-center justify-between border-b border-line pb-3 mb-4">
          <h3 class="text-sm uppercase tracking-wider font-bold text-ink flex items-center gap-2">
            <HelpCircle class="w-4 h-4 text-pri-strategic" />
            Editor Formatting Guide
          </h3>
          <button @click="showHelpModal = false" type="button" class="text-ink-3 hover:text-ink transition-colors">
            <X class="w-4 h-4" />
          </button>
        </div>

        <div class="space-y-4 text-xs leading-relaxed text-ink-2 overflow-y-auto max-h-[70vh] pr-1">
          <!-- Commands -->
          <div>
            <h4 class="font-bold text-ink uppercase tracking-wide text-[10px] mb-1 text-ink-3">Slash Commands</h4>
            <p>Type <kbd class="kbd">/</kbd> on a new line to select block elements: Headings, Bullet Lists, Numbered
              Lists, Checklists, Quote Blocks, Code Blocks, or Dividers.</p>
          </div>

          <!-- Wiki Links -->
          <div>
            <h4 class="font-bold text-ink uppercase tracking-wide text-[10px] mb-1 text-ink-3">Wiki Links</h4>
            <p>Type <kbd class="kbd">[[</kbd> to search for other notes. Select one to link them together in your
              directory.</p>
          </div>

          <!-- Shortcuts -->
          <div>
            <h4 class="font-bold text-ink uppercase tracking-wide text-[10px] mb-1.5 text-ink-3">Markdown Shortcuts
              (While typing)</h4>
            <div class="grid grid-cols-2 gap-x-4 gap-y-1.5 bg-canvas/50 border border-line/50 p-2.5 rounded-xl">
              <div><span class="font-mono text-ink"># + Space</span> Heading 1</div>
              <div><span class="font-mono text-ink">## + Space</span> Heading 2</div>
              <div><span class="font-mono text-ink">---</span> Divider</div>
              <div><span class="font-mono text-ink">- or *</span> Bullet List</div>
              <div><span class="font-mono text-ink">1.</span> Numbered List</div>
              <div><span class="font-mono text-ink">[ ]</span> Checklist</div>
              <div><span class="font-mono text-ink">></span> Quote</div>
              <div><span class="font-mono text-ink">`code`</span> Inline Code</div>
              <div><span class="font-mono text-ink">```</span> Code Block</div>
              <div><span class="font-mono text-ink">**bold**</span> Bold</div>
              <div><span class="font-mono text-ink">*italics*</span> Italics</div>
            </div>
          </div>

          <!-- Shortcuts -->
          <div>
            <h4 class="font-bold text-ink uppercase tracking-wide text-[10px] mb-1 text-ink-3">Keyboard Shortcuts</h4>
            <ul class="list-disc pl-4 space-y-1">
              <li><kbd class="kbd">⌘ B</kbd> / <kbd class="kbd">Ctrl B</kbd>: Bold</li>
              <li><kbd class="kbd">⌘ I</kbd> / <kbd class="kbd">Ctrl I</kbd>: Italic</li>
              <li><kbd class="kbd">⌘ U</kbd> / <kbd class="kbd">Ctrl U</kbd>: Underline</li>
            </ul>
          </div>
        </div>

        <div class="mt-6 pt-3 border-t border-line flex justify-end">
          <button @click="showHelpModal = false" class="btn-primary text-xs !py-1.5 !px-4">Got it</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style>
/* Tiptap Placeholder style */
.prose-soft p.is-empty::before {
  content: attr(data-placeholder);
  float: left;
  color: rgb(var(--ink-3));
  pointer-events: none;
  height: 0;
  font-style: italic;
}

/* Ensure editor stretches to full height of card container */
.editor-content {
  display: flex;
  flex-direction: column;
  flex: 1 1 0%;
  min-height: 0;
}

.ProseMirror {
  flex: 1 1 0%;
  min-height: 0;
}

/* Custom bullet & ordered lists style within editor context */
.prose-soft ul[data-type="taskList"] {
  list-style: none;
  padding-left: 0;
}

.prose-soft ul[data-type="taskList"] li[data-type="taskItem"] input[type="checkbox"] {
  margin-top: 0.3em;
  cursor: pointer;
  accent-color: rgb(var(--ink));
}

.prose-soft hr {
  border: none;
  border-top: 1px solid rgb(var(--line));
  margin: 1.5em 0;
}
</style>
