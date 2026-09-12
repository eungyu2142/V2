import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'

const sourcePath = resolve('data/research/hospital-condition-evidence.json')
const outputPath = resolve('public/data/hospital-condition-evidence.json')
const source = JSON.parse(await readFile(sourcePath, 'utf8'))

const runtimeData = {
  generatedAt: source.generatedAt,
  disclaimer: source.disclaimer,
  hospitals: source.hospitals.map((hospital) => ({
    id: hospital.id,
    name: hospital.name,
    address: hospital.address,
    conditions: Object.fromEntries(
      Object.entries(hospital.conditions ?? {}).map(([id, condition]) => [id, condition?.evidenceCount ?? 0]),
    ),
  })),
}

await mkdir(dirname(outputPath), { recursive: true })
await writeFile(outputPath, `${JSON.stringify(runtimeData, null, 2)}\n`, 'utf8')
console.log(`Wrote ${runtimeData.hospitals.length} hospitals to ${outputPath}`)
