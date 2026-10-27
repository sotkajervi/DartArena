'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.join(__dirname,'..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');

function loadI18n(){
  const textNode={nodeType:3,nodeValue:'Vil du avbryte kampen?\n\nKampen avsluttes for begge spillere.',
    parentElement:{closest(){return null}}};
  const document={
    head:{appendChild(){}},body:textNode,documentElement:{lang:'nb'},
    title:'DartArena • Kamp',readyState:'loading',
    addEventListener(){},dispatchEvent(){},
    createElement(){return {setAttribute(){},classList:{add(){},toggle(){}},appendChild(){},textContent:''}}
  };
  const window={};
  vm.runInNewContext(read('dartarena-i18n.js'),{
    window,document,
    localStorage:{getItem(){return 'en'},setItem(){}},
    CustomEvent:class CustomEvent{constructor(type,opts){this.type=type;this.detail=opts?.detail}}
  });
  return {i18n:window.DartArenaI18n,document,textNode};
}

test('X01 match cancel popup translates both message lines in English',()=>{
  const {i18n}=loadI18n();
  assert.equal(
    i18n.t('Vil du avbryte kampen?\n\nKampen avsluttes for begge spillere.'),
    'Do you want to cancel the match?\n\nThe match will end for both players.'
  );
  assert.equal(i18n.t('Avbryt kamp'),'Cancel match');
});
test('Tournament match and close-tab confirmations translate line by line',()=>{
  const {i18n}=loadI18n();
  assert.equal(
    i18n.t('Vil du avbryte denne turneringskampen?\n\nKampen nullstilles og kan startes på nytt.'),
    'Do you want to cancel this tournament match?\n\nThe match will be reset and can be started again.'
  );
  assert.equal(
    i18n.t('Kampen pågår fortsatt.\n\nVil du lukke kampfanen uten å avbryte kampen?'),
    'The match is still in progress.\n\nDo you want to close the match tab without cancelling the match?'
  );
  assert.equal(i18n.t('Lukk kampfane?'),'Close match tab?');
});
test('Multiline popup reversibly switches English -> Norwegian -> English',()=>{
  const {i18n,document,textNode}=loadI18n();
  const norwegian=textNode.nodeValue;
  i18n.translate(textNode);
  const english=textNode.nodeValue;
  assert.equal(english,'Do you want to cancel the match?\n\nThe match will end for both players.');
  i18n.setLanguage('no');
  assert.equal(textNode.nodeValue,norwegian);
  assert.equal(document.documentElement.lang,'nb');
  i18n.setLanguage('en');
  assert.equal(textNode.nodeValue,english);
  assert.equal(document.documentElement.lang,'en');
});
test('Match pages load updated dictionary, including other game modes',()=>{
  for(const page of ['match.html','cricket.html','half-it.html','61-match.html','jdc-match.html']){
    assert.match(read(page),/dartarena-i18n\.js\?v=20261027-multiline-modal1/,page);
  }
});
