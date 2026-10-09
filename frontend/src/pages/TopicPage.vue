<script setup lang="ts">
import { computed, watch } from 'vue'
import { RouterLink } from 'vue-router'
import DifficultyDots from '@/components/common/DifficultyDots.vue'
import ErrorState from '@/components/common/ErrorState.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import LevelBadge from '@/components/common/LevelBadge.vue'
import LoadingState from '@/components/common/LoadingState.vue'
import StatusBadge from '@/components/common/StatusBadge.vue'
import ChecklistPanel from '@/components/topic/ChecklistPanel.vue'
import EvidenceField from '@/components/topic/EvidenceField.vue'
import NotesEditor from '@/components/topic/NotesEditor.vue'
import ResourcesList from '@/components/topic/ResourcesList.vue'
import ReviewsTimeline from '@/components/topic/ReviewsTimeline.vue'
import TopicActions from '@/components/topic/TopicActions.vue'
import { usePageTitle } from '@/composables/usePageTitle'
import { useTopicStore } from '@/stores/topic'

const props = defineProps<{ slug: string }>()
const store = useTopicStore()

watch(
  () => props.slug,
  (slug) => store.load(slug),
  { immediate: true },
)

const topic = computed(() => (store.current?.slug === props.slug ? store.current : null))
usePageTitle(() => topic.value?.title)
</script>

<template>
  <div>
    <LoadingState v-if="!topic && store.loading" message="Carregando tópico…" />
    <EmptyState v-else-if="!topic && store.notFound" title="Tópico não encontrado">
      <RouterLink to="/" class="btn btn-secondary">Voltar ao roadmap</RouterLink>
    </EmptyState>
    <ErrorState
      v-else-if="!topic && store.error"
      :message="store.error"
      @retry="store.load(slug)"
    />

    <template v-else-if="topic">
      <nav aria-label="Você está em" class="muted mb-3 text-sm">
        <RouterLink to="/" class="hover:underline">Roadmap</RouterLink>
        <span aria-hidden="true"> / </span>
        <RouterLink
          :to="{ name: 'track', params: { slug: topic.trackSlug } }"
          class="hover:underline"
        >
          {{ topic.trackTitle }}
        </RouterLink>
      </nav>

      <header class="mb-6">
        <h1 class="text-2xl font-bold tracking-tight">{{ topic.title }}</h1>
        <div class="mt-2 flex flex-wrap items-center gap-3 text-sm">
          <LevelBadge :level="topic.careerLevel" />
          <DifficultyDots :value="topic.difficulty" />
          <span class="muted tabular-nums">{{ topic.xp }} XP</span>
          <StatusBadge :status="topic.status" />
        </div>
        <p class="mt-3 max-w-3xl text-slate-700 dark:text-slate-300">{{ topic.description }}</p>
      </header>

      <aside
        v-if="topic.status !== 'completed' && topic.recommendedFirst.length > 0"
        class="mb-6 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100"
        aria-label="Recomendação de estudo"
      >
        <p class="font-semibold">Recomendado estudar antes</p>
        <p class="mt-0.5">Isso não impede você de marcar este tópico. Pré-requisitos pendentes:</p>
        <ul class="mt-1 list-inside list-disc">
          <li v-for="p in topic.recommendedFirst" :key="p.slug">
            <RouterLink :to="{ name: 'topic', params: { slug: p.slug } }" class="underline">{{
              p.title
            }}</RouterLink>
          </li>
        </ul>
      </aside>

      <div class="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <div class="min-w-0 space-y-6">
          <ChecklistPanel
            :items="topic.checklist"
            :disabled="store.busy"
            @toggle="(key, checked) => store.toggleItem(key, checked)"
          />
          <NotesEditor
            :key="topic.slug"
            :notes="topic.notes"
            :saving="store.busy"
            @save="(notes) => store.saveNotes(notes)"
          />
        </div>

        <div class="space-y-6">
          <TopicActions
            :topic="topic"
            :busy="store.busy"
            @complete="store.complete()"
            @master="store.master()"
            @reopen="store.reopen()"
            @set-status="(status) => store.setStatus(status)"
          />
          <EvidenceField
            :evidence-url="topic.evidenceUrl"
            :saving="store.busy"
            @save="(url) => store.saveEvidence(url)"
          />
          <ResourcesList :resources="topic.resources" />
          <ReviewsTimeline :reviews="topic.reviews" />

          <section
            v-if="topic.projects.length > 0"
            class="card p-4"
            aria-labelledby="projects-title"
          >
            <h2 id="projects-title" class="text-base font-semibold">Projetos relacionados</h2>
            <ul class="mt-2 space-y-1.5 text-sm">
              <li v-for="project in topic.projects" :key="project.slug">
                <RouterLink
                  :to="{ name: 'project', params: { slug: project.slug } }"
                  class="text-indigo-700 underline dark:text-indigo-300"
                >
                  {{ project.title }}
                </RouterLink>
              </li>
            </ul>
          </section>
        </div>
      </div>
    </template>
  </div>
</template>
