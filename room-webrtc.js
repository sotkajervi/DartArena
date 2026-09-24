// DartArena WebRTC reliability layer.
// Loaded after room.js so the existing app/auth logic stays untouched.
(() => {
  const ICE_CONFIG = {
    iceServers: [
      { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302', 'stun:stun2.l.google.com:19302'] }
    ],
    iceCandidatePoolSize: 10,
    bundlePolicy: 'max-bundle'
  };

  let makingOffer = false;
  let ignoreOffer = false;
  let isSettingRemoteAnswerPending = false;
  let iceRestartAttempts = 0;
  let checkingTimer = null;
  let disconnectedTimer = null;
  let generation = 0;
  const polite = () => profile?.id === c?.challenged_id;

  function clearRecoveryTimers() {
    clearTimeout(checkingTimer);
    clearTimeout(disconnectedTimer);
    checkingTimer = disconnectedTimer = null;
  }

  async function sendDescription() {
    if (!pc || pc.signalingState === 'closed') return;
    try {
      makingOffer = true;
      await pc.setLocalDescription();
      lastSignal = `${pc.localDescription.type.toUpperCase()} sent`;
      debug(`generation:${generation}`);
      await send('signal', { description: pc.localDescription, generation });
    } catch (e) {
      debug(`negotiation error:${e?.name || 'unknown'}`);
    } finally {
      makingOffer = false;
    }
  }

  async function requestIceRestart(reason) {
    if (!pc || leaving || pc.signalingState === 'closed') return;
    if (iceRestartAttempts >= 3) {
      debug(`ICE restart exhausted:${reason}`);
      return hardRebuild(reason);
    }
    iceRestartAttempts++;
    lastSignal = `ICE restart ${iceRestartAttempts}/3`;
    debug(reason);
    $('cameraStatus').textContent = `Gjenoppretter video… (${iceRestartAttempts}/3)`;
    try {
      pc.restartIce();
      if (pc.signalingState === 'stable' && profile.id === c.challenger_id) await sendDescription();
    } catch (e) {
      debug(`restart error:${e?.name || 'unknown'}`);
      setTimeout(() => requestIceRestart('restart retry'), 900);
    }
  }

  async function hardRebuild(reason) {
    clearRecoveryTimers();
    generation++;
    iceRestartAttempts = 0;
    offerSent = false;
    pendingCandidates = [];
    if (pc) {
      pc.ontrack = pc.onicecandidate = pc.onconnectionstatechange = pc.oniceconnectionstatechange = pc.onnegotiationneeded = null;
      try { pc.close(); } catch {}
      pc = null;
    }
    lastSignal = 'PEER REBUILD';
    debug(reason);
    $('cameraStatus').textContent = 'Bygger videoforbindelsen på nytt…';
    await send('ready', { ready: true, generation });
    setTimeout(() => maybeConnect(), 500);
  }

  function watchIceState() {
    if (!pc) return;
    const state = pc.iceConnectionState;
    debug(`ICE:${state}`);
    if (state === 'connected' || state === 'completed') {
      clearRecoveryTimers();
      iceRestartAttempts = 0;
      return;
    }
    if (state === 'checking') {
      clearTimeout(checkingTimer);
      checkingTimer = setTimeout(() => {
        if (pc?.iceConnectionState === 'checking') requestIceRestart('ICE checking timeout');
      }, 8000);
    } else if (state === 'disconnected') {
      clearTimeout(disconnectedTimer);
      disconnectedTimer = setTimeout(() => {
        if (pc?.iceConnectionState === 'disconnected') requestIceRestart('ICE disconnected');
      }, 3500);
    } else if (state === 'failed') {
      requestIceRestart('ICE failed');
    }
  }

  ensurePeer = async function () {
    if (pc && !['closed', 'failed'].includes(pc.connectionState)) return pc;
    if (pc) { try { pc.close(); } catch {} }
    pc = new RTCPeerConnection(ICE_CONFIG);
    generation++;
    stream.getTracks().forEach(track => pc.addTrack(track, stream));
    pc.ontrack = attachRemote;
    pc.onicecandidate = ({ candidate }) => {
      if (candidate) {
        lastSignal = 'ICE sent';
        debug();
        send('signal', { candidate, generation });
      }
    };
    pc.oniceconnectionstatechange = watchIceState;
    pc.onsignalingstatechange = () => debug();
    pc.onnegotiationneeded = async () => {
      // Only the deterministic offerer initiates normal/restart offers.
      if (profile.id !== c.challenger_id || pc.signalingState !== 'stable') return;
      await sendDescription();
    };
    pc.onconnectionstatechange = () => {
      debug();
      if (!pc) return;
      if (pc.connectionState === 'connected') {
        clearRecoveryTimers();
        iceRestartAttempts = 0;
        remoteReady = true;
        $('cameraStatus').textContent = `Tilkoblet ${names[other] || 'motstander'}`;
      } else if (pc.connectionState === 'failed') {
        requestIceRestart('peer failed');
      }
    };
    debug(`peer generation:${generation}`);
    return pc;
  };

  maybeConnect = async function () {
    if (!localReady || !stream || !remoteReady) return;
    if (pc?.connectionState === 'connected') return;
    const peer = await ensurePeer();
    if (profile.id === c.challenger_id && !offerSent && peer.signalingState === 'stable') {
      offerSent = true;
      await sendDescription();
    }
  };

  handleSignal = async function (s) {
    if (!localReady || !stream) return;
    try {
      remoteReady = true;
      const peer = await ensurePeer();
      if (s.description) {
        const readyForOffer = !makingOffer && (peer.signalingState === 'stable' || isSettingRemoteAnswerPending);
        const offerCollision = s.description.type === 'offer' && !readyForOffer;
        ignoreOffer = !polite() && offerCollision;
        if (ignoreOffer) {
          debug('colliding offer ignored');
          return;
        }
        isSettingRemoteAnswerPending = s.description.type === 'answer';
        await peer.setRemoteDescription(s.description);
        isSettingRemoteAnswerPending = false;
        lastSignal = `${s.description.type.toUpperCase()} remote set`;
        debug();
        while (pendingCandidates.length) {
          const candidate = pendingCandidates.shift();
          try { await peer.addIceCandidate(candidate); } catch (e) { if (!ignoreOffer) throw e; }
        }
        if (s.description.type === 'offer') {
          await peer.setLocalDescription();
          lastSignal = 'ANSWER sent';
          debug();
          await send('signal', { description: peer.localDescription, generation });
        }
      } else if (s.candidate) {
        if (ignoreOffer) return;
        if (peer.remoteDescription) {
          try { await peer.addIceCandidate(s.candidate); } catch (e) { if (!ignoreOffer) throw e; }
          debug('ICE added');
        } else {
          pendingCandidates.push(s.candidate);
          debug('ICE queued');
        }
      }
    } catch (e) {
      isSettingRemoteAnswerPending = false;
      debug(`signal error:${e?.name || 'unknown'}`);
      console.error(e);
    }
  };

  restartPeer = async function () {
    await requestIceRestart('legacy recovery request');
  };

  window.addEventListener('beforeunload', clearRecoveryTimers);
  debug('robust ICE layer loaded');
})();