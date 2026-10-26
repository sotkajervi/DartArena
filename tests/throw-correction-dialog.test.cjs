const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const read=file=>fs.readFileSync(path.join(__dirname,'..',file),'utf8');

test('correcting a throw never uses browser-native prompts or alerts',()=>{
  const js=read('throw-log.js');
  assert.doesNotMatch(js,/(?<![\w.])(?:prompt|alert|confirm)\s*\(/);
  assert.match(js,/await ui\.prompt\(/);
  assert.match(js,/await notice\(/);
  assert.match(js,/correct_x01_throw/);
  assert.match(js,/correct_throw_to_checkout/);
});
test('numeric correction validator allows 0 and 180, rejects invalid formats',()=>{
  const source=read('throw-log.js');
  const m=source.match(/ function parseScoreInput\(raw\)\{([\s\S]*?)\n \}/);
  assert.ok(m,'Correction validator should exist');
  const parse=new Function('raw',m[1]);
  assert.equal(parse(null),null);
  assert.equal(parse('0'),0);
  assert.equal(parse('180'),180);
  assert.equal(parse(' 57 '),57);
  for(const value of ['', ' ', '181', '-1', '1.5', '1e2', 'abc', '500']){
    assert.equal(Number.isNaN(parse(value)),true,'Invalid input '+JSON.stringify(value));
  }
});
test('match and tournament pages preload dialog before their correction handlers',()=>{
  const configs=[
    ['match.html','throw-log.js'],
    ['tournament.html','tournament-result-edit.js']
  ];
  for(const [html,handler] of configs){
    const page=read(html);
    const dialogPos=page.indexOf('src="dartarena-dialog.js?v=20261027-correction2"');
    const handlerPos=page.indexOf('src="'+handler+'?v=20261027-correction2"');
    assert.ok(dialogPos>=0,'Missing shared dialog in '+html);
    assert.ok(handlerPos>dialogPos,'Handler loads before DartArena dialog in '+html);
  }
});
test('admin tournament result editing cannot fall back to the default browser dialog',()=>{
  const code=read('tournament-result-edit.js');
  assert.doesNotMatch(code,/(?<![\w.])(?:prompt|alert|confirm)\s*\(/);
  assert.match(code,/await dialog\.prompt/);
  assert.match(code,/await dialog\.confirm/);
});
test('shared dialog handles mobile numeric input and safely selects editable text',()=>{
  const code=read('dartarena-dialog.js');
  assert.match(code,/options\.inputMode/);
  assert.match(code,/try\{input\.select\(\)\}catch/);
  const throwCode=read('throw-log.js');
  assert.match(throwCode,/inputMode:'numeric'/);
  assert.match(throwCode,/inputType:'text'/);
});
