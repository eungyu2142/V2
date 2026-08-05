import { type FormEvent, useEffect, useMemo, useRef, useState } from 'react'
import { linkReviewToDiary } from '../../features/diary/diaryService'
import type { PetRecord } from '../../features/diary/diaryTypes'
import { loadAppData } from '../../lib/appData'
import HospitalReviewForm from './MapAndReview'
import HeartIcon from '../common/HeartIcon'
import type { AnimalCategory, AppProfile, Coordinates, DraftItem, Hospital, HospitalReview, HospitalReviewDraftPayload, HospitalSnapshot, HospitalSort, MobileMapSheetState, Pet } from '../../types/app'
import { buildHospitalSearchQuery, createGoogleHtmlMarker, formatReviewDate, getReviewSummary, getTodayOpeningHoursDescription, hospitalFromSnapshot, hospitalMarkerContent, hospitalMatchesQuery, isHospitalCareCategory, isSameHospitalIdentity, loadGoogleHospitalDetails, loadGoogleMaps, readBrowserLocation, reviewStorageKey, searchHospitals, sortHospitalsByDistance, toHospitalSnapshot, toReviewAnimalCategory } from './mapDependencies'
import type { GoogleHtmlMarker, GoogleLatLngLiteral, GoogleMapInstance } from '../../types/map'
const HOSPITAL_LIST_PAGE_SIZE = 10
const HOSPITAL_REVIEWS_ENABLED = true
const HOSPITAL_RATING_ENABLED = true
const DEFAULT_MAP_CENTER: Coordinates = { lat: 37.5665, lng: 126.978 }
const MAP_LOCATION_SESSION_KEY = 'exocare-map-location'
function HospitalAddressIcon() {
  return (
    <svg className="hospital-detail-meta-icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 22c4.6-4.2 7-8 7-11.3A7 7 0 1 0 5 10.7C5 14 7.4 17.8 12 22Z" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.4" />
      <circle cx="12" cy="10.5" r="2.8" fill="currentColor" />
    </svg>
  )
}

function PhoneIcon() {
  return (
    <svg className="hospital-action-icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M7.2 3.4 4.8 5.8c-.7.7-.8 1.8-.3 2.8 2.4 5 5.9 8.5 10.9 10.9 1 .5 2.1.4 2.8-.3l2.4-2.4-4.2-3.1-2.1 2.1c-2.7-1.5-4.6-3.4-6.1-6.1l2.1-2.1-3.1-4.2Z" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" />
      <path d="M14.5 5.2c2.3.5 3.8 2 4.3 4.3M14.8 1.8c4 .7 6.7 3.4 7.4 7.4" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
    </svg>
  )
}

function CopyIcon() {
  return (
    <svg className="hospital-copy-svg" viewBox="0 0 24 24" aria-hidden="true">
      <rect x="8" y="7" width="11" height="13" rx="2.2" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="M16 7V5.8A2.8 2.8 0 0 0 13.2 3H5.8A2.8 2.8 0 0 0 3 5.8v9.4A2.8 2.8 0 0 0 5.8 18H8" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
    </svg>
  )
}

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="10.5" cy="10.5" r="6.5" fill="none" stroke="currentColor" strokeWidth="2.25" />
      <path d="m15.4 15.4 4.1 4.1" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="2.25" />
    </svg>
  )
}

function CurrentLocationIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 21c3.8-3.6 6-6.7 6-9.5a6 6 0 1 0-12 0c0 2.8 2.2 5.9 6 9.5Z" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
      <circle cx="12" cy="11" r="2.2" fill="currentColor" />
    </svg>
  )
}

function OpeningStatusIcon({ open }: { open: boolean }) {
  return (
    <svg className="hospital-status-icon" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      {open ? <circle className="hospital-status-icon-mark" cx="12" cy="12" r="3.6" /> : <path className="hospital-status-icon-mark" d="M8.2 12h7.6" />}
    </svg>
  )
}

type HospitalDisplayReviewSummary = {
  average: number
  count: number
  source: 'google' | 'exocare' | 'combined' | null
}

function getHospitalDisplayReviewSummary(hospital: Hospital, hospitalReviews: HospitalReview[]): HospitalDisplayReviewSummary {
  const exocareSummary = getReviewSummary(hospitalReviews.filter((review) => isHospitalCareCategory(review.animalCategory)))
  const googleRating = typeof hospital.rating === 'number' && hospital.rating > 0 ? hospital.rating : null

  if (googleRating !== null && exocareSummary.count > 0) {
    return { average: (googleRating + exocareSummary.average) / 2, count: exocareSummary.count, source: 'combined' }
  }
  if (googleRating !== null) {
    return { average: googleRating, count: 0, source: 'google' }
  }
  if (exocareSummary.count > 0) {
    return { average: exocareSummary.average, count: exocareSummary.count, source: 'exocare' }
  }
  return { average: 0, count: 0, source: null }
}

function getHospitalOpeningStatusLabel(hospital: Hospital) {
  if (hospital.isOpenNow === true) return '영업 중'
  if (hospital.isOpenNow === false) return '영업 종료'
  return null
}

