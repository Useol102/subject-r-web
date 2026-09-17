import { useCallback, useEffect, useState } from 'react'
import { Activity, ArrowRight, ArrowUpRight, BookOpen, Check, ChevronRight, CircleHelp, Database, Download, FileJson, LayoutDashboard, MapPin, Plus, Radio, RefreshCw, Route, Save, Settings2, Upload, X } from 'lucide-react'
import { day, floorName, request, states, time, type Catalog, type Place, type Program, type Snapshot, type Trip } from './api'
import { searchByName } from './hangulSearch'

type Section='overview'|'programs'|'places'|'connections'
type Props={data:Snapshot|null;reload:()=>Promise<void>;connectionError:string}
export default function Admin({data,reload,connectionError}:Props){
  const [section,setSection]=useState<Section>('overview')
  const [trips,setTrips]=useState<Trip[]>([])
  const [catalog,setCatalog]=useState<Catalog>({version:1,places:[],programs:[]})
  const [notice,setNotice]=useState('')
  const [adminError,setAdminError]=useState('')
  const [busy,setBusy]=useState(false)
  const [destination,setDestination]=useState('')
  const [editor,setEditor]=useState<Place|Program|'new-place'|'new-program'|null>(null)
  const [search,setSearch]=useState('')
  const loadAdmin=useCallback(async()=>{
    try{const [t,c]=await Promise.all([request<Trip[]>('/admin/trips'),request<Catalog>('/admin/catalog')]);setTrips(t);setCatalog(c);setAdminError('')}
    catch(e){setAdminError((e as Error).message)}
  },[])
  useEffect(()=>{void loadAdmin();const timer=setInterval(()=>void loadAdmin(),5000);return()=>clearInterval(timer)},[loadAdmin])
  const run=async(action:()=>Promise<unknown>,message:string)=>{
    if(busy)return
    setBusy(true);setNotice('')
    try{await action();await Promise.all([reload(),loadAdmin()]);setNotice(message);return true}
    catch(e){setNotice((e as Error).message);return false}
    finally{setBusy(false)}
  }
  const change=(next:Section)=>{setSection(next);setEditor(null);setSearch('');setNotice('')}
  const places=data?.places||[]
  const robot=data?.robots[0]
  const current=places.find(p=>p.id===robot?.current_place_id)
  const activeTrip=trips.find(t=>['requested','moving'].includes(t.status))
  const today=day(new Date().toISOString())
  const todayPrograms=(data?.programs||[]).filter(p=>day(p.starts_at)===today)
  const sections:[Section,string,typeof Activity][]=[['overview','운영 대시보드',LayoutDashboard],['programs','프로그램 관리',BookOpen],['places','장소 관리',MapPin],['connections','데이터 · 연결',Settings2]]
  async function dispatch(target:string){
    if(!robot)return
    const ok=await run(()=>request('/admin/trips','POST',{robot_id:robot.id,destination_id:target}),'데모 이동 요청을 저장했습니다. 실제 로봇에는 전송되지 않습니다.')
    if(ok)setDestination('')
  }
  async function save(form:HTMLFormElement){
    const f=new FormData(form)
    const value=Object.fromEntries(f.entries())
    const isPlace=editor==='new-place'||(typeof editor==='object'&&editor!==null&&'floor' in editor)
    const original=typeof editor==='object'?editor:null
    let payload:Record<string,unknown>={...value,id:original?.id||value.id,is_active:f.get('is_active')==='on'}
    if(isPlace){payload={...payload,floor:Number(value.floor),wheelchair_accessible:f.get('wheelchair_accessible')==='on',directions:String(value.directions).split('\n').map(x=>x.trim()).filter(Boolean)}}
    else{payload={...payload,starts_at:new Date(String(value.starts_at)+'+09:00').toISOString(),ends_at:new Date(String(value.ends_at)+'+09:00').toISOString()}}
    const ok=await run(()=>request('/admin/'+(isPlace?'places':'programs'),'PUT',payload),'저장했습니다. 이용자 화면에도 반영됩니다.')
    if(ok)setEditor(null)
  }
  async function importFile(file:File){
    await run(async()=>{
      if(file.size>2_000_000)throw new Error('JSON 파일은 2MB 이하로 선택해 주세요.')
      let value:unknown
      try{value=JSON.parse(await file.text())}catch{throw new Error('JSON 형식이 올바르지 않습니다.')}
      return request('/admin/catalog/import','POST',value)
    },'데이터를 가져왔습니다. 같은 ID는 수정하고, 새로운 ID는 추가했습니다.')
  }
  async function exportFile(){
    await run(async()=>{const data=await request<Catalog>('/admin/catalog');const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='subject-r-catalog.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)},'프로그램·장소 JSON을 내보냈습니다.')
  }
  return <div className="admin-shell"><a className="skip-link" href="#admin-main">본문 바로가기</a><aside className="sidebar"><a className="brand" href="/admin"><span className="brand-symbol">R<span>·</span></span><span>Subject R<small>직원 워크스페이스</small></span></a><div className="sidebar-label">공간을 잇는 다정한 기술</div><nav>{sections.map(([key,label,Icon])=><button key={key} className={section===key?'nav-item selected':'nav-item'} aria-current={section===key?'page':undefined} onClick={()=>change(key)}><Icon size={20}/>{label}{section===key&&<span className="nav-dot"/>}</button>)}</nav><div className="sidebar-bottom"><div className="local-note"><span className="status-dot"/><div>로컬 웹 서비스<small>인터넷 없이, 같은 공간에서</small></div></div><a className="kiosk-open" href="/" target="_blank" rel="noreferrer">이용자 화면 열기 <ArrowUpRight size={18}/></a><p>SUBJECT R · WEB WORKSPACE</p></div></aside>
    <div className="admin-body"><header className="admin-header"><div><span className="breadcrumb">워크스페이스</span><ChevronRight size={14}/><strong>{sections.find(x=>x[0]===section)?.[1]}</strong></div><span className="demo-pill">{data?.demo?'DEMO · 예시 환경':'기관 데이터 환경'}</span></header><main id="admin-main" className="admin-main">
      <div className="admin-page-heading"><div><div className="eyebrow">{new Date().toLocaleDateString('ko-KR',{year:'numeric',month:'long',day:'numeric',weekday:'long',timeZone:'Asia/Seoul'})}</div><h1>{sections.find(x=>x[0]===section)?.[1]}</h1><p>{section==='overview'?'오늘의 안내와 로봇 이동 요청을 한곳에서 관리하세요.':section==='programs'?'프로그램 정보를 등록하면 이용자 화면에 바로 반영됩니다.':section==='places'?'층과 장소, 안내 문구를 실제 기관 정보로 채워 주세요.':'팀에서 받은 데이터를 연결하고 연동 준비 상태를 확인하세요.'}</p></div><button className="secondary" disabled={busy} onClick={()=>void run(()=>Promise.all([reload(),loadAdmin()]),'최신 데이터를 확인했습니다.')}><RefreshCw size={17}/>새로고침</button></div>
      {(connectionError||adminError)&&<div className="connection-error" role="alert">{connectionError||adminError}{adminError&&<button onClick={()=>change('connections')}>직원 연결 키 설정</button>}</div>}
      {notice&&<div className="notice" role="status"><CircleHelp size={18}/><span>{notice}</span><button aria-label="메시지 닫기" onClick={()=>setNotice('')}><X size={17}/></button></div>}
      {!places.length&&data?.demo&&<div className="setup-banner"><div className="setup-icon"><SparkleMark/></div><div><h2>데이터가 없어도, 먼저 둘러보세요.</h2><p>가상의 프로그램 4개와 장소 6개로 화면과 이동 흐름을 확인할 수 있어요.</p></div><button className="primary" disabled={busy||!!connectionError} onClick={()=>void run(()=>request('/admin/demo/seed','POST'),'예시 데이터를 불러왔습니다. 실제 기관 정보가 아닙니다.')}>예시 데이터 불러오기 <ArrowRight size={17}/></button></div>}
      {section==='overview'&&<>
        <div className="metric-grid"><Metric label="오늘의 프로그램" value={String(todayPrograms.length)} unit="개" description="등록된 일정 기준" icon={<BookOpen/>}/><Metric label="안내 가능한 장소" value={String(places.length)} unit="곳" description="활성화된 장소" icon={<MapPin/>}/><Metric label="진행 중인 요청" value={String(trips.filter(t=>['requested','moving'].includes(t.status)).length)} unit="건" description="데모 이동 요청" icon={<Route/>}/><Metric label="로봇 연결" value="미연결" description="연동 데이터 수신 대기" icon={<Radio/>}/></div>
        <div className="dashboard-grid"><section className="panel robot-panel"><div className="panel-heading"><h2><Radio size={19}/>로봇 이동 요청</h2><span className="tag">데모 전용</span></div><div className="robot-status"><div className="robot-avatar">R<span>··</span></div><div><h3>Subject R</h3><span className="muted">{activeTrip?states[activeTrip.status]:'대기 중'} · 실제 장치 미연결</span></div><span className="device-label">이동형 키오스크</span></div><div className="position-row"><MapPin size={19}/><span>현재 데모 위치</span><strong>{current?`${floorName(current.floor)} ${current.name}`:'등록 대기'}</strong></div><div className="dispatch-form"><label>이동할 장소<select aria-label="이동할 장소" value={destination} onChange={e=>setDestination(e.target.value)} disabled={!!activeTrip}><option value="">층과 장소를 선택하세요</option>{places.filter(p=>p.id!==current?.id).map(p=><option key={p.id} value={p.id}>{floorName(p.floor)} · {p.name}</option>)}</select></label><button className="primary" disabled={!destination||!!activeTrip||busy||!!connectionError||!!adminError||!data?.demo} onClick={()=>void dispatch(destination)}>데모 이동 요청 <ArrowRight size={18}/></button><button className="secondary" disabled={!robot||current?.id===robot.home_place_id||!!activeTrip||busy||!!connectionError||!!adminError||!data?.demo} onClick={()=>robot&&void dispatch(robot.home_place_id)}>로비로 데모 복귀</button></div>{activeTrip&&<div className="simulation"><strong>{places.find(p=>p.id===activeTrip.destination_id)?.name} · {states[activeTrip.status]}</strong><p>아래 버튼은 상태 수신을 재현합니다. 로봇을 제어하지 않습니다.</p><div>{(activeTrip.status==='requested'?['moving','canceled','failed']:['arrived','canceled','failed']).map(status=><button className="secondary small" key={status} disabled={busy||!!connectionError||!!adminError} onClick={()=>void run(()=>request(`/admin/trips/${activeTrip.id}/demo-state`,'PATCH',{status}),'데모 상태를 반영했습니다.')}>{status==='moving'?'이동 시작 재현':status==='arrived'?'도착 재현':status==='failed'?'실패 재현':'요청 취소'}</button>)}</div></div>}<p className="micro">실제 이동 요청은 로봇팀 API 계약 확정 후 연결합니다.</p></section>
        <section className="panel schedule-panel"><div className="panel-heading"><h2>오늘의 프로그램</h2><button className="text-button" onClick={()=>change('programs')}>전체 관리 <ArrowRight size={16}/></button></div>{todayPrograms.length?<div className="schedule-list">{todayPrograms.map(p=><div className="schedule-item" key={p.id}><span className="schedule-time">{time(p.starts_at)}<small>{time(p.ends_at)}</small></span><div><span className={`tag tag-${p.category}`}>{p.category}</span><h3>{p.title}</h3><p><MapPin size={14}/>{places.find(x=>x.id===p.place_id)?.name}</p></div></div>)}</div>:<div className="empty"><BookOpen/><p>오늘 등록된 일정이 없습니다.</p><button className="text-button" onClick={()=>change('programs')}>프로그램 등록하기 <Plus size={16}/></button></div>}</section></div>
        <section className="panel"><div className="panel-heading"><h2>최근 이동 요청</h2><span className="muted">최근 50건 · 모든 요청은 데모</span></div>{trips.length?<div className="table-wrap"><table><thead><tr><th>요청 시각</th><th>목적지</th><th>상태</th><th>환경</th></tr></thead><tbody>{trips.map(t=><tr key={t.id}><td>{day(t.created_at)} · {time(t.created_at)}</td><td>{catalog.places.find(p=>p.id===t.destination_id)?.name||t.destination_id}</td><td><span className={`state state-${t.status}`}>{states[t.status]}</span></td><td><span className="muted">시뮬레이션</span></td></tr>)}</tbody></table></div>:<div className="empty compact"><Route/>아직 이동 요청이 없습니다.</div>}</section>
      </>}
      {(section==='programs'||section==='places')&&<>
        {editor?<section className="panel editor"><div className="panel-heading"><h2>{typeof editor==='string'?'새 정보 등록':'정보 수정'}</h2><button className="text-button" onClick={()=>setEditor(null)}><X size={18}/>닫기</button></div><Editor key={typeof editor==='string'?editor:editor.id} value={editor} places={catalog.places} busy={busy} onSave={save}/></section>:<section className="panel"><div className="panel-heading"><input className="admin-search" aria-label="목록 검색" placeholder={section==='programs'?'프로그램 이름 검색':'장소 이름 검색'} value={search} onChange={e=>setSearch(e.target.value)}/><button className="primary" disabled={busy||!!adminError||!!connectionError} onClick={()=>setEditor(section==='programs'?'new-program':'new-place')}><Plus size={18}/>{section==='programs'?'프로그램 등록':'장소 등록'}</button></div><div className="table-wrap"><table><thead><tr>{(section==='programs'?['프로그램','일정 (한국 시간)','장소','공개 상태','관리']:['장소','층','구분','공개 상태','관리']).map(c=><th key={c}>{c}</th>)}</tr></thead><tbody>{section==='programs'?searchByName(catalog.programs,search,p=>({name:p.title,category:p.category})).map(p=><tr key={p.id}><td><strong>{p.title}</strong><small className="cell-sub">{p.category}</small></td><td>{day(p.starts_at)}<small className="cell-sub">{time(p.starts_at)} – {time(p.ends_at)}</small></td><td>{catalog.places.find(x=>x.id===p.place_id)?.name}</td><td><span className={p.is_active?'state state-arrived':'state'}>{p.is_active?'공개':'숨김'}</span></td><td><button className="secondary small" onClick={()=>setEditor(p)}>수정</button></td></tr>):searchByName(catalog.places,search,p=>p).map(p=><tr key={p.id}><td><strong>{p.name}</strong><small className="cell-sub">{p.id}</small></td><td>{floorName(p.floor)}</td><td>{p.category}</td><td><span className={p.is_active?'state state-arrived':'state'}>{p.is_active?'공개':'숨김'}</span></td><td><button className="secondary small" onClick={()=>setEditor(p)}>수정</button></td></tr>)}</tbody></table></div>{!(section==='programs'?catalog.programs.filter(p=>p.title.includes(search)):catalog.places.filter(p=>p.name.includes(search))).length&&<div className="empty compact">표시할 항목이 없습니다. 새 정보를 등록해 주세요.</div>}</section>}
      </>}
      {section==='connections'&&<><section className="panel"><div className="panel-heading"><h2><Activity size={19}/>연결 준비 현황</h2><span className="tag">웹 담당 범위</span></div><div className="integration-grid">{[['로봇 · 시뮬레이션','미연결','이동 요청 규격, 위치와 상태 응답을 기다리고 있어요.'],['기관 출결 시스템','미연결','QR·바코드 규격과 출결 API를 확인해야 해요.'],['실내 지도 · 경로','자료 대기','층별 지도와 검증된 장소 안내문이 필요해요.'],['안내문 출력','브라우저 인쇄','프린터 기종과 용지 폭은 현장에서 확인해요.']].map(([title,state,desc])=><div className="integration-card" key={title}><span className="tag">{state}</span><h3>{title}</h3><p>{desc}</p></div>)}</div></section><div className="dashboard-grid"><section className="panel"><div className="panel-heading"><h2><Database size={19}/>프로그램 · 장소 데이터</h2><span className="tag">SQLite</span></div><div className="data-transfer"><FileJson size={38}/><h3>데이터가 도착하면, 여기서 연결하세요.</h3><p>내보낸 JSON을 양식으로 사용하세요. 같은 ID는 수정하고, 새로운 ID는 추가합니다. 파일에서 빠진 항목은 삭제하지 않습니다.</p><div className="button-row"><button className="secondary" disabled={busy||!!adminError||!!connectionError} onClick={()=>void exportFile()}><Download size={18}/>JSON 내보내기</button><label className={`primary upload-label ${busy||adminError||connectionError?'disabled':''}`}><Upload size={18}/>JSON 가져오기<input type="file" accept=".json,application/json" aria-label="JSON 가져오기" disabled={busy||!!adminError||!!connectionError} onChange={e=>{const file=e.target.files?.[0];if(file)void importFile(file);e.target.value=''}}/></label></div><p className="micro">저장소: web-data.db · 예시 ID는 demo-로 시작합니다.<br/>개인정보·회원 정보는 가져오기 대상이 아닙니다.</p></div></section><section className="panel"><div className="panel-heading"><h2>직원 연결 설정</h2></div><form className="connection-form" onSubmit={e=>{e.preventDefault();const f=new FormData(e.currentTarget);sessionStorage.setItem('staff-key',String(f.get('key')||''));void loadAdmin();setNotice('현재 탭에 연결 키를 저장했습니다.')}}><p>로컬 데모에서는 키 없이 둘러볼 수 있습니다. 데모를 끄면 서버에 설정한 직원 키가 필요합니다.</p><label>직원 연결 키<input type="password" name="key" autoComplete="off" placeholder="WEB_ADMIN_KEY"/></label><button className="secondary" type="submit"><Save size={17}/>이 탭에 적용</button><button className="text-button" type="button" onClick={()=>{sessionStorage.removeItem('staff-key');void loadAdmin();setNotice('이 탭의 연결 키를 지웠습니다.')}}>연결 키 지우기</button></form></section></div></>}
      <footer className="admin-footer"><span>Subject R · 함께 만드는 이동형 안내</span><span>실제 기관 데이터 및 장치 연동 준비 중</span></footer>
    </main></div></div>
}

function Metric({label,value,unit,description,icon}:{label:string;value:string;unit?:string;description:string;icon:React.ReactNode}){return <section className="metric"><div><span>{label}</span>{icon}</div><strong>{value}<small>{unit}</small></strong><p>{description}</p></section>}
function SparkleMark(){return <Plus size={32}/>}
function localDate(value:string){const d=new Date(new Date(value).getTime()+9*60*60*1000);return d.toISOString().slice(0,16)}
function Editor({value,places,busy,onSave}:{value:Place|Program|'new-place'|'new-program';places:Place[];busy:boolean;onSave:(form:HTMLFormElement)=>Promise<void>}){
  const isPlace=value==='new-place'||(typeof value==='object'&&'floor' in value)
  const item=typeof value==='object'?value:null
  const place=isPlace?item as Place|null:null
  const program=!isPlace?item as Program|null:null
  return <form onSubmit={e=>{e.preventDefault();void onSave(e.currentTarget)}} className="editor-form"><label>고유 ID<input name="id" required pattern="[a-zA-Z0-9_-]{1,64}" maxLength={64} defaultValue={item?.id||''} readOnly={!!item} placeholder={isPlace?'예: room-201':'예: program-001'}/><small>영문·숫자·하이픈·밑줄만 사용. 등록 후에는 바꿀 수 없습니다.</small></label><label>{isPlace?'장소 이름':'프로그램 이름'}<input name={isPlace?'name':'title'} maxLength={100} required defaultValue={place?.name||program?.title||''}/></label><label>분류<select name="category" defaultValue={item?.category|| (isPlace?'강의실':'건강')}>{(isPlace?['안내','강의실','편의시설','상담']:['건강','문화','디지털','행사']).map(x=><option key={x}>{x}</option>)}</select></label>{isPlace?<><label>층<input name="floor" type="number" required min={-10} max={100} defaultValue={place?.floor??1}/><small>지하층은 음수로 입력하세요.</small></label><label className="full">장소 안내 문구 (줄마다 한 단계)<textarea name="directions" rows={4} defaultValue={place?.directions.join('\n')||''} placeholder="출발 기준점을 포함해 작성해 주세요. 실측 지도 확인 전에는 예시임을 표시하세요."/></label><label className="checkbox full"><input type="checkbox" name="wheelchair_accessible" defaultChecked={place?.wheelchair_accessible||false}/>휠체어 이용 가능 (확인된 경우에만 선택)</label></>:<><label>장소<select name="place_id" required defaultValue={program?.place_id||''}><option value="" disabled>장소를 선택하세요</option>{places.filter(p=>p.is_active).map(p=><option key={p.id} value={p.id}>{floorName(p.floor)} · {p.name}</option>)}</select></label><label>시작 시각 (한국 시간)<input type="datetime-local" name="starts_at" required defaultValue={program?localDate(program.starts_at):''}/></label><label>종료 시각 (한국 시간)<input type="datetime-local" name="ends_at" required defaultValue={program?localDate(program.ends_at):''}/></label><label>강사 · 진행자<input name="instructor" maxLength={100} defaultValue={program?.instructor||''}/></label></>}<label className="full">설명<textarea name="description" rows={3} maxLength={isPlace?500:1000} defaultValue={item?.description||''}/></label><label className="checkbox full"><input type="checkbox" name="is_active" defaultChecked={item?.is_active??true}/>이용자 화면에 공개</label><div className="full form-bottom"><p>숨겨도 기록은 보존됩니다. 사용 중인 장소는 먼저 연결 정보를 변경해 주세요.</p><button className="primary" disabled={busy}><Check size={18}/>{busy?'저장 중…':'저장하기'}</button></div></form>
}
