// DartArena WebRTC coordinated reset receiver.
// Kept separate so the recovery protocol can be tested without touching scoring logic.
(() => {
  let resetChannel = null;
  let started = false;

  async function startResetReceiver() {
    if (started || !matchId || !profile || !other || !db) return;
    started = true;
    resetChannel = db.channel('match-reset-' + matchId, { config: { broadcast: { ack: true } } })
      .on('broadcast', { event: 'reset' }, async ({ payload }) => {
        if (!payload || payload.from !== other || isOfferer() || leaving) return;
        const nextGen = Number(payload.generation) || generation;
        if (nextGen < generation) return;
        lastSignal = `RESET received g${nextGen}`;
        recoveryState = 'resetting';
        debug();
        destroyPeer();
        generation = nextGen;
        recoveryState = 'idle';
        lastRecoveryRequestAt = Date.now();
        showRemote('Kobler til video…');
        debug();
        await send('ready', { generation });
      })
      .subscribe(status => {
        if (status === 'SUBSCRIBED') {
          lastSignal = 'RESET receiver ready';
          debug();
        }
      });
  }

  const boot = setInterval(() => {
    if (typeof profile !== 'undefined' && profile && typeof other !== 'undefined' && other && typeof db !== 'undefined') {
      clearInterval(boot);
      startResetReceiver();
    }
  }, 200);

  window.addEventListener('beforeunload', () => {
    clearInterval(boot);
    if (resetChannel) db.removeChannel(resetChannel);
  });
})();
