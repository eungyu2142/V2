import { type ChangeEvent, type FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import './App.css'
import AuthScreen from './components/AuthScreen'
import ProfileScreen from './components/profile/ProfileScreen'
import PetsScreen from './components/my-pet/PetsScreen'
import StepShell from './components/account/StepShell'
import DiaryPage, { type RecordDraft, type Reminder } from './components/diary/DiaryScreen'
import HospitalReviewForm, { type ReviewAnimalCategory } from './components/hospital-map/MapAndReview'
import type { PetRecord, PetRecordType } from './features/diary/diaryTypes'
import { linkReviewToDiary, listDailyTasks } from './features/diary/diaryService'
import { deleteAppData, loadAppData, saveAppData } from './lib/appData'
import { supabase } from './lib/supabase'

export { loadAppData }
export { listDailyTasks }

type Tab = 'pets' | 'diary' | 'map' | 'qna' | 'profile'
type CreateMode = 'pet' | 'post' | null
type AnimalCategory = 'all' | 'reptile' | 'bird' | 'rodent' | 'amphibian' | 'other'
type HospitalSort = 'distance' | 'reviews' | 'rating'
type MobileMapSheetState = 'collapsed' | 'middle' | 'expanded'

export type Pet = {
  id: string
  name: string
  group: AnimalCategory
  species: string
  gender: 'male' | 'female' | 'unknown'
  photo?: string
  weight?: string
  weightUnit?: 'g' | 'kg'
  birthday?: string
  adoptionDate?: string
  registeredAt?: string
  description?: string
  ageStage?: string
  ageText?: string
}

type QnaCategory = '건강/증상' | '사육/관리'
type QnaStatus = 'unresolved' | 'resolved'
type QnaSort = 'latest' | 'popular' | 'views' | 'comments'
type QnaListStatus = 'all' | 'waiting' | 'answered' | 'resolved'

type QnaComment = {
  id: string
  author: string
  body: string
  createdAt: string
  mine: boolean
  hospitalSnapshot?: HospitalSnapshot
}

export type QnaPost = {
  id: string
  category: QnaCategory
  status?: QnaStatus
  selectedAnswerCommentId?: string
  title: string
  body: string
  author: string
  authorAvatarUrl?: string
  mine?: boolean
  animal: string
  petId: string
  animalGroup?: string
  animalSpecies?: string
  image?: string
  linkedRecordId?: string
  attachedRecordSnapshot?: AttachedRecordSnapshot
  attachedDiarySnapshot?: AttachedDiarySnapshot
  createdAt: string
  viewCount?: number
  liked: boolean
  likes: number
  comments: QnaComment[]
}

type DiaryRecordDraftPayload = {
  petId: string
  date: string
  draft: RecordDraft
}

type HospitalReviewDraftPayload = {
  hospital: HospitalSnapshot
  review: HospitalReview
}

type ReminderDraftPayload = {
  reminder: Reminder
}

type DraftKind = 'question' | 'pet' | 'care_record' | 'hospital_review' | 'reminder'

export type DraftItem = {
  id: string
  draftType: DraftKind
  title: string
  body: string
  updatedAt: string
  step?: number
  payload: QnaPost | Pet | DiaryRecordDraftPayload | HospitalReviewDraftPayload | ReminderDraftPayload
}

export type AppProfile = {
  username: string
  nickname: string
  avatarUrl: string
}

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

function readSavedHospitalSnapshots() {
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

function writeSavedHospitalSnapshots(items: HospitalSnapshot[]) {
  localStorage.setItem(savedHospitalDetailsStorageKey, JSON.stringify(items))
  localStorage.setItem(savedHospitalStorageKey, JSON.stringify(items.map((item) => item.id).filter(Boolean)))
}

type Coordinates = {
  lat: number
  lng: number
}

type Hospital = {
  id: string
  name: string
  address: string
  roadAddress?: string
  phone: string
  link: string
  lat: number
  lng: number
  distanceKm?: number
  categories: Exclude<AnimalCategory, 'all'>[]
  matchedQueries?: string[]
}

export type HospitalSnapshot = {
  id?: string
  name: string
  address: string
  phone: string
  lat: number
  lng: number
  animalTags: string[]
  naverLink: string
  source: 'naver_local_search' | 'local_hospital_data'
}

type AttachedRecordSnapshot = {
  recordId: string
  petId: string
  petName: string
  animalGroup: string
  animalSpecies: string
  recordDate: string
  recordType: PetRecordType
  recordTypeLabel: string
  summary: string
  photoUrl?: string
}

type AttachedDiarySnapshot = {
  petId: string
  petName: string
  petPhoto?: string
  records: PetRecord[]
  startDate: string
  endDate: string
  totalCount: number
}

export type HospitalReview = {
  id: string
  hospitalId: string
  userId?: string
  petId?: string
  petName?: string
  author: string
  animalCategory?: Exclude<AnimalCategory, 'all'>
  species?: string
  rating: number
  visitDate?: string
  cost?: number
  diagnosis?: string
  treatment?: string
  medicine?: string
  medicineDose?: string
  medicineStartDate?: string
  medicineEndDate?: string
  medicineDailyCount?: number
  medicineInstructions?: string
  medicineBagImage?: string
  medicineOcrRaw?: unknown
  tags?: string[]
  body: string
  content?: string
  images?: string[]
  mine?: boolean
  liked?: boolean
  likes?: number
  hospitalName?: string
  hospitalSnapshot?: HospitalSnapshot
  createdAt: string
}

type NaverMapApi = {
  maps: {
    LatLng: new (latitude: number, longitude: number) => unknown
    Point: new (x: number, y: number) => unknown
    Map: new (element: HTMLElement, options: { center: unknown; zoom: number }) => {
      setCenter: (center: unknown) => void
      setZoom: (zoom: number) => void
    }
    Marker: new (options: { position: unknown; map: unknown; title?: string; icon?: string | { content: string } }) => {
      setMap: (map: unknown | null) => void
    }
    Event: {
      addListener: (target: unknown, eventName: string, listener: () => void) => void
    }
    TransCoord?: {
      fromTM128ToLatLng: (point: unknown) => { lat: () => number; lng: () => number }
    }
  }
}

declare global {
  interface Window {
    naver?: NaverMapApi
  }
}

const tabs: Array<{ id: Tab; label: string }> = [
  { id: 'pets', label: '마이 펫' },
  { id: 'diary', label: '다이어리' },
  { id: 'map', label: '지도' },
  { id: 'qna', label: 'Q&A' },
]

export const animalCategoryOptions: AnimalCategory[] = ['all', 'reptile', 'amphibian', 'rodent', 'bird', 'other']
export const animalCategoryLabels: Record<AnimalCategory, string> = {
  all: '전체',
  reptile: '파충류',
  bird: '조류',
  rodent: '설치류',
  amphibian: '양서류',
  other: '기타',
}

function toReviewAnimalCategory(category?: AnimalCategory): Exclude<ReviewAnimalCategory, 'all'> {
  if (category === 'reptile' || category === 'bird' || category === 'rodent' || category === 'amphibian' || category === 'other') return category
  return 'other'
}

const animalCategorySearchTerms: Record<AnimalCategory, string> = {
  all: '특수동물병원',
  reptile: '파충류 동물병원',
  bird: '조류 동물병원',
  rodent: '설치류 동물병원',
  amphibian: '양서류 동물병원',
  other: '특수동물병원',
}

const exoticHospitalSearchTerms = ['특수동물병원', '이국동물병원', '파충류 동물병원', '조류 동물병원', '설치류 동물병원', '양서류 동물병원']
const hospitalPositiveKeywords = ['동물병원', '동물 병원', '특수동물', '특수 동물', '이국동물', '이국 동물', '파충류', '조류', '설치류', '양서류', '햄스터', '토끼', '페럿', '앵무새', '거북', '도마뱀']
const hospitalNegativeKeywords = ['애견카페', '카페', '펫샵', '애견샵', '용품', '미용', '호텔', '분양', '수족관', '아쿠아리움', '사료', '간식', '훈련소', '보호소']

const animalCategoryKeywords: Record<Exclude<AnimalCategory, 'all'>, string[]> = {
  reptile: ['파충류', '도마뱀', '게코', '거북', '거북이', '뱀', '이구아나', '카멜레온', '비어디'],
  bird: ['조류', '앵무새', '새', '카나리아', '문조', '잉꼬', '코뉴어'],
  rodent: ['설치류', '햄스터', '기니피그', '친칠라', '고슴도치', '토끼', '페럿', '데구', '저빌'],
  amphibian: ['양서류', '개구리', '팩맨', '도롱뇽', '뉴트', '살라만더', '아홀로틀'],
  other: ['특수동물', '기타'],
}

const petSpeciesOptions: Record<Exclude<AnimalCategory, 'all'>, string[]> = {
  reptile: ['개코', '비어디드래곤', '이구아나', '카멜레온', '왕도마뱀', '스킨크', '육지 거북', '수생 습지 거북', '콘스네이크', '킹스네이크', '볼파이톤', '보아-파이톤', '호그노즈', '기타 도마뱀', '기타 뱀', '직접 입력'],
  bird: ['앵무새', '닭', '기타 조류', '직접 입력'],
  rodent: ['슈가글라이더', '고슴도치', '햄스터', '기타 설치류', '직접 입력'],
  amphibian: ['팩맨', '트리프록', '두꺼비(토드)', '뉴트', '살라만다', '아홀로틀', '기타 양서류', '직접 입력'],
  other: ['직접 입력'],
}

const reviewStorageKey = 'exocare-hospital-reviews'
const savedHospitalStorageKey = 'exocare-saved-hospitals'
const savedHospitalDetailsStorageKey = 'exocare-liked-hospitals'
let naverMapsLoader: Promise<NaverMapApi> | null = null
const qnaTable = ['comm', 'unity_posts'].join('')
const qnaDatabaseCategory = ['Q', '&A'].join('')

function readInitialUrlState() {
  const params = new URLSearchParams(window.location.search)
  const tab = params.get('tab') as Tab | null
  const petId = params.get('petId')
  const allowedTabs: Tab[] = ['pets', 'diary', 'map', 'qna', 'profile']
  return {
    tab: tab && allowedTabs.includes(tab) ? tab : petId ? 'diary' as Tab : 'map' as Tab,
    petId,
  }
}

function syncAppUrl(tab: Tab, petId?: string | null) {
  const params = new URLSearchParams(window.location.search)
  params.set('tab', tab)
  if (petId) params.set('petId', petId)
  else params.delete('petId')
  const next = `${window.location.pathname}?${params.toString()}${window.location.hash}`
  window.history.replaceState(window.history.state, '', next)
}

function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [authReady, setAuthReady] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setAuthReady(true)
    })
    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
      setAuthReady(true)
    })
    return () => data.subscription.unsubscribe()
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
  const [currentPetId, setCurrentPetId] = useState<string | null>(initialUrlState.petId)
  const [pets, setPets] = useState<Pet[]>([])
  const [qnaPosts, setQnaPosts] = useState<QnaPost[]>([])
  const [drafts, setDrafts] = useState<DraftItem[]>([])
  const [hospitalReviews, setHospitalReviews] = useState<Record<string, HospitalReview[]>>(() => readStoredReviews())
  const [likedHospitals, setLikedHospitals] = useState<HospitalSnapshot[]>(() => readSavedHospitalSnapshots())
  const [profile, setProfile] = useState<AppProfile>({ username: '', nickname: '', avatarUrl: '' })
  const [dataError, setDataError] = useState('')
  const bottomNavDragStartRef = useRef<number | null>(null)
  const suppressNextBottomNavClickRef = useRef(false)
  const previousContentTabRef = useRef<Tab>(initialUrlState.tab === 'profile' ? 'map' : initialUrlState.tab)
  useEffect(() => {
    let active = true
    queueMicrotask(() => {
      if (!active) return
      setPets([])
      setQnaPosts([])
      setDrafts([])
      setHospitalReviews(readStoredReviews())
      setLikedHospitals(readSavedHospitalSnapshots())
      setProfile({ username: '', nickname: '', avatarUrl: '' })
      setCreateMode(null)
      setEditingPet(null)
      setEditingDraft(null)
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
    ]).then(([nextPets, nextPosts, nextDrafts]) => {
      if (!active) return
      setPets(nextPets.map(normalizePet))
      setQnaPosts(nextPosts)
      setDrafts(nextDrafts)
    }).catch((error) => {
      if (!active) return
      console.error('Initial data load failed:', error)
      setDataError('데이터를 불러오지 못했습니다. 잠시 후 다시 새로고침해 주세요.')
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

  const savePet = async (pet: Pet) => {
    setPets((items) => [pet, ...items.filter((item) => item.id !== pet.id)])
    setCurrentPetId(pet.id)
    try {
      await saveAppData('pets', session.user.id, pet, {
        name: pet.name, species: pet.species, category: pet.group,
        gender: pet.gender, photo_url: pet.photo ?? null,
      })
    } catch (error) {
      console.error('Supabase pet save failed; kept local state.', error)
    }
  }

  const deletePet = async (petId: string) => {
    try {
      await deleteAppData('pets', petId)
      setPets((items) => {
        const next = items.filter((item) => item.id !== petId)
        if (currentPetId === petId) setCurrentPetId(next[0]?.id ?? null)
        return next
      })
    } catch {
      setDataError('펫 정보를 삭제하지 못했습니다.')
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
      }).catch(() => setDataError('질문 변경 내용을 저장하지 못했습니다.'))
    }
  }

  const deleteQnaPost = async (postId: string) => {
    try {
      await deleteAppData(qnaTable, postId)
      setQnaPosts((items) => items.filter((item) => item.id !== postId))
    } catch {
      setDataError('질문을 삭제하지 못했습니다.')
    }
  }

  const saveDraft = async (draft: DraftItem) => {
    try {
      await saveAppData('drafts', session.user.id, draft, { draft_type: draft.draftType })
    } catch (error) {
      console.error('Supabase draft save failed; using local draft storage.', error)
    }
    const nextDrafts = [draft, ...readLocalDrafts(session.user.id).filter((item) => item.id !== draft.id)]
    writeLocalDrafts(session.user.id, nextDrafts)
    setDrafts((items) => [draft, ...items.filter((item) => item.id !== draft.id)])
    setCreateMode(null)
  }

  const deleteDraft = async (draftId: string) => {
    try {
      await deleteAppData('drafts', draftId)
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

  const saveProfile = async (nextProfile: AppProfile) => {
    try {
      const normalized = {
        username: nextProfile.username.trim(),
        nickname: nextProfile.nickname.trim(),
        avatarUrl: nextProfile.avatarUrl.trim(),
      }
      const { error } = await supabase.from('profiles').upsert({
        id: session.user.id,
        username: normalized.username || null,
        nickname: normalized.nickname || null,
        avatar_url: normalized.avatarUrl || null,
      })
      if (error) throw error
      setProfile(normalized)
    } catch {
      setDataError('프로필 정보를 저장하지 못했습니다.')
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

  if (createMode === 'pet') return (
    <PetCreateFlow
      initialPet={editingDraft?.draftType === 'pet' ? editingDraft.payload as Pet : editingPet}
      initialDraft={editingDraft?.draftType === 'pet' ? editingDraft : null}
      onClose={() => { setCreateMode(null); setEditingPet(null); setEditingDraft(null) }}
      onSave={async (pet) => {
        await savePet(pet)
        if (editingDraft?.draftType === 'pet') await deleteDraft(editingDraft.id)
        setEditingDraft(null)
      }}
      onOpenPlan={(petId) => openPetDiary(petId)}
      onSaveDraft={saveDraft}
    />
  )
  if (createMode === 'post') return (
    <QnaCreateFlow
      userId={session.user.id}
      pets={pets}
      author={profile.nickname.trim() || profile.username.trim() || '사용자'}
      initialPetId={qnaInitialPetId ?? undefined}
      initialDraft={editingDraft?.draftType === 'question' ? editingDraft : null}
      onClose={() => { setCreateMode(null); setEditingDraft(null); setQnaInitialPetId(null) }}
      onSave={async (post) => {
        await saveQnaPost(post)
        if (editingDraft && drafts.some((draft) => draft.id === editingDraft.id)) await deleteDraft(editingDraft.id)
        setEditingDraft(null)
        setQnaInitialPetId(null)
      }}
      onSaveDraft={saveDraft}
    />
  )
  return (
    <div className={`app-shell ${activeTab === 'map' ? 'map-shell' : ''}`}>
      <button
        className="menu-trigger"
        type="button"
        aria-label="메뉴 열기"
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
          aria-label="프로필 열기"
          onClick={toggleProfileTab}
        >
          {profile.avatarUrl ? <img src={profile.avatarUrl} alt="" /> : <span>{(profile.nickname || profile.username || 'ME').slice(0, 2).toUpperCase()}</span>}
        </button>
      )}
      <button
        className={`side-nav-dim ${sideNavOpen ? 'open' : ''}`}
        type="button"
        aria-label="메뉴 닫기"
        onClick={() => setSideNavOpen(false)}
      />
      <aside className={`side-nav ${sideNavOpen ? 'open' : ''}`}>
        <nav>
          {tabs.map((tab) => (
            <button className={activeTab === tab.id ? 'active' : ''} key={tab.id} type="button" onClick={() => { moveTab(tab.id); setSideNavOpen(false) }}>
              <span className={`side-nav-icon ${tab.id}`} aria-hidden="true" />
              {tab.label}
            </button>
          ))}
        </nav>
        <button className={`side-nav-profile ${activeTab === 'profile' ? 'active' : ''}`} type="button" onClick={() => { toggleProfileTab(); setSideNavOpen(false) }}>
          <span className="side-nav-icon profile" aria-hidden="true" />
          <span>&#54532;&#47196;&#54596;</span>
        </button>
      </aside>

      {activeTab !== 'qna' && <header className="top-bar">
        <div>
          <h1>{activeTab === 'profile' ? '프로필' : tabs.find((tab) => tab.id === activeTab)?.label}</h1>
        </div>
      </header>}

      {activeTab === 'map' && <main className="app-main"><MapScreen userId={session.user.id} profile={profile} pets={pets} initialPetId={currentPetId ?? undefined} focusHospital={mapFocusHospital} reviewDraft={editingDraft?.draftType === 'hospital_review' ? editingDraft : null} reviews={hospitalReviews} likedHospitals={likedHospitals} onReviewsChange={setHospitalReviews} onLikedHospitalsChange={setLikedHospitals} onSaveDraft={async (draft) => { await saveDraft(draft); setEditingDraft(null) }} onDeleteDraft={async (draftId) => { await deleteDraft(draftId); setEditingDraft(null) }} /></main>}

      {activeTab !== 'map' && (
        <main className="app-main">
          {activeTab === 'pets' && <PetsScreen userId={session.user.id} pets={pets} onDeletePet={deletePet} onEditPet={(pet) => { setEditingPet(pet); setCreateMode('pet') }} onOpenDiary={openPetDiary} onRegisterPet={() => { setEditingPet(null); setEditingDraft(null); setCreateMode('pet') }} />}
          {activeTab === 'diary' && <DiaryPage userId={session.user.id} pets={pets} initialPetId={diaryPetId ?? currentPetId ?? undefined} readOnly={diaryReadOnly} onAddPet={() => { setEditingPet(null); setEditingDraft(null); setCreateMode('pet') }} onAskQna={(petId) => openQnaCreate(petId)} initialDraft={editingDraft?.draftType === 'care_record' || editingDraft?.draftType === 'reminder' ? editingDraft as never : null} onSaveDraft={async (draft) => { await saveDraft(draft); setEditingDraft(null) }} onDeleteDraft={async (draftId) => { await deleteDraft(draftId); setEditingDraft(null) }} />}
          {activeTab === 'qna' && <QnaScreen userId={session.user.id} profile={profile} posts={qnaPosts} openPostId={qnaOpenId} onOpenHandled={() => setQnaOpenId(null)} onChange={updateQnaPosts} onDeletePost={deleteQnaPost} onEditPost={(post) => editWrittenPost('question', post.id)} onCreate={(petId) => openQnaCreate(petId)} onOpenHospital={openHospitalOnMap} onOpenDiary={(petId, readOnly) => { setDiaryPetId(petId); setCurrentPetId(petId); setDiaryReadOnly(readOnly); syncAppUrl('diary', petId); setActiveTab('diary') }} />}
          {activeTab === 'profile' && <ProfileScreen key={`${profile.username}-${profile.nickname}-${profile.avatarUrl}`} profile={profile} qnaPosts={qnaPosts} hospitalReviews={hospitalReviews} likedHospitals={likedHospitals} drafts={drafts} onSignOut={() => supabase.auth.signOut()} onDeleteAccount={deleteAccount} onSaveProfile={saveProfile} onDeleteDraft={deleteDraft} onContinueDraft={continueDraft} onOpenWrittenPost={openWrittenPost} onOpenHospital={openHospitalOnMap} onEditWrittenPost={editWrittenPost} onDeleteWrittenPost={deleteWrittenPost} />}
        </main>
      )}

      {activeTab === 'qna' && (
        <button className="app-fab" type="button" aria-label="질문 작성" onClick={() => { setEditingPet(null); setEditingDraft(null); setCreateMode('post') }}>
          +
        </button>
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
            <span className={`bottom-nav-icon side-nav-icon ${tab.id}`} aria-hidden="true" />
            <span className="bottom-nav-label">{tab.label}</span>
          </button>
        ))}
      </nav>

      {dataError && <button className="data-error" type="button" onClick={() => setDataError('')}>{dataError}</button>}
    </div>
  )
}

function MapScreen({ userId, profile, pets, initialPetId, focusHospital, reviewDraft, reviews, likedHospitals, onReviewsChange, onLikedHospitalsChange, onSaveDraft, onDeleteDraft }: { userId: string; profile: AppProfile; pets: Pet[]; initialPetId?: string; focusHospital?: HospitalSnapshot | null; reviewDraft?: DraftItem | null; reviews: Record<string, HospitalReview[]>; likedHospitals: HospitalSnapshot[]; onReviewsChange: (reviews: Record<string, HospitalReview[]>) => void; onLikedHospitalsChange: (hospitals: HospitalSnapshot[]) => void; onSaveDraft: (draft: DraftItem) => void | Promise<void>; onDeleteDraft: (draftId: string) => void | Promise<void> }) {
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
  const [reviewRating, setReviewRating] = useState(5)
  const [reviewBody, setReviewBody] = useState('')
  const [reviewVisitDate, setReviewVisitDate] = useState(new Date().toISOString().slice(0, 10))
  const [reviewCost, setReviewCost] = useState('')
  const [reviewDiagnosis, setReviewDiagnosis] = useState('')
  const [reviewTreatment, setReviewTreatment] = useState('')
  const [reviewMedicine, setReviewMedicine] = useState('')
  const [reviewPetId, setReviewPetId] = useState(initialPetId && pets.some((pet) => pet.id === initialPetId) ? initialPetId : pets[0]?.id ?? '')
  const [reviewMedicineStartDate, setReviewMedicineStartDate] = useState(new Date().toISOString().slice(0, 10))
  const [reviewMedicineEndDate, setReviewMedicineEndDate] = useState('')
  const [reviewMedicineDailyCount, setReviewMedicineDailyCount] = useState('1')
  const [reviewMedicineBagImage, setReviewMedicineBagImage] = useState('')
  const [reviewMedicineOcrRaw, setReviewMedicineOcrRaw] = useState<unknown>(null)
  const [medicineRecognitionStatus, setMedicineRecognitionStatus] = useState('')
  const [reviewTags, setReviewTags] = useState<string[]>([])
  const savedHospitalIds = likedHospitals.map((hospital) => hospital.id).filter(Boolean) as string[]
  const [isSidePanelCollapsed, setIsSidePanelCollapsed] = useState(false)
  const [sheetDismissed, setSheetDismissed] = useState(false)
  const [mobileSheetState, setMobileSheetState] = useState<MobileMapSheetState>('middle')
  void mobileSheetState
  void setMobileSheetState
  const [sheetDragY, setSheetDragY] = useState(0)
  const [editingReviewId, setEditingReviewId] = useState<string | null>(null)
  const mapElementRef = useRef<HTMLDivElement | null>(null)
  const mapInstanceRef = useRef<InstanceType<NaverMapApi['maps']['Map']> | null>(null)
  const markersRef = useRef<Array<InstanceType<NaverMapApi['maps']['Marker']>>>([])
  const currentLocationMarkerRef = useRef<InstanceType<NaverMapApi['maps']['Marker']> | null>(null)
  const searchTimerRef = useRef<number | null>(null)
  const lastHospitalSearchKeyRef = useRef('')
  const sheetDragStartRef = useRef<number | null>(null)

  const sortedHospitals = useMemo(() => sortHospitalsByDistance(hospitals, currentLocation), [hospitals, currentLocation])
  const filteredHospitals = useMemo(() => {
    return sortedHospitals
      .filter((hospital) => selectedCategories.length === 0 || hospital.categories.some((category) => selectedCategories.includes(category)))
      .sort((a, b) => {
        if (selectedSort === 'reviews') return getReviewSummary(reviews[b.id] ?? []).count - getReviewSummary(reviews[a.id] ?? []).count
        if (selectedSort === 'rating') return getReviewSummary(reviews[b.id] ?? []).average - getReviewSummary(reviews[a.id] ?? []).average
        return (a.distanceKm ?? 9999) - (b.distanceKm ?? 9999)
      })
  }, [reviews, selectedCategories, selectedSort, sortedHospitals])
  const selectedHospital = filteredHospitals.find((hospital) => hospital.id === selectedHospitalId) ?? null
  const selectedHospitalReviews = selectedHospital ? reviews[selectedHospital.id] ?? [] : []
  const selectedHospitalSummary = getReviewSummary(selectedHospitalReviews)
  const selectedHospitalRecentSpecies = getRecentSpecies(selectedHospitalReviews)
  const reviewDraftPayload = reviewDraft?.draftType === 'hospital_review' ? reviewDraft.payload as HospitalReviewDraftPayload : null
  const profileReviewAuthor = profile.nickname.trim() || profile.username.trim() || '사용자'
  const selectedReviewPet = pets.find((pet) => pet.id === reviewPetId)
  const selectedReviewAnimalCategory = toReviewAnimalCategory(selectedReviewPet?.group)
  const selectedReviewSpecies = selectedReviewPet?.species ?? ''

  useEffect(() => {
    if (!focusHospital) return
    let cancelled = false
    queueMicrotask(() => {
      if (cancelled) return
      const hospital = hospitalFromSnapshot(focusHospital)
      setHospitals((items) => [hospital, ...items.filter((item) => item.id !== hospital.id)])
      setSelectedHospitalId(hospital.id)
      setSheetDismissed(false)
      setMobileSheetState('expanded')
      setQuery(hospital.name)
      setSelectedCategories([...hospital.categories])
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
    setSheetDismissed(false)
    setMobileSheetState('expanded')
    setIsReviewFormOpen(true)
    setReviewRating(reviewDraftPayload.review.rating)
    setReviewBody(reviewDraftPayload.review.body)
    setReviewVisitDate(reviewDraftPayload.review.visitDate ?? new Date().toISOString().slice(0, 10))
    setReviewCost(reviewDraftPayload.review.cost ? reviewDraftPayload.review.cost.toLocaleString('ko-KR') : '')
    setReviewDiagnosis(reviewDraftPayload.review.diagnosis ?? '')
    setReviewTreatment(reviewDraftPayload.review.treatment ?? '')
    setReviewMedicine(reviewDraftPayload.review.medicine ?? '')
    setReviewPetId(reviewDraftPayload.review.petId ?? pets[0]?.id ?? '')
    setReviewMedicineStartDate(reviewDraftPayload.review.medicineStartDate ?? reviewDraftPayload.review.visitDate ?? new Date().toISOString().slice(0, 10))
    setReviewMedicineEndDate(reviewDraftPayload.review.medicineEndDate ?? '')
    setReviewMedicineDailyCount(String(reviewDraftPayload.review.medicineDailyCount ?? 1))
    setReviewMedicineBagImage(reviewDraftPayload.review.medicineBagImage ?? '')
    setReviewMedicineOcrRaw(reviewDraftPayload.review.medicineOcrRaw ?? null)
    setReviewTags(reviewDraftPayload.review.tags ?? [])
    setQuery(hospital.name)
    setSelectedCategories([...hospital.categories])
  }, [pets, reviewDraftPayload])

  useEffect(() => {
    if (!naverMapClientId) return

    let mounted = true

    Promise.allSettled([loadNaverMaps(naverMapClientId), readBrowserLocation()])
      .then(([naverResult, locationResult]) => {
        if (!mounted || !mapElementRef.current) return

        if (naverResult.status === 'rejected') {
          throw naverResult.reason
        }

        try {
          const naver = naverResult.value
          const firstLocation = locationResult.status === 'fulfilled' ? locationResult.value : null
          const centerLocation = firstLocation ?? { lat: 37.5665, lng: 126.978 }
          const center = new naver.maps.LatLng(centerLocation.lat, centerLocation.lng)
          mapInstanceRef.current = new naver.maps.Map(mapElementRef.current, { center, zoom: 12 })
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
        setMessage('지도를 불러오지 못했습니다. 네이버 콘솔의 Web 서비스 URL에 http://127.0.0.1:5173 을 등록했는지 확인해주세요.')
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
    if (!naver || !map || !currentLocation) return

    const position = new naver.maps.LatLng(currentLocation.lat, currentLocation.lng)
    currentLocationMarkerRef.current?.setMap(null)
    currentLocationMarkerRef.current = new naver.maps.Marker({
      position,
      map,
      title: '내 위치',
      icon: { content: '<div class="current-location-marker" aria-label="내 위치"><span></span></div>' },
    })
    map.setCenter(position)
    map.setZoom(14)
  }, [currentLocation])

  useEffect(() => {
    if (mapStatus !== 'ready' || focusHospital || reviewDraftPayload) return

    if (searchTimerRef.current) window.clearTimeout(searchTimerRef.current)
    searchTimerRef.current = window.setTimeout(() => {
      void runHospitalSearch(query, selectedCategories[0] ?? 'all', currentLocation)
    }, 600)

    return () => {
      if (searchTimerRef.current) window.clearTimeout(searchTimerRef.current)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentLocation, focusHospital, mapStatus, query, reviewDraftPayload, selectedCategories])

  useEffect(() => {
    const naver = window.naver
    const map = mapInstanceRef.current
    const hospital = selectedHospital
    if (!naver || !map || !hospital) return
    const position = new naver.maps.LatLng(hospital.lat, hospital.lng)
    map.setCenter(position)
    map.setZoom(16)
  }, [selectedHospital])

  useEffect(() => {
    const naver = window.naver
    const map = mapInstanceRef.current
    if (!naver || !map) return

    markersRef.current.forEach((marker) => marker.setMap(null))
    markersRef.current = []

    filteredHospitals.forEach((hospital) => {
      const position = new naver.maps.LatLng(hospital.lat, hospital.lng)
      const marker = new naver.maps.Marker({
        position,
        map,
        title: hospital.name,
        icon: { content: hospitalMarkerContent(hospital, hospital.id === selectedHospitalId, selectedHospitalReviews.length >= 5) },
      })
      naver.maps.Event.addListener(marker, 'click', () => {
        setSelectedHospitalId(hospital.id)
        setSheetDismissed(false)
        setMobileSheetState('expanded')
        map.setCenter(position)
        map.setZoom(16)
      })
      markersRef.current.push(marker)
    })
  }, [filteredHospitals, selectedHospitalId, selectedHospitalReviews.length])

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
    const next = likedHospitals.some((item) => item.id === snapshot.id)
      ? likedHospitals.filter((item) => item.id !== snapshot.id)
      : [snapshot, ...likedHospitals.filter((item) => item.id !== snapshot.id)]
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
    setSheetDismissed(false)

    const location = currentLocation ?? await getCurrentLocation().catch(() => null)
    lastHospitalSearchKeyRef.current = ''
    await runHospitalSearch(query, selectedCategories[0] ?? 'all', location)
  }

  const recognizeMedicineBag = (file: File) => {
    const reader = new FileReader()
    reader.onload = async () => {
      const image = typeof reader.result === 'string' ? reader.result : ''
      if (!image) return
      setReviewMedicineBagImage(image)
      setMedicineRecognitionStatus('약봉투를 인식하는 중이에요.')
      const { data, error } = await supabase.functions.invoke('recognize-medication-bag', { body: { image } })
      if (error || !data) {
        setMedicineRecognitionStatus('인식 결과를 확인할 수 없어 직접 입력해 주세요.')
        return
      }
      const result = data as { name?: string; type?: string; startDate?: string; endDate?: string; dailyCount?: number; raw?: unknown }
      setReviewMedicine(result.type ?? result.name ?? '')
      setReviewMedicineStartDate(result.startDate ?? reviewVisitDate)
      setReviewMedicineEndDate(result.endDate ?? '')
      setReviewMedicineDailyCount(String(result.dailyCount ?? 1))
      setReviewMedicineOcrRaw(result.raw ?? result)
      setMedicineRecognitionStatus('인식 결과를 확인하고 필요하면 수정해 주세요.')
    }
    reader.readAsDataURL(file)
  }

  const resetReviewForm = () => {
    setEditingReviewId(null)
    setReviewRating(5)
    setReviewBody('')
    setReviewVisitDate(new Date().toISOString().slice(0, 10))
    setReviewCost('')
    setReviewDiagnosis('')
    setReviewTreatment('')
    setReviewMedicine('')
    setReviewMedicineStartDate(new Date().toISOString().slice(0, 10))
    setReviewMedicineEndDate('')
    setReviewMedicineDailyCount('1')
    setReviewMedicineBagImage('')
    setReviewMedicineOcrRaw(null)
    setMedicineRecognitionStatus('')
    setReviewTags([])
    setReviewPetId(initialPetId && pets.some((pet) => pet.id === initialPetId) ? initialPetId : pets[0]?.id ?? '')
  }

  const beginReviewEdit = (review: HospitalReview) => {
    if (!review.mine) return
    setEditingReviewId(review.id)
    setReviewRating(review.rating)
    setReviewBody(review.body || review.content || '')
    setReviewVisitDate(review.visitDate ?? new Date().toISOString().slice(0, 10))
    setReviewCost(review.cost ? review.cost.toLocaleString('ko-KR') : '')
    setReviewDiagnosis(review.diagnosis ?? '')
    setReviewTreatment(review.treatment ?? '')
    setReviewMedicine(review.medicine ?? '')
    setReviewMedicineStartDate(review.medicineStartDate ?? review.visitDate ?? new Date().toISOString().slice(0, 10))
    setReviewMedicineEndDate(review.medicineEndDate ?? '')
    setReviewMedicineDailyCount(String(review.medicineDailyCount ?? 1))
    setReviewMedicineBagImage(review.medicineBagImage ?? '')
    setReviewMedicineOcrRaw(review.medicineOcrRaw ?? null)
    setMedicineRecognitionStatus(review.medicineBagImage ? '기존 약봉투 사진을 불러왔어요.' : '')
    setReviewTags(review.tags ?? [])
    setReviewPetId(review.petId && pets.some((pet) => pet.id === review.petId) ? review.petId : pets[0]?.id ?? '')
    setIsReviewFormOpen(true)
  }
  void beginReviewEdit

  const submitReview = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!selectedHospital || !reviewPetId || reviewBody.trim().length === 0) return

    const reviewPet = pets.find((pet) => pet.id === reviewPetId)
    const existingReview = editingReviewId ? selectedHospitalReviews.find((item) => item.id === editingReviewId) : null

    const review: HospitalReview = {
      id: editingReviewId ?? reviewDraftPayload?.review.id ?? crypto.randomUUID(),
      hospitalId: selectedHospital.id,
      petId: reviewPetId,
      petName: reviewPet?.name,
      author: profileReviewAuthor,
      animalCategory: selectedReviewAnimalCategory,
      species: selectedReviewSpecies,
      rating: reviewRating,
      visitDate: reviewVisitDate,
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
      await linkReviewToDiary({
        userId,
        reviewId: review.id,
        petId: reviewPetId,
        hospitalName: selectedHospital.name,
        visitDate: reviewVisitDate,
        diagnosis: reviewDiagnosis.trim(),
        treatment: reviewTreatment.trim(),
        medicine: reviewMedicine.trim() ? {
          name: reviewMedicine.trim(),
          startDate: reviewMedicineStartDate || reviewVisitDate,
          endDate: reviewMedicineEndDate || undefined,
          dailyCount: Math.max(1, Number(reviewMedicineDailyCount) || 1),
          ocrRaw: reviewMedicineOcrRaw,
        } : undefined,
      })
    } catch (error) {
      console.error('Review diary link failed.', error)
      setMessage('리뷰는 저장됐지만 다이어리 연결에 실패했어요.')
    }
    resetReviewForm()
    setIsReviewFormOpen(false)
    if (reviewDraft) void onDeleteDraft(reviewDraft.id)
  }

  const saveReviewDraft = () => {
    if (!selectedHospital) return
    const existingReview = editingReviewId ? selectedHospitalReviews.find((item) => item.id === editingReviewId) : null
    const review: HospitalReview = {
      id: editingReviewId ?? reviewDraftPayload?.review.id ?? crypto.randomUUID(),
      hospitalId: selectedHospital.id,
      petId: reviewPetId,
      petName: pets.find((pet) => pet.id === reviewPetId)?.name,
      author: profileReviewAuthor,
      animalCategory: selectedReviewAnimalCategory,
      species: selectedReviewSpecies,
      rating: reviewRating,
      visitDate: reviewVisitDate,
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
    void Promise.resolve(onSaveDraft({
      id: reviewDraft?.id ?? crypto.randomUUID(),
      draftType: 'hospital_review',
      title: selectedHospital.name,
      body: review.body,
      updatedAt: new Date().toISOString(),
      payload: { hospital: toHospitalSnapshot(selectedHospital), review },
    })).then(() => setIsReviewFormOpen(false))
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

  // 리뷰 메뉴가 다시 연결될 때 사용할 핸들러를 보존한다.
  void beginReviewEdit
  void deleteReview

  const beginSheetDrag = (event: { clientY: number; currentTarget: { setPointerCapture?: (pointerId: number) => void }; pointerId: number; stopPropagation: () => void }) => {
    sheetDragStartRef.current = event.clientY
    setSheetDragY(0)
    event.currentTarget.setPointerCapture?.(event.pointerId)
    event.stopPropagation()
  }

  const moveSheetDrag = (event: { clientY: number; preventDefault: () => void }) => {
    if (sheetDragStartRef.current === null) return
    const nextDragY = Math.max(0, event.clientY - sheetDragStartRef.current)
    setSheetDragY(nextDragY)
    if (nextDragY > 0) event.preventDefault()
  }

  const finishSheetDrag = () => {
    const shouldClose = sheetDragY > 72
    sheetDragStartRef.current = null
    setSheetDragY(0)
    if (!shouldClose) return
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
    setSheetDismissed(true)
  }

  const sheetDragHandlers = {
    onPointerDown: beginSheetDrag,
    onPointerMove: moveSheetDrag,
    onPointerUp: finishSheetDrag,
    onPointerCancel: finishSheetDrag,
  }

  const beginReopenDrag = (event: { clientY: number; currentTarget: { setPointerCapture?: (pointerId: number) => void }; pointerId: number; stopPropagation: () => void }) => {
    sheetDragStartRef.current = event.clientY
    setSheetDragY(0)
    event.currentTarget.setPointerCapture?.(event.pointerId)
    event.stopPropagation()
  }

  const moveReopenDrag = (event: { clientY: number; preventDefault: () => void }) => {
    if (sheetDragStartRef.current === null) return
    const nextDragY = Math.min(0, event.clientY - sheetDragStartRef.current)
    setSheetDragY(nextDragY)
    if (nextDragY < 0) event.preventDefault()
  }

  const finishReopenDrag = () => {
    const shouldOpen = sheetDragY < -34
    sheetDragStartRef.current = null
    setSheetDragY(0)
    if (shouldOpen) {
      setSheetDismissed(false)
      setMobileSheetState('expanded')
    }
  }

  const reopenDragHandlers = {
    onPointerDown: beginReopenDrag,
    onPointerMove: moveReopenDrag,
    onPointerUp: finishReopenDrag,
    onPointerCancel: finishReopenDrag,
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
      setSheetDismissed(false)
      setMobileSheetState((state) => state === 'expanded' ? 'expanded' : 'expanded')
    }
    window.addEventListener('map-bottom-nav-swipe-up', openFromBottomNav)
    return () => window.removeEventListener('map-bottom-nav-swipe-up', openFromBottomNav)
  }, [])

  return (
    <section className={`map-page ${selectedHospital ? 'has-selected-hospital' : ''}`}>
      <section className="map-area">
        <div className="map-canvas" ref={mapElementRef}>
          {mapStatus !== 'ready' && (
            <div className="map-load-state">
              <strong>{mapStatus === 'error' ? '지도를 불러오지 못했습니다' : '네이버 지도를 불러오는 중입니다'}</strong>
              {mapStatus === 'error' && <small>네이버 콘솔 Web 서비스 URL에 {window.location.origin} 을 등록해 주세요.</small>}
            </div>
          )}
        </div>
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
            <input value={query} onChange={(event) => { setQuery(event.target.value); setSheetDismissed(false) }} placeholder="지역명, 병원명, 특수동물 병원" />
          </label>
          <button className="map-search-icon-button" type="submit" disabled={isLoading} aria-label="검색">
            <span aria-hidden="true" />
          </button>
          <button className="secondary-button" type="button" disabled={locationStatus === 'loading'} onClick={requestCurrentLocation}>
            <span className="location-button-icon" aria-hidden="true" />
            <span>{locationStatus === 'loading' ? '확인중' : '내 위치'}</span>
          </button>
        </form>

        <div className="map-category-tags" aria-label="동물 분류 필터">
          {animalCategoryOptions.map((category) => (
            <button
              className={(category === 'all' ? selectedCategories.length === 0 : selectedCategories.includes(category)) ? 'active' : ''}
              key={category}
              type="button"
              aria-pressed={category === 'all' ? selectedCategories.length === 0 : selectedCategories.includes(category)}
              onClick={() => {
                if (category === 'all') {
                  setSelectedCategories([])
                } else {
                  setSelectedCategories((current) => current.includes(category) ? current.filter((item) => item !== category) : [...current, category])
                }
                setSelectedHospitalId(null)
              }}
            >
              <CategoryTagIcon category={category} />
              <span>{animalCategoryLabels[category]}</span>
            </button>
          ))}
        </div>

        <div className="map-sort-tabs" aria-label="병원 정렬">
          {([
            ['distance', '가까운 순'],
            ['reviews', '리뷰 많은 순'],
            ['rating', '평점 높은 순'],
          ] as Array<[HospitalSort, string]>).map(([sort, label]) => (
            <button className={selectedSort === sort ? 'active' : ''} type="button" key={sort} onClick={() => setSelectedSort(sort)}>
              {label}
            </button>
          ))}
        </div>

        {!sheetDismissed && (
          <section className={`map-hospital-list mobile-sheet-${mobileSheetState}`} aria-label="검색된 병원" style={{ transform: sheetDragY ? `translateY(${sheetDragY}px)` : undefined }}>
            <span className="map-sheet-handle" aria-hidden="true" {...sheetDragHandlers} />
            <div className="map-side-head">
              <strong>{isLoading ? '병원을 찾는 중' : `병원 ${filteredHospitals.length}곳`}</strong>
              <span>{currentLocation ? '내 위치 기준 가까운 순' : '위치 권한 허용 시 거리순'}</span>
            </div>
            {filteredHospitals.length === 0 ? (
              <p className="map-side-empty">검색 버튼을 누르거나 분류를 바꿔 병원을 찾아보세요.</p>
            ) : (
              filteredHospitals.slice(0, 30).map((hospital) => (
                <HospitalListRow
                  hospital={hospital}
                  key={hospital.id}
                  reviews={reviews[hospital.id] ?? []}
                  active={hospital.id === selectedHospitalId}
                  onSelect={() => { setSelectedHospitalId(hospital.id); setSheetDismissed(false); setMobileSheetState('expanded') }}
                />
              ))
            )}
          </section>
        )}

        {!selectedHospital && sheetDismissed && filteredHospitals.length > 0 && (
          <button
            className="map-sheet-reopen"
            type="button"
            aria-label="병원 목록을 위로 끌어올려 열기"
            style={{ transform: `translateX(50%)${sheetDragY ? ` translateY(${sheetDragY}px)` : ''}` }}
            {...reopenDragHandlers}
          >
            <span aria-hidden="true" />
            병원 {filteredHospitals.length}곳
          </button>
        )}

      </aside>

      {selectedHospital && (
        <article className={`map-hospital-panel map-detail-dock mobile-sheet-${mobileSheetState}`} style={{ transform: sheetDragY ? `translateY(${sheetDragY}px)` : undefined }}>
            <span className="map-sheet-handle" aria-hidden="true" {...sheetDragHandlers} />
            <button className="panel-close" type="button" aria-label="닫기" onClick={() => setSelectedHospitalId(null)} />
            <div className="hospital-card-main">
              <CategoryTagIcon category={selectedHospital.categories[0] ?? 'all'} />
              <div>
                <strong>{selectedHospital.name}</strong>
                <p><span className="meta-icon location" aria-hidden="true" />{selectedHospital.address || '주소 정보 없음'}</p>
                <small><span className="meta-icon distance" aria-hidden="true" />{selectedHospital.distanceKm === undefined ? '내 위치 기준 거리 계산 전' : `내 위치에서 ${selectedHospital.distanceKm.toFixed(1)}km`}</small>
                <small><span className="meta-icon species" aria-hidden="true" />최근 진료종 {selectedHospitalRecentSpecies || '리뷰 데이터 없음'}</small>
                <small><span className="meta-icon review" aria-hidden="true" />리뷰 {selectedHospitalSummary.count}개</small>
              </div>
            </div>
            <div className="hospital-tags">
              {selectedHospital.categories.map((category) => <span key={category}>{animalCategoryLabels[category]}</span>)}
            </div>
            <div className="hospital-actions">
              <button type="button" onClick={() => toggleSavedHospital(selectedHospital)}>
                {savedHospitalIds.includes(selectedHospital.id) ? '좋아요 취소' : '좋아요'}
              </button>
              <button type="button" onClick={() => { if (editingReviewId || isReviewFormOpen) { resetReviewForm(); setIsReviewFormOpen(false); return } resetReviewForm(); setIsReviewFormOpen(true) }}>
                {editingReviewId ? '수정 취소' : '리뷰 작성'}
              </button>
              {selectedHospital.phone && <a href={`tel:${selectedHospital.phone}`}>전화하기</a>}
            </div>
            <section className="hospital-review-panel">
              <div className="review-panel-head">
                <div><strong>리뷰</strong><span>{selectedHospitalSummary.count === 0 ? '아직 리뷰가 없습니다' : `${selectedHospitalSummary.average.toFixed(1)}점 · ${selectedHospitalSummary.count}개`}</span></div>
              </div>
              <HospitalReviewSummary reviews={selectedHospitalReviews} />
              {isReviewFormOpen && (
                <HospitalReviewForm
                  rating={reviewRating}
                  body={reviewBody}
                  visitDate={reviewVisitDate}
                  cost={reviewCost}
                  diagnosis={reviewDiagnosis}
                  treatment={reviewTreatment}
                  medicine={reviewMedicine}
                  pets={pets.map((pet) => ({ id: pet.id, name: pet.name, group: pet.group, species: pet.species }))}
                  selectedPetId={reviewPetId}
                  medicineStartDate={reviewMedicineStartDate}
                  medicineEndDate={reviewMedicineEndDate}
                  medicineDailyCount={reviewMedicineDailyCount}
                  medicineBagImage={reviewMedicineBagImage}
                  medicineRecognitionStatus={medicineRecognitionStatus}
                  selectedTags={reviewTags}
                  canSubmit={Boolean(reviewPetId) && reviewBody.trim().length > 0 && reviewVisitDate.trim().length > 0 && reviewRating >= 1}
                  submitLabel={editingReviewId ? '수정 완료' : '등록'}
                  onRatingChange={setReviewRating}
                  onBodyChange={setReviewBody}
                  onVisitDateChange={setReviewVisitDate}
                  onCostChange={setReviewCost}
                  onDiagnosisChange={setReviewDiagnosis}
                  onTreatmentChange={setReviewTreatment}
                  onMedicineChange={setReviewMedicine}
                  onPetChange={setReviewPetId}
                  onMedicineStartDateChange={setReviewMedicineStartDate}
                  onMedicineEndDateChange={setReviewMedicineEndDate}
                  onMedicineDailyCountChange={setReviewMedicineDailyCount}
                  onMedicineBagChange={recognizeMedicineBag}
                  onToggleTag={toggleReviewTag}
                  onSaveDraft={saveReviewDraft}
                  onSubmit={submitReview}
                />
              )}
              {selectedHospitalReviews.length === 0 ? (
                <p className="review-empty">아직 리뷰가 없습니다. 리뷰 작성 버튼으로 첫 경험을 남겨주세요.</p>
              ) : (
                <div className="review-list">
                  {selectedHospitalReviews.map((review) => (
                    <HospitalReviewItem
                      review={review}
                      fallbackAuthor={profileReviewAuthor}
                      key={review.id}
                      onDelete={() => deleteReview(selectedHospital.id, review.id)}
                      onEdit={() => beginReviewEdit(review)}
                      onToggleLike={() => toggleReviewLike(selectedHospital.id, review.id)}
                    />
                  ))}
                </div>
              )}
            </section>
          </article>
        )}
    </section>
  )
}

function HospitalListRow({ hospital, reviews, active, onSelect }: { hospital: Hospital; reviews: HospitalReview[]; active: boolean; onSelect: () => void }) {
  const summary = getReviewSummary(reviews)
  const recentSpecies = getRecentSpecies(reviews)

  return (
    <article className={`map-hospital-row ${active ? 'active' : ''}`}>
      <button className="map-hospital-row-main" type="button" onClick={onSelect}>
        <CategoryTagIcon category={hospital.categories[0] ?? 'all'} />
        <span>
          <strong>{hospital.name}</strong>
          <small>{hospital.distanceKm === undefined ? '거리 계산 전' : `${hospital.distanceKm.toFixed(1)}km`} · {hospital.address || '주소 정보 없음'}</small>
          {summary.count > 0 && <small>{`${summary.average.toFixed(1)}점 · 리뷰 ${summary.count}개`}{recentSpecies ? ` · 최근 ${recentSpecies}` : ''}</small>}
        </span>
      </button>
    </article>
  )
}

function HospitalReviewSummary({ reviews }: { reviews: HospitalReview[] }) {
  const summary = getReviewSummary(reviews)
  if (summary.count === 0) return <div className="review-summary-empty">아직 쌓인 리뷰 통계가 없습니다.</div>

  return (
    <div className="review-summary">
      <div className="review-summary-score">
        <strong>{summary.average.toFixed(1)}</strong>
        <span>리뷰 {summary.count}개</span>
      </div>
      <div className="review-score-bars">
        {[5, 4, 3, 2, 1].map((rating) => (
          <div key={rating}>
            <span>{rating}점</span>
            <i><b style={{ width: `${summary.count ? (summary.distribution[rating] / summary.count) * 100 : 0}%` }} /></i>
          </div>
        ))}
      </div>
      {summary.topTags.length > 0 && <div className="review-summary-tags">{summary.topTags.map((tag) => <span key={tag}>{tag}</span>)}</div>}
      {summary.topAnimal && <p>가장 많이 방문한 분류: {animalCategoryLabels[summary.topAnimal]}</p>}
    </div>
  )
}

function HospitalReviewItem({ review, fallbackAuthor, onDelete, onEdit, onToggleLike }: { review: HospitalReview; fallbackAuthor: string; onDelete: () => void; onEdit: () => void; onToggleLike: () => void }) {
  const authorName = review.author && review.author !== '익명' ? review.author : fallbackAuthor
  const body = review.body || review.content || ''

  return (
    <article className="review-item">
      <div>
        <strong>{authorName}</strong>
        <span>{'★'.repeat(Math.max(0, Math.min(5, review.rating)))}{'☆'.repeat(Math.max(0, 5 - Math.min(5, review.rating)))}</span>
      </div>
      <small>{review.petName || review.species || '반려동물 정보 없음'}{review.visitDate ? ` · ${formatReviewDate(review.visitDate)}` : ''}{review.cost ? ` · ${review.cost.toLocaleString('ko-KR')}원` : ''}</small>
      {review.tags && review.tags.length > 0 && <div className="review-item-tags">{review.tags.map((tag) => <span key={tag}>{tag}</span>)}</div>}
      {body && <p>{body}</p>}
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

function DiaryTimelineSkeleton() { return <div className="qna-diary-skeleton" aria-label="기록 불러오는 중" /> }
function DiaryTimelineAttachment({ snapshot, mode, onRemove }: { snapshot: AttachedDiarySnapshot; mode: 'draft' | 'posted'; onRemove?: () => void }) { return <section className="qna-diary-attachment"><strong>{snapshot.petName} 기록 {snapshot.totalCount}개</strong><span>{snapshot.startDate} - {snapshot.endDate}</span>{mode === 'draft' && onRemove && <button type="button" onClick={onRemove}>제거</button>}</section> }
function RecordAttachCard({ record, mode, onRemove, onOpen }: { record: AttachedRecordSnapshot; mode: 'draft' | 'posted'; onRemove?: () => void; onOpen?: () => void }) { return <article className="qna-record-attachment"><strong>{record.recordTypeLabel}</strong><span>{record.petName} · {record.recordDate}</span><p>{record.summary}</p>{onOpen && <button type="button" onClick={onOpen}>기록 보기</button>}{mode === 'draft' && onRemove && <button type="button" onClick={onRemove}>제거</button>}</article> }
function HospitalAttachCard({ hospital, mode, onRemove, onOpen }: { hospital: HospitalSnapshot; mode: 'draft' | 'posted'; onRemove?: () => void; onOpen?: () => void }) { return <article className="qna-hospital-attachment"><strong>{hospital.name}</strong><span>{hospital.address}</span>{onOpen && <button type="button" onClick={onOpen}>병원 보기</button>}{mode === 'draft' && onRemove && <button type="button" onClick={onRemove}>제거</button>}</article> }
function HospitalPicker({ onClose }: { onClose: () => void; onSelect: (hospital: Hospital) => void }) { return <div className="hospital-picker-overlay"><section className="hospital-picker" role="dialog" aria-modal="true"><strong>병원 선택</strong><p>지도에서 병원을 선택한 뒤 첨부할 수 있어요.</p><button type="button" onClick={onClose}>닫기</button></section></div> }
function StepText({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (value: string) => void; placeholder: string }) { return <label className="step-field"><span>{label}</span><input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} /></label> }
function StepDate({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) { return <label className="step-field"><span>{label}</span><input type="date" value={value} onChange={(event) => onChange(event.target.value)} /></label> }

function QnaScreen({ userId, profile, posts, openPostId, onOpenHandled, onChange, onDeletePost, onEditPost, onCreate, onOpenHospital, onOpenDiary }: { userId: string; profile: AppProfile; posts: QnaPost[]; openPostId?: string | null; onOpenHandled?: () => void; onChange: (posts: QnaPost[]) => void; onDeletePost: (postId: string) => void; onEditPost: (post: QnaPost) => void; onCreate: (petId?: string | null) => void; onOpenHospital: (hospital: HospitalSnapshot) => void; onOpenDiary: (petId: string, readOnly: boolean) => void }) {
  const displayAuthor = profile.nickname.trim() || profile.username.trim() || '사용자'
  const qnaUrl = new URLSearchParams(window.location.search)
  const [sort, setSort] = useState<QnaSort>(() => parseQnaSort(qnaUrl.get('sort')))
  const [sortSheetOpen, setSortSheetOpen] = useState(false)
  const [statusFilter, setStatusFilter] = useState<QnaListStatus>(() => parseQnaStatus(qnaUrl.get('status')))
  const [categoryFilter, setCategoryFilter] = useState<QnaCategory | 'all'>(() => parseQnaCategory(qnaUrl.get('category')))
  const [visibleCount, setVisibleCount] = useState(6)
  const [searchInput, setSearchInput] = useState(qnaUrl.get('q') ?? '')
  const [query, setQuery] = useState(qnaUrl.get('q') ?? '')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [comment, setComment] = useState('')
  const [attachedHospital, setAttachedHospital] = useState<HospitalSnapshot | null>(null)
  const [hospitalPickerOpen, setHospitalPickerOpen] = useState(false)
  const [commentsByPost, setCommentsByPost] = useState<Record<string, QnaComment[]>>({})
  const [commentMenuId, setCommentMenuId] = useState<string | null>(null)
  const previousSelectedIdRef = useRef<string | null>(null)
  const selected = posts.find((post) => post.id === selectedId)
  const selectedComments = selected ? commentsByPost[selected.id] ?? selected.comments : []
  useEffect(() => {
    let active = true
    supabase.from('post_comments').select('id, post_id, user_id, body, created_at, payload').then(({ data, error }) => {
      if (!active || error) return
      const grouped: Record<string, QnaComment[]> = {}
      for (const row of data ?? []) {
        const payload = (row.payload ?? {}) as { author?: string; hospitalSnapshot?: HospitalSnapshot }
        const mine = row.user_id === userId
        const author = payload.author && payload.author !== '작성자' ? payload.author : mine ? displayAuthor : '사용자'
        const item: QnaComment = { id: row.id, author, body: row.body, createdAt: row.created_at, mine, hospitalSnapshot: payload.hospitalSnapshot }
        grouped[row.post_id] = [...(grouped[row.post_id] ?? []), item]
      }
      setCommentsByPost(grouped)
    })
    return () => { active = false }
  }, [displayAuthor, posts.length, userId])
  useEffect(() => {
    if (!openPostId) return
    // This effect consumes a profile deep-link into the selected post.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSelectedId(openPostId)
    onOpenHandled?.()
  }, [openPostId, onOpenHandled])
  useEffect(() => {
    const timer = window.setTimeout(() => setQuery(searchInput), 250)
    return () => window.clearTimeout(timer)
  }, [searchInput])
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    params.set('tab', 'qna')
    params.set('sort', sort)
    params.set('status', statusFilter)
    params.set('category', categoryFilter)
    if (searchInput.trim()) params.set('q', searchInput.trim())
    else params.delete('q')
    window.history.replaceState(window.history.state, '', `${window.location.pathname}?${params.toString()}${window.location.hash}`)
  }, [categoryFilter, searchInput, sort, statusFilter])
  useEffect(() => {
    if (selectedId) {
      if (previousSelectedIdRef.current !== selectedId) {
        window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
        const appMain = document.querySelector('.app-main')
        if (appMain instanceof HTMLElement) appMain.scrollTop = 0
        const viewedKey = `qna_viewed_${selectedId}`
        if (!sessionStorage.getItem(viewedKey)) {
          sessionStorage.setItem(viewedKey, '1')
          void supabase.rpc(['increment', 'comm' + 'unity', 'post', 'view'].join('_'), { p_post_id: selectedId })
          onChange(posts.map((post) => post.id === selectedId ? { ...post, viewCount: (post.viewCount ?? 0) + 1 } : post))
        }
        previousSelectedIdRef.current = selectedId
      }
      return
    }
    if (previousSelectedIdRef.current) {
      const savedScroll = Number(sessionStorage.getItem(`qna_scroll_${userId}`) ?? 0)
      window.setTimeout(() => window.scrollTo({ top: savedScroll, left: 0, behavior: 'auto' }), 0)
      previousSelectedIdRef.current = null
    }
  }, [onChange, posts, selectedId, userId])
  const searchedPosts = posts.filter((post) => {
    const text = `${post.title} ${post.body} ${post.author} ${post.animalGroup ?? ''} ${post.animalSpecies ?? post.animal}`.toLowerCase()
    return text.includes(query.trim().toLowerCase())
  })
  const getCommentCount = (post: QnaPost) => Math.max(post.comments.length, commentsByPost[post.id]?.length ?? 0)
  const scopedPosts = searchedPosts.filter((post) => {
    const matchesCategory = categoryFilter === 'all' || normalizeQnaCategory(post.category) === categoryFilter
    const listStatus = qnaListStatus(post, getCommentCount(post))
    const matchesStatus = statusFilter === 'all' || listStatus === statusFilter
    return matchesCategory && matchesStatus
  })
  const feedPosts = sortQnaPosts(scopedPosts, sort, getCommentCount)
  const visiblePosts = feedPosts.slice(0, visibleCount)

  const updatePost = (post: QnaPost) => onChange(posts.map((item) => item.id === post.id ? post : item))
  const toggleLike = (post: QnaPost) => updatePost({ ...post, liked: !post.liked, likes: Math.max(0, post.likes + (post.liked ? -1 : 1)) })
  const toggleStatus = (post: QnaPost) => updatePost({ ...post, status: qnaStatus(post) === 'resolved' ? 'unresolved' : 'resolved' })
  const selectAnswer = (post: QnaPost, commentId: string) => updatePost(post.selectedAnswerCommentId === commentId ? { ...post, status: 'unresolved', selectedAnswerCommentId: undefined } : { ...post, status: 'resolved', selectedAnswerCommentId: commentId })
  const addComment = async (event: FormEvent) => {
    event.preventDefault()
    if (!selected || !comment.trim()) return
    const newComment: QnaComment = { id: crypto.randomUUID(), author: displayAuthor, body: comment.trim(), createdAt: new Date().toISOString(), mine: true, hospitalSnapshot: attachedHospital ?? undefined }
    const { error } = await supabase.from('post_comments').insert({ id: newComment.id, post_id: selected.id, user_id: userId, body: newComment.body, payload: { author: newComment.author, hospitalSnapshot: newComment.hospitalSnapshot ?? null } })
    if (error) return
    setCommentsByPost((items) => ({ ...items, [selected.id]: [...(items[selected.id] ?? selected.comments), newComment] }))
    setComment('')
    setAttachedHospital(null)
  }

  if (selected) {
    const sortedComments = [...selectedComments].sort((a, b) => (a.id === selected.selectedAnswerCommentId ? -1 : 0) - (b.id === selected.selectedAnswerCommentId ? -1 : 0))
    return (
      <section className="qna-detail">
        <header className="qna-detail-header">
          <button className="qna-back" type="button" aria-label="뒤로가기" onClick={() => setSelectedId(null)}>←</button>
          <strong>Q&A</strong>
          {selected.mine === true && <QnaOwnerMenu post={selected} onEdit={() => onEditPost(selected)} onToggleResolve={() => toggleStatus(selected)} onDelete={() => { if (window.confirm(`‘${selected.title || '제목 없는 질문'}’ 질문을 삭제할까요?`)) { onDeletePost(selected.id); setSelectedId(null) } }} />}
        </header>
        <article className="qna-detail-post">
          <div className="qna-detail-badges"><span className="qna-category">{normalizeQnaCategory(selected.category)}</span><span className={`qna-status ${qnaStatus(selected)}`}>{qnaStatusLabel(qnaStatus(selected))}</span></div>
          <h2>{selected.title}</h2>
          <div className="qna-author"><UserAvatar url={selected.authorAvatarUrl || (selected.mine === true ? profile.avatarUrl : '')} name={qnaDisplayAuthor(selected.author, selected.mine === true, displayAuthor)} /><div><strong>{qnaDisplayAuthor(selected.author, selected.mine === true, displayAuthor)}</strong><span>{formatQnaAnimal(selected)} · {formatQnaDate(selected.createdAt)}</span></div></div>
          {selected.image && <img src={selected.image} alt="" />}
          {selected.attachedDiarySnapshot && <DiaryTimelineAttachment snapshot={selected.attachedDiarySnapshot} mode="posted" />}
          {!selected.attachedDiarySnapshot && selected.attachedRecordSnapshot && <RecordAttachCard record={selected.attachedRecordSnapshot} mode="posted" onOpen={() => onOpenDiary(selected.attachedRecordSnapshot!.petId, selected.mine !== true)} />}
          <p>{selected.body}</p>
          <div className="qna-detail-actions">
            <button className={`qna-like ${selected.liked ? 'active' : ''}`} type="button" onClick={() => toggleLike(selected)}>♡ {selected.likes}</button>
            {selected.mine === true && <button className="qna-status-toggle" type="button" onClick={() => toggleStatus(selected)}>{qnaStatus(selected) === 'resolved' ? '다시 답변 필요' : '해결 완료'}</button>}
          </div>
        </article>
        <section className="qna-comments">
          <h3>댓글 {selectedComments.length}</h3>
          {sortedComments.map((item) => (
            <article className={selected.selectedAnswerCommentId === item.id ? 'accepted' : ''} key={item.id}>
              <div className="qna-comment-head"><span><strong>{item.author}</strong><time>{formatQnaDate(item.createdAt)}</time></span>{item.mine && <div className="qna-comment-menu"><button type="button" aria-label="댓글 관리 메뉴" aria-expanded={commentMenuId === item.id} onClick={() => setCommentMenuId(commentMenuId === item.id ? null : item.id)}>⋮</button>{commentMenuId === item.id && <div><button type="button" onClick={async () => { await supabase.from('post_comments').delete().eq('id', item.id).eq('user_id', userId); setCommentsByPost((items) => ({ ...items, [selected.id]: (items[selected.id] ?? []).filter((commentItem) => commentItem.id !== item.id) })); setCommentMenuId(null) }}>댓글 삭제</button></div>}</div>}</div>
              {selected.selectedAnswerCommentId === item.id && <span className="accepted-answer-chip">채택 답변</span>}
              {item.body && <p>{item.body}</p>}
              {item.hospitalSnapshot && <HospitalAttachCard hospital={item.hospitalSnapshot} mode="posted" onOpen={() => onOpenHospital(item.hospitalSnapshot!)} />}
              {selected.mine === true && <button className="qna-accept-button" type="button" onClick={() => selectAnswer(selected, item.id)}>{selected.selectedAnswerCommentId === item.id ? '채택 취소' : '답변 채택'}</button>}
            </article>
          ))}
          <form onSubmit={addComment}>
            {attachedHospital && <HospitalAttachCard hospital={attachedHospital} mode="draft" onRemove={() => setAttachedHospital(null)} />}
            <div className="qna-comment-tools">
              <button type="button" onClick={() => setHospitalPickerOpen(true)}>병원 첨부</button>
            </div>
            <div className="qna-comment-input-row">
              <input value={comment} onChange={(event) => setComment(event.target.value)} placeholder="댓글을 입력하세요" aria-label="댓글" />
              <button type="submit" disabled={!comment.trim()}>등록</button>
            </div>
          </form>
        </section>
        {hospitalPickerOpen && <HospitalPicker onClose={() => setHospitalPickerOpen(false)} onSelect={(hospital) => { setAttachedHospital(toHospitalSnapshot(hospital)); setHospitalPickerOpen(false) }} />}
      </section>
    )
  }

  return (
    <section className="qna-feed-page">
      <header className="qna-feed-head">
        <div>
          <h2>Q&A</h2>
          <p>특수동물의 문제를 기록과 함께 질문해 보세요.</p>
        </div>
        <button className="qna-create-button" type="button" onClick={() => onCreate()}>질문 작성</button>
      </header>
      <label className="qna-feed-search"><span aria-hidden="true">⌕</span><input aria-label="Q&A 검색" value={searchInput} onChange={(event) => { setSearchInput(event.target.value); setVisibleCount(6) }} placeholder="질문이나 동물 종으로 검색" />{searchInput && <button type="button" aria-label="검색어 지우기" onClick={() => { setSearchInput(''); setQuery(''); setVisibleCount(6) }}>×</button>}</label>
      <div className="qna-filter-bar" aria-label="Q&A 필터">
        <div className="qna-filter-row" aria-label="답변 상태">
          {([['all', '전체'], ['waiting', '답변 대기'], ['resolved', '해결 완료']] as const).map(([value, label]) => <button key={value} type="button" aria-pressed={statusFilter === value} className={statusFilter === value ? 'active' : ''} onClick={() => { setStatusFilter(value); setVisibleCount(6) }}>{label}</button>)}
        </div>
        <div className="qna-filter-row" aria-label="질문 카테고리">
          <button type="button" aria-pressed={categoryFilter === 'all'} className={categoryFilter === 'all' ? 'active' : ''} onClick={() => { setCategoryFilter('all'); setVisibleCount(6) }}>전체 카테고리</button>
          {qnaCategoryCards.map((categoryItem) => <button key={categoryItem} type="button" aria-pressed={categoryFilter === categoryItem} className={categoryFilter === categoryItem ? 'active' : ''} onClick={() => { setCategoryFilter(categoryItem); setVisibleCount(6) }}>{categoryItem}</button>)}
        </div>
        <button className="qna-feed-sort-trigger" type="button" aria-label="정렬 선택" onClick={() => setSortSheetOpen(true)}>{qnaSortLabel(sort)}⌄</button>
      </div>
      {feedPosts.length === 0 ? <div className="qna-empty-state">
        <div className="qna-empty-icon" aria-hidden="true">⌕</div>
        <strong>{query ? '검색 결과가 없습니다.' : statusFilter !== 'all' || categoryFilter !== 'all' ? '선택한 조건에 맞는 질문이 없습니다.' : '아직 등록된 질문이 없습니다.'}</strong>
        {(query || statusFilter !== 'all' || categoryFilter !== 'all') && <button type="button" onClick={() => { setSearchInput(''); setQuery(''); setStatusFilter('all'); setCategoryFilter('all'); setVisibleCount(6) }}>필터 초기화</button>}
      </div> : (
        <section className="qna-feed-section">
          <div className="qna-feed-list">
                {visiblePosts.map((post) => <QnaHelpCard post={post} authorName={qnaDisplayAuthor(post.author, post.mine === true, displayAuthor)} commentCount={getCommentCount(post)} fallbackAvatarUrl={post.mine === true ? profile.avatarUrl : ''} key={post.id} onOpen={() => { sessionStorage.setItem(`qna_scroll_${userId}`, String(window.scrollY)); setSelectedId(post.id) }} onEdit={post.mine === true ? () => onEditPost(post) : undefined} onToggleResolve={post.mine === true ? () => updatePost({ ...post, status: qnaStatus(post) === 'resolved' ? 'unresolved' : 'resolved' }) : undefined} onDelete={post.mine === true ? () => { if (window.confirm(`‘${post.title || '제목 없는 질문'}’ 질문을 삭제할까요?`)) void onDeletePost(post.id) } : undefined} />)}
          </div>
          {visiblePosts.length < feedPosts.length && <button className="qna-load-more" type="button" onClick={() => setVisibleCount((count) => count + 6)}>더보기</button>}
        </section>
      )}
      {sortSheetOpen && <QnaSortSheet value={sort} onChange={(value) => { setSort(value); setVisibleCount(6); setSortSheetOpen(false) }} onClose={() => setSortSheetOpen(false)} />}
      <button className="qna-mobile-fab" type="button" aria-label="질문 작성" onClick={() => onCreate()}>+</button>
    </section>
  )
}

function QnaHelpCard({ post, authorName, commentCount, fallbackAvatarUrl, onOpen, onEdit, onToggleResolve, onDelete }: { post: QnaPost; authorName: string; commentCount: number; fallbackAvatarUrl?: string; onOpen: () => void; onEdit?: () => void; onToggleResolve?: () => void; onDelete?: () => void }) {
  const record = post.attachedRecordSnapshot
  const diary = post.attachedDiarySnapshot
  const recordTypeCounts = diary ? Object.entries(diary.records.reduce<Record<string, number>>((counts, item) => {
    counts[item.type] = (counts[item.type] ?? 0) + 1
    return counts
  }, {})) : []
  const maxRecordTypeCount = Math.max(1, ...recordTypeCounts.map(([, count]) => count))
  const [menuOpen, setMenuOpen] = useState(false)
  const title = post.title.trim() || '제목 없는 질문'
  const body = post.body.trim()
  return (
    <article className={`qna-help-card ${qnaListStatus(post, commentCount)}`} role="button" tabIndex={0} aria-label={`${title} 상세 보기`} onClick={onOpen} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onOpen() } }}>
      <div className="qna-help-card-top">
        <span className={`qna-status ${qnaListStatus(post, commentCount)}`}>{qnaListStatusLabel(qnaListStatus(post, commentCount))}</span>
        <span className="qna-category">{normalizeQnaCategory(post.category)}</span>
        {(onEdit || onToggleResolve || onDelete) && <div className="qna-card-menu">
          <button className="qna-card-menu-trigger" type="button" aria-label="질문 관리 메뉴" aria-expanded={menuOpen} onClick={(event) => { event.stopPropagation(); setMenuOpen((value) => !value) }}>⋮</button>
          {menuOpen && <div className="qna-card-menu-popover" onClick={(event) => event.stopPropagation()}>
            {onEdit && <button type="button" onClick={() => { setMenuOpen(false); onEdit() }}>질문 수정</button>}
            {onToggleResolve && <button type="button" onClick={() => { setMenuOpen(false); onToggleResolve() }}>{qnaStatus(post) === 'resolved' ? '해결 취소' : '해결 완료'}</button>}
            {onDelete && <button className="danger" type="button" onClick={() => { setMenuOpen(false); onDelete() }}>질문 삭제</button>}
          </div>}
        </div>}
      </div>
      <div className="qna-card-main">
        <div className="qna-card-copy">
          <h3>{title}</h3>
          {body && <p className="qna-help-card-preview">{body}</p>}
          {formatQnaAnimal(post) !== '동물 X' && <p className="qna-help-card-animal">{formatQnaAnimal(post)}</p>}
        </div>
        {(post.image || diary || record) && <div className="qna-card-media" aria-label={post.image ? '첨부 사진 미리보기' : '첨부 기록 시각화 미리보기'}>
          {post.image ? <img src={post.image} alt="첨부 사진 미리보기" /> : <div className="qna-card-visualization" aria-hidden="true">
            <span>{diary ? '기록' : record?.recordTypeLabel}</span>
            {diary ? recordTypeCounts.slice(0, 4).map(([type, count]) => <i key={type} style={{ height: `${Math.max(18, (count / maxRecordTypeCount) * 52)}%` }} />) : <i style={{ height: '58%' }} />}
          </div>}
        </div>}
      </div>
      <footer>
        <div className="qna-card-author-meta"><span className="post-author"><UserAvatar url={post.authorAvatarUrl || fallbackAvatarUrl} name={authorName} />{authorName}</span><span>· {formatQnaDate(post.createdAt)}</span></div>
        <div className="qna-card-stats"><span>조회 {post.viewCount ?? 0}</span><span>댓글 {commentCount}</span></div>
      </footer>
      {(post.image || record || diary) && <div className="qna-attachment-summary"><span>{diary ? `기록 ${diary.totalCount}개` : record ? '기록 1개' : ''}{diary && diary.records.length > 0 ? ` · ${[...new Set(diary.records.map((item) => recordTypeLabels[item.type]))].slice(0, 3).join(', ')}` : record ? ` · ${record.recordTypeLabel}` : ''}</span>{post.image && <span>사진 1장</span>}</div>}
    </article>
  )
}


function QnaSortSheet({ value, onChange, onClose }: { value: QnaSort; onChange: (value: QnaSort) => void; onClose: () => void }) {
  const options: QnaSort[] = ['latest', 'popular', 'views', 'comments']
  return (
    <div className="qna-sort-sheet-overlay">
      <button className="qna-sort-sheet-dim" type="button" aria-label="정렬 닫기" onClick={onClose} />
      <section className="qna-sort-sheet" role="dialog" aria-modal="true" aria-label="Q&A 정렬">
        <span className="hospital-picker-handle" aria-hidden="true" />
        <h3>정렬</h3>
        {options.map((option) => <button className={value === option ? 'active' : ''} type="button" key={option} onClick={() => onChange(option)}>{qnaSortLabel(option)}</button>)}
      </section>
    </div>
  )
}

function UserAvatar({ url, name }: { url?: string; name: string }) {
  if (url) return <img className="user-avatar" src={url} alt="" />
  return <span className="user-avatar user-avatar-fallback" aria-hidden="true">{name.trim().slice(0, 1) || '?'}</span>
}

function PetCreateFlow({ initialPet, initialDraft, onClose, onSave, onOpenPlan, onSaveDraft }: { initialPet: Pet | null; initialDraft?: DraftItem | null; onClose: () => void; onSave: (pet: Pet) => void | Promise<void>; onOpenPlan: (petId: string) => void; onSaveDraft: (draft: DraftItem) => void | Promise<void> }) {
  const [step, setStep] = useState(0)
  const [completedPet, setCompletedPet] = useState<Pet | null>(null)
  const [name, setName] = useState(initialPet?.name ?? '')
  const [group, setGroup] = useState<Exclude<AnimalCategory, 'all'> | ''>(initialPet?.group === 'all' || !initialPet?.group ? '' : initialPet.group)
  const [speciesOption, setSpeciesOption] = useState(() => {
    if (!initialPet?.species || !initialPet.group || initialPet.group === 'all') return ''
    return petSpeciesOptions[initialPet.group].includes(initialPet.species) ? initialPet.species : '직접 입력'
  })
  const [customSpecies, setCustomSpecies] = useState(() => {
    if (!initialPet?.species || !initialPet.group || initialPet.group === 'all') return ''
    return petSpeciesOptions[initialPet.group].includes(initialPet.species) ? '' : initialPet.species
  })
  const [speciesQuery, setSpeciesQuery] = useState('')
  const [gender, setGender] = useState<Pet['gender'] | ''>(initialPet?.gender ?? '')
  const [photo, setPhoto] = useState<string | undefined>(initialPet?.photo)
  const [weight, setWeight] = useState(initialPet?.weight ?? '')
  const [weightUnit, setWeightUnit] = useState<'g' | 'kg'>(initialPet?.weightUnit ?? 'g')
  const [birthday, setBirthday] = useState(initialPet?.birthday ?? '')
  const [adoptionDate, setAdoptionDate] = useState(initialPet?.adoptionDate ?? '')
  const isEditing = Boolean(initialPet)
  const normalizedName = name.trim().slice(0, 24)
  const resolvedSpecies = (speciesOption === '직접 입력' || group === 'other') ? customSpecies.trim().slice(0, 32) : speciesOption
  const customSpeciesValid = resolvedSpecies.length > 0 && /[0-9A-Za-z가-힣]/.test(resolvedSpecies)
  const canNext = step === 0 ? normalizedName.length > 0 : step === 1 ? Boolean(group) : step === 2 ? Boolean(resolvedSpecies && (speciesOption !== '직접 입력' || customSpeciesValid)) : true
  const speciesChoices = group ? petSpeciesOptions[group].filter((item) => item !== '직접 입력').filter((item) => item.toLowerCase().includes(speciesQuery.trim().toLowerCase())) : []
  const finishRequired = async () => {
    if (!group || !resolvedSpecies || !normalizedName) return
    const pet: Pet = { id: initialPet?.id ?? crypto.randomUUID(), name: normalizedName, group, species: resolvedSpecies, gender: gender || 'unknown', photo, weight: weight.trim() || undefined, weightUnit, birthday: birthday || undefined, adoptionDate: adoptionDate || undefined, registeredAt: initialPet?.registeredAt ?? new Date().toISOString() }
    await onSave(pet)
    setCompletedPet(pet)
  }
  const saveDraft = () => {
    const pet: Pet = {
      id: initialPet?.id ?? crypto.randomUUID(),
      name: normalizedName,
      group: group || 'other',
      species: resolvedSpecies,
      gender: gender || 'unknown',
      photo,
      weight: weight.trim() || undefined,
      weightUnit,
      birthday: birthday || undefined,
      adoptionDate: adoptionDate || undefined,
    }
    onSaveDraft({
      id: initialDraft?.id ?? crypto.randomUUID(),
      draftType: 'pet',
      title: pet.name || '마이펫 초안',
      body: [animalCategoryLabels[pet.group], pet.species].filter(Boolean).join(' · '),
      updatedAt: new Date().toISOString(),
      step,
      payload: pet,
    })
  }
  const attachPhoto = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => setPhoto(typeof reader.result === 'string' ? reader.result : undefined)
    reader.readAsDataURL(file)
  }

  if (completedPet) {
    const completedWithDetails = { ...completedPet, photo, weight: weight.trim() || undefined, weightUnit, birthday: birthday || undefined, adoptionDate: adoptionDate || undefined }
    const hasAdditionalDetails = Boolean(photo || weight.trim() || birthday || adoptionDate)
    return (
      <main className="pet-complete-screen">
        <section className="pet-complete-card">
          <div className="pet-complete-mark">✓</div>
          <h1>{completedPet.name}가 등록되었어요.</h1>
          <p>반복 루틴을 한 번 설정하면 다이어리에서 체크만으로 관리할 수 있어요.</p>
          <div className="pet-complete-summary">
            <div className="pet-card-icon">{completedWithDetails.photo ? <img src={completedWithDetails.photo} alt={`${completedPet.name} 사진`} /> : <CategoryTagIcon category={completedPet.group} />}</div>
            <strong>{completedPet.name}</strong>
            <span>{completedPet.species} · {animalCategoryLabels[completedPet.group]}</span>
          </div>
          <div className="pet-complete-actions"><button type="button" onClick={onClose}>나중에 하기</button><button className="step-primary" type="button" onClick={async () => { if (hasAdditionalDetails) await onSave(completedWithDetails); onOpenPlan(completedPet.id) }}>첫 루틴 만들기</button></div>
        </section>
      </main>
    )
  }
  const finishEdit = async () => {
    if (!group || !resolvedSpecies || !normalizedName) return
    await onSave({ id: initialPet?.id ?? crypto.randomUUID(), name: normalizedName, group, species: resolvedSpecies, gender: gender || 'unknown', photo, weight: weight.trim() || undefined, weightUnit, birthday: birthday || undefined, adoptionDate: adoptionDate || undefined, registeredAt: initialPet?.registeredAt ?? new Date().toISOString() })
    onClose()
  }

  return (
    <StepShell title={isEditing ? '펫 수정' : '펫 등록'} onBack={step === 0 ? onClose : () => setStep((value) => value - 1)} currentStep={step} stepCount={4} stepLabels={['기본', '분류', '종', '확인']} onStepChange={setStep}>
      {step === 0 && <div className="pet-basic-step"><h2>새로운 가족을 알려주세요</h2><StepText label="이름" value={name} onChange={(value) => setName(value.slice(0, 24))} placeholder="이름을 입력해주세요" /></div>}
      {step === 1 && <StepSelect label="동물 분류" value={group} options={animalCategoryOptions.filter((item) => item !== 'all')} labels={animalCategoryLabels} onChange={(value) => { const nextGroup = value as Exclude<AnimalCategory, 'all'>; setGroup(nextGroup); setSpeciesOption(nextGroup === 'other' ? '직접 입력' : ''); setCustomSpecies(''); setSpeciesQuery('') }} />}
      {step === 2 && <div className="pet-species-step">{group === 'other' ? <StepText label="어떤 동물인가요?" value={customSpecies} onChange={(value) => setCustomSpecies(value.slice(0, 32))} placeholder="예: 전갈, 달팽이, 타란툴라" /> : <><label className="step-field"><span>종 검색</span><input value={speciesQuery} onChange={(event) => setSpeciesQuery(event.target.value)} placeholder="종을 검색해주세요" /></label><StepSelect label={speciesQuery ? '검색 결과' : '추천 종'} value={speciesOption} options={speciesChoices.slice(0, 8)} onChange={(value) => { setSpeciesOption(value); setCustomSpecies('') }} /><button className={speciesOption === '직접 입력' ? 'species-custom-toggle active' : 'species-custom-toggle'} type="button" onClick={() => setSpeciesOption('직접 입력')}>목록에 없나요? 직접 입력</button>{speciesOption === '직접 입력' && <StepText label="종 직접 입력" value={customSpecies} onChange={(value) => setCustomSpecies(value.slice(0, 32))} placeholder="예: 팬서카멜레온" />}</>}</div>}
      {step === 3 && <div className="pet-confirm-step"><article className="pet-confirm-card"><div className="pet-card-icon">{photo ? <img src={photo} alt="선택한 펫 미리보기" /> : <CategoryTagIcon category={group || 'other'} />}</div><strong>{normalizedName}</strong><span>{resolvedSpecies || '종 미입력'} · {group ? animalCategoryLabels[group] : '분류 미선택'}</span>{gender && <small>{genderLabel(gender)}</small>}</article><label className="pet-photo-picker"><span>{photo ? '사진 변경' : '사진 추가'}</span><input type="file" accept="image/*" onChange={attachPhoto} />{photo ? <img src={photo} alt="선택한 펫 미리보기" /> : <CategoryTagIcon category={group || 'other'} />}</label><StepSelect label="성별" value={gender} options={['male', 'female', 'unknown']} labels={{ male: '수컷', female: '암컷', unknown: '미구분' }} onChange={(value) => setGender(value as Pet['gender'])} /><div className="step-field"><span>몸무게</span><div className="weight-input"><input inputMode="decimal" value={weight} onChange={(event) => setWeight(event.target.value.replace(/[^0-9.]/g, ''))} placeholder="선택 입력" /><div className="weight-unit">{(['g', 'kg'] as const).map((unit) => <button className={weightUnit === unit ? 'active' : ''} type="button" key={unit} onClick={() => setWeightUnit(unit)}>{unit}</button>)}</div></div></div><div className="pet-date-pair"><StepDate label="생일" value={birthday} onChange={setBirthday} /><StepDate label="입양일" value={adoptionDate} onChange={setAdoptionDate} /></div></div>}
      <div className="step-actions">
        <button className="step-draft-corner" type="button" onClick={saveDraft}>임시저장</button>
        <button className="step-secondary step-back" type="button" disabled={step === 0} onClick={() => step > 0 ? setStep((value) => value - 1) : onClose()}>이전</button>
        <button className="step-primary" type="button" disabled={!canNext} onClick={step === 3 ? (isEditing ? finishEdit : finishRequired) : () => setStep((value) => value + 1)}>{step === 3 ? (isEditing ? '수정 완료' : '등록 완료') : '다음'}</button>
      </div>
    </StepShell>
  )
}

function QnaCreateFlow({ userId, pets, author, initialPetId, initialDraft, onClose, onSave, onSaveDraft }: { userId: string; pets: Pet[]; author: string; initialPetId?: string; initialDraft?: DraftItem | null; onClose: () => void; onSave: (post: QnaPost) => void | Promise<void>; onSaveDraft: (draft: DraftItem) => void | Promise<void> }) {
  const initialPost = initialDraft?.draftType === 'question' ? initialDraft.payload as QnaPost : null
  const [step, setStep] = useState(initialDraft?.step ?? 0)
  const [petId, setPetId] = useState(initialPost?.petId || (initialPetId && pets.some((pet) => pet.id === initialPetId) ? initialPetId : ''))
  const [category, setCategory] = useState<QnaCategory | ''>(initialPost ? normalizeQnaCategory(initialPost.category) : '')
  const [title, setTitle] = useState(initialPost?.title ?? '')
  const [body, setBody] = useState(initialPost?.body ?? '')
  const [image, setImage] = useState<string | undefined>(initialPost?.image)
  const [attachedRecord, setAttachedRecord] = useState<AttachedRecordSnapshot | null>(initialPost?.attachedRecordSnapshot ?? null)
  const [attachedDiary, setAttachedDiary] = useState<AttachedDiarySnapshot | null>(initialPost?.attachedDiarySnapshot ?? null)
  const [diaryLoading, setDiaryLoading] = useState(false)
  const [recordAttachOpen, setRecordAttachOpen] = useState(false)
  const [recordAttachRange, setRecordAttachRange] = useState<3 | 7 | 30>(30)
  const [recordCandidates, setRecordCandidates] = useState<PetRecord[]>([])
  const [selectedRecordIds, setSelectedRecordIds] = useState<string[]>([])
  const autoAttachedRef = useRef(false)
  const pet = pets.find((item) => item.id === petId)
  const hasNoAnimal = petId === 'none'
  const canSubmit = title.trim().length > 0 && body.trim().length > 0
  const canNext = step === 0 ? Boolean(category) : step === 1 ? Boolean(petId) : canSubmit
  const selectedGroup = hasNoAnimal ? '동물 X' : pet ? animalCategoryLabels[pet.group] : ''
  const selectedSpecies = hasNoAnimal ? '' : pet?.species || ''
  const buildPost = (): QnaPost => ({
    id: initialPost?.id ?? crypto.randomUUID(),
    category: category || '건강/증상',
    status: 'unresolved',
    title: title.trim(),
    body: body.trim(),
    author,
    mine: true,
    animal: hasNoAnimal ? '동물 X' : selectedSpecies.trim(),
    animalGroup: selectedGroup.trim(),
    animalSpecies: selectedSpecies.trim(),
    petId: hasNoAnimal ? '' : petId,
    image,
    linkedRecordId: attachedRecord?.recordId,
    attachedRecordSnapshot: attachedRecord ?? undefined,
    attachedDiarySnapshot: attachedDiary ?? undefined,
    createdAt: initialPost?.createdAt ?? new Date().toISOString(),
    liked: false,
    likes: 0,
    comments: [],
  })

  const changePet = (nextPetId: string) => {
    if (nextPetId !== petId && (attachedDiary || attachedRecord)) {
      const ok = window.confirm('질문 대상을 변경하면 현재 첨부된 기록이 해제됩니다.')
      if (!ok) return
      setAttachedDiary(null)
      setAttachedRecord(null)
      setSelectedRecordIds([])
    }
    setPetId(nextPetId)
  }

  const makeDiaryAttachment = useCallback((records: PetRecord[]): AttachedDiarySnapshot | null => {
    if (!pet || records.length === 0) return null
    const sorted = [...records].sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt))
    return {
      petId: pet.id,
      petName: pet.name,
      petPhoto: pet.photo,
      records: sorted,
      startDate: sorted[0].date,
      endDate: sorted[sorted.length - 1].date,
      totalCount: sorted.length,
    }
  }, [pet])

  const loadPetRecords = useCallback(async () => {
    if (hasNoAnimal || !petId || !pet) return
    const loaded = await loadAppData<PetRecord>('care_records', { userId, scope: 'mine' })
    return loaded.filter((record) => record.petId === petId).sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt))
  }, [hasNoAnimal, pet, petId, userId])

  const openRecordAttach = async () => {
    if (attachedDiary) return
    if (hasNoAnimal || !petId || !pet || diaryLoading) return
    setDiaryLoading(true)
    try {
      const petRecords = await loadPetRecords()
      if (!petRecords) return
      setRecordCandidates(petRecords)
      setSelectedRecordIds([])
      setRecordAttachOpen(true)
    } finally {
      setDiaryLoading(false)
    }
  }

  const saveRecordAttachment = (records: PetRecord[]) => {
    const attachment = makeDiaryAttachment(records)
    if (!attachment) return
    setAttachedDiary(attachment)
    setRecordAttachOpen(false)
  }

  useEffect(() => {
    if (!initialPetId || initialDraft || step !== 2 || attachedDiary || attachedRecord || autoAttachedRef.current) return
    if (hasNoAnimal || !petId || !pet) return
    autoAttachedRef.current = true
    let cancelled = false
    Promise.resolve()
      .then(async () => {
        setDiaryLoading(true)
        const petRecords = await loadPetRecords()
        if (cancelled) return
        if (!petRecords) return
        const cutoff = new Date()
        cutoff.setDate(cutoff.getDate() - 29)
        const cutoffKey = cutoff.toISOString().slice(0, 10)
        const recentRecords = petRecords.filter((record) => record.date >= cutoffKey)
        const attachment = makeDiaryAttachment(recentRecords)
        if (attachment) setAttachedDiary(attachment)
      })
      .finally(() => {
        if (!cancelled) setDiaryLoading(false)
      })
    return () => { cancelled = true }
  }, [attachedDiary, attachedRecord, hasNoAnimal, initialDraft, initialPetId, loadPetRecords, makeDiaryAttachment, pet, petId, step])

  const finish = () => onSave(buildPost())
  const saveDraft = () => {
    const post = buildPost()
    onSaveDraft({
      id: initialDraft?.id ?? crypto.randomUUID(),
      draftType: 'question',
      title: post.title || '제목 없음',
      body: post.body,
      updatedAt: new Date().toISOString(),
      step,
      payload: post,
    })
  }
  const attachImage = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => setImage(typeof reader.result === 'string' ? reader.result : undefined)
    reader.readAsDataURL(file)
  }

  return (
    <StepShell title="질문 작성" onBack={step === 0 ? onClose : () => setStep((value) => value - 1)} currentStep={step} stepCount={3} onStepChange={setStep} hideProgress>
      {step === 0 && <StepSelect label="질문 유형" value={category} options={['건강/증상', '사육/관리']} onChange={(value) => setCategory(value as QnaCategory)} />}
      {step === 1 && <StepSelect
        label="관련 펫"
        value={petId}
        options={[...pets.map((item) => item.id), 'none']}
        labels={{ ...Object.fromEntries(pets.map((item) => [item.id, `${item.name} · ${animalCategoryLabels[item.group]} · ${item.species}`])), none: '동물 X' }}
        onChange={changePet}
      />}
      {step === 2 && <div className="qna-compose-fields">
        <StepText label="제목" value={title} onChange={setTitle} placeholder="질문 제목을 입력하세요" />
        <StepTextarea label="내용" value={body} onChange={setBody} placeholder="궁금한 내용을 자세히 적어 주세요" />
        <label className="step-field attach-file-field"><span>사진 첨부 (선택)</span><span className="attach-file-button">사진 선택</span><input type="file" accept="image/*" onChange={attachImage} /><small>{image ? '사진이 선택되었습니다' : '선택된 사진 없음'}</small></label>
        {image && <img className="qna-compose-preview" src={image} alt="첨부 사진 미리보기" />}
        {attachedRecord && <RecordAttachCard record={attachedRecord} mode="draft" onRemove={() => setAttachedRecord(null)} />}
        {!hasNoAnimal && petId && <div className="qna-compose-tools">
          <button type="button" onClick={openRecordAttach}>{attachedDiary ? '기록 첨부됨' : diaryLoading ? '기록 불러오는 중' : '기록 첨부'}</button>
        </div>}
        <div>
          {diaryLoading && <DiaryTimelineSkeleton />}
          {attachedDiary && !diaryLoading && <DiaryTimelineAttachment snapshot={attachedDiary} mode="draft" onRemove={() => setAttachedDiary(null)} />}
        </div>
        {recordAttachOpen && pet && <QnaRecordAttachSheet pet={pet} records={recordCandidates} range={recordAttachRange} selectedIds={selectedRecordIds} onRangeChange={setRecordAttachRange} onToggle={(recordId) => setSelectedRecordIds((ids) => ids.includes(recordId) ? ids.filter((id) => id !== recordId) : [...ids, recordId])} onSelectDate={(_date, ids) => setSelectedRecordIds((current) => ids.every((id) => current.includes(id)) ? current.filter((id) => !ids.includes(id)) : [...new Set([...current, ...ids])])} onClose={() => setRecordAttachOpen(false)} onSave={saveRecordAttachment} />}
      </div>}
      {step === 2 && <div className="step-actions"><button className="step-draft-corner" type="button" onClick={saveDraft}>임시저장</button><button className="step-secondary step-back" type="button" onClick={() => setStep((value) => value - 1)}>이전</button><button className="step-primary" type="button" disabled={!canNext} onClick={finish}>등록</button></div>}
      {step !== 2 && <div className="step-actions"><button className="step-draft-corner" type="button" onClick={saveDraft}>임시저장</button><button className="step-secondary step-back" type="button" onClick={() => setStep((value) => value - 1)} disabled={step === 0}>이전</button><button className="step-primary" type="button" disabled={!canNext} onClick={() => setStep((value) => value + 1)}>다음</button></div>}
    </StepShell>
  )
}

