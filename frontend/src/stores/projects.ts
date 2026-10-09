import { ref } from 'vue'
import { defineStore } from 'pinia'
import { api } from '@/api'
import { ApiError, errorMessage } from '@/api/client'
import type { MilestoneStatus, Mutation, ProjectDetail, ProjectSummary } from '@/api/types'
import { useProfileStore } from './profile'
import { useUiStore } from './ui'

export const useProjectsStore = defineStore('projects', () => {
  const projects = ref<ProjectSummary[]>([])
  const listLoaded = ref(false)
  const listLoading = ref(false)
  const listError = ref<string | null>(null)

  const current = ref<ProjectDetail | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)
  const notFound = ref(false)
  const busy = ref(false)

  async function loadList() {
    listLoading.value = true
    listError.value = null
    try {
      projects.value = await api.projects()
      listLoaded.value = true
    } catch (e) {
      listError.value = errorMessage(e)
    } finally {
      listLoading.value = false
    }
  }

  async function load(slug: string) {
    if (current.value?.slug !== slug) current.value = null
    loading.value = true
    error.value = null
    notFound.value = false
    try {
      current.value = await api.project(slug)
    } catch (e) {
      error.value = errorMessage(e)
      notFound.value = e instanceof ApiError && e.status === 404
    } finally {
      loading.value = false
    }
  }

  async function mutate(action: () => Promise<Mutation<ProjectDetail>>): Promise<boolean> {
    busy.value = true
    try {
      const result = await action()
      current.value = result.data
      useProfileStore().apply(result.profile)
      // a lista de projetos fica desatualizada (progresso/XP mudaram)
      listLoaded.value = false
      return true
    } catch (e) {
      useUiStore().pushToast(errorMessage(e), 'error', 6000)
      return false
    } finally {
      busy.value = false
    }
  }

  async function setMilestoneStatus(key: string, status: MilestoneStatus): Promise<boolean> {
    if (!current.value) return false
    const slug = current.value.slug
    return mutate(() => api.setMilestoneStatus(slug, key, status))
  }

  async function saveLinks(links: {
    repositoryUrl?: string | null
    deployUrl?: string | null
  }): Promise<boolean> {
    if (!current.value) return false
    const slug = current.value.slug
    return mutate(() => api.updateProjectLinks(slug, links))
  }

  return {
    projects,
    listLoaded,
    listLoading,
    listError,
    current,
    loading,
    error,
    notFound,
    busy,
    loadList,
    load,
    setMilestoneStatus,
    saveLinks,
  }
})
