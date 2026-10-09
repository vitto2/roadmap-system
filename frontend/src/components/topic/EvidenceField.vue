<script setup lang="ts">
import { computed, ref, watch } from 'vue'

const props = defineProps<{ evidenceUrl: string | null; saving?: boolean }>()
const emit = defineEmits<{ save: [url: string | null] }>()

const value = ref(props.evidenceUrl ?? '')
watch(
  () => props.evidenceUrl,
  (next) => {
    value.value = next ?? ''
  },
)

const changed = computed(() => value.value.trim() !== (props.evidenceUrl ?? ''))

function submit() {
  emit('save', value.value.trim() === '' ? null : value.value.trim())
}
</script>

<template>
  <form class="card p-4" @submit.prevent="submit">
    <label for="evidence-url" class="label">Link de evidência (opcional)</label>
    <p class="muted mb-2 text-xs">
      Repositório, PR, deploy ou artigo que comprova o que você aprendeu.
    </p>
    <div class="flex gap-2">
      <input
        id="evidence-url"
        v-model="value"
        type="url"
        inputmode="url"
        class="input"
        placeholder="https://github.com/…"
        autocomplete="off"
      />
      <button type="submit" class="btn btn-secondary shrink-0" :disabled="!changed || saving">
        Salvar
      </button>
    </div>
    <a
      v-if="evidenceUrl"
      :href="evidenceUrl"
      target="_blank"
      rel="noopener noreferrer"
      class="mt-2 inline-block break-all text-sm text-indigo-700 underline dark:text-indigo-300"
    >
      Abrir evidência ↗
    </a>
  </form>
</template>
