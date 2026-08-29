import fs from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const CATALOG_FILE = path.join(ROOT, 'public', 'data', 'exotic-hospitals.json')
const OUT_DIR = path.join(ROOT, 'data', 'research')
const OUT_FILE = path.join(OUT_DIR, 'hospital-condition-evidence.json')
const SEARCH_ENDPOINTS = {
  blog: 'https://openapi.naver.com/v1/search/blog.json',
  cafe: 'https://openapi.naver.com/v1/search/cafearticle.json',
}

const CONDITIONS = [
  { id: 'shedding', label: '탈피', query: '탈피', keywords: ['탈피', '탈피부전', '잔존 탈피'] },
  { id: 'defecation', label: '배변', query: '배변', keywords: ['배변', '설사', '변비', '분변', '묽은 변', '딱딱한 변'] },
  { id: 'egg_laying', label: '산란', query: '산란', keywords: ['산란', '난산', '에그바인딩'] },
  { id: 'mbd', label: 'MBD(대사성 골질환)', query: '대사성 골질환', keywords: ['MBD', '대사성 골질환', '대사성골질환'] },
  { id: 'dystocia_egg_binding', label: '난산/에그바인딩', query: '에그바인딩', keywords: ['난산', '에그바인딩'] },
  { id: 'dysecdysis', label: '탈피부전', query: '탈피부전', keywords: ['탈피부전', '잔존 탈피', '잔존탈피'] },
  { id: 'stomatitis', label: '구내염', query: '구내염', keywords: ['구내염', '입병'] },
  { id: 'respiratory_infection', label: '호흡기 감염', query: '호흡기 감염', keywords: ['호흡기 감염', '호흡기감염', '호흡기 질환', '호흡기질환'] },
  { id: 'pneumonia', label: '폐렴', query: '폐렴', keywords: ['폐렴'] },
  { id: 'impaction', label: '장폐색/임팩션', query: '임팩션', keywords: ['장폐색', '임팩션'] },
  { id: 'prolapse', label: '탈항', query: '탈항', keywords: ['탈항', '총배설강 탈출', '총배설강탈출'] },
  { id: 'internal_parasites', label: '내부기생충', query: '내부기생충', keywords: ['내부기생충', '내부 기생충', '분변검사', '분변 검사'] },
  { id: 'external_parasites', label: '외부기생충', query: '외부기생충', keywords: ['외부기생충', '외부 기생충', '진드기'] },
  { id: 'dermatitis', label: '피부염', query: '피부염', keywords: ['피부염', '피부 질환', '피부질환'] },
  { id: 'fungal_disease', label: '진균성 질환', query: '진균성 질환', keywords: ['진균성 질환', '진균성질환', '곰팡이 감염', '곰팡이감염'] },
  { id: 'abscess', label: '농양', query: '농양', keywords: ['농양'] },
  { id: 'fracture', label: '골절', query: '골절', keywords: ['골절'] },
  { id: 'dehydration', label: '탈수', query: '탈수', keywords: ['탈수'] },
  { id: 'hypocalcemia', label: '저칼슘혈증', query: '저칼슘혈증', keywords: ['저칼슘혈증', '저칼슘', '칼슘 부족', '칼슘부족'] },
  { id: 'follicular_stasis', label: '난포 정체', query: '난포 정체', keywords: ['난포 정체', '난포정체'] },
  { id: 'reproductive_prolapse', label: '생식기 탈출', query: '생식기 탈출', keywords: ['생식기 탈출', '생식기탈출', '생식기 탈장', '생식기탈장'] },
]

const SPECIES_SEARCH_TERMS = ['파충류', '도마뱀', '거북이', '뱀']

const env = loadEnv()
const headers = {
  'X-Naver-Client-Id': env.NAVER_SEARCH_CLIENT_ID,
  'X-Naver-Client-Secret': env.NAVER_SEARCH_CLIENT_SECRET,
}
if (!headers['X-Naver-Client-Id'] || !headers['X-Naver-Client-Secret']) {
  throw new Error('NAVER_SEARCH_CLIENT_ID and NAVER_SEARCH_CLIENT_SECRET are required.')
}

