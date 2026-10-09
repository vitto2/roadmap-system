<script setup lang="ts">
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useProfileStore } from '@/stores/profile'
import { useReviewsStore } from '@/stores/reviews'

const auth = useAuthStore()
const route = useRoute()
const router = useRouter()

const password = ref('')

async function submit() {
  if (!(await auth.login(password.value))) return
  password.value = ''
  // recarrega o que falhou por falta de login
  await Promise.all([useProfileStore().load(), useReviewsStore().refreshDueCount()])
  const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : '/'
  router.replace(redirect.startsWith('/') ? redirect : '/')
}
</script>

<template>
  <div class="mx-auto mt-10 max-w-sm">
    <form class="card space-y-4 p-6" @submit.prevent="submit">
      <h1 class="text-xl font-bold">Entrar</h1>
      <p class="muted text-sm">Este roadmap está protegido por senha.</p>
      <div>
        <label for="password" class="label">Senha</label>
        <input
          id="password"
          v-model="password"
          type="password"
          class="input"
          autocomplete="current-password"
          required
          autofocus
        />
      </div>
      <p v-if="auth.error" class="text-sm text-red-700 dark:text-red-300" role="alert">
        {{ auth.error }}
      </p>
      <button type="submit" class="btn btn-primary w-full" :disabled="auth.loading || !password">
        Entrar
      </button>
    </form>
  </div>
</template>
