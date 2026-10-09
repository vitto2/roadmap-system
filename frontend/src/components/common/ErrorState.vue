<script setup lang="ts">
withDefaults(defineProps<{ message: string; title?: string; retryable?: boolean }>(), {
  title: 'Algo deu errado',
  retryable: true,
})

defineEmits<{ retry: [] }>()
</script>

<template>
  <div
    role="alert"
    class="mx-auto my-10 max-w-lg rounded-xl border border-red-200 bg-red-50 p-6 text-center dark:border-red-900 dark:bg-red-950/40"
  >
    <h2 class="text-base font-semibold text-red-900 dark:text-red-200">{{ title }}</h2>
    <p class="mt-1 text-sm text-red-800 dark:text-red-300">{{ message }}</p>
    <button v-if="retryable" type="button" class="btn btn-secondary mt-4" @click="$emit('retry')">
      Tentar novamente
    </button>
  </div>
</template>
