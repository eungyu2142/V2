import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

type SearchRequest = {
  query?: string
  pageSize?: number
  latitude?: number
  longitude?: number
  radiusMeters?: number
  includeDetails?: boolean
  placeId?: string
  hospitalId?: string
  hospitalName?: string
  hospitalAddress?: string
  googlePlaceId?: string
}

type CachedHospitalRow = {
  id: string
  external_id: string | null
  name: string
  address: string | null
  road_address: string | null
  phone: string | null
  link: string | null
  lat: number | null
  lng: number | null
  supported_animals: string[] | null
  google_place_id: string | null
  google_rating: number | null
  google_review_count: number | null
  google_phone: string | null
  google_website: string | null
  opening_hours: GoogleOpeningHours | null
  current_opening_hours: GoogleOpeningHours | null
  is_open_now: boolean | null
  places_last_updated: string | null
}

type GooglePlace = {
  id?: string
  displayName?: { text?: string; languageCode?: string }
  formattedAddress?: string
  location?: { latitude?: number; longitude?: number }
  nationalPhoneNumber?: string
  internationalPhoneNumber?: string
  googleMapsUri?: string
  websiteUri?: string
  shortFormattedAddress?: string
  businessStatus?: string
  rating?: number
  userRatingCount?: number
  primaryType?: string
  primaryTypeDisplayName?: { text?: string; languageCode?: string }
  types?: string[]
  editorialSummary?: { text?: string; languageCode?: string }
  regularOpeningHours?: GoogleOpeningHours
  currentOpeningHours?: GoogleOpeningHours
  reviews?: Array<{
    name?: string
    rating?: number
    text?: { text?: string; languageCode?: string }
    originalText?: { text?: string; languageCode?: string }
    publishTime?: string
    relativePublishTimeDescription?: string
    googleMapsUri?: string
    authorAttribution?: {
      displayName?: string
      uri?: string
      photoUri?: string
    }
  }>
}

type GoogleOpeningHours = {
  openNow?: boolean
  weekdayDescriptions?: string[]
  periods?: Array<Record<string, unknown>>
  specialDays?: Array<Record<string, unknown>>
  nextOpenTime?: string
  nextCloseTime?: string
}

const GOOGLE_PLACES_TEXT_SEARCH_URL = 'https://places.googleapis.com/v1/places:searchText'
const GOOGLE_PLACES_DETAILS_URL = 'https://places.googleapis.com/v1/places'
const PLACES_CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000
const HOSPITAL_CACHE_COLUMNS = [
  'id', 'external_id', 'name', 'address', 'road_address', 'phone', 'link', 'lat', 'lng',
  'supported_animals', 'google_place_id', 'google_rating', 'google_review_count',
  'google_phone', 'google_website', 'opening_hours', 'current_opening_hours',
  'is_open_now', 'places_last_updated',
].join(',')
const DEFAULT_QUERY = '파충류 동물 병원'
const CORE_FIELD_MASK = [
  'places.id',
  'places.displayName',
  'places.formattedAddress',
  'places.location',
  'places.nationalPhoneNumber',
  'places.googleMapsUri',
  'places.websiteUri',
  'places.rating',
  'places.userRatingCount',
  'places.primaryType',
  'places.types',
  'places.editorialSummary',
  'places.regularOpeningHours',
  'places.currentOpeningHours',
  'places.reviews',
].join(',')
const FIELD_MASK = [
  CORE_FIELD_MASK,
  'places.internationalPhoneNumber',
  'places.shortFormattedAddress',
  'places.businessStatus',
  'places.primaryTypeDisplayName',
].join(',')
const DETAILS_FIELD_MASK = FIELD_MASK
  .split(',')
  .map((field) => field.replace(/^places\./, ''))
  .join(',')
const CORE_DETAILS_FIELD_MASK = CORE_FIELD_MASK
  .split(',')
  .map((field) => field.replace(/^places\./, ''))
  .join(',')

