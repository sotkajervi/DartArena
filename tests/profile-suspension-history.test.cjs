'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const src=fs.readFileSync(path.join(__dirname,'..','player-suspension-history.js'),'utf8');
const target='00000000-0000-4000-8000-000000000001';
function harness({staff=true,entries=[],language='no',roles}={}){
 const calls=[],events={},auth=[],deferred=[];
 class Element{constructor(){this.children=[];this.hidden=true;this.textContent=''}append(...a){this.children.push(...a)}replaceChildren(...a){this.children=a}}
 const section=new Element(),content=new Element(),title=new Element();
 const d={getElementById:id=>({daSuspensionHistory:section,daSuspensionHistoryContent:content,daSuspensionHistoryTitle:title}[id]),createElement:()=>new Element(),addEventListener:(k,v)=>events[k]=v};
 const db={auth:{getSession:async()=>({data:{session:{user:{id:'staff'}}}}),onAuthStateChange:fn=>auth.push(fn)},rpc:async()=>({data:roles?.length?roles.shift():staff}),from(table){calls.push(table);const q={select:()=>q,eq:()=>q,order:()=>q,range:async(a,b)=>({data:entries.slice(a,b+1)}),in:async()=>({data:[{id:'moderator',username:'Admin Test'}]})};return q}};
 const w={document:d,DartArenaSupabaseClient:db,location:{search:'?id='+target},DartArenaI18n:{getLanguage:()=>language},addEventListener:(k,v)=>events[k]=v};
 vm.runInNewContext(src,{window:w,URLSearchParams,setInterval:()=>0,setTimeout:fn=>deferred.push(fn)});
 return {section,content,title,calls,events,auth,settle:()=>new Promise(resolve=>setImmediate(resolve))};
}
const entry={id:'1',imposed_by:'moderator',imposed_at:'2026-01-01T12:00:00Z',ends_at:'2099-01-02T12:00:00Z',reason:'<b>private reason</b>',revoked_at:null};
function strings(n){return [n.textContent,...n.children.flatMap(strings)]}
test('normal players do not query suspension history',async()=>{const h=harness({staff:false});await h.settle();assert.equal(h.section.hidden,true);assert.equal(h.calls.includes('player_suspensions'),false)});
test('staff see active and lifted entries with names and literal reasons',async()=>{const h=harness({entries:[entry,{...entry,id:'2',revoked_at:'2026-01-01T13:00:00Z',revoked_by:'moderator',revocation_reason:'Test complete'}],language:'en'});await h.settle();assert.equal(h.section.hidden,false);const text=strings(h.content);for(const s of ['Active','Lifted','Admin Test','<b>private reason</b>','Test complete'])assert.ok(text.includes(s),s);assert.equal(h.title.textContent,'Suspension history');h.auth[0]('SIGNED_OUT');assert.equal(h.section.hidden,true);assert.equal(h.content.children.length,0)});
test('lost role before display never exposes entries',async()=>{const h=harness({entries:[entry],roles:[true,false]});await h.settle();assert.equal(h.section.hidden,true);assert.equal(h.content.children.length,0)});
test('history loads beyond first page and keeps full count',async()=>{const entries=Array.from({length:201},(_,i)=>({...entry,id:String(i)}));const h=harness({entries});await h.settle();assert.equal(h.calls.filter(x=>x==='player_suspensions').length,2);assert.ok(strings(h.content).includes('201'));});
