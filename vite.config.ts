import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import yaml from '@modyfi/vite-plugin-yaml'

export default defineConfig({
  base: process.env.BASE_URL ?? '/',
  plugins: [react(), tailwindcss(), yaml()],
})
