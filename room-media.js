// DartArena remote media reliability layer.
// Keeps signaling/offer-answer logic in room.js untouched and only hardens media rendering.
(() => {
  const remoteVideo = $('remoteVideo');
  const remotePlaceholder = $('remotePlaceholder');
  const remoteAudioBtn = $('remoteAudioBtn');
  const cameraStatus = $('cameraStatus');
  let remoteStream = new MediaStream();
  let lastFrameAt = 0;
  let connectedAt = 0;
  let recoveryRequested = false;
  let frameWatchStarted = false;

  function markFrame() {
    lastFrameAt = Date.now();
    recoveryRequested = false;
  }

  async function playRemote() {
    if (!remoteVideo.srcObject || !remoteVideo.srcObject.getVideoTracks().length) return false;
    try {
      await remoteVideo.play();
      remotePlaceholder.classList.add('hidden');
      remoteAudioBtn.classList.remove('hidden');
      cameraStatus.textContent = `Tilkoblet ${names[other] || 'motstander'}`;
      return true;
    } catch (e) {
      // Muted video should normally autoplay. Retry once after forcing muted/playsInline.
      remoteVideo.muted = true;
      remoteVideo.playsInline = true;
      try {
        await remoteVideo.play();
        remotePlaceholder.classList.add('hidden');
        remoteAudioBtn.classList.remove('hidden');
        return true;
      } catch (e2) {
        lastSignal = `REMOTE PLAY ${e2?.name || 'error'}`;
        debug();
        return false;
      }
    }
  }

  function installFrameWatch() {
    if (frameWatchStarted || typeof remoteVideo.requestVideoFrameCallback !== 'function') return;
    frameWatchStarted = true;
    const onFrame = () => {
      markFrame();
      remoteVideo.requestVideoFrameCallback(onFrame);
    };
    remoteVideo.requestVideoFrameCallback(onFrame);
  }

  // room.js createPeer() calls this function from its ontrack handler, so replacing it
  // here fixes both current roles without changing the stable offer/answer code.
  attachRemoteTrack = function (e) {
    const track = e.track;
    if (!track) return;

    // Prefer the receiver stream when Chrome supplies one; otherwise maintain one stable stream.
    const incoming = e.streams?.[0];
    if (incoming) {
      incoming.getTracks().forEach(t => {
        if (!remoteStream.getTracks().some(x => x.id === t.id)) remoteStream.addTrack(t);
      });
    }
    if (!remoteStream.getTracks().some(t => t.id === track.id)) remoteStream.addTrack(track);

    if (remoteVideo.srcObject !== remoteStream) remoteVideo.srcObject = remoteStream;
    remoteReady = true;
    lastSignal = `REMOTE ${track.kind.toUpperCase()}`;
    remotePlaceholder.textContent = 'Starter motstanderens video…';
    remotePlaceholder.classList.remove('hidden');

    const wakeVideo = () => {
      if (track.kind === 'video') markFrame();
      playRemote();
      debug();
    };

    track.onunmute = wakeVideo;
    track.onended = () => {
      lastSignal = `${track.kind.toUpperCase()} ended`;
      debug();
      scheduleRecovery('remote track ended', 300);
    };
    track.onmute = () => {
      lastSignal = `${track.kind.toUpperCase()} muted`;
      debug();
    };

    remoteVideo.onloadedmetadata = wakeVideo;
    remoteVideo.oncanplay = wakeVideo;
    remoteVideo.onplaying = () => {
      markFrame();
      remotePlaceholder.classList.add('hidden');
      cameraStatus.textContent = `Tilkoblet ${names[other] || 'motstander'}`;
      debug('remote playing');
    };

    installFrameWatch();
    playRemote();
    debug('remote track attached');
  };

  // Reset the persistent receiver stream whenever room.js intentionally rebuilds the peer.
  const originalResetPeer = resetPeer;
  resetPeer = async function (...args) {
    try { remoteStream.getTracks().forEach(t => remoteStream.removeTrack(t)); } catch {}
    remoteStream = new MediaStream();
    lastFrameAt = 0;
    connectedAt = 0;
    recoveryRequested = false;
    remoteVideo.srcObject = null;
    return originalResetPeer.apply(this, args);
  };

  // A WebRTC peer can report connected even when Chrome has stopped rendering media.
  // Detect that exact state instead of repeatedly rebuilding healthy connections.
  setInterval(() => {
    if (!pc || pc.connectionState !== 'connected' || leaving) {
      connectedAt = 0;
      return;
    }
    if (!connectedAt) connectedAt = Date.now();

    const videoTrack = remoteVideo.srcObject?.getVideoTracks?.()[0];
    const hasLiveTrack = videoTrack && videoTrack.readyState === 'live';
    const renderedRecently = lastFrameAt && Date.now() - lastFrameAt < 6000;

    if (hasLiveTrack && !remoteVideo.paused) {
      playRemote();
    }

    // Give a new connection time to deliver its first frame. If ICE is connected but no
    // usable video arrives, rebuild both peers through the existing synchronized reset.
    if (Date.now() - connectedAt > 7000 && (!hasLiveTrack || !renderedRecently) && !recoveryRequested) {
      recoveryRequested = true;
      lastSignal = !hasLiveTrack ? 'NO REMOTE VIDEO TRACK' : 'REMOTE VIDEO STALLED';
      debug();
      remotePlaceholder.classList.remove('hidden');
      remotePlaceholder.textContent = 'Gjenoppretter motstanderens video…';
      scheduleRecovery('connected without remote video frames', 200);
      setTimeout(() => { recoveryRequested = false; }, 10000);
    }
  }, 1500);

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) playRemote();
  });
  window.addEventListener('focus', playRemote);

  debug('remote media reliability loaded');
})();