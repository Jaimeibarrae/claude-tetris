(function (G) {
  'use strict';
  const T = G.Tetris = G.Tetris || {};

  // Sonidos sintetizados con WebAudio (sin archivos). Cada nota: [frecuencia, duración s, onda, volumen, retardo s, frecuencia final]
  const SOUNDS = {
    move:      [[200, 0.03, 'square', 0.03]],
    rotate:    [[330, 0.05, 'square', 0.04]],
    lock:      [[120, 0.08, 'triangle', 0.09]],
    hold:      [[400, 0.06, 'sine', 0.08], [560, 0.08, 'sine', 0.08, 0.06]],
    drop:      [[180, 0.1, 'sawtooth', 0.05, 0, 70]],
    line:      [[523, 0.1, 'square', 0.07], [659, 0.12, 'square', 0.07, 0.08]],
    tetris:    [[523, 0.1, 'square', 0.08], [659, 0.1, 'square', 0.08, 0.08], [784, 0.1, 'square', 0.08, 0.16], [1047, 0.3, 'square', 0.09, 0.24]],
    tspin:     [[440, 0.1, 'sawtooth', 0.07], [880, 0.25, 'sawtooth', 0.07, 0.1]],
    b2b:       [[660, 0.08, 'triangle', 0.08], [880, 0.08, 'triangle', 0.08, 0.07], [1320, 0.2, 'triangle', 0.08, 0.14]],
    perfect:   [[523, 0.12, 'triangle', 0.09], [659, 0.12, 'triangle', 0.09, 0.1], [784, 0.12, 'triangle', 0.09, 0.2], [1047, 0.12, 'triangle', 0.09, 0.3], [1319, 0.4, 'triangle', 0.1, 0.4]],
    garbage:   [[90, 0.2, 'sawtooth', 0.09, 0, 50]],
    bomb:      [[160, 0.4, 'sawtooth', 0.14, 0, 40], [80, 0.5, 'square', 0.1, 0, 30]],
    lightning: [[1800, 0.05, 'sawtooth', 0.08, 0, 300], [1200, 0.15, 'square', 0.07, 0.04, 200]],
    tint:      [[500, 0.1, 'sine', 0.08], [700, 0.1, 'sine', 0.08, 0.08], [900, 0.2, 'sine', 0.08, 0.16]],
    gravity:   [[600, 0.35, 'triangle', 0.09, 0, 120]],
    freeze:    [[1400, 0.15, 'sine', 0.07], [1100, 0.15, 'sine', 0.07, 0.1], [800, 0.3, 'sine', 0.07, 0.2]],
    powerup:   [[660, 0.08, 'square', 0.06], [990, 0.12, 'square', 0.06, 0.07]],
    energy:    [[440, 0.08, 'sine', 0.07], [660, 0.08, 'sine', 0.07, 0.07], [880, 0.08, 'sine', 0.07, 0.14], [1320, 0.2, 'sine', 0.08, 0.21]],
    ability:   [[330, 0.1, 'triangle', 0.09, 0, 660], [880, 0.2, 'triangle', 0.08, 0.1]],
    error:     [[160, 0.12, 'square', 0.07], [120, 0.16, 'square', 0.07, 0.1]],
    banner:    [[300, 0.15, 'sawtooth', 0.07], [250, 0.25, 'sawtooth', 0.07, 0.15]],
    win:       [[523, 0.15, 'square', 0.08], [659, 0.15, 'square', 0.08, 0.15], [784, 0.15, 'square', 0.08, 0.3], [1047, 0.5, 'square', 0.09, 0.45]],
    lose:      [[392, 0.2, 'sawtooth', 0.08], [330, 0.2, 'sawtooth', 0.08, 0.2], [262, 0.2, 'sawtooth', 0.08, 0.4], [196, 0.6, 'sawtooth', 0.08, 0.6]],
  };

  const Sound = {
    ctx: null,
    muted: false,

    unlock() {
      if (this.ctx) {
        if (this.ctx.state === 'suspended') this.ctx.resume();
        return;
      }
      const AC = G.AudioContext || G.webkitAudioContext;
      if (AC) this.ctx = new AC();
    },

    tone(freq, dur, type, vol, delay, endFreq) {
      const ctx = this.ctx;
      const t0 = ctx.currentTime + (delay || 0);
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, t0);
      if (endFreq) osc.frequency.exponentialRampToValueAtTime(endFreq, t0 + dur);
      gain.gain.setValueAtTime(vol, t0);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t0);
      osc.stop(t0 + dur + 0.02);
    },

    play(name) {
      if (this.muted || !this.ctx || this.ctx.state !== 'running') return;
      const notes = SOUNDS[name];
      if (notes) notes.forEach(n => this.tone(n[0], n[1], n[2], n[3], n[4], n[5]));
    },

    // Intensidad creciente: cada nivel de combo sube dos semitonos y añade armónico
    combo(n) {
      if (this.muted || !this.ctx || this.ctx.state !== 'running') return;
      const f = 440 * Math.pow(2, (Math.min(n, 8) * 2) / 12);
      this.tone(f, 0.12, 'square', 0.07, 0.1);
      if (n >= 3) this.tone(f * 1.5, 0.14, 'square', 0.06, 0.18);
      if (n >= 5) this.tone(f * 2, 0.18, 'triangle', 0.07, 0.26);
    },

    setMuted(m) { this.muted = m; },
  };

  T.Sound = Sound;
})(typeof window !== 'undefined' ? window : globalThis);
