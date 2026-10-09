<script setup lang="ts">
import { computed } from 'vue'
import { Handle, Position } from '@vue-flow/core'
import type { CareerLevel, TopicStatus } from '@/api/types'
import { careerLabels } from '@/lib/labels'

const props = defineProps<{
  data: {
    title: string
    status: TopicStatus
    unlocked: boolean
    careerLevel: CareerLevel
  }
}>()

const state = computed(() => {
  if (props.data.status === 'completed') return 'completed'
  if (props.data.status === 'studying') return 'studying'
  return props.data.unlocked ? 'unlocked' : 'blocked'
})

const classes = {
  completed:
    'border-emerald-500 bg-emerald-50 text-emerald-950 dark:border-emerald-400 dark:bg-emerald-950 dark:text-emerald-50',
  studying:
    'border-indigo-500 bg-indigo-50 text-indigo-950 dark:border-indigo-400 dark:bg-indigo-950 dark:text-indigo-50',
  unlocked:
    'border-slate-400 bg-white text-slate-900 dark:border-slate-500 dark:bg-slate-900 dark:text-slate-50',
  blocked:
    'border-dashed border-slate-400 bg-slate-100 text-slate-600 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300',
} as const

const icons = { completed: '✓', studying: '◐', unlocked: '○', blocked: '🔒' } as const
const labels = {
  completed: 'concluído',
  studying: 'estudando',
  unlocked: 'desbloqueado',
  blocked: 'bloqueado (recomendado estudar os pré-requisitos antes)',
} as const
</script>

<template>
  <div
    class="flex h-[58px] w-[220px] items-center gap-2 rounded-lg border-2 px-3 text-left shadow-sm"
    :class="classes[state]"
    :title="`${data.title} — ${labels[state]}`"
  >
    <Handle type="target" :position="Position.Left" />
    <span aria-hidden="true" class="shrink-0 text-base">{{ icons[state] }}</span>
    <div class="min-w-0">
      <p class="line-clamp-2 text-xs font-semibold leading-tight">{{ data.title }}</p>
      <p class="mt-0.5 text-[10px] opacity-80">{{ careerLabels[data.careerLevel] }}</p>
    </div>
    <Handle type="source" :position="Position.Right" />
  </div>
</template>
