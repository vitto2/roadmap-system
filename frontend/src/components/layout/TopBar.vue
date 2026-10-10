<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import ProgressBar from '@/components/common/ProgressBar.vue'
import { isDemoMode } from '@/lib/backend'
import { careerLabels, formatNumber } from '@/lib/labels'
import { useAuthStore } from '@/stores/auth'
import { useProfileStore } from '@/stores/profile'
import { useReviewsStore } from '@/stores/reviews'
import { useUiStore } from '@/stores/ui'

const router = useRouter()
const baseUrl = import.meta.env.BASE_URL
const profileStore = useProfileStore()
const ui = useUiStore()
const reviews = useReviewsStore()
const auth = useAuthStore()

async function logout() {
  await auth.signOut()
  router.push({ name: 'login' })
}

const navItems = computed(() =>
  router
    .getRoutes()
    .filter((r) => r.meta.nav)
    .sort((a, b) => (a.meta.order ?? 99) - (b.meta.order ?? 99))
    .map((r) => ({ name: r.name, label: r.meta.nav as string, path: r.path })),
)

const profile = computed(() => profileStore.profile)
// Antes do login não há menu nem estatísticas para mostrar.
const locked = computed(() => !auth.authenticated)
</script>

<template>
  <header
    class="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur dark:border-slate-800 dark:bg-slate-900/90"
  >
    <div class="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
      <RouterLink to="/" class="flex items-center gap-2 text-base font-bold tracking-tight">
        <img :src="`${baseUrl}favicon.svg`" alt="" class="h-7 w-7" width="28" height="28" />
        Trilha Sênior
      </RouterLink>

      <div
        v-if="profile && !locked"
        class="order-3 flex w-full flex-wrap items-center gap-x-6 gap-y-2 sm:order-none sm:w-auto sm:flex-1"
      >
        <div class="min-w-40 flex-1 sm:max-w-xs">
          <div class="mb-1 flex items-baseline justify-between text-xs">
            <span class="font-semibold">Nível {{ profile.xp.level }}</span>
            <span class="muted" data-testid="xp-label">
              {{ formatNumber(profile.xp.xpIntoLevel) }} /
              {{ formatNumber(profile.xp.xpForNextLevel) }} XP
            </span>
          </div>
          <ProgressBar
            :percent="profile.xp.progressPercent"
            label="Progresso para o próximo nível"
            tone="amber"
            size="sm"
          />
        </div>

        <dl class="flex flex-wrap items-center gap-x-5 gap-y-1 text-xs">
          <div>
            <dt class="muted inline">Carreira:</dt>
            <dd class="ml-1 inline font-semibold">{{ careerLabels[profile.career.level] }}</dd>
          </div>
          <div>
            <dt class="muted inline">Geral:</dt>
            <dd class="ml-1 inline font-semibold">{{ profile.overall.percent }}%</dd>
          </div>
          <div :title="`Maior sequência: ${profile.streak.longest} dia(s)`">
            <dt class="muted inline">Streak:</dt>
            <dd class="ml-1 inline font-semibold">
              <span aria-hidden="true">🔥</span> {{ profile.streak.current }}
              {{ profile.streak.current === 1 ? 'dia' : 'dias' }}
            </dd>
          </div>
        </dl>
      </div>
      <p v-else-if="profileStore.error" class="text-xs text-red-700 dark:text-red-300" role="alert">
        {{ profileStore.error }}
      </p>

      <div class="ml-auto flex items-center gap-1">
        <span
          v-if="isDemoMode"
          class="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-950 dark:bg-amber-950 dark:text-amber-100"
          title="Os dados ficam só neste navegador (sem Supabase)"
        >
          Modo demo
        </span>
        <span
          v-if="auth.user?.email && !isDemoMode"
          class="muted hidden max-w-40 truncate text-xs sm:inline"
          :title="auth.user.email"
        >
          {{ auth.user.email }}
        </span>
        <button v-if="auth.authenticated" type="button" class="btn btn-ghost" @click="logout">
          Sair
        </button>
        <button
          type="button"
          class="btn btn-ghost !px-2.5"
          :aria-label="ui.theme === 'dark' ? 'Ativar tema claro' : 'Ativar tema escuro'"
          :title="ui.theme === 'dark' ? 'Tema claro' : 'Tema escuro'"
          @click="ui.toggleTheme()"
        >
          <span aria-hidden="true">{{ ui.theme === 'dark' ? '☀️' : '🌙' }}</span>
        </button>
      </div>
    </div>

    <nav v-if="!locked" aria-label="Principal" class="mx-auto max-w-6xl overflow-x-auto px-4">
      <ul class="flex gap-1 pb-2">
        <li v-for="item in navItems" :key="item.path">
          <RouterLink
            :to="item.path"
            class="block whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
            active-class="!bg-indigo-100 !text-indigo-900 dark:!bg-indigo-950 dark:!text-indigo-200"
          >
            {{ item.label }}
            <span
              v-if="item.name === 'reviews' && reviews.dueCount > 0"
              class="ml-1 rounded-full bg-amber-500 px-1.5 py-0.5 text-xs font-bold tabular-nums text-slate-950"
              :aria-label="`${reviews.dueCount} revisões para hoje`"
            >
              {{ reviews.dueCount }}
            </span>
          </RouterLink>
        </li>
      </ul>
    </nav>
  </header>
</template>
