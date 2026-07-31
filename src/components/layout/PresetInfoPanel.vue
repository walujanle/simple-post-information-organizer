<script setup lang="ts">
import AppIcon from '@/components/AppIcon.vue'

defineProps<{
  activePresetId?: string
  presetName: string
  tokenList: string[]
}>()

const emit = defineEmits<{
  copyToken: [token: string]
  updatePresetName: [value: string]
}>()
</script>

<template>
  <div class="panel">
    <div class="panel-heading">
      <div>
        <p class="eyebrow">Tokens</p>
        <h2 class="section-title">Available tokens</h2>
      </div>
      <span class="badge badge-strong">
        <AppIcon name="document" />
        {{ activePresetId ? 'Saved' : 'Draft' }}
      </span>
    </div>

    <div class="mt-4 space-y-3 border-b border-(--color-border) pb-4">
      <label class="field-label" for="preset-name">Preset Name</label>
      <input
        id="preset-name"
        class="control w-full text-sm"
        placeholder="Enter preset name (e.g. Blog Post)"
        :value="presetName"
        @input="emit('updatePresetName', ($event.target as HTMLInputElement).value)"
      />
    </div>

    <div class="mt-4">
      <div v-if="tokenList.length" class="flex flex-wrap gap-2">
        <button
          v-for="token in tokenList"
          :key="token"
          class="token"
          type="button"
          @click="emit('copyToken', token)"
        >
          <AppIcon name="clipboard" />
          {{ token }}
        </button>
      </div>
      <p v-else class="text-sm text-(--color-muted)">
        Add sections to generate copyable tokens.
      </p>
    </div>
  </div>
</template>
