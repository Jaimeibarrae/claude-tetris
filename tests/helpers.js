'use strict';
const GameEngine = require('../js/engine');
const Board = require('../js/board');
const Pieces = require('../js/pieces');
const C = require('../js/config');

// RNG determinista (mulberry32)
function seeded(seed = 1) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function newEngine(opts = {}) {
  return new GameEngine({ rng: seeded(opts.seed || 7), ...opts });
}

// Coloca una pieza concreta como pieza actual
function setPiece(engine, key, x, y = 0) {
  const p = Pieces.makePiece(Pieces.TYPE[key]);
  if (x !== undefined) p.x = x;
  p.y = y;
  engine.current = p;
  return p;
}

// Rellena una fila (0 = arriba) con un valor, dejando huecos en las columnas indicadas
function fillRow(board, r, value = 1, holes = []) {
  for (let c = 0; c < C.COLS; c++) board[r][c] = holes.includes(c) ? 0 : value;
}

module.exports = { newEngine, setPiece, fillRow, seeded, Board, Pieces, C, GameEngine };
