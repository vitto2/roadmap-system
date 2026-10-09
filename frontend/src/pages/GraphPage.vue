<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { Background } from '@vue-flow/background'
import { Controls } from '@vue-flow/controls'
import { VueFlow, type Edge, type Node, type NodeMouseEvent } from '@vue-flow/core'
import '@vue-flow/core/dist/style.css'
import '@vue-flow/core/dist/theme-default.css'
import '@vue-flow/controls/dist/style.css'
import EmptyState from '@/components/common/EmptyState.vue'
import ErrorState from '@/components/common/ErrorState.vue'
import LoadingState from '@/components/common/LoadingState.vue'
import TopicNode from '@/components/graph/TopicNode.vue'
import { layoutGraph } from '@/lib/graphLayout'
import { useGraphStore } from '@/stores/graph'
import { useUiStore } from '@/stores/ui'

const store = useGraphStore()
const ui = useUiStore()
const router = useRouter()

onMounted(() => store.load())

const flowNodes = computed<Node[]>(() => {
  const positions = layoutGraph(store.visibleNodes, store.visibleEdges)
  return store.visibleNodes.map((n) => ({
    id: n.slug,
    type: 'topic',
    position: positions.get(n.slug) ?? { x: 0, y: 0 },
    data: {
      title: n.title,
      status: n.status,
      unlocked: n.unlocked,
      careerLevel: n.careerLevel,
    },
  }))
})

const flowEdges = computed<Edge[]>(() => {
  const statusOf = new Map(store.visibleNodes.map((n) => [n.slug, n.status]))
  const dark = ui.theme === 'dark'
  return store.visibleEdges.map((e) => {
    const done = statusOf.get(e.source) === 'completed'
    return {
      id: `${e.source}->${e.target}`,
      source: e.source,
      target: e.target,
      type: 'smoothstep',
      animated: done && statusOf.get(e.target) !== 'completed',
      style: {
        stroke: done ? (dark ? '#34d399' : '#059669') : dark ? '#64748b' : '#94a3b8',
        strokeWidth: done ? 2 : 1.5,
      },
    }
  })
})

function open(event: NodeMouseEvent) {
  router.push({ name: 'topic', params: { slug: event.node.id } })
}

const legend = [
  { icon: '✓', text: 'Concluído', cls: 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950' },
  { icon: '◐', text: 'Estudando', cls: 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950' },
  { icon: '○', text: 'Desbloqueado', cls: 'border-slate-400 bg-white dark:bg-slate-900' },
  {
    icon: '🔒',
    text: 'Bloqueado (estude os pré-requisitos antes)',
    cls: 'border-dashed border-slate-400 bg-slate-100 dark:bg-slate-800',
  },
]
</script>

<template>
  <div>
    <div class="mb-4">
      <h1 class="text-2xl font-bold tracking-tight">Grafo de pré-requisitos</h1>
      <p class="muted mt-1 text-sm">
        Veja a ordem sugerida de estudo. “Bloqueado” é só uma recomendação: você pode marcar
        qualquer tópico a qualquer momento. Clique em um tópico para abri-lo.
      </p>
    </div>

    <LoadingState v-if="store.loading && !store.graph" message="Montando o grafo…" />
    <ErrorState
      v-else-if="store.error && !store.graph"
      :message="store.error"
      @retry="store.load()"
    />
    <EmptyState
      v-else-if="store.graph && store.graph.nodes.length === 0"
      title="Nenhum tópico para exibir"
      description="Carregue o conteúdo com: npm run db:setup (no backend)"
    />

    <template v-else-if="store.graph">
      <div class="mb-3 flex flex-wrap items-end gap-4">
        <div>
          <label for="graph-track" class="label">Trilha</label>
          <select id="graph-track" v-model="store.trackFilter" class="input">
            <option value="">Todas as trilhas</option>
            <option v-for="t in store.tracks" :key="t.slug" :value="t.slug">{{ t.title }}</option>
          </select>
        </div>
        <ul class="flex flex-wrap gap-x-4 gap-y-1 text-xs" aria-label="Legenda">
          <li v-for="item in legend" :key="item.text" class="flex items-center gap-1.5">
            <span
              class="inline-flex h-5 w-5 items-center justify-center rounded border-2 text-[10px]"
              :class="item.cls"
              aria-hidden="true"
            >
              {{ item.icon }}
            </span>
            {{ item.text }}
          </li>
        </ul>
      </div>

      <div
        class="h-[65vh] min-h-96 overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"
        role="application"
        aria-label="Grafo interativo de tópicos e pré-requisitos"
      >
        <VueFlow
          :key="store.trackFilter"
          :nodes="flowNodes"
          :edges="flowEdges"
          :nodes-draggable="false"
          :nodes-connectable="false"
          :min-zoom="0.1"
          :max-zoom="1.5"
          fit-view-on-init
          :class="{ dark: ui.theme === 'dark' }"
          @node-click="open"
        >
          <template #node-topic="nodeProps">
            <TopicNode :data="nodeProps.data" />
          </template>
          <Background :pattern-color="ui.theme === 'dark' ? '#334155' : '#cbd5e1'" />
          <Controls :show-interactive="false" />
        </VueFlow>
      </div>

      <section class="card mt-6 p-5" aria-labelledby="next-title">
        <h2 id="next-title" class="text-lg font-semibold">Próximos passos recomendados</h2>
        <p class="muted mt-0.5 text-sm">Tópicos com todos os pré-requisitos concluídos.</p>
        <p v-if="store.nextSteps.length === 0" class="mt-3 text-sm">
          Nada pendente neste filtro. Parabéns!
        </p>
        <ul v-else class="mt-3 grid gap-2 sm:grid-cols-2">
          <li v-for="node in store.nextSteps" :key="node.slug">
            <RouterLink
              :to="{ name: 'topic', params: { slug: node.slug } }"
              class="block rounded-lg border border-slate-200 px-3 py-2 text-sm hover:bg-slate-100 dark:border-slate-800 dark:hover:bg-slate-800"
            >
              <span class="font-medium">{{ node.title }}</span>
              <span class="muted block text-xs">{{ node.trackTitle }}</span>
            </RouterLink>
          </li>
        </ul>
      </section>
    </template>
  </div>
</template>