const REPTILE_KEYWORDS = [
  '파충류', '도마뱀', '게코', '거북', '거북이', '뱀', '이구아나', '카멜레온', '크레스티드', '레오파드', '비어디', '비어디드래곤', '스킨크', '왕도마뱀',
]
const AMPHIBIAN_KEYWORDS = [
  '양서류', '개구리', '팩맨', '팩맨프록', '트리프록', '두꺼비', '토드', '다트프록', '독화살개구리', '독화살 개구리', '도롱뇽', '뉴트', '살라만더', '살라만다', '아홀로틀',
]
type HerpCategory = 'reptile' | 'amphibian'

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const body = await readRequest(request)
    const query = body.query?.trim() || DEFAULT_QUERY
    const isDetailRequest = body.includeDetails === true || Boolean(body.placeId || body.googlePlaceId)
    const supabase = createServiceClient()
    let cachedRow: CachedHospitalRow | null = null

    if (isDetailRequest && supabase) {
      cachedRow = await findCachedHospital(supabase, body)
      if (cachedRow && isPlacesCacheFresh(cachedRow.places_last_updated)) {
        return cachedResponse(cachedRow, query, 'hit')
      }
    }

    const apiKey = Deno.env.get('GOOGLE_PLACES_API_KEY')
    if (!apiKey) {
      if (cachedRow) return cachedResponse(cachedRow, query, 'stale')
      return json({ error: 'missing_google_places_api_key' }, 500)
    }

    try {
      const requestedPlaceId = body.placeId || body.googlePlaceId
      const places = requestedPlaceId
        ? [await fetchGooglePlaceDetails(apiKey, requestedPlaceId)]
        : await searchGooglePlaces(apiKey, body)
      if (body.includeDetails && !requestedPlaceId && places.length > 0) {
        const bestMatch = selectBestPlace(places, body)
        if (bestMatch?.id) {
          places.splice(0, places.length, { ...bestMatch, ...await fetchGooglePlaceDetails(apiKey, bestMatch.id) })
        }
      }
      const hospitals = places
        .map(toHospitalCandidate)
        .filter((hospital): hospital is NonNullable<ReturnType<typeof toHospitalCandidate>> => Boolean(hospital))

      if (isDetailRequest && hospitals[0] && supabase) {
        try {
          await persistPlacesDetails(supabase, cachedRow, body, hospitals[0])
        } catch (error) {
          console.error('Google Places details were loaded but DB cache persistence failed:', error)
        }
      }

      return json({
        count: hospitals.length,
        query,
        source: 'google-places-new',
        cache: isDetailRequest ? 'refreshed' : 'bypass',
        hospitals,
      })
    } catch (error) {
      if (cachedRow) {
        console.error('Google Places refresh failed; stale DB cache returned:', error)
        return cachedResponse(cachedRow, query, 'stale')
      }
      throw error
    }
  } catch (error) {
    console.error('Google Places reptile/amphibian search failed:', error)
    return json({ error: 'google_places_search_failed', message: error instanceof Error ? error.message : 'Unknown error' }, 500)
  }
})

function createServiceClient() {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !serviceRoleKey) {
    console.error('Supabase service credentials are unavailable; Places DB cache is disabled.')
    return null
  }
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

type ServiceClient = NonNullable<ReturnType<typeof createServiceClient>>

