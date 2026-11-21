const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const html=fs.readFileSync(path.join(root,'tournament-match-viewer.html'),'utf8');
const css=fs.readFileSync(path.join(root,'tournament-spectator-compact.css'),'utf8');
test('live tournament spectator uses its isolated no-scroll stylesheet after the scorecard CSS',()=>{
  assert.match(html,/spectator-scorecard\.css[^"']+["'][^>]*><link rel="stylesheet" href="tournament-spectator-compact\.css/);
  assert.match(css,/body\.spectator-tv-live > \.shell\s*\{[^}]*grid-template-rows:auto minmax\(0,1fr\) auto!important/s);
  assert.match(css,/\.spectator-score\s*\{[^}]*grid-template-columns:repeat\(2,minmax\(0,1fr\)\)!important/s);
  assert.match(css,/\.spectator-score \.da-spectator-stats-row\s*\{\s*display:none!important/s);
  assert.match(css,/spectator-stats-open \.spectator-videos\s*\{\s*display:none!important/s);
  assert.match(css,/@media\(max-width:760px\)/);
  assert.match(css,/\.spectator-cricket-board\.active/);
  assert.match(html,/id="viewerStatsToggle"/);
  assert.match(html,/id="p1Video"/);
  assert.match(html,/id="p2Video"/);
});
