/* Convert a corrected round total to a legal scoring representation.
   These darts are not a claim about the actual individual throws. */
function halfCorrectionDarts(round,points,target){
 if(!round||!Number.isInteger(points)||points<0||points>180)return null;
 const miss={n:0,mult:0};
 const attach=d=>d.map((x,i)=>({...x,...(i===0&&round.type==='exact'&&target!==undefined?{exact_target:target}:{})}));
 if(points===0)return attach([miss,miss,miss]);
 const all=[miss];
 for(let n=1;n<=20;n++)for(let mult=1;mult<=3;mult++)all.push({n,mult});
 all.push({n:25,mult:1},{n:25,mult:2});
 const board=[20,1,18,4,13,6,10,15,2,17,3,19,7,16,8,11,14,9,12,5];
 const color=d=>d.n===25?(d.mult===1?'green':'red'):d.mult===1?(board.indexOf(d.n)%2===0?'black':'white'):(board.indexOf(d.n)%2===0?'red':'green');
 const type=round.type,exact41=type==='exact'&&target===undefined&&round.target===41;
 if(type==='exact'&&!exact41&&(!Number.isInteger(target)||(target===121?points<121:points!==target)))return null;
 if(exact41&&points!==41)return null;
 const filter=d=>d.n===0?!(exact41||type==='same'||type==='different'):type==='number'?d.n===round.target:type==='double'?d.mult===2:type==='treble'?d.mult===3:type==='bull'?d.n===25:true;
 const pool=all.filter(filter),byValue=new Map();
 for(const d of pool){const value=d.n*d.mult;if(!byValue.has(value))byValue.set(value,[]);byValue.get(value).push(d)}
 for(const a of pool)for(const b of pool){
   for(const c of byValue.get(points-a.n*a.mult-b.n*b.mult)||[]){
     if(type==='same'||type==='different'){
       const size=new Set([a,b,c].map(color)).size;
       if(size!==(type==='same'?1:3))continue;
     }
     return attach([a,b,c]);
   }
 }
 return null;
}
/* Both online variants, current-leg correction only. Server owns all scoring. */
(()=>{
 if(window.__dartArenaHalfCorrection)return;
 window.__dartArenaHalfCorrection=true;
 const panel=document.createElement('section');panel.id='halfCorrectionHistory';
 panel.innerHTML='<small>KORRIGER EGNE RUNDER</small><div class="half-correction-chips"></div>';
 document.getElementById('halfNextTarget').after(panel);
 const dialog=document.createElement('dialog');dialog.id='halfCorrectionDialog';
 dialog.setAttribute('aria-labelledby','halfCorrectionTitle');
 dialog.innerHTML='<small>HALF-IT</small><h2 id="halfCorrectionTitle">Korriger runde</h2><div id="halfCorrectionFields"></div><p id="halfCorrectionError" role="alert"></p><div class="half-correction-actions"><button id="halfCorrectionCancel" class="outline" type="button">Avbryt</button><button id="halfCorrectionSave" class="primary" type="button">Lagre</button></div>';
 document.body.appendChild(dialog);
 const chips=panel.querySelector('.half-correction-chips'),fields=dialog.querySelector('#halfCorrectionFields'),error=dialog.querySelector('#halfCorrectionError'),save=dialog.querySelector('#halfCorrectionSave'),cancel=dialog.querySelector('#halfCorrectionCancel');
 let editing=null,busy=false,exact=null,scoreInput=null,round=null;
 const leg=()=>Math.max(1,Number(m?.current_leg||1));
 const standard=()=>m?.game_config?.half_it_mode==='standard';
 const eligible=()=>m?.status==='playing'&&profile?visits.filter(v=>v.player_id===profile.id&&Number(v.leg_no||1)===leg()).sort((a,b)=>a.round_no-b.round_no).slice(-3):[];
 function draw(){
   chips.replaceChildren();const list=eligible();panel.hidden=!list.length;
   for(const v of list){
     const b=document.createElement('button');b.type='button';b.className='outline';
     b.setAttribute('aria-label','Korriger runde '+v.round_no+', score '+v.score_after+(v.success?'':', halvert'));
     const round=document.createElement('span');round.className='half-correction-round';round.textContent='Runde '+v.round_no;
     const score=document.createElement('strong');score.className='half-correction-score';score.textContent=String(v.score_after);
     b.append(round,score);
     if(!v.success){const badge=document.createElement('span');badge.className='half-correction-halved';badge.textContent='½';badge.title='Halvert';badge.setAttribute('aria-hidden','true');b.append(badge)}
     b.onclick=()=>open(v);chips.append(b);
   }
 }
 function field(label,options,value){
   const row=document.createElement('label'),name=document.createElement('span'),select=document.createElement('select');
   name.textContent=label;
   for(const [val,text] of options){const option=document.createElement('option');option.value=val;option.textContent=text;select.append(option)}
   select.value=String(value);row.append(name,select);fields.append(row);return select;
 }
 function open(v){
   if(busy||dialog.open||!eligible().some(x=>x.id===v.id))return;
   editing={...v,darts:JSON.parse(JSON.stringify(v.darts))};error.textContent='';fields.replaceChildren();exact=null;
   round=(standard()?STD_ROUNDS:ROUNDS)[v.round_no-1];
   document.getElementById('halfCorrectionTitle').textContent='Korriger runde '+v.round_no+' · '+round.label;
   if(!standard()&&v.round_no===8){
     const targets=typeof state!=='undefined'&&Array.isArray(state?.exact_options)?state.exact_options:[v.exact_target];
     exact=field('Måltall',targets.map(t=>[String(t),t===121?'121+':String(t)]),v.exact_target);
   }
   const label=document.createElement('label');label.className='half-correction-score-field';
   const caption=document.createElement('span');caption.textContent='Poeng i runden';
   scoreInput=document.createElement('input');scoreInput.type='text';scoreInput.inputMode='numeric';scoreInput.pattern='[0-9]{1,3}';scoreInput.maxLength=3;scoreInput.value=String(v.success?v.round_points:0);scoreInput.autocomplete='off';
   label.append(caption,scoreInput);fields.append(label);
   const hint=document.createElement('small');hint.className='half-correction-score-hint';hint.textContent='0 = halvering · Oppgi kun poengene fra runden.';fields.append(hint);
   dialog.showModal();scoreInput.focus();scoreInput.select();
 }
 cancel.onclick=()=>{if(!busy)dialog.close()};
 dialog.addEventListener('cancel',e=>{if(busy)e.preventDefault()});
 // Keep game shortcuts out of the modal; native input editing is preserved.
 window.addEventListener('keydown',e=>{
   if(!dialog.open||e.key==='Escape')return;
   if(e.key==='Enter'&&e.target===scoreInput){e.preventDefault();if(!busy)save.click()}
   e.stopImmediatePropagation();
 },true);
 save.onclick=async()=>{
   if(busy||!editing||!eligible().some(x=>x.id===editing.id)){error.textContent='Runden er ikke lenger tilgjengelig for korrigering.';return}
   const raw=scoreInput.value.trim();
   if(!/^\d{1,3}$/.test(raw)){error.textContent='Skriv inn poeng i runden, eller 0 for halvering.';return}
   const points=Number(raw),target=exact?Number(exact.value):undefined;
   const unchanged=points===(editing.success?Number(editing.round_points):0)&&(!exact||target===Number(editing.exact_target));
   const darts=unchanged?editing.darts:halfCorrectionDarts(round,points,target);
   if(!darts){error.textContent='Denne scoren er ikke mulig på dette målet med tre piler.';return}
   busy=true;save.disabled=cancel.disabled=true;error.textContent='';
   try{
     const {error:rpcError}=await db.rpc('correct_half_it_visit',{p_visit_id:editing.id,p_expected_darts:editing.darts,p_darts:darts});
     if(rpcError)throw rpcError;
     dialog.close();await refreshGame();document.getElementById('matchMessage').textContent='Runde korrigert.';
   }catch(e){error.textContent='Kunne ikke korrigere: '+(e?.message||'Ukjent feil')}
   finally{busy=false;save.disabled=cancel.disabled=false;draw()}
 };
 const base=render;
 render=function(...args){const result=base.apply(this,args);draw();return result};
 draw();
})();
