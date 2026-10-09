<script setup lang="ts">
import { onMounted } from 'vue'
import type { ReviewScope } from '@/api/types'
import EmptyState from '@/components/common/EmptyState.vue'
import ErrorState from '@/components/common/ErrorState.vue'
import LoadingState from '@/components/common/LoadingState.vue'
import ReviewItem from '@/components/reviews/ReviewItem.vue'
import { reviewScopeLabels } from '@/lib/labels'
import { useReviewsStore } from '@/stores/reviews'

const store = useReviewsStore()
const scopes: ReviewScope[] = ['today', 'upcoming', 'completed']

onMounted(() => store.load('today'))

const emptyText: Record<string, { title: string; description: string }> = {
  today: {
    title: 'Nenhuma revisão para hoje',
    description:
      'Ao concluir um tópico, as revisões de 7, 30 e 90 dias são agendadas automaticamente.',
  },
  upcoming: {
    title: 'Nenhuma revisão agendada',
    description: 'Conclua tópicos para agendar revisões.',
  },
  completed: {
    title: 'Nenhuma revisão concluída ainda',
    description: 'As revisões feitas aparecem aqui.',
  },
}

const chip =
  'rounded-full border px-3 py-1 text-sm font-medium transition-colors border-slate-300 text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800'
const chipOn =
  '!border-indigo-600 !bg-indigo-600 !text-white hover:!bg-indigo-700 dark:!border-indigo-400 dark:!bg-indigo-400 dark:!text-slate-950'
</script>

<template>
  <div>
    <div class="mb-6">
      <h1 class="text-2xl font-bold tracking-tight">Revisões</h1>
      <p class="muted mt-1 text-sm">
        A revisão espaçada fixa o que você aprendeu. Cada revisão concluída rende 25% do XP do
        tópico.
      </p>
    </div>

    <div class="mb-6 flex flex-wrap gap-2" role="group" aria-label="Período">
      <button
        v-for="s in scopes"
        :key="s"
        type="button"
        :class="[chip, store.scope === s && chipOn]"
        :aria-pressed="store.scope === s"
        @click="store.load(s)"
      >
        {{ reviewScopeLabels[s] }}
        <span v-if="s === 'today' && store.dueCount > 0" class="ml-1 tabular-nums"
          >({{ store.dueCount }})</span
        >
      </button>
    </div>

    <LoadingState v-if="store.loading && store.items.length === 0" message="Carregando revisões…" />
    <ErrorState v-else-if="store.error" :message="store.error" @retry="store.load()" />
    <EmptyState
      v-else-if="store.items.length === 0"
      :title="emptyText[store.scope]?.title ?? 'Nada por aqui'"
      :description="emptyText[store.scope]?.description"
    />
    <ul v-else class="card divide-y divide-slate-200 dark:divide-slate-800">
      <ReviewItem
        v-for="review in store.items"
        :key="review.id"
        :review="review"
        :busy="store.busyId === review.id"
        @complete="store.complete(review.id)"
        @undo="store.undo(review.id)"
      />
    </ul>
  </div>
</template>
