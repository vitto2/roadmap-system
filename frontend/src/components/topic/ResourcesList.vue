<script setup lang="ts">
defineProps<{ resources: { name: string; url: string | null }[] }>()
</script>

<template>
  <section class="card p-4" aria-labelledby="resources-title">
    <h2 id="resources-title" class="text-base font-semibold">Recursos sugeridos</h2>
    <p v-if="resources.length === 0" class="muted mt-2 text-sm">Nenhum recurso cadastrado.</p>
    <ul v-else class="mt-2 space-y-1.5 text-sm">
      <li v-for="resource in resources" :key="resource.name">
        <a
          v-if="resource.url"
          :href="resource.url"
          target="_blank"
          rel="noopener noreferrer"
          class="text-indigo-700 underline dark:text-indigo-300"
        >
          {{ resource.name }} <span aria-hidden="true">↗</span>
          <span class="sr-only">(abre em nova aba)</span>
        </a>
        <span v-else>{{ resource.name }}</span>
      </li>
    </ul>
  </section>
</template>
