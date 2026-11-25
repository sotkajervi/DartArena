const {test}=require('node:test'),a=require('node:assert/strict'),fs=require('node:fs');
const read=p=>fs.readFileSync(p,'utf8');
test('Both Half-It variants share the standard viewer pill and exactly one Presence script',()=>{
 const h=read('half-it.html'),x=read('match.html'),b=read('half-it-bootstrap.js');
 const pill=/<div id="viewerCount" class="viewer-count">[\s\S]*?<\/div>/;
 a.equal(h.match(pill)[0],x.match(pill)[0]);
 a.equal((h.match(/src="spectator-presence\.js\?/g)||[]).length,1);
 a.ok(h.indexOf('supabase-js@')<h.indexOf('src="spectator-presence.js'));
 a.match(h,/brand-header\.css\?v=20261112-spectator-shared1/);
 a.match(b,/half-it-standard\.js/);a.match(b,/half-it\.js/);
 a.doesNotMatch(b,/spectator-presence\.js/);
 a.match(read('spectate.html'),/src="spectator-presence\.js\?/);
});
