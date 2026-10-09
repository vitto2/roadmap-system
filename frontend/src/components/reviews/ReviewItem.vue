<script setup lang="ts">
import { RouterLink } from 'vue-router'
import type { Review } from '@/api/types'
import { formatCalendarDate, formatInstant } from '@/lib/labels'

defineProps<{ review: Review; busy?: boolean }>()
defineEmits<{ complete: []; undo: [] }>()
</script>

<template>
  <li class="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
    <div class="min-w-0 flex-1 basis-60">
      <RouterLink
        :to="{ name: 'topic', params: { slug: review.topic.slug } }"
        class="font-medium hover:text-indigo-700 hover:underline dark:hover:text-indigo-300"
      >
        {{ review.topic.title }}
      </RouterLink>
      <p class="muted mt-0.5 text-xs">
        Revisão de {{ review.intervalDays }} dias ·
        <template v-if="review.completedAt"
          >feita em {{ formatInstant(review.completedAt) }}</template
        >
        <template v-else>prevista para {{ formatCalendarDate(review.dueOn) }}</template>
      </p>
    </div>

    <span
      v-if="review.overdue"
      class="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-900 dark:bg-red-950 dark:text-red-200"
    >
      Atrasada
    </span>
    <span class="muted text-xs tabular-nums">+{{ review.xp }} XP</span>

    <button
      v-if="!review.completedAt"
      type="button"
      class="btn btn-primary"
      :disabled="busy"
      @click="$emit('complete')"
    >
      Concluir revisão
    </button>
    <button v-else type="button" class="btn btn-ghost" :disabled="busy" @click="$emit('undo')">
      Desfazer
    </button>
  </li>
</template>
