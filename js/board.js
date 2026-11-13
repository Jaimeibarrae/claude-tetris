(function (G) {
  'use strict';
  const T = G.Tetris = G.Tetris || {};
  const C = T.Config || require('./config');
  const { COLS, ROWS, CELL } = C;

  // Operaciones puras sobre un tablero (matriz ROWS×COLS de enteros). Mutan el tablero recibido.

  const create = () => Array.from({ length: ROWS }, () => new Array(COLS).fill(0));
  const clone = board => board.map(r => r.slice());
  const emptyRow = () => new Array(COLS).fill(0);

  function collide(board, shape, ox, oy) {
    for (let r = 0; r < shape.length; r++) {
      for (let c = 0; c < shape[r].length; c++) {
        if (!shape[r][c]) continue;
        const nx = ox + c;
        const ny = oy + r;
        if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
        if (ny >= 0 && board[ny][nx]) return true;
      }
    }
    return false;
  }

  function rotateCW(shape) {
    const rows = shape.length, cols = shape[0].length;
    const out = Array.from({ length: cols }, () => new Array(rows).fill(0));
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < cols; c++)
        out[c][rows - 1 - r] = shape[r][c];
    return out;
  }

  function rotateCCW(shape) {
    const rows = shape.length, cols = shape[0].length;
    const out = Array.from({ length: cols }, () => new Array(rows).fill(0));
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < cols; c++)
        out[cols - 1 - c][r] = shape[r][c];
    return out;
  }

  // Devuelve true si alguna celda quedó por encima del tablero (lock out).
  function merge(board, shape, ox, oy) {
    let overflow = false;
    for (let r = 0; r < shape.length; r++) {
      for (let c = 0; c < shape[r].length; c++) {
        if (!shape[r][c]) continue;
        const y = oy + r;
        if (y < 0) { overflow = true; continue; }
        board[y][ox + c] = shape[r][c];
      }
    }
    return overflow;
  }

  // Una fila se elimina si sus huecos pueden cubrirse con sus comodines (sin comodines: fila llena).
  function rowClears(row) {
    let empty = 0, wild = 0;
    for (const v of row) {
      if (!v) empty++;
      else if (v === CELL.WILD) wild++;
    }
    return empty <= wild;
  }

  function clearFullRows(board) {
    const rows = [];
    const cells = [];
    for (let r = 0; r < ROWS; r++) {
      if (!rowClears(board[r])) continue;
      rows.push(r);
      board[r].forEach((v, x) => { if (v) cells.push({ x, y: r, v }); });
    }
    for (let i = rows.length - 1; i >= 0; i--) board.splice(rows[i], 1);
    for (let i = 0; i < rows.length; i++) board.unshift(emptyRow());
    return { count: rows.length, rows, cells };
  }

  // Gravedad: compacta cada columna hacia abajo. Devuelve cuántas celdas cambiaron.
  function compact(board) {
    let moved = 0;
    for (let c = 0; c < COLS; c++) {
      const col = [];
      for (let r = ROWS - 1; r >= 0; r--) if (board[r][c]) col.push(board[r][c]);
      for (let r = ROWS - 1, i = 0; r >= 0; r--, i++) {
        const v = col[i] || 0;
        if (board[r][c] !== v) moved++;
        board[r][c] = v;
      }
    }
    return moved;
  }

  // Bomba 3×3 centrada en (cx, cy), recortada a los límites.
  function bomb(board, cx, cy) {
    const x0 = Math.max(0, cx - 1), x1 = Math.min(COLS - 1, cx + 1);
    const y0 = Math.max(0, cy - 1), y1 = Math.min(ROWS - 1, cy + 1);
    const cells = [];
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        if (board[y][x]) cells.push({ x, y, v: board[y][x] });
        board[y][x] = 0;
      }
    }
    return { area: { x0, y0, x1, y1 }, cells };
  }

  // Rayo en fila: la fila se elimina y lo de arriba baja una posición.
  function clearRow(board, r) {
    const cells = [];
    board[r].forEach((v, x) => { if (v) cells.push({ x, y: r, v }); });
    board.splice(r, 1);
    board.unshift(emptyRow());
    return cells;
  }

  // Rayo en columna: se vacía la columna.
  function clearColumn(board, c) {
    const cells = [];
    for (let y = 0; y < ROWS; y++) {
      if (board[y][c]) cells.push({ x: c, y, v: board[y][c] });
      board[y][c] = 0;
    }
    return cells;
  }

  // Tinte: todos los bloques del color dado pasan a comodín.
  function convertColor(board, color) {
    let n = 0;
    for (let y = 0; y < ROWS; y++)
      for (let x = 0; x < COLS; x++)
        if (board[y][x] === color) { board[y][x] = CELL.WILD; n++; }
    return n;
  }

  // Sube todo una fila e inserta basura abajo. Devuelve true si la fila superior tenía bloques.
  function pushGarbage(board, hole) {
    const overflow = board[0].some(v => v);
    board.shift();
    const row = new Array(COLS).fill(CELL.GARBAGE);
    row[hole] = 0;
    board.push(row);
    return overflow;
  }

  // Basura inicial aleatoria en las `n` filas inferiores (nunca una fila completa).
  function fillGarbageRows(board, n, rng) {
    for (let r = ROWS - n; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) board[r][c] = rng() < 0.7 ? CELL.GARBAGE : 0;
      if (board[r].every(v => v)) board[r][Math.floor(rng() * COLS)] = 0;
    }
  }

  const isEmpty = board => board.every(row => row.every(v => !v));

  function count(board, value) {
    let n = 0;
    for (const row of board) for (const v of row) if (v === value) n++;
    return n;
  }

  // Esquinas ocupadas (pared/suelo cuentan) alrededor del centro de una pieza 3×3.
  function tSpinCorners(board, x, y) {
    let n = 0;
    for (const [dx, dy] of [[0, 0], [2, 0], [0, 2], [2, 2]]) {
      const cx = x + dx, cy = y + dy;
      if (cx < 0 || cx >= COLS || cy >= ROWS || (cy >= 0 && board[cy][cx])) n++;
    }
    return n;
  }

  const Board = {
    create, clone, collide, rotateCW, rotateCCW, merge, rowClears, clearFullRows,
    compact, bomb, clearRow, clearColumn, convertColor, pushGarbage, fillGarbageRows,
    isEmpty, count, tSpinCorners,
  };
  T.Board = Board;
  if (typeof module !== 'undefined' && module.exports) module.exports = Board;
})(typeof window !== 'undefined' ? window : globalThis);
