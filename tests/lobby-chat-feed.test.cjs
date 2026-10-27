const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {roleOf,sortRows,dayKey,decorate}=require('../lobby-chat-feed.js');
const message=(id,sender,minutes,extra={})=>({
  id:String(id),room_id:'main',sender_id:sender,
  body:'Message '+id,created_at:new Date(Date.UTC(2026,9,26,12,0)+minutes*60000).toISOString(),...extra
});

test('owner cyan, admin orange and ordinary users are derived from trusted role map',()=>{
 const roles=new Map([['owner-id','owner'],['admin-id','admin']]);
 assert.equal(roleOf('owner-id',roles),'owner');
 assert.equal(roleOf('admin-id',roles),'admin');
 assert.equal(roleOf('unknown-id',roles),'user');
 assert.equal(roleOf('other-id',new Map([['other-id','leader']])),'user');
 const rows=[message('1','unknown-id',1,{role:'owner',username:'ADMIN'})];
 assert.equal(decorate(rows,roles)[0].role,'user');
});

test('chronological sorting handles updates arriving out of order',()=>{
 const rows=[message('3','a',6),message('1','b',1),message('2','a',4)];
 assert.deepEqual(sortRows(rows).map(r=>r.id),['1','2','3']);
});

test('one author within three minutes collapses repeated name, while role remains attached',()=>{
 const roles=new Map([['admin','admin']]);
 const messages=[message('1','admin',0),message('2','admin',2),message('3','admin',6),message('4','other',7)];
 const result=decorate(messages,roles);
 assert.deepEqual(result.map(x=>x.grouped),[false,true,false,false]);
 assert.deepEqual(result.map(x=>x.role),['admin','admin','admin','user']);
});

test('dates delimit groups across midnight, regardless of sender',()=>{
 const a=message('1','a',0);
 const b=message('2','a',1);
 const c={...message('3','a',2),created_at:new Date(Date.parse(b.created_at)+24*3600000).toISOString()};
 const [first,second,third]=decorate([a,b,c],new Map());
 assert.equal(first.dateChanged,true);
 assert.equal(second.dateChanged,false);
 assert.equal(third.dateChanged,true);
 assert.equal(third.grouped,false);
 assert.notEqual(dayKey(a.created_at),dayKey(c.created_at));
});

test('thirty messages stay thirty in order, with grouped clusters, not independent bubbles',()=>{
 const roles=new Map([['owner','owner']]);
 const rows=Array.from({length:30},(_,i)=>message(i,i<16?'owner':'member',i));
 const ordered=decorate(rows.reverse(),roles);
 assert.equal(ordered.length,30);
 assert.equal(ordered.filter(x=>!x.grouped).length,2);
 assert.equal(ordered.filter(x=>x.role==='owner').length,16);
 assert.equal(ordered.filter(x=>x.role==='user').length,14);
});

test('chat source uses DOM textContent for body and server-side role RPC',()=>{
 const source=fs.readFileSync(path.join(__dirname,'../lobby-chat.js'),'utf8');
 const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
 const tournament=fs.readFileSync(path.join(__dirname,'../tournament.html'),'utf8');
 assert.match(source,/db\.rpc\('get_public_user_roles'\)/);
 assert.match(source,/body\.textContent=row\.body\|\|''/);
 assert.match(source,/const badge=document\.createElement\('span'\)/);
 assert.match(source,/meta\.appendChild\(time\)/);
 assert.match(source,/function loadOlder\(/);
 assert.ok(html.indexOf('lobby-chat-feed.js?v=')<html.indexOf('lobby-chat.js?v='));
 assert.ok(tournament.indexOf('lobby-chat-feed.js?v=')<tournament.indexOf('lobby-chat.js?v='));
});

test('main lobby visually uses one continuous feed without stacked chat bubbles',()=>{
 const css=fs.readFileSync(path.join(__dirname,'../lobby-social.css'),'utf8');
 assert.match(css,/#lobbyView #daSocialLobby \.dart-chat-message,\n/);
 assert.match(css,/max-width:none!important/);
 assert.match(css,/border-radius:0!important/);
 assert.match(css,/\.dart-chat-message\.dart-chat-role-owner \.dart-chat-author/);
 assert.match(css,/\.dart-chat-message\.dart-chat-role-admin \.dart-chat-author/);
});
