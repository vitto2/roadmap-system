<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useDebouncedFn } from '@/composables/useDebouncedFn'
import { renderMarkdown } from '@/composables/useMarkdown'

const props = defineProps<{ notes: string; saving?: boolean }>()
const emit = defineEmits<{ save: [notes: string] }>()

const draft = ref(props.notes)
const tab = ref<'write' | 'preview'>('write')

const dirty = computed(() => draft.value !== props.notes)
const html = computed(() => renderMarkdown(draft.value))

const autosave = useDebouncedFn((value: string) => emit('save', value), 1000)

function onInput() {
  autosave.run(draft.value)
}

// Atualiza o rascunho quando o servidor devolve outro valor, sem sobrescrever o que está sendo digitado.
watch(
  () => props.notes,
  (next) => {
    if (!dirty.value || next === draft.value) draft.value = next
  },
)

const statusText = computed(() => {
  if (props.saving) return 'Salvando…'
  if (dirty.value) return 'Alterações não salvas'
  return 'Salvo'
})

const tabClass = (active: boolean) =>
  active
    ? 'border-b-2 border-indigo-600 text-indigo-700 dark:border-indigo-400 dark:text-indigo-300'
    : 'border-b-2 border-transparent text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
</script>

<template>
  <section class="card p-5" aria-labelledby="notes-title">
    <div class="flex flex-wrap items-center justify-between gap-2">
      <h2 id="notes-title" class="text-lg font-semibold">Minhas notas</h2>
      <span class="muted text-xs" role="status" data-testid="notes-status">{{ statusText }}</span>
    </div>

    <div
      class="mt-3 flex gap-4 border-b border-slate-200 dark:border-slate-800"
      role="tablist"
      aria-label="Modo das notas"
    >
      <button
        id="tab-write"
        type="button"
        role="tab"
        class="px-1 pb-2 text-sm font-medium"
        :class="tabClass(tab === 'write')"
        :aria-selected="tab === 'write'"
        aria-controls="panel-notes"
        @click="tab = 'write'"
      >
        Escrever
      </button>
      <button
        id="tab-preview"
        type="button"
        role="tab"
        class="px-1 pb-2 text-sm font-medium"
        :class="tabClass(tab === 'preview')"
        :aria-selected="tab === 'preview'"
        aria-controls="panel-notes"
        @click="tab = 'preview'"
      >
        Visualizar
      </button>
    </div>

    <div
      id="panel-notes"
      role="tabpanel"
      :aria-labelledby="tab === 'write' ? 'tab-write' : 'tab-preview'"
      class="mt-3"
    >
      <template v-if="tab === 'write'">
        <label for="notes-input" class="sr-only">Notas em markdown</label>
        <textarea
          id="notes-input"
          v-model="draft"
          class="input min-h-48 font-mono"
          rows="8"
          maxlength="20000"
          placeholder="Escreva em markdown: títulos, listas, `código`, links…"
          @input="onInput"
          @blur="autosave.flush()"
        />
      </template>
      <!-- eslint-disable-next-line vue/no-v-html -- sanitizado com DOMPurify em renderMarkdown -->
      <div
        v-else-if="draft.trim()"
        class="markdown-body"
        data-testid="notes-preview"
        v-html="html"
      />
      <p v-else class="muted text-sm">Nada para visualizar ainda.</p>
    </div>
  </section>
</template>
