import { type FormEvent, type ReactNode, useEffect, useMemo, useRef, useState } from 'react'
import './App.css'
import DiaryPage from './features/diary/DiaryPage'
import { supabase } from './lib/supabase'

type Tab = 'pets' | 'diary' | 'map' | 'community' | 'share'
type CreateMode = 'pet' | 'record' | 'post' | 'share' | null
type Gender = '미구분' | '수컷' | '암컷'
type RecordType = '먹이' | '무게' | '탈피' | '배변' | '온욕' | '청소' | '병원' | '기타'
type RecordDetail = '급여 완료' | '먹이 거부' | '소량 급여' | '측정 완료' | '증가' | '감소' | '탈피 중' | '탈피 완료' | '탈피 문제' | '예약' | '방문 완료' | '약 복용'

type Pet = {
  id: string
  name: string
  species: string
  group: string
  gender: Gender
}

type CareRecord = {
  id: string
  petId: string
  date: string
  type: RecordType
  detail?: RecordDetail
  memo: string
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
  categories: AnimalCategory[]
  rawCategory?: string
  matchedQueries?: string[]
  classification?: string
}

type AnimalCategory = 'all' | 'reptile' | 'amphibian' | 'rodent' | 'bird'

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

type Coordinates = {
  lat: number
  lng: number
}

declare global {
  interface Window {
    naver?: NaverMapApi
  }
}

let naverMapsLoader: Promise<NaverMapApi> | null = null

type Post = {
  id: string
  category: string
  title: string
  body: string
}

type ShareItem = {
  id: string
  title: string
  area: string
  memo: string
}

type AppUser = {
  id: string
  username: string
  nickname: string
}

const appUserStorageKey = 'exocare-app-user'

const tabs: Array<{ id: Tab; label: string }> = [
  { id: 'pets', label: '마이 펫' },
  { id: 'diary', label: '기록' },
  { id: 'map', label: '지도' },
  { id: 'community', label: '커뮤니티' },
  { id: 'share', label: '나눔' },
]

const animalGroups = ['파충류', '양서류', '조류', '설치류', '기타']
const animalCategoryOptions: AnimalCategory[] = ['all', 'reptile', 'rodent', 'amphibian', 'bird']
const animalCategoryLabels: Record<AnimalCategory, string> = {
  all: '전체',
  reptile: '파충류',
  amphibian: '양서류',
  rodent: '설치류',
  bird: '조류',
}
const animalCategoryKeywords: Record<Exclude<AnimalCategory, 'all'>, string[]> = {
  reptile: ['파충류', '도마뱀', '카멜레온', '거북', '거북이', '뱀', '게코', '크레스티드', '레오파드', '비어디', '이구아나'],
  amphibian: ['양서류', '개구리', '팩맨', '도롱뇽', '뉴트', '살라만더'],
  rodent: ['설치류', '햄스터', '기니피그', '친칠라', '데구', '저빌', '고슴도치', '토끼', '페럿'],
  bird: ['조류', '앵무새', '새', '카나리아', '문조', '잉꼬', '코뉴어'],
}
const recordTypes: RecordType[] = ['먹이', '무게', '탈피', '배변', '온욕', '청소', '병원', '기타']
const recordIcons = new Map<RecordType, string>([
  ['먹이', ''],
  ['무게', ''],
  ['탈피', ''],
  ['배변', ''],
  ['온욕', ''],
  ['청소', ''],
  ['병원', ''],
  ['기타', ''],
])
const animalGroupIcons = new Map<string, string>([
  ['파충류', ''],
  ['양서류', ''],
  ['조류', ''],
  ['설치류', ''],
  ['기타', ''],
])
const recordDetailOptions: Partial<Record<RecordType, RecordDetail[]>> = {
  먹이: ['급여 완료', '먹이 거부', '소량 급여'],
  무게: ['측정 완료', '증가', '감소'],
  탈피: ['탈피 중', '탈피 완료', '탈피 문제'],
  병원: ['예약', '방문 완료', '약 복용'],
}
const recordDetailIcons = new Map<RecordDetail, string>([
  ['급여 완료', ''],
  ['먹이 거부', ''],
  ['소량 급여', ''],
  ['측정 완료', ''],
  ['증가', ''],
  ['감소', ''],
  ['탈피 중', ''],
  ['탈피 완료', ''],
  ['탈피 문제', ''],
  ['예약', ''],
  ['방문 완료', ''],
  ['약 복용', ''],
])
const communityCategories = ['Q&A', '케어팁', '일상', '병원후기']

