<script setup>
import { computed, ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useNotesStore } from '@/stores/notes'
import { findWikiTargets, resolveTitle } from '@/lib/wikilinks'
import PageHeader from '@/components/PageHeader.vue'
import EmptyState from '@/components/EmptyState.vue'

const router = useRouter()
const notes = useNotesStore()
const svgEl = ref(null)
const hoverId = ref(null)

// Build nodes & edges from wiki links
const graph = computed(() => {
  const nodes = notes.items.map(n => ({ id: n.id, title: n.title, body: n.body || '' }))
  const edges = []
  for (const n of notes.items) {
    const targets = findWikiTargets(n.body)
    for (const t of targets) {
      const dest = resolveTitle(t, notes.items)
      if (dest && dest.id !== n.id) edges.push({ source: n.id, target: dest.id })
    }
  }
  return { nodes, edges }
})

// Lightweight force-directed simulation in pure JS (no library)
const W = 1000, H = 620
const positions = ref({}) // id -> {x,y,vx,vy}
const running = ref(false)
let raf = null

function initPositions() {
  const pos = {}
  const n = graph.value.nodes.length
  graph.value.nodes.forEach((node, i) => {
    const angle = (i / Math.max(n, 1)) * Math.PI * 2
    const r = Math.min(W, H) / 3
    pos[node.id] = { x: W / 2 + Math.cos(angle) * r, y: H / 2 + Math.sin(angle) * r, vx: 0, vy: 0 }
  })
  positions.value = pos
}

function step() {
  const pos = positions.value
  const nodes = graph.value.nodes
  const edges = graph.value.edges
  const dt = 0.6
  const repel = 9000
  const linkLen = 140
  const linkK = 0.04
  const friction = 0.86
  const center = { x: W / 2, y: H / 2 }
  // repulsion
  for (let i = 0; i < nodes.length; i++) {
    const a = pos[nodes[i].id]
    for (let j = i + 1; j < nodes.length; j++) {
      const b = pos[nodes[j].id]
      let dx = a.x - b.x, dy = a.y - b.y
      let d2 = dx * dx + dy * dy
      if (d2 < 1) d2 = 1
      const f = repel / d2
      const d = Math.sqrt(d2)
      const fx = (dx / d) * f, fy = (dy / d) * f
      a.vx += fx * dt; a.vy += fy * dt
      b.vx -= fx * dt; b.vy -= fy * dt
    }
    // pull to center
    a.vx += (center.x - a.x) * 0.002
    a.vy += (center.y - a.y) * 0.002
  }
  // edges - spring
  for (const e of edges) {
    const a = pos[e.source], b = pos[e.target]
    if (!a || !b) continue
    const dx = b.x - a.x, dy = b.y - a.y
    const d = Math.sqrt(dx * dx + dy * dy) || 1
    const diff = d - linkLen
    const f = diff * linkK
    const fx = (dx / d) * f, fy = (dy / d) * f
    a.vx += fx; a.vy += fy
    b.vx -= fx; b.vy -= fy
  }
  // integrate
  let kinetic = 0
  for (const n of nodes) {
    const p = pos[n.id]
    p.vx *= friction; p.vy *= friction
    p.x += p.vx * dt; p.y += p.vy * dt
    // clamp
    p.x = Math.max(30, Math.min(W - 30, p.x))
    p.y = Math.max(30, Math.min(H - 30, p.y))
    kinetic += p.vx * p.vx + p.vy * p.vy
  }
  positions.value = { ...pos }
  if (kinetic < 0.5) running.value = false
  if (running.value) raf = requestAnimationFrame(step)
}

function relayout() {
  initPositions()
  running.value = true
  cancelAnimationFrame(raf)
  raf = requestAnimationFrame(step)
}

onMounted(() => { relayout() })

const edgesResolved = computed(() => graph.value.edges.map(e => {
  const a = positions.value[e.source], b = positions.value[e.target]
  if (!a || !b) return null
  return { x1: a.x, y1: a.y, x2: b.x, y2: b.y, source: e.source, target: e.target }
}).filter(Boolean))

