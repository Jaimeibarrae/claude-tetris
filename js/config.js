(function (G) {
  'use strict';
  const T = G.Tetris = G.Tetris || {};

  // Toda la jugabilidad configurable vive aquí (tiempos en ms).
  const CONFIG = {
    COLS: 10,
    ROWS: 20,
    CELL: { GARBAGE: 13, WILD: 14 }, // valores especiales de celda

    drop: { base: 1000, min: 100, step: 90 },

    lineScores: [0, 100, 300, 500, 800],
    tSpinScores: [400, 800, 1200, 1600], // índice = líneas eliminadas
    b2bMultiplier: 1.5,
    perfectClearBonus: 3000,
    comboMax: 8,

    // Probabilidad relativa de cada pieza (la 1×1 no está: solo sale como recompensa de un Tetris)
    pieceWeights: { I: 10, O: 10, T: 10, S: 10, Z: 10, J: 10, L: 10, PLUS: 4, U: 4, Y: 4, NUT: 3 },

    powerUps: {
      everyLines: 5,   // cada N líneas se tira el dado
      chance: 0.7,     // probabilidad de que aparezca un power-up
      freezeMs: 5000,
      pool: ['bomb', 'lightning', 'tint', 'gravity', 'freeze'],
    },

    energy: {
      max: 100,
      perLine: 15,
      foresightMs: 20000,
      slowMs: 10000,
      slowFactor: 3,
      costs: { foresight: 30, swap: 20, slow: 30, undo: 50, reserve: 20 },
    },

    // Índice = valor de celda (0 = vacío)
    colors: [
      null,
      '#4dd0e1', // 1 I
      '#ffd54f', // 2 O
      '#ba68c8', // 3 T
      '#81c784', // 4 S
      '#e57373', // 5 Z
      '#90caf9', // 6 J
      '#ffb74d', // 7 L
      '#b0bec5', // 8 Tuerca
      '#f06292', // 9 +
      '#aed581', // 10 U
      '#7986cb', // 11 Y
      '#fff176', // 12 1×1
      '#5c6078', // 13 basura
      '#ffffff', // 14 comodín (se dibuja arcoíris)
    ],
    colorsLight: [
      null,
      '#00acc1', '#f9a825', '#8e24aa', '#43a047', '#e53935', '#1e88e5', '#fb8c00',
      '#607d8b', '#d81b60', '#7cb342', '#3949ab', '#fbc02d', '#8a8ea8', '#ffffff',
    ],
  };

  T.Config = CONFIG;
  if (typeof module !== 'undefined' && module.exports) module.exports = CONFIG;
})(typeof window !== 'undefined' ? window : globalThis);
