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
const constant=new Set(['1','2','3','4','5','6','X01','DIDO','SIDO','MPR:','3-dart AVG:','First 9 AVG:','BETA','T20','Bull','D20','Chicago Style','Zoom-cam','Cam-test','Available','Unavailable','↑','↓','←','→','.',',','Cricket, Half-It, 61 og JDC','DartArena','100 %','+','−']);
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

test('Illustrated Zoom-cam image is embedded from a repository asset with English accessibility copy',()=>{
  assert.equal((html.match(/assets\/zoomcam-guide\.avif\?v=20261027-illustrated1/g)||[]).length,2);
  assert.match(html,/class="help-zoomcam-poster"/);
  assert.match(html,/width="650" height="855" loading="lazy" decoding="async"/);
  assert.match(html,/id="helpZoomcamOpen"[^>]*target="_blank" rel="noopener"/);
  assert.match(html,/<dialog class="help-guide-viewer" id="helpZoomcamViewer"/);
  assert.match(html,/help-guide-viewport\{flex:1 1 auto;min-height:0;overflow:auto/);
  assert.match(html,/help-guide-viewer\.js\?v=20261028-scrollzoom1/);
  assert.match(html,/\.help-zoomcam-poster-link img\{display:block;width:100%;height:auto\}/);
  assert.match(dict['Åpne stor, rullbar Zoom-cam-guide'],/Open large, scrollable/);
  assert.match(dict['Zoom-cam hurtigguide: åpne Cam-test, marker Bull og D20, forhåndsvis og finjuster med pilknappene.'],/Zoom-cam quick guide/);
  assert.match(dict['Illustrert hurtigguide med fire trinn. Trykk på bildet for å åpne en stor visning der du kan scrolle og zoome. Flere detaljer finner du under.'],/Illustrated four-step quick guide/);
});
