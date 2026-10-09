<script setup lang="ts">
import type { CareerLevel } from '@/api/types'
import { careerClasses, careerLabels } from '@/lib/labels'

defineProps<{ level: CareerLevel }>()
</script>

<template>
  <span
    class="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium"
    :class="careerClasses[level]"
  >
    {{ careerLabels[level] }}
  </span>
</template>
