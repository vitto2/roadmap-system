<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import type { CareerLevel } from '@/api/types'
import EmptyState from '@/components/common/EmptyState.vue'
import ErrorState from '@/components/common/ErrorState.vue'
import LoadingState from '@/components/common/LoadingState.vue'
import ProjectCard from '@/components/projects/ProjectCard.vue'
import { CAREER_LEVELS, careerLabels } from '@/lib/labels'
import { useProjectsStore } from '@/stores/projects'

const store = useProjectsStore()
const level = ref<CareerLevel | null>(null)

onMounted(() => {
  if (!store.listLoaded) store.loadList()
})

const visible = computed(() =>
  store.projects.filter((p) => level.value === null || p.careerLevel === level.value),
)

const chip =
  'rounded-full border px-3 py-1 text-sm font-medium transition-colors border-slate-300 text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800'
const chipOn =
  '!border-indigo-600 !bg-indigo-600 !text-white hover:!bg-indigo-700 dark:!border-indigo-400 dark:!bg-indigo-400 dark:!text-slate-950'
</script>

<template>
  <div>
    <div class="mb-6">
      <h1 class="text-2xl font-bold tracking-tight">Projetos desafio</h1>
      <p class="muted mt-1 text-sm">
        Coloque o que aprendeu em prática. Cada etapa concluída rende XP; finalizar o projeto rende
        bônus, e links de repositório e deploy rendem ainda mais.
      </p>
    </div>

    <LoadingState
      v-if="store.listLoading && store.projects.length === 0"
      message="Carregando projetos…"
    />
    <ErrorState
      v-else-if="store.listError && store.projects.length === 0"
      :message="store.listError"
      @retry="store.loadList()"
    />
    <EmptyState
      v-else-if="store.projects.length === 0"
      title="Nenhum projeto cadastrado"
      description="Adicione projetos em backend/database/seed-data/projects e rode: npm run db:seed"
    />

    <template v-else>
      <div class="mb-6 flex flex-wrap gap-2" role="group" aria-label="Filtrar por nível">
        <button
          type="button"
          :class="[chip, level === null && chipOn]"
          :aria-pressed="level === null"
          @click="level = null"
        >
          Todos
        </button>
        <button
          v-for="l in CAREER_LEVELS"
          :key="l"
          type="button"
          :class="[chip, level === l && chipOn]"
          :aria-pressed="level === l"
          @click="level = level === l ? null : l"
        >
          {{ careerLabels[l] }}
        </button>
      </div>

      <EmptyState v-if="visible.length === 0" title="Nenhum projeto neste nível" />
      <ul v-else class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <li v-for="project in visible" :key="project.slug" class="contents">
          <ProjectCard :project="project" />
        </li>
      </ul>
    </template>
  </div>
</template>
