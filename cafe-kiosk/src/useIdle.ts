import { useEffect, useRef } from 'react'

/**
 * 일정 시간 아무 조작이 없으면 onIdle 을 부른다. 키오스크가 앞사람 주문을 들고 있지 않게 하는 용도.
 * 터치·클릭·키 입력이 있으면 타이머를 다시 센다. enabled 가 false 면 아무것도 하지 않는다.
 */
export function useIdle(enabled: boolean, ms: number, onIdle: () => void) {
  const cb = useRef(onIdle)
  cb.current = onIdle
  useEffect(() => {
    if (!enabled) return
    let timer = window.setTimeout(() => cb.current(), ms)
    const reset = () => {
      window.clearTimeout(timer)
      timer = window.setTimeout(() => cb.current(), ms)
    }
    const events = ['pointerdown', 'keydown', 'touchstart', 'wheel'] as const
    events.forEach((e) => window.addEventListener(e, reset, { passive: true }))
    return () => {
      window.clearTimeout(timer)
      events.forEach((e) => window.removeEventListener(e, reset))
    }
  }, [enabled, ms])
}
