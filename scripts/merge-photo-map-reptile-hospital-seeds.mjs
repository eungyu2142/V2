import fs from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const OUT_FILE = path.join(ROOT, 'public', 'data', 'exotic-hospitals.json')
const META_FILE = path.join(ROOT, 'public', 'data', 'exotic-hospitals.meta.json')
const API_URL = 'https://openapi.naver.com/v1/search/local.json'

const photoMapHospitalSeeds = [
  '펫인쥬동물메디컬센터',
  '하나동물병원',
  '월드펫동물메디컬센터',
  '그랜드동물병원',
  'WE동물병원',
  '나라동물병원',
  '로얄종합동물병원',
  '명진동물병원',
  '보드미동물병원',
  '아리스타동물의료센터',
  '오수의과동물병원',
  '이즈동물병원',
  '고운동물병원',
  '쿨펫천안동물병원',
  '아산서울동물지역센터',
  '김앤정동물병원',
  '다솜동물병원',
  '고려동물병원',
  '파주24시동물병원',
  '24시광명365동물의료센터',
  '새은평동물의료센터',
  '현대종합동물병원',
  '다봄동물병원',
  '에코동물병원',
  '한국동물병원',
  '분당중앙동물병원',
  '파우동물병원',
  '페피캣동물병원',
  '애니온동물병원',
  '라파엘동물병원',
  '서울든든동물병원 인천',
  '주라기동물종합병원',
  '맘스동물의료센터',
  '부천종합동물병원',
  '클로버동물병원',
  '한성동물병원',
  '반포베이스동물의료센터',
  '아우름동물병원',
  '아이엠동물병원',
  '조형선외과동물병원',
  '마스동물의료센터',
  '한샘동물병원',
  '콩닥동물의료센터',
  '라프종합동물병원',
]

const env = loadEnv()
const headers = {
  'X-Naver-Client-Id': env.NAVER_SEARCH_CLIENT_ID,
  'X-Naver-Client-Secret': env.NAVER_SEARCH_CLIENT_SECRET,
}

if (!headers['X-Naver-Client-Id'] || !headers['X-Naver-Client-Secret']) {
  throw new Error('NAVER_SEARCH_CLIENT_ID and NAVER_SEARCH_CLIENT_SECRET are required.')
}

const existing = JSON.parse(fs.readFileSync(OUT_FILE, 'utf8'))
const hospitals = new Map(existing.map((hospital) => [`${normalize(hospital.name)}:${normalize(hospital.address)}`, hospital]))
let hydratedCount = 0
let addedCount = 0

for (const seed of photoMapHospitalSeeds) {
  const item = await findHospital(seed)
  if (!item) {
    await sleep(180)
    continue
  }

  hydratedCount += 1
  const name = cleanHtml(item.title)
  const address = item.roadAddress || item.address || ''
  const key = `${normalize(name)}:${normalize(address)}`
  const evidence = {
    query: `${seed} 파충류 동물 병원`,
    keyword: '파충류 동물 병원',
    source: 'photo-map-seed',
    title: name,
    category: cleanHtml(item.category ?? ''),
    description: cleanHtml(item.description ?? ''),
    address,
  }
  const existingHospital = hospitals.get(key)

  if (existingHospital) {
    existingHospital.supportedAnimals = Array.from(new Set([...(existingHospital.supportedAnimals ?? []), 'reptile']))
    existingHospital.matchedQueries = Array.from(new Set([...(existingHospital.matchedQueries ?? []), evidence.query]))
    existingHospital.evidence = [...(existingHospital.evidence ?? []), evidence]
    existingHospital.sources = Array.from(new Set([...(existingHospital.sources ?? []), 'photo-map-seed']))
  } else {
    hospitals.set(key, {
      id: stableId(key),
      name,
      address,
      phone: item.telephone || '',
      lat: toCoordinate(item.mapy),
      lng: toCoordinate(item.mapx),
      mapX: Number(item.mapx),
      mapY: Number(item.mapy),
      supportedAnimals: ['reptile'],
      classification: 'confirmed',
      matchedQueries: [evidence.query],
      evidence: [evidence],
      sources: ['naver-local-search', 'photo-map-seed'],
      lastCollectedAt: new Date().toISOString(),
      link: item.link || '',
    })
    addedCount += 1
  }

  await sleep(180)
}

const merged = Array.from(hospitals.values()).sort((a, b) => a.name.localeCompare(b.name, 'ko'))
fs.writeFileSync(OUT_FILE, `${JSON.stringify(merged, null, 2)}\n`, 'utf8')

const meta = JSON.parse(fs.readFileSync(META_FILE, 'utf8'))
Object.assign(meta, {
  notice: '파충류 동물 병원 단일 검색어와 사진 지도 시드 병원을 기준으로 앱 지도 데이터를 구성합니다.',
  collectedCount: merged.length,
  photoMapSeedCount: photoMapHospitalSeeds.length,
  photoMapHydratedCount: hydratedCount,
  photoMapAddedCount: addedCount,
  lastPhotoMapSeededAt: new Date().toISOString(),
  allowedAnimals: ['reptile'],
  removedAnimals: ['amphibian', 'bird', 'rodent', 'other'],
})
fs.writeFileSync(META_FILE, `${JSON.stringify(meta, null, 2)}\n`, 'utf8')

console.log(JSON.stringify({ before: existing.length, after: merged.length, hydratedCount, addedCount }, null, 2))

async function findHospital(seed) {
  const queries = [`${seed} 파충류 동물 병원`, seed]
  for (const query of queries) {
    const items = await searchLocal(query)
    const matched = items.find((item) => {
      const text = normalize(`${item.title} ${item.category} ${item.description}`)
      return text.includes(normalize('동물병원')) || text.includes(normalize('동물의료센터'))
    })
    if (matched) return matched
  }
  return null
}

async function searchLocal(query) {
  const url = new URL(API_URL)
  url.searchParams.set('query', query)
  url.searchParams.set('display', '5')
  url.searchParams.set('start', '1')
  url.searchParams.set('sort', 'random')

  const response = await fetch(url, { headers })
  if (!response.ok) return []
  const data = await response.json()
  return data.items ?? []
}

function loadEnv() {
  const envPath = path.join(ROOT, '.env.local')
  const env = { ...process.env }
  if (!fs.existsSync(envPath)) return env
  fs.readFileSync(envPath, 'utf8')
    .split(/\r?\n/)
    .forEach((line) => {
      const match = line.match(/^([^#=\s]+)=(.*)$/)
      if (match) env[match[1]] = match[2].trim()
    })
  return env
}

function cleanHtml(value) {
  return String(value ?? '').replace(/<[^>]*>/g, '').replaceAll('&amp;', '&').trim()
}

function normalize(value) {
  return cleanHtml(value).replace(/\s+/g, '').toLowerCase()
}

function stableId(value) {
  let hash = 0x811c9dc5
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return `exotic_${(hash >>> 0).toString(16)}`
}

function toCoordinate(value) {
  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric / 10_000_000 : null
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
