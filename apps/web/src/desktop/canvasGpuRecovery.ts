/** Bounded context recovery. Does not persist the wallpaper or the user's opt-in. */
export function createCanvasGpuRecoveryGate(maxRestores = 2): {
  lost(): boolean
  restored(): boolean
  isLost(): boolean
  attempts(): number
  reset(): void
} {
  const limit = Math.max(0, Math.min(3, Math.floor(maxRestores)))
  let lost = false
  let attempts = 0
  return {
    lost() {
      lost = true
      return attempts < limit
    },
    restored() {
      if (!lost || attempts >= limit) return false
      lost = false
      attempts += 1
      return true
    },
    isLost() { return lost },
    attempts() { return attempts },
    reset() { lost = false; attempts = 0 },
  }
}
