import { useState } from 'react'
import { defaultOptions, formatWon, MAX_QTY, unitPrice, type LineOptions, type Size, type Temperature } from '../cart'
import { LARGE_EXTRA, type MenuItem } from '../menu'
import MenuArt from './MenuArt'
import { useDialogA11y } from '../useDialogA11y'

interface Props {
  item: MenuItem
  onCancel: () => void
  onConfirm: (opts: LineOptions, qty: number) => void
}

/** 옵션 선택 창: 온도 · 크기 · 수량 */
export default function OptionSheet({ item, onCancel, onConfirm }: Props) {
  const [opts, setOpts] = useState<LineOptions>(() => defaultOptions(item))
  const [qty, setQty] = useState(1)
  // Esc = 취소, Tab 은 창 안에서만 돈다
  const boxRef = useDialogA11y<HTMLDivElement>(onCancel)

  const setTemp = (temperature: Temperature) => setOpts((o) => ({ ...o, temperature }))
  const setSize = (size: Size) => setOpts((o) => ({ ...o, size }))
  const price = unitPrice(item, opts) * qty

  return (
    <div className="dim" role="presentation">
      <div className="dialog option" ref={boxRef} role="dialog" aria-modal="true" aria-labelledby="opt-title">
        <div className="option-head">
          <span className="option-art"><MenuArt item={item} /></span>
          <div>
            <h2 id="opt-title" className="dialog-title">{item.name}</h2>
            <p className="option-base">{formatWon(item.price)}</p>
          </div>
        </div>

        {item.hasTemperature && (
          <div className="opt-row" role="group" aria-labelledby="opt-temp">
            <span id="opt-temp" className="opt-label">온도</span>
            <div className="seg">
              <button type="button" className={`seg-btn hot${opts.temperature === 'HOT' ? ' on' : ''}`} disabled={!!item.iceOnly} aria-pressed={opts.temperature === 'HOT'} onClick={() => setTemp('HOT')}>
                뜨겁게 <small>HOT</small>
              </button>
              <button type="button" className={`seg-btn ice${opts.temperature === 'ICE' ? ' on' : ''}`} disabled={!!item.hotOnly} aria-pressed={opts.temperature === 'ICE'} onClick={() => setTemp('ICE')}>
                차갑게 <small>ICE</small>
              </button>
            </div>
          </div>
        )}

        {item.hasSize && (
          <div className="opt-row" role="group" aria-labelledby="opt-size">
            <span id="opt-size" className="opt-label">크기</span>
            <div className="seg">
              <button type="button" className={`seg-btn${opts.size === 'R' ? ' on' : ''}`} aria-pressed={opts.size === 'R'} onClick={() => setSize('R')}>
                기본
              </button>
              <button type="button" className={`seg-btn${opts.size === 'L' ? ' on' : ''}`} aria-pressed={opts.size === 'L'} onClick={() => setSize('L')}>
                크게 <small>+{formatWon(LARGE_EXTRA)}</small>
              </button>
            </div>
          </div>
        )}

        <div className="opt-row">
          <span className="opt-label">수량</span>
          <span className="qty qty-lg">
            <button type="button" aria-label="한 개 빼기" disabled={qty <= 1} onClick={() => setQty((q) => Math.max(1, q - 1))}>−</button>
            <span className="qty-num" aria-live="polite">{qty}</span>
            <button type="button" aria-label="한 개 더하기" disabled={qty >= MAX_QTY} onClick={() => setQty((q) => Math.min(MAX_QTY, q + 1))}>+</button>
          </span>
        </div>

        <div className="dialog-actions">
          <button type="button" className="btn btn-gray" onClick={onCancel}>취소</button>
          <button type="button" className="btn btn-main" onClick={() => onConfirm(opts, qty)}>
            <span className="num">{formatWon(price)}</span> 담기
          </button>
        </div>
      </div>
    </div>
  )
}
