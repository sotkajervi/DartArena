(function(w){
'use strict';
const SIZE=256;
const clamp=(v,lo,hi)=>Math.min(hi,Math.max(lo,v));
function geometry(width,height,zoom=1,rotation=0,x=0,y=0){
 const swapped=rotation%2!==0,rw=swapped?height:width,rh=swapped?width:height;
 const scale=SIZE/Math.min(rw,rh)*clamp(zoom,1,3);
 const maxX=Math.max(0,(rw*scale-SIZE)/2),maxY=Math.max(0,(rh*scale-SIZE)/2);
 return {scale,x:clamp(x,-maxX,maxX),y:clamp(y,-maxY,maxY)};
}
async function open(file){
 if(!file||!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>12*1024*1024)throw Error('invalid_avatar');
 const d=w.document,$=id=>d.getElementById(id),dialog=$('avatarCropDialog'),canvas=$('avatarCropCanvas'),slider=$('avatarCropZoom'),percent=$('avatarCropPercent'),rotate=$('avatarCropRotate'),reset=$('avatarCropReset'),cancel=$('avatarCropCancel'),save=$('avatarCropSave'),error=$('avatarCropError');
 if(dialog.open)throw Error('crop_already_open');
 const image=await w.createImageBitmap(file);if(!image.width||!image.height){image.close();throw Error('invalid_avatar')}
 let zoom=1,rotation=0,x=0,y=0,drag=null,busy=false,result=null,closed=false;
 const controls=[slider,rotate,reset,cancel,save];
 const ctx=canvas.getContext('2d');
 function paint(){
  const g=geometry(image.width,image.height,zoom,rotation,x,y);x=g.x;y=g.y;
  ctx.setTransform(1,0,0,1,0,0);ctx.fillStyle='#0b1719';ctx.fillRect(0,0,SIZE,SIZE);
  ctx.save();ctx.translate(SIZE/2+x,SIZE/2+y);ctx.rotate(rotation*Math.PI/2);ctx.scale(g.scale,g.scale);ctx.drawImage(image,-image.width/2,-image.height/2);ctx.restore();
  slider.value=String(zoom);percent.value=Math.round(zoom*100)+' %';
 }
 function changeZoom(next){const ratio=next/zoom;x*=ratio;y*=ratio;zoom=next;paint()}
 function clear(){closed=true;image.close();canvas.onpointerdown=canvas.onpointermove=canvas.onpointerup=canvas.onpointercancel=canvas.onlostpointercapture=canvas.onkeydown=null;slider.oninput=rotate.onclick=reset.onclick=cancel.onclick=save.onclick=null;controls.forEach(el=>el.disabled=false);ctx.clearRect(0,0,SIZE,SIZE);}
 return new Promise((resolve,reject)=>{
  dialog.addEventListener('close',()=>{clear();resolve(result)},{once:true});
  dialog.oncancel=e=>{if(busy)e.preventDefault()};
  slider.oninput=()=>{if(!busy)changeZoom(clamp(Number(slider.value),1,3))};
  rotate.onclick=()=>{if(!busy){rotation=(rotation+1)%4;x=0;y=0;paint()}};
  reset.onclick=()=>{if(!busy){zoom=1;rotation=0;x=y=0;paint()}};
  cancel.onclick=()=>{if(!busy)dialog.close()};
  canvas.onpointerdown=e=>{if(busy||e.button!==0||drag)return;drag={id:e.pointerId,x:e.clientX,y:e.clientY};canvas.setPointerCapture(e.pointerId)};
  canvas.onpointermove=e=>{if(!drag||drag.id!==e.pointerId||busy)return;const rect=canvas.getBoundingClientRect();x+=(e.clientX-drag.x)*SIZE/rect.width;y+=(e.clientY-drag.y)*SIZE/rect.height;drag.x=e.clientX;drag.y=e.clientY;paint()};
  canvas.onpointerup=canvas.onpointercancel=canvas.onlostpointercapture=e=>{if(drag?.id===e.pointerId)drag=null};
  canvas.onkeydown=e=>{const move={ArrowLeft:[-8,0],ArrowRight:[8,0],ArrowUp:[0,-8],ArrowDown:[0,8]}[e.key];if(move&&!busy){e.preventDefault();x+=move[0];y+=move[1];paint()}};
  save.onclick=async()=>{if(busy)return;busy=true;controls.forEach(el=>el.disabled=true);try{result=await w.DartArenaIdentity.encodeCanvas(canvas);if(!closed)dialog.close()}catch{if(!closed){error.textContent=w.DartArenaI18n?.t?.('Kunne ikke behandle bildet.')||'Kunne ikke behandle bildet.';controls.forEach(el=>el.disabled=false);busy=false}}};
  error.textContent='';paint();try{dialog.showModal();slider.focus()}catch(e){clear();reject(e)}
 });
}
const api={geometry,open};if(typeof module==='object'&&module.exports)module.exports=api;else w.DartArenaAvatarCrop=api;
})(typeof window!=='undefined'?window:globalThis);
