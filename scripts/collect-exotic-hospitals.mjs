import fs from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const OUT_DIR = path.join(ROOT, 'public', 'data')
const OUT_FILE = path.join(OUT_DIR, 'exotic-hospitals.json')
const META_FILE = path.join(OUT_DIR, 'exotic-hospitals.meta.json')
const API_URL = 'https://openapi.naver.com/v1/search/local.json'

const SEARCH_PLANS = [
  { suffix: '특수동물병원', animals: [] },
  { suffix: '이국동물병원', animals: [] },
  { suffix: '파충류 동물병원', animals: ['reptile'] },
  { suffix: '조류 동물병원', animals: ['bird'] },
  { suffix: '설치류 동물병원', animals: ['rodent'] },
  { suffix: '토끼 동물병원', animals: ['rodent'] },
  { suffix: '햄스터 동물병원', animals: ['rodent'] },
  { suffix: '페럿 동물병원', animals: ['rodent'] },
]

const REGIONS = [
  '서울 강남구', '서울 강동구', '서울 강북구', '서울 강서구', '서울 관악구', '서울 광진구', '서울 구로구', '서울 금천구', '서울 노원구', '서울 도봉구', '서울 동대문구', '서울 동작구', '서울 마포구', '서울 서대문구', '서울 서초구', '서울 성동구', '서울 성북구', '서울 송파구', '서울 양천구', '서울 영등포구', '서울 용산구', '서울 은평구', '서울 종로구', '서울 중구', '서울 중랑구',
  '부산 강서구', '부산 금정구', '부산 기장군', '부산 남구', '부산 동구', '부산 동래구', '부산 부산진구', '부산 북구', '부산 사상구', '부산 사하구', '부산 서구', '부산 수영구', '부산 연제구', '부산 영도구', '부산 중구', '부산 해운대구',
  '대구 군위군', '대구 남구', '대구 달서구', '대구 달성군', '대구 동구', '대구 북구', '대구 서구', '대구 수성구', '대구 중구',
  '인천 강화군', '인천 계양구', '인천 남동구', '인천 동구', '인천 미추홀구', '인천 부평구', '인천 서구', '인천 연수구', '인천 옹진군', '인천 중구',
  '광주 광산구', '광주 남구', '광주 동구', '광주 북구', '광주 서구',
  '대전 대덕구', '대전 동구', '대전 서구', '대전 유성구', '대전 중구',
  '울산 남구', '울산 동구', '울산 북구', '울산 울주군', '울산 중구',
  '세종 세종시',
  '경기 가평군', '경기 고양시', '경기 과천시', '경기 광명시', '경기 광주시', '경기 구리시', '경기 군포시', '경기 김포시', '경기 남양주시', '경기 동두천시', '경기 부천시', '경기 성남시', '경기 수원시', '경기 시흥시', '경기 안산시', '경기 안성시', '경기 안양시', '경기 양주시', '경기 양평군', '경기 여주시', '경기 연천군', '경기 오산시', '경기 용인시', '경기 의왕시', '경기 의정부시', '경기 이천시', '경기 파주시', '경기 평택시', '경기 포천시', '경기 하남시', '경기 화성시',
  '강원 강릉시', '강원 고성군', '강원 동해시', '강원 삼척시', '강원 속초시', '강원 양구군', '강원 양양군', '강원 영월군', '강원 원주시', '강원 인제군', '강원 정선군', '강원 철원군', '강원 춘천시', '강원 태백시', '강원 평창군', '강원 홍천군', '강원 화천군', '강원 횡성군',
  '충북 괴산군', '충북 단양군', '충북 보은군', '충북 영동군', '충북 옥천군', '충북 음성군', '충북 제천시', '충북 증평군', '충북 진천군', '충북 청주시', '충북 충주시',
  '충남 계룡시', '충남 공주시', '충남 금산군', '충남 논산시', '충남 당진시', '충남 보령시', '충남 부여군', '충남 서산시', '충남 서천군', '충남 아산시', '충남 예산군', '충남 천안시', '충남 청양군', '충남 태안군', '충남 홍성군',
  '전북 고창군', '전북 군산시', '전북 김제시', '전북 남원시', '전북 무주군', '전북 부안군', '전북 순창군', '전북 완주군', '전북 익산시', '전북 임실군', '전북 장수군', '전북 전주시', '전북 정읍시', '전북 진안군',
  '전남 강진군', '전남 고흥군', '전남 곡성군', '전남 광양시', '전남 구례군', '전남 나주시', '전남 담양군', '전남 목포시', '전남 무안군', '전남 보성군', '전남 순천시', '전남 신안군', '전남 여수시', '전남 영광군', '전남 영암군', '전남 완도군', '전남 장성군', '전남 장흥군', '전남 진도군', '전남 함평군', '전남 해남군', '전남 화순군',
  '경북 경산시', '경북 경주시', '경북 고령군', '경북 구미시', '경북 김천시', '경북 문경시', '경북 봉화군', '경북 상주시', '경북 성주군', '경북 안동시', '경북 영덕군', '경북 영양군', '경북 영주시', '경북 영천시', '경북 예천군', '경북 울릉군', '경북 울진군', '경북 의성군', '경북 청도군', '경북 청송군', '경북 칠곡군', '경북 포항시',
  '경남 거제시', '경남 거창군', '경남 고성군', '경남 김해시', '경남 남해군', '경남 밀양시', '경남 사천시', '경남 산청군', '경남 양산시', '경남 의령군', '경남 진주시', '경남 창녕군', '경남 창원시', '경남 통영시', '경남 하동군', '경남 함안군', '경남 함양군', '경남 합천군',
  '제주 서귀포시', '제주 제주시',
]

