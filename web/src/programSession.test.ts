import { describe, expect, it } from 'vitest'
import { pickProgramSession } from './programSession'
import type { Session } from './api'

const row=(id:string,start:string,end:string,status:Session['status']='scheduled'):Session=>({
  id,program_id:'course',place_id:id,starts_at:start,ends_at:end,
  session_day_kst:'2026-09-29',status,cancel_reason:status==='canceled'?'휴강 사유':'',
})
const rows=[
  row('today','2026-09-29T00:00:00.000Z','2026-09-29T02:00:00.000Z'),
  row('next','2026-10-06T00:00:00.000Z','2026-10-06T02:00:00.000Z'),
]

describe('프로그램 회차 선택',()=>{
  it('진행 중인 회차를 다음 주보다 먼저 보여준다',()=>{
    expect(pickProgramSession(rows,'course','2026-09-29T01:00:00.000Z')?.id).toBe('today')
  })
  it('홈에서 누른 회차가 휴강이어도 그 날짜와 장소를 유지한다',()=>{
    const canceled=row('canceled','2026-09-29T03:00:00.000Z','2026-09-29T04:00:00.000Z','canceled')
    expect(pickProgramSession([...rows,canceled],'course','2026-09-29T05:00:00.000Z','canceled')?.place_id).toBe('canceled')
  })
  it('선택이 없으면 다음 회차를 보여준다',()=>{
    expect(pickProgramSession(rows,'course','2026-09-30T00:00:00.000Z')?.id).toBe('next')
  })
})
