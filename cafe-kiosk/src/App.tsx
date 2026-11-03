import { useCallback, useState } from 'react'
import { addToCart, cartTotals, changeQty, nextOrderNumber, removeLine, type CartLine, type LineOptions } from './cart'
import type { MenuItem } from './menu'
import { useIdle } from './useIdle'
import StartScreen from './screens/StartScreen'
import MenuScreen from './screens/MenuScreen'
import ConfirmScreen from './screens/ConfirmScreen'
import PayScreen, { type PayMethod } from './screens/PayScreen'
import DoneScreen from './screens/DoneScreen'
import IdleDialog from './screens/IdleDialog'

/** 화면 흐름: 시작 → 메뉴 선택 → 주문 확인 → 결제 방식 선택 → 주문 완료 → 시작 */
type Screen = 'start' | 'menu' | 'confirm' | 'pay' | 'done'
export type DineType = 'store' | 'togo'

/** 조작이 없을 때 "계속하시겠어요?" 를 띄우기까지의 시간 */
const IDLE_MS = 60_000
/** 안내창이 뜬 뒤 처음 화면으로 돌아가기까지의 시간 */
const IDLE_GRACE_S = 15

export interface CompletedOrder {
  number: number
  dineType: DineType
  lines: CartLine[]
  total: number
  method: PayMethod
  paidAt: Date
}

export default function App() {
  const [screen, setScreen] = useState<Screen>('start')
  const [dineType, setDineType] = useState<DineType>('store')
  const [lines, setLines] = useState<CartLine[]>([])
  const [lastOrderNo, setLastOrderNo] = useState(0)
  const [order, setOrder] = useState<CompletedOrder | null>(null)
  const [idleWarning, setIdleWarning] = useState(false)

  const reset = useCallback(() => {
    setLines([])
    setOrder(null)
    setIdleWarning(false)
    setScreen('start')
  }, [])

  // 메뉴·확인·결제 화면에서만 유휴 감시. 완료 화면은 자체 카운트다운으로 돌아간다.
  useIdle(screen === 'menu' || screen === 'confirm' || screen === 'pay', IDLE_MS, () => setIdleWarning(true))

  const start = (type: DineType) => {
    setDineType(type)
    setLines([])
    setScreen('menu')
  }

  const add = (item: MenuItem, opts: LineOptions, qty: number) => setLines((ls) => addToCart(ls, item, opts, qty))
  const change = (key: string, delta: number) => setLines((ls) => changeQty(ls, key, delta))
  const remove = (key: string) => setLines((ls) => removeLine(ls, key))
  const clear = () => setLines([])

  /** 결제 화면에서 "결제 완료" 신호. 실제 결제는 없다 — 화면 흐름만 재현한다. */
  const complete = (method: PayMethod) => {
    const no = nextOrderNumber(lastOrderNo)
    setLastOrderNo(no)
    setOrder({ number: no, dineType, lines, total: cartTotals(lines).total, method, paidAt: new Date() })
    setScreen('done')
  }

  return (
    <div className="kiosk" data-screen={screen}>
      {screen === 'start' && <StartScreen onStart={start} />}
      {screen === 'menu' && (
        <MenuScreen
          dineType={dineType}
          lines={lines}
          onAdd={add}
          onChangeQty={change}
          onRemove={remove}
          onClear={clear}
          onHome={reset}
          onCheckout={() => setScreen('confirm')}
        />
      )}
      {screen === 'confirm' && (
        <ConfirmScreen
          dineType={dineType}
          lines={lines}
          onChangeDine={setDineType}
          onChangeQty={change}
          onRemove={remove}
          onBack={() => setScreen('menu')}
          onHome={reset}
          onNext={() => setScreen('pay')}
        />
      )}
      {screen === 'pay' && (
        <PayScreen dineType={dineType} lines={lines} onBack={() => setScreen('confirm')} onHome={reset} onComplete={complete} />
      )}
      {screen === 'done' && order && <DoneScreen order={order} onHome={reset} />}
      {idleWarning && <IdleDialog seconds={IDLE_GRACE_S} onContinue={() => setIdleWarning(false)} onTimeout={reset} />}
    </div>
  )
}
