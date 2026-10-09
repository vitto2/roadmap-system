<script setup lang="ts">
import { RouterLink } from 'vue-router'
import EmptyState from '@/components/common/EmptyState.vue'
</script>

<template>
  <EmptyState
    title="Página não encontrada"
    description="O endereço que você tentou abrir não existe."
  >
    <RouterLink to="/" class="btn btn-primary">Ir para o roadmap</RouterLink>
  </EmptyState>
</template>
