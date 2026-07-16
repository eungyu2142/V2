import { type ChangeEvent, type FormEvent, type ReactNode, useEffect, useMemo, useRef, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import './App.css'
import AuthScreen from './components/AuthScreen'
import DiaryPage, { type RecordDraft, type Reminder } from './features/diary/DiaryPage'
import type { PetRecord, PetRecordType } from './features/diary/diaryTypes'
import { deleteAppData, loadAppData, saveAppData } from './lib/appData'
import { supabase } from './lib/supabase'

type Tab = 'pets' | 'diary' | 'map' | 'qna' | 'share'
type CreateMode = 'pet' | 'post' | 'share' | null
type AnimalCategory = 'all' | 'reptile' | 'bird' | 'rodent' | 'amphibian' | 'other'
type ShareCategory = 'reptile' | 'bird' | 'rodent' | 'amphibian' | 'other' | 'food' | 'supplies'
type ShareSort = 'latest' | 'popular'
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

const LOCAL_DRAFTS_KEY = 'exocare:drafts'

function readLocalDrafts() {
  try {
    const value = JSON.parse(localStorage.getItem(LOCAL_DRAFTS_KEY) ?? '[]')
    return Array.isArray(value) ? value as DraftItem[] : []
  } catch {
    return []
  }
}

function writeLocalDrafts(items: DraftItem[]) {
  localStorage.setItem(LOCAL_DRAFTS_KEY, JSON.stringify(items))
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

type HospitalReview = {
  id: string
  hospitalId: string
  author: string
  rating: number
  body: string
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
  { id: 'share', label: '나눔' },
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

const animalCategorySearchTerms: Record<AnimalCategory, string> = {
  all: '특수동물병원',
  reptile: '파충류 동물병원',
  bird: '조류 동물병원',
  rodent: '설치류 동물병원',
  amphibian: '양서류 동물병원',
  other: '특수동물병원',
}

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
  const [profileOpen, setProfileOpen] = useState(false)
  const [sideNavOpen, setSideNavOpen] = useState(false)
  const [createMode, setCreateMode] = useState<CreateMode>(null)
  const [qnaOpenId, setQnaOpenId] = useState<string | null>(null)
  const [shareOpenId, setShareOpenId] = useState<string | null>(null)
  const [editingPet, setEditingPet] = useState<Pet | null>(null)
  const [diaryPetId, setDiaryPetId] = useState<string | null>(null)
  const [editingDraft, setEditingDraft] = useState<DraftItem | null>(null)
  const [mapFocusHospital, setMapFocusHospital] = useState<HospitalSnapshot | null>(null)
  const [pets, setPets] = useState<Pet[]>([])
  const [qnaPosts, setQnaPosts] = useState<QnaPost[]>([])
  const [shareItems, setShareItems] = useState<ShareItem[]>([])
  const [drafts, setDrafts] = useState<DraftItem[]>([])
  const [profile, setProfile] = useState<AppProfile>({ username: '', nickname: '', avatarUrl: '' })
  const [dataError, setDataError] = useState('')

  useEffect(() => {
    let active = true
    const loadRequired = async <T,>(table: string) => loadAppData<T>(table)
    const loadOptional = async <T,>(table: string) => loadAppData<T>(table).catch((error) => {
      console.warn(`Optional data load failed: ${table}`, error)
      return [] as T[]
    })

    Promise.all([
      loadRequired<Pet>('pets'),
      loadRequired<QnaPost>(qnaTable),
      loadRequired<ShareItem>('share_items'),
      loadOptional<DraftItem>('drafts').then((items) => {
        const localItems = readLocalDrafts()
        const merged = [...items, ...localItems.filter((local) => !items.some((item) => item.id === local.id))]
        writeLocalDrafts(merged)
        return merged
      }).catch(() => readLocalDrafts()),
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
    setCreateMode(null)
    setEditingPet(null)
    setEditingDraft(null)
  }

  const openHospitalOnMap = (hospital: HospitalSnapshot) => {
    setMapFocusHospital(hospital)
    moveTab('map')
  }

  const savePet = async (pet: Pet) => {
    try {
      await saveAppData('pets', session.user.id, pet, {
        name: pet.name, species: pet.species, category: pet.group,
        gender: pet.gender, photo_url: pet.photo ?? null,
      })
      setPets((items) => [pet, ...items.filter((item) => item.id !== pet.id)])
    } catch {
      setDataError('펫 정보를 저장하지 못했습니다.')
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
    try {
      await saveAppData(qnaTable, session.user.id, post, {
        category: qnaDatabaseCategory, title: post.title, body: post.body,
      })
      setQnaPosts((items) => [post, ...items.filter((item) => item.id !== post.id)])
      setCreateMode(null)
    } catch {
      setDataError('질문을 저장하지 못했습니다.')
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
    try {
      await saveAppData('share_items', session.user.id, item, {
        title: item.title, area: item.area, memo: item.memo,
      })
      setShareItems((items) => [item, ...items.filter((shareItem) => shareItem.id !== item.id)])
      setCreateMode(null)
    } catch {
      setDataError('나눔 글을 저장하지 못했습니다.')
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
    const nextDrafts = [draft, ...readLocalDrafts().filter((item) => item.id !== draft.id)]
    writeLocalDrafts(nextDrafts)
    setDrafts((items) => [draft, ...items.filter((item) => item.id !== draft.id)])
    setCreateMode(null)
  }

  const deleteDraft = async (draftId: string) => {
    try {
      await deleteAppData('drafts', draftId)
    } catch (error) {
      console.error('Supabase draft delete failed; deleting local draft.', error)
    }
    const nextDrafts = readLocalDrafts().filter((item) => item.id !== draftId)
    writeLocalDrafts(nextDrafts)
    setDrafts((items) => items.filter((item) => item.id !== draftId))
  }

  const continueDraft = (draft: DraftItem) => {
    setProfileOpen(false)
    setEditingDraft(draft)
    if (draft.draftType === 'question') {
      setCreateMode('post')
      return
    }
    if (draft.draftType === 'share_item') {
      setCreateMode('share')
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
    setProfileOpen(false)
    setCreateMode(null)
    if (kind === 'question') {
      setActiveTab('qna')
      setQnaOpenId(id)
      setShareOpenId(null)
      return
    }
    setActiveTab('share')
    setShareOpenId(id)
    setQnaOpenId(null)
  }

  const editWrittenPost = (kind: 'question' | 'share_item', id: string) => {
    const payload = kind === 'question' ? qnaPosts.find((post) => post.id === id) : shareItems.find((item) => item.id === id)
    if (!payload) return
    setProfileOpen(false)
    setEditingDraft({
      id,
      draftType: kind,
      title: 'title' in payload ? payload.title : '',
      body: 'body' in payload ? payload.body : 'memo' in payload ? payload.memo : '',
      updatedAt: new Date().toISOString(),
      payload,
    } as DraftItem)
    setCreateMode(kind === 'question' ? 'post' : 'share')
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
  if (createMode === 'share') return (
    <ShareCreateFlow
      pets={pets}
      initialDraft={editingDraft?.draftType === 'share_item' ? editingDraft : null}
      onClose={() => { setCreateMode(null); setEditingDraft(null) }}
      onSave={async (item) => {
        await saveShareItem(item)
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
        <button className="side-nav-profile" type="button" onClick={() => setProfileOpen(true)}>
          <span className="side-nav-icon profile" aria-hidden="true" />
          <span>&#54532;&#47196;&#54596;</span>
        </button>
      </aside>

      <header className="top-bar">
        <div>
          <h1>{tabs.find((tab) => tab.id === activeTab)?.label}</h1>
        </div>
      </header>

      {activeTab === 'map' && <main className="app-main"><MapScreen focusHospital={mapFocusHospital} reviewDraft={editingDraft?.draftType === 'hospital_review' ? editingDraft : null} onSaveDraft={async (draft) => { await saveDraft(draft); setEditingDraft(null) }} onDeleteDraft={async (draftId) => { await deleteDraft(draftId); setEditingDraft(null) }} /></main>}

      {activeTab !== 'map' && (
        <main className="app-main">
          {activeTab === 'pets' && <PetsScreen pets={pets} onDeletePet={deletePet} onEditPet={(pet) => { setEditingPet(pet); setCreateMode('pet') }} onOpenDiary={(petId) => { setDiaryPetId(petId); moveTab('diary') }} onRegisterPet={() => { setEditingPet(null); setEditingDraft(null); setCreateMode('pet') }} />}
          {activeTab === 'diary' && <DiaryPage userId={session.user.id} pets={pets} initialPetId={diaryPetId ?? undefined} onAddPet={() => { setEditingPet(null); setEditingDraft(null); setCreateMode('pet') }} initialDraft={editingDraft?.draftType === 'care_record' || editingDraft?.draftType === 'reminder' ? editingDraft as never : null} onSaveDraft={async (draft) => { await saveDraft(draft); setEditingDraft(null) }} onDeleteDraft={async (draftId) => { await deleteDraft(draftId); setEditingDraft(null) }} />}
          {activeTab === 'qna' && <QnaScreen userId={session.user.id} profile={profile} posts={qnaPosts} openPostId={qnaOpenId} onOpenHandled={() => setQnaOpenId(null)} onChange={updateQnaPosts} onDeletePost={deleteQnaPost} onOpenHospital={openHospitalOnMap} />}
          {activeTab === 'share' && <ShareScreen items={shareItems} openItemId={shareOpenId} onOpenHandled={() => setShareOpenId(null)} onItemsChange={setShareItems} onSaveItem={saveShareItem} onDeleteItem={deleteShareItem} onEditItem={(item) => editWrittenPost('share_item', item.id)} />}
        </main>
      )}

      {activeTab !== 'map' && activeTab !== 'diary' && (
        <button className="app-fab" type="button" aria-label="작성" onClick={() => { setEditingPet(null); setEditingDraft(null); setCreateMode(activeTab === 'pets' ? 'pet' : activeTab === 'qna' ? 'post' : 'share') }}>
          +
        </button>
      )}

      <nav className="bottom-nav">
        {tabs.map((tab) => (
          <button className={activeTab === tab.id ? 'active' : ''} key={tab.id} type="button" onClick={() => moveTab(tab.id)}>
            {tab.label}
          </button>
        ))}
      </nav>

      {dataError && <button className="data-error" type="button" onClick={() => setDataError('')}>{dataError}</button>}
      {profileOpen && <ProfilePanel profile={profile} qnaPosts={qnaPosts} shareItems={shareItems} drafts={drafts} onClose={() => setProfileOpen(false)} onSignOut={() => supabase.auth.signOut()} onSaveProfile={saveProfile} onDeleteDraft={deleteDraft} onContinueDraft={continueDraft} onOpenWrittenPost={openWrittenPost} onEditWrittenPost={editWrittenPost} onDeleteWrittenPost={deleteWrittenPost} />}
    </div>
  )
}

function ProfilePanel({
  profile,
  qnaPosts,
  shareItems,
  drafts,
  onClose,
  onSignOut,
  onSaveProfile,
  onDeleteDraft,
  onContinueDraft,
  onOpenWrittenPost,
  onEditWrittenPost,
  onDeleteWrittenPost,
}: {
  profile: AppProfile
  qnaPosts: QnaPost[]
  shareItems: ShareItem[]
  drafts: DraftItem[]
  onClose: () => void
  onSignOut: () => void
  onSaveProfile: (profile: AppProfile) => void
  onDeleteDraft: (draftId: string) => void
  onContinueDraft: (draft: DraftItem) => void
  onOpenWrittenPost: (kind: 'question' | 'share_item', id: string) => void
  onEditWrittenPost: (kind: 'question' | 'share_item', id: string) => void
  onDeleteWrittenPost: (kind: 'question' | 'share_item', id: string) => void
}) {
  const [view, setView] = useState<'menu' | 'profile' | 'posts' | 'drafts' | 'liked' | 'logout'>('menu')
  const [username, setUsername] = useState(profile.username)
  const [nickname, setNickname] = useState(profile.nickname)
  const [avatarUrl, setAvatarUrl] = useState(profile.avatarUrl)
  const [profileSaved, setProfileSaved] = useState(false)
  const posts: Array<{ id: string; kind: 'question' | 'share_item'; type: string; title: string; body: string }> = [
    ...qnaPosts.filter((post) => post.mine !== false).map((post) => ({ id: post.id, kind: 'question' as const, type: 'QNA', title: post.title, body: post.body })),
    ...shareItems.map((item) => ({ id: item.id, kind: 'share_item' as const, type: shareCategoryLabels[item.category ?? 'other'], title: item.title, body: item.memo })),
  ]
  const likedItems: Array<{ id: string; kind: 'question' | 'share_item'; type: string; title: string; body: string }> = [
    ...qnaPosts.filter((post) => post.liked).map((post) => ({ id: post.id, kind: 'question' as const, type: 'QNA', title: post.title, body: post.body })),
    ...shareItems.filter((item) => item.liked).map((item) => ({ id: item.id, kind: 'share_item' as const, type: shareCategoryLabels[item.category ?? 'other'], title: item.title, body: item.memo })),
  ]
  const attachAvatar = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => setAvatarUrl(typeof reader.result === 'string' ? reader.result : '')
    reader.readAsDataURL(file)
  }

  return (
    <div className="overlay">
      <button className="overlay-dim" type="button" onClick={onClose} aria-label="close" />
      <section className="profile-panel">
        <div className="profile-panel-header">
          {view !== 'menu' && <button className="profile-back" type="button" onClick={() => setView('menu')}>{'\uB4A4\uB85C'}</button>}
          <h2>&#54532;&#47196;&#54596;</h2>
        </div>
        {view === 'menu' && (
          <>
            <button type="button" onClick={() => setView('profile')}>&#45236; &#51221;&#48372; &#49688;&#51221;</button>
            <button type="button" onClick={() => setView('posts')}>&#45236;&#44032; &#50420; &#44544;</button>
            <button type="button" onClick={() => setView('drafts')}>{'\uC784\uC2DC\uC800\uC7A5'}<span>{drafts.length}</span></button>
            <button type="button" onClick={() => setView('liked')}>좋아요한<span>{likedItems.length}</span></button>
            <button type="button" onClick={() => setView('logout')}>&#47196;&#44536;&#50500;&#50883;</button>
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
            {drafts.length === 0 ? <p>임시저장한 글이 없습니다.</p> : (
              <div className="profile-list">
                {drafts.map((draft) => (
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
            {likedItems.length === 0 ? <p>좋아요한 항목이 없습니다.</p> : (
              <div className="profile-list">
                {likedItems.map((item) => (
                  <article key={`liked-${item.kind}-${item.id}`}>
                    <span>{item.type}</span>
                    <strong>{item.title}</strong>
                    <p>{item.body}</p>
                    <div className="profile-row-actions">
                      <button type="button" onClick={() => onOpenWrittenPost(item.kind, item.id)}>열기</button>
                    </div>
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
      </section>
    </div>
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

function MapScreen({ focusHospital, reviewDraft, onSaveDraft, onDeleteDraft }: { focusHospital?: HospitalSnapshot | null; reviewDraft?: DraftItem | null; onSaveDraft: (draft: DraftItem) => void | Promise<void>; onDeleteDraft: (draftId: string) => void | Promise<void> }) {
  const naverMapClientId = import.meta.env.VITE_NAVER_MAP_CLIENT_ID
  const [query, setQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<AnimalCategory>('all')
  const [hospitals, setHospitals] = useState<Hospital[]>([])
  const [selectedHospitalId, setSelectedHospitalId] = useState<string | null>(null)
  const [currentLocation, setCurrentLocation] = useState<Coordinates | null>(null)
  const [mapStatus, setMapStatus] = useState<'loading' | 'ready' | 'error'>(naverMapClientId ? 'loading' : 'error')
  const [locationStatus, setLocationStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>(naverMapClientId ? 'loading' : 'idle')
  const [isLoading, setIsLoading] = useState(false)
  const [message, setMessage] = useState(naverMapClientId ? '' : '.env.local의 VITE_NAVER_MAP_CLIENT_ID를 확인해주세요.')
  const [reviewPanelHospitalId, setReviewPanelHospitalId] = useState<string | null>(null)
  const [isReviewFormOpen, setIsReviewFormOpen] = useState(false)
  const [reviewAuthor, setReviewAuthor] = useState('')
  const [reviewRating, setReviewRating] = useState(5)
  const [reviewBody, setReviewBody] = useState('')
  const [reviews, setReviews] = useState<Record<string, HospitalReview[]>>(() => readStoredReviews())
  const mapElementRef = useRef<HTMLDivElement | null>(null)
  const mapInstanceRef = useRef<InstanceType<NaverMapApi['maps']['Map']> | null>(null)
  const markersRef = useRef<Array<InstanceType<NaverMapApi['maps']['Marker']>>>([])
  const currentLocationMarkerRef = useRef<InstanceType<NaverMapApi['maps']['Marker']> | null>(null)

  const sortedHospitals = useMemo(() => sortHospitalsByDistance(hospitals, currentLocation), [hospitals, currentLocation])
  const filteredHospitals = useMemo(() => {
    return sortedHospitals.filter((hospital) => selectedCategory === 'all' || hospital.categories.includes(selectedCategory))
  }, [selectedCategory, sortedHospitals])
  const selectedHospital = filteredHospitals.find((hospital) => hospital.id === selectedHospitalId) ?? null
  const selectedHospitalReviews = selectedHospital ? reviews[selectedHospital.id] ?? [] : []
  const isReviewPanelOpen = Boolean(selectedHospital && reviewPanelHospitalId === selectedHospital.id)
  const reviewDraftPayload = reviewDraft?.draftType === 'hospital_review' ? reviewDraft.payload as HospitalReviewDraftPayload : null

  useEffect(() => {
    if (!focusHospital) return
    let cancelled = false
    queueMicrotask(() => {
      if (cancelled) return
      const hospital = hospitalFromSnapshot(focusHospital)
      setHospitals((items) => [hospital, ...items.filter((item) => item.id !== hospital.id)])
      setSelectedHospitalId(hospital.id)
      setReviewPanelHospitalId(null)
      setQuery(hospital.name)
      setSelectedCategory(hospital.categories[0] ?? 'all')
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
    setReviewPanelHospitalId(hospital.id)
    setIsReviewFormOpen(true)
    setReviewAuthor(reviewDraftPayload.review.author)
    setReviewRating(reviewDraftPayload.review.rating)
    setReviewBody(reviewDraftPayload.review.body)
    setQuery(hospital.name)
    setSelectedCategory(hospital.categories[0] ?? 'all')
  }, [reviewDraftPayload])

  useEffect(() => {
    if (!naverMapClientId) return

    let mounted = true

    Promise.allSettled([loadNaverMaps(naverMapClientId), readBrowserLocation()])
      .then(([naverResult, locationResult]) => {
        if (!mounted || !mapElementRef.current) return

        if (naverResult.status === 'rejected') {
          throw naverResult.reason
        }

        const naver = naverResult.value
        const firstLocation = locationResult.status === 'fulfilled' ? locationResult.value : null
        const centerLocation = firstLocation ?? { lat: 37.5665, lng: 126.978 }
        const center = new naver.maps.LatLng(centerLocation.lat, centerLocation.lng)
        mapInstanceRef.current = new naver.maps.Map(mapElementRef.current, { center, zoom: 12 })
        setMapStatus('ready')

        if (firstLocation) {
          setCurrentLocation(firstLocation)
          setLocationStatus('ready')
          setMessage('내 위치 기준으로 지도를 열었어요.')
        } else {
          console.error('Initial geolocation error:', locationResult.status === 'rejected' ? locationResult.reason : null)
          setLocationStatus('error')
          setMessage('현재 위치를 가져올 수 없어서 기본 위치로 지도를 열었어요. 위치 권한을 확인해 주세요.')
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
        setReviewPanelHospitalId(null)
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

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (isLoading) return

    setIsLoading(true)
    setSelectedHospitalId(null)
    setReviewPanelHospitalId(null)
    setMessage('병원을 검색하는 중이에요.')

    const location = currentLocation ?? await getCurrentLocation().catch(() => null)

    try {
      const results = await searchHospitals(buildHospitalSearchQuery(query, selectedCategory), selectedCategory, location)
      setHospitals(results)
      setMessage(results.length > 0 ? `가까운 병원 ${results.length}곳을 찾았어요.` : '검색 결과가 없어요. 검색어를 바꿔보세요.')
    } catch (error) {
      console.error('Hospital search error:', error)
      setMessage(error instanceof Error ? error.message : '병원 검색 중 오류가 발생했습니다.')
    } finally {
      setIsLoading(false)
    }
  }

  const submitReview = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!selectedHospital || reviewBody.trim().length === 0) return

    const review: HospitalReview = {
      id: reviewDraftPayload?.review.id ?? crypto.randomUUID(),
      hospitalId: selectedHospital.id,
      author: reviewAuthor.trim() || '익명',
      rating: reviewRating,
      body: reviewBody.trim(),
      createdAt: reviewDraftPayload?.review.createdAt ?? new Date().toISOString(),
    }

    setReviews((previous) => {
      const next = { ...previous, [selectedHospital.id]: [review, ...(previous[selectedHospital.id] ?? [])] }
      localStorage.setItem(reviewStorageKey, JSON.stringify(next))
      return next
    })
    setReviewAuthor('')
    setReviewRating(5)
    setReviewBody('')
    setIsReviewFormOpen(false)
    if (reviewDraft) void onDeleteDraft(reviewDraft.id)
  }

  const saveReviewDraft = () => {
    if (!selectedHospital) return
    const review: HospitalReview = {
      id: reviewDraftPayload?.review.id ?? crypto.randomUUID(),
      hospitalId: selectedHospital.id,
      author: reviewAuthor.trim() || '익명',
      rating: reviewRating,
      body: reviewBody.trim(),
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

  return (
    <section className="map-page">
      <form className="map-search-panel" onSubmit={submit}>
        <label>
          병원 검색
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="지역명, 병원명, 특수동물 병원" />
        </label>
        <button className="secondary-button" type="button" disabled={locationStatus === 'loading'} onClick={requestCurrentLocation}>
          {locationStatus === 'loading' ? '확인중' : '내 위치'}
        </button>
        <button type="submit" disabled={isLoading}>{isLoading ? '검색 중' : '검색'}</button>
      </form>

      <div className="map-category-tags" aria-label="동물 분류 필터">
        {animalCategoryOptions.map((category) => (
          <button
            className={selectedCategory === category ? 'active' : ''}
            key={category}
            type="button"
            onClick={() => {
              setSelectedCategory(category)
              setSelectedHospitalId(null)
            }}
          >
            <CategoryTagIcon category={category} />
            <span>{animalCategoryLabels[category]}</span>
          </button>
        ))}
      </div>

      <section className="map-area">
        <div className="map-canvas" ref={mapElementRef}>
          {mapStatus !== 'ready' && (
            <span>{mapStatus === 'error' ? '지도를 불러오지 못했습니다' : '네이버 지도를 불러오는 중입니다'}</span>
          )}
        </div>
        {message && <p className={`status-copy ${mapStatus === 'error' ? 'error' : ''}`}>{message}</p>}
        {selectedHospital && (
          <article className="map-hospital-panel">
            <button className="panel-close" type="button" aria-label="닫기" onClick={() => setSelectedHospitalId(null)} />
            <div className="hospital-card-main">
              <CategoryTagIcon category={selectedHospital.categories[0] ?? 'all'} />
              <div>
                <strong>{selectedHospital.name}</strong>
                <p><span className="meta-icon location" aria-hidden="true" />{selectedHospital.address || '주소 정보 없음'}</p>
                <small><span className="meta-icon distance" aria-hidden="true" />{selectedHospital.distanceKm === undefined ? '내 위치 기준 거리 계산 전' : `내 위치에서 ${selectedHospital.distanceKm.toFixed(1)}km`}</small>
                <small><span className="meta-icon phone" aria-hidden="true" />{selectedHospital.phone || '전화번호 없음'}</small>
              </div>
            </div>
            <div className="hospital-tags">
              {selectedHospital.categories.map((category) => <span key={category}>{animalCategoryLabels[category]}</span>)}
            </div>
            <div className="hospital-actions">
              <button type="button" onClick={() => setReviewPanelHospitalId(selectedHospital.id)}>리뷰 보기</button>
              {selectedHospital.phone && <a href={`tel:${selectedHospital.phone}`}>전화하기</a>}
            </div>
            {isReviewPanelOpen && (
              <section className="hospital-review-panel">
                <div className="review-panel-head">
                  <div><strong>리뷰</strong><span>{selectedHospitalReviews.length}개</span></div>
                  <button className="review-add-button" type="button" aria-label="리뷰 작성" onClick={() => setIsReviewFormOpen((value) => !value)} />
                </div>
                {isReviewFormOpen && (
                  <form className="review-form" onSubmit={submitReview}>
                    <div className="step-progress review-progress" aria-hidden="true"><span style={{ width: '100%' }} /></div>
                    <div className="review-form-row">
                      <input value={reviewAuthor} onChange={(event) => setReviewAuthor(event.target.value)} placeholder="닉네임" />
                      <select value={reviewRating} onChange={(event) => setReviewRating(Number(event.target.value))}>
                        {[5, 4, 3, 2, 1].map((rating) => <option key={rating} value={rating}>{rating}점</option>)}
                      </select>
                    </div>
                    <textarea value={reviewBody} onChange={(event) => setReviewBody(event.target.value)} placeholder="방문 경험을 남겨주세요." />
                    <button type="button" onClick={saveReviewDraft}>임시저장</button>
                    <button type="submit" disabled={reviewBody.trim().length === 0}>등록</button>
                  </form>
                )}
                {selectedHospitalReviews.length === 0 ? (
                  <p className="review-empty">아직 리뷰가 없어요. + 버튼으로 첫 리뷰를 남겨주세요.</p>
                ) : (
                  <div className="review-list">
                    {selectedHospitalReviews.map((review) => (
                      <article className="review-item" key={review.id}>
                        <div><strong>{review.author}</strong><span>{review.rating}점</span></div>
                        <p>{review.body}</p>
                        <time dateTime={review.createdAt}>{formatReviewDate(review.createdAt)}</time>
                      </article>
                    ))}
                  </div>
                )}
              </section>
            )}
          </article>
        )}
      </section>
    </section>
  )
}

function PetsScreen({ pets, onDeletePet, onEditPet, onOpenDiary, onRegisterPet }: { pets: Pet[]; onDeletePet: (petId: string) => void; onEditPet: (pet: Pet) => void; onOpenDiary: (petId: string) => void; onRegisterPet: () => void }) {
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<AnimalCategory>('all')
  const [sort, setSort] = useState<'latest' | 'oldest'>('latest')
  const [view, setView] = useState<'card' | 'list'>(() => localStorage.getItem('exocare-pet-view') === 'list' ? 'list' : 'card')
  const [records, setRecords] = useState<PetRecord[]>([])
  const [menuPetId, setMenuPetId] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Pet | null>(null)
  const [detailPet, setDetailPet] = useState<Pet | null>(null)

  useEffect(() => {
    localStorage.setItem('exocare-pet-view', view)
  }, [view])

  useEffect(() => {
    let active = true
    loadAppData<PetRecord>('care_records').then((items) => {
      if (active) setRecords(items)
    }).catch(() => {
      if (active) setRecords([])
    })
    return () => { active = false }
  }, [pets.length])

  const filteredPets = pets.filter((pet) => {
    const text = `${pet.name} ${pet.species} ${animalCategoryLabels[pet.group]}`.toLowerCase()
    return (category === 'all' || pet.group === category) && text.includes(query.trim().toLowerCase())
  }).sort((a, b) => {
    const aDate = new Date(a.registeredAt ?? 0).getTime()
    const bDate = new Date(b.registeredAt ?? 0).getTime()
    return sort === 'latest' ? bDate - aDate : aDate - bDate
  })

  const recentRecords = (petId: string) => records.filter((record) => record.petId === petId).sort((a, b) => `${b.date}${b.createdAt}`.localeCompare(`${a.date}${a.createdAt}`)).slice(0, 4)
  const openDeleteConfirm = (pet: Pet) => {
    setMenuPetId(null)
    setDeleteTarget(pet)
  }
  const confirmDelete = () => {
    if (!deleteTarget) return
    onDeletePet(deleteTarget.id)
    setDeleteTarget(null)
  }

  return (
    <section className="page-stack my-pet-dashboard">
      <section className="section-block my-pet-tools my-pet-dashboard-panel">
        <div className="my-pet-dashboard-heading"><div><h2>마이 펫</h2><p>반려동물 관리</p></div></div>
        <label className="my-pet-search"><span>동물 검색</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="이름, 종, 분류 검색" /></label>
        <div className="filter-tags" aria-label="동물 분류 필터">
          {animalCategoryOptions.map((item) => (
            <button className={category === item ? 'active' : ''} type="button" key={item} onClick={() => setCategory(item)}>
              <CategoryTagIcon category={item} /><span>{animalCategoryLabels[item]}</span>
            </button>
          ))}
        </div>
      </section>
      <section className="section-block my-pet-section my-pet-dashboard-panel">
        <div className="pet-list-toolbar"><div className="section-title"><h2>등록된 펫</h2><span>{filteredPets.length}마리</span></div><div className="pet-list-controls"><select value={sort} onChange={(event) => setSort(event.target.value as 'latest' | 'oldest')} aria-label="정렬"><option value="latest">최신 등록순</option><option value="oldest">오래된 등록순</option></select><div className="pet-view-toggle" aria-label="보기 방식"><button className={view === 'card' ? 'active' : ''} type="button" onClick={() => setView('card')} aria-label="카드형 보기">▦</button><button className={view === 'list' ? 'active' : ''} type="button" onClick={() => setView('list')} aria-label="리스트형 보기">☷</button></div></div></div>
        {filteredPets.length === 0 ? <div className="pet-empty-state"><strong>{pets.length === 0 ? '등록된 펫 없음' : '해당 분류에 펫 없음'}</strong><p>{pets.length === 0 ? '첫 펫을 등록해보세요.' : '필터를 바꿔보세요.'}</p>{pets.length === 0 && <button type="button" onClick={onRegisterPet}>+ 펫 등록</button>}</div> : (
          <div className={`pet-list ${view === 'list' ? 'list-view' : 'card-view'}`}>
            {filteredPets.map((pet) => (
              <article className="pet-card" key={pet.id} onClick={() => setDetailPet(pet)}>
                <div className="pet-card-topline">
                  <span className="pet-category-badge">{animalCategoryLabels[pet.group]}</span>
                  <div className="pet-card-actions">
                    <button className="pet-more-button" type="button" aria-label="펫 메뉴" onClick={(event) => { event.stopPropagation(); setMenuPetId(menuPetId === pet.id ? null : pet.id) }}>⋮</button>
                    {menuPetId === pet.id && <div className="pet-more-menu"><button type="button" onClick={(event) => { event.stopPropagation(); setMenuPetId(null); onEditPet(pet) }}>수정</button><button className="danger" type="button" onClick={(event) => { event.stopPropagation(); openDeleteConfirm(pet) }}>삭제</button></div>}
                  </div>
                </div>
                <div className="pet-card-visual">
                  <div className="pet-card-icon">{pet.photo ? <img src={pet.photo} alt={`${pet.name} 사진`} /> : <CategoryTagIcon category={pet.group} />}</div>
                  <div className="pet-card-title-row"><strong>{pet.name}</strong></div>
                  <small className="pet-species-line">{pet.species}</small>
                </div>
                <div className="pet-card-body">
                  <div className="pet-info-badges"><span><b>성별</b>{genderLabel(pet.gender)}</span>{(pet.ageText || pet.ageStage) && <span><b>나이</b>{pet.ageText || pet.ageStage}</span>}{pet.registeredAt && <span><b>등록</b>{formatPetDate(pet.registeredAt)}</span>}{pet.weight && <span><b>무게</b>{pet.weight}{pet.weightUnit ?? 'g'}</span>}</div>
                  {pet.description && <p className="pet-description">{pet.description}</p>}
                </div>
                <div className="pet-recent-records"><strong>최근 기록</strong>{recentRecords(pet.id).length === 0 ? <p>기록 없음</p> : recentRecords(pet.id).map((record) => <div key={record.id}><span>{recordTypeLabels[record.type]}{record.weight ? ` ${record.weight}g` : ''}</span><time>{formatPetDate(record.date)}</time></div>)}</div>
                <div className="pet-card-footer"><button type="button" title="상세 정보" onClick={(event) => { event.stopPropagation(); setDetailPet(pet) }}>상세</button><button type="button" title="기록 추가" onClick={(event) => { event.stopPropagation(); onOpenDiary(pet.id) }}>기록</button><button type="button" title="수정" onClick={(event) => { event.stopPropagation(); onEditPet(pet) }}>수정</button>
                </div>
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

function PetDetailModal({ pet, records, onClose, onEdit, onOpenDiary }: { pet: Pet; records: PetRecord[]; onClose: () => void; onEdit: () => void; onOpenDiary: () => void }) {
  return (
    <div className="pet-detail-overlay">
      <button className="overlay-dim" type="button" aria-label="펫 상세 닫기" onClick={onClose} />
      <section className="pet-detail-modal" role="dialog" aria-modal="true" aria-label={`${pet.name} 상세 정보`}>
        <button className="pet-detail-close" type="button" aria-label="닫기" onClick={onClose}>×</button>
        <div className="pet-detail-hero">{pet.photo ? <img src={pet.photo} alt={`${pet.name} 사진`} /> : <div className="pet-card-icon"><CategoryTagIcon category={pet.group} /></div>}<div><span>{animalCategoryLabels[pet.group]}</span><h2>{pet.name}</h2><p>{pet.species} · {genderLabel(pet.gender)}</p></div></div>
        <div className="pet-detail-grid"><div><b>성별</b><span>{genderLabel(pet.gender)}</span></div><div><b>나이</b><span>{pet.ageText || pet.ageStage || '정보 없음'}</span></div><div><b>등록일</b><span>{formatPetDate(pet.registeredAt)}</span></div><div><b>무게</b><span>{pet.weight ? `${pet.weight}${pet.weightUnit ?? 'g'}` : '정보 없음'}</span></div></div>
        <section className="pet-detail-records"><h3>최근 기록</h3>{records.length === 0 ? <p>아직 작성된 기록이 없습니다.</p> : records.map((record) => <div key={record.id}><span>{recordTypeLabels[record.type]}{record.weight ? ` ${record.weight}g` : ''}</span><time>{formatPetDate(record.date)}</time></div>)}</section>
        <div className="pet-detail-actions"><button type="button" onClick={onOpenDiary}>기록 작성</button><button type="button" onClick={onEdit}>수정</button></div>
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

function QnaScreen({ userId, profile, posts, openPostId, onOpenHandled, onChange, onDeletePost, onOpenHospital }: { userId: string; profile: AppProfile; posts: QnaPost[]; openPostId?: string | null; onOpenHandled?: () => void; onChange: (posts: QnaPost[]) => void; onDeletePost: (postId: string) => void; onOpenHospital: (hospital: HospitalSnapshot) => void }) {
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
          {selected.mine === true && <ItemActions onDelete={() => { onDeletePost(selected.id); setSelectedId(null) }} />}
        </header>
        <article className="qna-detail-post">
          <div className="qna-detail-badges"><span className="qna-category">{normalizeQnaCategory(selected.category)}</span><span className={`qna-status ${qnaStatus(selected)}`}>{qnaStatusLabel(qnaStatus(selected))}</span></div>
          <h2>{selected.title}</h2>
          <div className="qna-author"><UserAvatar url={selected.authorAvatarUrl || (selected.mine === true ? profile.avatarUrl : '')} name={selected.author} /><div><strong>{selected.author}</strong><span>{formatQnaAnimal(selected)} · {formatQnaDate(selected.createdAt)}</span></div></div>
          {selected.image && <img src={selected.image} alt="" />}
          {selected.attachedRecordSnapshot && <RecordAttachCard record={selected.attachedRecordSnapshot} mode="posted" />}
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
        <div>
          <h2>QNA</h2>
        </div>
        <button className="qna-feed-sort-trigger" type="button" onClick={() => setSortSheetOpen(true)}>정렬: {qnaSortLabel(sort)} ▾</button>
      </header>
      <label className="qna-feed-search"><span aria-hidden="true">⌕</span><input value={query} onChange={(event) => { setQuery(event.target.value); setVisibleCount(6) }} placeholder="어떤 문제가 있나요?" /></label>
      <div className="qna-category-rail" aria-label="QNA 카테고리 안내">
        {qnaCategoryCards.map((categoryItem) => (
          <button className={feedCategory === categoryItem ? 'active' : ''} type="button" key={categoryItem} onClick={() => { setFeedCategory(feedCategory === categoryItem ? null : categoryItem); setVisibleCount(6) }}>
            <strong>{categoryItem}</strong>
          </button>
        ))}
      </div>
      {feedCategory && <button className="qna-feed-clear" type="button" onClick={() => { setFeedCategory(null); setVisibleCount(6) }}>전체 질문 보기</button>}
      {feedPosts.length === 0 ? <div className="qna-empty-state">
        <div className="qna-empty-icon" aria-hidden="true">⌕</div>
        <strong>아직 등록된 질문이 없어요.</strong>
      </div> : (
        <section className="qna-feed-section">
          <div className="qna-feed-list">
                {visiblePosts.map((post) => <QnaHelpCard post={post} fallbackAvatarUrl={post.mine === true ? profile.avatarUrl : ''} key={post.id} onOpen={() => setSelectedId(post.id)} onDelete={sort === 'resolved' && post.mine === true ? () => onDeletePost(post.id) : undefined} />)}
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
  return (
    <article className={`qna-help-card ${qnaStatus(post)}`} onClick={onOpen}>
      <div className="qna-help-card-top">
        <span className={`qna-status ${qnaStatus(post)}`}>{qnaStatusLabel(qnaStatus(post))}</span>
        <span className="qna-category">{normalizeQnaCategory(post.category)}</span>
        {onDelete && <button className="qna-feed-delete" type="button" onClick={(event) => { event.stopPropagation(); onDelete() }}>삭제</button>}
      </div>
      <h3>{post.title}</h3>
      <footer>
        <span>{formatQnaAnimal(post)}</span>
        <span>댓글 {post.comments.length}</span>
        <span>{formatQnaDate(post.createdAt)}</span>
        <span className="post-author"><UserAvatar url={post.authorAvatarUrl || fallbackAvatarUrl} name={post.author} />{post.author}</span>
      </footer>
      {(post.image || record) && <div className="qna-attach-flags">{post.image && <span>사진 첨부</span>}{record && <span>기록 첨부 · {formatRecordDate(record.recordDate)}</span>}</div>}
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
  const [openFilter, setOpenFilter] = useState<'category' | 'sort' | 'gender' | 'all' | null>(null)
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null)
  const normalized = items.map((item) => ({ ...item, status: item.status ?? 'active' as ShareStatus, category: item.category ?? 'supplies' as ShareCategory, subcategory: item.subcategory ?? '', species: item.species ?? '', gender: item.gender ?? 'unknown' as const, imageUrl: item.imageUrl ?? '', createdAt: item.createdAt ?? new Date(0).toISOString(), likes: item.likes ?? 0, liked: item.liked ?? false }))
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
  const sortLabels = { latest: '최신순', popular: '인기순' }
  const genderLabels = { all: '전체', male: '수컷', female: '암컷', unknown: '미구분' }
  const setCategoryFilter = (value: string) => {
    setCategory(value as 'all' | ShareCategory)
    setOpenFilter(null)
  }
  const setSortFilter = (value: string) => {
    setSort(value as ShareSort)
    setOpenFilter(null)
  }
  const setGenderFilter = (value: string) => {
    setGender(value as 'all' | Pet['gender'])
    setOpenFilter(null)
  }
  const toggleLike = (id: string) => {
    const next = normalized.map((item) => item.id === id ? { ...item, liked: !item.liked, likes: Math.max(0, item.likes + (item.liked ? -1 : 1)) } : item)
    onItemsChange(next)
    const changed = next.find((item) => item.id === id)
    if (changed) onSaveItem(changed)
  }
  const toggleShareStatus = (id: string) => {
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
            <button className="share-edit-button" type="button" onClick={() => onEditItem(selectedItem)}>수정</button>
            <ItemActions onDelete={() => { onDeleteItem(selectedItem.id); setSelectedItemId(null) }} />
          </div>
        </header>
        <article className="qna-detail-post">
          <div className="qna-detail-badges"><span className="qna-category">{shareCategoryLabels[selectedItem.category]}</span><span>{selectedItem.area || '지역 미입력'}</span></div>
          <h2>{selectedItem.title}</h2>
          {selectedItem.imageUrl && <img src={selectedItem.imageUrl} alt="" />}
          <p>{selectedItem.memo}</p>
          <div className="qna-detail-actions">
            <button className={`qna-like ${selectedItem.liked ? 'active' : ''}`} type="button" onClick={() => toggleLike(selectedItem.id)}>♥ {selectedItem.likes}</button>
            <button className="qna-status-toggle" type="button" onClick={() => toggleShareStatus(selectedItem.id)}>{selectedItem.status === 'completed' ? '다시 나눔중' : '나눔 완료'}</button>
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
        { id: 'status', label: status === 'active' ? '진행중' : '완료', active: status === 'completed', onClick: () => { setStatus(status === 'active' ? 'completed' : 'active'); setOpenFilter(null) } },
        { id: 'category', label: category === 'all' ? '종류' : shareCategoryLabels[category], active: openFilter === 'category' || category !== 'all', onClick: () => setOpenFilter(openFilter === 'category' ? null : 'category') },
        { id: 'sort', label: sortLabels[sort], active: openFilter === 'sort' || sort !== 'latest', onClick: () => setOpenFilter(openFilter === 'sort' ? null : 'sort') },
        { id: 'gender', label: gender === 'all' ? '성별' : genderLabel(gender), active: openFilter === 'gender' || gender !== 'all', onClick: () => setOpenFilter(openFilter === 'gender' ? null : 'gender') },
        { id: 'all', label: '전체 필터', active: openFilter === 'all', iconOnly: true, ariaLabel: '전체 필터', onClick: () => setOpenFilter(openFilter === 'all' ? null : 'all') },
      ]}
    >
        {openFilter && <div className="share-filter-panel">
          {(openFilter === 'category' || openFilter === 'all') && <FilterGroup title="종류" options={['all', ...Object.keys(shareCategoryLabels)]} value={category} labels={categoryLabels} onChange={setCategoryFilter} />}
          {(openFilter === 'sort' || openFilter === 'all') && <FilterGroup title="정렬" options={['latest', 'popular']} value={sort} labels={sortLabels} onChange={setSortFilter} />}
          {(openFilter === 'gender' || openFilter === 'all') && <FilterGroup title="성별" options={['all', 'male', 'female', 'unknown']} value={gender} labels={genderLabels} onChange={setGenderFilter} />}
        </div>}
          {filtered.length === 0 ? <div className="share-empty"><strong>{status === 'completed' ? '완료된 글이 없습니다' : '게시글이 없습니다'}</strong><p>{status === 'completed' ? '나눔 완료 처리한 글이 이곳에 모입니다.' : '조건을 바꾸거나 첫 무료분양/나눔 글을 작성해 보세요.'}</p></div> : <div className="share-card-grid">
            {filtered.map((item) => (
              <article className={`share-card ${item.status === 'completed' ? 'completed' : ''}`} key={item.id} onClick={() => setSelectedItemId(item.id)}>
                <div className="share-card-media">{item.imageUrl ? <img src={item.imageUrl} alt="" /> : <span>사진 없음</span>}<button className={item.liked ? 'liked' : ''} type="button" aria-label="좋아요" onClick={(event) => { event.stopPropagation(); toggleLike(item.id) }}>♥</button></div>
                <div className="share-card-body"><strong>{item.title}</strong><p>{item.species || item.subcategory}</p><div className="share-card-tags">{item.status === 'completed' && <span className="share-status-tag">완료</span>}<span>{shareCategoryLabels[item.category]}</span>{!['food', 'supplies'].includes(item.category) && <span>{genderLabel(item.gender)}</span>}</div><div className="share-card-meta"><span>{item.area || '지역 미입력'} · ♥ {item.likes}</span><ItemActions onDelete={() => onDeleteItem(item.id)} /></div><div className="share-card-actions"><button className="share-edit-button" type="button" onClick={(event) => { event.stopPropagation(); onEditItem(item) }}>수정</button><button className="share-complete-button" type="button" onClick={(event) => { event.stopPropagation(); toggleShareStatus(item.id) }}>{item.status === 'completed' ? '다시 나눔중' : '나눔 완료'}</button></div></div>
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

function RecordPicker({ pets, records, initialPetId, onClose, onSelect }: { pets: Pet[]; records: PetRecord[]; initialPetId: string; onClose: () => void; onSelect: (record: PetRecord, pet: Pet) => void }) {
  const initialSelectedPetId = initialPetId || pets[0]?.id || ''
  const initialRecord = records.filter((record) => record.petId === initialSelectedPetId).sort((a, b) => b.date.localeCompare(a.date))[0]
  const [selectedPetId, setSelectedPetId] = useState(initialSelectedPetId)
  const [visibleMonth, setVisibleMonth] = useState(initialRecord ? new Date(initialRecord.date) : new Date())
  const selectedPet = pets.find((pet) => pet.id === selectedPetId)
  const petRecords = records
    .filter((record) => record.petId === selectedPetId)
    .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt))
  const recordDates = Array.from(new Set(petRecords.map((record) => record.date)))
  const [selectedDate, setSelectedDate] = useState(recordDates[0] ?? '')
  const activeDate = recordDates.includes(selectedDate) ? selectedDate : recordDates[0] ?? ''
  const dayRecords = petRecords.filter((record) => !activeDate || record.date === activeDate)
  const calendarDays = getRecordPickerCalendarDays(visibleMonth)

  return (
    <div className="record-picker-overlay">
      <button className="record-picker-dim" type="button" aria-label="기록 선택 닫기" onClick={onClose} />
      <section className="record-picker-sheet" role="dialog" aria-modal="true" aria-label="QNA에 기록 첨부">
        <div className="hospital-picker-handle" aria-hidden="true" />
        <header>
          <div><strong>기록 첨부</strong><p>질문에 참고할 내 펫 기록을 선택합니다.</p></div>
          <button type="button" aria-label="닫기" onClick={onClose}>×</button>
        </header>
        {pets.length === 0 ? (
          <p className="record-picker-empty">등록된 마이 펫이 없습니다.</p>
        ) : (
          <>
            <div className="record-picker-pets">
              {pets.map((pet) => (
                <button className={selectedPetId === pet.id ? 'active' : ''} type="button" key={pet.id} onClick={() => {
                  const nextRecords = records.filter((record) => record.petId === pet.id).sort((a, b) => b.date.localeCompare(a.date))
                  setSelectedPetId(pet.id)
                  setSelectedDate('')
                  if (nextRecords[0]) setVisibleMonth(new Date(nextRecords[0].date))
                }}>
                  <strong>{pet.name}</strong>
                  <span>{animalCategoryLabels[pet.group]} · {pet.species}</span>
                </button>
              ))}
            </div>
            {selectedPet && petRecords.length > 0 && <section className="record-picker-calendar">
              <header>
                <button type="button" aria-label="이전 달" onClick={() => setVisibleMonth(new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() - 1, 1))}>‹</button>
                <strong>{visibleMonth.getFullYear()}년 {visibleMonth.getMonth() + 1}월</strong>
                <button type="button" aria-label="다음 달" onClick={() => setVisibleMonth(new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + 1, 1))}>›</button>
              </header>
              <div className="record-picker-weekdays">{['일', '월', '화', '수', '목', '금', '토'].map((day) => <span key={day}>{day}</span>)}</div>
              <div className="record-picker-days">
                {calendarDays.map((day) => {
                  const key = toRecordDateKey(day)
                  const count = petRecords.filter((record) => record.date === key).length
                  const isCurrentMonth = day.getMonth() === visibleMonth.getMonth()
                  return (
                    <button className={`${activeDate === key ? 'active' : ''}${!isCurrentMonth ? ' muted' : ''}`} type="button" key={key} onClick={() => count > 0 && setSelectedDate(key)} disabled={count === 0}>
                      <span>{day.getDate()}</span>
                      {count > 0 && <small>{count}</small>}
                    </button>
                  )
                })}
              </div>
            </section>}
            <div className="record-picker-list">
              {selectedPet && petRecords.length === 0 && <p className="record-picker-empty">이 펫의 기록이 없습니다.</p>}
              {selectedPet && dayRecords.length > 0 && <strong className="record-picker-selected-date">{formatRecordDate(activeDate)} 전체 기록</strong>}
              {selectedPet && dayRecords.map((record) => (
                <button type="button" key={record.id} onClick={() => onSelect(record, selectedPet)}>
                  {record.photoUrl && <img src={record.photoUrl} alt="" />}
                  <div>
                    <span>{formatRecordDate(record.date)} · {recordTypeLabels[record.type]}</span>
                    <strong>{summarizeRecord(record)}</strong>
                  </div>
                </button>
              ))}
            </div>
          </>
        )}
      </section>
    </div>
  )
}

function RecordAttachCard({ record, mode, onRemove }: { record: AttachedRecordSnapshot; mode: 'draft' | 'posted'; onRemove?: () => void }) {
  return (
    <div className={`record-attach-card ${mode}`}>
      {record.photoUrl && <img src={record.photoUrl} alt="" />}
      <div>
        <span>{record.petName} · {record.animalGroup} · {record.animalSpecies}</span>
        <strong>{formatRecordDate(record.recordDate)} · {record.recordTypeLabel}</strong>
        <p>{record.summary}</p>
      </div>
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
  const canNext = step === 0 ? Boolean(group) : step === 1 ? Boolean(species && gender) : name.trim().length > 0
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
          <div className="pet-complete-actions"><button type="button" onClick={onClose}>나중에</button><button className="step-primary" type="button" disabled={!hasAdditionalDetails} onClick={async () => { await onSave(completedWithDetails); onClose() }}>추가 정보 저장</button></div>
        </section>
      </main>
    )
  }

  return (
    <StepShell title="펫" onBack={step === 0 ? onClose : () => setStep((value) => value - 1)} currentStep={step} stepCount={3} onStepChange={setStep}>
      {step === 0 && <StepSelect label="종류" value={group} options={animalCategoryOptions.filter((item) => item !== 'all')} labels={animalCategoryLabels} onChange={(value) => { setGroup(value as Exclude<AnimalCategory, 'all'>); setSpecies('') }} />}
      {step === 1 && <div className="pet-species-gender-step"><StepSelect label="종" value={species} options={group ? petSpeciesOptions[group] : []} onChange={setSpecies} /><StepSelect label="성별" value={gender} options={['male', 'female', 'unknown']} labels={{ male: '수컷', female: '암컷', unknown: '미구분' }} onChange={(value) => setGender(value as Pet['gender'])} /></div>}
      {step === 2 && <StepText label="이름(닉네임)" value={name} onChange={setName} placeholder="예: 레오" />}
      <button className="step-secondary" type="button" onClick={saveDraft}>임시저장</button>
      <button className="step-primary" type="button" disabled={!canNext} onClick={step === 2 ? finishRequired : () => setStep((value) => value + 1)}>{step === 2 ? '등록 완료' : '다음'}</button>
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
  const [records, setRecords] = useState<PetRecord[]>([])
  const [recordPickerOpen, setRecordPickerOpen] = useState(false)
  const [attachedRecord, setAttachedRecord] = useState<AttachedRecordSnapshot | null>(initialPost?.attachedRecordSnapshot ?? null)
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
    createdAt: initialPost?.createdAt ?? new Date().toISOString(),
    liked: false,
    likes: 0,
    comments: [],
  })

  useEffect(() => {
    let active = true
    loadAppData<PetRecord>('care_records')
      .then((nextRecords) => {
        if (active) setRecords(nextRecords)
      })
      .catch(() => {
        if (active) setRecords([])
      })
    return () => { active = false }
  }, [userId])

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
    <StepShell title="NA" onBack={step === 0 ? onClose : () => setStep((value) => value - 1)} currentStep={step} stepCount={3} onStepChange={setStep}>
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
        <div className="qna-compose-tools">
          <button type="button" onClick={() => setRecordPickerOpen(true)}>기록 첨부</button>
          <span>{attachedRecord ? `${attachedRecord.recordTypeLabel} 기록 첨부됨` : '선택 사항'}</span>
        </div>
      </div>}
      {step === 2 && <button className="step-secondary" type="button" onClick={saveDraft}>임시저장</button>}
      <button className="step-primary" type="button" disabled={!canNext} onClick={step === 2 ? finish : () => setStep((value) => value + 1)}>{step === 2 ? '등록' : '다음'}</button>
      {recordPickerOpen && <RecordPicker pets={pets} records={records} initialPetId={!hasNoAnimal ? petId : ''} onClose={() => setRecordPickerOpen(false)} onSelect={(record, recordPet) => { setAttachedRecord(toAttachedRecordSnapshot(record, recordPet)); setRecordPickerOpen(false) }} />}
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

function summarizeRecord(record: PetRecord) {
  if (record.memo?.trim()) return record.memo.trim()
  if (record.type === 'food' && record.foods?.length) return record.foods.join(', ')
  if (record.type === 'weight' && record.weight !== undefined) return `${record.weight}g`
  return `${recordTypeLabels[record.type]} 기록`
}

function formatRecordDate(value: string) {
  return new Intl.DateTimeFormat('ko-KR', { month: 'short', day: 'numeric' }).format(new Date(value))
}

function toRecordDateKey(date: Date) {
  const year = date.getFullYear()
  const month = `${date.getMonth() + 1}`.padStart(2, '0')
  const day = `${date.getDate()}`.padStart(2, '0')
  return `${year}-${month}-${day}`
}

function getRecordPickerCalendarDays(month: Date) {
  const start = new Date(month.getFullYear(), month.getMonth(), 1)
  const first = new Date(start)
  first.setDate(start.getDate() - start.getDay())
  return Array.from({ length: 42 }, (_, index) => new Date(first.getFullYear(), first.getMonth(), first.getDate() + index))
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
      {step === 4 && <button className="step-secondary" type="button" onClick={saveDraft}>임시저장</button>}
      <button className="step-primary" type="button" disabled={!canNext} onClick={step === 4 ? finish : () => setStep((value) => value + 1)}>{step === 4 ? '등록' : '다음'}</button>
    </StepShell>
  )
}

function StepShell({ title, children, onBack, currentStep, stepCount, onStepChange }: { title: string; children: ReactNode; onBack: () => void; currentStep?: number; stepCount?: number; onStepChange?: (step: number) => void }) {
  const progress = currentStep !== undefined && stepCount ? (currentStep + 1) / stepCount : undefined
  return (
    <main className="step-screen">
      <header className="step-header">
        <button className="back" type="button" aria-label="뒤로가기" onClick={onBack}>←</button>
        <strong>{title}</strong>
      </header>
      {progress !== undefined && stepCount && <div className="step-progress step-progress-selectable" role="tablist" aria-label="작성 단계">
        <span className="step-progress-fill" style={{ width: `${progress * 100}%` }} />
        {Array.from({ length: stepCount }, (_, index) => <button key={index} className={index === currentStep ? 'active' : ''} type="button" role="tab" aria-selected={index === currentStep} aria-label={`${index + 1}단계`} onClick={() => onStepChange?.(index)}><span>{index + 1}</span></button>)}
      </div>}
      <section className="step-card">{children}</section>
    </main>
  )
}

function StepText({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (value: string) => void; placeholder: string }) {
  return <label className="step-field"><span>{label}</span><input autoFocus value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} /></label>
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
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
  const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

  if (supabaseUrl && publishableKey && supabaseUrl.startsWith('http')) {
    const response = await fetch(`${supabaseUrl.replace(/\/$/, '')}/functions/v1/search-hospitals`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: publishableKey,
        Authorization: `Bearer ${publishableKey}`,
      },
      body: JSON.stringify({ query, display: 100, start: 1, sort: 'random' }),
    })
    const data = await response.json().catch(() => ({}))
    if (!response.ok) {
      if (response.status === 429 || data.error === 'rate_limited' || data.errorCode === '012') {
        throw new Error('검색 요청이 너무 많아요. 잠시 후 다시 시도해주세요.')
      }
      throw new Error(data.message || data.error || '병원 검색 API 호출에 실패했습니다.')
    }
    const hospitals = transformHospitalItems(data.items ?? data.hospitals ?? [], query, category)
    return sortHospitalsByDistance(hospitals, location)
  }

  const fallback = await loadCollectedHospitals(query, category)
  return sortHospitalsByDistance(fallback, location)
}

async function loadCollectedHospitals(query: string, category: AnimalCategory) {
  const response = await fetch('/data/exotic-hospitals.json', { cache: 'no-store' })
  if (!response.ok) return []
  const items = await response.json() as Array<Record<string, unknown>>
  return transformHospitalItems(items, query, category)
}

function transformHospitalItems(items: Array<Record<string, unknown>>, query: string, category: AnimalCategory) {
  return dedupeHospitals(items
    .map((item, index) => transformHospitalItem(item, index, query, category))
    .filter((hospital): hospital is Hospital => Boolean(hospital)))
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
  const supportedAnimals = Array.isArray(item.supportedAnimals) ? item.supportedAnimals : []
  const categories = supportedAnimals
    .filter((value): value is Exclude<AnimalCategory, 'all'> => value === 'reptile' || value === 'bird' || value === 'rodent' || value === 'amphibian' || value === 'other')
  const guessed = categories.length > 0 ? categories : guessAnimalCategories(text, category)

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
  const naver = window.naver
  if (naver?.maps.TransCoord) {
    const latLng = naver.maps.TransCoord.fromTM128ToLatLng(new naver.maps.Point(mapx, mapy))
    return { lat: latLng.lat(), lng: latLng.lng() }
  }
  return { lat: mapy / 10_000_000, lng: mapx / 10_000_000 }
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
  if (category === 'all') return trimmed
  return normalizeText(trimmed).includes(normalizeText(categoryTerm)) ? trimmed : `${trimmed} ${categoryTerm}`
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
  return `<button class="hospital-map-marker${active ? ' active' : ''}${trusted ? ' trusted' : ''}" type="button" aria-label="${escapeHtml(hospital.name)}"><span>H</span></button>`
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

