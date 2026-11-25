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
