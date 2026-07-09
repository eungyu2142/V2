import { type FormEvent, useState } from 'react'
import { signInWithUsername, signUpWithUsername } from '../lib/auth'

export default function AuthScreen() {
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [username, setUsername] = useState('')
  const [nickname, setNickname] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setMessage('')
    setSubmitting(true)
    try {
      if (mode === 'signup') await signUpWithUsername(username, nickname, password)
      else await signInWithUsername(username, password)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '인증 처리 중 오류가 발생했습니다.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="auth-screen">
      <section className="auth-panel">
        <div className="auth-brand"><strong>Exocare</strong><span>특수동물 케어</span></div>
        <div className="auth-tabs" role="tablist">
          <button className={mode === 'login' ? 'active' : ''} type="button" onClick={() => { setMode('login'); setMessage('') }}>로그인</button>
          <button className={mode === 'signup' ? 'active' : ''} type="button" onClick={() => { setMode('signup'); setMessage('') }}>회원가입</button>
        </div>
        <form onSubmit={submit}>
          <label>아이디<input autoComplete="username" value={username} onChange={(event) => setUsername(event.target.value)} placeholder="영문 소문자, 숫자, 밑줄 4~20자" required /></label>
          {mode === 'signup' && <label>닉네임<input autoComplete="nickname" value={nickname} onChange={(event) => setNickname(event.target.value)} placeholder="앱에서 사용할 이름" required /></label>}
          <label>비밀번호<input type="password" autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="6자 이상" minLength={6} required /></label>
          {message && <p className="auth-message" role="alert">{message}</p>}
          <button className="auth-submit" disabled={submitting}>{submitting ? '처리 중...' : mode === 'signup' ? '회원가입' : '로그인'}</button>
        </form>
      </section>
    </main>
  )
}
