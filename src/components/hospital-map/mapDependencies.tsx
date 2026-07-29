/* This module intentionally groups the map feature's pure helpers and its small map icon. */
/* eslint-disable react-refresh/only-export-components */
import type { AnimalCategory, Coordinates, Hospital, HospitalReview, HospitalSnapshot, Pet } from '../../types/app'
import type { NaverMapApi } from '../../types/map'
import { supabase } from '../../lib/supabase'

const savedHospitalStorageKey = 'exocare-saved-hospitals'
const savedHospitalDetailsStorageKey = 'exocare-liked-hospitals'
let naverMapsLoader: Promise<NaverMapApi> | null = null
const hospitalCareCategories = ['reptile'] as const

export const animalCategoryOptions: AnimalCategory[] = ['all', 'reptile', 'amphibian', 'rodent', 'bird', 'other']
export const hospitalAnimalCategoryOptions: AnimalCategory[] = ['all', ...hospitalCareCategories]
export const animalCategoryLabels: Record<AnimalCategory, string> = {
  all: '전체',
  reptile: '파충류',
  bird: '조류',
  rodent: '설치류',
  amphibian: '양서류',
  other: '기타',
}

export function isHospitalCareCategory(category?: string): category is Exclude<AnimalCategory, 'all'> {
  return category === 'reptile'
}

export function toReviewAnimalCategory(category?: AnimalCategory): Exclude<AnimalCategory, 'all'> {
  if (isHospitalCareCategory(category)) return category
  return 'other'
}

const animalCategorySearchTerms: Record<AnimalCategory, string> = {
  all: '파충류 동물 병원',
  reptile: '파충류 동물 병원',
  bird: '파충류 동물 병원',
  rodent: '파충류 동물 병원',
  amphibian: '파충류 동물 병원',
  other: '파충류 동물 병원',
}

const exoticHospitalSearchTerms = ['특수동물병원', '이국동물병원', '파충류 동물병원', '파충류 동물 병원']
const hospitalGenericSearchWords = ['특수동물', '특수', '이국동물', '이국', '동물병원', '동물', '병원', '진료', '파충류']
const hospitalPositiveKeywords = ['동물병원', '동물 병원', '특수동물', '특수 동물', '이국동물', '이국 동물', '파충류', '양서류', '도마뱀', '게코', '거북', '거북이', '뱀', '이구아나', '카멜레온', '크레스티드', '레오파드', '비어디', '비어디드래곤', '스킨크', '왕도마뱀', '개구리', '팩맨', '트리프록', '두꺼비', '다트프록', '독화살 개구리', '도롱뇽', '뉴트', '살라만더', '살라만다', '아홀로틀']
const hospitalNegativeKeywords = ['애견카페', '카페', '펫샵', '애견샵', '용품', '미용', '호텔', '분양', '수족관', '아쿠아리움', '사료', '간식', '훈련소', '보호소']

const animalCategoryKeywords: Record<Exclude<AnimalCategory, 'all'>, string[]> = {
  reptile: ['파충류', '도마뱀', '게코', '거북', '거북이', '뱀', '이구아나', '카멜레온', '크레스티드', '레오파드', '비어디', '비어디드래곤', '스킨크', '왕도마뱀', '육지거북', '수생거북', '콘스네이크', '킹스네이크', '볼파이톤', '호그노즈'],
  bird: [],
  rodent: [],
  amphibian: ['양서류', '개구리', '팩맨', '팩맨프록', '트리프록', '두꺼비', '토드', '다트프록', '독화살 개구리', '도롱뇽', '뉴트', '살라만더', '살라만다', '아홀로틀'],
  other: [],
}

export const petSpeciesOptions: Record<Exclude<AnimalCategory, 'all'>, string[]> = {
  reptile: ['개코', '비어디드래곤', '이구아나', '카멜레온', '왕도마뱀', '스킨크', '육지 거북', '수생 습지 거북', '콘스네이크', '킹스네이크', '볼파이톤', '보아-파이톤', '호그노즈', '직접 입력'],
  bird: [],
  rodent: [],
  amphibian: ['팩맨', '트리프록', '두꺼비(토드)', '다트프록(독화살 개구리)', '뉴트', '살라만다', '아홀로틀', '직접 입력'],
  other: [],
}

