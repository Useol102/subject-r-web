import { useEffect, useState } from 'react'

interface Props {
  seconds: number
  onContinue: () => void
  onTimeout: () => void
}

/** 한동안 조작이 없을 때 띄우는 확인창. 남은 초가 0 이 되면 처음으로 돌아간다 */
export default function IdleDialog({ seconds, onContinue, onTimeout }: Props) {
  const [left, setLeft] = useState(seconds)
  useEffect(() => {
    if (left <= 0) {
      onTimeout()
      return
    }
    const t = window.setTimeout(() => setLeft((n) => n - 1), 1000)
    return () => window.clearTimeout(t)
  }, [left, onTimeout])

  return (
    <div className="modal-backdrop" role="presentation">
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="idle-title">
        <h2 id="idle-title">계속 주문하시겠어요?</h2>
        <p className="muted">
          <strong className="big-num">{left}</strong>초 뒤에 처음 화면으로 돌아갑니다.
        </p>
        <div className="modal-actions">
          <button type="button" className="btn ghost" onClick={onTimeout}>처음으로</button>
          <button type="button" className="btn primary" onClick={onContinue} autoFocus>계속 주문하기</button>
        </div>
      </div>
    </div>
  )
}
