// WebRTC v7 recovery guard: fixes ANSWER being left on a failed peer during coordinated reset.
(() => {
  const boot = setInterval(() => {
    if (typeof db === 'undefined' || typeof matchId === 'undefined' || !matchId || typeof profile === 'undefined' || !profile || typeof m === 'undefined' || !m || typeof other === 'undefined' || !other) return;
    clearInterval(boot);

    let resetChannel = null;
    let resetBusy = false;

    // v6 sent a "reset" broadcast from OFFER but did not subscribe to that event on ANSWER.
    // This listener makes the coordinated reset symmetrical.
    resetChannel = db.channel('match-reset-v7-' + matchId)
      .on('broadcast', { event: 'reset' }, async ({ payload }) => {
        if (!payload || payload.from !== other || isOfferer() || leaving) return;
        const nextGen = Number(payload.generation) || (generation + 1);
        if (nextGen < generation || resetBusy) return;

        resetBusy = true;
        lastSignal = `RESET received g${nextGen}`;
        recoveryState = 'resetting-answer';
        debug();

        // Kill the stale/failed ANSWER peer immediately. Do not keep audio on an invalid
        // peer while waiting for video; both tracks must be renegotiated together.
        destroyPeer();
        generation = nextGen;
        pendingCandidates = [];
        recoveryState = 'waiting-offer';
        showRemote('Gjenoppretter video…');
        lastSignal = `WAIT OFFER g${generation}`;
        debug();

        // Give OFFER enough time to create exactly one fresh peer/offer.
        clearTimeout(answerWatchTimer);
        answerWatchTimer = setTimeout(async () => {
          answerWatchTimer = null;
          if (leaving || isOfferer() || pc || generation !== nextGen) return;
          recoveryState = 'idle';
          lastSignal = `RESET offer timeout g${generation}`;
          debug();
          await requestReset('reset-offer-timeout');
        }, 12000);

        resetBusy = false;
      })
      .subscribe();

    // A failed ANSWER peer must be destroyed before asking OFFER for a reset.
    // v6 could leave Peer:failed + Recovery:handshake alive, which is the exact state
    // seen in testing (audio audible, remote video absent).
    hardFailure = function(p, reason) {
      if (p !== pc || leaving) return;
      clearTimeout(disconnectTimer);
      disconnectTimer = null;
      lastSignal = `HARD FAIL ${reason}`;
      debug();

      if (isOfferer()) {
        recoveryState = 'idle';
        destroyPeer();
        startOffererRecovery(reason);
        return;
      }

      // ANSWER: tear down first, then request one coordinated reset.
      destroyPeer();
      recoveryState = 'idle';
      requestReset(reason);
    };

    // Accept a fresh offer while ANSWER is explicitly waiting for it. The normal v6
    // signal handler then rebuilds audio + video tracks on one new RTCPeerConnection.
    const originalHandleSignal = handleSignal;
    handleSignal = async function(s) {
      if (s?.description?.type === 'offer' && !isOfferer()) {
        const sg = Number(s.generation) || 1;
        if (sg >= generation) {
          clearTimeout(answerWatchTimer);
          answerWatchTimer = null;
          if (pc && (pc.connectionState === 'failed' || pc.connectionState === 'closed')) destroyPeer();
          if (recoveryState === 'waiting-offer' || recoveryState === 'resetting-answer') recoveryState = 'idle';
        }
      }
      return originalHandleSignal(s);
    };

    window.addEventListener('beforeunload', () => {
      if (resetChannel) db.removeChannel(resetChannel);
    }, { once: true });

    lastSignal = 'v7 recovery loaded';
    debug();
  }, 100);
})();
