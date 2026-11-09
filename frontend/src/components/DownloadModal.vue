<script setup>
import { ref, onMounted } from 'vue'
import { useUIStore } from '@/stores/ui'
import { isTauriEnv } from '@/services/offlineSync'
import {
  Laptop,
  Smartphone,
  Download,
  X,
  CheckCircle2,
  Share2,
  Terminal,
  Copy,
  Check,
  AlertTriangle
} from 'lucide-vue-next'

const ui = useUIStore()

const deferredPrompt = ref(null)
const isAndroid = ref(false)
const isIOS = ref(false)
const isMac = ref(false)
const showGatekeeperHelp = ref(false)
const copied = ref(false)

function copyCommand() {
  navigator.clipboard.writeText('xattr -cr /Applications/Atrium.app')
  copied.value = true
  ui.showToast('Copied command to clipboard!', 'success')
  setTimeout(() => { copied.value = false }, 2500)
}

onMounted(() => {
  const ua = navigator.userAgent || ''
  isIOS.value = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  isAndroid.value = /Android/i.test(ua)
  isMac.value = /Macintosh|MacIntel/i.test(ua) && !isIOS.value

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    deferredPrompt.value = e
  })
})

function onDmgDownload() {
  localStorage.setItem('atrium.app_downloaded', 'true')
}

async function triggerAndroidInstall() {
  if (deferredPrompt.value) {
    deferredPrompt.value.prompt()
    const { outcome } = await deferredPrompt.value.userChoice
    if (outcome === 'accepted') {
      localStorage.setItem('atrium.app_downloaded', 'true')
    }
    deferredPrompt.value = null
  } else {
    ui.showToast('Open Chrome menu (⋮) and tap "Install App"', 'info')
  }
}
</script>

