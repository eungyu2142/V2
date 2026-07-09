import { supabase } from './supabase'

const INTERNAL_AUTH_DOMAIN = 'exopet.local'
const usernamePattern = /^[a-z0-9_]{4,20}$/

export function normalizeUsername(value: string) {
  return value.trim().toLowerCase()
}

function toInternalEmail(username: string) {
  return `${normalizeUsername(username)}@${INTERNAL_AUTH_DOMAIN}`
}

export function validateUsername(username: string) {
  return usernamePattern.test(normalizeUsername(username))
}

export async function signUpWithUsername(username: string, nickname: string, password: string) {
  const normalizedUsername = normalizeUsername(username)
  const normalizedNickname = nickname.trim()

  if (!validateUsername(normalizedUsername)) {
    throw new Error('아이디는 영문 소문자, 숫자, 밑줄로 4~20자 입력해 주세요.')
  }
  if (!normalizedNickname) throw new Error('닉네임을 입력해 주세요.')
  if (password.length < 6) throw new Error('비밀번호는 6자 이상 입력해 주세요.')

  const { data, error } = await supabase.auth.signUp({
    email: toInternalEmail(normalizedUsername),
    password,
    options: {
      data: { username: normalizedUsername, nickname: normalizedNickname },
    },
  })

  if (error) throw new Error(toAuthMessage(error.message))
  if (!data.session) {
    throw new Error('회원가입 후 바로 로그인할 수 있도록 Supabase 이메일 확인 옵션을 꺼 주세요.')
  }
  return data
}

export async function signInWithUsername(username: string, password: string) {
  const normalizedUsername = normalizeUsername(username)
  if (!validateUsername(normalizedUsername)) {
    throw new Error('아이디 또는 비밀번호를 확인해 주세요.')
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email: toInternalEmail(normalizedUsername),
    password,
  })

  if (error) throw new Error(toAuthMessage(error.message))
  return data
}

function toAuthMessage(message: string) {
  const normalized = message.toLowerCase()
  if (normalized.includes('already registered') || normalized.includes('already exists')) {
    return '이미 사용 중인 아이디입니다.'
  }
  if (normalized.includes('invalid login credentials')) {
    return '아이디 또는 비밀번호를 확인해 주세요.'
  }
  if (normalized.includes('password')) return '비밀번호는 6자 이상 입력해 주세요.'
  return '인증 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.'
}
