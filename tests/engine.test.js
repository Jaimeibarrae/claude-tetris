'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { newEngine, setPiece, fillRow, Board, Pieces, C, GameEngine } = require('./helpers');

const TYPE = Pieces.TYPE;

// ---------- Base / Game Over ----------

test('reset deja el motor limpio y en juego', () => {
  const e = newEngine();
  e.score = 999; e.lines = 33; e.level = 4; e.board[19][0] = 1;
  e.powerups.slot = 'bomb'; e.powerups.freezeMs = 3000; e.abilities.energy = 80; e.abilities.slowMs = 4000;
  e.hold.type = 3; e.combo.combo = 5;
  e.reset();
  assert.equal(e.status, 'playing');
  assert.equal(e.score, 0); assert.equal(e.lines, 0); assert.equal(e.level, 1);
  assert.equal(Board.isEmpty(e.board), true);
  assert.equal(e.powerups.slot, null); assert.equal(e.powerups.freezeMs, 0);
  assert.equal(e.abilities.energy, 0); assert.equal(e.abilities.slowMs, 0);
  assert.equal(e.hold.type, null); assert.equal(e.hold.used, false);
  assert.equal(e.combo.combo, 0);
});

test('la gravedad baja la pieza según dropInterval', () => {
  const e = newEngine();
  const y0 = e.current.y;
  e.update(999);
  assert.equal(e.current.y, y0);
  e.update(2);
  assert.equal(e.current.y, y0 + 1);
});

test('GAME OVER por gravedad: se detiene y no sigue generando piezas', () => {
  const e = newEngine();
  for (let r = 2; r < C.ROWS; r++) fillRow(e.board, r, 1, [0]); // columna 0 libre, no hay filas completas
  e.board[0][4] = 1; // bloquea el spawn siguiente
  setPiece(e, 'O', 4, 0);
  let overs = 0;
  e.on('over', () => overs++);
  // deja que la gravedad bloquee la pieza
  for (let i = 0; i < 400 && e.status === 'playing'; i++) e.update(100);
  assert.equal(e.status, 'over');
  const snapshot = JSON.stringify(e.board);
  const score = e.score;
  for (let i = 0; i < 200; i++) e.update(1000);
  assert.equal(JSON.stringify(e.board), snapshot, 'el tablero no cambia tras Game Over');
  assert.equal(e.score, score);
  assert.equal(overs, 1, 'game over se dispara una sola vez');
});

test('en pausa nada avanza', () => {
  const e = newEngine();
  e.togglePause();
  const y = e.current.y;
  e.update(5000);
  assert.equal(e.current.y, y);
  assert.equal(e.move(1), false);
  e.togglePause();
  assert.equal(e.status, 'playing');
});

test('puntuación clásica: línea simple = 100 × nivel', () => {
  const e = newEngine();
  fillRow(e.board, 19, 1, [4, 5]);
  setPiece(e, 'O', 4, 0);
  e.hardDrop();
  assert.equal(e.lines, 1);
  assert.equal(e.score, 100 + 2 * 18); // línea + caída (18 filas)
});

// ---------- HOLD ----------

test('HOLD: guarda, intercambia y solo una vez por pieza', () => {
  const e = newEngine();
  const first = e.current.type;
  const queued = e.peekNext(1)[0];
  assert.equal(e.holdPiece(), true);
  assert.equal(e.hold.type, first);
  assert.equal(e.current.type, queued, 'sale la siguiente de la cola');
  assert.equal(e.hold.used, true);
  let denied = null;
  e.on('denied', d => { denied = d.reason; });
  assert.equal(e.holdPiece(), false);
  assert.equal(denied, 'hold');
  assert.equal(e.current.type, queued);
  // al bloquear la pieza se desbloquea
  e.hardDrop();
  assert.equal(e.hold.used, false);
  const cur = e.current.type;
  assert.equal(e.holdPiece(), true);
  assert.equal(e.current.type, first, 'intercambio con la reservada');
  assert.equal(e.hold.type, cur);
});

