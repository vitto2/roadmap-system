<script setup lang="ts">
import { computed } from 'vue'
import type { MilestoneEntry, MilestoneStatus } from '@/api/types'
import { formatInstant, milestoneStatusLabels } from '@/lib/labels'

const props = defineProps<{ milestone: MilestoneEntry; index: number; busy?: boolean }>()
defineEmits<{ 'set-status': [status: MilestoneStatus] }>()

const STATUSES: MilestoneStatus[] = ['pending', 'in_progress', 'completed']

const done = computed(() => props.milestone.status === 'completed')

const segment = (active: boolean) =>
  active
    ? 'bg-indigo-600 text-white dark:bg-indigo-400 dark:text-slate-950'
    : 'bg-white text-slate-700 hover:bg-slate-100 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800'
</script>

<template>
  <li class="card p-4" :class="done ? 'border-emerald-300 dark:border-emerald-800' : ''">
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div class="min-w-0 flex-1 basis-64">
        <h3 class="font-semibold">
          <span class="muted mr-1 tabular-nums">{{ index + 1 }}.</span>
          {{ milestone.title }}
        </h3>
        <p v-if="milestone.completedAt" class="muted mt-0.5 text-xs">
          Concluída em {{ formatInstant(milestone.completedAt) }}
        </p>
      </div>
      <span
        class="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold tabular-nums text-amber-900 dark:bg-amber-950 dark:text-amber-200"
      >
        {{ milestone.xp }} XP
      </span>
    </div>

    <div class="mt-3">
      <p class="muted text-xs font-semibold uppercase tracking-wide">Critérios de aceite</p>
      <ul class="mt-1 list-disc space-y-1 pl-5 text-sm">
        <li v-for="criterion in milestone.acceptanceCriteria" :key="criterion">{{ criterion }}</li>
      </ul>
    </div>

    <div
      role="group"
      :aria-label="`Status da etapa ${milestone.title}`"
      class="mt-4 grid grid-cols-3 overflow-hidden rounded-lg border border-slate-300 text-sm font-medium dark:border-slate-700"
    >
      <button
        v-for="status in STATUSES"
        :key="status"
        type="button"
        class="px-2 py-2"
        :class="segment(milestone.status === status)"
        :aria-pressed="milestone.status === status"
        :disabled="busy"
        @click="milestone.status !== status && $emit('set-status', status)"
      >
        {{ milestoneStatusLabels[status] }}
      </button>
    </div>
  </li>
</template>