const nodesResolved = computed(() => graph.value.nodes.map(n => ({
  ...n,
  ...positions.value[n.id],
  degree: graph.value.edges.filter(e => e.source === n.id || e.target === n.id).length,
})))

const isolatedNodes = computed(() => nodesResolved.value.filter(n => n.degree === 0))

function nodeRadius(n) { return 8 + Math.min(14, n.degree * 2) }
function openNote(n) { router.push(`/notes/${n.id}`) }
function isEdgeHighlighted(e) { return hoverId.value && (e.source === hoverId.value || e.target === hoverId.value) }
function isNodeHighlighted(id) {
  if (!hoverId.value) return false
  if (hoverId.value === id) return true
  return graph.value.edges.some(e => (e.source === hoverId.value && e.target === id) || (e.target === hoverId.value && e.source === id))
}
</script>

<template>
  <div class="px-8 md:px-12 py-10 max-w-6xl mx-auto" data-testid="note-graph-view">
    <PageHeader overline="Memory" title="Note graph" sub="How your notes connect.">
      <template #right>
        <button class="btn-secondary" @click="relayout" data-testid="graph-relayout">Re-layout</button>
        <span class="text-sm text-ink-3 ml-3">{{ graph.nodes.length }} notes · {{ graph.edges.length }} links</span>
      </template>
    </PageHeader>

    <div v-if="graph.nodes.length" class="card p-2 overflow-hidden" data-testid="graph-canvas">
      <svg ref="svgEl" :viewBox="`0 0 ${W} ${H}`" class="w-full h-[620px]">
        <!-- edges -->
        <g>
          <line v-for="(e, i) in edgesResolved" :key="i"
                :x1="e.x1" :y1="e.y1" :x2="e.x2" :y2="e.y2"
                :stroke="isEdgeHighlighted(e) ? 'rgb(var(--ink))' : 'rgb(var(--line-2))'"
                :stroke-opacity="isEdgeHighlighted(e) ? 0.9 : 0.4"
                :stroke-width="isEdgeHighlighted(e) ? 1.8 : 1" />
        </g>
        <!-- nodes -->
        <g>
          <g v-for="n in nodesResolved" :key="n.id"
             @mouseenter="hoverId = n.id" @mouseleave="hoverId = null"
             @click="openNote(n)"
             style="cursor:pointer"
             :data-testid="`graph-node-${n.id}`">
            <circle :cx="n.x" :cy="n.y" :r="nodeRadius(n) + 4" fill="rgb(var(--canvas))" />
            <circle :cx="n.x" :cy="n.y" :r="nodeRadius(n)"
                    :fill="isNodeHighlighted(n.id) ? 'rgb(var(--ink))' : 'rgb(var(--ink-3))'"
                    :stroke="isNodeHighlighted(n.id) ? 'rgb(var(--ink))' : 'rgb(var(--line-2))'"
                    stroke-width="1.5"
                    class="transition-colors duration-200" />
            <text :x="n.x" :y="n.y - nodeRadius(n) - 6"
                  text-anchor="middle"
                  font-family="Newsreader, serif"
                  :font-size="hoverId === n.id ? 16 : 12"
                  :fill="isNodeHighlighted(n.id) ? 'rgb(var(--ink))' : 'rgb(var(--ink-2))'"
                  class="transition-all duration-200 pointer-events-none">{{ n.title }}</text>
          </g>
        </g>
      </svg>
    </div>
    <EmptyState v-else title="The graph is still" hint="Create a few notes with `[[wiki-links]]` between them." />

    <div v-if="isolatedNodes.length" class="mt-8" data-testid="isolated-notes">
      <h3 class="overline mb-3">Standalone — {{ isolatedNodes.length }} unlinked</h3>
      <div class="flex flex-wrap gap-2">
        <button v-for="n in isolatedNodes" :key="n.id"
                @click="openNote(n)"
                class="px-3 py-1.5 rounded-full bg-elevated border border-line text-sm hover:border-line-2 transition-colors duration-300">
          {{ n.title }}
        </button>
      </div>
    </div>
  </div>
</template>
