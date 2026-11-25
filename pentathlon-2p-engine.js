/* DartArena Pentathlon: standalone NDF-style local two-player scoring. */
(function(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.DartArenaPentathlon = api;
})(typeof window === 'object' ? window : null, function() {
  'use strict';

  const STAGES = Object.freeze([
    { id:'501a', kind:'x01', start:501, label:'501 · Leg 1', caption:'Dobbel ut · Tons og utsjekkbonus' },
    { id:'501b', kind:'x01', start:501, label:'501 · Leg 2', caption:'Dobbel ut · Nytt leg' },
    { id:'1001', kind:'x01', start:1001, label:'1001', caption:'Dobbel ut · Tons teller' },
    { id:'2001', kind:'x01', start:2001, label:'2001', caption:'Dobbel ut · Tons teller' },
    { id:'shanghai', kind:'shanghai', label:'Shanghai', caption:'1–9 · Tre piler per tall · Shanghai-bonus' },
    { id:'clock', kind:'clock', label:'Klokka rundt på dobbel', caption:'D1 til D20 · Maks 42 piler hver' },
    { id:'half', kind:'half', label:'Half-It · Pentathlon', caption:'20 · 16 · D7 · 14 · T10 · 17 · Bull 50' }
  ]);
  const HALF = Object.freeze([
    { n:20, m:0, label:'20' }, { n:16, m:0, label:'16' }, { n:7, m:2, label:'D7' },
    { n:14, m:0, label:'14' }, { n:10, m:3, label:'T10' }, { n:17, m:0, label:'17' },
    { n:25, m:2, label:'BULL 50' }
  ]);
  const IMPOSSIBLE = new Set([163,166,169,172,173,175,176,178,179]);
  const singles = Array.from({length:20},(_,i)=>i+1);
  const doubles = singles.map(n=>n*2).concat(50);
  const singlesScores = [0,...new Set([...singles,...doubles,...singles.map(n=>n*3),25,50])];
  const checkouts = [new Set(),new Set(),new Set(),new Set()];
  for(const d of doubles) {
    checkouts[1].add(d);
    for(const x of singlesScores) {
      checkouts[2].add(d+x);
      for(const y of singlesScores) checkouts[3].add(d+x+y);
    }
  }
  const clone = x => JSON.parse(JSON.stringify(x));
  function need(condition, message) { if(!condition) throw Error(message); }
  function isScore(score) { return Number.isInteger(score) && score>=0 && score<=180 && !IMPOSSIBLE.has(score); }
  function isCheckout(score,darts) {
    return Number.isInteger(score)&&Number.isInteger(darts)&&darts>=1&&darts<=3&&checkouts[darts].has(score);
  }
  function isDart(d) {
    return !!d && Number.isInteger(d.n) && Number.isInteger(d.m) &&
      ((d.n===0&&d.m===0)||(d.n===25&&[1,2].includes(d.m))||(d.n>=1&&d.n<=20&&[1,2,3].includes(d.m)));
  }
  function labelDart(d) {
    if (d.n===0) return 'BOM';
    if (d.n===25) return d.m===2?'BULL 50':'BULL 25';
    return (d.m===1?'S':d.m===2?'D':'T')+d.n;
  }
  function pointsForVisit(score) {
    if(score>=160) return 3;
    if(score>=131) return 2;
    if(score>=95) return 1;
    return 0;
  }
  function finishBonus(darts) {
    if(darts===9) return 10;
    if(darts>=10 && darts<=12) return 4;
    if(darts>=13 && darts<=15) return 3;
    if(darts>=16 && darts<=18) return 2;
    if(darts>=19 && darts<=21) return 1;
    return 0;
  }
  function stageStart(index,starter) {
    const stage=STAGES[index];
    return {
      kind:stage.kind, start:stage.start||null, turn:starter, starter:starter,
      remaining:stage.start?[stage.start,stage.start]:[0,0],
      used:[0,0], pent:[0,0], visitCounts:[{n95:0,n131:0,n160:0,tons:0},{n95:0,n131:0,n160:0,tons:0}],
      entries:[], pending:[], done:[false,false], win:null, clockTarget:[1,1], halfScores:[0,0], halfRoundScore:0
    };
  }
  function snapshot(state) {
    const s=clone(state);
    delete s.undo;
    return s;
  }
  function remember(before, after) {
    after.undo=(before.undo||[]).slice(-79).concat([snapshot(before)]);
    return after;
  }
  function create(config) {
    const p=[String(config?.name1||'').trim().slice(0,32),String(config?.name2||'').trim().slice(0,32)];
    const starter=Number(config?.starter);
    need(p[0] && p[1],'Skriv navn på begge spillere.');
    need(starter===0||starter===1,'Velg hvem som starter.');
    return {
      version:1,players:p,firstStarter:starter,createdAt:Date.now(),stageIndex:0,
      status:'playing',total:[0,0],summaries:[],undo:[],current:stageStart(0,starter)
    };
  }
  function currentTarget(state) {
    if(!state || state.status!=='playing') return null;
    const c=state.current,p=c.turn;
    if(c.kind==='x01') return {label:'REST '+c.remaining[p],type:'x01',number:null};
    if(c.kind==='shanghai') { const n=Math.floor(c.used[p]/3)+1;return{label:'TALL '+n,type:'number',number:n}; }
    if(c.kind==='clock') { const n=c.clockTarget[p];return{label:'D'+n,type:'double',number:n}; }
    if(c.kind==='half') {
      const item=HALF[Math.min(6,Math.floor(c.used[p]/3))];
      return {label:item.label,type:item.m===0?'number':item.m===2?'double':'triple',number:item.n,mult:item.m};
    }
    return null;
  }
  function completeStage(s) {
    const c=s.current;
    need(s.status==='playing','Øvelsen er allerede avsluttet.');
    const result={
      id:STAGES[s.stageIndex].id,label:STAGES[s.stageIndex].label,kind:c.kind,
      pent:[...c.pent],after:[s.total[0]+c.pent[0],s.total[1]+c.pent[1]],
      remaining:[...c.remaining],used:[...c.used],winner:c.win,halfScores:[...c.halfScores],
      counts:clone(c.visitCounts),entries:clone(c.entries)
    };
    s.summaries.push(result);
    s.total=[...result.after];
    s.status='review';
  }
  function submitX01(state, payload) {
    need(state?.status==='playing'&&state.current.kind==='x01','Ikke i et aktivt X01-leg.');
    const value=Number(payload?.score), raw=String(payload?.score??'').trim();
    need(raw!==''&&isScore(value),'Ugyldig score. Skriv en mulig sum fra 0 til 180.');
    const next=snapshot(state),c=next.current,p=c.turn,remaining=c.remaining[p];
    const automaticBust=value>remaining||remaining-value===1;
    const bust=payload?.bust===true||automaticBust;
    const checkout=value===remaining&&!bust;
    if(checkout) {
      need(payload?.doubleConfirmed===true,'Bekreft dobbel-ut eller bull før leg avsluttes.');
      need(isCheckout(value,Number(payload?.darts)),'Ugyldig utsjekk for antall piler.');
    }
    const credited=bust?0:value;
    const used=checkout?Number(payload.darts):3;
    const points=pointsForVisit(credited);
    c.remaining[p]-=credited;
    c.used[p]+=used;
    c.pent[p]+=points;
    const counters=c.visitCounts[p];
    if(credited>=95&&credited<=130)counters.n95++;
    if(credited>=131&&credited<=159)counters.n131++;
    if(credited>=160)counters.n160++;
    if(credited>=100)counters.tons++;
    const entry={player:p,type:'visit',score:credited,attempt:value,bust,checkout,darts:used,bonus:points,remaining:c.remaining[p]};
    c.entries.push(entry);
    if(checkout) {
      const speed=finishBonus(c.used[p]);
      c.pent[p]+=2+speed;
      c.win=p;
      entry.bonus+=2+speed;
      entry.legPoints=2;
      entry.speedBonus=speed;
      completeStage(next);
    } else {
      c.turn=1-p;
    }
    return remember(state,next);
  }
  // Correct one of the player's three latest visits in the ACTIVE X01 leg.
  // Rebuild every visit using the original X01 engine so busts, remaining
  // scores, averages and Pentathlon bonus thresholds are recomputed together.
  // Completed legs, checkout visits and other players' visits stay immutable.
  function correctX01Visit(state, visitIndex, newScore, editor) {
    need(state?.status==='playing' && state.current?.kind==='x01',
      'Korrigering er bare tilgjengelig under aktiv X01-øvelse.');
    const entries=state.current.entries;
    const index=Number(visitIndex), score=Number(newScore), me=Number(editor);
    need(Number.isInteger(index)&&index>=0&&index<entries.length,'Kastet finnes ikke.');
    need(me===0||me===1,'Ugyldig spiller.');
    const ownIndices=entries.map((t,i)=>t.type==='visit'&&t.player===me?i:-1).filter(i=>i>=0);
    need(ownIndices.slice(-3).includes(index),'Bare dine tre siste kast kan korrigeres.');
    need(!entries[index].checkout,'Checkout kan ikke korrigeres her.');
    need(isScore(score),'Skriv en poengsum mellom 0 og 180.');
    const original=snapshot(state);
    let next=snapshot(state);
    next.current=stageStart(state.stageIndex,state.current.starter);
    next.status='playing';
    next.undo=[];
    for(let i=0;i<entries.length;i++){
      const old=entries[i];
      need(old.type==='visit'&&next.current.turn===old.player,
        'Korrigeringen ville endret turrekkefølgen.');
      next=submitX01(next,{
        score:i===index?score:old.attempt,
        darts:old.darts,
        doubleConfirmed:!!old.checkout
      });
      const actual=next.current.entries[i];
      need(actual && actual.checkout===old.checkout,
        'Korrigeringen ville endret leggets avslutning.');
      // An earlier visit must never change the leg's already-played turn order.
      if(i<entries.length-1)need(next.status==='playing',
        'Korrigeringen ville avsluttet øvelsen for tidlig.');
    }
    need(next.status==='playing' && next.current.entries.length===entries.length,
      'Korrigeringen ville avsluttet øvelsen.');
    next.undo=[original];
    return next;
  }
  // Reuse the same dart engine; preserve all recorded hits except the chosen dart.
  function correctHalfDart(state, index, key, editor) {
    need(state?.status==='playing'&&state.current.kind==='half','Half-It er ikke aktiv.');
    const entries=state.current.entries, me=Number(editor);
    need(Number.isInteger(index)&&(me===0||me===1)&&Number.isInteger(key)&&key>=0&&key<=3,'Ugyldig korrigering.');
    const own=entries.map((e,i)=>e.player===me&&e.type==='dart'?i:-1).filter(i=>i>=0);
    need(own.slice(-3).includes(index),'Bare dine tre siste piler kan korrigeres.');
    let next=snapshot(state);next.current=stageStart(state.stageIndex,state.current.starter);next.undo=[];
    for(let i=0;i<entries.length;i++){
      const old=entries[i],t=currentTarget(next);
      need(next.current.turn===old.player&&t?.label===old.target,'Turrekkefølgen kan ikke endres.');
      let d;
      if(i===index){
        need(!t.mult||key===0||key===2,'Velg 2 (treff) eller 0 (bom).');
        d=key?{n:t.number,m:t.mult||key}:{n:0,m:0};
      }else if(old.hit==='BOM')d={n:0,m:0};
      else if(old.hit==='BULL 50')d={n:25,m:2};
      else if(old.hit==='BULL 25')d={n:25,m:1};
      else d={n:Number(old.hit.slice(1)),m:({S:1,D:2,T:3})[old.hit[0]]};
      next=submitDart(next,d);
      need(next.status==='playing','Øvelsen er avsluttet.');
    }
    need(next.current.turn===state.current.turn&&next.current.done.every((v,i)=>v===state.current.done[i]),'Turrekkefølgen kan ikke endres.');
    next.undo=[snapshot(state)];return next;
  }
  function hitHalf(target, dart) {
    if(target.m===0)return dart.n===target.n ? {value:dart.n*dart.m,pent:dart.m} : {value:0,pent:0};
    if(target.m===2 && target.n===25)return dart.n===25&&dart.m===2 ? {value:50,pent:2} : {value:0,pent:0};
    return dart.n===target.n&&dart.m===target.m ? {value:dart.n*dart.m,pent:dart.m} : {value:0,pent:0};
  }
  function submitDart(state, dart) {
    need(state?.status==='playing'&&state.current.kind!=='x01','Ikke i et aktivt spesialspill.');
    need(isDart(dart),'Ugyldig pil. Velg single, double, triple, bull eller bom.');
    const next=snapshot(state),c=next.current,p=c.turn,kind=c.kind;
    need(!c.done[p],'Denne spilleren er allerede ferdig.');
    const before=currentTarget(state);
    const entry={player:p,type:'dart',hit:labelDart(dart),target:before.label,bonus:0,dart:c.used[p]+1};
    c.used[p]++;
    c.pending.push({n:dart.n,m:dart.m});
    if(kind==='shanghai') {
      const valid=dart.n===before.number;
      const points=valid?dart.m:0;
      c.pent[p]+=points;
      entry.bonus+=points;
      if(c.pending.length===3) {
        const mults=c.pending.filter(d=>d.n===before.number).map(d=>d.m);
        if([1,2,3].every(m=>mults.includes(m))) {
          c.pent[p]+=6;entry.bonus+=6;entry.shanghai=true;
        }
      }
      c.done[p]=c.used[p]===27;
    } else if(kind==='clock') {
      if(dart.n===c.clockTarget[p]&&dart.m===2) {
        c.pent[p]+=2;entry.bonus+=2;c.clockTarget[p]++;
        if(c.clockTarget[p]===21) {
          const extra=42-c.used[p];
          c.pent[p]+=extra;entry.bonus+=extra;entry.finishBonus=extra;c.done[p]=true;
        }
      }
      if(c.used[p]>=42)c.done[p]=true;
    } else if(kind==='half') {
      const target=HALF[Math.floor((c.used[p]-1)/3)];
      const hit=hitHalf(target,dart);
      c.halfRoundScore+=hit.value;
      c.pent[p]+=hit.pent;
      entry.bonus+=hit.pent;
      entry.scoreValue=hit.value;
      if(c.pending.length===3) {
        const total=c.halfRoundScore;
        c.halfScores[p]=total===0?Math.ceil(c.halfScores[p]/2):c.halfScores[p]+total;
        entry.roundScore=total;
        entry.halfAfter=c.halfScores[p];
        entry.halved=total===0;
      }
      c.done[p]=c.used[p]===21;
    }
    c.entries.push(entry);
    if(c.done[0]&&c.done[1]) {
      c.pending=[];c.halfRoundScore=0;completeStage(next);
    } else if(c.pending.length===3||c.done[p]) {
      c.pending=[];c.halfRoundScore=0;
      c.turn=c.done[1-p]?p:1-p;
    }
    return remember(state,next);
  }
  // Rebuild a Shanghai stage from its individual dart entries. This keeps
  // the Shanghai 1+2+3 bonus consistent when an earlier dart is corrected.
  function correctShanghaiDart(state, entryIndex, multiplier, editor) {
    need(state?.status==='playing'&&state.current?.kind==='shanghai',
      'Bare kast i aktiv Shanghai-øvelse kan korrigeres.');
    const entries=state.current.entries, index=Number(entryIndex),m=Number(multiplier),me=Number(editor);
    need(Number.isInteger(index)&&index>=0&&index<entries.length,'Kastet finnes ikke.');
    need((me===0||me===1)&&Number.isInteger(m)&&m>=0&&m<=3,'Ugyldig korrigering.');
    const own=entries.map((e,i)=>e.player===me&&e.type==='dart'?i:-1).filter(i=>i>=0);
    need(own.slice(-3).includes(index),'Bare dine tre siste piler kan korrigeres.');
    let next=snapshot(state);
    next.current=stageStart(state.stageIndex,state.current.starter);
    next.status='playing';next.undo=[];
    for(let i=0;i<entries.length;i++){
      const old=entries[i];
      need(old.type==='dart'&&old.player===next.current.turn,'Uventet turrekkefølge.');
      const expected=Number(String(old.target||'').replace(/^TALL /,''));
      const target=currentTarget(next);
      need(expected===target.number,'Uventet Shanghai-mål.');
      const hit=i===index?(m?{n:target.number,m}:{n:0,m:0}):
        old.hit==='BOM'?{n:0,m:0}:
        {n:Number(String(old.hit).slice(1)),m:({S:1,D:2,T:3})[String(old.hit)[0]]};
      need(isDart(hit),'Ugyldig tidligere registrering.');
      next=submitDart(next,hit);
      need(next.current.entries[i]?.player===old.player,'Turrekkefølgen kan ikke endres.');
    }
    need(next.status==='playing'&&next.current.entries.length===entries.length,
      'Øvelsen kan ikke avsluttes ved korrigering.');
    next.undo=[snapshot(state)];
    return next;
  }
  // Clock correction replays all original dart hits through the same
  // scoring engine, preserving each player's actual throw history. A corrected
  // hit can change the target and points of following darts.
  function correctClockDart(state, entryIndex, doubleHit, editor){
    need(state?.status==='playing'&&state.current?.kind==='clock',
      'Korrigering er bare tilgjengelig i aktiv Klokka rundt.');
    const entries=state.current.entries,index=Number(entryIndex),m=Number(doubleHit),me=Number(editor);
    need(Number.isInteger(index)&&index>=0&&index<entries.length,'Kastet finnes ikke.');
    need((me===0||me===1)&&(m===0||m===2),'Velg 0 (BOM) eller 2 (dobbel).');
    const own=entries.map((e,i)=>e.type==='dart'&&e.player===me?i:-1).filter(i=>i>=0);
    need(own.slice(-3).includes(index),'Bare dine tre siste piler kan korrigeres.');
    const target=Number(String(entries[index].target||'').replace(/^D/,''));
    need(Number.isInteger(target)&&target>=1&&target<=20,'Ugyldig klokkekast.');
    let next=snapshot(state);
    next.current=stageStart(state.stageIndex,state.current.starter);
    next.status='playing';next.undo=[];
    for(let i=0;i<entries.length;i++){
      const old=entries[i];
      need(old.type==='dart'&&old.player===next.current.turn,
        'Korrigeringen endrer turrekkefølgen.');
      const value=i===index?(m?{n:target,m:2}:{n:0,m:0}):
        old.hit==='BOM'?{n:0,m:0}:
        /^D(?:[1-9]|1[0-9]|20)$/.test(old.hit)?
          {n:Number(old.hit.slice(1)),m:2}:null;
      need(isDart(value),'Ugyldig tidligere klokkekast.');
      next=submitDart(next,value);
      need(next.current.entries[i]?.player===old.player,
        'Korrigeringen endrer turrekkefølgen.');
      if(i<entries.length-1)need(next.status==='playing',
        'Korrigeringen ville avsluttet øvelsen for tidlig.');
    }
    need(next.status==='playing'&&next.current.entries.length===entries.length
      &&next.current.turn===state.current.turn
      &&next.current.done.every((done,i)=>done===state.current.done[i]),
      'Korrigeringen ville endret øvelsens avslutning.');
    next.undo=[snapshot(state)];
    return next;
  }
  // Shanghai quick entry: only successful hits need manual registration.
  // Missing darts are committed as ordinary misses, preserving 3 darts
  // per turn, Shanghai bonuses, the log, undo and stage progression.
  function submitShanghaiTurn(state, darts) {
    need(state?.status==='playing' && state.current?.kind==='shanghai','Ikke i en aktiv Shanghai-øvelse.');
    need(Array.isArray(darts),'Ugyldig Shanghai-tur.');
    const remaining=3-state.current.pending.length;
    need(remaining>=1 && remaining<=3 && darts.length<=remaining && darts.every(isDart),
      'Ugyldig antall piler i Shanghai-turen.');
    let next=state;
    for(const dart of darts)next=submitDart(next,dart);
    for(let i=darts.length;i<remaining;i++)next=submitDart(next,{n:0,m:0});
    return next;
  }
  // Clock quick entry: Enter fills unused darts with ordinary misses.
  // An early D20 finish stops immediately, so no extra darts or bonus
  // deductions are added after the player has completed the clock.
  function submitClockTurn(state, darts) {
    need(state?.status==='playing' && state.current?.kind==='clock','Ikke i en aktiv Klokka rundt-øvelse.');
    need(Array.isArray(darts),'Ugyldig Klokka rundt-tur.');
    const c=state.current,p=c.turn;
    const remaining=Math.min(3-c.pending.length,42-c.used[p]);
    need(!c.done[p] && remaining>=1 && remaining<=3 &&
      darts.length<=remaining && darts.every(isDart),'Ugyldig antall piler i Klokka rundt-turen.');
    let next=state;
    for(const dart of darts) {
      need(next.status==='playing' && next.current.kind==='clock' &&
        !next.current.done[p] && next.current.turn===p,'Klokka er allerede fullført.');
      next=submitDart(next,dart);
    }
    for(let i=darts.length;i<remaining;i++) {
      if(next.status!=='playing'||next.current.kind!=='clock'||
        next.current.done[p]||next.current.turn!==p)break;
      next=submitDart(next,{n:0,m:0});
    }
    return next;
  }
  function nextStage(state) {
    need(state?.status==='review','Fullfør øvelsen før du går videre.');
    const next=snapshot(state),idx=state.stageIndex+1;
    if(idx>=STAGES.length) {
      next.status='finished';next.stageIndex=STAGES.length;
    } else {
      next.stageIndex=idx;next.status='playing';
      next.current=stageStart(idx,(next.firstStarter+idx)%2);
    }
    return remember(state,next);
  }
  function undo(state) {
    need(state?.undo?.length,'Ingen registrering å angre.');
    const records=state.undo.slice();
    const last=records.pop();
    last.undo=records;
    return last;
  }
  function restore(value) {
    if(!value || value.version!==1 || !Array.isArray(value.players)||value.players.length!==2||
       !Array.isArray(value.total)||value.total.length!==2 ||
       !['playing','review','finished'].includes(value.status) ||
       !Number.isInteger(value.stageIndex)||value.stageIndex<0||value.stageIndex>STAGES.length ||
       !Array.isArray(value.summaries)||!value.current) return null;
    return value;
  }
  return Object.freeze({STAGES,HALF,create,restore,currentTarget,submitX01,correctX01Visit,submitDart,correctShanghaiDart,correctClockDart,correctHalfDart,submitShanghaiTurn,submitClockTurn,nextStage,undo,
    isScore,isCheckout,isDart,pointsForVisit,finishBonus,labelDart});
});
