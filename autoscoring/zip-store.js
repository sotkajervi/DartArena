/* Minimal offline ZIP writer for locally collected, already-compressed JPEG images.
   STORE method only. No CDN, uploads, dependencies or external storage. */
(()=>{
'use strict';
const encoder=new TextEncoder();
const TABLE=Uint32Array.from({length:256},(_,i)=>{
  let crc=i;
  for(let n=0;n<8;n++)crc=(crc&1)?((crc>>>1)^0xedb88320):(crc>>>1);
  return crc>>>0;
});
function checksum(bytes){
  let crc=0xffffffff;
  for(let i=0;i<bytes.length;i++)crc=TABLE[(crc^bytes[i])&255]^(crc>>>8);
  return (crc^0xffffffff)>>>0;
}
function header(size){return new DataView(new ArrayBuffer(size))}
function writeCommon(view,name,bytes,crc,offset,central){
  const utf8=encoder.encode(name),size=bytes.byteLength;
  view.setUint32(0,central?0x02014b50:0x04034b50,true);
  if(central){view.setUint16(4,20,true);view.setUint16(6,20,true)}
  else view.setUint16(4,20,true);
  const shift=central?2:0;
  view.setUint16(6+shift,0x0800,true);
  view.setUint16(8+shift,0,true);
  view.setUint16(10+shift,0,true);
  view.setUint16(12+shift,0,true);
  view.setUint32(14+shift,crc,true);
  view.setUint32(18+shift,size,true);
  view.setUint32(22+shift,size,true);
  view.setUint16(26+shift,utf8.length,true);
  view.setUint16(28+shift,0,true);
  if(central){
    view.setUint16(32,0,true);
    view.setUint16(34,0,true);
    view.setUint16(36,0,true);
    view.setUint32(38,0,true);
    view.setUint32(42,offset,true);
  }
  return utf8;
}
function build(entries){
  if(!Array.isArray(entries)||entries.length===0||entries.length>65000)throw new Error('Ugyldig antall filer.');
  const output=[],central=[];
  let offset=0,centralSize=0;
  const names=new Set();
  for(const entry of entries){
    const name=entry.name;
    const bytes=entry.bytes;
    if(typeof name!=='string'||!/^[\w./-]+$/.test(name)||name.startsWith('/')||name.includes('..'))throw new Error('Ugyldig ZIP-filnavn.');
    if(names.has(name))throw new Error('Duplisert ZIP-filnavn.');names.add(name);
    if(!(bytes instanceof Uint8Array)||bytes.byteLength>64*1024*1024)throw new Error('Ugyldig ZIP-innhold.');
    const nameBytes=encoder.encode(name);
    if(nameBytes.length>65535)throw new Error('ZIP-filnavn er for langt.');
    const crc=checksum(bytes);
    const local=header(30);
    writeCommon(local,name,bytes,crc,offset,false);
    output.push(local.buffer,nameBytes,bytes);
    const cd=header(46);
    writeCommon(cd,name,bytes,crc,offset,true);
    central.push(cd.buffer,nameBytes);
    offset+=30+nameBytes.length+bytes.byteLength;
    centralSize+=46+nameBytes.length;
    if(offset>0xffffffff||centralSize>0xffffffff)throw new Error('ZIP-filen ble for stor.');
  }
  const end=header(22);
  end.setUint32(0,0x06054b50,true);
  end.setUint16(8,entries.length,true);
  end.setUint16(10,entries.length,true);
  end.setUint32(12,centralSize,true);
  end.setUint32(16,offset,true);
  return new Blob([...output,...central,end.buffer],{type:'application/zip'});
}
window.DartArenaLabZip={build};
})();