function App() {
  const [user, setUser] = useState<AppUser | null>(() => readStoredAppUser())
  const [activeTab, setActiveTab] = useState<Tab>(() => window.location.pathname === '/diary' ? 'diary' : 'pets')
  const [createMode, setCreateMode] = useState<CreateMode>(null)
  const [profileOpen, setProfileOpen] = useState(false)
  const [recordDate] = useState(todayKey())
  const [pets, setPets] = useState<Pet[]>([])
  const [, setRecords] = useState<CareRecord[]>([])
  const [posts, setPosts] = useState<Post[]>([])
  const [shareItems, setShareItems] = useState<ShareItem[]>([])

  if (!user) return <LoginScreen onLogin={(nextUser) => { storeAppUser(nextUser); setUser(nextUser) }} />

  const closeCreate = () => setCreateMode(null)
  const moveTab = (tab: Tab) => {
    setActiveTab(tab)
    window.history.pushState(null, '', tab === 'diary' ? '/diary' : '/')
  }

  if (createMode === 'pet') {
    return <PetCreateFlow onClose={closeCreate} onSave={(pet) => { setPets((items) => [pet, ...items]); closeCreate() }} />
  }

  if (createMode === 'record') {
    return <RecordCreateFlow pets={pets} initialDate={recordDate} onClose={closeCreate} onSave={(record) => { setRecords((items) => [record, ...items]); closeCreate() }} />
  }

  if (createMode === 'post') {
    return <PostCreateFlow onClose={closeCreate} onSave={(post) => { setPosts((items) => [post, ...items]); closeCreate() }} />
  }

  if (createMode === 'share') {
    return <ShareCreateFlow onClose={closeCreate} onSave={(item) => { setShareItems((items) => [item, ...items]); closeCreate() }} />
  }

  return (
    <div className={`app-shell ${activeTab === 'map' ? 'map-shell' : ''}`}>
      <header className="top-bar">
        <div>
          <span className="eyebrow">Special Animal Care PWA</span>
          <h1>{titleFor(activeTab)}</h1>
        </div>
        <button className="profile-chip" type="button" onClick={() => setProfileOpen(true)}>
          <span>프로필</span>
          <b>ME</b>
        </button>
      </header>

      <main className="app-main">
        {activeTab === 'pets' && <PetsScreen pets={pets} onMoveToRecords={() => moveTab('diary')} />}
        {activeTab === 'diary' && <DiaryPage />}
        {activeTab === 'map' && <MapScreen />}
        {activeTab === 'community' && <CommunityScreen posts={posts} />}
        {activeTab === 'share' && <ShareScreen items={shareItems} />}
      </main>

      {activeTab !== 'map' && activeTab !== 'diary' && (
        <button className="app-fab" type="button" aria-label={`${titleFor(activeTab)} 작성`} onClick={() => setCreateMode(createModeFor(activeTab))}>
          +
        </button>
      )}

      <BottomNav activeTab={activeTab} onMove={moveTab} />
      {profileOpen && <ProfilePanel onClose={() => setProfileOpen(false)} onLogout={() => { setProfileOpen(false); clearStoredAppUser(); setUser(null) }} />}
    </div>
  )
}

function LoginScreen({ onLogin }: { onLogin: (user: AppUser) => void }) {
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [usernameChecked, setUsernameChecked] = useState(false)
  const [usernameAvailable, setUsernameAvailable] = useState(false)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  const normalizedUsername = normalizeUsername(username)

  const checkUsername = async () => {
    setMessage('')
    setUsernameChecked(false)
    setUsernameAvailable(false)

    if (!isValidUsername(normalizedUsername)) {
      setMessage('아이디는 영문 소문자, 숫자, 밑줄만 사용해서 4~20자로 입력해주세요.')
      return
    }

    setLoading(true)
    const { data, error } = await supabase.rpc('is_app_username_available', { input_username: normalizedUsername })
    setLoading(false)

    if (error) {
      setMessage(error.message)
      return
    }

    setUsernameChecked(true)
    setUsernameAvailable(!data)
    setMessage(data ? '이미 사용 중인 아이디입니다.' : '사용 가능한 아이디입니다.')
  }

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setMessage('')

    if (!isValidUsername(normalizedUsername)) {
      setMessage('아이디는 영문 소문자, 숫자, 밑줄만 사용해서 4~20자로 입력해주세요.')
      return
    }

    if (mode === 'signup') {
      if (!usernameChecked || !usernameAvailable) {
        setMessage('아이디 중복 확인을 먼저 해주세요.')
        return
      }

      if (password !== passwordConfirm) {
        setMessage('비밀번호가 서로 다릅니다.')
        return
      }
    }

    setLoading(true)

    const result = mode === 'login'
      ? await loginWithUsername(normalizedUsername, password)
      : await supabase.rpc('register_app_user', {
        input_username: normalizedUsername,
        input_password: password,
        input_nickname: displayName.trim() || normalizedUsername,
      })

    if (result.error) {
      setLoading(false)
      setMessage(result.error.message)
      return
    }

    setLoading(false)
    onLogin(parseAppUser(result.data))
  }

  return (
    <main className="login-screen">
      <section className="login-panel">
        <span className="brand-mark">ExoCare</span>
        <h1>{mode === 'login' ? '로그인' : '회원가입'}</h1>
        <p>이메일 없이 아이디와 비밀번호로 사용합니다.</p>
        <form className="login-form" onSubmit={submit}>
          <label>
            아이디
            <span className="inline-field">
              <input value={username} onChange={(event) => { setUsername(event.target.value); setUsernameChecked(false); setUsernameAvailable(false) }} placeholder="영문/숫자 4~20자" required />
              {mode === 'signup' && <button type="button" disabled={loading} onClick={checkUsername}>중복 확인</button>}
            </span>
          </label>
          {mode === 'signup' && <label>닉네임<input value={displayName} onChange={(event) => setDisplayName(event.target.value)} placeholder="닉네임" required /></label>}
          <label>비밀번호<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="6자 이상" minLength={6} required /></label>
          {mode === 'signup' && <label>비밀번호 확인<input type="password" value={passwordConfirm} onChange={(event) => setPasswordConfirm(event.target.value)} placeholder="비밀번호 확인" minLength={6} required /></label>}
          <button type="submit" disabled={loading}>{loading ? '처리 중' : mode === 'login' ? '로그인' : '가입하기'}</button>
        </form>
        <button className="auth-switch" type="button" onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setMessage(''); setUsernameChecked(false); setUsernameAvailable(false) }}>
          {mode === 'login' ? '계정이 없으면 회원가입' : '이미 계정이 있으면 로그인'}
        </button>
        {message && <small>{message}</small>}
      </section>
    </main>
  )
}

