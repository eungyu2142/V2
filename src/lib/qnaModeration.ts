import { supabase } from './supabase'

// Based on the CC0 KoreanCursewordRegex project and its commonly used variants.
// Source: https://github.com/curioustorvald/KoreanCursewordRegex
const profanityPatterns = [
  /[시씨씪슈쓔쉬쉽쒸쓉][0-9 ]*[바발벌빠빡빨뻘파팔펄]/giu,
  /[섊좆좇졷좄좃좉졽썅춍봊]/giu,
  /[ㅈ조][0-9 ]*까/giu,
  /ㅅ\s*ㅣ\s*ㅂ\s*ㅏ\s*ㄹ?/giu,
  /[ㅅㅆ][0-9 ]*[ㄲㅅㅆㅂ]/giu,
  /[존좉좇][0-9 ]*나/giu,
  /[병븅][0-9 ]*[신딱]/giu,
  /미친[가-닣닥-힣]?/giu,
  /[염옘][0-9 ]*병/giu,
  /[지야][0-9 ]*랄/giu,
  /니[애에]미/giu,
  /[샊샛세쉐쉑새][ ]*[끼키퀴]/giu,
  /[tT]l[qQ]kf|[Ww]ls|[ㅂ]신|[ㅅ]발|[ㅈ]밥/gu,
]

const DEVICE_ID_KEY = 'exocare_install_id_v1'

export function findKoreanProfanity(text: string) {
  const matches = new Set<string>()
  profanityPatterns.forEach((pattern) => {
    pattern.lastIndex = 0
    for (const match of text.matchAll(pattern)) {
      if (match[0]) matches.add(match[0])
    }
  })
  return [...matches]
}

export function containsKoreanProfanity(text: string) {
  return findKoreanProfanity(text).length > 0
}

export function maskKoreanProfanity(text: string) {
  return profanityPatterns.reduce((masked, pattern) => {
    pattern.lastIndex = 0
    return masked.replace(pattern, (value) => '#'.repeat([...value].length))
  }, text)
}

async function currentDeviceHash() {
  let installId = localStorage.getItem(DEVICE_ID_KEY)
  if (!installId) {
    installId = crypto.randomUUID()
    localStorage.setItem(DEVICE_ID_KEY, installId)
  }
  const bytes = new TextEncoder().encode(installId)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, '0')).join('')
}

export async function isCurrentDeviceBlocked() {
  const { data, error } = await supabase.rpc('is_app_device_blocked', { p_device_hash: await currentDeviceHash() })
  if (error) throw error
  return data === true
}

export async function registerCurrentDevice() {
  const { data, error } = await supabase.rpc('register_app_device', { p_device_hash: await currentDeviceHash() })
  if (error) throw error
  return data !== false
}

export async function getMyQnaWarningCount() {
  const { data, error } = await supabase.rpc('get_my_qna_warning_count')
  if (error) throw error
  return Number(data ?? 0)
}
