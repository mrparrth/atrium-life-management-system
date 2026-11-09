<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { isTauriEnv } from '@/services/offlineSync'
import {
  Sparkles,
  CheckCircle2,
  Download,
  ArrowRight,
  ShieldCheck,
  Zap,
  Smartphone,
  Laptop,
  Flame,
  Receipt,
  X
} from 'lucide-vue-next'

const router = useRouter()

// PWA deferred install prompt
const deferredPrompt = ref(null)
const canDirectInstall = ref(false)
const showInstallBanner = ref(false)
const showInstallModal = ref(false)

onMounted(() => {
  // If running inside native Tauri desktop or standalone installed PWA, go straight to dashboard
  const isDesktop = typeof window !== 'undefined' && Boolean(window.__TAURI_INTERNALS__ || window.__TAURI__ || window.__TAURI_IPC__ || window.__TAURI_METADATA__)
  const isStandalone = isDesktop ||
    window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true

  if (isStandalone) {
    router.replace('/dashboard')
    return
  }

  // Listen for native PWA install prompt (Chrome on Android, Mac, Windows)
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    deferredPrompt.value = e
    canDirectInstall.value = true
    // Display the floating top install banner automatically (like AppSumo screenshot)
    showInstallBanner.value = true
  })

  // Dismiss banner if already installed
  window.addEventListener('appinstalled', () => {
    canDirectInstall.value = false
    showInstallBanner.value = false
    deferredPrompt.value = null
  })
})

function enterApp() {
  localStorage.setItem('atrium.visited_landing', 'true')
  router.push('/dashboard')
}

function onDmgDownload() {
  localStorage.setItem('atrium.app_downloaded', 'true')
}

async function triggerDirectInstall() {
  if (deferredPrompt.value) {
    deferredPrompt.value.prompt()
    const { outcome } = await deferredPrompt.value.userChoice
    if (outcome === 'accepted') {
      showInstallBanner.value = false
      localStorage.setItem('atrium.app_downloaded', 'true')
    }
    deferredPrompt.value = null
  } else {
    // If browser doesn't support direct programmatic prompt (e.g. iOS Safari), show the modal
    showInstallModal.value = true
  }
}
</script>

