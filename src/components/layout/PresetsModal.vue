<script setup lang="ts">
import { computed, ref } from 'vue'
import AppIcon from '@/components/AppIcon.vue'
import AppModal from '@/components/AppModal.vue'
import type { DataSource, PresetMeta } from '@/domain/types'

const props = defineProps<{
  isOpen: boolean
  presets: PresetMeta[]
  activePresetId?: string
  activeSource: DataSource
}>()

const emit = defineEmits<{
  close: []
  loadPreset: [id: string]
  deletePreset: [id: string]
}>()

const searchQuery = ref('')
const confirmDeleteId = ref<string | null>(null)

const filteredPresets = computed(() => {
  const query = searchQuery.value.trim().toLowerCase()
  if (!query) return props.presets
  return props.presets.filter((p) => {
    if (p.id.toLowerCase().includes(query)) return true
    if (p.name?.toLowerCase().includes(query)) return true
    if (p.sectionKeys?.some((k: string) => k.toLowerCase().includes(query))) return true
    return false
  })
})

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

function handleSelect(id: string) {
  emit('loadPreset', id)
  emit('close')
}

function handleClose() {
  confirmDeleteId.value = null
  emit('close')
}
</script>

<template>
  <AppModal :is-open="isOpen" labelled-by="presets-modal-title" @close="handleClose">
      <div class="modal-header">
        <div>
          <h2 id="presets-modal-title" class="section-title text-base font-bold flex items-center gap-2">
            <AppIcon name="archive" />
            <span>Manage Presets</span>
          </h2>
          <p class="text-xs text-(--color-muted) mt-0.5">
            Loaded from
            <span class="font-semibold text-(--color-fg) capitalize">{{ activeSource }}</span>
            storage
          </p>
        </div>
        <button class="icon-button" type="button" aria-label="Close modal" @click="handleClose">
          <AppIcon name="x-mark" />
        </button>
      </div>

      <div class="modal-body space-y-4">
        <!-- Search filter -->
        <div>
          <label class="sr-only" for="preset-search">Search presets</label>
          <input
            id="preset-search"
            v-model="searchQuery"
            class="control w-full"
            placeholder="Search by preset ID or section key..."
          />
        </div>

        <!-- Presets list -->
        <div v-if="filteredPresets.length" class="space-y-2 max-h-96 overflow-y-auto">
          <article
            v-for="preset in filteredPresets"
            :key="preset.id"
            class="preset-item"
            :class="{ 'preset-item-active': preset.id === activePresetId }"
          >
            <button class="grid min-w-0 flex-1 gap-0.5 text-left" type="button" @click="handleSelect(preset.id)">
              <span class="truncate font-semibold text-xs text-(--color-fg)">{{ preset.name || 'Untitled Preset' }}</span>
              <span class="inline-flex items-center gap-2 text-[0.7rem] text-(--color-muted) font-mono truncate">
                ID: {{ preset.id }} · Updated: {{ formatDateTime(preset.updatedAt) }}
              </span>
            </button>

            <!-- Inline delete confirmation -->
            <div v-if="confirmDeleteId === preset.id" class="flex items-center gap-1.5 shrink-0">
              <span class="text-xs text-(--color-danger) font-semibold whitespace-nowrap">Delete?</span>
              <button
                class="button text-xs px-2 min-h-8"
                type="button"
                aria-label="Cancel delete"
                @click="confirmDeleteId = null"
              >
                Cancel
              </button>
              <button
                class="button button-danger text-xs px-2 min-h-8"
                type="button"
                aria-label="Confirm delete preset"
                @click="emit('deletePreset', preset.id); confirmDeleteId = null"
              >
                <AppIcon name="trash" />
                Delete
              </button>
            </div>
            <button
              v-else
              class="icon-button danger"
              type="button"
              aria-label="Delete preset"
              @click="confirmDeleteId = preset.id"
            >
              <AppIcon name="trash" />
            </button>
          </article>
        </div>

        <!-- Empty state -->
        <div v-else class="empty-state py-8">
          <div class="empty-icon"><AppIcon name="folder" /></div>
          <p class="font-semibold">No presets found</p>
          <p class="text-sm text-(--color-muted)">
            {{ searchQuery ? 'Try adjusting your search filter.' : 'Your presets will show up here.' }}
          </p>
        </div>
      </div>

      <div class="modal-footer">
        <button class="button" type="button" @click="handleClose">Close</button>
      </div>
  </AppModal>
</template>
