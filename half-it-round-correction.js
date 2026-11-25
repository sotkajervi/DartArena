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
 let editing=null,busy=false,exact=null,selects=[];
 const leg=()=>Math.max(1,Number(m?.current_leg||1));
 const standard=()=>m?.game_config?.half_it_mode==='standard';
 const eligible=()=>m?.status==='playing'&&profile?visits.filter(v=>v.player_id===profile.id&&Number(v.leg_no||1)===leg()).sort((a,b)=>a.round_no-b.round_no).slice(-3):[];
 function draw(){
   chips.replaceChildren();const list=eligible();panel.hidden=!list.length;
   for(const v of list){
     const b=document.createElement('button');b.type='button';b.className='outline';
     b.textContent='R'+v.round_no+' · '+v.score_after+' ✎';
     const detail=document.createElement('span');detail.textContent=v.success?'+'+v.round_points:'Halvert';b.append(detail);
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
   editing={...v,darts:JSON.parse(JSON.stringify(v.darts))};error.textContent='';fields.replaceChildren();exact=null;selects=[];
   const options=[['0:0','BOM']];
   for(let n=1;n<=20;n++)for(let mult=1;mult<=3;mult++)options.push([n+':'+mult,['','S','D','T'][mult]+n]);
   options.push(['25:1','25'],['25:2','50']);
   document.getElementById('halfCorrectionTitle').textContent='Korriger runde '+v.round_no;
   if(!standard()&&v.round_no===8){
     const targets=typeof state!=='undefined'&&Array.isArray(state?.exact_options)?state.exact_options:[v.exact_target];
     exact=field('Måltall',targets.map(t=>[String(t),t===121?'121+':String(t)]),v.exact_target);
   }
   for(let i=0;i<3;i++){const d=v.darts?.[i]||{n:0,mult:0};selects.push(field('Pil '+(i+1),options,d.n+':'+d.mult))}
   dialog.showModal();
 }
 cancel.onclick=()=>{if(!busy)dialog.close()};
 dialog.addEventListener('cancel',e=>{if(busy)e.preventDefault()});
 // Native select keyboard behavior is preserved; game shortcuts never fire in this modal.
 window.addEventListener('keydown',e=>{if(dialog.open&&e.key!=='Escape')e.stopImmediatePropagation()},true);
 save.onclick=async()=>{
   if(busy||!editing||!eligible().some(x=>x.id===editing.id)){error.textContent='Runden er ikke lenger tilgjengelig for korrigering.';return}
   const darts=selects.map(s=>{const [n,mult]=s.value.split(':').map(Number);return {n,mult}});
   if(exact)darts[0].exact_target=Number(exact.value);
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
