import { corsHeaders } from '../_shared/cors.ts'

type SearchRequest = {
  query?: string
  pageSize?: number
  latitude?: number
  longitude?: number
  radiusMeters?: number
}

type GooglePlace = {
  id?: string
  displayName?: { text?: string; languageCode?: string }
  formattedAddress?: string
  location?: { latitude?: number; longitude?: number }
  nationalPhoneNumber?: string
  googleMapsUri?: string
  websiteUri?: string
  rating?: number
  userRatingCount?: number
  primaryType?: string
  types?: string[]
  editorialSummary?: { text?: string; languageCode?: string }
  reviews?: Array<{
    name?: string
    rating?: number
    text?: { text?: string; languageCode?: string }
    originalText?: { text?: string; languageCode?: string }
    publishTime?: string
  }>
}

const GOOGLE_PLACES_TEXT_SEARCH_URL = 'https://places.googleapis.com/v1/places:searchText'
const DEFAULT_QUERY = '파충류 동물 병원'
const FIELD_MASK = [
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
  'places.reviews',
].join(',')

const REPTILE_KEYWORDS = [
  '파충류', '도마뱀', '게코', '거북', '거북이', '뱀', '이구아나', '카멜레온', '크레스티드', '레오파드', '비어디', '비어디드래곤', '스킨크', '왕도마뱀',
]

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const apiKey = Deno.env.get('GOOGLE_PLACES_API_KEY')
    if (!apiKey) return json({ error: 'missing_google_places_api_key' }, 500)

    const body = await readRequest(request)
    const places = await searchGooglePlaces(apiKey, body)
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

  const response = await fetch(GOOGLE_PLACES_TEXT_SEARCH_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': FIELD_MASK,
    },
    body: JSON.stringify(requestBody),
  })

  const text = await response.text()
  if (!response.ok) throw new Error(text.slice(0, 300))
  const data = JSON.parse(text) as { places?: GooglePlace[] }
  return data.places ?? []
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

  return {
    id: place.id || stableId(`${name}:${address}`),
    name,
    address,
    phone: place.nationalPhoneNumber || '',
    lat: place.location?.latitude ?? null,
    lng: place.location?.longitude ?? null,
    supportedAnimals: supportedAnimals.length > 0 ? supportedAnimals : ['reptile'],
    classification: 'confirmed',
    matchedQueries: ['Google Places 파충류 동물 병원 검색'],
    evidence: buildEvidence(place, supportedAnimals.length > 0 ? supportedAnimals : ['reptile']),
    sources: ['google-places-new'],
    rating: place.rating,
    userRatingCount: place.userRatingCount,
    link: place.googleMapsUri || place.websiteUri || '',
  }
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
