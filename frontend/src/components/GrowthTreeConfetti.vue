<script setup>
import { ref, watch, nextTick, onBeforeUnmount } from 'vue'

const props = defineProps({
  show: {
    type: Boolean,
    default: false
  },
  streakCount: {
    type: Number,
    default: 1
  },
  durationSec: {
    type: Number,
    default: 20
  }
})

const emit = defineEmits(['close'])
const confettiCanvas = ref(null)
let animId = null

function sampleTextTargets(text, width, height) {
  const offscreen = document.createElement('canvas')
  offscreen.width = width
  offscreen.height = height
  const offCtx = offscreen.getContext('2d')
  if (!offCtx) return []

  const fontSize = Math.min(width * 0.085, 95)
  offCtx.font = `italic 700 ${fontSize}px 'Playfair Display', 'Newsreader', serif`
  offCtx.textAlign = 'center'
  offCtx.textBaseline = 'middle'
  offCtx.fillStyle = '#ffffff'
  offCtx.fillText(text, width / 2, height / 2)

  const imgData = offCtx.getImageData(0, 0, width, height)
  const data = imgData.data
  const targets = []

  const step = Math.max(4, Math.floor(fontSize / 16))
  for (let y = 0; y < height; y += step) {
    for (let x = 0; x < width; x += step) {
      const alpha = data[(y * width + x) * 4 + 3]
      if (alpha > 128) {
        targets.push({ x, y })
      }
    }
  }
  return targets
}

function startCelebration() {
  if (animId) cancelAnimationFrame(animId)
  nextTick(() => {
    const canvas = confettiCanvas.value
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    canvas.width = window.innerWidth
    canvas.height = window.innerHeight

    const textStr = `${props.streakCount} Day Streak!`
    const targets = sampleTextTargets(textStr, canvas.width, canvas.height)

    const colors = [
      '#DC2626', '#EA580C', '#D97706', '#059669', '#0891B2',
      '#2563EB', '#4F46E5', '#7C3AED', '#DB2777', '#E11D48',
      '#52b788', '#f59e0b', '#74c69d'
    ]

    const fallDurationMs = props.durationSec * 1000
    const extraHoldMs = 3000 // Assembled text stays for 3 seconds after duration
    const totalDurationMs = fallDurationMs + extraHoldMs

    const assemblyMs = Math.min(3500, fallDurationMs * 0.35)
    const assemblyStartTime = fallDurationMs - assemblyMs
    const startTime = Date.now()

    let particles = []
    const totalParticles = Math.max(220, targets.length)

    function createParticle(targetIdx = null, forceSide = null) {
      const target = targets.length > 0 && targetIdx !== null ? targets[targetIdx % targets.length] : null
      const isLeft = forceSide !== null ? forceSide === 'left' : (targetIdx !== null ? targetIdx % 2 === 0 : Math.random() < 0.5)

      const originX = isLeft ? Math.random() * 50 : canvas.width - Math.random() * 50
      const originY = canvas.height + 10

      // High-velocity spray angled inward toward center screen
      const vx = isLeft ? (Math.random() * 14 + 10) : -(Math.random() * 14 + 10)
      const vy = -(Math.random() * 16 + 18)

      return {
        x: originX,
        y: originY,
        vx,
        vy,
        r: Math.random() * 3.5 + 2.5,
        color: colors[Math.floor(Math.random() * colors.length)],
        rotation: Math.random() * 360,
        rotationSpeed: (Math.random() - 0.5) * 14,
        targetX: target ? target.x : canvas.width / 2,
        targetY: target ? target.y : canvas.height / 2
      }
    }

    // Initial dual corner cannon burst
    for (let i = 0; i < totalParticles; i++) {
      particles.push(createParticle(i))
    }

    function animate() {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      const now = Date.now()
      const elapsed = now - startTime
      const isAssembling = elapsed >= assemblyStartTime

      // Continuous dual corner cannon spray during falling phase
      if (!isAssembling && elapsed < fallDurationMs) {
        if (Math.random() < 0.4) {
          particles.push(createParticle(particles.length, 'left'))
          particles.push(createParticle(particles.length, 'right'))
        }
      }

      particles.forEach((p) => {
        if (isAssembling && targets.length > 0) {
          // Smooth lightweight lerp to target text coordinates
          const ease = 0.05
          p.x += (p.targetX - p.x) * ease
          p.y += (p.targetY - p.y) * ease
          p.rotation += (0 - p.rotation) * ease
        } else {
          // Cannon physics (upward launch with gravity & air friction)
          p.x += p.vx
          p.y += p.vy
          p.vy += 0.45 // Gravity pulls launched particles back down
          p.vx *= 0.985 // Air friction
          p.rotation += p.rotationSpeed
        }

        ctx.save()
        ctx.translate(p.x, p.y)
        ctx.rotate((p.rotation * Math.PI) / 180)
        ctx.fillStyle = p.color

        // Fade out during final 800ms of extra hold duration
        if (elapsed > totalDurationMs - 800) {
          const fade = Math.max(0, (totalDurationMs - elapsed) / 800)
          ctx.globalAlpha = fade
        }

        ctx.fillRect(-p.r, -p.r, p.r * 2, p.r * 2)
        ctx.restore()
      })

      if (elapsed < totalDurationMs) {
        animId = requestAnimationFrame(animate)
      } else {
        emit('close')
      }
    }

    animate()
  })
}

watch(() => props.show, (newVal) => {
  if (newVal) {
    startCelebration()
  } else if (animId) {
    cancelAnimationFrame(animId)
  }
})

onBeforeUnmount(() => {
  if (animId) cancelAnimationFrame(animId)
})
</script>

<template>
  <Teleport to="body">
    <div v-if="show" class="fixed inset-0 pointer-events-none z-[9999]">
      <canvas ref="confettiCanvas" class="w-full h-full pointer-events-none"></canvas>
    </div>
  </Teleport>
</template>
