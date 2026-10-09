<script setup lang="ts">
import { computed, ref, watch } from 'vue'

const props = defineProps<{
  repositoryUrl: string | null
  deployUrl: string | null
  saving?: boolean
}>()

const emit = defineEmits<{
  save: [links: { repositoryUrl: string | null; deployUrl: string | null }]
}>()

const repository = ref(props.repositoryUrl ?? '')
const deploy = ref(props.deployUrl ?? '')

watch(
  () => [props.repositoryUrl, props.deployUrl] as const,
  ([repo, dep]) => {
    repository.value = repo ?? ''
    deploy.value = dep ?? ''
  },
)

const changed = computed(
  () =>
    repository.value.trim() !== (props.repositoryUrl ?? '') ||
    deploy.value.trim() !== (props.deployUrl ?? ''),
)

function submit() {
  emit('save', {
    repositoryUrl: repository.value.trim() || null,
    deployUrl: deploy.value.trim() || null,
  })
}
</script>

<template>
  <form class="card space-y-3 p-4" @submit.prevent="submit">
    <h2 class="text-base font-semibold">Links do projeto</h2>
    <div>
      <label for="repo-url" class="label">Repositório (+50 XP ao finalizar)</label>
      <input
        id="repo-url"
        v-model="repository"
        type="url"
        inputmode="url"
        class="input"
        placeholder="https://github.com/usuario/projeto"
        autocomplete="off"
      />
    </div>
    <div>
      <label for="deploy-url" class="label">Deploy (+50 XP ao finalizar)</label>
      <input
        id="deploy-url"
        v-model="deploy"
        type="url"
        inputmode="url"
        class="input"
        placeholder="https://meu-projeto.exemplo.com"
        autocomplete="off"
      />
    </div>
    <button type="submit" class="btn btn-secondary w-full" :disabled="!changed || saving">
      Salvar links
    </button>
  </form>
</template>
