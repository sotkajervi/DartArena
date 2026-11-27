const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const app=fs.readFileSync('app.js','utf8'),html=fs.readFileSync('index.html','utf8');
const start=app.indexOf('function authMode('),end=app.indexOf("$('logoutBtn').onclick",start);
assert(start>=0&&end>start);
const els={},calls=[];
function $(id){return els[id]??=( {value:'',classList:{toggle(){}},removeAttribute(n){if(n==='minlength')delete this.minLength}});}
const db={auth:{async signUp(x){calls.push({type:'signup',...x});return {data:{session:null}}},async signInWithPassword(x){calls.push({type:'login',...x});return {data:{}}}}};
const identity=require('../profile-avatars.js');
const ctx=vm.createContext({$,db,mode:'login',window:{DartArenaIdentity:identity,DartArenaAuthCaptcha:{token:async()=>null,message:()=>null}}});
vm.runInContext(app.slice(start,end),ctx);
assert(!Object.hasOwn($('password'),'minLength'));
assert.equal($('password').autocomplete,'current-password');
$('email').value='test@example.test';$('username').value='Test_Player';
async function submit(pass){$('password').value=pass;await $('authForm').onsubmit({preventDefault(){}});}
(async()=>{
 await submit('short1');assert.equal(calls.length,1);assert.equal(calls[0].type,'login');
 $('registerTab').onclick();assert.equal($('password').minLength,8);assert.equal($('password').autocomplete,'new-password');
 for(const pass of ['','short1','1234567']){await submit(pass);assert.equal(calls.length,1);assert.match($('authMessage').textContent,/8 tegn/);}
 await submit('abcdefgh');assert.equal(calls.length,2);assert.equal(calls[1].type,'signup');
 $('loginTab').onclick();assert(!Object.hasOwn($('password'),'minLength'));assert.equal($('password').autocomplete,'current-password');
 await submit('short1');assert.equal(calls.length,3);assert.equal(calls[2].type,'login');
 assert.match(html,/<input id="password"[^>]*autocomplete="current-password"[^>]*>/);
 assert(!html.match(/<input id="password"[^>]*minlength=/));
 assert.match(html,/app\.js\?v=[^"'\s]+/);
 console.log(JSON.stringify({oldLoginPreserved:true,shortRegistrationRejected:3,validRegistrationAccepted:true,modeSwitch:true,cacheVersionUpdated:true}));
})().catch(e=>{console.error(e);process.exitCode=1});
