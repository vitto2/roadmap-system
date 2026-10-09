<script setup lang="ts">
import { computed, watch } from 'vue'
import { RouterLink } from 'vue-router'
import DifficultyDots from '@/components/common/DifficultyDots.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import ErrorState from '@/components/common/ErrorState.vue'
import LevelBadge from '@/components/common/LevelBadge.vue'
import LoadingState from '@/components/common/LoadingState.vue'
import ProgressBar from '@/components/common/ProgressBar.vue'
import MilestoneItem from '@/components/projects/MilestoneItem.vue'
import ProjectBonus from '@/components/projects/ProjectBonus.vue'
import ProjectLinksForm from '@/components/projects/ProjectLinksForm.vue'
import ProjectStatusBadge from '@/components/projects/ProjectStatusBadge.vue'
import StatusBadge from '@/components/common/StatusBadge.vue'
import { usePageTitle } from '@/composables/usePageTitle'
import { useProjectsStore } from '@/stores/projects'

const props = defineProps<{ slug: string }>()
const store = useProjectsStore()

watch(
  () => props.slug,
  (slug) => store.load(slug),
  { immediate: true },
)

const project = computed(() => (store.current?.slug === props.slug ? store.current : null))
const percent = computed(() =>
  project.value && project.value.milestonesTotal > 0
    ? Math.floor((project.value.milestonesCompleted / project.value.milestonesTotal) * 100)
    : 0,
)

usePageTitle(() => project.value?.title)
</script>

<template>
  <div>
    <LoadingState v-if="!project && store.loading" message="Carregando projeto…" />
    <EmptyState v-else-if="!project && store.notFound" title="Projeto não encontrado">
      <RouterLink to="/projetos" class="btn btn-secondary">Voltar aos projetos</RouterLink>
    </EmptyState>
    <ErrorState
      v-else-if="!project && store.error"
      :message="store.error"
      @retry="store.load(slug)"
    />

    <template v-else-if="project">
      <nav aria-label="Você está em" class="muted mb-3 text-sm">
        <RouterLink to="/projetos" class="hover:underline">Projetos</RouterLink>
        <span aria-hidden="true"> / </span>
        <span aria-current="page">{{ project.title }}</span>
      </nav>

      <header class="mb-6">
        <h1 class="text-2xl font-bold tracking-tight">{{ project.title }}</h1>
        <div class="mt-2 flex flex-wrap items-center gap-3 text-sm">
          <LevelBadge :level="project.careerLevel" />
          <DifficultyDots :value="project.difficulty" />
          <ProjectStatusBadge :status="project.status" />
          <span class="muted tabular-nums">{{ project.earnedXp }} / {{ project.totalXp }} XP</span>
        </div>
        <p class="mt-3 max-w-3xl text-slate-700 dark:text-slate-300">{{ project.description }}</p>
        <div class="mt-4 max-w-md">
          <div class="mb-1 flex justify-between text-xs">
            <span class="font-medium">
              {{ project.milestonesCompleted }} de {{ project.milestonesTotal }} etapas
            </span>
            <span class="muted tabular-nums">{{ percent }}%</span>
          </div>
          <ProgressBar :percent="percent" :label="`Progresso em ${project.title}`" tone="emerald" />
        </div>
      </header>

      <div class="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <section aria-labelledby="milestones-title" class="min-w-0">
          <h2 id="milestones-title" class="mb-3 text-lg font-semibold">Etapas</h2>
          <ol class="space-y-4">
            <MilestoneItem
              v-for="(milestone, index) in project.milestones"
              :key="milestone.key"
              :milestone="milestone"
              :index="index"
              :busy="store.busy"
              @set-status="(status) => store.setMilestoneStatus(milestone.key, status)"
            />
          </ol>
        </section>

        <div class="space-y-6">
          <ProjectBonus :project="project" />
          <ProjectLinksForm
            :repository-url="project.repositoryUrl"
            :deploy-url="project.deployUrl"
            :saving="store.busy"
            @save="(links) => store.saveLinks(links)"
          />

          <section v-if="project.topics.length > 0" class="card p-4" aria-labelledby="topics-title">
            <h2 id="topics-title" class="text-base font-semibold">Tópicos relacionados</h2>
            <ul class="mt-2 space-y-2 text-sm">
              <li
                v-for="topic in project.topics"
                :key="topic.slug"
                class="flex items-center justify-between gap-2"
              >
                <RouterLink
                  :to="{ name: 'topic', params: { slug: topic.slug } }"
                  class="text-indigo-700 underline dark:text-indigo-300"
                >
                  {{ topic.title }}
                </RouterLink>
                <StatusBadge :status="topic.status" />
              </li>
            </ul>
          </section>
        </div>
      </div>
    </template>
  </div>
</template>