<template>
  <div class="min-h-screen bg-canvas text-ink flex flex-col selection:bg-ink selection:text-canvas overflow-x-hidden relative">
    
    <!-- Floating Native 1-Click Install Bar (Matching AppSumo reference screenshot) -->
    <aside
      v-if="showInstallBanner"
      class="fixed top-3 inset-x-4 max-w-md mx-auto z-50 bg-[#1c1a17] text-canvas px-4 py-2.5 rounded-2xl shadow-2xl border border-white/10 flex items-center justify-between gap-3 animate-rise-in select-none"
    >
      <div class="flex items-center gap-3 min-w-0">
        <span class="w-9 h-9 rounded-xl bg-canvas flex items-center justify-center shrink-0 shadow-sm">
          <span class="w-3.5 h-3.5 rounded-full bg-ink"></span>
        </span>
        <div class="min-w-0">
          <div class="font-medium text-sm text-canvas truncate leading-tight">Install Atrium</div>
          <div class="text-[11px] text-zinc-400 font-mono truncate leading-tight">atrium-life-planner.vercel.app</div>
        </div>
      </div>
      <div class="flex items-center gap-2 shrink-0">
        <button
          type="button"
          class="bg-canvas text-ink text-xs font-semibold px-3 py-1.5 rounded-xl hover:bg-zinc-200 transition-colors shadow-sm"
          @click="triggerDirectInstall"
        >
          Install
        </button>
        <button
          type="button"
          class="text-zinc-400 hover:text-canvas p-1 transition-colors"
          @click="showInstallBanner = false"
          title="Dismiss"
        >
          <X class="w-4 h-4" />
        </button>
      </div>
    </aside>

    <!-- Top Navigation Bar -->
    <header class="w-full border-b border-line/60 bg-surface/80 backdrop-blur-md sticky top-0 z-40">
      <div class="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        <!-- Brand -->
        <div class="flex items-center gap-3">
          <span class="w-8 h-8 rounded-full bg-ink flex items-center justify-center shadow-sm">
            <span class="w-2.5 h-2.5 rounded-full bg-canvas"></span>
          </span>
          <span class="font-serif text-2xl font-semibold tracking-tight text-ink">Atrium</span>
          <span class="text-[10px] uppercase font-mono tracking-widest px-2 py-0.5 rounded-md border border-line bg-canvas text-ink-3 hidden sm:inline">
            Local-First
          </span>
        </div>

        <!-- Right Action Buttons -->
        <div class="flex items-center gap-2.5">
          <!-- 1-Click Direct Install / Download Trigger -->
          <button
            type="button"
            class="btn-secondary text-xs !py-2 !px-3.5 hidden sm:flex items-center gap-1.5"
            @click="triggerDirectInstall"
          >
            <Download class="w-3.5 h-3.5" />
            <span>Install / Download</span>
          </button>
          <button
            type="button"
            class="btn-primary text-xs !py-2 !px-4 flex items-center gap-1.5"
            @click="enterApp"
          >
            <span>Launch Web App</span>
            <ArrowRight class="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </header>

    <!-- Hero Section -->
    <main class="flex-1">
      <section class="max-w-5xl mx-auto px-6 pt-16 pb-20 text-center">
        <!-- Pill Badge -->
        <div class="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-surface border border-line text-xs text-ink-2 mb-8 shadow-sm">
          <Sparkles class="w-3.5 h-3.5 text-pri-strategic" />
          <span>Personal Reflection & Deep Work Operating System</span>
        </div>

        <!-- Headline -->
        <h1 class="font-serif text-5xl sm:text-6xl md:text-7xl font-normal tracking-tight text-ink leading-[1.08] max-w-4xl mx-auto">
          Your quiet space for life, work, and personal growth.
        </h1>

        <!-- Subtitle -->
        <p class="text-ink-2 text-lg sm:text-xl mt-6 max-w-2xl mx-auto font-light leading-relaxed">
          A local-first system designed for intentional living. Your tasks, goals, finance, clients, and memories live privately on your device.
        </p>

        <!-- CTA Buttons Row -->
        <div class="flex flex-col sm:flex-row items-center justify-center gap-4 mt-10">
          <button
            type="button"
            class="btn-primary !text-base !py-3.5 !px-8 flex items-center justify-center gap-2.5 w-full sm:w-auto shadow-md"
            @click="enterApp"
          >
            <span>Start Using Atrium</span>
            <ArrowRight class="w-4 h-4" />
          </button>

          <!-- Direct Install or Modal trigger -->
          <button
            type="button"
            class="btn-secondary !text-base !py-3.5 !px-6 flex items-center justify-center gap-2.5 w-full sm:w-auto"
            @click="triggerDirectInstall"
          >
            <Download class="w-4 h-4 text-ink-3" />
            <span>Download / Install App</span>
          </button>
        </div>

        <!-- Trust Badges -->
        <div class="flex flex-wrap items-center justify-center gap-6 sm:gap-8 mt-12 text-xs text-ink-3 font-mono">
          <div class="flex items-center gap-1.5">
            <ShieldCheck class="w-4 h-4 text-emerald-600" />
            <span>100% Private IndexedDB</span>
          </div>
          <div class="flex items-center gap-1.5">
            <Zap class="w-4 h-4 text-amber-500" />
            <span>Works Full Offline</span>
          </div>
          <div class="flex items-center gap-1.5">
            <Smartphone class="w-4 h-4 text-blue-500" />
            <span>Instant Mobile PWA</span>
          </div>
          <div class="flex items-center gap-1.5">
            <Laptop class="w-4 h-4 text-purple-500" />
            <span>Native macOS Desktop</span>
          </div>
        </div>
      </section>

      <!-- Visual Preview Cards Section -->
      <section class="max-w-6xl mx-auto px-6 py-12">
        <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
          <!-- Pillar 1: Action -->
          <div class="card p-7 flex flex-col justify-between hover:border-line-2 transition-all">
            <div>
              <div class="w-10 h-10 rounded-2xl bg-canvas border border-line flex items-center justify-center text-ink-2 mb-4">
                <CheckCircle2 class="w-5 h-5 text-pri-strategic" />
              </div>
              <div class="overline text-xs">Pillar 01</div>
              <h3 class="font-serif text-2xl mt-1 text-ink">Action & Clarity</h3>
              <p class="text-sm text-ink-2 mt-2 leading-relaxed">
                Prioritize tasks with Eisenhower matrices, group by effective schedules, and plan quiet next steps without noisy notifications.
              </p>
            </div>
            <ul class="space-y-2 mt-6 pt-5 border-t border-line text-xs text-ink-3 font-mono">
              <li class="flex items-center gap-2">
                <span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                <span>Due date & snooze rescheduling</span>
              </li>
              <li class="flex items-center gap-2">
                <span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                <span>Next steps section planning</span>
              </li>
              <li class="flex items-center gap-2">
                <span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                <span>Project health & archives</span>
              </li>
            </ul>
          </div>

          <!-- Pillar 2: Reflection -->
          <div class="card p-7 flex flex-col justify-between hover:border-line-2 transition-all">
            <div>
              <div class="w-10 h-10 rounded-2xl bg-canvas border border-line flex items-center justify-center text-ink-2 mb-4">
                <Flame class="w-5 h-5 text-amber-500" />
              </div>
              <div class="overline text-xs">Pillar 02</div>
              <h3 class="font-serif text-2xl mt-1 text-ink">Growth & Memory</h3>
              <p class="text-sm text-ink-2 mt-2 leading-relaxed">
                Nurture your Tree of Daily Growth, preserve year visions, track habits, and resurface forgotten notes and inspiring mentors.
              </p>
            </div>
            <ul class="space-y-2 mt-6 pt-5 border-t border-line text-xs text-ink-3 font-mono">
              <li class="flex items-center gap-2">
                <span class="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                <span>Tree of Daily Growth scoring</span>
              </li>
              <li class="flex items-center gap-2">
                <span class="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                <span>Habit streaks & consistency</span>
              </li>
              <li class="flex items-center gap-2">
                <span class="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                <span>Memory resurfacing engine</span>
              </li>
            </ul>
          </div>

          <!-- Pillar 3: Work -->
          <div class="card p-7 flex flex-col justify-between hover:border-line-2 transition-all">
            <div>
              <div class="w-10 h-10 rounded-2xl bg-canvas border border-line flex items-center justify-center text-ink-2 mb-4">
                <Receipt class="w-5 h-5 text-blue-500" />
              </div>
              <div class="overline text-xs">Pillar 03</div>
              <h3 class="font-serif text-2xl mt-1 text-ink">Client Operations</h3>
              <p class="text-sm text-ink-2 mt-2 leading-relaxed">
                Separate professional context with one click. Manage clients, track deliverables, issue invoices, and sync calendar feeds.
              </p>
            </div>
            <ul class="space-y-2 mt-6 pt-5 border-t border-line text-xs text-ink-3 font-mono">
              <li class="flex items-center gap-2">
                <span class="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                <span>Instant Work / Personal toggle</span>
              </li>
              <li class="flex items-center gap-2">
                <span class="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                <span>Client pipeline & invoices</span>
              </li>
              <li class="flex items-center gap-2">
                <span class="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                <span>iCal / Google calendar sync</span>
              </li>
            </ul>
          </div>
        </div>
      </section>

      <!-- Download Direct Section -->
      <section class="max-w-4xl mx-auto px-6 py-12 text-center">
        <div class="card p-8 bg-elevated border-line-2">
          <h2 class="font-serif text-3xl sm:text-4xl text-ink">Install on your phone or desktop</h2>
          <p class="text-ink-2 text-sm sm:text-base mt-2.5 max-w-lg mx-auto">
            Choose your device to download the native desktop app or install directly to your home screen.
          </p>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-8 text-left">
            <!-- Mac Direct Download (DMG) -->
            <div class="card p-5 bg-surface hover:border-ink transition-all flex flex-col justify-between group space-y-3">
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-3.5">
                  <div class="w-10 h-10 rounded-xl bg-canvas border border-line flex items-center justify-center text-purple-500 shrink-0">
                    <Laptop class="w-5 h-5" />
                  </div>
                  <div>
                    <div class="font-medium text-sm text-ink">macOS Desktop App</div>
                    <div class="text-xs text-ink-3">Universal Disk Image (.dmg)</div>
                  </div>
                </div>
                <a
                  href="/Atrium-Installer.dmg"
                  download="Atrium-Installer.dmg"
                  @click="onDmgDownload"
                  class="btn-primary text-xs !py-1.5 !px-3.5 flex items-center gap-1.5 shrink-0"
                >
                  <Download class="w-3.5 h-3.5" />
                  <span>Download DMG</span>
                </a>
              </div>
              <div class="text-[11px] text-ink-3 bg-canvas border border-line rounded-lg p-2 flex items-center justify-between gap-1">
                <span>If Gatekeeper says "damaged": run <code class="text-ink font-mono select-all">xattr -cr /Applications/Atrium.app</code> in Terminal</span>
              </div>
            </div>

            <!-- Mobile PWA 1-Click -->
            <button
              type="button"
              class="card p-5 bg-surface hover:border-ink transition-all flex items-center justify-between group cursor-pointer text-left"
              @click="triggerDirectInstall"
            >
              <div class="flex items-center gap-3.5">
                <div class="w-10 h-10 rounded-xl bg-canvas border border-line flex items-center justify-center text-emerald-500 shrink-0">
                  <Smartphone class="w-5 h-5" />
                </div>
                <div>
                  <div class="font-medium text-sm text-ink">Mobile App (PWA)</div>
                  <div class="text-xs text-ink-3">iOS & Android Home Screen</div>
                </div>
              </div>
              <Download class="w-4 h-4 text-ink-3 group-hover:text-ink transition-colors shrink-0" />
            </button>
          </div>
        </div>
      </section>
    </main>

    <!-- Footer -->
    <footer class="border-t border-line/60 bg-surface/50 py-8 text-center text-xs text-ink-3">
      <div class="max-w-6xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div class="flex items-center gap-2">
          <span class="w-5 h-5 rounded-full bg-ink flex items-center justify-center">
            <span class="w-1.5 h-1.5 rounded-full bg-canvas"></span>
          </span>
          <span class="font-serif font-medium text-ink">Atrium Life Planner</span>
          <span>· Local-First Architecture</span>
        </div>
        <div class="flex items-center gap-4 text-ink-3">
          <button @click="enterApp" class="hover:text-ink transition-colors">Launch App</button>
          <span>·</span>
          <a href="/Atrium-Installer.dmg" download="Atrium-Installer.dmg" class="hover:text-ink transition-colors">Download macOS DMG</a>
        </div>
      </div>
    </footer>

    <!-- Installation Modal (for iOS & unsupported browsers) -->
    <div
      v-if="showInstallModal"
      class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/40 backdrop-blur-sm animate-fade-in"
      @click.self="showInstallModal = false"
    >
      <div class="relative w-full max-w-md card p-6 shadow-2xl animate-rise-in space-y-5 bg-surface">
        <div class="flex items-start justify-between">
          <div>
            <div class="overline">Device Installation</div>
            <h3 class="font-serif text-2xl text-ink mt-0.5">Install Atrium</h3>
          </div>
          <button class="btn-ghost !p-1.5" @click="showInstallModal = false">
            <X class="w-4 h-4" />
          </button>
        </div>

        <div class="space-y-3.5 text-xs text-ink-2">
          <!-- Mac Direct Download -->
          <div class="p-3.5 bg-canvas border border-line rounded-xl space-y-2.5">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-3">
                <Laptop class="w-5 h-5 text-purple-500 shrink-0" />
                <div>
                  <div class="font-semibold text-ink text-sm">Mac Desktop App</div>
                  <div class="text-[11px] text-ink-3">Standalone native application</div>
                </div>
              </div>
              <a
                href="/Atrium-Installer.dmg"
                download="Atrium-Installer.dmg"
                class="btn-primary text-xs !py-1.5 !px-3.5 flex items-center gap-1.5 shrink-0"
              >
                <Download class="w-3.5 h-3.5" />
                <span>Download DMG</span>
              </a>
            </div>
            <p class="text-[11px] text-ink-3 leading-relaxed border-t border-line/40 pt-2">
              If macOS says damaged: Drag to Applications, then run <code class="text-ink font-mono select-all">xattr -cr /Applications/Atrium.app</code> in Terminal.
            </p>
          </div>

          <!-- Android Instructions -->
          <div class="p-3.5 bg-canvas border border-line rounded-xl space-y-1.5">
            <div class="font-semibold text-ink flex items-center gap-2 text-sm">
              <Smartphone class="w-4 h-4 text-emerald-500" />
              <span>Android (Chrome)</span>
            </div>
            <p class="text-ink-3">
              Tap the <strong>three dots (⋮)</strong> in Chrome and select <strong class="text-ink">"Install App"</strong> or use the floating prompt at the top of the page.
            </p>
          </div>

          <!-- iPhone / iPad Instructions -->
          <div class="p-3.5 bg-canvas border border-line rounded-xl space-y-1.5">
            <div class="font-semibold text-ink flex items-center gap-2 text-sm">
              <Smartphone class="w-4 h-4 text-blue-500" />
              <span>iPhone & iPad (Safari)</span>
            </div>
            <ol class="list-decimal list-inside space-y-1 text-ink-3 pl-1">
              <li>Tap Safari's <strong class="text-ink">Share</strong> button at the bottom.</li>
              <li>Tap <strong class="text-ink">"Add to Home Screen"</strong>.</li>
            </ol>
          </div>
        </div>

        <div class="flex justify-end pt-2">
          <button
            type="button"
            class="btn-primary text-xs !py-2 !px-4"
            @click="showInstallModal = false"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
