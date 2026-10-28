// Configuration safety checks: no deployment or Cloudflare credentials required.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const raw=await readFile(new URL('./wrangler.staging.example.jsonc',import.meta.url),'utf8');
const config=JSON.parse(raw.replace(/^\s*\/\/.*$/gm,''));
test('staging Worker cannot target production name',()=>{
  assert.equal(config.name,'dartarena-realtime-security-test');
  assert.notEqual(config.name,'dartarena-realtime');
});
test('staging entry point references isolated source',()=>{
  assert.equal(config.main,'dartarena-realtime.staging.js');
});
test('Durable Object binding and SQLite migration match',()=>{
  assert.deepEqual(config.durable_objects.bindings,[{name:'SFU_ROOMS',class_name:'SfuRoom'}]);
  assert.deepEqual(config.migrations,[{tag:'sfu-security-test-v1',new_sqlite_classes:['SfuRoom']}]);
});
test('config contains no embedded SFU credentials',()=>{
  assert.deepEqual(config.vars,{SFU_MEDIA_ENABLED:'false'});
  assert.equal(JSON.stringify(config).includes('REALTIME_SFU_BEARER_TOKEN'),false);
});

test('full staging deploy preserves dashboard variables and secrets',()=>{
  assert.equal(config.keep_vars,true);
});
