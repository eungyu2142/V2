import { type ChangeEvent, type FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { deleteAppData, loadAppData, saveAppData } from '../../lib/appData'
import { completeDailyTask, deleteCarePlan, listCarePlans, listDailyTasks, markDailyTaskCompleted, saveCarePlan, skipDailyTask, undoDailyTask } from './diaryService'
import type { CarePlan, CareTaskType, DailyTask, EnvironmentRecord, FeedingFoodItem, PetRecord, PetRecordType, RiskLevel } from './diaryTypes'
import { cancelRoutineNotificationJobs, getFirstRoutineDate, markRoutineNotificationJobCompleted, markRoutineNotificationJobSkipped, upsertRoutineNotificationJob } from './routineNotificationJobs'
import { customFoodOptionKey, fallbackSpeciesCareProfiles, findSpeciesCareProfile, listSpeciesCareProfiles, type CareEnvironmentProfile, type CareFoodOption, type SpeciesCareProfile } from './speciesCareProfiles'
import { toDateKey } from './mockDiaryData'
import type { HospitalReview } from '../../types/app'
import './DiaryPage.css'

export type DiaryPet = {
  id: string
  name: string
  group: 'all' | 'reptile' | 'bird' | 'rodent' | 'amphibian' | 'other'
  species: string
  gender: 'male' | 'female' | 'unknown'
  photo?: string
  weight?: string
  weightUnit?: 'g' | 'kg'
  ageText?: string
}

type ReminderType = CareTaskType
type SmartAddKind = 'food' | 'water' | 'cleaning' | 'poop' | 'shed' | 'mating' | 'egg'
type IncidentKind = SmartAddKind | 'medicine' | 'hospital'
type RoutineInputType = 'check' | 'measurement' | 'feeding' | 'status' | 'short_text'
type FoodOption = CareFoodOption
type EnvironmentProfile = CareEnvironmentProfile
type EnvironmentRiskResult = {
  level: RiskLevel
  direction: 'low' | 'high' | 'normal'
  message: string
}
type DiaryInsightLevel = 'normal' | 'notice' | 'caution' | 'urgent'
type DiaryInsight = {
  id: string
  title: string
  body: string
  level: DiaryInsightLevel
  metric: 'shed' | 'environment' | 'weight' | 'poop'
  action?: 'shed-check'
}
type DisplayPetRecord = PetRecord & {
  sourceIds?: string[]
}
type MatingOption = {
  id: string
  label: string
  femaleName: string
  maleName: string
  species: string
}

const incidentIconSrc: Partial<Record<IncidentKind, string>> = {
  poop: '/assets/incident-icons/poop.png',
  shed: '/assets/incident-icons/shed.png',
  mating: '/assets/incident-icons/mating.png',
  egg: '/assets/incident-icons/egg.png',
  medicine: '/assets/incident-icons/medicine.png',
  hospital: '/assets/incident-icons/hospital.png',
}

export type Reminder = {
  id: string
  userId?: string
  petId: string
  title: string
  reminderType: ReminderType
  scheduleType: 'repeat' | 'once'
  weekdays: number[]
  startDate?: string
  endDate?: string
  reminderDate: string
  reminderTime: string
  memo: string
  isActive: boolean
  createdAt: string
  updatedAt?: string
  completedAt?: string
}

export type RecordDraft = {
  type: PetRecordType
  foods: string[]
  customFood: string
  weight: string
  status: string
  hospital: string
  memo: string
  photo?: string
  step?: number
}

type DiaryRecordDraftPayload = {
  petId: string
  date: string
  draft: RecordDraft
}

type DiaryReminderDraftPayload = {
  reminder: Reminder
}

type DiaryRecordDraftItem = {
  id: string
  draftType: 'care_record'
  title: string
  body: string
  updatedAt: string
  step?: number
  payload: DiaryRecordDraftPayload
}

type DiaryReminderDraftItem = {
  id: string
  draftType: 'reminder'
  title: string
  body: string
  updatedAt: string
  step?: number
  payload: DiaryReminderDraftPayload
}

type DiaryDraftItem = DiaryRecordDraftItem | DiaryReminderDraftItem

const recordMeta: Record<PetRecordType, { label: string; icon: string }> = {
  food: { label: '먹이', icon: '' },
  weight: { label: '무게', icon: '' },
  shed: { label: '탈피', icon: '' },
  poop: { label: '배변', icon: '' },
  cleaning: { label: '청소', icon: '' },
  hospital: { label: '병원', icon: '' },
  other: { label: '기록', icon: '' },
}

const lastDiaryPetKey = (userId: string) => `exocare:last-diary-pet:${userId}`

function getInitialDiaryPetId(userId: string, pets: DiaryPet[], initialPetId?: string) {
  if (initialPetId && pets.some((pet) => pet.id === initialPetId)) return initialPetId
  const savedPetId = window.localStorage.getItem(lastDiaryPetKey(userId))
  if (savedPetId && pets.some((pet) => pet.id === savedPetId)) return savedPetId
  return pets[0]?.id ?? ''
}

const reminderMeta: Record<ReminderType, { label: string; icon: string; recordType: PetRecordType; inputType: RoutineInputType; unit?: string }> = {
  feed: { label: '먹이', icon: '', recordType: 'food', inputType: 'feeding' },
  medicine: { label: '약', icon: '', recordType: 'other', inputType: 'check' },
  water: { label: '물그릇 교체', icon: '', recordType: 'other', inputType: 'check' },
  mist: { label: '분무', icon: '', recordType: 'other', inputType: 'check' },
  temperature: { label: '온도 확인', icon: '', recordType: 'other', inputType: 'measurement', unit: '℃' },
  water_temperature: { label: '수온 확인', icon: '', recordType: 'other', inputType: 'measurement', unit: '℃' },
  humidity: { label: '습도 확인', icon: '', recordType: 'other', inputType: 'measurement', unit: '%' },
  cleaning: { label: '청소', icon: '', recordType: 'cleaning', inputType: 'check' },
  partial_cleaning: { label: '부분 청소', icon: '', recordType: 'cleaning', inputType: 'check' },
  full_cleaning: { label: '전체 청소', icon: '', recordType: 'cleaning', inputType: 'check' },
  substrate_change: { label: '바닥재 교체', icon: '', recordType: 'cleaning', inputType: 'check' },
  structure_cleaning: { label: '구조물 세척', icon: '', recordType: 'cleaning', inputType: 'check' },
  wall_wipe: { label: '벽 닦기', icon: '', recordType: 'cleaning', inputType: 'check' },
  uvb_check: { label: 'UVB 확인', icon: '', recordType: 'other', inputType: 'status' },
  weight: { label: '무게 측정', icon: '', recordType: 'weight', inputType: 'measurement', unit: 'g/kg' },
  water_quality: { label: '수질 확인', icon: '', recordType: 'other', inputType: 'check' },
  filter_check: { label: '여과기 상태 확인', icon: '', recordType: 'other', inputType: 'check' },
  hospital: { label: '진료', icon: '', recordType: 'hospital', inputType: 'check' },
  custom: { label: '직접 입력', icon: '', recordType: 'other', inputType: 'check' },
}

const baseRoutineTypes: ReminderType[] = ['feed', 'mist', 'water', 'humidity', 'temperature', 'full_cleaning', 'partial_cleaning']
const herpRoutineTypes: ReminderType[] = [
  'feed',
  'mist',
  'water',
  'humidity',
  'temperature',
  'full_cleaning',
  'partial_cleaning',
]

const aquaticRoutineTypes: ReminderType[] = ['feed', 'water', 'water_temperature', 'water_quality', 'filter_check', 'weight', 'full_cleaning', 'partial_cleaning', 'custom']

const ENVIRONMENT_PROFILES: Record<string, EnvironmentProfile> = {
  crested_gecko: { key: 'crested_gecko', label: '크레스티드 게코', temperatureType: 'air', targetTemperature: 24, minTemperature: 22, maxTemperature: 26, humidityEnabled: true, targetHumidity: 55, minHumidity: 40, maxHumidity: 70, isBroadCategory: false },
  leopard_gecko: { key: 'leopard_gecko', label: '레오파드 게코', temperatureType: 'air', targetTemperature: 27, minTemperature: 24, maxTemperature: 30, humidityEnabled: true, targetHumidity: 35, minHumidity: 30, maxHumidity: 40, isBroadCategory: false },
  fat_tailed_gecko: { key: 'fat_tailed_gecko', label: '팻테일 게코', temperatureType: 'air', targetTemperature: 26, minTemperature: 24, maxTemperature: 29, humidityEnabled: true, targetHumidity: 60, minHumidity: 50, maxHumidity: 70, isBroadCategory: false },
  viper_gecko: { key: 'viper_gecko', label: '바이퍼 게코', temperatureType: 'air', targetTemperature: 27, minTemperature: 24, maxTemperature: 30, humidityEnabled: true, targetHumidity: 40, minHumidity: 30, maxHumidity: 50, isBroadCategory: false },
  chahoua_gecko: { key: 'chahoua_gecko', label: '차화 게코', temperatureType: 'air', targetTemperature: 24, minTemperature: 22, maxTemperature: 26, humidityEnabled: true, targetHumidity: 60, minHumidity: 50, maxHumidity: 75, isBroadCategory: false },
  gargoyle_gecko: { key: 'gargoyle_gecko', label: '가고일 게코', temperatureType: 'air', targetTemperature: 24, minTemperature: 22, maxTemperature: 26, humidityEnabled: true, targetHumidity: 60, minHumidity: 50, maxHumidity: 75, isBroadCategory: false },
  day_gecko: { key: 'day_gecko', label: '데이 게코', temperatureType: 'air', targetTemperature: 27, minTemperature: 24, maxTemperature: 30, humidityEnabled: true, targetHumidity: 58, minHumidity: 40, maxHumidity: 75, isBroadCategory: false },
  tokay_gecko: { key: 'tokay_gecko', label: '토케이 게코', temperatureType: 'air', targetTemperature: 27, minTemperature: 25, maxTemperature: 29, humidityEnabled: true, targetHumidity: 65, minHumidity: 55, maxHumidity: 75, isBroadCategory: false },
  bearded_dragon: { key: 'bearded_dragon', label: '비어디드래곤', temperatureType: 'air', targetTemperature: 30, minTemperature: 22, maxTemperature: 42, humidityEnabled: true, targetHumidity: 35, minHumidity: 30, maxHumidity: 40, isBroadCategory: false },
  monitor: { key: 'monitor', label: '모니터·왕도마뱀', temperatureType: 'air', targetTemperature: 29, minTemperature: 26, maxTemperature: 32, humidityEnabled: true, targetHumidity: 60, minHumidity: 45, maxHumidity: 70, isBroadCategory: true },
  chameleon: { key: 'chameleon', label: '카멜레온', temperatureType: 'air', targetTemperature: 25, minTemperature: 22, maxTemperature: 28, humidityEnabled: true, targetHumidity: 65, minHumidity: 50, maxHumidity: 80, isBroadCategory: true },
  iguana: { key: 'iguana', label: '이구아나', temperatureType: 'air', targetTemperature: 28, minTemperature: 25, maxTemperature: 31, humidityEnabled: true, targetHumidity: 75, minHumidity: 65, maxHumidity: 85, isBroadCategory: true },
  skink: { key: 'skink', label: '스킨크', temperatureType: 'air', targetTemperature: 27, minTemperature: 24, maxTemperature: 30, humidityEnabled: true, targetHumidity: 50, minHumidity: 40, maxHumidity: 60, isBroadCategory: true },
  uromastyx: { key: 'uromastyx', label: '유로매스틱스', temperatureType: 'air', targetTemperature: 34, minTemperature: 30, maxTemperature: 38, humidityEnabled: true, targetHumidity: 25, minHumidity: 20, maxHumidity: 35, isBroadCategory: true },
  snake: { key: 'snake', label: '스네이크', temperatureType: 'air', targetTemperature: 26, minTemperature: 23, maxTemperature: 29, humidityEnabled: true, targetHumidity: 50, minHumidity: 40, maxHumidity: 60, isBroadCategory: true },
  python: { key: 'python', label: '파이톤', temperatureType: 'air', targetTemperature: 28, minTemperature: 25, maxTemperature: 31, humidityEnabled: true, targetHumidity: 60, minHumidity: 50, maxHumidity: 70, isBroadCategory: true },
  boa: { key: 'boa', label: '보아', temperatureType: 'air', targetTemperature: 28, minTemperature: 25, maxTemperature: 31, humidityEnabled: true, targetHumidity: 65, minHumidity: 55, maxHumidity: 75, isBroadCategory: true },
  pacman_frog: { key: 'pacman_frog', label: '팩맨', temperatureType: 'air', targetTemperature: 25, minTemperature: 23, maxTemperature: 28, humidityEnabled: true, targetHumidity: 70, minHumidity: 60, maxHumidity: 80, isBroadCategory: true },
  tree_frog: { key: 'tree_frog', label: '트리프록', temperatureType: 'air', targetTemperature: 24, minTemperature: 22, maxTemperature: 28, humidityEnabled: true, targetHumidity: 70, minHumidity: 60, maxHumidity: 80, isBroadCategory: true },
  dart_frog: { key: 'dart_frog', label: '다트프록', temperatureType: 'air', targetTemperature: 23, minTemperature: 22, maxTemperature: 26, humidityEnabled: true, targetHumidity: 85, minHumidity: 75, maxHumidity: 90, isBroadCategory: true },
  newt: { key: 'newt', label: '뉴트', temperatureType: 'water', targetTemperature: 19, minTemperature: 16, maxTemperature: 22, humidityEnabled: true, targetHumidity: 75, minHumidity: 65, maxHumidity: 85, isBroadCategory: true },
  salamander: { key: 'salamander', label: '살라만다', temperatureType: 'air', targetTemperature: 19, minTemperature: 16, maxTemperature: 22, humidityEnabled: true, targetHumidity: 80, minHumidity: 70, maxHumidity: 90, isBroadCategory: true },
  axolotl: { key: 'axolotl', label: '아홀로틀', temperatureType: 'water', targetTemperature: 18, minTemperature: 16, maxTemperature: 20, humidityEnabled: false, targetHumidity: null, minHumidity: null, maxHumidity: null, isBroadCategory: false },
  toad: { key: 'toad', label: '토드', temperatureType: 'air', targetTemperature: 22, minTemperature: 19, maxTemperature: 25, humidityEnabled: true, targetHumidity: 65, minHumidity: 55, maxHumidity: 75, isBroadCategory: true },
}

function routineRecommendationsForPet(pet?: DiaryPet, speciesProfiles: SpeciesCareProfile[] = fallbackSpeciesCareProfiles): ReminderType[] {
  const speciesProfile = pet ? findSpeciesCareProfile(pet.species, speciesProfiles) : null
  const profile = speciesProfile?.environmentProfile ?? (pet ? getEnvironmentProfile(pet, speciesProfiles) : null)
  if (speciesProfile?.routineTypes.length) return speciesProfile.routineTypes
  if (profile?.temperatureType === 'water') return profile.key === 'axolotl' ? aquaticRoutineTypes : aquaticRoutineTypes.filter((type) => type !== 'filter_check')
  if (pet?.group === 'reptile' || pet?.group === 'amphibian') {
    if (isFullyAquaticTurtlePet(pet)) {
      return ['feed', 'water_temperature', 'water_quality', 'filter_check', 'weight', 'full_cleaning', 'partial_cleaning', 'custom']
    }
    return [...herpRoutineTypes
      .filter((type) => type !== 'humidity' || profile?.humidityEnabled !== false)
      .filter((type) => !(isGeckoPet(pet) && type === 'water'))
      .filter((type) => !(isAquaticTurtlePet(pet) && (type === 'mist' || type === 'water'))),
    ...(isSemiAquaticTurtlePet(pet) ? ['water_temperature' as const] : []),
    'custom']
  }
  return [...baseRoutineTypes, 'custom']
}

function isGeckoPet(pet?: DiaryPet) {
  const species = normalizeFoodMatchText(pet?.species)
  return species.includes('게코') || species.includes('gecko')
}

function isAquaticTurtlePet(pet?: DiaryPet) {
  const species = normalizeFoodMatchText(pet?.species)
  return species.includes('수생거북') || species.includes('반수생거북') || species.includes('aquaticturtle') || species.includes('semiaquaticturtle') || species.includes('terrapin')
}

function isFullyAquaticTurtlePet(pet?: DiaryPet) {
  const species = normalizeFoodMatchText(pet?.species)
  return (species.includes('수생거북') || species.includes('aquaticturtle')) && !isSemiAquaticTurtlePet(pet)
}

function isSemiAquaticTurtlePet(pet?: DiaryPet) {
  const species = normalizeFoodMatchText(pet?.species)
  return species.includes('반수생거북') || species.includes('semiaquaticturtle') || species.includes('terrapin')
}

function shouldHideShedForPet(pet?: DiaryPet) {
  const species = pet?.species.trim().toLowerCase() ?? ''
  if (!species) return false
  return ['아홀로틀', 'axolotl', '거북', '거북이', '육지거북', '육지 거북', '수생거북', '수생 거북', '반수생 거북', 'turtle', 'tortoise', 'terrapin'].some((keyword) => species.includes(keyword))
}

const weekdays = ['일', '월', '화', '수', '목', '금', '토']

const fixedHerpFoods: FoodOption[] = [
  { key: 'cricket', label: '귀뚜라미' },
  { key: 'mealworm', label: '밀웜' },
  { key: 'silkworm', label: '누에' },
]

const commonGeckoFoods: FoodOption[] = [
  ...fixedHerpFoods,
  { key: 'superworm', label: '슈퍼밀웜' },
  { key: customFoodOptionKey, label: '기타 직접 입력' },
]

const geckoFoodFoods: FoodOption[] = [
  { key: 'gecko_diet', label: '게코 전용 푸드' },
  ...commonGeckoFoods,
]

const FOOD_OPTIONS_BY_LIZARD_TYPE: Record<string, FoodOption[]> = {
  gecko: commonGeckoFoods,
  bearded_dragon: [
    { key: 'fruit', label: '과일' },
    { key: 'vegetable', label: '채소' },
    ...fixedHerpFoods,
    { key: 'diet', label: '사료' },
    { key: customFoodOptionKey, label: '기타 직접 입력' },
  ],
  monitor: [
    { key: 'mouse', label: '쥐' },
    { key: 'chick', label: '병아리' },
    { key: 'quail', label: '메추리' },
    ...fixedHerpFoods,
    { key: 'superworm', label: '슈퍼밀웜' },
    { key: 'egg', label: '달걀' },
    { key: 'meat', label: '육류' },
    { key: customFoodOptionKey, label: '기타 직접 입력' },
  ],
  chameleon: [
    ...fixedHerpFoods,
    { key: 'superworm', label: '슈퍼밀웜' },
    { key: 'fly', label: '파리류' },
    { key: customFoodOptionKey, label: '기타 직접 입력' },
  ],
  iguana: [
    { key: 'leafy_greens', label: '잎채소' },
    { key: 'vegetables', label: '기타 채소' },
    { key: 'fruit', label: '과일' },
    { key: 'flower', label: '꽃' },
    { key: 'iguana_diet', label: '이구아나 전용 사료' },
    { key: customFoodOptionKey, label: '기타 직접 입력' },
  ],
  skink: [
    ...fixedHerpFoods,
    { key: 'superworm', label: '슈퍼밀웜' },
    { key: 'egg', label: '달걀' },
    { key: 'meat', label: '육류' },
    { key: 'vegetable', label: '채소' },
    { key: 'fruit', label: '과일' },
    { key: 'skink_diet', label: '스킨크 전용 사료' },
    { key: customFoodOptionKey, label: '기타 직접 입력' },
  ],
  uromastyx: [
    { key: 'leafy_greens', label: '잎채소' },
    { key: 'vegetables', label: '기타 채소' },
    { key: 'flower', label: '꽃' },
    { key: 'seed', label: '씨앗류' },
    { key: 'bean', label: '콩류' },
    { key: 'uromastyx_diet', label: '유로매스틱스 전용 사료' },
    { key: customFoodOptionKey, label: '기타 직접 입력' },
  ],
  other: [
    ...fixedHerpFoods,
    { key: 'insect', label: '곤충' },
    { key: 'vegetable', label: '채소' },
    { key: 'fruit', label: '과일' },
    { key: 'meat', label: '육류' },
    { key: 'diet', label: '전용 사료' },
    { key: customFoodOptionKey, label: '기타 직접 입력' },
  ],
  unknown: [
    ...fixedHerpFoods,
    { key: customFoodOptionKey, label: '기타 직접 입력' },
  ],
}

const GECKO_FOOD_OPTIONS_BY_SPECIES: Record<string, FoodOption[]> = {
  crested_gecko: geckoFoodFoods,
  gargoyle_gecko: geckoFoodFoods,
  chahoua_gecko: geckoFoodFoods,
  day_gecko: geckoFoodFoods,
  leopard_gecko: commonGeckoFoods,
  fat_tailed_gecko: commonGeckoFoods,
  viper_gecko: commonGeckoFoods,
  tokay_gecko: commonGeckoFoods,
}

function normalizeFoodMatchText(value?: string) {
  return (value ?? '').toLowerCase().replace(/\s+/g, '').replace(/[()]/g, '')
}

function getGeckoSpeciesKey(pet: DiaryPet): string | null {
  const species = normalizeFoodMatchText(pet.species)
  if (species.includes('크레스티드') || species.includes('crested')) return 'crested_gecko'
  if (species.includes('가고일') || species.includes('gargoyle')) return 'gargoyle_gecko'
  if (species.includes('차화') || species.includes('chahoua')) return 'chahoua_gecko'
  if (species.includes('데이') || species.includes('day')) return 'day_gecko'
  if (species.includes('레오파드') || species.includes('leopard')) return 'leopard_gecko'
  if (species.includes('팻테일') || species.includes('fattail') || species.includes('fat-tailed') || species.includes('fat_tailed')) return 'fat_tailed_gecko'
  if (species.includes('바이퍼') || species.includes('viper')) return 'viper_gecko'
  if (species.includes('토케이') || species.includes('tokay')) return 'tokay_gecko'
  return null
}

function getLizardType(pet: DiaryPet): string {
  const species = normalizeFoodMatchText(pet.species)
  if (species.includes('게코') || species.includes('gecko')) return 'gecko'
  if (species.includes('비어디드래곤') || species.includes('비어디') || species.includes('beardeddragon')) return 'bearded_dragon'
  if (species.includes('모니터') || species.includes('왕도마뱀') || species.includes('monitor')) return 'monitor'
  if (species.includes('카멜레온') || species.includes('chameleon')) return 'chameleon'
  if (species.includes('이구아나') || species.includes('iguana')) return 'iguana'
  if (species.includes('스킨크') || species.includes('skink')) return 'skink'
  if (species.includes('유로매스틱스') || species.includes('uromastyx')) return 'uromastyx'
  if (species.includes('기타') || species.includes('other')) return 'other'
  return 'unknown'
}

function getFeedingFoodOptions(pet: DiaryPet, speciesProfiles: SpeciesCareProfile[] = fallbackSpeciesCareProfiles): FoodOption[] {
  const speciesProfile = findSpeciesCareProfile(pet.species, speciesProfiles)
  if (speciesProfile?.foodOptions.length) return withFixedHerpFoodOptions(pet, speciesProfile.foodOptions)
  const lizardType = getLizardType(pet)
  const addFixedHerpFoods = (options: FoodOption[]) => withFixedHerpFoodOptions(pet, options)
  if (lizardType === 'gecko') {
    const geckoKey = getGeckoSpeciesKey(pet)
    return addFixedHerpFoods(geckoKey ? GECKO_FOOD_OPTIONS_BY_SPECIES[geckoKey] ?? commonGeckoFoods : commonGeckoFoods)
  }
  if (pet.group === 'amphibian') return addFixedHerpFoods(FOOD_OPTIONS_BY_LIZARD_TYPE.unknown)
  return addFixedHerpFoods(FOOD_OPTIONS_BY_LIZARD_TYPE[lizardType] ?? FOOD_OPTIONS_BY_LIZARD_TYPE.unknown)
}

function withFixedHerpFoodOptions(pet: DiaryPet, options: FoodOption[]) {
  if (pet.group !== 'reptile') return options
  const custom = options.find((option) => option.key === customFoodOptionKey)
  const body = options.filter((option) => option.key !== customFoodOptionKey)
  const missingFixed = fixedHerpFoods.filter((fixed) => !body.some((option) => option.key === fixed.key))
  return [...body, ...missingFixed, ...(custom ? [custom] : [])]
}

function getEnvironmentProfileKey(pet: DiaryPet, speciesProfiles: SpeciesCareProfile[] = fallbackSpeciesCareProfiles): string | null {
  const speciesProfile = findSpeciesCareProfile(pet.species, speciesProfiles)
  if (speciesProfile?.environmentProfile) return speciesProfile.environmentProfile.key
  const species = normalizeFoodMatchText(pet.species)
  const geckoKey = getGeckoSpeciesKey(pet)
  if (geckoKey) return geckoKey
  if (species.includes('비어디드래곤') || species.includes('비어디') || species.includes('beardeddragon')) return 'bearded_dragon'
  if (species.includes('모니터') || species.includes('왕도마뱀') || species.includes('monitor')) return 'monitor'
  if (species.includes('카멜레온') || species.includes('chameleon')) return 'chameleon'
  if (species.includes('이구아나') || species.includes('iguana')) return 'iguana'
  if (species.includes('스킨크') || species.includes('skink')) return 'skink'
  if (species.includes('유로매스틱스') || species.includes('uromastyx')) return 'uromastyx'
  if (species.includes('파이톤') || species.includes('python')) return 'python'
  if (species.includes('보아') || species.includes('boa')) return 'boa'
  if (species.includes('스네이크') || species.includes('snake') || species.includes('뱀')) return 'snake'
  if (species.includes('팩맨') || species.includes('pacman')) return 'pacman_frog'
  if (species.includes('트리프록') || species.includes('treefrog') || species.includes('tree_frog')) return 'tree_frog'
  if (species.includes('다트프록') || species.includes('dartfrog') || species.includes('dart_frog')) return 'dart_frog'
  if (species.includes('뉴트') || species.includes('newt')) return 'newt'
  if (species.includes('살라만다') || species.includes('salamander')) return 'salamander'
  if (species.includes('아홀로틀') || species.includes('axolotl')) return 'axolotl'
  if (species.includes('토드') || species.includes('toad')) return 'toad'
  return null
}

function getEnvironmentProfile(pet: DiaryPet, speciesProfiles: SpeciesCareProfile[] = fallbackSpeciesCareProfiles) {
  const speciesProfile = findSpeciesCareProfile(pet.species, speciesProfiles)
  if (speciesProfile) return speciesProfile.environmentProfile
  const key = getEnvironmentProfileKey(pet, speciesProfiles)
  return key ? ENVIRONMENT_PROFILES[key] ?? null : null
}

function calculateEnvironmentRisk(
  metricType: 'temperature' | 'humidity',
  value: number,
  minValue: number,
  maxValue: number,
  previousRecords: PetRecord[],
): EnvironmentRiskResult {
  const direction = value < minValue ? 'low' : value > maxValue ? 'high' : 'normal'
  if (direction === 'normal') return { level: 0, direction, message: '적정 범위 안에 있어요.' }
  const diff = direction === 'low' ? minValue - value : value - maxValue
  const baseLevel = metricType === 'temperature'
    ? diff >= 7 ? 5 : diff >= 5 ? 4 : diff >= 3 ? 3 : 1
    : diff >= 31 ? 5 : diff >= 21 ? 4 : diff >= 11 ? 3 : 1
  const latestMetricRecord = previousRecords
    .filter((record) => record.environmentRecord?.metricType === metricType)
    .slice()
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0]
  const sameDirection = latestMetricRecord?.environmentRecord?.riskDirection === direction
  const repeatedLevel = sameDirection ? Math.min(5, Math.max(baseLevel, (latestMetricRecord.environmentRecord?.riskLevel ?? 0) + 1)) as RiskLevel : baseLevel as RiskLevel
  const level = repeatedLevel
  if (level === 1) {
    if (metricType === 'humidity') return { level, direction, message: direction === 'low' ? '적정 범위보다 습도가 조금 낮아요. 분무와 수분 상태를 확인해주세요.' : '적정 범위보다 습도가 조금 높아요. 환기와 바닥 상태를 확인해주세요.' }
    return { level, direction, message: direction === 'low' ? '적정 범위보다 조금 낮아요. 측정 위치와 난방 상태를 다시 확인해주세요.' : '적정 범위보다 조금 높아요. 측정 위치와 환기 상태를 다시 확인해주세요.' }
  }
  if (level === 2) return { level, direction, message: '같은 환경 이상이 반복되고 있어요. 사육장 환경을 조정한 뒤 다시 측정해주세요.' }
  if (level === 3) return { level, direction, message: '현재 환경이 적정 범위를 뚜렷하게 벗어났어요. 바로 조정하고 잠시 후 다시 확인해주세요.' }
  if (level === 4) return { level, direction, message: '환경을 빠르게 점검해야 해요. 온도·습도 장비와 동물의 활동 상태를 함께 확인해주세요.' }
  return { level, direction, message: '위험한 환경일 수 있어요. 안전한 범위로 즉시 조정하고 이상 증상이 있으면 특수동물 병원에 문의해주세요.' }
}

