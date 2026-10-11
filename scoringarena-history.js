/* Local Head-to-Head history browser in ScoringArena. */
(function(){
'use strict';
const H=window.DartArenaH2HHistory;
const $=id=>document.getElementById(id);
if(!H||!$('saH2HHistory'))return;
const list=$('saHistoryList'),count=$('saHistoryCount'),filter=$('saHistoryFilter'),
  more=$('saHistoryMore'),dialog=$('saHistoryDialog'),detail=$('saHistoryDetails');
let showAll=false;
const create=(tag,className,value)=>{
  const element=document.createElement(tag);
  if(className)element.className=className;
  if(value!==undefined)element.textContent=String(value);
  return element;
};
function date(value){
  const stamp=Date.parse(value||'');
  return Number.isFinite(stamp)?new Date(stamp).toLocaleString('nb-NO',{
    dateStyle:'medium',timeStyle:'short'}):'Ukjent dato';
}
function average(n){return Number.isFinite(Number(n))?Number(n).toFixed(2):'–'}
function scores(entry){return entry.mode==='sets'?entry.sets:entry.legs}
function typeLabel(entry){
  return entry.opponent==='adaptive'?'Adaptive AI':entry.opponent==='bot'?'Mot bot':'To spillere';
}
function closeDialog(){
  if(typeof dialog.close==='function'&&dialog.open)dialog.close();
  dialog.hidden=true;
}
function statValue(s,key){
  if(!s)return '–';
  const v=s[key];
  if(key==='avg'||key==='first9')return average(v);
  if(key==='fast')return v?String(v)+' piler':'–';
  if(key==='high')return v||'–';
  return v??'–';
}
function tableOf(rows,heads){
  const table=create('table','sa-history-table');
  const thead=create('thead'),top=create('tr');
  for(const h of heads)top.append(create('th','',h));
  thead.append(top);table.append(thead);
  const tbody=create('tbody');
  for(const row of rows){
    const tr=create('tr');
    row.forEach((value,i)=>tr.append(create(i===0?'th':'td','',value)));
    tbody.append(tr);
  }
  table.append(tbody);return table;
}
function openDetails(entry){
  detail.replaceChildren();
  const score=scores(entry);
  detail.append(create('small','sa-history-detail-kicker','HEAD-TO-HEAD · '+typeLabel(entry)),
    create('h2','',entry.players[entry.winner]+' vant'),
    create('p','sa-history-detail-sub',
      entry.players[0]+' '+score[0]+' – '+score[1]+' '+entry.players[1]));
  detail.append(create('p','muted compact',
    date(entry.finishedAt)+' · '+entry.format+' · '+
      (entry.mode==='sets'?'Best av '+entry.bestOfSets+' sets':'Best av '+entry.bestOf+' legs')+
      (entry.opponent!=='human'?' · Botnivå '+entry.botLevel:'')));
  detail.append(create('h3','','Kampstatistikk'));
  const keys=[
    ['3-dart AVG','avg'],['First 9 AVG','first9'],['Høyeste utsjekk','high'],
    ['Raskeste leg','fast'],['100+','c100'],['140+','c140'],['170+','c170'],
    ['180','c180'],['Antall kast','visits'],['Antall piler','darts']
  ];
  const rows=keys.map(k=>[k[0],statValue(entry.stats?.[0],k[1]),statValue(entry.stats?.[1],k[1])]);
  detail.append(tableOf(rows,['Statistikk',entry.players[0],entry.players[1]]));
  const legWins=entry.visits.filter(v=>v.checkout);
  detail.append(create('h3','','Legoversikt'));
  if(legWins.length){
    const perSet=new Map();
    const lines=legWins.map(v=>{
      const set=v.set||1,current=perSet.get(set)||[0,0];
      current[v.player]++;perSet.set(set,current);
      return [(entry.mode==='sets'?'Set '+set+' · ':'')+'Leg '+v.leg,
        entry.players[v.player],current[0]+' – '+current[1]];
    });
    detail.append(tableOf(lines,['Leg','Vinner','Stilling']));
  }else detail.append(create('p','muted compact','Ingen registrerte utsjekker.'));
  const all=create('details','sa-history-all-visits');
  all.append(create('summary','','Alle registrerte kast ('+entry.visits.length+')'));
  all.append(tableOf(entry.visits.map(v=>[
    (entry.mode==='sets'?'S'+(v.set||1)+' · ':'')+'L'+v.leg,
    entry.players[v.player]||'Spiller',
    v.bust?'BUST':v.checkout?v.score+' (ut)':v.score,
    v.remaining===undefined?'–':v.remaining,
    v.checkout?v.darts:3
  ]),['Leg','Spiller','Score','Igjen','Piler']));
  detail.append(all);
  const actions=create('div','sa-history-detail-actions');
  const del=create('button','outline sa-history-delete','Slett denne kampen');
  del.type='button';
  del.addEventListener('click',()=>{
    if(!window.confirm('Slette denne kampen fra historikken? Dette kan ikke angres.'))return;
    if(!H.remove(entry.id)){window.alert('Kunne ikke slette kampen.');return}
    closeDialog();render();
  });
  actions.append(del);detail.append(actions);
  dialog.hidden=false;
  if(typeof dialog.showModal==='function'&&!dialog.open)dialog.showModal();
}
function render(){
  const all=H.read(),filtered=all.filter(entry=>filter.value==='all'||
    filter.value==='bot'&&entry.opponent!=='human'||
    filter.value==='human'&&entry.opponent==='human');
  count.textContent=all.length===1?'1 kamp':all.length+' kamper';
  list.replaceChildren();
  if(!filtered.length){
    list.append(create('p','muted compact',
      all.length?'Ingen kamper passer filteret.':'Ingen ferdige Head-to-Head-kamper lagret ennå. Spill en kamp for å starte historikken.'));
    more.hidden=true;return;
  }
  const visible=showAll?filtered:filtered.slice(0,6);
  for(const entry of visible){
    const row=create('article','sa-history-row');
    const main=create('div','sa-history-match');
    const meta=create('div','sa-history-meta',date(entry.finishedAt)+' · '+entry.format+' · '+typeLabel(entry));
    const title=create('div','sa-history-matchup');
    const result=scores(entry);
    title.append(create('span',entry.winner===0?'sa-history-winner':'',entry.players[0]),
      create('strong','sa-history-score',result[0]+' – '+result[1]),
      create('span',entry.winner===1?'sa-history-winner':'',entry.players[1]));
    const summary=create('div','sa-history-averages',
      '3-dart AVG: '+average(entry.stats?.[0]?.avg)+' / '+average(entry.stats?.[1]?.avg));
    main.append(meta,title,summary);
    const button=create('button','outline sa-history-view','Detaljer');
    button.type='button';button.addEventListener('click',()=>openDetails(entry));
    row.append(main,button);list.append(row);
  }
  more.hidden=filtered.length<=6;
  more.textContent=showAll?'Vis færre':'Vis alle '+filtered.length+' kamper';
}
filter.addEventListener('change',()=>{showAll=false;render()});
more.addEventListener('click',()=>{showAll=!showAll;render()});
$('saHistoryClose').addEventListener('click',closeDialog);
dialog.addEventListener('click',event=>{if(event.target===dialog)closeDialog()});
window.addEventListener('storage',event=>{if(event.key===H.storageKey)render()});
render();
})();
