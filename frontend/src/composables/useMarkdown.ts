import DOMPurify from 'dompurify'
import MarkdownIt from 'markdown-it'

// `html: false` impede HTML cru no markdown; DOMPurify é a segunda barreira (sempre sanitizado).
const md = new MarkdownIt({ html: false, linkify: true, breaks: true })

// Links externos abrem em nova aba sem vazar o `opener`.
DOMPurify.addHook('afterSanitizeAttributes', (node) => {
  if (node instanceof Element && node.tagName === 'A') {
    node.setAttribute('target', '_blank')
    node.setAttribute('rel', 'noopener noreferrer nofollow')
  }
})

export function renderMarkdown(source: string): string {
  return DOMPurify.sanitize(md.render(source), {
    USE_PROFILES: { html: true },
    FORBID_TAGS: ['style', 'form', 'input', 'button', 'iframe', 'object', 'embed'],
    ALLOWED_URI_REGEXP: /^(?:https?:|mailto:|#|\/)/i,
  })
}

export function useMarkdown() {
  return { renderMarkdown }
}

/** Markdown em linha (código, ênfase e links) para textos curtos vindos do conteúdo (checklists, descrições). */
export function renderInlineMarkdown(source: string): string {
  return DOMPurify.sanitize(md.renderInline(source), {
    ALLOWED_TAGS: ['code', 'em', 'strong', 'a'],
    ALLOWED_ATTR: ['href', 'target', 'rel'],
    ALLOWED_URI_REGEXP: /^(?:https?:|mailto:|#|\/)/i,
  })
}