async function findCachedHospital(supabase: ServiceClient, body: SearchRequest) {
  const findOne = async (column: string, value?: string) => {
    if (!value?.trim()) return null
    const { data, error } = await supabase
      .from('hospitals')
      .select(HOSPITAL_CACHE_COLUMNS)
      .eq(column, value.trim())
      .limit(1)
      .maybeSingle()
    if (error) throw error
    return data as CachedHospitalRow | null
  }

  const byExternalId = await findOne('external_id', body.hospitalId)
  if (byExternalId) return byExternalId

  if (body.hospitalId && isUuid(body.hospitalId)) {
    const byId = await findOne('id', body.hospitalId)
    if (byId) return byId
  }

  const byGoogleId = await findOne('google_place_id', body.placeId || body.googlePlaceId)
  if (byGoogleId) return byGoogleId

  if (Number.isFinite(body.latitude) && Number.isFinite(body.longitude)) {
    const latitude = body.latitude as number
    const longitude = body.longitude as number
    const { data, error } = await supabase
      .from('hospitals')
      .select(HOSPITAL_CACHE_COLUMNS)
      .gte('lat', latitude - 0.01)
      .lte('lat', latitude + 0.01)
      .gte('lng', longitude - 0.01)
      .lte('lng', longitude + 0.01)
      .limit(20)
    if (error) throw error
    const nearbyRows = (data ?? []) as CachedHospitalRow[]
    const normalizedQuery = normalizeText(body.query || '')
    const namedMatch = nearbyRows.find((row) => normalizedQuery.includes(normalizeText(row.name)))
    if (namedMatch) return namedMatch
    const closest = nearbyRows
      .filter((row) => row.lat !== null && row.lng !== null)
      .sort((left, right) =>
        getDistanceKm(latitude, longitude, left.lat as number, left.lng as number) -
        getDistanceKm(latitude, longitude, right.lat as number, right.lng as number)
      )[0]
    if (closest && getDistanceKm(latitude, longitude, closest.lat as number, closest.lng as number) <= 0.25) {
      return closest
    }
  }

  if (!body.hospitalName?.trim()) return null
  const { data, error } = await supabase
    .from('hospitals')
    .select(HOSPITAL_CACHE_COLUMNS)
    .eq('name', body.hospitalName.trim())
    .limit(10)
  if (error) throw error
  const rows = (data ?? []) as CachedHospitalRow[]
  if (rows.length <= 1 || !body.hospitalAddress) return rows[0] ?? null
  const normalizedAddress = normalizeText(body.hospitalAddress)
  return rows.find((row) => {
    const address = normalizeText(row.road_address || row.address || '')
    return address === normalizedAddress || address.includes(normalizedAddress) || normalizedAddress.includes(address)
  }) ?? rows[0]
}

function isPlacesCacheFresh(updatedAt: string | null) {
  if (!updatedAt) return false
  const timestamp = Date.parse(updatedAt)
  return Number.isFinite(timestamp) && Date.now() - timestamp < PLACES_CACHE_TTL_MS
}

function cachedResponse(row: CachedHospitalRow, query: string, cache: 'hit' | 'stale') {
  return json({
    count: 1,
    query,
    source: 'supabase-places-cache',
    cache,
    hospitals: [cachedRowToHospital(row)],
  })
}

function cachedRowToHospital(row: CachedHospitalRow) {
  const regularOpeningHours = row.opening_hours ?? null
  const currentOpeningHours = row.current_opening_hours ?? null
  return {
    id: row.google_place_id || row.external_id || row.id,
    googlePlaceId: row.google_place_id || '',
    name: row.name,
    address: row.road_address || row.address || '',
    phone: row.google_phone || row.phone || '',
    internationalPhone: '',
    lat: row.lat,
    lng: row.lng,
    supportedAnimals: row.supported_animals?.length ? row.supported_animals : ['reptile'],
    classification: 'confirmed',
    matchedQueries: [],
    evidence: { source: 'supabase-places-cache' },
    sources: ['supabase-places-cache'],
    rating: row.google_rating ?? undefined,
    userRatingCount: row.google_review_count ?? undefined,
    googleReviews: [],
    regularOpeningHours,
    currentOpeningHours,
    openingHours: currentOpeningHours?.weekdayDescriptions ?? regularOpeningHours?.weekdayDescriptions ?? [],
    isOpenNow: row.is_open_now,
    openingHoursUpdatedAt: row.places_last_updated || undefined,
    placesLastUpdated: row.places_last_updated || undefined,
    googleMapsUri: row.google_place_id ? `https://www.google.com/maps/search/?api=1&query_place_id=${encodeURIComponent(row.google_place_id)}` : '',
    websiteUri: row.google_website || '',
    shortAddress: '',
    businessStatus: '',
    primaryTypeLabel: '',
    link: row.google_website || row.link || '',
  }
}