function environmentRiskLabel(level: RiskLevel) {
  return ['정상', '확인 필요', '주의', '조치 필요', '긴급 점검', '즉시 대응'][level]
}

export default function DiaryPage({
  userId,
  pets,
  hospitalReviews = {},
  initialPetId,
  readOnly = false,
  onAddPet,
  onCreateQna,
  initialDraft,
  onDeleteDraft,
}: {
  userId: string
  pets: DiaryPet[]
  hospitalReviews?: Record<string, HospitalReview[]>
  initialPetId?: string
  readOnly?: boolean
  onAddPet: () => void
  onCreateQna?: (petId: string) => void
  initialDraft?: DiaryDraftItem | null
  onDeleteDraft?: (draftId: string) => void | Promise<void>
}) {
  const today = toDateKey(new Date())
  const [selectedPetId, setSelectedPetId] = useState(() => getInitialDiaryPetId(userId, pets, initialPetId))
  const [selectedDate, setSelectedDate] = useState(today)
  const [mobileView, setMobileView] = useState<'plan' | 'calendar'>('plan')
  const [visibleMonth, setVisibleMonth] = useState(new Date())
  const [records, setRecords] = useState<PetRecord[]>([])
  const [reminders, setReminders] = useState<Reminder[]>([])
  const [dailyTasks, setDailyTasks] = useState<DailyTask[]>([])
  const [speciesCareProfiles, setSpeciesCareProfiles] = useState<SpeciesCareProfile[]>(fallbackSpeciesCareProfiles)
  const [usingCarePlans, setUsingCarePlans] = useState(false)
  const [createType, setCreateType] = useState<PetRecordType | null>(null)
  const [recordInitialDraft, setRecordInitialDraft] = useState<RecordDraft | undefined>()
  const [recordDate, setRecordDate] = useState(selectedDate)
  const [selectedRecordId, setSelectedRecordId] = useState<string | null>(null)
  const [completingDailyTask, setCompletingDailyTask] = useState<DailyTask | undefined>()
  const [feedingCompletion, setFeedingCompletion] = useState<{ reminder: Reminder; dailyTask?: DailyTask } | null>(null)
  const [selectedFeedingFoods, setSelectedFeedingFoods] = useState<FeedingFoodItem[]>([])
  const [customFeedingName, setCustomFeedingName] = useState('')
  const [feedingSaving, setFeedingSaving] = useState(false)
  const [feedingError, setFeedingError] = useState('')
  const [environmentCompletion, setEnvironmentCompletion] = useState<{ reminder: Reminder; dailyTask?: DailyTask; metricType: 'temperature' | 'humidity'; measurementType?: 'air' | 'water' | 'humidity' } | null>(null)
  const [environmentSaving, setEnvironmentSaving] = useState(false)
  const [environmentError, setEnvironmentError] = useState('')
  const [dateDetailsOpen, setDateDetailsOpen] = useState(false)
  const [visualizationOpen, setVisualizationOpen] = useState(false)
  const [completingReminder, setCompletingReminder] = useState<Reminder | null>(null)
  const [reminderFormOpen, setReminderFormOpen] = useState(false)
  const [hospitalReviewPickerOpen, setHospitalReviewPickerOpen] = useState(false)
  const [editingReminder, setEditingReminder] = useState<Reminder | null>(null)
  const [routinePresetType, setRoutinePresetType] = useState<ReminderType | null>(null)
  const [petWarningOpen, setPetWarningOpen] = useState(false)
  const [petMenuOpen, setPetMenuOpen] = useState(false)
  const [smartSheet, setSmartSheet] = useState<SmartAddKind | null>(null)
  const [smartFoodKind, setSmartFoodKind] = useState('')
  const [smartFoodQuantity, setSmartFoodQuantity] = useState('1')
  const [smartFoodUnit, setSmartFoodUnit] = useState('마리')
  const [smartPoopStatus, setSmartPoopStatus] = useState('')
  const [smartShedStatus, setSmartShedStatus] = useState('')
  const [smartMatingFemaleId, setSmartMatingFemaleId] = useState('')
  const [smartMatingMaleId, setSmartMatingMaleId] = useState('')
  const [smartEggMatingId, setSmartEggMatingId] = useState('')
  const [pendingSmartRecord, setPendingSmartRecord] = useState<{ record: PetRecord; message: string } | null>(null)
  const [smartToast, setSmartToast] = useState('')
  const completingTaskIds = useRef(new Set<string>())
  const lastInitialPetIdRef = useRef(initialPetId)

  const selectedPet = pets.find((pet) => pet.id === selectedPetId) ?? pets[0]
  const effectivePetId = selectedPet?.id ?? ''
  const selectedPetHospitalReviews = useMemo(
    () => Object.values(hospitalReviews)
      .flat()
      .filter((review) => review.petId === effectivePetId && (review.mine === true || review.userId === userId))
      .sort((a, b) => (b.visitDate ?? b.createdAt).localeCompare(a.visitDate ?? a.createdAt)),
    [effectivePetId, hospitalReviews, userId],
  )
  const activeReminders = reminders.filter((reminder) => reminder.isActive)
  const petCarePlans = reminders.filter((reminder) => reminder.petId === effectivePetId)
  const petRecords = records.filter((record) => record.petId === effectivePetId)
  const displayPetRecords = useMemo(() => collapseShedRecordsForDisplay(petRecords), [petRecords])
  const recentFoods = Array.from(new Set(petRecords.flatMap((record) => record.type === 'food' ? record.foods ?? [] : []))).slice(0, 3)
  const matingPetCandidates = selectedPet ? pets.filter((pet) => sameSpecies(pet, selectedPet)) : []
  const matingOptions = useMemo(() => getMatingOptions(records, pets, selectedPet), [pets, records, selectedPet])
  const previousDate = toDateKey(new Date(parseDateKey(selectedDate).getTime() - 86400000))
  const legacyPlanReminders = activeReminders
    .filter((reminder) => reminder.petId === effectivePetId && reminder.scheduleType === 'repeat')
    .flatMap((reminder) => {
      if (reminderOccursOn(reminder, parseDateKey(selectedDate))) return [{ reminder, overdue: false }]
      if (reminderOccursOn(reminder, parseDateKey(previousDate)) && reminder.completedAt?.slice(0, 10) !== previousDate) return [{ reminder, overdue: true }]
      return []
    })
  const dailyTaskPlanReminders = usingCarePlans
    ? dailyTasks
      .filter((task) => task.petId === effectivePetId && (task.scheduledDate === selectedDate || (task.scheduledDate < today && task.status === 'pending')))
      .map((task) => ({ reminder: reminders.find((item) => item.id === task.carePlanId) ?? medicationTaskReminder(task), overdue: task.scheduledDate < today, dailyTask: task }))
      .filter((item): item is { reminder: Reminder; overdue: boolean; dailyTask: DailyTask } => Boolean(item.reminder))
    : []
  const dailyTaskReminderIds = new Set(dailyTaskPlanReminders.map((item) => item.reminder.id))
  const immediatePlanReminders = legacyPlanReminders
    .filter((item) => !dailyTaskReminderIds.has(item.reminder.id))
    .map((item) => ({ ...item, dailyTask: undefined }))
  const planReminders = [...dailyTaskPlanReminders, ...immediatePlanReminders]
    .filter((item) => !selectedPet || isReminderVisibleForPet(item.reminder, selectedPet, speciesCareProfiles))
  const selectedRecord = selectedRecordId ? records.find((record) => record.id === selectedRecordId) : null

  useEffect(() => {
    const savedPetId = window.localStorage.getItem(lastDiaryPetKey(userId))
    const nextPetId = initialPetId && pets.some((pet) => pet.id === initialPetId)
      ? initialPetId
      : savedPetId && pets.some((pet) => pet.id === savedPetId)
        ? savedPetId
        : pets[0]?.id ?? ''
    const initialPetChanged = lastInitialPetIdRef.current !== initialPetId
    const selectedPetStillExists = pets.some((pet) => pet.id === selectedPetId)
    lastInitialPetIdRef.current = initialPetId
    if (nextPetId && nextPetId !== selectedPetId && (initialPetChanged || !selectedPetStillExists)) {
      setSelectedPetId(nextPetId)
      setSelectedRecordId(null)
      setDateDetailsOpen(false)
    }
  }, [initialPetId, pets, selectedPetId, userId])

  useEffect(() => {
    if (!selectedPetId || !pets.some((pet) => pet.id === selectedPetId)) return
    window.localStorage.setItem(lastDiaryPetKey(userId), selectedPetId)
  }, [pets, selectedPetId, userId])

  useEffect(() => {
    let active = true
    Promise.all([
      loadAppData<PetRecord>('care_records', { userId, scope: 'mine' }).catch(() => []),
      listCarePlans(userId).then((plans) => ({ plans, migrated: true })).catch(() => loadAppData<Reminder>('feeding_reminders', { userId, scope: 'mine' }).then((legacy) => ({ plans: legacy.map(reminderToCarePlan), migrated: false })).catch(() => ({ plans: [], migrated: false }))),
      listSpeciesCareProfiles().catch(() => fallbackSpeciesCareProfiles),
    ]).then(([nextRecords, planResult, nextSpeciesCareProfiles]) => {
      if (!active) return
      setRecords(nextRecords)
      setReminders(planResult.plans.map(carePlanToReminder))
      setUsingCarePlans(planResult.migrated)
      setSpeciesCareProfiles(nextSpeciesCareProfiles.length ? nextSpeciesCareProfiles : fallbackSpeciesCareProfiles)
    })
    return () => {
      active = false
    }
  }, [userId])

  const refreshDailyTasks = useCallback(() => {
    if (!usingCarePlans || !effectivePetId) {
      setDailyTasks([])
      return Promise.resolve()
    }
    const monthStart = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), 1)
    const monthEnd = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + 1, 0)
    return listDailyTasks(
      userId,
      toDateKey(new Date(monthStart.getTime() - 86400000 * 14)),
      toDateKey(new Date(monthEnd.getTime() + 86400000 * 14)),
      effectivePetId,
    ).then(setDailyTasks).catch(() => setDailyTasks([]))
  }, [effectivePetId, userId, usingCarePlans, visibleMonth])

  useEffect(() => {
    const taskId = window.setTimeout(() => {
      void refreshDailyTasks()
    }, 0)
    return () => window.clearTimeout(taskId)
  }, [refreshDailyTasks])

  useEffect(() => {
    if (!initialDraft || initialDraft.draftType !== 'care_record') return
    const payload = initialDraft.payload
    // Restore a draft opened from the profile activity list.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSelectedPetId(payload.petId)
    setSelectedDate(payload.date)
    setRecordDate(payload.date)
    setRecordInitialDraft({ ...payload.draft, step: initialDraft.step ?? payload.draft.step })
    setCompletingReminder(null)
    setCreateType(payload.draft.type)
  }, [initialDraft])

  useEffect(() => {
    if (!initialDraft || initialDraft.draftType !== 'reminder') return
    // Restore a reminder draft opened from the profile activity list.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSelectedPetId(initialDraft.payload.reminder.petId)
    setEditingReminder(initialDraft.payload.reminder)
    setRoutinePresetType(null)
    setReminderFormOpen(true)
  }, [initialDraft])

  const saveRecordList = (next: PetRecord[]) => {
    const removed = records.find((record) => !next.some((item) => item.id === record.id))
    const added = next.find((record) => !records.some((item) => item.id === record.id))
    setRecords(next)
    if (removed) void deleteAppData('care_records', removed.id).catch((error) => console.error('Care record delete failed.', error))
    if (added) {
      void saveAppData('care_records', userId, added, {
        pet_id: added.petId,
        record_date: added.date,
        record_type: added.type,
        memo: added.memo ?? '',
        daily_task_id: added.dailyTaskId,
        occurred_at: added.occurredAt,
        scheduled_for: added.scheduledFor,
        status: added.status ?? 'manual',
      }).catch((error) => console.error('Care record save failed; kept local state.', error))
    }
  }

  const saveReminderList = (next: Reminder[]) => {
    const removed = reminders.find((reminder) => !next.some((item) => item.id === reminder.id))
    const added = next.find((reminder) => !reminders.some((item) => item.id === reminder.id))
    const updated = next.find((reminder) => reminders.some((item) => item.id === reminder.id && item !== reminder))
    setReminders(next)
    if (usingCarePlans) {
      if (removed) void cancelNotificationJobsForReminder(removed)
        .finally(() => deleteCarePlan(removed.id))
        .finally(() => refreshDailyTasks())
        .catch((error) => console.error('Care plan delete failed.', error))
      if (added) void saveCarePlan(userId, reminderToCarePlan(added))
        .then(() => upsertNotificationJobForReminder(added))
        .then(() => refreshDailyTasks())
        .catch((error) => console.error('Care plan save failed; kept local state.', error))
      if (updated) void saveCarePlan(userId, reminderToCarePlan(updated))
        .then(() => updated.isActive ? upsertNotificationJobForReminder(updated) : cancelNotificationJobsForReminder(updated))
        .then(() => refreshDailyTasks())
        .catch((error) => console.error('Care plan update failed; kept local state.', error))
    } else {
      if (removed) void cancelNotificationJobsForReminder(removed)
        .finally(() => deleteAppData('feeding_reminders', removed.id))
        .catch((error) => console.error('Reminder delete failed.', error))
      if (added) void saveAppData('feeding_reminders', userId, added, { pet_id: added.petId })
        .then(() => upsertNotificationJobForReminder(added))
        .catch((error) => console.error('Reminder save failed; kept local state.', error))
      if (updated) void saveAppData('feeding_reminders', userId, updated, { pet_id: updated.petId })
        .then(() => updated.isActive ? upsertNotificationJobForReminder(updated) : cancelNotificationJobsForReminder(updated))
        .catch((error) => console.error('Reminder update failed; kept local state.', error))
    }
  }

  const upsertNotificationJobForReminder = async (reminder: Reminder) => {
    if (!reminder.isActive) return
    try {
      const startDate = reminder.startDate ?? reminder.reminderDate ?? today
      const routineDate = getFirstRoutineDate(startDate, reminder.weekdays)
      await upsertRoutineNotificationJob({
        userId: String(userId),
        petId: String(reminder.petId),
        routineId: String(reminder.id),
        routineDate,
        notificationTime: reminder.reminderTime || '09:00',
      })
    } catch (error) {
      console.error('Routine notification job upsert failed.', error)
      showSmartToast('알림 시간을 저장하지 못했어요. 루틴은 저장됐어요.')
    }
  }

  const cancelNotificationJobsForReminder = async (reminder: Reminder) => {
    try {
      await cancelRoutineNotificationJobs(String(userId), String(reminder.id))
    } catch (error) {
      console.error('Routine notification job cancel failed.', error)
      showSmartToast('알림 작업을 취소하지 못했어요.')
    }
  }

  const markNotificationJobCompletedForTask = async (dailyTask: DailyTask) => {
    if (!dailyTask.carePlanId) return
    try {
      await markRoutineNotificationJobCompleted(String(userId), String(dailyTask.carePlanId), dailyTask.scheduledDate)
    } catch (error) {
      console.error('Routine notification job complete sync failed.', error)
    }
  }

  const markNotificationJobSkippedForTask = async (dailyTask: DailyTask) => {
    if (!dailyTask.carePlanId) return
    try {
      await markRoutineNotificationJobSkipped(String(userId), String(dailyTask.carePlanId), dailyTask.scheduledDate)
    } catch (error) {
      console.error('Routine notification job skip sync failed.', error)
    }
  }

  const openSmartAdd = (kind: SmartAddKind) => {
    if (!selectedPet) {
      setPetWarningOpen(true)
      return
    }
    if (selectedDate > today) return
    setSmartSheet((current) => current === kind ? null : kind)
    setSmartFoodKind('')
    setSmartFoodQuantity('1')
    setSmartFoodUnit('마리')
    setSmartPoopStatus('')
    setSmartShedStatus('')
    setSmartMatingFemaleId(selectedPet.gender === 'female' ? selectedPet.id : '')
    setSmartMatingMaleId(selectedPet.gender === 'male' ? selectedPet.id : '')
    setSmartEggMatingId('')
  }

  const openReminderCreate = () => {
    if (!selectedPet) {
      setPetWarningOpen(true)
      return
    }
    setEditingReminder(null)
    setRoutinePresetType(null)
    setReminderFormOpen(true)
  }

  const openIncidentRoutine = (type: 'medicine' | 'hospital') => {
    if (!selectedPet) {
      setPetWarningOpen(true)
      return
    }
    if (type === 'hospital') {
      setHospitalReviewPickerOpen(true)
      return
    }
    setEditingReminder(null)
    setRoutinePresetType(type)
    setReminderFormOpen(true)
  }

  const showSmartToast = (message: string) => {
    setSmartToast(message)
    window.setTimeout(() => setSmartToast(''), 2000)
  }

  const closeFeedingCompletion = () => {
    setFeedingCompletion(null)
    setSelectedFeedingFoods([])
    setCustomFeedingName('')
    setFeedingSaving(false)
    setFeedingError('')
  }

  const closeEnvironmentCompletion = () => {
    setEnvironmentCompletion(null)
    setEnvironmentSaving(false)
    setEnvironmentError('')
  }

  const saveSmartRecord = (record: PetRecord, message: string) => {
    const key = `${record.type}|${record.memo ?? ''}|${record.foods?.join('|') ?? ''}`
    const duplicate = records.find((item) => item.petId === record.petId && item.date === record.date && `${item.type}|${item.memo ?? ''}|${item.foods?.join('|') ?? ''}` === key)
    if (duplicate) {
      showSmartToast('이미 같은 기록이 있어요.')
      return
    }
    saveRecordList([record, ...records])
    setSmartSheet(null)
    showSmartToast(message)
  }

  const openHospitalReviewRecord = (review: HospitalReview) => {
    if (!selectedPet) return
    const visitDate = review.visitDate ?? review.createdAt.slice(0, 10)
    const existingRecord = records.find((record) => record.id === review.id || record.reviewId === review.id)

    setHospitalReviewPickerOpen(false)
    setSelectedDate(visitDate)
    setVisibleMonth(new Date(`${visitDate}T00:00:00`))

    if (existingRecord) {
      setDateDetailsOpen(true)
      return
    }

    const hospitalName = review.hospitalName || review.hospitalSnapshot?.name || '병원 진료'
    const costText = review.cost ? `진료비 ${review.cost.toLocaleString('ko-KR')}원` : ''
    saveSmartRecord({
      id: review.id,
      userId,
      petId: selectedPet.id,
      type: 'hospital',
      date: visitDate,
      memo: [hospitalName, review.diagnosis, review.treatment, costText, review.body].filter(Boolean).join(' · '),
      hospitalId: review.hospitalId,
      reviewId: review.id,
      status: 'manual',
      createdAt: review.createdAt,
    }, '리뷰의 진료 기록을 불러왔어요.')
  }

  const makeSmartRecord = (type: PetRecordType, message: string, memo?: string, foods?: string[], photo?: string) => {
    if (!selectedPet) return
    saveSmartRecord({
      id: crypto.randomUUID(),
      userId,
      petId: selectedPet.id,
      type,
      date: selectedDate,
      memo,
      foods,
      photoUrl: photo,
      createdAt: new Date().toISOString(),
    }, message)
  }

  const saveSmartFood = (food: string) => makeSmartRecord('food', `${food} 먹이 기록이 저장되었습니다`, undefined, [food])
  const saveSmartPoop = (status = smartPoopStatus) => makeSmartRecord('poop', `배변 · ${status} 기록이 저장되었습니다`, status)
  const saveSmartShed = (status = smartShedStatus) => makeSmartRecord('shed', `탈피 · ${status} 기록이 저장되었습니다`, status)
  const saveShedCheckRecord = (status: '탈피 완료' | '탈피 확인 · 완료 안됨') => {
    if (!selectedPet) return
    const date = today
    const record: PetRecord = {
      id: crypto.randomUUID(),
      userId,
      petId: selectedPet.id,
      type: 'shed',
      date,
      memo: status,
      createdAt: new Date().toISOString(),
    }
    const duplicate = records.find((item) => item.petId === selectedPet.id && item.date === date && item.type === 'shed' && item.memo === status)
    if (duplicate) {
      showSmartToast('오늘 이미 탈피 확인을 기록했어요.')
      return
    }
    saveRecordList([record, ...records])
    showSmartToast(status === '탈피 완료' ? '탈피 완료로 기록했어요.' : '오늘은 아직 탈피 완료 전으로 기록했어요.')
  }
  const saveSmartWater = (option: string) => makeSmartRecord('other', `물 관리 · ${option} 기록이 저장되었습니다`, `물 관리 · ${option}`)
  const saveSmartCleaning = (option: string) => makeSmartRecord('cleaning', `청소 · ${option} 기록이 저장되었습니다`, option)
  const saveSmartMating = () => {
    const female = pets.find((pet) => pet.id === smartMatingFemaleId)
    const male = pets.find((pet) => pet.id === smartMatingMaleId)
    if (!female || !male || female.id === male.id || !sameSpecies(female, male)) return
    makeSmartRecord('other', `메이팅 기록이 저장되었습니다`, `메이팅 · 암컷 ${female.name} · 수컷 ${male.name} · ${female.species}`)
  }
  const saveSmartEgg = () => {
    const mating = matingOptions.find((option) => option.id === smartEggMatingId)
    if (!mating) return
    makeSmartRecord('other', `산란 기록이 저장되었습니다`, `산란 · ${mating.femaleName} · ${mating.maleName} · ${mating.species}`)
  }

  const completePlan = (reminder: Reminder, dailyTask?: DailyTask) => {
    if (!selectedPet) return
    if (reminder.reminderType === 'feed') {
      setFeedingCompletion({ reminder, dailyTask })
      setSelectedFeedingFoods([])
      setCustomFeedingName('')
      setFeedingSaving(false)
      setFeedingError('')
      return
    }
    if (reminder.reminderType === 'temperature' || reminder.reminderType === 'water_temperature' || reminder.reminderType === 'humidity') {
      setEnvironmentCompletion({
        reminder,
        dailyTask,
        metricType: reminder.reminderType === 'humidity' ? 'humidity' : 'temperature',
        measurementType: reminder.reminderType === 'water_temperature' ? 'water' : undefined,
      })
      setEnvironmentSaving(false)
      setEnvironmentError('')
      return
    }
    const meta = reminderMeta[reminder.reminderType]
    if (meta.inputType !== 'check') {
      setCompletingReminder(reminder)
      setCompletingDailyTask(dailyTask)
      setRecordDate(dailyTask?.scheduledDate ?? selectedDate)
      setRecordInitialDraft(createRoutineRecordDraft(meta.recordType, selectedPet, reminder))
      setCreateType(meta.recordType)
      return
    }
    if (dailyTask && usingCarePlans) {
      if (dailyTask.status === 'completed' || records.some((record) => record.dailyTaskId === dailyTask.id) || completingTaskIds.current.has(dailyTask.id)) return
      completingTaskIds.current.add(dailyTask.id)
      const label = planLabel(reminder)
      const recordType = reminderMeta[reminder.reminderType].recordType
      const completedAt = new Date().toISOString()
      setRecords((items) => [{ id: `task-${dailyTask.id}`, userId, petId: selectedPet.id, type: recordType, date: selectedDate, memo: label, foods: recordType === 'food' ? [label] : undefined, dailyTaskId: dailyTask.id, scheduledFor: dailyTask.scheduledDate, occurredAt: completedAt, status: 'completed', createdAt: completedAt }, ...items.filter((item) => item.dailyTaskId !== dailyTask.id)])
      setDailyTasks((items) => items.map((item) => item.id === dailyTask.id ? { ...item, status: 'completed', completedAt } : item))
      void completeDailyTask(dailyTask.id)
        .then(() => markNotificationJobCompletedForTask(dailyTask))
        .catch((error) => console.error('Daily task completion sync failed; kept local state.', error))
      showSmartToast(`${label} 완료 기록이 저장되었습니다`)
      return
    }
    const label = planLabel(reminder)
    const alreadyRecorded = records.some((record) => record.petId === selectedPet.id && record.date === selectedDate && record.memo === label)
    if (alreadyRecorded || reminder.completedAt?.slice(0, 10) === selectedDate) {
      showSmartToast(`${label}은(는) 이미 기록되어 있어요`)
      return
    }
    const recordType = reminderMeta[reminder.reminderType].recordType
    const record: PetRecord = {
      id: crypto.randomUUID(),
      userId,
      petId: selectedPet.id,
      type: recordType,
      date: selectedDate,
      memo: label,
      foods: recordType === 'food' ? [label] : undefined,
      createdAt: new Date().toISOString(),
    }
    saveRecordList([record, ...records])
    markReminderCompleted(reminder)
    showSmartToast(`${label} 완료 기록이 저장되었습니다`)
  }

  const completeFeedingPlan = async () => {
    if (!selectedPet || !feedingCompletion) return
    const customName = customFeedingName.trim()
    const foods: FeedingFoodItem[] = [
      ...selectedFeedingFoods.filter((food) => !food.isCustom),
      ...(customName ? [{ foodKey: null, foodName: customName, isCustom: true }] : []),
    ]
    if (!foods.length) {
      setFeedingError('먹이를 하나 이상 선택해 주세요.')
      return
    }
    setFeedingSaving(true)
    try {
      const { reminder, dailyTask } = feedingCompletion
      const completedAt = new Date().toISOString()
      const foodNames = foods.map((food) => food.foodName)
      const record: PetRecord = {
        id: dailyTask ? `task-${dailyTask.id}` : crypto.randomUUID(),
        userId,
        petId: selectedPet.id,
        type: 'food',
        date: dailyTask?.scheduledDate ?? selectedDate,
        memo: planLabel(reminder),
        foods: foodNames,
        feedingFoods: foods,
        dailyTaskId: dailyTask?.id,
        scheduledFor: dailyTask?.scheduledDate,
        occurredAt: completedAt,
        status: 'completed',
        createdAt: completedAt,
      }
      await saveAppData('care_records', userId, record, {
        pet_id: record.petId,
        record_date: record.date,
        record_type: record.type,
        memo: record.memo ?? '',
        daily_task_id: record.dailyTaskId,
        occurred_at: record.occurredAt,
        scheduled_for: record.scheduledFor,
        status: record.status ?? 'manual',
      })
      setRecords([record, ...records.filter((item) => dailyTask ? item.dailyTaskId !== dailyTask.id : item.id !== record.id)])
      if (dailyTask && usingCarePlans) {
        completingTaskIds.current.add(dailyTask.id)
        await markDailyTaskCompleted(dailyTask.id)
        void markNotificationJobCompletedForTask(dailyTask)
        setDailyTasks((items) => items.map((item) => item.id === dailyTask.id ? { ...item, status: 'completed', completedAt } : item))
      } else {
        markReminderCompleted(reminder)
      }
      closeFeedingCompletion()
      showSmartToast(`${foodNames.join(' · ')} 먹이 기록이 저장되었습니다`)
    } catch (error) {
      console.error('Feeding completion failed.', error)
      setFeedingSaving(false)
      setFeedingError('먹이 기록을 저장하지 못했어요. 다시 시도해주세요.')
    }
  }

  const completeEnvironmentPlan = async (value: number) => {
    if (!selectedPet || !environmentCompletion) return
    const profile = getEnvironmentProfile(selectedPet, speciesCareProfiles)
    const { reminder, dailyTask, metricType, measurementType } = environmentCompletion
    const isHumidity = metricType === 'humidity'
    const fallbackProfile: EnvironmentProfile = profile ?? {
      key: 'unknown',
      label: selectedPet.species || selectedPet.name,
      temperatureType: measurementType === 'water' ? 'water' : 'air',
      targetTemperature: value,
      minTemperature: value,
      maxTemperature: value,
      humidityEnabled: true,
      targetHumidity: isHumidity ? value : null,
      minHumidity: isHumidity ? value : null,
      maxHumidity: isHumidity ? value : null,
      isBroadCategory: false,
    }
    if (isHumidity && fallbackProfile.humidityEnabled === false) return
    const minValue = isHumidity ? fallbackProfile.minHumidity ?? value : fallbackProfile.minTemperature
    const maxValue = isHumidity ? fallbackProfile.maxHumidity ?? value : fallbackProfile.maxTemperature
    const targetValue = isHumidity ? fallbackProfile.targetHumidity ?? value : fallbackProfile.targetTemperature
    const risk = profile ? calculateEnvironmentRisk(metricType, value, minValue, maxValue, petRecords) : { level: 0 as RiskLevel, direction: 'normal' as const, message: '자동 온습도 기준이 없어 판정 없이 기록했어요.' }
    const recordMeasurementType = isHumidity ? 'humidity' : measurementType === 'water' ? 'water' : fallbackProfile.temperatureType
    const completedAt = new Date().toISOString()
    const environmentRecord: EnvironmentRecord = {
      profileKey: fallbackProfile.key,
      metricType,
      measurementType: recordMeasurementType,
      value,
      unit: isHumidity ? 'percent' : 'celsius',
      targetValue,
      minValue,
      maxValue,
      riskLevel: risk.level,
      riskDirection: risk.direction,
      riskMessage: risk.message,
    }
    const label = getEnvironmentMetricLabel(metricType, fallbackProfile, recordMeasurementType)
    const record: PetRecord = {
      id: dailyTask ? `task-${dailyTask.id}` : crypto.randomUUID(),
      userId,
      petId: selectedPet.id,
      type: 'other',
      date: dailyTask?.scheduledDate ?? selectedDate,
      memo: `${label} 완료`,
      environmentRecord,
      dailyTaskId: dailyTask?.id,
      scheduledFor: dailyTask?.scheduledDate,
      occurredAt: completedAt,
      status: 'completed',
      createdAt: completedAt,
    }
    setEnvironmentSaving(true)
    try {
      await saveAppData('care_records', userId, record, {
        pet_id: record.petId,
        record_date: record.date,
        record_type: record.type,
        memo: record.memo ?? '',
        daily_task_id: record.dailyTaskId,
        occurred_at: record.occurredAt,
        scheduled_for: record.scheduledFor,
        status: record.status ?? 'manual',
      })
      setRecords([record, ...records.filter((item) => dailyTask ? item.dailyTaskId !== dailyTask.id : item.id !== record.id)])
      if (dailyTask && usingCarePlans) {
        completingTaskIds.current.add(dailyTask.id)
        await markDailyTaskCompleted(dailyTask.id)
        void markNotificationJobCompletedForTask(dailyTask)
        setDailyTasks((items) => items.map((item) => item.id === dailyTask.id ? { ...item, status: 'completed', completedAt } : item))
      } else {
        markReminderCompleted(reminder)
      }
      closeEnvironmentCompletion()
      showSmartToast(`${label} ${formatEnvironmentValue(environmentRecord)} 기록이 저장되었습니다`)
    } catch (error) {
      console.error('Environment completion failed.', error)
      setEnvironmentSaving(false)
      setEnvironmentError('환경 기록을 저장하지 못했어요. 다시 시도해주세요.')
    }
  }

  const undoPlan = (reminder: Reminder, dailyTask?: DailyTask) => {
    if (dailyTask && usingCarePlans) {
      completingTaskIds.current.delete(dailyTask.id)
      setDailyTasks((items) => items.map((item) => item.id === dailyTask.id ? { ...item, status: 'pending', completedAt: undefined } : item))
      setRecords((items) => items.filter((item) => item.dailyTaskId !== dailyTask.id))
      void undoDailyTask(dailyTask.id).catch((error) => console.error('Daily task undo sync failed; kept local state.', error))
      showSmartToast(`${planLabel(reminder)} 기록을 되돌렸어요`)
      return
    }
    const record = records.find((item) => item.petId === effectivePetId && item.date === selectedDate && item.memo === planLabel(reminder))
    if (record) saveRecordList(records.filter((item) => item.id !== record.id))
    saveReminderList(reminders.map((item) => item.id === reminder.id ? { ...item, completedAt: undefined, updatedAt: new Date().toISOString() } : item))
  }

  const skipPlan = (dailyTask?: DailyTask) => {
    if (!dailyTask || !usingCarePlans) return
    setDailyTasks((items) => items.map((item) => item.id === dailyTask.id ? { ...item, status: 'skipped' } : item))
    void skipDailyTask(dailyTask.id)
      .then(() => markNotificationJobSkippedForTask(dailyTask))
      .catch((error) => console.error('Daily task skip sync failed; kept local state.', error))
    showSmartToast('이번 할 일을 건너뛰었어요')
  }

  const togglePlan = (reminder: Reminder) => {
    saveReminderList(reminders.map((item) => item.id === reminder.id ? { ...item, isActive: !item.isActive, updatedAt: new Date().toISOString() } : item))
  }
  void togglePlan

  const switchPet = (petId: string) => {
    if (petId === selectedPetId) return
    setSelectedPetId(petId)
    setPetMenuOpen(false)
    setSelectedRecordId(null)
    setDateDetailsOpen(false)
    setVisualizationOpen(false)
    closeFeedingCompletion()
    closeEnvironmentCompletion()
  }

  const removePlan = (reminderId: string) => {
    saveReminderList(reminders.filter((item) => item.id !== reminderId))
  }

  const closeRecordCreate = () => {
    setCreateType(null)
    setRecordInitialDraft(undefined)
    setCompletingReminder(null)
    setCompletingDailyTask(undefined)
    setRecordDate(selectedDate)
  }

  if (createType && selectedPet) {
    return (
      <RecordCreateScreen
        pet={selectedPet}
        type={createType}
        date={recordDate}
        initialDraft={recordInitialDraft}
        onBack={closeRecordCreate}
        onSave={(draft) => {
          const nextMemo = getRecordMemo(draft)
          const nextFoods = draft.type === 'food' ? [...draft.foods, draft.customFood].filter(Boolean) : undefined
          const duplicate = records.some((item) => item.petId === selectedPet.id && item.date === recordDate && item.type === draft.type && (item.memo ?? '') === nextMemo && (item.foods?.join('|') ?? '') === (nextFoods?.join('|') ?? ''))
          if (duplicate) {
            showSmartToast('이미 같은 기록이 있어요.')
            return
          }
          const record: PetRecord = {
            id: crypto.randomUUID(),
            userId,
            petId: selectedPet.id,
            type: draft.type,
            date: recordDate,
            memo: nextMemo,
            photoUrl: draft.photo,
            weight: draft.type === 'weight' ? Number(draft.weight) : undefined,
            foods: nextFoods,
            createdAt: new Date().toISOString(),
          }
          if (completingDailyTask && usingCarePlans) {
            const completedAt = new Date().toISOString()
            const taskRecord = {
              ...record,
              dailyTaskId: completingDailyTask.id,
              scheduledFor: completingDailyTask.scheduledDate,
              occurredAt: completedAt,
              status: 'completed' as const,
            }
            saveRecordList([taskRecord, ...records])
            setDailyTasks((items) => items.map((item) => item.id === completingDailyTask.id ? { ...item, status: 'completed', completedAt } : item))
            void markDailyTaskCompleted(completingDailyTask.id)
              .then(() => markNotificationJobCompletedForTask(completingDailyTask))
              .catch((error) => console.error('Daily task completion sync failed after typed record; kept local state.', error))
          } else if (completingReminder) {
            saveRecordList([record, ...records])
            markReminderCompleted(completingReminder)
          } else {
            saveRecordList([record, ...records])
          }
          closeRecordCreate()
          setSelectedDate(recordDate)
          if (initialDraft) void onDeleteDraft?.(initialDraft.id)
        }}
      />
    )
  }

  if (selectedRecord) {
    const recordPet = pets.find((pet) => pet.id === selectedRecord.petId)
    return (
      <RecordDetailScreen
        record={selectedRecord}
        pet={recordPet}
        readOnly={readOnly}
        onBack={() => setSelectedRecordId(null)}
        onDelete={() => {
          saveRecordList(records.filter((item) => item.id !== selectedRecord.id))
          setSelectedRecordId(null)
        }}
      />
    )
  }

  if (reminderFormOpen) {
    return (
      <ReminderCreateScreen
        pets={pets}
        selectedPetId={effectivePetId}
        existingReminders={reminders}
        initialReminder={editingReminder}
        presetType={routinePresetType}
        speciesCareProfiles={speciesCareProfiles}
        onBack={() => { setReminderFormOpen(false); setEditingReminder(null); setRoutinePresetType(null) }}
        onSave={(nextReminders) => {
          const next = editingReminder
            ? reminders.flatMap((item) => item.id === editingReminder.id ? nextReminders : [item])
            : [...nextReminders, ...reminders]
          saveReminderList(next)
          setReminderFormOpen(false)
          setEditingReminder(null)
          setRoutinePresetType(null)
          if (initialDraft?.draftType === 'reminder') void onDeleteDraft?.(initialDraft.id)
        }}
      />
    )
  }

  if (dateDetailsOpen) {
    return <DateRecordsScreen
      date={selectedDate}
      records={displayPetRecords.filter((record) => record.date === selectedDate)}
      onBack={() => setDateDetailsOpen(false)}
      onOpenRecord={(record) => setSelectedRecordId(record.sourceIds?.[0] ?? record.id)}
      onDelete={(recordIds) => {
        const ids = Array.isArray(recordIds) ? recordIds : [recordIds]
        saveRecordList(records.filter((record) => !ids.includes(record.id)))
      }}
      onAddMemo={(memo) => {
        if (!selectedPet) return
        saveRecordList([{
          id: crypto.randomUUID(),
          userId,
          petId: selectedPet.id,
          type: 'other',
          date: selectedDate,
          memo,
          createdAt: new Date().toISOString(),
          status: 'manual',
        }, ...records])
      }}
    />
  }

  if (visualizationOpen) {
    return <DataVisualizationScreen records={petRecords} petName={selectedPet?.name ?? '펫'} onBack={() => setVisualizationOpen(false)} onCreateQna={selectedPet && onCreateQna ? () => onCreateQna(selectedPet.id) : undefined} />
  }

  return (
    <section className="diary-page">
      <div className={`diary-pet-bar ${!readOnly && pets.length > 1 ? 'has-menu' : 'single-pet'}`}>
        {!readOnly && pets.length > 1 && (
          <button className="diary-pet-menu-trigger" type="button" aria-label="펫 전환 메뉴 열기" aria-expanded={petMenuOpen} onClick={() => setPetMenuOpen(true)}>
            <span />
            <span />
            <span />
          </button>
        )}
        <div className="diary-pet-profile">
          <PetAvatar pet={selectedPet} />
          <span>
            <span className="diary-pet-name-line">
              <strong>{selectedPet?.name ?? '등록된 펫이 없어요'}</strong>
              {selectedPet && <GenderMark gender={selectedPet.gender} />}
            </span>
            {selectedPet ? (
              <>
                <small>{selectedPet.species || '종 미등록'}</small>
                <small>{formatPetMetrics(selectedPet) || '무게 · 나이 미입력'}</small>
              </>
            ) : <small>펫을 먼저 등록해 주세요</small>}
          </span>
        </div>
        <button className="diary-record-top-button diary-record-desktop-button" type="button" onClick={() => setVisualizationOpen(true)}>기록 모아보기</button>
      </div>
      {petMenuOpen && selectedPet && (
        <PetMenuDrawer
          currentPet={selectedPet}
          pets={pets}
          selectedPetId={effectivePetId}
          onClose={() => setPetMenuOpen(false)}
          onSelect={switchPet}
        />
      )}

      <DiaryNotice records={petRecords} />

      <DiaryInsightBanner records={petRecords} petName={selectedPet?.name ?? '펫'} onShedComplete={() => saveShedCheckRecord('탈피 완료')} onShedNotYet={() => saveShedCheckRecord('탈피 확인 · 완료 안됨')} />

      <div className="diary-content-shell">
        <div className="diary-main-flow">
          <div className="diary-view-toolbar">
            <div className="diary-mobile-tabs" role="tablist" aria-label="다이어리 보기">
              <button type="button" className={mobileView === 'plan' ? 'active' : ''} onClick={() => setMobileView('plan')}>플랜</button>
              <button type="button" className={mobileView === 'calendar' ? 'active' : ''} onClick={() => setMobileView('calendar')}>캘린더</button>
            </div>
          </div>

          <div className={`diary-workspace mobile-${mobileView}`}>
            <main className="diary-calendar-area">
              <Calendar
                month={visibleMonth}
                selectedDate={selectedDate}
                records={displayPetRecords}
                onMove={(amount) => setVisibleMonth(new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + amount, 1))}
                onSelect={(date) => { if (date === selectedDate) setDateDetailsOpen(true); else setSelectedDate(date) }}
              />
              <SelectedDateStatus date={selectedDate} records={displayPetRecords} />
            </main>
            <aside className="diary-detail-panel">
              {!readOnly && <DailyPlan pet={selectedPet} tasks={planReminders} selectedDate={selectedDate} hasCarePlans={petCarePlans.length > 0} onAddPlan={openReminderCreate} onEditPlan={(reminder) => { setEditingReminder(reminder); setRoutinePresetType(null); setReminderFormOpen(true) }} onDeletePlan={removePlan} onComplete={(item) => completePlan(item.reminder, item.dailyTask)} onUndo={(item) => undoPlan(item.reminder, item.dailyTask)} onSkip={(item) => skipPlan(item.dailyTask)} />}
              {!readOnly && <IncidentAddBar pet={selectedPet} disabled={selectedDate > today} onOpen={openSmartAdd} onOpenRoutine={openIncidentRoutine} />}
            </aside>
          </div>
        </div>
      </div>

      <div className="diary-record-mobile-row">
        <button className="diary-record-top-button diary-record-mobile-button" type="button" onClick={() => setVisualizationOpen(true)}>기록 모아보기</button>
      </div>

      {smartSheet && selectedPet && (
        <Overlay onClose={() => setSmartSheet(null)}>
          <SmartAddSheet
            kind={smartSheet}
            pet={selectedPet}
            recentFoods={recentFoods}
            matingPetCandidates={matingPetCandidates}
            matingOptions={matingOptions}
            foodKind={smartFoodKind}
            foodQuantity={smartFoodQuantity}
            foodUnit={smartFoodUnit}
            poopStatus={smartPoopStatus}
            shedStatus={smartShedStatus}
            matingFemaleId={smartMatingFemaleId}
            matingMaleId={smartMatingMaleId}
            eggMatingId={smartEggMatingId}
            onFoodKind={setSmartFoodKind}
            onFoodQuantity={setSmartFoodQuantity}
            onFoodUnit={setSmartFoodUnit}
            onPoopStatus={setSmartPoopStatus}
            onShedStatus={setSmartShedStatus}
            onMatingFemale={setSmartMatingFemaleId}
            onMatingMale={setSmartMatingMaleId}
            onEggMating={setSmartEggMatingId}
            onFoodSave={(food) => saveSmartFood(food)}
            onWaterSave={saveSmartWater}
            onCleaningSave={saveSmartCleaning}
            onPoopSave={saveSmartPoop}
            onShedSave={saveSmartShed}
            onMatingSave={saveSmartMating}
            onEggSave={saveSmartEgg}
          />
        </Overlay>
      )}
      {hospitalReviewPickerOpen && selectedPet && (
        <Overlay onClose={() => setHospitalReviewPickerOpen(false)}>
          <HospitalReviewPicker
            petName={selectedPet.name}
            reviews={selectedPetHospitalReviews}
            onSelect={openHospitalReviewRecord}
            onClose={() => setHospitalReviewPickerOpen(false)}
          />
        </Overlay>
      )}
      {feedingCompletion && selectedPet && (
        <Overlay onClose={closeFeedingCompletion}>
          <FeedingFoodDialog
            pet={selectedPet}
            speciesCareProfiles={speciesCareProfiles}
            selectedFoods={selectedFeedingFoods}
            customFoodName={customFeedingName}
            saving={feedingSaving}
            error={feedingError}
            onSelectedFoodsChange={(foods) => { setSelectedFeedingFoods(foods); setFeedingError('') }}
            onCustomFoodNameChange={(value) => { setCustomFeedingName(value); setFeedingError('') }}
            onCancel={closeFeedingCompletion}
            onComplete={completeFeedingPlan}
          />
        </Overlay>
      )}
      {environmentCompletion && selectedPet && (
        <Overlay onClose={closeEnvironmentCompletion}>
        <EnvironmentInputDialog
          pet={selectedPet}
          metricType={environmentCompletion.metricType}
          measurementType={environmentCompletion.measurementType}
          speciesCareProfiles={speciesCareProfiles}
          saving={environmentSaving}
          error={environmentError}
            onCancel={closeEnvironmentCompletion}
            onComplete={completeEnvironmentPlan}
          />
        </Overlay>
      )}
      {pendingSmartRecord && (
        <Overlay onClose={() => setPendingSmartRecord(null)}>
          <div className="smart-duplicate-dialog">
            <h2>방금 같은 기록을 저장했습니다.</h2>
            <p>한 번 더 기록할까요?</p>
            <div>
              <button type="button" onClick={() => setPendingSmartRecord(null)}>취소</button>
              <button type="button" onClick={() => { const next = pendingSmartRecord.record; setPendingSmartRecord(null); saveRecordList([next, ...records]); setSmartSheet(null); showSmartToast(pendingSmartRecord.message) }}>추가 기록</button>
            </div>
          </div>
        </Overlay>
      )}
      {petWarningOpen && (
        <Overlay onClose={() => setPetWarningOpen(false)}>
          <div className="warning-dialog">
            <h2>펫을 먼저 추가해 주세요</h2>
            <button onClick={onAddPet}>이동하기</button>
          </div>
        </Overlay>
      )}
      {smartToast && <div className="smart-toast" role="status">{smartToast}</div>}
    </section>
  )

  function markReminderCompleted(reminder: Reminder) {
    if (reminder.scheduleType === 'repeat') {
      const updated = { ...reminder, completedAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
      saveReminderList(reminders.map((item) => item.id === reminder.id ? updated : item))
      return
    }

    const updated = { ...reminder, isActive: false, completedAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
    saveReminderList(reminders.map((item) => item.id === reminder.id ? updated : item))
  }
}

function DailyPlan({
  pet,
  tasks,
  selectedDate,
  hasCarePlans,
  onAddPlan,
  onEditPlan,
  onDeletePlan,
  onComplete,
  onUndo,
  onSkip,
}: {
  pet?: DiaryPet
  tasks: Array<{ reminder: Reminder; overdue: boolean; dailyTask?: DailyTask }>
  selectedDate: string
  hasCarePlans: boolean
  onAddPlan: () => void
  onEditPlan: (reminder: Reminder) => void
  onDeletePlan: (id: string) => void
  onComplete: (task: { reminder: Reminder; overdue: boolean; dailyTask?: DailyTask }) => void
  onUndo: (task: { reminder: Reminder; overdue: boolean; dailyTask?: DailyTask }) => void
  onSkip: (task: { reminder: Reminder; overdue: boolean; dailyTask?: DailyTask }) => void
}) {
  const isFuture = selectedDate > toDateKey(new Date())
  const overdueTasks = tasks.filter((task) => task.overdue && (!task.dailyTask || task.dailyTask.status === 'pending'))
  const todayTasks = tasks.filter((task) => !task.overdue && task.dailyTask?.status !== 'skipped')
  const renderTask = (task: { reminder: Reminder; overdue: boolean; dailyTask?: DailyTask }) => {
    const { reminder, overdue, dailyTask } = task
    const checked = dailyTask?.status === 'completed' || reminder.completedAt?.slice(0, 10) === selectedDate
    const taskDescription = overdue
      ? `${dailyTask?.scheduledDate ?? '지난 일정'} · 밀린 할 일`
      : reminder.reminderType === 'medicine'
        ? `${dailyTask?.scheduledDate ?? selectedDate} · ${dailyTask?.occurrenceNo ?? 1}회차`
        : formatPlanDays(reminder)
    return <div className={`daily-plan-task-row ${overdue ? 'overdue' : ''}`} key={`${reminder.id}-${dailyTask?.id ?? selectedDate}`}>
      <div className="daily-plan-task">
        <span className="daily-plan-task-content">
          <span className="daily-plan-title-line">
            <strong>{planLabel(reminder, pet)}</strong>
            <details className="daily-task-menu">
              <summary aria-label={`${planLabel(reminder, pet)} 메뉴`} title="루틴 메뉴"><span className="menu-dots" aria-hidden="true"><span /><span /><span /></span></summary>
              <div>
                <button type="button" onClick={() => onEditPlan(reminder)}>수정</button>
                <button type="button" onClick={() => onDeletePlan(reminder.id)}>삭제</button>
              </div>
            </details>
          </span>
          {overdue && <small>{taskDescription}</small>}
        </span>
        <label className="daily-plan-check-wrap">
          <span className={`daily-plan-check ${checked ? 'checked' : ''}`} aria-hidden="true">{checked ? '✓' : ''}</span>
          <input className="daily-plan-check-input" type="checkbox" checked={checked} disabled={isFuture} onChange={() => checked ? onUndo(task) : onComplete(task)} aria-label={`${planLabel(reminder, pet)} ${checked ? '완료 취소' : '완료'}`} />
        </label>
      </div>
      {overdue && <div className="daily-plan-task-actions"><button type="button" onClick={() => checked ? onUndo(task) : onComplete(task)}>지금 완료</button><button type="button" onClick={() => onSkip(task)}>건너뛰기</button></div>}
    </div>
  }

  if (!hasCarePlans) {
    return (
      <section className="daily-plan-panel">
        <header><div><h2>오늘 할 일</h2><p>{formatDate(selectedDate)}</p></div><button type="button" onClick={onAddPlan}>루틴 추가</button></header>
        <div className="daily-plan-first-empty">
          <strong>아직 반복 일정이 없어요.</strong>
        </div>
      </section>
    )
  }

  return (
    <section className="daily-plan-panel">
      <header><div><h2>오늘 할 일</h2><p>{formatDate(selectedDate)}</p></div><button type="button" onClick={onAddPlan}>루틴 추가</button></header>
      {overdueTasks.length > 0 && <section className="daily-task-group overdue-group"><h3>밀린 할 일</h3><div className="daily-plan-list">{overdueTasks.map(renderTask)}</div></section>}
      <section className="daily-task-group today-task-group">{todayTasks.length ? <div className="daily-plan-list">{todayTasks.map(renderTask)}</div> : <p className="daily-plan-empty">오늘 예정된 일이 없어요.</p>}</section>
    </section>
  )
}

function PetMenuDrawer({
  currentPet,
  pets,
  selectedPetId,
  onClose,
  onSelect,
}: {
  currentPet: DiaryPet
  pets: DiaryPet[]
  selectedPetId: string
  onClose: () => void
  onSelect: (petId: string) => void
}) {
  return (
    <div className="diary-pet-menu-layer">
      <button className="diary-pet-menu-dim" type="button" aria-label="펫 전환 메뉴 닫기" onClick={onClose} />
      <aside className="diary-pet-menu" aria-label="다이어리 펫 전환 메뉴">
        <header>
          <PetAvatar pet={currentPet} />
          <div>
            <small>현재 선택된 펫: {currentPet.name}</small>
            <span className="diary-pet-name-line">
              <strong>{currentPet.name}</strong>
              <GenderMark gender={currentPet.gender} />
            </span>
            <p>{currentPet.species || '종 미등록'}{formatPetMetrics(currentPet) ? ` · ${formatPetMetrics(currentPet)}` : ''}</p>
          </div>
        </header>
        <nav aria-label="다른 펫으로 전환">
          {pets.map((pet) => {
            const selected = pet.id === selectedPetId
            return (
              <button type="button" className={selected ? 'active' : ''} aria-current={selected ? 'true' : undefined} key={pet.id} onClick={() => selected ? onClose() : onSelect(pet.id)}>
                <PetAvatar pet={pet} />
                <span className="diary-pet-name-line">
                  <strong>{pet.name}</strong>
                  <GenderMark gender={pet.gender} />
                </span>
                <small>{pet.species}</small>
              </button>
            )
          })}
        </nav>
      </aside>
    </div>
  )
}

function PetAvatar({ pet }: { pet?: DiaryPet }) {
  const image = pet ? pet.photo || defaultPetImage(pet.group) : ''
  return (
    <span className="diary-pet-avatar">
      {pet ? <img className={pet.photo ? '' : 'pet-default-image'} src={image} alt={pet.photo ? `${pet.name} 사진` : `${animalGroupLabel(pet.group)} 기본 이미지`} /> : '+'}
    </span>
  )
}

function GenderMark({ gender }: { gender: DiaryPet['gender'] }) {
  if (gender === 'male') return <span className="diary-gender-mark male" aria-label="수컷">♂</span>
  if (gender === 'female') return <span className="diary-gender-mark female" aria-label="암컷">♀</span>
  return null
}

function CarePlanPanel({
  plans,
  selectedPetId,
  onAdd,
  onEdit,
  onToggle,
  onDelete,
}: {
  plans: Reminder[]
  selectedPetId: string
  onAdd: () => void
  onEdit: (plan: Reminder) => void
  onToggle: (plan: Reminder) => void
  onDelete: (id: string) => void
}) {
  const petPlans = plans.filter((plan) => plan.petId === selectedPetId)
  return (
    <section className="care-plan-panel">
      <header><div><h2>반복 일정</h2><p>요일을 정해두면 오늘 할 일로 보여요.</p></div>{petPlans.length > 0 && <button type="button" onClick={onAdd}>루틴 추가</button>}</header>
      {petPlans.length ? <div className="care-plan-list">{petPlans.map((plan) => (
        <article className={!plan.isActive ? 'inactive' : ''} key={plan.id}>
          <div><strong>{planLabel(plan)}</strong><span>{formatPlanDays(plan)}</span></div>
          <details className="care-plan-menu">
            <summary aria-label={`${planLabel(plan)} 일정 메뉴`} title="일정 메뉴"><span className="menu-dots" aria-hidden="true"><span /><span /><span /></span></summary>
            <div>
              <button type="button" onClick={() => onToggle(plan)}>{plan.isActive ? '끄기' : '켜기'}</button>
              <button type="button" onClick={() => onEdit(plan)}>수정</button>
              <button type="button" onClick={() => onDelete(plan.id)}>삭제</button>
            </div>
          </details>
        </article>
      ))}</div> : <div className="care-plan-empty"><strong>아직 등록한 루틴이 없어요.</strong><span>먹이, 물그릇 교체, 청소 요일을 먼저 정해보세요.</span><button type="button" onClick={onAdd}>첫 루틴 만들기</button></div>}
    </section>
  )
}

void CarePlanPanel

function formatPlanDays(plan: Reminder) {
  if (plan.weekdays.length === 7) return '매일'
  return plan.weekdays.slice().sort((a, b) => a - b).map((day) => weekdays[day]).join(' · ') || '요일 미설정'
}

function animalGroupLabel(group: DiaryPet['group']) {
  if (group === 'reptile') return '파충류'
  if (group === 'rodent') return '설치류'
  if (group === 'amphibian') return '양서류'
  if (group === 'bird') return '조류'
  return '기타'
}

function normalizeSpecies(value?: string) {
  return (value ?? '').trim().toLowerCase().replace(/\s+/g, '')
}

function sameSpecies(a: DiaryPet, b: DiaryPet) {
  const aSpecies = normalizeSpecies(a.species)
  const bSpecies = normalizeSpecies(b.species)
  return Boolean(aSpecies && bSpecies && aSpecies === bSpecies)
}

function getMatingOptions(records: PetRecord[], pets: DiaryPet[], selectedPet?: DiaryPet): MatingOption[] {
  if (!selectedPet) return []
  const selectedSpecies = normalizeSpecies(selectedPet.species)
  return records
    .filter((record) => record.type === 'other' && record.memo?.startsWith('메이팅 · ') && pets.some((pet) => pet.id === record.petId && normalizeSpecies(pet.species) === selectedSpecies))
    .map((record) => {
      const memo = record.memo ?? ''
      const femaleName = memo.match(/암컷 ([^·]+)/)?.[1]?.trim() ?? '암컷'
      const maleName = memo.match(/수컷 ([^·]+)/)?.[1]?.trim() ?? '수컷'
      const species = memo.split('·').at(-1)?.trim() || selectedPet.species
      return {
        id: record.id,
        femaleName,
        maleName,
        species,
        label: `${formatDate(record.date)} · ${femaleName} × ${maleName}`,
      }
    })
}

function SelectedDateStatus({ date, records }: { date: string; records: PetRecord[] }) {
  const dayRecords = records.filter((record) => record.date === date)
  if (!dayRecords.length) return null
  return <section className="selected-date-status"><h2>{formatDate(date)}</h2><div>{dayRecords.map((record) => <span className="status-record" key={`record-${record.id}`}>{recordMeta[record.type].label} · {recordSummary(record)}</span>)}</div></section>
}

function planLabel(reminder: Reminder, pet?: DiaryPet, speciesProfiles: SpeciesCareProfile[] = fallbackSpeciesCareProfiles) {
  if (reminder.reminderType === 'medicine' || reminder.reminderType === 'hospital') return reminder.title || reminderMeta[reminder.reminderType].label
  if (reminder.reminderType === 'custom') return reminder.title || '직접 입력'
  if (reminder.reminderType === 'water_temperature') return '수온 확인'
  if (reminder.reminderType === 'temperature' && pet) {
    const profile = getEnvironmentProfile(pet, speciesProfiles)
    if (profile?.temperatureType === 'water') return '수온 확인'
  }
  return reminderMeta[reminder.reminderType]?.label ?? reminder.title ?? '관리'
}

function routineOptionLabel(type: ReminderType, pet?: DiaryPet, speciesProfiles: SpeciesCareProfile[] = fallbackSpeciesCareProfiles) {
  if (type === 'water_temperature') return '수온 확인'
  if (type === 'temperature' && pet) {
    const profile = getEnvironmentProfile(pet, speciesProfiles)
    if (profile?.temperatureType === 'water') return '수온 확인'
  }
  return reminderMeta[type]?.label ?? '관리'
}

function specialRoutineNameForReminder(reminder: Reminder | null) {
  if (!reminder) return ''
  if (reminder.reminderType === 'medicine') return reminder.title.split('약 · ').pop()?.trim() ?? '약 복용'
  if (reminder.reminderType === 'hospital') return reminder.title.split('진료 · ').pop()?.trim() ?? '진료'
  return ''
}

function isReminderVisibleForPet(reminder: Reminder, pet: DiaryPet, speciesProfiles: SpeciesCareProfile[] = fallbackSpeciesCareProfiles) {
  const profile = getEnvironmentProfile(pet, speciesProfiles)
  if (reminder.reminderType === 'humidity' && profile?.humidityEnabled === false) return false
  if (isFullyAquaticTurtlePet(pet) && (reminder.reminderType === 'humidity' || reminder.reminderType === 'temperature')) return false
  return true
}

function HospitalReviewPicker({
  petName,
  reviews,
  onSelect,
  onClose,
}: {
  petName: string
  reviews: HospitalReview[]
  onSelect: (review: HospitalReview) => void
  onClose: () => void
}) {
  return (
    <section className="hospital-review-picker" role="dialog" aria-modal="true" aria-labelledby="hospital-review-picker-title">
      <header>
        <div>
          <h2 id="hospital-review-picker-title">진료 기록</h2>
          <p>{petName}의 작성한 리뷰에서 불러옵니다.</p>
        </div>
        <button type="button" aria-label="진료 기록 닫기" onClick={onClose}>×</button>
      </header>
      {reviews.length > 0 ? (
        <div className="hospital-review-picker-list">
          {reviews.map((review) => {
            const hospitalName = review.hospitalName || review.hospitalSnapshot?.name || '병원 리뷰'
            return (
              <button key={review.id} type="button" onClick={() => onSelect(review)}>
                <span>
                  <strong>{hospitalName}</strong>
                  <small>{review.visitDate ?? review.createdAt.slice(0, 10)}</small>
                </span>
                <span>
                  {review.diagnosis && <small>{review.diagnosis}</small>}
                  {review.treatment && <small>{review.treatment}</small>}
                  {!review.diagnosis && !review.treatment && <small>{review.body}</small>}
                </span>
              </button>
            )
          })}
        </div>
      ) : (
        <p className="hospital-review-picker-empty">이 펫으로 작성한 진료 리뷰가 없어요.</p>
      )}
    </section>
  )
}

function IncidentAddBar({
  pet,
  disabled,
  onOpen,
  onOpenRoutine,
}: {
  pet?: DiaryPet
  disabled: boolean
  onOpen: (kind: SmartAddKind) => void
  onOpenRoutine: (kind: 'medicine' | 'hospital') => void
}) {
  const petGroup = pet?.group
  const showShed = (petGroup === 'reptile' || petGroup === 'amphibian') && !shouldHideShedForPet(pet)
  const recordItems: Array<{ kind: SmartAddKind; label: string; iconSrc: string }> = [
    { kind: 'poop', label: '배변', iconSrc: incidentIconSrc.poop ?? '' },
    ...(showShed ? [{ kind: 'shed' as const, label: '탈피', iconSrc: incidentIconSrc.shed ?? '' }] : []),
    ...((petGroup === 'reptile' || petGroup === 'amphibian') ? [
      { kind: 'mating' as const, label: '메이팅', iconSrc: incidentIconSrc.mating ?? '' },
      { kind: 'egg' as const, label: '산란', iconSrc: incidentIconSrc.egg ?? '' },
    ] : []),
  ]
  const routineItems: Array<{ kind: 'medicine' | 'hospital'; label: string; iconSrc: string }> = [
    { kind: 'medicine', label: '약', iconSrc: incidentIconSrc.medicine ?? '' },
    { kind: 'hospital', label: '진료', iconSrc: incidentIconSrc.hospital ?? '' },
  ]
  return <section className="incident-add-panel"><header><h2>상황별 기록</h2></header><div className="incident-add-actions">{recordItems.map((item) => <button type="button" disabled={disabled} key={item.kind} onClick={() => onOpen(item.kind)}>{item.iconSrc ? <img className="incident-add-icon" src={item.iconSrc} alt="" aria-hidden="true" /> : null}{item.label}</button>)}{routineItems.map((item) => <button type="button" key={item.kind} onClick={() => onOpenRoutine(item.kind)}>{item.iconSrc ? <img className="incident-add-icon" src={item.iconSrc} alt="" aria-hidden="true" /> : null}{item.label}</button>)}</div></section>
}

function SmartAddSheet({
  kind,
  pet,
  recentFoods,
  matingPetCandidates,
  matingOptions,
  foodKind,
  foodQuantity,
  foodUnit,
  poopStatus,
  shedStatus,
  matingFemaleId,
  matingMaleId,
  eggMatingId,
  onFoodKind,
  onFoodQuantity,
  onFoodUnit,
  onPoopStatus,
  onShedStatus,
  onMatingFemale,
  onMatingMale,
  onEggMating,
  onFoodSave,
  onWaterSave,
  onCleaningSave,
  onPoopSave,
  onShedSave,
  onMatingSave,
  onEggSave,
}: {
  kind: SmartAddKind
  pet: DiaryPet
  recentFoods: string[]
  matingPetCandidates: DiaryPet[]
  matingOptions: MatingOption[]
  foodKind: string
  foodQuantity: string
  foodUnit: string
  poopStatus: string
  shedStatus: string
  matingFemaleId: string
  matingMaleId: string
  eggMatingId: string
  onFoodKind: (value: string) => void
  onFoodQuantity: (value: string) => void
  onFoodUnit: (value: string) => void
  onPoopStatus: (value: string) => void
  onShedStatus: (value: string) => void
  onMatingFemale: (value: string) => void
  onMatingMale: (value: string) => void
  onEggMating: (value: string) => void
  onFoodSave: (value: string) => void
  onWaterSave: (value: string) => void
  onCleaningSave: (value: string) => void
  onPoopSave: (status: string) => void
  onShedSave: (status: string) => void
  onMatingSave: () => void
  onEggSave: () => void
}) {
  const foodOptions = ['밀웜', '귀뚜라미', '랩사료']
  const poopOptions = ['평범', '묽음', '딱딱']
  const shedOptions = ['탈피 시작', '탈피 완료', '이상 있음']
  const waterOptions = ['전체 교체', '일부 보충', '물그릇 세척']
  const cleaningOptions = ['부분 청소', '전체 청소', '바닥재 교체', '용품 세척']
  const foodValue = foodKind.trim() ? `${foodKind.trim()} ${foodQuantity || '1'}${foodUnit}` : ''
  const femaleCandidates = matingPetCandidates.filter((candidate) => candidate.gender === 'female')
  const maleCandidates = matingPetCandidates.filter((candidate) => candidate.gender === 'male')
  const matingReady = Boolean(matingFemaleId && matingMaleId && matingFemaleId !== matingMaleId)
  const eggReady = Boolean(eggMatingId)

  return (
    <div className="smart-add-sheet">
      <span className="sheet-handle" />
      <h2>{kind === 'food' ? '먹이 기록' : kind === 'poop' ? '배변 기록' : kind === 'shed' ? '탈피 기록' : kind === 'mating' ? '메이팅 기록' : kind === 'egg' ? '산란 기록' : kind === 'water' ? '물그릇 교체 기록' : '청소 기록'}</h2>
      <p className="smart-add-sheet-pet">{pet.name}</p>
      {kind === 'food' && (
        <>
          {recentFoods.length > 0 && <div className="smart-recent-section"><strong>최근에 준 먹이</strong><div className="smart-choice-list">{recentFoods.map((food) => <button type="button" key={food} onClick={() => onFoodSave(food)}>{food}</button>)}</div></div>}
          <div className="smart-recent-section"><strong>새 먹이 기록</strong><div className="smart-choice-list">{foodOptions.map((food) => <button type="button" className={foodKind === food ? 'selected' : ''} key={food} onClick={() => onFoodKind(food)}>{food}</button>)}<label className="smart-inline-input"><input value={foodKind === '밀웜' || foodKind === '귀뚜라미' || foodKind === '랩사료' ? '' : foodKind} onChange={(event) => onFoodKind(event.target.value)} placeholder="직접 입력" /></label></div></div>
          {foodKind && <div className="smart-quantity-row"><label>수량<input type="number" min="1" value={foodQuantity} onChange={(event) => onFoodQuantity(event.target.value)} /></label><div><strong>단위</strong><div className="smart-unit-list">{['마리', '개', 'g', '회'].map((unit) => <button type="button" className={foodUnit === unit ? 'selected' : ''} key={unit} onClick={() => onFoodUnit(unit)}>{unit}</button>)}</div></div></div>}
          {foodValue && <button className="smart-save-button" type="button" onClick={() => onFoodSave(foodValue)}>이 내용으로 기록</button>}
        </>
      )}
      {kind === 'poop' && <div className="smart-choice-list">{poopOptions.map((status) => <button type="button" className={poopStatus === status ? 'selected' : ''} key={status} onClick={() => { onPoopStatus(status); onPoopSave(status) }}>{status}</button>)}</div>}
      {kind === 'shed' && <div className="smart-choice-list">{shedOptions.map((status) => <button type="button" className={shedStatus === status ? 'selected' : ''} key={status} onClick={() => { onShedStatus(status); onShedSave(status) }}>{status}</button>)}</div>}
      {kind === 'mating' && (
        <div className="smart-pair-fields">
          <label>암컷<select value={matingFemaleId} onChange={(event) => onMatingFemale(event.target.value)}><option value="">선택</option>{femaleCandidates.map((candidate) => <option value={candidate.id} key={candidate.id}>{candidate.name} · {candidate.species}</option>)}</select></label>
          <label>수컷<select value={matingMaleId} onChange={(event) => onMatingMale(event.target.value)}><option value="">선택</option>{maleCandidates.map((candidate) => <option value={candidate.id} key={candidate.id}>{candidate.name} · {candidate.species}</option>)}</select></label>
          {(!femaleCandidates.length || !maleCandidates.length) && <p className="smart-empty">같은 종의 암컷과 수컷이 모두 있어야 기록할 수 있어요.</p>}
          {matingReady && <button className="smart-save-button" type="button" onClick={onMatingSave}>메이팅 기록</button>}
        </div>
      )}
      {kind === 'egg' && (
        <div className="smart-pair-fields">
          {matingOptions.length ? <div className="smart-choice-list">{matingOptions.map((option) => <button type="button" className={eggMatingId === option.id ? 'selected' : ''} key={option.id} onClick={() => onEggMating(option.id)}>{option.label}</button>)}</div> : <p className="smart-empty">먼저 같은 종 메이팅 기록을 남겨주세요.</p>}
          {eggReady && <button className="smart-save-button" type="button" onClick={onEggSave}>산란 기록</button>}
        </div>
      )}
      {kind === 'water' && <div className="smart-choice-list">{waterOptions.map((option) => <button type="button" key={option} onClick={() => onWaterSave(option)}>{option}</button>)}</div>}
      {kind === 'cleaning' && <div className="smart-choice-list">{cleaningOptions.map((option) => <button type="button" key={option} onClick={() => onCleaningSave(option)}>{option}</button>)}</div>}
    </div>
  )
}

function Calendar({
  month,
  selectedDate,
  records,
  onMove,
  onSelect,
}: {
  month: Date
  selectedDate: string
  records: PetRecord[]
  onMove: (amount: number) => void
  onSelect: (date: string) => void
}) {
  const days = useMemo(() => getCalendarDays(month), [month])
  const monthInputRef = useRef<HTMLInputElement>(null)
  const currentYear = month.getFullYear()
  const currentMonth = month.getMonth()
  const monthValue = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`
  const openNativeMonthPicker = () => {
    const input = monthInputRef.current
    if (!input) return
    if ('showPicker' in input && typeof input.showPicker === 'function') input.showPicker()
    else input.focus()
  }
  const changeMonth = (value: string) => {
    const [yearText, monthText] = value.split('-')
    const nextYear = Number(yearText)
    const nextMonth = Number(monthText) - 1
    if (!Number.isFinite(nextYear) || !Number.isFinite(nextMonth)) return
    onMove((nextYear - currentYear) * 12 + (nextMonth - currentMonth))
  }

  return (
    <section className="calendar-month">
      <header className="calendar-month-bar">
        <button className="calendar-nav-button" type="button" aria-label="이전 달" onClick={() => onMove(-1)}>‹</button>
        <div className="calendar-title-picker">
          <button type="button" className="calendar-title-button" onClick={openNativeMonthPicker}>
            {currentYear}년 {currentMonth + 1}월
          </button>
          <input
            ref={monthInputRef}
            className="calendar-native-month-input"
            type="month"
            value={monthValue}
            aria-label="연도와 월 선택"
            onChange={(event) => changeMonth(event.target.value)}
          />
        </div>
        <button className="calendar-nav-button" type="button" aria-label="다음 달" onClick={() => onMove(1)}>›</button>
      </header>
      <div className="calendar-weekdays">{weekdays.map((day) => <span key={day}>{day}</span>)}</div>
      <div className="calendar-days">
        {days.map((day) => {
          const key = toDateKey(day)
          const dayRecords = records.filter((record) => record.date === key)
          const calendarItems = dayRecords
            .map((record) => ({ id: record.id, ...calendarRecordTag(record) }))
            .filter((item, index, items) => index === items.findIndex((value) => value.label === item.label))
          const compactSize = calendarItems.length > 7 ? 'tiny' : calendarItems.length > 4 ? 'compact' : ''
          return (
            <button
              key={key}
              className={`calendar-day ${key === selectedDate ? 'selected' : ''} ${day.getMonth() !== month.getMonth() ? 'muted' : ''}`}
              onClick={() => onSelect(key)}
            >
              <span className="day-head">
                <span className="day-number">{day.getDate()}</span>
              </span>
              <span className="calendar-tags" aria-label={`${dayRecords.length} records`}>
                {calendarItems.map((item) => (
                  <small className={`calendar-tag ${item.className} ${compactSize}`} key={item.id}>
                    {item.iconSrc ? <img src={item.iconSrc} alt="" aria-hidden="true" /> : item.icon ? <i>{item.icon}</i> : null}
                    <b>{item.label}</b>
                  </small>
                ))}
              </span>
            </button>
          )
        })}
      </div>
    </section>
  )
}
function RecordDetailScreen({
  record,
  pet,
  readOnly,
  onBack,
  onDelete,
}: {
  record: PetRecord
  pet?: DiaryPet
  readOnly?: boolean
  onBack: () => void
  onDelete: () => void
}) {
  return (
    <main className="diary-create-screen record-detail-screen">
      <header>
        <button type="button" aria-label="뒤로가기" onClick={onBack}>←</button>
        <strong>상세 보기</strong>
        <span />
      </header>
      <section className="record-detail-view">
        <div className="record-detail-title">
          <span>{recordMeta[record.type].icon}</span>
          <div>
            <h1>{recordMeta[record.type].label}</h1>
            <p>{pet?.name ?? '펫 없음'} · {formatDate(record.date)}</p>
          </div>
        </div>

        <dl className="record-detail-list">
          <div><dt>종류</dt><dd>{recordMeta[record.type].label}</dd></div>
          <div><dt>날짜</dt><dd>{formatDate(record.date)}</dd></div>
          {record.type === 'weight' && record.weight !== undefined && <div><dt>무게</dt><dd>{formatWeightValue(record.weight)}g</dd></div>}
          {getRecordFoodNames(record).length ? <div><dt>먹이</dt><dd>{getRecordFoodNames(record).join(' · ')}</dd></div> : null}
          {record.environmentRecord && (
            <>
              <div><dt>{getEnvironmentRecordTitle(record.environmentRecord)}</dt><dd>{formatEnvironmentValue(record.environmentRecord)}</dd></div>
              <div><dt>권장 범위</dt><dd>{formatEnvironmentRange(record.environmentRecord)}</dd></div>
              <div><dt>위험 단계</dt><dd>{record.environmentRecord.riskLevel === 0 ? '정상' : `${record.environmentRecord.riskLevel}단계 · ${environmentRiskLabel(record.environmentRecord.riskLevel)}`}</dd></div>
              <div><dt>안내</dt><dd>{record.environmentRecord.riskMessage}</dd></div>
              {record.occurredAt && <div><dt>기록 시간</dt><dd>{new Date(record.occurredAt).toLocaleString('ko-KR')}</dd></div>}
            </>
          )}
          {record.memo && <div><dt>메모</dt><dd>{record.memo}</dd></div>}
        </dl>
        {record.environmentRecord && <EnvironmentRiskGauge result={{ level: record.environmentRecord.riskLevel, direction: record.environmentRecord.riskDirection, message: record.environmentRecord.riskMessage }} />}

        {record.photoUrl && <div className="record-detail-photo"><img src={record.photoUrl} alt="" /></div>}
        {!readOnly && <button className="record-detail-delete" type="button" onClick={onDelete}>삭제</button>}
      </section>
    </main>
  )
}

function createRecordDraftInitialValue(type: PetRecordType, pet: DiaryPet): RecordDraft {
  return {
    type,
    foods: [],
    customFood: '',
    weight: type === 'weight' ? getPetWeightInGrams(pet) : '',
    status: '',
    hospital: '',
    memo: '',
  }
}

function createRoutineRecordDraft(type: PetRecordType, pet: DiaryPet, reminder: Reminder): RecordDraft {
  const base = createRecordDraftInitialValue(type, pet)
  const label = planLabel(reminder)
  if (type === 'food') return { ...base, customFood: label === '먹이 주기' ? '' : label }
  if (type === 'weight') return base
  if (type === 'cleaning') return { ...base, status: label }
  return { ...base, hospital: label, status: label }
}

function useWritingBrowserBack(step: number, onBack: () => void, onStepChange?: (step: number) => void) {
  const stepRef = useRef(step)
  const backRef = useRef(onBack)
  const changeRef = useRef(onStepChange)
  useEffect(() => {
    stepRef.current = step
    backRef.current = onBack
    changeRef.current = onStepChange
  }, [onBack, onStepChange, step])
  useEffect(() => {
    window.history.pushState({ exoPetDiaryCreate: true }, '', window.location.href)
    const handleBack = () => {
      if (stepRef.current > 0) {
        const previousStep = stepRef.current - 1
        stepRef.current = previousStep
        changeRef.current?.(previousStep)
        window.history.pushState({ exoPetDiaryCreate: true, step: previousStep }, '', window.location.href)
      } else {
        backRef.current()
      }
    }
    window.addEventListener('popstate', handleBack)
    return () => window.removeEventListener('popstate', handleBack)
  }, [])
}

function RecordCreateScreen({
  pet,
  type,
  date,
  initialDraft,
  onBack,
  onSave,
}: {
  pet: DiaryPet
  type: PetRecordType
  date: string
  initialDraft?: RecordDraft
  onBack: () => void
  onSave: (draft: RecordDraft) => void
}) {
  const steps = ['detail', 'photo']
  const [step, setStep] = useState(initialDraft?.step ?? 0)
  const [draft, setDraft] = useState<RecordDraft>(initialDraft ?? createRecordDraftInitialValue(type, pet))
  useWritingBrowserBack(step, onBack, setStep)
  const current = steps[step]
  const update = (patch: Partial<RecordDraft>) => setDraft((value) => ({ ...value, ...patch }))
  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (step < steps.length - 1) setStep(step + 1)
    else onSave(draft)
  }
  return (
    <main className="diary-create-screen">
      <header>
        <button type="button" aria-label="뒤로가기" onClick={() => step ? setStep(step - 1) : onBack()}>←</button>
        <strong>기록</strong>
        <span />
      </header>
      <form onSubmit={submit}>
        <StepProgress currentStep={step} stepCount={steps.length} onStepChange={setStep} />
        <p className="create-keyword" aria-label="작성 키워드">기록</p>
        <div className="create-title">
          <h1>{recordMeta[type].icon} {recordMeta[type].label}</h1>
          <p>{pet.name} · {date} · {step + 1}/{steps.length}</p>
        </div>
        <div className="create-content">
          {current === 'detail' && <RecordDetail draft={draft} update={update} />}
          {current === 'photo' && <PhotoPicker value={draft.photo} onChange={(photo) => update({ photo })} />}
        </div>
        <div className="step-actions">
          <button type="button" className="create-submit secondary diary-step-back" onClick={() => step ? setStep(step - 1) : onBack()} disabled={step === 0}>이전</button>
          <button className="create-submit" disabled={current === 'detail' && !validateDetail(draft)}>{step === steps.length - 1 ? '작성 완료' : '다음'}</button>
        </div>
      </form>
    </main>
  )
}

function RecordDetail({ draft, update }: { draft: RecordDraft; update: (patch: Partial<RecordDraft>) => void }) {
  if (draft.type === 'food') return <ChoiceField label="먹이 종류" options={['귀뚜라미', '밀웜', '채소', '사료', '기타']} values={draft.foods} multiple onChange={(foods) => update({ foods })} custom={draft.customFood} onCustom={(customFood) => update({ customFood })} />
  if (draft.type === 'weight') return <WeightField value={draft.weight} onChange={(weight) => update({ weight })} />
  if (draft.type === 'shed') return <ChoiceField label="탈피 상태를 선택하세요" options={['탈피 시작', '탈피 완료', '이상 있음', '기타']} values={[draft.status]} onChange={([status]) => update({ status })} />
  if (draft.type === 'poop') return <ChoiceField label="배변 상태를 선택하세요" options={['평범', '묽음', '딱딱']} values={[draft.status]} onChange={([status]) => update({ status })} />
  if (draft.type === 'cleaning') return <ChoiceField label="청소 범위를 선택하세요" options={['전체 청소', '부분 청소', '물그릇', '바닥재', '기타']} values={[draft.status]} onChange={([status]) => update({ status })} />
  if (draft.type === 'hospital') return <label>병원<input value={draft.hospital} onChange={(event) => update({ hospital: event.target.value })} placeholder="병원 이름" /></label>
  if (draft.hospital === 'UVB 확인') return <ChoiceField label="UVB 상태를 선택하세요" options={['정상', '고장']} values={[draft.status]} onChange={([status]) => update({ status })} />
  return <label>기록 내용<input value={draft.hospital} onChange={(event) => update({ hospital: event.target.value })} placeholder="확인한 값이나 상태를 짧게 입력" /></label>
}

function WeightField({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const adjust = (amount: number) => {
    const current = Number(value || 0)
    const next = Math.max(0, Math.round((current + amount) * 10) / 10)
    onChange(formatWeightValue(next))
  }

  return (
    <div className="weight-step-field">
      <label>무게<input type="number" min="0" step="0.1" value={value} onChange={(event) => onChange(event.target.value)} placeholder="g" /></label>
      <div className="weight-step-buttons" aria-label="무게 빠른 조절">
        <button type="button" onClick={() => adjust(-1)}>-1g</button>
        <button type="button" onClick={() => adjust(-0.1)}>-0.1g</button>
        <button type="button" onClick={() => adjust(0.1)}>+0.1g</button>
        <button type="button" onClick={() => adjust(1)}>+1g</button>
      </div>
    </div>
  )
}

function ReminderCreateScreen({
  pets,
  selectedPetId,
  existingReminders,
  initialReminder,
  presetType,
  speciesCareProfiles,
  onBack,
  onSave,
}: {
  pets: DiaryPet[]
  selectedPetId: string
  existingReminders: Reminder[]
  initialReminder: Reminder | null
  presetType: ReminderType | null
  speciesCareProfiles: SpeciesCareProfile[]
  onBack: () => void
  onSave: (reminders: Reminder[]) => void
}) {
  const petId = initialReminder?.petId ?? selectedPetId ?? pets[0]?.id ?? ''
  const selectedPet = pets.find((pet) => pet.id === petId)
  const recommendedTypes = routineRecommendationsForPet(selectedPet, speciesCareProfiles)
  const existingTypes = new Set(existingReminders
    .filter((reminder) => reminder.petId === petId && reminder.isActive && reminder.id !== initialReminder?.id && reminder.reminderType !== 'custom')
    .map((reminder) => reminder.reminderType))
  const initialType = initialReminder?.reminderType ?? presetType
  const [routineTypes, setRoutineTypes] = useState<ReminderType[]>(initialType ? [initialType] : [])
  const [selectedWeekdays, setSelectedWeekdays] = useState<number[]>(initialReminder?.weekdays ?? [])
  const [startDate] = useState(initialReminder?.startDate ?? initialReminder?.reminderDate ?? toDateKey(new Date()))
  const [endDate, setEndDate] = useState(initialReminder?.endDate ?? '')
  const [notificationTime, setNotificationTime] = useState(initialReminder?.reminderTime || '09:00')
  const [customRoutineName, setCustomRoutineName] = useState(initialReminder?.reminderType === 'custom' ? initialReminder.title.replace(selectedPet?.name ?? '', '').trim() : '')
  const [specialRoutineName, setSpecialRoutineName] = useState(() => {
    if (!initialReminder || (initialReminder.reminderType !== 'medicine' && initialReminder.reminderType !== 'hospital')) return ''
    return initialReminder.title
      .replace(selectedPet?.name ?? '', '')
      .replace(initialReminder.reminderType === 'medicine' ? /^약\s*·?\s*/ : /^진료\s*·?\s*/, '')
      .trim()
  })
  const [appointmentDate, setAppointmentDate] = useState(initialReminder?.startDate ?? initialReminder?.reminderDate ?? toDateKey(new Date()))
  const isEditingRoutine = Boolean(initialReminder)
  const isMedicineRoutine = routineTypes.length === 1 && routineTypes[0] === 'medicine'
  const isHospitalRoutine = routineTypes.length === 1 && routineTypes[0] === 'hospital'
  useWritingBrowserBack(0, onBack)
  const visibleRoutineTypes = recommendedTypes.filter((type) => type !== 'custom')
  const customDisplayedTypes: ReminderType[] = ['custom']
  const hasCustomRoutine = routineTypes.includes('custom')
  const customRoutineExists = hasCustomRoutine && existingReminders.some((reminder) => reminder.petId === petId && reminder.isActive && reminder.id !== initialReminder?.id && reminder.reminderType === 'custom' && planLabel(reminder, selectedPet, speciesCareProfiles) === customRoutineName.trim())
  const valid = Boolean(
    petId
    && routineTypes.length > 0
    && (isHospitalRoutine ? appointmentDate : selectedWeekdays.length > 0)
    && startDate
    && (!endDate || endDate >= startDate)
    && (!isMedicineRoutine || Boolean(endDate))
    && (!hasCustomRoutine || (customRoutineName.trim().length > 0 && !customRoutineExists))
    && (isEditingRoutine || (!isMedicineRoutine && !isHospitalRoutine) || specialRoutineName.trim().length > 0)
  )
  const toggleRoutineType = (type: ReminderType) => {
    if (initialReminder) {
      if (!existingTypes.has(type)) setRoutineTypes([type])
      return
    }
    if (existingTypes.has(type)) return
    setRoutineTypes((current) => current.includes(type) ? current.filter((item) => item !== type) : [...current, type])
  }
  const buildReminder = (reminderType: ReminderType, index = 0): Reminder => {
    const specialName = specialRoutineName.trim()
    const isHospital = reminderType === 'hospital'
    const reminderStartDate = isHospital ? appointmentDate : startDate
    return {
    id: initialReminder && index === 0 ? initialReminder.id : crypto.randomUUID(),
    petId,
    title: reminderType === 'custom'
      ? customRoutineName.trim()
      : reminderType === 'medicine'
        ? `약 · ${specialName || specialRoutineNameForReminder(initialReminder)}`.trim()
        : reminderType === 'hospital'
          ? `진료 · ${specialName || specialRoutineNameForReminder(initialReminder)}`.trim()
          : `${selectedPet?.name ?? ''} ${routineOptionLabel(reminderType, selectedPet, speciesCareProfiles)}`.trim(),
    reminderType,
    scheduleType: 'repeat',
    weekdays: isHospital ? [parseDateKey(appointmentDate).getDay()] : selectedWeekdays,
    startDate: reminderStartDate,
    endDate: isHospital ? appointmentDate : endDate || undefined,
    reminderDate: '',
    reminderTime: notificationTime,
    memo: '',
    isActive: true,
    createdAt: initialReminder && index === 0 ? initialReminder.createdAt : new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    completedAt: initialReminder && index === 0 ? initialReminder.completedAt : undefined,
  }}
  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (!valid) return
    onSave(routineTypes.map((type, index) => buildReminder(type, index)))
  }
  return (
    <main className="diary-create-screen">
      <header>
        <button type="button" aria-label="뒤로가기" onClick={onBack}>←</button>
        <strong>관리 루틴</strong>
        <span />
      </header>
      <form onSubmit={submit}>
        <p className="create-keyword" aria-label="작성 키워드">루틴</p>
        <div className="create-title">
          <h1>{initialReminder ? '루틴 수정' : '루틴 설정'}</h1>
        </div>
        <div className="create-content">
          <p className="selected-pet-inline">대상 펫: <strong>{selectedPet?.name ?? '현재 펫'}</strong>{selectedPet && <span> · {selectedPet.species}</span>}</p>
          {isEditingRoutine ? (
            <div className="routine-edit-summary" aria-label="수정 중인 루틴">
              <span>수정 중인 루틴</span>
              <strong>{initialReminder ? planLabel(initialReminder, selectedPet, speciesCareProfiles) : '루틴'}</strong>
            </div>
          ) : (
            !presetType && <div className="routine-recommendation-field">
              <label className="required-label">{selectedPet ? `${selectedPet.species || animalGroupLabel(selectedPet.group)} 추천 루틴` : '관리 항목'}<span aria-hidden="true">*</span></label>
              <div className="routine-tag-section">
                <div>
                  {visibleRoutineTypes.map((key) => (
                    <button type="button" className={routineTypes.includes(key) ? 'selected' : ''} disabled={existingTypes.has(key)} key={key} onClick={() => toggleRoutineType(key)}>
                      <strong>{routineOptionLabel(key, selectedPet, speciesCareProfiles)}</strong>
                      {existingTypes.has(key) && <em>이미 있음</em>}
                    </button>
                  ))}
                </div>
              </div>
              <div className="routine-tag-section">
                <div>
                  {customDisplayedTypes.map((key) => (
                    <button type="button" className={routineTypes.includes(key) ? 'selected' : ''} key={key} onClick={() => toggleRoutineType(key)}>
                      <strong>{routineOptionLabel(key, selectedPet, speciesCareProfiles)}</strong>
                    </button>
                  ))}
                </div>
              </div>
              {hasCustomRoutine && <label className="custom-routine-name-field">루틴 이름<input value={customRoutineName} onChange={(event) => setCustomRoutineName(event.target.value)} placeholder="예: 환기하기" /></label>}
              {customRoutineExists && <p className="routine-field-error">이미 같은 이름의 직접 입력 루틴이 있어요.</p>}
            </div>
          )}
          {!isEditingRoutine && isMedicineRoutine && <label className="required-label">약 이름<span aria-hidden="true">*</span><input value={specialRoutineName} onChange={(event) => setSpecialRoutineName(event.target.value)} placeholder="예: 처방약 A" autoFocus /></label>}
          {!isEditingRoutine && isHospitalRoutine && <label className="required-label">진료 일정 이름<span aria-hidden="true">*</span><input value={specialRoutineName} onChange={(event) => setSpecialRoutineName(event.target.value)} placeholder="예: 정기 검진" autoFocus /></label>}
          {isHospitalRoutine ? (
            <label className="required-label">다음 진료 예정일<span aria-hidden="true">*</span><input type="date" min={toDateKey(new Date())} value={appointmentDate} onChange={(event) => setAppointmentDate(event.target.value)} /></label>
          ) : (
            <>
              <label className="required-label">반복 요일<span aria-hidden="true">*</span></label>
              <div className="weekday-picker">
                {weekdays.map((day, index) => (
                  <button type="button" className={selectedWeekdays.includes(index) ? 'selected' : ''} onClick={() => setSelectedWeekdays(selectedWeekdays.includes(index) ? selectedWeekdays.filter((item) => item !== index) : [...selectedWeekdays, index])} key={day}>{day}</button>
                ))}
                <button type="button" className={selectedWeekdays.length === 7 ? 'selected' : ''} onClick={() => setSelectedWeekdays(selectedWeekdays.length === 7 ? [] : [0, 1, 2, 3, 4, 5, 6])}>매일</button>
              </div>
            </>
          )}
          <label className="routine-notification-time-field">부재 시 알람 시간<input type="time" value={notificationTime} onChange={(event) => setNotificationTime(event.target.value)} /></label>
          {!isHospitalRoutine && <label className={isMedicineRoutine ? 'required-label' : undefined}>종료일 {isMedicineRoutine ? <span aria-hidden="true">*</span> : '(선택)'}<input type="date" value={endDate} min={startDate} onChange={(event) => setEndDate(event.target.value)} /></label>}
        </div>
        <div className="step-actions">
          <button type="button" className="create-submit secondary diary-step-back" onClick={onBack}>이전</button>
          <button className="create-submit" disabled={!valid}>저장</button>
        </div>
      </form>
    </main>
  )
}

function StepProgress({ currentStep, stepCount, onStepChange }: { currentStep: number; stepCount: number; onStepChange: (step: number) => void }) {
  return (
    <div className="step-progress step-progress-selectable" role="tablist" aria-label="작성 단계">
      <span className="step-progress-fill" style={{ width: `${((currentStep + 1) / stepCount) * 100}%` }} />
      {Array.from({ length: stepCount }, (_, index) => (
        <button key={index} className={index === currentStep ? 'active' : ''} type="button" role="tab" aria-selected={index === currentStep} aria-label={`${index + 1}단계`} onClick={() => onStepChange(index)}>
          <span>{index + 1}</span>
        </button>
      ))}
    </div>
  )
}

function ChoiceField({
  label,
  options,
  labels,
  values,
  onChange,
  multiple = false,
  custom,
  onCustom,
}: {
  label: string
  options: string[]
  labels?: Record<string, string>
  values: string[]
  onChange: (values: string[]) => void
  multiple?: boolean
  custom?: string
  onCustom?: (value: string) => void
}) {
  return (
    <div className="choice-field">
      <label>{label}</label>
      <div>
        {options.map((option) => (
          <button type="button" className={values.includes(option) ? 'selected' : ''} onClick={() => onChange(multiple ? values.includes(option) ? values.filter((item) => item !== option) : [...values, option] : [option])} key={option}>{labels?.[option] ?? option}</button>
        ))}
      </div>
      {onCustom && <input value={custom} onChange={(event) => onCustom(event.target.value)} placeholder="직접 입력" />}
    </div>
  )
}

function PhotoPicker({ value, onChange }: { value?: string; onChange: (value?: string) => void }) {
  const choose = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/') || file.size > 8 * 1024 * 1024) return
    const reader = new FileReader()
    reader.onload = () => onChange(typeof reader.result === 'string' ? reader.result : undefined)
    reader.readAsDataURL(file)
  }
  return (
    <label className="photo-picker">
      사진
      <span>
        <b>{value ? '사진 선택됨' : '사진 선택'}</b>
        <input type="file" accept="image/*" onChange={choose} />
      </span>
    </label>
  )
}

function DateRecordsScreen({ date, records, onBack, onOpenRecord, onDelete, onAddMemo }: { date: string; records: DisplayPetRecord[]; onBack: () => void; onOpenRecord: (record: DisplayPetRecord) => void; onDelete: (id: string | string[]) => void; onAddMemo: (memo: string) => void }) {
  const [memo, setMemo] = useState('')
  const saveMemo = () => {
    const nextMemo = memo.trim()
    if (!nextMemo) return
    onAddMemo(nextMemo)
    setMemo('')
  }

  return <main className="diary-create-screen date-records-screen"><header><button type="button" aria-label="뒤로가기" onClick={onBack}>←</button><strong>{formatDate(date)} 기록</strong><span /></header><section className="date-records-content">{records.length ? records.map((record) => {
    const tag = calendarRecordTag(record)
    return <article key={record.id}><button type="button" onClick={() => onOpenRecord(record)}><span className="selected-date-record-icon">{tag.iconSrc ? <img src={tag.iconSrc} alt="" /> : tag.icon}</span><span><strong>{tag.label}</strong><small>{recordSummary(record)}</small></span></button><button type="button" aria-label="기록 삭제" onClick={() => onDelete(record.sourceIds ?? record.id)}>×</button></article>
  }) : <p>이 날짜에 작성된 기록이 없어요.</p>}</section><section className="date-memo-composer"><label>메모<textarea value={memo} onChange={(event) => setMemo(event.target.value)} placeholder="이 날짜에 남길 메모" /></label><button type="button" disabled={!memo.trim()} onClick={saveMemo}>메모 추가</button></section></main>
}

function DiaryNotice({ records }: { records: PetRecord[] }) {
  const notice = buildDiaryNotice(records)
  return <p className="diary-notice-line"><strong>NOTICE</strong>{notice.stage ? <b className={`notice-stage stage-${notice.stage}`}>{notice.stage}단계</b> : null}<span>{notice.message}</span></p>
}

function DiaryInsightBanner({
  records,
  petName,
  onShedComplete,
  onShedNotYet,
}: {
  records: PetRecord[]
  petName: string
  onShedComplete?: () => void
  onShedNotYet?: () => void
}) {
  const insights = buildDiaryInsights(records, petName)
  if (insights.length === 0) return null
  return (
    <section className="diary-insight-banner" aria-label="다이어리 경고와 변화">
      {insights.map((insight) => (
        <article className={`diary-insight-card ${insight.level}`} key={insight.id}>
          <small>{insightLabel(insight.metric)}</small>
          <strong>{insight.title}</strong>
          <span>{insight.body}</span>
          {insight.action === 'shed-check' && onShedComplete && onShedNotYet && (
            <div className="diary-insight-actions" aria-label="탈피 완료 확인">
              <button type="button" onClick={onShedComplete}>예</button>
              <button type="button" onClick={onShedNotYet}>아니요</button>
            </div>
          )}
        </article>
      ))}
    </section>
  )
}

function DataVisualization({ records, petName, onCreateQna }: { records: PetRecord[]; petName: string; onCreateQna?: () => void }) {
  const [activeMetric, setActiveMetric] = useState<'shed' | 'environment' | 'weight' | 'poop'>('shed')
  const environmentRecords = records
    .filter((record) => record.environmentRecord)
    .slice()
    .sort((a, b) => `${a.date}${a.occurredAt ?? a.createdAt}`.localeCompare(`${b.date}${b.occurredAt ?? b.createdAt}`))
  const temperatureRecords = environmentRecords.filter((record) => record.environmentRecord?.metricType === 'temperature')
  const humidityRecords = environmentRecords.filter((record) => record.environmentRecord?.metricType === 'humidity')
  const weightRecords = records.filter((record) => record.type === 'weight' && record.weight !== undefined).sort(compareRecordTime)
  const shedRecords = records.filter((record) => record.type === 'shed').sort(compareRecordTime)
  const displayShedRecords = collapseShedRecordsForDisplay(shedRecords).filter((record) => record.type === 'shed')
  const poopRecords = records.filter((record) => record.type === 'poop').sort(compareRecordTime)
  const hasAnyData = environmentRecords.length > 0 || weightRecords.length > 0 || displayShedRecords.length > 0 || poopRecords.length > 0
  if (!hasAnyData) return <div className="data-visualization"><DataVisualizationHeader petName={petName} onCreateQna={onCreateQna} /><div className="data-visualization-empty">아직 모아볼 기록이 없어요.</div></div>
  const metricCounts = {
    shed: displayShedRecords.length,
    environment: environmentRecords.length,
    weight: weightRecords.length,
    poop: poopRecords.length,
  }
  const firstAvailableMetric = (Object.keys(metricCounts) as Array<keyof typeof metricCounts>).find((metric) => metricCounts[metric] > 0) ?? 'shed'
  const selectedMetric = metricCounts[activeMetric] > 0 ? activeMetric : firstAvailableMetric
  return (
    <div className="data-visualization">
      <DataVisualizationHeader petName={petName} onCreateQna={onCreateQna} />
      <DiaryInsightBanner records={records} petName={petName} />
      <div className="record-collection-tabs" aria-label="모아보기 항목">
        <button className={selectedMetric === 'shed' ? 'active' : ''} type="button" onClick={() => setActiveMetric('shed')}>탈피 <span>{metricCounts.shed}</span></button>
        <button className={selectedMetric === 'environment' ? 'active' : ''} type="button" onClick={() => setActiveMetric('environment')}>온습도 <span>{metricCounts.environment}</span></button>
        <button className={selectedMetric === 'weight' ? 'active' : ''} type="button" onClick={() => setActiveMetric('weight')}>체중 <span>{metricCounts.weight}</span></button>
        <button className={selectedMetric === 'poop' ? 'active' : ''} type="button" onClick={() => setActiveMetric('poop')}>배변 <span>{metricCounts.poop}</span></button>
      </div>
      {selectedMetric === 'shed' && (shedRecords.length > 0 ? <ShedCycleChart records={shedRecords} /> : <MetricEmpty label="탈피 기록" />)}
      {selectedMetric === 'environment' && (
        temperatureRecords.length || humidityRecords.length
          ? <>{temperatureRecords.length > 0 && <EnvironmentLineChart title="온도·수온 변화" records={temperatureRecords} />}{humidityRecords.length > 0 && <EnvironmentLineChart title="습도 변화" records={humidityRecords} />}</>
          : <MetricEmpty label="온습도 기록" />
      )}
      {selectedMetric === 'weight' && (weightRecords.length > 0 ? <WeightLineChart records={weightRecords} /> : <MetricEmpty label="체중 기록" />)}
      {selectedMetric === 'poop' && (poopRecords.length > 0 ? <PoopStatusChart records={poopRecords} /> : <MetricEmpty label="배변 기록" />)}
    </div>
  )
}

function DataVisualizationHeader({ petName, onCreateQna }: { petName: string; onCreateQna?: () => void }) {
  return (
    <header className="data-visualization-heading">
      <div><h2>{petName} 기록 모아보기</h2></div>
      {onCreateQna && <button className="record-collection-qna" type="button" onClick={onCreateQna}>Q&A 작성하기</button>}
    </header>
  )
}

function MetricEmpty({ label }: { label: string }) {
  return <div className="data-visualization-empty">{label}이 아직 없어요.</div>
}

function buildDiaryInsights(records: PetRecord[], petName: string): DiaryInsight[] {
  const insights = [
    buildWeightInsight(records, petName),
    buildEnvironmentInsight(records, petName),
    buildShedInsight(records, petName),
    buildPoopInsight(records, petName),
  ].filter((value): value is DiaryInsight => Boolean(value))
  const priority: Record<DiaryInsightLevel, number> = { urgent: 0, caution: 1, notice: 2, normal: 3 }
  return insights.sort((a, b) => priority[a.level] - priority[b.level]).slice(0, 3)
}

function buildDiaryNotice(records: PetRecord[]): { message: string; stage?: RiskLevel } {
  const stagedInsight = buildDiaryInsights(records, '펫').find((insight) => {
    const stage = noticeStageFromTitle(insight.title)
    return stage !== undefined && stage > 0
  })
  if (stagedInsight) {
    return {
      message: stagedInsight.body,
      stage: noticeStageFromTitle(stagedInsight.title),
    }
  }
  const sortedRecords = records.slice().sort(compareRecordTime)
  const foodRecord = sortedRecords.filter((record) => record.type === 'food').at(-1)
  if (foodRecord) return { message: elapsedNotice('마지막 먹이 급여', foodRecord.date) }
  const poopRecord = sortedRecords.filter((record) => record.type === 'poop').at(-1)
  if (poopRecord) return { message: elapsedNotice('마지막 배변 기록', poopRecord.date) }
  const shedRecord = sortedRecords.filter((record) => record.type === 'shed').at(-1)
  if (shedRecord) return { message: elapsedNotice('마지막 탈피 기록', shedRecord.date) }
  return { message: '아직 다이어리 기록이 없어요.' }
}

function noticeStageFromTitle(title: string): RiskLevel | undefined {
  const match = title.match(/([1-5])단계/)
  if (!match) return undefined
  return Number(match[1]) as RiskLevel
}

function elapsedNotice(label: string, date: string) {
  const days = Math.max(0, daysBetween(date, toDateKey(new Date())))
  if (days === 0) return `${label}이 오늘 있었어요.`
  return `${label} 후 ${days}일이 지났어요.`
}

function buildWeightInsight(records: PetRecord[], petName: string): DiaryInsight | null {
  const weights = records.filter((record) => record.type === 'weight' && record.weight !== undefined).sort(compareRecordTime)
  if (weights.length < 2) return null
  const previous = weights[weights.length - 2]
  const latest = weights[weights.length - 1]
  const previousWeight = previous.weight ?? 0
  const latestWeight = latest.weight ?? 0
  if (previousWeight <= 0 || latestWeight <= 0) return null
  const diff = latestWeight - previousWeight
  const percent = Math.abs(diff / previousWeight) * 100
  if (percent < 5) return null
  const direction = diff > 0 ? '증가' : '감소'
  return {
    id: 'weight-change',
    metric: 'weight',
    level: percent >= 10 ? 'urgent' : 'caution',
    title: `체중이 최근 ${formatWeightValue(percent)}% ${direction}했어요.`,
    body: `${petName}의 체중이 ${formatWeightValue(previousWeight)}g에서 ${formatWeightValue(latestWeight)}g로 바뀌었어요. 변화가 계속되면 Q&A에 기록을 첨부해 질문하거나 특수동물 병원 상담을 확인해주세요.`,
  }
}

function buildEnvironmentInsight(records: PetRecord[], petName: string): DiaryInsight | null {
  const latestRisk = records
    .filter((record) => record.environmentRecord && record.environmentRecord.riskLevel > 0)
    .sort(compareRecordTime)
    .at(-1)
  if (!latestRisk?.environmentRecord) return null
  const risk = latestRisk.environmentRecord
  const label = risk.metricType === 'humidity' ? '습도' : risk.measurementType === 'water' ? '수온' : '온도'
  return {
    id: 'environment-risk',
    metric: 'environment',
    level: risk.riskLevel >= 4 ? 'urgent' : risk.riskLevel >= 2 ? 'caution' : 'notice',
    title: `${label}가 ${risk.riskLevel}단계 상태예요.`,
    body: `${petName}의 ${label} 기록은 ${formatEnvironmentValue(risk)}예요. ${risk.riskMessage}`,
  }
}

function buildShedInsight(records: PetRecord[], petName: string): DiaryInsight | null {
  const ongoingShed = getOngoingShedRecord(records)
  if (ongoingShed) {
    const days = daysBetween(ongoingShed.date, toDateKey(new Date()))
    if (days < 1) return null
    const levelNumber = shedDelayLevel(days)
    const durations = buildShedDurationRecords(records)
    const averageDuration = averageDurationDays(durations)
    const durationHint = averageDuration ? `평균 탈피 기간은 약 ${averageDuration}일이에요. ` : ''
    return {
      id: 'shed-ongoing',
      metric: 'shed',
      level: levelNumber >= 4 ? 'urgent' : levelNumber >= 2 ? 'caution' : 'notice',
      title: levelNumber > 0 ? `탈피가 ${levelNumber}단계 확인 상태예요.` : '탈피가 완료됐나요?',
      body: levelNumber > 0
        ? `${durationHint}${petName}의 탈피 시작 기록 후 ${days}일이 지났어요. 탈피가 끝났는지 확인해주세요.`
        : `${durationHint}${petName}의 탈피 시작 기록이 있어요. 탈피가 끝났다면 완료로 남겨주세요.`,
      action: 'shed-check',
    }
  }
  return null
}

function getOngoingShedRecord(records: PetRecord[]) {
  const sheds = records.filter((record) => record.type === 'shed').sort(compareRecordTime)
  const latestStarted = sheds.filter(isStartedShed).at(-1)
  if (!latestStarted) return null
  const latestCompleted = sheds.filter(isCompletedShed).at(-1)
  if (latestCompleted && compareRecordTime(latestCompleted, latestStarted) > 0) return null
  return latestStarted
}

function shedDelayLevel(days: number) {
  if (days >= 20) return 5
  if (days >= 14) return 4
  if (days >= 11) return 3
  if (days >= 8) return 2
  if (days >= 5) return 1
  return 0
}

function buildPoopInsight(records: PetRecord[], petName: string): DiaryInsight | null {
  const latestPoops = records.filter((record) => record.type === 'poop').sort(compareRecordTime).slice(-5)
  const looseCount = latestPoops.filter((record) => normalizePoopStatus(record.memo) === '묽음').length
  const hardCount = latestPoops.filter((record) => normalizePoopStatus(record.memo) === '딱딱').length
  if (looseCount >= 2) {
    return {
      id: 'poop-loose',
      metric: 'poop',
      level: looseCount >= 3 ? 'caution' : 'notice',
      title: '묽은 배변 기록이 반복됐어요.',
      body: `${petName}의 최근 배변 중 묽음 기록이 ${looseCount}번 있어요. 사육장 습도가 높게 유지되는지 확인하고 필요하면 조금 더 건조하게 조정해주세요.`,
    }
  }
  if (hardCount >= 2) {
    return {
      id: 'poop-hard',
      metric: 'poop',
      level: hardCount >= 3 ? 'caution' : 'notice',
      title: '딱딱한 배변 기록이 반복됐어요.',
      body: `${petName}의 최근 배변 중 딱딱함 기록이 ${hardCount}번 있어요. 물그릇과 급수 상태를 확인하고 수분 보충을 신경 써주세요.`,
    }
  }
  return null
}

function insightLabel(metric: DiaryInsight['metric']) {
  if (metric === 'shed') return '탈피 기간'
  if (metric === 'environment') return '온습도 변화'
  if (metric === 'weight') return '체중 변화'
  return '배변 상태'
}

function compareRecordTime(a: PetRecord, b: PetRecord) {
  return `${a.date}${a.occurredAt ?? a.createdAt}`.localeCompare(`${b.date}${b.occurredAt ?? b.createdAt}`)
}

function daysBetween(from: string, to: string) {
  const start = new Date(`${from}T00:00:00`)
  const end = new Date(`${to}T00:00:00`)
  return Math.round((end.getTime() - start.getTime()) / 86400000)
}

function normalizePoopStatus(value?: string) {
  const text = value ?? ''
  if (text.includes('묽')) return '묽음'
  if (text.includes('딱딱') || text.includes('단단')) return '딱딱'
  if (text.includes('평범') || text.includes('정상')) return '평범'
  return ''
}

function isCompletedShed(record: PetRecord) {
  const memo = record.memo ?? ''
  return memo.includes('탈피 완료') || (!isStartedShed(record) && !memo.includes('완료 안됨') && !memo.includes('부분') && !memo.includes('이상'))
}

function isStartedShed(record: PetRecord) {
  const memo = record.memo ?? ''
  return memo.includes('탈피 시작') || memo.includes('탈피 중')
}

function buildShedDurationRecords(records: PetRecord[]) {
  const sheds = records.filter((record) => record.type === 'shed').sort(compareRecordTime)
  const starts = sheds.filter(isStartedShed)
  const completions = sheds.filter(isCompletedShed)
  const usedCompletionIds = new Set<string>()
  return starts.flatMap((start) => {
    const completion = completions.find((candidate) => !usedCompletionIds.has(candidate.id) && compareRecordTime(candidate, start) > 0)
    if (!completion) return []
    usedCompletionIds.add(completion.id)
    return [{
      ...completion,
      id: `shed-${start.id}-${completion.id}`,
      memo: `${formatDate(start.date)} 시작 · ${formatDate(completion.date)} 완료`,
      sourceIds: [start.id, completion.id],
      duration: Math.max(1, daysBetween(start.date, completion.date)),
    }]
  })
}

function collapseShedRecordsForDisplay(records: PetRecord[]): DisplayPetRecord[] {
  const combinedSheds = buildShedDurationRecords(records)
  const pairedShedIds = new Set(combinedSheds.flatMap((record) => record.sourceIds ?? []))
  return [
    ...records.filter((record) => record.type !== 'shed' || !pairedShedIds.has(record.id)),
    ...combinedSheds,
  ].sort(compareRecordTime)
}

function averageDurationDays(records: Array<PetRecord & { duration?: number }>) {
  const durations = records.map((record) => record.duration).filter((duration): duration is number => typeof duration === 'number' && duration > 0)
  if (!durations.length) return 0
  return Math.round(durations.reduce((sum, duration) => sum + duration, 0) / durations.length)
}

function SimpleLineChart({ title, subtitle = '날짜별 변화', unit, records, getValue }: { title: string; subtitle?: string; unit: string; records: PetRecord[]; getValue: (record: PetRecord) => number }) {
  const width = 520
  const height = 190
  const values = records.map(getValue)
  const min = Math.min(...values) - 1
  const max = Math.max(...values) + 1
  const y = (value: number) => height - 30 - ((value - min) / Math.max(1, max - min)) * (height - 58)
  const x = (index: number) => values.length === 1 ? width / 2 : 36 + (index / (values.length - 1)) * (width - 72)
  const path = values.map((value, index) => `${index === 0 ? 'M' : 'L'} ${x(index)} ${y(value)}`).join(' ')
  return (
    <section className="environment-chart">
      <header><strong>{title}</strong><span>{subtitle}</span></header>
      <div className="environment-chart-wrap">
        <svg className="line-chart environment-line-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${title} 꺾은선 그래프`}>
          <line x1="28" y1="18" x2="28" y2={height - 26} />
          <line x1="28" y1={height - 26} x2={width - 28} y2={height - 26} />
          <path className="line-chart-path" d={path} />
          {values.map((value, index) => <circle key={`${records[index].id}-${title}`} cx={x(index)} cy={y(value)} r="5"><title>{`${formatDate(records[index].date)} · ${formatWeightValue(value)}${unit}`}</title></circle>)}
        </svg>
        <div className="line-chart-scale"><span>{formatWeightValue(max)}{unit}</span><span>{formatWeightValue(min)}{unit}</span></div>
      </div>
      <div className="environment-chart-labels">
        {records.map((record, index) => <span key={`${record.id}-simple-label`}><strong>{formatDate(record.date)}</strong><b>{formatWeightValue(values[index])}{unit}</b></span>)}
      </div>
    </section>
  )
}

