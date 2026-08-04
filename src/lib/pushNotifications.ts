import { supabase } from './supabase'

export type PushPermissionState = NotificationPermission | 'unsupported'
export type PushDeviceStatus =
  | 'enabled'
  | 'disabled'
  | 'registration-required'
  | 'blocked'
  | 'unsupported'

export type PushSubscriptionState = {
  permission: PushPermissionState
  isSubscribed: boolean
  isDatabaseActive: boolean
  status: PushDeviceStatus
}

const SERVICE_WORKER_PATH = '/sw.js'
const LAST_ENDPOINT_KEY = 'exocare.push.last-endpoint'
const USER_DISABLED_KEY = 'exocare.push.user-disabled'

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

function unsupportedState(): PushSubscriptionState {
  return {
    permission: 'unsupported',
    isSubscribed: false,
    isDatabaseActive: false,
    status: 'unsupported',
  }
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

function configuredVapidPublicKey() {
  return import.meta.env.VITE_VAPID_PUBLIC_KEY?.trim() || null
}

function subscriptionUsesVapidKey(subscription: PushSubscription, vapidPublicKey: string) {
  const applicationServerKey = subscription.options.applicationServerKey
  if (!applicationServerKey) return false

  const actual = new Uint8Array(applicationServerKey)
  const expected = urlBase64ToUint8Array(vapidPublicKey)
  if (actual.length !== expected.length) return false
  return actual.every((value, index) => value === expected[index])
}

async function getServiceWorkerRegistration() {
  const existingRegistration = await navigator.serviceWorker.getRegistration('/')
  if (existingRegistration) {
    await navigator.serviceWorker.ready
    return existingRegistration
  }

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

function rememberEndpoint(endpoint: string) {
  localStorage.setItem(LAST_ENDPOINT_KEY, endpoint)
}

function readRememberedEndpoint() {
  return localStorage.getItem(LAST_ENDPOINT_KEY)?.trim() || null
}

async function activateSubscription(subscription: PushSubscription) {
  const { endpoint, p256dh, auth } = readSubscriptionKeys(subscription)
  const { error } = await supabase.rpc('sync_current_push_subscription', {
    p_endpoint: endpoint,
    p_p256dh: p256dh,
    p_auth: auth,
    p_user_agent: navigator.userAgent,
  })
  if (error) throw error

  rememberEndpoint(endpoint)
  localStorage.removeItem(USER_DISABLED_KEY)
}

async function deactivateEndpoint(endpoint: string | null) {
  if (!endpoint) return
  const { error } = await supabase.rpc('deactivate_current_push_subscription', {
    p_endpoint: endpoint,
  })
  if (error) throw error
}

/**
 * Reconciles the browser's real subscription with the current user's DB row.
 * It never opens a permission prompt; permission is requested only by the
 * explicit enable action below.
 */
export async function syncCurrentDevicePushSubscription(): Promise<PushSubscriptionState> {
  if (!isPushNotificationSupported()) return unsupportedState()

  const permission = Notification.permission
  const registration = await getServiceWorkerRegistration()
  const subscription = await registration.pushManager.getSubscription()
  const rememberedEndpoint = readRememberedEndpoint()
  const vapidPublicKey = configuredVapidPublicKey()

  if (permission === 'denied') {
    await deactivateEndpoint(subscription?.endpoint ?? rememberedEndpoint)
    return {
      permission,
      isSubscribed: subscription !== null,
      isDatabaseActive: false,
      status: 'blocked',
    }
  }

  if (!subscription) {
    await deactivateEndpoint(rememberedEndpoint)
    const wasDisabledByUser = localStorage.getItem(USER_DISABLED_KEY) === 'true'
    return {
      permission,
      isSubscribed: false,
      isDatabaseActive: false,
      status: permission === 'granted' && !wasDisabledByUser
        ? 'registration-required'
        : 'disabled',
    }
  }

  if (vapidPublicKey && !subscriptionUsesVapidKey(subscription, vapidPublicKey)) {
    await deactivateEndpoint(subscription.endpoint)
    await subscription.unsubscribe()
    return {
      permission,
      isSubscribed: false,
      isDatabaseActive: false,
      status: 'registration-required',
    }
  }

  await activateSubscription(subscription)
  return {
    permission,
    isSubscribed: true,
    isDatabaseActive: true,
    status: 'enabled',
  }
}

export async function getPushSubscriptionState(): Promise<PushSubscriptionState> {
  try {
    return await syncCurrentDevicePushSubscription()
  } catch (error: unknown) {
    if (import.meta.env.DEV) console.error('Push subscription synchronization failed.', error)
    const permission = getPushPermissionState()
    if (permission === 'unsupported') return unsupportedState()
    return {
      permission,
      isSubscribed: false,
      isDatabaseActive: false,
      status: permission === 'denied' ? 'blocked' : 'registration-required',
    }
  }
}

export async function enablePushNotifications(userId: string): Promise<PushSubscriptionState> {
  void userId
  if (!isPushNotificationSupported()) return unsupportedState()

  const vapidPublicKey = configuredVapidPublicKey()
  if (!vapidPublicKey) throw new Error('VAPID_PUBLIC_KEY_MISSING')

  const permission = Notification.permission === 'default'
    ? await Notification.requestPermission()
    : Notification.permission

  if (permission !== 'granted') {
    return syncCurrentDevicePushSubscription()
  }

  const registration = await getServiceWorkerRegistration()
  const existingSubscription = await registration.pushManager.getSubscription()
  const reusableSubscription = existingSubscription && subscriptionUsesVapidKey(existingSubscription, vapidPublicKey)
    ? existingSubscription
    : null
  if (existingSubscription && !reusableSubscription) {
    await deactivateEndpoint(existingSubscription.endpoint)
    await existingSubscription.unsubscribe()
  }
  const subscription = reusableSubscription ?? await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
  })

  await activateSubscription(subscription)
  return {
    permission: 'granted',
    isSubscribed: true,
    isDatabaseActive: true,
    status: 'enabled',
  }
}

export async function disablePushNotifications(userId: string): Promise<PushSubscriptionState> {
  void userId
  if (!isPushNotificationSupported()) return unsupportedState()

  const registration = await getServiceWorkerRegistration()
  const subscription = await registration.pushManager.getSubscription()
  const endpoint = subscription?.endpoint ?? readRememberedEndpoint()

  if (subscription) {
    const unsubscribed = await subscription.unsubscribe()
    if (!unsubscribed) throw new Error('PUSH_UNSUBSCRIBE_FAILED')
  }

  await deactivateEndpoint(endpoint)
  localStorage.setItem(USER_DISABLED_KEY, 'true')
  return {
    permission: Notification.permission,
    isSubscribed: false,
    isDatabaseActive: false,
    status: 'disabled',
  }
}

// Logout keeps the browser subscription reusable, but disables delivery for
// the signed-out account. A later login reassigns and reactivates the endpoint.
export async function deactivatePushSubscriptionForLogout(userId: string) {
  void userId
  if (!isPushNotificationSupported()) return

  const registration = await navigator.serviceWorker.getRegistration('/')
  const subscription = registration
    ? await registration.pushManager.getSubscription()
    : null
  await deactivateEndpoint(subscription?.endpoint ?? readRememberedEndpoint())
}
