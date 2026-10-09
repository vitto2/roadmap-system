<script setup lang="ts">
import type { TopicReview } from '@/api/types'
import { formatCalendarDate } from '@/lib/labels'

defineProps<{ reviews: TopicReview[] }>()
</script>

<template>
  <section class="card p-4" aria-labelledby="reviews-title">
    <h2 id="reviews-title" class="text-base font-semibold">Revisões espaçadas</h2>
    <p v-if="reviews.length === 0" class="muted mt-2 text-sm">
      As revisões (7, 30 e 90 dias) são agendadas quando você conclui o tópico.
    </p>
    <ul v-else class="mt-2 space-y-1.5 text-sm">
      <li
        v-for="review in reviews"
        :key="review.id"
        class="flex items-center justify-between gap-2"
      >
        <span>{{ review.intervalDays }} dias · {{ formatCalendarDate(review.dueOn) }}</span>
        <span
          class="rounded-full px-2 py-0.5 text-xs font-medium"
          :class="
            review.completedAt
              ? 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200'
              : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
          "
        >
          {{ review.completedAt ? 'Feita' : 'Agendada' }}
        </span>
      </li>
    </ul>
  </section>
</template>
