import { useEffect, useRef } from 'react'

/**
 * 팝업(옵션 · 결제 안내 · 시간 초과) 키보드 처리.
 * - 열리면 제목으로 포커스를 옮기고, 닫히면 팝업을 연 버튼으로 돌려준다.
 * - Tab 이 팝업 밖으로 나가지 않게 가둔다.
 * - onEscape 가 있으면 Esc 로 취소한다.
 */
export function useDialogA11y<T extends HTMLElement>(onEscape?: () => void) {
  const ref = useRef<T>(null)
  const escRef = useRef(onEscape)
  escRef.current = onEscape

  useEffect(() => {
    const box = ref.current
    if (!box) return
    const opener = document.activeElement as HTMLElement | null
    const title = box.querySelector<HTMLElement>('.dialog-title')
    if (title) {
      title.tabIndex = -1
      title.focus({ preventScroll: true })
    }

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && escRef.current) {
        e.preventDefault()
        escRef.current()
        return
      }
      if (e.key !== 'Tab') return
      const buttons = [...box.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')].filter((b) => b.offsetParent !== null)
      if (buttons.length === 0) return
      const first = buttons[0]
      const last = buttons[buttons.length - 1]
      const active = document.activeElement as HTMLElement | null
      const inside = active ? buttons.includes(active as HTMLButtonElement) : false
      if (e.shiftKey && (active === first || !inside)) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && (active === last || !inside)) {
        e.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      if (opener && opener.isConnected) opener.focus({ preventScroll: true })
    }
  }, [])

  return ref
}
