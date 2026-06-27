import type { Pet, PetRecord } from './diaryTypes'

const today = toDateKey(new Date())
const yesterday = shiftDate(today, -1)
const threeDaysAgo = shiftDate(today, -3)
const fiveDaysAgo = shiftDate(today, -5)

export const mockPets: Pet[] = [
  { id: 'pet-mochi', userId: 'user-1', name: '모찌', category: 'reptile', species: '카멜레온', gender: 'female', emoji: '🦎', weight: 42.1 },
  { id: 'pet-leo', userId: 'user-1', name: '레오', category: 'reptile', species: '크레스티드 게코', gender: 'male', emoji: '🦎', weight: 31.4 },
  { id: 'pet-happy', userId: 'user-1', name: '해피', category: 'rodent', species: '햄스터', gender: 'unknown', emoji: '🐹', weight: 118 },
  { id: 'pet-coco', userId: 'user-1', name: '코코', category: 'bird', species: '앵무새', gender: 'female', emoji: '🐦', weight: 87 },
  { id: 'pet-bidi', userId: 'user-1', name: '비디', category: 'reptile', species: '비어디드래곤', gender: 'male', emoji: '🐉', weight: 382 },
  { id: 'pet-lumi', userId: 'user-1', name: '루미', category: 'amphibian', species: '팩맨프로그', gender: 'unknown', emoji: '🐸', weight: 54 },
]

export const mockRecords: PetRecord[] = [
  {
    id: 'record-1',
    userId: 'user-1',
    petId: 'pet-mochi',
    type: 'food',
    date: today,
    memo: '귀뚜라미 3마리',
    foods: ['귀뚜라미'],
    createdAt: `${today}T09:20:00`,
  },
  {
    id: 'record-2',
    userId: 'user-1',
    petId: 'pet-mochi',
    type: 'weight',
    date: today,
    memo: '42.1g',
    weight: 42.1,
    createdAt: `${today}T10:05:00`,
  },
  {
    id: 'record-3',
    userId: 'user-1',
    petId: 'pet-mochi',
    type: 'poop',
    date: yesterday,
    memo: '정상',
    createdAt: `${yesterday}T18:40:00`,
  },
  {
    id: 'record-4',
    userId: 'user-1',
    petId: 'pet-mochi',
    type: 'shed',
    date: threeDaysAgo,
    memo: '탈피 확인',
    createdAt: `${threeDaysAgo}T21:10:00`,
  },
  {
    id: 'record-5',
    userId: 'user-1',
    petId: 'pet-mochi',
    type: 'hospital',
    date: fiveDaysAgo,
    memo: '병원 방문 기록',
    hospitalId: 'hospital-sample',
    createdAt: `${fiveDaysAgo}T14:00:00`,
  },
  {
    id: 'record-6',
    userId: 'user-1',
    petId: 'pet-leo',
    type: 'cleaning',
    date: today,
    memo: '사육장 청소',
    createdAt: `${today}T12:30:00`,
  },
]

export function toDateKey(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function shiftDate(dateKey: string, amount: number) {
  const date = new Date(`${dateKey}T00:00:00`)
  date.setDate(date.getDate() + amount)
  return toDateKey(date)
}
