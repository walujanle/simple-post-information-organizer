import { computed, onScopeDispose, reactive, ref, watch } from 'vue'
import { MAX_BODY_CHARS, PREVIEW_DEBOUNCE_MS } from '@/config/constants'
import { collectSectionProblems, markdownToSafeHtml, renderTemplate } from '@/domain/render'
import type { Preset, Section } from '@/domain/types'

const rowKeys = new WeakMap<object, string>()
let nextKeyId = 1
function nextRowKey(item: object, prefix: string): string {
  let key = rowKeys.get(item)
  if (!key) {
    key = `${prefix}-${nextKeyId++}`
    rowKeys.set(item, key)
  }
  return key
}

function createDefaultPreset(): Preset {
  const now = new Date().toISOString()
  return {
    id: crypto.randomUUID(),
    name: '',
    sections: [],
    bodyBlocks: [],
    createdAt: now,
    updatedAt: now,
  }
}

function createSection(sort: number): Section {
  return { key: '', value: '', sort }
}

interface RenderInput {
  body: string
  sections: Section[]
}

export function useDocumentEditor() {
  const documentPreset = reactive<Preset>(createDefaultPreset())

  const sortedSections = computed(() =>
    [...documentPreset.sections].sort((a, b) => a.sort - b.sort),
  )
  const tokenList = computed(() => sortedSections.value.map((s: Section) => `{${s.key}}`))

  const bodyText = computed<string>({
    get: () => documentPreset.bodyBlocks[0]?.contentMd ?? '',
    set: (val: string) => {
      const truncated = val.slice(0, MAX_BODY_CHARS)
      if (documentPreset.bodyBlocks.length === 0) {
        documentPreset.bodyBlocks.push({ label: '', contentMd: truncated, sort: 0 })
      } else {
        const block = documentPreset.bodyBlocks[0]
        if (block) block.contentMd = truncated
      }
    },
  })

  function snapshot(): RenderInput {
    return {
      body: bodyText.value,
      sections: documentPreset.sections.map((s) => ({ key: s.key, value: s.value, sort: s.sort })),
    }
  }

  // The preview is debounced because renderTemplate + markdownToSafeHtml both walk
  // the whole body (up to MAX_BODY_CHARS) and would otherwise run on every
  // keystroke. The textarea itself stays bound synchronously, so typing never lags.
  const renderInput = ref<RenderInput>(snapshot())
  let timer: ReturnType<typeof setTimeout> | undefined

  function commitRenderInput(): void {
    clearTimeout(timer)
    renderInput.value = snapshot()
  }

  watch(
    () => [
      bodyText.value,
      documentPreset.sections.map((s) => `${s.key}\u0000${s.value}\u0000${s.sort}`).join('\u0001'),
    ],
    () => {
      clearTimeout(timer)
      timer = setTimeout(() => {
        renderInput.value = snapshot()
      }, PREVIEW_DEBOUNCE_MS)
    },
  )

  onScopeDispose(() => clearTimeout(timer))

  const renderResult = computed(() => {
    const { body, sections } = renderInput.value
    if (!body) return { text: '', copyText: '', issues: [] }
    return renderTemplate(body, { sections })
  })

  const renderedBodySource = computed(() => renderResult.value.text)
  const renderedBodyCopySource = computed(() => renderResult.value.copyText)
  const renderedBodyHtml = computed(() => markdownToSafeHtml(renderedBodySource.value))
  const sectionProblems = computed(() => collectSectionProblems(documentPreset.sections))
  const allProblems = computed(() => sectionProblems.value)

  function addSection(): void {
    const maxSort = documentPreset.sections.reduce((max, s) => Math.max(max, s.sort), -1)
    documentPreset.sections.push(createSection(maxSort + 1))
  }

  function removeSection(section: Section): void {
    const index = documentPreset.sections.indexOf(section)
    if (index >= 0) documentPreset.sections.splice(index, 1)
  }

  function updateSectionKey(section: Section, value: string): void {
    section.key = value.toLowerCase().replace(/[^a-z0-9-]/g, '')
  }

  function updateSectionValue(section: Section, value: string): void {
    section.value = value
  }

  function moveSectionUp(section: Section): void {
    const sorted = sortedSections.value
    const idx = sorted.indexOf(section)
    if (idx <= 0) return
    const prev = sorted[idx - 1]
    const tmp = section.sort
    section.sort = prev.sort
    prev.sort = tmp
  }

  function moveSectionDown(section: Section): void {
    const sorted = sortedSections.value
    const idx = sorted.indexOf(section)
    if (idx < 0 || idx >= sorted.length - 1) return
    const next = sorted[idx + 1]
    const tmp = section.sort
    section.sort = next.sort
    next.sort = tmp
  }

  function replaceDocument(preset: Preset): void {
    documentPreset.id = preset.id
    documentPreset.name = preset.name ?? ''
    documentPreset.sections = preset.sections
    documentPreset.bodyBlocks = preset.bodyBlocks
    documentPreset.createdAt = preset.createdAt
    documentPreset.updatedAt = preset.updatedAt
    commitRenderInput()
  }

  return {
    documentPreset,
    sortedSections,
    bodyText,
    tokenList,
    renderedBodyHtml,
    renderedBodySource,
    renderedBodyCopySource,
    sectionProblems,
    allProblems,
    getRowKey: nextRowKey,
    addSection,
    removeSection,
    updateSectionKey,
    updateSectionValue,
    moveSectionUp,
    moveSectionDown,
    replaceDocument,
  }
}
