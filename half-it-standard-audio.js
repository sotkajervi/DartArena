(()=>{
  const video=document.getElementById('remoteVideo'),button=document.getElementById('remoteAudioBtn');
  if(!video||!button)return;
  video.muted=true;
  button.textContent='Slå på lyd';
  button.onclick=async()=>{video.muted=!video.muted;button.textContent=video.muted?'Slå på lyd':'Slå av lyd';try{await video.play()}catch{video.muted=true;button.textContent='Slå på lyd'}};
  const timer=setInterval(()=>{
    const hasAudio=!!video.srcObject?.getAudioTracks?.().some(t=>t.readyState==='live');
    button.classList.toggle('hidden',!hasAudio);
  },500);
  window.addEventListener('beforeunload',()=>clearInterval(timer),{once:true});
})();
