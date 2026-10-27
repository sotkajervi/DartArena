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
test('Online X01 throw log and correction controls translate in English',()=>{
  const {api}=i18n();
  const cases=[
    ['Kast i dette legget','Throws in this leg'],
    ['DU','YOU'],['MOT','OPP'],
    ['Trykk på et av dine siste kast for å korrigere','Select one of your recent visits to correct it'],
    ['Korriger kast 100','Correct visit 100'],
    ['Korriger 60 (3p)','Correct 60 (3p)'],
    ['Checkout 100. Hvor mange piler brukte du?','Checkout 100. How many darts did you use?'],
    ['Korrigert til checkout 40 på 2 piler.','Corrected to checkout 40 with 2 darts.'],
    ['Korrigert til checkout 40 på 1 pil.','Corrected to checkout 40 with 1 dart.'],
    ['Kast korrigert: 100 → 60.','Visit corrected: 100 → 60.'],
    ['Checkout 40 på 2 piler • Leg vunnet!','Checkout 40 with 2 darts • Leg won!'],
    ['Checkout 40 på 1 pil • Leg vunnet!','Checkout 40 with 1 dart • Leg won!'],
    ['Vil du avbryte kampen?','Do you want to cancel the match?'],
    ['Kamera kunne ikke startes.','Could not start camera.'],
    ['CHICAGO STYLE • GAME 2 AV 3 • CRICKET • 1–0','CHICAGO STYLE • GAME 2 OF 3 • CRICKET • 1–0']
  ];
  for(const [source,english] of cases)assert.equal(api.t(source),english,source);
});
test('Language toggle retains Norwegian source and restores English',()=>{
  const {api,doc}=i18n();
  api.setLanguage('no');
  assert.equal(doc.documentElement.lang,'nb');
  assert.equal(api.t('Kast i dette legget'),'Kast i dette legget');
  api.setLanguage('en');
  assert.equal(doc.documentElement.lang,'en');
  assert.equal(api.t('Kast i dette legget'),'Throws in this leg');
});
test('Match room cache busts both language dictionary and dynamically created throw log',()=>{
  const html=read('match.html');
  const css=read('match-own-turn.css');
  const throws=read('throw-log.js');
  assert.match(html,/dartarena-i18n\.js\?v=20261027-i18naudit1/);
  assert.match(html,/throw-log\.js\?v=20261027-i18naudit1/);
  assert.match(html,/match-own-turn\.css\?v=20261027-i18naudit1/);
  assert.match(css,/html\[lang="en"\].*\.focus-input-dock::before/);
  assert.match(css,/content:'YOUR TURN  •  ENTER SCORE'/);
  assert.match(throws,/Kast i dette legget/);
  assert.doesNotMatch(throws,/Kast i dette leget/);
  assert.match(throws,/tr\('NY SCORE \(0–180\)'\)/);
});
