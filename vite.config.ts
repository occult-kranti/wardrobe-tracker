import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { sharedAliases } from './packages/shared/aliases.mjs'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: './',
  resolve: { alias: sharedAliases() },
})
