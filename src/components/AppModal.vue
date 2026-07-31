<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue'

const props = defineProps<{
  isOpen: boolean
  labelledBy: string
  contentClass?: string
}>()

const emit = defineEmits<{ close: [] }>()

const dialog = ref<HTMLDialogElement | null>(null)

watch(
  () => props.isOpen,
  (open) => {
    const el = dialog.value
    if (!el) return
    if (open && !el.open) el.showModal()
    else if (!open && el.open) el.close()
  },
  { flush: 'post' },
)

onBeforeUnmount(() => {
  if (dialog.value?.open) dialog.value.close()
})
</script>

<template>
  <dialog
    ref="dialog"
    class="app-dialog"
    :aria-labelledby="labelledBy"
    @cancel.prevent="emit('close')"
    @click.self="emit('close')"
  >
    <div class="modal-content" :class="contentClass">
      <slot />
    </div>
  </dialog>
</template>
