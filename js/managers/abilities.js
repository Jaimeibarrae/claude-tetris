(function (G) {
  'use strict';
  const T = G.Tetris = G.Tetris || {};
  const C = T.Config || require('../config');

  const DEFS = [
    { id: 'foresight', name: 'Visión futura', desc: 'Muestra las próximas 5 piezas' },
    { id: 'swap',      name: 'Intercambio',   desc: 'Cambia la pieza actual por otra al azar' },
    { id: 'slow',      name: 'Tiempo lento',  desc: 'La caída es mucho más lenta' },
    { id: 'undo',      name: 'Deshacer',      desc: 'Vuelve antes de la última colocación' },
    { id: 'reserve',   name: 'Reserva',       desc: 'Rearma el HOLD para usarlo otra vez' },
  ];

  // Energía + efectos temporales de las habilidades (la lógica de cada efecto vive en el motor).
  class AbilityManager {
    constructor(cfg) { this.cfg = (cfg || C).energy; this.reset(); }
    reset() { this.energy = 0; this.foresightMs = 0; this.slowMs = 0; }
    tick(dt) {
      if (this.foresightMs > 0) this.foresightMs = Math.max(0, this.foresightMs - dt);
      if (this.slowMs > 0) this.slowMs = Math.max(0, this.slowMs - dt);
    }
    get full() { return this.energy >= this.cfg.max; }
    cost(id) { return this.cfg.costs[id]; }
    // Devuelve true si la barra se llenó con esta aportación.
    addEnergy(lines) {
      const was = this.full;
      this.energy = Math.min(this.cfg.max, this.energy + lines * this.cfg.perLine);
      return !was && this.full;
    }
    spend(id) { this.energy = Math.max(0, this.energy - this.cost(id)); }
  }

  AbilityManager.DEFS = DEFS;
  T.AbilityManager = AbilityManager;
  if (typeof module !== 'undefined' && module.exports) module.exports = AbilityManager;
})(typeof window !== 'undefined' ? window : globalThis);
