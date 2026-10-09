<script setup lang="ts">
import { RouterLink } from 'vue-router'
import type { TopicSummary } from '@/api/types'
import DifficultyDots from '@/components/common/DifficultyDots.vue'
import StatusBadge from '@/components/common/StatusBadge.vue'

defineProps<{ topic: TopicSummary }>()
</script>

<template>
  <li class="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3">
    <div class="min-w-0 flex-1 basis-60">
      <RouterLink
        :to="{ name: 'topic', params: { slug: topic.slug } }"
        class="font-medium text-slate-900 hover:text-indigo-700 hover:underline dark:text-slate-100 dark:hover:text-indigo-300"
      >
        {{ topic.title }}
      </RouterLink>
      <p
        v-if="topic.status !== 'completed' && topic.recommendedFirst.length > 0"
        class="mt-0.5 text-xs text-amber-800 dark:text-amber-300"
      >
        Recomendado estudar antes:
        {{ topic.recommendedFirst.map((t) => t.title).join(', ') }}
      </p>
    </div>
    <DifficultyDots :value="topic.difficulty" />
    <span class="muted w-14 text-right text-xs tabular-nums">{{ topic.xp }} XP</span>
    <span
      class="muted w-12 text-right text-xs tabular-nums"
      :title="`${topic.checklistChecked} de ${topic.checklistTotal} itens do checklist`"
    >
      {{ topic.checklistChecked }}/{{ topic.checklistTotal }}
    </span>
    <StatusBadge :status="topic.status" />
  </li>
</template>
