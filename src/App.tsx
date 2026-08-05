import { useEffect, useMemo, useRef, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import './App.css'
import AuthScreen from './components/AuthScreen'
import ProfileScreen from './components/profile/ProfileScreen'
import PetsScreen from './components/my-pet/PetsScreen'
import PetCreateFlow from './components/my-pet/PetCreateFlow'
import DiaryPage from './components/diary/DiaryScreen'
import MapScreen from './components/hospital-map/MapScreen'
import { QnaCreateFlow, QnaScreen } from './components/qna/QnaScreen'
import { deleteAppData, loadAppData, saveAppData } from './lib/appData'
import { supabase } from './lib/supabase'
import { dataUrlToImageFile, removeUploadedImage, uploadImageFile } from './lib/imageStorage'
import { deleteHospitalLike, getHospitalLikeKey, mergeLocalHospitalLikes, saveHospitalLike } from './lib/hospitalLikes'
import { deactivatePushSubscriptionForLogout, syncCurrentDevicePushSubscription } from './lib/pushNotifications'
import { animalCategoryLabels, animalCategoryOptions, CategoryTagIcon, isSameHospitalIdentity, loadCollectedHospitals, normalizePet, petSpeciesOptions, readSavedHospitalSnapshots, readStoredReviews, reviewStorageKey, toHospitalSnapshot, writeSavedHospitalSnapshots } from './components/hospital-map/mapDependencies'
import type { AnimalCategory, AppProfile, CreateMode, DraftItem, HospitalReview, HospitalSnapshot, Pet, QnaPost, Tab } from './types/app'
export type { AppProfile, DraftItem, HospitalReview, HospitalSnapshot, Pet, QnaPost } from './types/app'

const LOCAL_DRAFTS_KEY_PREFIX = 'exocare:drafts'

function localDraftsKey(userId: string) {
  return `${LOCAL_DRAFTS_KEY_PREFIX}:${userId}`
}

function readLocalDrafts(userId: string) {
  try {
    const value = JSON.parse(localStorage.getItem(localDraftsKey(userId)) ?? '[]')
    return Array.isArray(value) ? value as DraftItem[] : []
  } catch {
    return []
  }
}

function writeLocalDrafts(userId: string, items: DraftItem[]) {
  localStorage.setItem(localDraftsKey(userId), JSON.stringify(items))
}

const tabs: Array<{ id: Tab; label: string }> = [
  { id: 'pets', label: '\uB9C8\uC774 \uD3AB' },
  { id: 'diary', label: '\uB2E4\uC774\uC5B4\uB9AC' },
  { id: 'map', label: '\uBCD1\uC6D0 \uCC3E\uAE30' },
  { id: 'qna', label: 'Q&A' },
]

function NavigationIcon({ tab, mobile = false }: { tab: Tab; mobile?: boolean }) {
  const className = `${mobile ? 'bottom-nav-icon ' : ''}side-nav-icon nav-icon-vector ${tab}`

  if (tab === 'pets') {
    return (
      <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
        <ellipse cx="6.4" cy="7.2" rx="2" ry="2.7" />
        <ellipse cx="10.2" cy="4.6" rx="2" ry="2.7" />
        <ellipse cx="14.3" cy="4.6" rx="2" ry="2.7" />
        <ellipse cx="18" cy="7.3" rx="2" ry="2.7" />
        <path d="M6.7 16.3c.2-3.9 2.3-6.5 5.3-6.5s5.1 2.6 5.3 6.5c.1 2.1-1.7 3.5-3.6 2.7a4.5 4.5 0 0 0-3.4 0c-1.9.8-3.7-.6-3.6-2.7Z" />
      </svg>
    )
  }

  if (tab === 'diary') {
    return (
      <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
        <path d="M6.5 3.5h9a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2h-9a2 2 0 0 1-2-2v-13a2 2 0 0 1 2-2Z" />
        <path d="M2.8 7h3.4M2.8 11h3.4M2.8 15h3.4" />
        <path d="m12.2 15.8.8-3.2 5.6-5.6 2.4 2.4-5.6 5.6-3.2.8Zm5.2-7.6 2.4 2.4" />
      </svg>
    )
  }

  if (tab === 'map') {
    return (
      <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
        <path d="M19 10.2c0 5.2-7 11-7 11s-7-5.8-7-11a7 7 0 1 1 14 0Z" />
        <path d="M12 6.8v6.4M8.8 10h6.4" />
      </svg>
    )
  }

  if (tab === 'qna') {
    return (
      <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
        <path d="M3.2 14.8 2.5 19l4-1.9a8.5 8.5 0 0 0 3.5.7c4.4 0 8-3 8-6.7s-3.6-6.6-8-6.6-8 3-8 6.6c0 1.4.4 2.6 1.2 3.7Z" />
        <path d="M15.4 8.2c3.5.3 6.1 2.7 6.1 5.7 0 1.2-.4 2.3-1 3.2l.6 3.5-3.4-1.6a7.5 7.5 0 0 1-5.4.2" />
        <circle cx="7.2" cy="11.1" r=".7" fill="currentColor" stroke="none" />
        <circle cx="10" cy="11.1" r=".7" fill="currentColor" stroke="none" />
        <circle cx="12.8" cy="11.1" r=".7" fill="currentColor" stroke="none" />
      </svg>
    )
  }

  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="7" r="4" />
      <path d="M4.5 20c.2-5 3-8 7.5-8s7.3 3 7.5 8c-2.2 1-4.7 1.5-7.5 1.5S6.7 21 4.5 20Z" />
    </svg>
  )
}

