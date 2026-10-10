<script setup lang="ts">
// Exibida quando o app foi publicado/rodado sem a configuração do Supabase.
</script>

<template>
  <main class="mx-auto max-w-2xl px-4 py-12">
    <h1 class="text-2xl font-bold tracking-tight">Falta conectar o Supabase</h1>
    <p class="muted mt-2">
      O app não encontrou as variáveis de ambiente do seu projeto Supabase. Sem elas ele não sabe
      onde guardar seu progresso.
    </p>

    <ol class="card mt-6 list-decimal space-y-3 p-6 pl-10 text-sm">
      <li>
        Crie um projeto em <strong>supabase.com</strong> e copie, em
        <em>Project Settings → API</em>, a <strong>Project URL</strong> e a chave
        <strong>anon / publishable</strong>.
      </li>
      <li>
        Em <code>frontend/.env</code> (local) ou nas <em>Environment Variables</em> da hospedagem,
        defina:
        <pre class="mt-2 overflow-x-auto rounded-lg bg-slate-900 p-3 text-slate-100">
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_ANON_KEY=sua-chave-anon</pre>
      </li>
      <li>
        Prepare o banco (migrations + conteúdo) com <code>npm run db:setup</code> na pasta
        <code>tools/</code> — o passo a passo está no <strong>README.md</strong>.
      </li>
      <li>Rebuild/reinicie o app: as variáveis <code>VITE_*</code> são lidas na hora do build.</li>
    </ol>

    <p class="muted mt-6 text-sm">
      Quer só experimentar? Rode <code>npm run dev:demo</code> em <code>frontend/</code>: o app usa
      um banco de demonstração dentro do navegador, sem precisar do Supabase.
    </p>
  </main>
</template>
