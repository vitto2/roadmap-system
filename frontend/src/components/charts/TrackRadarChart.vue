<script setup lang="ts">
import { computed } from 'vue'
import {
  Chart as ChartJS,
  Filler,
  Legend,
  LineElement,
  PointElement,
  RadialLinearScale,
  Tooltip,
  type ChartData,
  type ChartOptions,
} from 'chart.js'
import { Radar } from 'vue-chartjs'
import { useChartColors } from './chartTheme'

ChartJS.register(RadialLinearScale, PointElement, LineElement, Filler, Tooltip, Legend)

const props = defineProps<{ items: { trackSlug: string; title: string; percent: number }[] }>()
const colors = useChartColors()

const data = computed<ChartData<'radar'>>(() => ({
  labels: props.items.map((i) => i.title),
  datasets: [
    {
      label: 'Progresso (%)',
      data: props.items.map((i) => i.percent),
      borderColor: colors.value.primary,
      backgroundColor: colors.value.primaryFill,
      pointBackgroundColor: colors.value.primary,
      borderWidth: 2,
    },
  ],
}))

const options = computed<ChartOptions<'radar'>>(() => ({
  responsive: true,
  maintainAspectRatio: false,
  scales: {
    r: {
      min: 0,
      max: 100,
      ticks: { stepSize: 25, color: colors.value.text, backdropColor: 'transparent' },
      grid: { color: colors.value.grid },
      angleLines: { color: colors.value.grid },
      pointLabels: { color: colors.value.text, font: { size: 11 } },
    },
  },
  plugins: { legend: { display: false } },
}))
</script>

<template>
  <figure>
    <div class="h-80">
      <Radar
        :data="data"
        :options="options"
        aria-label="Radar de progresso por trilha"
        role="img"
      />
    </div>
    <figcaption class="sr-only">Progresso por trilha, em porcentagem</figcaption>
    <table class="sr-only">
      <caption>
        Progresso por trilha
      </caption>
      <thead>
        <tr>
          <th scope="col">Trilha</th>
          <th scope="col">Progresso</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="item in items" :key="item.trackSlug">
          <th scope="row">{{ item.title }}</th>
          <td>{{ item.percent }}%</td>
        </tr>
      </tbody>
    </table>
  </figure>
</template>
