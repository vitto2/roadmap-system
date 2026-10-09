<script setup lang="ts">
import type { ProjectDetail } from '@/api/types'

defineProps<{ project: ProjectDetail }>()
</script>

<template>
  <section class="card p-4" aria-labelledby="bonus-title">
    <h2 id="bonus-title" class="text-base font-semibold">Bônus de projeto</h2>
    <p class="muted mt-1 text-xs">
      Concedido quando todas as etapas estão concluídas. Os valores vêm do servidor.
    </p>
    <ul class="mt-3 space-y-1.5 text-sm">
      <li class="flex justify-between gap-2">
        <span>
          <span aria-hidden="true">{{ project.bonus.finished ? '✓' : '○' }}</span>
          Projeto finalizado
        </span>
        <span class="tabular-nums">+100 XP</span>
      </li>
      <li class="flex justify-between gap-2">
        <span>
          <span aria-hidden="true">{{ project.repositoryUrl ? '✓' : '○' }}</span>
          Link do repositório
        </span>
        <span class="tabular-nums">+50 XP</span>
      </li>
      <li class="flex justify-between gap-2">
        <span>
          <span aria-hidden="true">{{ project.deployUrl ? '✓' : '○' }}</span>
          Link de deploy
        </span>
        <span class="tabular-nums">+50 XP</span>
      </li>
    </ul>
    <p class="mt-3 border-t border-slate-200 pt-2 text-sm font-semibold dark:border-slate-800">
      Bônus ganho:
      <span class="tabular-nums" data-testid="bonus-total">{{ project.bonus.total }}</span> XP
    </p>
  </section>
</template>