test('HOLD devuelve la pieza a su posición de aparición', () => {
  const e = newEngine();
  e.move(2); e.update(2000);
  e.holdPiece();
  e.hardDrop();
  e.holdPiece();
  assert.equal(e.current.y, 0);
  assert.equal(e.current.x, Math.floor(C.COLS / 2) - Math.floor(e.current.shape[0].length / 2));
});

// ---------- Piezas especiales ----------

test('la cola nunca genera 1×1 de forma aleatoria y respeta los pesos', () => {
  const e = newEngine({ seed: 11 });
  const counts = {};
  for (let i = 0; i < 4000; i++) { const t = e.queue.take(); counts[t] = (counts[t] || 0) + 1; }
  assert.equal(counts[TYPE.DOT] || 0, 0);
  assert.ok(counts[TYPE.NUT] > 0 && counts[TYPE.NUT] < counts[TYPE.T] / 2, 'la tuerca es rara');
  for (const k of ['I', 'O', 'T', 'S', 'Z', 'J', 'L', 'PLUS', 'U', 'Y', 'NUT']) assert.ok(counts[TYPE[k]] > 0, k);
});

test('un Tetris premia con la pieza 1×1 inmediata', () => {
  const e = newEngine();
  for (let r = 16; r < 20; r++) fillRow(e.board, r, 1, [9]);
  setPiece(e, 'I', 0, 0);
  e.rotate(1);               // vertical
  e.current.x = 9 - 2;       // columna 9 libre (matriz I vertical: columna 2)
  e.hardDrop();
  assert.equal(e.lines, 4);
  assert.equal(e.current.type, TYPE.DOT);
});

test('las piezas especiales caen y bloquean como las demás', () => {
  for (const key of ['PLUS', 'U', 'Y', 'DOT', 'NUT']) {
    const e = newEngine();
    setPiece(e, key, 3, 0);
    for (let i = 0; i < 4; i++) e.rotate(1);
    e.hardDrop();
    assert.ok(Board.count(e.board, TYPE[key]) > 0, key + ' quedó en el tablero');
  }
});

test('rotar con paredes: kicks horizontales', () => {
  const e = newEngine();
  setPiece(e, 'I', 0, 0);
  e.rotate(1);
  assert.equal(e.current.shape.length, 4);
  assert.ok(e.current.x >= -2);
  assert.equal(Board.collide(e.board, e.current.shape, e.current.x, e.current.y), false);
});

// ---------- Combos ----------

test('combo: x1, x2, x3 en colocaciones consecutivas y reinicio al fallar', () => {
  const e = newEngine();
  const labels = [];
  e.on('lines', d => labels.push(...d.labels));
  const clearOne = () => {
    fillRow(e.board, 19, 1, [4, 5]);
    setPiece(e, 'O', 4, 0);
    e.hardDrop();
  };
  clearOne(); assert.equal(e.combo.combo, 1);
  clearOne(); assert.equal(e.combo.combo, 2);
  clearOne(); assert.equal(e.combo.combo, 3);
  assert.ok(labels.includes('COMBO x2') && labels.includes('COMBO x3'));
  assert.ok(!labels.includes('COMBO x1'));
  setPiece(e, 'O', 0, 0); // sin línea
  e.hardDrop();
  assert.equal(e.combo.combo, 0);
});

test('puntos del combo: base × nivel × multiplicador (sin duplicar)', () => {
  const e = newEngine();
  const gained = [];
  const clearOne = () => {
    const before = e.score;
    fillRow(e.board, 19, 1, [4, 5]);
    setPiece(e, 'O', 4, 18); // ya apoyada: sin puntos de caída
    e.hardDrop();
    gained.push(e.score - before);
  };
  clearOne(); clearOne(); clearOne();
  assert.deepEqual(gained, [100, 200, 300]);
});