function WeightLineChart({ records }: { records: PetRecord[] }) {
  return <SimpleLineChart title="체중 변화" unit="g" records={records} getValue={(record) => record.weight ?? 0} />
}

function ShedCycleChart({ records }: { records: PetRecord[] }) {
  const durations = buildShedDurationRecords(records)
  const average = averageDurationDays(durations)
  if (durations.length === 0) return <section className="environment-chart"><header><strong>탈피 기간</strong><span>탈피 시작과 완료 기록이 더 필요해요</span></header></section>
  return <SimpleLineChart title="탈피 기간" subtitle={`평균 ${average}일 정도 탈피해요`} unit="일" records={durations} getValue={(record) => 'duration' in record ? Number(record.duration) : 0} />
}

function PoopStatusChart({ records }: { records: PetRecord[] }) {
  const counts = [
    { label: '평범', count: records.filter((record) => normalizePoopStatus(record.memo) === '평범').length, color: 'var(--color-primary-600)' },
    { label: '묽음', count: records.filter((record) => normalizePoopStatus(record.memo) === '묽음').length, color: 'var(--color-primary-300)' },
    { label: '딱딱', count: records.filter((record) => normalizePoopStatus(record.memo) === '딱딱').length, color: 'var(--color-accent-700)' },
  ]
  const max = Math.max(1, ...counts.map((item) => item.count))
  return (
    <section className="poop-status-chart">
      <header><strong>배변 상태</strong><span>평범 · 묽음 · 딱딱</span></header>
      <div>{counts.map((item) => <span key={item.label}><b>{item.label}</b><i style={{ width: `${(item.count / max) * 100}%`, background: item.color }} /><em>{item.count}회</em></span>)}</div>
    </section>
  )
}

