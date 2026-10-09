<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import type { StudySessionInput } from '@/api/types'
import EmptyState from '@/components/common/EmptyState.vue'
import ErrorState from '@/components/common/ErrorState.vue'
import LoadingState from '@/components/common/LoadingState.vue'
import ProgressBar from '@/components/common/ProgressBar.vue'
import SessionForm from '@/components/journal/SessionForm.vue'
import { formatCalendarDate, formatMinutes } from '@/lib/labels'
import { useJournalStore } from '@/stores/journal'
import { useProfileStore } from '@/stores/profile'
import { useRoadmapStore } from '@/stores/roadmap'

const journal = useJournalStore()
const profileStore = useProfileStore()
const roadmap = useRoadmapStore()

const editingId = ref<number | null>(null)

onMounted(() => {
  journal.load()
  roadmap.ensureLoaded()
})

const streak = computed(() => profileStore.profile?.streak)
const goalPercent = computed(() =>
  streak.value && streak.value.weeklyGoal > 0
    ? Math.min(100, Math.round((streak.value.weeklySessions / streak.value.weeklyGoal) * 100))
    : 0,
)

async function create(input: StudySessionInput) {
  await journal.create(input)
}

async function update(id: number, input: StudySessionInput) {
  if (await journal.update(id, input)) editingId.value = null
}

async function remove(id: number) {
  if (window.confirm('Remover esta sessão do diário?')) await journal.remove(id)
}
</script>

<template>
  <div>
    <div class="mb-6">
      <h1 class="text-2xl font-bold tracking-tight">Diário de estudo</h1>
      <p class="muted mt-1 text-sm">
        Registre cada sessão para manter o streak e bater a meta semanal. Quebrar o streak nunca
        tira XP.
      </p>
    </div>

    <div v-if="streak" class="mb-6 grid gap-4 sm:grid-cols-3">
      <div class="card p-4">
        <p class="muted text-xs font-semibold uppercase tracking-wide">Streak atual</p>
        <p class="mt-1 text-2xl font-bold tabular-nums">
          <span aria-hidden="true">🔥</span> {{ streak.current }}
          <span class="text-base font-medium">{{ streak.current === 1 ? 'dia' : 'dias' }}</span>
        </p>
        <p class="muted text-xs">Maior sequência: {{ streak.longest }}</p>
      </div>
      <div class="card p-4 sm:col-span-2">
        <p class="muted text-xs font-semibold uppercase tracking-wide">Meta da semana</p>
        <p class="mt-1 text-2xl font-bold tabular-nums">
          {{ streak.weeklySessions }}
          <span class="text-base font-medium">de {{ streak.weeklyGoal }} sessões</span>
        </p>
        <ProgressBar
          class="mt-2"
          :percent="goalPercent"
          label="Meta semanal de sessões"
          tone="emerald"
        />
      </div>
    </div>

    <section class="card mb-6 p-5" aria-labelledby="new-session-title">
      <h2 id="new-session-title" class="mb-3 text-lg font-semibold">Nova sessão</h2>
      <SessionForm :topics="roadmap.topics" :saving="journal.saving" @submit="create" />
    </section>

    <h2 class="mb-3 text-lg font-semibold">Histórico</h2>
    <LoadingState
      v-if="journal.loading && journal.sessions.length === 0"
      message="Carregando diário…"
    />
    <ErrorState
      v-else-if="journal.error && journal.sessions.length === 0"
      :message="journal.error"
      @retry="journal.load()"
    />
    <EmptyState
      v-else-if="journal.sessions.length === 0"
      title="Nenhuma sessão registrada"
      description="Registre sua primeira sessão de estudo acima."
    />

    <template v-else>
      <ul class="card divide-y divide-slate-200 dark:divide-slate-800">
        <li v-for="session in journal.sessions" :key="session.id" class="px-4 py-3">
          <SessionForm
            v-if="editingId === session.id"
            :topics="roadmap.topics"
            :initial="session"
            :saving="journal.saving"
            @submit="(input) => update(session.id, input)"
            @cancel="editingId = null"
          />
          <div v-else class="flex flex-wrap items-start justify-between gap-3">
            <div class="min-w-0 flex-1 basis-60">
              <p class="font-medium">
                {{ formatCalendarDate(session.studiedOn) }}
                <span class="muted font-normal"
                  >· {{ formatMinutes(session.durationMinutes) }}</span
                >
              </p>
              <p v-if="session.topic" class="text-sm">
                <RouterLink
                  :to="{ name: 'topic', params: { slug: session.topic.slug } }"
                  class="text-indigo-700 underline dark:text-indigo-300"
                >
                  {{ session.topic.title }}
                </RouterLink>
              </p>
              <p v-if="session.note" class="muted mt-0.5 text-sm">{{ session.note }}</p>
            </div>
            <div class="flex gap-1">
              <button
                type="button"
                class="btn btn-ghost !px-2 !py-1 text-xs"
                @click="editingId = session.id"
              >
                Editar
              </button>
              <button
                type="button"
                class="btn btn-ghost !px-2 !py-1 text-xs text-red-700 dark:text-red-300"
                @click="remove(session.id)"
              >
                Remover
              </button>
            </div>
          </div>
        </li>
      </ul>
      <div v-if="journal.hasMore" class="mt-4 flex justify-center">
        <button
          type="button"
          class="btn btn-secondary"
          :disabled="journal.loading"
          @click="journal.loadMore()"
        >
          Carregar mais
        </button>
      </div>
    </template>
  </div>
</template>
