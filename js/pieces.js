(function (G) {
  'use strict';
  const T = G.Tetris = G.Tetris || {};
  const C = T.Config || require('./config');

  // El índice + 1 es el id de tipo (y el valor de celda en el tablero)
  const KEYS = ['I', 'O', 'T', 'S', 'Z', 'J', 'L', 'NUT', 'PLUS', 'U', 'Y', 'DOT'];
  const TYPE = {};
  KEYS.forEach((k, i) => { TYPE[k] = i + 1; });

  const SHAPES = {
    I:    [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]],
    O:    [[2,2],[2,2]],
    T:    [[0,3,0],[3,3,3],[0,0,0]],
    S:    [[0,4,4],[4,4,0],[0,0,0]],
    Z:    [[5,5,0],[0,5,5],[0,0,0]],
    J:    [[6,0,0],[6,6,6],[0,0,0]],
    L:    [[0,0,7],[7,7,7],[0,0,0]],
    NUT:  [[8,8,8],[8,0,8],[8,8,8]],           // Tuerca: 3×3 con hueco central
    PLUS: [[0,9,0],[9,9,9],[0,9,0]],           // pentominó +
    U:    [[10,0,10],[10,10,10],[0,0,0]],      // pentominó U
    Y:    [[0,11,0,0],[11,11,11,11],[0,0,0,0],[0,0,0,0]], // pentominó Y
    DOT:  [[12]],                              // 1×1 (recompensa)
  };

  const shapeOf = type => SHAPES[KEYS[type - 1]].map(r => r.slice());

  function makePiece(type) {
    const shape = shapeOf(type);
    return {
      type,
      key: KEYS[type - 1],
      shape,
      x: Math.floor(C.COLS / 2) - Math.floor(shape[0].length / 2),
      y: 0,
    };
  }

  // Cola de piezas con generador ponderado. items[0] es la siguiente pieza.
  class PieceQueue {
    constructor(rng, weights) {
      this.rng = rng || Math.random;
      this.table = Object.entries(weights || C.pieceWeights)
        .map(([k, w]) => [TYPE[k], w]);
      this.total = this.table.reduce((s, [, w]) => s + w, 0);
      this.items = [];
    }
    randomType() {
      let r = this.rng() * this.total;
      for (const [type, w] of this.table) {
        if ((r -= w) < 0) return type;
      }
      return this.table[this.table.length - 1][0];
    }
    fill(n = 7) {
      while (this.items.length < n) this.items.push(this.randomType());
    }
    take() {
      this.fill();
      const t = this.items.shift();
      this.fill();
      return t;
    }
    peek(n) {
      this.fill(Math.max(7, n));
      return this.items.slice(0, n);
    }
    pushFront(type) { this.items.unshift(type); }
    snapshot() { return this.items.slice(); }
    restore(items) { this.items = items.slice(); }
  }

  const Pieces = { KEYS, TYPE, SHAPES, shapeOf, makePiece, PieceQueue };
  T.Pieces = Pieces;
  if (typeof module !== 'undefined' && module.exports) module.exports = Pieces;
})(typeof window !== 'undefined' ? window : globalThis);
