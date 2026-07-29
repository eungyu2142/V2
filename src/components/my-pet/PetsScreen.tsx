import { useMemo, useState } from 'react'

type AnimalCategory = 'all' | 'reptile' | 'bird' | 'rodent' | 'amphibian' | 'other'

type Pet = {
  id: string
  name: string
  group: AnimalCategory
  species: string
  gender: 'male' | 'female' | 'unknown'
  photo?: string
  photoPosition?: { x: number; y: number }
  registeredAt?: string
}

const animalCategoryLabels: Record<AnimalCategory, string> = {
  all: '전체',
  reptile: '파충류',
  bird: '조류',
  rodent: '설치류',
  amphibian: '양서류',
  other: '기타',
}

const visibleCategoryOptions: AnimalCategory[] = ['all', 'reptile', 'amphibian']

function isVisiblePetCategory(value: AnimalCategory): value is 'reptile' | 'amphibian' {
  return value === 'reptile' || value === 'amphibian'
}

function genderSymbol(value: Pet['gender']) {
  if (value === 'male') return '♂'
  if (value === 'female') return '♀'
  return ''
}

export default function PetsScreen({
  pets,
  onDeletePet,
  onEditPet,
  onOpenDiary,
  onRegisterPet,
}: {
  userId: string
  pets: Pet[]
  onDeletePet: (petId: string) => void
  onEditPet: (pet: Pet) => void
  onOpenDiary: (petId: string) => void
  onRegisterPet: () => void
}) {
  const [query, setQuery] = useState('')
  const [selectedCategories, setSelectedCategories] = useState<Array<'reptile' | 'amphibian'>>([])
  const [menuPetId, setMenuPetId] = useState<string | null>(null)

  const filteredPets = useMemo(() => {
    const keyword = query.trim().toLowerCase()
    return pets
      .filter((pet) => {
        const matchesCategory = selectedCategories.length === 0 || selectedCategories.includes(pet.group as 'reptile' | 'amphibian')
        const text = `${pet.name} ${pet.species} ${animalCategoryLabels[pet.group]}`.toLowerCase()
        return matchesCategory && text.includes(keyword)
      })
      .sort((a, b) => new Date(b.registeredAt ?? 0).getTime() - new Date(a.registeredAt ?? 0).getTime())
  }, [pets, query, selectedCategories])

  const toggleCategory = (item: AnimalCategory) => {
    if (item === 'all') {
      setSelectedCategories([])
      return
    }
    if (!isVisiblePetCategory(item)) return
    setSelectedCategories((current) => {
      if (current.includes(item)) return current.filter((category) => category !== item)
      if (current.length > 0) return []
      return [item]
    })
  }

  const requestDelete = (pet: Pet) => {
    if (window.confirm(`'${pet.name}'을 삭제하시겠습니까?`)) onDeletePet(pet.id)
  }

  return (
    <section className="page-stack my-pet-dashboard">
      <section className="section-block my-pet-tools my-pet-dashboard-panel">
        <label className="my-pet-search">
          <input aria-label="펫 검색" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="예시) 크레스티드 게코" />
        </label>
        <div className="my-pet-filter-row">
          <div className="filter-tags" aria-label="동물 분류 필터">
            {visibleCategoryOptions.map((item) => (
              <button
                className={(item === 'all' ? selectedCategories.length === 0 : isVisiblePetCategory(item) && selectedCategories.includes(item)) ? 'active' : ''}
                type="button"
                key={item}
                onClick={() => toggleCategory(item)}
                aria-pressed={item === 'all' ? selectedCategories.length === 0 : isVisiblePetCategory(item) && selectedCategories.includes(item)}
              >
                <span>{animalCategoryLabels[item]}</span>
              </button>
            ))}
          </div>
          <button className="pet-add-icon" type="button" onClick={onRegisterPet} aria-label="펫 등록">+</button>
        </div>
      </section>

      <section className="section-block my-pet-section my-pet-dashboard-panel">
        <div className="pet-list-toolbar">
          <div className="section-title"><h2>등록된 펫</h2><span>{filteredPets.length}</span></div>
        </div>
        {filteredPets.length === 0 ? (
          <div className="pet-empty-state">
            <strong>{pets.length === 0 ? '아직 등록된 펫이 없어요' : '검색 결과가 없어요'}</strong>
            <p>{pets.length === 0 ? '관리할 반려동물을 먼저 등록해 주세요.' : '검색어 또는 분류를 다시 확인해 주세요.'}</p>
            {pets.length === 0 && <button type="button" onClick={onRegisterPet}>첫 펫 등록하기</button>}
          </div>
        ) : (
          <div className="pet-list card-view">
            {filteredPets.map((pet) => {
              const symbol = genderSymbol(pet.gender)
              return (
                <article className="pet-card pet-management-card pet-pick-card" key={pet.id}>
                  <button className="pet-card-main pet-pick-card-main" type="button" aria-label={`${pet.name} 다이어리 열기`} onClick={() => onOpenDiary(pet.id)}>
                    <div className="pet-card-visual">
                      <div className="pet-card-icon">
                        {pet.photo ? <img src={pet.photo} alt={`${pet.name} 사진`} style={{ objectPosition: `${pet.photoPosition?.x ?? 50}% ${pet.photoPosition?.y ?? 50}%` }} /> : <span className="pet-photo-initial" aria-label="사진 없음">{pet.name.trim().slice(0, 1) || '?'}</span>}
                      </div>
                    </div>
                    <div className="pet-card-body">
                      <div className="pet-card-identity">
                        <strong>{pet.name}{symbol && <span className={`pet-gender-symbol ${pet.gender}`} aria-label={pet.gender === 'male' ? '수컷' : '암컷'}>{symbol}</span>}</strong>
                        {pet.species && <small>{pet.species}</small>}
                      </div>
                    </div>
                  </button>
                  <div className="pet-card-topline">
                    <button
                      className="pet-more-button"
                      type="button"
                      aria-label={`${pet.name} 메뉴 열기`}
                      onClick={(event) => {
                        event.stopPropagation()
                        setMenuPetId(menuPetId === pet.id ? null : pet.id)
                      }}
                    >
                      ⋯
                    </button>
                    {menuPetId === pet.id && (
                      <div className="pet-more-menu">
                        <button type="button" onClick={() => { setMenuPetId(null); onEditPet(pet) }}>수정</button>
                        <button className="danger" type="button" onClick={() => { setMenuPetId(null); requestDelete(pet) }}>삭제</button>
                      </div>
                    )}
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </section>
    </section>
  )
}
