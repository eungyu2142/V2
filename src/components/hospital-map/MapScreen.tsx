import { type FormEvent, useEffect, useMemo, useRef, useState } from 'react'
import { linkReviewToDiary } from '../../features/diary/diaryService'
import type { PetRecord } from '../../features/diary/diaryTypes'
import { loadAppData } from '../../lib/appData'
import HospitalReviewForm from './MapAndReview'
import type { AnimalCategory, AppProfile, Coordinates, DraftItem, Hospital, HospitalReview, HospitalReviewDraftPayload, HospitalSnapshot, HospitalSort, MobileMapSheetState, Pet } from '../../types/app'
import { buildHospitalSearchQuery, formatReviewDate, getReviewSummary, getTodayOpeningHoursDescription, hospitalFromSnapshot, hospitalMarkerContent, hospitalMatchesQuery, isHospitalCareCategory, isSameHospitalIdentity, loadGoogleHospitalDetails, loadNaverMaps, readBrowserLocation, reviewStorageKey, searchHospitals, sortHospitalsByDistance, toHospitalSnapshot, toReviewAnimalCategory, writeSavedHospitalSnapshots } from './mapDependencies'
import type { NaverMapApi } from '../../types/map'
const HOSPITAL_LIST_PAGE_SIZE = 10
function MapScreen({ userId, profile, pets, initialPetId, focusHospital, reviewDraft, reviews, likedHospitals, onReviewsChange, onLikedHospitalsChange, onDeleteDraft }: { userId: string; profile: AppProfile; pets: Pet[]; initialPetId?: string; focusHospital?: HospitalSnapshot | null; reviewDraft?: DraftItem | null; reviews: Record<string, HospitalReview[]>; likedHospitals: HospitalSnapshot[]; onReviewsChange: (reviews: Record<string, HospitalReview[]>) => void; onLikedHospitalsChange: (hospitals: HospitalSnapshot[]) => void; onDeleteDraft: (draftId: string) => void | Promise<void> }) {
  const naverMapClientId = import.meta.env.VITE_NAVER_MAP_CLIENT_ID
  const [query, setQuery] = useState('')
  const [selectedCategories, setSelectedCategories] = useState<Array<Exclude<AnimalCategory, 'all'>>>([])
  const [selectedSort, setSelectedSort] = useState<HospitalSort>('distance')
  const [hospitals, setHospitals] = useState<Hospital[]>([])
  const [selectedHospitalId, setSelectedHospitalId] = useState<string | null>(null)
  const [currentLocation, setCurrentLocation] = useState<Coordinates | null>(null)
  const [mapStatus, setMapStatus] = useState<'loading' | 'ready' | 'error'>(naverMapClientId ? 'loading' : 'error')
  const [locationStatus, setLocationStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>(naverMapClientId ? 'loading' : 'idle')
  const [isLoading, setIsLoading] = useState(false)
  const [, setMessage] = useState(naverMapClientId ? '' : '.env.local의 VITE_NAVER_MAP_CLIENT_ID를 확인해주세요.')
  const [isReviewFormOpen, setIsReviewFormOpen] = useState(false)
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
  const [mobileSheetState, setMobileSheetState] = useState<MobileMapSheetState>('middle')
  const [sheetDragY, setSheetDragY] = useState(0)
  const [isSheetDragging, setIsSheetDragging] = useState(false)
  const [editingReviewId, setEditingReviewId] = useState<string | null>(null)
  const [visibleHospitalCount, setVisibleHospitalCount] = useState(HOSPITAL_LIST_PAGE_SIZE)
  const mapElementRef = useRef<HTMLDivElement | null>(null)
  const mapInstanceRef = useRef<InstanceType<NaverMapApi['maps']['Map']> | null>(null)
  const markersRef = useRef<Array<InstanceType<NaverMapApi['maps']['Marker']>>>([])
  const currentLocationMarkerRef = useRef<InstanceType<NaverMapApi['maps']['Marker']> | null>(null)
  const lastHospitalSearchKeyRef = useRef('')
  const sheetDragStartRef = useRef<number | null>(null)

  function moveMapSmoothly(position: unknown, zoom: number) {
    const map = mapInstanceRef.current
    if (!map) return

    try {
      if (typeof map.morph === 'function') {
        map.morph(position, zoom, { duration: 520 })
        return
      }

      if (typeof map.panTo === 'function') {
        map.panTo(position, { duration: 520 })
        window.setTimeout(() => map.setZoom(zoom), 220)
        return
      }
    } catch (error) {
      console.error('Naver map smooth move error:', error)
    }

    map.setCenter(position)
    map.setZoom(zoom)
  }

  const sortedHospitals = useMemo(() => sortHospitalsByDistance(hospitals, currentLocation), [hospitals, currentLocation])
  const filteredHospitals = useMemo(() => {
    return sortedHospitals
      .filter((hospital) => hospitalMatchesQuery(hospital, query))
      .filter((hospital) => selectedCategories.length === 0 || hospital.categories.some((category) => selectedCategories.includes(category)))
      .sort((a, b) => {
        if (selectedSort === 'reviews') {
          const bCount = getReviewSummary(reviews[b.id] ?? []).count + (b.googleReviewCount ?? 0)
          const aCount = getReviewSummary(reviews[a.id] ?? []).count + (a.googleReviewCount ?? 0)
          return bCount - aCount
        }
        if (selectedSort === 'rating') {
          const bSummary = getReviewSummary(reviews[b.id] ?? [])
          const aSummary = getReviewSummary(reviews[a.id] ?? [])
          return (bSummary.count > 0 ? bSummary.average : b.rating ?? 0) - (aSummary.count > 0 ? aSummary.average : a.rating ?? 0)
        }
        return (a.distanceKm ?? 9999) - (b.distanceKm ?? 9999)
      })
  }, [query, reviews, selectedCategories, selectedSort, sortedHospitals])
  const visibleHospitals = filteredHospitals.slice(0, visibleHospitalCount)
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
  const isHospitalDetailsLoading = Boolean(selectedHospital && !selectedHospital.googleDetailsLoaded)

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
    if (!naverMapClientId) return

    let mounted = true

    Promise.allSettled([loadNaverMaps(naverMapClientId), readBrowserLocation()])
      .then(([naverResult, locationResult]) => {
        if (!mounted || !mapElementRef.current) return

        if (naverResult.status === 'rejected') throw naverResult.reason

        try {
          const naver = naverResult.value
          const firstLocation = locationResult.status === 'fulfilled' ? locationResult.value : null
          const centerLocation = firstLocation ?? { lat: 37.5665, lng: 126.978 }
          if (!naver.maps) throw new Error('Naver Maps API authentication failed.')
          const center = new naver.maps.LatLng(centerLocation.lat, centerLocation.lng)
          mapInstanceRef.current = new naver.maps.Map(mapElementRef.current, { center, zoom: 12 })
          naver.maps.Event.addListener(mapInstanceRef.current, 'click', () => {
            setSelectedHospitalId(null)
            setIsReviewFormOpen(false)
            setMobileSheetState('collapsed')
          })
          setMapStatus('ready')

          if (firstLocation) {
            setCurrentLocation(firstLocation)
            setLocationStatus('ready')
            setMessage('')
          } else {
            console.error('Initial geolocation error:', locationResult.status === 'rejected' ? locationResult.reason : null)
            setLocationStatus('error')
            setMessage('')
          }
        } catch (error) {
          console.error('Naver map initialization error:', error)
          setMapStatus('error')
          setMessage(`지도를 초기화하지 못했습니다. ${window.location.origin}을 네이버 콘솔 Web 서비스 URL에 등록해주세요.`)
        }
      })
      .catch((error) => {
        console.error('Naver map load error:', error)
        if (!mounted) return
        setMapStatus('error')
        setMessage(`지도를 불러오지 못했습니다. 네이버 콘솔의 Web 서비스 URL에 ${window.location.origin}을 등록했는지 확인해주세요.`)
      })

    return () => {
      mounted = false
      markersRef.current.forEach((marker) => marker.setMap(null))
      currentLocationMarkerRef.current?.setMap(null)
    }
  }, [naverMapClientId])

  useEffect(() => {
    const naver = window.naver
    const map = mapInstanceRef.current
    if (!naver?.maps?.LatLng || !map || !currentLocation) return

    const position = new naver.maps.LatLng(currentLocation.lat, currentLocation.lng)
    currentLocationMarkerRef.current?.setMap(null)
    currentLocationMarkerRef.current = new naver.maps.Marker({
      position,
      map,
      title: '내 위치',
      icon: { content: '<div class="current-location-marker" aria-label="내 위치"><span></span></div>' },
    })
    ;(currentLocationMarkerRef.current as unknown as { setZIndex?: (zIndex: number) => void }).setZIndex?.(180)
    moveMapSmoothly(position, 14)
  }, [currentLocation])

  useEffect(() => {
    const naver = window.naver
    const map = mapInstanceRef.current
    const hospital = selectedHospital
    if (!naver?.maps?.LatLng || !map || !hospital) return
    const position = new naver.maps.LatLng(hospital.lat, hospital.lng)
    moveMapSmoothly(position, 16)
  }, [selectedHospital])

  useEffect(() => {
    const naver = window.naver
    const map = mapInstanceRef.current
    if (!naver?.maps?.LatLng || !naver.maps.Marker || !naver.maps.Event || !map) return

    markersRef.current.forEach((marker) => marker.setMap(null))
    markersRef.current = []

    filteredHospitals.forEach((hospital) => {
      const position = new naver.maps.LatLng(hospital.lat, hospital.lng)
      const appReviewCount = getReviewSummary(
        (reviews[hospital.id] ?? []).filter((review) => isHospitalCareCategory(review.animalCategory)),
      ).count
      const hospitalReviewCount = appReviewCount + (hospital.googleReviewCount ?? 0)
      const hospitalIsLiked = likedHospitals.some((likedHospital) => isSameHospitalIdentity(likedHospital, hospital))
      const marker = new naver.maps.Marker({
        position,
        map,
        title: hospital.name,
        icon: { content: hospitalMarkerContent(hospital, hospital.id === selectedHospitalId, hospitalReviewCount, hospitalIsLiked) },
      })
      ;(marker as unknown as { setZIndex?: (zIndex: number) => void }).setZIndex?.(hospital.id === selectedHospitalId ? 260 : 210)
      naver.maps.Event.addListener(marker, 'click', () => {
        setSelectedHospitalId(hospital.id)
        setMobileSheetState('middle')
      })
      markersRef.current.push(marker)
    })
  }, [filteredHospitals, likedHospitals, reviews, selectedHospitalId])

  const getCurrentLocation = () => {
    setLocationStatus('loading')
    return readBrowserLocation()
      .then((location) => {
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
    writeSavedHospitalSnapshots(next)
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
    setIsSheetDragging(true)
    setSheetDragY(0)
    event.currentTarget.setPointerCapture?.(event.pointerId)
    event.stopPropagation()
  }

  const moveSheetDrag = (event: { clientY: number; preventDefault: () => void }) => {
    if (sheetDragStartRef.current === null) return
    const nextDragY = event.clientY - sheetDragStartRef.current
    setSheetDragY(nextDragY)
    if (Math.abs(nextDragY) > 0) event.preventDefault()
  }

  const finishSheetDrag = () => {
    const dragDistance = sheetDragY
    sheetDragStartRef.current = null
    setIsSheetDragging(false)
    setSheetDragY(0)

    if (dragDistance < -56) {
      setMobileSheetState((state) => state === 'collapsed' ? 'middle' : 'expanded')
      return
    }

    if (dragDistance <= 56) return

    if (mobileSheetState === 'expanded') {
      setMobileSheetState('middle')
      return
    }

    if (selectedHospital) {
      setSelectedHospitalId(null)
      setIsReviewFormOpen(false)
      setMobileSheetState('middle')
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
        <div className="map-canvas" ref={mapElementRef}>
          {mapStatus !== 'ready' && (
            <div className="map-load-state">
              <strong>{mapStatus === 'error' ? '지도를 불러오지 못했습니다' : '네이버 지도를 불러오는 중입니다'}</strong>
              {mapStatus === 'error' && <small>네이버 콘솔 Web 서비스 URL에 {window.location.origin} 을 등록해 주세요.</small>}
            </div>
          )}
        </div>
        <button className="map-mobile-location-button" type="button" disabled={locationStatus === 'loading'} onClick={requestCurrentLocation} aria-label="내 위치로 이동">
          <span>{locationStatus === 'loading' ? '확인중' : '내 위치'}</span>
        </button>
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
          <label>
            병원 검색
            <input value={query} onChange={(event) => { setQuery(event.target.value); setVisibleHospitalCount(HOSPITAL_LIST_PAGE_SIZE) }} placeholder="지역명, 병원명" />
          </label>
          <button className="map-search-icon-button" type="submit" disabled={isLoading} aria-label="검색">
            <span aria-hidden="true" />
          </button>
          <button className="secondary-button" type="button" disabled={locationStatus === 'loading'} onClick={requestCurrentLocation}>
            <span>{locationStatus === 'loading' ? '확인중' : '내 위치'}</span>
          </button>
        </form>

        <div className="map-sort-tabs" aria-label="병원 정렬">
          {([
            ['distance', '가까운 순'],
            ['reviews', '리뷰 많은 순'],
            ['rating', '평점 높은 순'],
          ] as Array<[HospitalSort, string]>).map(([sort, label]) => (
            <button className={selectedSort === sort ? 'active' : ''} type="button" key={sort} onClick={() => { setSelectedSort(sort); setVisibleHospitalCount(HOSPITAL_LIST_PAGE_SIZE) }}>
              {label}
            </button>
          ))}
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
                <span className="hospital-heart-icon" aria-hidden="true" />
              </button>
              <button className="panel-close" type="button" aria-label="병원 상세 닫기" onClick={() => setSelectedHospitalId(null)} />
            </div>
          </header>

          <section className="hospital-basic-info" aria-label="병원 기본 정보">
            <div className="hospital-address-row">
              <p><span className="meta-icon location" aria-hidden="true" />{selectedHospital.address || '주소 정보 없음'}</p>
              {selectedHospital.address && (
                <button className={`hospital-address-copy ${copiedAddressHospitalId === selectedHospital.id ? 'copied' : ''}`} type="button" aria-label={copiedAddressHospitalId === selectedHospital.id ? '주소 복사 완료' : '병원 주소 복사'} title={copiedAddressHospitalId === selectedHospital.id ? '복사됨' : '주소 복사'} onClick={() => void copyHospitalAddress(selectedHospital)}>
                  <span className="hospital-copy-icon" aria-hidden="true" />
                  <span className="sr-only">{copiedAddressHospitalId === selectedHospital.id ? '복사됨' : '복사'}</span>
                </button>
              )}
            </div>
            <p className="hospital-distance"><span className="meta-icon distance" aria-hidden="true" />{selectedHospital.distanceKm === undefined ? '내 위치 기준 거리 계산 전' : `내 위치에서 ${selectedHospital.distanceKm.toFixed(1)}km`}</p>
            <div className="hospital-opening-hours" aria-label="영업시간">
              <div className="hospital-opening-current">
                <strong className={selectedHospital.isOpenNow === true ? 'is-open' : selectedHospital.isOpenNow === false ? 'is-closed' : 'is-unknown'}>
                  {isHospitalDetailsLoading ? '영업정보 확인 중' : selectedHospital.isOpenNow === true ? '영업 중' : selectedHospital.isOpenNow === false ? '영업 종료' : '영업시간 정보 없음'}
                </strong>
                <span>{selectedHospitalTodayHours || '오늘 운영시간 정보 없음'}</span>
              </div>
              {selectedHospitalOpeningHours.length > 0 ? (
                <details>
                  <summary>요일별 영업시간</summary>
                  <ul>
                    {selectedHospitalOpeningHours.map((description) => (
                      <li key={description}>{description}</li>
                    ))}
                  </ul>
                </details>
              ) : (
                <span className="hospital-opening-empty">등록된 영업시간이 없습니다</span>
              )}
            </div>
          </section>
          <section className="hospital-contact-info" aria-labelledby="hospital-contact-title">
            <h3 id="hospital-contact-title">연락처</h3>
            <dl>
              <div><dt>전화번호</dt><dd>{selectedHospital.phone ? <a href={`tel:${selectedHospital.phone}`}>{selectedHospital.phone}</a> : '정보 없음'}</dd></div>
              <div><dt>홈페이지</dt><dd>{selectedHospital.websiteUri ? <a href={selectedHospital.websiteUri} target="_blank" rel="noreferrer">홈페이지 열기</a> : '정보 없음'}</dd></div>
            </dl>
          </section>
          <section className="hospital-review-panel" aria-labelledby="exocare-review-title">
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
                <span>이 병원에 방문했다면 경험을 공유해 주세요.</span>
              </div>
            )}
          </section>

          {(isHospitalDetailsLoading || selectedHospital.rating !== undefined || selectedHospital.googleReviewCount !== undefined || selectedHospital.googleMapsUri) && (
            <section className="hospital-google-rating" aria-labelledby="google-rating-title">
              <h3 id="google-rating-title">Google 평점</h3>
              {isHospitalDetailsLoading ? (
                <p>평점 정보를 확인하고 있습니다.</p>
              ) : (
                <div className="hospital-google-rating-row">
                  <strong><span aria-hidden="true">★</span> {selectedHospital.rating !== undefined ? selectedHospital.rating.toFixed(1) : '정보 없음'}</strong>
                  <span>{selectedHospital.googleReviewCount !== undefined ? `평가 ${selectedHospital.googleReviewCount.toLocaleString()}개` : '평가 수 정보 없음'}</span>
                  {selectedHospital.googleMapsUri && <a href={selectedHospital.googleMapsUri} target="_blank" rel="noreferrer">Google Maps에서 확인 ↗</a>}
                </div>
              )}
            </section>
          )}
        </article>
      )}
      {selectedHospital && isReviewFormOpen && (
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

function HospitalListRow({ hospital, active, onSelect }: { hospital: Hospital; active: boolean; onSelect: () => void }) {
  return (
    <article className={`map-hospital-row ${active ? 'active' : ''}`}>
      <button className="map-hospital-row-main" type="button" onClick={onSelect}>
        <span>
          <strong>{hospital.name}</strong>
          <small>{hospital.distanceKm === undefined ? '거리 계산 전' : `${hospital.distanceKm.toFixed(1)}km`}</small>
        </span>
      </button>
    </article>
  )
}

function HospitalReviewItem({ review, fallbackAuthor, fallbackAvatarUrl, onDelete, onEdit, onToggleLike }: { review: HospitalReview; fallbackAuthor: string; fallbackAvatarUrl: string; onDelete: () => void; onEdit: () => void; onToggleLike: () => void }) {
  const authorName = review.author && review.author !== '익명' ? review.author : fallbackAuthor
  const avatarUrl = review.mine ? fallbackAvatarUrl : review.authorAvatarUrl
  const body = review.body || review.content || ''
  const reviewMeta = [
    review.petName || review.species || '반려동물 정보 없음',
    review.visitDate ? formatReviewDate(review.visitDate) : '',
    review.cost ? `${review.cost.toLocaleString('ko-KR')}원` : '',
  ].filter(Boolean).join(' · ')

  return (
    <article className="review-item">
      <div className="review-item-head">
        <ReviewAuthorAvatar url={avatarUrl} name={authorName} />
        <div>
          <strong>{authorName}</strong>
          <small>{reviewMeta}</small>
        </div>
        <span className="review-rating-badge" aria-label={`평점 ${review.rating}점`}>{review.rating.toFixed(1)}</span>
      </div>
      {body && <p className="review-item-body">{body}</p>}
      {review.tags && review.tags.length > 0 && <div className="review-item-tags" aria-label="리뷰 태그">{review.tags.map((tag) => <span key={tag}>{tag}</span>)}</div>}
      {review.images && review.images.length > 0 && <div className="review-image-row">{review.images.map((image) => <img src={image} alt="" key={image} />)}</div>}
      <footer className="review-item-footer">
        <time>{formatReviewDate(review.createdAt)}</time>
        <div className="review-item-actions">
          <button className={`review-like-button ${review.liked ? 'active' : ''}`} type="button" onClick={onToggleLike}>♥ {review.likes ?? 0}</button>
          {review.mine && <><button type="button" onClick={onEdit}>수정</button><button type="button" onClick={onDelete}>삭제</button></>}
        </div>
      </footer>
    </article>
  )
}

function ReviewAuthorAvatar({ url, name }: { url?: string; name: string }) {
  if (url) return <img className="user-avatar review-author-avatar" src={url} alt="" />
  return <span className="user-avatar user-avatar-fallback review-author-avatar" aria-hidden="true">{name.trim().slice(0, 1) || '?'}</span>
}

export default MapScreen


