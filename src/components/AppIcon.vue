<script setup lang="ts">
type IconName =
  | 'archive'
  | 'arrow-down-tray'
  | 'arrow-path'
  | 'arrow-up-tray'
  | 'check'
  | 'clipboard'
  | 'cloud'
  | 'code'
  | 'document'
  | 'duplicate'
  | 'eye'
  | 'folder'
  | 'link'
  | 'moon'
  | 'plus'
  | 'server'
  | 'sparkles'
  | 'sun'
  | 'trash'
  | 'x-mark'

defineProps<{
  name: IconName
}>()
</script>

<template>
  <svg
    class="icon"
    aria-hidden="true"
    fill="none"
    stroke="currentColor"
    stroke-linecap="round"
    stroke-linejoin="round"
    stroke-width="1.8"
    viewBox="0 0 24 24"
  >
    <template v-if="name === 'archive'">
      <path d="M3.75 7.5h16.5" />
      <path d="M5.25 7.5v10.75A2.25 2.25 0 0 0 7.5 20.5h9a2.25 2.25 0 0 0 2.25-2.25V7.5" />
      <path d="M6.75 3.5h10.5a2 2 0 0 1 2 2v2h-14.5v-2a2 2 0 0 1 2-2Z" />
      <path d="M9.75 11.25h4.5" />
    </template>

    <template v-else-if="name === 'arrow-down-tray'">
      <path d="M12 3.75v10.5" />
      <path d="m8.25 10.5 3.75 3.75 3.75-3.75" />
      <path d="M4.5 16.5v2.25A1.75 1.75 0 0 0 6.25 20.5h11.5a1.75 1.75 0 0 0 1.75-1.75V16.5" />
    </template>

    <template v-else-if="name === 'arrow-path'">
      <path d="M19.5 12a7.5 7.5 0 0 1-12.8 5.3" />
      <path d="M6.5 20v-3.5H10" />
      <path d="M4.5 12A7.5 7.5 0 0 1 17.3 6.7" />
      <path d="M17.5 4v3.5H14" />
    </template>

    <template v-else-if="name === 'arrow-up-tray'">
      <path d="M12 14.25V3.75" />
      <path d="m8.25 7.5 3.75-3.75 3.75 3.75" />
      <path d="M4.5 16.5v2.25A1.75 1.75 0 0 0 6.25 20.5h11.5a1.75 1.75 0 0 0 1.75-1.75V16.5" />
    </template>

    <template v-else-if="name === 'check'">
      <path d="m5 12.5 4.25 4.25L19 7" />
    </template>

    <template v-else-if="name === 'clipboard'">
      <path d="M9 5.25A2.25 2.25 0 0 1 11.25 3h1.5A2.25 2.25 0 0 1 15 5.25" />
      <path d="M8.5 5.25h7A1.5 1.5 0 0 1 17 6.75v12A1.5 1.5 0 0 1 15.5 20.25h-7A1.5 1.5 0 0 1 7 18.75v-12A1.5 1.5 0 0 1 8.5 5.25Z" />
      <path d="M9.75 9.75h4.5" />
      <path d="M9.75 13h4.5" />
    </template>

    <template v-else-if="name === 'cloud'">
      <path d="M7.5 18.5h9.25a4 4 0 0 0 .6-7.95 6 6 0 0 0-11.3-1.85A4.75 4.75 0 0 0 7.5 18.5Z" />
    </template>

    <template v-else-if="name === 'code'">
      <path d="m9 8-4 4 4 4" />
      <path d="m15 8 4 4-4 4" />
    </template>

    <template v-else-if="name === 'document'">
      <path d="M7 3.75h6l4 4v12.5H7A2 2 0 0 1 5 18.25V5.75a2 2 0 0 1 2-2Z" />
      <path d="M13 3.75V8h4" />
      <path d="M8.5 12h7" />
      <path d="M8.5 15.25h5" />
    </template>

    <template v-else-if="name === 'duplicate'">
      <path d="M8 8.5h8.5v10H8z" />
      <path d="M5 15.5V5.5h8.5" />
    </template>

    <template v-else-if="name === 'eye'">
      <path d="M3 12s3.25-6 9-6 9 6 9 6-3.25 6-9 6-9-6-9-6Z" />
      <path d="M12 14.75a2.75 2.75 0 1 0 0-5.5 2.75 2.75 0 0 0 0 5.5Z" />
    </template>

    <template v-else-if="name === 'folder'">
      <path d="M3.75 7.25A2.25 2.25 0 0 1 6 5h4l2 2h6A2.25 2.25 0 0 1 20.25 9.25v7.5A2.25 2.25 0 0 1 18 19H6a2.25 2.25 0 0 1-2.25-2.25v-9.5Z" />
    </template>

    <template v-else-if="name === 'link'">
      <path d="M9.75 14.25 14.25 9.75" />
      <path d="M11 6.75 12.2 5.5a4 4 0 0 1 5.65 5.65L16.5 12.5" />
      <path d="M13 17.25 11.8 18.5a4 4 0 0 1-5.65-5.65L7.5 11.5" />
    </template>

    <template v-else-if="name === 'moon'">
      <path d="M20 14.5A7.75 7.75 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z" />
    </template>

    <template v-else-if="name === 'plus'">
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </template>

    <template v-else-if="name === 'server'">
      <path d="M5.75 4.5h12.5A1.75 1.75 0 0 1 20 6.25v3A1.75 1.75 0 0 1 18.25 11H5.75A1.75 1.75 0 0 1 4 9.25v-3A1.75 1.75 0 0 1 5.75 4.5Z" />
      <path d="M5.75 13h12.5A1.75 1.75 0 0 1 20 14.75v3a1.75 1.75 0 0 1-1.75 1.75H5.75A1.75 1.75 0 0 1 4 17.75v-3A1.75 1.75 0 0 1 5.75 13Z" />
      <path d="M7.5 7.75h.01" />
      <path d="M7.5 16.25h.01" />
    </template>

    <template v-else-if="name === 'sparkles'">
      <path d="M12 3.5 13.35 8 18 9.5l-4.65 1.5L12 15.5 10.65 11 6 9.5 10.65 8 12 3.5Z" />
      <path d="m18.5 14 .65 2.1 2.1.65-2.1.65-.65 2.1-.65-2.1-2.1-.65 2.1-.65.65-2.1Z" />
      <path d="m5.5 15 .5 1.6 1.6.5-1.6.5-.5 1.6-.5-1.6-1.6-.5 1.6-.5.5-1.6Z" />
    </template>

    <template v-else-if="name === 'sun'">
      <path d="M12 4V2.75" />
      <path d="M12 21.25V20" />
      <path d="M4 12H2.75" />
      <path d="M21.25 12H20" />
      <path d="m6.35 6.35-.9-.9" />
      <path d="m18.55 18.55-.9-.9" />
      <path d="m17.65 6.35.9-.9" />
      <path d="m5.45 18.55.9-.9" />
      <path d="M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" />
    </template>

    <template v-else-if="name === 'trash'">
      <path d="M5 7h14" />
      <path d="M9 7V5.25A1.25 1.25 0 0 1 10.25 4h3.5A1.25 1.25 0 0 1 15 5.25V7" />
      <path d="m7 7 .75 12A1.5 1.5 0 0 0 9.25 20.5h5.5A1.5 1.5 0 0 0 16.25 19L17 7" />
      <path d="M10 10.5v6" />
      <path d="M14 10.5v6" />
    </template>

    <template v-else-if="name === 'x-mark'">
      <path d="m6 6 12 12" />
      <path d="m18 6-12 12" />
    </template>
  </svg>
</template>