function EnvironmentLineChart({ title, records }: { title: string; records: PetRecord[] }) {
  const width = 520
  const height = 190
  const values = records.map((record) => record.environmentRecord).filter((record): record is EnvironmentRecord => Boolean(record))
  const min = Math.min(...values.map((record) => Math.min(record.value, record.minValue))) - 1
  const max = Math.max(...values.map((record) => Math.max(record.value, record.maxValue))) + 1
  const y = (value: number) => height - 30 - ((value - min) / Math.max(1, max - min)) * (height - 58)
  const x = (index: number) => values.length === 1 ? width / 2 : 36 + (index / (values.length - 1)) * (width - 72)
  const valuePath = values.map((record, index) => `${index === 0 ? 'M' : 'L'} ${x(index)} ${y(record.value)}`).join(' ')
  const minPath = values.map((record, index) => `${index === 0 ? 'M' : 'L'} ${x(index)} ${y(record.minValue)}`).join(' ')
  const maxPath = values.map((record, index) => `${index === 0 ? 'M' : 'L'} ${x(index)} ${y(record.maxValue)}`).join(' ')
  const unit = values[0]?.unit === 'percent' ? '%' : '℃'

  return (
    <section className="environment-chart">
      <header><strong>{title}</strong><span>기록 당시 정상 범위 기준</span></header>
      <div className="environment-chart-wrap">
        <svg className="line-chart environment-line-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${title} 꺾은선 그래프`}>
          <line x1="28" y1="18" x2="28" y2={height - 26} />
          <line x1="28" y1={height - 26} x2={width - 28} y2={height - 26} />
          <path className="environment-range-line" d={minPath} />
          <path className="environment-range-line" d={maxPath} />
          <path className="line-chart-path" d={valuePath} />
          {values.map((record, index) => (
            <g key={`${records[index].id}-${record.metricType}`}>
              <circle cx={x(index)} cy={y(record.value)} r="5" />
              <title>{`${formatDate(records[index].date)} · ${formatEnvironmentValue(record)} · 정상 ${formatEnvironmentRange(record)}`}</title>
            </g>
          ))}
        </svg>
        <div className="line-chart-scale"><span>{formatWeightValue(max)}{unit}</span><span>{formatWeightValue(min)}{unit}</span></div>
      </div>
      <div className="environment-chart-labels">
        {values.map((record, index) => <span key={`${records[index].id}-label`}><strong>{formatDate(records[index].date)}</strong><b>{formatEnvironmentValue(record)}</b><em>{record.riskLevel === 0 ? '적정 범위' : `${record.riskLevel}단계 ${environmentRiskLabel(record.riskLevel)}`}</em></span>)}
      </div>
    </section>
  )
}