function PetsScreen({ pets, onMoveToRecords }: { pets: Pet[]; onMoveToRecords: () => void }) {
  const [query, setQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<AnimalCategory>('all')
  const filteredPets = useMemo(() => {
    const searchText = normalizeText(query)

    return pets.filter((pet) => {
      const category = categoryForPet(pet)
      const matchesCategory = selectedCategory === 'all' || category === selectedCategory
      const matchesSearch = !searchText || normalizeText(`${pet.name} ${pet.group} ${pet.species} ${pet.gender}`).includes(searchText)
      return matchesCategory && matchesSearch
    })
  }, [pets, query, selectedCategory])

  return (
    <section className="page-stack">
      <section className="summary-band my-pet-hero">
        <div>
          <span>마이 펫</span>
          <strong>{pets.length}마리 등록됨</strong>
        </div>
        <p>동물 분류와 이름으로 빠르게 찾고, 등록된 펫에서 바로 기록으로 이동합니다.</p>
      </section>

      <section className="section-block my-pet-tools">
        <label className="my-pet-search">
          <span>동물 검색</span>
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="이름, 종, 분류 검색" />
        </label>
        <div className="filter-tags" aria-label="동물 분류 필터">
          {animalCategoryOptions.map((category) => (
            <button className={selectedCategory === category ? 'active' : ''} key={category} type="button" onClick={() => setSelectedCategory(category)}>
              <AnimalIcon category={category} />
              <span>{animalCategoryLabels[category]}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="section-block my-pet-section">
        <div className="section-title"><h2>등록된 펫</h2><span>{filteredPets.length}마리</span></div>
        {pets.length === 0 ? <EmptyState title="등록된 펫이 없습니다" body="+ 버튼으로 이름, 동물 분류, 종, 성별을 순서대로 입력하세요." /> : filteredPets.length === 0 ? (
          <EmptyState title="검색 결과가 없습니다" body="다른 이름이나 분류 태그로 다시 찾아보세요." />
        ) : (
          <div className="pet-list">
            {filteredPets.map((pet) => (
              <article className="pet-card" key={pet.id}>
                <div className="pet-card-icon"><AnimalIcon category={categoryForPet(pet)} /></div>
                <div className="pet-card-main">
                  <strong>{pet.name}</strong>
                  <small>{pet.group} · {pet.species} · {pet.gender}</small>
                </div>
                <button className="pet-record-link" type="button" onClick={onMoveToRecords}>기록으로 이동</button>
              </article>
            ))}
          </div>
        )}
      </section>
    </section>
  )
}

function MapScreen() {
  const naverMapClientId = import.meta.env.VITE_NAVER_MAP_CLIENT_ID
  const [query, setQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<AnimalCategory>('all')
  const [hospitals, setHospitals] = useState<Hospital[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [mapStatus, setMapStatus] = useState<'loading' | 'ready' | 'error'>(naverMapClientId ? 'loading' : 'error')
  const [locationStatus, setLocationStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle')
  const [currentLocation, setCurrentLocation] = useState<Coordinates | null>(null)
  const [selectedHospitalId, setSelectedHospitalId] = useState<string | null>(null)
  const [message, setMessage] = useState(naverMapClientId ? '주변 특수동물 병원을 찾는 중이에요...' : '.env.local의 VITE_NAVER_MAP_CLIENT_ID를 확인해주세요.')
  const [errorMessage, setErrorMessage] = useState('')
  const mapElementRef = useRef<HTMLDivElement | null>(null)
  const mapInstanceRef = useRef<InstanceType<NaverMapApi['maps']['Map']> | null>(null)
  const markersRef = useRef<Array<InstanceType<NaverMapApi['maps']['Marker']>>>([])
  const currentLocationMarkerRef = useRef<InstanceType<NaverMapApi['maps']['Marker']> | null>(null)
  const sortedHospitals = useMemo(() => sortHospitalsByDistance(hospitals, currentLocation), [hospitals, currentLocation])
  const filteredHospitals = useMemo(() => {
    const normalizedQuery = normalizeText(query)
    return sortedHospitals.filter((hospital) => {
      const matchesCategory = selectedCategory === 'all' || hospital.categories.includes(selectedCategory)
      const matchesQuery = !normalizedQuery || normalizeText(`${hospital.name} ${hospital.address} ${(hospital.matchedQueries ?? []).join(' ')}`).includes(normalizedQuery)
      return matchesCategory && matchesQuery
    })
  }, [query, selectedCategory, sortedHospitals])
  const selectedHospital = useMemo(
    () => filteredHospitals.find((hospital) => hospital.id === selectedHospitalId) ?? null,
    [filteredHospitals, selectedHospitalId],
  )

  useEffect(() => {
    if (!naverMapClientId) return

    let mounted = true
    loadNaverMaps(naverMapClientId)
      .then((naver) => {
        if (!mounted || !mapElementRef.current) return
        const center = new naver.maps.LatLng(37.5665, 126.978)
        mapInstanceRef.current = new naver.maps.Map(mapElementRef.current, { center, zoom: 12 })
        setMapStatus('ready')
      })
      .catch(() => {
        if (!mounted) return
        setMapStatus('error')
        setMessage('네이버 지도 SDK를 불러오지 못했습니다. 키와 네이버 콘솔의 서비스 URL 등록을 확인해주세요.')
      })

    return () => {
      mounted = false
      markersRef.current.forEach((marker) => marker.setMap(null))
      markersRef.current = []
      currentLocationMarkerRef.current?.setMap(null)
      currentLocationMarkerRef.current = null
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
      title: '현재 위치',
      icon: {
        content: '<div class="current-location-marker" aria-label="현재 위치"><span></span></div>',
      },
    })
    map.setCenter(position)
    map.setZoom(14)
  }, [currentLocation, mapStatus])

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
        icon: { content: hospitalMarkerContent(hospital, hospital.id === selectedHospitalId) },
      })
      naver.maps.Event.addListener(marker, 'click', () => {
        setSelectedHospitalId(hospital.id)
        map.setCenter(position)
        map.setZoom(16)
      })
      markersRef.current.push(marker)
    })

    const focusedHospital = filteredHospitals.find((hospital) => hospital.id === selectedHospitalId) ?? filteredHospitals[0]
    if (!currentLocation && focusedHospital) {
      map.setCenter(new naver.maps.LatLng(focusedHospital.lat, focusedHospital.lng))
      map.setZoom(filteredHospitals.length > 1 ? 12 : 16)
    }
  }, [filteredHospitals, mapStatus, selectedHospitalId, currentLocation])

  const getCurrentLocation = (silent = false) => new Promise<Coordinates>((resolve, reject) => {
    if (!('geolocation' in navigator)) {
      setLocationStatus('error')
      if (!silent) setErrorMessage('현재 위치를 가져올 수 없어요. 위치 권한을 확인해 주세요.')
      reject(new Error('Geolocation is unavailable.'))
      return
    }

    setLocationStatus('loading')
    if (!silent) setMessage('현재 위치를 확인하는 중이에요.')
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const location = { lat: position.coords.latitude, lng: position.coords.longitude }
        setCurrentLocation(location)
        setLocationStatus('ready')
        setErrorMessage('')
        if (!silent) setMessage('현재 위치를 기준으로 지도를 이동했어요.')
        resolve(location)
      },
      (error) => {
        console.error('Geolocation error:', error)
        setLocationStatus('error')
        if (!silent) setErrorMessage('현재 위치를 가져올 수 없어요. 위치 권한을 확인해 주세요.')
        reject(error)
      },
      {
        enableHighAccuracy: true,
        timeout: 10_000,
        maximumAge: 300_000,
      },
    )
  })

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSelectedHospitalId(null)
    if (hospitals.length === 0) {
      const location = currentLocation ?? await getCurrentLocation(true).catch(() => null)
      await handleSearch(location, false)
    }
  }

  const requestCurrentLocation = async () => {
    await getCurrentLocation(false).catch(() => null)
  }

  const handleSearch = async (location: Coordinates | null = currentLocation, silent = false) => {
    if (isLoading) return
    setIsLoading(true)
    setErrorMessage('')
    if (!silent) setMessage('주변 특수동물 병원을 찾는 중이에요...')

    try {
      const results = await searchHospitals(query, location)
      setHospitals(results)
      setSelectedHospitalId(null)
      setMessage(results.length > 0 ? `내 위치 기준 가까운 병원 ${results.length}곳을 찾았어요.` : '아직 병원을 찾지 못했어요.')
    } catch (error) {
      console.error('Hospital search error:', error)
      const message = error instanceof Error ? error.message : '검색 중 오류가 발생했습니다.'
      setErrorMessage(message)
      setMessage('')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <section className="map-page">
      <form className="map-search-panel" onSubmit={submit}>
        <label>병원 검색<input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="지역명, 병원명, 특수동물 병원" /></label>
        <label>
          동물 분류
          <select value={selectedCategory} onChange={(event) => setSelectedCategory(event.target.value as AnimalCategory)}>
            {animalCategoryOptions.map((item) => (
              <option key={item} value={item}>
                {animalCategoryLabels[item]}
              </option>
            ))}
          </select>
        </label>
        <button className="secondary-button" type="button" disabled={locationStatus === 'loading'} onClick={requestCurrentLocation}>
          {locationStatus === 'loading' ? '확인중' : '내 위치'}
        </button>
        <button type="submit" disabled={isLoading}>{isLoading ? '검색 중...' : '검색'}</button>
      </form>

      <section className="map-area">
        <div className="map-canvas" ref={mapElementRef}>
          {mapStatus !== 'ready' && (
            <span>{mapStatus === 'error' ? '지도를 불러오지 못했습니다' : '네이버 지도를 불러오는 중입니다'}</span>
          )}
        </div>
        {(message || errorMessage) && <p className={`status-copy ${errorMessage ? 'error' : ''}`}>{errorMessage || message}</p>}
        {selectedHospital && (
          <article className="map-hospital-panel">
            <button className="panel-close" type="button" aria-label="병원 정보 닫기" onClick={() => setSelectedHospitalId(null)} />
            <div className="hospital-card-main">
              <AnimalIcon category={selectedHospital.categories[0] ?? 'all'} />
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
              <a href={`https://search.naver.com/search.naver?query=${encodeURIComponent(`${selectedHospital.name} 리뷰`)}`} target="_blank" rel="noreferrer">리뷰 보기</a>
              {selectedHospital.phone && <a href={`tel:${selectedHospital.phone}`}>전화하기</a>}
            </div>
          </article>
        )}
      </section>
    </section>
  )
}

