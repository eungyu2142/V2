import { readFile, readdir } from 'node:fs/promises'
import { extname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../src/', import.meta.url))
const forbidden = ['community', '\uCEE4\uBBA4\uB2C8\uD2F0', 'Q&A']

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
    for (const token of forbidden) {
      if (source.toLowerCase().includes(token.toLowerCase())) {
        throw new Error(`QNA naming guard: "${token}" found in ${relative(root, path)}`)
      }
    }
  }
}

await scan(root)
