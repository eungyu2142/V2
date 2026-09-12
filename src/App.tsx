import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { AppNavigation } from './components/navigation/AppNavigation'
import { deleteAppData, loadAppData, saveAppData } from './lib/appData'
import { readInitialUrlState, syncAppUrl } from './lib/appUrl'
import { readLocalDrafts, writeLocalDrafts } from './lib/draftStorage'
import { supabase } from './lib/supabase'
import { dataUrlToImageFile, removeUploadedImage, uploadImageFile } from './lib/imageStorage'
import { deleteHospitalLike, getHospitalLikeKey, mergeLocalHospitalLikes, saveHospitalLike } from './lib/hospitalLikes'
import { deactivatePushSubscriptionForLogout, syncCurrentDevicePushSubscription } from './lib/pushNotifications'
import { isCurrentDeviceBlocked, registerCurrentDevice } from './lib/qnaModeration'
import { animalCategoryLabels, animalCategoryOptions, CategoryTagIcon, isSameHospitalIdentity, loadCollectedHospitals, normalizePet, petSpeciesOptions, readSavedHospitalSnapshots, readStoredReviews, reviewStorageKey, toHospitalSnapshot, writeSavedHospitalSnapshots } from './components/hospital-map/mapDependencies'
import type { AnimalCategory, AppProfile, CreateMode, DraftItem, HospitalRecommendationConcern, HospitalReview, HospitalSnapshot, Pet, QnaCategory, QnaPost, Tab } from './types/app'
import type { HospitalConditionId } from './features/hospital-map/hospitalConditionCatalog'
export type { AppProfile, DraftItem, HospitalReview, HospitalSnapshot, Pet, QnaPost } from './types/app'

const AuthScreen = lazy(() => import('./components/AuthScreen'))
const ProfileScreen = lazy(() => import('./components/profile/ProfileScreen'))
const PetsScreen = lazy(() => import('./components/my-pet/PetsScreen'))
const PetCreateFlow = lazy(() => import('./components/my-pet/PetCreateFlow'))
const DiaryPage = lazy(() => import('./components/diary/DiaryScreen'))
const MapScreen = lazy(() => import('./components/hospital-map/MapScreen'))
const QnaScreen = lazy(() => import('./components/qna/QnaScreen').then((module) => ({ default: module.QnaScreen })))
const QnaCreateFlow = lazy(() => import('./components/qna/QnaScreen').then((module) => ({ default: module.QnaCreateFlow })))

function AppLoading() {
  return <main className="app-loading" role="status" aria-live="polite"><span className="app-loading-spinner" aria-hidden="true" /><span>불러오는 중</span></main>
}

const qnaTable = ['comm', 'unity_posts'].join('')
const qnaDatabaseCategory = ['Q', '&A'].join('')

function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [authReady, setAuthReady] = useState(false)
  const [deviceBlocked, setDeviceBlocked] = useState<boolean | null>(null)

  useEffect(() => {
    let active = true
    void isCurrentDeviceBlocked()
      .then((blocked) => { if (active) setDeviceBlocked(blocked) })
      .catch(() => { if (active) setDeviceBlocked(false) })
    return () => { active = false }
  }, [])

  useEffect(() => {
    let active = true
    const authTimeout = window.setTimeout(() => {
      if (active) setAuthReady(true)
    }, 4000)

    void supabase.auth.getSession()
      .then(({ data }) => {
        if (!active) return
        setSession(data.session)
        setAuthReady(true)
      })
      .catch(() => {
        if (active) setAuthReady(true)
      })
      .finally(() => window.clearTimeout(authTimeout))

    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!active) return
      setSession(nextSession)
      setAuthReady(true)
    })

    return () => {
      active = false
      window.clearTimeout(authTimeout)
      data.subscription.unsubscribe()
    }
  }, [])

  if (!authReady || deviceBlocked === null) return <main className="auth-screen"><p className="auth-loading">로그인 상태를 확인하고 있습니다.</p></main>
  if (deviceBlocked) return <main className="auth-screen"><section className="auth-card"><h1>접근이 제한된 기기입니다</h1><p>커뮤니티 운영 정책 위반으로 이 기기에서는 서비스를 이용할 수 없습니다.</p></section></main>
  if (!session) return <Suspense fallback={<AppLoading />}><AuthScreen /></Suspense>
  return <Suspense fallback={<AppLoading />}><AuthenticatedApp session={session} /></Suspense>
}

