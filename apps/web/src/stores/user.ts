import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { authApi, type AuthTokenResponse } from '@/api/auth'
import { usersApi } from '@/api/users'
import {
  AUTH_INVALIDATED_EVENT,
  AUTH_REFRESHED_EVENT,
  getApiErrorMessage,
  isApiNetworkError,
  isApiUnauthorizedError,
} from '@/api/client'
import { useToolsStore } from '@/stores/tools'
import {
  clearStoredAccessToken,
  getStoredAccessToken,
  getStoredAccessTokenExpiresAtMs,
  isStoredAccessTokenExpired,
  persistAccessToken,
} from '@/auth/accessToken'
import {
  clearStoredRefreshToken,
  getStoredRefreshToken,
  hasStoredRefreshSession,
  persistRefreshToken,
} from '@/auth/refreshToken'
import { isLocalProfileCacheEnabled } from '@/privacy/privacyPreferences'

export interface UserProfile {
  id: number
  username: string
  email: string
  displayName: string
  avatar: string
  avatarType: 'upload' | 'preset' | 'emoji'
  created_at: string
}

/** 本地只缓存非敏感的用户资料，不存储密码 */
interface LocalProfileCache {
  email?: string
  displayName?: string
  avatar?: string
  avatarType?: 'upload' | 'preset' | 'emoji'
  created_at?: string
}