export const reviewStorageKey = 'exocare-hospital-reviews'

export function readSavedHospitalSnapshots() {
  try {
    const stored = localStorage.getItem(savedHospitalDetailsStorageKey)
    if (!stored) {
      return readSavedHospitalIds().map((id) => ({
        id,
        name: id,
        address: '',
        phone: '',
        lat: 0,
        lng: 0,
        animalTags: [],
        naverLink: '',
        source: 'local_hospital_data' as const,
      }))
    }
    const parsed = JSON.parse(stored)
    return Array.isArray(parsed) ? parsed as HospitalSnapshot[] : []
  } catch {
    return []
  }
}

export function writeSavedHospitalSnapshots(items: HospitalSnapshot[]) {
  localStorage.setItem(savedHospitalDetailsStorageKey, JSON.stringify(items))
  localStorage.setItem(savedHospitalStorageKey, JSON.stringify(items.map((item) => item.id).filter(Boolean)))
}

export function CategoryTagIcon({ category }: { category: AnimalCategory }) {
  if (category === 'all') {
    return (
      <svg className="category-tag-icon" viewBox="0 0 48 48" aria-hidden="true">
        <circle cx="16" cy="16" r="6" />
        <circle cx="32" cy="16" r="6" />
        <circle cx="16" cy="32" r="6" />
        <circle cx="32" cy="32" r="6" />
      </svg>
    )
  }

  if (category === 'reptile') {
    return (
      <svg className="category-tag-icon" viewBox="0 0 48 48" aria-hidden="true">
        <path d="M28 8c7 0 11 5 9 12-2 8-9 11-17 10-5-.6-8-3.5-8-7.5 0-3.4 2.3-5.8 5.5-5.8 2.8 0 4.8 1.8 4.8 4.1" />
        <path d="M17 30c-6 2-9 6-9 11 9 1 15-2 18-9" />
        <path d="M16 20l-5-5M16 25l-6 1M23 31l-1 7M28 29l5 5M34 20l5-1" />
        <circle cx="30" cy="14" r="1.2" />
      </svg>
    )
  }

  if (category === 'rodent') {
    return (
      <svg className="category-tag-icon" viewBox="0 0 48 48" aria-hidden="true">
        <circle cx="16" cy="13" r="7" />
        <circle cx="32" cy="13" r="7" />
        <path d="M9 27c0-10 7-17 15-17s15 7 15 17c0 8-6 13-15 13S9 35 9 27Z" />
        <circle cx="18" cy="27" r="1.5" />
        <circle cx="30" cy="27" r="1.5" />
        <path d="M24 31v3M14 32H6M16 36l-8 4M34 32h8M32 36l8 4" />
      </svg>
    )
  }

  if (category === 'amphibian') {
    return (
      <svg className="category-tag-icon" viewBox="0 0 48 48" aria-hidden="true">
        <circle cx="16" cy="12" r="5" />
        <circle cx="32" cy="12" r="5" />
        <path d="M10 27c0-10 6-16 14-16s14 6 14 16c0 8-5 13-14 13S10 35 10 27Z" />
        <circle cx="16" cy="12" r="1.2" />
        <circle cx="32" cy="12" r="1.2" />
        <path d="M18 28c3 3 9 3 12 0M12 34l-5 5M36 34l5 5M14 23l-6 1M34 23l6 1" />
      </svg>
    )
  }

  return (
    <svg className="category-tag-icon" viewBox="0 0 48 48" aria-hidden="true">
      <path d="M12 31c6-12 14-19 24-21 1 8-2 16-8 21-5 4-11 5-16 0Z" />
      <path d="M28 12l9 5-7 3M21 34v8M28 32l4 9M15 40h10M27 40h9" />
      <circle cx="31" cy="15" r="1.2" />
    </svg>
  )
}