function AuthenticatedApp({ session }: { session: Session }) {
  const initialUrlState = useMemo(() => readInitialUrlState(), [])
  const [activeTab, setActiveTab] = useState<Tab>(initialUrlState.tab)
  const [sideNavOpen, setSideNavOpen] = useState(false)
  const [createMode, setCreateMode] = useState<CreateMode>(null)
  const [qnaOpenId, setQnaOpenId] = useState<string | null>(null)
  const [editingPet, setEditingPet] = useState<Pet | null>(null)
  const [diaryPetId, setDiaryPetId] = useState<string | null>(initialUrlState.petId)
  const [diaryReadOnly, setDiaryReadOnly] = useState(false)
  const [diaryInitialAction, setDiaryInitialAction] = useState<'routine-create' | null>(null)
  const [qnaInitialPetId, setQnaInitialPetId] = useState<string | null>(initialUrlState.tab === 'qna' ? initialUrlState.petId : null)
  const [qnaInitialPreset, setQnaInitialPreset] = useState<{ category: QnaCategory; title: string } | null>(null)
  const [editingDraft, setEditingDraft] = useState<DraftItem | null>(null)
  const [mapFocusHospital, setMapFocusHospital] = useState<HospitalSnapshot | null>(null)
  const [mapRecommendationConcern, setMapRecommendationConcern] = useState<HospitalRecommendationConcern | HospitalConditionId | null>(null)
  const [diaryClinicHospital, setDiaryClinicHospital] = useState<HospitalSnapshot | null>(null)
  const [currentPetId, setCurrentPetId] = useState<string | null>(initialUrlState.petId)
  const [pets, setPets] = useState<Pet[]>([])
  const [qnaPosts, setQnaPosts] = useState<QnaPost[]>([])
  const [drafts, setDrafts] = useState<DraftItem[]>([])
  const [hospitalReviews, setHospitalReviews] = useState<Record<string, HospitalReview[]>>(() => readStoredReviews())
  const [likedHospitals, setLikedHospitals] = useState<HospitalSnapshot[]>(() => readSavedHospitalSnapshots(session.user.id))
  const [allHospitals, setAllHospitals] = useState<HospitalSnapshot[]>([])
  const [profile, setProfile] = useState<AppProfile>({ username: '', nickname: '', avatarUrl: '' })
  const [dataError, setDataError] = useState('')
  const bottomNavDragStartRef = useRef<number | null>(null)
  const suppressNextBottomNavClickRef = useRef(false)
  const previousContentTabRef = useRef<Tab>(initialUrlState.tab === 'profile' ? 'map' : initialUrlState.tab)

  useEffect(() => {
    void registerCurrentDevice().then((allowed) => {
      if (!allowed) void supabase.auth.signOut().finally(() => window.location.reload())
    }).catch((error: unknown) => {
      if (import.meta.env.DEV) console.error('Current device registration failed.', error)
    })
    void syncCurrentDevicePushSubscription().catch((error: unknown) => {
      if (import.meta.env.DEV) console.error('Current device push synchronization failed.', error)
    })
  }, [session.user.id])

  useEffect(() => {
    let active = true
    queueMicrotask(() => {
      if (!active) return
      setPets([])
      setQnaPosts([])
      setDrafts([])
      setHospitalReviews(readStoredReviews())
      setLikedHospitals(readSavedHospitalSnapshots(session.user.id))
      setAllHospitals([])
      setProfile({ username: '', nickname: '', avatarUrl: '' })
      setCreateMode(null)
      setEditingPet(null)
      setEditingDraft(null)
      setDiaryClinicHospital(null)
      setQnaOpenId(null)
      setDiaryPetId(initialUrlState.petId)
      setCurrentPetId(initialUrlState.petId)
      setQnaInitialPetId(initialUrlState.tab === 'qna' ? initialUrlState.petId : null)
      setDiaryReadOnly(false)
      setDataError('')
    })
    const loadMine = async <T,>(table: string) => loadAppData<T>(table, { userId: session.user.id, scope: 'mine' })
    const loadAll = async <T,>(table: string, options: { includeViewCount?: boolean } = {}) => loadAppData<T>(table, { userId: session.user.id, scope: 'all', ...options })
    const loadOptionalAll = async <T,>(table: string, options: { includeViewCount?: boolean } = {}) => loadAll<T>(table, options).catch((error) => {
      console.warn(`Optional public data load failed: ${table}`, error)
      return [] as T[]
    })
    const loadOptionalMine = async <T,>(table: string) => loadMine<T>(table).catch((error) => {
      console.warn(`Optional data load failed: ${table}`, error)
      return [] as T[]
    })

    Promise.all([
      loadMine<Pet>('pets'),
      loadOptionalAll<QnaPost>(qnaTable, { includeViewCount: true }),
      loadOptionalMine<DraftItem>('drafts').then((items) => {
        const localItems = readLocalDrafts(session.user.id)
        const merged = [...items, ...localItems.filter((local) => !items.some((item) => item.id === local.id))]
        writeLocalDrafts(session.user.id, merged)
        return merged
      }).catch(() => readLocalDrafts(session.user.id)),
      loadCollectedHospitals('', 'all').then((items) => items.map(toHospitalSnapshot)).catch((error) => {
        console.warn('Optional hospital data load failed:', error)
        return [] as HospitalSnapshot[]
      }),
      mergeLocalHospitalLikes(session.user.id, readSavedHospitalSnapshots(session.user.id)).catch((error) => {
        console.warn('Hospital like synchronization failed:', error)
        return readSavedHospitalSnapshots(session.user.id)
      }),
      loadOptionalAll<HospitalReview>('hospital_reviews'),
    ]).then(([nextPets, nextPosts, nextDrafts, nextHospitals, nextLikedHospitals, nextHospitalReviews]) => {
      if (!active) return
      setPets(nextPets.map(normalizePet))
      setQnaPosts(nextPosts.map((post) => {
        const likedBy = Array.isArray(post.likedBy) ? post.likedBy : []
        return { ...post, likedBy, liked: likedBy.length > 0 ? likedBy.includes(session.user.id) : post.liked === true }
      }))
      setDrafts(nextDrafts)
      setAllHospitals(nextHospitals)
      writeSavedHospitalSnapshots(nextLikedHospitals, session.user.id)
      setLikedHospitals(nextLikedHospitals)
      const localReviews = readStoredReviews()
      const groupedReviews = nextHospitalReviews.reduce<Record<string, HospitalReview[]>>((grouped, review) => {
        if (!review.hospitalId) return grouped
        const item = { ...review, userId: review.userId || undefined }
        grouped[review.hospitalId] = [...(grouped[review.hospitalId] ?? []), item]
        return grouped
      }, {})
      Object.entries(localReviews).forEach(([hospitalId, items]) => {
        const serverIds = new Set((groupedReviews[hospitalId] ?? []).map((review) => review.id))
        const localOnly = items.filter((review) => !serverIds.has(review.id))
        if (localOnly.length > 0) groupedReviews[hospitalId] = [...(groupedReviews[hospitalId] ?? []), ...localOnly]
      })
      localStorage.setItem(reviewStorageKey, JSON.stringify(groupedReviews))
      setHospitalReviews(groupedReviews)
      const unsyncedOwnedReviews = Object.values(localReviews).flat().filter((review) => review.mine === true)
      void Promise.all(unsyncedOwnedReviews.map((review) => saveAppData('hospital_reviews', session.user.id, {
        ...review,
        userId: review.userId || session.user.id,
      }, {
        hospital_id: review.hospitalId,
        hospital_name: review.hospitalName || '',
        pet_id: review.petId || null,
        rating: review.rating,
        visit_date: review.visitDate || null,
        diagnosis: review.diagnosis || null,
        treatment: review.treatment || null,
        cost: review.cost || null,
        tags: review.tags ?? [],
        body: review.body || review.content || '',
        images: review.images ?? [],
      }))).catch((error) => {
        console.error('Local review migration failed:', error)
        setDataError('기존 리뷰를 서버에 동기화하지 못했습니다. 네트워크 연결 후 다시 시도해 주세요.')
      })
    }).catch((error) => {
      if (!active) return
      console.error('Initial data load failed:', error)
      setDataError('데이터를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.')
    })
    return () => { active = false }
  }, [initialUrlState.petId, initialUrlState.tab, session.user.id])

  useEffect(() => {
    let active = true
    supabase
      .from('profiles')
      .select('username, nickname, avatar_url')
      .eq('id', session.user.id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (!active) return
        if (error) {
          setDataError('프로필 정보를 불러오지 못했습니다.')
          return
        }
        setProfile({
          username: String(data?.username ?? session.user.user_metadata?.username ?? ''),
          nickname: String(data?.nickname ?? session.user.user_metadata?.nickname ?? ''),
          avatarUrl: String(data?.avatar_url ?? ''),
        })
      })
    return () => { active = false }
  }, [session.user.id, session.user.user_metadata])

  const moveTab = (tab: Tab) => {
    if (tab !== 'profile') previousContentTabRef.current = tab
    setActiveTab(tab)
    syncAppUrl(tab, tab === 'diary' ? diaryPetId ?? currentPetId : null)
    if (tab !== 'diary') {
      setDiaryPetId(null)
      setDiaryReadOnly(false)
    }
    if (tab !== 'qna') setQnaInitialPetId(null)
    if (tab !== 'map') setMapRecommendationConcern(null)
    setCreateMode(null)
    setEditingPet(null)
    setEditingDraft(null)
  }

  const toggleProfileTab = () => {
    if (activeTab === 'profile') {
      moveTab(previousContentTabRef.current)
      return
    }
    previousContentTabRef.current = activeTab
    moveTab('profile')
  }

  const beginBottomNavDrag = (event: { clientY: number; currentTarget: { setPointerCapture?: (pointerId: number) => void }; pointerId: number }) => {
    if (activeTab !== 'map') return
    bottomNavDragStartRef.current = event.clientY
    event.currentTarget.setPointerCapture?.(event.pointerId)
  }

  const moveBottomNavDrag = (event: { clientY: number; preventDefault: () => void }) => {
    if (activeTab !== 'map' || bottomNavDragStartRef.current === null) return
    const dragY = event.clientY - bottomNavDragStartRef.current
    if (dragY < -12) event.preventDefault()
  }

  const finishBottomNavDrag = (event: { clientY: number; preventDefault: () => void }) => {
    if (activeTab !== 'map' || bottomNavDragStartRef.current === null) return
    const dragY = event.clientY - bottomNavDragStartRef.current
    bottomNavDragStartRef.current = null
    if (dragY > -42) return
    suppressNextBottomNavClickRef.current = true
    event.preventDefault()
    window.dispatchEvent(new CustomEvent('map-bottom-nav-swipe-up'))
    window.setTimeout(() => {
      suppressNextBottomNavClickRef.current = false
    }, 0)
  }

  const openHospitalOnMap = (hospital: HospitalSnapshot) => {
    setMapFocusHospital(hospital)
    moveTab('map')
  }

  const openClinicReview = (hospital: HospitalSnapshot, review: HospitalReview) => {
    setCurrentPetId(review.petId ?? currentPetId)
    setEditingDraft({
      id: `clinic-review-${review.clinicRecordId ?? review.id}`,
      draftType: 'hospital_review',
      title: hospital.name,
      body: '',
      updatedAt: new Date().toISOString(),
      payload: { hospital, review },
    } as DraftItem)
    setMapFocusHospital(hospital)
    moveTab('map')
  }

  const savePet = async (pet: Pet, selectedPhotoFile?: File) => {
    let uploadedPhotoUrl = ''
    try {
      const legacyPhotoFile = !selectedPhotoFile && pet.photo?.startsWith('data:')
        ? await dataUrlToImageFile(pet.photo, `${pet.id}.jpg`)
        : undefined
      const photoFile = selectedPhotoFile ?? legacyPhotoFile
      if (photoFile) {
        uploadedPhotoUrl = (await uploadImageFile({
          file: photoFile,
          userId: session.user.id,
          area: 'pets',
          ownerId: pet.id,
        })).url
      }
      const storedPet = { ...pet, photo: uploadedPhotoUrl || pet.photo }
      await saveAppData('pets', session.user.id, storedPet, {
        name: storedPet.name, species: storedPet.species, category: storedPet.group,
        gender: storedPet.gender, photo_url: storedPet.photo ?? null,
      })
      setPets((items) => [storedPet, ...items.filter((item) => item.id !== storedPet.id)])
      setCurrentPetId(storedPet.id)
      setDataError('')
    } catch (error) {
      if (uploadedPhotoUrl) void removeUploadedImage(uploadedPhotoUrl).catch(() => undefined)
      console.error('Supabase pet save failed.', error)
      setDataError('펫 사진 또는 정보를 저장하지 못했습니다. 잠시 후 다시 시도해 주세요.')
      throw error
    }
  }

  const deletePet = async (petId: string) => {
    try {
      await deleteAppData('pets', petId, session.user.id)
      setPets((items) => {
        const next = items.filter((item) => item.id !== petId)
        if (currentPetId === petId) setCurrentPetId(next[0]?.id ?? null)
        return next
      })
      setDataError('')
    } catch (error) {
      console.error('Supabase pet delete failed.', error)
      setDataError('동물을 삭제하지 못했습니다. 잠시 후 다시 시도해 주세요.')
    }
  }

  const openPetDiary = (petId: string, action?: 'routine-create') => {
    setCurrentPetId(petId)
    setDiaryPetId(petId)
    setDiaryReadOnly(false)
    setDiaryInitialAction(action ?? null)
    syncAppUrl('diary', petId)
    setActiveTab('diary')
    setCreateMode(null)
    setEditingPet(null)
    setEditingDraft(null)
  }

  const openQnaCreate = (petId?: string | null, preset?: { category: QnaCategory; title: string }) => {
    const validPetId = petId && pets.some((pet) => pet.id === petId) ? petId : null
    setQnaInitialPetId(validPetId)
    setQnaInitialPreset(preset ?? null)
    setEditingPet(null)
    setEditingDraft(null)
    setCreateMode('post')
    syncAppUrl('qna', validPetId)
  }

  const openPetHospitalSearch = (petId: string, concern?: HospitalRecommendationConcern) => {
    if (pets.some((pet) => pet.id === petId)) setCurrentPetId(petId)
    setMapRecommendationConcern(concern ?? null)
    moveTab('map')
  }

  const openConditionHospitalSearch = (conditionId: HospitalConditionId) => {
    setMapRecommendationConcern(conditionId)
    moveTab('map')
  }

  const saveQnaPost = async (post: QnaPost) => {
    setQnaPosts((items) => [post, ...items.filter((item) => item.id !== post.id)])
    setCreateMode(null)
    try {
      await saveAppData(qnaTable, session.user.id, post, {
        category: qnaDatabaseCategory, title: post.title, body: post.body, view_count: post.viewCount ?? 0,
      })
      sessionStorage.setItem('qna_created_message', '질문을 등록했어요.')
      setQnaOpenId(post.id)
      setActiveTab('qna')
    } catch (error) {
      console.error('Supabase QNA save failed; kept local state.', error)
    }
  }

  const updateQnaPosts = (next: QnaPost[]) => {
    setQnaPosts(next)
    const changed = next.find((post) => {
      const previous = qnaPosts.find((item) => item.id === post.id)
      return previous && JSON.stringify(previous) !== JSON.stringify(post)
    })
    if (changed) {
      void saveAppData(qnaTable, session.user.id, changed, {
        category: qnaDatabaseCategory, title: changed.title, body: changed.body, view_count: changed.viewCount ?? 0,
      }).catch(() => setDataError('질문 변경 내용을 저장하지 못했습니다.'))
    }
  }

  const deleteQnaPost = async (postId: string) => {
    try {
      await deleteAppData(qnaTable, postId, session.user.id)
      setQnaPosts((items) => items.filter((item) => item.id !== postId))
    } catch {
      setDataError('질문을 삭제하지 못했습니다.')
    }
  }

  const deleteDraft = async (draftId: string) => {
    try {
      await deleteAppData('drafts', draftId, session.user.id)
    } catch (error) {
      console.error('Supabase draft delete failed; deleting local draft.', error)
    }
    const nextDrafts = readLocalDrafts(session.user.id).filter((item) => item.id !== draftId)
    writeLocalDrafts(session.user.id, nextDrafts)
    setDrafts((items) => items.filter((item) => item.id !== draftId))
  }

  const continueDraft = (draft: DraftItem) => {
    setEditingDraft(draft)
    if (draft.draftType === 'question') {
      setCreateMode('post')
      return
    }
    if (draft.draftType === 'pet') {
      setEditingPet(draft.payload as Pet)
      setCreateMode('pet')
      return
    }
    if (draft.draftType === 'care_record' || draft.draftType === 'reminder') {
      setActiveTab('diary')
      setCreateMode(null)
      return
    }
    if (draft.draftType === 'hospital_review') {
      setActiveTab('map')
      setCreateMode(null)
    }
  }

  const openWrittenPost = (kind: 'question', id: string) => {
    setCreateMode(null)
    if (kind === 'question') {
      setActiveTab('qna')
      setQnaOpenId(id)
      return
    }
  }

  const editWrittenPost = (kind: 'question', id: string) => {
    const payload = qnaPosts.find((post) => post.id === id)
    if (!payload) return
    setEditingDraft({
      id,
      draftType: kind,
      title: 'title' in payload ? payload.title : '',
      body: payload.body,
      updatedAt: new Date().toISOString(),
      payload,
    } as DraftItem)
    setCreateMode('post')
  }

  const deleteWrittenPost = (kind: 'question', id: string) => {
    if (kind === 'question') void deleteQnaPost(id)
  }

  const editHospitalReviewFromProfile = (review: HospitalReview & { hospitalId: string }) => {
    const hospital = review.hospitalSnapshot ?? allHospitals.find((item) => item.id === review.hospitalId)
    if (!hospital) return
    setEditingDraft({
      id: `profile-review-edit-${review.id}`,
      draftType: 'hospital_review',
      title: review.hospitalName || hospital.name || '병원 리뷰',
      body: review.body || review.content || '',
      updatedAt: new Date().toISOString(),
      payload: {
        hospital,
        review: { ...review, hospitalSnapshot: hospital },
      },
    })
    setMapFocusHospital(hospital)
    moveTab('map')
  }

  const deleteHospitalReviewFromProfile = (hospitalId: string, reviewId: string) => {
    setHospitalReviews((items) => {
      const next = {
        ...items,
        [hospitalId]: (items[hospitalId] ?? []).filter((review) => review.id !== reviewId),
      }
      localStorage.setItem(reviewStorageKey, JSON.stringify(next))
      return next
    })
    void deleteAppData('hospital_reviews', reviewId, session.user.id).catch((error) => {
      console.error('Profile review deletion synchronization failed.', error)
      setDataError('리뷰를 서버에서 삭제하지 못했습니다. 잠시 후 다시 시도해 주세요.')
    })
  }

  const unlikePostFromProfile = (postId: string) => {
    const next = qnaPosts.map((post) => post.id === postId
      ? { ...post, liked: false, likes: Math.max(0, post.likes - 1) }
      : post)
    updateQnaPosts(next)
  }

  const updateLikedHospitals = (next: HospitalSnapshot[]) => {
    const previous = likedHospitals
    const previousKeys = new Set(previous.map(getHospitalLikeKey))
    const nextKeys = new Set(next.map(getHospitalLikeKey))
    const added = next.filter((hospital) => !previousKeys.has(getHospitalLikeKey(hospital)))
    const removed = previous.filter((hospital) => !nextKeys.has(getHospitalLikeKey(hospital)))

    writeSavedHospitalSnapshots(next, session.user.id)
    setLikedHospitals(next)
    void Promise.all([
      ...added.map((hospital) => saveHospitalLike(session.user.id, hospital)),
      ...removed.map((hospital) => deleteHospitalLike(session.user.id, hospital)),
    ]).catch((error: unknown) => {
      console.error('Hospital like synchronization failed.', error)
      setDataError('병원 좋아요를 서버에 동기화하지 못했습니다. 네트워크 연결 후 다시 시도해 주세요.')
    })
  }

  const unlikeHospitalFromProfile = (hospital: HospitalSnapshot) => {
    const identity = { id: hospital.id ?? '', name: hospital.name, address: hospital.address }
    const next = likedHospitals.filter((item) => !isSameHospitalIdentity(item, identity))
    updateLikedHospitals(next)
  }

  const unlikeReviewFromProfile = (hospitalId: string, reviewId: string) => {
    setHospitalReviews((items) => {
      const next = {
        ...items,
        [hospitalId]: (items[hospitalId] ?? []).map((review) => review.id === reviewId
          ? { ...review, liked: false, likes: Math.max(0, (review.likes ?? 0) - 1) }
          : review),
      }
      localStorage.setItem(reviewStorageKey, JSON.stringify(next))
      return next
    })
  }

  const saveProfile = async (nextProfile: AppProfile, selectedAvatarFile?: File) => {
    let uploadedAvatarUrl = ''
    try {
      const legacyAvatarFile = !selectedAvatarFile && nextProfile.avatarUrl.startsWith('data:')
        ? await dataUrlToImageFile(nextProfile.avatarUrl, 'profile-avatar.jpg')
        : undefined
      const avatarFile = selectedAvatarFile ?? legacyAvatarFile
      if (avatarFile) {
        uploadedAvatarUrl = (await uploadImageFile({
          file: avatarFile,
          userId: session.user.id,
          area: 'profiles',
          ownerId: session.user.id,
        })).url
      }
      const normalized = {
        username: nextProfile.username.trim(),
        nickname: nextProfile.nickname.trim(),
        avatarUrl: uploadedAvatarUrl || nextProfile.avatarUrl.trim(),
      }
      const { error } = await supabase.from('profiles').upsert({
        id: session.user.id,
        username: normalized.username || null,
        nickname: normalized.nickname || null,
        avatar_url: normalized.avatarUrl || null,
      })
      if (error) throw error
      setProfile(normalized)
      const nextQnaPosts = qnaPosts.map((post) => post.mine === true ? { ...post, author: normalized.nickname || normalized.username || post.author, authorAvatarUrl: normalized.avatarUrl } : post)
      setQnaPosts(nextQnaPosts)
      setDataError('')
      void Promise.all(nextQnaPosts.filter((post) => post.mine === true).map((post) => saveAppData(qnaTable, session.user.id, post, {
        category: qnaDatabaseCategory, title: post.title, body: post.body, view_count: post.viewCount ?? 0,
      }))).catch(() => setDataError('프로필 사진을 작성 글에 반영하지 못했습니다.'))
    } catch (error) {
      if (uploadedAvatarUrl) void removeUploadedImage(uploadedAvatarUrl).catch(() => undefined)
      setDataError('프로필 사진 또는 정보를 저장하지 못했습니다. 잠시 후 다시 시도해 주세요.')
      throw error
    }
  }

  const deleteAccount = async () => {
    try {
      const { error } = await supabase.rpc('delete_own_account')
      if (error) throw error
      await supabase.auth.signOut()
    } catch {
      setDataError('계정을 삭제하지 못했습니다. 잠시 후 다시 시도해 주세요.')
    }
  }

  const signOut = async () => {
    try {
      await deactivatePushSubscriptionForLogout(session.user.id)
    } catch (error: unknown) {
      if (import.meta.env.DEV) console.error('Push subscription deactivation on logout failed.', error)
    } finally {
      await supabase.auth.signOut()
    }
  }

  if (createMode === 'pet') return (
    <PetCreateFlow
      userId={session.user.id}
      initialPet={editingDraft?.draftType === 'pet' ? editingDraft.payload as Pet : editingPet}
      initialDraft={editingDraft?.draftType === 'pet' ? editingDraft : null}
      categoryOptions={animalCategoryOptions.filter((item): item is Exclude<AnimalCategory, 'all'> => item !== 'all')}
      categoryLabels={animalCategoryLabels}
      speciesOptions={petSpeciesOptions}
      renderCategoryIcon={(category) => <CategoryTagIcon category={category} />}
      onClose={() => { setCreateMode(null); setEditingPet(null); setEditingDraft(null) }}
      onSave={async (pet, photoFile) => {
        await savePet(pet, photoFile)
        if (editingDraft?.draftType === 'pet') await deleteDraft(editingDraft.id)
        setEditingDraft(null)
      }}
      onOpenPlan={(petId) => openPetDiary(petId)}
    />
  )
  if (createMode === 'post') return (
    <QnaCreateFlow
      userId={session.user.id}
      pets={pets}
      author={profile.nickname.trim() || profile.username.trim() || '\uC0AC\uC6A9\uC790'}
      authorAvatarUrl={profile.avatarUrl}
      initialPetId={qnaInitialPetId ?? undefined}
      initialCategory={qnaInitialPreset?.category}
      initialTitle={qnaInitialPreset?.title}
      initialDraft={editingDraft?.draftType === 'question' ? editingDraft : null}
      onClose={() => { setCreateMode(null); setEditingDraft(null); setQnaInitialPetId(null); setQnaInitialPreset(null) }}
      onSave={async (post) => {
        await saveQnaPost(post)
        if (editingDraft && drafts.some((draft) => draft.id === editingDraft.id)) await deleteDraft(editingDraft.id)
        setEditingDraft(null)
        setQnaInitialPetId(null)
        setQnaInitialPreset(null)
      }}
    />
  )
  return (
    <div className={`app-shell ${activeTab === 'map' ? 'map-shell' : ''}`}>
      <AppNavigation
        activeTab={activeTab}
        profile={profile}
        sideNavOpen={sideNavOpen}
        onOpenMenu={() => setSideNavOpen(true)}
        onCloseMenu={() => setSideNavOpen(false)}
        onMoveTab={moveTab}
        onToggleProfile={toggleProfileTab}
        onBottomPointerDown={beginBottomNavDrag}
        onBottomPointerMove={moveBottomNavDrag}
        onBottomPointerUp={finishBottomNavDrag}
        onBottomPointerCancel={() => { bottomNavDragStartRef.current = null }}
        shouldSuppressBottomClick={() => suppressNextBottomNavClickRef.current}
      />

      {activeTab === 'map' && <main className="app-main"><MapScreen userId={session.user.id} profile={profile} pets={pets} initialPetId={currentPetId ?? undefined} focusHospital={mapFocusHospital} recommendationConcern={mapRecommendationConcern} reviewDraft={editingDraft?.draftType === 'hospital_review' ? editingDraft : null} reviews={hospitalReviews} likedHospitals={likedHospitals} onReviewsChange={setHospitalReviews} onLikedHospitalsChange={updateLikedHospitals} onDeleteDraft={async (draftId) => { await deleteDraft(draftId); setEditingDraft(null) }} /></main>}

      {activeTab !== 'map' && (
        <main className="app-main">
          {activeTab === 'pets' && <PetsScreen userId={session.user.id} pets={pets} onDeletePet={deletePet} onEditPet={(pet) => { setEditingPet(pet); setCreateMode('pet') }} onOpenDiary={openPetDiary} onRegisterPet={() => { setEditingPet(null); setEditingDraft(null); setCreateMode('pet') }} />}
          {activeTab === 'diary' && <DiaryPage userId={session.user.id} pets={pets} hospitals={allHospitals} hospitalReviews={hospitalReviews} initialPetId={diaryPetId ?? currentPetId ?? undefined} initialAction={diaryInitialAction} onInitialActionHandled={() => setDiaryInitialAction(null)} initialClinicHospital={diaryClinicHospital} readOnly={diaryReadOnly} onAddPet={() => { setEditingPet(null); setEditingDraft(null); setCreateMode('pet') }} onCreateQna={openQnaCreate} onFindHospital={openPetHospitalSearch} onCreateClinicReview={openClinicReview} onInitialClinicHospitalHandled={() => setDiaryClinicHospital(null)} initialDraft={editingDraft?.draftType === 'care_record' || editingDraft?.draftType === 'reminder' ? editingDraft as never : null} onDeleteDraft={async (draftId) => { await deleteDraft(draftId); setEditingDraft(null) }} />}
          {activeTab === 'qna' && <QnaScreen userId={session.user.id} profile={profile} posts={qnaPosts} hospitals={allHospitals} openPostId={qnaOpenId} onOpenHandled={() => setQnaOpenId(null)} onChange={updateQnaPosts} onDeletePost={deleteQnaPost} onEditPost={(post) => editWrittenPost('question', post.id)} onCreate={(petId) => openQnaCreate(petId)} onOpenHospital={openHospitalOnMap} onFindConditionHospitals={openConditionHospitalSearch} onOpenDiary={(petId, readOnly) => { setDiaryPetId(petId); setCurrentPetId(petId); setDiaryReadOnly(readOnly); syncAppUrl('diary', petId); setActiveTab('diary') }} />}
          {activeTab === 'profile' && (
            <ProfileScreen
              key={`${profile.username}-${profile.nickname}-${profile.avatarUrl}`}
              userId={session.user.id}
              profile={profile}
              qnaPosts={qnaPosts}
              hospitalReviews={hospitalReviews}
              likedHospitals={likedHospitals}
              drafts={drafts}
              onSignOut={signOut}
              onDeleteAccount={deleteAccount}
              onSaveProfile={saveProfile}
              onDeleteDraft={deleteDraft}
              onContinueDraft={continueDraft}
              onOpenWrittenPost={openWrittenPost}
              onOpenHospital={openHospitalOnMap}
              onEditWrittenPost={editWrittenPost}
              onDeleteWrittenPost={deleteWrittenPost}
              onEditReview={editHospitalReviewFromProfile}
              onDeleteReview={deleteHospitalReviewFromProfile}
              onUnlikePost={unlikePostFromProfile}
              onUnlikeHospital={unlikeHospitalFromProfile}
              onUnlikeReview={unlikeReviewFromProfile}
              onCreateQuestion={() => openQnaCreate(null)}
              onCreateReview={() => moveTab('map')}
            />
          )}
        </main>
      )}

      {dataError && <button className="data-error" type="button" onClick={() => setDataError('')}>{dataError}</button>}
    </div>
  )
}

export default App








