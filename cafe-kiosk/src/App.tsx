import { useCallback, useEffect, useRef, useState } from 'react'
import { addToCart, cartTotals, changeQty, nextOrderNumber, removeLine, type CartLine, type LineOptions } from './cart'
import type { MenuItem } from './menu'
import { useCountdown } from './useCountdown'
import { pageTitle, type Screen } from './flow'
import { AppHeading, FlowBar } from './screens/FlowBar'
import StartScreen from './screens/StartScreen'
import MenuScreen from './screens/MenuScreen'
import ConfirmScreen from './screens/ConfirmScreen'
import PayScreen, { type PayMethod } from './screens/PayScreen'
import DoneScreen from './screens/DoneScreen'
import IdleDialog from './screens/IdleDialog'

/* 화면 흐름: 시작 → 메뉴 선택 → 주문 확인 → 결제 방식 선택 → 주문 완료 → 시작 (Screen 은 flow.ts) */
export type DineType = 'store' | 'togo'

/** 주문 중 화면의 제한 시간. 조작하면 다시 처음부터 센다 */
const ORDER_SECONDS = 120
/** 시간이 다 된 뒤 "시간을 늘릴까요?" 창이 기다리는 시간 */
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
  const [paying, setPaying] = useState(false)
  const kioskRef = useRef<HTMLDivElement>(null)

  // 화면이 바뀌면 탭 제목을 바꾸고, 화면 제목으로 포커스를 옮긴다 (화면 읽기 프로그램이 새 화면을 읽도록)
  useEffect(() => {
    document.title = pageTitle(screen)
    const title = kioskRef.current?.querySelector<HTMLElement>('.hdr-title, .start-title')
    if (title) {
      title.tabIndex = -1
      title.focus({ preventScroll: true })
    }
  }, [screen])

  const reset = useCallback(() => {
    setLines([])
    setOrder(null)
    setIdleWarning(false)
    setPaying(false)
    setScreen('start')
  }, [])

  // 결제 진행 중에는 시간을 세지 않는다 (단말기 응답을 기다리는 중)
  const counting = (screen === 'menu' || screen === 'confirm' || screen === 'pay') && !idleWarning && !paying
  const timeLeft = useCountdown(counting, ORDER_SECONDS, () => setIdleWarning(true))

  const start = (type: DineType) => {
    setDineType(type)
    setLines([])
    setScreen('menu')
  }

  const add = (item: MenuItem, opts: LineOptions, qty: number) => setLines((ls) => addToCart(ls, item, opts, qty))
  const change = (key: string, delta: number) => setLines((ls) => changeQty(ls, key, delta))
  const remove = (key: string) => setLines((ls) => removeLine(ls, key))
  const clear = () => setLines([])

  /** 결제 완료 신호. 실제 결제는 없다 — 화면 흐름만 재현한다. */
  const complete = (method: PayMethod) => {
    const no = nextOrderNumber(lastOrderNo)
    setLastOrderNo(no)
    setOrder({ number: no, dineType, lines, total: cartTotals(lines).total, method, paidAt: new Date() })
    setPaying(false)
    setScreen('done')
  }

  return (
    <div className="kiosk" data-screen={screen} ref={kioskRef}>
      <AppHeading />
      <FlowBar screen={screen} />
      {screen === 'start' && <StartScreen onStart={start} />}
      {screen === 'menu' && (
        <MenuScreen
          dineType={dineType}
          lines={lines}
          timeLeft={timeLeft}
          onAdd={add}
          onChangeQty={change}
          onRemove={remove}
          onClear={clear}
          onHome={reset}
          onNext={() => setScreen('confirm')}
        />
      )}
      {screen === 'confirm' && (
        <ConfirmScreen
          dineType={dineType}
          lines={lines}
          timeLeft={timeLeft}
          onChangeDine={setDineType}
          onChangeQty={change}
          onRemove={remove}
          onBack={() => setScreen('menu')}
          onHome={reset}
          onNext={() => setScreen('pay')}
        />
      )}
      {screen === 'pay' && (
        <PayScreen
          lines={lines}
          timeLeft={timeLeft}
          paying={paying}
          onPayingChange={setPaying}
          onBack={() => setScreen('confirm')}
          onHome={reset}
          onComplete={complete}
        />
      )}
      {screen === 'done' && order && <DoneScreen order={order} onHome={reset} />}
      {idleWarning && <IdleDialog seconds={IDLE_GRACE_S} onContinue={() => setIdleWarning(false)} onTimeout={reset} />}
    </div>
  )
}
