<script setup lang="ts">
defineProps<{ value: number }>()
</script>

<template>
  <span
    class="inline-flex items-center gap-0.5"
    role="img"
    :aria-label="`Dificuldade ${value} de 5`"
  >
    <span
      v-for="n in 5"
      :key="n"
      class="h-2 w-2 rounded-full"
      :class="n <= value ? 'bg-amber-500 dark:bg-amber-400' : 'bg-slate-300 dark:bg-slate-700'"
    />
  </span>
</template>
