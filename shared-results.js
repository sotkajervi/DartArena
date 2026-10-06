(()=>{
  if(window.__dartArenaSharedResults)return;
  window.__dartArenaSharedResults=true;

  const matchId=new URLSearchParams(location.search).get('id');
  const resultDb=window.supabase?window.supabase.createClient(
    'https://jqpxlbhwvskhjbqrbidk.supabase.co',
    'sb_publishable_aqx1Q36C3cznImJ5KMDk3w_I1uUTHQK'
  ):null;
  const providers=window.DartArenaResultProviders=window.DartArenaResultProviders||{};
  let shownFor=null,ch=null;

  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const num=v=>Number(v||0);
  const pct=(a,b)=>b?`${Math.round((a/b)*100)} %`:'0 %';
  const sortTime=(a,b)=>new Date(a.created_at||0)-new Date(b.created_at||0);

  function providerKey(m){return String(m?.game_config?.chicago??'false').toLowerCase()==='true'?'chicago':m?.game_variant||'x01'}
  function gameLabel(m){
    if(providerKey(m)==='chicago')return'Chicago Style';
    if(m?.game_variant==='cricket')return'Cricket';
    if(m?.game_variant==='sixty_one')return'61';
    if(m?.game_variant==='half_it')return m.game_config?.half_it_mode==='standard'?'Half-It (Standard)':'Half-It (DartCounter)';
    return String(m?.game||'X01');
  }
  function formatLabel(m){
    if(providerKey(m)==='chicago')return'301 DIDO • Cricket • 501 SIDO';
    if(m?.match_mode==='sets'&&providerKey(m)==='x01')return`Best of ${num(m.best_of_sets)||1} sets • Best of ${num(m.legs)||1} legs`;
    return`Best of ${num(m?.legs)||1} legs`;
  }
  function scoreInfo(m){
    if(m?.match_mode==='sets'&&providerKey(m)==='x01')return{a:num(m.player1_sets),b:num(m.player2_sets),label:'SETS'};
    return{a:num(m?.player1_legs),b:num(m?.player2_legs),label:'LEGS'};
  }
  function displayOrder(m){
    if(m?.winner_id===m?.player2_id)return[m.player2_id,m.player1_id];
    return[m?.player1_id,m?.player2_id];
  }
  function orderedScore(m,score){
    const[leftId]=displayOrder(m);
    return leftId===m.player2_id?{left:score.b,right:score.a}:{left:score.a,right:score.b};
  }
  function playerInitial(name){return String(name||'?').trim().slice(0,1).toUpperCase()||'?'}
  function fillStats(rows){const out=[...(rows||[])].slice(0,4);while(out.length<4)out.push({label:'–',value:'–'});return out}
  function cumulativeSummary(items,m){
    const[leftId,rightId]=displayOrder(m);let left=0,right=0;
    return(items||[]).map((item,index)=>{
      if(item.winnerId===leftId)left++;
      else if(item.winnerId===rightId)right++;
      return{label:item.label||`Leg ${index+1}`,score:`${left} – ${right}`,winnerId:item.winnerId||null};
    });
  }
  function hideResult(){document.getElementById('dartArenaResultOverlay')?.remove();document.body.classList.remove('da-result-open')}

  async function namesFor(m){
    const{data}=await resultDb.from('profiles').select('id,username').in('id',[m.player1_id,m.player2_id]);
    return Object.fromEntries((data||[]).map(p=>[p.id,p.username]));
  }

  async function buildX01(m){
    const{data,error}=await resultDb.from('match_throws').select('player_id,set_no,leg_no,visit_no,score,darts_used,is_checkout,created_at').eq('match_id',m.id);
    if(error)throw error;
    const rows=(data||[]).sort(sortTime),out={};
    for(const id of[m.player1_id,m.player2_id])out[id]={score:0,darts:0,first9Score:0,first9Darts:0,high:0,n180:0};
    for(const r of rows){
      const s=out[r.player_id];if(!s)continue;
      const darts=r.is_checkout?Math.max(1,num(r.darts_used)||3):3;
      s.score+=num(r.score);s.darts+=darts;
      if(num(r.visit_no)<=3){s.first9Score+=num(r.score);s.first9Darts+=darts}
      if(r.is_checkout)s.high=Math.max(s.high,num(r.score));
      if(num(r.score)===180)s.n180++;
    }
    const mk=id=>{const s=out[id];return fillStats([
      {label:'3-DART AVG',value:s.darts?(s.score/s.darts*3).toFixed(2):'0.00'},
      {label:'FIRST 9 AVG',value:s.first9Darts?(s.first9Score/s.first9Darts*3).toFixed(2):'0.00'},
      {label:'HØYESTE UT',value:s.high},
      {label:'180',value:s.n180}
    ])};
    const seen=new Set(),wins=[];
    for(const r of rows.filter(x=>x.is_checkout)){
      const key=`${num(r.set_no)||1}:${num(r.leg_no)||1}`;
      if(seen.has(key))continue;seen.add(key);
      wins.push({label:m.match_mode==='sets'?`S${num(r.set_no)||1} • L${num(r.leg_no)||1}`:`Leg ${wins.length+1}`,winnerId:r.player_id});
    }
    return{stats:{[m.player1_id]:mk(m.player1_id),[m.player2_id]:mk(m.player2_id)},summary:cumulativeSummary(wins,m)};
  }

  async function buildCricket(m){
    const{data,error}=await resultDb.from('cricket_visits').select('player_id,leg_no,visit_no,darts,points_scored,created_at').eq('match_id',m.id);
    if(error)throw error;
    const rows=(data||[]).sort(sortTime),out={};
    for(const id of[m.player1_id,m.player2_id])out[id]={visits:0,points:0,pointVisits:0,marks:0};
    const addMarks=(target,row)=>{
      const visit=Array.isArray(row?.darts)?row.darts:[];
      for(const dart of visit)target.marks+=Math.max(0,Math.min(3,num(dart?.mult)));
    };
    for(const r of rows){
      const s=out[r.player_id];if(!s)continue;
      s.visits++;s.points+=num(r.points_scored);if(num(r.points_scored)>0)s.pointVisits++;
      addMarks(s,r);
    }
    const mpr=s=>s.visits?(s.marks/s.visits).toFixed(2):'0.00';
    const mk=id=>{const s=out[id];return fillStats([
      {label:'VISITS',value:s.visits},
      {label:'POENG',value:s.points},
      {label:'MPR',value:mpr(s)},
      {label:'POENGVISITS',value:s.pointVisits}
    ])};
    const byLeg=new Map();
    for(const r of rows){const leg=num(r.leg_no)||1;if(!byLeg.has(leg))byLeg.set(leg,[]);byLeg.get(leg).push(r)}
    const wins=[...byLeg.keys()].sort((a,b)=>a-b).map(leg=>{
      const list=byLeg.get(leg).sort(sortTime);
      const legStats={
        [m.player1_id]:{marks:0,visits:0,points:0},
        [m.player2_id]:{marks:0,visits:0,points:0}
      };
      for(const r of list){
        const s=legStats[r.player_id];
        if(!s)continue;
        s.visits++;
        addMarks(s,r);
        s.points+=num(r.points_scored);
      }
      return{
        label:`Leg ${leg}`,
        winnerId:list.at(-1)?.player_id||null,
        metric:{
          label:'MPR',
          values:{[m.player1_id]:mpr(legStats[m.player1_id]),[m.player2_id]:mpr(legStats[m.player2_id])},
          secondary:{
            label:'POENG',
            values:{[m.player1_id]:legStats[m.player1_id].points,[m.player2_id]:legStats[m.player2_id].points}
          }
        }
      };
    });
    const summary=cumulativeSummary(wins,m).map((row,index)=>({...row,metric:wins[index]?.metric||null}));
    return{stats:{[m.player1_id]:mk(m.player1_id),[m.player2_id]:mk(m.player2_id)},summary};
  }

  async function buildHalfIt(m){
    const{data,error}=await resultDb.from('half_it_visits').select('player_id,leg_no,round_no,success,score_after,created_at').eq('match_id',m.id);
    if(error)throw error;
    const rows=(data||[]).sort(sortTime),out={},byLeg=new Map();
    for(const id of[m.player1_id,m.player2_id])out[id]={ok:0,total:0,bestLeg:0};
    for(const r of rows){
      const s=out[r.player_id];if(!s)continue;s.total++;if(r.success)s.ok++;
      const leg=num(r.leg_no)||1;if(!byLeg.has(leg))byLeg.set(leg,new Map());
      const playerMap=byLeg.get(leg),prev=playerMap.get(r.player_id);
      if(!prev||num(r.round_no)>=num(prev.round_no))playerMap.set(r.player_id,r);
    }
    const wins=[],legNumbers=[...byLeg.keys()].sort((a,b)=>a-b),lastLeg=legNumbers.at(-1);
    for(const leg of legNumbers){
      const pm=byLeg.get(leg),a=pm.get(m.player1_id),b=pm.get(m.player2_id),as=num(a?.score_after),bs=num(b?.score_after);
      out[m.player1_id].bestLeg=Math.max(out[m.player1_id].bestLeg,as);out[m.player2_id].bestLeg=Math.max(out[m.player2_id].bestLeg,bs);
      let winnerId=as>bs?m.player1_id:bs>as?m.player2_id:null;
      if(!winnerId&&leg===lastLeg&&m.status==='finished')winnerId=m.winner_id||null;
      wins.push({label:`Leg ${leg}`,winnerId});
    }
    const mk=id=>{const s=out[id];return fillStats([
      {label:'TREFFRUNDER',value:s.ok},
      {label:'HALVERINGER',value:s.total-s.ok},
      {label:'SUKSESS',value:pct(s.ok,s.total)},
      {label:'BESTE LEG',value:s.bestLeg}
    ])};
    return{stats:{[m.player1_id]:mk(m.player1_id),[m.player2_id]:mk(m.player2_id)},summary:cumulativeSummary(wins,m)};
  }

  async function buildSixtyOne(m){
    const{data,error}=await resultDb.from('sixty_one_visits').select('player_id,result,target_before,leg_no').eq('match_id',m.id);
    if(error)throw error;
    const rows=data||[],out={};
    for(const id of[m.player1_id,m.player2_id])out[id]={high:0,hit:0,miss:0};
    for(const r of rows){const s=out[r.player_id];if(!s)continue;if(r.result==='hit'){s.hit++;s.high=Math.max(s.high,num(r.target_before))}else if(r.result==='miss')s.miss++}
    const mk=id=>{const s=out[id],total=s.hit+s.miss;return fillStats([
      {label:'HØYESTE UT',value:s.high},
      {label:'TREFF',value:s.hit},
      {label:'BOM',value:s.miss},
      {label:'TREFFPROSENT',value:pct(s.hit,total)}
    ])};
    return{stats:{[m.player1_id]:mk(m.player1_id),[m.player2_id]:mk(m.player2_id)},summary:[]};
  }

  async function buildChicago(m){
    const raw=Array.isArray(m?.game_config?.chicago_results)?m.game_config.chicago_results:[],labels={1:'301 DIDO',2:'Cricket',3:'501 SIDO'};
    const [{data:x01Rows,error:x01Error},{data:cricketRows,error:cricketError}]=await Promise.all([
      resultDb.from('match_throws').select('player_id,leg_no,score,darts_used,is_checkout').eq('match_id',m.id),
      resultDb.from('cricket_visits').select('player_id,leg_no,darts').eq('match_id',m.id)
    ]);
    if(x01Error)throw x01Error;
    if(cricketError)throw cricketError;

    const x01Metric=(stage,id)=>{
      let score=0,darts=0;
      for(const r of x01Rows||[]){
        if(r.player_id!==id||(num(r.leg_no)||1)!==stage)continue;
        score+=num(r.score);
        darts+=r.is_checkout?Math.max(1,num(r.darts_used)||3):3;
      }
      return darts?(score/darts*3).toFixed(2):'0.00';
    };
    const cricketMetric=id=>{
      let marks=0,rounds=0;
      for(const r of cricketRows||[]){
        if(r.player_id!==id||(num(r.leg_no)||1)!==2)continue;
        rounds++;
        const visit=Array.isArray(r.darts)?r.darts:[];
        for(const dart of visit)marks+=Math.max(0,Math.min(3,num(dart?.mult)));
      }
      return rounds?(marks/rounds).toFixed(2):'0.00';
    };
    const metricFor=stage=>stage===2
      ?{label:'MPR',values:{[m.player1_id]:cricketMetric(m.player1_id),[m.player2_id]:cricketMetric(m.player2_id)}}
      :{label:'AVG',values:{[m.player1_id]:x01Metric(stage,m.player1_id),[m.player2_id]:x01Metric(stage,m.player2_id)}};

    const results=raw.map(r=>{
      const stage=num(r?.stage);
      return{stage,winnerId:r?.winner_id||null,label:labels[stage]||`Game ${stage||'?'}`,metric:metricFor(stage)};
    }).sort((a,b)=>a.stage-b.stage);
    const outcome=(stage,id)=>{const r=results.find(x=>x.stage===stage);return!r?'IKKE SPILT':r.winnerId===id?'VANT':'TAP'};
    const mk=id=>fillStats([
      {label:'GAMES',value:id===m.player1_id?num(m.player1_legs):num(m.player2_legs)},
      {label:'301 DIDO',value:outcome(1,id)},
      {label:'CRICKET',value:outcome(2,id)},
      {label:'501 SIDO',value:outcome(3,id)}
    ]);
    const summary=cumulativeSummary(results,m).map((row,index)=>({...row,metric:results[index]?.metric||null}));
    return{
      label:'Chicago Style',
      format:'301 DIDO • Cricket • 501 SIDO',
      stats:{[m.player1_id]:mk(m.player1_id),[m.player2_id]:mk(m.player2_id)},
      summary
    };
  }

  async function buildGeneric(m){
    const mk=(id,score,legs,sets)=>fillStats([
      {label:'SLUTTSCORE',value:num(score)},
      {label:'LEGS',value:num(legs)},
      {label:'SETS',value:num(sets)},
      {label:'STATUS',value:id===m.winner_id?'VANT':'FERDIG'}
    ]);
    return{stats:{
      [m.player1_id]:mk(m.player1_id,m.player1_score,m.player1_legs,m.player1_sets),
      [m.player2_id]:mk(m.player2_id,m.player2_score,m.player2_legs,m.player2_sets)
    },summary:[]};
  }

  providers.chicago=providers.chicago||buildChicago;
  providers.x01=providers.x01||buildX01;
  providers.cricket=providers.cricket||buildCricket;
  providers.half_it=providers.half_it||buildHalfIt;
  providers.sixty_one=providers.sixty_one||buildSixtyOne;
  providers.default=providers.default||buildGeneric;

  function statRowsHtml(rows){return fillStats(rows).map(s=>`<div class="da-result-statrow"><span>${esc(s.label)}</span><b>${esc(s.value)}</b></div>`).join('')}
  function playerCardHtml(id,name,m,stats){
    const winner=id===m.winner_id;
    return`<article class="da-result-statcard ${winner?'winner':''}" data-player-id="${esc(id)}"><div class="da-result-playerhead"><div class="da-result-playericon">${winner?'♛':esc(playerInitial(name))}</div><div style="min-width:0"><div class="da-result-stat-name">${esc(name)}</div>${winner?'<span class="da-result-winner-badge">VINNER</span>':''}</div></div><div class="da-result-statlist">${statRowsHtml(stats)}</div></article>`;
  }
  function summaryHtml(summary,names,m){
    if(!summary?.length)return'';
    const all=summary,visible=all.length>5?all.slice(-5):all,[leftId,rightId]=displayOrder(m);
    const rows=visible.map(row=>{
      const name=row.winnerId?names[row.winnerId]||'Vinner':'Uavgjort';
      const metric=row.metric?.label?(
        `<div class="da-result-legmetric"><span>${esc(row.metric.label)}</span><b>${esc(names[leftId]||'Spiller 1')}: ${esc(row.metric.values?.[leftId]??'–')}</b><i>•</i><b>${esc(names[rightId]||'Spiller 2')}: ${esc(row.metric.values?.[rightId]??'–')}</b>${row.metric.secondary?.label?`<i>•</i><span>${esc(row.metric.secondary.label)}</span><b>${esc(names[leftId]||'Spiller 1')}: ${esc(row.metric.secondary.values?.[leftId]??'–')}</b><i>•</i><b>${esc(names[rightId]||'Spiller 2')}: ${esc(row.metric.secondary.values?.[rightId]??'–')}</b>`:''}</div>`
      ):'';
      return`<div class="da-result-legrow"><span>${esc(row.label)}</span><span class="da-result-legscore">${esc(row.score||'–')}</span><span class="da-result-legwinner ${row.winnerId===m.winner_id?'is-winner':''}">${esc(name)}</span>${metric}</div>`;
    }).join('');
    const more=all.length>visible.length?`<div class="da-result-more">+ ${all.length-visible.length} tidligere legs</div>`:'';
    return`<section class="da-result-legs"><div class="da-result-legs-title">LEG-OVERSIKT</div>${rows}${more}</section>`;
  }
  function mountOverlay(html){
    hideResult();document.body.classList.add('da-result-open');
    const overlay=document.createElement('div');overlay.id='dartArenaResultOverlay';overlay.className='da-result-overlay';overlay.innerHTML=html;document.body.appendChild(overlay);return overlay;
  }
  function showSolo(options={}){
    const title=options.title||'Økt ferdig',subtitle=options.subtitle||'',score=options.score??'–',name=options.playerName||'Resultat',stats=fillStats(options.stats||[]),actions=options.actions?.length?options.actions:[{label:'Til lobby',primary:true,onClick:()=>location.href='./'}];
    const overlay=mountOverlay(`<section class="da-result-card" role="dialog" aria-modal="true" aria-label="Resultat"><div class="da-result-kicker">${esc(options.kicker||'ØKT FERDIG')}</div><h1 class="da-result-title"><span class="da-result-winner-name">${esc(title)}</span></h1>${subtitle?`<div class="da-result-sub">${esc(subtitle)}</div>`:''}<div class="da-result-scorebox da-result-solo-score">${esc(score)}</div><div class="da-result-stats solo"><article class="da-result-statcard solo"><div class="da-result-playerhead"><div class="da-result-playericon">★</div><div class="da-result-stat-name">${esc(name)}</div></div><div class="da-result-statlist">${statRowsHtml(stats)}</div></article></div><div id="daSoloActions" class="da-result-actions"></div><p class="da-result-note">DartArena • treningsresultat</p></section>`);
    const host=overlay.querySelector('#daSoloActions');
    actions.slice(0,3).forEach((action,index)=>{const b=document.createElement('button');b.type='button';b.className=action.primary||index===0?'primary':'outline';b.textContent=action.label||'Fortsett';b.onclick=()=>{hideResult();action.onClick?.()};host.appendChild(b)});
  }

  window.DartArenaResults=Object.assign(window.DartArenaResults||{}, {
    registerProvider(key,provider){if(key&&typeof provider==='function')providers[key]=provider},
    getProvider(key){return providers[key]||providers.default},
    showSolo,
    hide:hideResult,
    refresh:()=>refresh()
  });

  async function showResult(m){
    if(!m||m.status!=='finished'||shownFor===m.id)return;
    shownFor=m.id;
    const names=await namesFor(m),provider=window.DartArenaResults.getProvider(providerKey(m));
    let payload;try{payload=await provider(m,resultDb)}catch(e){console.warn('Result provider failed',providerKey(m),e);payload=await buildGeneric(m)}
    const stats=payload?.stats||{},summary=payload?.summary||[],winnerName=m.winner_id?names[m.winner_id]||'Vinner':'Kampen';
    const score=scoreInfo(m),ordered=orderedScore(m,score),label=payload?.label||gameLabel(m),format=payload?.format||formatLabel(m);
    const[leftId,rightId]=displayOrder(m),leftName=names[leftId]||'Spiller 1',rightName=names[rightId]||'Spiller 2';
    const overlay=mountOverlay(`<section class="da-result-card" role="dialog" aria-modal="true" aria-label="Kampresultat"><div class="da-result-kicker">KAMP FERDIG</div><h1 class="da-result-title"><span class="da-result-winner-name">${esc(winnerName)}</span>${m.winner_id?' vant!':' er ferdig'}</h1><div class="da-result-sub">${esc(label)} • ${esc(format)}</div><div class="da-result-scorebox">${ordered.left}<span>–</span>${ordered.right}</div><div class="da-result-stats">${playerCardHtml(leftId,leftName,m,stats[leftId])}${playerCardHtml(rightId,rightName,m,stats[rightId])}</div>${summaryHtml(summary,names,m)}<div class="da-result-actions"><button id="daResultLobby" class="primary" type="button">Til lobby</button><button id="daResultClose" class="outline" type="button">Lukk kampfane</button></div><p class="da-result-note">DartArena • resultatet er lagret i kamphistorikken</p></section>`);
    overlay.querySelector('#daResultLobby').onclick=()=>location.href='./';
    overlay.querySelector('#daResultClose').onclick=()=>{window.close();setTimeout(()=>{if(!window.closed)location.href='./'},120)};
  }

  async function refresh(){if(!matchId||!resultDb)return;const{data,error}=await resultDb.from('matches').select('*').eq('id',matchId).single();if(!error&&data?.status==='finished')await showResult(data)}
  async function boot(){
    if(!matchId||!resultDb)return;
    const{data:{session}}=await resultDb.auth.getSession();if(!session)return;
    await refresh();
    ch=resultDb.channel('shared-result-'+matchId).on('postgres_changes',{event:'UPDATE',schema:'public',table:'matches',filter:`id=eq.${matchId}`},p=>{if(p.new?.status==='finished')showResult(p.new)}).subscribe();
  }

  window.addEventListener('pagehide',()=>{if(ch&&resultDb)resultDb.removeChannel(ch)});
  boot().catch(e=>console.warn('Shared result screen failed',e));
})();