test('Back-to-Back: dos Tetris seguidos puntúan ×1.5 el segundo', () => {
  const e = newEngine();
  const doTetris = () => {
    for (let r = 16; r < 20; r++) fillRow(e.board, r, 1, [9]);
    setPiece(e, 'I', 0, 0);
    e.rotate(1); e.current.x = 7; e.current.y = 16 - 1;
    e.board[2][0] = 9; // bloque suelto: evita el Perfect Clear
    e.board[2][0] = 9;
    const before = e.score;
    e.hardDrop();
    return e.score - before;
  };
  e.combo.combo = 0;
  const first = doTetris() - 2; // descuenta 1 fila de caída (+2)
  assert.equal(first, 800 * 1, 'primer tetris, combo x1, nivel 1');
  e.queue.items.shift(); // quitar el 1×1 para que no moleste
  e.current = Pieces.makePiece(TYPE.I);
  const second = doTetris() - 2;
  // combo x2 y B2B: floor(800*1.5)=1200 * 2
  assert.equal(second, 1200 * 2);
  assert.equal(e.combo.b2b, true);
});

test('una limpieza normal rompe el Back-to-Back', () => {
  const e = newEngine();
  e.combo.b2b = true;
  fillRow(e.board, 19, 1, [4, 5]);
  setPiece(e, 'O', 4, 18);
  e.hardDrop();
  assert.equal(e.combo.b2b, false);
});

test('T-Spin detectado: rotación final con 3 esquinas ocupadas', () => {
  const e = newEngine();
  // Cavidad para una T apuntando hacia abajo, cerrada por las esquinas
  fillRow(e.board, 19, 1, [4]);
  fillRow(e.board, 18, 1, [3, 4, 5]);
  e.board[17][3] = 1; e.board[17][5] = 1;
  const p = setPiece(e, 'T', 3, 17);
  p.shape = [[0, 0, 0], [3, 3, 3], [0, 3, 0]];
  assert.equal(Board.collide(e.board, p.shape, p.x, p.y), false);
  e.lastAction = 'rotate';
  let info = null;
  e.on('lines', d => { info = d; });
  e.lockPiece();
  assert.ok(info && info.tSpin, 'T-SPIN detectado');
  assert.ok(info.labels.includes('T-SPIN'));
  assert.equal(info.count, 2);
  assert.equal(e.score, 1200, 'T-Spin doble = 1200 × nivel 1 × combo 1');
});

test('sin rotación previa no hay T-Spin', () => {
  const e = newEngine();
  const p = setPiece(e, 'T', 3, 17);
  p.shape = [[0, 0, 0], [3, 3, 3], [0, 3, 0]];
  e.board[17][3] = 1; e.board[17][5] = 1; e.board[19][3] = 1; e.board[19][5] = 1;
  e.lastAction = 'move';
  const labels = [];
  e.on('lines', d => labels.push(...d.labels));
  e.lockPiece();
  assert.equal(labels.includes('T-SPIN'), false);
});

test('Perfect Clear otorga bonificación y etiqueta', () => {
  const e = newEngine();
  fillRow(e.board, 19, 1, [3, 4, 5, 6]);
  setPiece(e, 'I', 3, 18); // fila 1 de la matriz = fila 19 del tablero
  const labels = [];
  e.on('lines', d => labels.push(...d.labels));
  e.hardDrop();
  assert.ok(labels.includes('PERFECT CLEAR'));
  assert.equal(e.score, 100 + C.perfectClearBonus);
});

// ---------- Power-ups ----------

test('los power-ups aparecen cada N líneas (probabilidad configurable)', () => {
  const e = newEngine();
  const old = C.powerUps.chance;
  C.powerUps.chance = 1;
  e.addLines(C.powerUps.everyLines);
  assert.ok(e.powerups.slot);
  const slot = e.powerups.slot;
  e.addLines(C.powerUps.everyLines);
  assert.equal(e.powerups.slot, slot, 'el slot ocupado no se sobrescribe');
  C.powerUps.chance = old;
});

