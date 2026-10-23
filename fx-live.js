/* DartArena FX Live — visuals only. No game state, score writes, WebRTC or RPC calls. */
(function(root){
'use strict';
const LEVELS=Object.freeze({off:0,minimal:1,normal:2,cinematic:3});
const EFFECT_MIN_LEVEL=Object.freeze({rolling_score:1,neon_relay:2,led_score_rail:1,cinematic_switch:3,elimination_fx:2,bracket_power:2});
const DEFAULT_EFFECTS=Object.freeze(Object.fromEntries(Object.keys(EFFECT_MIN_LEVEL).map(name=>[name,true])));
function effectsFrom(input){const result={...DEFAULT_EFFECTS};for(const key of Object.keys(result)){if(typeof input?.[key]==='boolean')result[key]=input[key]}return result}
const KEY='dartarena-fx-level-v1';
const validLevel=s=>Object.prototype.hasOwnProperty.call(LEVELS,s);
function readLevel(){try{const s=root.localStorage.getItem(KEY);return validLevel(s)?s:'off'}catch{return 'off'}}
function storeLevel(s){if(!validLevel(s))return;try{root.localStorage.setItem(KEY,s)}catch{}}
const reduced=()=>!!root.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
const scoreValid=n=>Number.isInteger(n)&&n>=0&&n<=1001;
function connectSelect(element,instance){
  if(!element||!instance)return()=>{};
  element.value=instance.getLevel();
  function change(){const next=element.value;if(!validLevel(next))return;storeLevel(next);instance.setLevel(next)}
  element.addEventListener('change',change);
  return()=>element.removeEventListener('change',change);
}
function engine(matchId,options={}){
  const doc=options.document||root.document,seen=new Set(),order=[],active=new Map();
  let level=validLevel(options.level)?options.level:'off',dead=false;
  let effects=effectsFrom(options.effects);
  const can=name=>!!effects[name]&&LEVELS[level]>=EFFECT_MIN_LEVEL[name]&&!reduced();
  const targets=options.targets||{};
  function find(key){const target=targets[key];return typeof target==='function'?target():typeof target==='string'?doc.querySelector(target):target||null}
  function stopAll(){for(const controller of active.values())controller.abort();active.clear()}
  function play(lane,action){
    if(dead||level==='off'||reduced())return;
    const old=active.get(lane);if(old)old.abort();
    const controller=new AbortController();active.set(lane,controller);
    Promise.resolve().then(()=>{if(!controller.signal.aborted)return action(controller.signal)}).catch(e=>{
      if(!controller.signal.aborted)console.warn('[DartArenaFX]',e);
    }).finally(()=>{if(active.get(lane)===controller)active.delete(lane)});
  }
  function emit(e){
    if(dead||level==='off'||!e||String(e.matchId)!==String(matchId))return 0;
    if(!e.id)return 0;
    const key=String(e.id);if(seen.has(key))return 0;
    seen.add(key);order.push(key);if(order.length>256)seen.delete(order.shift());
    if(e.type==='score_applied'&&e.playerSlot&&scoreValid(e.previousScore)&&scoreValid(e.newScore)&&
       e.previousScore>=2&&e.newScore!==1&&(e.newScore!==0||e.checkout===true)&&
       Number.isInteger(e.scored)&&e.scored>0&&e.scored<=180&&
       e.previousScore-e.newScore===e.scored&&!e.bust&&!e.undo){
      if(can('rolling_score'))play('rolling:'+e.playerSlot,signal=>rolling(doc,find(e.playerSlot),e,signal,level));
      if(can('led_score_rail'))play('rail:'+e.playerSlot,()=>{const rail=find('rail:'+e.playerSlot);if(rail)paintRail(rail,e.newScore,e.startScore,true)});
    }
    if(e.type==='turn_changed'&&e.previousSlot!==e.nextSlot&&!e.legEnded&&!e.matchEnded){
      if(can('neon_relay'))play('turn',signal=>relay(doc,find('card:'+e.previousSlot),find('card:'+e.nextSlot),signal));
      if(can('cinematic_switch'))play('handoff',signal=>cinematic(doc,find('card:'+e.previousSlot),find('card:'+e.nextSlot),signal));
    }
    if(e.type==='cup_result_confirmed'&&can('elimination_fx'))
      play('cup:'+e.cupMatchId,signal=>elimination(doc,e,signal));
    if(e.type==='cup_bracket_advanced'&&can('bracket_power'))
      play('bracket:'+e.cupMatchId,signal=>bracket(doc,e,signal));
    return 1;
  }
  function setLevel(next){if(!validLevel(next)||dead)return;stopAll();level=next}
  function setEffects(next){if(dead||!next||typeof next!=='object')return;stopAll();effects=effectsFrom({...effects,...next})}
  const getEffects=()=>({...effects});
  const isEnabled=name=>Object.prototype.hasOwnProperty.call(effects,name)&&can(name);
  function onHide(){if(doc.hidden)stopAll()}
  function destroy(){if(dead)return;dead=true;stopAll();doc.removeEventListener('visibilitychange',onHide);root.removeEventListener('pagehide',destroy)}
  doc.addEventListener('visibilitychange',onHide);root.addEventListener('pagehide',destroy);
  return {emit,setLevel,getLevel:()=>level,setEffects,getEffects,isEnabled,reset:stopAll,destroy,find};
}
function onAbort(signal,cleanup){
  signal.addEventListener('abort',cleanup,{once:true});
  return()=>signal.removeEventListener('abort',cleanup);
}
function rolling(doc,target,e,signal,level){
  if(!target?.isConnected||!doc.body||!doc.defaultView?.requestAnimationFrame)return;
  const win=doc.defaultView,r=target.getBoundingClientRect();
  if(r.width<1||r.height<1)return;
  const style=win.getComputedStyle(target);
  const el=doc.createElement('span');el.className='da-fx-rolling-number';el.setAttribute('aria-hidden','true');
  Object.assign(el.style,{left:r.left+'px',top:r.top+'px',width:r.width+'px',height:r.height+'px',
    fontFamily:style.fontFamily,fontSize:style.fontSize,fontWeight:style.fontWeight,
    lineHeight:style.lineHeight,letterSpacing:style.letterSpacing,color:style.color});
  el.textContent=String(e.previousScore);doc.body.appendChild(el);
  target.classList.add('da-fx-rolling-target');
  const duration=Math.min(level==='cinematic'?660:540,290+e.scored*1.45);
  return new Promise(resolve=>{
    let finished=false,frame=0,timer=0,start=null;
    function cleanup(){
      if(finished)return;finished=true;win.cancelAnimationFrame(frame);root.clearTimeout(timer);
      off();el.remove();target.classList.remove('da-fx-rolling-target');resolve();
    }
    const off=onAbort(signal,cleanup);
    function tick(now){
      if(signal.aborted||!target.isConnected)return cleanup();
      if(start===null)start=now;
      const t=Math.min(1,(now-start)/duration),ease=1-Math.pow(1-t,3);
      el.textContent=String(Math.round(e.previousScore+(e.newScore-e.previousScore)*ease));
      if(t<1)frame=win.requestAnimationFrame(tick);
      else{el.classList.add('da-fx-rolling-finish');timer=root.setTimeout(cleanup,90)}
    }
    if(signal.aborted)cleanup();else frame=win.requestAnimationFrame(tick);
  });
}
function paintRail(rail,score,start,animate){
  if(!scoreValid(Number(score))||!Number.isInteger(Number(start))||Number(start)<2)return;
  const fill=rail.firstElementChild,ratio=Math.max(0,Math.min(1,(Number(start)-Number(score))/Number(start)));
  if(!fill)return;
  fill.style.transitionDuration=animate&&!reduced()?'420ms':'0ms';
  fill.style.transform='scaleY('+ratio+')';
  rail.classList.toggle('da-fx-rail-checkout',score<=170&&score>1);
  rail.classList.toggle('da-fx-rail-finish',score===0);
}
function makeRail(doc,card,slot){
  if(!card?.isConnected)return null;
  const rail=doc.createElement('span'),fill=doc.createElement('span');
  rail.className='da-fx-score-rail';rail.setAttribute('aria-hidden','true');
  fill.className='da-fx-score-rail-fill';rail.append(fill);
  card.classList.add('da-fx-rail-host');card.append(rail);
  rail.dataset.slot=slot;return rail;
}
function relay(doc,from,to,signal){
  if(!from?.isConnected||!to?.isConnected||!doc.body)return;
  const a=from.getBoundingClientRect(),b=to.getBoundingClientRect();
  const x=a.left+a.width/2,y=a.top+a.height/2,x2=b.left+b.width/2,y2=b.top+b.height/2;
  const length=Math.hypot(x2-x,y2-y);if(length<12)return;
  const line=doc.createElement('span');line.className='da-fx-relay-beam';line.setAttribute('aria-hidden','true');
  Object.assign(line.style,{left:x+'px',top:y+'px',width:length+'px',transform:'rotate('+Math.atan2(y2-y,x2-x)+'rad)'});
  doc.body.appendChild(line);to.classList.add('da-fx-relay-arrival');
  return new Promise(resolve=>{let done=false,timer;
    function clear(){if(done)return;done=true;root.clearTimeout(timer);off();line.remove();to.classList.remove('da-fx-relay-arrival');resolve()}
    const off=onAbort(signal,clear);if(signal.aborted)clear();else timer=root.setTimeout(clear,350);
  });
}
// Cinematic Switch: a bright full-width band moving vertically over stacked
// scorecards, or a full-height band moving horizontally over adjacent cards.
// Geometry comes from actual card positions, not a page layout assumption.
function cinematic(doc,from,to,signal){
  if(!doc.body||signal.aborted||!from?.isConnected||!to?.isConnected)return;
  const a=from.getBoundingClientRect(),b=to.getBoundingClientRect();
  if(!a.width||!a.height||!b.width||!b.height)return;
  const ax=a.left+a.width/2,ay=a.top+a.height/2;
  const bx=b.left+b.width/2,by=b.top+b.height/2;
  const stacked=Math.abs(by-ay)>=Math.abs(bx-ax)*0.65;
  const thickness=14,margin=3;
  let left,top,width,height,dx=0,dy=0;
  if(stacked){
    const down=by>ay;
    // Span the entire width of BOTH cards, even if their widths differ.
    left=Math.min(a.left,b.left)+margin;
    width=Math.max(a.right,b.right)-margin-left;
    top=down?a.top-thickness:a.bottom;
    height=thickness;
    const end=down?b.bottom:b.top-thickness;
    dy=end-top;
  }else{
    const right=bx>ax;
    // Span the entire height of BOTH cards, even if their heights differ.
    top=Math.min(a.top,b.top)+margin;
    height=Math.max(a.bottom,b.bottom)-margin-top;
    left=right?a.left-thickness:a.right;
    width=thickness;
    const end=right?b.right:b.left-thickness;
    dx=end-left;
  }
  if(width<=0||height<=0||Math.hypot(dx,dy)<12)return;
  const sweep=doc.createElement('span');
  sweep.className='da-fx-turn-sweep '+(stacked?'is-horizontal-band':'is-vertical-band');
  sweep.setAttribute('aria-hidden','true');
  Object.assign(sweep.style,{left:left+'px',top:top+'px',width:width+'px',height:height+'px'});
  sweep.style.setProperty('--da-fx-travel-x',dx+'px');
  sweep.style.setProperty('--da-fx-travel-y',dy+'px');
  const duration=580,arrivalAt=345,cleanupAt=810;
  return new Promise(resolve=>{
    let finished=false;
    const timers=[];
    function cleanup(){
      if(finished)return;finished=true;
      for(const timer of timers)root.clearTimeout(timer);
      off();
      from.classList.remove('da-fx-turn-source');
      to.classList.remove('da-fx-turn-arrival');
      sweep.remove();
      resolve();
    }
    const off=onAbort(signal,cleanup);
    if(signal.aborted)return cleanup();
    doc.body.append(sweep);
    from.classList.add('da-fx-turn-source');
    timers.push(root.setTimeout(()=>{
      if(!signal.aborted&&to.isConnected)to.classList.add('da-fx-turn-arrival');
    },arrivalAt));
    timers.push(root.setTimeout(cleanup,cleanupAt));
  });
}
const findCupMatch=(doc,id)=>[...doc.querySelectorAll('#cupBracket .cup-match[data-match]')].find(x=>x.getAttribute('data-match')===String(id));
const cupCard=(match,id)=>[...(match?.querySelectorAll('.cup-player')||[])].find(card=>
  [...card.querySelectorAll('[data-user-id]')].some(x=>x.getAttribute('data-user-id')===String(id)));
function elimination(doc,e,signal){
  const match=findCupMatch(doc,e.cupMatchId),card=cupCard(match,e.loserId);
  if(!card?.isConnected)return;
  const label=doc.createElement('span');label.className='da-fx-elimination-label';label.setAttribute('aria-hidden','true');
  label.textContent='UTSLÅTT';card.classList.add('da-fx-elimination');card.append(label);
  return new Promise(resolve=>{let done=false,timer;
    function clear(){if(done)return;done=true;root.clearTimeout(timer);off();label.remove();card.classList.remove('da-fx-elimination');resolve()}
    const off=onAbort(signal,clear);if(signal.aborted)clear();else timer=root.setTimeout(clear,830);
  });
}
function bracket(doc,e,signal){
  const source=findCupMatch(doc,e.cupMatchId),target=findCupMatch(doc,e.nextMatchId);
  const winner=cupCard(source,e.winnerId);
  if(!winner?.isConnected||!target?.isConnected||!doc.body||
     ![...target.querySelectorAll('[data-user-id]')].some(x=>x.getAttribute('data-user-id')===String(e.winnerId)))return;
  return new Promise(resolve=>{let done=false,svg=null,timer=null,anim=null;
    function clear(){if(done)return;done=true;root.clearTimeout(timer);off();try{anim?.cancel()}catch{}svg?.remove();winner.classList.remove('da-fx-bracket-source');target.classList.remove('da-fx-bracket-target');resolve()}
    const off=onAbort(signal,clear);
    timer=root.setTimeout(()=>{
      if(signal.aborted||!winner.isConnected||!target.isConnected)return clear();
      const a=winner.getBoundingClientRect(),b=target.getBoundingClientRect();
      const ax=a.left+a.width/2,ay=a.top+a.height/2,bx=b.left+b.width/2,by=b.top+b.height/2;
      const ns='http://www.w3.org/2000/svg';
      svg=doc.createElementNS(ns,'svg');svg.setAttribute('viewBox','0 0 '+root.innerWidth+' '+root.innerHeight);
      svg.setAttribute('aria-hidden','true');svg.classList.add('da-fx-bracket-svg');
      const path=doc.createElementNS(ns,'path');const dx=Math.max(30,Math.abs(bx-ax)*.45);
      path.setAttribute('d','M '+ax+' '+ay+' C '+(ax+dx)+' '+ay+' '+(bx-dx)+' '+by+' '+bx+' '+by);
      path.classList.add('da-fx-bracket-path');svg.append(path);doc.body.append(svg);
      const length=path.getTotalLength?.()||Math.hypot(bx-ax,by-ay)*1.3;
      path.style.strokeDasharray=String(length);path.style.strokeDashoffset=String(length);
      try{anim=path.animate?.([{strokeDashoffset:length},{strokeDashoffset:0}],{duration:620,easing:'ease-in-out',fill:'forwards'})}catch{}
      winner.classList.add('da-fx-bracket-source');target.classList.add('da-fx-bracket-target');
      timer=root.setTimeout(clear,700);
    },380);
    if(signal.aborted)clear();
  });
}
function createX01(options={}){
  const doc=options.document||root.document,matchId=String(options.matchId||'');
  if(!matchId)throw Error('FX matchId required');
  const slots=options.slots||{},start=Number(options.startScore||501),targets={};
  if(!Number.isInteger(start)||start<2||start>1001)throw Error('Invalid start score');
  const railNodes={};
  for(const s of ['p1','p2']){
    targets[s]=slots[s]?.score;targets['card:'+s]=slots[s]?.card;targets['camera:'+s]=slots[s]?.camera;
    const card=typeof slots[s]?.card==='string'?doc.querySelector(slots[s].card):slots[s]?.card;
    const rail=makeRail(doc,card,s);if(rail){railNodes[s]=rail;targets['rail:'+s]=rail}
  }
  const fx=engine(matchId,{document:doc,level:options.level||'off',effects:options.effects,targets});
  const scores={p1:Number(options.initialScores?.p1??start),p2:Number(options.initialScores?.p2??start)};
  let destroyed=false;
  function syncSnapshot(next={},opts={}){
    if(destroyed)return;if(opts.resetEffects)fx.reset();
    for(const s of ['p1','p2'])if(scoreValid(Number(next[s])))scores[s]=Number(next[s]);
    for(const s of ['p1','p2'])if(railNodes[s])paintRail(railNodes[s],scores[s],start,false);
  }
  function railVisibility(){for(const rail of Object.values(railNodes))rail.hidden=!fx.isEnabled('led_score_rail')}
  function setLevel(next){fx.setLevel(next);railVisibility();syncSnapshot(scores)}
  function setEffects(next){fx.setEffects(next);railVisibility();syncSnapshot(scores)}
  function confirmed(x){
    if(destroyed||x?.confirmed!==true||!x.eventId||!['p1','p2'].includes(x.playerSlot))return 0;
    const prev=Number(x.previousScore),newScore=Number(x.newScore),points=Number(x.scored);
    if(prev!==scores[x.playerSlot])return 0;
    let count=0;
    if(scoreValid(prev)&&scoreValid(newScore)&&Number.isInteger(points)&&points>0&&points<=180&&
      !x.bust&&prev-newScore===points){
      count+=fx.emit({id:'score:'+x.eventId,type:'score_applied',matchId,playerSlot:x.playerSlot,
        previousScore:prev,newScore,scored:points,startScore:start,checkout:x.checkout===true});
      scores[x.playerSlot]=newScore;
    }
    if(['p1','p2'].includes(x.nextTurnSlot)&&['p1','p2'].includes(x.previousTurnSlot)&&
      x.previousTurnSlot!==x.nextTurnSlot&&!x.legEnded&&!x.matchEnded){
      count+=fx.emit({id:'turn:'+x.eventId,type:'turn_changed',matchId,
        previousSlot:x.previousTurnSlot,nextSlot:x.nextTurnSlot});
    }
    return count;
  }
  function acceptLocalTransition(before,after,action='submit'){
    if(destroyed||!['submit','bot_visit'].includes(action)||before?.status!=='playing'||!after)return 0;
    if(after.visits?.length!==before.visits?.length+1)return 0;
    const visit=after.visits.at(-1),idx=before.visits.length;
    if(!visit||visit.player!==before.turn||visit.leg!==before.leg||
       Number(visit.set||1)!==Number(before.currentSet||1))return 0;
    return confirmed({confirmed:true,eventId:'local:'+matchId+':'+idx+':'+(visit.at||''),
      playerSlot:visit.player===0?'p1':'p2',previousScore:Number(before.scores?.[visit.player]),
      newScore:Number(visit.remaining),scored:Number(visit.score),checkout:visit.checkout===true,
      bust:visit.bust===true,previousTurnSlot:visit.player===0?'p1':'p2',
      nextTurnSlot:after.turn===0?'p1':'p2',legEnded:after.status!=='playing',
      matchEnded:after.status==='finished'});
  }
  function destroy(){if(destroyed)return;destroyed=true;fx.destroy();for(const s of ['p1','p2']){railNodes[s]?.remove();const card=doc.querySelector(typeof slots[s]?.card==='string'?slots[s].card:'#__no_fx_card__');card?.classList.remove('da-fx-rail-host')}}
  syncSnapshot(scores);setLevel(fx.getLevel());
  return {acceptLocalTransition,acceptConfirmedOnlineVisit:confirmed,syncSnapshot,setLevel,setEffects,
    getEffects:fx.getEffects,isEnabled:fx.isEnabled,getLevel:fx.getLevel,destroy,emit:fx.emit};
}
function createCup(options={}){
  const id=String(options.tournamentId||'');if(!id)throw Error('FX tournamentId required');
  const fx=engine(id,{document:options.document,level:options.level||'off',effects:options.effects});
  let known=null,disposed=false;const pending=new Map();
  const asMap=list=>new Map((list||[]).filter(m=>m?.id&&m.stage==='cup').map(m=>[String(m.id),m]));
  const human=m=>!!m.winner_id&&!!m.player1_id&&!!m.player2_id&&
    (m.winner_id===m.player1_id||m.winner_id===m.player2_id)&&!m.is_wo&&!m.is_ai_rival&&!m.ai_rival_wo;
  function afterBracketRender(matches){
    if(disposed)return 0;const now=asMap(matches);
    if(known===null){known=now;return 0}
    let count=0;
    for(const [key,m] of now){
      const old=known.get(key);
      if(!old||old.status==='finished'||m.status!=='finished'||!human(m))continue;
      const loser=m.winner_id===m.player1_id?m.player2_id:m.player1_id;
      count+=fx.emit({id:'elimination:'+key+':'+m.winner_id,matchId:id,type:'cup_result_confirmed',
        cupMatchId:key,winnerId:String(m.winner_id),loserId:String(loser)});
      pending.set(key,{match:m,winnerId:String(m.winner_id)});
    }
    for(const [key,item] of pending){
      const source=now.get(key)||item.match;
      const round=Number(source.round_no)+1,matchNo=Math.ceil(Number(source.match_no)/2);
      const next=[...now.values()].find(m=>Number(m.round_no)===round&&Number(m.match_no)===matchNo);
      if(!next){pending.delete(key);continue}
      if(![next.player1_id,next.player2_id].includes(item.winnerId))continue;
      count+=fx.emit({id:'advance:'+key+':'+item.winnerId,matchId:id,type:'cup_bracket_advanced',
        cupMatchId:key,nextMatchId:String(next.id),winnerId:item.winnerId});
      pending.delete(key);
    }
    known=now;return count;
  }
  function destroy(){if(disposed)return;disposed=true;pending.clear();known=null;fx.destroy()}
  return {afterBracketRender,setLevel:fx.setLevel,setEffects:fx.setEffects,getEffects:fx.getEffects,
    isEnabled:fx.isEnabled,getLevel:fx.getLevel,destroy,emit:fx.emit};
}
root.DartArenaFXLive=Object.freeze({LEVELS,EFFECT_MIN_LEVEL,DEFAULT_EFFECTS,readLevel,storeLevel,connectSelect,createX01,createCup,engine});
})(window);