function CommunityScreen({ posts }: { posts: Post[] }) {
  return (
    <section className="page-stack">
      <section className="summary-band">
        <div><span>커뮤니티</span><strong>{posts.length}개 글</strong></div>
        <p>+ 버튼으로 카테고리, 제목, 본문을 순서대로 작성합니다.</p>
      </section>
      <section className="section-block">
        <div className="section-title"><h2>글 목록</h2><span>{posts.length}개</span></div>
        {posts.length === 0 ? <EmptyState title="아직 글이 없습니다" body="+ 버튼을 눌러 단계별 작성 화면을 시작하세요." /> : (
          <div className="result-list">{posts.map((post) => <article className="post-card" key={post.id}><span>{post.category}</span><strong>{post.title}</strong><p>{post.body}</p></article>)}</div>
        )}
      </section>
    </section>
  )
}

function ShareScreen({ items }: { items: ShareItem[] }) {
  return (
    <section className="page-stack">
      <section className="summary-band">
        <div><span>무료 나눔</span><strong>{items.length}개 등록</strong></div>
        <p>+ 버튼으로 물품명, 지역, 메모를 차례대로 입력합니다.</p>
      </section>
      <section className="section-block">
        <div className="section-title"><h2>나눔 목록</h2><span>{items.length}개</span></div>
        {items.length === 0 ? <EmptyState title="등록된 나눔이 없습니다" body="작성 폼은 목록에 고정하지 않고 단계 화면에서만 보여줍니다." /> : (
          <div className="result-list">{items.map((item) => <article className="post-card" key={item.id}><span>{item.area}</span><strong>{item.title}</strong><p>{item.memo}</p></article>)}</div>
        )}
      </section>
    </section>
  )
}