function getOpeningTransitionDescription(hospital: Hospital, now = new Date()) {
  const hours = hospital.currentOpeningHours ?? hospital.regularOpeningHours
  const value = hospital.isOpenNow === true
    ? hours?.nextCloseTime
    : hospital.isOpenNow === false
      ? hours?.nextOpenTime
      : undefined
  if (!value) return null
  const target = new Date(value)
  if (Number.isNaN(target.getTime())) return null

  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const targetDay = new Date(target.getFullYear(), target.getMonth(), target.getDate())
  const dayDifference = Math.round((targetDay.getTime() - today.getTime()) / 86_400_000)
  const dayLabel = dayDifference === 0
    ? '오늘'
    : dayDifference === 1
      ? '내일'
      : `${target.getMonth() + 1}월 ${target.getDate()}일`
  const timeLabel = new Intl.DateTimeFormat('ko-KR', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(target)
  return `${dayLabel} ${timeLabel} ${hospital.isOpenNow === true ? '종료' : '영업 시작'}`
}

function buildHospitalDirectionsUrl(hospital: Hospital) {
  const query = encodeURIComponent(`${hospital.name} ${hospital.address}`.trim())
  const placeId = hospital.googlePlaceId ? `&destination_place_id=${encodeURIComponent(hospital.googlePlaceId)}` : ''
  return `https://www.google.com/maps/dir/?api=1&destination=${query}${placeId}`
}

function formatOpeningTime(value: string) {
  const match = value.trim().match(/^(오전|오후)\s*(\d{1,2}):(\d{2})$/)
  if (!match) return value.trim()
  const [, meridiem, rawHour, minute] = match
  let hour = Number(rawHour) % 12
  if (meridiem === '오후') hour += 12
  return `${String(hour).padStart(2, '0')}:${minute}`
}

function normalizeOpeningRange(value: string) {
  const [rawStart, rawEnd] = value.split(/\s*[~～]\s*/, 2)
  const start = rawStart?.trim() ?? ''
  let end = rawEnd?.trim() ?? ''
  if (!start || !end) return value.trim()

  const meridiem = start.match(/^(오전|오후)\s*/)?.[1]
  if (meridiem && !/^(오전|오후)\s*/.test(end)) end = `${meridiem} ${end}`
  return `${formatOpeningTime(start)} ~ ${formatOpeningTime(end)}`
}

function parseTodayOpeningHours(description: string | null) {
  if (!description) return { day: null, hours: null, breakTime: null }
  const separatorIndex = description.indexOf(':')
  const day = separatorIndex < 0 ? null : description.slice(0, separatorIndex).trim()
  const value = separatorIndex < 0 ? description : description.slice(separatorIndex + 1)
  const periods = value.split(/\s*,\s*/).map((period) => normalizeOpeningRange(period)).filter(Boolean)
  if (periods.length === 0) return { day, hours: null, breakTime: null }
  if (periods.length === 1) return { day, hours: periods[0], breakTime: null }

  const firstRange = periods[0].split(' ~ ')
  const secondRange = periods[1].split(' ~ ')
  const lastRange = periods[periods.length - 1].split(' ~ ')
  if (firstRange.length !== 2 || lastRange.length !== 2) return { day, hours: periods.join(', '), breakTime: null }

  return {
    day,
    hours: `${firstRange[0]} ~ ${lastRange[1]}`,
    breakTime: secondRange.length === 2 ? `${firstRange[1]} ~ ${secondRange[0]}` : null,
  }
}

function readSessionMapLocation(): Coordinates | null {
  try {
    const value = sessionStorage.getItem(MAP_LOCATION_SESSION_KEY)
    if (!value) return null
    const parsed = JSON.parse(value) as Partial<Coordinates>
    return typeof parsed.lat === 'number' && typeof parsed.lng === 'number'
      ? { lat: parsed.lat, lng: parsed.lng }
      : null
  } catch {
    return null
  }
}

function MapScreen({ userId, profile, pets, initialPetId, focusHospital, reviewDraft, reviews, likedHospitals, onReviewsChange, onLikedHospitalsChange, onCreateClinicRecord, onDeleteDraft }: { userId: string; profile: AppProfile; pets: Pet[]; initialPetId?: string; focusHospital?: HospitalSnapshot | null; reviewDraft?: DraftItem | null; reviews: Record<string, HospitalReview[]>; likedHospitals: HospitalSnapshot[]; onReviewsChange: (reviews: Record<string, HospitalReview[]>) => void; onLikedHospitalsChange: (hospitals: HospitalSnapshot[]) => void; onCreateClinicRecord: (hospital: HospitalSnapshot) => void; onDeleteDraft: (draftId: string) => void | Promise<void> }) {
  const googleMapsApiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY
  const [initialMapLocation] = useState<Coordinates | null>(readSessionMapLocation)
  const [query, setQuery] = useState('')
  const [selectedCategories, setSelectedCategories] = useState<Array<Exclude<AnimalCategory, 'all'>>>([])
  const [selectedSort, setSelectedSort] = useState<HospitalSort>('distance')
  const [openNowOnly, setOpenNowOnly] = useState(false)
  const [hospitals, setHospitals] = useState<Hospital[]>([])
  const [selectedHospitalId, setSelectedHospitalId] = useState<string | null>(null)
  const [currentLocation, setCurrentLocation] = useState<Coordinates | null>(initialMapLocation)
  const [mapStatus, setMapStatus] = useState<'loading' | 'ready' | 'error'>(googleMapsApiKey ? 'loading' : 'error')
  const [locationStatus, setLocationStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>(googleMapsApiKey ? 'loading' : 'idle')
  const [isLoading, setIsLoading] = useState(false)
  const [message, setMessage] = useState(googleMapsApiKey ? '' : '빌드 환경의 VITE_GOOGLE_MAPS_API_KEY를 확인해주세요.')
  const [isReviewFormOpen, setIsReviewFormOpen] = useState(false)
  const [isOpeningHoursExpanded, setIsOpeningHoursExpanded] = useState(false)
  const [copiedAddressHospitalId, setCopiedAddressHospitalId] = useState<string | null>(null)
  const [reviewRating, setReviewRating] = useState(5)
  const [reviewBody, setReviewBody] = useState('')
  const [reviewVisitDate, setReviewVisitDate] = useState(new Date().toISOString().slice(0, 10))
  const [reviewHasNextVisit, setReviewHasNextVisit] = useState(false)
  const [reviewNextVisitDate, setReviewNextVisitDate] = useState('')
  const [reviewNextVisitTime, setReviewNextVisitTime] = useState('09:00')
  const [reviewCost, setReviewCost] = useState('')
  const [reviewDiagnosis, setReviewDiagnosis] = useState('')
  const [reviewTreatment, setReviewTreatment] = useState('')
  const [reviewMedicine, setReviewMedicine] = useState('')
  const [reviewPetId, setReviewPetId] = useState(initialPetId && pets.some((pet) => pet.id === initialPetId && isHospitalCareCategory(pet.group)) ? initialPetId : pets.find((pet) => isHospitalCareCategory(pet.group))?.id ?? '')
  const [reviewMedicineStartDate, setReviewMedicineStartDate] = useState(new Date().toISOString().slice(0, 10))
  const [reviewMedicineEndDate, setReviewMedicineEndDate] = useState('')
  const [reviewMedicineDailyCount, setReviewMedicineDailyCount] = useState('1')
  const [reviewMedicineBagImage, setReviewMedicineBagImage] = useState('')
  const [reviewMedicineOcrRaw, setReviewMedicineOcrRaw] = useState<unknown>(null)
  const [reviewTags, setReviewTags] = useState<string[]>([])
  const [clinicRecords, setClinicRecords] = useState<PetRecord[]>([])
  const [reviewClinicRecordId, setReviewClinicRecordId] = useState('')
  const [isSidePanelCollapsed, setIsSidePanelCollapsed] = useState(false)
  const [mobileSheetState, setMobileSheetState] = useState<MobileMapSheetState>('collapsed')
  const [sheetDragY, setSheetDragY] = useState(0)
  const [isSheetDragging, setIsSheetDragging] = useState(false)
  const [editingReviewId, setEditingReviewId] = useState<string | null>(null)
  const [visibleHospitalCount, setVisibleHospitalCount] = useState(HOSPITAL_LIST_PAGE_SIZE)
  const mapElementRef = useRef<HTMLDivElement | null>(null)
  const mapInstanceRef = useRef<GoogleMapInstance | null>(null)
  const markersRef = useRef<GoogleHtmlMarker[]>([])
  const currentLocationMarkerRef = useRef<GoogleHtmlMarker | null>(null)
  const initialLocationRequestRef = useRef(false)
  const lastHospitalSearchKeyRef = useRef('')
  const sheetDragStartRef = useRef<number | null>(null)
  const sheetDragDistanceRef = useRef(0)

  function moveMapSmoothly(position: GoogleLatLngLiteral, zoom: number) {
    const map = mapInstanceRef.current
    if (!map) return

    try {
      map.panTo(position)
      if (map.getZoom() !== zoom) window.setTimeout(() => map.setZoom(zoom), 180)
      return
    } catch (error) {
      console.error('Google map smooth move error:', error)
    }

    map.setCenter(position)
    map.setZoom(zoom)
  }

  const sortedHospitals = useMemo(() => sortHospitalsByDistance(hospitals, currentLocation), [hospitals, currentLocation])
  const filteredHospitals = useMemo(() => {
    return sortedHospitals
      .filter((hospital) => hospitalMatchesQuery(hospital, query))
      .filter((hospital) => selectedCategories.length === 0 || hospital.categories.some((category) => selectedCategories.includes(category)))
      .filter((hospital) => !openNowOnly || hospital.isOpenNow === true)
      .sort((a, b) => {
        if (selectedSort === 'reviews') {
          const bCount = getReviewSummary((reviews[b.id] ?? []).filter((review) => isHospitalCareCategory(review.animalCategory))).count
          const aCount = getReviewSummary((reviews[a.id] ?? []).filter((review) => isHospitalCareCategory(review.animalCategory))).count
          return bCount - aCount
        }
        if (selectedSort === 'rating') {
          const bRating = getHospitalDisplayReviewSummary(b, reviews[b.id] ?? []).average
          const aRating = getHospitalDisplayReviewSummary(a, reviews[a.id] ?? []).average
          return bRating - aRating
        }
        return (a.distanceKm ?? 9999) - (b.distanceKm ?? 9999)
      })
  }, [openNowOnly, query, reviews, selectedCategories, selectedSort, sortedHospitals])
  const visibleHospitals = filteredHospitals.slice(0, visibleHospitalCount)
  const visibleHospitalDetailIds = visibleHospitals
    .filter((hospital) => !hospital.googleDetailsLoaded)
    .map((hospital) => hospital.id)
    .join('|')
  const hasMoreHospitals = visibleHospitalCount < filteredHospitals.length
  const selectedHospital = filteredHospitals.find((hospital) => hospital.id === selectedHospitalId) ?? null
  const selectedHospitalReviews = selectedHospital ? (reviews[selectedHospital.id] ?? []).filter((review) => isHospitalCareCategory(review.animalCategory)) : []
  const reviewDraftPayload = reviewDraft?.draftType === 'hospital_review' ? reviewDraft.payload as HospitalReviewDraftPayload : null
  const profileReviewAuthor = profile.nickname.trim() || profile.username.trim() || '사용자'
  const selectedReviewPet = pets.find((pet) => pet.id === reviewPetId)
  const selectedReviewAnimalCategory = toReviewAnimalCategory(selectedReviewPet?.group)
  const selectedReviewSpecies = selectedReviewPet?.species ?? ''
  const reviewablePets = pets.filter((pet) => isHospitalCareCategory(pet.group))
  const linkedClinicRecordIds = useMemo(
    () => new Set(Object.values(reviews).flatMap((items) => items.flatMap((review) => review.clinicRecordId ? [review.clinicRecordId] : []))),
    [reviews],
  )
  const reviewClinicRecordOptions = useMemo(
    () => clinicRecords
      .filter((record) => record.type === 'hospital' && record.petId === reviewPetId)
      .map((record) => ({
        id: record.id,
        hospitalName: record.clinicDetails?.hospitalName || record.hospitalId || '진료 기록',
        visitDate: record.clinicDetails?.visitDate || record.date,
        disabled: (Boolean(record.reviewId) || linkedClinicRecordIds.has(record.id)) && record.id !== reviewClinicRecordId,
      }))
      .sort((a, b) => b.visitDate.localeCompare(a.visitDate)),
    [clinicRecords, linkedClinicRecordIds, reviewClinicRecordId, reviewPetId],
  )
  const canSubmitHospitalReview = Boolean(
    reviewPetId
    && isHospitalCareCategory(selectedReviewPet?.group)
    && reviewBody.trim().length > 0
    && reviewVisitDate.trim().length > 0
    && reviewRating >= 1
    && (!reviewHasNextVisit || reviewNextVisitDate)
    && (!reviewMedicine.trim() || reviewMedicineEndDate)
  )
  const selectedHospitalIsLiked = selectedHospital ? likedHospitals.some((hospital) => isSameHospitalIdentity(hospital, selectedHospital)) : false
  const selectedHospitalOpeningHours = selectedHospital?.openingHours ?? []
  const selectedHospitalTodayHours = getTodayOpeningHoursDescription(selectedHospitalOpeningHours)
  const selectedHospitalTodaySchedule = parseTodayOpeningHours(selectedHospitalTodayHours)
  const selectedHospitalDisplayReviewSummary = selectedHospital
    ? getHospitalDisplayReviewSummary(selectedHospital, selectedHospitalReviews)
    : { average: 0, count: 0, source: null }
  const selectedHospitalOpeningTransition = selectedHospital ? getOpeningTransitionDescription(selectedHospital) : null

  useEffect(() => {
    let cancelled = false
    loadAppData<PetRecord>('care_records', { userId, scope: 'mine' })
      .then((items) => {
        if (!cancelled) setClinicRecords(items.filter((record) => record.type === 'hospital'))
      })
      .catch((error: unknown) => console.error('Clinic record load failed.', error))
    return () => { cancelled = true }
  }, [reviews, userId])

  useEffect(() => {
    let cancelled = false
    searchHospitals('', 'all', null)
      .then((items) => {
        if (cancelled) return
        setHospitals(items)
        setMessage('')
      })
      .catch((error) => {
        console.error('Collected hospital data load error:', error)
      })
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    const candidates = visibleHospitals.filter((hospital) => !hospital.googleDetailsLoaded)
    if (candidates.length === 0) return
    let cancelled = false

    const enrichVisibleHospitals = async () => {
      for (let index = 0; index < candidates.length; index += 2) {
        const batch = candidates.slice(index, index + 2)
        const details = await Promise.all(batch.map((hospital) => loadGoogleHospitalDetails(hospital)))
        if (cancelled) return
        const detailsById = new Map(details.filter((hospital): hospital is Hospital => Boolean(hospital)).map((hospital) => [hospital.id, hospital]))
        if (detailsById.size > 0) {
          setHospitals((items) => items.map((hospital) => detailsById.get(hospital.id) ?? hospital))
        }
      }
    }

    void enrichVisibleHospitals()
    return () => { cancelled = true }
    // The stable id string prevents detail updates from restarting the same batch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleHospitalDetailIds])

  useEffect(() => {
    if (!selectedHospital || selectedHospital.googleDetailsLoaded) return
    let cancelled = false
    loadGoogleHospitalDetails(selectedHospital)
      .then((details) => {
        if (cancelled || !details) return
        setHospitals((items) => items.map((item) => item.id === selectedHospital.id ? details : item))
      })
    return () => { cancelled = true }
  }, [selectedHospital])

  useEffect(() => {
    if (!focusHospital) return
    let cancelled = false
    queueMicrotask(() => {
      if (cancelled) return
      const hospital = hospitalFromSnapshot(focusHospital)
      setHospitals((items) => [hospital, ...items.filter((item) => item.id !== hospital.id)])
      setSelectedHospitalId(hospital.id)
      setMobileSheetState('expanded')
      setQuery(hospital.name)
      setSelectedCategories(hospital.categories.filter(isHospitalCareCategory))
    })
    return () => { cancelled = true }
  }, [focusHospital])

  useEffect(() => {
    if (!reviewDraftPayload) return
    const hospital = hospitalFromSnapshot(reviewDraftPayload.hospital)
    // This effect restores a draft opened from another screen.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHospitals((items) => [hospital, ...items.filter((item) => item.id !== hospital.id)])
    setSelectedHospitalId(hospital.id)
    setMobileSheetState('expanded')
    setIsReviewFormOpen(true)
    setEditingReviewId((reviews[hospital.id] ?? []).some((review) => review.id === reviewDraftPayload.review.id && review.mine === true) ? reviewDraftPayload.review.id : null)
    setReviewRating(reviewDraftPayload.review.rating)
    setReviewBody(reviewDraftPayload.review.body)
    setReviewVisitDate(reviewDraftPayload.review.visitDate ?? new Date().toISOString().slice(0, 10))
    setReviewHasNextVisit(Boolean(reviewDraftPayload.review.nextVisitDate))
    setReviewNextVisitDate(reviewDraftPayload.review.nextVisitDate ?? '')
    setReviewNextVisitTime(reviewDraftPayload.review.nextVisitTime ?? '09:00')
    setReviewCost(reviewDraftPayload.review.cost ? reviewDraftPayload.review.cost.toLocaleString('ko-KR') : '')
    setReviewDiagnosis(reviewDraftPayload.review.diagnosis ?? '')
    setReviewTreatment(reviewDraftPayload.review.treatment ?? '')
    setReviewMedicine(reviewDraftPayload.review.medicine ?? '')
    setReviewPetId(reviewDraftPayload.review.petId && pets.some((pet) => pet.id === reviewDraftPayload.review.petId && isHospitalCareCategory(pet.group)) ? reviewDraftPayload.review.petId : pets.find((pet) => isHospitalCareCategory(pet.group))?.id ?? '')
    setReviewMedicineStartDate(reviewDraftPayload.review.medicineStartDate ?? reviewDraftPayload.review.visitDate ?? new Date().toISOString().slice(0, 10))
    setReviewMedicineEndDate(reviewDraftPayload.review.medicineEndDate ?? '')
    setReviewMedicineDailyCount(String(reviewDraftPayload.review.medicineDailyCount ?? 1))
    setReviewMedicineBagImage(reviewDraftPayload.review.medicineBagImage ?? '')
    setReviewMedicineOcrRaw(reviewDraftPayload.review.medicineOcrRaw ?? null)
    setReviewTags(reviewDraftPayload.review.tags ?? [])
    setReviewClinicRecordId(reviewDraftPayload.review.clinicRecordId ?? '')
    setQuery(hospital.name)
    setSelectedCategories(hospital.categories.filter(isHospitalCareCategory))
  }, [pets, reviewDraftPayload, reviews])

  useEffect(() => {
    const handleGoogleMapsAuthFailure = () => {
      setMapStatus('error')
      setMessage('Google Cloud에서 Maps JavaScript API를 활성화해 주세요.')
    }
    window.addEventListener('exocare-google-maps-auth-failure', handleGoogleMapsAuthFailure)
    return () => window.removeEventListener('exocare-google-maps-auth-failure', handleGoogleMapsAuthFailure)
  }, [])

  useEffect(() => {
    if (!googleMapsApiKey) return

    let mounted = true

    loadGoogleMaps(googleMapsApiKey)
      .then((google) => {
        if (!mounted || !mapElementRef.current) return

        try {
          const centerLocation = initialMapLocation ?? DEFAULT_MAP_CENTER
          if (!google.maps) throw new Error('Google Maps JavaScript API authentication failed.')
          mapInstanceRef.current = new google.maps.Map(mapElementRef.current, {
            center: centerLocation,
            zoom: initialMapLocation ? 14 : 12,
            clickableIcons: false,
            fullscreenControl: false,
            gestureHandling: 'greedy',
            mapTypeControl: false,
            streetViewControl: false,
            zoomControl: true,
          })
          mapInstanceRef.current.addListener('click', () => {
            setSelectedHospitalId(null)
            setIsReviewFormOpen(false)
            setMobileSheetState('collapsed')
          })
          setMapStatus('ready')
        } catch (error) {
          console.error('Google map initialization error:', error)
          setMapStatus('error')
          setMessage('Google Maps JavaScript API 설정과 웹사이트 제한을 확인해주세요.')
        }
      })
      .catch((error) => {
        console.error('Google map load error:', error)
        if (!mounted) return
        setMapStatus('error')
        setMessage('Google Maps JavaScript API 키와 허용된 웹사이트 주소를 확인해주세요.')
      })

    return () => {
      mounted = false
      markersRef.current.forEach((marker) => marker.setMap(null))
      currentLocationMarkerRef.current?.setMap(null)
    }
  }, [googleMapsApiKey, initialMapLocation])

  useEffect(() => {
    if (initialLocationRequestRef.current) return
    initialLocationRequestRef.current = true

    readBrowserLocation()
      .then((location) => {
        sessionStorage.setItem(MAP_LOCATION_SESSION_KEY, JSON.stringify(location))
        setCurrentLocation(location)
        setLocationStatus('ready')
        setMessage('')
      })
      .catch((error) => {
        console.error('Initial geolocation error:', error)
        setLocationStatus('error')
        setMessage('')
      })
  }, [])

  useEffect(() => {
    const google = window.google
    const map = mapInstanceRef.current
    if (!google?.maps?.OverlayView || !map || !currentLocation) return

    const position = currentLocation
    currentLocationMarkerRef.current?.setMap(null)
    currentLocationMarkerRef.current = createGoogleHtmlMarker({
      api: google,
      position,
      map,
      title: '내 위치',
      html: '<div class="current-location-marker" aria-label="내 위치"><span></span></div>',
      zIndex: 180,
    })
    moveMapSmoothly(position, 14)
  }, [currentLocation, mapStatus])

  useEffect(() => {
    const google = window.google
    const map = mapInstanceRef.current
    const hospital = selectedHospital
    if (!google?.maps?.Map || !map || !hospital) return
    const position = { lat: hospital.lat, lng: hospital.lng }
    moveMapSmoothly(position, 16)
  }, [selectedHospital])

  useEffect(() => {
    const google = window.google
    const map = mapInstanceRef.current
    if (!google?.maps?.OverlayView || !map) return

    markersRef.current.forEach((marker) => marker.setMap(null))
    markersRef.current = []

    filteredHospitals.forEach((hospital) => {
      const position = { lat: hospital.lat, lng: hospital.lng }
      const appReviewCount = getReviewSummary(
        (reviews[hospital.id] ?? []).filter((review) => isHospitalCareCategory(review.animalCategory)),
      ).count
      const hospitalIsLiked = likedHospitals.some((likedHospital) => isSameHospitalIdentity(likedHospital, hospital))
      const marker = createGoogleHtmlMarker({
        api: google,
        position,
        map,
        title: hospital.name,
        html: hospitalMarkerContent(hospital, hospital.id === selectedHospitalId, appReviewCount, hospitalIsLiked),
        zIndex: hospital.id === selectedHospitalId ? 260 : 210,
        onClick: () => {
          setSelectedHospitalId(hospital.id)
          setMobileSheetState('middle')
        },
      })
      markersRef.current.push(marker)
    })
  }, [filteredHospitals, likedHospitals, mapStatus, reviews, selectedHospitalId])

  const getCurrentLocation = () => {
    setLocationStatus('loading')
    return readBrowserLocation()
      .then((location) => {
        sessionStorage.setItem(MAP_LOCATION_SESSION_KEY, JSON.stringify(location))
        setCurrentLocation(location)
        setLocationStatus('ready')
        return location
      })
      .catch((error) => {
        console.error('Geolocation error:', error)
        setLocationStatus('error')
        throw error
      })
  }

  const requestCurrentLocation = async () => {
    await getCurrentLocation().catch(() => {
      setMessage('현재 위치를 가져올 수 없어요. 브라우저 위치 권한을 확인해주세요.')
    })
  }

  const toggleSavedHospital = (hospital: Hospital) => {
    const snapshot = toHospitalSnapshot(hospital)
    const isLiked = likedHospitals.some((item) => isSameHospitalIdentity(item, hospital))
    const next = isLiked
      ? likedHospitals.filter((item) => !isSameHospitalIdentity(item, hospital))
      : [snapshot, ...likedHospitals.filter((item) => !isSameHospitalIdentity(item, hospital))]
    onLikedHospitalsChange(next)
  }

  async function runHospitalSearch(searchQuery: string, category: AnimalCategory, location: Coordinates | null) {
    const resolvedQuery = buildHospitalSearchQuery(searchQuery, category)
    const cacheKey = `${resolvedQuery}:${category}:${location ? `${Math.round(location.lat * 100)}:${Math.round(location.lng * 100)}` : 'no-location'}`
    if (lastHospitalSearchKeyRef.current === cacheKey || isLoading) return

    lastHospitalSearchKeyRef.current = cacheKey
    setIsLoading(true)

    try {
      const results = await searchHospitals(resolvedQuery, category, location)
      setHospitals(results)
      setVisibleHospitalCount(HOSPITAL_LIST_PAGE_SIZE)
    } catch (error) {
      console.error('Hospital search error:', error)
      lastHospitalSearchKeyRef.current = ''
    } finally {
      setIsLoading(false)
    }
  }

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (isLoading) return

    setSelectedHospitalId(null)
    const location = currentLocation ?? await getCurrentLocation().catch(() => null)
    lastHospitalSearchKeyRef.current = ''
    await runHospitalSearch(query, selectedCategories[0] ?? 'all', location)
  }

  const resetReviewForm = () => {
    setEditingReviewId(null)
    setReviewRating(5)
    setReviewBody('')
    setReviewVisitDate(new Date().toISOString().slice(0, 10))
    setReviewHasNextVisit(false)
    setReviewNextVisitDate('')
    setReviewNextVisitTime('09:00')
    setReviewCost('')
    setReviewDiagnosis('')
    setReviewTreatment('')
    setReviewMedicine('')
    setReviewMedicineStartDate(new Date().toISOString().slice(0, 10))
    setReviewMedicineEndDate('')
    setReviewMedicineDailyCount('1')
    setReviewMedicineBagImage('')
    setReviewMedicineOcrRaw(null)
    setReviewTags([])
    setReviewClinicRecordId('')
    setReviewPetId(initialPetId && pets.some((pet) => pet.id === initialPetId && isHospitalCareCategory(pet.group)) ? initialPetId : pets.find((pet) => isHospitalCareCategory(pet.group))?.id ?? '')
  }

  const closeReviewForm = () => {
    resetReviewForm()
    setIsReviewFormOpen(false)
  }

  const beginReviewEdit = (review: HospitalReview) => {
    if (!review.mine) return
    setEditingReviewId(review.id)
    setReviewRating(review.rating)
    setReviewBody(review.body || review.content || '')
    setReviewVisitDate(review.visitDate ?? new Date().toISOString().slice(0, 10))
    setReviewHasNextVisit(Boolean(review.nextVisitDate))
    setReviewNextVisitDate(review.nextVisitDate ?? '')
    setReviewNextVisitTime(review.nextVisitTime ?? '09:00')
    setReviewCost(review.cost ? review.cost.toLocaleString('ko-KR') : '')
    setReviewDiagnosis(review.diagnosis ?? '')
    setReviewTreatment(review.treatment ?? '')
    setReviewMedicine(review.medicine ?? '')
    setReviewMedicineStartDate(review.medicineStartDate ?? review.visitDate ?? new Date().toISOString().slice(0, 10))
    setReviewMedicineEndDate(review.medicineEndDate ?? '')
    setReviewMedicineDailyCount(String(review.medicineDailyCount ?? 1))
    setReviewMedicineBagImage(review.medicineBagImage ?? '')
    setReviewMedicineOcrRaw(review.medicineOcrRaw ?? null)
    setReviewTags(review.tags ?? [])
    setReviewClinicRecordId(review.clinicRecordId ?? clinicRecords.find((record) => record.reviewId === review.id)?.id ?? '')
    setReviewPetId(review.petId && pets.some((pet) => pet.id === review.petId && isHospitalCareCategory(pet.group)) ? review.petId : pets.find((pet) => isHospitalCareCategory(pet.group))?.id ?? '')
    setIsReviewFormOpen(true)
  }

  const selectClinicRecordForReview = (recordId: string) => {
    setReviewClinicRecordId(recordId)
    if (!recordId) return
    const record = clinicRecords.find((item) => item.id === recordId)
    const details = record?.clinicDetails
    if (!record || !details) return
    setReviewPetId(record.petId)
    setReviewVisitDate(details.visitDate)
    setReviewCost(details.cost ? details.cost.toLocaleString('ko-KR') : '')
    setReviewDiagnosis(details.diagnosis ?? '')
    setReviewTreatment(details.treatment ?? '')
    setReviewBody(details.reviewBody ?? record.memo ?? '')
    setReviewHasNextVisit(Boolean(details.nextVisit))
    setReviewNextVisitDate(details.nextVisit?.date ?? '')
    setReviewNextVisitTime(details.nextVisit?.time ?? '09:00')
    setReviewMedicine(details.medicine?.name ?? '')
    setReviewMedicineStartDate(details.medicine?.startDate ?? details.visitDate)
    setReviewMedicineEndDate(details.medicine?.endDate ?? '')
    setReviewMedicineDailyCount(String(details.medicine?.dailyCount ?? 1))
  }

  const submitReview = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!selectedHospital || !canSubmitHospitalReview) return

    const reviewPet = pets.find((pet) => pet.id === reviewPetId)
    const existingReview = editingReviewId ? selectedHospitalReviews.find((item) => item.id === editingReviewId) : null

    const review: HospitalReview = {
      id: editingReviewId ?? reviewDraftPayload?.review.id ?? crypto.randomUUID(),
      hospitalId: selectedHospital.id,
      petId: reviewPetId,
      petName: reviewPet?.name,
      clinicRecordId: reviewClinicRecordId || existingReview?.clinicRecordId,
      author: profileReviewAuthor,
      authorAvatarUrl: profile.avatarUrl,
      animalCategory: selectedReviewAnimalCategory,
      species: selectedReviewSpecies,
      rating: reviewRating,
      visitDate: reviewVisitDate,
      nextVisitDate: reviewHasNextVisit ? reviewNextVisitDate : undefined,
      nextVisitTime: reviewHasNextVisit ? reviewNextVisitTime : undefined,
      cost: Number(reviewCost.replace(/\D/g, '')) || undefined,
      diagnosis: reviewDiagnosis.trim(),
      treatment: reviewTreatment.trim(),
      medicine: reviewMedicine.trim(),
      medicineStartDate: reviewMedicineStartDate,
      medicineEndDate: reviewMedicineEndDate,
      medicineDailyCount: Math.max(1, Number(reviewMedicineDailyCount) || 1),
      medicineBagImage: reviewMedicineBagImage || undefined,
      medicineOcrRaw: reviewMedicineOcrRaw ?? undefined,
      tags: reviewTags,
      body: reviewBody.trim(),
      content: reviewBody.trim(),
      mine: true,
      liked: existingReview?.liked ?? reviewDraftPayload?.review.liked ?? false,
      likes: existingReview?.likes ?? reviewDraftPayload?.review.likes ?? 0,
      hospitalName: selectedHospital.name,
      hospitalSnapshot: toHospitalSnapshot(selectedHospital),
      createdAt: existingReview?.createdAt ?? reviewDraftPayload?.review.createdAt ?? new Date().toISOString(),
    }

    const nextReviews = { ...reviews, [selectedHospital.id]: [review, ...(reviews[selectedHospital.id] ?? []).filter((item) => item.id !== review.id)] }
    localStorage.setItem(reviewStorageKey, JSON.stringify(nextReviews))
    onReviewsChange(nextReviews)
    try {
      if (!reviewClinicRecordId) {
        resetReviewForm()
        setIsReviewFormOpen(false)
        if (reviewDraft) void onDeleteDraft(reviewDraft.id)
        return
      }
      await linkReviewToDiary({
        userId,
        reviewId: review.id,
        clinicRecordId: reviewClinicRecordId,
        petId: reviewPetId,
        hospitalName: selectedHospital.name,
        visitDate: reviewVisitDate,
        cost: Number(reviewCost.replace(/\D/g, '')) || undefined,
        diagnosis: reviewDiagnosis.trim(),
        treatment: reviewTreatment.trim(),
        reviewBody: reviewBody.trim(),
        nextVisit: reviewHasNextVisit && reviewNextVisitDate ? {
          date: reviewNextVisitDate,
          time: reviewNextVisitTime || '09:00',
        } : undefined,
        medicine: reviewMedicine.trim() ? {
          name: reviewMedicine.trim(),
          startDate: reviewMedicineStartDate || reviewVisitDate,
          endDate: reviewMedicineEndDate || undefined,
          dailyCount: Math.max(1, Number(reviewMedicineDailyCount) || 1),
          ocrRaw: reviewMedicineOcrRaw,
        } : undefined,
      })
      setClinicRecords((current) => current.map((record) => record.id === reviewClinicRecordId ? { ...record, reviewId: review.id } : record))
    } catch (error) {
      console.error('Review diary link failed.', error)
      setMessage('리뷰는 저장됐지만 다이어리 연결에 실패했어요.')
    }
    resetReviewForm()
    setIsReviewFormOpen(false)
    if (reviewDraft) void onDeleteDraft(reviewDraft.id)
  }

  const toggleReviewTag = (tag: string) => {
    setReviewTags((current) => current.includes(tag) ? current.filter((item) => item !== tag) : current.length >= 5 ? current : [...current, tag])
  }

  const toggleReviewLike = (hospitalId: string, reviewId: string) => {
    const nextReviews = {
      ...reviews,
      [hospitalId]: (reviews[hospitalId] ?? []).map((review) => {
        if (review.id !== reviewId) return review
        const liked = !review.liked
        const likes = Math.max(0, (review.likes ?? 0) + (liked ? 1 : -1))
        return { ...review, liked, likes }
      }),
    }
    localStorage.setItem(reviewStorageKey, JSON.stringify(nextReviews))
    onReviewsChange(nextReviews)
  }

  const deleteReview = (hospitalId: string, reviewId: string) => {
    const targetReview = (reviews[hospitalId] ?? []).find((review) => review.id === reviewId)
    if (!targetReview?.mine) return
    if (!window.confirm('내가 쓴 리뷰를 삭제할까요?')) return

    const nextHospitalReviews = (reviews[hospitalId] ?? []).filter((review) => review.id !== reviewId)
    const nextReviews = { ...reviews, [hospitalId]: nextHospitalReviews }
    localStorage.setItem(reviewStorageKey, JSON.stringify(nextReviews))
    onReviewsChange(nextReviews)

    if (editingReviewId === reviewId) {
      resetReviewForm()
      setIsReviewFormOpen(false)
    }
  }

  const beginSheetDrag = (event: { clientY: number; currentTarget: { setPointerCapture?: (pointerId: number) => void }; pointerId: number; stopPropagation: () => void }) => {
    sheetDragStartRef.current = event.clientY
    sheetDragDistanceRef.current = 0
    setIsSheetDragging(true)
    setSheetDragY(0)
    event.currentTarget.setPointerCapture?.(event.pointerId)
    event.stopPropagation()
  }

  const moveSheetDrag = (event: { clientY: number; preventDefault: () => void }) => {
    if (sheetDragStartRef.current === null) return
    const nextDragY = event.clientY - sheetDragStartRef.current
    sheetDragDistanceRef.current = nextDragY
    setSheetDragY(nextDragY)
    if (Math.abs(nextDragY) > 0) event.preventDefault()
  }

  const finishSheetDrag = () => {
    const dragDistance = sheetDragDistanceRef.current
    sheetDragStartRef.current = null
    sheetDragDistanceRef.current = 0
    setIsSheetDragging(false)
    setSheetDragY(0)

    if (dragDistance < -48) {
      setMobileSheetState((state) => {
        if (state === 'expanded') return state
        if (state === 'middle') return 'expanded'
        return dragDistance < -120 ? 'expanded' : 'middle'
      })
      return
    }

    if (dragDistance <= 56) return

    if (mobileSheetState === 'expanded') {
      setMobileSheetState('middle')
      return
    }

    if (mobileSheetState === 'middle') {
      setMobileSheetState('collapsed')
      return
    }

    if (selectedHospital) {
      setSelectedHospitalId(null)
      setIsReviewFormOpen(false)
      setMobileSheetState('collapsed')
      return
    }

    setMobileSheetState('collapsed')
  }

  const sheetDragHandlers = {
    onPointerDown: beginSheetDrag,
    onPointerMove: moveSheetDrag,
    onPointerUp: finishSheetDrag,
    onPointerCancel: finishSheetDrag,
  }

  useEffect(() => {
    document.documentElement.classList.add('map-overscroll-lock')
    document.body.classList.add('map-overscroll-lock')
    return () => {
      document.documentElement.classList.remove('map-overscroll-lock')
      document.body.classList.remove('map-overscroll-lock')
    }
  }, [])

  useEffect(() => {
    const openFromBottomNav = () => {
      setIsReviewFormOpen(false)
      setMobileSheetState((state) => state === 'expanded' ? 'expanded' : 'expanded')
    }
    window.addEventListener('map-bottom-nav-swipe-up', openFromBottomNav)
    return () => window.removeEventListener('map-bottom-nav-swipe-up', openFromBottomNav)
  }, [])

  useEffect(() => {
    if (!isReviewFormOpen) return
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      setIsReviewFormOpen(false)
      setEditingReviewId(null)
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [isReviewFormOpen])

  useEffect(() => {
    if (!copiedAddressHospitalId) return
    const timeout = window.setTimeout(() => setCopiedAddressHospitalId(null), 1800)
    return () => window.clearTimeout(timeout)
  }, [copiedAddressHospitalId])

  const copyHospitalAddress = async (hospital: Hospital) => {
    if (!hospital.address) return
    try {
      await navigator.clipboard.writeText(hospital.address)
      setCopiedAddressHospitalId(hospital.id)
    } catch (error) {
      console.error('Hospital address copy failed.', error)
    }
  }

  return (
    <section className={`map-page mobile-sheet-${mobileSheetState} ${selectedHospital ? 'has-selected-hospital' : ''}`}>
      <section className="map-area">
        <div className="map-canvas" ref={mapElementRef} />
        {mapStatus !== 'ready' && (
          <div className="map-load-state">
            <strong>{mapStatus === 'error' ? '지도를 불러오지 못했습니다' : 'Google 지도를 불러오는 중입니다'}</strong>
            {mapStatus === 'error' && <small>{message || 'VITE_GOOGLE_MAPS_API_KEY와 Google Cloud의 웹사이트 제한을 확인해 주세요.'}</small>}
          </div>
        )}
      </section>
      <aside className={`map-side-panel ${isSidePanelCollapsed ? 'collapsed' : ''}`} aria-label="병원 검색과 정보">
        <button className="map-side-collapse-toggle" type="button" onClick={() => setIsSidePanelCollapsed((value) => !value)} aria-label={isSidePanelCollapsed ? '병원 목록 열기' : '병원 목록 닫기'}>
          <span aria-hidden="true" />
          <b>{isSidePanelCollapsed ? '열기' : '닫기'}</b>
        </button>
        {!isSidePanelCollapsed && (
          <button className="map-panel-close-button" type="button" onClick={() => setIsSidePanelCollapsed(true)} aria-label="병원 찾기 닫기">
            <span aria-hidden="true" />
          </button>
        )}
        <form className="map-search-panel" onSubmit={submit}>
          <div className="map-search-field">
            <label htmlFor="hospital-map-search">병원 검색</label>
            <span className="map-search-leading-icon" aria-hidden="true"><SearchIcon /></span>
            <input id="hospital-map-search" value={query} onChange={(event) => { setQuery(event.target.value); setVisibleHospitalCount(HOSPITAL_LIST_PAGE_SIZE) }} placeholder="지역명 또는 병원명을 입력하세요" />
          </div>
          <button className="secondary-button" type="button" disabled={locationStatus === 'loading'} onClick={requestCurrentLocation}>
            <CurrentLocationIcon />
            <span>{locationStatus === 'loading' ? '확인중' : '내 위치'}</span>
          </button>
        </form>

        <div className="map-sort-tabs" aria-label="병원 정렬과 필터">
          {([
            ['distance', '가까운 순'],
            ['reviews', '리뷰 많은 순'],
            ['rating', '평점 높은 순'],
          ] as Array<[HospitalSort, string]>).map(([sort, label]) => (
            <button className={selectedSort === sort ? 'active' : ''} type="button" key={sort} onClick={() => { setSelectedSort(sort); setVisibleHospitalCount(HOSPITAL_LIST_PAGE_SIZE) }}>
              {label}
            </button>
          ))}
          <button className={openNowOnly ? 'active' : ''} type="button" aria-pressed={openNowOnly} onClick={() => { setOpenNowOnly((value) => !value); setVisibleHospitalCount(HOSPITAL_LIST_PAGE_SIZE) }}>
            영업 중
          </button>
        </div>

        <section className={`map-hospital-list mobile-sheet-${mobileSheetState} ${isSheetDragging ? 'is-dragging' : ''}`} aria-label="검색된 병원" style={{ transform: sheetDragY ? `translateY(${sheetDragY}px)` : undefined }}>
          <span className="map-sheet-handle" aria-hidden="true" {...sheetDragHandlers} />
          {filteredHospitals.length === 0 ? (
            <p className="map-side-empty">검색 버튼을 누르거나 분류를 바꿔 병원을 찾아보세요.</p>
          ) : (
            <>
              {visibleHospitals.map((hospital) => (
                <HospitalListRow
                  hospital={hospital}
                  reviews={reviews[hospital.id] ?? []}
                  key={hospital.id}
                  active={hospital.id === selectedHospitalId}
                  onSelect={() => { setSelectedHospitalId(hospital.id); setMobileSheetState('middle') }}
                />
              ))}
              {hasMoreHospitals && (
                <button className="map-hospital-more-button" type="button" onClick={() => setVisibleHospitalCount((count) => count + HOSPITAL_LIST_PAGE_SIZE)}>
                  더보기
                </button>
              )}
            </>
          )}
        </section>

      </aside>

      {selectedHospital && (
        <article className={`map-hospital-panel map-detail-dock mobile-sheet-${mobileSheetState} ${isSheetDragging ? 'is-dragging' : ''}`} style={{ transform: sheetDragY ? `translateY(${sheetDragY}px)` : undefined }}>
          <span className="map-sheet-handle" aria-hidden="true" {...sheetDragHandlers} />
          <header className="hospital-detail-header">
            <strong>{selectedHospital.name}</strong>
            <div className="hospital-detail-tools">
              <button
                className={`hospital-detail-like ${selectedHospitalIsLiked ? 'active' : ''}`}
                type="button"
                aria-label={selectedHospitalIsLiked ? '병원 좋아요 취소' : '병원 좋아요'}
                aria-pressed={selectedHospitalIsLiked}
                onClick={() => toggleSavedHospital(selectedHospital)}
              >
                <HeartIcon filled={selectedHospitalIsLiked} />
              </button>
              <button className="panel-close" type="button" aria-label="병원 상세 닫기" onClick={() => setSelectedHospitalId(null)} />
            </div>
          </header>

          <div className="hospital-detail-summary" aria-label="병원 요약 정보">
            {HOSPITAL_RATING_ENABLED && <HospitalRatingSummary summary={selectedHospitalDisplayReviewSummary} />}
            <span className="hospital-summary-distance">{selectedHospital.distanceKm === undefined ? '거리 계산 전' : `${selectedHospital.distanceKm.toFixed(1)}km`}</span>
            {getHospitalOpeningStatusLabel(selectedHospital) && (
              <span className={`hospital-open-status ${selectedHospital.isOpenNow === true ? 'is-open' : 'is-closed'}`}>
                <OpeningStatusIcon open={selectedHospital.isOpenNow === true} />
                {getHospitalOpeningStatusLabel(selectedHospital)}
              </span>
            )}
          </div>
          {selectedHospitalOpeningTransition && <p className="hospital-opening-transition">{selectedHospitalOpeningTransition}</p>}

          <section className="hospital-basic-info" aria-label="병원 기본 정보">
            <div className="hospital-address-row">
              <p><HospitalAddressIcon />{selectedHospital.address || '주소 정보 없음'}</p>
              {selectedHospital.address && (
                <button className={`hospital-address-copy ${copiedAddressHospitalId === selectedHospital.id ? 'copied' : ''}`} type="button" aria-label={copiedAddressHospitalId === selectedHospital.id ? '주소 복사 완료' : '병원 주소 복사'} title={copiedAddressHospitalId === selectedHospital.id ? '복사됨' : '주소 복사'} onClick={() => void copyHospitalAddress(selectedHospital)}>
                  <CopyIcon />
                  <span className="sr-only">{copiedAddressHospitalId === selectedHospital.id ? '복사됨' : '복사'}</span>
                </button>
              )}
            </div>
            <div className="hospital-opening-hours" aria-label="영업시간">
              {selectedHospitalOpeningHours.length > 0 ? (
                <>
                  <div className="hospital-opening-current">
                    <div className="hospital-opening-title">
                      <strong>오늘 운영시간</strong>
                      {getHospitalOpeningStatusLabel(selectedHospital) && (
                        <span className={`hospital-opening-badge ${selectedHospital.isOpenNow === true ? 'is-open' : 'is-closed'}`}>
                          {getHospitalOpeningStatusLabel(selectedHospital)}
                        </span>
                      )}
                    </div>
                    <div className="hospital-opening-schedule">
                      <span className="hospital-today-hours">
                        {selectedHospitalTodaySchedule.day && <b>{selectedHospitalTodaySchedule.day}</b>}
                        <span>{selectedHospitalTodaySchedule.hours ?? '운영시간 정보 없음'}</span>
                      </span>
                      {selectedHospitalTodaySchedule.breakTime && (
                        <small className="hospital-opening-break">휴게시간 {selectedHospitalTodaySchedule.breakTime}</small>
                      )}
                    </div>
                  </div>
                  <div className="hospital-weekly-hours">
                    <button className="hospital-weekly-hours-toggle" type="button" aria-expanded={isOpeningHoursExpanded} onClick={() => setIsOpeningHoursExpanded((expanded) => !expanded)}>
                      <span className="hospital-hours-chevron" aria-hidden="true" />
                      요일별 영업시간 ({isOpeningHoursExpanded ? '접기' : '펼치기'})
                    </button>
                    <div className={`hospital-weekly-hours-panel ${isOpeningHoursExpanded ? 'is-open' : ''}`} aria-hidden={!isOpeningHoursExpanded}>
                      <div>
                        <ul>
                          {selectedHospitalOpeningHours.map((description) => (
                            <li key={description}>{description}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <span className="hospital-opening-empty">운영시간 정보 없음</span>
              )}
            </div>
          </section>
          <section className="hospital-primary-actions" aria-label="병원 주요 작업">
            {selectedHospital.phone ? (
              <a href={`tel:${selectedHospital.phone}`}><PhoneIcon />전화하기</a>
            ) : (
              <button type="button" disabled><PhoneIcon />전화번호 없음</button>
            )}
            <a href={buildHospitalDirectionsUrl(selectedHospital)} target="_blank" rel="noreferrer">길찾기</a>
          </section>
          <button className="hospital-visit-record-action" type="button" onClick={() => onCreateClinicRecord(toHospitalSnapshot(selectedHospital))}>
            <span>이 병원으로 방문 기록 남기기</span>
          </button>
          <section className="hospital-contact-info" aria-labelledby="hospital-contact-title">
            <h3 id="hospital-contact-title">연락처</h3>
            <dl>
              <div><dt>전화번호</dt><dd>{selectedHospital.phone ? <a className="hospital-phone-link" href={`tel:${selectedHospital.phone}`}><PhoneIcon />{selectedHospital.phone}</a> : <span className="hospital-contact-empty">없음</span>}</dd></div>
            </dl>
          </section>
          {HOSPITAL_REVIEWS_ENABLED && <section className="hospital-review-panel" aria-labelledby="exocare-review-title">
            <header className="hospital-section-header">
              <div>
                <h3 id="exocare-review-title">방문 리뷰</h3>
                {selectedHospitalReviews.length > 0 && <span>{selectedHospitalReviews.length}개</span>}
              </div>
              <button className="hospital-review-write-action" type="button" onClick={() => { resetReviewForm(); setIsReviewFormOpen(true) }}>
                리뷰 작성
              </button>
            </header>
            {selectedHospitalReviews.length > 0 ? (
                <div className="review-list">
                  {selectedHospitalReviews.map((review) => (
                    <HospitalReviewItem
                      review={review}
                      fallbackAuthor={profileReviewAuthor}
                      fallbackAvatarUrl={profile.avatarUrl}
                      key={review.id}
                      onDelete={() => deleteReview(selectedHospital.id, review.id)}
                      onEdit={() => beginReviewEdit(review)}
                      onToggleLike={() => toggleReviewLike(selectedHospital.id, review.id)}
                    />
                  ))}
                </div>
            ) : (
              <div className="hospital-review-empty">
                <strong>아직 작성된 방문 리뷰가 없습니다.</strong>
                <span>첫 번째 리뷰를 작성해 다른 사용자에게 도움을 주세요.</span>
              </div>
            )}
          </section>}
        </article>
      )}
      {copiedAddressHospitalId && <div className="map-action-toast" role="status" aria-live="polite">주소를 복사했습니다.</div>}
      {HOSPITAL_REVIEWS_ENABLED && selectedHospital && isReviewFormOpen && (
        <div className="hospital-review-modal-layer">
          <button className="hospital-review-modal-backdrop" type="button" aria-label="리뷰 작성 닫기" onClick={closeReviewForm} />
          <section className="hospital-review-modal" role="dialog" aria-modal="true" aria-labelledby="hospital-review-modal-title">
            <header className="hospital-review-modal-head">
              <div>
                <strong id="hospital-review-modal-title">{editingReviewId ? '리뷰 수정' : '리뷰 작성'}</strong>
                <span>{selectedHospital.name}</span>
              </div>
              <button className="hospital-review-modal-close" type="button" aria-label="닫기" onClick={closeReviewForm} />
            </header>
            <div className="hospital-review-modal-body">
              <HospitalReviewForm
                rating={reviewRating}
                body={reviewBody}
                visitDate={reviewVisitDate}
                hasNextVisit={reviewHasNextVisit}
                nextVisitDate={reviewNextVisitDate}
                nextVisitTime={reviewNextVisitTime}
                cost={reviewCost}
                diagnosis={reviewDiagnosis}
                treatment={reviewTreatment}
                medicine={reviewMedicine}
                pets={reviewablePets.map((pet) => ({ id: pet.id, name: pet.name, group: pet.group, species: pet.species }))}
                selectedPetId={reviewPetId}
                medicineStartDate={reviewMedicineStartDate}
                medicineEndDate={reviewMedicineEndDate}
                medicineDailyCount={reviewMedicineDailyCount}
                selectedTags={reviewTags}
                clinicRecords={reviewClinicRecordOptions}
                selectedClinicRecordId={reviewClinicRecordId}
                canSubmit={canSubmitHospitalReview}
                submitLabel={editingReviewId ? '수정 완료' : '등록'}
                onRatingChange={setReviewRating}
                onBodyChange={setReviewBody}
                onVisitDateChange={setReviewVisitDate}
                onHasNextVisitChange={(value) => {
                  setReviewHasNextVisit(value)
                  if (!value) setReviewNextVisitDate('')
                }}
                onNextVisitDateChange={setReviewNextVisitDate}
                onNextVisitTimeChange={setReviewNextVisitTime}
                onCostChange={setReviewCost}
                onDiagnosisChange={setReviewDiagnosis}
                onTreatmentChange={setReviewTreatment}
                onMedicineChange={setReviewMedicine}
                onPetChange={(petId) => {
                  setReviewPetId(petId)
                  setReviewClinicRecordId('')
                }}
                onMedicineStartDateChange={setReviewMedicineStartDate}
                onMedicineEndDateChange={setReviewMedicineEndDate}
                onMedicineDailyCountChange={setReviewMedicineDailyCount}
                onToggleTag={toggleReviewTag}
                onClinicRecordSelect={selectClinicRecordForReview}
                onSubmit={submitReview}
              />
            </div>
          </section>
        </div>
      )}
    </section>
  )
}

function HospitalRatingSummary({ summary, compact = false }: { summary: HospitalDisplayReviewSummary; compact?: boolean }) {
  if (summary.source === null) return null
  const sourceLabel = summary.source === 'combined'
    ? 'Google과 ExoCare 방문 리뷰 통합 별점'
    : summary.source === 'exocare'
      ? 'ExoCare 방문 리뷰 별점'
      : 'Google 별점'
  return (
    <span className={`hospital-rating-summary ${compact ? 'compact' : ''}`} aria-label={`${sourceLabel} ${summary.average.toFixed(1)}점`}>
      <span className="hospital-rating-stars" aria-hidden="true">
        <span>★★★★★</span>
        <span style={{ width: `${Math.min(100, Math.max(0, summary.average / 5 * 100))}%` }}>★★★★★</span>
      </span>
      <span className="hospital-rating-value">{summary.average.toFixed(1)}</span>
    </span>
  )
}

function HospitalListRow({ hospital, reviews, active, onSelect }: { hospital: Hospital; reviews: HospitalReview[]; active: boolean; onSelect: () => void }) {
  const reviewSummary = getHospitalDisplayReviewSummary(hospital, reviews)
  return (
    <article className={`map-hospital-row ${active ? 'active' : ''}`}>
      <button className="map-hospital-row-main" type="button" onClick={onSelect}>
        <span>
          <strong>{hospital.name}</strong>
          {HOSPITAL_RATING_ENABLED && <HospitalRatingSummary summary={reviewSummary} compact />}
          <small>
            <span>{hospital.distanceKm === undefined ? '거리 계산 전' : `${hospital.distanceKm.toFixed(1)}km`}</span>
            {getHospitalOpeningStatusLabel(hospital) && <><span aria-hidden="true">·</span><span className={`hospital-list-open-status ${hospital.isOpenNow === true ? 'is-open' : 'is-closed'}`}>{getHospitalOpeningStatusLabel(hospital)}</span></>}
          </small>
        </span>
      </button>
    </article>
  )
}

function HospitalReviewItem({ review, fallbackAuthor, fallbackAvatarUrl, onDelete, onEdit, onToggleLike }: { review: HospitalReview; fallbackAuthor: string; fallbackAvatarUrl: string; onDelete: () => void; onEdit: () => void; onToggleLike: () => void }) {
  const [isManageMenuOpen, setIsManageMenuOpen] = useState(false)
  const authorName = review.author && review.author !== '익명' ? review.author : fallbackAuthor
  const avatarUrl = review.mine ? fallbackAvatarUrl : review.authorAvatarUrl
  const body = review.body || review.content || ''
  const petName = review.petName || '반려동물'
  const species = review.species?.trim() || '정보 없음'
  const reviewMeta = [
    formatReviewDate(review.visitDate || review.createdAt),
    review.cost ? `${review.cost.toLocaleString('ko-KR')}원` : '',
  ].filter(Boolean).join(' · ')

  return (
    <article className={`review-item ${isManageMenuOpen ? 'is-manage-menu-open' : ''}`}>
      <div className="review-item-head">
        <ReviewAuthorAvatar url={avatarUrl} name={authorName} />
        <div className="review-pet-info">
          <strong>{petName}</strong>
          <small className="review-species-label">종: {species}</small>
          <small>{reviewMeta}</small>
        </div>
        <div className="review-item-head-tools">
          <ReviewRatingStars rating={review.rating} />
          {review.mine && (
            <div
              className="review-manage-menu"
              onBlur={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setIsManageMenuOpen(false)
              }}
              onKeyDown={(event) => {
                if (event.key === 'Escape') setIsManageMenuOpen(false)
              }}
            >
              <button className="review-manage-trigger" type="button" aria-label="내 리뷰 관리" aria-expanded={isManageMenuOpen} aria-haspopup="menu" onClick={() => setIsManageMenuOpen((open) => !open)}>
                <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="5" cy="12" r="1.7" /><circle cx="12" cy="12" r="1.7" /><circle cx="19" cy="12" r="1.7" /></svg>
              </button>
              {isManageMenuOpen && (
                <div className="review-manage-popover" role="menu">
                  <button type="button" role="menuitem" onClick={() => { setIsManageMenuOpen(false); onEdit() }}>수정</button>
                  <button className="danger" type="button" role="menuitem" onClick={() => { setIsManageMenuOpen(false); onDelete() }}>삭제</button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      {body && <p className="review-item-body">{body}</p>}
      {review.tags && review.tags.length > 0 && <div className="review-item-tags" aria-label="리뷰 태그">{review.tags.map((tag) => <span key={tag}>{tag}</span>)}</div>}
      {review.images && review.images.length > 0 && <div className="review-image-row">{review.images.map((image) => <img src={image} alt="" key={image} />)}</div>}
      <footer className="review-item-footer">
        <div className="review-item-actions">
          <button className={`review-like-button ${review.liked ? 'active' : ''}`} type="button" aria-label={review.liked ? '리뷰 좋아요 취소' : '리뷰 좋아요'} aria-pressed={review.liked === true} onClick={onToggleLike}><HeartIcon filled={review.liked === true} /><span>{review.likes ?? 0}</span></button>
        </div>
      </footer>
    </article>
  )
}

function ReviewRatingStars({ rating }: { rating: number }) {
  const filledStars = Math.max(0, Math.min(5, Math.round(rating)))
  return (
    <span className="review-rating-stars" aria-label={`평점 ${rating}점`} role="img">
      {Array.from({ length: 5 }, (_, index) => (
        <svg className={index < filledStars ? 'is-filled' : ''} viewBox="0 0 24 24" aria-hidden="true" key={index}>
          <polygon points="12,2 15.1,8.2 22,9.2 17,14 18.2,21 12,17.7 5.8,21 7,14 2,9.2 8.9,8.2" />
        </svg>
      ))}
    </span>
  )
}

function ReviewAuthorAvatar({ url, name }: { url?: string; name: string }) {
  if (url) return <img className="user-avatar review-author-avatar" src={url} alt="" />
  return <span className="user-avatar user-avatar-fallback review-author-avatar" aria-hidden="true">{name.trim().slice(0, 1) || '?'}</span>
}

export default MapScreen


