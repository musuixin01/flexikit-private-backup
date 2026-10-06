import { computed, readonly, ref } from 'vue'

export type ConnectivityMode = 'online' | 'offline' | 'service-unavailable'

const browserOnlineState = ref(
  typeof navigator === 'undefined' ? true : navigator.onLine,
)
const apiReachableState = ref<boolean | null>(null)
let trackingInitialized = false

export const browserOnline = readonly(browserOnlineState)
export const apiReachable = readonly(apiReachableState)

export const connectivityMode = computed<ConnectivityMode>(() => {
  if (!browserOnlineState.value) return 'offline'
  if (apiReachableState.value === false) return 'service-unavailable'
  return 'online'
})

export const hasConnectivityIssue = computed(
  () => connectivityMode.value !== 'online',
)

export function markApiReachable(): void {
  if (!browserOnlineState.value) return
  apiReachableState.value = true
}

export function markApiUnavailable(): void {
  apiReachableState.value = false
}

export function initConnectivityTracking(): void {
  if (trackingInitialized || typeof window === 'undefined') return
  trackingInitialized = true

  const syncOffline = () => {
    browserOnlineState.value = false
    apiReachableState.value = false
  }

  const syncOnline = () => {
    browserOnlineState.value = true
    // A browser "online" event only means a network interface exists.
    // Keep the API state unknown until the next real request/probe succeeds.
    apiReachableState.value = null
  }

  browserOnlineState.value = navigator.onLine
  if (!browserOnlineState.value) apiReachableState.value = false

  window.addEventListener('offline', syncOffline)
  window.addEventListener('online', syncOnline)
}
