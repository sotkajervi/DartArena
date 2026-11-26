'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const read=file=>fs.readFileSync(path.join(__dirname,'..',file),'utf8');
function i18n(){
  const doc={
    head:{appendChild(){}},body:null,documentElement:{lang:'nb'},
    title:'DartArena',readyState:'loading',
    createElement(){return {setAttribute(){},appendChild(){},classList:{add(){},toggle(){}}}},
    addEventListener(){},dispatchEvent(){}
  };
  const win={};
  vm.runInNewContext(read('dartarena-i18n.js'),{
    window:win,document:doc,
    localStorage:{getItem(){return 'en'},setItem(){}},
    CustomEvent:class CustomEvent{constructor(type,options){this.type=type;this.detail=options?.detail}}
  });
  return {api:win.DartArenaI18n,doc};
}

test('New game labels and dynamic messages translate and restore Norwegian',()=>{
 const {api}=i18n();
 const cases=[
 ['Kampforløp','Match history'],
 ['HØYESTE I LEGET','HIGHEST IN LEG'],
 ['ØVELSE 4 AV 7','EVENT 4 OF 7'],
 ['HALF-IT · MÅL 3/7','HALF-IT · TARGET 3/7'],
 ['NESTE ØVELSE →','NEXT EVENT →'],
 ['Velg rekordopptak','Select personal best recording'],
 ['Din beste: ingen fullført Pentathlon-kamp ennå.','Your best: no completed Pentathlon match yet.'],
 ['Neste øvelse er klar. Åse starter.','The next event is ready. Åse starts.'],
 ['Registrert 60. Bjørn kaster nå.','Recorded 60. Bjørn is throwing now.'],
 ['Løpet er i gang! Åse kaster først.','The race is underway! Åse throws first.'],
 ['3 RUNDER','3 LAPS'],
 ['2 / 3 RUNDER','2 / 3 LAPS'],
 ['Kunne ikke gjenoppta: offline','Could not resume: offline'],
 ['3 forsøk','3 attempts']
 ];
 for(const [no,en] of cases)assert.equal(api.t(no),en,no);
 api.setLanguage('no');
 for(const [no] of cases)assert.equal(api.t(no),no);
 api.setLanguage('en');
 for(const [no,en] of cases)assert.equal(api.t(no),en);
});
test('New games load shared language support',()=>{
 for(const page of ['61-match.html','pentathlon-2p.html','pentathlon-top10.html','pentathlon-rejoin.html','scoringarena.html','arcade-racing.html']){
  assert.match(read(page),/dartarena-i18n\.js/,page);
 }
});

test('Persistent heatmap and new 61 messages translate both directions',()=>{
 const {api}=i18n();
 const cases=[["Mitt heatmap · 501","My heatmap · 501"],["Periode","Period"],["Siste 30 dager","Last 30 days"],["Siste 90 dager","Last 90 days"],["Personlig heatmap","Personal heatmap"],["Laster lagrede treff…","Loading saved hits…"],["Ingen lagrede treff i perioden.","No saved hits in this period."],["Kunne ikke laste heatmap-data.","Could not load heatmap data."],["Kunne ikke hente lagrede heatmap-data.","Could not retrieve saved heatmap data."],["Ingen registrerte heatmap-data for denne kampen.","No heatmap data recorded for this match."],["Kameraestimater, ikke poengfasit. Lagrede treffposisjoner vises når kalibrert kamera har registrert dem.","Camera estimates, not definitive scoring. Saved hit positions are shown when recorded by a calibrated camera."],["Kameraestimater, ikke poengfasit. Kun fullførte ordinære 501-kamper.","Camera estimates, not definitive scoring. Completed regular 501 matches only."],["▶ START TID","▶ START TIMER"],["▶ FORTSETT","▶ RESUME"],["Venter på felles start","Waiting for both players to start"],["Begge klare? Start tiden","Both ready? Start the timer"],["Felles servertid aktiv","Shared server timer active"],["Pauset","Paused"],["Pauset · tiden står stille","Paused · timer stopped"],["Kampen er pauset. Tiden står stille.","Match paused. The timer is stopped."],["Kampen fortsetter.","Match resumed."],["Kunne ikke endre pause.","Could not change pause state."],["Tiden er ute – legen må avgjøres.","Time is up – the leg must be decided."],["Tiden ute · avgjør leg…","Time is up · deciding leg…"],["Tiden ute · ditt siste forsøk","Time is up · your final attempt"],["Tiden ute · motstanderens siste forsøk","Time is up · opponent's final attempt"],["Tiden er ute – siste spiller får like mange forsøk.","Time is up – the last player gets the same number of attempts."],["Tiden er ute – leg avgjort!","Time is up – leg decided!"],["Kampen er avgjort!","Match decided!"],["Neste leg · ENTER","Next leg · ENTER"],["Leget endte uavgjort","The leg ended in a draw"],["Leg avgjort!","Leg decided!"],["15 registrerte kameraestimater fra 3 kamper.","15 recorded camera estimates from 3 matches."],["1 registrerte kameraestimater fra 1 kamper.","1 recorded camera estimate from 1 match."],["Leg 2 · Resultat","Leg 2 · Result"],["Åse vant leget!","Åse won the leg!"],["Leg 3 · Bjørn starter","Leg 3 · Bjørn starts"],["Stilling: 1 – 0","Score: 1 – 0"],["Tiden ute · du har 2 forsøk igjen","Time is up · you have 2 attempts left"]];
 for(const [no,en] of cases)assert.equal(api.t(no),en,no);
 api.setLanguage('no');for(const [no] of cases)assert.equal(api.t(no),no);
 api.setLanguage('en');for(const [no,en] of cases)assert.equal(api.t(no),en,no);
});
test('Both history views, personal profile and live game load the current language dictionary',()=>{
 for(const p of ['match.html','match-stats.html','tournament-match-stats.html','player.html','61-match.html','half-it.html','pentathlon-rejoin.html'])assert.match(read(p),/dartarena-i18n\.js\?v=202611(?:25-heatmap-i18n1|26-(?:profile1|identity[1-4]|crop1))/,p);
});
