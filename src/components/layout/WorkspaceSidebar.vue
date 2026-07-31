<script setup lang="ts">
import AppIcon from '@/components/AppIcon.vue'
import type { CloudServerStatus, DataSource, ImportMode, PresetMeta } from '@/domain/types'

defineProps<{
  mode?: 'presets' | 'cloud'
  activePresetId?: string
  activeSource: DataSource
  cloudHealthy: boolean
  isAuthenticated: boolean
  currentUser?: string
  cloudServerStatus?: CloudServerStatus
  importMode: ImportMode
  presets: PresetMeta[]
}>()

const emit = defineEmits<{
  backup: []
  deletePreset: [id: string]
  loadPreset: [id: string]
  pullCloudToLocal: []
  pushLocalToCloud: []
  restore: []
  updateImportMode: [mode: ImportMode]
  openPresetsModal: []
  openAuthModal: [mode: 'login' | 'register' | 'change-password']
  logout: []
}>()
</script>

<template>
  <aside class="space-y-4 lg:sticky lg:top-28 lg:max-h-[calc(100vh-8rem)] lg:overflow-auto">
    <!-- Workspace Presets Panel -->
    <section v-if="!mode || mode === 'presets'" class="panel panel-compact">
      <div class="panel-heading">
        <div>
          <p class="eyebrow">Workspace</p>
          <h2 class="section-title">Presets</h2>
        </div>
        <span class="badge badge-strong">
          <AppIcon :name="activeSource === 'cloud' ? 'cloud' : 'folder'" />
          {{ activeSource }}
        </span>
      </div>

      <div class="mt-4">
        <button class="button button-primary w-full" type="button" @click="emit('openPresetsModal')">
          <AppIcon name="archive" />
          <span>Manage Presets ({{ presets.length }})</span>
        </button>
      </div>
    </section>

    <!-- Backup & Restore Panel -->
    <section v-if="!mode || mode === 'presets'" class="panel panel-compact">
      <div class="panel-heading">
        <div>
          <p class="eyebrow">Data</p>
          <h2 class="section-title">Backup &amp; restore</h2>
        </div>
        <span class="badge badge-strong">
          <AppIcon name="archive" />
          JSON
        </span>
      </div>

      <div class="mt-4 grid grid-cols-2 gap-2">
        <button class="button" type="button" @click="emit('backup')">
          <AppIcon name="arrow-down-tray" />
          <span>Backup</span>
        </button>
        <button class="button" type="button" @click="emit('restore')">
          <AppIcon name="arrow-up-tray" />
          <span>Restore</span>
        </button>
        <select
          class="control col-span-2"
          aria-label="Import mode"
          :value="importMode"
          @change="emit('updateImportMode', ($event.target as HTMLSelectElement).value as ImportMode)"
        >
          <option value="merge">Import mode: merge</option>
          <option value="replace">Import mode: replace + safety backup</option>
        </select>
      </div>
    </section>

    <!-- Cloud Account Panel -->
    <section v-if="!mode || mode === 'cloud'" class="panel panel-compact">
      <div class="panel-heading">
        <div>
          <p class="eyebrow">Cloud</p>
          <h2 class="section-title">Account</h2>
        </div>
        <span class="badge badge-strong">
          <AppIcon name="server" />
          {{ cloudHealthy ? 'Online' : 'Offline' }}
        </span>
      </div>

      <div class="mt-4 space-y-3">
        <!-- Not Authenticated State -->
        <template v-if="!isAuthenticated">
          <p class="text-xs leading-5 text-(--color-muted)">
            Connect to cloud storage to synchronize presets across devices.
          </p>
          <button
            class="button button-primary w-full"
            type="button"
            @click="emit('openAuthModal', 'login')"
          >
            <AppIcon name="cloud" />
            <span>Sign In to Cloud</span>
          </button>
        </template>

        <!-- Authenticated State -->
        <template v-else>
          <div class="text-xs space-y-1 bg-(--color-soft) p-2.5 rounded-lg border border-(--color-border)">
            <p class="font-semibold text-(--color-fg)">
              User: <span class="font-mono">{{ currentUser }}</span>
            </p>
            <p v-if="cloudServerStatus?.version" class="text-[10px] text-(--color-muted)">
              Server v{{ cloudServerStatus.version }}
            </p>
          </div>

          <div class="grid grid-cols-2 gap-2">
            <button
              class="button text-xs"
              type="button"
              @click="emit('openAuthModal', 'change-password')"
            >
              <span>Password</span>
            </button>
            <button
              class="button text-xs"
              type="button"
              @click="emit('logout')"
            >
              <span>Sign Out</span>
            </button>
          </div>
        </template>
      </div>
    </section>

    <!-- Sync Transfer Panel -->
    <section v-if="(!mode || mode === 'cloud') && isAuthenticated" class="panel panel-compact">
      <div class="panel-heading">
        <div>
          <p class="eyebrow">Sync</p>
          <h2 class="section-title">Transfer</h2>
        </div>
        <AppIcon name="arrow-path" />
      </div>
      <div class="mt-4 grid gap-2">
        <button class="button" type="button" :disabled="!cloudHealthy" @click="emit('pushLocalToCloud')">
          <AppIcon name="arrow-up-tray" />
          <span>Push Local → Cloud</span>
        </button>
        <button class="button" type="button" :disabled="!cloudHealthy" @click="emit('pullCloudToLocal')">
          <AppIcon name="arrow-down-tray" />
          <span>Pull Cloud → Local</span>
        </button>
      </div>
    </section>
  </aside>
</template>
