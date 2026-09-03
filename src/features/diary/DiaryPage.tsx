import { type ChangeEvent, type FormEvent, type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import ReactCalendar from 'react-calendar'
import { deleteAppData, loadAppData, saveAppData } from '../../lib/appData'
import { completeDailyTask, deleteCarePlan, listCarePlans, listCareRecords, listDailyTasks, saveCarePlan, saveClinicToDiary, saveDailyTaskCareRecord, settleSupersededOverdueTasks, skipDailyTask } from './diaryService'
import type { CarePlan, CareTaskType, ClinicRecordDetails, DailyTask, EnvironmentRecord, FeedingFoodItem, PetRecord, PetRecordType, RiskLevel, StoolStatus } from './diaryTypes'
import { analyzeRecordedCycle } from './diaryCycleAnalysis'
import { cancelRoutineNotificationJobs, getFirstRoutineDate, markRoutineNotificationJobCompleted, markRoutineNotificationJobSkipped, upsertRoutineNotificationJob } from './routineNotificationJobs'
import { customFoodOptionKey, fallbackSpeciesCareProfiles, findSpeciesCareProfile, listSpeciesCareProfiles, type CareEnvironmentProfile, type CareFoodOption, type SpeciesCareProfile } from './speciesCareProfiles'
import { toDateKey } from './mockDiaryData'
import type { HospitalRecommendationConcern, HospitalReview, HospitalSnapshot } from '../../types/app'
import NotificationOptInNudge from '../../components/notifications/NotificationOptInNudge'
import { OptionalBadge } from '../../components/common/FieldMarkers'
import { sanitizeImageFile } from '../../lib/imageStorage'
import DiaryMobileScreen from './DiaryMobileScreen'
import type { MobileDiaryAlert, MobileDiaryPrediction, MobileDiaryQuickAction, MobileDiaryRecord, MobileDiaryRoutine } from './DiaryMobileScreen'
import 'react-calendar/dist/Calendar.css'
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
  metric: 'shed' | 'environment' | 'weight' | 'poop' | 'mating' | 'egg'
  action?: 'shed-check' | 'shed-cycle-check' | 'environment-resolve'
  sourceUrl?: string
  poopFollowUpStage?: 1 | 2 | 3
  poopStatus?: StoolStatus
  poopRecovered?: boolean
}
type PoopFollowUp = {
  record: PetRecord
  status: StoolStatus
  repeated: boolean
  recovered: boolean
}
type DisplayPetRecord = PetRecord & {
  sourceIds?: string[]
}
type CalendarRecordTag = {
  icon: string
  iconSrc?: string
  iconIsRoutineCard?: boolean
  label: string
  className: string
}
type CalendarCyclePrediction = {
  date: string
  startDate: string
  endDate: string
  lastDate: string
  type: 'shed' | 'egg'
  label: string
}
type ClinicDraft = ClinicRecordDetails & {
  id: string
  reviewId?: string
  hospitalSnapshot?: HospitalSnapshot
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
  recurrenceType?: 'weekdays' | 'interval'
  recurrenceIntervalDays?: number
  startDate?: string
  endDate?: string
  reminderDate: string
  reminderTime: string
  memo: string
  isActive: boolean
  createdAt: string
  updatedAt?: string
  completedAt?: string
  purpose?: 'poop_follow_up'
  sourceRecordId?: string
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

const routinePhotoKeys: Partial<Record<ReminderType, string>> = {
  feed: 'feed',
  water: 'water',
  mist: 'mist',
  weight: 'weight',
  temperature: 'temperature',
  water_temperature: 'water-temperature',
  humidity: 'humidity',
  water_quality: 'water-quality',
  filter_check: 'filter-check',
  uvb_check: 'uvb-check',
  cleaning: 'cleaning',
  partial_cleaning: 'partial-cleaning',
  full_cleaning: 'full-cleaning',
  substrate_change: 'substrate-change',
  structure_cleaning: 'structure-cleaning',
  wall_wipe: 'wall-wipe',
}

function RoutinePhoto({ type, className = '' }: { type: ReminderType; className?: string }) {
  const photoKey = routinePhotoKeys[type]
  if (!photoKey) return null
  return <img className={`routine-photo routine-photo-${photoKey} ${className}`.trim()} src={`/assets/routine-icons/cards/${photoKey}.png`} alt="" aria-hidden="true" />
}

const baseRoutineTypes: ReminderType[] = ['feed', 'mist', 'cleaning', 'medicine', 'water', 'weight', 'humidity', 'temperature']
const herpRoutineTypes: ReminderType[] = [
  'feed',
  'mist',
  'water',
  'weight',
  'humidity',
  'temperature',
  'cleaning',
  'medicine',
]

const aquaticRoutineTypes: ReminderType[] = ['feed', 'mist', 'cleaning', 'medicine', 'water', 'water_temperature', 'water_quality', 'filter_check', 'weight', 'custom']

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
  if (speciesProfile?.routineTypes.length) return withRequiredRoutineTypes(speciesProfile.routineTypes)
  if (profile?.temperatureType === 'water') return withRequiredRoutineTypes(profile.key === 'axolotl' ? aquaticRoutineTypes : aquaticRoutineTypes.filter((type) => type !== 'filter_check'))
  if (pet?.group === 'reptile' || pet?.group === 'amphibian') {
    if (isFullyAquaticTurtlePet(pet)) {
      return withRequiredRoutineTypes(['feed', 'mist', 'cleaning', 'medicine', 'water_temperature', 'water_quality', 'filter_check', 'custom'])
    }
    return withRequiredRoutineTypes([...herpRoutineTypes
      .filter((type) => type !== 'humidity' || profile?.humidityEnabled !== false)
      .filter((type) => !(isGeckoPet(pet) && type === 'water'))
      .filter((type) => !(isAquaticTurtlePet(pet) && (type === 'mist' || type === 'water'))),
    ...(isSemiAquaticTurtlePet(pet) ? ['water_temperature' as const] : []),
    'custom'])
  }
  return withRequiredRoutineTypes([...baseRoutineTypes, 'custom'])
}

function withRequiredRoutineTypes(types: ReminderType[]): ReminderType[] {
  const normalized = types.map((type) => type === 'partial_cleaning' || type === 'full_cleaning' ? 'cleaning' as const : type)
  const required: ReminderType[] = ['feed', 'mist', 'cleaning', 'medicine']
  const unique = Array.from(new Set([...required, ...normalized.filter((type) => type !== 'weight' && type !== 'custom')]))
  return normalized.includes('custom') ? [...unique, 'weight', 'custom'] : [...unique, 'weight']
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
): EnvironmentRiskResult {
  const direction = value < minValue ? 'low' : value > maxValue ? 'high' : 'normal'
  if (direction === 'normal') return { level: 1, direction, message: '적정 범위 안에 있어요.' }
  const diff = direction === 'low' ? minValue - value : value - maxValue
  const level: RiskLevel = metricType === 'temperature'
    ? diff >= 7 ? 5 : diff >= 5 ? 4 : diff >= 3 ? 3 : 2
    : diff >= 31 ? 5 : diff >= 21 ? 4 : diff >= 11 ? 3 : 2
  if (level === 2) {
    if (metricType === 'humidity') return { level, direction, message: direction === 'low' ? '적정 범위보다 습도가 조금 낮아요. 분무와 수분 상태를 확인해주세요.' : '적정 범위보다 습도가 조금 높아요. 환기와 바닥 상태를 확인해주세요.' }
    return { level, direction, message: direction === 'low' ? '적정 범위보다 조금 낮아요. 측정 위치와 난방 상태를 다시 확인해주세요.' : '적정 범위보다 조금 높아요. 측정 위치와 환기 상태를 다시 확인해주세요.' }
  }
  if (level === 3) return { level, direction, message: '현재 환경이 적정 범위를 뚜렷하게 벗어났어요. 바로 조정하고 잠시 후 다시 확인해주세요.' }
  if (level === 4) return { level, direction, message: '환경을 빠르게 점검해야 해요. 온도·습도 장비와 동물의 활동 상태를 함께 확인해주세요.' }
  return { level, direction, message: '위험한 환경일 수 있어요. 안전한 범위로 즉시 조정하고 이상 증상이 있으면 특수동물 병원에 문의해주세요.' }
}

function environmentRiskLabel(level: RiskLevel) {
  return ['정상', '정상', '확인 필요', '조치 필요', '긴급 점검', '즉시 대응'][level]
}

