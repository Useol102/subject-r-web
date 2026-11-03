interface Props {
  /** 가운데 제목 (현재 단계) */
  title: string
  /** 남은 시간(초). 없으면 표시하지 않는다 */
  timeLeft?: number
  onHome?: () => void
}

/** 화면 맨 위 줄. 실제 키오스크처럼 처음으로 · 현재 단계 · 남은 시간을 보여준다 */
export default function Header({ title, timeLeft, onHome }: Props) {
  return (
    <header className="hdr">
      <div className="hdr-side">
        {onHome && (
          <button type="button" className="hdr-home" onClick={onHome}>
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 11l9-7 9 7" /><path d="M5 10v10h14V10" /></svg>
            처음으로
          </button>
        )}
      </div>
      <h1 className="hdr-title">{title}</h1>
      <div className="hdr-side hdr-right">
        {timeLeft !== undefined && (
          <span className={`hdr-timer${timeLeft <= 20 ? ' warn' : ''}`} aria-live={timeLeft <= 10 ? 'polite' : 'off'}>
            남은 시간 <strong>{timeLeft}</strong>초
          </span>
        )}
      </div>
    </header>
  )
}
