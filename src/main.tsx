import { createRoot } from 'react-dom/client'
import './index.css'

async function bootstrap() {
  if (import.meta.env.DEV && 'serviceWorker' in navigator) {
    const wasControlledByServiceWorker = Boolean(navigator.serviceWorker.controller)
    const cleanup = navigator.serviceWorker.getRegistrations()
      .then((registrations) => Promise.all(registrations.map((registration) => registration.unregister())))
      .then(() => caches.keys())
      .then((keys) => Promise.all(keys.filter((key) => key.startsWith('repdiary-pwa-')).map((key) => caches.delete(key))))
      .catch((error) => {
        console.warn('Development service worker cleanup failed', error)
      })

    await Promise.race([
      cleanup,
      new Promise<void>((resolve) => window.setTimeout(resolve, 700)),
    ])

    const devResetKey = 'exocare-dev-service-worker-reset'
    if (wasControlledByServiceWorker && sessionStorage.getItem(devResetKey) !== 'done') {
      sessionStorage.setItem(devResetKey, 'done')
      window.location.reload()
      return
    }
    if (!wasControlledByServiceWorker) sessionStorage.removeItem(devResetKey)
  }

  const { default: App } = await import('./App.tsx')

  createRoot(document.getElementById('root')!).render(
    <App />,
  )

  if (import.meta.env.PROD && 'serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').catch((error) => {
        console.warn('Service worker registration failed', error)
      })
    })
  }
}

void bootstrap().catch((error) => {
  console.error('Application bootstrap failed', error)
  const root = document.getElementById('root')
  if (root) root.textContent = '앱을 불러오지 못했습니다. 화면을 새로고침해 주세요.'
})
