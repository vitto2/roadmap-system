<script setup lang="ts">
import type { CareerLevel, TopicStatus } from '@/api/types'
import { CAREER_LEVELS, TOPIC_STATUSES, careerLabels, topicStatusLabels } from '@/lib/labels'

defineProps<{
  level: CareerLevel | null
  status: TopicStatus | null
  active: boolean
}>()

defineEmits<{
  'update:level': [value: CareerLevel | null]
  'update:status': [value: TopicStatus | null]
  clear: []
}>()

const chip =
  'rounded-full border px-3 py-1 text-sm font-medium transition-colors border-slate-300 text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800'
const chipOn =
  '!border-indigo-600 !bg-indigo-600 !text-white hover:!bg-indigo-700 dark:!border-indigo-400 dark:!bg-indigo-400 dark:!text-slate-950'
</script>

<template>
  <section aria-label="Filtros" class="space-y-3">
    <fieldset>
      <legend class="muted mb-1 text-xs font-semibold uppercase tracking-wide">Nível</legend>
      <div class="flex flex-wrap gap-2">
        <button
          type="button"
          :class="[chip, level === null && chipOn]"
          :aria-pressed="level === null"
          @click="$emit('update:level', null)"
        >
          Todos
        </button>
        <button
          v-for="l in CAREER_LEVELS"
          :key="l"
          type="button"
          :class="[chip, level === l && chipOn]"
          :aria-pressed="level === l"
          @click="$emit('update:level', level === l ? null : l)"
        >
          {{ careerLabels[l] }}
        </button>
      </div>
    </fieldset>

    <fieldset>
      <legend class="muted mb-1 text-xs font-semibold uppercase tracking-wide">Status</legend>
      <div class="flex flex-wrap gap-2">
        <button
          type="button"
          :class="[chip, status === null && chipOn]"
          :aria-pressed="status === null"
          @click="$emit('update:status', null)"
        >
          Todos
        </button>
        <button
          v-for="s in TOPIC_STATUSES"
          :key="s"
          type="button"
          :class="[chip, status === s && chipOn]"
          :aria-pressed="status === s"
          @click="$emit('update:status', status === s ? null : s)"
        >
          {{ topicStatusLabels[s] }}
        </button>
      </div>
    </fieldset>

    <button
      v-if="active"
      type="button"
      class="btn btn-ghost !px-2 !py-1 text-xs"
      @click="$emit('clear')"
    >
      Limpar filtros
    </button>
  </section>
</template>
