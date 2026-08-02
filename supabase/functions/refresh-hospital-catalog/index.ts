import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

type SeedHospital = {
  id?: string
  name?: string
  address?: string
  phone?: string
  lat?: number
  lng?: number
  supportedAnimals?: string[]
  classification?: string
  matchedQueries?: string[]
  evidence?: unknown[]
  sources?: string[]
  lastCollectedAt?: string
  link?: string
}

const NAVER_LOCAL_SEARCH_URL = 'https://openapi.naver.com/v1/search/local.json'
const SEARCH_SUFFIX = '파충류 동물 병원'
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
] as const

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const naverClientId = Deno.env.get('NAVER_SEARCH_CLIENT_ID')
  const naverClientSecret = Deno.env.get('NAVER_SEARCH_CLIENT_SECRET')
  if (!supabaseUrl || !serviceRoleKey || !naverClientId || !naverClientSecret) {
    return json({ error: 'missing_server_configuration' }, 500)
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  try {
    const body = await request.json().catch(() => ({})) as { seedHospitals?: SeedHospital[] }
    const seeded = await seedCatalogIfEmpty(supabase, body.seedHospitals ?? [])
    const catalogCount = await readCatalogCount(supabase)
    const cycle = new Date().toISOString().slice(0, 7)
    const { data: claimedIndex, error: claimError } = await supabase.rpc('claim_hospital_collection_region', {
      p_cycle: cycle,
      p_region_count: REGIONS.length,
    })
    if (claimError) throw claimError
    if (typeof claimedIndex !== 'number') {
      return json({ status: 'idle', cycle, seeded, catalogCount, regionCount: REGIONS.length })
    }

    const region = REGIONS[claimedIndex]
    try {
      const query = `${region} ${SEARCH_SUFFIX}`
      const items = await searchNaverHospitals(query, naverClientId, naverClientSecret)
      const rows = items.filter(isHospitalCandidate).map((item) => toHospitalRow(item, query, region))
      if (rows.length > 0) {
        const { error: upsertError } = await supabase.from('hospitals').upsert(rows, { onConflict: 'external_id' })
        if (upsertError) throw upsertError
      }
      await supabase.rpc('finish_hospital_collection_region', { p_region_index: claimedIndex, p_error: null })
      return json({ status: 'collected', cycle, seeded, catalogCount, region, regionIndex: claimedIndex, saved: rows.length })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown collection error'
      await supabase.rpc('finish_hospital_collection_region', { p_region_index: claimedIndex, p_error: message.slice(0, 500) })
      throw error
    }
  } catch (error) {
    console.error('Monthly hospital catalog refresh failed:', error)
    return json({ error: 'hospital_catalog_refresh_failed', message: error instanceof Error ? error.message : 'Unknown error' }, 500)
  }
})

async function seedCatalogIfEmpty(
  supabase: ReturnType<typeof createClient>,
  seedHospitals: SeedHospital[],
) {
  if (seedHospitals.length === 0) return 0
  const { count, error } = await supabase.from('hospitals').select('id', { count: 'exact', head: true })
  if (error) throw error
  if ((count ?? 0) > 0) return 0

  const rows = seedHospitals.slice(0, 200).flatMap((hospital) => {
    const name = hospital.name?.trim() ?? ''
    const address = hospital.address?.trim() ?? ''
    if (!name || !Number.isFinite(hospital.lat) || !Number.isFinite(hospital.lng)) return []
    return [{
      external_id: hospital.id || stableId(`${name}:${address}`),
      name,
      address,
      road_address: address,
      phone: hospital.phone?.trim() || null,
      link: hospital.link?.trim() || null,
      lat: hospital.lat,
      lng: hospital.lng,
      categories: ['reptile'],
      supported_animals: ['reptile'],
      source: 'initial-static-catalog',
      last_collected_at: hospital.lastCollectedAt || new Date().toISOString(),
      payload: {
        classification: hospital.classification || 'confirmed',
        matchedQueries: hospital.matchedQueries ?? [],
        evidence: hospital.evidence ?? [],
        sources: hospital.sources ?? ['local-hospital-data'],
      },
      updated_at: new Date().toISOString(),
    }]
  })
  if (rows.length === 0) return 0
  const { error: upsertError } = await supabase.from('hospitals').upsert(rows, { onConflict: 'external_id' })
  if (upsertError) throw upsertError
  return rows.length
}

async function readCatalogCount(supabase: ReturnType<typeof createClient>) {
  const { count, error } = await supabase.from('hospitals').select('id', { count: 'exact', head: true })
  if (error) throw error
  return count ?? 0
}

async function searchNaverHospitals(query: string, clientId: string, clientSecret: string) {
  const url = new URL(NAVER_LOCAL_SEARCH_URL)
  url.searchParams.set('query', query)
  url.searchParams.set('display', '5')
  url.searchParams.set('start', '1')
  url.searchParams.set('sort', 'random')
  const response = await fetch(url, {
    headers: {
      'X-Naver-Client-Id': clientId,
      'X-Naver-Client-Secret': clientSecret,
    },
  })
  const text = await response.text()
  if (!response.ok) throw new Error(`Naver Local Search ${response.status}: ${text.slice(0, 200)}`)
  return (JSON.parse(text) as { items?: Array<Record<string, unknown>> }).items ?? []
}

function toHospitalRow(item: Record<string, unknown>, query: string, region: string) {
  const name = cleanHtml(item.title)
  const address = String(item.roadAddress || item.address || '').trim()
  const externalId = stableId(`${normalize(name)}:${normalize(address)}`)
  const collectedAt = new Date().toISOString()
  return {
    external_id: externalId,
    name,
    address,
    road_address: String(item.roadAddress || '').trim() || null,
    phone: String(item.telephone || '').trim() || null,
    link: String(item.link || '').trim() || null,
    lat: toCoordinate(item.mapy),
    lng: toCoordinate(item.mapx),
    categories: ['reptile'],
    supported_animals: ['reptile'],
    source: 'naver-local-search',
    last_collected_at: collectedAt,
    payload: {
      classification: 'confirmed',
      matchedQueries: [query],
      evidence: [{ query, region, keyword: SEARCH_SUFFIX, source: 'naver-local-search' }],
      sources: ['naver-local-search'],
    },
    updated_at: collectedAt,
  }
}

function isHospitalCandidate(item: Record<string, unknown>) {
  const text = normalize(`${item.title ?? ''} ${item.category ?? ''} ${item.description ?? ''} ${item.address ?? ''} ${item.roadAddress ?? ''}`)
  if (!text.includes(normalize('동물병원')) && !text.includes(normalize('동물 병원'))) return false
  return !['애견카페', '카페', '펫샵', '애견샵', '용품', '미용', '호텔', '분양', '수족관', '아쿠아리움', '사료', '간식', '훈련소', '보호소']
    .some((word) => text.includes(normalize(word)))
}

function cleanHtml(value: unknown) {
  return String(value ?? '').replace(/<[^>]*>/g, '').replaceAll('&amp;', '&').trim()
}

function normalize(value: unknown) {
  return cleanHtml(value).replace(/\s+/g, '').toLowerCase()
}

function stableId(value: string) {
  let hash = 0x811c9dc5
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }
  return `exotic_${(hash >>> 0).toString(16)}`
}

function toCoordinate(value: unknown) {
  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric / 10_000_000 : null
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' },
  })
}
