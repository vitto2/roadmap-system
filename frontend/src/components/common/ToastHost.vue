<script setup lang="ts">
import { useUiStore, type ToastKind } from '@/stores/ui'

const ui = useUiStore()

const classes: Record<ToastKind, string> = {
  success:
    'border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-100',
  info: 'border-slate-300 bg-white text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100',
  error:
    'border-red-300 bg-red-50 text-red-900 dark:border-red-800 dark:bg-red-950 dark:text-red-100',
}
</script>

<template>
  <div
    class="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex flex-col items-center gap-2 px-4 sm:items-end sm:pr-6"
    aria-live="polite"
  >
    <TransitionGroup name="toast">
      <div
        v-for="toast in ui.toasts"
        :key="toast.id"
        class="pointer-events-auto flex items-center gap-3 rounded-lg border px-4 py-2 text-sm font-medium shadow-lg"
        :class="classes[toast.kind]"
        :role="toast.kind === 'error' ? 'alert' : 'status'"
      >
        <span>{{ toast.message }}</span>
        <button
          type="button"
          class="rounded px-1 text-lg leading-none opacity-70 hover:opacity-100"
          aria-label="Fechar aviso"
          @click="ui.dismissToast(toast.id)"
        >
          ×
        </button>
      </div>
    </TransitionGroup>
  </div>
</template>

<style scoped>
.toast-enter-active,
.toast-leave-active {
  transition:
    opacity 0.2s,
    transform 0.2s;
}
.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateY(8px);
}
</style>
