import { useEffect, useState } from 'react'
import {
  enablePushNotifications,
  getPushSubscriptionState,
  type PushSubscriptionState,
} from '../../lib/pushNotifications'

function NotificationOptInNudge({ userId }: { userId: string }) {
  const [state, setState] = useState<PushSubscriptionState | null>(null)
  const [dismissed, setDismissed] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    if (dismissed) return

    let active = true
    getPushSubscriptionState().then((nextState) => {
      if (active) setState(nextState)
    })
    return () => {
      active = false
    }
  }, [dismissed, userId])

  if (dismissed || !state) return null
  if (state.status === 'enabled' || state.status === 'unsupported') return null

  const enable = async () => {
    setIsSaving(true)
    setErrorMessage('')
    try {
      const nextState = await enablePushNotifications(userId)
      setState(nextState)
      if (nextState.status === 'blocked') setErrorMessage('브라우저 설정에서 파작파작 알림을 허용해 주세요.')
    } catch (error: unknown) {
      if (import.meta.env.DEV) console.error('Push notification nudge opt-in failed.', error)
      setErrorMessage('알림을 설정하지 못했어요. 다시 시도해 주세요.')
    } finally {
      setIsSaving(false)
    }
  }

  const snooze = () => {
    setDismissed(true)
  }

  return (
    <section className="diary-notification-nudge" role="dialog" aria-modal="false" aria-labelledby="diary-notification-nudge-title" aria-describedby="diary-notification-nudge-description">
      <span className="diary-notification-nudge-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M6.8 9.7a5.2 5.2 0 0 1 10.4 0c0 6 2.4 6.1 2.4 7.3H4.4c0-1.2 2.4-1.3 2.4-7.3Z"/><path d="M10 20h4M12 4V2.8"/></svg>
      </span>
      <div className="diary-notification-nudge-copy">
        <strong id="diary-notification-nudge-title">알림을 허용하시겠습니까?</strong>
        <span id="diary-notification-nudge-description">정해둔 시간과 아직 끝내지 않은 돌봄을 알려드려요.</span>
        {errorMessage && <small role="alert">{errorMessage}</small>}
      </div>
      <div className="diary-notification-nudge-actions">
        <button type="button" className="secondary" onClick={snooze}>나중에</button>
        <button type="button" className="primary" disabled={isSaving} onClick={enable}>
          {isSaving ? '설정 중' : '허용하기'}
        </button>
      </div>
    </section>
  )
}

export default NotificationOptInNudge
