// Camera/microphone selection for the DartArena waiting room.
// Keeps the current WebRTC connection alive by replacing the relevant sender track.
(() => {
  const cameraSelect = document.getElementById('cameraDeviceSelect');
  const micSelect = document.getElementById('micDeviceSelect');
  const micLevelFill = document.getElementById('micLevelFill');
  const micLevelText = document.getElementById('micLevelText');
  const controls = document.getElementById('roomDeviceControls');
  if (!cameraSelect || !micSelect || !controls) return;

  const CAMERA_KEY = 'dartarena-preferred-camera';
  const MIC_KEY = 'dartarena-preferred-microphone';
  let switching = false;
  let meterContext = null;
  let meterSource = null;
  let meterAnalyser = null;
  let meterFrame = 0;
  let initializedStream = null;

  const currentTrack = kind => stream?.getTracks?.().find(track => track.kind === kind && track.readyState === 'live') || null;
  const currentDeviceId = kind => currentTrack(kind)?.getSettings?.().deviceId || '';

  function setMicLevel(value) {
    const pct = Math.max(0, Math.min(100, Math.round(value)));
    if (micLevelFill) micLevelFill.style.width = `${pct}%`;
  }

  async function stopMeter() {
    if (meterFrame) cancelAnimationFrame(meterFrame);
    meterFrame = 0;
    if (meterSource) {
      try { meterSource.disconnect(); } catch {}
      meterSource = null;
    }
    meterAnalyser = null;
    if (meterContext) {
      try { await meterContext.close(); } catch {}
      meterContext = null;
    }
    setMicLevel(0);
  }

  async function startMeter(track) {
    await stopMeter();
    if (!track || track.readyState !== 'live') {
      if (micLevelText) micLevelText.textContent = 'Ingen mikrofon';
      return;
    }

    const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextCtor) {
      if (micLevelText) micLevelText.textContent = 'Mikrofon aktiv';
      return;
    }

    try {
      meterContext = new AudioContextCtor();
      await meterContext.resume().catch(() => {});
      meterSource = meterContext.createMediaStreamSource(new MediaStream([track]));
      meterAnalyser = meterContext.createAnalyser();
      meterAnalyser.fftSize = 512;
      meterAnalyser.smoothingTimeConstant = 0.72;
      meterSource.connect(meterAnalyser);
      const data = new Uint8Array(meterAnalyser.fftSize);

      const tick = () => {
        if (!meterAnalyser) return;
        meterAnalyser.getByteTimeDomainData(data);
        let sum = 0;
        for (const sample of data) {
          const v = (sample - 128) / 128;
          sum += v * v;
        }
        const level = Math.min(100, Math.sqrt(sum / data.length) * 330);
        setMicLevel(level);
        if (micLevelText) micLevelText.textContent = level > 6 ? 'Mikrofon registrerer lyd' : 'Snakk for å teste mikrofonen';
        meterFrame = requestAnimationFrame(tick);
      };
      tick();
    } catch {
      if (micLevelText) micLevelText.textContent = 'Mikrofon aktiv';
    }
  }

  function fillSelect(select, devices, preferredId, activeId, fallbackLabel) {
    const availableIds = new Set(devices.map(device => device.deviceId));
    const wanted = availableIds.has(preferredId) ? preferredId : availableIds.has(activeId) ? activeId : devices[0]?.deviceId || '';
    select.innerHTML = '';

    if (!devices.length) {
      const option = document.createElement('option');
      option.value = '';
      option.textContent = `Ingen ${fallbackLabel.toLowerCase()} funnet`;
      select.appendChild(option);
      select.disabled = true;
      return;
    }

    devices.forEach((device, index) => {
      const option = document.createElement('option');
      option.value = device.deviceId;
      option.textContent = device.label || `${fallbackLabel} ${index + 1}`;
      select.appendChild(option);
    });
    select.disabled = switching;
    if (wanted) select.value = wanted;
  }

  async function refreshDevices() {
    if (!navigator.mediaDevices?.enumerateDevices) {
      controls.classList.add('media-unavailable');
      cameraSelect.disabled = true;
      micSelect.disabled = true;
      return;
    }

    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      fillSelect(
        cameraSelect,
        devices.filter(device => device.kind === 'videoinput'),
        localStorage.getItem(CAMERA_KEY) || '',
        currentDeviceId('video'),
        'Kamera'
      );
      fillSelect(
        micSelect,
        devices.filter(device => device.kind === 'audioinput'),
        localStorage.getItem(MIC_KEY) || '',
        currentDeviceId('audio'),
        'Mikrofon'
      );
    } catch (error) {
      console.warn('Kunne ikke hente kamera/mikrofonliste', error);
    }
  }

  function mediaConstraint(kind, deviceId) {
    if (kind === 'video') {
      return {
        video: {
          deviceId: deviceId ? { exact: deviceId } : undefined,
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 30, max: 30 }
        },
        audio: false
      };
    }
    return {
      video: false,
      audio: {
        deviceId: deviceId ? { exact: deviceId } : undefined,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
      }
    };
  }

  async function replaceDevice(kind, deviceId, save = true) {
    if (!deviceId || switching || !navigator.mediaDevices?.getUserMedia) return;
    const oldTrack = currentTrack(kind);
    if (oldTrack?.getSettings?.().deviceId === deviceId) {
      if (save) localStorage.setItem(kind === 'video' ? CAMERA_KEY : MIC_KEY, deviceId);
      if (kind === 'audio') await startMeter(oldTrack);
      return;
    }

    switching = true;
    cameraSelect.disabled = true;
    micSelect.disabled = true;
    const previousStatus = document.getElementById('cameraStatus')?.textContent || '';
    setStatus(kind === 'video' ? 'Bytter kamera…' : 'Bytter mikrofon…');

    try {
      const replacementStream = await navigator.mediaDevices.getUserMedia(mediaConstraint(kind, deviceId));
      const newTrack = kind === 'video' ? replacementStream.getVideoTracks()[0] : replacementStream.getAudioTracks()[0];
      if (!newTrack) throw new Error(`Mangler ${kind}-track`);

      const sender = pc?.getSenders?.().find(item => item.track?.kind === kind);
      if (sender) await sender.replaceTrack(newTrack);

      if (!stream) stream = new MediaStream();
      if (oldTrack) {
        try { stream.removeTrack(oldTrack); } catch {}
        try { oldTrack.stop(); } catch {}
      }
      stream.addTrack(newTrack);

      const localVideo = document.getElementById('localVideo');
      if (localVideo) {
        localVideo.srcObject = stream;
        localVideo.muted = true;
        await localVideo.play().catch(() => {});
      }

      if (kind === 'video') document.getElementById('localPlaceholder')?.classList.add('hidden');
      if (save) localStorage.setItem(kind === 'video' ? CAMERA_KEY : MIC_KEY, deviceId);
      if (kind === 'audio') await startMeter(newTrack);

      localReady = stream.getVideoTracks().some(track => track.readyState === 'live') && stream.getAudioTracks().some(track => track.readyState === 'live');
      await refreshDevices();
      await send('ready').catch(() => {});
      if (remoteReady) await connectIfReady().catch(() => {});

      if (pc?.connectionState === 'connected') setStatus(`Tilkoblet ${names[other] || 'motstander'}`);
      else setStatus('Kamera og mikrofon klart – venter på motstander…');
    } catch (error) {
      console.error(`Kunne ikke bytte ${kind}`, error);
      setStatus(cameraErrorText?.(error) || `Kunne ikke bytte ${kind === 'video' ? 'kamera' : 'mikrofon'}.`);
      await refreshDevices();
      setTimeout(() => {
        if (document.getElementById('cameraStatus')?.textContent.includes('Kunne ikke')) setStatus(previousStatus || 'Kamera klart');
      }, 2500);
    } finally {
      switching = false;
      cameraSelect.disabled = !cameraSelect.options.length;
      micSelect.disabled = !micSelect.options.length;
    }
  }

  async function applySavedDevices() {
    const savedCamera = localStorage.getItem(CAMERA_KEY) || '';
    const savedMic = localStorage.getItem(MIC_KEY) || '';
    const cameraExists = Array.from(cameraSelect.options).some(option => option.value === savedCamera);
    const micExists = Array.from(micSelect.options).some(option => option.value === savedMic);

    if (savedCamera && cameraExists && savedCamera !== currentDeviceId('video')) await replaceDevice('video', savedCamera, false);
    if (savedMic && micExists && savedMic !== currentDeviceId('audio')) await replaceDevice('audio', savedMic, false);
  }

  cameraSelect.addEventListener('change', () => replaceDevice('video', cameraSelect.value));
  micSelect.addEventListener('change', () => replaceDevice('audio', micSelect.value));
  navigator.mediaDevices?.addEventListener?.('devicechange', refreshDevices);
  document.addEventListener('pointerdown', () => meterContext?.resume?.().catch(() => {}), { passive: true });

  async function waitForRoomStream() {
    await refreshDevices();
    const timer = setInterval(async () => {
      if (!stream || initializedStream === stream || !stream.getTracks().length) return;
      initializedStream = stream;
      clearInterval(timer);
      await refreshDevices();
      await startMeter(currentTrack('audio'));
      await applySavedDevices();
    }, 150);
    setTimeout(() => clearInterval(timer), 15000);
  }

  waitForRoomStream();
  window.addEventListener('beforeunload', stopMeter);
})();