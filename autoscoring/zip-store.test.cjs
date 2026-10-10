/* Tests: node autoscoring/zip-store.test.cjs */
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const {Blob}=require('node:buffer');
const sandbox={window:{},Blob,TextEncoder,Uint8Array,Uint32Array,DataView,ArrayBuffer};
vm.runInNewContext(fs.readFileSync(__dirname+'/zip-store.js','utf8'),sandbox,{filename:'zip-store.js'});
const zip=sandbox.window.DartArenaLabZip;
assert.ok(zip);
function read32(data,offset){return new DataView(data.buffer,data.byteOffset,data.byteLength).getUint32(offset,true)}
(async()=>{
  const b=zip.build([
    {name:'labels.json',bytes:Uint8Array.from([97,98,99])},
    {name:'images/0001-after.jpg',bytes:Uint8Array.from([255,216,255,217])}
  ]);
  const bytes=new Uint8Array(await b.arrayBuffer());
  assert.equal(read32(bytes,0),0x04034b50);
  const firstCRC=read32(bytes,14);
  assert.equal(firstCRC,0x352441c2,'CRC32 must match abc');
  const eocd=bytes.length-22;
  assert.equal(read32(bytes,eocd),0x06054b50);
  const view=new DataView(bytes.buffer);
  assert.equal(view.getUint16(eocd+10,true),2);
  const start=view.getUint32(eocd+16,true);
  assert.equal(read32(bytes,start),0x02014b50);
  assert.throws(()=>zip.build([{name:'../secret',bytes:new Uint8Array()}]),/filnavn/);
  assert.throws(()=>zip.build([
    {name:'dup',bytes:new Uint8Array()},
    {name:'dup',bytes:new Uint8Array()}
  ]),/Duplisert/);
  console.log('Autoscoring ZIP writer: CRC, headers, entry count and validation OK');
})().catch(err=>{console.error(err);process.exitCode=1});
