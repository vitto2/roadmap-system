<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { RouterLink } from 'vue-router'
import EmptyState from '@/components/common/EmptyState.vue'
import ErrorState from '@/components/common/ErrorState.vue'
import LoadingState from '@/components/common/LoadingState.vue'
import ProgressBar from '@/components/common/ProgressBar.vue'
import RoadmapFilters from '@/components/roadmap/RoadmapFilters.vue'
import TopicRow from '@/components/roadmap/TopicRow.vue'
import { usePageTitle } from '@/composables/usePageTitle'
import { CAREER_LEVELS, careerLabels } from '@/lib/labels'
import { useRoadmapStore } from '@/stores/roadmap'

const props = defineProps<{ slug: string }>()
const roadmap = useRoadmapStore()

onMounted(() => roadmap.ensureLoaded())

const track = computed(() => roadmap.tracks.find((t) => t.slug === props.slug))
const topics = computed(() => roadmap.topics.filter((t) => t.trackSlug === props.slug))
const matching = computed(() => roadmap.filteredByTrack.get(props.slug) ?? [])

const sections = computed(() =>
  CAREER_LEVELS.map((level) => ({
    level,
    topics: matching.value.filter((t) => t.careerLevel === level),
    done: topics.value.filter((t) => t.careerLevel === level && t.status === 'completed').length,
    total: topics.value.filter((t) => t.careerLevel === level).length,
  })).filter((s) => s.topics.length > 0),
)

usePageTitle(() => track.value?.title)
</script>

<template>
  <div>
    <nav aria-label="Você está em" class="muted mb-3 text-sm">
      <RouterLink to="/" class="hover:underline">Roadmap</RouterLink>
      <span aria-hidden="true"> / </span>
      <span aria-current="page">{{ track?.title ?? 'Trilha' }}</span>
    </nav>

    <LoadingState v-if="roadmap.loading && !roadmap.loaded" message="Carregando trilha…" />
    <ErrorState
      v-else-if="roadmap.error && !roadmap.loaded"
      :message="roadmap.error"
      @retry="roadmap.load()"
    />
    <EmptyState
      v-else-if="!track"
      title="Trilha não encontrada"
      description="Verifique o endereço ou volte ao roadmap."
    >
      <RouterLink to="/" class="btn btn-secondary">Voltar ao roadmap</RouterLink>
    </EmptyState>

    <template v-else>
      <header class="mb-6">
        <h1 class="text-2xl font-bold tracking-tight">{{ track.title }}</h1>
        <p class="muted mt-1 text-sm">{{ track.description }}</p>
        <div class="mt-4 max-w-md">
          <div class="mb-1 flex justify-between text-xs">
            <span class="font-medium"
              >{{ track.completedTopics }} de {{ track.totalTopics }} tópicos</span
            >
            <span class="muted tabular-nums">{{ track.earnedXp }} / {{ track.totalXp }} XP</span>
          </div>
          <ProgressBar
            :percent="track.percent"
            :label="`Progresso em ${track.title}`"
            tone="emerald"
          />
        </div>
      </header>

      <RoadmapFilters
        :level="roadmap.levelFilter"
        :status="roadmap.statusFilter"
        :active="roadmap.hasActiveFilters"
        class="mb-6"
        @update:level="roadmap.setLevelFilter"
        @update:status="roadmap.setStatusFilter"
        @clear="roadmap.clearFilters"
      />

      <EmptyState
        v-if="sections.length === 0"
        title="Nenhum tópico corresponde aos filtros"
        description="Tente outro nível ou status."
      >
        <button type="button" class="btn btn-secondary" @click="roadmap.clearFilters()">
          Limpar filtros
        </button>
      </EmptyState>

      <div v-else class="space-y-6">
        <section
          v-for="section in sections"
          :key="section.level"
          :aria-labelledby="`nivel-${section.level}`"
        >
          <h2
            :id="`nivel-${section.level}`"
            class="mb-2 flex items-baseline gap-2 text-lg font-semibold"
          >
            {{ careerLabels[section.level] }}
            <span class="muted text-sm font-normal"
              >{{ section.done }}/{{ section.total }} concluídos</span
            >
          </h2>
          <ul class="card divide-y divide-slate-200 dark:divide-slate-800">
            <TopicRow v-for="topic in section.topics" :key="topic.slug" :topic="topic" />
          </ul>
        </section>
      </div>
    </template>
  </div>
</template>
