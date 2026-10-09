import { createRouter, createWebHistory } from 'vue-router'
import RoadmapPage from '@/pages/RoadmapPage.vue'

declare module 'vue-router' {
  interface RouteMeta {
    /** Título da página (aba do navegador). */
    title?: string
    /** Texto no menu principal; rotas sem `nav` não aparecem no menu. */
    nav?: string
    order?: number
  }
}

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  scrollBehavior: (_to, _from, saved) => saved ?? { top: 0 },
  routes: [
    {
      path: '/',
      name: 'roadmap',
      component: RoadmapPage,
      meta: { title: 'Roadmap', nav: 'Roadmap', order: 1 },
    },
    {
      path: '/trilhas/:slug',
      name: 'track',
      component: () => import('@/pages/TrackPage.vue'),
      props: true,
      meta: { title: 'Trilha' },
    },
    {
      path: '/topicos/:slug',
      name: 'topic',
      component: () => import('@/pages/TopicPage.vue'),
      props: true,
      meta: { title: 'Tópico' },
    },
    {
      path: '/:pathMatch(.*)*',
      name: 'not-found',
      component: () => import('@/pages/NotFoundPage.vue'),
      meta: { title: 'Página não encontrada' },
    },
  ],
})

router.afterEach((to) => {
  const title = to.meta.title
  document.title = title ? `${title} · Trilha Sênior` : 'Trilha Sênior'
})

export default router
