<script setup lang="ts">
import type { TopicStatus } from '@/api/types'
import { topicStatusLabels } from '@/lib/labels'

defineProps<{ status: TopicStatus }>()

const icons: Record<TopicStatus, string> = {
  not_started: '○',
  studying: '◐',
  completed: '✓',
}

const classes: Record<TopicStatus, string> = {
  not_started: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  studying: 'bg-indigo-100 text-indigo-900 dark:bg-indigo-950 dark:text-indigo-200',
  completed: 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200',
}
</script>

<template>
  <span
    class="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium"
    :class="classes[status]"
  >
    <span aria-hidden="true">{{ icons[status] }}</span>
    {{ topicStatusLabels[status] }}
  </span>
</template>
