import { type ChangeEvent, type FormEvent, type ReactNode, useEffect, useMemo, useRef, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import './App.css'
import AuthScreen from './components/AuthScreen'
import DiaryPage, { type RecordDraft, type Reminder } from './features/diary/DiaryPage'
import HospitalReviewForm, { type ReviewAnimalCategory } from './features/hospital-map/HospitalReviewForm'
import type { DailyTask, PetRecord, PetRecordType } from './features/diary/diaryTypes'
import { linkReviewToDiary, listDailyTasks } from './features/diary/diaryService'
import { toDateKey } from './features/diary/mockDiaryData'
import { deleteAppData, loadAppData, saveAppData } from './lib/appData'
import { supabase } from './lib/supabase'

type Tab = 'pets' | 'diary' | 'map' | 'qna' | 'share' | 'profile'
type CreateMode = 'pet' | 'post' | 'share' | null
type AnimalCategory = 'all' | 'reptile' | 'bird' | 'rodent' | 'amphibian' | 'other'
type ShareCategory = 'reptile' | 'bird' | 'rodent' | 'amphibian' | 'other' | 'food' | 'supplies'
type ShareSort = 'latest' | 'popular'
type HospitalSort = 'distance' | 'reviews' | 'rating'
type MobileMapSheetState = 'collapsed' | 'middle' | 'expanded'
type ShareStatus = 'active' | 'completed'

type Pet = {
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
type QnaSort = 'needsAnswer' | 'latest' | 'comments' | 'resolved'

type QnaComment = {
  id: string
  author: string
  body: string
  createdAt: string
  mine: boolean
  hospitalSnapshot?: HospitalSnapshot
}

type QnaPost = {
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
  liked: boolean
  likes: number
  comments: QnaComment[]
}

type ShareItem = {
  id: string
  title: string
  area: string
  memo: string
  author?: string
  authorAvatarUrl?: string
  mine?: boolean
  status?: ShareStatus
  category?: ShareCategory
  subcategory?: string
  species?: string
  gender?: Pet['gender']
  imageUrl?: string
  createdAt?: string
  likes?: number
  liked?: boolean
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

type DraftKind = 'question' | 'share_item' | 'pet' | 'care_record' | 'hospital_review' | 'reminder'

type DraftItem = {
  id: string
  draftType: DraftKind
  title: string
  body: string
  updatedAt: string
  step?: number
  payload: QnaPost | ShareItem | Pet | DiaryRecordDraftPayload | HospitalReviewDraftPayload | ReminderDraftPayload
}

type AppProfile = {
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

type HospitalSnapshot = {
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

type HospitalReview = {
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
  { id: 'qna', label: 'QNA' },
]

const animalCategoryOptions: AnimalCategory[] = ['all', 'reptile', 'rodent', 'amphibian', 'bird', 'other']
const animalCategoryLabels: Record<AnimalCategory, string> = {
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
  reptile: ['개코', '비어디드래곤', '이구아나', '카멜레온', '왕도마뱀', '스킨크', '육지 거북', '수생 습지 거북', '콘스네이크', '킹스네이크', '볼파이톤', '보아-파이톤', '호그노즈', '기타 도마뱀', '기타 뱀', '기타'],
  bird: ['앵무새', '닭', '기타 조류', '기타'],
  rodent: ['슈가글라이더', '고슴도치', '햄스터', '기타 설치류', '기타'],
  amphibian: ['팩맨', '트리프록', '두꺼비(토드)', '뉴트', '살라만다', '아홀로틀', '기타 양서류', '기타'],
  other: ['기타'],
}

const reviewStorageKey = 'exocare-hospital-reviews'
const savedHospitalStorageKey = 'exocare-saved-hospitals'
const savedHospitalDetailsStorageKey = 'exocare-liked-hospitals'
const shareCategoryLabels: Record<ShareCategory, string> = {
  reptile: '파충류', bird: '조류', rodent: '설치류', amphibian: '양서류',
  other: '기타', food: '먹이', supplies: '용품',
}
const shareSubcategories: Record<ShareCategory, string[]> = {
  reptile: ['개코', '비어디드래곤', '이구아나', '카멜레온', '왕도마뱀', '스킨크', '육지 거북', '수생 습지 거북', '콘스네이크', '킹스네이크', '볼파이톤', '보아-파이톤', '호그노즈', '기타 도마뱀', '기타 뱀'],
  bird: ['앵무새', '닭', '기타'],
  rodent: ['슈가글라이더', '고슴도치', '햄스터', '기타'],
  amphibian: ['팩맨', '트리프록', '두꺼비(토드)', '뉴트', '살라만다', '아홀로틀', '기타'],
  other: ['기타 동물'],
  food: ['영양제', '귀뚜라미', '밀웜', '누에', '마우스', '사료', '기타'],
  supplies: ['사육장', '식급수기', '은신처', '바닥재', '온습도계', '난방용품', '기타'],
}
const shareAreaSuggestions = ['서울', '경기', '인천', '부산', '대구', '대전', '광주', '울산', '세종', '강원', '충북', '충남', '전북', '전남', '경북', '경남', '제주']
void shareSubcategories
let naverMapsLoader: Promise<NaverMapApi> | null = null
const qnaTable = ['comm', 'unity_posts'].join('')
const qnaDatabaseCategory = ['Q', '&A'].join('')

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
  const [activeTab, setActiveTab] = useState<Tab>('map')
  const [sideNavOpen, setSideNavOpen] = useState(false)
  const [createMode, setCreateMode] = useState<CreateMode>(null)
  const [qnaOpenId, setQnaOpenId] = useState<string | null>(null)
  const [editingPet, setEditingPet] = useState<Pet | null>(null)
  const [diaryPetId, setDiaryPetId] = useState<string | null>(null)
  const [diaryReadOnly, setDiaryReadOnly] = useState(false)
  const [editingDraft, setEditingDraft] = useState<DraftItem | null>(null)
  const [mapFocusHospital, setMapFocusHospital] = useState<HospitalSnapshot | null>(null)
  const [pets, setPets] = useState<Pet[]>([])
  const [qnaPosts, setQnaPosts] = useState<QnaPost[]>([])
  const [shareItems, setShareItems] = useState<ShareItem[]>([])
  const [drafts, setDrafts] = useState<DraftItem[]>([])
  const [hospitalReviews, setHospitalReviews] = useState<Record<string, HospitalReview[]>>(() => readStoredReviews())
  const [likedHospitals, setLikedHospitals] = useState<HospitalSnapshot[]>(() => readSavedHospitalSnapshots())
  const [profile, setProfile] = useState<AppProfile>({ username: '', nickname: '', avatarUrl: '' })
  const [dataError, setDataError] = useState('')
  const bottomNavDragStartRef = useRef<number | null>(null)
  const suppressNextBottomNavClickRef = useRef(false)

  /* eslint-disable react-hooks/set-state-in-effect -- reset local app state when the signed-in user changes. */
  useEffect(() => {
    let active = true
    setPets([])
    setQnaPosts([])
    setShareItems([])
    setDrafts([])
    setHospitalReviews(readStoredReviews())
    setLikedHospitals(readSavedHospitalSnapshots())
    setProfile({ username: '', nickname: '', avatarUrl: '' })
    setCreateMode(null)
    setEditingPet(null)
    setEditingDraft(null)
    setQnaOpenId(null)
    setDiaryPetId(null)
    setDiaryReadOnly(false)
    setDataError('')
    const loadMine = async <T,>(table: string) => loadAppData<T>(table, { userId: session.user.id, scope: 'mine' })
    const loadAll = async <T,>(table: string) => loadAppData<T>(table, { userId: session.user.id, scope: 'all' })
    const loadOptionalMine = async <T,>(table: string) => loadMine<T>(table).catch((error) => {
      console.warn(`Optional data load failed: ${table}`, error)
      return [] as T[]
    })

    Promise.all([
      loadMine<Pet>('pets'),
      loadAll<QnaPost>(qnaTable),
      loadAll<ShareItem>('share_items'),
      loadOptionalMine<DraftItem>('drafts').then((items) => {
        const localItems = readLocalDrafts(session.user.id)
        const merged = [...items, ...localItems.filter((local) => !items.some((item) => item.id === local.id))]
        writeLocalDrafts(session.user.id, merged)
        return merged
      }).catch(() => readLocalDrafts(session.user.id)),
    ]).then(([nextPets, nextPosts, nextItems, nextDrafts]) => {
      if (!active) return
      setPets(nextPets.map(normalizePet))
      setQnaPosts(nextPosts)
      setShareItems(nextItems)
      setDrafts(nextDrafts)
    }).catch((error) => {
      if (!active) return
      console.error('Initial data load failed:', error)
      setDataError('데이터를 불러오지 못했습니다. 잠시 후 다시 새로고침해 주세요.')
    })
    return () => { active = false }
  }, [session.user.id])
  /* eslint-enable react-hooks/set-state-in-effect */

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
    setActiveTab(tab)
    if (tab !== 'diary') {
      setDiaryPetId(null)
      setDiaryReadOnly(false)
    }
    setCreateMode(null)
    setEditingPet(null)
    setEditingDraft(null)
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
    setCreateMode(null)
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
      setPets((items) => items.filter((item) => item.id !== petId))
    } catch {
      setDataError('펫 정보를 삭제하지 못했습니다.')
    }
  }

  const saveQnaPost = async (post: QnaPost) => {
    setQnaPosts((items) => [post, ...items.filter((item) => item.id !== post.id)])
    setCreateMode(null)
    try {
      await saveAppData(qnaTable, session.user.id, post, {
        category: qnaDatabaseCategory, title: post.title, body: post.body,
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
        category: qnaDatabaseCategory, title: changed.title, body: changed.body,
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

  const saveShareItem = async (item: ShareItem) => {
    setShareItems((items) => [item, ...items.filter((shareItem) => shareItem.id !== item.id)])
    setCreateMode(null)
    try {
      await saveAppData('share_items', session.user.id, item, {
        title: item.title, area: item.area, memo: item.memo,
      })
    } catch (error) {
      console.error('Supabase share save failed; kept local state.', error)
    }
  }

  const deleteShareItem = async (itemId: string) => {
    try {
      await deleteAppData('share_items', itemId)
      setShareItems((items) => items.filter((item) => item.id !== itemId))
    } catch {
      setDataError('나눔 글을 삭제하지 못했습니다.')
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
    if (draft.draftType === 'share_item') {
      setDataError('나눔 기능은 현재 준비 중입니다.')
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

  const openWrittenPost = (kind: 'question' | 'share_item', id: string) => {
    setCreateMode(null)
    if (kind === 'question') {
      setActiveTab('qna')
      setQnaOpenId(id)
      return
    }
    void id
    setDataError('나눔 기능은 현재 준비 중입니다.')
    setQnaOpenId(null)
  }

  const editWrittenPost = (kind: 'question' | 'share_item', id: string) => {
    const payload = kind === 'question' ? qnaPosts.find((post) => post.id === id) : shareItems.find((item) => item.id === id)
    if (!payload) return
    if (kind === 'share_item') {
      setDataError('나눔 기능은 현재 준비 중입니다.')
      return
    }
    setEditingDraft({
      id,
      draftType: kind,
      title: 'title' in payload ? payload.title : '',
      body: 'body' in payload ? payload.body : 'memo' in payload ? payload.memo : '',
      updatedAt: new Date().toISOString(),
      payload,
    } as DraftItem)
    setCreateMode('post')
  }

  const deleteWrittenPost = (kind: 'question' | 'share_item', id: string) => {
    if (kind === 'question') {
      void deleteQnaPost(id)
      return
    }
    void deleteShareItem(id)
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

  // 나눔 기능은 프론트엔드에서 보류 중이지만, 저장 로직은 재활성화 대비로 보존한다.
  void saveShareItem

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
      onSaveDraft={saveDraft}
    />
  )
  if (createMode === 'post') return (
    <QnaCreateFlow
      userId={session.user.id}
      pets={pets}
      initialDraft={editingDraft?.draftType === 'question' ? editingDraft : null}
      onClose={() => { setCreateMode(null); setEditingDraft(null) }}
      onSave={async (post) => {
        await saveQnaPost(post)
        if (editingDraft && drafts.some((draft) => draft.id === editingDraft.id)) await deleteDraft(editingDraft.id)
        setEditingDraft(null)
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
        <button className={`side-nav-profile ${activeTab === 'profile' ? 'active' : ''}`} type="button" onClick={() => { moveTab('profile'); setSideNavOpen(false) }}>
          <span className="side-nav-icon profile" aria-hidden="true" />
          <span>&#54532;&#47196;&#54596;</span>
        </button>
      </aside>

      <header className="top-bar">
        <div>
          <h1>{activeTab === 'profile' ? '프로필' : tabs.find((tab) => tab.id === activeTab)?.label}</h1>
        </div>
      </header>

      {activeTab === 'map' && <main className="app-main"><MapScreen userId={session.user.id} profile={profile} pets={pets} focusHospital={mapFocusHospital} reviewDraft={editingDraft?.draftType === 'hospital_review' ? editingDraft : null} reviews={hospitalReviews} likedHospitals={likedHospitals} onReviewsChange={setHospitalReviews} onLikedHospitalsChange={setLikedHospitals} onSaveDraft={async (draft) => { await saveDraft(draft); setEditingDraft(null) }} onDeleteDraft={async (draftId) => { await deleteDraft(draftId); setEditingDraft(null) }} /></main>}

      {activeTab !== 'map' && (
        <main className="app-main">
          {activeTab === 'pets' && <PetsScreen userId={session.user.id} pets={pets} onDeletePet={deletePet} onEditPet={(pet) => { setEditingPet(pet); setCreateMode('pet') }} onOpenDiary={(petId) => { setDiaryPetId(petId); setDiaryReadOnly(false); moveTab('diary') }} onRegisterPet={() => { setEditingPet(null); setEditingDraft(null); setCreateMode('pet') }} />}
          {activeTab === 'diary' && <DiaryPage userId={session.user.id} pets={pets} initialPetId={diaryPetId ?? undefined} readOnly={diaryReadOnly} onAddPet={() => { setEditingPet(null); setEditingDraft(null); setCreateMode('pet') }} initialDraft={editingDraft?.draftType === 'care_record' || editingDraft?.draftType === 'reminder' ? editingDraft as never : null} onSaveDraft={async (draft) => { await saveDraft(draft); setEditingDraft(null) }} onDeleteDraft={async (draftId) => { await deleteDraft(draftId); setEditingDraft(null) }} />}
          {activeTab === 'qna' && <QnaScreen userId={session.user.id} profile={profile} posts={qnaPosts} openPostId={qnaOpenId} onOpenHandled={() => setQnaOpenId(null)} onChange={updateQnaPosts} onDeletePost={deleteQnaPost} onEditPost={(post) => editWrittenPost('question', post.id)} onOpenHospital={openHospitalOnMap} onOpenDiary={(petId, readOnly) => { setDiaryPetId(petId); setDiaryReadOnly(readOnly); moveTab('diary') }} />}
          {activeTab === 'profile' && <ProfileScreen key={`${profile.username}-${profile.nickname}-${profile.avatarUrl}`} profile={profile} qnaPosts={qnaPosts} hospitalReviews={hospitalReviews} likedHospitals={likedHospitals} drafts={drafts} onSignOut={() => supabase.auth.signOut()} onDeleteAccount={deleteAccount} onSaveProfile={saveProfile} onDeleteDraft={deleteDraft} onContinueDraft={continueDraft} onOpenWrittenPost={openWrittenPost} onOpenHospital={openHospitalOnMap} onEditWrittenPost={editWrittenPost} onDeleteWrittenPost={deleteWrittenPost} />}
        </main>
      )}

      {activeTab !== 'map' && activeTab !== 'diary' && activeTab !== 'profile' && (
        <button className="app-fab" type="button" aria-label="작성" onClick={() => { setEditingPet(null); setEditingDraft(null); setCreateMode(activeTab === 'pets' ? 'pet' : 'post') }}>
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

function ProfileScreen({
  profile,
  qnaPosts,
  hospitalReviews,
  likedHospitals,
  drafts,
  onSignOut,
  onDeleteAccount,
  onSaveProfile,
  onDeleteDraft,
  onContinueDraft,
  onOpenWrittenPost,
  onOpenHospital,
  onEditWrittenPost,
  onDeleteWrittenPost,
}: {
  profile: AppProfile
  qnaPosts: QnaPost[]
  hospitalReviews: Record<string, HospitalReview[]>
  likedHospitals: HospitalSnapshot[]
  drafts: DraftItem[]
  onSignOut: () => void
  onDeleteAccount: () => void | Promise<void>
  onSaveProfile: (profile: AppProfile) => void
  onDeleteDraft: (draftId: string) => void
  onContinueDraft: (draft: DraftItem) => void
  onOpenWrittenPost: (kind: 'question' | 'share_item', id: string) => void
  onOpenHospital: (hospital: HospitalSnapshot) => void
  onEditWrittenPost: (kind: 'question' | 'share_item', id: string) => void
  onDeleteWrittenPost: (kind: 'question' | 'share_item', id: string) => void
}) {
  const [view, setView] = useState<'menu' | 'profile' | 'posts' | 'drafts' | 'liked' | 'logout' | 'delete-account'>('menu')
  const [username, setUsername] = useState(profile.username)
  const [nickname, setNickname] = useState(profile.nickname)
  const [avatarUrl, setAvatarUrl] = useState(profile.avatarUrl)
  const [profileSaved, setProfileSaved] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState('')
  const [deletingAccount, setDeletingAccount] = useState(false)
  const displayName = profile.nickname || profile.username || '사용자'
  const visibleDrafts = drafts.filter((draft) => draft.draftType !== 'share_item')
  const posts: Array<{ id: string; kind: 'question' | 'share_item'; type: string; title: string; body: string }> = [
    ...qnaPosts.filter((post) => post.mine === true).map((post) => ({ id: post.id, kind: 'question' as const, type: 'QNA', title: post.title, body: post.body })),
  ]
  const likedQnaItems = qnaPosts.filter((post) => post.liked).map((post) => ({ id: post.id, kind: 'question' as const, type: 'QNA', title: post.title, body: post.body }))
  const likedReviewItems = Object.entries(hospitalReviews).flatMap(([hospitalId, reviews]) => reviews.filter((review) => review.liked).map((review) => ({
    id: review.id,
    hospitalId,
    type: '리뷰',
    title: review.hospitalName || review.hospitalSnapshot?.name || '병원 리뷰',
    body: review.body || review.content || '',
    hospital: review.hospitalSnapshot,
  })))
  const likedCount = likedQnaItems.length + likedHospitals.length + likedReviewItems.length
  const attachAvatar = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => setAvatarUrl(typeof reader.result === 'string' ? reader.result : '')
    reader.readAsDataURL(file)
  }

  return (
      <section className="profile-screen">
        <div className="profile-panel-header">
          {view !== 'menu' && <button className="profile-back" type="button" onClick={() => setView('menu')}>{'\uB4A4\uB85C'}</button>}
          <div>
            <h2>{displayName}님</h2>
            <span>프로필</span>
          </div>
        </div>
        {view === 'menu' && (
          <>
            <button type="button" onClick={() => setView('profile')}>&#45236; &#51221;&#48372; &#49688;&#51221;</button>
            <button type="button" onClick={() => setView('posts')}>&#45236;&#44032; &#50420; &#44544;</button>
            <button type="button" onClick={() => setView('drafts')}>{'\uC784\uC2DC\uC800\uC7A5'}<span>{visibleDrafts.length}</span></button>
            <button type="button" onClick={() => setView('liked')}>좋아요한<span>{likedCount}</span></button>
            <button type="button" onClick={() => setView('logout')}>&#47196;&#44536;&#50500;&#50883;</button>
            <button className="danger" type="button" onClick={() => setView('delete-account')}>계정 삭제</button>
          </>
        )}
        {view === 'profile' && (
          <div className="profile-panel-content">
            <label>
              <span>{'\uC544\uC774\uB514'}</span>
              <input value={username} onChange={(event) => setUsername(event.target.value)} placeholder="username" />
            </label>
            <label>
              <span>{'\uB2C9\uB124\uC784'}</span>
              <input value={nickname} onChange={(event) => setNickname(event.target.value)} placeholder="nickname" />
            </label>
            <label>
              <span>{'\uD504\uB85C\uD544 \uC0AC\uC9C4'}</span>
              <span className="profile-file-button">사진 선택</span>
              <input type="file" accept="image/*" onChange={attachAvatar} />
            </label>
            {avatarUrl && <img className="profile-avatar-preview" src={avatarUrl} alt="profile preview" />}
            <button type="button" onClick={() => { onSaveProfile({ username, nickname, avatarUrl }); setProfileSaved(true) }}>{'\uC800\uC7A5'}</button>
            {profileSaved && <p>{'\uD504\uB85C\uD544 \uC815\uBCF4\uB97C \uC800\uC7A5\uD588\uC2B5\uB2C8\uB2E4.'}</p>}
          </div>
        )}
        {view === 'posts' && (
          <div className="profile-panel-content">
            {posts.length === 0 ? <p>아직 작성한 글이 없습니다.</p> : (
              <div className="profile-list">
                {posts.map((post) => (
                  <article key={`${post.type}-${post.id}`}>
                    <span>{post.type}</span>
                    <strong>{post.title}</strong>
                    <p>{post.body}</p>
                    <div className="profile-row-actions three">
                      <button type="button" onClick={() => onOpenWrittenPost(post.kind, post.id)}>열기</button>
                      <button type="button" onClick={() => onEditWrittenPost(post.kind, post.id)}>수정</button>
                      <button type="button" onClick={() => onDeleteWrittenPost(post.kind, post.id)}>삭제</button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        )}
        {view === 'drafts' && (
          <div className="profile-panel-content">
            {visibleDrafts.length === 0 ? <p>임시저장한 글이 없습니다.</p> : (
              <div className="profile-list">
                {visibleDrafts.map((draft) => (
                  <article key={draft.id}>
                    <span>{draftTypeLabel(draft.draftType)} · {formatReviewDate(draft.updatedAt)}</span>
                    <strong>{draft.title || '제목 없음'}</strong>
                    <p>{draft.body || '내용 없음'}</p>
                    <div className="profile-row-actions">
                      <button type="button" onClick={() => onContinueDraft(draft)}>이어쓰기</button>
                      <button type="button" onClick={() => onDeleteDraft(draft.id)}>삭제</button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        )}
        {view === 'liked' && (
          <div className="profile-panel-content">
            {likedCount === 0 ? <p>좋아요한 항목이 없습니다.</p> : (
              <div className="profile-list">
                {likedQnaItems.map((item) => (
                  <article key={`liked-${item.kind}-${item.id}`}>
                    <span>{item.type}</span>
                    <strong>{item.title}</strong>
                    <p>{item.body}</p>
                    <div className="profile-row-actions">
                      <button type="button" onClick={() => onOpenWrittenPost(item.kind, item.id)}>열기</button>
                    </div>
                  </article>
                ))}
                {likedHospitals.map((hospital) => (
                  <article key={`liked-hospital-${hospital.id ?? hospital.name}`}>
                    <span>병원</span>
                    <strong>{hospital.name}</strong>
                    <p>{hospital.address || '주소 정보 없음'}</p>
                    <div className="profile-row-actions">
                      <button type="button" onClick={() => onOpenHospital(hospital)}>열기</button>
                    </div>
                  </article>
                ))}
                {likedReviewItems.map((review) => (
                  <article key={`liked-review-${review.id}`}>
                    <span>{review.type}</span>
                    <strong>{review.title}</strong>
                    <p>{review.body}</p>
                    {review.hospital && (
                      <div className="profile-row-actions">
                        <button type="button" onClick={() => onOpenHospital(review.hospital!)}>병원 열기</button>
                      </div>
                    )}
                  </article>
                ))}
              </div>
            )}
          </div>
        )}
        {view === 'logout' && (
          <div className="profile-panel-content">
            <p>현재 계정에서 로그아웃합니다.</p>
            <button type="button" onClick={onSignOut}>&#47196;&#44536;&#50500;&#50883;</button>
          </div>
        )}
        {view === 'delete-account' && (
          <div className="profile-panel-content">
            <div className="profile-danger-box">
              <strong>계정 삭제</strong>
              <p>계정을 삭제하면 프로필, 마이 펫, 기록, 글, 임시저장 데이터가 함께 삭제됩니다.</p>
            </div>
            <label>
              <span>확인 문구</span>
              <input value={deleteConfirm} onChange={(event) => setDeleteConfirm(event.target.value)} placeholder="계정 삭제" />
            </label>
            <button
              className="danger"
              type="button"
              disabled={deleteConfirm !== '계정 삭제' || deletingAccount}
              onClick={async () => {
                setDeletingAccount(true)
                try {
                  await onDeleteAccount()
                } finally {
                  setDeletingAccount(false)
                }
              }}
            >
              {deletingAccount ? '삭제 중...' : '계정 삭제'}
            </button>
          </div>
        )}
      </section>
  )
}

function draftTypeLabel(type: DraftKind) {
  if (type === 'question') return 'QNA'
  if (type === 'share_item') return '나눔'
  if (type === 'pet') return '마이펫'
  if (type === 'care_record') return '기록'
  if (type === 'reminder') return '알림'
  return '병원 리뷰'
}

function MapScreen({ userId, profile, pets, focusHospital, reviewDraft, reviews, likedHospitals, onReviewsChange, onLikedHospitalsChange, onSaveDraft, onDeleteDraft }: { userId: string; profile: AppProfile; pets: Pet[]; focusHospital?: HospitalSnapshot | null; reviewDraft?: DraftItem | null; reviews: Record<string, HospitalReview[]>; likedHospitals: HospitalSnapshot[]; onReviewsChange: (reviews: Record<string, HospitalReview[]>) => void; onLikedHospitalsChange: (hospitals: HospitalSnapshot[]) => void; onSaveDraft: (draft: DraftItem) => void | Promise<void>; onDeleteDraft: (draftId: string) => void | Promise<void> }) {
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
  const [reviewPetId, setReviewPetId] = useState(pets[0]?.id ?? '')
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

  const submitReview = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!selectedHospital || !reviewPetId || reviewBody.trim().length === 0) return

    const reviewPet = pets.find((pet) => pet.id === reviewPetId)

    const review: HospitalReview = {
      id: reviewDraftPayload?.review.id ?? crypto.randomUUID(),
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
      liked: reviewDraftPayload?.review.liked ?? false,
      likes: reviewDraftPayload?.review.likes ?? 0,
      hospitalName: selectedHospital.name,
      hospitalSnapshot: toHospitalSnapshot(selectedHospital),
      createdAt: reviewDraftPayload?.review.createdAt ?? new Date().toISOString(),
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
    setIsReviewFormOpen(false)
    if (reviewDraft) void onDeleteDraft(reviewDraft.id)
  }

  const saveReviewDraft = () => {
    if (!selectedHospital) return
    const review: HospitalReview = {
      id: reviewDraftPayload?.review.id ?? crypto.randomUUID(),
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
      liked: reviewDraftPayload?.review.liked ?? false,
      likes: reviewDraftPayload?.review.likes ?? 0,
      hospitalName: selectedHospital.name,
      hospitalSnapshot: toHospitalSnapshot(selectedHospital),
      createdAt: reviewDraftPayload?.review.createdAt ?? new Date().toISOString(),
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
              <button type="button" onClick={() => setIsReviewFormOpen((value) => !value)}>리뷰 작성</button>
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
                    <HospitalReviewItem review={review} fallbackAuthor={profileReviewAuthor} key={review.id} onToggleLike={() => toggleReviewLike(selectedHospital.id, review.id)} />
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

function HospitalReviewItem({ review, fallbackAuthor, onToggleLike }: { review: HospitalReview; fallbackAuthor: string; onToggleLike: () => void }) {
  const authorName = review.author && review.author !== '익명' ? review.author : fallbackAuthor
  return (
    <article className="review-item">
      <div><strong>{authorName}</strong><span>{review.rating}점</span></div>
      <small>{[review.petName, review.animalCategory ? animalCategoryLabels[review.animalCategory] : '', review.species, review.visitDate, review.cost ? `${review.cost.toLocaleString('ko-KR')}원` : ''].filter(Boolean).join(' · ')}</small>
      {(review.diagnosis || review.treatment) && <small>{[review.diagnosis, review.treatment].filter(Boolean).join(' · ')}</small>}
      <p>{review.body || review.content}</p>
      {review.tags && review.tags.length > 0 && <div className="review-item-tags">{review.tags.map((tag) => <span key={tag}>{tag}</span>)}</div>}
      <footer className="review-item-footer">
        <time dateTime={review.createdAt}>{formatReviewDate(review.createdAt)}</time>
        <button className={`review-like-button ${review.liked ? 'active' : ''}`} type="button" onClick={onToggleLike}>
          좋아요 {review.likes ?? 0}
        </button>
      </footer>
    </article>
  )
}

function PetsScreen({ userId, pets, onDeletePet, onEditPet, onOpenDiary, onRegisterPet }: { userId: string; pets: Pet[]; onDeletePet: (petId: string) => void; onEditPet: (pet: Pet) => void; onOpenDiary: (petId: string) => void; onRegisterPet: () => void }) {
  const [query, setQuery] = useState('')
  const [selectedCategories, setSelectedCategories] = useState<Exclude<AnimalCategory, 'all'>[]>([])
  const sort: 'latest' | 'oldest' = 'latest'
  const [records, setRecords] = useState<PetRecord[]>([])
  const [dailyTasks, setDailyTasks] = useState<DailyTask[]>([])
  const [recordStatus, setRecordStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle')
  const [planStatus, setPlanStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle')
  const [menuPetId, setMenuPetId] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Pet | null>(null)
  const [detailPet, setDetailPet] = useState<Pet | null>(null)

  useEffect(() => {
    let active = true
    const today = toDateKey(new Date())
    queueMicrotask(() => {
      if (!active) return
      setRecordStatus('loading')
      setPlanStatus('loading')
    })
    loadAppData<PetRecord>('care_records', { userId, scope: 'mine' }).then((items) => {
      if (!active) return
      setRecords(items)
      setRecordStatus('ready')
    }).catch(() => {
      if (!active) return
      setRecords([])
      setRecordStatus('error')
    })
    listDailyTasks(userId, today, today).then((items) => {
      if (!active) return
      setDailyTasks(items)
      setPlanStatus('ready')
    }).catch(() => {
      if (!active) return
      setDailyTasks([])
      setPlanStatus('error')
    })
    return () => { active = false }
  }, [pets.length, userId])

  const filteredPets = pets.filter((pet) => {
    const text = `${pet.name} ${pet.species} ${animalCategoryLabels[pet.group]}`.toLowerCase()
    return (selectedCategories.length === 0 || (pet.group !== 'all' && selectedCategories.includes(pet.group))) && text.includes(query.trim().toLowerCase())
  }).sort((a, b) => {
    const aDate = new Date(a.registeredAt ?? 0).getTime()
    const bDate = new Date(b.registeredAt ?? 0).getTime()
    return sort === 'latest' ? bDate - aDate : aDate - bDate
  })

  const recentRecords = (petId: string) => records.filter((record) => record.petId === petId).sort((a, b) => `${b.date}${b.occurredAt ?? b.createdAt}`.localeCompare(`${a.date}${a.occurredAt ?? a.createdAt}`)).slice(0, 4)
  const planSummary = (petId: string) => {
    const tasks = dailyTasks.filter((task) => task.petId === petId)
    const completed = tasks.filter((task) => task.status === 'completed').length
    const pending = tasks.filter((task) => task.status === 'pending')
    const percent = tasks.length ? Math.round((completed / tasks.length) * 100) : 0
    return { tasks, completed, pending, percent, nextTask: pending[0] }
  }
  const latestRecord = (petId: string) => recentRecords(petId)[0]
  const openDeleteConfirm = (pet: Pet) => {
    setMenuPetId(null)
    setDeleteTarget(pet)
  }
  const confirmDelete = () => {
    if (!deleteTarget) return
    onDeletePet(deleteTarget.id)
    setDeleteTarget(null)
  }
  const toggleCategory = (item: AnimalCategory) => {
    if (item === 'all') {
      setSelectedCategories([])
      return
    }
    setSelectedCategories((current) => current.includes(item) ? current.filter((category) => category !== item) : [...current, item])
  }

  return (
    <section className="page-stack my-pet-dashboard">
      <section className="section-block my-pet-tools my-pet-dashboard-panel">
        <div className="my-pet-dashboard-heading"><div><h2>마이 펫</h2><p>반려동물 관리</p></div></div>
        <label className="my-pet-search"><span>동물 검색</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="이름, 종, 분류 검색" /></label>
        <div className="filter-tags" aria-label="동물 분류 필터">
          {animalCategoryOptions.map((item) => (
            <button className={(item === 'all' ? selectedCategories.length === 0 : selectedCategories.includes(item)) ? 'active' : ''} type="button" key={item} onClick={() => toggleCategory(item)} aria-pressed={item === 'all' ? selectedCategories.length === 0 : selectedCategories.includes(item)}>
              <CategoryTagIcon category={item} /><span>{animalCategoryLabels[item]}</span>
            </button>
          ))}
        </div>
      </section>
      <section className="section-block my-pet-section my-pet-dashboard-panel">
        <div className="pet-list-toolbar"><div className="section-title"><h2>등록된 펫</h2><span>{filteredPets.length}마리</span></div></div>
        {filteredPets.length === 0 ? <div className="pet-empty-state"><strong>{pets.length === 0 ? '등록된 펫 없음' : '해당 분류에 펫 없음'}</strong><p>{pets.length === 0 ? '첫 펫을 등록해보세요.' : '필터를 바꿔보세요.'}</p>{pets.length === 0 && <button type="button" onClick={onRegisterPet}>+ 펫 등록</button>}</div> : (
          <div className="pet-list card-view">
            {filteredPets.map((pet) => (
              <article className="pet-card pet-management-card" key={pet.id} role="button" tabIndex={0} onClick={() => onOpenDiary(pet.id)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onOpenDiary(pet.id) } }}>
                <div className="pet-card-topline">
                  <span className="pet-card-click-hint">관리 요약</span>
                  <div className="pet-card-actions">
                    <button className="pet-more-button" type="button" aria-label={`${pet.name} 수정 및 삭제 메뉴`} onClick={(event) => { event.stopPropagation(); setMenuPetId(menuPetId === pet.id ? null : pet.id) }}>⋮</button>
                    {menuPetId === pet.id && <div className="pet-more-menu"><button type="button" onClick={(event) => { event.stopPropagation(); setMenuPetId(null); onEditPet(pet) }}>수정</button><button className="danger" type="button" onClick={(event) => { event.stopPropagation(); openDeleteConfirm(pet) }}>삭제</button></div>}
                  </div>
                </div>
                {(() => {
                  const summary = planSummary(pet.id)
                  const record = latestRecord(pet.id)
                  return <>
                <div className="pet-card-main">
                  <div className="pet-card-visual">
                    <div className="pet-card-icon">{pet.photo ? <img src={pet.photo} alt={`${pet.name} 사진`} /> : <CategoryTagIcon category={pet.group} />}</div>
                  </div>
                  <div className="pet-card-body">
                    <div className="pet-card-identity"><strong>{pet.name}</strong><small>{pet.species || animalCategoryLabels[pet.group]}</small></div>
                    <div className="pet-card-meta"><span>{animalCategoryLabels[pet.group]}</span><span>{genderLabel(pet.gender)}</span>{pet.weight && <span>{pet.weight}{pet.weightUnit ?? 'g'}</span>}</div>
                    {pet.description && <p className="pet-description">{pet.description}</p>}
                  </div>
                </div>
                <div className="pet-today-summary">
                  <div className="pet-summary-head">
                    <strong>오늘의 관리</strong>
                    {planStatus === 'ready' && summary.tasks.length > 0 && <span>{summary.completed}/{summary.tasks.length} 완료</span>}
                  </div>
                  {planStatus === 'loading' && <p>관리 정보를 불러오는 중</p>}
                  {planStatus === 'error' && <p>오늘 관리 확인 불가</p>}
                  {planStatus === 'ready' && summary.tasks.length === 0 && <p>오늘 예정된 관리가 없다.</p>}
                  {planStatus === 'ready' && summary.tasks.length > 0 && <>
                    <div className="pet-plan-progress" role="img" aria-label={`오늘 관리 ${summary.tasks.length}개 중 ${summary.completed}개 완료, ${summary.percent}%`}>
                      <span style={{ width: `${summary.percent}%` }} />
                    </div>
                    <p>{summary.pending.length === 0 ? '오늘 루틴 완료' : `남은 루틴 · ${dailyTaskLabel(summary.nextTask!)}`}</p>
                  </>}
                </div>
                {recordStatus === 'ready' && record && <p className="pet-latest-record"><b>최근</b>{formatPetRecordSummary(record)}</p>}
                {recordStatus === 'loading' && <p className="pet-latest-record muted">최근 기록 확인 중</p>}
                <div className="pet-card-footer"><button type="button" title="루틴 관리하기" onClick={(event) => { event.stopPropagation(); onOpenDiary(pet.id) }}>관리하기 →</button>
                </div>
                </>
                })()}
              </article>
            ))}
          </div>
        )}
      </section>
      {detailPet && <PetDetailModal pet={detailPet} records={recentRecords(detailPet.id)} onClose={() => setDetailPet(null)} onEdit={() => { setDetailPet(null); onEditPet(detailPet) }} onOpenDiary={() => onOpenDiary(detailPet.id)} />}
      {deleteTarget && <DeletePetModal pet={deleteTarget} onCancel={() => setDeleteTarget(null)} onConfirm={confirmDelete} />}
    </section>
  )
}

function formatPetDate(value?: string) {
  if (!value) return '정보 없음'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '정보 없음'
  return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')}`
}

function dailyTaskLabel(task: DailyTask) {
  if (task.taskType === 'feed') return '먹이'
  if (task.taskType === 'water') return '물 교체'
  if (task.taskType === 'cleaning') return '청소'
  if (task.taskType.startsWith('medicine|')) return task.taskType.split('|')[1] || '약'
  return task.taskType || '관리'
}

function formatPetRecordSummary(record: PetRecord) {
  const dateTime = record.occurredAt ?? record.createdAt
  const date = new Date(dateTime)
  const today = toDateKey(new Date())
  const when = Number.isNaN(date.getTime())
    ? formatPetDate(record.date)
    : record.date === today
      ? `오늘 ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
      : formatPetDate(record.date)
  const detail = record.memo?.trim() || (record.type === 'food' && record.foods?.length ? record.foods.join(', ') : '') || (record.weight !== undefined ? `${record.weight}g` : '')
  return `${when} · ${recordTypeLabels[record.type]}${detail ? ` · ${detail}` : ''}`
}

function PetDetailModal({ pet, records, onClose, onEdit, onOpenDiary }: { pet: Pet; records: PetRecord[]; onClose: () => void; onEdit: () => void; onOpenDiary: () => void }) {
  return (
    <div className="pet-detail-overlay">
      <button className="overlay-dim" type="button" aria-label="펫 상세 닫기" onClick={onClose} />
      <section className="pet-detail-modal" role="dialog" aria-modal="true" aria-label={`${pet.name} 상세 정보`}>
        <button className="pet-detail-close" type="button" aria-label="닫기" onClick={onClose}>×</button>
        <div className="pet-detail-hero">{pet.photo ? <img src={pet.photo} alt={`${pet.name} 사진`} /> : <div className="pet-card-icon"><CategoryTagIcon category={pet.group} /></div>}<div><span>{animalCategoryLabels[pet.group]}</span><h2>{pet.name}</h2><p>{pet.species} · {genderLabel(pet.gender)}</p></div></div>
        <div className="pet-detail-grid"><div><b>성별</b><span>{genderLabel(pet.gender)}</span></div><div><b>나이</b><span>{pet.ageText || pet.ageStage || '정보 없음'}</span></div><div><b>등록일</b><span>{formatPetDate(pet.registeredAt)}</span></div><div><b>무게</b><span>{pet.weight ? `${pet.weight}${pet.weightUnit ?? 'g'}` : '정보 없음'}</span></div></div>
        <section className="pet-detail-records"><h3>최근 기록</h3>{records.length === 0 ? <p>아직 작성된 기록이 없습니다.</p> : records.map((record) => <div key={record.id}><span>{recordTypeLabels[record.type]}{record.weight ? ` ${record.weight}g` : ''}</span><time>{formatPetDate(record.date)}</time></div>)}</section>
        <div className="pet-detail-actions"><button type="button" onClick={onOpenDiary}>루틴 관리하기</button><button type="button" onClick={onEdit}>수정</button></div>
      </section>
    </div>
  )
}

function DeletePetModal({ pet, onCancel, onConfirm }: { pet: Pet; onCancel: () => void; onConfirm: () => void }) {
  return (
    <div className="pet-detail-overlay">
      <button className="overlay-dim" type="button" aria-label="삭제 확인 닫기" onClick={onCancel} />
      <section className="delete-pet-modal" role="dialog" aria-modal="true" aria-label="펫 삭제 확인">
        <h2>‘{pet.name}’을 삭제하시겠습니까?</h2>
        <p>관련 기록도 함께 삭제될 수 있습니다.</p>
        <div><button type="button" onClick={onCancel}>취소</button><button className="danger" type="button" onClick={onConfirm}>삭제</button></div>
      </section>
    </div>
  )
}

function QnaScreen({ userId, profile, posts, openPostId, onOpenHandled, onChange, onDeletePost, onEditPost, onOpenHospital, onOpenDiary }: { userId: string; profile: AppProfile; posts: QnaPost[]; openPostId?: string | null; onOpenHandled?: () => void; onChange: (posts: QnaPost[]) => void; onDeletePost: (postId: string) => void; onEditPost: (post: QnaPost) => void; onOpenHospital: (hospital: HospitalSnapshot) => void; onOpenDiary: (petId: string, readOnly: boolean) => void }) {
  const [sort, setSort] = useState<QnaSort>('latest')
  const [sortSheetOpen, setSortSheetOpen] = useState(false)
  const [feedCategory, setFeedCategory] = useState<QnaCategory | null>(null)
  const [visibleCount, setVisibleCount] = useState(6)
  const [query, setQuery] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [comment, setComment] = useState('')
  const [attachedHospital, setAttachedHospital] = useState<HospitalSnapshot | null>(null)
  const [hospitalPickerOpen, setHospitalPickerOpen] = useState(false)
  const [commentsByPost, setCommentsByPost] = useState<Record<string, QnaComment[]>>({})
  const selected = posts.find((post) => post.id === selectedId)
  const selectedComments = selected ? commentsByPost[selected.id] ?? selected.comments : []
  useEffect(() => {
    let active = true
    supabase.from('post_comments').select('id, post_id, user_id, body, created_at, payload').then(({ data, error }) => {
      if (!active || error) return
      const grouped: Record<string, QnaComment[]> = {}
      for (const row of data ?? []) {
        const payload = (row.payload ?? {}) as { author?: string; hospitalSnapshot?: HospitalSnapshot }
        const item: QnaComment = { id: row.id, author: payload.author ?? (row.user_id === userId ? '나' : '작성자'), body: row.body, createdAt: row.created_at, mine: row.user_id === userId, hospitalSnapshot: payload.hospitalSnapshot }
        grouped[row.post_id] = [...(grouped[row.post_id] ?? []), item]
      }
      setCommentsByPost(grouped)
    })
    return () => { active = false }
  }, [userId, posts.length])
  useEffect(() => {
    if (!openPostId) return
    // This effect consumes a profile deep-link into the selected post.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSelectedId(openPostId)
    onOpenHandled?.()
  }, [openPostId, onOpenHandled])
  const searchedPosts = posts.filter((post) => {
    const text = `${post.title} ${post.body} ${post.author} ${post.animalGroup ?? ''} ${post.animalSpecies ?? post.animal}`.toLowerCase()
    return text.includes(query.trim().toLowerCase())
  })
  const scopedPosts = feedCategory ? searchedPosts.filter((post) => normalizeQnaCategory(post.category) === feedCategory) : searchedPosts
  const feedPosts = buildQnaFeedPosts(scopedPosts, sort)
  const visiblePosts = feedPosts.slice(0, visibleCount)

  const updatePost = (post: QnaPost) => onChange(posts.map((item) => item.id === post.id ? post : item))
  const toggleLike = (post: QnaPost) => updatePost({ ...post, liked: !post.liked, likes: Math.max(0, post.likes + (post.liked ? -1 : 1)) })
  const toggleStatus = (post: QnaPost) => updatePost({ ...post, status: qnaStatus(post) === 'resolved' ? 'unresolved' : 'resolved' })
  const selectAnswer = (post: QnaPost, commentId: string) => updatePost(post.selectedAnswerCommentId === commentId ? { ...post, status: 'unresolved', selectedAnswerCommentId: undefined } : { ...post, status: 'resolved', selectedAnswerCommentId: commentId })
  const addComment = async (event: FormEvent) => {
    event.preventDefault()
    if (!selected || (!comment.trim() && !attachedHospital)) return
    const newComment: QnaComment = { id: crypto.randomUUID(), author: '나', body: comment.trim(), createdAt: new Date().toISOString(), mine: true, hospitalSnapshot: attachedHospital ?? undefined }
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
          <strong>QNA</strong>
          {selected.mine === true && <div className="item-actions"><button type="button" aria-label="수정" title="수정" onClick={() => onEditPost(selected)}>✎</button><ItemActions onDelete={() => { onDeletePost(selected.id); setSelectedId(null) }} /></div>}
        </header>
        <article className="qna-detail-post">
          <div className="qna-detail-badges"><span className="qna-category">{normalizeQnaCategory(selected.category)}</span><span className={`qna-status ${qnaStatus(selected)}`}>{qnaStatusLabel(qnaStatus(selected))}</span></div>
          <h2>{selected.title}</h2>
          <div className="qna-author"><UserAvatar url={selected.authorAvatarUrl || (selected.mine === true ? profile.avatarUrl : '')} name={selected.author} /><div><strong>{selected.author}</strong><span>{formatQnaAnimal(selected)} · {formatQnaDate(selected.createdAt)}</span></div></div>
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
              <div><strong>{item.author}</strong><time>{formatQnaDate(item.createdAt)}</time></div>
              {selected.selectedAnswerCommentId === item.id && <span className="accepted-answer-chip">채택 답변</span>}
              {item.body && <p>{item.body}</p>}
              {item.hospitalSnapshot && <HospitalAttachCard hospital={item.hospitalSnapshot} mode="posted" onOpen={() => onOpenHospital(item.hospitalSnapshot!)} />}
              {selected.mine === true && <button className="qna-accept-button" type="button" onClick={() => selectAnswer(selected, item.id)}>{selected.selectedAnswerCommentId === item.id ? '채택 취소' : '답변 채택'}</button>}
              {item.mine && <button type="button" onClick={async () => { await supabase.from('post_comments').delete().eq('id', item.id).eq('user_id', userId); setCommentsByPost((items) => ({ ...items, [selected.id]: (items[selected.id] ?? []).filter((commentItem) => commentItem.id !== item.id) })) }}>삭제</button>}
            </article>
          ))}
          <form onSubmit={addComment}>
            {attachedHospital && <HospitalAttachCard hospital={attachedHospital} mode="draft" onRemove={() => setAttachedHospital(null)} />}
            <div className="qna-comment-tools">
              <button type="button" onClick={() => setHospitalPickerOpen(true)}>병원 첨부</button>
            </div>
            <div className="qna-comment-input-row">
              <input value={comment} onChange={(event) => setComment(event.target.value)} placeholder="댓글을 입력하세요" aria-label="댓글" />
              <button type="submit">등록</button>
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
        <button className="qna-feed-sort-trigger" type="button" onClick={() => setSortSheetOpen(true)}>정렬: {qnaSortLabel(sort)} ▾</button>
      </header>
      <label className="qna-feed-search"><span aria-hidden="true">⌕</span><input value={query} onChange={(event) => { setQuery(event.target.value); setVisibleCount(6) }} placeholder="예: 먹이를 안 먹어요, 크레스티드 게코" /></label>
      <div className="qna-category-rail" aria-label="QNA 카테고리 안내">
        {qnaCategoryCards.map((categoryItem) => (
          <button className={feedCategory === categoryItem ? 'active' : ''} type="button" key={categoryItem} onClick={() => { setFeedCategory(feedCategory === categoryItem ? null : categoryItem); setVisibleCount(6) }}>
            <strong>{categoryItem}</strong>
          </button>
        ))}
        {feedCategory && <button className="qna-feed-clear" type="button" onClick={() => { setFeedCategory(null); setVisibleCount(6) }}>전체 질문 보기</button>}
      </div>
      {feedPosts.length === 0 ? <div className="qna-empty-state">
        <div className="qna-empty-icon" aria-hidden="true">⌕</div>
        <strong>아직 등록된 질문이 없어요.</strong>
      </div> : (
        <section className="qna-feed-section">
          <div className="qna-feed-list">
                {visiblePosts.map((post) => <QnaHelpCard post={post} fallbackAvatarUrl={post.mine === true ? profile.avatarUrl : ''} key={post.id} onOpen={() => setSelectedId(post.id)} onDelete={post.mine === true ? () => onDeletePost(post.id) : undefined} />)}
          </div>
          {visiblePosts.length < feedPosts.length && <button className="qna-load-more" type="button" onClick={() => setVisibleCount((count) => count + 6)}>더보기</button>}
        </section>
      )}
      {sortSheetOpen && <QnaSortSheet value={sort} onChange={(value) => { setSort(value); setVisibleCount(6); setSortSheetOpen(false) }} onClose={() => setSortSheetOpen(false)} />}
    </section>
  )
}

function QnaHelpCard({ post, fallbackAvatarUrl, onOpen, onDelete }: { post: QnaPost; fallbackAvatarUrl?: string; onOpen: () => void; onDelete?: () => void }) {
  const record = post.attachedRecordSnapshot
  const diary = post.attachedDiarySnapshot
  return (
    <article className={`qna-help-card ${qnaStatus(post)}`} onClick={onOpen}>
      <div className="qna-help-card-top">
        <span className={`qna-status ${qnaStatus(post)}`}>{qnaStatusLabel(qnaStatus(post))}</span>
        <span className="qna-category">{normalizeQnaCategory(post.category)}</span>
        {onDelete && <button className="qna-feed-delete" type="button" onClick={(event) => { event.stopPropagation(); onDelete() }}>삭제</button>}
      </div>
      <h3>{post.title}</h3>
      <p className="qna-help-card-preview">{post.body}</p>
      <footer>
        <span>{formatQnaAnimal(post)}</span>
        <span>댓글 {post.comments.length}</span>
        <span>{formatQnaDate(post.createdAt)}</span>
        <span className="post-author"><UserAvatar url={post.authorAvatarUrl || fallbackAvatarUrl} name={post.author} />{post.author}</span>
      </footer>
      {(post.image || record || diary) && <div className="qna-attach-flags">{post.image && <span>사진 첨부</span>}{diary && <span>전체 기록 첨부 · {diary.totalCount}개</span>}{!diary && record && <span>기록 첨부 · {formatRecordDate(record.recordDate)}</span>}</div>}
    </article>
  )
}

function QnaSortSheet({ value, onChange, onClose }: { value: QnaSort; onChange: (value: QnaSort) => void; onClose: () => void }) {
  const options: QnaSort[] = ['needsAnswer', 'latest', 'comments', 'resolved']
  return (
    <div className="qna-sort-sheet-overlay">
      <button className="qna-sort-sheet-dim" type="button" aria-label="정렬 닫기" onClick={onClose} />
      <section className="qna-sort-sheet" role="dialog" aria-modal="true" aria-label="QNA 정렬">
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

type BoardFilter = {
  id: string
  label: ReactNode
  active?: boolean
  ariaLabel?: string
  iconOnly?: boolean
  onClick: () => void
}

function BoardSurface({ className = '', title, count, query, onQueryChange, placeholder, filters, controlsOrder = 'search-first', children }: { className?: string; title: string; count: number; query: string; onQueryChange: (value: string) => void; placeholder: string; filters: BoardFilter[]; controlsOrder?: 'search-first' | 'filters-first'; children: ReactNode }) {
  const searchControl = <label className="board-search"><span aria-hidden="true">⌕</span><input value={query} onChange={(event) => onQueryChange(event.target.value)} placeholder={placeholder} /></label>
  const filterControl = (
    <div className="share-filter-row">
      {filters.map((filter) => (
        <button className={`${filter.active ? 'active' : ''}${filter.iconOnly ? ' filter-all-button' : ''}`.trim()} type="button" key={filter.id} aria-label={filter.ariaLabel} onClick={filter.onClick}>
          {filter.iconOnly ? <><span /><span /><span /></> : filter.label}
        </button>
      ))}
    </div>
  )

  return (
    <section className={`page-stack board-page ${className}`.trim()}>
      <section className="share-board">
        <div className="section-title"><h2>{title}</h2><span>{count}</span></div>
        {controlsOrder === 'filters-first' ? <>{filterControl}{searchControl}</> : <>{searchControl}{filterControl}</>}
        {children}
      </section>
    </section>
  )
}

function ShareScreen({ items, openItemId, onOpenHandled, onItemsChange, onSaveItem, onDeleteItem, onEditItem }: { items: ShareItem[]; openItemId?: string | null; onOpenHandled?: () => void; onItemsChange: (items: ShareItem[]) => void; onSaveItem: (item: ShareItem) => void; onDeleteItem: (itemId: string) => void; onEditItem: (item: ShareItem) => void }) {
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<ShareStatus>('active')
  const [category, setCategory] = useState<'all' | ShareCategory>('all')
  const [gender, setGender] = useState<'all' | Pet['gender']>('all')
  const [sort, setSort] = useState<ShareSort>('latest')
  const [openFilter, setOpenFilter] = useState<'status' | 'category' | 'sort' | 'gender' | 'all' | null>(null)
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null)
  const normalized = items.map((item) => ({ ...item, mine: item.mine === true, status: item.status ?? 'active' as ShareStatus, category: item.category ?? 'supplies' as ShareCategory, subcategory: item.subcategory ?? '', species: item.species ?? '', gender: item.gender ?? 'unknown' as const, imageUrl: item.imageUrl ?? '', createdAt: item.createdAt ?? new Date(0).toISOString(), likes: item.likes ?? 0, liked: item.liked ?? false }))
  const selectedItem = normalized.find((item) => item.id === selectedItemId)
  useEffect(() => {
    if (!openItemId) return
    const item = normalized.find((shareItem) => shareItem.id === openItemId)
    if (item) {
      // This effect consumes a profile deep-link into the selected item.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setStatus(item.status)
      setSelectedItemId(item.id)
    }
    onOpenHandled?.()
  }, [openItemId, onOpenHandled, normalized])
  const filtered = normalized.filter((item) => item.status === status).filter((item) => category === 'all' || item.category === category).filter((item) => gender === 'all' || item.gender === gender).filter((item) => `${item.title} ${item.subcategory} ${item.species} ${item.memo}`.toLowerCase().includes(query.trim().toLowerCase())).sort((a, b) => sort === 'popular' ? b.likes - a.likes : b.createdAt.localeCompare(a.createdAt))
  const categoryLabels = { all: '전체', ...shareCategoryLabels }
  const statusLabels = { active: '진행중', completed: '완료' }
  const sortLabels = { latest: '최신순', popular: '인기순' }
  const genderLabels = { all: '전체', male: '수컷', female: '암컷', unknown: '미구분' }
  const setStatusFilter = (value: string) => {
    setStatus(value as ShareStatus)
  }
  const setCategoryFilter = (value: string) => {
    setCategory(value as 'all' | ShareCategory)
  }
  const setSortFilter = (value: string) => {
    setSort(value as ShareSort)
  }
  const setGenderFilter = (value: string) => {
    setGender(value as 'all' | Pet['gender'])
  }
  const toggleLike = (id: string) => {
    const next = normalized.map((item) => item.id === id ? { ...item, liked: !item.liked, likes: Math.max(0, item.likes + (item.liked ? -1 : 1)) } : item)
    onItemsChange(next)
    const changed = next.find((item) => item.id === id)
    if (changed) onSaveItem(changed)
  }
  const toggleShareStatus = (id: string) => {
    const target = normalized.find((item) => item.id === id)
    if (!target?.mine) return
    const next = normalized.map((item) => item.id === id ? { ...item, status: item.status === 'completed' ? 'active' as ShareStatus : 'completed' as ShareStatus } : item)
    onItemsChange(next)
    const changed = next.find((item) => item.id === id)
    if (changed) onSaveItem(changed)
  }
  if (selectedItem) {
    return (
      <section className="share-detail">
        <header className="qna-detail-header">
          <button className="qna-back" type="button" aria-label="뒤로가기" onClick={() => setSelectedItemId(null)}>←</button>
          <strong>나눔</strong>
          <div className="share-detail-header-actions">
            {selectedItem.mine && <><button className="share-edit-button" type="button" onClick={() => onEditItem(selectedItem)}>수정</button><ItemActions onDelete={() => { onDeleteItem(selectedItem.id); setSelectedItemId(null) }} /></>}
          </div>
        </header>
        <article className="qna-detail-post">
          <div className="qna-detail-badges"><span className="qna-category">{shareCategoryLabels[selectedItem.category]}</span><span>{selectedItem.area || '지역 미입력'}</span></div>
          <h2>{selectedItem.title}</h2>
          {selectedItem.imageUrl && <img src={selectedItem.imageUrl} alt="" />}
          <p>{selectedItem.memo}</p>
          <div className="qna-detail-actions">
            <button className={`qna-like ${selectedItem.liked ? 'active' : ''}`} type="button" onClick={() => toggleLike(selectedItem.id)}>♥ {selectedItem.likes}</button>
            {selectedItem.mine && <button className="qna-status-toggle" type="button" onClick={() => toggleShareStatus(selectedItem.id)}>{selectedItem.status === 'completed' ? '다시 나눔중' : '나눔 완료'}</button>}
          </div>
        </article>
      </section>
    )
  }
  return (
    <BoardSurface
      className="share-page"
      title="무료분양/나눔"
      count={filtered.length}
      query={query}
      onQueryChange={setQuery}
      placeholder="제목, 물품 이름, 동물 종, 내용 검색"
      filters={[
        { id: 'status', label: statusLabels[status], active: openFilter === 'status' || status !== 'active', onClick: () => setOpenFilter(openFilter === 'status' ? null : 'status') },
        { id: 'category', label: category === 'all' ? '종류' : shareCategoryLabels[category], active: openFilter === 'category' || category !== 'all', onClick: () => setOpenFilter(openFilter === 'category' ? null : 'category') },
        { id: 'sort', label: sortLabels[sort], active: openFilter === 'sort' || sort !== 'latest', onClick: () => setOpenFilter(openFilter === 'sort' ? null : 'sort') },
        { id: 'gender', label: gender === 'all' ? '성별' : genderLabel(gender), active: openFilter === 'gender' || gender !== 'all', onClick: () => setOpenFilter(openFilter === 'gender' ? null : 'gender') },
        { id: 'all', label: '전체 필터', active: openFilter === 'all', iconOnly: true, ariaLabel: '전체 필터', onClick: () => setOpenFilter(openFilter === 'all' ? null : 'all') },
      ]}
    >
        {openFilter && <div className="share-filter-panel">
          {(openFilter === 'status' || openFilter === 'all') && <FilterGroup title="상태" options={['active', 'completed']} value={status} labels={statusLabels} onChange={setStatusFilter} />}
          {(openFilter === 'category' || openFilter === 'all') && <FilterGroup title="종류" options={['all', ...Object.keys(shareCategoryLabels)]} value={category} labels={categoryLabels} onChange={setCategoryFilter} />}
          {(openFilter === 'sort' || openFilter === 'all') && <FilterGroup title="정렬" options={['latest', 'popular']} value={sort} labels={sortLabels} onChange={setSortFilter} />}
          {(openFilter === 'gender' || openFilter === 'all') && <FilterGroup title="성별" options={['all', 'male', 'female', 'unknown']} value={gender} labels={genderLabels} onChange={setGenderFilter} />}
        </div>}
          {filtered.length === 0 ? <div className="share-empty"><strong>{status === 'completed' ? '완료된 글이 없습니다' : '게시글이 없습니다'}</strong><p>{status === 'completed' ? '나눔 완료 처리한 글이 이곳에 모입니다.' : '조건을 바꾸거나 첫 무료분양/나눔 글을 작성해 보세요.'}</p></div> : <div className="share-card-grid">
            {filtered.map((item) => (
              <article className={`share-card ${item.status === 'completed' ? 'completed' : ''}`} key={item.id} onClick={() => setSelectedItemId(item.id)}>
                <div className="share-card-media">{item.imageUrl ? <img src={item.imageUrl} alt="" /> : <span>사진 없음</span>}<button className={item.liked ? 'liked' : ''} type="button" aria-label="좋아요" onClick={(event) => { event.stopPropagation(); toggleLike(item.id) }}>♥</button></div>
                <div className="share-card-body"><strong>{item.title}</strong><p>{item.species || item.subcategory}</p><div className="share-card-tags">{item.status === 'completed' && <span className="share-status-tag">완료</span>}<span>{shareCategoryLabels[item.category]}</span>{!['food', 'supplies'].includes(item.category) && <span>{genderLabel(item.gender)}</span>}</div><div className="share-card-meta"><span>{item.area || '지역 미입력'} · ♥ {item.likes}</span>{item.mine && <ItemActions onDelete={() => onDeleteItem(item.id)} />}</div>{item.mine && <div className="share-card-actions"><button className="share-edit-button" type="button" onClick={(event) => { event.stopPropagation(); onEditItem(item) }}>수정</button><button className="share-complete-button" type="button" onClick={(event) => { event.stopPropagation(); toggleShareStatus(item.id) }}>{item.status === 'completed' ? '다시 나눔중' : '나눔 완료'}</button></div>}</div>
              </article>
            ))}
          </div>}
    </BoardSurface>
  )
}

function HospitalPicker({ onClose, onSelect }: { onClose: () => void; onSelect: (hospital: Hospital) => void }) {
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<AnimalCategory>('all')
  const [hospitals, setHospitals] = useState<Hospital[]>([])
  const [status, setStatus] = useState('병원명이나 지역을 입력해 추천할 병원을 찾아보세요.')
  const [loading, setLoading] = useState(false)

  const submit = async (event?: FormEvent<HTMLFormElement>) => {
    event?.preventDefault()
    if (loading) return
    setLoading(true)
    setStatus('병원을 찾는 중이에요.')
    try {
      const results = await searchHospitals(buildHospitalSearchQuery(query, category), category, null)
      setHospitals(results)
      setStatus(results.length ? `${results.length}곳을 찾았어요.` : '검색 결과가 없어요. 검색어를 바꿔보세요.')
    } catch (error) {
      console.error('Hospital picker search error:', error)
      setStatus(error instanceof Error ? error.message : '병원 검색 중 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="hospital-picker-overlay">
      <button className="hospital-picker-dim" type="button" aria-label="병원 선택 닫기" onClick={onClose} />
      <section className="hospital-picker-sheet" role="dialog" aria-modal="true" aria-label="지도에서 병원 가져오기">
        <div className="hospital-picker-handle" aria-hidden="true" />
        <header>
          <div><strong>지도에서 병원 가져오기</strong><p>댓글에 추천할 특수동물 병원을 첨부합니다.</p></div>
          <button type="button" aria-label="닫기" onClick={onClose}>×</button>
        </header>
        <form className="hospital-picker-search" onSubmit={submit}>
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="지역명, 병원명, 특수동물 병원" />
          <button type="submit" disabled={loading}>{loading ? '검색 중' : '검색'}</button>
        </form>
        <div className="hospital-picker-tags" aria-label="동물 분류">
          {animalCategoryOptions.map((item) => (
            <button className={category === item ? 'active' : ''} type="button" key={item} onClick={() => setCategory(item)}>{animalCategoryLabels[item]}</button>
          ))}
        </div>
        <p className="hospital-picker-status">{status}</p>
        <div className="hospital-picker-list">
          {hospitals.map((hospital) => (
            <button type="button" key={hospital.id} onClick={() => onSelect(hospital)}>
              <strong>{hospital.name}</strong>
              <span>{hospital.address || hospital.roadAddress || '주소 정보 없음'}</span>
              <small>{hospital.phone || '전화번호 없음'}</small>
              <div>{hospital.categories.map((item) => <em key={item}>{animalCategoryLabels[item]}</em>)}</div>
            </button>
          ))}
        </div>
      </section>
    </div>
  )
}

function RecordPicker({ pets, records, initialPetId, onClose }: { pets: Pet[]; records: PetRecord[]; initialPetId: string; onClose: () => void }) {
  const petsWithRecords = new Set(records.map((record) => record.petId))
  const firstAvailablePetId = pets.find((pet) => petsWithRecords.has(pet.id))?.id || ''
  const initialSelectedPetId = initialPetId && petsWithRecords.has(initialPetId) ? initialPetId : firstAvailablePetId
  const [selectedPetId, setSelectedPetId] = useState(initialSelectedPetId)
  const selectedPet = pets.find((pet) => pet.id === selectedPetId)
  const petRecords = records
    .filter((record) => record.petId === selectedPetId)
    .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt))
  const recordTypeCounts = Object.entries(petRecords.reduce<Record<string, number>>((counts, record) => {
    counts[record.type] = (counts[record.type] ?? 0) + 1
    return counts
  }, {})).sort(([, a], [, b]) => b - a)
  const maxTypeCount = Math.max(1, ...recordTypeCounts.map(([, count]) => count))

  return (
    <div className="record-picker-overlay">
      <button className="record-picker-dim" type="button" aria-label="기록 선택 닫기" onClick={onClose} />
      <section className="record-picker-sheet" role="dialog" aria-modal="true" aria-label="QNA에 기록 첨부">
        <div className="hospital-picker-handle" aria-hidden="true" />
        <header>
          <div><strong>기록 첨부</strong><p>선택한 펫의 기록을 확인합니다.</p></div>
          <button type="button" aria-label="닫기" onClick={onClose}>×</button>
        </header>
        {pets.length === 0 ? (
          <p className="record-picker-empty">등록된 마이 펫이 없습니다.</p>
        ) : (
          <>
            {!initialPetId && <div className="record-picker-pets">
              {pets.map((pet) => (
                <button className={`${selectedPetId === pet.id ? 'active ' : ''}${!petsWithRecords.has(pet.id) ? 'disabled' : ''}`} type="button" key={pet.id} disabled={!petsWithRecords.has(pet.id)} onClick={() => {
                  setSelectedPetId(pet.id)
                }}>
                  <strong>{pet.name}</strong>
                  <span>{animalCategoryLabels[pet.group]} · {pet.species}</span>
                  {!petsWithRecords.has(pet.id) && <small>기록 없음</small>}
                </button>
              ))}
            </div>}
            {selectedPet && petRecords.length > 0 && <section className="record-picker-chart" aria-label={`${selectedPet.name} 기록 통계`}>
              <div className="record-picker-chart-head"><strong>전체 기록 {petRecords.length}개</strong><span>기록 유형별</span></div>
              <div className="record-picker-bars">
                {recordTypeCounts.map(([type, count]) => <div className="record-picker-bar-row" key={type}><span>{recordTypeLabels[type as PetRecordType]}</span><div><i style={{ width: `${(count / maxTypeCount) * 100}%` }} /></div><strong>{count}</strong></div>)}
              </div>
            </section>}
            <div className="record-picker-list">
              {selectedPet && petRecords.length === 0 && <p className="record-picker-empty">이 펫의 기록이 없습니다.</p>}
              {selectedPet && petRecords.length > 0 && <strong className="record-picker-selected-date">전체 기록</strong>}
              {selectedPet && petRecords.map((record) => (
                <div className="record-picker-record" key={record.id}>
                  {record.photoUrl && <img src={record.photoUrl} alt="" />}
                  <div>
                    <span>{formatRecordDate(record.date)} · {recordTypeLabels[record.type]}</span>
                    <strong>{summarizeRecord(record)}</strong>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </section>
    </div>
  )
}

void RecordPicker

function RecordAttachCard({ record, mode, onRemove, onOpen }: { record: AttachedRecordSnapshot; mode: 'draft' | 'posted'; onRemove?: () => void; onOpen?: () => void }) {
  if (onOpen) {
    return (
      <div className={`record-attach-card ${mode} compact`}>
        <button className="record-attach-open" type="button" onClick={onOpen}>{record.petName}의 기록</button>
        {mode === 'draft' && <button type="button" aria-label="첨부 기록 취소" onClick={onRemove}>×</button>}
      </div>
    )
  }
  return (
    <div className={`record-attach-card ${mode}`}>
      {record.photoUrl && <img src={record.photoUrl} alt="" />}
      <div>
        <span>{record.petName} · {record.animalGroup} · {record.animalSpecies}</span>
        <strong>{formatRecordDate(record.recordDate)} · {record.recordTypeLabel}</strong>
        <p>{record.summary}</p>
      </div>
      {mode === 'posted' && onOpen && <button className="record-attach-open" type="button" onClick={onOpen}>{record.petName}의 기록</button>}
      {mode === 'draft' && <button type="button" aria-label="첨부 기록 취소" onClick={onRemove}>×</button>}
    </div>
  )
}

function HospitalAttachCard({ hospital, mode, onRemove, onOpen }: { hospital: HospitalSnapshot; mode: 'draft' | 'posted'; onRemove?: () => void; onOpen?: () => void }) {
  const content = (
    <>
      <div>
        <strong>{hospital.name}</strong>
        <span>{hospital.address || '주소 정보 없음'}</span>
        <small>{hospital.phone || '전화번호 없음'}</small>
      </div>
      <div className="hospital-attach-tags">{hospital.animalTags.map((tag) => <em key={tag}>{tag}</em>)}</div>
    </>
  )

  return (
    <div className={`hospital-attach-card ${mode}`}>
      {mode === 'posted' ? <button type="button" onClick={onOpen} aria-label={`${hospital.name} 지도에서 보기`}>{content}</button> : content}
      {mode === 'draft' && <button className="hospital-attach-remove" type="button" aria-label="첨부 병원 취소" onClick={onRemove}>×</button>}
    </div>
  )
}

function ItemActions({ onDelete }: { onDelete: () => void }) {
  return (
    <div className="item-actions">
      <button className="item-action-button danger" type="button" aria-label="삭제" onClick={(event) => { event.stopPropagation(); onDelete() }}>
        <span className="item-action-icon delete" aria-hidden="true" />
      </button>
    </div>
  )
}

function PetCreateFlow({ initialPet, initialDraft, onClose, onSave, onSaveDraft }: { initialPet: Pet | null; initialDraft?: DraftItem | null; onClose: () => void; onSave: (pet: Pet) => void | Promise<void>; onSaveDraft: (draft: DraftItem) => void | Promise<void> }) {
  const [step, setStep] = useState(0)
  const [completedPet, setCompletedPet] = useState<Pet | null>(null)
  const [name, setName] = useState(initialPet?.name ?? '')
  const [group, setGroup] = useState<Exclude<AnimalCategory, 'all'> | ''>(initialPet?.group === 'all' || !initialPet?.group ? '' : initialPet.group)
  const [species, setSpecies] = useState(initialPet?.species ?? '')
  const [gender, setGender] = useState<Pet['gender'] | ''>(initialPet?.gender ?? '')
  const [photo, setPhoto] = useState<string | undefined>(initialPet?.photo)
  const [weight, setWeight] = useState(initialPet?.weight ?? '')
  const [weightUnit, setWeightUnit] = useState<'g' | 'kg'>(initialPet?.weightUnit ?? 'g')
  const [birthday, setBirthday] = useState(initialPet?.birthday ?? '')
  const [adoptionDate, setAdoptionDate] = useState(initialPet?.adoptionDate ?? '')
  const isEditing = Boolean(initialPet)
  const canNext = step === 0 ? Boolean(group) : step === 1 ? Boolean(species && gender) : step === 2 ? name.trim().length > 0 : true
  const finishRequired = async () => {
    if (!group || !species || !gender || !name.trim()) return
    const pet: Pet = { id: initialPet?.id ?? crypto.randomUUID(), name: name.trim(), group, species, gender, registeredAt: initialPet?.registeredAt ?? new Date().toISOString() }
    await onSave(pet)
    setCompletedPet(pet)
  }
  const saveDraft = () => {
    const pet: Pet = {
      id: initialPet?.id ?? crypto.randomUUID(),
      name: name.trim(),
      group: group || 'other',
      species: species.trim(),
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
          <h1>{completedPet.name}가 등록되었습니다.</h1>
          <p>더 자세한 정보를 지금 추가할 수 있어요.</p>
          <div className="pet-detail-add-grid">
            <label className="pet-detail-add"><span>사진 추가</span><input type="file" accept="image/*" onChange={attachPhoto} />{photo && <img src={photo} alt="선택한 펫 사진" />}</label>
            <label className="pet-detail-add"><span>몸무게 추가</span><div className="weight-input"><input inputMode="decimal" value={weight} onChange={(event) => setWeight(event.target.value.replace(/[^0-9.]/g, ''))} placeholder="몸무게" /><div className="weight-unit">{(['g', 'kg'] as const).map((unit) => <button className={weightUnit === unit ? 'active' : ''} type="button" key={unit} onClick={() => setWeightUnit(unit)}>{unit}</button>)}</div></div></label>
            <label className="pet-detail-add"><span>생일 추가</span><input type="date" value={birthday} onChange={(event) => setBirthday(event.target.value)} /></label>
            <label className="pet-detail-add"><span>입양일 추가</span><input type="date" value={adoptionDate} onChange={(event) => setAdoptionDate(event.target.value)} /></label>
          </div>
          <div className="pet-complete-actions"><button type="button" onClick={onClose}>나중에 추가 가능</button><button className="step-primary" type="button" disabled={!hasAdditionalDetails} onClick={async () => { await onSave(completedWithDetails); onClose() }}>추가 정보 저장</button></div>
        </section>
      </main>
    )
  }
  const finishEdit = async () => {
    if (!group || !species || !gender || !name.trim()) return
    await onSave({ id: initialPet?.id ?? crypto.randomUUID(), name: name.trim(), group, species, gender, photo, weight: weight.trim() || undefined, weightUnit, birthday: birthday || undefined, adoptionDate: adoptionDate || undefined, registeredAt: initialPet?.registeredAt ?? new Date().toISOString() })
    onClose()
  }

  return (
    <StepShell title={isEditing ? '펫 수정' : '펫'} onBack={step === 0 ? onClose : () => setStep((value) => value - 1)} currentStep={step} stepCount={isEditing ? 6 : 3} stepLabels={isEditing ? ['종류', '종·성별', '이름', '사진', '몸무게', '생일·입양일'] : ['종류', '종·성별', '이름']} onStepChange={setStep}>
      {step === 0 && <StepSelect label="종류" value={group} options={animalCategoryOptions.filter((item) => item !== 'all')} labels={animalCategoryLabels} onChange={(value) => { setGroup(value as Exclude<AnimalCategory, 'all'>); setSpecies('') }} />}
      {step === 1 && <div className="pet-species-gender-step"><StepSelect label="종" value={species} options={group ? petSpeciesOptions[group] : []} onChange={setSpecies} /><StepSelect label="성별" value={gender} options={['male', 'female', 'unknown']} labels={{ male: '수컷', female: '암컷', unknown: '미구분' }} onChange={(value) => setGender(value as Pet['gender'])} /></div>}
      {step === 2 && <StepText label="이름(닉네임)" value={name} onChange={setName} placeholder="예: 레오" />}
      {isEditing && step === 3 && <label className="step-field attach-file-field"><span>사진</span><span className="attach-file-button">사진 선택</span><input type="file" accept="image/*" onChange={attachPhoto} /><small>{photo ? '사진이 선택되었습니다' : '선택된 사진 없음'}</small>{photo && <img src={photo} alt="선택한 펫 미리보기" />}</label>}
      {isEditing && step === 4 && <div className="step-field"><span>몸무게</span><div className="weight-input"><input inputMode="decimal" value={weight} onChange={(event) => setWeight(event.target.value.replace(/[^0-9.]/g, ''))} placeholder="몸무게 입력" /><div className="weight-unit">{(['g', 'kg'] as const).map((unit) => <button className={weightUnit === unit ? 'active' : ''} type="button" key={unit} onClick={() => setWeightUnit(unit)}>{unit}</button>)}</div></div></div>}
      {isEditing && step === 5 && <div className="pet-date-pair"><StepDate label="생일" value={birthday} onChange={setBirthday} /><StepDate label="입양일" value={adoptionDate} onChange={setAdoptionDate} /></div>}
      <div className="step-actions">
        <button className="step-secondary" type="button" onClick={saveDraft}>임시저장</button>
        <button className="step-primary" type="button" disabled={!canNext} onClick={isEditing && step === 5 ? finishEdit : !isEditing && step === 2 ? finishRequired : () => setStep((value) => value + 1)}>{isEditing && step === 5 ? '수정 완료' : !isEditing && step === 2 ? '등록 완료' : '다음'}</button>
      </div>
    </StepShell>
  )
}

function QnaCreateFlow({ userId, pets, initialDraft, onClose, onSave, onSaveDraft }: { userId: string; pets: Pet[]; initialDraft?: DraftItem | null; onClose: () => void; onSave: (post: QnaPost) => void | Promise<void>; onSaveDraft: (draft: DraftItem) => void | Promise<void> }) {
  const initialPost = initialDraft?.draftType === 'question' ? initialDraft.payload as QnaPost : null
  const [step, setStep] = useState(initialDraft?.step ?? 0)
  const [petId, setPetId] = useState(initialPost?.petId || '')
  const [category, setCategory] = useState<QnaCategory | ''>(initialPost ? normalizeQnaCategory(initialPost.category) : '')
  const [title, setTitle] = useState(initialPost?.title ?? '')
  const [body, setBody] = useState(initialPost?.body ?? '')
  const [image, setImage] = useState<string | undefined>(initialPost?.image)
  const [attachedRecord, setAttachedRecord] = useState<AttachedRecordSnapshot | null>(initialPost?.attachedRecordSnapshot ?? null)
  const [attachedDiary, setAttachedDiary] = useState<AttachedDiarySnapshot | null>(initialPost?.attachedDiarySnapshot ?? null)
  const [diaryLoading, setDiaryLoading] = useState(false)
  const diaryAttachmentRef = useRef<HTMLDivElement | null>(null)
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
    author: '작성자',
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

  const attachDiary = async () => {
    if (attachedDiary) {
      diaryAttachmentRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      return
    }
    if (hasNoAnimal || !petId || !pet || diaryLoading) return
    setDiaryLoading(true)
    try {
      const loaded = await loadAppData<PetRecord>('care_records', { userId, scope: 'mine' })
      const petRecords = loaded.filter((record) => record.petId === petId).sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt))
      if (petRecords.length > 0) {
        setAttachedDiary({ petId: pet.id, petName: pet.name, petPhoto: pet.photo, records: petRecords, startDate: petRecords[0].date, endDate: petRecords[petRecords.length - 1].date, totalCount: petRecords.length })
      }
    } finally {
      setDiaryLoading(false)
    }
  }

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
    <StepShell title="QNA 작성" onBack={step === 0 ? onClose : () => setStep((value) => value - 1)} currentStep={step} stepCount={3} onStepChange={setStep}>
      {step === 0 && <StepSelect label="질문 유형" value={category} options={['건강/증상', '사육/관리']} onChange={(value) => setCategory(value as QnaCategory)} />}
      {step === 1 && <StepSelect
        label="관련 펫"
        value={petId}
        options={[...pets.map((item) => item.id), 'none']}
        labels={{ ...Object.fromEntries(pets.map((item) => [item.id, `${item.name} · ${animalCategoryLabels[item.group]} · ${item.species}`])), none: '동물 X' }}
        onChange={setPetId}
      />}
      {step === 2 && <div className="qna-compose-fields">
        <StepText label="제목" value={title} onChange={setTitle} placeholder="질문 제목을 입력하세요" />
        <StepTextarea label="내용" value={body} onChange={setBody} placeholder="궁금한 내용을 자세히 적어 주세요" />
        <label className="step-field attach-file-field"><span>사진 첨부 (선택)</span><span className="attach-file-button">사진 선택</span><input type="file" accept="image/*" onChange={attachImage} /><small>{image ? '사진이 선택되었습니다' : '선택된 사진 없음'}</small></label>
        {image && <img className="qna-compose-preview" src={image} alt="첨부 사진 미리보기" />}
        {attachedRecord && <RecordAttachCard record={attachedRecord} mode="draft" onRemove={() => setAttachedRecord(null)} />}
        {!hasNoAnimal && petId && <div className="qna-compose-tools">
          <button type="button" onClick={attachDiary}>{attachedDiary ? '기록 첨부됨' : diaryLoading ? '기록 불러오는 중' : '기록 첨부'}</button>
        </div>}
        <div ref={diaryAttachmentRef}>
          {diaryLoading && <DiaryTimelineSkeleton />}
          {attachedDiary && !diaryLoading && <DiaryTimelineAttachment snapshot={attachedDiary} mode="draft" onRemove={() => setAttachedDiary(null)} />}
        </div>
      </div>}
      {step === 2 && <div className="step-actions"><button className="step-secondary" type="button" onClick={saveDraft}>임시저장</button><button className="step-primary" type="button" disabled={!canNext} onClick={finish}>등록</button></div>}
      {step !== 2 && <div className="step-actions single"><button className="step-primary" type="button" disabled={!canNext} onClick={() => setStep((value) => value + 1)}>다음</button></div>}
    </StepShell>
  )
}

function FilterGroup({ title, options, value, labels, onChange }: { title: string; options: string[]; value: string; labels: Record<string, string>; onChange: (value: string) => void }) {
  return <section><strong>{title}</strong><div>{options.map((option) => <button className={value === option ? 'active' : ''} key={option} type="button" onClick={() => onChange(option)}>{labels[option]}</button>)}</div></section>
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

function qnaStatus(post: QnaPost): QnaStatus {
  return post.status === 'resolved' ? 'resolved' : 'unresolved'
}

function qnaStatusLabel(status: QnaStatus) {
  return status === 'resolved' ? '해결 완료' : '답변 기다리는 중'
}

const qnaCategoryCards: QnaCategory[] = ['건강/증상', '사육/관리']

function qnaSortLabel(sort: QnaSort) {
  if (sort === 'latest') return '최신순'
  if (sort === 'comments') return '댓글 많은 질문'
  if (sort === 'resolved') return '해결된 사례'
  return '답변 필요 우선'
}

function buildQnaFeedPosts(posts: QnaPost[], sort: QnaSort) {
  if (sort === 'resolved') return [...posts].filter((post) => qnaStatus(post) === 'resolved').sort((a, b) => compareQnaPosts(a, b, sort))
  if (sort === 'needsAnswer') return [...posts].filter((post) => qnaStatus(post) === 'unresolved').sort((a, b) => compareQnaPosts(a, b, sort))
  return [...posts].filter((post) => qnaStatus(post) === 'unresolved').sort((a, b) => compareQnaPosts(a, b, sort))
}

function compareQnaPosts(a: QnaPost, b: QnaPost, sort: QnaSort) {
  if (sort === 'needsAnswer') {
    const statusDiff = (qnaStatus(a) === 'resolved' ? 1 : 0) - (qnaStatus(b) === 'resolved' ? 1 : 0)
    if (statusDiff !== 0) return statusDiff
    const emptyCommentDiff = (a.comments.length === 0 ? 0 : 1) - (b.comments.length === 0 ? 0 : 1)
    if (emptyCommentDiff !== 0) return emptyCommentDiff
  }
  if (sort === 'resolved') {
    const statusDiff = (qnaStatus(a) === 'resolved' ? 0 : 1) - (qnaStatus(b) === 'resolved' ? 0 : 1)
    if (statusDiff !== 0) return statusDiff
  }
  if (sort === 'comments') {
    const commentDiff = b.comments.length - a.comments.length
    if (commentDiff !== 0) return commentDiff
  }
  return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
}

const recordTypeLabels: Record<PetRecordType, string> = {
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

function ShareCreateFlow({ pets, initialDraft, onClose, onSave, onSaveDraft }: { pets: Pet[]; initialDraft?: DraftItem | null; onClose: () => void; onSave: (item: ShareItem) => void | Promise<void>; onSaveDraft: (draft: DraftItem) => void | Promise<void> }) {
  const initialItem = initialDraft?.draftType === 'share_item' ? initialDraft.payload as ShareItem : null
  const initialShareType = initialItem?.category === 'food' || initialItem?.category === 'supplies' ? 'item' : 'animal'
  const [step, setStep] = useState(initialDraft?.step ?? 0)
  const [shareType, setShareType] = useState<'animal' | 'item' | ''>(initialItem ? initialShareType : '')
  const [category, setCategory] = useState<ShareCategory | ''>(initialItem?.category ?? '')
  const [subcategory, setSubcategory] = useState(initialItem?.subcategory ?? '')
  const [source, setSource] = useState<'pet' | 'custom'>(initialItem?.species ? 'custom' : 'pet')
  const [petId, setPetId] = useState('')
  const [species, setSpecies] = useState(initialItem?.species ?? '')
  const [gender, setGender] = useState<Pet['gender']>(initialItem?.gender ?? 'unknown')
  const [title, setTitle] = useState(initialItem?.title ?? '')
  const [area, setArea] = useState(initialItem?.area ?? '')
  const [memo, setMemo] = useState(initialItem?.memo ?? '')
  const [imageUrl, setImageUrl] = useState(initialItem?.imageUrl ?? '')
  const selectedPet = pets.find((pet) => pet.id === petId)
  const resolvedSpecies = source === 'pet' && selectedPet ? selectedPet.species : species
  const resolvedGender = source === 'pet' && selectedPet ? selectedPet.gender : gender
  const resolvedCategory = shareType === 'animal' && selectedPet && selectedPet.group !== 'all' ? selectedPet.group : category
  const canNext = step === 0 ? Boolean(shareType) : step === 1 ? (shareType === 'animal' ? Boolean(resolvedCategory && resolvedSpecies.trim()) : Boolean(category && subcategory)) : step === 2 ? title.trim().length > 0 : step === 3 ? Boolean(imageUrl) : step === 4 ? memo.trim().length > 0 : true
  const buildItem = (): ShareItem => ({ id: initialItem?.id ?? crypto.randomUUID(), title: title.trim(), area: area.trim(), memo: memo.trim(), status: initialItem?.status ?? 'active', category: resolvedCategory || 'other', subcategory: shareType === 'animal' ? resolvedSpecies.trim() : subcategory, species: shareType === 'animal' ? resolvedSpecies.trim() : '', gender: shareType === 'animal' ? resolvedGender : 'unknown', imageUrl, createdAt: initialItem?.createdAt ?? new Date().toISOString(), likes: initialItem?.likes ?? 0, liked: initialItem?.liked ?? false })
  const finish = () => onSave(buildItem())
  const saveDraft = () => {
    const item = buildItem()
    onSaveDraft({
      id: initialDraft?.id ?? crypto.randomUUID(),
      draftType: 'share_item',
      title: item.title || '제목 없음',
      body: item.memo,
      updatedAt: new Date().toISOString(),
      step,
      payload: item,
    })
  }

  return (
    <StepShell title="나눔" onBack={step === 0 ? onClose : () => setStep((value) => value - 1)} currentStep={step} stepCount={5} onStepChange={setStep}>
      {step === 0 && <div className="share-type-picker"><span className="step-heading">무엇을 나눔하나요?</span><div><button className={shareType === 'animal' ? 'active' : ''} type="button" onClick={() => { setShareType('animal'); setCategory(''); setSubcategory('') }}><strong>동물</strong><span>무료분양할 동물을 선택합니다</span></button><button className={shareType === 'item' ? 'active' : ''} type="button" onClick={() => { setShareType('item'); setCategory(''); setSubcategory('') }}><strong>물품</strong><span>먹이 또는 용품을 나눔합니다</span></button></div></div>}
      {step === 1 && shareType === 'animal' && <div className="share-animal-picker"><span className="step-heading">동물 선택</span><div className="share-source-tabs"><button className={source === 'pet' ? 'active' : ''} type="button" onClick={() => setSource('pet')}>마이 펫</button><button className={source === 'custom' ? 'active' : ''} type="button" onClick={() => setSource('custom')}>다른 종 직접 입력</button></div>{source === 'pet' ? <div className="share-pet-grid">{pets.length ? pets.map((pet) => <button className={petId === pet.id ? 'active' : ''} type="button" key={pet.id} onClick={() => setPetId(pet.id)}><strong>{pet.name}</strong><span>{pet.species}</span></button>) : <div className="share-animal-empty"><strong>등록된 마이 펫이 없습니다</strong><p>다른 종 직접 입력을 선택해 주세요.</p></div>}</div> : <><StepSelect label="동물 분류" value={category} options={['reptile', 'amphibian', 'rodent', 'bird', 'other']} labels={shareCategoryLabels} onChange={(value) => setCategory(value as ShareCategory)} /><StepText label="종" value={species} onChange={setSpecies} placeholder="예: 크레스티드 게코" /><StepSelect label="성별" value={gender} options={['male', 'female', 'unknown']} labels={{ male: '수컷', female: '암컷', unknown: '미구분' }} onChange={(value) => setGender(value as Pet['gender'])} /></>}</div>}
      {step === 1 && shareType === 'item' && <div className="share-category-picker"><span className="step-heading">물품 카테고리</span><div className="share-category-section">{(['food', 'supplies'] as const).map((value) => <button className={category === value ? 'active' : ''} type="button" key={value} onClick={() => { setCategory(value); setSubcategory('') }}>{shareCategoryLabels[value]}</button>)}</div><div className="share-subcategory-section">{(category ? shareSubcategories[category] : []).map((value) => <button className={subcategory === value ? 'active' : ''} type="button" key={value} onClick={() => setSubcategory(value)}>{value}</button>)}</div></div>}
      {step === 2 && <div className="share-create-fields"><StepText label="제목" value={title} onChange={setTitle} placeholder="나눔 내용을 한눈에 알 수 있게 입력" /><ShareAreaField value={area} onChange={setArea} /></div>}
      {step === 3 && <label className="share-photo-input attach-file-field"><span className="step-heading">사진</span><span className="attach-file-button">사진 선택</span><input type="file" accept="image/*" onChange={(event) => { const file = event.target.files?.[0]; if (!file) return; const reader = new FileReader(); reader.onload = () => setImageUrl(String(reader.result)); reader.readAsDataURL(file) }} /><small>{imageUrl ? '사진이 선택되었습니다' : '선택된 사진 없음'}</small>{imageUrl && <img src={imageUrl} alt="첨부 미리보기" />}</label>}
      {step === 4 && <StepTextarea label="설명" value={memo} onChange={setMemo} placeholder="상태, 나눔 방식, 특징 등을 입력" />}
      {step === 4 && <div className="step-actions"><button className="step-secondary" type="button" onClick={saveDraft}>임시저장</button><button className="step-primary" type="button" disabled={!canNext} onClick={finish}>등록</button></div>}
      {step !== 4 && <div className="step-actions single"><button className="step-primary" type="button" disabled={!canNext} onClick={() => setStep((value) => value + 1)}>다음</button></div>}
    </StepShell>
  )
}

type DiaryTimelinePoint = { key: string; label: string; records: PetRecord[] }

const diaryTimelineMeta: Record<string, { label: string; icon: string }> = {
  food: { label: '먹이', icon: '🍽' },
  poop: { label: '배변', icon: '◉' },
  memo: { label: '메모', icon: '📝' },
  environment: { label: '환경', icon: '🌿' },
  photo: { label: '사진', icon: '▣' },
  other: { label: '기타', icon: '•' },
}

function diaryTimelineKind(record: PetRecord) {
  if (record.type === 'food') return 'food'
  if (record.type === 'poop') return 'poop'
  if (record.photoUrl) return 'photo'
  if (record.type === 'cleaning' || record.type === 'weight' || record.type === 'shed') return 'environment'
  if (record.memo?.trim()) return 'memo'
  return 'other'
}

function diaryTimelineGranularity(startDate: string, endDate: string) {
  const days = Math.floor((new Date(`${endDate}T00:00:00`).getTime() - new Date(`${startDate}T00:00:00`).getTime()) / 86400000) + 1
  return days > 180 ? 'month' : days > 31 ? 'week' : 'day'
}

function diaryTimelinePointKey(date: string, granularity: 'day' | 'week' | 'month') {
  const parsed = new Date(`${date}T00:00:00`)
  if (granularity === 'day') return date
  if (granularity === 'month') return date.slice(0, 7)
  const first = new Date(parsed.getFullYear(), 0, 1)
  const week = Math.ceil((((parsed.getTime() - first.getTime()) / 86400000) + first.getDay() + 1) / 7)
  return `${parsed.getFullYear()}-W${String(week).padStart(2, '0')}`
}

function diaryTimelineLabel(key: string, granularity: 'day' | 'week' | 'month') {
  if (granularity === 'month') return key.slice(5).replace('-', '월') + '월'
  if (granularity === 'week') return key.slice(5)
  return new Intl.DateTimeFormat('ko-KR', { month: 'numeric', day: 'numeric' }).format(new Date(`${key}T00:00:00`))
}

function diaryRecordSummary(record: PetRecord) {
  if (record.memo?.trim()) return record.memo.trim()
  if (record.foods?.length) return record.foods.join(', ')
  if (record.weight !== undefined) return `${record.weight}g`
  return recordTypeLabels[record.type]
}

function DiaryTimelineSkeleton() {
  return <section className="qna-diary-attachment qna-diary-skeleton" aria-label="기록 불러오는 중"><i /><i /><i /><i /></section>
}

function DiaryTimelineAttachment({ snapshot, mode, onRemove }: { snapshot: AttachedDiarySnapshot; mode: 'draft' | 'posted'; onRemove?: () => void }) {
  const [expanded, setExpanded] = useState(mode === 'draft')
  const granularity = diaryTimelineGranularity(snapshot.startDate, snapshot.endDate)
  const points = useMemo<DiaryTimelinePoint[]>(() => {
    const grouped = new Map<string, PetRecord[]>()
    snapshot.records.forEach((record) => {
      const key = diaryTimelinePointKey(record.date, granularity)
      grouped.set(key, [...(grouped.get(key) ?? []), record])
    })
    return [...grouped.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([key, records]) => ({ key, records, label: diaryTimelineLabel(key, granularity) }))
  }, [granularity, snapshot.records])
  const [selectedKey, setSelectedKey] = useState(points[points.length - 1]?.key ?? '')
  const selectedPoint = points.find((point) => point.key === selectedKey) ?? points[points.length - 1]
  const maxCount = Math.max(1, ...points.map((point) => point.records.length))
  if (snapshot.records.length === 0) return <section className="qna-diary-attachment qna-diary-empty">아직 작성된 다이어리 기록이 없어요.</section>
  return (
    <section className={`qna-diary-attachment ${mode}`}>
      <header className="qna-diary-attachment-head">
        <div className="qna-diary-pet-mark">{snapshot.petPhoto ? <img src={snapshot.petPhoto} alt="" /> : '🐾'}</div>
        <div><strong>{snapshot.petName}의 전체 다이어리 기록</strong><span>{snapshot.startDate.replaceAll('-', '.')} ~ {snapshot.endDate.replaceAll('-', '.')} · 총 {snapshot.totalCount}개</span></div>
        {mode === 'draft' && <button type="button" aria-label="기록 첨부 삭제" onClick={onRemove}>×</button>}
      </header>
      {mode === 'posted' && !expanded ? <button className="qna-diary-expand" type="button" onClick={() => setExpanded(true)}>전체 기록 흐름 보기</button> : (
        <>
          <div className="qna-diary-chart-wrap">
            <div className="qna-diary-chart" role="img" aria-label={`${snapshot.petName} 전체 기록 타임라인`}>
              {points.map((point) => <button className={`qna-diary-point ${point.key === selectedPoint?.key ? 'active' : ''}`} type="button" key={point.key} onClick={() => setSelectedKey(point.key)} aria-label={`${point.label} 기록 ${point.records.length}개`}>
                <span className="qna-diary-bar" style={{ height: `${Math.max(18, (point.records.length / maxCount) * 100)}%` }}><b>{point.records.length}</b></span>
                <span className="qna-diary-point-icons">{[...new Set(point.records.map(diaryTimelineKind))].slice(0, 3).map((kind) => <i key={kind}>{diaryTimelineMeta[kind].icon}</i>)}</span>
                <small>{point.label}</small>
              </button>)}
            </div>
            <span className="qna-diary-chart-caption">{granularity === 'day' ? '날짜별' : granularity === 'week' ? '주별' : '월별'} 기록량</span>
          </div>
          <div className="qna-diary-legend">{Object.entries(diaryTimelineMeta).map(([kind, meta]) => <span key={kind}><i>{meta.icon}</i>{meta.label}</span>)}</div>
          {selectedPoint && <section className="qna-diary-details"><h4>{selectedPoint.label} 기록</h4>{[...selectedPoint.records].sort((a, b) => a.createdAt.localeCompare(b.createdAt)).map((record) => <article key={record.id}>
            <div className="qna-diary-detail-meta"><time>{formatTimelineDateTime(record)}</time><span>{diaryTimelineMeta[diaryTimelineKind(record)].icon} {recordTypeLabels[record.type]}</span></div>
            <strong>{diaryRecordSummary(record)}</strong>
            {record.photoUrl && <img src={record.photoUrl} alt="첨부 사진" />}
          </article>)}</section>}
        </>
      )}
    </section>
  )
}

function formatTimelineDateTime(record: PetRecord) {
  const date = new Date(record.createdAt)
  return `${formatRecordDate(record.date)} · ${new Intl.DateTimeFormat('ko-KR', { hour: '2-digit', minute: '2-digit' }).format(date)}`
}

void DiaryTimelineSkeleton
void DiaryTimelineAttachment
void RecordPicker
void toAttachedRecordSnapshot
// 나눔 프론트엔드 진입점은 보류 중이다. 재활성화 시 다시 연결한다.
void ShareScreen
void ShareCreateFlow

function StepShell({ title, children, onBack, currentStep, stepCount, stepLabels, onStepChange }: { title: string; children: ReactNode; onBack: () => void; currentStep?: number; stepCount?: number; stepLabels?: string[]; onStepChange?: (step: number) => void }) {
  const progress = currentStep !== undefined && stepCount ? (currentStep + 1) / stepCount : undefined
  const keyword = title.includes('QNA') ? '질문' : title.includes('나눔') ? '나눔' : title.includes('펫') ? '펫' : '작성'
  return (
    <main className="step-screen">
      <header className="step-header">
        <button className="back" type="button" aria-label="뒤로가기" onClick={onBack}>←</button>
        <strong>{title}</strong>
      </header>
      <p className="step-keyword" aria-label="작성 키워드">{keyword}</p>
      {progress !== undefined && stepCount && <div className="step-progress step-progress-selectable" role="tablist" aria-label="작성 단계">
        <span className="step-progress-fill" style={{ width: `${progress * 100}%` }} />
        {Array.from({ length: stepCount }, (_, index) => <button key={index} className={index === currentStep ? 'active' : ''} type="button" role="tab" aria-selected={index === currentStep} aria-label={`${index + 1}단계`} onClick={() => onStepChange?.(index)}><span>{index + 1}</span></button>)}
      </div>}
      {stepLabels && <div className={`step-progress-labels step-progress-labels-${stepLabels.length}`}>{stepLabels.map((label, index) => <span className={index === currentStep ? 'active' : ''} key={label}>{index + 1}. {label}</span>)}</div>}
      <section className="step-card">{children}</section>
    </main>
  )
}

function StepText({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (value: string) => void; placeholder: string }) {
  return <label className="step-field"><span>{label}</span><input autoFocus value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} /></label>
}

function StepDate({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <label className="step-field"><span>{label}</span><input type="date" value={value} onChange={(event) => onChange(event.target.value)} /></label>
}

function ShareAreaField({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <div className="step-field share-area-field">
      <span>지역/주소 (선택)</span>
      <input value={value} onChange={(event) => onChange(event.target.value)} placeholder="주소나 지역을 직접 입력" />
      <div className="share-area-options" aria-label="지역 선택">
        {shareAreaSuggestions.map((area) => <button className={value === area ? 'active' : ''} type="button" key={area} onClick={() => onChange(area)}>{area}</button>)}
      </div>
    </div>
  )
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

function CategoryTagIcon({ category }: { category: AnimalCategory }) {
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



