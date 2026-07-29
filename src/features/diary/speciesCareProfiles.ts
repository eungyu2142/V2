import { supabase } from '../../lib/supabase'
import type { CareTaskType } from './diaryTypes'

export type CareFoodOption = {
  key: string
  label: string
}

export type CareEnvironmentProfile = {
  key: string
  label: string
  temperatureType: 'air' | 'water'
  targetTemperature: number
  minTemperature: number
  maxTemperature: number
  humidityEnabled: boolean
  targetHumidity: number | null
  minHumidity: number | null
  maxHumidity: number | null
  isBroadCategory: boolean
}

export type SpeciesCareProfile = {
  key: string
  label: string
  category: 'reptile' | 'amphibian'
  aliases: string[]
  environmentProfile: CareEnvironmentProfile | null
  foodOptions: CareFoodOption[]
  routineTypes: CareTaskType[]
}

type SpeciesCareProfileRow = {
  profile_key: string
  label: string
  category: SpeciesCareProfile['category']
  aliases: string[]
  environment_profile: CareEnvironmentProfile | null
  food_options: CareFoodOption[]
  routine_types: CareTaskType[]
}

export const customFoodOptionKey = 'custom'

const fixedHerpFoods: CareFoodOption[] = [
  { key: 'cricket', label: '귀뚜라미' },
  { key: 'mealworm', label: '밀웜' },
  { key: 'silkworm', label: '누에' },
]

const customFood: CareFoodOption = { key: customFoodOptionKey, label: '기타 직접 입력' }

const commonGeckoFoods: CareFoodOption[] = [
  ...fixedHerpFoods,
  { key: 'superworm', label: '슈퍼밀웜' },
  customFood,
]

const geckoDietFoods: CareFoodOption[] = [
  { key: 'gecko_diet', label: '게코 전용 푸드' },
  ...commonGeckoFoods,
]

const commonHerpFoods: CareFoodOption[] = [
  ...fixedHerpFoods,
  customFood,
]

const defaultHerpRoutines: CareTaskType[] = ['feed', 'mist', 'water', 'humidity', 'temperature', 'full_cleaning', 'partial_cleaning', 'custom']
const geckoRoutines: CareTaskType[] = ['feed', 'mist', 'humidity', 'temperature', 'full_cleaning', 'partial_cleaning', 'custom']
const aquaticTurtleRoutines: CareTaskType[] = ['feed', 'water_temperature', 'water_quality', 'filter_check', 'weight', 'full_cleaning', 'partial_cleaning', 'custom']
const semiAquaticTurtleRoutines: CareTaskType[] = ['feed', 'humidity', 'temperature', 'water_temperature', 'water_quality', 'filter_check', 'weight', 'full_cleaning', 'partial_cleaning', 'custom']
const amphibianWaterRoutines: CareTaskType[] = ['feed', 'water_temperature', 'water_quality', 'filter_check', 'weight', 'full_cleaning', 'partial_cleaning', 'custom']

const env = (
  key: string,
  label: string,
  temperatureType: 'air' | 'water',
  targetTemperature: number,
  minTemperature: number,
  maxTemperature: number,
  humidity: { target: number; min: number; max: number } | null,
  isBroadCategory: boolean,
): CareEnvironmentProfile => ({
  key,
  label,
  temperatureType,
  targetTemperature,
  minTemperature,
  maxTemperature,
  humidityEnabled: Boolean(humidity),
  targetHumidity: humidity?.target ?? null,
  minHumidity: humidity?.min ?? null,
  maxHumidity: humidity?.max ?? null,
  isBroadCategory,
})

