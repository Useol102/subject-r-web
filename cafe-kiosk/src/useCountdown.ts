import { useEffect, useRef, useState } from 'react'

/**
 * 실제 키오스크처럼 "남은 시간"을 센다. 화면을 누르거나 키를 치면 처음 값으로 되돌린다.
 * 0 이 되면 onExpire 를 한 번 부른다. enabled 가 false 면 멈추고 처음 값으로 되돌린다.
 */
export function useCountdown(enabled: boolean, seconds: number, onExpire: () => void): number {
  const [left, setLeft] = useState(seconds)
  const cb = useRef(onExpire)
  cb.current = onExpire

  useEffect(() => {
    setLeft(seconds)
    if (!enabled) return
    const reset = () => setLeft(seconds)
    const events = ['pointerdown', 'keydown', 'touchstart', 'wheel'] as const
    events.forEach((e) => window.addEventListener(e, reset, { passive: true }))
    const timer = window.setInterval(() => setLeft((n) => (n > 0 ? n - 1 : 0)), 1000)
    return () => {
      window.clearInterval(timer)
      events.forEach((e) => window.removeEventListener(e, reset))
    }
  }, [enabled, seconds])

  useEffect(() => {
    if (enabled && left === 0) cb.current()
  }, [enabled, left])

  return left
}
