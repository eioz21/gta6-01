// audio.js — every sound is synthesised with WebAudio: no audio files, no
// network. A tiny bassline loop keeps the city humming; the engine, siren and
// gunshots are oscillators and noise shaped by hand.

export function createAudio() {
  let ctx = null;
  let master = null;
  let musicTimer = null;
  let sirenNodes = null;
  let engineNodes = null;
  let muted = false;
  let musicOn = false;

  function ensure() {
    if (ctx) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.5;
      master.connect(ctx.destination);
    } catch {
      return false;
    }
    return true;
  }

  function noiseBuffer(seconds) {
    const buf = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;
    return buf;
  }

  function blip(freq, dur, type, vol, slideTo) {
    if (!ensure() || muted) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(gain);
    gain.connect(master);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  function noiseHit(dur, vol, filterFreq) {
    if (!ensure() || muted) return;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer(dur + 0.05);
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = filterFreq;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    src.start(t);
    src.stop(t + dur + 0.05);
  }

  // A slow two-bar bassline: A minor, walking down. Loops while the game runs.
  const BASSLINE = [55, 0, 55, 65.4, 49, 0, 49, 58.3, 55, 0, 55, 65.4, 82.4, 73.4, 65.4, 49];
  let bassStep = 0;
  function bassTick() {
    if (!ctx || muted || !musicOn) return;
    const freq = BASSLINE[bassStep % BASSLINE.length];
    bassStep += 1;
    if (freq > 0) blip(freq, 0.24, 'triangle', 0.16);
    if (bassStep % 4 === 0) blip(220, 0.05, 'square', 0.03); // a faint hat tick
  }

  return {
    /** Call from the first user gesture; browsers block audio before one. */
    unlock() {
      if (ensure() && ctx.state === 'suspended') ctx.resume();
    },
    get muted() { return muted; },
    toggleMute() {
      muted = !muted;
      if (master) master.gain.value = muted ? 0 : 0.5;
      if (muted) this.stopSiren();
      return muted;
    },
    startMusic() {
      if (musicOn || !ensure()) return;
      musicOn = true;
      musicTimer = window.setInterval(bassTick, 240);
    },
    stopMusic() {
      musicOn = false;
      if (musicTimer) window.clearInterval(musicTimer);
      musicTimer = null;
    },
    shoot(kind) {
      if (kind === 'shotgun') noiseHit(0.22, 0.5, 900);
      else if (kind === 'smg') { noiseHit(0.08, 0.3, 2400); blip(180, 0.06, 'square', 0.12, 60); }
      else { noiseHit(0.12, 0.4, 1800); blip(220, 0.08, 'square', 0.14, 70); }
    },
    punch() { noiseHit(0.08, 0.3, 500); },
    pickup() { blip(660, 0.09, 'sine', 0.2); window.setTimeout(() => blip(990, 0.12, 'sine', 0.2), 70); },
    cash() { blip(880, 0.07, 'sine', 0.18); window.setTimeout(() => blip(1320, 0.1, 'sine', 0.18), 60); },
    hurt() { blip(160, 0.18, 'sawtooth', 0.22, 70); },
    missionStart() { [523, 659, 784].forEach((f, i) => window.setTimeout(() => blip(f, 0.16, 'triangle', 0.22), i * 110)); },
    missionDone() { [523, 659, 784, 1047].forEach((f, i) => window.setTimeout(() => blip(f, 0.2, 'triangle', 0.24), i * 120)); },
    missionFail() { [392, 330, 262].forEach((f, i) => window.setTimeout(() => blip(f, 0.22, 'sawtooth', 0.16), i * 140)); },
    wantedUp() { blip(440, 0.12, 'square', 0.18, 880); },
    crash() { noiseHit(0.25, 0.4, 700); },
    door() { blip(300, 0.08, 'square', 0.12, 180); },
    phone() { blip(1200, 0.1, 'sine', 0.14); window.setTimeout(() => blip(1200, 0.1, 'sine', 0.14), 160); },

    startSiren() {
      if (!ensure() || muted || sirenNodes) return;
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = 700;
      const lfo = ctx.createOscillator();
      lfo.type = 'square';
      lfo.frequency.value = 0.6;
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = 280;
      const gain = ctx.createGain();
      gain.gain.value = 0.05;
      lfo.connect(lfoGain);
      lfoGain.connect(osc.frequency);
      osc.connect(gain);
      gain.connect(master);
      osc.start();
      lfo.start();
      sirenNodes = { osc, lfo, gain };
    },
    stopSiren() {
      if (!sirenNodes) return;
      try { sirenNodes.osc.stop(); sirenNodes.lfo.stop(); } catch { /* already stopped */ }
      sirenNodes = null;
    },
    /** A continuous engine hum whose pitch follows the car's speed (0..1). */
    setEngine(level) {
      if (!ensure() || muted) { this.stopEngine(); return; }
      if (level <= 0.02) { this.stopEngine(); return; }
      if (!engineNodes) {
        const osc = ctx.createOscillator();
        osc.type = 'sawtooth';
        const gain = ctx.createGain();
        gain.gain.value = 0.04;
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 500;
        osc.connect(filter);
        filter.connect(gain);
        gain.connect(master);
        osc.start();
        engineNodes = { osc, gain, filter };
      }
      engineNodes.osc.frequency.value = 50 + level * 160;
      engineNodes.filter.frequency.value = 300 + level * 1200;
      engineNodes.gain.gain.value = 0.03 + level * 0.05;
    },
    stopEngine() {
      if (!engineNodes) return;
      try { engineNodes.osc.stop(); } catch { /* already stopped */ }
      engineNodes = null;
    },
  };
}
