(function (G) {
  'use strict';
  const T = G.Tetris = G.Tetris || {};
  const C = T.Config || require('./config');
  const Board = T.Board || require('./board');
  const Pieces = T.Pieces || require('./pieces');
  const HoldManager = T.HoldManager || require('./managers/hold');
  const ComboManager = T.ComboManager || require('./managers/combo');
  const PowerUpManager = T.PowerUpManager || require('./managers/powerups');
  const AbilityManager = T.AbilityManager || require('./managers/abilities');
  const ChallengeManager = T.ChallengeManager || require('./managers/challenge');

  const { COLS, ROWS, CELL } = C;
  const { TYPE, makePiece, PieceQueue } = Pieces;

  // Desplazamientos al rotar: horizontales (como antes) y hacia abajo (permiten T-Spins).
  const KICKS = [[0, 0], [-1, 0], [1, 0], [-2, 0], [2, 0], [0, 1], [-1, 1], [1, 1]];

  /*
   * Motor del juego sin DOM. Estados (status):
   *   menu | ready | playing | paused | targeting | abilityMenu | over | won
   * Toda la lógica de tiempo avanza solo en update(dt) y solo en 'playing'.
   */
  class GameEngine {
    constructor(opts = {}) {
      this.rng = opts.rng || Math.random;
      this.handlers = {};
      this.hold = new HoldManager();
      this.combo = new ComboManager(C);
      this.powerups = new PowerUpManager(C);
      this.abilities = new AbilityManager(C);
      this.challenge = new ChallengeManager();
      this.reset(opts);
    }

    // ---- Eventos ----
    on(name, fn) { (this.handlers[name] = this.handlers[name] || []).push(fn); }
    emit(name, data) { (this.handlers[name] || []).forEach(fn => fn(data)); }
    deny(reason) { this.emit('denied', { reason }); return false; }

    // ---- Ciclo de vida ----
    reset(opts = {}) {
      this.mode = opts.challenge ? 'challenge' : 'classic';
      this.board = Board.create();
      this.score = 0;
      this.lines = 0;
      const sl = Math.trunc(Number(opts.startLevel));
      this.startLevel = opts.challenge || Number.isNaN(sl) ? 1 : Math.min(15, Math.max(1, sl));
      this.level = this.startLevel;
      this.dropAccum = 0;
      this.lastAction = null;
      this.history = [];
      this.target = null;
      this.endReason = null;
      this.queue = new PieceQueue(this.rng, opts.weights);
      this.queue.fill();
      this.hold.reset();
      this.combo.reset();
      this.powerups.reset();
      this.abilities.reset();
      this.challenge.setup(this, opts.challenge);
      this.status = opts.status || (opts.challenge ? 'ready' : 'playing');
      this.current = null;
      this.spawn();
      this.emit('reset');
    }

    // Sale de la pantalla de presentación de un desafío.
    begin() {
      if (this.status !== 'ready') return;
      this.status = 'playing';
      this.emit('begin');
      this.announceReverse();
    }

    announceReverse() {
      if (this.challenge.reverseActive(this) && !this.challenge.reverseNotified) {
        this.challenge.reverseNotified = true;
        this.emit('banner', { text: '¡ROTACIÓN INVERTIDA!' });
      }
    }

    endGame(reason) {
      if (this.status === 'over' || this.status === 'won') return;
      this.status = 'over';
      this.endReason = reason;
      this.target = null;
      this.emit('over', { reason, challenge: this.mode === 'challenge' });
    }

    win() {
      if (this.status === 'over' || this.status === 'won') return;
      this.status = 'won';
      this.target = null;
      this.emit('won', {});
    }

    togglePause() {
      if (this.status === 'playing') this.status = 'paused';
      else if (this.status === 'paused') this.status = 'playing';
      else return false;
      this.emit('pause', { paused: this.status === 'paused' });
      return true;
    }

    // ---- Tiempo ----
    get dropInterval() {
      const d = C.drop;
      const base = Math.max(d.min, d.base - (this.level - 1) * d.step);
      return this.abilities.slowMs > 0 ? base * C.energy.slowFactor : base;
    }
    get frozen() { return this.powerups.freezeMs > 0; }

    update(dt) {
      if (this.status !== 'playing') return;
      this.powerups.tick(dt);
      this.abilities.tick(dt);

      this.applyChallenge(this.challenge.update(dt, this));
      if (this.status !== 'playing') return;

      if (this.frozen) return; // Congelar: no hay gravedad
      this.dropAccum += dt;
      if (this.dropAccum >= this.dropInterval) {
        this.dropAccum = 0;
        if (!Board.collide(this.board, this.current.shape, this.current.x, this.current.y + 1)) {
          this.current.y++;
          this.lastAction = 'move';
        } else {
          this.lockPiece();
        }
      }
    }

    applyChallenge(result) {
      if (result === 'won') this.win();
      else if (result === 'lost') this.endGame('time');
    }
    checkChallenge() { this.applyChallenge(this.challenge.check(this)); }

    // ---- Piezas ----
    get canAct() { return this.status === 'playing' && !!this.current; }

    spawn() {
      this.current = makePiece(this.queue.take());
      this.lastAction = null;
      this.dropAccum = 0;
      if (Board.collide(this.board, this.current.shape, this.current.x, this.current.y)) {
        this.endGame('blocked');
        return;
      }
      this.pushHistory();
      this.emit('spawn', { piece: this.current });
    }

    ghostY() {
      let gy = this.current.y;
      while (!Board.collide(this.board, this.current.shape, this.current.x, gy + 1)) gy++;
      return gy;
    }

    move(dx) {
      if (!this.canAct) return false;
      const p = this.current;
      if (Board.collide(this.board, p.shape, p.x + dx, p.y)) return false;
      p.x += dx;
      this.lastAction = 'move';
      this.emit('move');
      return true;
    }

    // dir: 1 = horario, -1 = antihorario (se invierte si el desafío lo exige)
    rotate(dir = 1) {
      if (!this.canAct) return false;
      const eff = this.challenge.reverseActive(this) ? -dir : dir;
      const p = this.current;
      const rotated = eff > 0 ? Board.rotateCW(p.shape) : Board.rotateCCW(p.shape);
      for (const [kx, ky] of KICKS) {
        if (!Board.collide(this.board, rotated, p.x + kx, p.y + ky)) {
          p.shape = rotated;
          p.x += kx;
          p.y += ky;
          this.lastAction = 'rotate';
          this.emit('rotate');
          return true;
        }
      }
      return false;
    }

    softDrop() {
      if (!this.canAct) return false;
      const p = this.current;
      if (!Board.collide(this.board, p.shape, p.x, p.y + 1)) {
        p.y++;
        this.score += 1;
        this.lastAction = 'move';
      } else {
        this.lockPiece();
      }
      return true;
    }

    hardDrop() {
      if (!this.canAct) return false;
      const gy = this.ghostY();
      const dist = gy - this.current.y;
      this.score += dist * 2;
      if (dist > 0) this.lastAction = 'move';
      this.current.y = gy;
      this.emit('harddrop', { dist });
      this.lockPiece();
      return true;
    }

    // Pieza → tablero → líneas → puntuación → siguiente pieza
    lockPiece() {
      const p = this.current;
      const tSpin = p.key === 'T' && this.lastAction === 'rotate'
        && Board.tSpinCorners(this.board, p.x, p.y) >= 3;
      const overflow = Board.merge(this.board, p.shape, p.x, p.y);
      this.emit('lock', { piece: p });
      this.hold.unlock();
      if (overflow) { this.endGame('lockout'); return; }

      const cleared = Board.clearFullRows(this.board);
      const perfect = cleared.count > 0 && Board.isEmpty(this.board);
      const res = this.combo.score({ lines: cleared.count, tSpin, level: this.level, perfect });
      this.score += res.points;
      if (cleared.count) this.addLines(cleared.count);
      if (cleared.count === 4) this.queue.pushFront(TYPE.DOT); // recompensa por un Tetris
      if (cleared.count || res.labels.length) {
        this.emit('lines', { ...res, count: cleared.count, rows: cleared.rows, cells: cleared.cells });
      }

      this.checkChallenge();
      if (this.status === 'playing') this.spawn();
    }

    // Líneas → nivel, energía y power-ups
    addLines(n) {
      this.lines += n;
      this.level = this.startLevel + Math.floor(this.lines / 10);
      const full = this.abilities.addEnergy(n);
      const gained = this.powerups.onLines(n, this.rng);
      if (gained) this.emit('powerup-gained', { type: gained });
      if (full) this.emit('energy-full');
      this.announceReverse();
    }

    // ---- HOLD ----
    holdPiece() {
      if (!this.canAct) return false;
      if (!this.hold.canUse()) return this.deny('hold');
      const previous = this.hold.swap(this.current.type);
      this.current = makePiece(previous !== null ? previous : this.queue.take());
      this.lastAction = null;
      this.dropAccum = 0;
      this.emit('hold', { type: this.hold.type });
      if (Board.collide(this.board, this.current.shape, this.current.x, this.current.y)) {
        this.endGame('blocked');
      }
      return true;
    }

    // ---- Power-ups ----
    usePowerUp() {
      if (!this.canAct) return false;
      const type = this.powerups.slot;
      if (!type) return this.deny('powerup');

      if (type === 'freeze') {
        if (this.abilities.slowMs > 0) return this.deny('conflict');
        this.powerups.freezeMs = C.powerUps.freezeMs;
        this.powerups.slot = null;
        this.emit('powerup', { type });
        return true;
      }
      if (type === 'gravity') {
        const moved = Board.compact(this.board);
        this.powerups.slot = null;
        this.emit('powerup', { type, moved });
        this.afterBoardChange();
        return true;
      }
      // bomba / rayo / tinte: modo selección (el tiempo se detiene)
      this.target = { type, x: Math.floor(COLS / 2), y: Math.floor(ROWS / 2), axis: 'row' };
      this.status = 'targeting';
      this.emit('targeting', { type });
      return true;
    }

    setTarget(x, y) {
      if (this.status !== 'targeting') return;
      this.target.x = Math.max(0, Math.min(COLS - 1, x));
      this.target.y = Math.max(0, Math.min(ROWS - 1, y));
    }
    moveTarget(dx, dy) { if (this.target) this.setTarget(this.target.x + dx, this.target.y + dy); }
    toggleAxis() {
      if (this.status === 'targeting' && this.target.type === 'lightning') {
        this.target.axis = this.target.axis === 'row' ? 'col' : 'row';
      }
    }
    cancelTarget() {
      if (this.status !== 'targeting') return;
      this.target = null;
      this.status = 'playing';
    }

    confirmTarget() {
      if (this.status !== 'targeting') return false;
      const t = this.target;
      const b = this.board;
      switch (t.type) {
        case 'bomb': {
          const res = Board.bomb(b, t.x, t.y);
          this.emit('bomb', { x: t.x, y: t.y, ...res });
          break;
        }
        case 'lightning': {
          const cells = t.axis === 'row' ? Board.clearRow(b, t.y) : Board.clearColumn(b, t.x);
          this.emit('lightning', { axis: t.axis, index: t.axis === 'row' ? t.y : t.x, cells });
          break;
        }
        case 'tint': {
          const v = b[t.y][t.x];
          if (!v || v === CELL.GARBAGE || v === CELL.WILD) return this.deny('target');
          const count = Board.convertColor(b, v);
          this.emit('tint', { color: v, count });
          break;
        }
      }
      this.powerups.slot = null;
      this.target = null;
      this.status = 'playing';
      this.emit('powerup', { type: t.type });
      this.afterBoardChange();
      return true;
    }

    // Tras alterar el tablero con un power-up: resolver colisión de la pieza y líneas completas
    afterBoardChange() {
      this.resolveCurrentCollision();
      if (this.status !== 'playing') return;
      const c = Board.clearFullRows(this.board);
      if (c.count) {
        const points = C.lineScores[Math.min(c.count, 4)] * this.level;
        this.score += points;
        this.addLines(c.count);
        this.emit('lines', { points, combo: 0, b2b: false, tSpin: false, perfect: false, labels: [], bonus: true, count: c.count, rows: c.rows, cells: c.cells });
      }
      this.checkChallenge();
    }

    // Si el tablero cambió bajo la pieza actual, la sube hasta que quepa
    resolveCurrentCollision() {
      const p = this.current;
      while (Board.collide(this.board, p.shape, p.x, p.y)) p.y--;
      if (p.y < 0) this.endGame('overflow');
    }

    // Fila de basura desde abajo (desafío de supervivencia)
    pushGarbage() {
      const overflow = Board.pushGarbage(this.board, Math.floor(this.rng() * COLS));
      this.emit('garbage');
      if (overflow) { this.endGame('overflow'); return; }
      this.resolveCurrentCollision();
    }

    // ---- Habilidades ----
    openAbilityMenu() {
      if (!this.canAct) return false;
      if (!this.abilities.full) return this.deny('ability');
      this.status = 'abilityMenu';
      this.emit('abilitymenu', { open: true });
      return true;
    }
    closeAbilityMenu() {
      if (this.status !== 'abilityMenu') return;
      this.status = 'playing';
      this.emit('abilitymenu', { open: false });
    }

    abilityStatus(id) {
      const a = this.abilities;
      if (a.energy < a.cost(id)) return { ok: false, reason: 'energy' };
      if (id === 'slow' && (this.frozen || a.slowMs > 0)) return { ok: false, reason: 'conflict' };
      if (id === 'foresight' && a.foresightMs > 0) return { ok: false, reason: 'active' };
      if (id === 'undo' && this.history.length < 2) return { ok: false, reason: 'none' };
      if (id === 'reserve' && !this.hold.used) return { ok: false, reason: 'unused' };
      return { ok: true };
    }

    useAbility(id) {
      if (this.status !== 'abilityMenu') return false;
      if (!this.abilityStatus(id).ok) return this.deny('ability');
      const a = this.abilities;
      switch (id) {
        case 'foresight': a.foresightMs = C.energy.foresightMs; break;
        case 'slow': a.slowMs = C.energy.slowMs; break;
        case 'reserve': this.hold.rearm(); break;
        case 'undo': this.undo(); break;
        case 'swap': {
          let type = this.current.type;
          for (let i = 0; i < 6 && type === this.current.type; i++) type = this.queue.randomType();
          const piece = makePiece(type);
          if (Board.collide(this.board, piece.shape, piece.x, piece.y)) return this.deny('ability');
          this.current = piece;
          this.lastAction = null;
          break;
        }
        default: return false;
      }
      a.spend(id);
      this.status = 'playing';
      this.emit('ability', { id });
      return true;
    }

    // ---- Deshacer ----
    snapshot() {
      const p = this.current;
      return {
        board: Board.clone(this.board),
        pieceType: p.type,
        queue: this.queue.snapshot(),
        score: this.score, lines: this.lines, level: this.level,
        combo: this.combo.snapshot(),
        hold: this.hold.snapshot(),
        powerups: this.powerups.snapshot(),
      };
    }

    pushHistory() {
      this.history.push(this.snapshot());
      if (this.history.length > 8) this.history.shift();
    }

    // Vuelve al instante en que apareció la pieza anterior (antes de su colocación).
    undo() {
      if (this.history.length < 2) return false;
      this.history.pop();                 // snapshot de la pieza actual
      const s = this.history.pop();       // snapshot de la pieza anterior
      this.board = Board.clone(s.board);
      this.queue.restore(s.queue);
      this.score = s.score; this.lines = s.lines; this.level = s.level;
      this.combo.restore(s.combo);
      this.hold.restore(s.hold);
      this.powerups.restore(s.powerups);
      this.current = makePiece(s.pieceType);
      this.lastAction = null;
      this.dropAccum = 0;
      this.history.push(s);
      return true;
    }

    // Próximas piezas visibles (5 con Visión futura activa)
    get nextCount() { return this.abilities.foresightMs > 0 ? 5 : 1; }
    peekNext(n = this.nextCount) { return this.queue.peek(n); }
  }

  GameEngine.KICKS = KICKS;
  T.GameEngine = GameEngine;
  if (typeof module !== 'undefined' && module.exports) module.exports = GameEngine;
})(typeof window !== 'undefined' ? window : globalThis);
