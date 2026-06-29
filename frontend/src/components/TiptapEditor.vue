<script setup>
import { ref, shallowRef, watch, onMounted, onUnmounted, nextTick, computed } from 'vue'
import { Editor, EditorContent } from '@tiptap/vue-3'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import TurndownService from 'turndown'
import { marked } from 'marked'
import { Heading1, Heading2, Heading3, List, ListOrdered, CheckSquare, Quote, Code, Minus, Link2 } from 'lucide-vue-next'
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
        class: 'prose-soft focus:outline-none min-h-[400px] h-full outline-none max-w-none text-ink'
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
      emit('update:modelValue', markdown)
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
