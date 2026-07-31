<script setup lang="ts">
import { ref, watch } from 'vue'
import AppIcon from '@/components/AppIcon.vue'
import AppModal from '@/components/AppModal.vue'

const props = defineProps<{
  isOpen: boolean
  mode: 'login' | 'register' | 'change-password'
  error?: string
  isLoading?: boolean
}>()

const emit = defineEmits<{
  close: []
  login: [username: string, password: string]
  register: [username: string, password: string]
  changePassword: [current: string, newPass: string]
  updateMode: [mode: 'login' | 'register' | 'change-password']
}>()

const username = ref('')
const password = ref('')
const confirmPassword = ref('')

const currentPassword = ref('')
const newPassword = ref('')
const confirmNewPassword = ref('')

const localError = ref('')

watch(
  () => props.isOpen,
  (open) => {
    if (open) {
      resetForms()
    }
  },
)

watch(
  () => props.mode,
  () => {
    resetForms()
  },
)

function resetForms() {
  username.value = ''
  password.value = ''
  confirmPassword.value = ''
  currentPassword.value = ''
  newPassword.value = ''
  confirmNewPassword.value = ''
  localError.value = ''
}

function handleSubmit() {
  localError.value = ''

  if (props.mode === 'login') {
    if (!username.value.trim() || !password.value) {
      localError.value = 'Please enter both username and password.'
      return
    }
    emit('login', username.value.trim(), password.value)
  } else if (props.mode === 'register') {
    if (!username.value.trim() || !password.value || !confirmPassword.value) {
      localError.value = 'All fields are required.'
      return
    }
    if (username.value.trim().length > 64) {
      localError.value = 'Username must be at most 64 characters long.'
      return
    }
    if (password.value !== confirmPassword.value) {
      localError.value = 'Passwords do not match.'
      return
    }
    if (password.value.length < 6) {
      localError.value = 'Password must be at least 6 characters long.'
      return
    }
    emit('register', username.value.trim(), password.value)
  } else if (props.mode === 'change-password') {
    if (!currentPassword.value || !newPassword.value || !confirmNewPassword.value) {
      localError.value = 'All fields are required.'
      return
    }
    if (newPassword.value !== confirmNewPassword.value) {
      localError.value = 'New passwords do not match.'
      return
    }
    if (newPassword.value.length < 6) {
      localError.value = 'New password must be at least 6 characters long.'
      return
    }
    emit('changePassword', currentPassword.value, newPassword.value)
  }
}
</script>

<template>
  <AppModal
    :is-open="isOpen"
    labelled-by="auth-modal-title"
    content-class="max-w-sm"
    @close="emit('close')"
  >
      <div class="modal-header">
        <h2 id="auth-modal-title" class="section-title text-base font-bold flex items-center gap-2">
          <AppIcon :name="mode === 'change-password' ? 'check' : 'cloud'" />
          <span>
            {{
              mode === 'login'
                ? 'Cloud Login'
                : mode === 'register'
                  ? 'Create Account'
                  : 'Change Password'
            }}
          </span>
        </h2>
        <button
          class="icon-button"
          type="button"
          aria-label="Close modal"
          :disabled="isLoading"
          @click="emit('close')"
        >
          <AppIcon name="x-mark" />
        </button>
      </div>

      <form @submit.prevent="handleSubmit">
        <div class="modal-body space-y-4">
          <!-- Switch tabs only when not changing password -->
          <div v-if="mode !== 'change-password'" class="flex border-b border-(--color-border) pb-1">
            <button
              type="button"
              class="flex-1 py-1.5 text-center text-xs font-bold border-b-2 transition-all duration-150"
              :class="
                mode === 'login'
                  ? 'border-(--color-accent) text-(--color-fg)'
                  : 'border-transparent text-(--color-muted) hover:text-(--color-fg)'
              "
              :disabled="isLoading"
              @click="emit('updateMode', 'login')"
            >
              Sign In
            </button>
            <button
              type="button"
              class="flex-1 py-1.5 text-center text-xs font-bold border-b-2 transition-all duration-150"
              :class="
                mode === 'register'
                  ? 'border-(--color-accent) text-(--color-fg)'
                  : 'border-transparent text-(--color-muted) hover:text-(--color-fg)'
              "
              :disabled="isLoading"
              @click="emit('updateMode', 'register')"
            >
              Register
            </button>
          </div>

          <!-- Form Errors -->
          <div
            v-if="localError || error"
            class="text-xs p-2.5 rounded-lg border border-(--color-danger) bg-(--color-danger)/10 text-(--color-danger) font-medium"
          >
            {{ localError || error }}
          </div>

          <!-- Login/Register fields -->
          <template v-if="mode === 'login' || mode === 'register'">
            <div class="space-y-1.5">
              <label class="field-label" for="auth-username">Username</label>
              <input
                id="auth-username"
                v-model="username"
                class="control w-full"
                placeholder="Enter username"
                required
                autocomplete="username"
                :disabled="isLoading"
              />
            </div>

            <div class="space-y-1.5">
              <label class="field-label" for="auth-password">Password</label>
              <input
                id="auth-password"
                v-model="password"
                type="password"
                class="control w-full"
                placeholder="Enter password"
                required
                autocomplete="current-password"
                :disabled="isLoading"
              />
            </div>

            <div v-if="mode === 'register'" class="space-y-1.5">
              <label class="field-label" for="auth-confirm-password">Confirm Password</label>
              <input
                id="auth-confirm-password"
                v-model="confirmPassword"
                type="password"
                class="control w-full"
                placeholder="Confirm password"
                required
                autocomplete="new-password"
                :disabled="isLoading"
              />
            </div>
          </template>

          <!-- Change password fields -->
          <template v-else-if="mode === 'change-password'">
            <div class="space-y-1.5">
              <label class="field-label" for="current-password">Current Password</label>
              <input
                id="current-password"
                v-model="currentPassword"
                type="password"
                class="control w-full"
                placeholder="Current password"
                required
                autocomplete="current-password"
                :disabled="isLoading"
              />
            </div>

            <div class="space-y-1.5">
              <label class="field-label" for="new-password">New Password</label>
              <input
                id="new-password"
                v-model="newPassword"
                type="password"
                class="control w-full"
                placeholder="New password (min. 6 chars)"
                required
                autocomplete="new-password"
                :disabled="isLoading"
              />
            </div>

            <div class="space-y-1.5">
              <label class="field-label" for="confirm-new-password">Confirm New Password</label>
              <input
                id="confirm-new-password"
                v-model="confirmNewPassword"
                type="password"
                class="control w-full"
                placeholder="Confirm new password"
                required
                autocomplete="new-password"
                :disabled="isLoading"
              />
            </div>
          </template>
        </div>

        <div class="modal-footer">
          <button
            class="button"
            type="button"
            :disabled="isLoading"
            @click="emit('close')"
          >
            Cancel
          </button>
          <button
            class="button button-primary"
            type="submit"
            :disabled="isLoading"
          >
            <span v-if="isLoading" class="flex items-center gap-1">
              <AppIcon name="arrow-path" class="animate-spin" />
              <span>Processing...</span>
            </span>
            <span v-else-if="mode === 'login'">Sign In</span>
            <span v-else-if="mode === 'register'">Create Account</span>
            <span v-else-if="mode === 'change-password'">Change Password</span>
          </button>
        </div>
      </form>
  </AppModal>
</template>