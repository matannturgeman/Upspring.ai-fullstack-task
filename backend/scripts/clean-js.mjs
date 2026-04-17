import { rmSync, existsSync } from 'fs'
import { join } from 'path'

const targets = ['src', '.']

async function removeJsFiles(dir) {
  const fs = await import('fs/promises')
  const entries = await fs.readdir(dir, { withFileTypes: true })

  for (const entry of entries) {
    const fullPath = join(dir, entry.name)

    if (entry.isDirectory()) {
      removeJsFiles(fullPath)
    } else if (entry.name.endsWith('.js') || entry.name.endsWith('.js.map')) {
      console.log('Removing:', fullPath)
      rmSync(fullPath)
    }
  }
}

removeJsFiles('src')
console.log('Cleanup done')
