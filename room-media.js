// DartArena remote media renderer.
// IMPORTANT: this layer never rebuilds WebRTC and never restarts local capture.
// Connection recovery belongs exclusively to room.js and is triggered only by real peer/ICE failure.
(() => {
  const remoteVideo = $('remoteVideo');
  const remotePlaceholder = $('remotePlaceholder');
  const remoteAudioBtn = $('remoteAudioBtn');
  const cameraStatus = $('cameraStatus');

  let remoteStream = new MediaStream();
  let playRetryTimer = null;

  function setRemoteStatus(text) {
    if (remotePlaceholder) remotePlaceholder.textContent = text;
  }

  function showRemoteVideo() {
    if (remotePlaceholder) remotePlaceholder.classList.add('hidden');
    if (remoteAudioBtn) remoteAudioBtn.classList.remove('hidden');
    if (cameraStatus) cameraStatus.textContent = `Tilkoblet ${names[other] || 'motstander'}`;
  }

  async function playRemote() {
    if (!remoteVideo?.srcObject) return false;
    const videoTrack = remoteVideo.srcObject.getVideoTracks?.()[0];
    if (!videoTrack || videoTrack.readyState !== 'live') return false;

    remoteVideo.muted = true;
    remoteVideo.playsInline = true;
    try {
      await remoteVideo.play();
      return true;
    } catch (e) {
      lastSignal = `REMOTE PLAY ${e?.name || 'error'}`;
      debug();
      return false;
    }
  }

  function schedulePlayRetry() {
    clearTimeout(playRetryTimer);
    playRetryTimer = setTimeout(async () => {
      if (leaving || !remoteVideo?.srcObject) return;
      const ok = await playRemote();
      if (!ok) schedulePlayRetry();
    }, 1000);
  }

  // room.js calls this for every receiver track. Keep one stable MediaStream for the
  // lifetime of the page. Re-negotiation may replace tracks, but never local capture.
  attachRemoteTrack = function (event) {
    const track = event?.track;
    if (!track) return;

    const sameKind = remoteStream.getTracks().filter(t => t.kind === track.kind && t.id !== track.id);
    sameKind.forEach(oldTrack => {
      try { remoteStream.removeTrack(oldTrack); } catch {}
    });
    if (!remoteStream.getTracks().some(t => t.id === track.id)) remoteStream.addTrack(track);

    if (remoteVideo.srcObject !== remoteStream) remoteVideo.srcObject = remoteStream;
    remoteReady = true;
    lastSignal = `REMOTE ${track.kind.toUpperCase()}`;
    setRemoteStatus('Starter motstanderens video…');
    remotePlaceholder?.classList.remove('hidden');

    const wake = async () => {
      if (track.readyState !== 'live') return;
      const ok = await playRemote();
      if (ok && track.kind === 'video') showRemoteVideo();
      debug();
    };

    track.onunmute = wake;
    track.onmute = () => {
      lastSignal = `${track.kind.toUpperCase()} muted`;
      debug();
    };
    track.onended = () => {
      // Do not start a reconnect loop here. A replaced receiver track can legitimately end.
      lastSignal = `${track.kind.toUpperCase()} ended`;
      debug();
    };

    if (track.kind === 'video') {
      remoteVideo.onloadedmetadata = wake;
      remoteVideo.oncanplay = wake;
      remoteVideo.onplaying = () => {
        showRemoteVideo();
        lastSignal = 'REMOTE PLAYING';
        debug();
      };
    }

    wake();
    schedulePlayRetry();
    debug('remote track attached');
  };

  // Keep media rendering passive. A healthy connected peer must never be destroyed just
  // because Chrome pauses rendering briefly or requestVideoFrameCallback misses frames.
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) playRemote();
  });
  window.addEventListener('focus', playRemote);
  window.addEventListener('beforeunload', () => clearTimeout(playRetryTimer));

  debug('passive remote media renderer loaded');
})();