export const fallbackSpeciesCareProfiles: SpeciesCareProfile[] = [
  { key: 'crested_gecko', label: '크레스티드 게코', category: 'reptile', aliases: ['크레스티드게코', 'crestedgecko'], environmentProfile: env('crested_gecko', '크레스티드 게코', 'air', 24, 22, 26, { target: 55, min: 40, max: 70 }, false), foodOptions: geckoDietFoods, routineTypes: geckoRoutines },
  { key: 'leopard_gecko', label: '레오파드 게코', category: 'reptile', aliases: ['레오파드게코', 'leopardgecko'], environmentProfile: env('leopard_gecko', '레오파드 게코', 'air', 27, 24, 30, { target: 35, min: 30, max: 40 }, false), foodOptions: commonGeckoFoods, routineTypes: geckoRoutines },
  { key: 'fat_tailed_gecko', label: '팻테일 게코', category: 'reptile', aliases: ['펫테일게코', '팻테일게코', 'fattailgecko', 'fat-tailedgecko', 'fat_tailedgecko'], environmentProfile: env('fat_tailed_gecko', '팻테일 게코', 'air', 26, 24, 29, { target: 60, min: 50, max: 70 }, false), foodOptions: commonGeckoFoods, routineTypes: geckoRoutines },
  { key: 'viper_gecko', label: '바이퍼 게코', category: 'reptile', aliases: ['바이퍼게코', 'vipergecko'], environmentProfile: env('viper_gecko', '바이퍼 게코', 'air', 27, 24, 30, { target: 40, min: 30, max: 50 }, false), foodOptions: commonGeckoFoods, routineTypes: geckoRoutines },
  { key: 'chahoua_gecko', label: '차화 게코', category: 'reptile', aliases: ['차화게코', 'chahouagecko'], environmentProfile: env('chahoua_gecko', '차화 게코', 'air', 24, 22, 26, { target: 60, min: 50, max: 75 }, false), foodOptions: geckoDietFoods, routineTypes: geckoRoutines },
  { key: 'gargoyle_gecko', label: '가고일 게코', category: 'reptile', aliases: ['가고일게코', 'gargoylegecko'], environmentProfile: env('gargoyle_gecko', '가고일 게코', 'air', 24, 22, 26, { target: 60, min: 50, max: 75 }, false), foodOptions: geckoDietFoods, routineTypes: geckoRoutines },
  { key: 'day_gecko', label: '데이 게코', category: 'reptile', aliases: ['데이게코', 'daygecko'], environmentProfile: env('day_gecko', '데이 게코', 'air', 27, 24, 30, { target: 58, min: 40, max: 75 }, false), foodOptions: geckoDietFoods, routineTypes: geckoRoutines },
  { key: 'tokay_gecko', label: '토케이 게코', category: 'reptile', aliases: ['토케이게코', 'tokaygecko'], environmentProfile: env('tokay_gecko', '토케이 게코', 'air', 27, 25, 29, { target: 65, min: 55, max: 75 }, false), foodOptions: commonGeckoFoods, routineTypes: geckoRoutines },
  { key: 'bearded_dragon', label: '비어디드래곤', category: 'reptile', aliases: ['비어디드래곤', '비어디', 'beardeddragon'], environmentProfile: env('bearded_dragon', '비어디드래곤', 'air', 30, 22, 42, { target: 35, min: 30, max: 40 }, false), foodOptions: [{ key: 'fruit', label: '과일' }, { key: 'vegetable', label: '채소' }, ...fixedHerpFoods, { key: 'diet', label: '사료' }, customFood], routineTypes: defaultHerpRoutines },
  { key: 'monitor', label: '모니터·왕도마뱀', category: 'reptile', aliases: ['모니터', '왕도마뱀', 'monitor'], environmentProfile: env('monitor', '모니터·왕도마뱀', 'air', 29, 26, 32, { target: 60, min: 45, max: 70 }, true), foodOptions: [{ key: 'mouse', label: '쥐' }, { key: 'chick', label: '병아리' }, { key: 'quail', label: '메추리' }, ...fixedHerpFoods, { key: 'superworm', label: '슈퍼밀웜' }, { key: 'egg', label: '달걀' }, { key: 'meat', label: '육류' }, customFood], routineTypes: defaultHerpRoutines },
  { key: 'chameleon', label: '카멜레온', category: 'reptile', aliases: ['카멜레온', 'chameleon'], environmentProfile: env('chameleon', '카멜레온', 'air', 25, 22, 28, { target: 65, min: 50, max: 80 }, true), foodOptions: [...fixedHerpFoods, { key: 'superworm', label: '슈퍼밀웜' }, { key: 'fly', label: '파리류' }, customFood], routineTypes: defaultHerpRoutines },
  { key: 'iguana', label: '이구아나', category: 'reptile', aliases: ['이구아나', 'iguana'], environmentProfile: env('iguana', '이구아나', 'air', 28, 25, 31, { target: 75, min: 65, max: 85 }, true), foodOptions: [{ key: 'leafy_greens', label: '잎채소' }, { key: 'vegetables', label: '기타 채소' }, { key: 'fruit', label: '과일' }, { key: 'flower', label: '꽃' }, { key: 'iguana_diet', label: '이구아나 전용 사료' }, ...fixedHerpFoods, customFood], routineTypes: defaultHerpRoutines },
  { key: 'skink', label: '스킨크', category: 'reptile', aliases: ['스킨크', 'skink'], environmentProfile: env('skink', '스킨크', 'air', 27, 24, 30, { target: 50, min: 40, max: 60 }, true), foodOptions: [...fixedHerpFoods, { key: 'superworm', label: '슈퍼밀웜' }, { key: 'egg', label: '달걀' }, { key: 'meat', label: '육류' }, { key: 'vegetable', label: '채소' }, { key: 'fruit', label: '과일' }, { key: 'skink_diet', label: '스킨크 전용 사료' }, customFood], routineTypes: defaultHerpRoutines },
  { key: 'uromastyx', label: '유로매스틱스', category: 'reptile', aliases: ['유로매스틱스', 'uromastyx'], environmentProfile: env('uromastyx', '유로매스틱스', 'air', 34, 30, 38, { target: 25, min: 20, max: 35 }, true), foodOptions: [{ key: 'leafy_greens', label: '잎채소' }, { key: 'vegetables', label: '기타 채소' }, { key: 'flower', label: '꽃' }, { key: 'seed', label: '씨앗류' }, { key: 'bean', label: '콩류' }, { key: 'uromastyx_diet', label: '유로매스틱스 전용 사료' }, ...fixedHerpFoods, customFood], routineTypes: defaultHerpRoutines },
  { key: 'snake', label: '스네이크', category: 'reptile', aliases: ['스네이크', 'snake'], environmentProfile: null, foodOptions: [{ key: 'mouse', label: '쥐' }, { key: 'quail', label: '메추리' }, { key: 'chick', label: '병아리' }, customFood], routineTypes: ['feed', 'water', 'full_cleaning', 'partial_cleaning', 'weight', 'custom'] },
  { key: 'python', label: '파이톤', category: 'reptile', aliases: ['파이톤', 'python'], environmentProfile: null, foodOptions: [{ key: 'mouse', label: '쥐' }, { key: 'rat', label: '랫' }, { key: 'quail', label: '메추리' }, customFood], routineTypes: ['feed', 'water', 'full_cleaning', 'partial_cleaning', 'weight', 'custom'] },
  { key: 'boa', label: '보아', category: 'reptile', aliases: ['보아', 'boa'], environmentProfile: null, foodOptions: [{ key: 'mouse', label: '쥐' }, { key: 'rat', label: '랫' }, { key: 'quail', label: '메추리' }, customFood], routineTypes: ['feed', 'water', 'full_cleaning', 'partial_cleaning', 'weight', 'custom'] },
  { key: 'tortoise', label: '육지거북', category: 'reptile', aliases: ['육지거북', '육지거북이', 'tortoise'], environmentProfile: env('tortoise', '육지거북', 'air', 23, 20, 25, { target: 50, min: 40, max: 60 }, true), foodOptions: [{ key: 'vegetable', label: '채소' }, customFood], routineTypes: ['feed', 'water', 'humidity', 'temperature', 'full_cleaning', 'partial_cleaning', 'weight', 'custom'] },
  { key: 'aquatic_turtle', label: '수생거북', category: 'reptile', aliases: ['수생거북', '수생거북이', 'aquaticturtle'], environmentProfile: env('aquatic_turtle', '수생거북', 'water', 25, 22, 27, null, true), foodOptions: [{ key: 'turtle_diet', label: '거북이 전용사료' }, { key: 'cricket', label: '귀뚜라미' }, { key: 'aquatic_plant', label: '수초' }, customFood], routineTypes: aquaticTurtleRoutines },
  { key: 'semi_aquatic_turtle', label: '반수생 거북', category: 'reptile', aliases: ['반수생거북', '반수생거북이', 'semiaquaticturtle', 'terrapin'], environmentProfile: env('semi_aquatic_turtle', '반수생 거북', 'air', 25, 22, 25, null, true), foodOptions: [{ key: 'turtle_diet', label: '거북이사료' }, { key: 'cricket', label: '귀뚜라미' }, { key: 'mealworm', label: '밀웜' }, { key: 'vegetable', label: '채소' }, customFood], routineTypes: semiAquaticTurtleRoutines.filter((type) => type !== 'humidity') },
  { key: 'pacman_frog', label: '팩맨', category: 'amphibian', aliases: ['팩맨', 'pacman', 'pacmanfrog'], environmentProfile: env('pacman_frog', '팩맨', 'air', 25, 23, 28, { target: 75, min: 70, max: 85 }, true), foodOptions: commonHerpFoods, routineTypes: defaultHerpRoutines },
  { key: 'tree_frog', label: '트리프록', category: 'amphibian', aliases: ['트리프록', 'treefrog'], environmentProfile: env('tree_frog', '트리프록', 'air', 25, 22, 28, { target: 75, min: 65, max: 85 }, true), foodOptions: commonHerpFoods, routineTypes: defaultHerpRoutines },
  { key: 'dart_frog', label: '다트프록', category: 'amphibian', aliases: ['다트프록', '독화살개구리', 'dartfrog'], environmentProfile: env('dart_frog', '다트프록', 'air', 24, 22, 26, { target: 85, min: 75, max: 90 }, true), foodOptions: commonHerpFoods, routineTypes: defaultHerpRoutines },
  { key: 'toad', label: '토드', category: 'amphibian', aliases: ['토드', '두꺼비', 'toad'], environmentProfile: env('toad', '토드', 'air', 22, 19, 25, { target: 75, min: 65, max: 85 }, true), foodOptions: commonHerpFoods, routineTypes: defaultHerpRoutines },
  { key: 'newt', label: '뉴트', category: 'amphibian', aliases: ['뉴트', 'newt'], environmentProfile: env('newt', '뉴트', 'water', 19, 16, 22, null, true), foodOptions: commonHerpFoods, routineTypes: amphibianWaterRoutines.filter((type) => type !== 'filter_check') },
  { key: 'salamander', label: '살라만다', category: 'amphibian', aliases: ['살라만다', 'salamander'], environmentProfile: env('salamander', '살라만다', 'air', 19, 16, 22, { target: 80, min: 70, max: 90 }, true), foodOptions: commonHerpFoods, routineTypes: defaultHerpRoutines },
  { key: 'axolotl', label: '아홀로틀', category: 'amphibian', aliases: ['아홀로틀', 'axolotl'], environmentProfile: env('axolotl', '아홀로틀', 'water', 18, 16, 20, null, false), foodOptions: commonHerpFoods, routineTypes: amphibianWaterRoutines },
]

