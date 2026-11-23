// All sound is synthesised live with WebAudio — no audio files, no network.
// Engine hum, sirens, gunshots, pickups, UI blips and a low-key city groove.
export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.muted = false;
    this.musicOn = true;
    this.engineOsc = null;
    this.engineGain = null;
    this.sirenOsc = null;
    this.sirenGain = null;
    this.sirenTimer = 0;
    this.musicTimer = 0;
    this.musicStep = 0;
    this.noiseBuffer = null;
  }

  // Call from a user gesture (key/click). Safe to call repeatedly.
  ensure() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
      return;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.5;
      this.master.connect(this.ctx.destination);
      // White noise buffer, reused by shots, hats and explosions.
      const len = this.ctx.sampleRate * 0.5;
      this.noiseBuffer = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = this.noiseBuffer.getChannelData(0);
      for (let i = 0; i < len; i += 1) data[i] = Math.random() * 2 - 1;
      this.startEngine();
    } catch (e) {
      this.ctx = null;
    }
  }

  setMuted(muted) {
    this.muted = muted;
    if (this.master) this.master.gain.value = muted ? 0 : 0.5;
  }

  _tone(freq, dur, type, vol, when = 0, slideTo = 0) {
    if (!this.ctx) return;
    try {
      const t0 = this.ctx.currentTime + when;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, t0);
      if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + dur);
      gain.gain.setValueAtTime(vol, t0);
      gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
      osc.connect(gain);
      gain.connect(this.master);
      osc.start(t0);
      osc.stop(t0 + dur + 0.02);
    } catch (e) { /* audio is best-effort */ }
  }

  _noise(dur, vol, filterFreq, when = 0) {
    if (!this.ctx || !this.noiseBuffer) return;
    try {
      const t0 = this.ctx.currentTime + when;
      const src = this.ctx.createBufferSource();
      src.buffer = this.noiseBuffer;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = filterFreq;
      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(vol, t0);
      gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
      src.connect(filter);
      filter.connect(gain);
      gain.connect(this.master);
      src.start(t0);
      src.stop(t0 + dur + 0.02);
    } catch (e) { /* audio is best-effort */ }
  }

  shoot() { this._noise(0.12, 0.5, 2800); this._tone(160, 0.08, 'square', 0.18, 0, 60); }
  punch() { this._noise(0.09, 0.35, 900); }
  thud() { this._tone(90, 0.15, 'sine', 0.4, 0, 45); }
  hurt() { this._tone(220, 0.18, 'sawtooth', 0.2, 0, 110); }
  pickup() { this._tone(660, 0.09, 'sine', 0.3); this._tone(990, 0.12, 'sine', 0.3, 0.08); }
  objective() { this._tone(520, 0.1, 'triangle', 0.3); this._tone(780, 0.14, 'triangle', 0.3, 0.09); }
  reload() { this._tone(300, 0.05, 'square', 0.12); this._tone(420, 0.05, 'square', 0.12, 0.07); }
  uiClick() { this._tone(440, 0.06, 'sine', 0.2); }
  missionStart() { this._tone(392, 0.12, 'triangle', 0.3); this._tone(523, 0.12, 'triangle', 0.3, 0.1); this._tone(659, 0.2, 'triangle', 0.3, 0.2); }
  missionComplete() {
    const notes = [523, 659, 784, 1047];
    notes.forEach((n, i) => this._tone(n, 0.18, 'triangle', 0.32, i * 0.11));
  }
  missionFail() { this._tone(330, 0.25, 'sawtooth', 0.22, 0, 165); this._tone(220, 0.35, 'sawtooth', 0.22, 0.2, 110); }
  sirenSting() { this._tone(700, 0.16, 'square', 0.14); this._tone(950, 0.16, 'square', 0.14, 0.16); }
  explosion() { this._noise(0.7, 0.7, 500); this._tone(70, 0.6, 'sine', 0.5, 0, 30); }
  carEnter() { this._tone(180, 0.08, 'square', 0.15, 0, 320); }
  horn() { this._tone(370, 0.18, 'square', 0.16); this._tone(466, 0.18, 'square', 0.12); }

  // --- Engine hum: one looping oscillator whose pitch follows speed. ---
  startEngine() {
    if (!this.ctx || this.engineOsc) return;
    try {
      this.engineOsc = this.ctx.createOscillator();
      this.engineOsc.type = 'sawtooth';
      this.engineOsc.frequency.value = 50;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 420;
      this.engineGain = this.ctx.createGain();
      this.engineGain.gain.value = 0;
      this.engineOsc.connect(filter);
      filter.connect(this.engineGain);
      this.engineGain.connect(this.master);
      this.engineOsc.start();
    } catch (e) { /* best-effort */ }
  }

  setEngine(speedRatio, driving) {
    if (!this.ctx || !this.engineOsc) return;
    const t = this.ctx.currentTime;
    this.engineOsc.frequency.setTargetAtTime(55 + speedRatio * 140, t, 0.08);
    this.engineGain.gain.setTargetAtTime(driving ? 0.05 + speedRatio * 0.05 : 0, t, 0.1);
  }

  // --- Police siren: two-tone wail while any cruiser is near. ---
  setSiren(on) {
    if (!this.ctx) return;
    if (on && !this.sirenOsc) {
      try {
        this.sirenOsc = this.ctx.createOscillator();
        this.sirenOsc.type = 'triangle';
        this.sirenOsc.frequency.value = 750;
        this.sirenGain = this.ctx.createGain();
        this.sirenGain.gain.value = 0.045;
        this.sirenOsc.connect(this.sirenGain);
        this.sirenGain.connect(this.master);
        this.sirenOsc.start();
        this.sirenTimer = 0;
      } catch (e) { this.sirenOsc = null; }
    } else if (!on && this.sirenOsc) {
      try { this.sirenOsc.stop(); } catch (e) { /* already stopped */ }
      this.sirenOsc = null;
      this.sirenGain = null;
    }
  }

  // --- Music: a slow Am–F–C–G groove, scheduled a step at a time. ---
  update(dt, playing) {
    if (!this.ctx || !this.musicOn) return;
    // Siren wail.
    if (this.sirenOsc) {
      this.sirenTimer += dt;
      const phase = Math.floor(this.sirenTimer * 1.6) % 2;
      this.sirenOsc.frequency.setTargetAtTime(phase === 0 ? 750 : 980, this.ctx.currentTime, 0.05);
    }
    if (!playing) return;
    this.musicTimer -= dt;
    if (this.musicTimer > 0) return;
    this.musicTimer = 0.24; // eighth notes at ~125 bpm
    const step = this.musicStep;
    this.musicStep = (this.musicStep + 1) % 64;
    const chords = [
      [110, 130.8, 164.8], // Am
      [87.3, 110, 130.8], // F
      [130.8, 164.8, 196], // C
      [98, 123.5, 146.8], // G
    ];
    const chord = chords[Math.floor(step / 16) % 4];
    const beat = step % 16;
    // Bass on beats 0, 3, 6, 8, 11, 14.
    if ([0, 3, 6, 8, 11, 14].includes(beat)) {
      this._tone(chord[0] / 2, 0.22, 'triangle', 0.22);
    }
    // Soft pad at the top of each bar.
    if (beat === 0) {
      chord.forEach((f) => this._tone(f, 1.6, 'sine', 0.05));
    }
    // Hat ticks.
    if (beat % 2 === 1) this._noise(0.03, 0.05, 6000);
    // Kick on the four.
    if (beat % 4 === 0) this._tone(120, 0.12, 'sine', 0.25, 0, 45);
  }
}