const catalog = JSON.parse(fs.readFileSync(CATALOG_FILE, 'utf8'))
const requestDelayMs = Number(getArg('--delay-ms') ?? 120)
const candidateLimit = Number(getArg('--candidate-limit') ?? catalogLength())
const errors = []
let requestCount = 0

const candidateRows = []
for (const hospital of catalog) {
  const region = String(hospital.address ?? '').split(/\s+/).slice(0, 2).join(' ')
  const query = `${hospital.name} ${region} 파충류 특수동물`
  const items = await searchBoth(query, 30)
  const evidence = uniqueByLink(items.filter((item) => matchesHospital(item, hospital)))
  candidateRows.push({ hospital, evidence })
}

const selected = candidateRows
  .sort((a, b) => b.evidence.length - a.evidence.length || a.hospital.name.localeCompare(b.hospital.name, 'ko'))
  .slice(0, candidateLimit)

const globalEvidence = {}
for (const condition of CONDITIONS) {
  const resultItems = []
  for (const speciesTerm of SPECIES_SEARCH_TERMS) {
    resultItems.push(...await searchBoth(`${speciesTerm} ${condition.query} 동물병원`, 50))
  }
  const evidence = uniqueByLink(resultItems
    .map((item) => toEvidence(item, condition))
    .filter((item) => item.keywordHits.length > 0 && item.hasHospitalSignal))
  globalEvidence[condition.id] = {
    label: condition.label,
    status: evidence.length > 0 ? 'evidence_found' : 'insufficient_evidence',
    evidenceCount: evidence.length,
    evidence,
  }
}

const hospitals = []
for (const candidate of selected) {
  const conditionEvidence = {}
  for (const condition of CONDITIONS) {
    const evidence = globalEvidence[condition.id].evidence.filter((item) => item.matchedHospitalIds.includes(candidate.hospital.id))
    conditionEvidence[condition.id] = {
      label: condition.label,
      status: evidence.length > 0 ? 'evidence_found' : 'insufficient_evidence',
      evidenceCount: evidence.length,
      evidence,
    }
  }

  hospitals.push({
    id: candidate.hospital.id,
    name: candidate.hospital.name,
    address: candidate.hospital.address,
    supportedAnimals: candidate.hospital.supportedAnimals,
    candidateEvidenceCount: candidate.evidence.length,
    conditions: conditionEvidence,
  })
}

const output = {
  generatedAt: new Date().toISOString(),
  screenIntegrated: false,
  purpose: '병원 추천 점수 계산 전 연구용 공개 검색 근거',
  disclaimer: '검색 노출 근거이며 의료 품질이나 치료 성공률을 보증하지 않는다. 병원 자체 콘텐츠와 실제 보호자 후기가 섞일 수 있어 원문 확인이 필요하다.',
  source: {
    provider: 'Naver Search API',
    categories: Object.keys(SEARCH_ENDPOINTS),
    storesFullReviewBody: false,
  },
  selection: {
    catalogCount: catalog.length,
    selectedHospitalCount: hospitals.length,
    method: '앱 병원 목록을 병원명·지역·파충류 키워드로 검색한 뒤 고유 공개 검색 결과 수 상위 후보를 선택',
  },
  conditionCount: CONDITIONS.length,
  conditions: CONDITIONS.map(({ id, label, query, keywords }) => ({ id, label, query, keywords })),
  globalEvidence,
  hospitals,
  collection: {
    requestCount,
    requestDelayMs,
    errors,
  },
}

fs.mkdirSync(OUT_DIR, { recursive: true })
fs.writeFileSync(OUT_FILE, `${JSON.stringify(output, null, 2)}\n`, 'utf8')
console.log(JSON.stringify({ outFile: OUT_FILE, requestCount, selectedHospitals: hospitals.map((item) => item.name), errorCount: errors.length }, null, 2))

