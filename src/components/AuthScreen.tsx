import { type FormEvent, useState } from 'react'
import {
  findUsernameByNicknameAndPet,
  resetPasswordByUsernameAndPet,
  signInWithUsername,
  signUpWithUsername,
} from '../lib/auth'

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
    ? '회원가입'
    : mode === 'find-id'
      ? '아이디 찾기'
      : mode === 'reset-password'
        ? '비밀번호 변경'
        : '로그인'

  return (
    <main className="auth-screen">
      <section className="auth-panel">
        <div className="auth-brand"><strong>Exocare</strong><span>특수동물 케어</span></div>
        <div className="auth-tabs" role="tablist">
          <button className={mode === 'login' ? 'active' : ''} type="button" onClick={() => switchMode('login')}>로그인</button>
          <button className={mode === 'signup' ? 'active' : ''} type="button" onClick={() => switchMode('signup')}>회원가입</button>
        </div>
        <form onSubmit={submit}>
          {(mode === 'login' || mode === 'signup' || mode === 'reset-password') && (
            <label>아이디<input autoComplete="username" value={username} onChange={(event) => setUsername(event.target.value)} placeholder="영문 소문자, 숫자, 밑줄 4~20자" required /></label>
          )}
          {(mode === 'signup' || mode === 'find-id') && (
            <label>닉네임<input autoComplete="nickname" value={nickname} onChange={(event) => setNickname(event.target.value)} placeholder="앱에서 사용할 이름" required /></label>
          )}
          {(mode === 'find-id' || mode === 'reset-password') && (
            <label>반려동물 이름<input value={petName} onChange={(event) => setPetName(event.target.value)} placeholder="등록한 반려동물 이름" required /></label>
          )}
          {(mode === 'login' || mode === 'signup') && (
            <label>비밀번호<input type="password" autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="6자 이상" minLength={6} required /></label>
          )}
          {mode === 'reset-password' && (
            <>
              <label>새 비밀번호<input type="password" autoComplete="new-password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} placeholder="6자 이상" minLength={6} required /></label>
              <label>새 비밀번호 확인<input type="password" autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} placeholder="새 비밀번호 재입력" minLength={6} required /></label>
            </>
          )}
          {foundUsername && <p className="auth-result">아이디: <strong>{foundUsername}</strong></p>}
          {message && <p className="auth-message" role="alert">{message}</p>}
          <button className="auth-submit" disabled={submitting}>{submitting ? '처리 중...' : submitLabel}</button>
        </form>
        <div className="auth-links">
          <button type="button" onClick={() => switchMode('find-id')}>아이디 찾기</button>
          <button type="button" onClick={() => switchMode('reset-password')}>비밀번호 재설정</button>
        </div>
      </section>
    </main>
  )
}
