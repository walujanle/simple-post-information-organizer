<script setup lang="ts">
import { ref } from 'vue'
import AppIcon from '@/components/AppIcon.vue'
import AppModal from '@/components/AppModal.vue'
import { FORMAT_REFERENCE } from '@/domain/render'
import type { Section } from '@/domain/types'

defineProps<{
  getRowKey: (item: object, prefix: string) => string
  sections: Section[]
  sortedSections: Section[]
  sectionProblems: string[]
}>()

const emit = defineEmits<{
  add: []
  remove: [section: Section]
  updateKey: [section: Section, value: string]
  updateValue: [section: Section, value: string]
  moveUp: [section: Section]
  moveDown: [section: Section]
}>()

const showFormatModal = ref(false)
</script>

<template>
  <div class="panel">
    <div class="panel-heading">
      <div>
        <p class="eyebrow">Tokens</p>
        <h2 class="section-title">Sections</h2>
      </div>
      <div class="flex items-center gap-2">
        <button
          class="button"
          type="button"
          title="View format modifiers"
          @click="showFormatModal = true"
        >
          <AppIcon name="code" />
          <span class="hidden sm:inline">Formats</span>
        </button>
        <button class="button" type="button" @click="emit('add')">
          <AppIcon name="plus" />
          <span>Add section</span>
        </button>
      </div>
    </div>

    <!-- Format reference modal -->
    <AppModal
      :is-open="showFormatModal"
      labelled-by="format-modal-title"
      @close="showFormatModal = false"
    >
        <div class="modal-header">
          <h2 id="format-modal-title" class="section-title">Format Modifiers</h2>
          <button
            class="icon-button"
            type="button"
            aria-label="Close"
            @click="showFormatModal = false"
          >
            <AppIcon name="x-mark" />
          </button>
        </div>
        <div class="modal-body space-y-4">
          <p class="text-sm text-(--color-muted)">
            Use <code class="token">&#123;key:format&#125;</code> in body text to apply a format to a section value.
            Section values can also reference other sections using <code class="token">&#123;key&#125;</code>.
          </p>
          <div class="space-y-3">
            <div
              v-for="item in FORMAT_REFERENCE"
              :key="item.format"
              class="rounded-lg border border-(--color-border) bg-(--color-soft) p-3"
            >
              <div class="flex items-center justify-between gap-3 mb-1">
                <code class="token font-bold">:{{ item.format }}</code>
                <span class="text-xs text-(--color-muted)">{{ item.desc }}</span>
              </div>
              <div class="flex items-center gap-2 text-sm">
                <span class="text-(--color-muted)">{{ item.example }}</span>
                <AppIcon name="arrow-path" class="icon-sm shrink-0 text-(--color-muted)" />
                <span class="font-semibold">{{ item.result }}</span>
              </div>
            </div>
          </div>
          <div class="rounded-lg border border-(--color-border) bg-(--color-soft) p-3 text-sm space-y-1">
            <p class="font-semibold">Variable interpolation</p>
            <p class="text-(--color-muted)">Section values can reference other sections:</p>
            <code class="token block">name = John</code>
            <code class="token block">greeting = Hello, &#123;name&#125;!</code>
            <p class="text-(--color-muted) text-xs">Cycles are detected and left unexpanded.</p>
          </div>
        </div>
    </AppModal>

    <div v-if="!sections.length" class="empty-state mt-4">
      <div class="empty-icon">
        <AppIcon name="document" />
      </div>
      <p class="font-semibold">No sections yet</p>
      <p class="text-sm text-(--color-muted)">
        Create sections to define reusable values for filename and post templates.
      </p>
    </div>

    <template v-else>
      <div v-if="sectionProblems.length" class="mt-4 space-y-1">
        <p
          v-for="(problem, idx) in sectionProblems"
          :key="idx"
          class="text-xs text-(--color-danger) flex items-center gap-1.5"
        >
          <AppIcon name="x-mark" />
          {{ problem }}
        </p>
      </div>

      <div class="mt-4">
        <!-- Desktop table view -->
        <div class="overflow-x-auto hidden md:block">
          <table class="w-full border-separate border-spacing-y-2 table-fixed">
            <thead class="text-left text-xs uppercase tracking-widest text-(--color-muted)">
              <tr>
                <th class="w-24 pb-1"></th>
                <th class="w-1/3 lg:w-1/4 pb-1">Key</th>
                <th class="pb-1">Value</th>
                <th class="w-12 pb-1"></th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="(section, idx) in sortedSections"
                :key="getRowKey(section, 'section')"
              >
                <td class="pr-1">
                  <div class="flex gap-1">
                    <button
                      class="icon-button"
                      type="button"
                      aria-label="Move up"
                      :disabled="idx === 0"
                      @click="emit('moveUp', section)"
                    >
                      <AppIcon name="arrow-up-tray" />
                    </button>
                    <button
                      class="icon-button"
                      type="button"
                      aria-label="Move down"
                      :disabled="idx === sortedSections.length - 1"
                      @click="emit('moveDown', section)"
                    >
                      <AppIcon name="arrow-down-tray" />
                    </button>
                  </div>
                </td>
                <td class="pr-3">
                  <input
                    :value="section.key"
                    class="control w-full"
                    :aria-label="`Section ${idx + 1} key`"
                    @input="emit('updateKey', section, ($event.target as HTMLInputElement).value)"
                  />
                </td>
                <td class="pr-3">
                  <input
                    :value="section.value"
                    class="control w-full"
                    :aria-label="`Section ${idx + 1} value`"
                    @input="emit('updateValue', section, ($event.target as HTMLInputElement).value)"
                  />
                </td>
                <td>
                  <button
                    class="icon-button danger"
                    type="button"
                    aria-label="Remove section"
                    @click="emit('remove', section)"
                  >
                    <AppIcon name="trash" />
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Mobile card view -->
        <div class="space-y-3 md:hidden">
          <div
            v-for="(section, idx) in sortedSections"
            :key="getRowKey(section, 'section-m')"
            class="section-mobile-card"
          >
            <div class="flex items-center justify-between mb-2">
              <div class="flex items-center gap-1">
                <button
                  class="icon-button"
                  type="button"
                  aria-label="Move up"
                  :disabled="idx === 0"
                  @click="emit('moveUp', section)"
                >
                  <AppIcon name="arrow-up-tray" />
                </button>
                <button
                  class="icon-button"
                  type="button"
                  aria-label="Move down"
                  :disabled="idx === sortedSections.length - 1"
                  @click="emit('moveDown', section)"
                >
                  <AppIcon name="arrow-down-tray" />
                </button>
              </div>
              <button
                class="icon-button danger"
                type="button"
                aria-label="Remove section"
                @click="emit('remove', section)"
              >
                <AppIcon name="trash" />
              </button>
            </div>
            <div class="space-y-3">
              <div>
                <label class="field-label text-[0.7rem] block mb-1" :for="`${getRowKey(section, 'section-m')}-key`">Key</label>
                <input
                  :id="`${getRowKey(section, 'section-m')}-key`"
                  :value="section.key"
                  class="control w-full text-sm"
                  @input="emit('updateKey', section, ($event.target as HTMLInputElement).value)"
                />
              </div>
              <div>
                <label class="field-label text-[0.7rem] block mb-1" :for="`${getRowKey(section, 'section-m')}-value`">Value</label>
                <input
                  :id="`${getRowKey(section, 'section-m')}-value`"
                  :value="section.value"
                  class="control w-full text-sm"
                  @input="emit('updateValue', section, ($event.target as HTMLInputElement).value)"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>