const thawedRodentFoods: CareFoodOption[] = [
  { key: 'frozen_thawed_mouse', label: '냉동 해동 마우스' },
  { key: 'frozen_thawed_rat', label: '냉동 해동 래트' },
  customFood,
]

const speciesCareProfileOverrides: Record<string, Partial<SpeciesCareProfile>> = {
  snake: {
    environmentProfile: env('snake', '스네이크', 'air', 26, 23, 29, { target: 50, min: 40, max: 60 }, true),
    foodOptions: thawedRodentFoods,
    routineTypes: ['feed', 'water', 'humidity', 'temperature', 'full_cleaning', 'partial_cleaning', 'weight', 'custom'],
  },
  python: {
    environmentProfile: env('python', '파이톤', 'air', 28, 25, 31, { target: 60, min: 50, max: 70 }, true),
    foodOptions: thawedRodentFoods,
    routineTypes: ['feed', 'water', 'humidity', 'temperature', 'full_cleaning', 'partial_cleaning', 'weight', 'custom'],
  },
  boa: {
    environmentProfile: env('boa', '보아', 'air', 28, 25, 31, { target: 65, min: 55, max: 75 }, true),
    foodOptions: thawedRodentFoods,
    routineTypes: ['feed', 'water', 'humidity', 'temperature', 'full_cleaning', 'partial_cleaning', 'weight', 'custom'],
  },
  newt: {
    environmentProfile: env('newt', '뉴트', 'water', 19, 16, 22, { target: 75, min: 65, max: 85 }, true),
    foodOptions: [
      { key: 'earthworm', label: '지렁이' },
      { key: 'bloodworm', label: '장구벌레' },
      { key: 'blackworm', label: '블랙웜' },
      { key: 'daphnia', label: '물벼룩' },
      customFood,
    ],
  },
  salamander: {
    foodOptions: [
      { key: 'earthworm', label: '지렁이' },
      { key: 'cricket', label: '귀뚜라미' },
      { key: 'springtail', label: '톡토기' },
      { key: 'isopod', label: '등각류' },
      customFood,
    ],
  },
  axolotl: {
    foodOptions: [
      { key: 'earthworm', label: '지렁이' },
      { key: 'sinking_pellet', label: '전용 침강사료' },
      { key: 'bloodworm', label: '장구벌레' },
      { key: 'blackworm', label: '블랙웜' },
      customFood,
    ],
  },
  pacman_frog: {
    environmentProfile: env('pacman_frog', '팩맨', 'air', 25, 23, 28, { target: 70, min: 60, max: 80 }, true),
    foodOptions: [
      { key: 'cricket', label: '귀뚜라미' },
      { key: 'earthworm', label: '지렁이' },
      { key: 'silkworm', label: '누에' },
      customFood,
    ],
  },
  tree_frog: {
    environmentProfile: env('tree_frog', '트리프록', 'air', 24, 22, 28, { target: 70, min: 60, max: 80 }, true),
    foodOptions: [
      { key: 'cricket', label: '귀뚜라미' },
      { key: 'silkworm', label: '누에' },
      { key: 'flightless_fruit_fly', label: '날개 없는 초파리' },
      customFood,
    ],
  },
  dart_frog: {
    environmentProfile: env('dart_frog', '다트프록', 'air', 23, 22, 26, { target: 85, min: 75, max: 90 }, true),
    foodOptions: [
      { key: 'flightless_fruit_fly', label: '날개 없는 초파리' },
      { key: 'springtail', label: '톡토기' },
      { key: 'small_isopod', label: '소형 등각류' },
      customFood,
    ],
  },
  toad: {
    environmentProfile: env('toad', '토드', 'air', 22, 19, 25, { target: 65, min: 55, max: 75 }, true),
    foodOptions: [
      { key: 'cricket', label: '귀뚜라미' },
      { key: 'earthworm', label: '지렁이' },
      { key: 'silkworm', label: '누에' },
      { key: 'isopod', label: '등각류' },
      customFood,
    ],
  },
}

