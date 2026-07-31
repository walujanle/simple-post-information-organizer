<script setup lang="ts">
import { ref } from 'vue'
import AppIcon from '@/components/AppIcon.vue'
import AuthModal from '@/components/layout/AuthModal.vue'
import BodyPanel from '@/components/layout/BodyPanel.vue'
import PresetInfoPanel from '@/components/layout/PresetInfoPanel.vue'
import PresetsModal from '@/components/layout/PresetsModal.vue'
import SectionsPanel from '@/components/layout/SectionsPanel.vue'
import WorkspaceSidebar from '@/components/layout/WorkspaceSidebar.vue'
import { usePostInformationApp } from '@/composables/usePostInformationApp'
import type { DataSource, ThemePreference } from '@/domain/types'

const {
  activePresetId,
  activeSource,
  addSection,
  allProblems,
  bodyText,
  clearError,
  cloudHealthy,
  copyBodyRaw,
  copyBodyRendered,
  copyText,
  deletePreset,
  documentPreset,
  downloadBody,
  duplicatePreset,
  errorMessage,
  exportActiveSource,
  getRowKey,
  importActiveSource,
  importFile,
  importMode,
  loadPreset,
  newDocument,
  openImportPicker,
  presets,
  pullCloudToLocal,
  pushLocalToCloud,
  removeSection,
  renderedBodyCopySource,
  renderedBodyHtml,
  renderedBodySource,
  saveCurrentPreset,
  sectionProblems,
  settings,
  sortedSections,
  statusMessage,
  tokenList,
  updateSectionKey,
  updateSectionValue,
  moveSectionUp,
  moveSectionDown,
  updateSource,
  updateTheme,
  isAuthenticated,
  currentUser,
  authModalOpen,
  authModalMode,
  authError,
  isAuthLoading,
  cloudServerStatus,
  login,
  register,
  changePassword,
  logout,
} = usePostInformationApp()

const activeTab = ref<'editor' | 'workspace'>('editor')
const isPresetsModalOpen = ref(false)
const activeEditorTab = ref<'tokens' | 'body'>('tokens')
</script>