const qnaTable = ['comm', 'unity_posts'].join('')
const qnaDatabaseCategory = ['Q', '&A'].join('')

function readInitialUrlState() {
  if (window.location.pathname === '/profile') {
    return {
      tab: 'profile' as Tab,
      petId: null,
    }
  }
  const params = new URLSearchParams(window.location.search)
  const tab = params.get('tab') as Tab | null
  const petId = params.get('petId')
  const allowedTabs: Tab[] = ['pets', 'diary', 'map', 'qna', 'profile']
  return {
    tab: tab && allowedTabs.includes(tab) ? tab : petId ? 'diary' as Tab : 'pets' as Tab,
    petId,
  }
}

function syncAppUrl(tab: Tab, petId?: string | null) {
  if (tab === 'profile') {
    const currentProfileTab = new URLSearchParams(window.location.search).get('tab')
    const profileTabs = ['posts', 'drafts', 'likes', 'reviews', 'settings']
    const nextProfileTab = currentProfileTab && profileTabs.includes(currentProfileTab) ? currentProfileTab : 'posts'
    window.history.replaceState(window.history.state, '', `/profile?tab=${nextProfileTab}${window.location.hash}`)
    return
  }

  const params = new URLSearchParams(window.location.search)
  params.set('tab', tab)
  if (petId) params.set('petId', petId)
  else params.delete('petId')
  const pathname = window.location.pathname === '/profile' ? '/' : window.location.pathname
  const next = `${pathname}?${params.toString()}${window.location.hash}`
  window.history.replaceState(window.history.state, '', next)
}

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
  if (!session) return <AuthScreen />
  return <AuthenticatedApp session={session} />
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
      setQnaPosts(nextPosts)
      setDrafts(nextDrafts)
      setAllHospitals(nextHospitals)
      writeSavedHospitalSnapshots(nextLikedHospitals, session.user.id)
      setLikedHospitals(nextLikedHospitals)
    }).catch((error) => {
      if (!active) return
      console.error('Initial data load failed:', error)
      setDataError('?곗씠?곕? 遺덈윭?ㅼ? 紐삵뻽?듬땲?? ?좎떆 ???ㅼ떆 ?덈줈怨좎묠?댁＜?몄슂.')
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
          setDataError('?꾨줈???뺣낫瑜?遺덈윭?ㅼ? 紐삵뻽?듬땲??')
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
      }).catch(() => setDataError('吏덈Ц 蹂寃??댁슜????ν븯吏 紐삵뻽?듬땲??'))
    }
  }

  const deleteQnaPost = async (postId: string) => {
    try {
      await deleteAppData(qnaTable, postId, session.user.id)
      setQnaPosts((items) => items.filter((item) => item.id !== postId))
    } catch {
      setDataError('吏덈Ц????젣?섏? 紐삵뻽?듬땲??')
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
      setDataError('怨꾩젙????젣?섏? 紐삵뻽?듬땲?? ?좎떆 ???ㅼ떆 ?쒕룄?댁＜?몄슂.')
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
      <button
        className="menu-trigger"
        type="button"
        aria-label="硫붾돱 ?닿린"
        aria-expanded={sideNavOpen}
        onClick={() => setSideNavOpen(true)}
      >
        <span />
        <span />
        <span />
      </button>
      {activeTab !== 'map' && (
        <button
          className={`mobile-profile-button ${activeTab === 'profile' ? 'active' : ''}`}
          type="button"
          aria-label="?꾨줈???닿린"
          onClick={toggleProfileTab}
        >
          {profile.avatarUrl ? <img src={profile.avatarUrl} alt="" /> : <span>{(profile.nickname || profile.username || 'ME').slice(0, 2).toUpperCase()}</span>}
        </button>
      )}
      <button
        className={`side-nav-dim ${sideNavOpen ? 'open' : ''}`}
        type="button"
        aria-label="硫붾돱 ?リ린"
        onClick={() => setSideNavOpen(false)}
      />
      <aside className={`side-nav ${sideNavOpen ? 'open' : ''}`}>
        <nav>
          {tabs.map((tab) => (
            <button className={activeTab === tab.id ? 'active' : ''} key={tab.id} type="button" onClick={() => { moveTab(tab.id); setSideNavOpen(false) }}>
              <NavigationIcon tab={tab.id} />
              {tab.label}
            </button>
          ))}
        </nav>
        <button className={`side-nav-profile ${activeTab === 'profile' ? 'active' : ''}`} type="button" onClick={() => { toggleProfileTab(); setSideNavOpen(false) }}>
          <NavigationIcon tab="profile" />
          <span>&#54532;&#47196;&#54596;</span>
        </button>
      </aside>

      {activeTab === 'map' && <header className="top-bar">
        <div>
           <h1>{tabs.find((tab) => tab.id === activeTab)?.label}</h1>
        </div>
      </header>}

      {activeTab === 'map' && <main className="app-main"><MapScreen userId={session.user.id} profile={profile} pets={pets} initialPetId={currentPetId ?? undefined} focusHospital={mapFocusHospital} reviewDraft={editingDraft?.draftType === 'hospital_review' ? editingDraft : null} reviews={hospitalReviews} likedHospitals={likedHospitals} onReviewsChange={setHospitalReviews} onLikedHospitalsChange={updateLikedHospitals} onCreateClinicRecord={openHospitalVisitRecord} onDeleteDraft={async (draftId) => { await deleteDraft(draftId); setEditingDraft(null) }} /></main>}

      {activeTab !== 'map' && (
        <main className="app-main">
          {activeTab === 'pets' && <PetsScreen userId={session.user.id} pets={pets} onDeletePet={deletePet} onEditPet={(pet) => { setEditingPet(pet); setCreateMode('pet') }} onOpenDiary={openPetDiary} onRegisterPet={() => { setEditingPet(null); setEditingDraft(null); setCreateMode('pet') }} />}
          {activeTab === 'diary' && <DiaryPage userId={session.user.id} pets={pets} hospitalReviews={hospitalReviews} hospitals={allHospitals} initialPetId={diaryPetId ?? currentPetId ?? undefined} initialClinicHospital={diaryClinicHospital} readOnly={diaryReadOnly} onAddPet={() => { setEditingPet(null); setEditingDraft(null); setCreateMode('pet') }} onCreateQna={openQnaCreate} onCreateClinicReview={openClinicReview} onInitialClinicHospitalHandled={() => setDiaryClinicHospital(null)} initialDraft={editingDraft?.draftType === 'care_record' || editingDraft?.draftType === 'reminder' ? editingDraft as never : null} onDeleteDraft={async (draftId) => { await deleteDraft(draftId); setEditingDraft(null) }} />}
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

      <nav
        className={`bottom-nav ${activeTab === 'map' ? 'map-bottom-nav' : ''}`}
        onPointerDown={beginBottomNavDrag}
        onPointerMove={moveBottomNavDrag}
        onPointerUp={finishBottomNavDrag}
        onPointerCancel={() => { bottomNavDragStartRef.current = null }}
      >
        {tabs.map((tab) => (
          <button className={activeTab === tab.id ? 'active' : ''} key={tab.id} type="button" onClick={(event) => { if (suppressNextBottomNavClickRef.current) { event.preventDefault(); return } moveTab(tab.id) }}>
            <NavigationIcon tab={tab.id} mobile />
            <span className="bottom-nav-label">{tab.label}</span>
          </button>
        ))}
      </nav>

      {dataError && <button className="data-error" type="button" onClick={() => setDataError('')}>{dataError}</button>}
    </div>
  )
}

export default App








