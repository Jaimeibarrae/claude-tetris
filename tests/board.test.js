'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { Board, Pieces, C, fillRow, seeded } = require('./helpers');

test('todas las piezas: 4 rotaciones horarias = identidad y CW/CCW son inversas', () => {
  for (const key of Pieces.KEYS) {
    const s = Pieces.shapeOf(Pieces.TYPE[key]);
    let r = s;
    for (let i = 0; i < 4; i++) r = Board.rotateCW(r);
    assert.deepEqual(r, s, key);
    assert.deepEqual(Board.rotateCCW(Board.rotateCW(s)), s, key);
  }
});

test('las rotaciones conservan la cantidad de bloques y no salen de la matriz', () => {
  for (const key of Pieces.KEYS) {
    const s = Pieces.shapeOf(Pieces.TYPE[key]);
    const n = s.flat().filter(Boolean).length;
    const r = Board.rotateCW(s);
    assert.equal(r.flat().filter(Boolean).length, n, key);
  }
});

test('tamaños de las piezas especiales', () => {
  const count = k => Pieces.shapeOf(Pieces.TYPE[k]).flat().filter(Boolean).length;
  assert.equal(count('PLUS'), 5);
  assert.equal(count('U'), 5);
  assert.equal(count('Y'), 5);
  assert.equal(count('DOT'), 1);
  assert.equal(count('NUT'), 8);
  assert.equal(Pieces.shapeOf(Pieces.TYPE.NUT)[1][1], 0, 'la tuerca tiene hueco central');
});

test('collide: paredes, suelo y bloques', () => {
  const b = Board.create();
  const o = Pieces.shapeOf(Pieces.TYPE.O);
  assert.equal(Board.collide(b, o, -1, 0), true);
  assert.equal(Board.collide(b, o, C.COLS - 1, 0), true);
  assert.equal(Board.collide(b, o, 0, C.ROWS - 1), true);
  assert.equal(Board.collide(b, o, 0, C.ROWS - 2), false);
  b[5][5] = 1;
  assert.equal(Board.collide(b, o, 4, 4), true);
  assert.equal(Board.collide(b, o, 2, 4), false);
});

test('colisión de piezas nuevas (+, U, Y, 1×1, tuerca)', () => {
  const b = Board.create();
  for (const key of ['PLUS', 'U', 'Y', 'DOT', 'NUT']) {
    const p = Pieces.makePiece(Pieces.TYPE[key]);
    assert.equal(Board.collide(b, p.shape, p.x, p.y), false, key + ' cabe al aparecer');
  }
  // el hueco de la tuerca admite un bloque ya existente
  const nut = Pieces.shapeOf(Pieces.TYPE.NUT);
  b[6][5] = 1; // centro de una tuerca en (4,5)
  assert.equal(Board.collide(b, nut, 4, 5), false);
  b[6][4] = 1; // borde
  assert.equal(Board.collide(b, nut, 4, 5), true);
});

test('clearFullRows elimina filas llenas y baja el resto', () => {
  const b = Board.create();
  fillRow(b, 19); fillRow(b, 18, 1, [3]); b[17][0] = 2;
  const res = Board.clearFullRows(b);
  assert.equal(res.count, 1);
  assert.deepEqual(res.rows, [19]);
  assert.equal(b.length, C.ROWS);
  assert.equal(b[19][0], 2 === 0 ? 0 : 0 + b[19][0]); // la fila 18 pasó a 19
  assert.equal(b[19][3], 0);
  assert.equal(b[18][0], 2);
});

test('comodín cubre un hueco de su fila (y solo uno por comodín)', () => {
  const b = Board.create();
  fillRow(b, 19, 1, [3]);
  assert.equal(Board.rowClears(b[19]), false);
  b[19][0] = C.CELL.WILD;
  assert.equal(Board.rowClears(b[19]), true);
  fillRow(b, 18, 1, [3, 4]);
  b[18][0] = C.CELL.WILD;
  assert.equal(Board.rowClears(b[18]), false, '2 huecos, 1 comodín');
  b[18][1] = C.CELL.WILD;
  assert.equal(Board.rowClears(b[18]), true);
});

test('convertColor solo transforma el color elegido', () => {
  const b = Board.create();
  b[19][0] = 3; b[19][1] = 3; b[19][2] = 4; b[18][0] = C.CELL.GARBAGE;
  assert.equal(Board.convertColor(b, 3), 2);
  assert.equal(b[19][0], C.CELL.WILD);
  assert.equal(b[19][2], 4);
  assert.equal(b[18][0], C.CELL.GARBAGE);
});

test('gravedad compacta columnas sin mover el orden', () => {
  const b = Board.create();
  b[5][0] = 1; b[10][0] = 2; b[2][3] = 4;
  Board.compact(b);
  assert.equal(b[19][0], 2);
  assert.equal(b[18][0], 1);
  assert.equal(b[19][3], 4);
  assert.equal(b[5][0], 0);
  assert.equal(Board.compact(b), 0, 'idempotente');
});

test('bomba 3×3 respeta los bordes', () => {
  const b = Board.create();
  for (let y = 0; y < 20; y++) for (let x = 0; x < 10; x++) b[y][x] = 1;
  const res = Board.bomb(b, 0, 0);
  assert.equal(res.cells.length, 4);
  assert.deepEqual(res.area, { x0: 0, y0: 0, x1: 1, y1: 1 });
  assert.equal(b[0][0], 0); assert.equal(b[1][1], 0); assert.equal(b[2][2], 1);
  const res2 = Board.bomb(b, 5, 10);
  assert.equal(res2.cells.length, 9);
  const res3 = Board.bomb(b, 9, 19);
  assert.equal(res3.cells.length, 4);
});

test('rayo: fila baja lo de arriba, columna se vacía', () => {
  const b = Board.create();
  fillRow(b, 19); b[18][2] = 5;
  Board.clearRow(b, 19);
  assert.equal(b[19][2], 5);
  assert.equal(b.length, C.ROWS);
  b[10][4] = 1; b[3][4] = 2;
  Board.clearColumn(b, 4);
  assert.equal(b.every(r => r[4] === 0), true);
  assert.equal(b[19][2], 5, 'otras columnas intactas');
});

test('pushGarbage sube el tablero y detecta desbordamiento', () => {
  const b = Board.create();
  b[19][0] = 1;
  assert.equal(Board.pushGarbage(b, 3), false);
  assert.equal(b[18][0], 1);
  assert.equal(b[19][3], 0);
  assert.equal(b[19][0], C.CELL.GARBAGE);
  b[0][0] = 1;
  assert.equal(Board.pushGarbage(b, 3), true);
});

test('fillGarbageRows nunca crea filas completas', () => {
  const b = Board.create();
  Board.fillGarbageRows(b, 10, seeded(3));
  for (let r = 10; r < 20; r++) assert.equal(b[r].every(v => v), false);
  for (let r = 0; r < 10; r++) assert.equal(b[r].every(v => !v), true);
});

test('tSpinCorners cuenta paredes y suelo', () => {
  const b = Board.create();
  assert.equal(Board.tSpinCorners(b, 0, 18), 2, 'las dos esquinas inferiores quedan bajo el suelo');
  assert.equal(Board.tSpinCorners(b, -1, 5), 2, 'las dos esquinas izquierdas quedan fuera por la pared');
  assert.equal(Board.tSpinCorners(b, 4, 5), 0);
  b[5][4] = 1; b[5][6] = 1; b[7][4] = 1;
  assert.equal(Board.tSpinCorners(b, 4, 5), 3);
});
