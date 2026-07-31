<script setup lang="ts">
import { ref } from 'vue'
import AppIcon from '@/components/AppIcon.vue'

defineProps<{
  bodyText: string
  renderedBodyCopySource: string
  renderedBodyHtml: string
  renderedBodySource: string
}>()

const emit = defineEmits<{
  updateBody: [value: string]
  copyRaw: []
  copyRendered: []
  download: []
}>()

const activeSubTab = ref<'write' | 'preview'>('write')
</script>

<template>
  <div class="panel">
    <div class="panel-heading flex-col items-start md:flex-row md:items-center text-left">
      <div class="w-full text-left md:w-auto">
        <p class="eyebrow">Post</p>
        <h2 class="section-title">Body text</h2>
      </div>
      <div class="toolbar flex-wrap gap-1.5 w-full md:w-auto mt-2 md:mt-0 justify-start">
        <button
          class="button flex-1 md:flex-initial"
          type="button"
          :disabled="!renderedBodyCopySource"
          @click="emit('copyRendered')"
        >
          <AppIcon name="eye" />
          <span class="hidden sm:inline">Copy rendered</span>
          <span class="sm:hidden">Rendered</span>
        </button>
        <button
          class="button flex-1 md:flex-initial"
          type="button"
          :disabled="!renderedBodyCopySource"
          @click="emit('copyRaw')"
        >
          <AppIcon name="code" />
          <span class="hidden sm:inline">Copy raw</span>
          <span class="sm:hidden">Raw</span>
        </button>
        <button
          class="button button-primary flex-1 md:flex-initial"
          type="button"
          :disabled="!renderedBodyCopySource"
          @click="emit('download')"
        >
          <AppIcon name="arrow-down-tray" />
          <span class="hidden sm:inline">Download</span>
          <span class="sm:hidden">Save</span>
        </button>
      </div>
    </div>

    <!-- Mobile sub-tabs for Write vs Preview -->
    <div class="flex border border-(--color-border) rounded-lg p-0.5 bg-(--color-soft) lg:hidden w-full mt-3">
      <button
        class="flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-semibold rounded-md transition-all"
        :class="activeSubTab === 'write' ? 'bg-(--color-panel) text-(--color-fg) shadow-sm' : 'text-(--color-muted)'"
        type="button"
        @click="activeSubTab = 'write'"
      >
        Write
      </button>
      <button
        class="flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-semibold rounded-md transition-all"
        :class="activeSubTab === 'preview' ? 'bg-(--color-panel) text-(--color-fg) shadow-sm' : 'text-(--color-muted)'"
        type="button"
        @click="activeSubTab = 'preview'"
      >
        Preview
      </button>
    </div>

    <!-- Body panels -->
    <div class="mt-3 grid lg:grid-cols-2 gap-3">
      <!-- Write view -->
      <div
        :class="activeSubTab === 'write' ? 'flex' : 'hidden lg:flex'"
        class="subpanel flex-col min-w-0 min-h-0 h-64 sm:h-80 lg:h-112"
      >
        <div class="mb-3 flex shrink-0 items-center justify-between gap-3 border-b border-(--color-border) pb-2">
          <h3 class="text-sm font-semibold uppercase tracking-widest text-(--color-muted)">Write</h3>
          <AppIcon name="code" />
        </div>
        <textarea
          class="flex-1 min-h-0 w-full resize-none bg-transparent font-mono text-sm leading-relaxed outline-none whitespace-pre-wrap break-words overflow-y-auto placeholder:text-(--color-muted)"
          placeholder="Write your body text here. Use {token} to reference section values."
          :value="bodyText"
          @input="emit('updateBody', ($event.target as HTMLTextAreaElement).value)"
        ></textarea>
      </div>

      <!-- Preview view -->
      <div
        :class="activeSubTab === 'preview' ? 'flex' : 'hidden lg:flex'"
        class="subpanel flex-col min-w-0 min-h-0 h-64 sm:h-80 lg:h-112"
      >
        <div class="mb-3 flex shrink-0 items-center justify-between gap-3 border-b border-(--color-border) pb-2">
          <h3 class="text-sm font-semibold uppercase tracking-widest text-(--color-muted)">Preview</h3>
          <AppIcon name="eye" />
        </div>
        <div
          v-if="renderedBodySource"
          class="markdown-preview flex-1 min-h-0 overflow-y-auto pr-1 break-words break-all"
          v-html="renderedBodyHtml"
        ></div>
        <div v-else class="empty-state flex-1 flex flex-col justify-center min-h-48 border-none">
          <div class="empty-icon"><AppIcon name="eye" /></div>
          <p class="font-semibold text-sm">Preview</p>
          <p class="text-xs text-(--color-muted)">Rendered output appears here.</p>
        </div>
      </div>
    </div>
  </div>
</template>