const delayMs = Number(getArg('--delay-ms') ?? process.env.COLLECT_DELAY_MS ?? 650)
const display = Number(getArg('--display') ?? process.env.COLLECT_DISPLAY ?? 5)
const maxHospitals = Number(getArg('--max-hospitals') ?? process.env.COLLECT_MAX_HOSPITALS ?? Number.POSITIVE_INFINITY)
const maxRequests = Number(getArg('--max-requests') ?? process.env.COLLECT_MAX_REQUESTS ?? Number.POSITIVE_INFINITY)
const dryRun = process.argv.includes('--dry-run')

const env = loadEnv()
const headers = {
  'X-Naver-Client-Id': env.NAVER_SEARCH_CLIENT_ID,
  'X-Naver-Client-Secret': env.NAVER_SEARCH_CLIENT_SECRET,
}

if (!headers['X-Naver-Client-Id'] || !headers['X-Naver-Client-Secret']) {
  throw new Error('NAVER_SEARCH_CLIENT_ID and NAVER_SEARCH_CLIENT_SECRET are required.')
}

fs.mkdirSync(OUT_DIR, { recursive: true })

const hospitals = new Map()
const errors = []
const startedAt = new Date().toISOString()
let requestCount = 0
let rateLimitRetryCount = 0
let lastQuery = ''

for (const region of REGIONS) {
  for (const plan of SEARCH_PLANS) {
    if (hospitals.size >= maxHospitals || requestCount >= maxRequests) break
    const query = `${region} ${plan.suffix}`
    lastQuery = query
    requestCount += 1
    const items = await searchLocalWithRetry(query)
    mergeItems({ items, query, region, plan })
    await sleep(delayMs)
  }
  if (hospitals.size >= maxHospitals || requestCount >= maxRequests) break
}

const collected = Array.from(hospitals.values()).sort((a, b) => a.name.localeCompare(b.name, 'ko'))
const finishedAt = new Date().toISOString()
const meta = {
  source: 'Naver Local Search API',
  endpoint: API_URL,
  notice: '네이버 지역 검색 결과는 실제 특수동물 진료 가능 여부의 공식 보증이 아니라 검색 키워드 기반 추정입니다.',
  startedAt,
  finishedAt,
  lastCollectedAt: finishedAt,
  requestCount,
  rateLimitRetryCount,
  requestedMaxHospitals: Number.isFinite(maxHospitals) ? maxHospitals : null,
  collectedCount: collected.length,
  lastQuery,
  regionCount: REGIONS.length,
  keywordCount: SEARCH_PLANS.length,
  queryPolicy: {
    schedule: 'weekly',
    concurrency: 1,
    delayMs,
    display,
    backoffMs: [1500, 3000, 4500],
  },
  errors,
}

