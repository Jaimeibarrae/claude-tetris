(function (G) {
  'use strict';
  const T = G.Tetris = G.Tetris || {};
  const C = T.Config || require('../config');

  // Única fuente de puntuación por colocación: evita contar dos veces la misma acción.
  class ComboManager {
    constructor(cfg) { this.cfg = cfg || C; this.reset(); }
    reset() { this.combo = 0; this.b2b = false; }

    score({ lines, tSpin, level, perfect }) {
      const cfg = this.cfg;
      const labels = [];

      if (lines === 0) {
        this.combo = 0;
        let points = 0;
        if (tSpin) {
          points = cfg.tSpinScores[0] * level;
          labels.push('T-SPIN');
        }
        return { points, combo: 0, b2b: false, tSpin, perfect: false, labels };
      }

      this.combo = Math.min(this.combo + 1, cfg.comboMax);
      const hard = tSpin || lines === 4;
      let base = (tSpin
        ? cfg.tSpinScores[Math.min(lines, 3)]
        : cfg.lineScores[Math.min(lines, 4)]) * level;
      const b2b = hard && this.b2b;
      if (b2b) base = Math.floor(base * cfg.b2bMultiplier);
      this.b2b = hard;

      let points = base * this.combo;
      if (perfect) points += cfg.perfectClearBonus * level;

      if (tSpin) labels.push('T-SPIN');
      else if (lines === 4) labels.push('TETRIS');
      if (b2b) labels.push('BACK-TO-BACK');
      if (this.combo >= 2) labels.push('COMBO x' + this.combo);
      if (perfect) labels.push('PERFECT CLEAR');

      return { points, combo: this.combo, b2b, tSpin, perfect: !!perfect, labels };
    }

    snapshot() { return { combo: this.combo, b2b: this.b2b }; }
    restore(s) { this.combo = s.combo; this.b2b = s.b2b; }
  }

  T.ComboManager = ComboManager;
  if (typeof module !== 'undefined' && module.exports) module.exports = ComboManager;
})(typeof window !== 'undefined' ? window : globalThis);
