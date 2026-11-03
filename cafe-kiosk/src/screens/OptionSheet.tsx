import { useState } from 'react'
import { defaultOptions, formatWon, MAX_QTY, optionLabel, unitPrice, type LineOptions, type Size, type Temperature } from '../cart'
import { LARGE_EXTRA, type MenuItem } from '../menu'

interface Props {
  item: MenuItem
  onCancel: () => void
  onConfirm: (opts: LineOptions, qty: number) => void
}

/** 온도·사이즈·수량을 고르는 창 */
export default function OptionSheet({ item, onCancel, onConfirm }: Props) {
  const [opts, setOpts] = useState<LineOptions>(() => defaultOptions(item))
  const [qty, setQty] = useState(1)

  const setTemp = (temperature: Temperature) => setOpts((o) => ({ ...o, temperature }))
  const setSize = (size: Size) => setOpts((o) => ({ ...o, size }))
  const tempLocked = item.iceOnly || item.hotOnly
  const price = unitPrice(item, opts) * qty

  return (
    <div className="modal-backdrop" onClick={onCancel} role="presentation">
      <div className="modal sheet" role="dialog" aria-modal="true" aria-labelledby="opt-title" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head">
          <span className="sheet-emoji" aria-hidden="true">{item.emoji}</span>
          <div>
            <h2 id="opt-title">{item.name}</h2>
            <p className="muted">{item.desc}</p>
          </div>
        </div>

        {item.hasTemperature && (
          <fieldset className="opt-group">
            <legend>온도</legend>
            <div className="pills">
              <button type="button" className={`pill${opts.temperature === 'HOT' ? ' on hot' : ''}`} disabled={!!item.iceOnly} aria-pressed={opts.temperature === 'HOT'} onClick={() => setTemp('HOT')}>
                🔥 HOT
              </button>
              <button type="button" className={`pill${opts.temperature === 'ICE' ? ' on ice' : ''}`} disabled={!!item.hotOnly} aria-pressed={opts.temperature === 'ICE'} onClick={() => setTemp('ICE')}>
                🧊 ICE
              </button>
            </div>
            {tempLocked && <p className="muted small">이 메뉴는 {item.iceOnly ? 'ICE' : 'HOT'}로만 준비됩니다.</p>}
          </fieldset>
        )}

        {item.hasSize && (
          <fieldset className="opt-group">
            <legend>사이즈</legend>
            <div className="pills">
              <button type="button" className={`pill${opts.size === 'R' ? ' on' : ''}`} aria-pressed={opts.size === 'R'} onClick={() => setSize('R')}>
                기본
              </button>
              <button type="button" className={`pill${opts.size === 'L' ? ' on' : ''}`} aria-pressed={opts.size === 'L'} onClick={() => setSize('L')}>
                라지 <span className="pill-sub">+{formatWon(LARGE_EXTRA)}</span>
              </button>
            </div>
          </fieldset>
        )}

        <fieldset className="opt-group">
          <legend>수량</legend>
          <div className="stepper large">
            <button type="button" aria-label="수량 줄이기" disabled={qty <= 1} onClick={() => setQty((q) => Math.max(1, q - 1))}>−</button>
            <span className="stepper-num" aria-live="polite">{qty}</span>
            <button type="button" aria-label="수량 늘리기" disabled={qty >= MAX_QTY} onClick={() => setQty((q) => Math.min(MAX_QTY, q + 1))}>+</button>
          </div>
        </fieldset>

        <div className="sheet-foot">
          <div className="sheet-summary">
            <span className="muted">{optionLabel(opts) || '옵션 없음'} · {qty}개</span>
            <strong className="sheet-price">{formatWon(price)}</strong>
          </div>
          <div className="modal-actions">
            <button type="button" className="btn ghost" onClick={onCancel}>취소</button>
            <button type="button" className="btn primary" onClick={() => onConfirm(opts, qty)}>담기</button>
          </div>
        </div>
      </div>
    </div>
  )
}