async function persistPlacesDetails(
  supabase: ServiceClient,
  cachedRow: CachedHospitalRow | null,
  body: SearchRequest,
  hospital: NonNullable<ReturnType<typeof toHospitalCandidate>>,
) {
  const now = new Date().toISOString()
  const values = {
    google_place_id: hospital.googlePlaceId || cachedRow?.google_place_id || null,
    google_rating: hospital.rating ?? cachedRow?.google_rating ?? null,
    google_review_count: hospital.userRatingCount ?? cachedRow?.google_review_count ?? null,
    google_phone: hospital.phone || cachedRow?.google_phone || null,
    google_website: hospital.websiteUri || cachedRow?.google_website || null,
    opening_hours: hospital.regularOpeningHours ?? cachedRow?.opening_hours ?? null,
    current_opening_hours: hospital.currentOpeningHours ?? cachedRow?.current_opening_hours ?? null,
    is_open_now: hospital.isOpenNow ?? cachedRow?.is_open_now ?? null,
    places_last_updated: now,
    opening_hours_updated_at: now,
    updated_at: now,
  }

  if (cachedRow) {
    const { error } = await supabase.from('hospitals').update(values).eq('id', cachedRow.id)
    if (error) throw error
    return
  }

  const externalId = body.hospitalId?.trim() || hospital.id
  const { error } = await supabase.from('hospitals').upsert({
    external_id: externalId,
    name: body.hospitalName?.trim() || hospital.name,
    address: body.hospitalAddress?.trim() || hospital.address,
    road_address: body.hospitalAddress?.trim() || hospital.address,
    phone: hospital.phone || null,
    link: hospital.link || null,
    lat: hospital.lat,
    lng: hospital.lng,
    categories: hospital.supportedAnimals,
    supported_animals: hospital.supportedAnimals,
    source: 'google-places-cache',
    payload: { classification: hospital.classification, sources: hospital.sources },
    ...values,
  }, { onConflict: 'external_id' })
  if (error) throw error
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}

async function searchGooglePlaces(apiKey: string, body: SearchRequest) {
  const requestBody: Record<string, unknown> = {
    textQuery: body.query?.trim() || DEFAULT_QUERY,
    languageCode: 'ko',
    regionCode: 'KR',
    pageSize: clamp(body.pageSize, 1, 20, 10),
  }

  if (Number.isFinite(body.latitude) && Number.isFinite(body.longitude)) {
    requestBody.locationBias = {
      circle: {
        center: {
          latitude: body.latitude,
          longitude: body.longitude,
        },
        radius: clamp(body.radiusMeters, 1, 50_000, 20_000),
      },
    }
  }

  let response = await requestTextSearch(apiKey, requestBody, FIELD_MASK)
  if (response.status === 403) response = await requestTextSearch(apiKey, requestBody, CORE_FIELD_MASK)

  const text = await response.text()
  if (!response.ok) throw new Error(text.slice(0, 300))
  const data = JSON.parse(text) as { places?: GooglePlace[] }
  return data.places ?? []
}

function requestTextSearch(apiKey: string, requestBody: Record<string, unknown>, fieldMask: string) {
  return fetch(GOOGLE_PLACES_TEXT_SEARCH_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': fieldMask,
    },
    body: JSON.stringify(requestBody),
  })
}

async function fetchGooglePlaceDetails(apiKey: string, placeId: string) {
  const url = new URL(`${GOOGLE_PLACES_DETAILS_URL}/${encodeURIComponent(placeId)}`)
  url.searchParams.set('languageCode', 'ko')
  url.searchParams.set('regionCode', 'KR')
  let response = await requestPlaceDetails(url, apiKey, DETAILS_FIELD_MASK)
  if (response.status === 403) response = await requestPlaceDetails(url, apiKey, CORE_DETAILS_FIELD_MASK)
  const text = await response.text()
  if (!response.ok) throw new Error(`Google Place Details ${response.status}: ${text.slice(0, 300)}`)
  return JSON.parse(text) as GooglePlace
}

