<script setup lang="ts">
import { computed } from 'vue'
import {
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip,
  type ChartData,
  type ChartOptions,
} from 'chart.js'
import { Chart } from 'vue-chartjs'
import { useChartColors } from './chartTheme'

ChartJS.register(BarElement, CategoryScale, LinearScale, LineElement, PointElement, Tooltip, Legend)

const props = defineProps<{
  weeks: { weekStart: string; sessions: number; minutes: number }[]
  goal: number
}>()
const colors = useChartColors()

const labelFor = (weekStart: string) => {
  const [, month, day] = weekStart.split('-')
  return `${day}/${month}`
}

const data = computed<ChartData<'bar' | 'line'>>(() => ({
  labels: props.weeks.map((w) => labelFor(w.weekStart)),
  datasets: [
    {
      type: 'bar',
      label: 'Sessões',
      data: props.weeks.map((w) => w.sessions),
      backgroundColor: colors.value.primary,
      borderRadius: 4,
    },
    {
      type: 'line',
      label: 'Meta semanal',
      data: props.weeks.map(() => props.goal),
      borderColor: colors.value.accent,
      borderDash: [6, 4],
      pointRadius: 0,
      borderWidth: 2,
    },
  ],
}))

const options = computed<ChartOptions<'bar' | 'line'>>(() => ({
  responsive: true,
  maintainAspectRatio: false,
  scales: {
    x: { ticks: { color: colors.value.text }, grid: { display: false } },
    y: {
      beginAtZero: true,
      ticks: { color: colors.value.text, precision: 0 },
      grid: { color: colors.value.grid },
    },
  },
  plugins: { legend: { labels: { color: colors.value.text } } },
}))
</script>

<template>
  <figure>
    <div class="h-72">
      <Chart
        type="bar"
        :data="data"
        :options="options"
        aria-label="Sessões de estudo por semana"
        role="img"
      />
    </div>
    <table class="sr-only">
      <caption>
        Sessões de estudo por semana (semanas começam na segunda-feira)
      </caption>
      <thead>
        <tr>
          <th scope="col">Semana</th>
          <th scope="col">Sessões</th>
          <th scope="col">Minutos</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="week in weeks" :key="week.weekStart">
          <th scope="row">{{ labelFor(week.weekStart) }}</th>
          <td>{{ week.sessions }}</td>
          <td>{{ week.minutes }}</td>
        </tr>
      </tbody>
    </table>
  </figure>
</template>
