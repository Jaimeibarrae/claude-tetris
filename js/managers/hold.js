(function (G) {
  'use strict';
  const T = G.Tetris = G.Tetris || {};

  // Reserva de pieza: una vez por pieza colocada.
  class HoldManager {
    constructor() { this.reset(); }
    reset() { this.type = null; this.used = false; }
    canUse() { return !this.used; }
    // Guarda `currentType` y devuelve el tipo que estaba reservado (o null si estaba vacío).
    swap(currentType) {
      const previous = this.type;
      this.type = currentType;
      this.used = true;
      return previous;
    }
    unlock() { this.used = false; }
    rearm() { this.used = false; }
    snapshot() { return { type: this.type, used: this.used }; }
    restore(s) { this.type = s.type; this.used = s.used; }
  }

  T.HoldManager = HoldManager;
  if (typeof module !== 'undefined' && module.exports) module.exports = HoldManager;
})(typeof window !== 'undefined' ? window : globalThis);
