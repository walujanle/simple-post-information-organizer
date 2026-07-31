import type { RenderContext, RenderIssue, RenderResult, Section } from '@/domain/types'

const tokenPattern = /\{([a-z0-9-]+)(?::([^{}]+))?\}/g

function isValidSectionKey(key: string): boolean {
  return /^[a-z0-9-]+$/.test(key)
}

function applyFormat(value: string, format?: string): string {
  if (format === 'lowercase') return value.toLowerCase()
  if (format === 'uppercase') return value.toUpperCase()
  if (format === 'trim') return value.trim()
  if (format === 'capitalized') return value.replace(/\b\w/g, (c) => c.toUpperCase())
  return value
}

// Resolve a single section value, expanding {token} references in its value.
// Cycle detection via visiting set prevents infinite recursion.
function resolveSection(
  key: string,
  sectionMap: Map<string, Section>,
  visiting: Set<string>,
): string | undefined {
  const section = sectionMap.get(key)
  if (!section) return undefined
  const raw = section.value.trim()
  if (!raw) return ''
  if (visiting.has(key)) {
    // Cycle detected — return the raw value without further expansion
    return raw
  }
  visiting.add(key)
  const resolved = raw.replace(tokenPattern, (_match, refKey: string, fmt?: string) => {
    const inner = resolveSection(refKey, sectionMap, new Set(visiting))
    if (inner === undefined) return `«unknown:${refKey}»`
    if (!inner) return `«empty:${refKey}»`
    return applyFormat(inner, fmt)
  })
  visiting.delete(key)
  return resolved
}

export function renderTemplate(template: string, context: RenderContext): RenderResult {
  const issues: RenderIssue[] = []
  const escapedOpen = '\uE000'
  const escapedClose = '\uE001'
  const escaped = template.replaceAll('{{', escapedOpen).replaceAll('}}', escapedClose)
  const sectionMap = new Map(context.sections.map((section) => [section.key, section]))

  const rendered = escaped.replace(tokenPattern, (_match, key: string, format?: string) => {
    const resolved = resolveSection(key, sectionMap, new Set())
    if (resolved === undefined) {
      issues.push({ type: 'unknown', key })
      return `«unknown:${key}»`
    }
    if (!resolved) {
      issues.push({ type: 'empty', key })
      return `«empty:${key}»`
    }
    return applyFormat(resolved, format)
  })

  const text = rendered.replaceAll(escapedOpen, '{').replaceAll(escapedClose, '}')
  const copyText = text
    .replace(/«empty:[a-z0-9-]+»/g, '')
    .replaceAll(/«unknown:([a-z0-9-]+)»/g, 'unknown-$1')

  return { text, copyText, issues }
}

export function collectSectionProblems(sections: Section[]): string[] {
  const problems: string[] = []
  const seen = new Set<string>()

  for (const section of sections) {
    if (!section.key.trim()) {
      problems.push('Section key cannot be empty.')
      continue
    }
    if (!isValidSectionKey(section.key)) {
      problems.push(
        `Invalid section key "${section.key}". Use lowercase letters, numbers, and dashes.`,
      )
    }
    if (seen.has(section.key)) {
      problems.push(`Duplicate section key "${section.key}".`)
    }
    seen.add(section.key)
  }

  return problems
}

export function markdownToSafeHtml(markdown: string): string {
  const escaped = escapeHtml(markdown)
  const lines = escaped.split('\n')
  const html: string[] = []
  let inList = false

  for (const line of lines) {
    if (line.startsWith('### ')) {
      closeList()
      html.push(`<h3>${inlineMarkdown(line.slice(4))}</h3>`)
    } else if (line.startsWith('## ')) {
      closeList()
      html.push(`<h2>${inlineMarkdown(line.slice(3))}</h2>`)
    } else if (line.startsWith('# ')) {
      closeList()
      html.push(`<h1>${inlineMarkdown(line.slice(2))}</h1>`)
    } else if (line.startsWith('- ')) {
      if (!inList) {
        html.push('<ul>')
        inList = true
      }
      html.push(`<li>${inlineMarkdown(line.slice(2))}</li>`)
    } else if (!line.trim()) {
      closeList()
    } else {
      closeList()
      html.push(`<p>${inlineMarkdown(line)}</p>`)
    }
  }

  closeList()
  return html.join('')

  function closeList() {
    if (inList) {
      html.push('</ul>')
      inList = false
    }
  }
}

function inlineMarkdown(value: string): string {
  return value
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
}

const HTML_ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#039;',
}
const HTML_ESCAPE_REGEXP = /[&<>"']/g

function escapeHtml(value: string): string {
  return value.replace(HTML_ESCAPE_REGEXP, (char) => HTML_ESCAPES[char] || char)
}

// All supported format modifiers for display in the format reference modal
export const FORMAT_REFERENCE = [
  { format: 'lowercase', example: 'Hello World', result: 'hello world', desc: 'All lowercase' },
  { format: 'uppercase', example: 'Hello World', result: 'HELLO WORLD', desc: 'All uppercase' },
  {
    format: 'capitalized',
    example: 'hello world',
    result: 'Hello World',
    desc: 'First letter of each word capitalized',
  },
  {
    format: 'trim',
    example: '  hello  ',
    result: 'hello',
    desc: 'Remove leading and trailing spaces',
  },
]
