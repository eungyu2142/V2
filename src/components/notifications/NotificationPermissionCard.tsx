import { useEffect, useState } from 'react'
import {
  disablePushNotifications,
  enablePushNotifications,
  getPushSubscriptionState,
  type PushSubscriptionState,
} from '../../lib/pushNotifications'

const initialState: PushSubscriptionState = {
  permission: 'default',
  isSubscribed: false,
}

function permissionLabel(state: PushSubscriptionState) {
  if (state.permission === 'unsupported') return '지원하지 않음'
  if (state.permission === 'denied') return '차단됨'
  if (state.permission === 'granted' && state.isSubscribed) return '허용됨'
  if (state.permission === 'granted') return '구독 해제됨'
  return '아직 선택하지 않음'
}

function permissionMessage(state: PushSubscriptionState) {
  if (state.permission === 'unsupported') return '이 기기에서는 알림을 지원하지 않아요.'
  if (state.permission === 'denied') return '브라우저 설정에서 ExoCare 알림 권한을 허용해 주세요.'
  if (state.permission === 'granted' && state.isSubscribed) return '이 기기에서 돌봄 알림을 받을 수 있어요.'
  return '루틴 시간과 완료하지 않은 돌봄을 알려드려요.'
}

function readableError(error: unknown) {
  if (!(error instanceof Error)) return '알림 설정을 완료하지 못했어요. 다시 시도해 주세요.'
  if (error.message === 'VAPID_PUBLIC_KEY_MISSING') return '알림 설정이 아직 준비되지 않았어요.'
  if (error.message === 'VAPID_PUBLIC_KEY_INVALID') return '알림 설정값을 확인해 주세요.'
  if (error.message === 'PUSH_SUBSCRIPTION_KEYS_MISSING') return '브라우저 구독 정보를 확인하지 못했어요.'
  if (error.message === 'PUSH_UNSUBSCRIBE_FAILED') return '알림 구독을 해제하지 못했어요. 다시 시도해 주세요.'
  return '알림 설정을 완료하지 못했어요. 다시 시도해 주세요.'
}

function NotificationPermissionCard({ userId }: { userId: string }) {
  const [state, setState] = useState<PushSubscriptionState>(initialState)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    let active = true
    getPushSubscriptionState()
      .then((nextState) => {
        if (active) setState(nextState)
      })
      .finally(() => {
        if (active) setIsLoading(false)
      })

    return () => {
      active = false
    }
  }, [])

  const enable = async () => {
    setIsSaving(true)
    setErrorMessage('')
    try {
      setState(await enablePushNotifications(userId))
    } catch (error: unknown) {
      if (import.meta.env.DEV) console.error('Push notification opt-in failed.', error)
      setErrorMessage(readableError(error))
    } finally {
      setIsSaving(false)
    }
  }

  const disable = async () => {
    setIsSaving(true)
    setErrorMessage('')
    try {
      setState(await disablePushNotifications(userId))
    } catch (error: unknown) {
      if (import.meta.env.DEV) console.error('Push notification opt-out failed.', error)
      setErrorMessage(readableError(error))
    } finally {
      setIsSaving(false)
    }
  }

  const subscribed = state.isSubscribed
  const canEnable = state.permission !== 'unsupported' && state.permission !== 'denied'

  return (
    <section className="notification-permission-card" aria-labelledby="notification-permission-title">
      <div className="notification-permission-copy">
        <div>
          <h3 id="notification-permission-title">돌봄 알림 받기</h3>
          <span className={`notification-permission-status ${state.permission}`}>
            {isLoading ? '확인 중' : permissionLabel(state)}
          </span>
        </div>
        <p>{permissionMessage(state)}</p>
      </div>

      {!isLoading && subscribed && (
        <button type="button" className="notification-disable-button" disabled={isSaving} onClick={disable}>
          {isSaving ? '해제 중...' : '알림 해제'}
        </button>
      )}

      {!isLoading && !subscribed && canEnable && (
        <button type="button" className="notification-enable-button" disabled={isSaving} onClick={enable}>
          {isSaving ? '설정 중...' : '알림 허용'}
        </button>
      )}

      {errorMessage && <p className="notification-permission-error" role="alert">{errorMessage}</p>}
      <span className="sr-only" aria-live="polite">{permissionLabel(state)}</span>
    </section>
  )
}

export default NotificationPermissionCard