function applySpeciesCareProfileOverrides(profile: SpeciesCareProfile): SpeciesCareProfile {
  const override = speciesCareProfileOverrides[profile.key]
  return override ? { ...profile, ...override } : profile
}

export function normalizeSpeciesText(value?: string) {
  return (value ?? '').toLowerCase().replace(/\s+/g, '').replace(/[()]/g, '')
}

export function findSpeciesCareProfile(species: string, profiles: SpeciesCareProfile[] = fallbackSpeciesCareProfiles) {
  const normalized = normalizeSpeciesText(species)
  const profile = profiles.find((item) => normalizeSpeciesText(item.label) === normalized || item.aliases.some((alias) => normalized.includes(normalizeSpeciesText(alias)))) ?? null
  return profile ? applySpeciesCareProfileOverrides(profile) : null
}

export async function listSpeciesCareProfiles() {
  const { data, error } = await supabase.from('species_care_profiles').select('*').order('sort_order', { ascending: true })
  if (error) throw error
  return ((data ?? []) as SpeciesCareProfileRow[]).map((row) => applySpeciesCareProfileOverrides({
    key: row.profile_key,
    label: row.label,
    category: row.category,
    aliases: row.aliases ?? [],
    environmentProfile: row.environment_profile,
    foodOptions: row.food_options ?? [],
    routineTypes: row.routine_types ?? [],
  }))
}