<template>
  <div
    v-if="ui.downloadModalOpen"
    class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/40 backdrop-blur-sm animate-fade-in"
    @click.self="ui.downloadModalOpen = false"
  >
    <div class="relative w-full max-w-lg card p-6 sm:p-7 shadow-2xl animate-rise-in space-y-6 bg-surface border border-line">
      <!-- Modal Header -->
      <div class="flex items-start justify-between">
        <div class="flex items-center gap-3">
          <span class="w-10 h-10 rounded-2xl bg-canvas border border-line flex items-center justify-center shadow-sm">
            <img src="/pwa-192.png" alt="Atrium" class="w-7 h-7 object-contain" />
          </span>
          <div>
            <div class="overline">Get Atrium App</div>
            <h3 class="font-serif text-2xl text-ink leading-tight">Install on Your Devices</h3>
          </div>
        </div>
        <button class="btn-ghost !p-2 text-ink-3 hover:text-ink" @click="ui.downloadModalOpen = false">
          <X class="w-4 h-4" />
        </button>
      </div>

      <!-- Device Download Cards -->
      <div class="space-y-3.5">
        <!-- 1. macOS Native Desktop App -->
        <div class="p-4 bg-canvas border border-line rounded-2xl space-y-3 hover:border-line-2 transition-all">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-3">
              <div class="w-9 h-9 rounded-xl bg-surface border border-line flex items-center justify-center text-purple-600 shrink-0">
                <Laptop class="w-5 h-5" />
              </div>
              <div>
                <div class="font-semibold text-ink text-sm flex items-center gap-2">
                  <span>macOS Desktop App</span>
                  <span v-if="isMac" class="text-[10px] bg-purple-500/10 text-purple-600 px-2 py-0.5 rounded-full font-sans font-medium">Your Device</span>
                </div>
                <div class="text-xs text-ink-3">Apple Silicon & Intel Universal</div>
              </div>
            </div>
          </div>

          <div class="pt-1 space-y-2">
            <a
              href="/Atrium-Installer.dmg"
              download="Atrium-Installer.dmg"
              @click="onDmgDownload"
              class="btn-primary text-xs !py-2.5 !px-4 w-full flex items-center justify-center gap-2"
            >
              <Download class="w-4 h-4" />
              <span>Download macOS DMG Installer</span>
            </a>

            <!-- Gatekeeper "Damaged" fix accordion/tip -->
            <div class="p-3 bg-surface/70 border border-line rounded-xl text-xs space-y-2">
              <div class="flex items-center justify-between cursor-pointer select-none" @click="showGatekeeperHelp = !showGatekeeperHelp">
                <div class="flex items-center gap-1.5 text-amber-600 font-medium">
                  <AlertTriangle class="w-3.5 h-3.5 shrink-0" />
                  <span>Mac says "App is damaged and can't be opened"?</span>
                </div>
                <span class="text-[11px] text-ink-3 underline">{{ showGatekeeperHelp ? 'Hide' : 'How to fix' }}</span>
              </div>

              <div v-if="showGatekeeperHelp" class="space-y-2 pt-1 border-t border-line/40 text-ink-2">
                <p class="leading-relaxed text-[11px]">
                  macOS Gatekeeper blocks unnotarized internet downloads with this generic warning. Drag <strong>Atrium</strong> into your <strong>Applications</strong> folder, then run this quick command in Terminal:
                </p>
                <div class="flex items-center justify-between gap-2 p-2 bg-canvas border border-line rounded-lg font-mono text-[11px] text-ink">
                  <span class="truncate">xattr -cr /Applications/Atrium.app</span>
                  <button
                    type="button"
                    class="p-1 hover:text-pri-strategic text-ink-3 shrink-0 flex items-center gap-1"
                    @click="copyCommand"
                    title="Copy command"
                  >
                    <Check v-if="copied" class="w-3.5 h-3.5 text-emerald-500" />
                    <Copy v-else class="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- 2. Android 1-Click Mobile App -->
        <div class="p-4 bg-canvas border border-line rounded-2xl space-y-2.5 hover:border-line-2 transition-all">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-3">
              <div class="w-9 h-9 rounded-xl bg-surface border border-line flex items-center justify-center text-emerald-600 shrink-0">
                <Smartphone class="w-5 h-5" />
              </div>
              <div>
                <div class="font-semibold text-ink text-sm flex items-center gap-2">
                  <span>Android (Chrome)</span>
                  <span v-if="isAndroid" class="text-[10px] bg-emerald-500/10 text-emerald-600 px-2 py-0.5 rounded-full font-sans font-medium">Your Device</span>
                </div>
                <div class="text-xs text-ink-3">Instant 1-Click Home Screen Install</div>
              </div>
            </div>

            <button
              v-if="deferredPrompt"
              type="button"
              @click="triggerAndroidInstall"
              class="btn-primary text-xs !py-1.5 !px-3 shrink-0 flex items-center gap-1"
            >
              <Download class="w-3.5 h-3.5" />
              <span>Install App</span>
            </button>
          </div>
          <p class="text-xs text-ink-3 leading-relaxed">
            Visit this link in Chrome on your phone, then tap the floating <strong>"Install App"</strong> bar or the three dots (⋮) → <strong>"Install App"</strong>.
          </p>
        </div>

        <!-- 3. iPhone & iPad (Safari) -->
        <div class="p-4 bg-canvas border border-line rounded-2xl space-y-2 hover:border-line-2 transition-all">
          <div class="flex items-center gap-3">
            <div class="w-9 h-9 rounded-xl bg-surface border border-line flex items-center justify-center text-blue-600 shrink-0">
              <Share2 class="w-5 h-5" />
            </div>
            <div>
              <div class="font-semibold text-ink text-sm flex items-center gap-2">
                <span>iPhone & iPad (Safari)</span>
                <span v-if="isIOS" class="text-[10px] bg-blue-500/10 text-blue-600 px-2 py-0.5 rounded-full font-sans font-medium">Your Device</span>
              </div>
              <div class="text-xs text-ink-3">Add to iOS Home Screen</div>
            </div>
          </div>
          <ol class="list-decimal list-inside space-y-1 text-xs text-ink-3 pl-1 leading-relaxed">
            <li>Open Safari and tap the <strong class="text-ink">Share</strong> button (<Share2 class="w-3 h-3 inline pb-0.5" />) at the bottom.</li>
            <li>Scroll down and tap <strong class="text-ink">"Add to Home Screen"</strong>.</li>
          </ol>
        </div>
      </div>

      <!-- Modal Footer -->
      <div class="flex items-center justify-between pt-1 text-xs text-ink-3">
        <span>Works 100% offline with encrypted local storage</span>
        <button
          type="button"
          class="btn-secondary text-xs !py-1.5 !px-4"
          @click="ui.downloadModalOpen = false"
        >
          Close
        </button>
      </div>
    </div>
  </div>
</template>
