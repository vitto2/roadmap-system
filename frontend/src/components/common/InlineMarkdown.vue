<script setup lang="ts">
import { computed } from 'vue'
import { renderInlineMarkdown } from '@/composables/useMarkdown'

const props = defineProps<{ text: string }>()
const html = computed(() => renderInlineMarkdown(props.text))
</script>

<template>
  <!-- eslint-disable-next-line vue/no-v-html -- sanitizado com DOMPurify em renderInlineMarkdown -->
  <span class="inline-md" v-html="html" />
</template>
