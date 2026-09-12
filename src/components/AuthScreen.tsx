import { type FormEvent, useState } from 'react'
import {
  findUsernameByNicknameAndPet,
  resetPasswordByUsernameAndPet,
  signInWithUsername,
  signUpWithUsername,
} from '../lib/auth'
import { RequiredMark } from './common/FieldMarkers'
import Mascot from './common/Mascot'
import { Button } from './ui/Button'
import { FlowHeader } from './ui/FlowHeader'

type AuthMode = 'login' | 'signup' | 'find-id' | 'reset-password'

export default function AuthScreen() {
  const [mode, setMode] = useState<AuthMode>('login')
  const [username, setUsername] = useState('')
  const [nickname, setNickname] = useState('')
  const [petName, setPetName] = useState('')
  const [password, setPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [message, setMessage] = useState('')
  const [foundUsername, setFoundUsername] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const switchMode = (nextMode: AuthMode) => {
    setMode(nextMode)
    setMessage('')
    setFoundUsername('')
    setPassword('')
    setNewPassword('')
    setConfirmPassword('')
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setMessage('')
    setFoundUsername('')
    setSubmitting(true)
    try {
      if (mode === 'signup') {
        if (password !== confirmPassword) throw new Error('비밀번호가 서로 일치하지 않습니다.')
        await signUpWithUsername(username, nickname, password)
        return
      }
      if (mode === 'find-id') {
        const nextUsername = await findUsernameByNicknameAndPet(nickname, petName)
        setFoundUsername(nextUsername)
        return
      }
      if (mode === 'reset-password') {
        await resetPasswordByUsernameAndPet(username, petName, newPassword, confirmPassword)
        setMessage('비밀번호가 변경되었습니다. 새 비밀번호로 로그인해 주세요.')
        setNewPassword('')
        setConfirmPassword('')
        return
      }
      await signInWithUsername(username, password)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '인증 처리 중 오류가 발생했습니다.')
    } finally {
      setSubmitting(false)
    }
  }

  const submitLabel = mode === 'signup'
    ? '가입하기'
    : mode === 'find-id'
      ? '아이디 찾기'
      : mode === 'reset-password'
        ? '비밀번호 변경'
        : '로그인'

  return (
    <main className="grid min-h-dvh place-items-center bg-[var(--color-surface)] px-6 py-8">
      <section className={`w-full max-w-[360px] ${mode === 'login' ? 'py-6' : 'self-start pt-3'}`}>
        {mode === 'login' ? <div className="mb-9 flex flex-col items-center gap-3 text-[var(--color-primary-900)] [&>strong]:text-4xl [&>strong]:font-black [&>strong]:tracking-tight"><Mascot mood="happy" /><strong>파작파작</strong></div> : <FlowHeader title={mode === 'signup' ? '회원가입' : mode === 'find-id' ? '아이디 찾기' : '비밀번호 재설정'} onBack={() => switchMode('login')} />}
        <form className="grid gap-4 [&>label]:grid [&>label]:gap-2" onSubmit={submit}>
          {(mode === 'login' || mode === 'signup' || mode === 'reset-password') && (
            <label><span className="sr-only">아이디<RequiredMark /></span><input autoComplete="username" value={username} onChange={(event) => setUsername(event.target.value)} placeholder="아이디" required /></label>
          )}
          {(mode === 'signup' || mode === 'find-id') && (
            <label><span className="sr-only">닉네임<RequiredMark /></span><input autoComplete="nickname" value={nickname} onChange={(event) => setNickname(event.target.value)} placeholder="닉네임" required /></label>
          )}
          {(mode === 'find-id' || mode === 'reset-password') && (
            <label><span className="sr-only">반려동물 이름<RequiredMark /></span><input value={petName} onChange={(event) => setPetName(event.target.value)} placeholder="등록한 반려동물 이름" required /></label>
          )}
          {(mode === 'login' || mode === 'signup') && (
            <label><span className="sr-only">비밀번호<RequiredMark /></span><input type="password" autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="비밀번호 (6자 이상)" minLength={6} required /></label>
          )}
          {mode === 'signup' && <label><span className="sr-only">비밀번호 확인<RequiredMark /></span><input type="password" autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} placeholder="비밀번호 확인" minLength={6} required /></label>}
          {mode === 'reset-password' && (
            <>
              <label><span className="sr-only">새 비밀번호<RequiredMark /></span><input type="password" autoComplete="new-password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} placeholder="비밀번호 (6자 이상)" minLength={6} required /></label>
              <label><span className="sr-only">새 비밀번호 확인<RequiredMark /></span><input type="password" autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} placeholder="새 비밀번호 재입력" minLength={6} required /></label>
            </>
          )}
          {foundUsername && <p className="rounded-[var(--radius-control)] bg-[var(--color-primary-50)] p-3 text-[var(--color-primary-700)]">아이디: <strong>{foundUsername}</strong></p>}
          {message && <p className="text-sm text-[var(--color-error-600)]" role="alert">{message}</p>}
          <Button className="mt-3" fullWidth type="submit" disabled={submitting}>{submitting ? '처리 중...' : submitLabel}</Button>
        </form>
        <div className="mt-5 flex items-center justify-center gap-3 text-xs text-[var(--color-text-secondary)] [&>button]:min-h-10">
          {mode === 'login' ? <><button type="button" onClick={() => switchMode('signup')}>회원가입</button><span aria-hidden="true">|</span><button type="button" onClick={() => switchMode('find-id')}>아이디 찾기</button></> : mode === 'find-id' ? <button type="button" onClick={() => switchMode('reset-password')}>비밀번호 재설정</button> : null}
        </div>
      </section>
    </main>
  )
}
