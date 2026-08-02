import { corsHeaders } from '../_shared/cors.ts'

type SearchRequest = {
  query?: string
  pageSize?: number
  latitude?: number
  longitude?: number
  radiusMeters?: number
  includeDetails?: boolean
  placeId?: string
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

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const apiKey = Deno.env.get('GOOGLE_PLACES_API_KEY')
    if (!apiKey) return json({ error: 'missing_google_places_api_key' }, 500)

    const body = await readRequest(request)
    const places = body.placeId
      ? [await fetchGooglePlaceDetails(apiKey, body.placeId)]
      : await searchGooglePlaces(apiKey, body)
    if (body.includeDetails && !body.placeId && places.length > 0) {
      const bestMatch = selectBestPlace(places, body)
      if (bestMatch?.id) {
        places.splice(0, places.length, { ...bestMatch, ...await fetchGooglePlaceDetails(apiKey, bestMatch.id) })
      }
    }
    const hospitals = places
      .map(toHospitalCandidate)
      .filter((hospital): hospital is NonNullable<ReturnType<typeof toHospitalCandidate>> => Boolean(hospital))

    return json({
      count: hospitals.length,
      query: body.query?.trim() || DEFAULT_QUERY,
      source: 'google-places-new',
      hospitals,
    })
  } catch (error) {
    console.error('Google Places reptile/amphibian search failed:', error)
    return json({ error: 'google_places_search_failed', message: error instanceof Error ? error.message : 'Unknown error' }, 500)
  }
})

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
    googleReviews: (place.reviews ?? []).map((review) => ({
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
  const animals: Array<'reptile'> = []
  if (REPTILE_KEYWORDS.some((keyword) => normalized.includes(normalizeText(keyword)))) animals.push('reptile')
  return animals
}

function buildEvidence(place: GooglePlace, supportedAnimals: Array<'reptile'>) {
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