function PetCreateFlow({ onClose, onSave }: { onClose: () => void; onSave: (pet: Pet) => void }) {
  const [step, setStep] = useState(0)
  const [name, setName] = useState('')
  const [group, setGroup] = useState(animalGroups[0])
  const [species, setSpecies] = useState('')
  const [gender, setGender] = useState<Gender>('미구분')
  const canNext = step === 0 ? name.trim().length > 0 : step === 2 ? species.trim().length > 0 : true

  const finish = () => onSave({ id: crypto.randomUUID(), name: name.trim(), group, species: species.trim(), gender })

  return (
    <StepShell title="펫 등록" step={step + 1} total={4} onBack={step === 0 ? onClose : () => setStep((value) => value - 1)}>
      {step === 0 && <StepText title="이름을 입력하세요" value={name} onChange={setName} placeholder="예: 레오" />}
      {step === 1 && <StepChoice title="동물 분류를 입력하세요" value={group} options={animalGroups} icons={animalGroupIcons} onChange={setGroup} />}
      {step === 2 && <StepText title="종을 입력하세요" value={species} onChange={setSpecies} placeholder="예: 레오파드게코" />}
      {step === 3 && <StepChoice title="성별을 선택하세요" value={gender} options={['미구분', '수컷', '암컷']} onChange={(value) => setGender(value as Gender)} />}
      <StepActions primaryLabel={step === 3 ? '저장' : '다음'} disabled={!canNext} onPrimary={step === 3 ? finish : () => setStep((value) => value + 1)} />
    </StepShell>
  )
}

