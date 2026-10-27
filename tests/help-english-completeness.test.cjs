'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const html=fs.readFileSync(path.join(root,'help.html'),'utf8');
const langSrc=fs.readFileSync(path.join(root,'help-translations.js'),'utf8');
const i18nSrc=fs.readFileSync(path.join(root,'dartarena-i18n.js'),'utf8');
const dict=JSON.parse(langSrc.match(/Object\.freeze\(([\s\S]*?)\);/)?.[1]||'{}');
const constant=new Set(['1','2','3','4','5','6','X01','DIDO','SIDO','MPR:','3-dart AVG:','First 9 AVG:','BETA','T20','Bull','D20','Chicago Style','Zoom-cam','Cam-test','Available','Unavailable','↑','↓','←','→','.',',','Cricket, Half-It, 61 og JDC','DartArena']);
test('English Help translations load before the existing bilingual engine',()=>{
  assert.ok(html.indexOf('help-translations.js?v=20261027-helpenglish1')>0);
  assert.ok(html.indexOf('help-translations.js?v=20261027-helpenglish1')<html.indexOf('dartarena-i18n.js?v=20261027-helpenglish1'));
  assert.match(i18nSrc,/\.\.\.\(window\.DartArenaHelpTranslations\|\|\{\}\)/);
  assert.match(i18nSrc,/localStorage\.setItem\(KEY,lang\)/);
});
test('Every visible Help source fragment has a deliberate English translation',()=>{
  const visible=html.split('</style>')[1].split('<script>')[0].replace(/<[^>]*>/g,'\n');
  const nodes=[...new Set(visible.split('\n').map(x=>x.trim()).filter(Boolean))];
  const untranslated=nodes.filter(x=>!constant.has(x)&&!/^\d+$/.test(x)&&!(x in dict));
  assert.deepEqual(untranslated,[], 'Untranslated Help fragments: '+untranslated.join(' / '));
  assert.ok(Object.keys(dict).length>150);
});
test('Calibration, Zoom-cam setup, troubleshooting, and FAQ translated accurately',()=>{
  assert.match(dict['Kalibreringen lagres automatisk.'],/saved automatically/);
  assert.match(dict['2,5 % av skiveradiusen'],/2\.5%/);
  assert.match(dict['ikke automatisk poengregistrering'],/not automatic scoring/);
  assert.match(dict['Du trenger ikke trykke «Ferdig». Bull\/D20, finjustering og digitalt utsnitt lagres i nettleseren for det valgte kameraet. Hvis du bytter kamera, videoformat eller nettleser, kan ny kalibrering være nødvendig.'],/You do not need to press/);
  assert.match(dict['Zoomvinduet fryser?'],/frozen/);
  assert.match(dict['Slik setter du opp Zoom-cam'],/How to set up Zoom-cam/);
});
test('Page remains searchable with both languages',()=>{
  assert.match(html,/helpSearch/);
  assert.match(html,/card\.textContent\.toLowerCase\(\)\.includes\(term\)/);
  assert.match(html,/\.help-shell\{position:relative;z-index:1\}/);
});