async function searchBoth(query, display) {
  const results = []
  for (const [sourceType, endpoint] of Object.entries(SEARCH_ENDPOINTS)) {
    requestCount += 1
    try {
      const url = new URL(endpoint)
      url.searchParams.set('query', query)
      url.searchParams.set('display', String(display))
      url.searchParams.set('start', '1')
      url.searchParams.set('sort', 'sim')
      const response = await fetch(url, { headers })
      const body = await response.text()
      if (!response.ok) throw new Error(`${response.status}: ${body.slice(0, 160)}`)
      const data = JSON.parse(body)
      results.push(...(data.items ?? []).map((item) => ({ ...item, sourceType, query })))
    } catch (error) {
      errors.push({ query, sourceType, message: error instanceof Error ? error.message : String(error) })
    }
    await sleep(requestDelayMs)
  }
  return results
}

function toEvidence(item, condition) {
  const title = cleanHtml(item.title)
  const summary = cleanHtml(item.description).slice(0, 240)
  const searchable = normalize(`${title} ${summary}`)
  const mentionedHospitalNames = extractHospitalNames(`${title} ${summary}`)
  const matchedHospitalIds = catalog.filter((hospital) => matchesHospital(item, hospital)).map((hospital) => hospital.id)
  return {
    sourceType: item.sourceType,
    title,
    summary,
    url: item.link,
    publishedAt: item.postdate ? formatPostDate(item.postdate) : null,
    keywordHits: condition.keywords.filter((keyword) => searchable.includes(normalize(keyword))),
    hasHospitalSignal: mentionedHospitalNames.length > 0 || matchedHospitalIds.length > 0 || /동물병원|동물의료|특수동물/.test(`${title} ${summary}`),
    mentionedHospitalNames,
    matchedHospitalIds,
    query: item.query,
  }
}

function extractHospitalNames(value) {
  const matches = cleanHtml(value).match(/[가-힣A-Za-z0-9·&]{2,24}(?:동물병원|동물의료센터|동물메디컬센터|특수동물병원)/g) ?? []
  return Array.from(new Set(matches.map((item) => item.replace(/^(?:파충류|도마뱀|거북이|뱀)/, '')).filter((item) => item.length >= 4)))
}

function matchesHospital(item, hospital) {
  const searchable = normalize(`${item.title} ${item.description}`)
  const fullName = normalize(hospital.name)
  if (searchable.includes(fullName)) return true
  const coreName = fullName
    .replace(/^24시/, '')
    .replace(/서울|인천/g, '')
    .replace(/동물의료센터|동물메디컬센터|종합동물병원|동물종합병원|동물병원/g, '')
  const exactAliases = [
    `${coreName}동물병원`,
    `${coreName}특수동물병원`,
    `${coreName}동물의료센터`,
    `${coreName}동물메디컬센터`,
  ]
  if (exactAliases.some((alias) => searchable.includes(alias))) return true
  return coreName.length >= 3 && searchable.includes(coreName) && /동물병원|동물의료|특수동물/.test(cleanHtml(`${item.title} ${item.description}`))
}

function uniqueByLink(items) {
  return Array.from(new Map(items
    .map((item) => [item.link ?? item.url, item])
    .filter(([link]) => Boolean(link))).values())
}

function loadEnv() {
  const result = { ...process.env }
  const envPath = path.join(ROOT, '.env.local')
  if (!fs.existsSync(envPath)) return result
  fs.readFileSync(envPath, 'utf8').split(/\r?\n/).forEach((line) => {
    const match = line.match(/^([^#=\s]+)=(.*)$/)
    if (match) result[match[1]] = match[2].trim()
  })
  return result
}

function cleanHtml(value) {
  return String(value ?? '')
    .replace(/<[^>]*>/g, '')
    .replaceAll('&amp;', '&')
    .replaceAll('&quot;', '"')
    .replaceAll('&#39;', "'")
    .replace(/\s+/g, ' ')
    .trim()
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

function catalogLength() {
  return JSON.parse(fs.readFileSync(CATALOG_FILE, 'utf8')).length
}
