import { useCallback, useEffect, useRef, useState } from 'react'
import { ArrowLeft, ArrowRight, BookOpen, CalendarDays, Check, ChevronRight, Clock3, Home, MapPin, MessageCircle, Printer, ScanLine, Settings2, Sparkles, Accessibility, X, WifiOff, RefreshCw, Search } from 'lucide-react'
import { day, floorName, request, time, type Place, type Program, type Snapshot } from './api'
import { choseongOf, searchByName } from './hangulSearch'
import { createScanBuffer, pickDefaultProgram } from './scanner'
import Admin from './Admin'

type Page = 'home'|'programs'|'places'|'attendance'|'detail'
export default function App(){
  const [data,setData]=useState<Snapshot|null>(null)
  const [error,setError]=useState('')
  const [page,setPage]=useState<Page>('home')
  const [selected,setSelected]=useState<Program|Place|null>(null)
  const [large,setLarge]=useState(false)
  const [filter,setFilter]=useState('전체')
  const [query,setQuery]=useState('')
  const [help,setHelp]=useState(false)
  const [busy,setBusy]=useState(false)
  const [attendanceMessage,setAttendanceMessage]=useState('')
  const [programId,setProgramId]=useState('')
  const [manual,setManual]=useState(false)
  const [reading,setReading]=useState(false)
  const [now,setNow]=useState(new Date())
  const mainRef=useRef<HTMLElement>(null)
  const searchRef=useRef<HTMLInputElement>(null)
  // 스캐너 리스너는 한 번만 붙이고, 최신 값은 ref 로 읽는다 (리스너 재등록 방지)
  const attendRef=useRef<(code:string,target:string)=>void>(()=>{})
  const liveRef=useRef({programId:'',demo:false})
  const isAdmin=window.location.pathname==='/admin'
  const load=useCallback(async()=>{
    try {setData(await request<Snapshot>('/snapshot'));setError('')}catch(e){setError((e as Error).message)}
  },[])
  useEffect(()=>{void load();const id=window.setInterval(()=>{void load();setNow(new Date())},10000);return()=>clearInterval(id)},[load])
  useEffect(()=>{mainRef.current?.focus();window.scrollTo(0,0)},[page])
  useEffect(()=>{
    if(isAdmin||page==='home')return
    let timer=window.setTimeout(reset,180000)
    function reset(){setPage('home');setSelected(null);setAttendanceMessage('');setHelp(false)}
    const touch=()=>{clearTimeout(timer);timer=window.setTimeout(reset,180000)}
    window.addEventListener('pointerdown',touch);window.addEventListener('keydown',touch)
    return()=>{clearTimeout(timer);window.removeEventListener('pointerdown',touch);window.removeEventListener('keydown',touch)}
  },[page,isAdmin])
  const navigate=(next:Page)=>{setPage(next);setFilter('전체');setQuery('');setAttendanceMessage('')}
  const places=data?.places||[]
  const programs=data?.programs||[]
  const today=day(now.toISOString())
  const todays=programs.filter(p=>day(p.starts_at)===today)
  // 출석 화면에 들어오면 지금 시간대의 프로그램을 미리 골라준다.
  useEffect(()=>{
    if(page!=='attendance')return
    setProgramId(prev=>prev||pickDefaultProgram(todays,now)?.id||'')
  },[page,todays.length])// eslint-disable-line react-hooks/exhaustive-deps
  // 바코드 스캐너(키보드 웨지) 입력을 받는다. 직접 입력 중에는 끈다.
  useEffect(()=>{
    if(isAdmin||page!=='attendance'||manual)return
    const buffer=createScanBuffer()
    let idle=0
    function onKey(e:KeyboardEvent){
      const code=buffer.push(e.key,e.timeStamp||performance.now())
      if(buffer.size()>0){
        setReading(true)
        window.clearTimeout(idle)
        idle=window.setTimeout(()=>setReading(false),500)
      }
      if(code){
        e.preventDefault()
        window.clearTimeout(idle)
        setReading(false)
        if(liveRef.current.demo)attendRef.current(code,liveRef.current.programId)
      }
    }
    window.addEventListener('keydown',onKey)
    return()=>{window.removeEventListener('keydown',onKey);window.clearTimeout(idle);setReading(false)}
  },[page,manual,isAdmin])
  if(isAdmin)return <Admin data={data} reload={load} connectionError={error}/>
  const current=places.find(p=>p.id===data?.robots[0]?.current_place_id)
  // 장소 찾기: 층 필터 → 이름·초성 검색 순. 검색 규칙은 hangulSearch.ts
  const foundPlaces=searchByName(places.filter(p=>filter==='전체'||floorName(p.floor)===filter),query,p=>p)
  // 초성 검색 예시는 지어내지 않고 실제 등록된 장소 이름에서 만든다
  // (한글로만 된 가장 짧은 이름을 골라야 예시가 한눈에 읽힌다)
  const searchExample=(()=>{const name=places.map(p=>p.name).filter(n=>Array.from(n).every(ch=>choseongOf(ch))).sort((a,b)=>a.length-b.length)[0];return name?{name,initials:Array.from(name).map(ch=>choseongOf(ch)).join('')}:null})()
  const pickedProgram=selected&&'title' in selected ? selected : null
  const pickedPlace=pickedProgram ? places.find(p=>p.id===pickedProgram.place_id) : selected as Place|null
  const choose=(item:Program|Place)=>{setSelected(item);navigate('detail')}
  async function attend(code:string,target:string){
    if(busy)return
    if(!target){setAttendanceMessage('참여하실 프로그램을 먼저 골라 주세요.');return}
    setBusy(true);setAttendanceMessage('')
    try{const result=await request<{message:string}>('/attendance/demo','POST',{program_id:target,code});setAttendanceMessage(result.message)}
    catch(e){setAttendanceMessage((e as Error).message)}finally{setBusy(false)}
  }
  attendRef.current=attend
  liveRef.current={programId,demo:!!data?.demo}
  return <div className={`kiosk ${large?'large-type':''}`}>
    <a className="skip-link" href="#main">본문 바로가기</a>
    <header className="kiosk-header"><button className="brand" onClick={()=>navigate('home')} aria-label="처음 화면"><span className="brand-symbol">R<span>·</span></span><span>Subject R<small>우리 곁의 다정한 안내</small></span></button><div className="header-right"><span className="location"><MapPin size={17}/>{current?`${floorName(current.floor)} ${current.name}`:'현재 위치 연결 대기'}</span><span className="header-date">{now.toLocaleDateString('ko-KR',{month:'long',day:'numeric',weekday:'long',timeZone:'Asia/Seoul'})}</span></div></header>
    <div className="demo-strip"><span className="status-dot"/>{data?.demo?'미리보기 · 모든 장소와 프로그램은 예시입니다.':'웹 서비스 · 로봇과 출결은 연결 준비 중입니다.'}<a href="/admin">직원 화면 <ArrowRight size={14}/></a></div>
    {error&&<div className="connection-error" role="alert"><WifiOff size={18}/>{error}<button onClick={()=>void load()}><RefreshCw size={16}/>다시 연결</button></div>}
    <main id="main" ref={mainRef} tabIndex={-1} className="kiosk-main">
      {!data&&!error?<div className="empty">안내 화면을 준비하고 있어요…</div>:<>
      {page!=='home'&&<button className="back-link" onClick={()=>navigate('home')}><ArrowLeft size={19}/>처음으로</button>}
      {page==='home'&&<>
        <section className="welcome"><div><div className="eyebrow">반가워요, 오늘도 함께해요</div><h1>어떤 도움이<br/>필요하세요?</h1><p>찾고 싶은 정보, 천천히 골라 주세요.</p></div><div className="welcome-art" aria-hidden="true"><div className="orbit orbit-one"/><div className="orbit orbit-two"/><span className="art-spark"><Sparkles size={30}/></span><div className="robot-illustration"><div className="robot-top"><span/><span/></div><div className="robot-smile"/><span className="robot-r">R</span><div className="robot-base"/></div><div className="art-caption">오늘도 좋은 하루 보내세요 <span>✦</span></div></div></section>
        <section className="action-grid" aria-label="주요 안내"><button className="action-card program-action" onClick={()=>navigate('programs')}><div className="action-top"><span className="action-icon"><CalendarDays size={31}/></span><span className="card-number">01</span></div><h2>프로그램 보기</h2><p>오늘은 어떤 배움이 있을까요?</p><span className="action-bottom">강의 · 행사 안내 <ArrowRight/></span></button><button className="action-card place-action" onClick={()=>navigate('places')}><div className="action-top"><span className="action-icon"><MapPin size={31}/></span><span className="card-number">02</span></div><h2>장소 찾기</h2><p>찾아가실 곳을 알려드릴게요.</p><span className="action-bottom">강의실 · 편의시설 <ArrowRight/></span></button><button className="action-card attendance-action" onClick={()=>navigate('attendance')}><div className="action-top"><span className="action-icon"><ScanLine size={31}/></span><span className="card-number">03</span></div><h2>출석 확인</h2><p>참여하실 프로그램에 출석해요.</p><span className="action-bottom">QR · 바코드 안내 <ArrowRight/></span></button></section>
        <section className="today-section"><div className="section-heading"><h2><span className="tiny-square"/>오늘의 프로그램 <span className="count">{todays.length}</span></h2><button className="text-button" onClick={()=>navigate('programs')}>모두 보기 <ChevronRight size={17}/></button></div>{todays.length?<div className="today-list">{todays.slice(0,3).map(p=><button className="today-row" key={p.id} onClick={()=>choose(p)}><span className="program-time">{time(p.starts_at)}</span><span className={`tag tag-${p.category}`}>{p.category}</span><strong>{p.title}</strong><span className="muted row-place">{places.find(x=>x.id===p.place_id)?.name}</span><ChevronRight size={20}/></button>)}</div>:<div className="empty compact"><CalendarDays/>아직 오늘의 프로그램이 등록되지 않았어요.<small>직원 화면에서 프로그램을 등록하면 여기에 표시돼요.</small><a className="text-button" href="/admin">직원 화면 열기 <ArrowRight size={16}/></a></div>}</section>
      </>}
      {page==='programs'&&<><PageTitle eyebrow="함께 배우는 즐거움" title="프로그램을 골라 주세요" description="프로그램을 누르면 시간과 장소를 볼 수 있어요."/><div className="filter-row">{['전체','건강','문화','디지털','행사'].map(x=><button key={x} aria-pressed={filter===x} className={filter===x?'chip active':'chip'} onClick={()=>setFilter(x)}>{x}</button>)}</div><div className="program-grid">{programs.filter(p=>filter==='전체'||p.category===filter).map(p=><button className="program-card" key={p.id} onClick={()=>choose(p)}><div className="card-title-line"><span className={`tag tag-${p.category}`}>{p.category}</span><BookOpen size={24}/></div><h2>{p.title}</h2><p>{p.description}</p><div className="program-meta"><span><CalendarDays size={17}/>{day(p.starts_at)}</span><span><Clock3 size={17}/>{time(p.starts_at)} – {time(p.ends_at)}</span><span><MapPin size={17}/>{places.find(x=>x.id===p.place_id)?.name||'장소 확인 필요'}</span></div><span className="card-link">자세히 보기 <ArrowRight size={20}/></span></button>)}</div>{!programs.filter(p=>filter==='전체'||p.category===filter).length&&<Empty text="등록된 프로그램이 없어요."/>}</>}
      {page==='places'&&<><PageTitle eyebrow="어디로 가시나요?" title="찾으시는 장소를 골라 주세요" description="장소별 안내와 이용 정보를 확인할 수 있어요."/>
        <div className="place-search">
          <label className="search-field search-field-large"><Search size={28} aria-hidden="true"/><input ref={searchRef} type="search" placeholder="장소 이름을 입력해 주세요" value={query} onChange={e=>setQuery(e.target.value)} aria-label="장소 검색" autoComplete="off" enterKeyHint="search"/>{query&&<button type="button" className="search-clear" aria-label="검색어 지우기" onClick={()=>{setQuery('');searchRef.current?.focus()}}><X size={24}/></button>}</label>
          <p className="search-hint">첫 자음만 넣어도 찾아요.{searchExample&&<> 예) {searchExample.name} → <strong>{searchExample.initials}</strong></>}</p>
        </div>
        <div className="filter-row">{['전체',...Array.from(new Set(places.map(p=>floorName(p.floor))))].map(x=><button key={x} className={filter===x?'chip active':'chip'} aria-pressed={filter===x} onClick={()=>setFilter(x)}>{x}</button>)}</div>
        {query.trim()&&<p className="search-count" role="status">{foundPlaces.length?`${foundPlaces.length}곳을 찾았어요.`:'찾으시는 장소가 없어요.'}</p>}
        <div className="place-grid">{foundPlaces.map(p=><button className="place-card" onClick={()=>choose(p)} key={p.id}><span className="floor-box">{floorName(p.floor)}</span><div><span className="muted">{p.category}</span><h2>{p.name}</h2><p>{p.wheelchair_accessible?`휠체어 이용 가능${data?.demo?' · 예시 정보':''}`:'접근성 정보 확인 필요'}</p></div><ChevronRight/></button>)}</div>
        {!foundPlaces.length&&<div className="empty"><MapPin/><p>{query.trim()?'다른 이름이나 첫 자음으로 다시 찾아보세요.':'이 층에 등록된 장소가 없어요.'}</p><button className="secondary" onClick={()=>setHelp(true)}><MessageCircle size={20}/>직원에게 물어보기</button></div>}
      </>}
      {page==='detail'&&selected&&<><div className="detail-layout"><section className="detail-info"><span className="eyebrow">{pickedProgram?'프로그램 안내':'장소 안내'}</span><h1>{pickedProgram?.title||pickedPlace?.name}</h1><p className="detail-description">{selected.description}</p>{pickedProgram&&<div className="detail-facts"><div><CalendarDays/>날짜<strong>{day(pickedProgram.starts_at)}</strong></div><div><Clock3/>시간<strong>{time(pickedProgram.starts_at)} – {time(pickedProgram.ends_at)}</strong></div>{pickedProgram.instructor&&<div><BookOpen/>진행<strong>{pickedProgram.instructor}</strong></div>}</div>}<div className="place-highlight"><MapPin/><div><small>찾아가실 곳</small><strong>{pickedPlace?`${floorName(pickedPlace.floor)} · ${pickedPlace.name}`:'장소 정보 확인 필요'}</strong></div></div><button className="primary print-button" onClick={()=>window.print()}><Printer size={21}/>안내문 인쇄하기</button><p className="micro">연결된 프린터를 선택해 주세요. 인쇄 완료 여부는 프린터에서 확인해요.</p></section><section className="directions-card"><span className="tag">장소 안내</span><h2>천천히 찾아오세요</h2><p className="muted">{data?.demo?'예시 안내 · 실제 이동에 사용하지 마세요.':'등록된 안내문입니다. 현재 위치 기준 자동 경로는 제공하지 않아요.'}</p><div className="map-placeholder"><MapPin size={38}/><strong>실내 지도를 준비하고 있어요</strong><span>실측 지도와 경로를 받으면 여기에 연결해요.</span></div>{pickedPlace?.directions.length?<ol className="directions">{pickedPlace.directions.map((step,i)=><li key={i}><span>{i+1}</span><p>{step}</p></li>)}</ol>:<p>안내 문구가 아직 없어요. 직원에게 물어봐 주세요.</p>}{pickedPlace?.wheelchair_accessible&&<div className="access-note"><Accessibility size={20}/>휠체어 이용 가능{data?.demo?' · 예시 정보':''}</div>}</section></div></>}
      {page==='attendance'&&<><PageTitle eyebrow="반가워요, 잘 오셨어요" title="프로그램 출석을 확인해요" description={manual?'예시 코드를 직접 넣어 확인해요.':'회원증 바코드를 스캐너에 대 주세요.'}/><div className="attendance-layout">
        <div className={`scan-illustration${reading?' is-reading':''}${busy?' is-busy':''}`}>
          <ScanLine size={94} strokeWidth={1}/>
          <h2 aria-live="polite">{busy?'확인하고 있어요':reading?'읽고 있어요':'회원증을 대 주세요'}</h2>
          <p>{busy?'잠시만 기다려 주세요.':reading?'그대로 잠시 들고 계세요.':<>바코드를 스캐너 불빛에<br/>가볍게 대 주시면 됩니다.</>}</p>
          <span className="tag">{data?.demo?'현재는 체험 화면이에요':'기관 연동 준비 중이에요'}</span>
        </div>
        <div className="attendance-form">
          <label>참여 프로그램<select value={programId} onChange={e=>setProgramId(e.target.value)} disabled={!todays.length}><option value="" disabled>오늘의 프로그램을 선택해 주세요</option>{todays.map(p=><option value={p.id} key={p.id}>{time(p.starts_at)} · {p.title}</option>)}</select></label>
          {!todays.length&&<p className="muted">오늘 예정된 프로그램이 없어요.</p>}
          {manual
            ?<form className="manual-scan" onSubmit={e=>{e.preventDefault();const input=e.currentTarget.elements.namedItem('code') as HTMLInputElement;void attend(input.value,programId);input.value=''}}>
              <label>예시 코드<input name="code" required maxLength={128} placeholder="TEST-001" autoComplete="off" autoFocus/></label>
              <p className="muted">체험용 코드 <strong>TEST-001</strong>을 입력해 주세요.<br/>실제 회원증이나 개인정보는 입력하지 마세요.</p>
              <button className="primary" disabled={busy||!!error||!todays.length||!data?.demo}><Check size={20}/>{busy?'확인 중…':'데모 출석 확인'}</button>
            </form>
            :<p className="muted">스캐너가 준비돼 있어요. 회원증을 대면 자동으로 확인합니다.<br/>스캐너가 없으면 아래에서 직접 입력할 수 있어요.</p>}
          <button type="button" className="text-button" onClick={()=>{setManual(m=>!m);setAttendanceMessage('')}}>{manual?<><ScanLine size={17}/>스캐너로 확인하기</>:<><Settings2 size={17}/>직접 입력하기</>}</button>
          {attendanceMessage&&<div className="inline-message" role="status">{attendanceMessage}</div>}
        </div>
      </div></>}
      </>}
    </main>
    <footer className="kiosk-footer"><button onClick={()=>navigate('home')}><Home size={20}/>처음으로</button><span className="footer-greeting">천천히 이용하세요. 늘 곁에 있을게요.</span><div><button aria-pressed={large} onClick={()=>setLarge(!large)}><span className="text-size-icon">가</span>{large?'기본 글씨':'큰 글씨'}</button><button onClick={()=>setHelp(true)}><MessageCircle size={20}/>도움 안내</button></div></footer>
    {help&&<div className="modal-backdrop" onClick={()=>setHelp(false)}><section className="modal" role="dialog" aria-modal="true" aria-label="도움 안내" onClick={e=>e.stopPropagation()} onKeyDown={e=>{if(e.key==='Escape')setHelp(false);if(e.key==='Tab')e.preventDefault()}}><button autoFocus className="icon-close" aria-label="닫기" onClick={()=>setHelp(false)}><X/></button><MessageCircle size={40}/><h2>가까운 직원에게 물어보세요</h2><p>안내데스크에서 도움을 받으실 수 있어요.<br/>이 화면에서는 직원 호출이 전송되지 않아요.</p></section></div>}
    {page==='detail'&&selected&&<article className="receipt"><h2>Subject R · 안내문</h2><p>{data?.demo?'예시 정보 · 실제 기관 안내가 아닙니다.':''}</p><h1>{pickedProgram?.title||pickedPlace?.name}</h1>{pickedProgram&&<p>{day(pickedProgram.starts_at)}<br/>{time(pickedProgram.starts_at)} – {time(pickedProgram.ends_at)}</p>}<p>{pickedPlace?`${floorName(pickedPlace.floor)} ${pickedPlace.name}`:''}</p><p>{selected.description}</p><hr/><h3>장소 안내</h3><ol>{pickedPlace?.directions.map((s,i)=><li key={i}>{s}</li>)}</ol><p>자동 경로가 아닌 등록된 안내문입니다.</p><small>궁금한 점은 안내데스크에 물어보세요.</small></article>}
  </div>
}
function PageTitle({eyebrow,title,description}:{eyebrow:string;title:string;description:string}){return <div className="page-title"><div className="eyebrow">{eyebrow}</div><h1>{title}</h1><p>{description}</p></div>}
function Empty({text}:{text:string}){return <div className="empty"><CalendarDays/><p>{text}</p></div>}
