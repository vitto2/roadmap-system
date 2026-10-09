<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    percent: number
    label: string
    tone?: 'indigo' | 'emerald' | 'amber'
    size?: 'sm' | 'md'
  }>(),
  { tone: 'indigo', size: 'md' },
)

const clamped = computed(() => Math.min(100, Math.max(0, Math.round(props.percent))))

const toneClass = computed(
  () =>
    ({
      indigo: 'bg-indigo-600 dark:bg-indigo-400',
      emerald: 'bg-emerald-600 dark:bg-emerald-400',
      amber: 'bg-amber-500 dark:bg-amber-400',
    })[props.tone],
)
</script>

<template>
  <div
    role="progressbar"
    :aria-label="label"
    aria-valuemin="0"
    aria-valuemax="100"
    :aria-valuenow="clamped"
    class="w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800"
    :class="size === 'sm' ? 'h-1.5' : 'h-2.5'"
  >
    <div
      class="h-full rounded-full transition-[width] duration-500"
      :class="toneClass"
      :style="{ width: `${clamped}%` }"
    />
  </div>
</template>