function QnaOwnerMenu({ post, onEdit, onToggleResolve, onDelete }: { post: QnaPost; onEdit: () => void; onToggleResolve: () => void; onDelete: () => void }) {
  const [open, setOpen] = useState(false)
  return <div className="qna-owner-menu">
    <button type="button" aria-label="질문 관리 메뉴 열기" aria-expanded={open} onClick={() => setOpen((value) => !value)}>⋮</button>
    {open && <div role="menu"><button type="button" onClick={() => { setOpen(false); onEdit() }}>질문 수정</button><button type="button" onClick={() => { setOpen(false); onToggleResolve() }}>{qnaStatus(post) === 'resolved' ? '해결 취소' : '해결 완료'}</button><button className="danger" type="button" onClick={() => { setOpen(false); onDelete() }}>질문 삭제</button></div>}
  </div>
}

function QnaRecordAttachSheet({
  pet,
  records,
  range,
  selectedIds,
  onRangeChange,
  onToggle,
  onSelectDate,
  onClose,
  onSave,
}: {
  pet: Pet
  records: PetRecord[]
  range: 3 | 7 | 30
  selectedIds: string[]
  onRangeChange: (range: 3 | 7 | 30) => void
  onToggle: (recordId: string) => void
  onSelectDate: (date: string, ids: string[]) => void
  onClose: () => void
  onSave: (records: PetRecord[]) => void
}) {
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - (range - 1))
  const cutoffKey = cutoff.toISOString().slice(0, 10)
  const visibleRecords = records.filter((record) => record.date >= cutoffKey)
  const grouped = visibleRecords.reduce<Record<string, PetRecord[]>>((groups, record) => {
    groups[record.date] = [...(groups[record.date] ?? []), record]
    return groups
  }, {})
  const selectedRecords = records.filter((record) => selectedIds.includes(record.id))
  const selectedDates = selectedRecords.map((record) => record.date).sort()
  const rangeLabel = selectedDates.length ? `${formatRecordDate(selectedDates[0])}~${formatRecordDate(selectedDates[selectedDates.length - 1])}` : '선택된 기록 없음'

  return (
    <div className="record-picker-overlay">
      <button className="record-picker-dim" type="button" aria-label="기록 첨부 닫기" onClick={onClose} />
      <section className="record-picker-sheet qna-record-attach-sheet" role="dialog" aria-modal="true" aria-label={`${pet.name} 기록 첨부`}>
        <div className="hospital-picker-handle" aria-hidden="true" />
        <header>
          <div><strong>{pet.name} 기록 첨부</strong><p>질문에 필요한 기록만 선택하세요.</p></div>
          <button type="button" aria-label="닫기" onClick={onClose}>×</button>
        </header>
        <div className="qna-record-range-tabs" aria-label="기록 범위">
          {([3, 7, 30] as const).map((value) => <button className={range === value ? 'active' : ''} type="button" key={value} onClick={() => onRangeChange(value)}>최근 {value}일</button>)}
        </div>
        <div className="qna-record-selected-summary"><strong>기록 {selectedRecords.length}개 선택</strong><span>{rangeLabel}</span></div>
        {visibleRecords.length === 0 ? <p className="record-picker-empty">첨부할 기록이 없습니다. 다이어리에서 루틴을 완료한 뒤 다시 확인해 주세요.</p> : (
          <div className="qna-record-group-list">
            {Object.entries(grouped).sort(([a], [b]) => b.localeCompare(a)).map(([date, items]) => {
              const ids = items.map((item) => item.id)
              const allSelected = ids.every((id) => selectedIds.includes(id))
              return (
                <section className="qna-record-date-group" key={date}>
                  <header><strong>{formatRecordDate(date)}</strong><button type="button" onClick={() => onSelectDate(date, ids)}>{allSelected ? '날짜 선택 해제' : `${formatRecordDate(date)} 전체 선택`}</button></header>
                  {items.map((record) => (
                    <label className="qna-record-check-row" key={record.id}>
                      <input type="checkbox" checked={selectedIds.includes(record.id)} onChange={() => onToggle(record.id)} />
                      <span><strong>{recordTypeLabels[record.type]}</strong><small>{summarizeRecord(record)}</small></span>
                    </label>
                  ))}
                </section>
              )
            })}
          </div>
        )}
        <div className="qna-record-attach-actions">
          <button type="button" onClick={onClose}>취소</button>
          <button type="button" disabled={selectedRecords.length === 0} onClick={() => onSave(selectedRecords)}>선택 기록 첨부</button>
        </div>
      </section>
    </div>
  )
}

