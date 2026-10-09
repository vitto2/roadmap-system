<script setup lang="ts">
import { computed } from 'vue'
import type { TopicDetail } from '@/api/types'
import StatusBadge from '@/components/common/StatusBadge.vue'
import { formatInstant } from '@/lib/labels'

const props = defineProps<{ topic: TopicDetail; busy: boolean }>()

defineEmits<{
  complete: []
  master: []
  reopen: []
  'set-status': [status: 'not_started' | 'studying']
}>()

const allChecked = computed(() => props.topic.checklistChecked >= props.topic.checklistTotal)

const segment = (active: boolean) =>
  active
    ? 'bg-indigo-600 text-white dark:bg-indigo-400 dark:text-slate-950'
    : 'bg-white text-slate-700 hover:bg-slate-100 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800'
</script>

<template>
  <section class="card space-y-3 p-4" aria-labelledby="actions-title">
    <div class="flex items-center justify-between gap-2">
      <h2 id="actions-title" class="text-base font-semibold">Progresso</h2>
      <StatusBadge :status="topic.status" />
    </div>

    <template v-if="topic.status !== 'completed'">
      <button
        type="button"
        class="btn btn-primary w-full"
        :disabled="busy || !allChecked"
        @click="$emit('complete')"
      >
        Concluir tópico (+{{ topic.xp }} XP)
      </button>
      <p v-if="!allChecked" class="muted text-xs">
        Marque todos os itens do checklist para concluir.
      </p>

      <button
        type="button"
        class="btn btn-secondary w-full"
        :disabled="busy"
        @click="$emit('master')"
      >
        Já domino
      </button>
      <p class="muted text-xs">
        Marca o checklist inteiro e conclui de uma vez. Agenda apenas a revisão de 90 dias.
      </p>

      <div
        role="group"
        aria-label="Status de estudo"
        class="grid grid-cols-2 overflow-hidden rounded-lg border border-slate-300 text-sm font-medium dark:border-slate-700"
      >
        <button
          type="button"
          :class="segment(topic.status === 'not_started')"
          :aria-pressed="topic.status === 'not_started'"
          :disabled="busy"
          class="px-3 py-2"
          @click="$emit('set-status', 'not_started')"
        >
          Não iniciado
        </button>
        <button
          type="button"
          :class="segment(topic.status === 'studying')"
          :aria-pressed="topic.status === 'studying'"
          :disabled="busy"
          class="px-3 py-2"
          @click="$emit('set-status', 'studying')"
        >
          Estudando
        </button>
      </div>
    </template>

    <template v-else>
      <p class="text-sm">
        Concluído<span v-if="topic.completedAt"> em {{ formatInstant(topic.completedAt) }}</span
        >.
        <span v-if="topic.masteredDirectly" class="muted">Marcado como “Já domino”.</span>
      </p>
      <button
        type="button"
        class="btn btn-secondary w-full"
        :disabled="busy"
        @click="$emit('reopen')"
      >
        Reabrir tópico
      </button>
      <p class="muted text-xs">Reabrir desfaz o XP do tópico e cancela as revisões agendadas.</p>
    </template>
  </section>
</template>
