'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const safety=require('../tournament-room-site-safety.js');
const room=fs.readFileSync(path.join(root,'tournament-match-room.js'),'utf8');
const html=fs.readFileSync(path.join(root,'tournament-match-room.html'),'utf8');

const preview='dartarena-sfu-preview.sotkajervi.workers.dev';
const standard='sotkajervi.github.io';

test('two same-version SFU preview players may start a tournament match',()=>{
 assert.equal(safety.isPreview(preview),true);
 assert.equal(safety.compatible(preview,safety.tag(preview)),true);
 assert.equal(safety.tag(preview),'isolated-sfu-preview-v1');
});
test('preview rejects the legacy production site, including old clients missing their version tag',()=>{
 assert.equal(safety.compatible(preview,safety.tag(standard)),false);
 assert.equal(safety.compatible(preview,undefined),false);
 assert.equal(safety.compatible(preview,null),false);
 assert.equal(safety.compatible(preview,''),false);
});
test('legacy production is unchanged (does not require a preview-only handshake)',()=>{
 assert.equal(safety.isPreview(standard),false);
 assert.equal(safety.compatible(standard,undefined),true);
 assert.equal(safety.compatible(standard,safety.tag(preview)),true);
});
test('room propagates site tag with player identity and blocks mixed client readiness before start RPC',()=>{
 assert.match(room,/siteTag:siteSafety\?\.tag\(location\.hostname\)/);
 assert.match(room,/payload\.from!==other\)return;\s*if\(isolatedPreview&&!siteSafety\.compatible\(location\.hostname,payload\.siteTag\)\)/);
 assert.match(room,/remoteSiteMismatch=true;\s*localReady=false;\s*remoteReady=false;/);
 assert.match(room,/if\(mustResend\)await sendState\(\);/);
 assert.match(room,/readyBtn'\)\.disabled=!roomConnected\|\|starting\|\|remoteSiteMismatch/);
 assert.match(room,/if\(!roomConnected\|\|remoteSiteMismatch\)return;/);
 assert.match(room,/if\(starting\|\|remoteSiteMismatch\|\|!localReady\|\|!remoteReady/);
});
test('preview warnings are visible and script is loaded before tournament room bootstrap',()=>{
 const helper=html.indexOf('tournament-room-site-safety.js?v=20261031-mixedsite1');
 const roomScript=html.indexOf('tournament-match-room.js?v=20261031-mixedsite1');
 assert.ok(helper>=0&&roomScript>helper);
 assert.match(room,/SFU-test: Begge spillere må åpne testadressen/);
 assert.match(room,/Tilskuervideo er foreløpig ikke tilgjengelig/);
});