function DataVisualizationScreen({ records, petName, onBack, onCreateQna }: { records: PetRecord[]; petName: string; onBack: () => void; onCreateQna?: () => void }) {
  return <main className="diary-create-screen data-visualization-screen"><header><button type="button" aria-label="뒤로가기" onClick={onBack}>←</button><strong>기록 모아보기</strong><span /></header><DataVisualization records={records} petName={petName} onCreateQna={onCreateQna} /></main>
}

function Overlay({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
  return <div className="diary-overlay"><button className="diary-dim" aria-label="닫기" onClick={onClose} /><section className="diary-modal"><button className="diary-modal-close" type="button" aria-label="닫기" onClick={onClose}>×</button>{children}</section></div>
}

function FeedingFoodDialog({
  pet,
  speciesCareProfiles,
  selectedFoods,
  customFoodName,
  saving,
  error,
  onSelectedFoodsChange,
  onCustomFoodNameChange,
  onCancel,
  onComplete,
}: {
  pet: DiaryPet
  speciesCareProfiles: SpeciesCareProfile[]
  selectedFoods: FeedingFoodItem[]
  customFoodName: string
  saving: boolean
  error: string
  onSelectedFoodsChange: (foods: FeedingFoodItem[]) => void
  onCustomFoodNameChange: (value: string) => void
  onCancel: () => void
  onComplete: () => void
}) {
  const [customOpen, setCustomOpen] = useState(Boolean(customFoodName))
  const options = getFeedingFoodOptions(pet, speciesCareProfiles)
  const customName = customFoodName.trim()
  const canComplete = selectedFoods.length > 0 || customName.length > 0

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !saving) onCancel()
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [onCancel, saving])

  const toggleFood = (option: FoodOption) => {
    if (option.key === customFoodOptionKey) {
      setCustomOpen(true)
      return
    }
    const selected = selectedFoods.some((food) => food.foodKey === option.key)
    onSelectedFoodsChange(selected
      ? selectedFoods.filter((food) => food.foodKey !== option.key)
      : [...selectedFoods, { foodKey: option.key, foodName: option.label, isCustom: false }])
  }

  return (
    <div className="feeding-food-dialog" role="dialog" aria-modal="true" aria-labelledby="feeding-food-title">
      <span className="sheet-handle" />
      <header>
        <h2 id="feeding-food-title">오늘 무엇을 먹였나요?</h2>
        <p>{pet.name}</p>
      </header>
      <div className="feeding-food-options" aria-label="먹이 선택">
        {options.map((option) => {
          const selected = option.key === customFoodOptionKey ? customOpen : selectedFoods.some((food) => food.foodKey === option.key)
          return (
            <button
              type="button"
              key={option.key}
              className={selected ? 'selected' : ''}
              aria-pressed={selected}
              onClick={() => toggleFood(option)}
            >
              {option.label}
            </button>
          )
        })}
      </div>
      {customOpen && (
        <label className="feeding-custom-field">
          <span>기타 직접 입력</span>
          <input value={customFoodName} onChange={(event) => onCustomFoodNameChange(event.target.value)} placeholder="먹이 이름을 입력하세요" />
        </label>
      )}
      {error && <p className="feeding-food-error" role="alert">{error}</p>}
      <footer>
        <button type="button" className="step-secondary" disabled={saving} onClick={onCancel}>취소</button>
        <button type="button" className="step-primary" disabled={!canComplete || saving} aria-busy={saving} onClick={onComplete}>{saving ? '저장 중' : '기록 완료'}</button>
      </footer>
    </div>
  )
}

