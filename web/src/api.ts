export type Place = { id:string; name:string; floor:number; category:string; description:string; directions:string[]; wheelchair_accessible:boolean; is_active:boolean }
export type Program = { id:string; title:string; category:string; place_id:string; starts_at:string; ends_at:string; description:string; instructor:string; is_active:boolean }
export type Robot = {id:string; name:string; current_place_id:string; home_place_id:string}
export type Trip = {id:string; robot_id:string; destination_id:string; status:'requested'|'moving'|'arrived'|'canceled'|'failed'; is_simulated:boolean; created_at:string; updated_at:string}
export type Snapshot = {demo:boolean; places:Place[]; programs:Program[]; robots:Robot[]; integrations:Record<string,string>}
export type Catalog = {version:1; places:Place[]; programs:Program[]}

export async function request<T>(path:string, method='GET', data?:unknown):Promise<T> {
  const controller = new AbortController()
  const timeout = window.setTimeout(()=>controller.abort(),10000)
  try {
    const response = await fetch('/api'+path,{method, signal:controller.signal,
      headers:{'Content-Type':'application/json', 'X-Admin-Key':sessionStorage.getItem('staff-key')||''},
      body:data === undefined ? undefined : JSON.stringify(data)})
    if (!response.ok) {
      const error = await response.json().catch(()=>null)
      throw new Error(typeof error?.detail === 'string' ? error.detail : '입력값과 연결 상태를 확인해 주세요.')
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