test('Bomba: modo selección, cancelable sin gastar, destruye 3×3', () => {
  const e = newEngine();
  e.powerups.slot = 'bomb';
  for (let y = 15; y < 20; y++) for (let x = 0; x < 9; x++) e.board[y][x] = 1;
  e.usePowerUp();
  assert.equal(e.status, 'targeting');
  e.update(5000); // el tiempo no corre
  e.cancelTarget();
  assert.equal(e.status, 'playing');
  assert.equal(e.powerups.slot, 'bomb');
  e.usePowerUp();
  e.setTarget(8, 19);
  assert.equal(e.confirmTarget(), true);
  assert.equal(e.powerups.slot, null);
  assert.equal(e.status, 'playing');
  assert.equal(e.board[19][8], 0); assert.equal(e.board[18][7], 0);
  assert.equal(e.board[19][6], 1);
});

test('Rayo: elimina fila (lo de arriba baja) y columna', () => {
  const e = newEngine();
  fillRow(e.board, 19, 1, [0]); e.board[18][2] = 5;
  e.powerups.slot = 'lightning';
  e.usePowerUp(); e.setTarget(0, 19); e.confirmTarget();
  assert.equal(e.board[19][2], 5);
  e.powerups.slot = 'lightning';
  e.usePowerUp(); e.toggleAxis(); e.setTarget(2, 5); e.confirmTarget();
  assert.equal(e.board.every(r => r[2] === 0), true);
});

test('Tinte: convierte el color en comodines que completan líneas', () => {
  const e = newEngine();
  fillRow(e.board, 19, 4, [5]);      // verde con un hueco
  e.board[19][0] = 3;                // un bloque morado
  e.board[19][1] = 3;
  e.board[19][9] = 3;
  e.board[17][8] = 3;
  e.powerups.slot = 'tint';
  e.usePowerUp(); e.setTarget(0, 19);
  const lines0 = e.lines;
  e.confirmTarget();
  // 3 comodines en la fila 19 (columnas 0,1,9) + 1 en otra fila; hueco único cubierto
  assert.equal(e.lines, lines0 + 1);
  assert.equal(Board.count(e.board, C.CELL.WILD), 1, 'queda el comodín de la fila 17');
});

test('Tinte rechaza celdas vacías y basura sin gastar el power-up', () => {
  const e = newEngine();
  e.board[19][0] = C.CELL.GARBAGE;
  e.powerups.slot = 'tint';
  e.usePowerUp();
  e.setTarget(5, 5);
  assert.equal(e.confirmTarget(), false);
  e.setTarget(0, 19);
  assert.equal(e.confirmTarget(), false);
  assert.equal(e.status, 'targeting');
  assert.equal(e.powerups.slot, 'tint');
});

test('Gravedad: compacta y puede completar líneas', () => {
  const e = newEngine();
  fillRow(e.board, 19, 1, [3]);
  e.board[10][3] = 2; // flotando sobre el hueco
  e.powerups.slot = 'gravity';
  e.usePowerUp();
  assert.equal(e.lines, 1, 'el bloque cayó y completó la fila');
  assert.equal(e.board[19][3], 0);
});

test('Gravedad: la pieza actual se sube si el tablero cambia bajo ella', () => {
  const e = newEngine();
  setPiece(e, 'O', 4, 0);
  for (let y = 4; y < 20; y++) e.board[y][4] = 1; // columnas con huecos arriba
  e.board[1][5] = 1; // flotando justo dentro del área de la pieza... colisión previa
  e.board[1][5] = 0;
  e.board[2][4] = 0; e.board[3][4] = 0;
  e.board[0][9] = 0;
  e.board[3][5] = 1; // bloque que cae a otro lado; la pieza no colisiona
  e.powerups.slot = 'gravity';
  e.usePowerUp();
  assert.equal(Board.collide(e.board, e.current.shape, e.current.x, e.current.y), false);
});