function EnvironmentInputDialog({
  pet,
  metricType,
  measurementType,
  speciesCareProfiles,
  saving,
  error,
  onCancel,
  onComplete,
}: {
  pet: DiaryPet
  metricType: 'temperature' | 'humidity'
  measurementType?: 'air' | 'water' | 'humidity'
  speciesCareProfiles: SpeciesCareProfile[]
  saving: boolean
  error: string
  onCancel: () => void
  onComplete: (value: number) => void
}) {
  const profile = getEnvironmentProfile(pet, speciesCareProfiles)
  const isHumidity = metricType === 'humidity'
  const defaultValue = isHumidity ? profile?.targetHumidity ?? 50 : profile?.targetTemperature ?? 24
  const [value, setValue] = useState(defaultValue)
  const canSave = Number.isFinite(value)
  const previewProfile = profile ?? {
    key: 'unknown',
    label: pet.species || pet.name,
    temperatureType: measurementType === 'water' ? 'water' : 'air',
    targetTemperature: value,
    minTemperature: value,
    maxTemperature: value,
    humidityEnabled: true,
    targetHumidity: isHumidity ? value : null,
    minHumidity: isHumidity ? value : null,
    maxHumidity: isHumidity ? value : null,
    isBroadCategory: false,
  }
  const isWaterTemperature = !isHumidity && (measurementType === 'water' || previewProfile.temperatureType === 'water')
  const title = isHumidity
    ? '현재 사육장 습도는 몇 %인가요?'
    : isWaterTemperature
      ? '현재 수조의 수온은 몇 도인가요?'
      : '현재 사육장 온도는 몇 도인가요?'
  const saveLabel = isHumidity ? '습도 기록 완료' : isWaterTemperature ? '수온 기록 완료' : '온도 기록 완료'
  const unitLabel = isHumidity ? '%' : '℃'

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !saving) onCancel()
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [onCancel, saving])

  return (
    <div className="environment-input-dialog" role="dialog" aria-modal="true" aria-labelledby="environment-input-title">
      <span className="sheet-handle" />
      <header>
        <h2 id="environment-input-title">{title}</h2>
        <p>{pet.name}</p>
      </header>
      <div className="environment-stepper">
        <button type="button" onClick={() => setValue((current) => current - 1)} aria-label="값 줄이기">?</button>
        <label>
          <input inputMode="decimal" value={String(value)} onChange={(event) => setValue(Number(event.target.value.replace(/[^0-9.-]/g, '')))} />
          <span>{unitLabel}</span>
        </label>
        <button type="button" onClick={() => setValue((current) => current + 1)} aria-label="값 늘리기">+</button>
      </div>
      {!profile && <p className="environment-profile-empty">기준 없이 기록만 저장돼요.</p>}
      {error && <p className="feeding-food-error" role="alert">{error}</p>}
      <footer>
        <button type="button" className="step-secondary" disabled={saving} onClick={onCancel}>취소</button>
        <button type="button" className="step-primary" disabled={!canSave || saving} aria-busy={saving} onClick={() => onComplete(value)}>{saving ? '저장 중' : saveLabel}</button>
      </footer>
    </div>
  )
}

