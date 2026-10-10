import { createRouter, createWebHistory } from 'vue-router'
import RoadmapPage from '@/pages/RoadmapPage.vue'
import { useAuthStore } from '@/stores/auth'

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
      path: '/projetos',
      name: 'projects',
      component: () => import('@/pages/ProjectsPage.vue'),
      meta: { title: 'Projetos', nav: 'Projetos', order: 2 },
    },
    {
      path: '/projetos/:slug',
      name: 'project',
      component: () => import('@/pages/ProjectPage.vue'),
      props: true,
      meta: { title: 'Projeto' },
    },
    {
      path: '/revisoes',
      name: 'reviews',
      component: () => import('@/pages/ReviewsPage.vue'),
      meta: { title: 'Revisões', nav: 'Revisões', order: 3 },
    },
    {
      path: '/diario',
      name: 'journal',
      component: () => import('@/pages/JournalPage.vue'),
      meta: { title: 'Diário de estudo', nav: 'Diário', order: 4 },
    },
    {
      path: '/dashboard',
      name: 'dashboard',
      component: () => import('@/pages/DashboardPage.vue'),
      meta: { title: 'Dashboard', nav: 'Dashboard', order: 5 },
    },
    {
      path: '/grafo',
      name: 'graph',
      component: () => import('@/pages/GraphPage.vue'),
      meta: { title: 'Grafo de pré-requisitos', nav: 'Grafo', order: 6 },
    },
    {
      path: '/configuracoes',
      name: 'settings',
      component: () => import('@/pages/SettingsPage.vue'),
      meta: { title: 'Configurações', nav: 'Configurações', order: 9 },
    },
    {
      path: '/entrar',
      name: 'login',
      component: () => import('@/pages/LoginPage.vue'),
      meta: { title: 'Entrar' },
    },
    {
      path: '/:pathMatch(.*)*',
      name: 'not-found',
      component: () => import('@/pages/NotFoundPage.vue'),
      meta: { title: 'Página não encontrada' },
    },
  ],
})

// Tudo exige login (Supabase Auth); sem sessão, vai para a tela de entrada e volta depois.
router.beforeEach(async (to) => {
  const auth = useAuthStore()
  await auth.init()
  if (!auth.authenticated && to.name !== 'login') {
    return { name: 'login', query: { redirect: to.fullPath } }
  }
  if (auth.authenticated && to.name === 'login') return { name: 'roadmap' }
  return true
})

router.afterEach((to) => {
  const title = to.meta.title
  document.title = title ? `${title} · Trilha Sênior` : 'Trilha Sênior'
})

export default router
