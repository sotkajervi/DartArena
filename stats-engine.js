(()=>{
const $=id=>document.getElementById(id),wait=setInterval(()=>{if(!window.supabase||!$('matchView')||!window.DartArenaX01Stats)return;clearInterval(wait);boot()},100);
async function boot(){
 const matchId=new URLSearchParams(location.search).get('id');if(!matchId)return;
 const db=window.supabase.createClient('https://jqpxlbhwvskhjbqrbidk.supabase.co','sb_publishable_aqx1Q36C3cznImJ5KMDk3w_I1uUTHQK');
 const {data:{session}}=await db.auth.getSession();if(!session)return;
 let {data:match}=await db.from('matches').select('*').eq('id',matchId).single();if(!match)return;
 let throws=[];
 const style=document.createElement('style');style.textContent=`
.stats-card{margin-top:10px;width:100%}
.match-page.match-tv-layout #matchView>.stats-card{grid-column:1/-1!important;width:100%!important;margin-top:2px!important;align-self:start}
.match-page.match-tv-layout #matchView>.stats-card .stats-grid{grid-template-columns:minmax(170px,220px) minmax(0,1fr) minmax(0,1fr)}
.stats-title{display:flex;justify-content:space-between;align-items:end;gap:12px;margin-bottom:10px}
.stats-title h3{margin:0;font-size:16px}
.stats-grid{display:grid;grid-template-columns:150px 1fr 1fr;border:1px solid rgba(255,255,255,.08);border-radius:12px;overflow:hidden}
.stats-grid>*{padding:8px 10px;border-bottom:1px solid rgba(255,255,255,.06)}
.stats-grid>*:nth-last-child(-n+3){border-bottom:0}
.stats-grid .label{color:#88a1a5;font-size:12px}
.stats-grid .val{text-align:center;font-weight:900}
.stats-grid .head{color:#23e2d1;font-size:12px;font-weight:900}
.da-result-actions.x01-result-actions{grid-template-columns:repeat(2,minmax(0,1fr))}
.da-result-actions.x01-result-actions #daResultClose{grid-column:1/-1}
body.match-page.da-result-open .video-card .video-name,
body.match-page.da-result-open .video-slot-label{opacity:0!important;visibility:hidden!important}
.da-result-statlist.x01-expanded-statlist{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));column-gap:16px}
.da-result-statlist.x01-expanded-statlist .da-result-statrow{min-width:0;padding:6px 2px}
.da-result-statlist.x01-expanded-statlist .da-result-statrow span{min-width:0;font-size:10px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.da-result-statlist.x01-expanded-statlist .da-result-statrow b{font-size:14px;white-space:nowrap}
.da-result-statcard.da-result-winner-first{order:1}
.da-result-statcard.da-result-runner-up{order:2}
@media(max-width:600px){
 .stats-grid{grid-template-columns:100px 1fr 1fr}.stats-grid>*{padding:7px 5px;font-size:12px}
 .da-result-actions.x01-result-actions{grid-template-columns:1fr}.da-result-actions.x01-result-actions #daResultClose{grid-column:auto}
 .da-result-statlist.x01-expanded-statlist{column-gap:10px}
 .da-result-statlist.x01-expanded-statlist .da-result-statrow span{font-size:9px}
 .da-result-statlist.x01-expanded-statlist .da-result-statrow b{font-size:13px}
}`;document.head.appendChild(style);
 const host=document.querySelector('.match-grid');const live=document.createElement('section');live.className='card stats-card';live.innerHTML='<div class="stats-title"><h3>Live-statistikk</h3><small>HELE KAMPEN</small></div><div id="liveStats"></div>';host?.insertAdjacentElement('afterend',live);
 function names(){return[$('matchName1')?.textContent||'Spiller 1',$('matchName2')?.textContent||'Spiller 2']}
 function statRows(s){return[['3-DART AVG',s.avg.toFixed(2)],['FIRST 9 AVG',s.first9.toFixed(2)],['HØYESTE UT',s.high||'–'],['RASKESTE LEG',s.fast?`${s.fast} piler`:'–'],['100+',s.c100],['140+',s.c140],['170+',s.c170],['180',s.c180]]}
 function grid(){const a=window.DartArenaX01Stats.statsFor(throws,match.player1_id),b=window.DartArenaX01Stats.statsFor(throws,match.player2_id),[n1,n2]=names(),rows=[['3-dart avg',a.avg.toFixed(2),b.avg.toFixed(2)],['First 9 AVG',a.first9.toFixed(2),b.first9.toFixed(2)],['Høyeste checkout',a.high||'–',b.high||'–'],['Raskeste leg',a.fast?`${a.fast} piler`:'–',b.fast?`${b.fast} piler`:'–'],['100+',a.c100,b.c100],['140+',a.c140,b.c140],['170+',a.c170,b.c170],['180',a.c180,b.c180]];return'<div class="stats-grid"><div></div><div class="val head">'+esc(n1)+'</div><div class="val head">'+esc(n2)+'</div>'+rows.map(r=>`<div class="label">${r[0]}</div><div class="val">${r[1]}</div><div class="val">${r[2]}</div>`).join('')+'</div>'}
 function esc(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
 function resultStatHtml(s){return statRows(s).map(([label,value])=>`<div class="da-result-statrow"><span>${esc(label)}</span><b>${esc(value)}</b></div>`).join('')}
 function enhanceResultStats(overlay){
   const cards=[...overlay.querySelectorAll('.da-result-statcard')];
   if(cards.length<2)return;
   cards.slice(0,2).forEach(card=>{
     const pid=card.dataset.playerId;
     if(!pid)return;
     const list=card.querySelector('.da-result-statlist');
     if(!list)return;
     const value=window.DartArenaX01Stats.statsFor(throws,pid);
     list.classList.add('x01-expanded-statlist');
     list.innerHTML=resultStatHtml(value);
   });
 }
 function applyWinnerFirstResult(overlay){
   if(!overlay)return;
   const cards=[...overlay.querySelectorAll('.da-result-stats>.da-result-statcard')];
   if(cards.length<2)return;
   cards.forEach(card=>card.classList.remove('da-result-winner-first','da-result-runner-up','da-result-self-card','da-result-opponent-card'));
   const winnerCard=cards.find(card=>card.dataset.playerId===match.winner_id)||cards.find(card=>card.classList.contains('winner'))||cards[0];
   const otherCard=cards.find(card=>card!==winnerCard);
   winnerCard?.classList.add('da-result-winner-first');
   otherCard?.classList.add('da-result-runner-up');
   overlay.dataset.winnerFirstStats='1';
 }
 function applyResultRoles(attempt=0){
   if(window.DartArenaRoleVisuals?.scan){window.DartArenaRoleVisuals.scan();return}
   if(attempt<30)setTimeout(()=>applyResultRoles(attempt+1),100);
 }
 function enhanceFinalResult(attempt=0){
   if(match.status!=='finished')return;
   document.getElementById('finalStatsOverlay')?.remove();
   const overlay=$('dartArenaResultOverlay'),actions=overlay?.querySelector('.da-result-actions');
   if(!overlay||!actions){if(attempt<50)setTimeout(()=>enhanceFinalResult(attempt+1),100);return}
   enhanceResultStats(overlay);
   applyWinnerFirstResult(overlay);
   overlay.querySelector('#daResultLobby')?.remove();
   if(actions.dataset.x01Enhanced==='1'){applyResultRoles();return}
   actions.dataset.x01Enhanced='1';actions.classList.add('x01-result-actions');
   const screenshot=document.createElement('button');screenshot.type='button';screenshot.className='outline';screenshot.textContent='Skjermbilde';
   screenshot.onclick=()=>{enhanceResultStats(overlay);applyWinnerFirstResult(overlay);applyResultRoles();setTimeout(()=>window.DartArenaResultScreenshot?.open?.(overlay.querySelector('.da-result-card'),{returnFocus:screenshot}),0)};
   const full=document.createElement('button');full.type='button';full.className='outline';full.textContent='Full kampstatistikk';
   full.onclick=()=>window.open(`match-stats.html?id=${encodeURIComponent(matchId)}`,`dartarena-match-stats-${matchId}`);
   actions.prepend(full);actions.prepend(screenshot);applyResultRoles();
 }
 function draw(){const html=grid();if($('liveStats'))$('liveStats').innerHTML=html;if(match.status==='finished')enhanceFinalResult()}
 async function loadThrows(){const {data,error}=await db.from('match_throws').select('*').eq('match_id',matchId).order('created_at',{ascending:true});if(!error)throws=data||[];draw()}
 db.channel('stats-'+matchId).on('postgres_changes',{event:'*',schema:'public',table:'match_throws',filter:`match_id=eq.${matchId}`},()=>loadThrows()).on('postgres_changes',{event:'UPDATE',schema:'public',table:'matches',filter:`id=eq.${matchId}`},p=>{match=p.new;loadThrows()}).subscribe();
 await loadThrows();
}
})();