function EnvironmentRiskGauge({ result }: { result: EnvironmentRiskResult }) {
  return (
    <div className={`environment-risk-gauge level-${result.level}`}>
      <div><strong>{result.level === 0 ? '정상' : `${result.level}단계 · ${environmentRiskLabel(result.level)}`}</strong><span>{result.message}</span></div>
      <ol aria-label="환경 위험 단계">
        {[0, 1, 2, 3, 4, 5].map((level) => <li className={level <= result.level ? 'active' : ''} key={level} />)}
      </ol>
    </div>
  )
}

function validateDetail(draft: RecordDraft) {
  if (draft.type === 'food') return draft.foods.length > 0 || draft.customFood.trim().length > 0
  if (draft.type === 'weight') return Number(draft.weight) > 0
  if (draft.type === 'hospital') return draft.hospital.trim().length > 0
  if (draft.type === 'other') return draft.hospital.trim().length > 0 || draft.status.trim().length > 0
  return draft.status.length > 0
}

function getPetWeightInGrams(pet: DiaryPet) {
  const rawWeight = Number(pet.weight)
  if (!Number.isFinite(rawWeight) || rawWeight <= 0) return ''
  const grams = pet.weightUnit === 'kg' ? rawWeight * 1000 : rawWeight
  return formatWeightValue(grams)
}

