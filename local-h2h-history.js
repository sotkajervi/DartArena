/* Local Head-to-Head completed-match archive. Stored only in this browser. */
(function(root){
'use strict';
const KEY='dartarena-local-h2h-history-v1';
const DELETED_KEY=KEY+'-deleted-ids';
const LIMIT=150;
const STATS=root.DartArenaX01Stats;
function getStore(){try{return root.localStorage}catch{return null}}
function read(){
  try{
    const items=JSON.parse(getStore()?.getItem(KEY)||'[]');
    return Array.isArray(items)?items.filter(v=>
      v&&typeof v.id==='string'&&Array.isArray(v.players)&&v.players.length===2&&
      Array.isArray(v.visits)&&Number.isInteger(v.winner)&&[0,1].includes(v.winner))
      .sort((a,b)=>String(b.finishedAt||'').localeCompare(String(a.finishedAt||''))).slice(0,LIMIT):[];
  }catch{return []}
}
function deletedIds(){
 try{
   const saved=JSON.parse(getStore()?.getItem(DELETED_KEY)||'[]');
   return new Set(Array.isArray(saved)?saved.filter(x=>typeof x==='string').slice(-500):[]);
 }catch{return new Set()}
}
function stats(visits,player){
  const mapped=visits.map(v=>({
    player_id:v.player,score:v.score,is_checkout:v.checkout,
    darts_used:v.darts,set_no:v.set||1,leg_no:v.leg
  }));
  const calc=STATS?.statsFor(mapped,player);
  return calc?{avg:calc.avg,first9:calc.first9,high:calc.high,
    fast:calc.fast,c100:calc.c100,c140:calc.c140,c170:calc.c170,c180:calc.c180,
    darts:mapped.filter(v=>v.player_id===player).reduce((n,v)=>n+STATS.dartsFor(v),0),
    visits:mapped.filter(v=>v.player_id===player).length}:null;
}
function snapshot(state,config){
  if(!state||state.status!=='finished'||!Number.isInteger(state.winner)||
    !Array.isArray(state.players)||state.players.length!==2||!Array.isArray(state.visits))return null;
  const visits=state.visits.map(v=>({
    player:v.player,set:v.set||1,leg:v.leg,score:v.score,
    remaining:v.remaining,checkout:!!v.checkout,bust:!!v.bust,
    darts:v.darts,at:v.at||null
  }));
  return {
    id:String(state.id),players:state.players.map(n=>String(n).slice(0,32)),
    format:Number(state.format),mode:state.mode==='sets'?'sets':'legs',
    bestOf:Number(state.bestOf),bestOfSets:Number(state.bestOfSets)||1,
    winner:state.winner,legs:(state.legs||[0,0]).slice(0,2),
    sets:(state.sets||[0,0]).slice(0,2),firstStarter:state.firstStarter,
    startedAt:state.startedAt||null,
    finishedAt:visits.length&&Number.isFinite(Date.parse(visits[visits.length-1].at||''))
      ?new Date(visits[visits.length-1].at).toISOString():new Date().toISOString(),
    opponent:config?.mode==='adaptive'?'adaptive':config?'bot':'human',
    profile:config?.profile||null,botLevel:config?Number(config.average):null,
    visits,stats:[stats(visits,0),stats(visits,1)]
  };
}
function save(state,config){
  const item=snapshot(state,config);
  if(!item)return {ok:false,reason:'unfinished'};
  const stored=read();
  if(stored.some(v=>v.id===item.id)||deletedIds().has(item.id))return {ok:true,alreadySaved:true};
  const next=[item,...stored].slice(0,LIMIT);
  try{
    const store=getStore();
    if(!store)throw Error('Ingen lokal lagring tilgjengelig.');
    store.setItem(KEY,JSON.stringify(next));
    return {ok:true,alreadySaved:false};
  }catch(error){return {ok:false,reason:'storage',message:error?.message||'Lagring feilet'};}
}
function recover(){
  // Backfill the last finished local game if it has not been archived.
  try{
    const store=getStore();
    const raw=JSON.parse(store?.getItem('dartarena-local-h2h-state-v1')||'null');
    if(!raw||raw.status!=='finished'||![0,1].includes(raw.winner))return {ok:false,reason:'none'};
    const session=JSON.parse(store?.getItem('dartarena-local-h2h-bot-session-v1')||'null');
    const remembered=session?.id===raw.id?session.config:null;
    const isBot=String(raw.players?.[1]||'').includes(' BOT (');
    return save(raw,remembered||(isBot?{mode:'standard'}:null));
  }catch(error){return {ok:false,reason:'recovery',message:String(error?.message||error)}}
}
function remove(id){
  const old=read();
  const next=old.filter(v=>v.id!==String(id));
  if(old.length===next.length)return false;
  try{
    const store=getStore(),removed=deletedIds();
    removed.add(String(id));
    store.setItem(DELETED_KEY,JSON.stringify([...removed].slice(-500)));
    store.setItem(KEY,JSON.stringify(next));
    return true;
  }catch{return false}
}
function clear(){
  try{getStore().removeItem(KEY);return true}catch{return false}
}
root.DartArenaH2HHistory={read,save,recover,remove,clear,storageKey:KEY,limit:LIMIT};
})(window);
