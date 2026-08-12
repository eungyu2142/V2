import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import './App.css'
import './styles/feature-layout.css'
import './components/ui/ui.css'
import { AppNavigation } from './components/navigation/AppNavigation'
import { appTabs } from './components/navigation/navigationConfig'
import { deleteAppData, loadAppData, saveAppData } from './lib/appData'
import { readInitialUrlState, syncAppUrl } from './lib/appUrl'
import { readLocalDrafts, writeLocalDrafts } from './lib/draftStorage'
import { supabase } from './lib/supabase'
import { dataUrlToImageFile, removeUploadedImage, uploadImageFile } from './lib/imageStorage'
import { deleteHospitalLike, getHospitalLikeKey, mergeLocalHospitalLikes, saveHospitalLike } from './lib/hospitalLikes'
import { deactivatePushSubscriptionForLogout, syncCurrentDevicePushSubscription } from './lib/pushNotifications'
import { animalCategoryLabels, animalCategoryOptions, CategoryTagIcon, isSameHospitalIdentity, loadCollectedHospitals, normalizePet, petSpeciesOptions, readSavedHospitalSnapshots, readStoredReviews, reviewStorageKey, toHospitalSnapshot, writeSavedHospitalSnapshots } from './components/hospital-map/mapDependencies'
import type { AnimalCategory, AppProfile, CreateMode, DraftItem, HospitalReview, HospitalSnapshot, Pet, QnaPost, Tab } from './types/app'
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

  if (!authReady) return <main className="auth-screen"><p className="auth-loading">로그인 상태를 확인하고 있습니다.</p></main>
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
  const [qnaInitialPetId, setQnaInitialPetId] = useState<string | null>(initialUrlState.tab === 'qna' ? initialUrlState.petId : null)
  const [editingDraft, setEditingDraft] = useState<DraftItem | null>(null)
  const [mapFocusHospital, setMapFocusHospital] = useState<HospitalSnapshot | null>(null)
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
    ]).then(([nextPets, nextPosts, nextDrafts, nextHospitals, nextLikedHospitals]) => {
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

  const openHospitalVisitRecord = (hospital: HospitalSnapshot) => {
    const petId = currentPetId && pets.some((pet) => pet.id === currentPetId)
      ? currentPetId
      : pets[0]?.id
    if (!petId) {
      window.alert('방문 기록을 남기려면 마이 펫을 먼저 등록해 주세요.')
      return
    }
    setCurrentPetId(petId)
    setDiaryPetId(petId)
    setDiaryReadOnly(false)
    setDiaryClinicHospital(hospital)
    setEditingDraft(null)
    setCreateMode(null)
    syncAppUrl('diary', petId)
    setActiveTab('diary')
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

  const openPetDiary = (petId: string) => {
    setCurrentPetId(petId)
    setDiaryPetId(petId)
    setDiaryReadOnly(false)
    syncAppUrl('diary', petId)
    setActiveTab('diary')
    setCreateMode(null)
    setEditingPet(null)
    setEditingDraft(null)
  }

  const openQnaCreate = (petId?: string | null) => {
    const validPetId = petId && pets.some((pet) => pet.id === petId) ? petId : null
    setQnaInitialPetId(validPetId)
    setEditingPet(null)
    setEditingDraft(null)
    setCreateMode('post')
    syncAppUrl('qna', validPetId)
  }

  const openPetHospitalSearch = (petId: string) => {
    if (pets.some((pet) => pet.id === petId)) setCurrentPetId(petId)
    moveTab('map')
  }

  const saveQnaPost = async (post: QnaPost) => {
    setQnaPosts((items) => [post, ...items.filter((item) => item.id !== post.id)])
    setCreateMode(null)
    try {
      await saveAppData(qnaTable, session.user.id, post, {
        category: qnaDatabaseCategory, title: post.title, body: post.body, view_count: post.viewCount ?? 0,
      })
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
      const nextHospitalReviews = Object.fromEntries(Object.entries(hospitalReviews).map(([hospitalId, items]) => [
        hospitalId,
        items.map((review) => review.mine === true ? { ...review, author: normalized.nickname || normalized.username || review.author, authorAvatarUrl: normalized.avatarUrl } : review),
      ])) as Record<string, HospitalReview[]>
      setHospitalReviews(nextHospitalReviews)
      localStorage.setItem(reviewStorageKey, JSON.stringify(nextHospitalReviews))
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
      initialDraft={editingDraft?.draftType === 'question' ? editingDraft : null}
      onClose={() => { setCreateMode(null); setEditingDraft(null); setQnaInitialPetId(null) }}
      onSave={async (post) => {
        await saveQnaPost(post)
        if (editingDraft && drafts.some((draft) => draft.id === editingDraft.id)) await deleteDraft(editingDraft.id)
        setEditingDraft(null)
        setQnaInitialPetId(null)
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

      {activeTab === 'map' && <header className="top-bar">
        <div>
           <h1>{appTabs.find((tab) => tab.id === activeTab)?.label}</h1>
        </div>
      </header>}

      {activeTab === 'map' && <main className="app-main"><MapScreen userId={session.user.id} profile={profile} pets={pets} initialPetId={currentPetId ?? undefined} focusHospital={mapFocusHospital} reviewDraft={editingDraft?.draftType === 'hospital_review' ? editingDraft : null} reviews={hospitalReviews} likedHospitals={likedHospitals} onReviewsChange={setHospitalReviews} onLikedHospitalsChange={updateLikedHospitals} onCreateClinicRecord={openHospitalVisitRecord} onDeleteDraft={async (draftId) => { await deleteDraft(draftId); setEditingDraft(null) }} /></main>}

      {activeTab !== 'map' && (
        <main className="app-main">
          {activeTab === 'pets' && <PetsScreen userId={session.user.id} pets={pets} onDeletePet={deletePet} onEditPet={(pet) => { setEditingPet(pet); setCreateMode('pet') }} onOpenDiary={openPetDiary} onRegisterPet={() => { setEditingPet(null); setEditingDraft(null); setCreateMode('pet') }} />}
          {activeTab === 'diary' && <DiaryPage userId={session.user.id} pets={pets} hospitalReviews={hospitalReviews} hospitals={allHospitals} initialPetId={diaryPetId ?? currentPetId ?? undefined} initialClinicHospital={diaryClinicHospital} readOnly={diaryReadOnly} onAddPet={() => { setEditingPet(null); setEditingDraft(null); setCreateMode('pet') }} onCreateQna={openQnaCreate} onFindHospital={openPetHospitalSearch} onCreateClinicReview={openClinicReview} onInitialClinicHospitalHandled={() => setDiaryClinicHospital(null)} initialDraft={editingDraft?.draftType === 'care_record' || editingDraft?.draftType === 'reminder' ? editingDraft as never : null} onDeleteDraft={async (draftId) => { await deleteDraft(draftId); setEditingDraft(null) }} />}
          {activeTab === 'qna' && <QnaScreen userId={session.user.id} profile={profile} posts={qnaPosts} hospitals={allHospitals} openPostId={qnaOpenId} onOpenHandled={() => setQnaOpenId(null)} onChange={updateQnaPosts} onDeletePost={deleteQnaPost} onEditPost={(post) => editWrittenPost('question', post.id)} onCreate={(petId) => openQnaCreate(petId)} onOpenHospital={openHospitalOnMap} onOpenDiary={(petId, readOnly) => { setDiaryPetId(petId); setCurrentPetId(petId); setDiaryReadOnly(readOnly); syncAppUrl('diary', petId); setActiveTab('diary') }} />}
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








