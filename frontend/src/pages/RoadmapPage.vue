<script setup lang="ts">
import { computed, onMounted } from 'vue'
import ErrorState from '@/components/common/ErrorState.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import LoadingState from '@/components/common/LoadingState.vue'
import RoadmapFilters from '@/components/roadmap/RoadmapFilters.vue'
import TrackCard from '@/components/roadmap/TrackCard.vue'
import { useProfileStore } from '@/stores/profile'
import { useRoadmapStore } from '@/stores/roadmap'

const roadmap = useRoadmapStore()
const profileStore = useProfileStore()

onMounted(() => roadmap.ensureLoaded())

const topicsOf = (slug: string) => roadmap.topics.filter((t) => t.trackSlug === slug)

const visibleTracks = computed(() =>
  roadmap.hasActiveFilters
    ? roadmap.tracks.filter((t) => (roadmap.filteredByTrack.get(t.slug)?.length ?? 0) > 0)
    : roadmap.tracks,
)

const overall = computed(() => profileStore.profile?.overall)
</script>

<template>
  <div>
    <div class="mb-6">
      <h1 class="text-2xl font-bold tracking-tight">Seu roadmap</h1>
      <p class="muted mt-1 text-sm">
        <template v-if="overall">
          {{ overall.completedTopics }} de {{ overall.totalTopics }} tópicos concluídos ({{
            overall.percent
          }}%).
        </template>
        Marque o que já estudou, avance no checklist e acumule XP até chegar a sênior.
      </p>
    </div>

    <LoadingState v-if="roadmap.loading && !roadmap.loaded" message="Carregando trilhas…" />
    <ErrorState
      v-else-if="roadmap.error && !roadmap.loaded"
      :message="roadmap.error"
      @retry="roadmap.load()"
    />
    <EmptyState
      v-else-if="roadmap.tracks.length === 0"
      title="Nenhuma trilha encontrada"
      description="O conteúdo ainda não foi carregado. No backend, rode: npm run db:setup"
    />

    <template v-else>
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
        v-if="visibleTracks.length === 0"
        title="Nenhum tópico corresponde aos filtros"
        description="Tente outro nível ou status."
      >
        <button type="button" class="btn btn-secondary" @click="roadmap.clearFilters()">
          Limpar filtros
        </button>
      </EmptyState>

      <ul v-else class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <li v-for="track in visibleTracks" :key="track.slug" class="contents">
          <TrackCard
            :track="track"
            :topics="topicsOf(track.slug)"
            :matching="roadmap.filteredByTrack.get(track.slug) ?? []"
            :filters-active="roadmap.hasActiveFilters"
          />
        </li>
      </ul>
    </template>
  </div>
</template>
