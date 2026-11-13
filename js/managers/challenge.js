(function (G) {
  'use strict';
  const T = G.Tetris = G.Tetris || {};
  const C = T.Config || require('../config');
  const Board = T.Board || require('../board');

  const LEVEL_NAMES = ['Fácil', 'Normal', 'Difícil'];
  const sec = s => s * 1000;

  const DEFS = [
    {
      id: 'time', name: 'Contrarreloj',
      desc: 'Elimina las líneas antes de que se acabe el tiempo.',
      levels: [{ lines: 25, timeMs: sec(120) }, { lines: 40, timeMs: sec(120) }, { lines: 40, timeMs: sec(105) }],
      goal: l => `Elimina ${l.lines} líneas en ${fmt(l.timeMs)}`,
    },
    {
      id: 'survival', name: 'Supervivencia',
      desc: 'Suben filas de basura desde abajo, cada vez más rápido.',
      levels: [
        { surviveMs: sec(120), garbageEvery: sec(10), minEvery: sec(5) },
        { surviveMs: sec(180), garbageEvery: sec(10), minEvery: sec(4) },
        { surviveMs: sec(240), garbageEvery: sec(10), minEvery: sec(3) },
      ],
      goal: l => `Sobrevive ${fmt(l.surviveMs)}`,
    },
    {
      id: 'dirty', name: 'Tablero contaminado',
      desc: 'Empiezas con bloques fijos. Limpia toda la basura.',
      levels: [{ rows: 6 }, { rows: 8 }, { rows: 10 }],
      goal: l => `Elimina toda la basura (${l.rows} filas iniciales)`,
    },
    {
      id: 'invisible', name: 'Piezas invisibles',
      desc: 'Las piezas se ocultan al bloquearse. Recuerda el tablero.',
      levels: [{ lines: 15 }, { lines: 20 }, { lines: 30 }],
      goal: l => `Elimina ${l.lines} líneas sin ver el tablero`,
    },
    {
      id: 'reverse', name: 'Rotación inversa',
      desc: 'Pasado cierto nivel, el giro se invierte.',
      levels: [{ lines: 30, reverseFrom: 3 }, { lines: 40, reverseFrom: 2 }, { lines: 50, reverseFrom: 1 }],
      goal: l => `Elimina ${l.lines} líneas`,
      warning: l => l.reverseFrom <= 1
        ? '¡Atención! La rotación está invertida desde el principio.'
        : `¡Atención! Al llegar al nivel ${l.reverseFrom} la rotación se invierte.`,
    },
  ];

  function fmt(ms) {
    const s = Math.max(0, Math.ceil(ms / 1000));
    return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
  }

  class ChallengeManager {
    constructor() { this.reset(); }
    reset() {
      this.def = null; this.cfg = null; this.levelIdx = 0;
      this.elapsed = 0; this.garbageTimer = 0; this.garbageEvery = 0;
      this.initialGarbage = 0; this.reverseNotified = false;
    }

    get active() { return !!this.def; }

    setup(engine, spec) {
      this.reset();
      if (!spec) return;
      this.def = DEFS.find(d => d.id === spec.id);
      this.levelIdx = spec.level || 0;
      this.cfg = this.def.levels[this.levelIdx];
      this.garbageEvery = this.cfg.garbageEvery || 0;
      if (this.def.id === 'dirty') {
        Board.fillGarbageRows(engine.board, this.cfg.rows, engine.rng);
        this.initialGarbage = Board.count(engine.board, C.CELL.GARBAGE);
      }
    }

    reverseActive(engine) {
      return !!this.def && this.def.id === 'reverse' && engine.level >= this.cfg.reverseFrom;
    }
    hideLocked() { return !!this.def && this.def.id === 'invisible'; }

    // Avanza el reloj del desafío. Devuelve 'won' | 'lost' | null.
    update(dt, engine) {
      if (!this.def) return null;
      this.elapsed += dt;
      if (this.def.id === 'survival') {
        this.garbageTimer += dt;
        if (this.garbageTimer >= this.garbageEvery) {
          this.garbageTimer = 0;
          this.garbageEvery = Math.max(this.cfg.minEvery, this.garbageEvery - 400);
          engine.pushGarbage();
          if (engine.status !== 'playing') return null; // el motor ya terminó la partida
        }
      }
      return this.check(engine);
    }

    // Comprueba victoria/derrota con el estado actual.
    check(engine) {
      if (!this.def) return null;
      const c = this.cfg;
      switch (this.def.id) {
        case 'time':
          if (engine.lines >= c.lines) return 'won';
          if (this.elapsed >= c.timeMs) return 'lost';
          return null;
        case 'survival':
          return this.elapsed >= c.surviveMs ? 'won' : null;
        case 'dirty':
          return Board.count(engine.board, C.CELL.GARBAGE) === 0 ? 'won' : null;
        default:
          return engine.lines >= c.lines ? 'won' : null;
      }
    }

    // Texto + progreso para el HUD.
    progress(engine) {
      if (!this.def) return null;
      const c = this.cfg;
      const clamp = v => Math.max(0, Math.min(1, v));
      switch (this.def.id) {
        case 'time':
          return { text: `Líneas ${Math.min(engine.lines, c.lines)} / ${c.lines}`, ratio: clamp(engine.lines / c.lines), timer: fmt(c.timeMs - this.elapsed) };
        case 'survival':
          return { text: 'Sobrevive', ratio: clamp(this.elapsed / c.surviveMs), timer: fmt(c.surviveMs - this.elapsed) };
        case 'dirty': {
          const left = Board.count(engine.board, C.CELL.GARBAGE);
          return { text: `Basura restante: ${left}`, ratio: clamp(1 - left / Math.max(1, this.initialGarbage)), timer: fmt(this.elapsed) };
        }
        default:
          return { text: `Líneas ${Math.min(engine.lines, c.lines)} / ${c.lines}`, ratio: clamp(engine.lines / c.lines), timer: fmt(this.elapsed) };
      }
    }
  }

  ChallengeManager.DEFS = DEFS;
  ChallengeManager.LEVEL_NAMES = LEVEL_NAMES;
  ChallengeManager.fmt = fmt;
  T.ChallengeManager = ChallengeManager;
  if (typeof module !== 'undefined' && module.exports) module.exports = ChallengeManager;
})(typeof window !== 'undefined' ? window : globalThis);
