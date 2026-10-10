<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { allowSignUp, isDemoMode } from '@/lib/backend'
import { useAuthStore } from '@/stores/auth'
import { useProfileStore } from '@/stores/profile'
import { useReviewsStore } from '@/stores/reviews'

const auth = useAuthStore()
const route = useRoute()
const router = useRouter()

const mode = ref<'signin' | 'signup'>('signin')
const email = ref('')
const password = ref('')

const isSignUp = computed(() => mode.value === 'signup')

function switchMode(next: 'signin' | 'signup') {
  mode.value = next
  auth.error = null
  auth.notice = null
}

async function submit() {
  const ok = isSignUp.value
    ? await auth.signUp(email.value, password.value)
    : await auth.signIn(email.value, password.value)
  if (!ok) return
  password.value = ''
  // carrega o que ainda não tinha sessão para buscar
  await Promise.all([useProfileStore().load(), useReviewsStore().refreshDueCount()])
  const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : '/'
  router.replace(redirect.startsWith('/') ? redirect : '/')
}
</script>

<template>
  <div class="mx-auto mt-10 max-w-sm">
    <form class="card space-y-4 p-6" @submit.prevent="submit">
      <h1 class="text-xl font-bold">{{ isSignUp ? 'Criar conta' : 'Entrar' }}</h1>
      <p
        v-if="isDemoMode"
        class="rounded-lg bg-amber-100 p-3 text-sm text-amber-950 dark:bg-amber-950/50 dark:text-amber-100"
      >
        Modo demo: os dados ficam só neste navegador. Qualquer e-mail e senha entram.
      </p>
      <p v-else class="muted text-sm">Seus estudos são salvos na sua conta (Supabase).</p>

      <div>
        <label for="email" class="label">E-mail</label>
        <input
          id="email"
          v-model="email"
          type="email"
          class="input"
          autocomplete="email"
          inputmode="email"
          required
          autofocus
        />
      </div>
      <div>
        <label for="password" class="label">Senha</label>
        <input
          id="password"
          v-model="password"
          type="password"
          class="input"
          :autocomplete="isSignUp ? 'new-password' : 'current-password'"
          minlength="6"
          required
        />
      </div>

      <p v-if="auth.error" class="text-sm text-red-700 dark:text-red-300" role="alert">
        {{ auth.error }}
      </p>
      <p v-if="auth.notice" class="text-sm text-emerald-800 dark:text-emerald-300" role="status">
        {{ auth.notice }}
      </p>

      <button
        type="submit"
        class="btn btn-primary w-full"
        :disabled="auth.loading || !email || !password"
      >
        {{ isSignUp ? 'Criar conta' : 'Entrar' }}
      </button>

      <p v-if="allowSignUp && !isDemoMode" class="text-center text-sm">
        <template v-if="isSignUp">
          Já tem conta?
          <button
            type="button"
            class="text-indigo-700 underline dark:text-indigo-300"
            @click="switchMode('signin')"
          >
            Entrar
          </button>
        </template>
        <template v-else>
          Primeira vez?
          <button
            type="button"
            class="text-indigo-700 underline dark:text-indigo-300"
            @click="switchMode('signup')"
          >
            Criar conta
          </button>
        </template>
      </p>
    </form>
  </div>
</template>