export function loadNaverMaps(clientId: string) {
  if (window.naver?.maps) return Promise.resolve(window.naver)
  if (naverMapsLoader) return naverMapsLoader

  naverMapsLoader = new Promise<NaverMapApi>((resolve, reject) => {
    const existingScript = document.querySelector<HTMLScriptElement>('script[data-naver-map-sdk="true"]')
    if (existingScript) {
      existingScript.addEventListener('load', () => window.naver?.maps ? resolve(window.naver) : reject(new Error('Naver Maps SDK authentication failed or maps namespace is unavailable.')), { once: true })
      existingScript.addEventListener('error', () => reject(new Error('Naver Maps SDK failed to load.')), { once: true })
      return
    }

    const script = document.createElement('script')
    script.src = `https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=${encodeURIComponent(clientId)}&submodules=geocoder`
    script.async = true
    script.dataset.naverMapSdk = 'true'
    script.addEventListener('load', () => window.naver?.maps ? resolve(window.naver) : reject(new Error('Naver Maps SDK authentication failed or maps namespace is unavailable.')), { once: true })
    script.addEventListener('error', () => reject(new Error('Naver Maps SDK failed to load.')), { once: true })
    document.head.appendChild(script)
  })

  return naverMapsLoader
}

export function readBrowserLocation() {
  return new Promise<Coordinates>((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation is unavailable.'))
      return
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({ lat: position.coords.latitude, lng: position.coords.longitude })
      },
      reject,
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 300_000 },
    )
  })
}

export async function searchHospitals(query: string, category: AnimalCategory, location: Coordinates | null) {
  const collectedHospitals = await loadCollectedHospitals(query, category)
  const liveHospitals = await loadLiveReptileHospitals(query, category, location)
  const hospitals = dedupeHospitals([...collectedHospitals, ...liveHospitals])
  return sortHospitalsByDistance(hospitals, location)
}

export async function loadCollectedHospitals(query: string, category: AnimalCategory) {
  const response = await fetch('/data/exotic-hospitals.json', { cache: 'no-store' })
  if (!response.ok) return []
  const items = await response.json() as Array<Record<string, unknown>>
  return transformHospitalItems(items, query, category)
}

export function transformHospitalItems(items: Array<Record<string, unknown>>, query: string, category: AnimalCategory) {
  return dedupeHospitals(items
    .filter((item) => isHospitalSearchResult(item, query, category))
    .map((item, index) => transformHospitalItem(item, index, query, category))
    .filter((hospital): hospital is Hospital => Boolean(hospital)))
    .filter((hospital) => hospitalMatchesQuery(hospital, query))
}

export function toHospitalSnapshot(hospital: Hospital): HospitalSnapshot {
  return {
    id: hospital.id,
    name: hospital.name,
    address: hospital.address || hospital.roadAddress || '',
    phone: hospital.phone,
    lat: hospital.lat,
    lng: hospital.lng,
    animalTags: hospital.categories.map((category) => animalCategoryLabels[category]),
    naverLink: hospital.link,
    source: hospital.link ? 'naver_local_search' : 'local_hospital_data',
  }
}

export function hospitalFromSnapshot(snapshot: HospitalSnapshot): Hospital {
  const categories = snapshot.animalTags
    .map((tag) => Object.entries(animalCategoryLabels).find(([, label]) => label === tag)?.[0])
    .filter(isHospitalCareCategory)

  return {
    id: snapshot.id || `${snapshot.name}-${snapshot.lat}-${snapshot.lng}`,
    name: snapshot.name,
    address: snapshot.address,
    phone: snapshot.phone,
    link: snapshot.naverLink,
    lat: snapshot.lat,
    lng: snapshot.lng,
    categories: categories.length ? categories : ['reptile'],
    matchedQueries: [snapshot.name],
  }
}