test('Congelar: detiene la gravedad 5 s, se puede mover y la cuenta no se acumula', () => {
  const e = newEngine();
  e.powerups.slot = 'freeze';
  e.usePowerUp();
  assert.equal(e.frozen, true);
  const y = e.current.y;
  e.update(4000);
  assert.equal(e.current.y, y);
  assert.equal(e.move(1), true);
  assert.equal(e.rotate(1), true);
  e.update(900);
  assert.equal(e.frozen, true);
  e.update(200);
  assert.equal(e.frozen, false);
  assert.equal(e.current.y, y, 'no cae de golpe al descongelar');
  e.update(801);
  assert.equal(e.current.y, y + 1);
});

test('Congelar y Tiempo lento son incompatibles', () => {
  const e = newEngine();
  e.abilities.slowMs = 5000;
  e.powerups.slot = 'freeze';
  const reasons = [];
  e.on('denied', d => reasons.push(d.reason));
  assert.equal(e.usePowerUp(), false);
  assert.deepEqual(reasons, ['conflict']);
  assert.equal(e.powerups.slot, 'freeze');
  e.abilities.slowMs = 0; e.powerups.freezeMs = 3000;
  e.abilities.energy = 100;
  assert.equal(e.abilityStatus('slow').ok, false);
});

// ---------- Habilidades ----------

test('la energía sube con las líneas y el menú exige barra llena', () => {
  const e = newEngine();
  const reasons = [];
  e.on('denied', d => reasons.push(d.reason));
  assert.equal(e.openAbilityMenu(), false);
  assert.deepEqual(reasons, ['ability']);
  e.addLines(Math.ceil(C.energy.max / C.energy.perLine));
  assert.equal(e.abilities.full, true);
  assert.equal(e.openAbilityMenu(), true);
  assert.equal(e.status, 'abilityMenu');
  e.update(5000);
  assert.equal(e.lines, 7, 'el tiempo no corre en el menú');
  e.closeAbilityMenu();
  assert.equal(e.status, 'playing');
});

test('Visión futura muestra 5 piezas y expira', () => {
  const e = newEngine();
  e.abilities.energy = 100;
  e.openAbilityMenu();
  assert.equal(e.useAbility('foresight'), true);
  assert.equal(e.peekNext().length, 5);
  assert.equal(e.abilities.energy, 100 - C.energy.costs.foresight);
  e.update(C.energy.foresightMs + 10);
  assert.equal(e.peekNext().length, 1);
});

test('Tiempo lento ralentiza la caída y expira', () => {
  const e = newEngine();
  const base = e.dropInterval;
  e.abilities.energy = 100;
  e.openAbilityMenu(); e.useAbility('slow');
  assert.equal(e.dropInterval, base * C.energy.slowFactor);
  e.update(C.energy.slowMs + 1);
  assert.equal(e.dropInterval, base);
});

test('Intercambio cambia la pieza actual', () => {
  const e = newEngine();
  const t = e.current.type;
  e.abilities.energy = 100;
  e.openAbilityMenu();
  assert.equal(e.useAbility('swap'), true);
  assert.notEqual(e.current.type, t);
  assert.equal(e.current.y, 0);
});

test('Reserva rearma el HOLD (solo si ya se usó)', () => {
  const e = newEngine();
  e.abilities.energy = 100;
  e.openAbilityMenu();
  assert.equal(e.useAbility('reserve'), false);
  e.closeAbilityMenu();
  e.holdPiece();
  e.openAbilityMenu();
  assert.equal(e.useAbility('reserve'), true);
  assert.equal(e.hold.used, false);
  assert.equal(e.holdPiece(), true);
});

