export type Place = { id:string; name:string; floor:number; category:string; description:string; directions:string[]; wheelchair_accessible:boolean; is_active:boolean }
export type Program = { id:string; title:string; category:string; place_id:string; description:string; instructor:string; is_active:boolean }
/** 강좌의 한 회차. 시각과 장소는 프로그램이 아니라 회차에 있다 (반복 강좌 때문). */
export type Session = { id:string; program_id:string; place_id:string; starts_at:string; ends_at:string; session_day_kst:string; status:'scheduled'|'canceled'; cancel_reason:string }
export type Robot = {id:string; name:string; current_place_id:string; home_place_id:string}
export type Trip = {id:string; robot_id:string; destination_id:string; status:'requested'|'moving'|'arrived'|'canceled'|'failed'; is_simulated:boolean; created_at:string; updated_at:string}
export type Snapshot = {demo:boolean; places:Place[]; programs:Program[]; sessions:Session[]; robots:Robot[]; integrations:Record<string,string>}
/** 내보내기 양식은 사람이 읽는 문서라 회차를 프로그램 안에 중첩한다. 화면이 훑는 Snapshot 은 반대로 평면이다. */
export type CatalogSession = Omit<Session,'program_id'|'session_day_kst'>
export type Catalog = {version:2; places:Place[]; programs:(Program&{sessions:CatalogSession[]})[]}

/** 서버가 돌려준 상태 코드를 가진 오류. 401·429 는 직원 비밀번호 문제다. */
export type ApiError = Error & { status?:number; retryAfter?:number }

export async function request<T>(path:string, method='GET', data?:unknown):Promise<T> {
  const controller = new AbortController()
  const timeout = window.setTimeout(()=>controller.abort(),10000)
  try {
    const headers:Record<string,string>={'Content-Type':'application/json'}
    // 이용자 API 에 직원 비밀번호를 보내지 않는다.
    if(path.startsWith('/admin/'))headers['X-Admin-Key']=sessionStorage.getItem('staff-key')||''
    const response = await fetch('/api'+path,{method, signal:controller.signal,
      headers,
      body:data === undefined ? undefined : JSON.stringify(data)})
    if (!response.ok) {
      const error = await response.json().catch(()=>null)
      const retryAfter=Number(response.headers.get('Retry-After'))
      const detail=typeof error?.detail === 'string' ? error.detail : '입력값과 연결 상태를 확인해 주세요.'
      const message=response.status===429&&retryAfter>0
        ?`시도가 많습니다. ${retryAfter}초 후 다시 입력해 주세요.`:detail
      throw Object.assign(new Error(message), {status:response.status,retryAfter:retryAfter>0?retryAfter:undefined})
    }
    return await response.json()
  } catch (error) {
    if (error instanceof TypeError || (error instanceof DOMException && error.name==='AbortError')) throw new Error('서버에 연결할 수 없어요. 잠시 후 다시 시도해 주세요.')
    throw error
  } finally { window.clearTimeout(timeout) }
}
export const day = (date:string) => new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Seoul'}).format(new Date(date))
export const time = (date:string) => new Intl.DateTimeFormat('ko-KR',{timeZone:'Asia/Seoul',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(date))
export const floorName = (floor:number) => floor < 0 ? `지하 ${-floor}층` : `${floor}층`
export const states:Record<Trip['status'],string> = {requested:'요청 대기',moving:'이동 중',arrived:'도착 완료',canceled:'취소됨',failed:'이동 실패'}
