import { useEffect, useRef } from 'react'

export function useWakeLock(active: boolean): void {
  const lockRef = useRef<WakeLockSentinel | null>(null)

  useEffect(() => {
    let cancelled = false

    async function requestLock() {
      if (!active || !('wakeLock' in navigator)) return
      try {
        const lock = await navigator.wakeLock.request('screen')
        if (cancelled) {
          await lock.release()
          return
        }
        lockRef.current = lock
      } catch {
        // Wake Lock may be denied on unsupported browsers / power-saving modes.
      }
    }

    async function releaseLock() {
      const lock = lockRef.current
      lockRef.current = null
      if (lock) {
        try {
          await lock.release()
        } catch {
          // already released
        }
      }
    }

    if (active) {
      void requestLock()
    } else {
      void releaseLock()
    }

    const onVisibility = () => {
      if (document.visibilityState === 'visible' && active) {
        void requestLock()
      }
    }

    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', onVisibility)
      void releaseLock()
    }
  }, [active])
}