function formatQnaDate(value: string) {
  const elapsed = Date.now() - new Date(value).getTime()
  const minutes = Math.max(0, Math.floor(elapsed / 60000))
  if (minutes < 1) return '방금 전'
  if (minutes < 60) return `${minutes}분 전`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}시간 전`
  return new Intl.DateTimeFormat('ko-KR', { month: 'short', day: 'numeric' }).format(new Date(value))
}

function formatQnaAnimal(post: QnaPost) {
  if (post.animal === '동물 X' || post.animalGroup === '동물 X' || post.animal === '동물 없음' || post.animalGroup === '동물 없음') return '동물 X'
  const group = post.animalGroup || '분류 미지정'
  const species = post.animalSpecies || post.animal || '종 미지정'
  return `${group} · ${species}`
}

function normalizeQnaCategory(category: string): QnaCategory {
  if (category === '동물 병원' || category === '병원/진료') return '건강/증상'
  if (category === '정보' || category === '기타' || category === '사육/관리') return '사육/관리'
  return '건강/증상'
}

function qnaDisplayAuthor(author: string | undefined, mine: boolean, currentNickname: string) {
  if (mine || !author || author === '작성자' || author === '나') return currentNickname
  return author
}

function qnaStatus(post: QnaPost): QnaStatus {
  return post.status === 'resolved' ? 'resolved' : 'unresolved'
}

function qnaStatusLabel(status: QnaStatus) {
  return status === 'resolved' ? '해결 완료' : '답변 대기'
}

function parseQnaStatus(value: string | null): QnaListStatus {
  return value === 'waiting' || value === 'resolved' ? value : 'all'
}

function parseQnaCategory(value: string | null): QnaCategory | 'all' {
  return value === '건강/증상' || value === '사육/관리' ? value : 'all'
}

function parseQnaSort(value: string | null): QnaSort {
  return value === 'popular' || value === 'comments' ? value : 'latest'
}

function qnaListStatus(post: QnaPost, commentCount = post.comments.length): QnaListStatus {
  if (qnaStatus(post) === 'resolved') return 'resolved'
  return commentCount > 0 ? 'answered' : 'waiting'
}

function qnaListStatusLabel(status: QnaListStatus) {
  if (status === 'resolved') return '해결 완료'
  if (status === 'answered') return '답변 있음'
  return '답변 대기'
}

const qnaCategoryCards: QnaCategory[] = ['건강/증상', '사육/관리']

function qnaSortLabel(sort: QnaSort) {
  if (sort === 'latest') return '최신순'
  if (sort === 'popular') return '인기순'
  if (sort === 'views') return '조회순'
  return '댓글순'
}

function sortQnaPosts(posts: QnaPost[], sort: QnaSort, getCommentCount: (post: QnaPost) => number = (post) => post.comments.length) {
  return [...posts].sort((a, b) => {
    if (sort === 'popular') {
      const commentDiff = getCommentCount(b) - getCommentCount(a)
      if (commentDiff !== 0) return commentDiff
      const viewDiff = (b.viewCount ?? 0) - (a.viewCount ?? 0)
      if (viewDiff !== 0) return viewDiff
    }
    if (sort === 'views') {
      const viewDiff = (b.viewCount ?? 0) - (a.viewCount ?? 0)
      if (viewDiff !== 0) return viewDiff
    }
    if (sort === 'comments') {
      const commentDiff = getCommentCount(b) - getCommentCount(a)
      if (commentDiff !== 0) return commentDiff
    }
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  })
}

export const recordTypeLabels: Record<PetRecordType, string> = {
  food: '먹이',
  weight: '무게',
  shed: '탈피',
  poop: '배변',
  cleaning: '청소',
  hospital: '병원',
  other: '기록',
}

function toAttachedRecordSnapshot(record: PetRecord, pet: Pet): AttachedRecordSnapshot {
  return {
    recordId: record.id,
    petId: pet.id,
    petName: pet.name,
    animalGroup: animalCategoryLabels[pet.group],
    animalSpecies: pet.species,
    recordDate: record.date,
    recordType: record.type,
    recordTypeLabel: recordTypeLabels[record.type],
    summary: summarizeRecord(record),
    photoUrl: record.photoUrl,
  }
}

void toAttachedRecordSnapshot

function summarizeRecord(record: PetRecord) {
  if (record.memo?.trim()) return record.memo.trim()
  if (record.type === 'food' && record.foods?.length) return record.foods.join(', ')
  if (record.type === 'weight' && record.weight !== undefined) return `${record.weight}g`
  return `${recordTypeLabels[record.type]} 기록`
}

function formatRecordDate(value: string) {
  return new Intl.DateTimeFormat('ko-KR', { month: 'short', day: 'numeric' }).format(new Date(value))
}

function StepTextarea({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (value: string) => void; placeholder: string }) {
  return <label className="step-field"><span>{label}</span><textarea autoFocus value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} /></label>
}

function StepSelect({ label, value, options, labels, onChange }: { label: string; value: string; options: string[]; labels?: Record<string, string>; onChange: (value: string) => void }) {
  return (
    <div className="step-field">
      <span>{label}</span>
      <div className="choice-grid">
        {options.map((option) => <button className={value === option ? 'active' : ''} key={option} type="button" onClick={() => onChange(option)}>{labels?.[option] ?? option}</button>)}
      </div>
    </div>
  )
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

function loadNaverMaps(clientId: string) {
  if (window.naver?.maps) return Promise.resolve(window.naver)
  if (naverMapsLoader) return naverMapsLoader

  naverMapsLoader = new Promise<NaverMapApi>((resolve, reject) => {
    const existingScript = document.querySelector<HTMLScriptElement>('script[data-naver-map-sdk="true"]')
    if (existingScript) {
      existingScript.addEventListener('load', () => window.naver ? resolve(window.naver) : reject(new Error('Naver Maps SDK is unavailable.')), { once: true })
      existingScript.addEventListener('error', () => reject(new Error('Naver Maps SDK failed to load.')), { once: true })
      return
    }

    const script = document.createElement('script')
    script.src = `https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=${encodeURIComponent(clientId)}&submodules=geocoder`
    script.async = true
    script.dataset.naverMapSdk = 'true'
    script.addEventListener('load', () => window.naver ? resolve(window.naver) : reject(new Error('Naver Maps SDK is unavailable.')), { once: true })
    script.addEventListener('error', () => reject(new Error('Naver Maps SDK failed to load.')), { once: true })
    document.head.appendChild(script)
  })

  return naverMapsLoader
}

function readBrowserLocation() {
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

async function searchHospitals(query: string, category: AnimalCategory, location: Coordinates | null) {
  const hospitals = await loadCollectedHospitals(query, category)
  return sortHospitalsByDistance(hospitals, location)
}

async function loadCollectedHospitals(query: string, category: AnimalCategory) {
  const response = await fetch('/data/exotic-hospitals.json', { cache: 'no-store' })
  if (!response.ok) return []
  const items = await response.json() as Array<Record<string, unknown>>
  return transformHospitalItems(items, query, category)
}

function transformHospitalItems(items: Array<Record<string, unknown>>, query: string, category: AnimalCategory) {
  return dedupeHospitals(items
    .filter((item) => isHospitalSearchResult(item, query, category))
    .map((item, index) => transformHospitalItem(item, index, query, category))
    .filter((hospital): hospital is Hospital => Boolean(hospital)))
    .filter((hospital) => hospitalMatchesQuery(hospital, query))
}

function toHospitalSnapshot(hospital: Hospital): HospitalSnapshot {
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

function hospitalFromSnapshot(snapshot: HospitalSnapshot): Hospital {
  const categories = snapshot.animalTags
    .map((tag) => Object.entries(animalCategoryLabels).find(([, label]) => label === tag)?.[0])
    .filter((value): value is Exclude<AnimalCategory, 'all'> => value === 'reptile' || value === 'bird' || value === 'rodent' || value === 'amphibian' || value === 'other')

  return {
    id: snapshot.id || `${snapshot.name}-${snapshot.lat}-${snapshot.lng}`,
    name: snapshot.name,
    address: snapshot.address,
    phone: snapshot.phone,
    link: snapshot.naverLink,
    lat: snapshot.lat,
    lng: snapshot.lng,
    categories: categories.length ? categories : ['other'],
    matchedQueries: [snapshot.name],
  }
}

function transformHospitalItem(item: Record<string, unknown>, index: number, query: string, category: AnimalCategory): Hospital | null {
  const name = cleanHtml(String(item.title ?? item.name ?? '이름 없는 병원'))
  const address = String(item.roadAddress ?? item.address ?? '')
  const lat = Number(item.lat)
  const lng = Number(item.lng)
  const mapx = Number(item.mapx ?? item.mapX)
  const mapy = Number(item.mapy ?? item.mapY)
  const coords = Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : convertNaverLocalCoords(mapx, mapy)
  if (!coords) return null

  const text = `${query} ${name} ${item.category ?? ''} ${item.description ?? ''} ${address}`
  const rawSupportedAnimals = item.supportedAnimals
  const hasCollectedAnimals = Array.isArray(rawSupportedAnimals)
  const supportedAnimals = hasCollectedAnimals ? rawSupportedAnimals.map(String) : []
  const categories = supportedAnimals
    .filter((value): value is Exclude<AnimalCategory, 'all'> => value === 'reptile' || value === 'bird' || value === 'rodent' || value === 'amphibian' || value === 'other')
  const guessed: Exclude<AnimalCategory, 'all'>[] = categories.length > 0 ? categories : hasCollectedAnimals ? ['other'] : guessAnimalCategories(text, category)

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
  if (selectedCategory !== 'all') return [selectedCategory]
  const normalized = normalizeText(text)
  const matched = Object.entries(animalCategoryKeywords)
    .filter(([, keywords]) => keywords.some((keyword) => normalized.includes(normalizeText(keyword))))
    .map(([category]) => category as Exclude<AnimalCategory, 'all'>)
  return matched.length > 0 ? matched : ['reptile', 'bird', 'rodent']
}

function buildHospitalSearchQuery(query: string, category: AnimalCategory) {
  const trimmed = query.trim()
  const categoryTerm = animalCategorySearchTerms[category]
  if (!trimmed) return categoryTerm
  if (category === 'all') {
    return exoticHospitalSearchTerms.some((term) => normalizeText(trimmed).includes(normalizeText(term))) ? trimmed : `${trimmed} ${categoryTerm}`
  }
  return normalizeText(trimmed).includes(normalizeText(categoryTerm)) ? trimmed : `${trimmed} ${categoryTerm}`
}

function isHospitalSearchResult(item: Record<string, unknown>, query: string, category: AnimalCategory) {
  void query
  if (Array.isArray(item.sources) && item.sources.includes('naver-local-search')) return true
  const text = normalizeText(`${item.title ?? item.name ?? ''} ${item.category ?? ''} ${item.description ?? ''} ${item.address ?? ''} ${item.roadAddress ?? ''}`)
  const hasAnimalHospitalSignal = hospitalPositiveKeywords.some((keyword) => text.includes(normalizeText(keyword)))
  const hasCategoryHospitalSignal = text.includes(normalizeText('동물병원')) || text.includes(normalizeText('동물 병원'))
  const hasNegativeSignal = hospitalNegativeKeywords.some((keyword) => text.includes(normalizeText(keyword)))

  if (category !== 'all') {
    const categoryTerm = animalCategorySearchTerms[category]
    return (hasAnimalHospitalSignal || text.includes(normalizeText(categoryTerm))) && (!hasNegativeSignal || hasCategoryHospitalSignal)
  }

  return hasAnimalHospitalSignal && (!hasNegativeSignal || hasCategoryHospitalSignal)
}

function hospitalMatchesQuery(hospital: Hospital, query: string) {
  if (!query.trim()) return true

  const queryWithoutGenericTerms = exoticHospitalSearchTerms.reduce((value, term) => value.replaceAll(term, ' '), query)
  const normalizedWords = queryWithoutGenericTerms.split(/[,\s]+/).map(normalizeText).filter(Boolean)
  if (normalizedWords.length === 0) return true

  const target = normalizeText(`${hospital.name} ${hospital.address} ${hospital.roadAddress ?? ''} ${(hospital.matchedQueries ?? []).join(' ')}`)
  return normalizedWords.every((word) => target.includes(word))
}

function sortHospitalsByDistance(hospitals: Hospital[], location: Coordinates | null) {
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

function hospitalMarkerContent(hospital: Hospital, active: boolean, trusted: boolean) {
  return `<button class="hospital-map-marker${active ? ' active' : ''}${trusted ? ' trusted' : ''}" type="button" aria-label="${escapeHtml(hospital.name)}"><span aria-hidden="true"></span></button>`
}

function readStoredReviews() {
  try {
    const stored = localStorage.getItem(reviewStorageKey)
    if (!stored) return {}
    return JSON.parse(stored) as Record<string, HospitalReview[]>
  } catch {
    return {}
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

function getReviewSummary(reviews: HospitalReview[]) {
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

function getRecentSpecies(reviews: HospitalReview[]) {
  return reviews.find((review) => review.species || review.animalCategory)?.species ?? ''
}

function normalizePet(pet: Pet & { category?: string }): Pet {
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

function genderLabel(value: Pet['gender']) {
  if (value === 'male') return '수컷'
  if (value === 'female') return '암컷'
  return '미구분'
}

function formatReviewDate(value: string) {
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

export default App








