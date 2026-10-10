<script setup lang="ts">
import { onMounted, watch } from 'vue'
import { RouterView, useRoute, useRouter } from 'vue-router'
import ToastHost from '@/components/common/ToastHost.vue'
import TopBar from '@/components/layout/TopBar.vue'
import { useAuthStore } from '@/stores/auth'
import { useProfileStore } from '@/stores/profile'
import { useReviewsStore } from '@/stores/reviews'
import { useUiStore } from '@/stores/ui'

const ui = useUiStore()
const auth = useAuthStore()
const profile = useProfileStore()
const reviews = useReviewsStore()
const route = useRoute()
const router = useRouter()

onMounted(() => {
  ui.applyTheme()
  auth.init()
})

// Reage ao estado da sessão: carrega os dados ao entrar e volta ao login se a sessão acabar (logout/expiração).
watch(
  [() => auth.ready, () => auth.authenticated],
  ([ready, signedIn], previous) => {
    if (!ready) return
    if (!signedIn) {
      if (route.name !== 'login')
        router.push({ name: 'login', query: { redirect: route.fullPath } })
      return
    }
    if (!previous?.[0] || !previous[1]) {
      profile.load()
      reviews.refreshDueCount()
    }
  },
  { immediate: true },
)
</script>

<template>
  <a
    href="#conteudo"
    class="sr-only z-50 rounded-lg bg-white px-4 py-2 text-sm font-medium focus:not-sr-only focus:fixed focus:left-4 focus:top-4 dark:bg-slate-900"
  >
    Pular para o conteúdo
  </a>
  <TopBar />
  <main id="conteudo" class="mx-auto max-w-6xl px-4 py-6" tabindex="-1">
    <RouterView />
  </main>
  <ToastHost />
</template>
