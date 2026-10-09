<script setup lang="ts">
import { RouterLink } from 'vue-router'
import type { ProjectSummary } from '@/api/types'
import DifficultyDots from '@/components/common/DifficultyDots.vue'
import LevelBadge from '@/components/common/LevelBadge.vue'
import ProgressBar from '@/components/common/ProgressBar.vue'
import ProjectStatusBadge from './ProjectStatusBadge.vue'

const props = defineProps<{ project: ProjectSummary }>()

const percent = () =>
  props.project.milestonesTotal === 0
    ? 0
    : Math.floor((props.project.milestonesCompleted / props.project.milestonesTotal) * 100)
</script>

<template>
  <article class="card flex flex-col p-5">
    <header class="flex items-start justify-between gap-3">
      <h2 class="text-lg font-semibold leading-snug">
        <RouterLink
          :to="{ name: 'project', params: { slug: project.slug } }"
          class="hover:text-indigo-700 hover:underline dark:hover:text-indigo-300"
        >
          {{ project.title }}
        </RouterLink>
      </h2>
      <ProjectStatusBadge :status="project.status" class="shrink-0" />
    </header>

    <div class="mt-2 flex flex-wrap items-center gap-3 text-sm">
      <LevelBadge :level="project.careerLevel" />
      <DifficultyDots :value="project.difficulty" />
    </div>

    <p class="muted mt-3 text-sm">{{ project.description }}</p>

    <div class="mt-4">
      <div class="mb-1 flex justify-between text-xs">
        <span class="font-medium">
          {{ project.milestonesCompleted }} de {{ project.milestonesTotal }} etapas
        </span>
        <span class="muted tabular-nums">{{ project.earnedXp }} / {{ project.totalXp }} XP</span>
      </div>
      <ProgressBar
        :percent="percent()"
        :label="`Progresso em ${project.title}`"
        tone="emerald"
        size="sm"
      />
    </div>

    <footer class="mt-auto pt-4">
      <RouterLink
        :to="{ name: 'project', params: { slug: project.slug } }"
        class="btn btn-secondary w-full"
      >
        Abrir projeto
      </RouterLink>
    </footer>
  </article>
</template>
