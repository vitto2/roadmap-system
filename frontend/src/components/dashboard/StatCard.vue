<script setup lang="ts">
defineProps<{ label: string; value: string; hint?: string }>()
</script>

<template>
  <div class="card p-4">
    <p class="muted text-xs font-semibold uppercase tracking-wide">{{ label }}</p>
    <p class="mt-1 text-2xl font-bold tabular-nums">{{ value }}</p>
    <p v-if="hint" class="muted mt-0.5 text-xs">{{ hint }}</p>
    <slot />
  </div>
</template>
