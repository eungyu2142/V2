import fs from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const DATA_FILE = path.join(ROOT, 'data', 'research', 'hospital-condition-evidence.json')
const CATALOG_FILE = path.join(ROOT, 'public', 'data', 'exotic-hospitals.json')
const SEARCH_ENDPOINTS = {
  blog: 'https://openapi.naver.com/v1/search/blog.json',
  cafe: 'https://openapi.naver.com/v1/search/cafearticle.json',
  web: 'https://openapi.naver.com/v1/search/webkr.json',
}
const PRIORITY_CONDITIONS = [
  { id: 'defecation', label: '배변', queryTerms: ['배변', '설사', '변비', '분변검사', '묽은변', '딱딱한변'], keywords: ['배변', '설사', '변비', '분변', '묽은 변', '묽은변', '딱딱한 변', '딱딱한변'] },
  { id: 'shedding', label: '탈피', queryTerms: ['탈피', '탈피부전', '잔존탈피', '탈피껍질', '탈피이상'], keywords: ['탈피', '탈피부전', '잔존 탈피', '잔존탈피', '탈피 껍질', '탈피껍질', '탈피 이상', '탈피이상'] },
  { id: 'egg_laying', label: '산란', queryTerms: ['산란', '난산', '에그바인딩', '난포정체', '무정란', '알막힘'], keywords: ['산란', '난산', '에그바인딩', '난포 정체', '난포정체', '무정란', '알막힘'] },
]
const SPECIES_TERMS = ['파충류', '도마뱀', '거북이', '뱀', '크레스티드게코', '레오파드게코', '비어디드래곤', '볼파이톤', '육지거북']
const PAGE_STARTS = [1, 101, 201]
const DISPLAY = 100
const requestDelayMs = Number(getArg('--delay-ms') ?? 60)

const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'))
const catalog = JSON.parse(fs.readFileSync(CATALOG_FILE, 'utf8'))
const env = loadEnv()
const headers = { 'X-Naver-Client-Id': env.NAVER_SEARCH_CLIENT_ID, 'X-Naver-Client-Secret': env.NAVER_SEARCH_CLIENT_SECRET }
if (!headers['X-Naver-Client-Id'] || !headers['X-Naver-Client-Secret']) throw new Error('NAVER_SEARCH_CLIENT_ID and NAVER_SEARCH_CLIENT_SECRET are required.')

let requestCount = 0
const errors = []
const summaries = []

for (const condition of PRIORITY_CONDITIONS) {
  const collected = []
  for (const queryTerm of condition.queryTerms) {
    for (const speciesTerm of SPECIES_TERMS) {
      const query = `${speciesTerm} ${queryTerm} 동물병원`
      for (const [sourceType, endpoint] of Object.entries(SEARCH_ENDPOINTS)) {
        for (const start of PAGE_STARTS) {
          const items = await search({ endpoint, sourceType, query, start })
          collected.push(...items.map((item) => toEvidence(item, condition)))
        }
      }
    }
  }

  const previous = data.globalEvidence[condition.id]?.evidence ?? []
  const expanded = uniqueByUrl([...previous, ...collected].filter((item) => item.keywordHits.length > 0 && item.hasHospitalSignal))
  data.globalEvidence[condition.id] = { label: condition.label, status: expanded.length > 0 ? 'evidence_found' : 'insufficient_evidence', evidenceCount: expanded.length, evidence: expanded }

  for (const hospital of data.hospitals) {
    const linked = expanded.filter((item) => item.matchedHospitalIds.includes(hospital.id))
    hospital.conditions[condition.id] = { label: condition.label, status: linked.length > 0 ? 'evidence_found' : 'insufficient_evidence', evidenceCount: linked.length, evidence: linked }
  }
  summaries.push({ id: condition.id, label: condition.label, previousEvidenceCount: previous.length, expandedEvidenceCount: expanded.length, linkedEvidenceCount: expanded.filter((item) => item.matchedHospitalIds.length > 0).length })
}

data.generatedAt = new Date().toISOString()
data.screenIntegrated = false
data.collection.priorityExpansion = { collectedAt: data.generatedAt, sourceCategories: Object.keys(SEARCH_ENDPOINTS), speciesTerms: SPECIES_TERMS, pageStarts: PAGE_STARTS, display: DISPLAY, requestCount, errorCount: errors.length, errors, summaries }
fs.writeFileSync(DATA_FILE, `${JSON.stringify(data, null, 2)}\n`, 'utf8')
console.log(JSON.stringify({ dataFile: DATA_FILE, requestCount, errorCount: errors.length, summaries }, null, 2))