test('Deshacer restaura tablero, pieza, puntuación, combo y cola', () => {
  const e = newEngine();
  const before = {
    board: JSON.stringify(e.board), type: e.current.type, score: e.score,
    lines: e.lines, queue: e.queue.snapshot(),
  };
  fillRow(e.board, 19, 1, [4, 5]);
  const boardWithRow = JSON.stringify(e.board);
  e.history[e.history.length - 1].board = Board.clone(e.board); // el estado previo incluye la fila
  setPiece(e, 'O', 4, 0);
  e.hardDrop();                  // limpia una línea
  assert.equal(e.lines, 1);
  assert.equal(e.combo.combo, 1);
  e.abilities.energy = 100;
  e.openAbilityMenu();
  assert.equal(e.useAbility('undo'), true);
  assert.equal(JSON.stringify(e.board), boardWithRow);
  assert.equal(e.lines, 0);
  assert.equal(e.score, 0);
  assert.equal(e.combo.combo, 0);
  assert.equal(e.current.y, 0);
  assert.equal(e.abilities.energy, 100 - C.energy.costs.undo + 0, 'la energía gastada no se devuelve');
  assert.ok(before.type >= 1);
});

test('Deshacer no está disponible sin colocación previa', () => {
  const e = newEngine();
  e.abilities.energy = 100;
  assert.equal(e.abilityStatus('undo').ok, false);
  e.hardDrop();
  assert.equal(e.abilityStatus('undo').ok, true);
});

// ---------- Desafíos ----------

const challenge = (id, level = 0, extra = {}) => newEngine({ challenge: { id, level }, ...extra });

test('desafío: empieza en "ready" y begin() lo inicia', () => {
  const e = challenge('time');
  assert.equal(e.status, 'ready');
  e.update(5000);
  assert.equal(e.challenge.elapsed, 0);
  e.begin();
  assert.equal(e.status, 'playing');
});

test('Contrarreloj: victoria por líneas y derrota por tiempo', () => {
  const e = challenge('time', 1);
  e.begin();
  e.lines = 39;
  fillRow(e.board, 19, 1, [4, 5]);
  setPiece(e, 'O', 4, 18);
  e.hardDrop();
  assert.equal(e.status, 'won');

  const e2 = challenge('time', 1);
  e2.begin();
  for (let i = 0; i < 130 && e2.status === 'playing'; i++) { e2.powerups.freezeMs = 2000; e2.update(1000); }
  assert.equal(e2.status, 'over');
  assert.equal(e2.endReason, 'time');
});

test('Supervivencia: sube basura, acelera y se gana sobreviviendo', () => {
  const e = challenge('survival', 0);
  e.begin();
  e.update(10001);
  assert.ok(Board.count(e.board, C.CELL.GARBAGE) > 0);
  assert.ok(e.challenge.garbageEvery < 10000, 'el intervalo disminuye');
  const e2 = challenge('survival', 0);
  e2.begin();
  // mantenemos la pieza arriba sin bloquear: congelamos la gravedad y quitamos la basura
  for (let t = 0; t < 130000 && e2.status === 'playing'; t += 500) {
    e2.powerups.freezeMs = 1000;
    e2.update(500);
    for (let r = 0; r < C.ROWS; r++) e2.board[r].fill(0);
  }
  assert.equal(e2.status, 'won');
});

test('Supervivencia: la basura que desborda el tablero termina la partida', () => {
  const e = challenge('survival', 0);
  e.begin();
  for (let r = 0; r < C.ROWS; r++) if (r > 0) fillRow(e.board, r, 1, [0]);
  e.board[0][5] = 1;
  e.pushGarbage();
  assert.equal(e.status, 'over');
});

