<script setup lang="ts">
import { computed, defineAsyncComponent, onMounted } from 'vue'
import ErrorState from '@/components/common/ErrorState.vue'
import LoadingState from '@/components/common/LoadingState.vue'
import ProgressBar from '@/components/common/ProgressBar.vue'
import StatCard from '@/components/dashboard/StatCard.vue'
import { careerLabels, formatMinutes, formatNumber } from '@/lib/labels'
import { useDashboardStore } from '@/stores/dashboard'

// Chart.js só é baixado quando o dashboard é aberto.
const TrackRadarChart = defineAsyncComponent(
  () => import('@/components/charts/TrackRadarChart.vue'),
)
const WeeklySessionsChart = defineAsyncComponent(
  () => import('@/components/charts/WeeklySessionsChart.vue'),
)

const store = useDashboardStore()
onMounted(() => store.load())

const profile = computed(() => store.data?.profile)
const breakdown = computed(() => {
  const b = profile.value?.xp.breakdown
  return b
    ? [
        { label: 'Tópicos', value: b.topics },
        { label: 'Etapas de projetos', value: b.milestones },
        { label: 'Bônus de projetos', value: b.projects },
        { label: 'Revisões', value: b.reviews },
      ]
    : []
})
const goalPercent = computed(() => {
  const s = profile.value?.streak
  return s && s.weeklyGoal > 0
    ? Math.min(100, Math.round((s.weeklySessions / s.weeklyGoal) * 100))
    : 0
})
</script>

<template>
  <div>
    <h1 class="mb-6 text-2xl font-bold tracking-tight">Dashboard</h1>

    <LoadingState v-if="store.loading && !store.data" message="Carregando dashboard…" />
    <ErrorState
      v-else-if="store.error && !store.data"
      :message="store.error"
      @retry="store.load()"
    />

    <template v-else-if="store.data && profile">
      <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="XP total"
          :value="formatNumber(profile.xp.total)"
          :hint="`Nível ${profile.xp.level} · faltam ${formatNumber(profile.xp.xpForNextLevel - profile.xp.xpIntoLevel)} XP`"
        />
        <StatCard
          label="Nível de carreira"
          :value="careerLabels[profile.career.level]"
          :hint="
            profile.career.next
              ? `Próximo: ${careerLabels[profile.career.next.level]} (${profile.career.next.percent}% de ${profile.career.next.requiredPercent}%)`
              : 'Nível máximo atingido'
          "
        />
        <StatCard
          label="Streak"
          :value="`${profile.streak.current} ${profile.streak.current === 1 ? 'dia' : 'dias'}`"
          :hint="`Maior sequência: ${profile.streak.longest}`"
        />
        <StatCard
          label="Estudo total"
          :value="formatMinutes(store.data.totals.minutes)"
          :hint="`${store.data.totals.sessions} sessões`"
        />
      </div>

      <div class="mt-6 grid gap-6 lg:grid-cols-2">
        <section class="card p-5" aria-labelledby="radar-title">
          <h2 id="radar-title" class="mb-2 text-lg font-semibold">Progresso por trilha</h2>
          <TrackRadarChart :items="store.data.radar" />
        </section>

        <section class="card p-5" aria-labelledby="weeks-title">
          <h2 id="weeks-title" class="mb-1 text-lg font-semibold">Sessões por semana</h2>
          <p class="muted mb-2 text-sm">
            Esta semana: {{ profile.streak.weeklySessions }} de {{ profile.streak.weeklyGoal }}
          </p>
          <ProgressBar
            :percent="goalPercent"
            label="Meta semanal de sessões"
            tone="emerald"
            size="sm"
            class="mb-4"
          />
          <WeeklySessionsChart :weeks="store.data.weeks" :goal="profile.streak.weeklyGoal" />
        </section>
      </div>

      <section class="card mt-6 p-5" aria-labelledby="xp-title">
        <h2 id="xp-title" class="mb-3 text-lg font-semibold">De onde vem seu XP</h2>
        <dl class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div v-for="item in breakdown" :key="item.label">
            <dt class="muted text-sm">{{ item.label }}</dt>
            <dd class="text-xl font-semibold tabular-nums">{{ formatNumber(item.value) }} XP</dd>
          </div>
        </dl>
      </section>

      <section
        v-if="profile.career.progress.length"
        class="card mt-6 p-5"
        aria-labelledby="career-title"
      >
        <h2 id="career-title" class="mb-3 text-lg font-semibold">Caminho na carreira</h2>
        <ul class="space-y-3">
          <li v-for="step in profile.career.progress" :key="step.level">
            <div class="mb-1 flex justify-between text-sm">
              <span class="font-medium">
                {{ careerLabels[step.level] }}
                <span v-if="step.reached" aria-label="atingido">✓</span>
              </span>
              <span class="muted tabular-nums"
                >{{ step.percent }}% de {{ step.requiredPercent }}% exigidos</span
              >
            </div>
            <ProgressBar
              :percent="Math.min(100, Math.round((step.percent / step.requiredPercent) * 100))"
              :label="`Progresso para ${careerLabels[step.level]}`"
              :tone="step.reached ? 'emerald' : 'indigo'"
              size="sm"
            />
          </li>
        </ul>
      </section>
    </template>
  </div>
</template>
