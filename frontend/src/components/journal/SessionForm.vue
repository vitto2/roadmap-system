<script setup lang="ts">
import { computed, ref } from 'vue'
import type { StudySession, StudySessionInput, TopicSummary } from '@/api/types'

const props = defineProps<{
  topics: TopicSummary[]
  initial?: StudySession
  saving?: boolean
}>()

const emit = defineEmits<{ submit: [input: StudySessionInput]; cancel: [] }>()

const studiedOn = ref(props.initial?.studiedOn ?? '')
const duration = ref<number | null>(props.initial?.durationMinutes ?? 30)
const topicSlug = ref(props.initial?.topic?.slug ?? '')
const note = ref(props.initial?.note ?? '')

const valid = computed(
  () => duration.value !== null && duration.value >= 1 && duration.value <= 1440,
)

const groups = computed(() => {
  const map = new Map<string, TopicSummary[]>()
  for (const t of props.topics) {
    const list = map.get(t.trackTitle) ?? []
    list.push(t)
    map.set(t.trackTitle, list)
  }
  return [...map.entries()]
})

const idSuffix = props.initial ? `-${props.initial.id}` : '-novo'

function submit() {
  if (!valid.value || duration.value === null) return
  emit('submit', {
    ...(studiedOn.value ? { studiedOn: studiedOn.value } : {}),
    durationMinutes: duration.value,
    topicSlug: topicSlug.value || null,
    note: note.value.trim(),
  })
  if (!props.initial) {
    note.value = ''
  }
}
</script>

<template>
  <form class="grid gap-3 sm:grid-cols-2" @submit.prevent="submit">
    <div>
      <label :for="`date${idSuffix}`" class="label">Data</label>
      <input :id="`date${idSuffix}`" v-model="studiedOn" type="date" class="input" />
      <p class="muted mt-1 text-xs">Em branco = hoje.</p>
    </div>
    <div>
      <label :for="`duration${idSuffix}`" class="label">Duração (minutos)</label>
      <input
        :id="`duration${idSuffix}`"
        v-model.number="duration"
        type="number"
        min="1"
        max="1440"
        step="5"
        class="input"
        required
      />
    </div>
    <div class="sm:col-span-2">
      <label :for="`topic${idSuffix}`" class="label">Tópico (opcional)</label>
      <select :id="`topic${idSuffix}`" v-model="topicSlug" class="input">
        <option value="">Sem tópico específico</option>
        <optgroup v-for="[track, list] in groups" :key="track" :label="track">
          <option v-for="t in list" :key="t.slug" :value="t.slug">{{ t.title }}</option>
        </optgroup>
      </select>
    </div>
    <div class="sm:col-span-2">
      <label :for="`note${idSuffix}`" class="label">Nota curta (opcional)</label>
      <input
        :id="`note${idSuffix}`"
        v-model="note"
        type="text"
        maxlength="500"
        class="input"
        placeholder="O que você estudou ou praticou?"
      />
    </div>
    <div class="flex gap-2 sm:col-span-2">
      <button type="submit" class="btn btn-primary" :disabled="!valid || saving">
        {{ initial ? 'Salvar alterações' : 'Registrar sessão' }}
      </button>
      <button v-if="initial" type="button" class="btn btn-ghost" @click="emit('cancel')">
        Cancelar
      </button>
    </div>
  </form>
</template>