function safeParseProfiles(raw: string | null): Record<string, LocalProfileCache> {
  if (!raw) return {}
  try {
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

interface AccessIdentity {
  id: number
  username: string
}

function decodeAccessIdentity(token: string | null): AccessIdentity | null {
  if (!token || typeof window === 'undefined' || typeof window.atob !== 'function') return null
  const payload = token.split('.')[1]
  if (!payload) return null
  try {
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/')
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=')
    const decoded: unknown = JSON.parse(window.atob(padded))
    if (!decoded || typeof decoded !== 'object') return null
    const record = decoded as Record<string, unknown>
    return typeof record.sub === 'number' && typeof record.username === 'string'
      ? { id: record.sub, username: record.username }
      : null
  } catch {
    return null
  }
}

const LOCAL_PROFILE_KEY = 'flexikit-profiles'

export const PRESET_AVATARS = [
  { id: 'emoji-1', label: '😯', type: 'emoji' as const },
  { id: 'emoji-2', label: '😐', type: 'emoji' as const },
  { id: 'emoji-3', label: '😗', type: 'emoji' as const },
  { id: 'emoji-4', label: '😣', type: 'emoji' as const },
  { id: 'emoji-5', label: '😃', type: 'emoji' as const },
  { id: 'emoji-6', label: '😦', type: 'emoji' as const },
  { id: 'emoji-7', label: '😛', type: 'emoji' as const },
  { id: 'emoji-8', label: '😮', type: 'emoji' as const },
  { id: 'emoji-9', label: '😕', type: 'emoji' as const },
  { id: 'emoji-10', label: '😶', type: 'emoji' as const },
  { id: 'emoji-11', label: '😓', type: 'emoji' as const },
  { id: 'emoji-12', label: '😩', type: 'emoji' as const },
  { id: 'emoji-13', label: '🤤', type: 'emoji' as const },
  { id: 'emoji-14', label: '🤓', type: 'emoji' as const },
  { id: 'emoji-15', label: '🤠', type: 'emoji' as const },
  { id: 'emoji-16', label: '🤡', type: 'emoji' as const },
  { id: 'emoji-17', label: '🥳', type: 'emoji' as const },
  { id: 'emoji-18', label: '🤩', type: 'emoji' as const },
  { id: 'emoji-19', label: '🧐', type: 'emoji' as const },
  { id: 'emoji-20', label: '😺', type: 'emoji' as const },
]

export const PRESET_GRADIENT_AVATARS = [
  { id: 'grad-1', colors: ['#0071e3', '#5e5ce6'] },
  { id: 'grad-2', colors: ['#ff375f', '#ff9f0a'] },
  { id: 'grad-3', colors: ['#34c759', '#30b0c7'] },
  { id: 'grad-4', colors: ['#af52de', '#5e5ce6'] },
  { id: 'grad-5', colors: ['#ff6b35', '#ff375f'] },
  { id: 'grad-6', colors: ['#0db7ed', '#0071e3'] },
]

export const useUserStore = defineStore('user', () => {
  const token = ref<string | null>(null)
  const profile = ref<UserProfile | null>(null)
  const isLoggedIn = ref(false)
  /** 本地资料缓存不存密码，但 email / avatar 等仍属于个人数据。 */
  const profileCache = ref<Record<string, LocalProfileCache>>(
    isLocalProfileCacheEnabled()
      ? safeParseProfiles(localStorage.getItem(LOCAL_PROFILE_KEY))
      : {}
  )

  const displayName = computed(() => profile.value?.displayName || profile.value?.username || '用户')
  const avatarDisplay = computed(() => {
    if (!profile.value) return '👤'
    if (profile.value.avatarType === 'emoji') return profile.value.avatar
    if (profile.value.avatarType === 'upload' && profile.value.avatar.startsWith('data:image')) {
      return profile.value.avatar
    }
    return profile.value.avatar || '👤'
  })

  function restoreLocalSession(identity: AccessIdentity | null): void {
    if (!identity) {
      isLoggedIn.value = false
      profile.value = null
      return
    }
    const cached = profileCache.value[identity.username]
    profile.value = {
      id: identity.id,
      username: identity.username,
      email: cached?.email || '',
      displayName: cached?.displayName || identity.username,
      avatar: cached?.avatar || '👤',
      avatarType: cached?.avatarType || 'emoji',
      created_at: cached?.created_at || '',
    }
    isLoggedIn.value = true
  }

  function persistProfileCache() {
    if (!isLocalProfileCacheEnabled()) {
      profileCache.value = {}
      localStorage.removeItem(LOCAL_PROFILE_KEY)
      return
    }
    localStorage.setItem(LOCAL_PROFILE_KEY, JSON.stringify(profileCache.value))
  }

  async function persistAuthTokens(lifecycle: AuthTokenResponse) {
    try {
      await Promise.all([
        persistAccessToken(lifecycle),
        persistRefreshToken(lifecycle),
      ])
    } catch (error) {
      await Promise.allSettled([
        clearStoredAccessToken(),
        clearStoredRefreshToken(),
      ])
      throw error
    }
  }

  let accessTokenExpiryTimer: number | null = null

  function cancelAccessTokenExpiryTimer() {
    if (accessTokenExpiryTimer !== null && typeof window !== 'undefined') {
      window.clearTimeout(accessTokenExpiryTimer)
    }
    accessTokenExpiryTimer = null
  }

  async function scheduleAccessTokenExpiry() {
    cancelAccessTokenExpiryTimer()
    if (!token.value || typeof window === 'undefined') return

    const expiresAt = await getStoredAccessTokenExpiresAtMs()
    if (expiresAt === null) return

    const remainingMs = expiresAt - Date.now()
    if (remainingMs <= 0) {
      token.value = null
      await clearStoredAccessToken()
      return
    }

    const maxDelayMs = 2_147_000_000
    accessTokenExpiryTimer = window.setTimeout(() => {
      void (async () => {
        if (await isStoredAccessTokenExpired()) {
          token.value = null
          await clearStoredAccessToken()
        } else {
          await scheduleAccessTokenExpiry()
        }
      })()
    }, Math.min(remainingMs, maxDelayMs))
  }

  async function handleAccessTokenFocus() {
    token.value = await getStoredAccessToken()
    if (!token.value) return
    if (await isStoredAccessTokenExpired()) {
      token.value = null
      await clearStoredAccessToken()
      return
    }
    await scheduleAccessTokenExpiry()
  }

  async function clearAuthState(clearTools = true) {
    cancelAccessTokenExpiryTimer()
    token.value = null
    await Promise.allSettled([
      clearStoredAccessToken(),
      clearStoredRefreshToken(),
    ])
    isLoggedIn.value = false
    profile.value = null
    if (clearTools) useToolsStore().clearUserData()
  }

  function handleAuthInvalidated() {
    void clearAuthState()
  }

  function handleAuthRefreshed() {
    void (async () => {
      token.value = await getStoredAccessToken()
      await scheduleAccessTokenExpiry()
    })()
  }

  if (typeof window !== 'undefined') {
    window.addEventListener(AUTH_INVALIDATED_EVENT, handleAuthInvalidated)
    window.addEventListener(AUTH_REFRESHED_EVENT, handleAuthRefreshed)
    window.addEventListener('focus', () => {
      void handleAccessTokenFocus()
    })
  }

  async function init() {
    token.value = await getStoredAccessToken()
    const localIdentity = decodeAccessIdentity(token.value)
    const hasRefreshSession = await hasStoredRefreshSession()

    if (!token.value && !hasRefreshSession) {
      isLoggedIn.value = false
      profile.value = null
      return
    }

    if (token.value && await isStoredAccessTokenExpired()) {
      token.value = null
      await clearStoredAccessToken()
    } else if (token.value) {
      await scheduleAccessTokenExpiry()
    }

    try {
      const res = await usersApi.getProfile()
      token.value = await getStoredAccessToken()
      await scheduleAccessTokenExpiry()
      profile.value = res.data
      isLoggedIn.value = true
      if (profile.value) {
        // 本地资料缓存不包含密码，但仍按个人数据管理。
        profileCache.value[profile.value.username] = {
          email: profile.value.email,
          displayName: profile.value.displayName,
          avatar: profile.value.avatar,
          avatarType: profile.value.avatarType,
          created_at: profile.value.created_at,
        }
        persistProfileCache()
      }
    } catch (err: unknown) {
      // 只有明确 401 才说明服务端会话已失效。网络波动 / 5xx 保留
      // Browser HttpOnly Refresh Session 标记与 Desktop DPAPI 凭据。
      if (isApiUnauthorizedError(err)) {
        await clearAuthState()
        return
      }
      restoreLocalSession(localIdentity)
    }
  }

  async function login(username: string, password: string): Promise<{ success: boolean; error?: string }> {
    try {
      const res = await authApi.login(username, password)
      const accessToken = res.data.access_token
      await persistAuthTokens(res.data)
      token.value = accessToken
      await scheduleAccessTokenExpiry()

      const userRes = await usersApi.getProfile()
      profile.value = userRes.data
      isLoggedIn.value = true
      if (profile.value) {
        // 只缓存非敏感信息，不存储密码
        profileCache.value[profile.value.username] = {
          email: profile.value.email,
          displayName: profile.value.displayName,
          avatar: profile.value.avatar,
          avatarType: profile.value.avatarType,
          created_at: profile.value.created_at,
        }
        persistProfileCache()
      }

      // 登录成功后，从后端加载用户的工具数据
      const toolsStore = useToolsStore()
      toolsStore.loadFromBackend().catch(() => {
        // 静默处理工具加载失败，不影响登录
      })

      return { success: true }
    } catch (err: unknown) {
      return {
        success: false,
        error: isApiNetworkError(err)
          ? '网络连接失败，请检查网络后重试'
          : getApiErrorMessage(err, '登录失败，请检查用户名和密码'),
      }
    }
  }

  async function register(
    username: string,
    email: string,
    password: string,
    displayName?: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const res = await authApi.register(username, email, password)
      const accessToken = res.data.access_token
      await persistAuthTokens(res.data)
      token.value = accessToken
      await scheduleAccessTokenExpiry()

      const userRes = await usersApi.getProfile()
      profile.value = userRes.data
      isLoggedIn.value = true
      if (profile.value) {
        // 只缓存非敏感信息，不存储密码
        profileCache.value[profile.value.username] = {
          email: profile.value.email,
          displayName: profile.value.displayName,
          avatar: profile.value.avatar,
          avatarType: profile.value.avatarType,
          created_at: profile.value.created_at,
        }
        persistProfileCache()
      }

      if (displayName && profile.value) {
        await usersApi.updateProfile({ displayName })
        profile.value = { ...profile.value, displayName }
        profileCache.value[profile.value.username] = {
          ...profileCache.value[profile.value.username],
          displayName,
        }
        persistProfileCache()
      }

      // 注册成功后，从后端加载用户的工具数据
      const toolsStore = useToolsStore()
      toolsStore.loadFromBackend().catch(() => {
        // 静默处理工具加载失败，不影响注册
      })

      return { success: true }
    } catch (err: unknown) {
      return {
        success: false,
        error: isApiNetworkError(err)
          ? '网络连接失败，请检查网络后重试'
          : getApiErrorMessage(err, '注册失败'),
      }
    }
  }

  async function logout(options: { server?: boolean } = {}) {
    const revokeServerSession = options.server ?? true

    try {
      if (revokeServerSession) {
        const refreshToken = await getStoredRefreshToken()
        await authApi.logout(refreshToken ?? undefined)
      }
    } catch {
      // 即使离线或服务端会话已失效，也必须允许用户清除本地登录态。
    } finally {
      await clearAuthState()
    }
  }

  async function updateProfile(updates: Partial<UserProfile>): Promise<{ success: boolean; error?: string }> {
    if (!isLoggedIn.value || !profile.value) {
      return { success: false, error: '请先登录' }
    }

    try {
      const res = await usersApi.updateProfile(updates)
      profile.value = res.data
      if (profile.value) {
        profileCache.value[profile.value.username] = {
          email: profile.value.email,
          displayName: profile.value.displayName,
          avatar: profile.value.avatar,
          avatarType: profile.value.avatarType,
          created_at: profile.value.created_at,
        }
        persistProfileCache()
      }
      return { success: true }
    } catch (err: unknown) {
      return {
        success: false,
        error: isApiNetworkError(err)
          ? '网络连接失败，修改未保存'
          : getApiErrorMessage(err, '更新资料失败'),
      }
    }
  }

  async function setAvatar(data: string, type: 'upload' | 'preset' | 'emoji') {
    return updateProfile({ avatar: data, avatarType: type })
  }

  init()

  return {
    token,
    profile,
    isLoggedIn,
    displayName,
    avatarDisplay,
    login,
    register,
    logout,
    updateProfile,
    setAvatar,
    init,
  }
})
