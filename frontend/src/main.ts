import './assets/main.css'

import { createApp } from 'vue'
import { createPinia } from 'pinia'

import { isBackendConfigured } from './lib/backend'

async function start() {
  // Sem as variáveis do Supabase o app não tem onde guardar nada: mostra o passo a passo em vez de quebrar.
  if (!isBackendConfigured()) {
    const { default: SetupRequiredPage } = await import('./pages/SetupRequiredPage.vue')
    createApp(SetupRequiredPage).mount('#app')
    return
  }

  const [{ default: App }, { default: router }] = await Promise.all([
    import('./App.vue'),
    import('./router'),
  ])
  const app = createApp(App)
  app.use(createPinia())
  app.use(router)
  app.mount('#app')
}

start()
