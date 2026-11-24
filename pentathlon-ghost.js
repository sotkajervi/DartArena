/* Local Pentathlon archive and deterministic Ghost replay; no network or database. */
(function(root){
'use strict';
const PREFIX='dartarena-pentathlon-history-v1:';
const clone=x=>JSON.parse(JSON.stringify(x));
const nameKey=n=>String(n||'').trim().toLocaleLowerCase('nb-NO');
const mode=s=>s.ghost?'ghost':s.rival?'rival':'human';
function archive(storage,s){
 if(s?.status!=='finished'||s.summaries?.length!==7||!Number.isFinite(s.createdAt))return false;
 const id=mode(s)+':'+s.createdAt;
 const record={id,mode:mode(s),createdAt:s.createdAt,players:s.players,total:s.total,firstStarter:s.firstStarter,summaries:s.summaries};
 const key=PREFIX+id,json=JSON.stringify(record);
 if(storage.getItem(key)!==json)storage.setItem(key,json);
 return true;
}
function valid(r){return !!r&&Array.isArray(r.players)&&r.players.length===2&&Array.isArray(r.total)&&r.total.length===2&&r.total.every(Number.isFinite)&&[0,1].includes(r.firstStarter)&&r.summaries?.length===7&&r.summaries.every(s=>Array.isArray(s.entries)&&Array.isArray(s.pent)&&Array.isArray(s.used));}
function get(storage,id){try{const r=JSON.parse(storage.getItem(PREFIX+id)||'null');return valid(r)?r:null}catch{return null}}
function list(storage){
 const rows=[];
 for(let i=0;i<storage.length;i++){const k=storage.key(i);if(k?.startsWith(PREFIX)){const r=get(storage,k.slice(PREFIX.length));if(r)rows.push(r)}}
 return rows.sort((a,b)=>b.createdAt-a.createdAt);
}
function candidates(storage,name){
 const key=nameKey(name);if(!key)return [];
 return list(storage).flatMap(r=>r.players.flatMap((n,p)=>nameKey(n)===key&&(p===0||r.mode==='human')?[{id:r.id+'|'+p,record:r,player:p,total:r.total[p]}]:[])).sort((a,b)=>b.total-a.total||b.record.createdAt-a.record.createdAt);
}
function profile(storage,id){
 const pos=String(id||'').lastIndexOf('|');
 if(pos<0)return null;
 const record=get(storage,id.slice(0,pos)),player=Number(id.slice(pos+1));
 if(!record||![0,1].includes(player)||(player===1&&record.mode!=='human'))return null;
 return {id,record,player,total:record.total[player]};
}
function dart(hit){
 if(hit==='BOM')return{n:0,m:0};
 if(hit==='BULL 50')return{n:25,m:2};
 if(hit==='BULL 25')return{n:25,m:1};
 const m=/^([SDT])([1-9]|1[0-9]|20)$/.exec(hit);
 if(!m)throw Error('Ukjent pil i Ghost-opptaket.');
 return{n:Number(m[2]),m:{S:1,D:2,T:3}[m[1]]};
}
function cutoff(s,E){
 // Only when a historical X01 leg ended without the recorded player checking out.
 // Preserve real visits and awarded points; no invented darts, win or bonus.
 const next=clone(s),c=next.current;
 const before=clone(s);delete before.undo;
 next.undo=(s.undo||[]).slice(-79).concat([before]);
 const after=next.total.map((t,p)=>t+c.pent[p]);
 next.summaries.push({id:E.STAGES[s.stageIndex].id,label:E.STAGES[s.stageIndex].label,kind:c.kind,pent:[...c.pent],after,remaining:[...c.remaining],used:[...c.used],winner:null,halfScores:[...c.halfScores],counts:clone(c.visitCounts),entries:clone(c.entries),ghostCutoff:true});
 next.total=after;next.status='review';return next;
}
function step(s,p,E){
 if(s.status!=='playing'||s.current.turn!==1)return s;
 const reference=p.record.summaries[s.stageIndex];
 if(!reference||reference.kind!==s.current.kind)throw Error('Ghost-opptaket samsvarer ikke med øvelsen.');
 const own=reference.entries.filter(e=>e.player===p.player);
 let index=s.current.entries.filter(e=>e.player===1).length;
 if(s.current.kind==='x01'){
  const v=own[index];
  if(!v)return cutoff(s,E);
  return E.submitX01(s,{score:v.attempt??v.score,bust:v.bust===true,doubleConfirmed:v.checkout===true,darts:v.darts});
 }
 for(let i=0;i<3&&s.status==='playing'&&s.current.turn===1;i++){
  const v=own[index++];
  if(!v)throw Error('Ghost-opptaket mangler en pil.');
  if(v.target!==E.currentTarget(s)?.label)throw Error('Ghost-opptaket har et annet mål.');
  s=E.submitDart(s,dart(v.hit));
 }
 return s;
}
function starter(p){return p.record.firstStarter===p.player?1:0}
function comparison(s,p){
 const n=s.summaries.length,reference=p.record.summaries.slice(0,n).reduce((sum,x)=>sum+x.pent[p.player],0);
 return {completed:n,target:p.total,reference,difference:s.total[0]-reference};
}
root.DartArenaPentathlonGhost=Object.freeze({archive,get,list,candidates,profile,step,starter,comparison});
})(window);
