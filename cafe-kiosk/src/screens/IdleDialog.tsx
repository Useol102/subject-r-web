import { useEffect, useState } from 'react'
import { useDialogA11y } from '../useDialogA11y'

interface Props {
  seconds: number
  onContinue: () => void
  onTimeout: () => void
}

/** 남은 시간이 0 이 되면 띄우는 창. 여기서도 고르지 않으면 처음 화면으로 돌아간다 */
export default function IdleDialog({ seconds, onContinue, onTimeout }: Props) {
  const [left, setLeft] = useState(seconds)
  // Esc = 시간 연장 (실수로 처음으로 돌아가지 않게)
  const boxRef = useDialogA11y<HTMLDivElement>(onContinue)
  useEffect(() => {
    if (left <= 0) {
      onTimeout()
      return
    }
    const t = window.setTimeout(() => setLeft((n) => n - 1), 1000)
    return () => window.clearTimeout(t)
  }, [left, onTimeout])

  return (
    <div className="dim" role="presentation">
      <div className="dialog" ref={boxRef} role="alertdialog" aria-modal="true" aria-labelledby="idle-title" aria-describedby="idle-desc">
        <h2 id="idle-title" className="dialog-title">주문 시간이 지났습니다</h2>
        <p id="idle-desc" className="dialog-text">
          계속 주문하시려면 <b>시간 연장</b>을 눌러 주세요.<br />
          <b className="num">{left}</b>초 뒤 처음 화면으로 돌아갑니다.
        </p>
        <div className="dialog-actions">
          <button type="button" className="btn btn-gray" onClick={onTimeout}>처음으로</button>
          <button type="button" className="btn btn-main" onClick={onContinue}>시간 연장</button>
        </div>
      </div>
    </div>
  )
}
