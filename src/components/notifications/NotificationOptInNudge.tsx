import { useEffect, useState } from 'react'
import {
  enablePushNotifications,
  getPushSubscriptionState,
  type PushSubscriptionState,
} from '../../lib/pushNotifications'

const snoozeDurationMs = 7 * 24 * 60 * 60 * 1000

function snoozeKey(userId: string) {
  return `exocare.push.nudge-snoozed-until.${userId}`
}

function isSnoozed(userId: string) {
  const value = Number(localStorage.getItem(snoozeKey(userId)))
  return Number.isFinite(value) && value > Date.now()
}

function NotificationOptInNudge({ userId, hasActiveRoutines }: { userId: string; hasActiveRoutines: boolean }) {
  const [state, setState] = useState<PushSubscriptionState | null>(null)
  const [dismissed, setDismissed] = useState(() => isSnoozed(userId))
  const [isSaving, setIsSaving] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    if (!hasActiveRoutines || dismissed) return

    let active = true
    getPushSubscriptionState().then((nextState) => {
      if (active) setState(nextState)
    })
    return () => {
      active = false
    }
  }, [dismissed, hasActiveRoutines, userId])

  if (!hasActiveRoutines || dismissed || !state) return null
  if (state.status === 'enabled' || state.status === 'blocked' || state.status === 'unsupported') return null

  const enable = async () => {
    setIsSaving(true)
    setErrorMessage('')
    try {
      const nextState = await enablePushNotifications(userId)
      setState(nextState)
      if (nextState.status === 'enabled') localStorage.removeItem(snoozeKey(userId))
    } catch (error: unknown) {
      if (import.meta.env.DEV) console.error('Push notification nudge opt-in failed.', error)
      setErrorMessage('알림을 설정하지 못했어요. 다시 시도해 주세요.')
    } finally {
      setIsSaving(false)
    }
  }

  const snooze = () => {
    localStorage.setItem(snoozeKey(userId), String(Date.now() + snoozeDurationMs))
    setDismissed(true)
  }

  return (
    <section className="diary-notification-nudge" aria-labelledby="diary-notification-nudge-title">
      <div>
        <strong id="diary-notification-nudge-title">루틴 알림을 켜놓을까요?</strong>
        <span>정해둔 시간과 아직 끝내지 않은 돌봄을 알려드려요.</span>
        {errorMessage && <small role="alert">{errorMessage}</small>}
      </div>
      <div className="diary-notification-nudge-actions">
        <button type="button" className="secondary" onClick={snooze}>나중에</button>
        <button type="button" className="primary" disabled={isSaving} onClick={enable}>
          {isSaving ? '설정 중' : '알림 켜기'}
        </button>
      </div>
    </section>
  )
}

export default NotificationOptInNudge