async function search({ endpoint, sourceType, query, start }) {
  requestCount += 1
  try {
    const url = new URL(endpoint)
    url.searchParams.set('query', query)
    url.searchParams.set('display', String(DISPLAY))
    url.searchParams.set('start', String(start))
    if (sourceType !== 'web') url.searchParams.set('sort', 'sim')
    const response = await fetch(url, { headers })
    const body = await response.text()
    if (!response.ok) throw new Error(`${response.status}: ${body.slice(0, 160)}`)
    return (JSON.parse(body).items ?? []).map((item) => ({ ...item, sourceType, query, start }))
  } catch (error) {
    errors.push({ sourceType, query, start, message: error instanceof Error ? error.message : String(error) })
    return []
  } finally {
    await sleep(requestDelayMs)
  }
}

function toEvidence(item, condition) {
  const title = cleanHtml(item.title)
  const summary = cleanHtml(item.description).slice(0, 240)
  const searchable = normalize(`${title} ${summary}`)
  const mentionedHospitalNames = extractHospitalNames(`${title} ${summary}`)
  const matchedHospitalIds = catalog.filter((hospital) => matchesHospital(item, hospital)).map((hospital) => hospital.id)
  return { sourceType: item.sourceType, title, summary, url: item.link, publishedAt: item.postdate ? formatPostDate(item.postdate) : null, keywordHits: condition.keywords.filter((keyword) => searchable.includes(normalize(keyword))), hasHospitalSignal: mentionedHospitalNames.length > 0 || matchedHospitalIds.length > 0 || /동물병원|동물의료|특수동물/.test(`${title} ${summary}`), mentionedHospitalNames, matchedHospitalIds, query: item.query, searchStart: item.start }
}

function matchesHospital(item, hospital) {
  const searchable = normalize(`${item.title} ${item.description}`)
  const fullName = normalize(hospital.name)
  if (searchable.includes(fullName)) return true
  const coreName = fullName.replace(/^24시/, '').replace(/서울|인천/g, '').replace(/동물의료센터|동물메디컬센터|종합동물병원|동물종합병원|동물병원/g, '')
  const exactAliases = [`${coreName}동물병원`, `${coreName}특수동물병원`, `${coreName}동물의료센터`, `${coreName}동물메디컬센터`]
  if (exactAliases.some((alias) => searchable.includes(alias))) return true
  return coreName.length >= 3 && searchable.includes(coreName) && /동물병원|동물의료|특수동물/.test(cleanHtml(`${item.title} ${item.description}`))
}

function extractHospitalNames(value) {
  const matches = cleanHtml(value).match(/[가-힣A-Za-z0-9·&]{2,24}(?:동물병원|동물의료센터|동물메디컬센터|특수동물병원)/g) ?? []
  return Array.from(new Set(matches.map((item) => item.replace(/^(?:파충류|도마뱀|거북이|뱀)/, '')).filter((item) => item.length >= 4)))
}

function uniqueByUrl(items) {
  return Array.from(new Map(items.filter((item) => item.url).map((item) => [item.url, item])).values())
}

function loadEnv() {
  const result = { ...process.env }
  fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8').split(/\r?\n/).forEach((line) => {
    const match = line.match(/^([^#=\s]+)=(.*)$/)
    if (match) result[match[1]] = match[2].trim()
  })
  return result
}

function cleanHtml(value) {
  return String(value ?? '').replace(/<[^>]*>/g, '').replaceAll('&amp;', '&').replaceAll('&quot;', '"').replaceAll('&#39;', "'").replace(/\s+/g, ' ').trim()
}

function normalize(value) {
  return cleanHtml(value).replace(/\s+/g, '').toLowerCase()
}

function formatPostDate(value) {
  const text = String(value)
  return /^\d{8}$/.test(text) ? `${text.slice(0, 4)}-${text.slice(4, 6)}-${text.slice(6, 8)}` : null
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function getArg(name) {
  const value = process.argv.find((arg) => arg.startsWith(`${name}=`))
  return value ? value.slice(name.length + 1) : undefined
}