function requestPlaceDetails(url: URL, apiKey: string, fieldMask: string) {
  return fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': fieldMask,
    },
  })
}

function toHospitalCandidate(place: GooglePlace) {
  const name = place.displayName?.text?.trim() || ''
  const address = place.formattedAddress?.trim() || ''
  const evidenceText = [
    name,
    address,
    place.primaryType,
    ...(place.types ?? []),
    place.editorialSummary?.text,
    ...(place.reviews ?? []).flatMap((review) => [review.text?.text, review.originalText?.text]),
  ].filter(Boolean).join(' ')

  if (!looksLikeAnimalHospital(evidenceText)) return null
  const supportedAnimals = inferSupportedAnimals(evidenceText)
  const relevantGoogleReviews = (place.reviews ?? []).filter((review) => {
    const text = review.text?.text || review.originalText?.text || ''
    return inferSupportedAnimals(text).length > 0
  })
  const regularOpeningHours = place.regularOpeningHours ?? null
  const currentOpeningHours = place.currentOpeningHours ?? null
  const isOpenNow =
    currentOpeningHours?.openNow ??
    regularOpeningHours?.openNow ??
    null
  const weekdayDescriptions =
    currentOpeningHours?.weekdayDescriptions ??
    regularOpeningHours?.weekdayDescriptions ??
    []

  return {
    id: place.id || stableId(`${name}:${address}`),
    googlePlaceId: place.id || '',
    name,
    address,
    phone: place.nationalPhoneNumber || place.internationalPhoneNumber || '',
    internationalPhone: place.internationalPhoneNumber || '',
    lat: place.location?.latitude ?? null,
    lng: place.location?.longitude ?? null,
    supportedAnimals: supportedAnimals.length > 0 ? supportedAnimals : ['reptile'],
    classification: 'confirmed',
    matchedQueries: ['Google Places 파충류 동물 병원 검색'],
    evidence: buildEvidence(place, supportedAnimals.length > 0 ? supportedAnimals : ['reptile']),
    sources: ['google-places-new'],
    rating: place.rating,
    userRatingCount: place.userRatingCount,
    googleReviews: relevantGoogleReviews.map((review) => ({
      id: review.name || stableId(`${place.id || name}:${review.publishTime || ''}:${review.authorAttribution?.displayName || ''}`),
      authorName: review.authorAttribution?.displayName || '',
      authorUri: review.authorAttribution?.uri || '',
      authorPhotoUri: review.authorAttribution?.photoUri || '',
      rating: review.rating,
      text: review.text?.text || review.originalText?.text || '',
      publishTime: review.publishTime || '',
      relativePublishTimeDescription: review.relativePublishTimeDescription || '',
      googleMapsUri: review.googleMapsUri || place.googleMapsUri || '',
    })),
    regularOpeningHours,
    currentOpeningHours,
    openingHours: weekdayDescriptions,
    isOpenNow,
    openingHoursUpdatedAt: new Date().toISOString(),
    googleMapsUri: place.googleMapsUri || '',
    websiteUri: place.websiteUri || '',
    shortAddress: place.shortFormattedAddress || '',
    businessStatus: place.businessStatus || '',
    primaryTypeLabel: place.primaryTypeDisplayName?.text || '',
    link: place.websiteUri || place.googleMapsUri || '',
  }
}

function selectBestPlace(places: GooglePlace[], body: SearchRequest) {
  const normalizedQuery = normalizeText(body.query || '')
  return [...places].sort((left, right) => scorePlace(right, normalizedQuery, body) - scorePlace(left, normalizedQuery, body))[0]
}