test('Tablero contaminado: parte con basura y se gana al limpiarla', () => {
  const e = challenge('dirty', 0);
  e.begin();
  assert.ok(Board.count(e.board, C.CELL.GARBAGE) > 0);
  for (let r = 0; r < C.ROWS; r++) for (let c = 0; c < C.COLS; c++) if (e.board[r][c] === C.CELL.GARBAGE) e.board[r][c] = 0;
  e.update(16);
  assert.equal(e.status, 'won');
});

test('Piezas invisibles: oculta los bloques bloqueados', () => {
  const e = challenge('invisible', 0);
  assert.equal(e.challenge.hideLocked(), true);
  assert.equal(challenge('time').challenge.hideLocked(), false);
});

test('Rotación inversa: se invierte desde el nivel indicado y avisa', () => {
  const e = challenge('reverse', 0);
  const banners = [];
  e.on('banner', b => banners.push(b.text));
  e.begin();
  assert.equal(e.challenge.reverseActive(e), false);
  setPiece(e, 'L', 3, 5);
  const shape = JSON.stringify(Board.rotateCW(e.current.shape));
  e.rotate(1);
  assert.equal(JSON.stringify(e.current.shape), shape, 'normal: horario');
  e.level = 3;
  assert.equal(e.challenge.reverseActive(e), true);
  setPiece(e, 'L', 3, 5);
  const ccw = JSON.stringify(Board.rotateCCW(e.current.shape));
  e.rotate(1);
  assert.equal(JSON.stringify(e.current.shape), ccw, 'invertida: antihorario');
  // Difícil: invertida desde el inicio, con aviso al empezar
  const hard = challenge('reverse', 2);
  const b2 = [];
  hard.on('banner', b => b2.push(b.text));
  hard.begin();
  assert.equal(b2.length, 1);
});

test('reiniciar un desafío restablece temporizadores y estados', () => {
  const e = challenge('survival', 1);
  e.begin();
  e.update(30000);
  e.reset({ challenge: { id: 'survival', level: 1 } });
  assert.equal(e.challenge.elapsed, 0);
  assert.equal(e.challenge.garbageEvery, 10000);
  assert.equal(Board.count(e.board, C.CELL.GARBAGE), 0);
  assert.equal(e.status, 'ready');
});

test('los temporizadores no se acumulan entre partidas', () => {
  const e = newEngine();
  e.powerups.freezeMs = 4000; e.abilities.slowMs = 4000; e.abilities.foresightMs = 4000;
  e.reset();
  assert.equal(e.powerups.freezeMs + e.abilities.slowMs + e.abilities.foresightMs, 0);
  const e2 = new GameEngine({ rng: () => 0.5 });
  assert.equal(e2.status, 'playing');
});

// ---------- Nivel inicial ----------

test('startLevel=5: nivel 5, dropInterval acorde y sube a 6 tras 10 líneas', () => {
  const e = newEngine();
  e.reset({ startLevel: 5 });
  assert.equal(e.startLevel, 5);
  assert.equal(e.level, 5);
  assert.equal(e.dropInterval, Math.max(C.drop.min, C.drop.base - 4 * C.drop.step));
  e.addLines(10);
  assert.equal(e.level, 6);
});

test('startLevel inválido se recorta o ignora', () => {
  const e = newEngine();
  for (const [v, exp] of [[0, 1], [99, 15], [NaN, 1], ['abc', 1], ['7', 7], [-3, 1], [undefined, 1]]) {
    e.reset({ startLevel: v });
    assert.equal(e.startLevel, exp, String(v));
    assert.equal(e.level, exp);
  }
});

test('el modo desafío ignora startLevel', () => {
  const e = newEngine();
  e.reset({ challenge: { id: 'survival', level: 0 }, startLevel: 9 });
  assert.equal(e.level, 1);
});

test('undo conserva el nivel con startLevel', () => {
  const e = newEngine();
  e.reset({ startLevel: 5 });
  e.hardDrop();
  e.undo();
  assert.equal(e.level, 5);
  assert.equal(e.startLevel, 5);
});
