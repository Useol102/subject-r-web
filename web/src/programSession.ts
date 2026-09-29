import type { Session } from './api'

/** 누른 회차가 있으면 그대로 보여주고, 없으면 진행 중이거나 다음 회차를 고른다. */
export function pickProgramSession(sessions:Session[],programId:string,now:string,preferredId?:string|null){
  const rows=sessions.filter(s=>s.program_id===programId)
  if(preferredId){
    const selected=rows.find(s=>s.id===preferredId)
    if(selected)return selected
  }
  return rows.find(s=>s.status==='scheduled'&&s.ends_at>=now)||rows[rows.length-1]
}