if (!dryRun) {
  fs.writeFileSync(OUT_FILE, `${JSON.stringify(collected, null, 2)}\n`, 'utf8')
  fs.writeFileSync(META_FILE, `${JSON.stringify(meta, null, 2)}\n`, 'utf8')
}

console.log(JSON.stringify({ dryRun, collectedCount: collected.length, requestCount, rateLimitRetryCount, outFile: OUT_FILE, metaFile: META_FILE }, null, 2))

async function searchLocalWithRetry(query) {
  const backoffs = [0, 1500, 3000, 4500]
  for (let attempt = 0; attempt < backoffs.length; attempt += 1) {
    if (backoffs[attempt] > 0) {
      rateLimitRetryCount += 1
      await sleep(backoffs[attempt])
    }

    const result = await searchLocal(query)
    if (result.status !== 'rate_limited') return result.items
  }

  errors.push({ query, type: 'rate_limited', message: '429 after retries' })
  return []
}

async function searchLocal(query) {
  const url = new URL(API_URL)
  url.searchParams.set('query', query)
  url.searchParams.set('display', String(Math.max(1, Math.min(display, 100))))
  url.searchParams.set('start', '1')
  url.searchParams.set('sort', 'random')

  const response = await fetch(url, { headers })
  const text = await response.text()

  if (response.status === 429 || text.includes('"errorCode":"012"')) {
    return { status: 'rate_limited', items: [] }
  }

  if (!response.ok) {
    errors.push({ query, type: 'request_failed', status: response.status, message: text.slice(0, 240) })
    return { status: 'failed', items: [] }
  }

  return { status: 'ok', items: JSON.parse(text).items ?? [] }
}

function mergeItems({ items, query, region, plan }) {
  items.filter(isHospitalCandidate).forEach((item) => {
    const name = cleanHtml(item.title)
    const address = item.roadAddress || item.address || ''
    const key = normalize(`${name}:${address}`)
    const existing = hospitals.get(key)
    const animals = plan.animals
    const evidence = {
      query,
      region,
      keyword: plan.suffix,
      title: name,
      category: cleanHtml(item.category ?? ''),
      description: cleanHtml(item.description ?? ''),
      address,
    }
    const now = new Date().toISOString()

    if (existing) {
      existing.supportedAnimals = Array.from(new Set([...existing.supportedAnimals, ...animals]))
      existing.matchedQueries = Array.from(new Set([...existing.matchedQueries, query]))
      existing.evidence.push(evidence)
      existing.sources = Array.from(new Set([...existing.sources, 'naver-local-search']))
      existing.classification = existing.supportedAnimals.length > 0 || existing.matchedQueries.length > 1 ? 'confirmed' : 'candidate'
      existing.lastCollectedAt = now
      if (!existing.link && item.link) existing.link = item.link
      if (!existing.phone && item.telephone) existing.phone = item.telephone
      return
    }

    hospitals.set(key, {
      id: stableId(key),
      name,
      address,
      phone: item.telephone || '',
      lat: toCoordinate(item.mapy),
      lng: toCoordinate(item.mapx),
      mapX: Number(item.mapx),
      mapY: Number(item.mapy),
      supportedAnimals: [...animals],
      classification: animals.length > 0 ? 'confirmed' : 'candidate',
      matchedQueries: [query],
      evidence: [evidence],
      sources: ['naver-local-search'],
      lastCollectedAt: now,
      link: item.link || '',
    })
  })
}

function isHospitalCandidate(item) {
  const text = normalize(`${item.title} ${item.category} ${item.description} ${item.address} ${item.roadAddress}`)
  if (!text.includes(normalize('동물병원')) && !text.includes(normalize('동물 병원'))) return false
  return !['애견카페', '카페', '펫샵', '애견샵', '용품', '미용', '호텔', '분양', '수족관', '아쿠아리움', '사료', '간식', '훈련소', '보호소'].some((word) => text.includes(normalize(word)))
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

function getArg(name) {
  const value = process.argv.find((arg) => arg.startsWith(`${name}=`))
  return value ? value.slice(name.length + 1) : undefined
}
