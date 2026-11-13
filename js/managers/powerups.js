(function (G) {
  'use strict';
  const T = G.Tetris = G.Tetris || {};
  const C = T.Config || require('../config');

  const DEFS = {
    bomb:      { name: 'Bomba',    icon: '💣', hint: 'BOMBA: elige el centro del área 3×3 (clic o flechas + Enter · Esc cancela)' },
    lightning: { name: 'Rayo',     icon: '⚡', hint: 'RAYO: elige fila o columna (R o clic derecho alterna · Enter/clic confirma · Esc cancela)' },
    tint:      { name: 'Tinte',    icon: '🎨', hint: 'TINTE: elige un bloque; todos los de su color serán comodines (Esc cancela)' },
    gravity:   { name: 'Gravedad', icon: '⬇️', hint: '' },
    freeze:    { name: 'Congelar', icon: '❄️', hint: '' },
  };

  // Un único slot de power-up. Los efectos con duración se descuentan con el dt del motor.
  class PowerUpManager {
    constructor(cfg) { this.cfg = (cfg || C).powerUps; this.reset(); }
    reset() { this.slot = null; this.counter = 0; this.freezeMs = 0; }
    tick(dt) { if (this.freezeMs > 0) this.freezeMs = Math.max(0, this.freezeMs - dt); }

    // Llamar con cada línea eliminada. Devuelve el power-up ganado o null.
    onLines(n, rng) {
      const { everyLines, chance, pool } = this.cfg;
      this.counter += n;
      let gained = null;
      while (this.counter >= everyLines) {
        this.counter -= everyLines;
        if (this.slot === null && rng() < chance) {
          this.slot = pool[Math.floor(rng() * pool.length)];
          gained = this.slot;
        }
      }
      return gained;
    }

    snapshot() { return { slot: this.slot, counter: this.counter }; }
    restore(s) { this.slot = s.slot; this.counter = s.counter; }
  }

  PowerUpManager.DEFS = DEFS;
  T.PowerUpManager = PowerUpManager;
  if (typeof module !== 'undefined' && module.exports) module.exports = PowerUpManager;
})(typeof window !== 'undefined' ? window : globalThis);
