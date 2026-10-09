<script setup lang="ts">
import { onMounted } from 'vue'
import { RouterView } from 'vue-router'
import ToastHost from '@/components/common/ToastHost.vue'
import TopBar from '@/components/layout/TopBar.vue'
import { useProfileStore } from '@/stores/profile'
import { useUiStore } from '@/stores/ui'

const ui = useUiStore()
const profile = useProfileStore()

onMounted(() => {
  ui.applyTheme()
  profile.load()
})
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
