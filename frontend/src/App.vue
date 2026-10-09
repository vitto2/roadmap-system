<script setup lang="ts">
import { onBeforeUnmount, onMounted } from 'vue'
import { RouterView, useRoute, useRouter } from 'vue-router'
import { AUTH_REQUIRED_EVENT } from '@/api/client'
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

// A API recusou o token (expirou ou a senha mudou): volta para o login.
function onAuthRequired() {
  auth.expire()
  if (route.name !== 'login') router.push({ name: 'login', query: { redirect: route.fullPath } })
}

onMounted(async () => {
  ui.applyTheme()
  window.addEventListener(AUTH_REQUIRED_EVENT, onAuthRequired)
  await auth.init()
  if (auth.authenticated) {
    profile.load()
    reviews.refreshDueCount()
  }
})

onBeforeUnmount(() => window.removeEventListener(AUTH_REQUIRED_EVENT, onAuthRequired))
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