async function loadLiveReptileHospitals(query: string, category: AnimalCategory, location: Coordinates | null) {
  const normalizedQuery = buildHospitalSearchQuery(query, category)
  const locationKey = location ? `${Math.round(location.lat * 100)}:${Math.round(location.lng * 100)}` : 'no-location'
  const cacheKey = `exocare-live-reptile-hospitals:${normalizeText(normalizedQuery)}:${locationKey}`
  const cached = readHospitalCache(cacheKey)
  if (cached) return transformHospitalItems(cached, normalizedQuery, 'reptile')

  const merged: Array<Record<string, unknown>> = []

  const naverResult = await supabase.functions.invoke('search-hospitals', {
    body: {
      query: normalizedQuery,
      display: 100,
      start: 1,
      sort: 'random',
    },
  })
  if (naverResult.error) {
    console.error('Naver reptile hospital search failed:', naverResult.error)
  } else {
    const items = (naverResult.data as { items?: Array<Record<string, unknown>> } | null)?.items ?? []
    merged.push(...items.map((item) => ({
      ...item,
      supportedAnimals: ['reptile'],
      matchedQueries: [normalizedQuery],
      sources: ['naver-local-search'],
    })))
  }

  const googleResult = await supabase.functions.invoke('search-reptile-amphibian-places', {
    body: {
      query: normalizedQuery,
      pageSize: 20,
      latitude: location?.lat,
      longitude: location?.lng,
      radiusMeters: 50_000,
    },
  })
  if (googleResult.error) {
    console.error('Google Places reptile hospital search failed:', googleResult.error)
  } else {
    const hospitals = (googleResult.data as { hospitals?: Array<Record<string, unknown>> } | null)?.hospitals ?? []
    merged.push(...hospitals.map((hospital) => ({
      ...hospital,
      supportedAnimals: ['reptile'],
      matchedQueries: [normalizedQuery],
      sources: ['google-places-new'],
    })))
  }

  writeHospitalCache(cacheKey, merged)
  return transformHospitalItems(merged, normalizedQuery, 'reptile')
}

function transformHospitalItem(item: Record<string, unknown>, index: number, query: string, category: AnimalCategory): Hospital | null {
  const name = cleanHtml(String(item.title ?? item.name ?? '이름 없는 병원')).trim()
  const address = String(item.roadAddress ?? item.address ?? '')
  const lat = Number(item.lat)
  const lng = Number(item.lng)
  const mapx = Number(item.mapx ?? item.mapX)
  const mapy = Number(item.mapy ?? item.mapY)
  const coords = Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : convertNaverLocalCoords(mapx, mapy)
  if (!coords) return null

  const text = `${query} ${name} ${item.category ?? ''} ${item.description ?? ''} ${address} ${Array.isArray(item.matchedQueries) ? item.matchedQueries.join(' ') : ''} ${Array.isArray(item.evidence) ? JSON.stringify(item.evidence) : ''}`
  const rawSupportedAnimals = item.supportedAnimals
  const hasCollectedAnimals = Array.isArray(rawSupportedAnimals)
  const supportedAnimals = hasCollectedAnimals ? rawSupportedAnimals.map(String) : []
  const categories = supportedAnimals
    .filter(isHospitalCareCategory)
  const guessed = categories.length > 0 ? categories : guessAnimalCategories(text, category)
  if (guessed.length === 0) return null

  return {
    id: String(item.id ?? `${name}-${coords.lat}-${coords.lng}-${index}`),
    name,
    address,
    roadAddress: String(item.roadAddress ?? ''),
    phone: String(item.telephone ?? item.phone ?? ''),
    link: String(item.link ?? ''),
    lat: coords.lat,
    lng: coords.lng,
    categories: guessed,
    matchedQueries: Array.isArray(item.matchedQueries) ? item.matchedQueries.map(String) : [query],
  }
}

function convertNaverLocalCoords(mapx: number, mapy: number): Coordinates | null {
  if (!Number.isFinite(mapx) || !Number.isFinite(mapy)) return null

  const lng = mapx / 10_000_000
  const lat = mapy / 10_000_000
  if (lat >= 30 && lat <= 45 && lng >= 120 && lng <= 135) {
    return { lat, lng }
  }

  const naver = window.naver
  if (naver?.maps.TransCoord) {
    const latLng = naver.maps.TransCoord.fromTM128ToLatLng(new naver.maps.Point(mapx, mapy))
    return { lat: latLng.lat(), lng: latLng.lng() }
  }
  return null
}

function guessAnimalCategories(text: string, selectedCategory: AnimalCategory): Exclude<AnimalCategory, 'all'>[] {
  if (isHospitalCareCategory(selectedCategory)) return [selectedCategory]
  if (selectedCategory !== 'all') return []
  const normalized = normalizeText(text)
  const matched = Object.entries(animalCategoryKeywords)
    .filter(([category]) => isHospitalCareCategory(category))
    .filter(([, keywords]) => keywords.some((keyword) => normalized.includes(normalizeText(keyword))))
    .map(([category]) => category as Exclude<AnimalCategory, 'all'>)
  return matched
}

