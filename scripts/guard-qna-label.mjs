import { readFile, readdir } from 'node:fs/promises'
import { extname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../src/', import.meta.url))
const visibleQnaPattern = /(?:>|aria-label=["']|title=["']|label=["'])\s*QNA\b/i

async function scan(directory) {
  const entries = await readdir(directory, { withFileTypes: true })
  for (const entry of entries) {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) {
      await scan(path)
      continue
    }
    if (!['.ts', '.tsx', '.css'].includes(extname(entry.name))) continue
    const source = await readFile(path, 'utf8')
    if (visibleQnaPattern.test(source)) {
      throw new Error(`QNA naming guard: visible "QNA" found in ${relative(root, path)}`)
    }
  }
}

await scan(root)
