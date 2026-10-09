<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import ErrorState from '@/components/common/ErrorState.vue'
import LoadingState from '@/components/common/LoadingState.vue'
import { useDataTransfer } from '@/composables/useDataTransfer'
import { useSettingsStore } from '@/stores/settings'
import { useUiStore } from '@/stores/ui'

const store = useSettingsStore()
const ui = useUiStore()
const transfer = useDataTransfer()
const fileInput = ref<HTMLInputElement | null>(null)

const timezone = ref('')
const weeklyGoal = ref<number | null>(5)

// Lista de fusos do navegador (fallback com os mais comuns do Brasil).
const timezones = computed(() => {
  const fallback = [
    'America/Sao_Paulo',
    'America/Manaus',
    'America/Fortaleza',
    'America/Noronha',
    'America/Rio_Branco',
    'UTC',
  ]
  const supported =
    typeof Intl.supportedValuesOf === 'function' ? Intl.supportedValuesOf('timeZone') : fallback
  return [...new Set([...fallback, ...supported])]
})

onMounted(() => store.load())

watch(
  () => store.settings,
  (value) => {
    if (value) {
      timezone.value = value.timezone
      weeklyGoal.value = value.weeklyGoal
    }
  },
  { immediate: true },
)

const changed = computed(
  () =>
    store.settings !== null &&
    (timezone.value !== store.settings.timezone || weeklyGoal.value !== store.settings.weeklyGoal),
)

async function onFileChosen(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  const ok = window.confirm(
    'Restaurar este backup vai SUBSTITUIR todo o seu progresso atual (tópicos, projetos, revisões e diário). Continuar?',
  )
  if (ok) await transfer.restoreBackup(file)
}

function submit() {
  if (weeklyGoal.value === null) return
  store.save({ timezone: timezone.value, weeklyGoal: weeklyGoal.value })
}
</script>

<template>
  <div class="max-w-2xl">
    <h1 class="mb-6 text-2xl font-bold tracking-tight">Configurações</h1>

    <LoadingState v-if="store.loading && !store.settings" />
    <ErrorState
      v-else-if="store.error && !store.settings"
      :message="store.error"
      @retry="store.load()"
    />

    <div v-else class="space-y-6">
      <form class="card space-y-4 p-5" @submit.prevent="submit">
        <h2 class="text-lg font-semibold">Estudo</h2>
        <div>
          <label for="timezone" class="label">Fuso horário</label>
          <select id="timezone" v-model="timezone" class="input" aria-describedby="timezone-help">
            <option v-for="tz in timezones" :key="tz" :value="tz">{{ tz }}</option>
          </select>
          <p id="timezone-help" class="muted mt-1 text-xs">
            Define o que é “hoje” para streak, meta semanal e revisões. As datas ficam em UTC no
            banco.
          </p>
          <p
            v-if="store.fieldErrors.timezone"
            class="mt-1 text-xs text-red-700 dark:text-red-300"
            role="alert"
          >
            {{ store.fieldErrors.timezone[0] }}
          </p>
        </div>
        <div>
          <label for="weekly-goal" class="label">Meta semanal (sessões por semana)</label>
          <input
            id="weekly-goal"
            v-model.number="weeklyGoal"
            type="number"
            min="1"
            max="50"
            class="input max-w-32"
            required
          />
          <p
            v-if="store.fieldErrors.weeklyGoal"
            class="mt-1 text-xs text-red-700 dark:text-red-300"
            role="alert"
          >
            {{ store.fieldErrors.weeklyGoal[0] }}
          </p>
        </div>
        <button type="submit" class="btn btn-primary" :disabled="!changed || store.saving">
          Salvar
        </button>
      </form>

      <section class="card space-y-4 p-5" aria-labelledby="data-title">
        <h2 id="data-title" class="text-lg font-semibold">Dados</h2>

        <div>
          <h3 class="font-medium">Portfólio de projetos</h3>
          <p class="muted mb-2 text-sm">
            Markdown com os projetos concluídos, para colar no GitHub ou no currículo.
          </p>
          <button
            type="button"
            class="btn btn-secondary"
            :disabled="transfer.busy.value !== null"
            @click="transfer.exportPortfolio()"
          >
            Exportar portfólio (.md)
          </button>
        </div>

        <div class="border-t border-slate-200 pt-4 dark:border-slate-800">
          <h3 class="font-medium">Backup do progresso</h3>
          <p class="muted mb-2 text-sm">
            Baixe um JSON com seu progresso (não inclui o conteúdo do roadmap). Restaurar substitui
            o progresso atual.
          </p>
          <div class="flex flex-wrap gap-2">
            <button
              type="button"
              class="btn btn-secondary"
              :disabled="transfer.busy.value !== null"
              @click="transfer.exportBackup()"
            >
              Baixar backup (.json)
            </button>
            <button
              type="button"
              class="btn btn-danger"
              :disabled="transfer.busy.value !== null"
              @click="fileInput?.click()"
            >
              Restaurar backup…
            </button>
            <input
              ref="fileInput"
              type="file"
              accept="application/json,.json"
              class="sr-only"
              tabindex="-1"
              aria-label="Arquivo de backup"
              @change="onFileChosen"
            />
          </div>
          <div
            v-if="transfer.summary.value"
            class="mt-3 rounded-lg bg-slate-100 p-3 text-sm dark:bg-slate-800"
            role="status"
          >
            <p class="font-medium">
              Restaurados: {{ transfer.summary.value.imported.topics }} tópicos,
              {{ transfer.summary.value.imported.projects }} projetos,
              {{ transfer.summary.value.imported.sessions }} sessões.
            </p>
            <template v-if="transfer.summary.value.skipped.length > 0">
              <p class="mt-1">Ignorados (não existem mais no conteúdo atual):</p>
              <ul class="list-disc pl-5">
                <li v-for="item in transfer.summary.value.skipped" :key="item">{{ item }}</li>
              </ul>
            </template>
          </div>
        </div>
      </section>

      <section class="card p-5" aria-labelledby="theme-title">
        <h2 id="theme-title" class="mb-3 text-lg font-semibold">Aparência</h2>
        <div
          role="group"
          aria-label="Tema"
          class="inline-grid grid-cols-2 overflow-hidden rounded-lg border border-slate-300 text-sm font-medium dark:border-slate-700"
        >
          <button
            type="button"
            class="px-4 py-2"
            :class="
              ui.theme === 'light'
                ? 'bg-indigo-600 text-white dark:bg-indigo-400 dark:text-slate-950'
                : ''
            "
            :aria-pressed="ui.theme === 'light'"
            @click="ui.setTheme('light')"
          >
            Claro
          </button>
          <button
            type="button"
            class="px-4 py-2"
            :class="
              ui.theme === 'dark'
                ? 'bg-indigo-600 text-white dark:bg-indigo-400 dark:text-slate-950'
                : ''
            "
            :aria-pressed="ui.theme === 'dark'"
            @click="ui.setTheme('dark')"
          >
            Escuro
          </button>
        </div>
      </section>
    </div>
  </div>
</template>
