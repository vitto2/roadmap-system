<script setup lang="ts">
withDefaults(defineProps<{ message?: string }>(), { message: 'Carregando…' })
</script>

<template>
  <div
    role="status"
    class="flex items-center justify-center gap-3 py-16 text-sm text-slate-600 dark:text-slate-400"
  >
    <span
      class="h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-indigo-600 dark:border-slate-700 dark:border-t-indigo-400"
      aria-hidden="true"
    />
    {{ message }}
  </div>
</template>
