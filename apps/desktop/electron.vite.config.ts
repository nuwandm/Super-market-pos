import { resolve } from 'path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'
import { copyFileSync, mkdirSync, existsSync, readdirSync } from 'fs'
import { join } from 'path'

function copyMigrationsPlugin() {
  return {
    name: 'copy-migrations',
    closeBundle() {
      const src = resolve('src/main/db/migrations')
      const dest = resolve('out/main/migrations')
      const metaDest = join(dest, 'meta')
      try {
        mkdirSync(metaDest, { recursive: true })
        for (const file of readdirSync(src)) {
          if (file.endsWith('.sql')) {
            copyFileSync(join(src, file), join(dest, file))
          }
        }
        if (existsSync(join(src, 'meta/_journal.json'))) {
          copyFileSync(join(src, 'meta/_journal.json'), join(metaDest, '_journal.json'))
        }
      } catch (e) {
        console.warn('Migration copy warning:', e)
      }
    },
  }
}

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin(), copyMigrationsPlugin()],
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
  },
  renderer: {
    resolve: {
      alias: {
        '@': resolve('src/renderer/src'),
      },
    },
    plugins: [react()],
  },
})