function useDiaryMobileLayout() {
  const [mobile, setMobile] = useState(() => window.matchMedia('(max-width: 760px) and (orientation: portrait)').matches)
  useEffect(() => {
    const media = window.matchMedia('(max-width: 760px) and (orientation: portrait)')
    const update = () => setMobile(media.matches)
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [])
  return mobile
}

export default function DiaryPage({
  userId,
  pets,
  hospitals = [],
  hospitalReviews = {},
  initialPetId,
  initialAction,
  onInitialActionHandled,
  initialClinicHospital,
  readOnly = false,
  onAddPet,
  onCreateQna,
  onFindHospital,
  onCreateClinicReview,
  onInitialClinicHospitalHandled,
  initialDraft,
  onDeleteDraft,
}: {
  userId: string
  pets: DiaryPet[]
  hospitals?: HospitalSnapshot[]
  hospitalReviews?: Record<string, HospitalReview[]>
  initialPetId?: string
  initialAction?: 'routine-create' | null
  onInitialActionHandled?: () => void
  initialClinicHospital?: HospitalSnapshot | null
  readOnly?: boolean
  onAddPet: () => void
  onCreateQna?: (petId: string, preset?: { category: '질병'; title: string }) => void
  onFindHospital?: (petId: string, concern?: HospitalRecommendationConcern) => void
  onCreateClinicReview?: (hospital: HospitalSnapshot, review: HospitalReview) => void
  onInitialClinicHospitalHandled?: () => void
  initialDraft?: DiaryDraftItem | null
  onDeleteDraft?: (draftId: string) => void | Promise<void>
}) {
  const today = toDateKey(new Date())
  const mobileLayout = useDiaryMobileLayout()
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
  const [weightCompletion, setWeightCompletion] = useState<{ reminder: Reminder; dailyTask?: DailyTask; initialValue: string } | null>(null)
  const [weightSaving, setWeightSaving] = useState(false)
  const [weightError, setWeightError] = useState('')
  const [dateDetailsOpen, setDateDetailsOpen] = useState(false)
  const [visualizationOpen, setVisualizationOpen] = useState(false)
  const [completingReminder, setCompletingReminder] = useState<Reminder | null>(null)
  const [reminderFormOpen, setReminderFormOpen] = useState(false)
  const [clinicEditorOpen, setClinicEditorOpen] = useState(false)
  const [clinicDraft, setClinicDraft] = useState<ClinicDraft | null>(null)
  const [clinicSaving, setClinicSaving] = useState(false)
  const [clinicError, setClinicError] = useState('')
  const [savedClinicDraft, setSavedClinicDraft] = useState<ClinicDraft | null>(null)
  const [editingReminder, setEditingReminder] = useState<Reminder | null>(null)
  const [routinePresetType, setRoutinePresetType] = useState<ReminderType | null>(null)
  const [petWarningOpen, setPetWarningOpen] = useState(false)
  const [petMenuOpen, setPetMenuOpen] = useState(false)
  const [smartSheet, setSmartSheet] = useState<SmartAddKind | null>(null)
  const [smartFoodKind, setSmartFoodKind] = useState('')
  const [smartFoodQuantity, setSmartFoodQuantity] = useState('1')
  const [smartFoodUnit, setSmartFoodUnit] = useState('마리')
  const [smartPoopStatus, setSmartPoopStatus] = useState('')
  const [poopFollowUp, setPoopFollowUp] = useState<PoopFollowUp | null>(null)
  const [smartShedStatus, setSmartShedStatus] = useState('')
  const [smartMatingFemaleId, setSmartMatingFemaleId] = useState('')
  const [smartMatingMaleId, setSmartMatingMaleId] = useState('')
  const [smartEggMatingId, setSmartEggMatingId] = useState('')
  const [smartEggFertility, setSmartEggFertility] = useState<'unfertilized' | 'fertilized'>('unfertilized')
  const [pendingSmartRecord, setPendingSmartRecord] = useState<{ record: PetRecord; message: string } | null>(null)
  const [smartToast, setSmartToast] = useState('')
  const [resolvedInsightIds, setResolvedInsightIds] = useState<string[]>([])
  const [followedUpInsightIds, setFollowedUpInsightIds] = useState<string[]>([])
  const completingTaskIds = useRef(new Set<string>())
  const environmentSaveInFlight = useRef(false)
  const weightSaveInFlight = useRef(false)
  const lastInitialPetIdRef = useRef(initialPetId)

  const selectedPet = pets.find((pet) => pet.id === selectedPetId) ?? pets[0]
  const effectivePetId = selectedPet?.id ?? ''
  const resolvedInsightStorageKey = `exocare:resolved-diary-insights:${userId}:${effectivePetId}`
  const followedUpInsightStorageKey = `exocare:followed-up-diary-insights:${userId}:${effectivePetId}`
  const activeReminders = reminders.filter((reminder) => reminder.isActive)
  const petCarePlans = reminders.filter((reminder) => reminder.petId === effectivePetId)
  const petRecords = records.filter((record) => record.petId === effectivePetId)
  const displayPetRecords = useMemo(() => collapseShedRecordsForDisplay(petRecords), [petRecords])
  const calendarPetRecords = useMemo(() => {
    const monthStart = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), 1)
    const calendarStart = new Date(monthStart)
    calendarStart.setDate(monthStart.getDate() - monthStart.getDay())
    const visibleCalendarDates = Array.from({ length: 42 }, (_, index) => {
      const date = new Date(calendarStart)
      date.setDate(calendarStart.getDate() + index)
      return date
    })
    const scheduledCareRecords: PetRecord[] = activeReminders
      .filter((reminder) => reminder.petId === effectivePetId && (reminder.reminderType === 'hospital' || reminder.reminderType === 'medicine'))
      .flatMap((reminder) => {
        const scheduledDates = reminder.scheduleType === 'once'
          ? [reminder.startDate || reminder.reminderDate].filter((date): date is string => Boolean(date))
          : visibleCalendarDates.filter((date) => reminderOccursOn(reminder, date)).map(toDateKey)
        return scheduledDates.filter((scheduledDate) => scheduledDate > today).map((scheduledDate) => ({
          id: `scheduled-${reminder.reminderType}-${reminder.id}-${scheduledDate}`,
          userId,
          petId: reminder.petId,
          type: reminder.reminderType === 'hospital' ? 'hospital' as const : 'other' as const,
          date: scheduledDate,
          memo: reminder.reminderType === 'hospital' ? '진료 예정' : '약 예정',
          scheduledFor: scheduledDate,
          createdAt: reminder.createdAt,
        }))
      })
    const reviewVisitRecords: PetRecord[] = Object.values(hospitalReviews)
      .flat()
      .flatMap((review) => {
        const nextVisitDate = review.nextVisitDate
        if (review.petId !== effectivePetId || !nextVisitDate || nextVisitDate <= today) return []
        return [{
          id: `scheduled-review-hospital-${review.id}-${nextVisitDate}`,
          userId,
          petId: effectivePetId,
          type: 'hospital' as const,
          date: nextVisitDate,
          memo: '진료 예정',
          hospitalId: review.hospitalId,
          reviewId: review.id,
          clinicDetails: {
            hospitalName: review.hospitalName ?? review.hospitalSnapshot?.name ?? '병원',
            visitDate: nextVisitDate,
          },
          scheduledFor: nextVisitDate,
          createdAt: review.createdAt,
        }]
      })
    const futurePlans = [...scheduledCareRecords, ...reviewVisitRecords].filter((record, index, items) => (
      index === items.findIndex((candidate) => candidate.petId === record.petId && candidate.date === record.date && candidate.type === record.type)
    ))
    return [...displayPetRecords.filter((record) => record.date <= today), ...futurePlans]
  }, [activeReminders, displayPetRecords, effectivePetId, hospitalReviews, today, userId, visibleMonth])

  useEffect(() => {
    if (initialAction !== 'routine-create' || !effectivePetId) return
    setEditingReminder(null)
    setRoutinePresetType(null)
    setReminderFormOpen(true)
    onInitialActionHandled?.()
  }, [effectivePetId, initialAction, onInitialActionHandled])
  const recentFoods = Array.from(new Set(petRecords.flatMap((record) => record.type === 'food' ? record.foods ?? [] : []))).slice(0, 3)
  const matingPetCandidates = selectedPet ? pets.filter((pet) => sameSpecies(pet, selectedPet)) : []
  const matingOptions = useMemo(() => getMatingOptions(records, pets, selectedPet), [pets, records, selectedPet])
  const calendarCyclePredictions = useMemo(() => buildCalendarCyclePredictions(petRecords), [petRecords])

  useEffect(() => {
    if (!effectivePetId) return
    try {
      const stored = JSON.parse(localStorage.getItem(resolvedInsightStorageKey) ?? '[]') as unknown
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setResolvedInsightIds(Array.isArray(stored) ? stored.filter((value): value is string => typeof value === 'string') : [])
    } catch {
      setResolvedInsightIds([])
    }
    try {
      const stored = JSON.parse(localStorage.getItem(followedUpInsightStorageKey) ?? '[]') as unknown
      setFollowedUpInsightIds(Array.isArray(stored) ? stored.filter((value): value is string => typeof value === 'string') : [])
    } catch {
      setFollowedUpInsightIds([])
    }
  }, [effectivePetId, followedUpInsightStorageKey, resolvedInsightStorageKey])

  const markDiaryInsightFollowUp = (insightId: string) => {
    setFollowedUpInsightIds((current) => {
      const next = current.includes(insightId) ? current : [...current, insightId]
      localStorage.setItem(followedUpInsightStorageKey, JSON.stringify(next))
      return next
    })
  }

  const resolveDiaryInsight = (insightId: string) => {
    setResolvedInsightIds((current) => {
      const next = current.includes(insightId) ? current : [...current, insightId]
      localStorage.setItem(resolvedInsightStorageKey, JSON.stringify(next))
      return next
    })
    setFollowedUpInsightIds((current) => {
      const next = current.filter((id) => id !== insightId)
      localStorage.setItem(followedUpInsightStorageKey, JSON.stringify(next))
      return next
    })
  }

  const keepDiaryInsight = (insightId: string) => {
    setFollowedUpInsightIds((current) => {
      const next = current.filter((id) => id !== insightId)
      localStorage.setItem(followedUpInsightStorageKey, JSON.stringify(next))
      return next
    })
  }

  const previousDate = toDateKey(new Date(parseDateKey(selectedDate).getTime() - 86400000))
  const legacyPlanReminders = activeReminders
    .filter((reminder) => reminder.petId === effectivePetId && reminder.scheduleType === 'repeat')
    .flatMap((reminder) => {
      const completedDate = reminder.completedAt?.slice(0, 10)
      if (reminderOccursOn(reminder, parseDateKey(selectedDate))) return [{ reminder, overdue: false }]
      if (reminderOccursOn(reminder, parseDateKey(previousDate)) && completedDate !== previousDate && completedDate !== selectedDate) return [{ reminder, overdue: true }]
      return []
    })
  const dailyTaskPlanReminderCandidates = usingCarePlans
    ? dailyTasks
      .filter((task) => task.petId === effectivePetId && (task.scheduledDate === selectedDate || (task.scheduledDate < today && task.status === 'pending')))
      .map((task) => ({ reminder: reminders.find((item) => item.id === task.carePlanId) ?? medicationTaskReminder(task), overdue: task.scheduledDate < today, dailyTask: task }))
      .filter((item): item is { reminder: Reminder; overdue: boolean; dailyTask: DailyTask } => Boolean(item.reminder))
    : []
  const dailyTaskPlanReminders = collapseOverdueRoutineTasks(dailyTaskPlanReminderCandidates)
  const dailyTaskReminderIds = new Set(dailyTaskPlanReminders.map((item) => item.reminder.id))
  const immediatePlanReminders = legacyPlanReminders
    .filter((item) => !dailyTaskReminderIds.has(item.reminder.id))
    .map((item) => ({ ...item, dailyTask: undefined }))
  const planReminders = [...dailyTaskPlanReminders, ...immediatePlanReminders]
    .filter((item) => !selectedPet || isReminderVisibleForPet(item.reminder, selectedPet, speciesCareProfiles))
  const mobileDays = getDiaryWeekDates(selectedDate).map((date) => {
    const key = toDateKey(date)
    const indicators: Array<'record' | 'egg' | 'shed'> = []
    if (calendarPetRecords.some((record) => record.date === key)) indicators.push('record')
    if (calendarCyclePredictions.some((prediction) => prediction.type === 'egg' && key >= prediction.startDate && key <= prediction.endDate)) indicators.push('egg')
    if (calendarCyclePredictions.some((prediction) => prediction.type === 'shed' && key >= prediction.startDate && key <= prediction.endDate)) indicators.push('shed')
    return { key, weekday: ['일', '월', '화', '수', '목', '금', '토'][date.getDay()], day: date.getDate(), selected: key === selectedDate, today: key === today, indicators }
  })
  const mobileRoutines: MobileDiaryRoutine[] = planReminders.filter((item) => !item.overdue).map((item) => ({
    id: item.dailyTask?.id ?? item.reminder.id,
    label: planLabel(item.reminder, selectedPet),
    icon: routinePhotoKeys[item.reminder.reminderType] ? `/assets/routine-icons/cards/${routinePhotoKeys[item.reminder.reminderType]}.png` : undefined,
    completed: item.dailyTask ? item.dailyTask.status === 'completed' : item.reminder.completedAt?.slice(0, 10) === selectedDate,
    disabled: selectedDate > today,
  }))
  const mobileQuickActions: MobileDiaryQuickAction[] = [
    { id: 'poop', label: '배변', icon: incidentIconSrc.poop ?? '', disabled: selectedDate > today, onClick: () => openSmartAdd('poop') },
    { id: 'shed', label: '탈피', icon: incidentIconSrc.shed ?? '', disabled: selectedDate > today, onClick: () => openSmartAdd('shed') },
    { id: 'egg', label: '산란', icon: incidentIconSrc.egg ?? '', disabled: selectedDate > today, onClick: () => openSmartAdd('egg') },
    { id: 'mating', label: '메이팅', icon: incidentIconSrc.mating ?? '', disabled: selectedDate > today, onClick: () => openSmartAdd('mating') },
    { id: 'hospital', label: '병원 방문', icon: incidentIconSrc.hospital ?? '', onClick: () => openIncidentRoutine('hospital') },
  ]
  const mobileAgenda = mobileRecordsForDate(petRecords, selectedDate)
  const mobilePredictions: MobileDiaryPrediction[] = calendarCyclePredictions.map((prediction) => ({ type: prediction.type, label: prediction.type === 'egg' ? '산란 예상 주기' : '탈피 예상 주기', startDate: prediction.startDate, endDate: prediction.endDate }))
  const mobileInsight = buildDiaryInsights(petRecords, selectedPet?.name ?? '펫', resolvedInsightIds)[0]
  const hasTemporaryPoopRoutine = petCarePlans.some((reminder) => reminder.isActive && reminder.purpose === 'poop_follow_up')
  const mobileAlert: MobileDiaryAlert | undefined = mobileInsight && !(mobileInsight.poopRecovered && !hasTemporaryPoopRoutine) ? {
    severity: mobileInsight.poopRecovered ? 'complete' : mobileInsight.level === 'urgent' ? 'critical' : mobileInsight.level === 'caution' ? 'warning' : mobileInsight.level === 'notice' ? 'caution' : 'info',
    badge: mobileInsight.poopRecovered ? '완료' : mobileInsight.level === 'urgent' ? '심각' : mobileInsight.level === 'caution' ? '경고' : mobileInsight.level === 'notice' ? '주의' : '정보',
    title: mobileInsight.title,
    body: mobileInsight.body,
    actions: mobileInsight.poopRecovered ? [
      { label: '유지하기', onClick: () => { resolveDiaryInsight(mobileInsight.id); showSmartToast('임시 루틴을 유지합니다.') } },
      { label: '종료하기', onClick: () => { closeTemporaryPoopRoutines(); resolveDiaryInsight(mobileInsight.id) } },
    ] : buildMobileDiaryAlertActions({
      insight: mobileInsight,
      onOpenRecords: () => setVisualizationOpen(true),
      onCreateQna: selectedPet && onCreateQna ? () => onCreateQna(selectedPet.id, mobileInsight.metric === 'shed' ? { category: '질병', title: '탈피 관련 질문' } : mobileInsight.metric === 'poop' ? { category: '질병', title: '배변 관련 질문' } : undefined) : undefined,
      onFindHospital: selectedPet && onFindHospital ? () => onFindHospital(selectedPet.id, mobileInsight.metric === 'poop' ? 'poop' : mobileInsight.metric === 'shed' ? 'shed' : undefined) : undefined,
      onShedComplete: () => saveShedCheckRecord('탈피 완료'),
      onShedNotYet: () => saveShedCheckRecord('탈피 확인 · 완료 안됨'),
    }),
  } : undefined
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
      listCareRecords(userId).catch((error) => {
        console.error('Care records could not be loaded.', error)
        return []
      }),
      listCarePlans(userId).then((plans) => ({ plans, migrated: true })).catch(() => loadAppData<Reminder>('feeding_reminders', { userId, scope: 'mine' }).then((legacy) => ({ plans: legacy.map(reminderToCarePlan), migrated: false })).catch(() => ({ plans: [], migrated: false }))),
      listSpeciesCareProfiles().catch(() => fallbackSpeciesCareProfiles),
    ]).then(([nextRecords, planResult, nextSpeciesCareProfiles]) => {
      if (!active) return
      setRecords(deduplicateMeasuredRecordsByDay(nextRecords))
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

  useEffect(() => {
    if (!initialClinicHospital || !selectedPet) return
    // Open the clinic editor with the hospital selected on the map.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSavedClinicDraft(null)
    setClinicDraft({
      id: crypto.randomUUID(),
      hospitalName: initialClinicHospital.name,
      hospitalSnapshot: initialClinicHospital,
      visitDate: today,
    })
    setSelectedDate(today)
    setVisibleMonth(new Date(`${today}T00:00:00`))
    setClinicError('')
    setClinicEditorOpen(true)
    onInitialClinicHospitalHandled?.()
  }, [initialClinicHospital, onInitialClinicHospitalHandled, selectedPet, today])

  const saveRecordList = (next: PetRecord[]) => {
    const removed = records.find((record) => !next.some((item) => item.id === record.id))
    const added = next.find((record) => !records.some((item) => item.id === record.id))
    setRecords(next)
    if (removed) void deleteAppData('care_records', removed.id, userId).catch((error) => console.error('Care record delete failed.', error))
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
        .finally(() => deleteAppData('feeding_reminders', removed.id, userId))
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
      await markRoutineNotificationJobCompleted(String(userId), String(dailyTask.carePlanId), dailyTask.scheduledDate, dailyTask.id)
    } catch (error) {
      console.error('Routine notification job complete sync failed.', error)
    }
  }

  const markNotificationJobSkippedForTask = async (dailyTask: DailyTask) => {
    if (!dailyTask.carePlanId) return
    try {
      await markRoutineNotificationJobSkipped(String(userId), String(dailyTask.carePlanId), dailyTask.scheduledDate, dailyTask.id)
    } catch (error) {
      console.error('Routine notification job skip sync failed.', error)
    }
  }

  const consolidateOverdueTasksAfterCompletion = (dailyTask: DailyTask) => {
    if (dailyTask.scheduledDate >= today) return
    const supersededIds = new Set(dailyTasks
      .filter((task) => task.id !== dailyTask.id
        && task.petId === dailyTask.petId
        && task.taskType === dailyTask.taskType
        && task.status === 'pending'
        && task.scheduledDate <= today)
      .map((task) => task.id))
    setDailyTasks((items) => items.map((item) => {
      if (supersededIds.has(item.id)) return { ...item, status: 'skipped', skipReason: 'overdue_consolidated' }
      return item
    }))
    void settleSupersededOverdueTasks(String(userId), dailyTask, today)
      .catch((error) => console.error('Overdue routine consolidation failed; completed record was kept.', error))
      .finally(() => refreshDailyTasks())
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
    setSmartEggFertility('unfertilized')
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
      openNewClinicRecord()
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
    environmentSaveInFlight.current = false
    setEnvironmentCompletion(null)
    setEnvironmentSaving(false)
    setEnvironmentError('')
  }

  const closeWeightCompletion = () => {
    weightSaveInFlight.current = false
    setWeightCompletion(null)
    setWeightSaving(false)
    setWeightError('')
  }

  const saveSmartRecord = (record: PetRecord, message: string) => {
    const key = `${record.type}|${record.memo ?? ''}|${record.foods?.join('|') ?? ''}`
    const duplicate = records.find((item) => item.petId === record.petId && item.date === record.date && `${item.type}|${item.memo ?? ''}|${item.foods?.join('|') ?? ''}` === key)
    if (duplicate) {
      showSmartToast('이미 같은 기록이 있어요.')
      return false
    }
    saveRecordList([record, ...records])
    setSmartSheet(null)
    showSmartToast(message)
    return true
  }

  const openNewClinicRecord = () => {
    setSavedClinicDraft(null)
    setClinicDraft({
      id: crypto.randomUUID(),
      hospitalName: '다이어리 진료 기록',
      visitDate: selectedDate <= today ? selectedDate : today,
    })
    setClinicError('')
    setClinicEditorOpen(true)
  }

  const saveClinicRecord = async (draft: ClinicDraft) => {
    if (!selectedPet || !draft.visitDate || !draft.treatment?.trim()) return
    setClinicSaving(true)
    setClinicError('')
    try {
      await saveClinicToDiary({
        userId,
        clinicRecordId: draft.id,
        reviewId: draft.reviewId,
        petId: selectedPet.id,
        hospitalName: draft.hospitalName.trim(),
        visitDate: draft.visitDate,
        cost: draft.cost,
        diagnosis: draft.diagnosis?.trim(),
        treatment: draft.treatment?.trim(),
        reviewBody: undefined,
        nextVisit: draft.nextVisit,
        medicine: draft.medicine ? { ...draft.medicine, ocrRaw: undefined } : undefined,
      })
      const record: PetRecord = {
        id: draft.id,
        userId,
        petId: selectedPet.id,
        type: 'hospital',
        date: draft.visitDate,
        memo: [
          draft.diagnosis?.trim(),
          draft.treatment?.trim(),
          draft.medicine?.name ? `처방약 ${draft.medicine.name}` : '',
        ].filter(Boolean).join(' · '),
        clinicDetails: draft,
        hospitalId: draft.hospitalName.trim(),
        reviewId: draft.reviewId,
        status: 'manual',
        createdAt: new Date().toISOString(),
      }
      setRecords((current) => [record, ...current.filter((item) => item.id !== record.id)])
      setReminders((current) => {
        const withoutClinicPlan = current.filter((item) => item.id !== draft.id)
        if (!draft.nextVisit) return withoutClinicPlan
        return [...withoutClinicPlan, {
          id: draft.id,
          userId,
          petId: selectedPet.id,
          title: '다음 진료',
          reminderType: 'hospital',
          scheduleType: 'repeat',
          weekdays: [parseDateKey(draft.nextVisit.date).getDay()],
          recurrenceType: 'weekdays',
          recurrenceIntervalDays: 1,
          startDate: draft.nextVisit.date,
          endDate: draft.nextVisit.date,
          reminderDate: draft.nextVisit.date,
          reminderTime: draft.nextVisit.time,
          memo: '',
          isActive: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }]
      })
      void refreshDailyTasks()
      setSelectedDate(draft.visitDate)
      setVisibleMonth(new Date(`${draft.visitDate}T00:00:00`))
      setClinicEditorOpen(false)
      setClinicDraft(null)
      setSavedClinicDraft(draft.hospitalSnapshot ? draft : null)
      showSmartToast('진료 기록을 저장했어요.')
    } catch (error: unknown) {
      console.error('Clinic record save failed.', error)
      setClinicError('진료 기록을 저장하지 못했어요. 입력 내용은 그대로 유지했어요.')
    } finally {
      setClinicSaving(false)
    }
  }

  const makeSmartRecord = (type: PetRecordType, message: string, memo?: string, foods?: string[], photo?: string, incidentRecord?: PetRecord['incidentRecord']) => {
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
      incidentRecord,
      createdAt: new Date().toISOString(),
    }, message)
  }

  const saveSmartFood = (food: string) => makeSmartRecord('food', `${food} 먹이 기록이 저장되었습니다`, undefined, [food])
  const saveSmartPoop = (statusLabel = smartPoopStatus) => {
    if (!selectedPet) return
    const status = stoolStatusFromLabel(statusLabel)
    const record: PetRecord = {
      id: crypto.randomUUID(),
      userId,
      petId: selectedPet.id,
      type: 'poop',
      date: selectedDate,
      memo: statusLabel,
      stoolRecord: { status, statusLabel },
      createdAt: new Date().toISOString(),
    }
    const previousPoop = petRecords.slice().sort(compareRecordTime).at(-1)
    if (!saveSmartRecord(record, `배변 · ${statusLabel} 기록이 저장되었습니다`)) return
    const previousStatus = previousPoop ? getStoolStatus(previousPoop) : null
    if (status === 'normal' && previousStatus && previousStatus !== 'normal') {
      showSmartToast('배변 상태가 정상으로 돌아왔어요.')
    }
  }

  const addTemporaryPoopRoutine = (taskType: 'mist' | 'water', sourceRecordId?: string) => {
    if (!selectedPet) return
    const existing = reminders.find((reminder) => reminder.petId === selectedPet.id && reminder.reminderType === taskType && reminder.isActive)
    if (existing) {
      showSmartToast('이미 활성화된 루틴이 있어요.')
      return
    }
    const now = new Date().toISOString()
    const reminder: Reminder = {
      id: crypto.randomUUID(), userId, petId: selectedPet.id,
      title: taskType === 'mist' ? '분무 확인 · 배변 상태 임시 루틴' : '물그릇 확인 · 배변 상태 임시 루틴',
      reminderType: taskType, scheduleType: 'repeat', weekdays: [0, 1, 2, 3, 4, 5, 6],
      recurrenceType: 'interval', recurrenceIntervalDays: 1, startDate: today, reminderDate: today,
      reminderTime: '09:00', memo: '배변 상태 확인을 위한 임시 루틴', isActive: true,
      createdAt: now, updatedAt: now, purpose: 'poop_follow_up', sourceRecordId: sourceRecordId ?? petRecords.filter((record) => record.type === 'poop').sort(compareRecordTime).at(-1)?.id,
    }
    saveReminderList([...reminders, reminder])
    showSmartToast('배변 상태 확인용 임시 루틴을 추가했어요.')
  }

  const closeTemporaryPoopRoutines = () => {
    const next = reminders.map((reminder) => reminder.petId === effectivePetId && reminder.purpose === 'poop_follow_up'
      ? { ...reminder, isActive: false, updatedAt: new Date().toISOString() }
      : reminder)
    saveReminderList(next)
    setPoopFollowUp(null)
    showSmartToast('배변 상태 확인용 임시 루틴을 종료했어요.')
  }
  const saveSmartShed = (status = smartShedStatus) => {
    if (status === '탈피 완료' && !getOngoingShedRecord(petRecords)) {
      showSmartToast('탈피 시작을 먼저 기록해주세요.')
      return
    }
    makeSmartRecord('shed', `탈피 · ${status} 기록이 저장되었습니다`, status)
  }
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
    makeSmartRecord('other', `메이팅 기록이 저장되었습니다`, `메이팅 · 암컷 ${female.name} · 수컷 ${male.name} · ${female.species}`, undefined, undefined, {
      kind: 'mating',
      femalePetId: female.id,
      malePetId: male.id,
      femaleName: female.name,
      maleName: male.name,
      species: female.species,
    })
  }
  const saveSmartEgg = () => {
    const mating = matingOptions.find((option) => option.id === smartEggMatingId)
    if (smartEggFertility === 'fertilized' && !mating) return
    const fertilityLabel = smartEggFertility === 'fertilized' ? '유정란' : '무정란'
    const species = mating?.species ?? selectedPet?.species ?? ''
    const matingMemo = mating ? ` · ${mating.femaleName} · ${mating.maleName}` : ''
    makeSmartRecord('other', `${fertilityLabel} 산란 기록이 저장되었습니다`, `산란 · ${fertilityLabel}${matingMemo} · ${species}`, undefined, undefined, {
      kind: 'egg',
      fertility: smartEggFertility,
      matingRecordId: mating?.id,
      femaleName: mating?.femaleName,
      maleName: mating?.maleName,
      species,
    })
  }

  const completePlan = async (reminder: Reminder, dailyTask?: DailyTask) => {
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
    if (reminder.reminderType === 'weight') {
      setWeightCompletion({
        reminder,
        dailyTask,
        initialValue: getLatestWeightInGrams(selectedPet, petRecords),
      })
      setWeightSaving(false)
      setWeightError('')
      return
    }
    const meta = reminderMeta[reminder.reminderType]
    if (meta.inputType !== 'check') {
      setCompletingReminder(reminder)
      setCompletingDailyTask(dailyTask)
      setRecordDate(dailyTask ? today : selectedDate)
      setRecordInitialDraft(createRoutineRecordDraft(meta.recordType, selectedPet, reminder))
      setCreateType(meta.recordType)
      return
    }
    if (dailyTask && usingCarePlans) {
      if (dailyTask.status === 'completed' || completingTaskIds.current.has(dailyTask.id)) return
      completingTaskIds.current.add(dailyTask.id)
      const label = planLabel(reminder)
      const completedAt = new Date().toISOString()
      try {
        const storedRecord = await completeDailyTask(dailyTask.id)
        setRecords((items) => [storedRecord, ...items.filter((item) => item.dailyTaskId !== dailyTask.id)])
        setDailyTasks((items) => items.map((item) => item.id === dailyTask.id ? { ...item, status: 'completed', completedAt } : item))
        consolidateOverdueTasksAfterCompletion(dailyTask)
        if (dailyTask.scheduledDate >= today) void refreshDailyTasks()
        void markNotificationJobCompletedForTask(dailyTask)
        showSmartToast(`${label} 완료 기록이 저장되었습니다`)
      } catch (error) {
        console.error('Daily task completion failed.', error)
        showSmartToast('완료 상태를 저장하지 못했어요. 다시 시도해주세요.')
      } finally {
        completingTaskIds.current.delete(dailyTask.id)
      }
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
        id: crypto.randomUUID(),
        userId,
        petId: selectedPet.id,
        type: 'food',
        date: dailyTask ? today : selectedDate,
        memo: planLabel(reminder),
        foods: foodNames,
        feedingFoods: foods,
        dailyTaskId: dailyTask?.id,
        scheduledFor: dailyTask?.scheduledDate,
        occurredAt: completedAt,
        status: 'completed',
        createdAt: completedAt,
      }
      const storedRecord = dailyTask
        ? await saveDailyTaskCareRecord(userId, record)
        : (await saveAppData('care_records', userId, record, {
            pet_id: record.petId,
            record_date: record.date,
            record_type: record.type,
            memo: record.memo ?? '',
            daily_task_id: record.dailyTaskId,
            occurred_at: record.occurredAt,
            scheduled_for: record.scheduledFor,
            status: record.status ?? 'manual',
          }), record)
      setRecords([storedRecord, ...records.filter((item) => dailyTask ? item.dailyTaskId !== dailyTask.id : item.id !== storedRecord.id)])
      if (dailyTask && usingCarePlans) {
        void markNotificationJobCompletedForTask(dailyTask)
        setDailyTasks((items) => items.map((item) => item.id === dailyTask.id ? { ...item, status: 'completed', completedAt } : item))
        consolidateOverdueTasksAfterCompletion(dailyTask)
        if (dailyTask.scheduledDate >= today) void refreshDailyTasks()
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
    if (!selectedPet || !environmentCompletion || environmentSaveInFlight.current) return
    environmentSaveInFlight.current = true
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
    const risk = profile ? calculateEnvironmentRisk(metricType, value, minValue, maxValue) : { level: 0 as RiskLevel, direction: 'normal' as const, message: '자동 온습도 기준이 없어 판정 없이 기록했어요.' }
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
      id: crypto.randomUUID(),
      userId,
      petId: selectedPet.id,
      type: 'other',
      date: dailyTask ? today : selectedDate,
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
      const storedRecord = dailyTask
        ? await saveDailyTaskCareRecord(userId, record)
        : (await saveAppData('care_records', userId, record, {
            pet_id: record.petId,
            record_date: record.date,
            record_type: record.type,
            memo: record.memo ?? '',
            daily_task_id: record.dailyTaskId,
            occurred_at: record.occurredAt,
            scheduled_for: record.scheduledFor,
            status: record.status ?? 'manual',
          }), record)
      setRecords(deduplicateMeasuredRecordsByDay([
        storedRecord,
        ...records.filter((item) => dailyTask ? item.dailyTaskId !== dailyTask.id : item.id !== storedRecord.id),
      ]))
      if (dailyTask && usingCarePlans) {
        void markNotificationJobCompletedForTask(dailyTask)
        setDailyTasks((items) => items.map((item) => item.id === dailyTask.id ? { ...item, status: 'completed', completedAt } : item))
        consolidateOverdueTasksAfterCompletion(dailyTask)
        if (dailyTask.scheduledDate >= today) void refreshDailyTasks()
      } else {
        markReminderCompleted(reminder)
      }
      closeEnvironmentCompletion()
      showSmartToast(`${label} ${formatEnvironmentValue(environmentRecord)} 기록이 저장되었습니다`)
    } catch (error) {
      environmentSaveInFlight.current = false
      console.error('Environment completion failed.', error)
      setEnvironmentSaving(false)
      setEnvironmentError('환경 기록을 저장하지 못했어요. 다시 시도해주세요.')
    }
  }

  const completeWeightPlan = async (value: number) => {
    if (!selectedPet || !weightCompletion || !Number.isFinite(value) || value <= 0 || weightSaveInFlight.current) return
    weightSaveInFlight.current = true
    const { reminder, dailyTask } = weightCompletion
    const completedAt = new Date().toISOString()
    const record: PetRecord = {
      id: crypto.randomUUID(),
      userId,
      petId: selectedPet.id,
      type: 'weight',
      date: dailyTask ? today : selectedDate,
      memo: planLabel(reminder),
      weight: Math.round(value * 10) / 10,
      dailyTaskId: dailyTask?.id,
      scheduledFor: dailyTask?.scheduledDate,
      occurredAt: completedAt,
      status: 'completed',
      createdAt: completedAt,
    }
    setWeightSaving(true)
    setWeightError('')
    try {
      const storedRecord = dailyTask
        ? await saveDailyTaskCareRecord(userId, record)
        : (await saveAppData('care_records', userId, record, {
            pet_id: record.petId,
            record_date: record.date,
            record_type: record.type,
            memo: record.memo ?? '',
            daily_task_id: record.dailyTaskId,
            occurred_at: record.occurredAt,
            scheduled_for: record.scheduledFor,
            status: record.status ?? 'manual',
          }), record)
      setRecords(deduplicateMeasuredRecordsByDay([
        storedRecord,
        ...records.filter((item) => dailyTask ? item.dailyTaskId !== dailyTask.id : item.id !== storedRecord.id),
      ]))
      if (dailyTask && usingCarePlans) {
        void markNotificationJobCompletedForTask(dailyTask)
        setDailyTasks((items) => items.map((item) => item.id === dailyTask.id ? { ...item, status: 'completed', completedAt } : item))
        consolidateOverdueTasksAfterCompletion(dailyTask)
        if (dailyTask.scheduledDate >= today) void refreshDailyTasks()
      } else {
        markReminderCompleted(reminder)
      }
      closeWeightCompletion()
      showSmartToast(`무게 ${formatWeightValue(value)}g을 기록했어요`)
    } catch (error) {
      weightSaveInFlight.current = false
      console.error('Weight completion failed.', error)
      setWeightSaving(false)
      setWeightError('무게 기록을 저장하지 못했어요. 다시 시도해주세요.')
    }
  }

  const skipPlan = (dailyTask?: DailyTask) => {
    if (!dailyTask || !usingCarePlans) return
    setDailyTasks((items) => items.map((item) => item.id === dailyTask.id ? { ...item, status: 'skipped' } : item))
    void skipDailyTask(dailyTask.id)
      .then(() => {
        void markNotificationJobSkippedForTask(dailyTask)
        consolidateOverdueTasksAfterCompletion(dailyTask)
        if (dailyTask.scheduledDate >= today) void refreshDailyTasks()
      })
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
    setSelectedDate(today)
    setVisibleMonth(new Date(`${today}T00:00:00`))
    setPetMenuOpen(false)
    setSelectedRecordId(null)
    setDateDetailsOpen(false)
    setVisualizationOpen(false)
    closeFeedingCompletion()
    closeEnvironmentCompletion()
    closeWeightCompletion()
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
        onSave={async (draft) => {
          const nextMemo = getRecordMemo(draft)
          const nextFoods = draft.type === 'food' ? [...draft.foods, draft.customFood].filter(Boolean) : undefined
          const duplicate = records.some((item) => item.petId === selectedPet.id && item.date === recordDate && item.type === draft.type && (item.memo ?? '') === nextMemo && (item.foods?.join('|') ?? '') === (nextFoods?.join('|') ?? ''))
          if (duplicate && !completingDailyTask) {
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
            try {
              const storedRecord = await saveDailyTaskCareRecord(userId, taskRecord)
              setRecords((items) => [storedRecord, ...items.filter((item) => item.dailyTaskId !== completingDailyTask.id)])
              setDailyTasks((items) => items.map((item) => item.id === completingDailyTask.id ? { ...item, status: 'completed', completedAt } : item))
              consolidateOverdueTasksAfterCompletion(completingDailyTask)
              if (completingDailyTask.scheduledDate >= today) void refreshDailyTasks()
              void markNotificationJobCompletedForTask(completingDailyTask)
            } catch (error) {
              console.error('Typed routine completion failed.', error)
              showSmartToast('완료 상태를 저장하지 못했어요. 입력 내용은 유지되어 있습니다.')
              return
            }
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

  const dateRecordsView = dateDetailsOpen ? (
    <DateRecordsScreen
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
      mobileActions={!readOnly ? (
        <>
          <DailyPlan
            pet={selectedPet}
            tasks={planReminders}
            selectedDate={selectedDate}
            hasCarePlans={petCarePlans.length > 0}
            onAddPlan={openReminderCreate}
            onEditPlan={(reminder) => {
              setEditingReminder(reminder)
              setRoutinePresetType(null)
              setReminderFormOpen(true)
            }}
            onDeletePlan={removePlan}
            onComplete={(item) => completePlan(item.reminder, item.dailyTask)}
            onSkip={(item) => skipPlan(item.dailyTask)}
          />
          <IncidentAddBar pet={selectedPet} disabled={selectedDate > today} onOpen={openSmartAdd} onOpenRoutine={openIncidentRoutine} />
        </>
      ) : null}
    />
  ) : null

  if (visualizationOpen) {
    return <DataVisualizationScreen
      records={petRecords}
      petName={selectedPet?.name ?? '펫'}
      onBack={() => setVisualizationOpen(false)}
      onCreateQna={selectedPet && onCreateQna ? (metric) => onCreateQna(selectedPet.id, metric === 'shed' ? { category: '질병', title: '탈피 관련 질문' } : metric === 'poop' ? { category: '질병', title: '배변 관련 질문' } : undefined) : undefined}
      onFindHospital={selectedPet && onFindHospital ? (concern) => onFindHospital(selectedPet.id, concern) : undefined}
      onShedComplete={() => saveShedCheckRecord('탈피 완료')}
      onShedNotYet={() => saveShedCheckRecord('탈피 확인 · 완료 안됨')}
      resolvedInsightIds={resolvedInsightIds}
      followedUpInsightIds={followedUpInsightIds}
      onFollowUpInsight={markDiaryInsightFollowUp}
      onResolveInsight={resolveDiaryInsight}
      onKeepInsight={keepDiaryInsight}
    />
  }

  return (
    <section className="diary-page">
      {dateRecordsView ?? (mobileLayout ? (
        <>
          <DiaryMobileScreen
            petName={selectedPet?.name ?? '펫 선택'}
            petPhoto={selectedPet?.photo}
            canChangePet={!readOnly && pets.length > 1}
            calendarOpen={mobileView === 'calendar'}
            days={mobileDays}
            alert={mobileAlert}
            routines={mobileRoutines}
            quickActions={mobileQuickActions}
            agenda={mobileAgenda}
            selectedDateLabel={formatMobileAgendaDate(selectedDate)}
            predictions={mobilePredictions}
            calendar={<Calendar mobileMode month={visibleMonth} selectedDate={selectedDate} records={calendarPetRecords} cyclePredictions={calendarCyclePredictions} onMove={(amount) => setVisibleMonth(new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + amount, 1))} onSelect={(date) => setSelectedDate(date)} />}
            onChangePet={() => setPetMenuOpen(true)}
            onToggleCalendar={() => setMobileView((view) => view === 'calendar' ? 'plan' : 'calendar')}
            onSelectDate={(date) => { setSelectedDate(date); setVisibleMonth(parseDateKey(date)) }}
            onToggleRoutine={(id) => { const item = planReminders.find((candidate) => (candidate.dailyTask?.id ?? candidate.reminder.id) === id); if (item) void completePlan(item.reminder, item.dailyTask) }}
          />
          {petMenuOpen && selectedPet && <PetMenuDrawer currentPet={selectedPet} pets={pets} selectedPetId={effectivePetId} onClose={() => setPetMenuOpen(false)} onSelect={switchPet} />}
        </>
      ) : (
        <>
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

      <DiaryNotice
        records={petRecords}
        reminders={petCarePlans}
        petName={selectedPet?.name ?? '펫'}
        resolvedInsightIds={resolvedInsightIds}
        followedUpInsightIds={followedUpInsightIds}
        onShedComplete={() => saveShedCheckRecord('탈피 완료')}
        onShedNotYet={() => saveShedCheckRecord('탈피 확인 · 완료 안됨')}
        onFollowUpInsight={markDiaryInsightFollowUp}
        onResolveInsight={resolveDiaryInsight}
        onKeepInsight={keepDiaryInsight}
        onCreateQna={selectedPet && onCreateQna ? (metric) => onCreateQna(selectedPet.id, metric === 'shed' ? { category: '질병', title: '탈피 관련 질문' } : metric === 'poop' ? { category: '질병', title: '배변 관련 질문' } : undefined) : undefined}
        onFindHospital={selectedPet && onFindHospital ? (concern) => onFindHospital(selectedPet.id, concern) : undefined}
        onRecordEnvironment={() => {
          const environmentRoutine = petCarePlans.find((reminder) => reminder.isActive && (reminder.reminderType === 'humidity' || reminder.reminderType === 'temperature'))
          if (environmentRoutine) void completePlan(environmentRoutine)
          else { setEditingReminder(null); setRoutinePresetType('humidity'); setReminderFormOpen(true) }
        }}
        onAddTemporaryRoutine={(type, sourceRecordId) => addTemporaryPoopRoutine(type, sourceRecordId)}
        onOpenRecords={() => setVisualizationOpen(true)}
        onKeepTemporaryRoutines={(insightId) => { resolveDiaryInsight(insightId); showSmartToast('임시 루틴을 유지합니다.') }}
        onCloseTemporaryRoutines={(insightId) => { closeTemporaryPoopRoutines(); resolveDiaryInsight(insightId) }}
      />

      {!readOnly && (
        <NotificationOptInNudge
          userId={userId}
          hasActiveRoutines={petCarePlans.some((reminder) => reminder.isActive)}
        />
      )}

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
                key={effectivePetId}
                month={visibleMonth}
                selectedDate={selectedDate}
                records={calendarPetRecords}
                cyclePredictions={calendarCyclePredictions}
                onMove={(amount) => setVisibleMonth(new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + amount, 1))}
                onSelect={(date) => { if (date === selectedDate) setDateDetailsOpen(true); else setSelectedDate(date) }}
              />
            </main>
            <aside className="diary-detail-panel">
              {!readOnly && <DailyPlan pet={selectedPet} tasks={planReminders} selectedDate={selectedDate} hasCarePlans={petCarePlans.length > 0} onAddPlan={openReminderCreate} onEditPlan={(reminder) => { setEditingReminder(reminder); setRoutinePresetType(null); setReminderFormOpen(true) }} onDeletePlan={removePlan} onComplete={(item) => completePlan(item.reminder, item.dailyTask)} onSkip={(item) => skipPlan(item.dailyTask)} />}
              {!readOnly && <IncidentAddBar pet={selectedPet} disabled={selectedDate > today} onOpen={openSmartAdd} onOpenRoutine={openIncidentRoutine} />}
            </aside>
          </div>
        </div>
      </div>

        </>
      ))}

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
            canCompleteShed={Boolean(getOngoingShedRecord(petRecords))}
            matingFemaleId={smartMatingFemaleId}
            matingMaleId={smartMatingMaleId}
            eggMatingId={smartEggMatingId}
            eggFertility={smartEggFertility}
            onFoodKind={setSmartFoodKind}
            onFoodQuantity={setSmartFoodQuantity}
            onFoodUnit={setSmartFoodUnit}
            onPoopStatus={setSmartPoopStatus}
            onShedStatus={setSmartShedStatus}
            onMatingFemale={setSmartMatingFemaleId}
            onMatingMale={setSmartMatingMaleId}
            onEggMating={setSmartEggMatingId}
            onEggFertility={setSmartEggFertility}
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
      {clinicEditorOpen && clinicDraft && selectedPet && (
        <Overlay onClose={() => {
          if (clinicSaving) return
          setClinicEditorOpen(false)
          setClinicDraft(null)
          setClinicError('')
        }}>
          <ClinicRecordEditor
            petName={selectedPet.name}
            draft={clinicDraft}
            saving={clinicSaving}
            error={clinicError}
            onChange={setClinicDraft}
            onCancel={() => {
              if (clinicSaving) return
              setClinicEditorOpen(false)
              setClinicDraft(null)
              setClinicError('')
            }}
            onSave={() => void saveClinicRecord(clinicDraft)}
          />
        </Overlay>
      )}
      {savedClinicDraft && selectedPet && (
        <Overlay onClose={() => setSavedClinicDraft(null)}>
          <ClinicRecordNextActions
            hospitalName={savedClinicDraft.hospitalName}
            onClose={() => setSavedClinicDraft(null)}
            onCreateReview={() => {
              const hospital = savedClinicDraft.hospitalSnapshot
                ?? hospitals.find((item) => item.name === savedClinicDraft.hospitalName)
              if (!hospital || !onCreateClinicReview) return
              onCreateClinicReview(hospital, {
                id: crypto.randomUUID(),
                hospitalId: hospital.id ?? hospital.name,
                userId,
                petId: selectedPet.id,
                petName: selectedPet.name,
                clinicRecordId: savedClinicDraft.id,
                author: '',
                rating: 5,
                visitDate: savedClinicDraft.visitDate,
                nextVisitDate: savedClinicDraft.nextVisit?.date,
                nextVisitTime: savedClinicDraft.nextVisit?.time,
                cost: savedClinicDraft.cost,
                diagnosis: savedClinicDraft.diagnosis,
                treatment: savedClinicDraft.treatment,
                body: '',
                hospitalName: hospital.name,
                hospitalSnapshot: hospital,
                createdAt: new Date().toISOString(),
              })
              setSavedClinicDraft(null)
            }}
            reviewDisabled={!onCreateClinicReview || !(savedClinicDraft.hospitalSnapshot ?? hospitals.find((item) => item.name === savedClinicDraft.hospitalName))}
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
      {weightCompletion && selectedPet && (
        <Overlay onClose={closeWeightCompletion}>
          <WeightInputDialog
            petName={selectedPet.name}
            initialValue={weightCompletion.initialValue}
            saving={weightSaving}
            error={weightError}
            onCancel={closeWeightCompletion}
            onComplete={completeWeightPlan}
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
      {poopFollowUp && selectedPet && (
        <Overlay onClose={() => setPoopFollowUp(null)}>
          <PoopFollowUpPanel
            followUp={poopFollowUp}
            records={petRecords}
            reminders={reminders.filter((reminder) => reminder.petId === selectedPet.id)}
            onClose={() => setPoopFollowUp(null)}
            onOpenRecords={() => { setPoopFollowUp(null); setVisualizationOpen(true) }}
            onCreateQna={() => onCreateQna?.(selectedPet.id, { category: '질병', title: `${selectedPet.name} 배변 기록 관련 질문` })}
            onFindHospital={() => onFindHospital?.(selectedPet.id, 'poop')}
            onAddRoutine={addTemporaryPoopRoutine}
            onKeepRoutines={() => setPoopFollowUp(null)}
            onCloseRoutines={closeTemporaryPoopRoutines}
          />
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
  onSkip: (task: { reminder: Reminder; overdue: boolean; dailyTask?: DailyTask }) => void
}) {
  const [listOpen, setListOpen] = useState(false)
  const isFuture = selectedDate > toDateKey(new Date())
  const overdueTasks = tasks.filter((task) => task.overdue && (task.dailyTask
    ? task.dailyTask.status === 'pending'
    : task.reminder.completedAt?.slice(0, 10) !== selectedDate))
  const isTaskCompleted = (task: { reminder: Reminder; dailyTask?: DailyTask }) => task.dailyTask
    ? task.dailyTask.status === 'completed'
    : task.reminder.completedAt?.slice(0, 10) === selectedDate
  const pendingTodayTasks = tasks.filter((task) => !task.overdue && (task.dailyTask
    ? task.dailyTask.status === 'pending'
    : !isTaskCompleted(task)))
  const completedTodayTasks = tasks.filter((task) => !task.overdue && isTaskCompleted(task))
  const todayTasks = pendingTodayTasks
  const doneToggle = (
    <button
      className="daily-plan-list-toggle"
      type="button"
      aria-haspopup="dialog"
      onClick={() => setListOpen(true)}
    >
      <strong>한 일</strong>
      <span className="daily-plan-list-toggle-state">{completedTodayTasks.length}</span>
    </button>
  )
  const renderTask = (task: { reminder: Reminder; overdue: boolean; dailyTask?: DailyTask }) => {
    const { reminder, overdue, dailyTask } = task
    const checked = isTaskCompleted(task)
    const completedTime = checked && (dailyTask?.completedAt ?? reminder.completedAt)
      ? new Date(dailyTask?.completedAt ?? reminder.completedAt ?? '').toLocaleTimeString('ko-KR', { hour: 'numeric', minute: '2-digit' })
      : ''
    const overdueDays = dailyTask ? Math.max(1, daysBetween(dailyTask.scheduledDate, toDateKey(new Date()))) : 1
    const overdueStage = overdueDays >= 7 ? Math.min(5, overdueDays - 6) : 0
    const taskDescription = overdue
      ? `${overdueDays}일 지남${overdueStage > 0 ? ` · ${overdueStage}단계` : ''}`
      : checked
        ? `${completedTime || '완료'} · 완료한 루틴`
      : reminder.reminderType === 'medicine'
        ? `${dailyTask?.scheduledDate ?? selectedDate} · ${dailyTask?.occurrenceNo ?? 1}회차`
        : formatPlanDays(reminder)
    return <div className={`daily-plan-task-row ${overdue ? 'overdue' : ''}`} key={`${reminder.id}-${dailyTask?.id ?? selectedDate}`}>
      <div className={`daily-plan-task ${routinePhotoKeys[reminder.reminderType] ? 'has-routine-photo' : ''}`}>
        <RoutinePhoto type={reminder.reminderType} className="daily-plan-routine-photo" />
        <span className="daily-plan-task-content">
          <span className="daily-plan-title-line">
            <strong>{planLabel(reminder, pet)}</strong>
          </span>
          {(overdue || checked) && <small>{taskDescription}</small>}
        </span>
        {!overdue && <label className="daily-plan-check-wrap">
          <span className={`daily-plan-check ${checked ? 'checked' : ''}`} aria-hidden="true">{checked ? '✓' : ''}</span>
          <input className="daily-plan-check-input" type="checkbox" checked={checked} disabled={isFuture || checked} onChange={() => onComplete(task)} aria-label={`${planLabel(reminder, pet)} ${checked ? '완료됨' : '완료'}`} />
        </label>}
        <details className="daily-task-menu">
          <summary aria-label={`${planLabel(reminder, pet)} 메뉴`} title="루틴 메뉴"><span className="menu-dots" aria-hidden="true"><span /><span /><span /></span></summary>
          <div>
            <button type="button" onClick={() => onEditPlan(reminder)}>수정</button>
            <button type="button" onClick={() => onDeletePlan(reminder.id)}>삭제</button>
          </div>
        </details>
      </div>
      {overdue && !checked && <div className="daily-plan-task-actions"><button type="button" onClick={() => onComplete(task)}>지금 완료</button><button type="button" onClick={() => onSkip(task)}>건너뛰기</button></div>}
    </div>
  }

  return (
    <>
      <section className="daily-plan-panel">
        <div className="daily-plan-heading"><span><strong>오늘 할 일</strong><small>{formatDate(selectedDate)}</small></span><em>전체 {pendingTodayTasks.length + overdueTasks.length}개</em></div>
        <header><button className="daily-plan-add-button" type="button" onClick={onAddPlan}>루틴</button>{doneToggle}</header>
        {hasCarePlans && (
          <div className="daily-plan-inline-list">
            {overdueTasks.length > 0 && <div className="daily-plan-list">{overdueTasks.map(renderTask)}</div>}
            {todayTasks.length > 0 && <div className="daily-plan-list">{todayTasks.map(renderTask)}</div>}
            {overdueTasks.length === 0 && todayTasks.length === 0 && (
              <button className="daily-plan-completed-summary" type="button" onClick={() => setListOpen(true)}>
                {tasks.some((task) => !task.overdue && isTaskCompleted(task)) ? '오늘 할 일을 모두 마쳤어요.' : '오늘 예정된 일이 없어요.'}
              </button>
            )}
          </div>
        )}
      </section>
      {listOpen && (
        <Overlay onClose={() => setListOpen(false)}>
          <section className="daily-plan-dialog" role="dialog" aria-modal="true" aria-labelledby="daily-plan-dialog-title">
            <header>
              <div><h2 id="daily-plan-dialog-title">오늘 한 일</h2><p>{formatDate(selectedDate)}</p></div>
            </header>
            {!hasCarePlans ? (
              <div className="daily-plan-first-empty"><strong>아직 반복 일정이 없어요.</strong></div>
            ) : (
              <div className="daily-plan-list-content">
                <section className="daily-task-group today-task-group">{completedTodayTasks.length ? <div className="daily-plan-list">{completedTodayTasks.map(renderTask)}</div> : <p className="daily-plan-empty">아직 완료한 일이 없어요.</p>}</section>
              </div>
            )}
          </section>
        </Overlay>
      )}
    </>
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
      <header><div><h2>반복 일정</h2><p>반복 규칙을 정해두면 오늘 할 일로 보여요.</p></div>{petPlans.length > 0 && <button type="button" onClick={onAdd}>루틴</button>}</header>
      {petPlans.length ? <div className="care-plan-list">{petPlans.map((plan) => (
        <article className={`${!plan.isActive ? 'inactive' : ''} ${routinePhotoKeys[plan.reminderType] ? 'has-routine-photo' : ''}`} key={plan.id}>
          <div className="care-plan-summary"><RoutinePhoto type={plan.reminderType} className="care-plan-routine-photo" /><span><strong>{planLabel(plan)}</strong><span>{formatPlanDays(plan)}</span></span></div>
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
  if (plan.recurrenceType === 'interval') return `${Math.max(1, plan.recurrenceIntervalDays ?? 1)}일마다`
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
    .filter((record) => isMatingRecord(record) && pets.some((pet) => pet.id === record.petId && normalizeSpecies(pet.species) === selectedSpecies))
    .map((record) => {
      if (record.incidentRecord?.kind === 'mating') {
        const mating = record.incidentRecord
        return {
          id: record.id,
          femaleName: mating.femaleName,
          maleName: mating.maleName,
          species: mating.species,
          label: `${formatDate(record.date)} · ${mating.femaleName} × ${mating.maleName}`,
        }
      }
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

function isMatingRecord(record: PetRecord) {
  return record.incidentRecord?.kind === 'mating' || (record.type === 'other' && record.memo?.startsWith('메이팅 · '))
}

function isEggRecord(record: PetRecord) {
  return record.incidentRecord?.kind === 'egg' || (record.type === 'other' && record.memo?.startsWith('산란 · '))
}

function eggFertility(record: PetRecord): 'unfertilized' | 'fertilized' | 'unknown' {
  if (record.incidentRecord?.kind === 'egg') return record.incidentRecord.fertility
  if (record.memo?.includes('무정란')) return 'unfertilized'
  if (record.memo?.includes('유정란')) return 'fertilized'
  return 'unknown'
}

function planLabel(reminder: Reminder, pet?: DiaryPet, speciesProfiles: SpeciesCareProfile[] = fallbackSpeciesCareProfiles) {
  if (reminder.reminderType === 'medicine' || reminder.reminderType === 'hospital') return reminder.title || reminderMeta[reminder.reminderType].label
  if (reminder.reminderType === 'custom') return reminder.title || '직접 입력'
  if (reminder.reminderType === 'partial_cleaning' || reminder.reminderType === 'full_cleaning') return '청소'
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

function ClinicRecordEditor({
  petName,
  draft,
  saving,
  error,
  onChange,
  onCancel,
  onSave,
}: {
  petName: string
  draft: ClinicDraft
  saving: boolean
  error: string
  onChange: (draft: ClinicDraft) => void
  onCancel: () => void
  onSave: () => void
}) {
  const update = (patch: Partial<ClinicDraft>) => onChange({ ...draft, ...patch })
  const canSave = Boolean(
    draft.visitDate
    && draft.treatment?.trim()
    && (!draft.nextVisit || draft.nextVisit.date)
    && (!draft.medicine?.name || (draft.medicine.startDate && draft.medicine.endDate && draft.medicine.dailyCount >= 1))
  )

  return (
    <section className="clinic-record-editor" role="dialog" aria-modal="true" aria-labelledby="clinic-record-editor-title">
      <header>
        <div>
          <h2 id="clinic-record-editor-title">진료 기록 작성</h2>
          <p>{petName}</p>
        </div>
        <button type="button" aria-label="진료 기록 닫기" onClick={onCancel}>×</button>
      </header>
      <div className="clinic-record-fields">
        <label>방문 날짜 <span aria-label="필수">*</span><input type="date" value={draft.visitDate} onChange={(event) => update({ visitDate: event.target.value })} /></label>
        <label>병명<input value={draft.diagnosis ?? ''} onChange={(event) => update({ diagnosis: event.target.value })} placeholder="진단받은 병명을 입력하세요" /></label>
        <label>진료 내용 <span aria-label="필수">*</span><textarea value={draft.treatment ?? ''} onChange={(event) => update({ treatment: event.target.value })} placeholder="검사와 진료 내용을 입력하세요" /></label>
        <fieldset>
          <legend>처방약과 약 루틴</legend>
          <label>처방약<input value={draft.medicine?.name ?? ''} onChange={(event) => update({ medicine: event.target.value ? { name: event.target.value, dose: draft.medicine?.dose, startDate: draft.medicine?.startDate || draft.visitDate, endDate: draft.medicine?.endDate, dailyCount: draft.medicine?.dailyCount || 1, instructions: draft.medicine?.instructions } : undefined })} placeholder="약 이름" /></label>
          {draft.medicine && <><div className="clinic-record-row"><label>복용량<input value={draft.medicine.dose ?? ''} onChange={(event) => update({ medicine: { ...draft.medicine!, dose: event.target.value } })} placeholder="예: 0.2ml" /></label><label>하루 횟수<input type="number" min="1" value={draft.medicine.dailyCount} onChange={(event) => update({ medicine: { ...draft.medicine!, dailyCount: Math.max(1, Number(event.target.value) || 1) } })} /></label></div><div className="clinic-record-row"><label>복용 시작일<input type="date" value={draft.medicine.startDate} onChange={(event) => update({ medicine: { ...draft.medicine!, startDate: event.target.value } })} /></label><label>복용 종료일<input type="date" min={draft.medicine.startDate} value={draft.medicine.endDate ?? ''} onChange={(event) => update({ medicine: { ...draft.medicine!, endDate: event.target.value || undefined } })} /></label></div><label>복용 안내<input value={draft.medicine.instructions ?? ''} onChange={(event) => update({ medicine: { ...draft.medicine!, instructions: event.target.value } })} placeholder="투약 방법이나 주의사항" /></label><small>저장하면 기존 약 루틴에 연결됩니다.</small></>}
        </fieldset>
        <fieldset>
          <legend>다음 예정일이 있나요?</legend>
          <div className="clinic-record-choice">
            <button type="button" className={draft.nextVisit ? 'active' : ''} aria-pressed={Boolean(draft.nextVisit)} onClick={() => update({ nextVisit: draft.nextVisit ?? { date: '', time: '09:00' } })}>예</button>
            <button type="button" className={!draft.nextVisit ? 'active' : ''} aria-pressed={!draft.nextVisit} onClick={() => update({ nextVisit: undefined })}>아니요</button>
          </div>
          {draft.nextVisit && (
            <div className="clinic-record-row">
              <label>다음 진료일<input type="date" value={draft.nextVisit.date} onChange={(event) => update({ nextVisit: { ...draft.nextVisit!, date: event.target.value } })} /></label>
              <label>알림 시간<input type="time" value={draft.nextVisit.time} onChange={(event) => update({ nextVisit: { ...draft.nextVisit!, time: event.target.value } })} /></label>
            </div>
          )}
        </fieldset>
      </div>
      {error && <p className="clinic-record-error" role="alert">{error}</p>}
      <footer>
        <button type="button" onClick={onCancel} disabled={saving}>취소</button>
        <button type="button" onClick={onSave} disabled={!canSave || saving}>{saving ? '저장 중' : '진료 기록 저장'}</button>
      </footer>
    </section>
  )
}

function ClinicRecordNextActions({
  hospitalName,
  reviewDisabled,
  onCreateReview,
  onClose,
}: {
  hospitalName: string
  reviewDisabled: boolean
  onCreateReview: () => void
  onClose: () => void
}) {
  return (
    <section className="clinic-record-next-actions" role="dialog" aria-modal="true" aria-labelledby="clinic-record-next-title">
      <header>
        <div>
          <h2 id="clinic-record-next-title">진료 기록을 저장했어요</h2>
          <p>{hospitalName}</p>
        </div>
        <button type="button" aria-label="후속 작업 닫기" onClick={onClose}>×</button>
      </header>
      <div className="clinic-record-next-buttons">
        <button type="button" onClick={onCreateReview} disabled={reviewDisabled}>리뷰 작성하러 가기</button>
      </div>
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
  canCompleteShed,
  matingFemaleId,
  matingMaleId,
  eggMatingId,
  eggFertility,
  onFoodKind,
  onFoodQuantity,
  onFoodUnit,
  onPoopStatus,
  onShedStatus,
  onMatingFemale,
  onMatingMale,
  onEggMating,
  onEggFertility,
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
  canCompleteShed: boolean
  matingFemaleId: string
  matingMaleId: string
  eggMatingId: string
  eggFertility: 'unfertilized' | 'fertilized'
  onFoodKind: (value: string) => void
  onFoodQuantity: (value: string) => void
  onFoodUnit: (value: string) => void
  onPoopStatus: (value: string) => void
  onShedStatus: (value: string) => void
  onMatingFemale: (value: string) => void
  onMatingMale: (value: string) => void
  onEggMating: (value: string) => void
  onEggFertility: (value: 'unfertilized' | 'fertilized') => void
  onFoodSave: (value: string) => void
  onWaterSave: (value: string) => void
  onCleaningSave: (value: string) => void
  onPoopSave: (status: string) => void
  onShedSave: (status: string) => void
  onMatingSave: () => void
  onEggSave: () => void
}) {
  const foodOptions = ['밀웜', '귀뚜라미', '랩사료']
  const poopOptions = ['정상', '건조', '묽음', '이물질', '혈변']
  const shedOptions = ['탈피 시작', '탈피 완료', '이상 있음']
  const waterOptions = ['전체 교체', '일부 보충', '물그릇 세척']
  const cleaningOptions = ['청소']
  const foodValue = foodKind.trim() ? `${foodKind.trim()} ${foodQuantity || '1'}${foodUnit}` : ''
  const femaleCandidates = matingPetCandidates.filter((candidate) => candidate.gender === 'female')
  const maleCandidates = matingPetCandidates.filter((candidate) => candidate.gender === 'male')
  const matingReady = Boolean(matingFemaleId && matingMaleId && matingFemaleId !== matingMaleId)
  const eggReady = eggFertility === 'unfertilized' || Boolean(eggMatingId)

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
      {kind === 'shed' && <div className="smart-choice-list">{shedOptions.map((status) => {
        const disabled = status === '탈피 완료' && !canCompleteShed
        return <button type="button" className={shedStatus === status ? 'selected' : ''} key={status} disabled={disabled} aria-disabled={disabled} title={disabled ? '탈피 시작을 먼저 기록해주세요' : undefined} onClick={() => { onShedStatus(status); onShedSave(status) }}>{status}</button>
      })}</div>}
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
          <strong>알 상태</strong>
          <div className="smart-choice-list" aria-label="산란 상태">
            <button type="button" aria-pressed={eggFertility === 'unfertilized'} className={eggFertility === 'unfertilized' ? 'selected' : ''} onClick={() => { onEggFertility('unfertilized'); onEggMating('') }}>무정란</button>
            <button type="button" aria-pressed={eggFertility === 'fertilized'} className={eggFertility === 'fertilized' ? 'selected' : ''} disabled={matingOptions.length === 0} title={matingOptions.length === 0 ? '메이팅 기록이 있어야 선택할 수 있어요' : undefined} onClick={() => onEggFertility('fertilized')}>유정란</button>
          </div>
          {matingOptions.length === 0 && <p className="smart-empty">메이팅 기록이 없어 무정란만 기록할 수 있어요.</p>}
          {eggFertility === 'fertilized' && matingOptions.length > 0 && <><strong>연결할 메이팅</strong><div className="smart-choice-list">{matingOptions.map((option) => <button type="button" className={eggMatingId === option.id ? 'selected' : ''} key={option.id} onClick={() => onEggMating(option.id)}>{option.label}</button>)}</div></>}
          {eggReady && <button className="smart-save-button" type="button" onClick={onEggSave}>산란 기록</button>}
        </div>
      )}
      {kind === 'water' && <div className="smart-choice-list">{waterOptions.map((option) => <button type="button" key={option} onClick={() => onWaterSave(option)}>{option}</button>)}</div>}
      {kind === 'cleaning' && <div className="smart-choice-list">{cleaningOptions.map((option) => <button type="button" key={option} onClick={() => onCleaningSave(option)}>{option}</button>)}</div>}
    </div>
  )
}

function Calendar({
  mobileMode = false,
  month,
  selectedDate,
  records,
  cyclePredictions,
  onMove,
  onSelect,
}: {
  mobileMode?: boolean
  month: Date
  selectedDate: string
  records: PetRecord[]
  cyclePredictions: CalendarCyclePrediction[]
  onMove: (amount: number) => void
  onSelect: (date: string) => void
}) {
  const todayKey = toDateKey(new Date())
  const renderRecordTags = (day: Date) => {
    const key = toDateKey(day)
    const dayRecords = records.filter((record) => record.date === key)
    const dayPredictions = cyclePredictions.filter((prediction) => prediction.date === key)
    const calendarItems = dayRecords
      .map((record) => ({ id: record.id, ...calendarRecordTag(record) }))
      .filter((item, index, items) => index === items.findIndex((value) => value.label === item.label))
    const predictionItems = dayPredictions.map((prediction) => ({
      id: `prediction-${prediction.type}-${prediction.date}`,
      icon: prediction.type === 'shed' ? '◌' : '◇',
      iconSrc: undefined,
      iconIsRoutineCard: false,
      label: prediction.label,
      className: `cycle-prediction ${prediction.type}`,
    }))
    const allItems = [...predictionItems, ...calendarItems]
    const visibleItems = allItems.slice(0, 2)
    const hiddenItemCount = Math.max(0, allItems.length - visibleItems.length)

    return (
      <span className="calendar-tags" aria-label={`${dayRecords.length}개 기록${dayPredictions.length ? `, 예상 주기 ${dayPredictions.length}개` : ''}`}>
        {visibleItems.map((item) => (
          <small className={`calendar-tag ${item.className}`} key={item.id}>
            {item.iconSrc ? <img className={item.iconIsRoutineCard ? 'routine-record-mark-image' : ''} src={item.iconSrc} alt="" aria-hidden="true" /> : item.icon ? <i>{item.icon}</i> : null}
            <b>{item.label}</b>
          </small>
        ))}
        {hiddenItemCount > 0 && <small className="calendar-tag-more">+{hiddenItemCount}</small>}
      </span>
    )
  }

  return (
    <section className="calendar-month">
      <ReactCalendar
        activeStartDate={new Date(month.getFullYear(), month.getMonth(), 1)}
        calendarType={mobileMode ? 'iso8601' : 'gregory'}
        locale="ko-KR"
        minDetail="decade"
        maxDetail="month"
        next2Label={null}
        prev2Label={null}
        nextLabel="›"
        prevLabel="‹"
        showFixedNumberOfWeeks
        showNeighboringMonth
        value={new Date(`${selectedDate}T00:00:00`)}
        formatDay={(_, date) => String(date.getDate())}
        formatMonthYear={(_, date) => `${date.getFullYear()}년 ${date.getMonth() + 1}월`}
        formatShortWeekday={(_, date) => weekdays[date.getDay()]}
        onActiveStartDateChange={({ activeStartDate, view }) => {
          if (!activeStartDate || view !== 'month') return
          const difference = (activeStartDate.getFullYear() - month.getFullYear()) * 12
            + activeStartDate.getMonth() - month.getMonth()
          if (difference !== 0) onMove(difference)
        }}
        onClickDay={(date) => onSelect(toDateKey(date))}
        tileClassName={({ date, view }) => {
          if (view !== 'month') return undefined
          const key = toDateKey(date)
          const predictionTypes = cyclePredictions.flatMap((prediction) => key >= prediction.startDate && key <= prediction.endDate ? [
            `expected-${prediction.type}`,
            `expected-range-${prediction.type}`,
            key === prediction.startDate ? 'expected-range-start' : '',
            key === prediction.endDate ? 'expected-range-end' : '',
          ] : []).filter(Boolean).join(' ')
          const hasClinicPlan = records.some((record) => record.date === key && record.type === 'hospital' && record.memo === '진료 예정')
          return `calendar-day ${key === todayKey ? 'today' : ''} ${key === selectedDate ? 'selected' : ''} ${date.getMonth() !== month.getMonth() ? 'muted' : ''} ${predictionTypes} ${hasClinicPlan ? 'expected-clinic' : ''}`
        }}
        tileContent={({ date, view }) => view === 'month' ? renderRecordTags(date) : null}
      />
      {(cyclePredictions.length > 0 || records.some((record) => record.type === 'hospital' && record.memo === '진료 예정')) && <div className="calendar-cycle-legend" aria-label="예정일 색상 안내"><span className="clinic"><i />다음 진료일</span><span className="shed"><i />탈피 예상일</span><span className="egg"><i />산란 예상일</span></div>}
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
  const tag = calendarRecordTag(record)
  return (
    <main className="diary-create-screen record-detail-screen">
      <header>
        <button type="button" aria-label="뒤로가기" onClick={onBack}>←</button>
        <strong>상세 보기</strong>
        <span />
      </header>
      <section className="record-detail-view">
        <div className="record-detail-title">
          <span className="record-detail-mark">{tag.iconSrc ? <img className={tag.iconIsRoutineCard ? 'routine-record-mark-image' : ''} src={tag.iconSrc} alt="" aria-hidden="true" /> : tag.icon}</span>
          <div>
            <h1>{tag.label}</h1>
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
              <div><dt>환경 단계</dt><dd>{record.environmentRecord.riskLevel <= 1 ? '1단계 · 정상' : `${record.environmentRecord.riskLevel}단계 · ${environmentRiskLabel(record.environmentRecord.riskLevel)}`}</dd></div>
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
  if (draft.type === 'hospital') return <label>병원<span className="required-mark" aria-label="필수">*</span><input value={draft.hospital} onChange={(event) => update({ hospital: event.target.value })} placeholder="병원 이름" required /></label>
  if (draft.hospital === 'UVB 확인') return <ChoiceField label="UVB 상태를 선택하세요" options={['정상', '고장']} values={[draft.status]} onChange={([status]) => update({ status })} />
  return <label>기록 내용<span className="required-mark" aria-label="필수">*</span><input value={draft.hospital} onChange={(event) => update({ hospital: event.target.value })} placeholder="확인한 값이나 상태를 짧게 입력" required /></label>
}

function WeightField({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const adjust = (amount: number) => {
    const current = Number(value || 0)
    const next = Math.max(0, Math.round((current + amount) * 10) / 10)
    onChange(formatWeightValue(next))
  }

  return (
    <div className="weight-step-field">
      <label>무게<span className="required-mark" aria-label="필수">*</span><input type="number" min="0" step="0.1" value={value} onChange={(event) => onChange(event.target.value)} placeholder="g" required /></label>
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
  const requiredRoutineTypes: ReminderType[] = ['feed', 'mist', 'cleaning']
  const normalizedExistingTypes = new Set<ReminderType>()
  existingTypes.forEach((type) => {
    normalizedExistingTypes.add(type === 'partial_cleaning' || type === 'full_cleaning' ? 'cleaning' : type)
  })
  const missingRequiredTypes = requiredRoutineTypes.filter((type) => !normalizedExistingTypes.has(type))
  const [routineTypes, setRoutineTypes] = useState<ReminderType[]>(initialType ? [initialType] : missingRequiredTypes)
  const [selectedWeekdays, setSelectedWeekdays] = useState<number[]>(initialReminder?.weekdays ?? [])
  const [recurrenceType, setRecurrenceType] = useState<'weekdays' | 'interval'>(initialReminder?.recurrenceType ?? 'weekdays')
  const [recurrenceIntervalDays, setRecurrenceIntervalDays] = useState(initialReminder?.recurrenceIntervalDays ?? 3)
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
    && (isHospitalRoutine
      ? appointmentDate
      : recurrenceType === 'interval'
        ? recurrenceIntervalDays >= 1
        : selectedWeekdays.length > 0)
    && startDate
    && (!endDate || endDate >= startDate)
    && (!isMedicineRoutine || Boolean(endDate))
    && (!hasCustomRoutine || (customRoutineName.trim().length > 0 && !customRoutineExists))
    && (isEditingRoutine || (!isMedicineRoutine && !isHospitalRoutine) || specialRoutineName.trim().length > 0)
  )
  const toggleRoutineType = (type: ReminderType) => {
    if (initialReminder) {
      setRoutineTypes([type])
      return
    }
    if (missingRequiredTypes.includes(type) && routineTypes.includes(type)) return
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
    recurrenceType: isHospital ? 'weekdays' : recurrenceType,
    recurrenceIntervalDays: isHospital ? 1 : recurrenceIntervalDays,
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
          {isEditingRoutine && (
            <div className="routine-edit-summary" aria-label="수정 중인 루틴">
              <span>수정 중인 루틴</span>
              <strong>{initialReminder ? planLabel(initialReminder, selectedPet, speciesCareProfiles) : '루틴'}</strong>
            </div>
          )}
          {!presetType && <div className="routine-recommendation-field">
              <label className="required-label">{selectedPet ? `${selectedPet.species || animalGroupLabel(selectedPet.group)} 추천 루틴` : '관리 항목'}<span aria-hidden="true">*</span></label>
              <div className="routine-tag-section">
                <div>
                  {visibleRoutineTypes.map((key) => (
                    <button type="button" className={routineTypes.includes(key) ? 'selected' : ''} key={key} onClick={() => toggleRoutineType(key)}>
                      <RoutinePhoto type={key} className="routine-picker-photo" />
                      <strong>{routineOptionLabel(key, selectedPet, speciesCareProfiles)}</strong>
                      {requiredRoutineTypes.includes(key) && <em>필수</em>}
                      {normalizedExistingTypes.has(key) && <em>이미 있음</em>}
                    </button>
                  ))}
                </div>
              </div>
              <div className="routine-tag-section">
                <div>
                  {customDisplayedTypes.map((key) => (
                    <button type="button" className={routineTypes.includes(key) ? 'selected' : ''} key={key} onClick={() => toggleRoutineType(key)}>
                      <RoutinePhoto type={key} className="routine-picker-photo" />
                      <strong>{routineOptionLabel(key, selectedPet, speciesCareProfiles)}</strong>
                    </button>
                  ))}
                </div>
              </div>
              {hasCustomRoutine && <label className="custom-routine-name-field">루틴 이름<input value={customRoutineName} onChange={(event) => setCustomRoutineName(event.target.value)} placeholder="예: 환기하기" /></label>}
              {customRoutineExists && <p className="routine-field-error">이미 같은 이름의 직접 입력 루틴이 있어요.</p>}
            </div>
          }
          {!isEditingRoutine && isMedicineRoutine && <label className="required-label">약 이름<span aria-hidden="true">*</span><input value={specialRoutineName} onChange={(event) => setSpecialRoutineName(event.target.value)} placeholder="예: 처방약 A" autoFocus /></label>}
          {!isEditingRoutine && isHospitalRoutine && <label className="required-label">진료 일정 이름<span aria-hidden="true">*</span><input value={specialRoutineName} onChange={(event) => setSpecialRoutineName(event.target.value)} placeholder="예: 정기 검진" autoFocus /></label>}
          {isHospitalRoutine ? (
            <label className="required-label">다음 진료 예정일<span aria-hidden="true">*</span><input type="date" min={toDateKey(new Date())} value={appointmentDate} onChange={(event) => setAppointmentDate(event.target.value)} /></label>
          ) : (
            <>
              <label className="required-label">반복 설정<span aria-hidden="true">*</span></label>
              <div className="weekday-picker repeat-type-picker" role="group" aria-label="반복 설정">
                <button type="button" className={recurrenceType === 'weekdays' ? 'selected' : ''} onClick={() => setRecurrenceType('weekdays')}>반복</button>
                <button type="button" className={recurrenceType === 'interval' ? 'selected' : ''} onClick={() => setRecurrenceType('interval')}>주기</button>
              </div>
              {recurrenceType === 'weekdays' ? (
                <>
                  <label className="required-label">요일<span aria-hidden="true">*</span></label>
                  <div className="weekday-picker">
                    {weekdays.map((day, index) => (
                      <button type="button" className={selectedWeekdays.includes(index) ? 'selected' : ''} onClick={() => setSelectedWeekdays(selectedWeekdays.includes(index) ? selectedWeekdays.filter((item) => item !== index) : [...selectedWeekdays, index])} key={day}>{day}</button>
                    ))}
                    <button type="button" className={selectedWeekdays.length === 7 ? 'selected' : ''} onClick={() => setSelectedWeekdays(selectedWeekdays.length === 7 ? [] : [0, 1, 2, 3, 4, 5, 6])}>매일</button>
                  </div>
                </>
              ) : (
                <label className="required-label repeat-interval-field">주기<span aria-hidden="true">*</span><span className="repeat-interval-input"><input type="number" min="1" max="365" inputMode="numeric" value={recurrenceIntervalDays} onChange={(event) => setRecurrenceIntervalDays(Math.max(1, Number(event.target.value) || 1))} /><span>일마다</span></span></label>
              )}
            </>
          )}
          <label className="routine-notification-time-field">부재 시 알람 시간<input type="time" value={notificationTime} onChange={(event) => setNotificationTime(event.target.value)} /></label>
          {!isHospitalRoutine && <label className={isMedicineRoutine ? 'required-label' : undefined}>종료일 {isMedicineRoutine ? <span aria-hidden="true">*</span> : <OptionalBadge />}<input type="date" value={endDate} min={startDate} onChange={(event) => setEndDate(event.target.value)} /></label>}
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
      {Array.from({ length: stepCount }, (_, index) => {
        const status = index < currentStep ? 'completed' : index === currentStep ? 'active' : 'upcoming'
        return (
          <button key={index} className={`is-${status}`} data-step-status={status} type="button" role="tab" aria-selected={status === 'active'} aria-label={`${index + 1}단계 ${status === 'completed' ? '완료' : status === 'active' ? '현재' : '예정'}`} onClick={() => onStepChange(index)}>
            <span aria-hidden="true">{status === 'completed' ? '✓' : index + 1}</span>
          </button>
        )
      })}
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
      <label>{label}<span className="required-mark" aria-label="필수">*</span></label>
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
  const choose = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    event.target.value = ''
    let sanitizedFile: File
    try {
      sanitizedFile = await sanitizeImageFile(file)
    } catch (error) {
      window.alert(error instanceof Error ? error.message : '사진을 확인해 주세요.')
      return
    }
    const reader = new FileReader()
    reader.onload = () => onChange(typeof reader.result === 'string' ? reader.result : undefined)
    reader.readAsDataURL(sanitizedFile)
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

function DateRecordsScreen({ date, records, mobileActions, onBack, onOpenRecord, onDelete, onAddMemo }: { date: string; records: DisplayPetRecord[]; mobileActions?: ReactNode; onBack: () => void; onOpenRecord: (record: DisplayPetRecord) => void; onDelete: (id: string | string[]) => void; onAddMemo: (memo: string) => void }) {
  const [memo, setMemo] = useState('')
  const saveMemo = () => {
    const nextMemo = memo.trim()
    if (!nextMemo) return
    onAddMemo(nextMemo)
    setMemo('')
  }

  return <main className="diary-create-screen date-records-screen"><header><button type="button" aria-label="뒤로가기" onClick={onBack}>←</button><strong>{formatDate(date)}</strong><span /></header><section className="date-records-content compact-date-records">{records.length ? records.map((record) => {
    const tag = calendarRecordTag(record)
    return <article key={record.id}><button type="button" onClick={() => onOpenRecord(record)}><span className="date-record-mark" aria-hidden="true">{tag.iconSrc ? <img className={tag.iconIsRoutineCard ? 'routine-record-mark-image' : ''} src={tag.iconSrc} alt="" /> : tag.icon}</span><strong>{tag.label}</strong></button><button type="button" aria-label={`${tag.label} 기록 삭제`} onClick={() => onDelete(record.sourceIds ?? record.id)}>×</button></article>
  }) : <p>이 날짜에 작성된 기록이 없어요.</p>}</section>{mobileActions ? <section className="date-records-mobile-actions">{mobileActions}</section> : null}<section className="date-memo-composer"><label>메모<textarea value={memo} onChange={(event) => setMemo(event.target.value)} placeholder="이 날짜에 남길 메모" /></label><button type="button" disabled={!memo.trim()} onClick={saveMemo}>메모 추가</button></section></main>
}

function DiaryNotice({
  records,
  reminders,
  petName,
  resolvedInsightIds = [],
  followedUpInsightIds = [],
  onShedComplete,
  onShedNotYet,
  onFollowUpInsight,
  onResolveInsight,
  onKeepInsight,
  onCreateQna,
  onFindHospital,
  onRecordEnvironment,
  onAddTemporaryRoutine,
  onOpenRecords,
  onKeepTemporaryRoutines,
  onCloseTemporaryRoutines,
}: {
  records: PetRecord[]
  reminders: Reminder[]
  petName: string
  resolvedInsightIds?: string[]
  followedUpInsightIds?: string[]
  onShedComplete?: () => void
  onShedNotYet?: () => void
  onFollowUpInsight?: (insightId: string) => void
  onResolveInsight?: (insightId: string) => void
  onKeepInsight?: (insightId: string) => void
  onCreateQna?: (metric?: DiaryInsight['metric']) => void
  onFindHospital?: (concern?: HospitalRecommendationConcern) => void
  onRecordEnvironment?: () => void
  onAddTemporaryRoutine?: (type: 'mist' | 'water', sourceRecordId: string) => void
  onOpenRecords?: () => void
  onKeepTemporaryRoutines?: (insightId: string) => void
  onCloseTemporaryRoutines?: (insightId: string) => void
}) {
  const hasTemporaryPoopRoutine = reminders.some((reminder) => reminder.isActive && reminder.purpose === 'poop_follow_up')
  const insights = buildDiaryInsights(records, petName, resolvedInsightIds)
    .filter((insight) => !insight.poopRecovered || hasTemporaryPoopRoutine)
  if (insights.length === 0) {
    const notice = buildDiaryNotice(records, resolvedInsightIds)
    return <div className="diary-notice-line"><strong>NOTICE</strong><span>{notice.message}</span></div>
  }
  return (
    <section className="diary-notice-line diary-notice-alerts" aria-label="다이어리 알림">
      <strong>NOTICE</strong>
      <div className="diary-notice-items">
        {insights.map((insight) => {
          const stage = noticeStageFromTitle(insight.title)
          const followedUp = followedUpInsightIds.includes(insight.id)
          const hasTemporaryRoutine = reminders.some((reminder) => reminder.isActive && reminder.purpose === 'poop_follow_up')
          const isRepeatedPoop = insight.metric === 'poop' && insight.poopFollowUpStage === 2
          return (
            <div className="diary-notice-item" key={insight.id}>
              <div className="diary-notice-copy">
                <div className="diary-notice-heading">{stage ? <b className={`notice-stage stage-${stage}`}>{stage}단계</b> : null}<b>{insight.title}</b></div>
                <p>{insight.body}</p>
              </div>
              <div className="diary-notice-actions">
                {(insight.action === 'shed-check' || insight.action === 'shed-cycle-check') && onShedComplete && onShedNotYet ? (
                  insight.action === 'shed-cycle-check'
                    ? <><button type="button" onClick={onShedComplete}>예</button><button type="button" onClick={onShedNotYet}>아니요</button></>
                    : <><button type="button" onClick={onShedNotYet}>탈피 중</button><button type="button" onClick={onShedComplete}>탈피 완료</button></>
                ) : followedUp && onResolveInsight && onKeepInsight ? (
                  <><b>해결됐나요?</b><button type="button" onClick={() => onResolveInsight(insight.id)}>예</button><button type="button" onClick={() => onKeepInsight(insight.id)}>아니오</button></>
                ) : (
                  <>
                    {insight.metric === 'poop' && insight.poopRecovered && hasTemporaryRoutine && onKeepTemporaryRoutines && <button type="button" onClick={() => onKeepTemporaryRoutines(insight.id)}>유지하기</button>}
                    {insight.metric === 'poop' && insight.poopRecovered && hasTemporaryRoutine && onCloseTemporaryRoutines && <button type="button" onClick={() => onCloseTemporaryRoutines(insight.id)}>종료하기</button>}
                    {insight.metric === 'poop' && insight.poopFollowUpStage === 1 && onRecordEnvironment && <button type="button" onClick={onRecordEnvironment}>온습도 기록하기</button>}
                    {insight.metric === 'poop' && insight.poopFollowUpStage === 1 && insight.poopStatus === 'dry' && onAddTemporaryRoutine && <button type="button" onClick={() => onAddTemporaryRoutine('mist', insight.id.replace('poop-dry-', ''))}>분무 루틴</button>}
                    {insight.metric === 'poop' && insight.poopFollowUpStage === 1 && insight.poopStatus === 'dry' && onAddTemporaryRoutine && <button type="button" onClick={() => onAddTemporaryRoutine('water', insight.id.replace('poop-dry-', ''))}>물그릇 루틴</button>}
                    {isRepeatedPoop && onOpenRecords && <button type="button" onClick={onOpenRecords}>기록 모아보기</button>}
                    {isRepeatedPoop && onCreateQna && <button type="button" onClick={() => onCreateQna('poop')}>Q&A 작성하기</button>}
                    {isRepeatedPoop && onFindHospital && <button type="button" onClick={() => onFindHospital('poop')}>병원 찾기</button>}
                    {insight.metric === 'poop' && insight.level === 'urgent' && insight.poopStatus === 'foreign_body' && onCreateQna && <button type="button" onClick={() => onCreateQna('poop')}>Q&A 작성하기</button>}
                    {insight.metric === 'poop' && insight.level === 'urgent' && onFindHospital && <button type="button" onClick={() => { onFollowUpInsight?.(insight.id); onFindHospital('poop') }}>병원 찾기</button>}
                    {insight.metric === 'poop' && insight.level === 'urgent' && insight.poopStatus !== 'foreign_body' && onCreateQna && <button type="button" onClick={() => onCreateQna('poop')}>Q&A 작성하기</button>}
                    {insight.metric !== 'poop' && onCreateQna && <button type="button" onClick={() => { onFollowUpInsight?.(insight.id); onCreateQna(insight.metric) }}>Q&A</button>}
                    {insight.metric !== 'poop' && onFindHospital && <button type="button" onClick={() => { onFollowUpInsight?.(insight.id); onFindHospital(insight.metric === 'shed' ? 'shed' : undefined) }}>병원 찾기</button>}
                  </>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}

function PoopFollowUpPanel({ followUp, records, reminders, onClose, onOpenRecords, onCreateQna, onFindHospital, onAddRoutine, onKeepRoutines, onCloseRoutines }: {
  followUp: PoopFollowUp; records: PetRecord[]; reminders: Reminder[]; onClose: () => void; onOpenRecords: () => void; onCreateQna: () => void; onFindHospital: () => void; onAddRoutine: (type: 'mist' | 'water') => void; onKeepRoutines: () => void; onCloseRoutines: () => void
}) {
  const temporary = reminders.filter((item) => item.isActive && item.purpose === 'poop_follow_up')
  const hasMist = reminders.some((item) => item.isActive && item.reminderType === 'mist')
  const hasWater = reminders.some((item) => item.isActive && item.reminderType === 'water')
  const humidity = records.filter((item) => item.environmentRecord?.metricType === 'humidity').sort(compareRecordTime).at(-1)
  const actions = (children: ReactNode) => <div className="poop-follow-up-actions">{children}</div>
  if (followUp.recovered) return <div className="poop-follow-up-panel"><h2>배변 상태가 정상으로 돌아왔습니다.</h2><p>{temporary.length ? '배변 상태 확인을 위해 추가한 임시 루틴을 종료할까요?' : '이전 이상 상태의 추적을 마쳤어요.'}</p>{actions(temporary.length ? <><button type="button" onClick={onKeepRoutines}>유지하기</button><button type="button" onClick={onCloseRoutines}>종료하기</button></> : <button type="button" onClick={onClose}>확인</button>)}</div>
  if (followUp.status === 'blood') return <div className="poop-follow-up-panel urgent"><h2>혈변이 기록되었습니다.</h2><p>환경 조절만으로 판단하지 말고 진료 가능한 병원을 확인해 주세요.</p>{actions(<><button type="button" onClick={onFindHospital}>병원 찾기</button><button type="button" onClick={onCreateQna}>Q&A 작성하기</button></>)}</div>
  if (followUp.status === 'foreign_body') return <div className="poop-follow-up-panel caution"><h2>배변에서 이물질이 확인되었습니다.</h2><p>기록을 첨부해 질문하거나 진료 가능한 병원을 찾아볼 수 있습니다.</p>{actions(<><button type="button" onClick={onCreateQna}>Q&A 작성하기</button><button type="button" onClick={onFindHospital}>병원 찾기</button></>)}</div>
  if (followUp.repeated && ['dry', 'constipation', 'diarrhea'].includes(followUp.status)) return <div className="poop-follow-up-panel caution"><h2>{followUp.status === 'diarrhea' ? '묽은' : '건조한'} 배변이 반복되고 있습니다.</h2><p>{followUp.status === 'diarrhea' ? '최근 기록을 함께 확인하거나 도움이 필요한 경우 질문 또는 병원 찾기를 이용할 수 있습니다.' : '최근 사육환경과 기록을 함께 확인해 주세요.'}</p>{actions(<><button type="button" onClick={onOpenRecords}>기록 모아보기</button><button type="button" onClick={onCreateQna}>Q&A 작성하기</button><button type="button" onClick={onFindHospital}>병원 찾기</button></>)}</div>
  if (followUp.status === 'diarrhea') return <div className="poop-follow-up-panel"><h2>묽은 배변이 기록되었습니다.</h2><p>최근 사육환경과 급여 기록을 확인해 주세요.</p><div className="poop-context-list">{buildRecentPoopContext(records, followUp.record.date).map((item) => <span key={item}>{item}</span>)}</div>{actions(<button type="button" onClick={onOpenRecords}>최근 기록 확인</button>)}</div>
  if (followUp.status === 'dry' || followUp.status === 'constipation') return <div className="poop-follow-up-panel"><h2>건조한 배변이 기록되었습니다.</h2><p>최근 습도와 수분 공급 환경을 확인해 주세요.</p><div className="poop-context-list"><span>{humidity?.environmentRecord ? `최근 습도 ${humidity.environmentRecord.value}% · ${formatDate(humidity.date)}` : '최근 습도 기록 없음'}</span><span>분무 루틴 {hasMist ? '있음' : '없음'}</span><span>물그릇·물 공급 루틴 {hasWater ? '있음' : '없음'}</span></div>{actions(<><button type="button" onClick={onOpenRecords}>습도 기록 확인</button>{!hasMist && <button type="button" onClick={() => onAddRoutine('mist')}>분무 루틴 추가</button>}{!hasWater && <button type="button" onClick={() => onAddRoutine('water')}>물그릇 확인 루틴 추가</button>}</>)}</div>
  return null
}

function buildRecentPoopContext(records: PetRecord[], date: string) {
  const latest = (predicate: (record: PetRecord) => boolean) => records.filter((record) => record.date <= date && predicate(record)).sort(compareRecordTime).at(-1)
  const temperature = latest((record) => record.environmentRecord?.metricType === 'temperature')
  const humidity = latest((record) => record.environmentRecord?.metricType === 'humidity')
  const food = latest((record) => record.type === 'food')
  const water = latest((record) => Boolean(record.memo?.includes('물') || record.memo?.includes('분무')))
  return [temperature?.environmentRecord ? `최근 온도 ${temperature.environmentRecord.value}℃` : '최근 온도 기록 없음', humidity?.environmentRecord ? `최근 습도 ${humidity.environmentRecord.value}%` : '최근 습도 기록 없음', food ? `최근 먹이 ${food.feedingFoods?.map((item) => item.foodName).join(' · ') || food.foods?.join(' · ') || '기록 있음'}` : '최근 먹이 기록 없음', water ? `최근 수분 공급 ${formatDate(water.date)}` : '최근 수분 공급 기록 없음']
}

function DiaryInsightBanner({
  records,
  petName,
  onShedComplete,
  onShedNotYet,
  resolvedInsightIds = [],
  followedUpInsightIds = [],
  onFollowUpInsight,
  onResolveInsight,
  onKeepInsight,
  onCreateQna,
  onFindHospital,
  onOpenRecords,
}: {
  records: PetRecord[]
  petName: string
  onShedComplete?: () => void
  onShedNotYet?: () => void
  resolvedInsightIds?: string[]
  followedUpInsightIds?: string[]
  onFollowUpInsight?: (insightId: string) => void
  onResolveInsight?: (insightId: string) => void
  onKeepInsight?: (insightId: string) => void
  onCreateQna?: (metric?: DiaryInsight['metric']) => void
  onFindHospital?: (concern?: HospitalRecommendationConcern) => void
  onOpenRecords?: () => void
}) {
  const insights = buildDiaryInsights(records, petName, resolvedInsightIds).filter((insight) => insight.metric !== 'poop')
  if (insights.length === 0) return null
  return (
    <section className="diary-insight-banner" aria-label="다이어리 경고와 변화">
      {insights.map((insight) => (
        <article className={`diary-insight-card ${insight.level}`} key={insight.id}>
          <small>{insightLabel(insight.metric)}</small>
          <strong>{insight.title}</strong>
          <span>{insight.body}</span>
          {insight.sourceUrl && <a href={insight.sourceUrl} target="_blank" rel="noreferrer">참고 자료</a>}
          {(insight.action === 'shed-check' || insight.action === 'shed-cycle-check') && onShedComplete && onShedNotYet && (
            <div className="diary-insight-actions" aria-label="탈피 완료 확인">
              {insight.action === 'shed-cycle-check'
                ? <><button type="button" onClick={onShedComplete}>예</button><button type="button" onClick={onShedNotYet}>아니요</button></>
                : <><button type="button" onClick={onShedNotYet}>탈피 중</button><button type="button" onClick={onShedComplete}>탈피 완료</button></>}
            </div>
          )}
          {insight.action !== 'shed-check' && insight.action !== 'shed-cycle-check' && followedUpInsightIds.includes(insight.id) && onResolveInsight && onKeepInsight && (
            <div className="diary-insight-resolution">
              <b>해결됐나요?</b>
              <div className="diary-insight-actions" aria-label="경고 해결 여부">
                <button type="button" onClick={() => onResolveInsight(insight.id)}>예</button>
                <button type="button" onClick={() => onKeepInsight(insight.id)}>아니오</button>
              </div>
            </div>
          )}
          {insight.action !== 'shed-check' && insight.action !== 'shed-cycle-check' && !followedUpInsightIds.includes(insight.id) && (onCreateQna || onFindHospital) && (
            <div className="diary-insight-actions">
              {insight.metric === 'poop' && !isRepeatedPoopInsight(insight) && insight.level !== 'urgent' && onResolveInsight && <button type="button" onClick={() => onResolveInsight(insight.id)}>확인했어요</button>}
              {isRepeatedPoopInsight(insight) && onOpenRecords && <button type="button" onClick={onOpenRecords}>기록 모아보기</button>}
              {isRepeatedPoopInsight(insight) && onCreateQna && <button type="button" onClick={() => onCreateQna('poop')}>Q&A 작성하기</button>}
              {isRepeatedPoopInsight(insight) && onFindHospital && <button type="button" onClick={() => onFindHospital('poop')}>병원 찾기</button>}
              {insight.metric === 'poop' && insight.level === 'urgent' && onFindHospital && <button type="button" onClick={() => { onFollowUpInsight?.(insight.id); onFindHospital('poop') }}>병원 찾으러 가기</button>}
              {insight.metric !== 'poop' && onCreateQna && <button type="button" onClick={() => { onFollowUpInsight?.(insight.id); onCreateQna(insight.metric) }}>{insight.metric === 'shed' ? '탈피 질문 작성' : 'Q&A에 도움받기'}</button>}
              {insight.metric !== 'poop' && onFindHospital && <button type="button" onClick={() => { onFollowUpInsight?.(insight.id); onFindHospital(insight.metric === 'shed' ? 'shed' : undefined) }}>병원 찾으러 가기</button>}
            </div>
          )}
        </article>
      ))}
    </section>
  )
}

export function DataVisualization({
  records,
  petName,
  onCreateQna,
  onShedComplete,
  onShedNotYet,
  resolvedInsightIds = [],
  followedUpInsightIds = [],
  onFollowUpInsight,
  onResolveInsight,
  onKeepInsight,
  onFindHospital,
}: {
  records: PetRecord[]
  petName: string
  onCreateQna?: (metric?: DiaryInsight['metric']) => void
  onShedComplete?: () => void
  onShedNotYet?: () => void
  resolvedInsightIds?: string[]
  followedUpInsightIds?: string[]
  onFollowUpInsight?: (insightId: string) => void
  onResolveInsight?: (insightId: string) => void
  onKeepInsight?: (insightId: string) => void
  onFindHospital?: (concern?: HospitalRecommendationConcern) => void
}) {
  const [activeMetric, setActiveMetric] = useState<'shed' | 'environment' | 'weight' | 'poop' | 'mating' | 'egg'>('shed')
  const measuredRecords = deduplicateMeasuredRecordsByDay(records)
  const environmentRecords = measuredRecords
    .filter((record) => record.environmentRecord)
    .slice()
    .sort((a, b) => `${a.date}${a.occurredAt ?? a.createdAt}`.localeCompare(`${b.date}${b.occurredAt ?? b.createdAt}`))
  const temperatureRecords = environmentRecords.filter((record) => record.environmentRecord?.metricType === 'temperature')
  const humidityRecords = environmentRecords.filter((record) => record.environmentRecord?.metricType === 'humidity')
  const weightRecords = measuredRecords.filter((record) => record.type === 'weight' && record.weight !== undefined).sort(compareRecordTime)
  const shedRecords = records.filter((record) => record.type === 'shed').sort(compareRecordTime)
  const shedSummary = getShedCycleSummary(shedRecords)
  const poopRecords = records.filter((record) => record.type === 'poop').sort(compareRecordTime)
  const matingRecords = records.filter(isMatingRecord).sort(compareRecordTime)
  const eggRecords = records.filter(isEggRecord).sort(compareRecordTime)
  const hasAnyData = environmentRecords.length > 0 || weightRecords.length > 0 || shedSummary.count > 0 || poopRecords.length > 0 || matingRecords.length > 0 || eggRecords.length > 0
  if (!hasAnyData) return <div className="data-visualization"><DataVisualizationHeader petName={petName} onCreateQna={onCreateQna} /><div className="data-visualization-empty">아직 모아볼 기록이 없어요.</div></div>
  const metricCounts = {
    shed: shedSummary.count,
    environment: environmentRecords.length,
    weight: weightRecords.length,
    poop: poopRecords.length,
    mating: matingRecords.length,
    egg: eggRecords.length,
  }
  const firstAvailableMetric = (Object.keys(metricCounts) as Array<keyof typeof metricCounts>).find((metric) => metricCounts[metric] > 0) ?? 'shed'
  const selectedMetric = metricCounts[activeMetric] > 0 ? activeMetric : firstAvailableMetric
  return (
    <div className="data-visualization">
      <DataVisualizationHeader petName={petName} onCreateQna={onCreateQna} />
      <DiaryInsightBanner records={records} petName={petName} onShedComplete={onShedComplete} onShedNotYet={onShedNotYet} resolvedInsightIds={resolvedInsightIds} followedUpInsightIds={followedUpInsightIds} onFollowUpInsight={onFollowUpInsight} onResolveInsight={onResolveInsight} onKeepInsight={onKeepInsight} onCreateQna={onCreateQna} onFindHospital={onFindHospital} onOpenRecords={() => setActiveMetric('poop')} />
      <div className="record-collection-tabs" aria-label="모아보기 항목">
        <button className={selectedMetric === 'shed' ? 'active' : ''} type="button" onClick={() => setActiveMetric('shed')}>
          탈피 <span>{metricCounts.shed}</span>
        </button>
        <button className={selectedMetric === 'environment' ? 'active' : ''} type="button" onClick={() => setActiveMetric('environment')}>온습도 <span>{metricCounts.environment}</span></button>
        <button className={selectedMetric === 'weight' ? 'active' : ''} type="button" onClick={() => setActiveMetric('weight')}>체중 <span>{metricCounts.weight}</span></button>
        <button className={selectedMetric === 'poop' ? 'active' : ''} type="button" onClick={() => setActiveMetric('poop')}>배변 <span>{metricCounts.poop}</span></button>
        <button className={selectedMetric === 'mating' ? 'active' : ''} type="button" onClick={() => setActiveMetric('mating')}>메이팅 <span>{metricCounts.mating}</span></button>
        <button className={selectedMetric === 'egg' ? 'active' : ''} type="button" onClick={() => setActiveMetric('egg')}>산란 <span>{metricCounts.egg}</span></button>
      </div>
      {selectedMetric === 'shed' && (shedRecords.length > 0 ? <ShedCycleChart records={shedRecords} /> : <MetricEmpty label="탈피 기록" />)}
      {selectedMetric === 'environment' && (
        temperatureRecords.length || humidityRecords.length
          ? <>{temperatureRecords.length > 0 && <EnvironmentLineChart title="온도·수온 변화" records={temperatureRecords} />}{humidityRecords.length > 0 && <EnvironmentLineChart title="습도 변화" records={humidityRecords} />}</>
          : <MetricEmpty label="온습도 기록" />
      )}
      {selectedMetric === 'weight' && (weightRecords.length > 0 ? <WeightLineChart records={weightRecords} /> : <MetricEmpty label="체중 기록" />)}
      {selectedMetric === 'poop' && (poopRecords.length > 0 ? <><EventIntervalChart title="배변 주기" records={poopRecords.filter((record) => getStoolStatus(record) === 'normal')} /><PoopStatusChart records={poopRecords} /></> : <MetricEmpty label="배변 기록" />)}
      {selectedMetric === 'mating' && (matingRecords.length > 0 ? <EventIntervalChart title="메이팅 간격" records={matingRecords} /> : <MetricEmpty label="메이팅 기록" />)}
      {selectedMetric === 'egg' && (eggRecords.length > 0 ? <><EventIntervalChart title="산란 주기" records={eggRecords} /><EggStatusChart records={eggRecords} /></> : <MetricEmpty label="산란 기록" />)}
    </div>
  )
}

function DataVisualizationHeader({ petName, onCreateQna }: { petName: string; onCreateQna?: (metric?: DiaryInsight['metric']) => void }) {
  return (
    <header className="data-visualization-heading">
      <div><h2>{petName} 기록 모아보기</h2></div>
      {onCreateQna && <button className="record-collection-qna" type="button" onClick={() => onCreateQna()}>Q&A 작성하기</button>}
    </header>
  )
}

function MetricEmpty({ label }: { label: string }) {
  return <div className="data-visualization-empty">{label}이 아직 없어요.</div>
}

function buildDiaryInsights(records: PetRecord[], petName: string, resolvedInsightIds: string[] = []): DiaryInsight[] {
  const insights = [
    buildWeightInsight(records, petName),
    buildEnvironmentInsight(records, petName),
    buildShedInsight(records, petName),
    buildPoopInsight(records, petName),
  ]
    .filter((value): value is DiaryInsight => value !== null)
    .filter((value) => !resolvedInsightIds.includes(value.id))
  const priority: Record<DiaryInsightLevel, number> = { urgent: 0, caution: 1, notice: 2, normal: 3 }
  return insights.sort((a, b) => priority[a.level] - priority[b.level]).slice(0, 3)
}

function buildDiaryNotice(records: PetRecord[], resolvedInsightIds: string[] = []): { message: string; stage?: RiskLevel } {
  const stagedInsight = buildDiaryInsights(records, '펫', resolvedInsightIds).find((insight) => {
    const stage = noticeStageFromTitle(insight.title)
    return stage !== undefined && stage > 0
  })
  if (stagedInsight) {
    const stage = noticeStageFromTitle(stagedInsight.title)
    return {
      message: stage === 5 ? '빠르게 확인하세요.' : stagedInsight.body,
      stage,
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
  const latestByMetric = new Map<string, PetRecord>()
  records
    .filter((record) => record.environmentRecord)
    .sort(compareRecordTime)
    .forEach((record) => {
      const environment = record.environmentRecord
      if (!environment) return
      latestByMetric.set(`${environment.metricType}:${environment.measurementType}`, record)
    })
  const latestRisk = Array.from(latestByMetric.values())
    .filter((record) => (record.environmentRecord?.riskLevel ?? 0) > 1)
    .sort(compareRecordTime)
    .at(-1)
  if (!latestRisk?.environmentRecord) return null
  const risk = latestRisk.environmentRecord
  const label = risk.metricType === 'humidity' ? '습도' : risk.measurementType === 'water' ? '수온' : '온도'
  const subjectLabel = label === '수온' ? '수온이' : `${label}가`
  const isCritical = risk.riskLevel === 5
  return {
    id: `environment-risk-${latestRisk.id}`,
    metric: 'environment',
    level: risk.riskLevel >= 4 ? 'urgent' : risk.riskLevel >= 2 ? 'caution' : 'notice',
    title: isCritical ? `${subjectLabel} 5단계 위험 수준이에요. 환경을 조정하고 병원 진료를 서둘러주세요.` : `${subjectLabel} ${risk.riskLevel}단계 상태예요.`,
    body: isCritical
      ? `${petName}의 ${label} 기록은 ${formatEnvironmentValue(risk)}예요. 즉시 안전 범위로 조정하고 동물의 상태를 확인한 뒤 빠르게 특수동물 병원에 데려가세요.`
      : `${petName}의 ${label} 기록은 ${formatEnvironmentValue(risk)}예요. ${risk.riskMessage}`,
    action: 'environment-resolve',
  }
}

function buildShedInsight(records: PetRecord[], petName: string): DiaryInsight | null {
  const ongoingShed = getOngoingShedRecord(records)
  if (ongoingShed) {
    const days = daysBetween(ongoingShed.date, toDateKey(new Date()))
    if (days < 2) return null
    const levelNumber = shedDelayLevel(days)
    const durations = buildShedDurationRecords(records)
    const averageDuration = averageDurationDays(durations)
    const durationHint = averageDuration
      ? `${petName}는 이전 기록에서 평균 ${averageDuration}일 만에 탈피를 끝냈어요. `
      : ''
    return {
      id: 'shed-ongoing',
      metric: 'shed',
      level: levelNumber >= 4 ? 'urgent' : levelNumber >= 2 ? 'caution' : 'notice',
      title: levelNumber > 0 ? `탈피 중 · ${levelNumber}단계 확인 상태예요.` : '탈피 중 · 탈피가 완료됐나요?',
      body: levelNumber > 0
        ? `${durationHint}${petName}의 탈피 시작 기록 후 ${days}일이 지났어요. 탈피가 끝났는지 확인해주세요.`
        : `${durationHint}${petName}의 탈피 시작 기록이 있어요. 탈피가 끝났다면 완료로 남겨주세요.`,
      action: 'shed-check',
    }
  }
  const cycle = getShedCyclePrediction(records)
  if (cycle && cycle.daysUntilExpected <= 0) {
    const overdueDays = Math.abs(cycle.daysUntilExpected)
    const latestNotCompleted = records
      .filter((record) => record.type === 'shed' && record.memo?.includes('완료 안됨') && record.date >= cycle.lastCompletedDate)
      .sort(compareRecordTime)
      .at(-1)
    if (!latestNotCompleted) {
      return {
        id: `shed-cycle-check-${cycle.lastCompletedDate}`,
        metric: 'shed',
        level: 'notice',
        title: `평균 ${cycle.averageCycleDays}일 주기예요. 탈피를 완료했나요?`,
        body: `${petName}의 이전 탈피 완료 기록 간격을 기준으로 확인할 시점이에요.`,
        action: 'shed-cycle-check',
      }
    }
    const latestHumidity = records
      .filter((record) => record.environmentRecord?.metricType === 'humidity')
      .sort(compareRecordTime)
      .at(-1)?.environmentRecord
    const humidityIsLow = latestHumidity?.riskDirection === 'low' || (latestHumidity ? latestHumidity.value < latestHumidity.minValue : false)
    if (humidityIsLow) {
      return {
        id: `shed-cycle-humidity-${cycle.lastCompletedDate}`,
        metric: 'shed',
        level: overdueDays >= 7 ? 'caution' : 'notice',
        title: `탈피 확인이 필요해요.`,
        body: `${petName}의 최근 습도가 기록 당시 범위보다 낮아요. 습도가 낮아 탈피가 지연될 수 있으니 환경을 먼저 확인해주세요.`,
      }
    }
    return {
      id: `shed-cycle-delay-${cycle.lastCompletedDate}`,
      metric: 'shed',
      level: overdueDays >= 7 ? 'caution' : 'notice',
      title: `탈피 부전 가능성도 있어요. 확인이 필요해요.`,
      body: overdueDays >= 7
        ? `${petName}의 예상 시점이 ${overdueDays}일 지났어요. 탈피 부전 가능성도 있어 확인이 필요해요. 기록을 첨부해 질문하거나 특수동물 병원에 상담해보세요.`
        : `${petName}의 최근 탈피 간격을 기준으로 예상 시점이 지났어요. 탈피 여부와 사육 환경을 확인해주세요.`,
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
  const poops = records.filter((record) => record.type === 'poop').sort(compareRecordTime)
  if (poops.length === 0) return null
  const latest = poops.at(-1) as PetRecord
  const latestStatus = getStoolStatus(latest)
  const previousStatus = poops.length > 1 ? getStoolStatus(poops[poops.length - 2]) : null

  if (latestStatus === 'normal' && (previousStatus === 'dry' || previousStatus === 'constipation')) {
    return {
      id: `poop-recovered-${latest.id}`,
      metric: 'poop',
      level: 'notice',
      title: '배변 상태가 정상으로 돌아왔습니다.',
      body: '배변 상태 확인을 위해 추가한 임시 루틴을 종료할까요?',
      poopRecovered: true,
      poopStatus: 'normal',
    }
  }

  if (latestStatus === 'blood' || latestStatus === 'foreign_body') {
    const statusLabel = latestStatus === 'blood' ? '혈변' : '이물질'
    return {
      id: `poop-urgent-${latest.id}`,
      metric: 'poop',
      level: 'urgent',
      title: `${statusLabel} 기록을 확인해주세요.`,
      body: latestStatus === 'blood' ? '환경 조절만으로 판단하지 말고 진료 가능한 병원을 확인해 주세요.' : '기록을 첨부해 질문하거나 진료 가능한 병원을 찾아볼 수 있습니다.',
      poopStatus: latestStatus,
      sourceUrl: 'https://www.msdvetmanual.com/digestive-system/digestive-system-introduction/the-digestive-system-in-animals',
    }
  }
  if (latestStatus === 'diarrhea') {
    const repeated = previousStatus === 'diarrhea'
    const environmentSummary = describePoopEnvironment(records, latest.date)
    return {
      id: `poop-diarrhea-${latest.id}`,
      metric: 'poop',
      level: repeated ? 'caution' : 'notice',
      title: repeated ? '묽은 배변이 반복되고 있습니다.' : '묽은 배변이 기록되었습니다.',
      body: repeated ? '최근 기록을 함께 확인하거나 도움이 필요한 경우 질문 또는 병원 찾기를 이용할 수 있습니다.' : `최근 사육환경과 급여 기록을 확인해 주세요. ${environmentSummary} ${describeRecentFeeding(records, latest.date)}`,
      poopFollowUpStage: repeated ? 2 : 1,
      poopStatus: 'diarrhea',
      sourceUrl: 'https://www.msdvetmanual.com/all-other-pets/reptiles/disorders-and-diseases-of-reptiles',
    }
  }
  if (latestStatus === 'dry' || latestStatus === 'constipation') {
    const repeated = previousStatus === 'dry' || previousStatus === 'constipation'
    return {
      id: `poop-dry-${latest.id}`,
      metric: 'poop',
      level: repeated ? 'caution' : 'notice',
      title: repeated ? '건조한 배변이 반복되고 있습니다.' : '건조한 배변이 기록되었습니다.',
      body: repeated ? '최근 사육환경과 기록을 함께 확인해 주세요.' : describePoopEnvironment(records, latest.date),
      poopFollowUpStage: repeated ? 2 : 1,
      poopStatus: 'dry',
    }
  }
  const cycle = analyzeRecordedCycle(poops.filter((record) => getStoolStatus(record) === 'normal').map((record) => record.date), toDateKey(new Date()))
  if (cycle && cycle.daysOverdue > 0) {
    return {
      id: `poop-cycle-${cycle.lastDate}`,
      metric: 'poop',
      level: cycle.daysOverdue >= 3 ? 'caution' : 'notice',
      title: `평균 배변 주기보다 ${cycle.daysOverdue}일 지났어요.`,
      body: `${petName}의 정상 배변 간격은 평균 ${cycle.averageCycleDays}일이에요. ${describeStoolDelayCause(records)} ${describeRecentFeeding(records)} 배변 지연이 계속되면 다음 배변 상태를 다이어리에 남기고 확인이 필요해요.`,
    }
  }
  return null
}

function describePoopEnvironment(records: PetRecord[], date: string) {
  const todayEnvironment = records
    .filter((record) => record.date === date && record.environmentRecord)
    .sort(compareRecordTime)
  const temperature = todayEnvironment.filter((record) => record.environmentRecord?.metricType === 'temperature').at(-1)?.environmentRecord
  const humidity = todayEnvironment.filter((record) => record.environmentRecord?.metricType === 'humidity').at(-1)?.environmentRecord
  if (!temperature || !humidity) return '현재 사육환경을 확인하기 위해 오늘 온도와 습도를 먼저 기록해 주세요.'
  if (temperature.riskDirection !== 'normal' || humidity.riskDirection !== 'normal') return '현재 사육환경이 설정된 적정 범위를 벗어났습니다. 적정 범위를 확인해 주세요.'
  return `오늘 온도 ${temperature.value}℃와 습도 ${humidity.value}%는 설정된 적정 범위 안에 있습니다.`
}

function describeStoolDelayCause(records: PetRecord[]) {
  const environment = records.filter((record) => record.environmentRecord).sort(compareRecordTime).at(-1)?.environmentRecord
  if (environment && environment.riskDirection !== 'normal') {
    const metric = environment.metricType === 'humidity' ? '습도' : environment.measurementType === 'water' ? '수온' : '온도'
    return `최근 ${metric}가 기록 당시 적정 범위를 벗어나 있어 환경 영향으로 배변이 지연될 수 있어요.`
  }
  return '최근 온습도 기록에서 뚜렷한 원인을 확인하기 어려워요.'
}

function describeRecentFeeding(records: PetRecord[], referenceDate = toDateKey(new Date())) {
  const food = records.filter((record) => record.type === 'food' && record.date <= referenceDate).sort(compareRecordTime).at(-1)
  if (!food) return '최근 급이 기록이 없어 급이 상태도 함께 확인해주세요.'
  const elapsed = Math.max(0, daysBetween(food.date, referenceDate))
  const names = food.feedingFoods?.map((item) => item.foodName).filter(Boolean).join(' · ')
  return `최근 급이는 ${elapsed === 0 ? '같은 날' : `${elapsed}일 전`} 기록됐${names ? `고 먹이는 ${names}였` : ''}어요.`
}

function insightLabel(metric: DiaryInsight['metric']) {
  if (metric === 'shed') return '탈피'
  if (metric === 'environment') return '온습도 변화'
  if (metric === 'weight') return '체중 변화'
  return '배변 상태'
}

function isRepeatedPoopInsight(insight: DiaryInsight) {
  return insight.metric === 'poop' && insight.title.includes('반복')
}

function compareRecordTime(a: PetRecord, b: PetRecord) {
  return `${a.date}${a.occurredAt ?? a.createdAt}`.localeCompare(`${b.date}${b.occurredAt ?? b.createdAt}`)
}

function getDiaryWeekDates(dateKey: string) {
  const selected = parseDateKey(dateKey)
  const monday = new Date(selected)
  monday.setDate(selected.getDate() + (selected.getDay() === 0 ? -6 : 1 - selected.getDay()))
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(monday)
    date.setDate(monday.getDate() + index)
    return date
  })
}

function formatMobileDiaryTime(record: PetRecord) {
  const value = record.occurredAt ?? record.createdAt
  if (!value) return '--'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '--' : date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false })
}

function formatMobileDiarySummary(record: PetRecord) {
  if (record.environmentRecord) return formatEnvironmentValue(record.environmentRecord)
  if (record.weight !== undefined) return `${formatWeightValue(record.weight)}g`
  const foods = getRecordFoodNames(record)
  return foods.length > 0 ? foods.join(' · ') : record.memo?.trim() || undefined
}

function mobileRecordsForDate(records: PetRecord[], date: string): MobileDiaryRecord[] {
  return records.filter((record) => record.date === date).sort((a, b) => compareRecordTime(a, b)).map((record) => ({
    id: record.id,
    date: '',
    time: formatMobileDiaryTime(record),
    type: calendarRecordTag(record).label,
    summary: formatMobileDiarySummary(record),
    photo: record.photoUrl,
  }))
}

function formatMobileAgendaDate(date: string) {
  const [, month, day] = date.split('-')
  return `${Number(month)}월 ${Number(day)}일`
}

function buildMobileDiaryAlertActions({ insight, onOpenRecords, onCreateQna, onFindHospital, onShedComplete, onShedNotYet }: {
  insight: DiaryInsight
  onOpenRecords: () => void
  onCreateQna?: () => void
  onFindHospital?: () => void
  onShedComplete: () => void
  onShedNotYet: () => void
}) {
  if (insight.action === 'shed-check' || insight.action === 'shed-cycle-check') return [
    { label: insight.action === 'shed-check' ? '탈피 중' : '아니요', onClick: onShedNotYet },
    { label: insight.action === 'shed-check' ? '탈피 완료' : '예', onClick: onShedComplete },
  ]
  if (isRepeatedPoopInsight(insight)) return [
    { label: '기록 모아보기', onClick: onOpenRecords },
    ...(onCreateQna ? [{ label: 'Q&A 작성하기', onClick: onCreateQna }] : []),
  ].slice(0, 2)
  return [
    ...(onFindHospital ? [{ label: '병원 찾기', onClick: onFindHospital }] : []),
    ...(onCreateQna ? [{ label: 'Q&A', onClick: onCreateQna }] : []),
    { label: '기록 모아보기', onClick: onOpenRecords },
  ].slice(0, 2)
}

function deduplicateMeasuredRecordsByDay(records: PetRecord[]) {
  const uniqueRecords = new Map<string, PetRecord>()

  records
    .slice()
    .sort(compareRecordTime)
    .forEach((record) => {
      const environment = record.environmentRecord
      const key = environment
        ? `environment:${record.petId}:${record.date}:${environment.metricType}`
        : record.type === 'weight' && record.weight !== undefined
          ? `weight:${record.petId}:${record.date}`
          : `record:${record.id}`
      if (!uniqueRecords.has(key)) uniqueRecords.set(key, record)
    })

  return Array.from(uniqueRecords.values()).sort((a, b) => compareRecordTime(b, a))
}

function collapseOverdueRoutineTasks(
  tasks: Array<{ reminder: Reminder; overdue: boolean; dailyTask: DailyTask }>,
) {
  const sortedTasks = tasks
    .slice()
    .sort((a, b) => a.dailyTask.scheduledDate.localeCompare(b.dailyTask.scheduledDate))
  const oldestOverdueTask = sortedTasks.find((task) => task.overdue)
  const currentTasks = sortedTasks.filter((task) => !task.overdue)

  return oldestOverdueTask ? [oldestOverdueTask, ...currentTasks] : currentTasks
}

function daysBetween(from: string, to: string) {
  const start = new Date(`${from}T00:00:00`)
  const end = new Date(`${to}T00:00:00`)
  return Math.round((end.getTime() - start.getTime()) / 86400000)
}

function stoolStatusFromLabel(value?: string): StoolStatus {
  if (value?.includes('혈변') || value?.includes('피')) return 'blood'
  if (value?.includes('이물질')) return 'foreign_body'
  if (value?.includes('설사') || value?.includes('묽')) return 'diarrhea'
  if (value?.includes('건조')) return 'dry'
  if (value?.includes('변비') || value?.includes('딱딱') || value?.includes('단단')) return 'constipation'
  return 'normal'
}

function getStoolStatus(record: PetRecord): StoolStatus {
  return record.stoolRecord?.status ?? stoolStatusFromLabel(record.memo)
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

function getShedCycleSummary(records: PetRecord[]) {
  const sheds = records.filter((record) => record.type === 'shed').sort(compareRecordTime)
  const completedCycles = buildShedDurationRecords(sheds)
  const pairedIds = new Set(completedCycles.flatMap((record) => record.sourceIds ?? []))
  const standaloneCompletions = sheds.filter((record) => isCompletedShed(record) && !pairedIds.has(record.id))
  const ongoing = getOngoingShedRecord(sheds)

  return {
    completedCycles,
    ongoing,
    count: completedCycles.length + standaloneCompletions.length + (ongoing ? 1 : 0),
  }
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

function getCompletedShedDates(records: PetRecord[]) {
  const summary = getShedCycleSummary(records)
  const pairedIds = new Set(summary.completedCycles.flatMap((record) => record.sourceIds ?? []))
  const standalone = records.filter((record) => record.type === 'shed' && isCompletedShed(record) && !pairedIds.has(record.id))
  return [...summary.completedCycles, ...standalone]
    .map((record) => record.date)
    .filter((date, index, dates) => dates.indexOf(date) === index)
    .sort()
}

function getShedCyclePrediction(records: PetRecord[]) {
  const dates = getCompletedShedDates(records)
  if (dates.length < 2) return null
  const intervals = dates.slice(1).map((date, index) => Math.max(1, daysBetween(dates[index], date)))
  const averageCycleDays = Math.round(intervals.reduce((sum, days) => sum + days, 0) / intervals.length)
  const lastCompletedDate = dates.at(-1) as string
  const expected = new Date(`${lastCompletedDate}T00:00:00`)
  expected.setDate(expected.getDate() + averageCycleDays)
  const expectedDate = toDateKey(expected)
  const expectedStartDate = addDaysToDateKey(lastCompletedDate, Math.min(...intervals))
  const expectedEndDate = addDaysToDateKey(lastCompletedDate, Math.max(...intervals))
  return {
    averageCycleDays,
    expectedDate,
    expectedStartDate,
    expectedEndDate,
    lastCompletedDate,
    daysUntilExpected: daysBetween(toDateKey(new Date()), expectedDate),
  }
}

function addDaysToDateKey(dateKey: string, days: number) {
  const date = new Date(`${dateKey}T00:00:00`)
  date.setDate(date.getDate() + days)
  return toDateKey(date)
}

function getObservedCycleWindow(dates: string[]) {
  const uniqueDates = Array.from(new Set(dates)).sort()
  if (uniqueDates.length < 2) return null
  const intervals = uniqueDates.slice(1).map((date, index) => Math.max(1, daysBetween(uniqueDates[index], date)))
  const prediction = analyzeRecordedCycle(uniqueDates, toDateKey(new Date()))
  if (!prediction) return null
  return { ...prediction, startDate: addDaysToDateKey(prediction.lastDate, Math.min(...intervals)), endDate: addDaysToDateKey(prediction.lastDate, Math.max(...intervals)) }
}

function buildCalendarCyclePredictions(records: PetRecord[]): CalendarCyclePrediction[] {
  const predictions: CalendarCyclePrediction[] = []
  const shedPrediction = getShedCyclePrediction(records)
  if (shedPrediction) {
    predictions.push({ date: shedPrediction.expectedDate, startDate: shedPrediction.expectedStartDate, endDate: shedPrediction.expectedEndDate, lastDate: shedPrediction.lastCompletedDate, type: 'shed', label: '탈피 예상' })
  }

  const eggPrediction = getObservedCycleWindow(records.filter(isEggRecord).map((record) => record.date))
  if (eggPrediction) {
    predictions.push({ date: eggPrediction.expectedDate, startDate: eggPrediction.startDate, endDate: eggPrediction.endDate, lastDate: eggPrediction.lastDate, type: 'egg', label: '산란 예상' })
  }

  return predictions.filter((prediction, index) => predictions.findIndex((item) => item.date === prediction.date && item.type === prediction.type) === index)
}

function buildIntervalRecords(records: PetRecord[]) {
  const sorted = records.slice().sort(compareRecordTime)
  return sorted.slice(1).map((record, index) => ({
    ...record,
    id: `interval-${sorted[index].id}-${record.id}`,
    intervalDays: Math.max(1, daysBetween(sorted[index].date, record.date)),
  }))
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
  const durationAverage = averageDurationDays(durations)
  const completedDates = getCompletedShedDates(records)
  const cycleRecords = buildIntervalRecords(completedDates.map((date) => ({ id: `shed-complete-${date}`, userId: '', petId: '', type: 'shed' as const, date, createdAt: `${date}T00:00:00` })))
  const cycleAverage = cycleRecords.length ? Math.round(cycleRecords.reduce((sum, record) => sum + record.intervalDays, 0) / cycleRecords.length) : 0
  const ongoing = getOngoingShedRecord(records)
  if (cycleRecords.length > 0) return <SimpleLineChart title="탈피 주기" subtitle={`평균 ${cycleAverage}일${durationAverage ? ` · 평균 완료 기간 ${durationAverage}일` : ''}`} unit="일" records={cycleRecords} getValue={(record) => 'intervalDays' in record ? Number(record.intervalDays) : 0} />
  if (durations.length > 0) return <SimpleLineChart title="탈피 기간" subtitle={`${ongoing ? '진행 중 · ' : ''}평균 ${durationAverage}일`} unit="일" records={durations} getValue={(record) => 'duration' in record ? Number(record.duration) : 0} />
  return <section className="environment-chart shed-cycle-status"><header><strong>탈피</strong><span>{ongoing ? '진행 중' : '주기 계산에는 완료 기록이 2회 이상 필요해요.'}</span></header></section>
}

function EventIntervalChart({ title, records }: { title: string; records: PetRecord[] }) {
  const intervals = buildIntervalRecords(records)
  if (intervals.length === 0) return <section className="environment-chart shed-cycle-status"><header><strong>{title}</strong><span>간격 계산에는 기록이 2회 이상 필요해요.</span></header></section>
  const average = Math.round(intervals.reduce((sum, record) => sum + record.intervalDays, 0) / intervals.length)
  return <SimpleLineChart title={title} subtitle={`평균 ${average}일`} unit="일" records={intervals} getValue={(record) => 'intervalDays' in record ? Number(record.intervalDays) : 0} />
}

function EggStatusChart({ records }: { records: PetRecord[] }) {
  const counts = [
    { label: '무정란', count: records.filter((record) => eggFertility(record) === 'unfertilized').length, color: 'var(--color-primary-300)' },
    { label: '유정란', count: records.filter((record) => eggFertility(record) === 'fertilized').length, color: 'var(--color-primary-600)' },
    { label: '구분 없음', count: records.filter((record) => eggFertility(record) === 'unknown').length, color: 'var(--color-neutral-300)' },
  ].filter((item) => item.count > 0)
  const total = Math.max(1, counts.reduce((sum, item) => sum + item.count, 0))
  return <section className="poop-status-chart"><header><strong>산란 기록</strong><span>기록한 알 상태</span></header><div>{counts.map((item) => <span key={item.label}><b>{item.label}</b><i style={{ width: `${(item.count / total) * 100}%`, background: item.color }} /><em>{item.count}회</em></span>)}</div></section>
}

function PoopStatusChart({ records }: { records: PetRecord[] }) {
  const counts = [
    { label: '정상', status: 'normal' as const, color: 'var(--color-primary-600)' },
    { label: '건조', status: 'dry' as const, color: 'var(--color-accent-700)' },
    { label: '묽음', status: 'diarrhea' as const, color: 'var(--color-primary-300)' },
    { label: '이물질', status: 'foreign_body' as const, color: 'var(--color-warning-600)' },
    { label: '혈변', status: 'blood' as const, color: 'var(--color-error-600)' },
  ].map((item) => ({ ...item, count: records.filter((record) => getStoolStatus(record) === item.status).length }))
  const max = Math.max(1, ...counts.map((item) => item.count))
  return (
    <section className="poop-status-chart">
      <header><strong>배변 상태</strong><span>기록한 상태별 횟수</span></header>
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
        {values.map((record, index) => <span key={`${records[index].id}-label`}><strong>{formatDate(records[index].date)}</strong><b>{formatEnvironmentValue(record)}</b><em>{record.riskLevel <= 1 ? '1단계 정상' : `${record.riskLevel}단계 ${environmentRiskLabel(record.riskLevel)}`}</em></span>)}
      </div>
    </section>
  )
}

function DataVisualizationScreen({ records, petName, onBack, onCreateQna, onFindHospital, onShedComplete, onShedNotYet, resolvedInsightIds, followedUpInsightIds, onFollowUpInsight, onResolveInsight, onKeepInsight }: { records: PetRecord[]; petName: string; onBack: () => void; onCreateQna?: (metric?: DiaryInsight['metric']) => void; onFindHospital?: (concern?: HospitalRecommendationConcern) => void; onShedComplete?: () => void; onShedNotYet?: () => void; resolvedInsightIds?: string[]; followedUpInsightIds?: string[]; onFollowUpInsight?: (insightId: string) => void; onResolveInsight?: (insightId: string) => void; onKeepInsight?: (insightId: string) => void }) {
  return <main className="diary-create-screen data-visualization-screen"><header><button type="button" aria-label="뒤로가기" onClick={onBack}>←</button><strong>기록 모아보기</strong><span /></header><DataVisualization records={records} petName={petName} onCreateQna={onCreateQna} onFindHospital={onFindHospital} onShedComplete={onShedComplete} onShedNotYet={onShedNotYet} resolvedInsightIds={resolvedInsightIds} followedUpInsightIds={followedUpInsightIds} onFollowUpInsight={onFollowUpInsight} onResolveInsight={onResolveInsight} onKeepInsight={onKeepInsight} /></main>
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

function WeightInputDialog({
  petName,
  initialValue,
  saving,
  error,
  onCancel,
  onComplete,
}: {
  petName: string
  initialValue: string
  saving: boolean
  error: string
  onCancel: () => void
  onComplete: (value: number) => void
}) {
  const [value, setValue] = useState(initialValue)
  const numericValue = Number(value)
  const canComplete = Number.isFinite(numericValue) && numericValue > 0

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !saving) onCancel()
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [onCancel, saving])

  return (
    <div className="weight-input-dialog" role="dialog" aria-modal="true" aria-labelledby="weight-input-title">
      <span className="sheet-handle" />
      <header>
        <h2 id="weight-input-title">현재 무게를 기록해주세요</h2>
        <p>{petName}{initialValue ? ` · 최근 무게 ${initialValue}g` : ''}</p>
      </header>
      <WeightField value={value} onChange={setValue} />
      {error && <p className="feeding-food-error" role="alert">{error}</p>}
      <footer>
        <button type="button" className="step-secondary" disabled={saving} onClick={onCancel}>취소</button>
        <button type="button" className="step-primary" disabled={!canComplete || saving} aria-busy={saving} onClick={() => onComplete(numericValue)}>{saving ? '저장 중' : '무게 기록 완료'}</button>
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
        <button type="button" onClick={() => setValue((current) => current - 1)} aria-label="값 줄이기">−</button>
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
  const displayLevel = result.level === 0 ? 1 : result.level
  return (
    <div className={`environment-risk-gauge level-${displayLevel}`}>
      <div><strong>{displayLevel}단계 · {environmentRiskLabel(displayLevel as RiskLevel)}</strong><span>{result.message}</span></div>
      <ol aria-label="환경 위험 단계">
        {[1, 2, 3, 4, 5].map((level) => <li className={level <= displayLevel ? 'active' : ''} key={level} />)}
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

function getLatestWeightInGrams(pet: DiaryPet, records: PetRecord[]) {
  const latestWeight = records
    .filter((record) => record.type === 'weight' && typeof record.weight === 'number' && record.weight > 0)
    .sort(compareRecordTime)
    .at(-1)?.weight
  return typeof latestWeight === 'number' ? formatWeightValue(latestWeight) : getPetWeightInGrams(pet)
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
    recurrenceType: plan.recurrenceType ?? 'weekdays',
    recurrenceIntervalDays: plan.recurrenceIntervalDays ?? 1,
    startDate: plan.startDate,
    endDate: plan.endDate,
    reminderDate: '',
    reminderTime: plan.notificationTime,
    memo: '',
    isActive: plan.isActive,
    createdAt: plan.createdAt,
    updatedAt: plan.updatedAt,
    purpose: plan.purpose,
    sourceRecordId: plan.sourceRecordId,
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
    recurrenceType: reminder.recurrenceType ?? 'weekdays',
    recurrenceIntervalDays: reminder.recurrenceIntervalDays ?? 1,
    startDate: reminder.startDate ?? reminder.reminderDate ?? toDateKey(new Date()),
    endDate: reminder.endDate,
    notificationTime: reminder.reminderTime || '09:00',
    isActive: reminder.isActive,
    createdAt: reminder.createdAt,
    updatedAt: reminder.updatedAt ?? new Date().toISOString(),
    purpose: reminder.purpose,
    sourceRecordId: reminder.sourceRecordId,
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

function getRoutineTypeFromRecord(record: PetRecord): ReminderType | null {
  if (record.environmentRecord) {
    if (record.environmentRecord.metricType === 'humidity') return 'humidity'
    return record.environmentRecord.measurementType === 'water' ? 'water_temperature' : 'temperature'
  }
  if (record.type === 'food') return 'feed'
  if (record.type === 'weight') return 'weight'

  const memo = record.memo?.replace(/\s+/g, '') ?? ''
  if (memo.includes('물그릇교체') || memo.includes('물교체') || memo.includes('물관리')) return 'water'
  if (memo.includes('분무')) return 'mist'
  if (memo.includes('부분청소') || memo.includes('전체청소')) return 'cleaning'
  if (memo.includes('바닥재교체')) return 'substrate_change'
  if (memo.includes('구조물세척')) return 'structure_cleaning'
  if (memo.includes('벽닦기')) return 'wall_wipe'
  if (memo.toUpperCase().includes('UVB')) return 'uvb_check'
  if (memo.includes('수질확인')) return 'water_quality'
  if (memo.includes('여과기상태확인') || memo.includes('여과기확인')) return 'filter_check'
  if (record.type === 'cleaning') return 'cleaning'
  return null
}

function calendarRecordTag(record: PetRecord): CalendarRecordTag {
  if (record.type === 'poop') return { icon: recordMeta.poop.icon, iconSrc: incidentIconSrc.poop, label: recordMeta.poop.label, className: 'poop' }
  if (record.type === 'shed') return { icon: recordMeta.shed.icon, iconSrc: incidentIconSrc.shed, label: recordMeta.shed.label, className: 'shed' }
  if (record.type === 'hospital') return { icon: recordMeta.hospital.icon, iconSrc: incidentIconSrc.hospital, label: record.memo === '진료 예정' ? '진료 예정' : '진료', className: record.memo === '진료 예정' ? 'hospital planned' : 'hospital' }
  if (record.type === 'other' && record.memo?.startsWith('메이팅')) return { icon: '', iconSrc: incidentIconSrc.mating, label: '메이팅', className: 'mating' }
  if (record.type === 'other' && record.memo?.startsWith('산란')) return { icon: '', iconSrc: incidentIconSrc.egg, label: '산란', className: 'egg' }
  if (record.type === 'other' && record.memo?.startsWith('약')) return { icon: '', iconSrc: incidentIconSrc.medicine, label: record.memo === '약 예정' ? '약 예정' : '약', className: record.memo === '약 예정' ? 'medicine planned' : 'medicine' }

  const routineType = getRoutineTypeFromRecord(record)
  const photoKey = routineType ? routinePhotoKeys[routineType] : undefined
  if (routineType && photoKey) {
    const label = routineType === 'humidity'
      ? '습도'
      : routineType === 'water_temperature'
        ? '수온'
        : routineType === 'temperature'
          ? '온도'
      : routineType === 'partial_cleaning' || routineType === 'full_cleaning'
        ? '청소'
        : reminderMeta[routineType].label
    return {
      icon: '',
      iconSrc: `/assets/routine-icons/cards/${photoKey}.png`,
      iconIsRoutineCard: true,
      label,
      className: routineType.replaceAll('_', '-'),
    }
  }
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

function reminderOccursOn(reminder: Reminder, date: Date) {
  const dateKey = toDateKey(date)
  const startDate = reminder.startDate ?? reminder.reminderDate
  if (startDate && dateKey < startDate) return false
  if (reminder.endDate && dateKey > reminder.endDate) return false
  if (reminder.recurrenceType === 'interval') {
    if (!startDate) return false
    const intervalDays = Math.max(1, reminder.recurrenceIntervalDays ?? 1)
    const elapsedDays = Math.round((parseDateKey(dateKey).getTime() - parseDateKey(startDate).getTime()) / 86_400_000)
    return elapsedDays >= 0 && elapsedDays % intervalDays === 0
  }
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

