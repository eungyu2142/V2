import { supabase } from './supabase'

export type PushPermissionState = NotificationPermission | 'unsupported'

export type PushSubscriptionState = {
  permission: PushPermissionState
  isSubscribed: boolean
}

const SERVICE_WORKER_PATH = '/sw.js'

function isLocalhost(hostname: string) {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]'
}

export function isPushNotificationSupported() {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false

  return (
    'serviceWorker' in navigator
    && 'PushManager' in window
    && 'Notification' in window
    && (window.isSecureContext || isLocalhost(window.location.hostname))
  )
}

export function getPushPermissionState(): PushPermissionState {
  if (!isPushNotificationSupported()) return 'unsupported'
  return Notification.permission
}

function urlBase64ToUint8Array(value: string) {
  const padding = '='.repeat((4 - (value.length % 4)) % 4)
  const base64 = (value + padding).replace(/-/g, '+').replace(/_/g, '/')

  let decoded: string
  try {
    decoded = window.atob(base64)
  } catch {
    throw new Error('VAPID_PUBLIC_KEY_INVALID')
  }

  return Uint8Array.from(decoded, (character) => character.charCodeAt(0))
}

async function getServiceWorkerRegistration() {
  const existingRegistration = await navigator.serviceWorker.getRegistration('/')
  if (existingRegistration) return existingRegistration

  await navigator.serviceWorker.register(SERVICE_WORKER_PATH, { scope: '/' })
  return navigator.serviceWorker.ready
}

function readSubscriptionKeys(subscription: PushSubscription) {
  const payload = subscription.toJSON()
  const endpoint = payload.endpoint ?? subscription.endpoint
  const p256dh = payload.keys?.p256dh
  const auth = payload.keys?.auth

  if (!endpoint || !p256dh || !auth) {
    throw new Error('PUSH_SUBSCRIPTION_KEYS_MISSING')
  }

  return { endpoint, p256dh, auth }
}

async function setSubscriptionActive(userId: string, endpoint: string, isActive: boolean) {
  const { error } = await supabase
    .from('push_subscriptions')
    .update({
      is_active: isActive,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', String(userId))
    .eq('endpoint', endpoint)

  if (error) throw error
}

async function saveSubscription(userId: string, subscription: PushSubscription) {
  const { endpoint, p256dh, auth } = readSubscriptionKeys(subscription)
  const { error } = await supabase
    .from('push_subscriptions')
    .upsert({
      user_id: String(userId),
      endpoint,
      p256dh,
      auth,
      user_agent: navigator.userAgent,
      is_active: true,
      updated_at: new Date().toISOString(),
    }, {
      onConflict: 'endpoint',
    })

  if (error) throw error
}

export async function getPushSubscriptionState(): Promise<PushSubscriptionState> {
  const permission = getPushPermissionState()
  if (permission === 'unsupported') return { permission, isSubscribed: false }

  try {
    const registration = await navigator.serviceWorker.getRegistration('/')
    const subscription = registration
      ? await registration.pushManager.getSubscription()
      : null

    return {
      permission,
      isSubscribed: subscription !== null,
    }
  } catch (error: unknown) {
    if (import.meta.env.DEV) console.error('Push subscription state check failed.', error)
    return { permission, isSubscribed: false }
  }
}

export async function enablePushNotifications(userId: string): Promise<PushSubscriptionState> {
  if (!isPushNotificationSupported()) {
    return { permission: 'unsupported', isSubscribed: false }
  }

  const vapidPublicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY?.trim()
  if (!vapidPublicKey) throw new Error('VAPID_PUBLIC_KEY_MISSING')

  const permission = Notification.permission === 'default'
    ? await Notification.requestPermission()
    : Notification.permission

  if (permission !== 'granted') {
    return { permission, isSubscribed: false }
  }

  const registration = await getServiceWorkerRegistration()
  const existingSubscription = await registration.pushManager.getSubscription()
  const subscription = existingSubscription ?? await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
  })

  await saveSubscription(String(userId), subscription)
  return { permission: 'granted', isSubscribed: true }
}

export async function disablePushNotifications(userId: string): Promise<PushSubscriptionState> {
  if (!isPushNotificationSupported()) {
    return { permission: 'unsupported', isSubscribed: false }
  }

  const registration = await navigator.serviceWorker.getRegistration('/')
  const subscription = registration
    ? await registration.pushManager.getSubscription()
    : null

  if (subscription) {
    const endpoint = subscription.endpoint
    const unsubscribed = await subscription.unsubscribe()
    if (!unsubscribed) throw new Error('PUSH_UNSUBSCRIBE_FAILED')
    await setSubscriptionActive(String(userId), endpoint, false)
  }

  return {
    permission: Notification.permission,
    isSubscribed: false,
  }
}

export async function deactivatePushSubscriptionForLogout(userId: string) {
  if (!isPushNotificationSupported()) return

  const registration = await navigator.serviceWorker.getRegistration('/')
  const subscription = registration
    ? await registration.pushManager.getSubscription()
    : null

  if (!subscription) return
  await setSubscriptionActive(String(userId), subscription.endpoint, false)
}