function formatPetWeight(pet: DiaryPet) {
  const rawWeight = Number(pet.weight)
  if (!Number.isFinite(rawWeight) || rawWeight <= 0) return ''
  return `${formatWeightValue(rawWeight)}${pet.weightUnit ?? 'g'}`
}

function formatPetAge(pet: DiaryPet) {
  const age = pet.ageText?.trim()
  if (!age) return ''
  return age.endsWith('살') ? age : `${age}살`
}

function formatPetMetrics(pet: DiaryPet) {
  return [
    formatPetWeight(pet) ? `무게 ${formatPetWeight(pet)}` : '',
    formatPetAge(pet),
  ].filter(Boolean).join(' · ')
}

function formatWeightValue(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1).replace(/\.0$/, '')
}

function carePlanToReminder(plan: CarePlan): Reminder {
  return {
    id: plan.id,
    petId: plan.petId,
    title: plan.title,
    reminderType: plan.taskType,
    scheduleType: 'repeat',
    weekdays: plan.repeatDays,
    startDate: plan.startDate,
    endDate: plan.endDate,
    reminderDate: '',
    reminderTime: plan.notificationTime,
    memo: '',
    isActive: plan.isActive,
    createdAt: plan.createdAt,
    updatedAt: plan.updatedAt,
  }
}

function medicationTaskReminder(task: DailyTask): Reminder | undefined {
  if (!task.medicationPlanId || !task.taskType.startsWith('medicine|')) return undefined
  const [, name = '처방약', dose = ''] = task.taskType.split('|')
  return {
    id: task.medicationPlanId,
    petId: task.petId,
    title: `약 · ${name}${dose ? ` · ${dose}` : ''}`,
    reminderType: 'medicine',
    scheduleType: 'repeat',
    weekdays: [],
    startDate: task.scheduledDate,
    reminderDate: task.scheduledDate,
    reminderTime: '',
    memo: '',
    isActive: true,
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
  }
}

function reminderToCarePlan(reminder: Reminder): CarePlan {
  return {
    id: reminder.id,
    userId: reminder.userId ?? '',
    petId: reminder.petId,
    taskType: reminder.reminderType,
    title: reminder.title,
    repeatDays: reminder.weekdays,
    startDate: reminder.startDate ?? reminder.reminderDate ?? toDateKey(new Date()),
    endDate: reminder.endDate,
    notificationTime: reminder.reminderTime || '09:00',
    isActive: reminder.isActive,
    createdAt: reminder.createdAt,
    updatedAt: reminder.updatedAt ?? new Date().toISOString(),
  }
}

function getRecordMemo(draft: RecordDraft) {
  if (draft.memo.trim()) return draft.memo.trim()
  if (draft.type === 'food') return [...draft.foods, draft.customFood].filter(Boolean).join(', ')
  if (draft.type === 'weight') return `${draft.weight}g`
  if (draft.type === 'hospital') return draft.hospital
  if (draft.type === 'other') return [draft.hospital, draft.status].filter(Boolean).join(' · ')
  return draft.status || '기록'
}

function recordSummary(record: PetRecord) {
  if (record.environmentRecord) return `${formatEnvironmentValue(record.environmentRecord)} · ${record.environmentRecord.riskLevel === 0 ? '적정 범위' : `${record.environmentRecord.riskLevel}단계 ${environmentRiskLabel(record.environmentRecord.riskLevel)}`}`
  if (record.type === 'food' && getRecordFoodNames(record).length) return getRecordFoodNames(record).join(' · ')
  if (record.type === 'weight' && record.weight !== undefined) return `${formatWeightValue(record.weight)}g`
  return record.memo?.trim() || recordMeta[record.type].label
}

function calendarRecordTag(record: PetRecord) {
  if (record.environmentRecord) {
    const label = record.environmentRecord.metricType === 'humidity'
      ? '습도'
      : record.environmentRecord.measurementType === 'water'
        ? '수온'
        : '온도'
    return {
      icon: record.environmentRecord.metricType === 'humidity' ? '??' : '???',
      label,
      className: record.environmentRecord.metricType,
    }
  }
  if (record.type === 'poop') return { icon: recordMeta.poop.icon, iconSrc: incidentIconSrc.poop, label: recordMeta.poop.label, className: 'poop' }
  if (record.type === 'shed') return { icon: recordMeta.shed.icon, iconSrc: incidentIconSrc.shed, label: recordMeta.shed.label, className: 'shed' }
  if (record.type === 'hospital') return { icon: recordMeta.hospital.icon, iconSrc: incidentIconSrc.hospital, label: '진료', className: 'hospital' }
  if (record.type === 'other' && record.memo?.startsWith('메이팅')) return { icon: '', iconSrc: incidentIconSrc.mating, label: '메이팅', className: 'mating' }
  if (record.type === 'other' && record.memo?.startsWith('산란')) return { icon: '', iconSrc: incidentIconSrc.egg, label: '산란', className: 'egg' }
  if (record.type === 'other' && record.memo?.startsWith('약')) return { icon: '', iconSrc: incidentIconSrc.medicine, label: '약', className: 'medicine' }
  if (record.type === 'other' && record.memo?.includes('물')) return { icon: '', label: '물', className: 'water' }
  return { icon: recordMeta[record.type].icon, label: recordMeta[record.type].label, className: record.type }
}

function getEnvironmentRecordTitle(record: EnvironmentRecord) {
  if (record.metricType === 'humidity') return '현재 습도'
  return record.measurementType === 'water' ? '현재 수온' : '현재 온도'
}

function formatEnvironmentValue(record: EnvironmentRecord) {
  return `${formatWeightValue(record.value)}${record.unit === 'percent' ? '%' : '℃'}`
}

function formatEnvironmentRange(record: EnvironmentRecord) {
  return `${formatWeightValue(record.minValue)}~${formatWeightValue(record.maxValue)}${record.unit === 'percent' ? '%' : '℃'}`
}

function getEnvironmentMetricLabel(metricType: 'temperature' | 'humidity', profile: EnvironmentProfile, measurementType?: 'air' | 'water' | 'humidity') {
  if (metricType === 'humidity') return '습도 확인'
  return measurementType === 'water' || profile.temperatureType === 'water' ? '수온 확인' : '온도 확인'
}

function getRecordFoodNames(record: PetRecord) {
  if (record.feedingFoods?.length) return record.feedingFoods.map((food) => food.foodName)
  return record.foods ?? []
}

function getCalendarDays(month: Date) {
  const start = new Date(month.getFullYear(), month.getMonth(), 1)
  start.setDate(1 - start.getDay())
  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start)
    date.setDate(start.getDate() + index)
    return date
  })
}

function reminderOccursOn(reminder: Reminder, date: Date) {
  const dateKey = toDateKey(date)
  const startDate = reminder.startDate ?? reminder.reminderDate
  if (startDate && dateKey < startDate) return false
  if (reminder.endDate && dateKey > reminder.endDate) return false
  return reminder.weekdays.includes(date.getDay())
}

function parseDateKey(date: string) {
  const [year, month, day] = date.split('-').map(Number)
  return new Date(year, month - 1, day)
}

function formatDate(date: string) {
  const [, month, day] = date.split('-')
  return `${Number(month)}월 ${Number(day)}일`
}

function defaultPetImage(group: DiaryPet['group']) {
  if (group === 'amphibian') return '/assets/pet-default-amphibian.png'
  return '/assets/pet-default-reptile.png'
}