function RecordCreateFlow({ pets, initialDate, onClose, onSave }: { pets: Pet[]; initialDate: string; onClose: () => void; onSave: (record: CareRecord) => void }) {
  const [step, setStep] = useState(0)
  const [petId, setPetId] = useState(pets[0]?.id ?? '')
  const [date, setDate] = useState(initialDate)
  const [type, setType] = useState<RecordType>('먹이')
  const [detail, setDetail] = useState<RecordDetail>(recordDetailOptions['먹이']?.[0] ?? '급여 완료')
  const [memo, setMemo] = useState('')
  const detailOptions = recordDetailOptions[type] ?? []
  const hasDetailStep = detailOptions.length > 0
  const memoStep = hasDetailStep ? 4 : 3
  const totalSteps = hasDetailStep ? 5 : 4
  const canNext = step === 0 ? petId.length > 0 : step === memoStep ? memo.trim().length > 0 : true

  const selectType = (value: string) => {
    const nextType = value as RecordType
    setType(nextType)
    setDetail(recordDetailOptions[nextType]?.[0] ?? '급여 완료')
  }

  const finish = () => onSave({ id: crypto.randomUUID(), petId, date, type, detail: hasDetailStep ? detail : undefined, memo: memo.trim() })

  return (
    <StepShell title="기록 작성" step={step + 1} total={totalSteps} onBack={step === 0 ? onClose : () => setStep((value) => value - 1)}>
      {pets.length === 0 ? (
        <EmptyState title="등록된 펫이 없습니다" body="기록 작성 전에 마이 펫 탭에서 펫을 먼저 등록해주세요." />
      ) : (
        <>
          {step === 0 && <StepChoice title="어떤 펫의 기록인가요?" value={petId} options={pets.map((pet) => pet.id)} labels={new Map(pets.map((pet) => [pet.id, pet.name]))} onChange={setPetId} />}
          {step === 1 && <StepDate title="날짜를 선택하세요" value={date} onChange={setDate} />}
          {step === 2 && <StepChoice title="기록 종류를 선택하세요" value={type} options={recordTypes} icons={recordIcons} onChange={selectType} />}
          {step === 3 && hasDetailStep && <StepChoice title={`${recordIcons.get(type) ?? ''} ${type} 상태를 선택하세요`} value={detail} options={detailOptions} icons={recordDetailIcons} onChange={(value) => setDetail(value as RecordDetail)} />}
          {step === memoStep && <StepTextarea title="메모를 입력하세요" value={memo} onChange={setMemo} placeholder="급여량, 컨디션, 병원 내용 등을 입력" />}
          <StepActions primaryLabel={step === memoStep ? '저장' : '다음'} disabled={!canNext} onPrimary={step === memoStep ? finish : () => setStep((value) => value + 1)} />
        </>
      )}
    </StepShell>
  )
}

function PostCreateFlow({ onClose, onSave }: { onClose: () => void; onSave: (post: Post) => void }) {
  const [step, setStep] = useState(0)
  const [category, setCategory] = useState(communityCategories[0])
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const canNext = step === 1 ? title.trim().length > 0 : step === 2 ? body.trim().length > 0 : true
  const finish = () => onSave({ id: crypto.randomUUID(), category, title: title.trim(), body: body.trim() })

  return (
    <StepShell title="글 작성" step={step + 1} total={3} onBack={step === 0 ? onClose : () => setStep((value) => value - 1)}>
      {step === 0 && <StepChoice title="카테고리를 선택하세요" value={category} options={communityCategories} onChange={setCategory} />}
      {step === 1 && <StepText title="제목을 입력하세요" value={title} onChange={setTitle} placeholder="질문 또는 공유할 내용" />}
      {step === 2 && <StepTextarea title="본문을 입력하세요" value={body} onChange={setBody} placeholder="상황, 사육환경, 증상 등을 입력" />}
      <StepActions primaryLabel={step === 2 ? '등록' : '다음'} disabled={!canNext} onPrimary={step === 2 ? finish : () => setStep((value) => value + 1)} />
    </StepShell>
  )
}

function ShareCreateFlow({ onClose, onSave }: { onClose: () => void; onSave: (item: ShareItem) => void }) {
  const [step, setStep] = useState(0)
  const [title, setTitle] = useState('')
  const [area, setArea] = useState('')
  const [memo, setMemo] = useState('')
  const canNext = step === 0 ? title.trim().length > 0 : step === 1 ? area.trim().length > 0 : memo.trim().length > 0
  const finish = () => onSave({ id: crypto.randomUUID(), title: title.trim(), area: area.trim(), memo: memo.trim() })

  return (
    <StepShell title="나눔 등록" step={step + 1} total={3} onBack={step === 0 ? onClose : () => setStep((value) => value - 1)}>
      {step === 0 && <StepText title="물품명을 입력하세요" value={title} onChange={setTitle} placeholder="사육장, 먹이, 용품 등" />}
      {step === 1 && <StepText title="지역을 입력하세요" value={area} onChange={setArea} placeholder="예: 서울 강남" />}
      {step === 2 && <StepTextarea title="메모를 입력하세요" value={memo} onChange={setMemo} placeholder="상태, 수령 방식 등을 입력" />}
      <StepActions primaryLabel={step === 2 ? '등록' : '다음'} disabled={!canNext} onPrimary={step === 2 ? finish : () => setStep((value) => value + 1)} />
    </StepShell>
  )
}