function scorePlace(place: GooglePlace, normalizedQuery: string, body: SearchRequest) {
  const name = normalizeText(place.displayName?.text || '')
  const address = normalizeText(place.formattedAddress || '')
  let score = 0
  if (name && normalizedQuery.includes(name)) score += 80
  if (address && normalizedQuery.includes(address)) score += 40
  for (const token of normalizedQuery.split(/(?=[가-힣]{2,}|[a-z]{3,})/).filter((value) => value.length >= 2)) {
    if (name.includes(token)) score += 8
    if (address.includes(token)) score += 3
  }
  if (Number.isFinite(body.latitude) && Number.isFinite(body.longitude) && place.location?.latitude !== undefined && place.location.longitude !== undefined) {
    const distanceKm = getDistanceKm(body.latitude as number, body.longitude as number, place.location.latitude, place.location.longitude)
    score += Math.max(0, 30 - distanceKm * 6)
  }
  return score
}

function getDistanceKm(lat1: number, lng1: number, lat2: number, lng2: number) {
  const toRadians = (degree: number) => degree * Math.PI / 180
  const dLat = toRadians(lat2 - lat1)
  const dLng = toRadians(lng2 - lng1)
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLng / 2) ** 2
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function inferSupportedAnimals(text: string) {
  const normalized = normalizeText(text)
  const animals: HerpCategory[] = []
  if (REPTILE_KEYWORDS.some((keyword) => normalized.includes(normalizeText(keyword)))) animals.push('reptile')
  if (AMPHIBIAN_KEYWORDS.some((keyword) => normalized.includes(normalizeText(keyword)))) animals.push('amphibian')
  return animals
}

function buildEvidence(place: GooglePlace, supportedAnimals: HerpCategory[]) {
  return {
    source: 'google-places-new',
    supportedAnimals,
    displayName: place.displayName?.text || '',
    editorialSummary: place.editorialSummary?.text || '',
    reviews: (place.reviews ?? [])
      .map((review) => ({
        rating: review.rating,
        text: review.text?.text || review.originalText?.text || '',
        publishTime: review.publishTime,
      }))
      .filter((review) => inferSupportedAnimals(review.text).length > 0),
  }
}

function looksLikeAnimalHospital(text: string) {
  const normalized = normalizeText(text)
  return normalized.includes(normalizeText('동물병원')) ||
    normalized.includes(normalizeText('동물 병원')) ||
    normalized.includes('veterinary') ||
    normalized.includes('animalhospital') ||
    normalized.includes('animalclinic')
}

async function readRequest(request: Request): Promise<SearchRequest> {
  if (request.method === 'GET') {
    const url = new URL(request.url)
    return {
      query: url.searchParams.get('query') ?? undefined,
      pageSize: parseNumber(url.searchParams.get('pageSize')),
      latitude: parseNumber(url.searchParams.get('latitude')),
      longitude: parseNumber(url.searchParams.get('longitude')),
      radiusMeters: parseNumber(url.searchParams.get('radiusMeters')),
      includeDetails: url.searchParams.get('includeDetails') === 'true',
      placeId: url.searchParams.get('placeId') ?? undefined,
      hospitalId: url.searchParams.get('hospitalId') ?? undefined,
      hospitalName: url.searchParams.get('hospitalName') ?? undefined,
      hospitalAddress: url.searchParams.get('hospitalAddress') ?? undefined,
      googlePlaceId: url.searchParams.get('googlePlaceId') ?? undefined,
    }
  }

  if (request.method !== 'POST') throw new Error('Only GET and POST are supported.')
  return await request.json().catch(() => ({}))
}

function parseNumber(value: string | null) {
  if (!value) return undefined
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : undefined
}

function clamp(value: number | undefined, min: number, max: number, fallback: number) {
  if (!value || Number.isNaN(value)) return fallback
  return Math.min(Math.max(Math.floor(value), min), max)
}

function normalizeText(value: string) {
  return value.replace(/\s+/g, '').toLowerCase()
}

function stableId(value: string) {
  let hash = 0x811c9dc5
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return `google_${(hash >>> 0).toString(16)}`
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json; charset=utf-8',
    },
  })
}