export function buildHospitalSearchQuery(query: string, category: AnimalCategory) {
  const trimmed = query.trim()
  const categoryTerm = animalCategorySearchTerms[category]
  if (!trimmed) return categoryTerm
  if (category === 'all') {
    return exoticHospitalSearchTerms.some((term) => normalizeText(trimmed).includes(normalizeText(term))) ? trimmed : `${trimmed} ${categoryTerm}`
  }
  return normalizeText(trimmed).includes(normalizeText(categoryTerm)) ? trimmed : `${trimmed} ${categoryTerm}`
}

export function isHospitalSearchResult(item: Record<string, unknown>, query: string, category: AnimalCategory) {
  void query
  if (Array.isArray(item.sources) && item.sources.includes('naver-local-search')) return true
  const text = normalizeText(`${item.title ?? item.name ?? ''} ${item.category ?? ''} ${item.description ?? ''} ${item.address ?? ''} ${item.roadAddress ?? ''} ${Array.isArray(item.supportedAnimals) ? item.supportedAnimals.join(' ') : ''}`)
  const hasAnimalHospitalSignal = hospitalPositiveKeywords.some((keyword) => text.includes(normalizeText(keyword)))
  const hasCategoryHospitalSignal = text.includes(normalizeText('동물병원')) || text.includes(normalizeText('동물 병원'))
  const hasNegativeSignal = hospitalNegativeKeywords.some((keyword) => text.includes(normalizeText(keyword)))

  if (category !== 'all') {
    const categoryTerm = animalCategorySearchTerms[category]
    return (hasAnimalHospitalSignal || text.includes(normalizeText(categoryTerm))) && (!hasNegativeSignal || hasCategoryHospitalSignal)
  }

  return hasAnimalHospitalSignal && (!hasNegativeSignal || hasCategoryHospitalSignal)
}

export function hospitalMatchesQuery(hospital: Hospital, query: string) {
  if (!query.trim()) return true

  const queryWithoutGenericTerms = exoticHospitalSearchTerms.reduce((value, term) => value.replaceAll(term, ' '), query)
  const genericWords = hospitalGenericSearchWords.map(normalizeText)
  const normalizedWords = queryWithoutGenericTerms
    .split(/[,\s]+/)
    .map(normalizeText)
    .filter((word) => word && !genericWords.includes(word))
  if (normalizedWords.length === 0) return true

  const target = normalizeText(`${hospital.name} ${hospital.address} ${hospital.roadAddress ?? ''} ${(hospital.matchedQueries ?? []).join(' ')}`)
  return normalizedWords.every((word) => target.includes(word))
}

export function sortHospitalsByDistance(hospitals: Hospital[], location: Coordinates | null) {
  return hospitals
    .map((hospital) => ({
      ...hospital,
      distanceKm: location ? getDistanceKm(location.lat, location.lng, hospital.lat, hospital.lng) : hospital.distanceKm,
    }))
    .sort((a, b) => (a.distanceKm ?? 9999) - (b.distanceKm ?? 9999))
}

function getDistanceKm(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2)
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function dedupeHospitals(hospitals: Hospital[]) {
  const unique = new Map<string, Hospital>()
  hospitals.forEach((hospital) => {
    const key = `${normalizeText(hospital.name)}:${normalizeText(hospital.address)}`
    const existing = unique.get(key)
    if (!existing) {
      unique.set(key, hospital)
      return
    }
    unique.set(key, {
      ...existing,
      categories: Array.from(new Set([...existing.categories, ...hospital.categories])),
      phone: existing.phone || hospital.phone,
      link: existing.link || hospital.link,
    })
  })
  return Array.from(unique.values())
}

export function hospitalMarkerContent(hospital: Hospital, active: boolean, reviewCount: number, liked: boolean) {
  const trusted = reviewCount >= 5
  const reviewLabel = reviewCount > 99 ? '99+' : String(reviewCount)
  return `<button class="exo-hospital-marker${active ? ' is-selected' : ''}${trusted ? ' is-reviewed' : ''}${liked ? ' is-liked' : ''}" type="button" aria-label="${escapeHtml(hospital.name)}, 리뷰 ${reviewCount}개"><span class="exo-marker-pin" aria-hidden="true"><b>H</b></span><span class="exo-marker-review" aria-hidden="true">${reviewLabel}</span>${liked ? '<span class="exo-marker-like" aria-hidden="true"></span>' : ''}</button>`
}

