// @ts-check

import { fileURLToPath, URL } from 'node:url'
import node from '@astrojs/node'
import vercel from '@astrojs/vercel'
import vue from '@astrojs/vue'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'astro/config'

// `output: "server"` makes an adapter mandatory, and it must match the host --
// each one packages the same app in a different format. Vercel sets VERCEL=1 in
// its build environment, so deploying there needs no build-command override.
// ASTRO_ADAPTER forces a target explicitly; `build:vercel` uses it to test the
// Vercel output locally.
const target = process.env.ASTRO_ADAPTER ?? (process.env.VERCEL ? 'vercel' : 'node')

const adapter = target === 'vercel' ? vercel() : node({ mode: 'standalone' })

export default defineConfig({
  output: 'server',
  adapter,
  integrations: [vue()],

  vite: {
    plugins: [tailwindcss()],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
  },
})