<template>
  <div class="min-h-screen bg-(--color-bg) text-(--color-fg)">
    <a
      href="#main-content"
      class="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:px-4 focus:py-2 focus:rounded-lg focus:bg-(--color-accent) focus:text-white focus:outline-none"
    >
      Skip to main content
    </a>

    <main
      id="main-content"
      class="mx-auto grid max-w-[100rem] gap-4 px-4 py-4 sm:gap-5 sm:px-6 lg:grid-cols-[18rem_1fr] xl:grid-cols-[18rem_1fr_18rem] lg:px-8 lg:py-5"
    >
      <header class="col-span-full panel flex flex-col gap-4">
        <div class="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div class="flex items-center justify-between w-full lg:w-auto">
            <div class="flex min-w-0 items-center gap-3">
              <div class="brand-mark shrink-0">
                <AppIcon name="document" />
              </div>
              <div class="min-w-0">
                <h1 class="truncate text-sm font-semibold tracking-tight sm:text-base lg:text-lg">
                  <span class="hidden sm:inline">Post Information Organizer</span>
                  <span class="sm:hidden">PIO</span>
                </h1>
              </div>
            </div>

            <!-- Mobile controls -->
            <div class="flex items-center gap-1.5 lg:hidden">
              <div class="segmented-field-compact">
                <AppIcon
                  :name="activeSource === 'cloud' ? 'cloud' : 'folder'"
                  class="icon-sm text-(--color-muted)"
                />
                <select
                  id="source-mobile"
                  class="control-ghost-compact text-xs font-bold"
                  :value="activeSource"
                  @change="updateSource(($event.target as HTMLSelectElement).value as DataSource)"
                >
                  <option value="local">Local</option>
                  <option value="cloud" :disabled="!cloudHealthy">Cloud</option>
                </select>
              </div>
              <div class="segmented-field-compact">
                <AppIcon
                  :name="settings.theme === 'dark' ? 'moon' : 'sun'"
                  class="icon-sm text-(--color-muted)"
                />
                <select
                  id="theme-mobile"
                  class="control-ghost-compact text-xs font-bold"
                  :value="settings.theme"
                  @change="updateTheme(($event.target as HTMLSelectElement).value as ThemePreference)"
                >
                  <option value="system">Sys</option>
                  <option value="light">Lt</option>
                  <option value="dark">Dk</option>
                </select>
              </div>
            </div>
          </div>

          <div class="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between lg:gap-4 w-full lg:w-auto">
            <div class="grid grid-cols-3 gap-2 sm:flex sm:items-center sm:gap-2 w-full sm:w-auto">
              <button class="button" type="button" @click="newDocument">
                <AppIcon name="plus" />
                <span class="truncate">New</span>
              </button>
              <button class="button" type="button" @click="duplicatePreset">
                <AppIcon name="duplicate" />
                <span class="truncate">Duplicate</span>
              </button>
              <button class="button button-primary" type="button" @click="saveCurrentPreset">
                <AppIcon name="check" />
                <span class="truncate">Save</span>
              </button>
            </div>

            <!-- Desktop controls -->
            <div class="hidden lg:flex lg:items-center lg:gap-3">
              <div class="segmented-field min-w-0">
                <label class="sr-only" for="source-desktop">Source</label>
                <AppIcon :name="activeSource === 'cloud' ? 'cloud' : 'folder'" />
                <select
                  id="source-desktop"
                  class="control control-ghost min-w-0 text-sm"
                  :value="activeSource"
                  @change="updateSource(($event.target as HTMLSelectElement).value as DataSource)"
                >
                  <option value="local">Local</option>
                  <option value="cloud" :disabled="!cloudHealthy">Cloud</option>
                </select>
              </div>

              <div class="segmented-field min-w-0">
                <label class="sr-only" for="theme-desktop">Theme</label>
                <AppIcon :name="settings.theme === 'dark' ? 'moon' : 'sun'" />
                <select
                  id="theme-desktop"
                  class="control control-ghost min-w-0 text-sm"
                  :value="settings.theme"
                  @change="updateTheme(($event.target as HTMLSelectElement).value as ThemePreference)"
                >
                  <option value="system">System</option>
                  <option value="light">Light</option>
                  <option value="dark">Dark</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        <!-- Status / Error Banner -->
        <div
          v-if="errorMessage || (statusMessage && statusMessage !== 'Ready.')"
          class="flex items-center justify-between border-t border-(--color-border) pt-3 text-xs w-full transition-all"
          :class="errorMessage ? 'text-(--color-danger)' : 'text-(--color-muted)'"
        >
          <span class="flex items-center gap-1.5">
            <AppIcon :name="errorMessage ? 'x-mark' : 'check'" class="icon-sm" />
            <span>{{ errorMessage || statusMessage }}</span>
          </span>
          <button
            v-if="errorMessage"
            class="underline font-bold text-xs hover:text-(--color-fg) cursor-pointer"
            type="button"
            @click="clearError"
          >
            Dismiss
          </button>
        </div>
      </header>

      <!-- Mobile tab switcher -->
      <div class="col-span-full flex border-b border-(--color-border) gap-6 lg:hidden mb-2">
        <button
          class="pb-2.5 text-xs font-bold border-b-2 transition-all cursor-pointer flex items-center gap-1.5"
          :class="activeTab === 'editor' ? 'border-(--color-accent) text-(--color-fg)' : 'border-transparent text-(--color-muted)'"
          type="button"
          @click="activeTab = 'editor'"
        >
          <AppIcon name="document" />
          <span>Editor</span>
        </button>
        <button
          class="pb-2.5 text-xs font-bold border-b-2 transition-all cursor-pointer flex items-center gap-1.5"
          :class="activeTab === 'workspace' ? 'border-(--color-accent) text-(--color-fg)' : 'border-transparent text-(--color-muted)'"
          type="button"
          @click="activeTab = 'workspace'"
        >
          <AppIcon name="folder" />
          <span>Workspace</span>
        </button>
      </div>

      <!-- Column 1: Workspace sidebar (presets + backup/restore) -->
      <WorkspaceSidebar
        mode="presets"
        :class="[activeTab === 'workspace' ? 'block' : 'hidden lg:block', 'min-w-0']"
        :active-preset-id="activePresetId"
        :active-source="activeSource"
        :cloud-healthy="cloudHealthy"
        :is-authenticated="isAuthenticated"
        :current-user="currentUser"
        :cloud-server-status="cloudServerStatus"
        :import-mode="importMode"
        :presets="presets"
        @backup="exportActiveSource"
        @delete-preset="deletePreset"
        @load-preset="loadPreset"
        @pull-cloud-to-local="pullCloudToLocal"
        @push-local-to-cloud="pushLocalToCloud"
        @restore="openImportPicker"
        @update-import-mode="importMode = $event"
        @open-presets-modal="isPresetsModalOpen = true"
        @open-auth-modal="authModalMode = $event; authModalOpen = true"
        @logout="logout"
      />

      <!-- Column 2: Main editor -->
      <section
        :class="[activeTab === 'editor' ? 'block' : 'hidden lg:block', 'lg:row-span-2 xl:row-span-1 min-w-0']"
        class="space-y-4"
      >
        <div class="flex border-b border-(--color-border) gap-6 w-full mb-2">
          <button
            class="pb-2.5 text-xs font-semibold border-b-2 transition-all cursor-pointer flex items-center gap-1.5"
            :class="activeEditorTab === 'tokens' ? 'border-(--color-accent) text-(--color-fg)' : 'border-transparent text-(--color-muted) hover:text-(--color-fg)'"
            type="button"
            @click="activeEditorTab = 'tokens'"
          >
            <AppIcon name="document" />
            <span>
              <span class="hidden sm:inline">Tokens &amp; Sections</span>
              <span class="sm:hidden">Tokens</span>
            </span>
          </button>
          <button
            class="pb-2.5 text-xs font-semibold border-b-2 transition-all cursor-pointer flex items-center gap-1.5"
            :class="activeEditorTab === 'body' ? 'border-(--color-accent) text-(--color-fg)' : 'border-transparent text-(--color-muted) hover:text-(--color-fg)'"
            type="button"
            @click="activeEditorTab = 'body'"
          >
            <AppIcon name="code" />
            <span>
              <span class="hidden sm:inline">Body Text &amp; Preview</span>
              <span class="sm:hidden">Body</span>
            </span>
          </button>
        </div>

        <div v-show="activeEditorTab === 'tokens'" class="space-y-4">
          <PresetInfoPanel
            :active-preset-id="activePresetId"
            :preset-name="documentPreset.name"
            :token-list="tokenList"
            @copy-token="copyText"
            @update-preset-name="documentPreset.name = $event"
          />
          <SectionsPanel
            :get-row-key="getRowKey"
            :sections="documentPreset.sections"
            :sorted-sections="sortedSections"
            :section-problems="sectionProblems"
            @add="addSection"
            @remove="removeSection"
            @update-key="updateSectionKey"
            @update-value="updateSectionValue"
            @move-up="moveSectionUp"
            @move-down="moveSectionDown"
          />
        </div>

        <div v-show="activeEditorTab === 'body'">
          <BodyPanel
            :body-text="bodyText"
            :rendered-body-copy-source="renderedBodyCopySource"
            :rendered-body-html="renderedBodyHtml"
            :rendered-body-source="renderedBodySource"
            @update-body="bodyText = $event"
            @copy-raw="copyBodyRaw"
            @copy-rendered="copyBodyRendered"
            @download="downloadBody"
          />
        </div>
      </section>

      <!-- Column 3: Cloud sidebar -->
      <WorkspaceSidebar
        mode="cloud"
        :class="[activeTab === 'workspace' ? 'block' : 'hidden lg:block', 'min-w-0']"
        :active-preset-id="activePresetId"
        :active-source="activeSource"
        :cloud-healthy="cloudHealthy"
        :is-authenticated="isAuthenticated"
        :current-user="currentUser"
        :cloud-server-status="cloudServerStatus"
        :import-mode="importMode"
        :presets="presets"
        @backup="exportActiveSource"
        @delete-preset="deletePreset"
        @load-preset="loadPreset"
        @pull-cloud-to-local="pullCloudToLocal"
        @push-local-to-cloud="pushLocalToCloud"
        @restore="openImportPicker"
        @update-import-mode="importMode = $event"
        @open-presets-modal="isPresetsModalOpen = true"
        @open-auth-modal="authModalMode = $event; authModalOpen = true"
        @logout="logout"
      />
    </main>

    <!-- Hidden file input for import -->
    <input
      ref="importFile"
      class="sr-only"
      type="file"
      accept="application/json"
      @change="importActiveSource"
    />

    <PresetsModal
      :is-open="isPresetsModalOpen"
      :presets="presets"
      :active-preset-id="activePresetId"
      :active-source="activeSource"
      @close="isPresetsModalOpen = false"
      @load-preset="loadPreset"
      @delete-preset="deletePreset"
    />

    <AuthModal
      :is-open="authModalOpen"
      :mode="authModalMode"
      :error="authError"
      :is-loading="isAuthLoading"
      @close="authModalOpen = false"
      @login="login"
      @register="register"
      @change-password="changePassword"
      @update-mode="authModalMode = $event"
    />
  </div>
</template>