export function readStoredReviews() {
  try {
    const stored = localStorage.getItem(reviewStorageKey)
    if (!stored) return {}
    return JSON.parse(stored) as Record<string, HospitalReview[]>
  } catch {
    return {}
  }
}

function readHospitalCache(key: string) {
  try {
    const stored = sessionStorage.getItem(key)
    if (!stored) return null
    const parsed = JSON.parse(stored) as { savedAt?: number; items?: Array<Record<string, unknown>> }
    if (!parsed.savedAt || Date.now() - parsed.savedAt > 1000 * 60 * 30) return null
    return Array.isArray(parsed.items) ? parsed.items : null
  } catch {
    return null
  }
}

function writeHospitalCache(key: string, items: Array<Record<string, unknown>>) {
  try {
    sessionStorage.setItem(key, JSON.stringify({ savedAt: Date.now(), items }))
  } catch {
    // Session cache is an optimization only.
  }
}

function readSavedHospitalIds() {
  try {
    const stored = localStorage.getItem(savedHospitalStorageKey)
    if (!stored) return []
    const parsed = JSON.parse(stored)
    return Array.isArray(parsed) ? parsed.map(String) : []
  } catch {
    return []
  }
}

export function isSameHospitalIdentity(saved: HospitalSnapshot, hospital: Pick<Hospital, 'id' | 'name' | 'address'>) {
  if (saved.id && saved.id === hospital.id) return true
  const savedName = normalizeText(saved.name)
  const hospitalName = normalizeText(hospital.name)
  const savedAddress = normalizeText(saved.address)
  const hospitalAddress = normalizeText(hospital.address)
  return Boolean(savedName && hospitalName && savedName === hospitalName && savedAddress && hospitalAddress && savedAddress === hospitalAddress)
}

export function getReviewSummary(reviews: HospitalReview[]) {
  const distribution: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
  const tagCounts = new Map<string, number>()
  const animalCounts = new Map<Exclude<AnimalCategory, 'all'>, number>()
  let total = 0

  reviews.forEach((review) => {
    const rating = Math.min(5, Math.max(1, Math.round(review.rating || 0)))
    distribution[rating] += 1
    total += rating
    review.tags?.forEach((tag) => tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1))
    if (review.animalCategory) animalCounts.set(review.animalCategory, (animalCounts.get(review.animalCategory) ?? 0) + 1)
  })

  const count = reviews.length
  const topTags = Array.from(tagCounts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([tag]) => tag)
  const topAnimal = Array.from(animalCounts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0]
  return { count, average: count ? total / count : 0, distribution, topTags, topAnimal }
}

export function getRecentSpecies(reviews: HospitalReview[]) {
  return reviews.find((review) => review.species || review.animalCategory)?.species ?? ''
}

export function normalizePet(pet: Pet & { category?: string }): Pet {
  const rawCategory = pet.group ?? pet.category
  const categoryAliases: Record<string, Exclude<AnimalCategory, 'all'>> = {
    reptile: 'reptile', 파충류: 'reptile',
    bird: 'bird', 조류: 'bird',
    rodent: 'rodent', 설치류: 'rodent',
    amphibian: 'amphibian', 양서류: 'amphibian',
    other: 'other', 기타: 'other',
  }
  const inferredCategory = (Object.entries(petSpeciesOptions).find(([, species]) => species.includes(pet.species))?.[0] ?? 'other') as Exclude<AnimalCategory, 'all'>
  return {
    ...pet,
    group: categoryAliases[String(rawCategory)] ?? inferredCategory,
  }
}

export function formatReviewDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')}`
}

function cleanHtml(value: string) {
  return value.replace(/<[^>]*>/g, '').replaceAll('&amp;', '&').trim()
}

function escapeHtml(value: string) {
  return cleanHtml(value)
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
}

function normalizeText(value: string) {
  return cleanHtml(value).replace(/\s+/g, '').toLowerCase()
}

