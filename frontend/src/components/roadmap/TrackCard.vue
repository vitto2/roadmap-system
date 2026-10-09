<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import type { CareerLevel, TopicSummary, TrackSummary } from '@/api/types'
import ProgressBar from '@/components/common/ProgressBar.vue'
import StatusBadge from '@/components/common/StatusBadge.vue'
import { CAREER_LEVELS, careerLabels } from '@/lib/labels'

const props = defineProps<{
  track: TrackSummary
  /** Todos os tópicos da trilha (para o resumo por nível). */
  topics: TopicSummary[]
  /** Tópicos que passam pelos filtros ativos. */
  matching: TopicSummary[]
  filtersActive: boolean
}>()

const PREVIEW_LIMIT = 5

const levelStats = computed(() =>
  CAREER_LEVELS.map((level: CareerLevel) => {
    const all = props.topics.filter((t) => t.careerLevel === level)
    return { level, total: all.length, done: all.filter((t) => t.status === 'completed').length }
  }).filter((s) => s.total > 0),
)

const preview = computed(() => props.matching.slice(0, PREVIEW_LIMIT))
</script>

<template>
  <article class="card flex flex-col p-5">
    <header class="flex items-start justify-between gap-3">
      <h2 class="text-lg font-semibold leading-snug">
        <RouterLink
          :to="{ name: 'track', params: { slug: track.slug } }"
          class="hover:text-indigo-700 hover:underline dark:hover:text-indigo-300"
        >
          {{ track.title }}
        </RouterLink>
      </h2>
      <span
        v-if="!track.required"
        class="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-300"
        title="Não conta para o nível de carreira"
      >
        Opcional
      </span>
    </header>

    <p class="muted mt-1 text-sm">{{ track.description }}</p>

    <div class="mt-4">
      <div class="mb-1 flex justify-between text-xs">
        <span class="font-medium"
          >{{ track.completedTopics }} de {{ track.totalTopics }} tópicos</span
        >
        <span class="muted tabular-nums">{{ track.percent }}%</span>
      </div>
      <ProgressBar :percent="track.percent" :label="`Progresso em ${track.title}`" tone="emerald" />
      <p class="muted mt-1 text-xs tabular-nums">{{ track.earnedXp }} / {{ track.totalXp }} XP</p>
    </div>

    <ul v-if="!filtersActive" class="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-xs">
      <li v-for="stat in levelStats" :key="stat.level" class="muted">
        <span class="font-medium text-slate-800 dark:text-slate-200">{{
          careerLabels[stat.level]
        }}</span>
        {{ stat.done }}/{{ stat.total }}
      </li>
    </ul>

    <div v-else class="mt-4">
      <p class="muted mb-1 text-xs">
        {{ matching.length }}
        {{ matching.length === 1 ? 'tópico corresponde' : 'tópicos correspondem' }}
        aos filtros
      </p>
      <ul class="space-y-1">
        <li
          v-for="topic in preview"
          :key="topic.slug"
          class="flex items-center justify-between gap-2 text-sm"
        >
          <RouterLink
            :to="{ name: 'topic', params: { slug: topic.slug } }"
            class="truncate hover:text-indigo-700 hover:underline dark:hover:text-indigo-300"
          >
            {{ topic.title }}
          </RouterLink>
          <StatusBadge :status="topic.status" />
        </li>
      </ul>
      <p v-if="matching.length > PREVIEW_LIMIT" class="muted mt-1 text-xs">
        +{{ matching.length - PREVIEW_LIMIT }} outros
      </p>
    </div>

    <footer class="mt-auto pt-4">
      <RouterLink
        :to="{ name: 'track', params: { slug: track.slug } }"
        class="btn btn-secondary w-full"
      >
        Abrir trilha
      </RouterLink>
    </footer>
  </article>
</template>
