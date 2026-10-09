<script setup lang="ts">
defineProps<{ title: string; description?: string }>()
</script>

<template>
  <div
    class="mx-auto my-10 max-w-lg rounded-xl border border-dashed border-slate-300 p-8 text-center dark:border-slate-700"
  >
    <h2 class="text-base font-semibold">{{ title }}</h2>
    <p v-if="description" class="muted mt-1 text-sm">{{ description }}</p>
    <div class="mt-4 flex justify-center"><slot /></div>
  </div>
</template>
