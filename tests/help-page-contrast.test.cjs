'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const html=fs.readFileSync(path.join(__dirname,'..','help.html'),'utf8');
test('help content stacks above decorative dartboard background',()=>{
  assert.match(html,/\.help-shell\{position:relative;z-index:1\}/);
});
test('help title and cards have non-transparent dark backgrounds',()=>{
  assert.match(html,/\.help-head\{[^}]*background:linear-gradient\(145deg,#[0-9a-f]{6},#[0-9a-f]{6}\)/i);
  assert.match(html,/\.help-card\{[^}]*background:linear-gradient\(145deg,#[0-9a-f]{6},#[0-9a-f]{6}\)/i);
  assert.match(html,/\.help-note\{[^}]*background:#[0-9a-f]{6}/i);
  assert.match(html,/\.help-nav a\{background:#[0-9a-f]{6}\}/i);
});
test('help remains a responsive searchable page',()=>{
  assert.match(html,/@media\(max-width:720px\)/);
  assert.match(html,/\.help-grid\{grid-template-columns:1fr\}/);
  assert.match(html,/q\?\.addEventListener\('input'/);
});
