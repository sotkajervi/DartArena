class DartArenaSFU {
  constructor(workerUrl) {
    this.workerUrl = workerUrl.replace(/\/$/, '');
    this.publisher = null;
    this.subscriber = null;
    this.publisherSessionId = null;
    this.subscriberSessionId = null;
  }

  async request(path, body, method = 'POST') {
    const response = await fetch(this.workerUrl + path, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body)
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.ok === false) throw new Error(data?.sfu?.errorDescription || data?.error || `HTTP ${response.status}`);
    return data.sfu ?? data;
  }

  async waitForIce(pc, timeout = 5000) {
    if (pc.iceGatheringState === 'complete') return;
    await new Promise(resolve => {
      const timer = setTimeout(done, timeout);
      const check = () => pc.iceGatheringState === 'complete' && done();
      const self = this;
      function done() { clearTimeout(timer); pc.removeEventListener('icegatheringstatechange', check); resolve(self); }
      pc.addEventListener('icegatheringstatechange', check);
    });
  }

  newPeer() {
    return new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.cloudflare.com:3478' }] });
  }

  async publish(stream) {
    this.closePublisher();
    const pc = this.newPeer();
    this.publisher = pc;
    const entries = stream.getTracks().map(track => ({
      track,
      transceiver: pc.addTransceiver(track, { direction: 'sendonly' }),
      trackName: track.kind === 'video' ? 'camera' : 'microphone'
    }));
    await pc.setLocalDescription(await pc.createOffer());
    await this.waitForIce(pc);
    const session = await this.request('/api/sfu/session');
    this.publisherSessionId = session.sessionId;
    const tracks = entries.map(x => ({ location: 'local', mid: x.transceiver.mid, trackName: x.trackName }));
    const result = await this.request('/api/sfu/publish', {
      sessionId: this.publisherSessionId,
      sessionDescription: pc.localDescription,
      tracks
    });
    if (!result.sessionDescription) throw new Error('SFU publish returned no sessionDescription');
    await pc.setRemoteDescription(result.sessionDescription);
    return { sessionId: this.publisherSessionId, tracks: tracks.map(x => x.trackName) };
  }

  async subscribe(publication, onTrack) {
    this.closeSubscriber();
    const pc = this.newPeer();
    this.subscriber = pc;
    pc.ontrack = onTrack;
    const session = await this.request('/api/sfu/session');
    this.subscriberSessionId = session.sessionId;
    const tracks = (publication.tracks || ['camera', 'microphone']).map(trackName => ({
      location: 'remote', sessionId: publication.sessionId, trackName
    }));
    const result = await this.request('/api/sfu/subscribe', { sessionId: this.subscriberSessionId, tracks });
    if (!result.sessionDescription) throw new Error('SFU subscribe returned no sessionDescription');
    await pc.setRemoteDescription(result.sessionDescription);
    await pc.setLocalDescription(await pc.createAnswer());
    await this.waitForIce(pc);
    await this.request('/api/sfu/renegotiate', {
      sessionId: this.subscriberSessionId,
      sessionDescription: pc.localDescription
    }, 'PUT');
    return this.subscriberSessionId;
  }

  closePublisher() {
    if (this.publisher) { try { this.publisher.close(); } catch {} }
    this.publisher = null;
    this.publisherSessionId = null;
  }

  closeSubscriber() {
    if (this.subscriber) { try { this.subscriber.close(); } catch {} }
    this.subscriber = null;
    this.subscriberSessionId = null;
  }

  close() {
    this.closePublisher();
    this.closeSubscriber();
  }
}

window.DartArenaSFU = DartArenaSFU;
