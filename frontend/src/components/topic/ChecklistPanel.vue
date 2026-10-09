<script setup lang="ts">
import { computed } from 'vue'
import type { ChecklistEntry } from '@/api/types'
import ProgressBar from '@/components/common/ProgressBar.vue'

const props = defineProps<{ items: ChecklistEntry[]; disabled?: boolean }>()

defineEmits<{ toggle: [key: string, checked: boolean] }>()

const checked = computed(() => props.items.filter((i) => i.checked).length)
const percent = computed(() =>
  props.items.length === 0 ? 0 : Math.round((checked.value / props.items.length) * 100),
)
</script>

<template>
  <section class="card p-5" aria-labelledby="checklist-title">
    <div class="flex items-baseline justify-between gap-3">
      <h2 id="checklist-title" class="text-lg font-semibold">Como sei que dominei</h2>
      <span class="muted text-sm tabular-nums" data-testid="checklist-count">
        {{ checked }} de {{ items.length }}
      </span>
    </div>
    <ProgressBar
      class="mt-2"
      :percent="percent"
      label="Itens do checklist marcados"
      tone="emerald"
      size="sm"
    />

    <ul class="mt-4 space-y-1">
      <li v-for="item in items" :key="item.key">
        <label
          class="flex cursor-pointer items-start gap-3 rounded-lg p-2 hover:bg-slate-100 dark:hover:bg-slate-800/60"
        >
          <input
            type="checkbox"
            class="mt-0.5 h-5 w-5 shrink-0 cursor-pointer accent-indigo-600"
            :checked="item.checked"
            :disabled="disabled"
            @change="$emit('toggle', item.key, ($event.target as HTMLInputElement).checked)"
          />
          <span class="text-sm" :class="item.checked ? 'text-slate-600 dark:text-slate-400' : ''">
            {{ item.text }}
          </span>
        </label>
      </li>
    </ul>
  </section>
</template>