function StepShell({
  title,
  step,
  total,
  children,
  onBack,
}: {
  title: string
  step: number
  total: number
  children: ReactNode
  onBack: () => void
}) {
  return (
    <main className="step-screen">
      <header className="step-header">
        <button className="step-icon-button" type="button" aria-label="뒤로가기" onClick={onBack}>←</button>
        <strong>{title}</strong>
      </header>
      <div className="step-progress" aria-label={`${step}/${total}`}><span style={{ width: `${(step / total) * 100}%` }} /></div>
      <section className="step-card">{children}</section>
    </main>
  )
}

function StepText({ title, value, onChange, placeholder }: { title: string; value: string; onChange: (value: string) => void; placeholder: string }) {
  return <label className="step-field"><span>{title}</span><input autoFocus value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} /></label>
}

function StepDate({ title, value, onChange }: { title: string; value: string; onChange: (value: string) => void }) {
  return <label className="step-field"><span>{title}</span><input type="date" value={value} onChange={(event) => onChange(event.target.value)} /></label>
}

function StepTextarea({ title, value, onChange, placeholder }: { title: string; value: string; onChange: (value: string) => void; placeholder: string }) {
  return <label className="step-field"><span>{title}</span><textarea autoFocus value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} /></label>
}

function StepChoice({
  title,
  value,
  options,
  labels,
  icons,
  onChange,
}: {
  title: string
  value: string
  options: string[]
  labels?: Map<string, string>
  icons?: Map<string, string>
  onChange: (value: string) => void
}) {
  return (
    <div className="step-field">
      <span>{title}</span>
      <div className="choice-grid">
        {options.map((option) => (
          <button className={value === option ? 'active' : ''} key={option} type="button" onClick={() => onChange(option)}>
            {icons?.get(option) && <span className="choice-icon" aria-hidden="true">{icons.get(option)}</span>}
            <span>{labels?.get(option) ?? option}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

function StepActions({ primaryLabel, disabled, onPrimary }: { primaryLabel: string; disabled: boolean; onPrimary: () => void }) {
  return <button className="step-primary" type="button" disabled={disabled} onClick={onPrimary}>{primaryLabel}</button>
}

function BottomNav({ activeTab, onMove }: { activeTab: Tab; onMove: (tab: Tab) => void }) {
  return (
    <nav className="bottom-nav">
      {tabs.map((tab) => (
        <button className={activeTab === tab.id ? 'active' : ''} key={tab.id} type="button" onClick={() => onMove(tab.id)}>
          {tab.label}
        </button>
      ))}
    </nav>
  )
}

function ProfilePanel({ onClose, onLogout }: { onClose: () => void; onLogout: () => void }) {
  return (
    <div className="overlay">
      <button className="overlay-dim" type="button" onClick={onClose} aria-label="닫기" />
      <section className="profile-panel">
        <h2>프로필</h2>
        <button type="button">내 정보 수정</button>
        <button type="button">내가 쓴 글</button>
        <button type="button">저장한 병원</button>
        <button type="button" onClick={onLogout}>로그아웃</button>
      </section>
    </div>
  )
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="empty-state">
      <strong>{title}</strong>
      <p>{body}</p>
    </div>
  )
}

function AnimalIcon({ category }: { category: AnimalCategory }) {
  return (
    <span className={`animal-icon animal-icon-${category}`} aria-hidden="true">
      <span />
    </span>
  )
}

function toDateKey(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

async function searchHospitals(query: string, location: Coordinates | null): Promise<Hospital[]> {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
  const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
  const searchQuery = query.trim() || '특수동물병원'

  if (!supabaseUrl || !publishableKey || !supabaseUrl.startsWith('http')) {
    throw new Error('.env.local의 Supabase URL과 publishable key를 확인해주세요.')
  }

  const cacheKey = hospitalCacheKey(searchQuery, location)
  const cached = readHospitalCache(cacheKey)
  if (cached) return sortHospitalsByDistance(cached, location)

  const response = await fetch(`${supabaseUrl.replace(/\/$/, '')}/functions/v1/search-hospitals`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: publishableKey,
      Authorization: `Bearer ${publishableKey}`,
    },
    body: JSON.stringify({
      query: searchQuery,
      display: 100,
      start: 1,
      sort: 'random',
    }),
  })
  const data = await response.json().catch(() => ({}))

  if (!response.ok) {
    if (response.status === 429 || data.error === 'rate_limited' || data.errorCode === '012') {
      throw new Error('검색 요청이 너무 많아요. 잠시 후 다시 시도해 주세요.')
    }
    throw new Error(data.message || data.error || 'Edge Function 호출에 실패했습니다.')
  }

  const hospitals = dedupeHospitals(((data.items ?? data.hospitals ?? []) as Array<Record<string, unknown>>)
    .map((item, index) => transformNaverLocalItem(item, index, searchQuery))
    .filter((hospital): hospital is Hospital => Boolean(hospital)))
  writeHospitalCache(cacheKey, hospitals)
  return sortHospitalsByDistance(hospitals, location)
}

function normalizeUsername(value: string) {
  return value.trim().toLowerCase()
}

function isValidUsername(value: string) {
  return /^[a-z0-9_]{4,20}$/.test(value)
}

async function loginWithUsername(username: string, password: string) {
  return await supabase.rpc('login_app_user', {
    input_username: username,
    input_password: password,
  })
}

function parseAppUser(value: unknown): AppUser {
  if (!value || typeof value !== 'object') {
    throw new Error('로그인 응답을 확인할 수 없습니다.')
  }

  const data = value as Partial<AppUser>
  return {
    id: String(data.id ?? ''),
    username: String(data.username ?? ''),
    nickname: String(data.nickname ?? data.username ?? ''),
  }
}

function readStoredAppUser() {
  const stored = localStorage.getItem(appUserStorageKey)
  if (!stored) return null

  try {
    return parseAppUser(JSON.parse(stored))
  } catch {
    localStorage.removeItem(appUserStorageKey)
    return null
  }
}

function storeAppUser(user: AppUser) {
  localStorage.setItem(appUserStorageKey, JSON.stringify(user))
}

function clearStoredAppUser() {
  localStorage.removeItem(appUserStorageKey)
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

function transformNaverLocalItem(item: Record<string, unknown>, index: number, searchQuery: string): Hospital | null {
  const name = cleanHtml(String(item.title ?? item.name ?? '이름 없는 병원'))
  const rawCategory = cleanHtml(String(item.category ?? item.rawCategory ?? ''))
  const description = cleanHtml(String(item.description ?? ''))
  const roadAddress = String(item.roadAddress ?? '')
  const address = roadAddress || String(item.address ?? '')
  const mapx = Number(item.mapx)
  const mapy = Number(item.mapy)
  const coords = convertNaverLocalCoords(mapx, mapy)
  if (!coords) return null

  return {
    id: String(item.id ?? `${name}-${mapx}-${mapy}-${index}`),
    name,
    address,
    roadAddress,
    phone: String(item.telephone ?? item.phone ?? ''),
    link: String(item.link ?? ''),
    lat: coords.lat,
    lng: coords.lng,
    categories: guessAnimalCategories(`${searchQuery} ${name} ${rawCategory} ${description} ${address}`),
    rawCategory,
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

function guessAnimalCategories(text: string): Exclude<AnimalCategory, 'all'>[] {
  const result: Exclude<AnimalCategory, 'all'>[] = []
  Object.entries(animalCategoryKeywords).forEach(([category, keywords]) => {
    if (keywords.some((keyword) => text.includes(keyword))) {
      result.push(category as Exclude<AnimalCategory, 'all'>)
    }
  })
  return result.length > 0 ? result : ['reptile', 'rodent', 'bird']
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
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
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
      categories: Array.from(new Set([...existing.categories, ...hospital.categories])) as Exclude<AnimalCategory, 'all'>[],
      phone: existing.phone || hospital.phone,
      link: existing.link || hospital.link,
    })
  })
  return Array.from(unique.values())
}

function hospitalCacheKey(query: string, location: Coordinates | null) {
  const lat = location ? Math.round(location.lat * 100) : 0
  const lng = location ? Math.round(location.lng * 100) : 0
  return `hospital-search:${query}:${lat}:${lng}`
}

function readHospitalCache(key: string) {
  try {
    const cached = sessionStorage.getItem(key)
    if (!cached) return null
    const parsed = JSON.parse(cached) as { savedAt: number; hospitals: Hospital[] }
    if (Date.now() - parsed.savedAt > 1000 * 60 * 10) return null
    return parsed.hospitals
  } catch {
    return null
  }
}

function writeHospitalCache(key: string, hospitals: Hospital[]) {
  try {
    sessionStorage.setItem(key, JSON.stringify({ savedAt: Date.now(), hospitals }))
  } catch {
    // Ignore storage quota and private-mode failures.
  }
}

function cleanHtml(value: string) {
  return value.replace(/<[^>]*>/g, '').replaceAll('&amp;', '&').trim()
}

function normalizeText(value: string) {
  return cleanHtml(value).replace(/\s+/g, '').toLowerCase()
}

function categoryForPet(pet: Pet): AnimalCategory {
  const target = normalizeText(`${pet.group} ${pet.species}`)
  const matched = animalCategoryOptions.find((category) => {
    if (category === 'all') return false
    return animalCategoryKeywords[category].some((keyword) => target.includes(normalizeText(keyword)))
  })

  return matched ?? 'all'
}

function hospitalMarkerContent(hospital: Hospital, active: boolean) {
  const category = hospital.categories[0] ?? 'all'
  return `<button class="hospital-map-marker${active ? ' active' : ''}" type="button" aria-label="${hospital.name}"><span class="animal-icon animal-icon-${category}"><span></span></span></button>`
}

function createModeFor(tab: Tab): Exclude<CreateMode, null> {
  if (tab === 'pets') return 'pet'
  if (tab === 'diary') return 'record'
  if (tab === 'community') return 'post'
  return 'share'
}

function titleFor(tab: Tab) {
  const titles: Record<Tab, string> = {
    pets: '마이 펫',
    diary: '케어 기록',
    map: '병원 지도',
    community: '커뮤니티',
    share: '무료 나눔',
  }
  return titles[tab]
}

function todayKey() {
  return toDateKey(new Date())
}

export default App
