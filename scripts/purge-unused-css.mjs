import { writeFile } from 'node:fs/promises'
import { PurgeCSS } from 'purgecss'

const cssFiles = [
  'src/App.css',
  'src/features/diary/DiaryPage.css',
]

const results = await new PurgeCSS().purge({
  content: ['index.html', 'src/**/*.{ts,tsx}'],
  css: cssFiles,
  keyframes: false,
  variables: false,
  safelist: {
    standard: [
      /^(active|open|selected|disabled|loading|error|ready|dragging|expanded|collapsed)$/,
      /^is-/,
      /^has-/,
      /^stage-/,
      /^(food|weight|shed|poop|cleaning|hospital|other|feed|medicine|tiny|trusted)$/,
      /^gm-/,
    ],
    deep: [/^react-calendar/, /^gm-/],
    greedy: [/^data-/],
  },
})

for (const result of results) {
  await writeFile(result.file, result.css, 'utf8')
  console.log(`Removed unused selectors from ${result.file}`)
}
