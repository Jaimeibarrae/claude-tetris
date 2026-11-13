'use strict';

/*
 * Capa de presentación: render en canvas, entrada, menús y HUD.
 * Toda la lógica de juego vive en js/engine.js (GameEngine); aquí solo se lee su estado
 * y se reacciona a sus eventos.
 */
(function () {
  const { Config: C, Board, Pieces, GameEngine, PowerUpManager, AbilityManager, ChallengeManager, Sound, FX } = window.Tetris;
  const { COLS, ROWS, CELL } = C;
  const BLOCK = 30; // el canvas de index.html (300×600) debe coincidir con COLS*BLOCK × ROWS*BLOCK

  // ---------- DOM ----------
  const $ = id => document.getElementById(id);
  const canvas = $('board');
  const ctx = canvas.getContext('2d');
  const nextCanvas = $('next-canvas');
  const nextCtx = nextCanvas.getContext('2d');
  const extraCanvas = $('next-extra');
  const extraCtx = extraCanvas.getContext('2d');
  const holdCanvas = $('hold-canvas');
  const holdCtx = holdCanvas.getContext('2d');
  const el = {
    score: $('score'), lines: $('lines'), level: $('level'),
    overlay: $('overlay'), title: $('overlay-title'), oScore: $('overlay-score'), detail: $('overlay-detail'),
    restart: $('restart-btn'), resume: $('resume-btn'), menuBtn: $('menu-btn'),
    theme: $('theme-toggle'), mute: $('mute-btn'), toMenu: $('to-menu-btn'),
    puSlot: $('powerup-slot'), puIcon: $('pu-icon'), puName: $('pu-name'),
    energyBar: document.querySelector('.bar.energy'), energyFill: $('energy-fill'), abilityBtn: $('ability-btn'),
    combo: $('combo-value'), b2b: $('b2b-badge'),
    fxFreeze: $('fx-freeze'), fxSlow: $('fx-slow'), fxFore: $('fx-foresight'),
    pauseMenu: $('pause-menu'), pauseBox: $('pause-box'),
    hint: $('hint'), menu: $('menu'), menuBox: $('menu-box'),
    abilityMenu: $('ability-menu'), abilityList: $('ability-list'),
    chHud: $('challenge-hud'), chName: $('ch-name'), chTimer: $('ch-timer'), chFill: $('ch-fill'), chText: $('ch-text'),
  };

  const engine = new GameEngine();
  window.Tetris.engine = engine; // acceso para depuración desde la consola
  const fx = new FX();
  let palette = C.colors;
  let gridColor = '#22222e';
  let lastSpec = null;        // desafío actual ({id, level}) o null en clásico
  let shownStatus = null;     // último estado reflejado en la UI

  // ---------- Utilidades ----------
  const textCache = new WeakMap();
  function setText(node, value) {
    const v = String(value);
    if (textCache.get(node) !== v) { node.textContent = v; textCache.set(node, v); }
  }
  const show = (node, on) => node.classList.toggle('hidden', !on);
  function pulse(node, cls) {
    node.classList.remove(cls);
    void node.offsetWidth; // reinicia la animación
    node.classList.add(cls);
  }
  function make(tag, cls, text, onClick) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text) n.textContent = text;
    if (onClick) n.addEventListener('click', onClick);
    return n;
  }

  // ---------- Dibujo ----------
  function drawBlock(c, x, y, v, size, alpha, ox = 0, oy = 0) {
    if (!v) return;
    const px = ox + x * size + 1, py = oy + y * size + 1, s = size - 2;
    c.globalAlpha = alpha ?? 1;
    if (v === CELL.WILD) {
      const hue = (x * 36 + y * 18 + performance.now() / 12) % 360;
      c.fillStyle = `hsl(${hue}, 85%, 62%)`;
    } else {
      c.fillStyle = palette[v];
    }
    c.fillRect(px, py, s, s);
    c.fillStyle = 'rgba(255,255,255,0.12)';
    c.fillRect(px, py, s, Math.max(2, size / 7));
    if (v === CELL.GARBAGE) {
      c.fillStyle = 'rgba(0,0,0,0.25)';
      c.fillRect(px + 3, py + 3, s - 6, s - 6);
    }
    c.globalAlpha = 1;
  }

  function drawGrid() {
    ctx.strokeStyle = gridColor;
    ctx.lineWidth = 0.5;
    for (let c = 1; c < COLS; c++) { ctx.beginPath(); ctx.moveTo(c * BLOCK, 0); ctx.lineTo(c * BLOCK, ROWS * BLOCK); ctx.stroke(); }
    for (let r = 1; r < ROWS; r++) { ctx.beginPath(); ctx.moveTo(0, r * BLOCK); ctx.lineTo(COLS * BLOCK, r * BLOCK); ctx.stroke(); }
  }

  // Dibuja una pieza centrada por su caja envolvente dentro de un rectángulo
  function drawPreview(c, type, w, h, size, alpha) {
    if (!type) return;
    const shape = Pieces.makePiece(type).shape;
    let minR = 99, maxR = -1, minC = 99, maxC = -1;
    shape.forEach((row, r) => row.forEach((v, cc) => {
      if (!v) return;
      minR = Math.min(minR, r); maxR = Math.max(maxR, r);
      minC = Math.min(minC, cc); maxC = Math.max(maxC, cc);
    }));
    const ox = (w - (maxC - minC + 1) * size) / 2 - minC * size;
    const oy = (h - (maxR - minR + 1) * size) / 2 - minR * size;
    shape.forEach((row, r) => row.forEach((v, cc) => drawBlock(c, cc, r, v, size, alpha, ox, oy)));
  }

  function drawSidePanels() {
    nextCtx.clearRect(0, 0, 120, 120);
    const next = engine.peekNext(engine.nextCount);
    drawPreview(nextCtx, next[0], 120, 120, 30);

    const showExtra = engine.nextCount > 1;
    show(extraCanvas, showExtra);
    if (showExtra) {
      extraCtx.clearRect(0, 0, 120, 200);
      next.slice(1).forEach((t, i) => {
        const c = extraCtx;
        c.save();
        c.translate(0, i * 50);
        drawPreview(c, t, 120, 50, 12);
        c.restore();
      });
    }

    holdCtx.clearRect(0, 0, 120, 120);
    drawPreview(holdCtx, engine.hold.type, 120, 120, 30);
    holdCanvas.classList.toggle('used', engine.hold.used);
  }

  function drawTarget() {
    const t = engine.target;
    if (!t) return;
    ctx.save();
    const wave = 0.25 + 0.15 * Math.sin(performance.now() / 120);
    if (t.type === 'bomb') {
      const x0 = Math.max(0, t.x - 1), x1 = Math.min(COLS - 1, t.x + 1);
      const y0 = Math.max(0, t.y - 1), y1 = Math.min(ROWS - 1, t.y + 1);
      ctx.fillStyle = `rgba(229,115,115,${wave + 0.15})`;
      ctx.fillRect(x0 * BLOCK, y0 * BLOCK, (x1 - x0 + 1) * BLOCK, (y1 - y0 + 1) * BLOCK);
      ctx.strokeStyle = '#e57373'; ctx.lineWidth = 2;
      ctx.strokeRect(x0 * BLOCK, y0 * BLOCK, (x1 - x0 + 1) * BLOCK, (y1 - y0 + 1) * BLOCK);
    } else if (t.type === 'lightning') {
      ctx.fillStyle = `rgba(255,238,88,${wave + 0.1})`;
      if (t.axis === 'row') ctx.fillRect(0, t.y * BLOCK, COLS * BLOCK, BLOCK);
      else ctx.fillRect(t.x * BLOCK, 0, BLOCK, ROWS * BLOCK);
    } else if (t.type === 'tint') {
      const v = engine.board[t.y][t.x];
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2;
      if (v && v !== CELL.GARBAGE && v !== CELL.WILD) {
        for (let y = 0; y < ROWS; y++)
          for (let x = 0; x < COLS; x++)
            if (engine.board[y][x] === v) ctx.strokeRect(x * BLOCK + 2, y * BLOCK + 2, BLOCK - 4, BLOCK - 4);
      }
      ctx.fillStyle = `rgba(255,255,255,${wave})`;
      ctx.fillRect(t.x * BLOCK, t.y * BLOCK, BLOCK, BLOCK);
    }
    ctx.restore();
  }

  function render() {
    const [sx, sy] = fx.shakeOffset();
    ctx.save();
    ctx.translate(sx, sy);
    ctx.clearRect(-10, -10, canvas.width + 20, canvas.height + 20);
    drawGrid();

    // Piezas invisibles: el tablero solo se ve durante el destello tras limpiar líneas
    const hidden = engine.challenge.hideLocked() && fx.boardFlashMs <= 0
      && engine.status !== 'over' && engine.status !== 'won';
    if (!hidden) {
      for (let r = 0; r < ROWS; r++)
        for (let c = 0; c < COLS; c++)
          drawBlock(ctx, c, r, engine.board[r][c], BLOCK);
    }

    const p = engine.current;
    if (p && engine.status !== 'menu' && engine.status !== 'ready') {
      if (!hidden) {
        const gy = engine.ghostY();
        for (let r = 0; r < p.shape.length; r++)
          for (let c = 0; c < p.shape[r].length; c++)
            drawBlock(ctx, p.x + c, gy + r, p.shape[r][c], BLOCK, 0.2);
      }
      for (let r = 0; r < p.shape.length; r++)
        for (let c = 0; c < p.shape[r].length; c++)
          if (p.shape[r][c] && p.y + r >= 0) drawBlock(ctx, p.x + c, p.y + r, p.shape[r][c], BLOCK);
    }

    if (engine.frozen) {
      ctx.fillStyle = 'rgba(77,208,225,0.10)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    drawTarget();
    fx.draw(ctx, canvas.width, canvas.height);
    ctx.restore();
    drawSidePanels();
  }

  // ---------- HUD ----------
  function updateHUD() {
    setText(el.score, engine.score.toLocaleString());
    setText(el.lines, engine.lines);
    setText(el.level, engine.level);

    // power-up
    const slot = engine.powerups.slot;
    const def = slot ? PowerUpManager.DEFS[slot] : null;
    setText(el.puIcon, def ? def.icon : '·');
    setText(el.puName, def ? def.name : 'Vacío');
    el.puSlot.classList.toggle('empty', !slot);
    el.puSlot.classList.toggle('ready', !!slot);

    // energía
    const a = engine.abilities;
    el.energyFill.style.width = (a.energy / C.energy.max * 100) + '%';
    el.energyBar.classList.toggle('full', a.full);
    el.abilityBtn.classList.toggle('ready', a.full);

    // combo
    setText(el.combo, 'x' + engine.combo.combo);
    el.combo.classList.toggle('hot', engine.combo.combo >= 2);
    show(el.b2b, engine.combo.b2b);

    // efectos activos
    const chip = (node, ms, label) => { show(node, ms > 0); if (ms > 0) setText(node, `${label} ${(ms / 1000).toFixed(1)}s`); };
    chip(el.fxFreeze, engine.powerups.freezeMs, '❄ CONGELADO');
    chip(el.fxSlow, a.slowMs, '⏳ LENTO');
    chip(el.fxFore, a.foresightMs, '🔮 VISIÓN');
    canvas.classList.toggle('frozen', engine.frozen);
    canvas.classList.toggle('slow', a.slowMs > 0);
    canvas.classList.toggle('targeting', engine.status === 'targeting');

    // desafío
    const prog = engine.challenge.progress(engine);
    show(el.chHud, !!prog && engine.status !== 'menu');
    if (prog) {
      setText(el.chText, prog.text);
      setText(el.chTimer, prog.timer);
      el.chFill.style.width = (prog.ratio * 100) + '%';
    }

    if (engine.status === 'abilityMenu') updateAbilityMenu();
  }

  // ---------- Menú de habilidades ----------
  const abilityRows = AbilityManager.DEFS.map((d, i) => {
    const row = make('button', 'ability-item');
    row.type = 'button';
    row.appendChild(make('span', 'num', String(i + 1)));
    const info = make('span', 'info');
    info.appendChild(make('b', '', d.name));
    info.appendChild(make('small', '', d.desc));
    row.appendChild(info);
    row.appendChild(make('span', 'cost', String(C.energy.costs[d.id])));
    row.addEventListener('click', () => engine.useAbility(d.id));
    el.abilityList.appendChild(row);
    return { id: d.id, row };
  });

  function updateAbilityMenu() {
    abilityRows.forEach(({ id, row }) => row.classList.toggle('off', !engine.abilityStatus(id).ok));
  }

  // ---------- Menús ----------
  const progressKey = (id, lvl) => `tetris-done-${id}-${lvl}`;
  function isDone(id, lvl) { try { return localStorage.getItem(progressKey(id, lvl)) === '1'; } catch (e) { return false; } }
  function markDone(id, lvl) { try { localStorage.setItem(progressKey(id, lvl), '1'); } catch (e) {} }

  function menuScreen(build) {
    el.menuBox.replaceChildren();
    build(el.menuBox);
    el.menu.classList.remove('hidden');
    el.menu.style.animation = 'none'; void el.menu.offsetWidth; el.menu.style.animation = '';
  }

  function showMain() {
    lastSpec = null;
    engine.reset({ status: 'menu' });
    fx.reset();
    menuScreen(box => {
      box.appendChild(make('p', 'menu-title', 'TETRIS'));
      box.appendChild(make('p', 'menu-sub', 'Elige un modo de juego'));
      const list = make('div', 'menu-list');
      const classic = make('button', 'menu-btn', 'Clásico', () => startGame(null));
      classic.appendChild(make('small', '', 'Partida libre con hold, power-ups, combos y habilidades'));
      const chal = make('button', 'menu-btn', 'Desafío', showChallengeList);
      chal.appendChild(make('small', '', '5 retos con objetivos y 3 dificultades'));
      list.append(classic, chal);
      box.appendChild(list);
    });
  }

  function showChallengeList() {
    menuScreen(box => {
      box.appendChild(make('p', 'menu-title', 'DESAFÍO'));
      const list = make('div', 'menu-list');
      ChallengeManager.DEFS.forEach(d => {
        const done = d.levels.every((_, i) => isDone(d.id, i));
        const b = make('button', 'menu-btn' + (done ? ' done' : ''), d.name, () => showLevels(d));
        b.appendChild(make('small', '', d.desc));
        list.appendChild(b);
      });
      list.appendChild(make('button', 'menu-btn secondary', 'Volver', showMain));
      box.appendChild(list);
    });
  }

  function showLevels(def) {
    menuScreen(box => {
      box.appendChild(make('p', 'menu-title', def.name.toUpperCase()));
      box.appendChild(make('p', 'menu-sub', def.desc));
      const levels = make('div', 'levels');
      def.levels.forEach((l, i) => {
        const b = make('button', 'menu-btn' + (isDone(def.id, i) ? ' done' : ''), ChallengeManager.LEVEL_NAMES[i],
          () => startGame({ id: def.id, level: i }));
        b.appendChild(make('small', '', def.goal(l)));
        levels.appendChild(b);
      });
      box.appendChild(levels);
      box.appendChild(make('button', 'menu-btn secondary', 'Volver', showChallengeList));
    });
  }

  // Presentación del desafío: objetivo + advertencias antes de empezar
  function showBriefing() {
    const ch = engine.challenge;
    menuScreen(box => {
      box.appendChild(make('p', 'menu-title', ch.def.name.toUpperCase()));
      box.appendChild(make('p', 'menu-sub', `${ChallengeManager.LEVEL_NAMES[ch.levelIdx]} · ${ch.def.goal(ch.cfg)}`));
      if (ch.def.warning) box.appendChild(make('p', 'menu-warning', ch.def.warning(ch.cfg)));
      if (ch.def.id === 'invisible') box.appendChild(make('p', 'menu-warning', 'Tus bloques se ocultan al bloquearse. ¡Memoriza el tablero!'));
      const row = make('div', 'overlay-buttons');
      row.appendChild(make('button', 'menu-btn', 'Comenzar', () => { Sound.unlock(); hideMenu(); engine.begin(); }));
      row.appendChild(make('button', 'menu-btn secondary', 'Atrás', () => showLevels(ch.def)));
      box.appendChild(row);
    });
  }

  const hideMenu = () => el.menu.classList.add('hidden');

  function startGame(spec) {
    Sound.unlock();
    lastSpec = spec;
    fx.reset();
    hideMenu();
    engine.reset(spec ? { challenge: spec } : { startLevel: getStartLevel() });
    syncStatus();
  }

  // ---------- Menú de pausa ----------
  const START_LEVEL_KEY = 'tetris-start-level';
  const MAX_START_LEVEL = 15;
  const PAUSE_GUARD_MS = 150;
  let guardUntil = 0;              // descarta teclas de juego tras reanudar (solo UI)
  const menuKeys = new Set();      // teclas pulsadas mientras el menú está abierto

  function getStartLevel() {
    try {
      const n = parseInt(localStorage.getItem(START_LEVEL_KEY), 10);
      if (n >= 1 && n <= MAX_START_LEVEL) return n;
    } catch (e) {}
    return 1;
  }
  function setStartLevel(n) {
    try { localStorage.setItem(START_LEVEL_KEY, String(n)); } catch (e) {}
  }

  const CONTROLS = [
    ['← →', 'Mover'], ['↑ / X', 'Rotar'], ['Z', 'Rotar inverso'], ['↓', 'Bajar'],
    ['Espacio', 'Caída instantánea'], ['C / Shift', 'Guardar pieza (hold)'],
    ['E', 'Usar power-up'], ['Q', 'Habilidades'], ['P / Esc', 'Pausa'],
  ];

  function pauseScreen(build) {
    el.pauseBox.replaceChildren();
    build(el.pauseBox);
    const first = el.pauseBox.querySelector('button');
    if (first) first.focus();
  }

  function showPauseMain() {
    pauseScreen(box => {
      box.appendChild(make('p', 'menu-title', 'PAUSA'));
      const list = make('div', 'menu-list');
      list.appendChild(make('button', 'menu-btn', 'Reanudar', () => togglePause()));
      list.appendChild(make('button', 'menu-btn', 'Reiniciar', () => startGame(lastSpec)));
      list.appendChild(make('button', 'menu-btn', 'Ver controles', showPauseControls));
      const lvl = make('button', 'menu-btn', '', () => stepStartLevel(1));
      lvl.dataset.level = '1';
      lvl._paint = () => {
        lvl.textContent = `Nivel inicial: ◀ ${getStartLevel()} ▶`;
        lvl.appendChild(make('small', '', lastSpec ? 'Solo para partidas clásicas' : 'Se aplica a la próxima partida'));
      };
      lvl._paint();
      list.appendChild(lvl);
      list.appendChild(make('button', 'menu-btn secondary', 'Menú', () => { hideOverlays(); showMain(); }));
      box.appendChild(list);
    });
  }

  function stepStartLevel(d) {
    const n = ((getStartLevel() - 1 + d + MAX_START_LEVEL) % MAX_START_LEVEL) + 1;
    setStartLevel(n);
    const b = el.pauseBox.querySelector('[data-level]');
    if (b && b._paint) { b._paint(); b.focus(); }
  }

  function showPauseControls() {
    pauseScreen(box => {
      box.appendChild(make('p', 'menu-title', 'CONTROLES'));
      const dl = make('dl', 'controls-list');
      CONTROLS.forEach(([k, d]) => { dl.appendChild(make('dt', '', k)); dl.appendChild(make('dd', '', d)); });
      box.appendChild(dl);
      box.appendChild(make('button', 'menu-btn secondary', 'Volver', showPauseMain));
    });
  }

  function togglePause() {
    const wasPaused = engine.status === 'paused';
    engine.togglePause();
    if (wasPaused && engine.status !== 'paused') guardUntil = performance.now() + PAUSE_GUARD_MS;
  }

  function pauseNav(e) {
    const btns = [...el.pauseBox.querySelectorAll('button')];
    if (!btns.length) return;
    const i = btns.indexOf(document.activeElement);
    if (i < 0) { if (/^(Arrow(Up|Down)|Enter)$/.test(e.code)) { e.preventDefault(); btns[0].focus(); } return; }
    if (e.code === 'ArrowDown') btns[(i + 1) % btns.length].focus();
    else if (e.code === 'ArrowUp') btns[(i - 1 + btns.length) % btns.length].focus();
    else if ((e.code === 'ArrowLeft' || e.code === 'ArrowRight') && document.activeElement && document.activeElement.dataset.level) {
      stepStartLevel(e.code === 'ArrowLeft' ? -1 : 1);
    }
  }

  // ---------- Estado → overlays ----------
  const END_REASONS = {
    time: 'Se acabó el tiempo.',
    blocked: 'El tablero se llenó.',
    overflow: 'La basura desbordó el tablero.',
    lockout: 'La pieza se bloqueó fuera del tablero.',
  };

  function syncStatus() {
    const s = engine.status;
    if (s === shownStatus) return;
    const prevStatus = shownStatus;
    shownStatus = s;

    if (prevStatus === 'paused' && s === 'playing') guardUntil = Math.max(guardUntil, performance.now() + PAUSE_GUARD_MS);
    show(el.overlay, s === 'over' || s === 'won');
    show(el.pauseMenu, s === 'paused');
    if (s === 'paused') { menuKeys.clear(); showPauseMain(); }
    show(el.abilityMenu, s === 'abilityMenu');
    el.title.classList.toggle('win', s === 'won');
    show(el.resume, s === 'paused');

    if (s === 'ready') showBriefing();
    if (s === 'over') {
      const ch = engine.mode === 'challenge';
      el.title.textContent = ch ? 'DERROTA' : 'GAME OVER';
      el.oScore.textContent = `Puntuación: ${engine.score.toLocaleString()}`;
      el.detail.textContent = ch ? (END_REASONS[engine.endReason] || '') : '';
      el.restart.textContent = ch ? 'Reintentar' : 'Reiniciar';
    } else if (s === 'won') {
      const ch = engine.challenge;
      markDone(ch.def.id, ch.levelIdx);
      el.title.textContent = 'VICTORIA';
      el.oScore.textContent = `Puntuación: ${engine.score.toLocaleString()}`;
      el.detail.textContent = `${ch.def.name} (${ChallengeManager.LEVEL_NAMES[ch.levelIdx]}) · ${engine.lines} líneas · ${ChallengeManager.fmt(ch.elapsed)}`;
      el.restart.textContent = 'Reintentar';
    }

    // pista de selección
    const t = engine.target;
    show(el.hint, s === 'targeting');
    if (s === 'targeting' && t) el.hint.textContent = PowerUpManager.DEFS[t.type].hint;
  }

  // ---------- Eventos del motor → efectos y sonido ----------
  const cellCenter = (x, y) => [x * BLOCK + BLOCK / 2, y * BLOCK + BLOCK / 2];
  const colorOf = v => (v === CELL.WILD ? `hsl(${Math.random() * 360},85%,62%)` : palette[v]);

  engine.on('move', () => Sound.play('move'));
  engine.on('rotate', () => Sound.play('rotate'));
  engine.on('lock', () => Sound.play('lock'));
  engine.on('harddrop', d => { if (d.dist > 2) Sound.play('drop'); });
  engine.on('hold', () => { Sound.play('hold'); pulse(holdCanvas, 'swap'); });
  engine.on('garbage', () => { Sound.play('garbage'); fx.shake(200, 4); });
  engine.on('powerup-gained', d => {
    Sound.play('powerup');
    fx.popup(PowerUpManager.DEFS[d.type].icon + ' ' + PowerUpManager.DEFS[d.type].name, '#fff176', 18);
  });
  engine.on('energy-full', () => { Sound.play('energy'); fx.flash(500, '#81c784'); });
  engine.on('banner', b => { fx.showBanner(b.text); Sound.play('banner'); });

  engine.on('lines', d => {
    d.cells.forEach(({ x, y, v }) => { const [px, py] = cellCenter(x, y); fx.burst(px, py, colorOf(v), d.count >= 4 ? 4 : 2); });
    fx.boardFlashMs = 500;
    if (d.labels.includes('PERFECT CLEAR')) { Sound.play('perfect'); fx.flash(900, '#fff59d'); fx.shake(350, 6); }
    else if (d.tSpin) Sound.play('tspin');
    else if (d.count === 4) { Sound.play('tetris'); fx.flash(600, '#4dd0e1'); fx.shake(320, 6); }
    else Sound.play('line');
    if (d.b2b) Sound.play('b2b');
    if (d.combo >= 2) Sound.combo(d.combo);
    d.labels.forEach(l => {
      const color = l.startsWith('COMBO') ? '#ffb74d' : l === 'BACK-TO-BACK' ? '#f06292' : l === 'PERFECT CLEAR' ? '#fff176' : l === 'T-SPIN' ? '#ba68c8' : '#4dd0e1';
      fx.popup(l, color, l.startsWith('COMBO') ? 20 + Math.min(d.combo, 8) * 2 : 24);
    });
    if (d.points) fx.popup('+' + d.points.toLocaleString(), '#ffffff', 16);
  });

  engine.on('bomb', d => {
    const [cx, cy] = cellCenter(d.x, d.y);
    d.cells.forEach(({ x, y, v }) => { const [px, py] = cellCenter(x, y); fx.burst(px, py, colorOf(v), 5, 0.3); });
    fx.ring(cx, cy, '#ff8a65', 110);
    fx.flash(350, '#ff8a65'); fx.shake(380, 7);
    Sound.play('bomb');
  });
  engine.on('lightning', d => {
    d.cells.forEach(({ x, y, v }) => { const [px, py] = cellCenter(x, y); fx.burst(px, py, '#fff59d', 3, 0.25); });
    if (d.axis === 'row') fx.bolt(0, d.index * BLOCK + BLOCK / 2, COLS * BLOCK, d.index * BLOCK + BLOCK / 2);
    else fx.bolt(d.index * BLOCK + BLOCK / 2, 0, d.index * BLOCK + BLOCK / 2, ROWS * BLOCK);
    fx.flash(250, '#fff59d'); fx.shake(200, 3);
    Sound.play('lightning');
  });
  engine.on('powerup', d => {
    if (d.type === 'tint') { fx.flash(400, '#ce93d8'); Sound.play('tint'); fx.popup('COMODINES', '#ce93d8', 20); }
    if (d.type === 'gravity') { Sound.play('gravity'); fx.shake(220, 3); fx.popup('GRAVEDAD', '#90caf9', 20); }
    if (d.type === 'freeze') { Sound.play('freeze'); fx.flash(500, '#4dd0e1'); fx.popup('CONGELADO', '#4dd0e1', 22); }
  });
  engine.on('ability', d => {
    Sound.play('ability');
    fx.flash(350, '#b39ddb');
    fx.popup(AbilityManager.DEFS.find(a => a.id === d.id).name.toUpperCase(), '#b39ddb', 20);
  });
  engine.on('targeting', () => Sound.play('powerup'));

  engine.on('denied', d => {
    Sound.play('error');
    const node = d.reason === 'hold' ? holdCanvas
      : d.reason === 'powerup' || d.reason === 'conflict' || d.reason === 'target' ? el.puSlot
      : el.abilityBtn;
    pulse(node, 'deny');
    if (d.reason === 'target') fx.popup('Elige un bloque de color', '#e57373', 14);
    if (d.reason === 'conflict') fx.popup('Efecto incompatible', '#e57373', 14);
  });
  engine.on('over', () => Sound.play('lose'));
  engine.on('won', () => Sound.play('win'));

  // ---------- Entrada ----------
  const BLOCKED_KEYS = new Set(['ArrowLeft', 'ArrowRight', 'ArrowDown', 'ArrowUp', 'Space']);

  document.addEventListener('keydown', e => {
    Sound.unlock();
    if (BLOCKED_KEYS.has(e.code) && !(e.code === 'Space' && engine.status === 'paused')) e.preventDefault();
    const s = engine.status;

    if (s === 'paused') {
      if (e.code === 'KeyP' || e.code === 'Escape') {
        if (!e.repeat) togglePause();
        return;
      }
      if (e.repeat && menuKeys.has(e.code)) return;
      menuKeys.add(e.code);
      pauseNav(e);
      return;
    }
    if (e.code === 'KeyP') { if (!e.repeat) togglePause(); return; }
    if (s === 'playing' && performance.now() < guardUntil) return;
    if (s === 'playing' && e.code === 'Escape') { togglePause(); return; }
    if (menuKeys.has(e.code)) { if (e.repeat) return; menuKeys.delete(e.code); }

    if (s === 'targeting') {
      switch (e.code) {
        case 'ArrowLeft': engine.moveTarget(-1, 0); break;
        case 'ArrowRight': engine.moveTarget(1, 0); break;
        case 'ArrowUp': engine.moveTarget(0, -1); break;
        case 'ArrowDown': engine.moveTarget(0, 1); break;
        case 'KeyR': engine.toggleAxis(); break;
        case 'Enter': case 'Space': engine.confirmTarget(); break;
        case 'Escape': engine.cancelTarget(); break;
      }
      return;
    }

    if (s === 'abilityMenu') {
      if (e.code === 'Escape' || e.code === 'KeyQ') engine.closeAbilityMenu();
      else if (/^Digit[1-5]$/.test(e.code)) engine.useAbility(AbilityManager.DEFS[+e.code.slice(5) - 1].id);
      return;
    }

    if (s === 'ready' && e.code === 'Enter') { hideMenu(); engine.begin(); return; }
    if (s !== 'playing') return;

    switch (e.code) {
      case 'ArrowLeft': engine.move(-1); break;
      case 'ArrowRight': engine.move(1); break;
      case 'ArrowDown': engine.softDrop(); break;
      case 'ArrowUp': case 'KeyX': engine.rotate(1); break;
      case 'KeyZ': engine.rotate(-1); break;
      case 'Space': engine.hardDrop(); break;
      case 'KeyC': case 'ShiftLeft': case 'ShiftRight': engine.holdPiece(); break;
      case 'KeyE': engine.usePowerUp(); break;
      case 'KeyQ': engine.openAbilityMenu(); break;
    }
  });

  document.addEventListener('keyup', e => menuKeys.delete(e.code));

  // Ratón: selección de objetivo de los power-ups
  function cellFromEvent(e) {
    const rect = canvas.getBoundingClientRect();
    const x = Math.floor((e.clientX - rect.left) * (canvas.width / rect.width) / BLOCK);
    const y = Math.floor((e.clientY - rect.top) * (canvas.height / rect.height) / BLOCK);
    return [x, y];
  }
  canvas.addEventListener('mousemove', e => {
    if (engine.status === 'targeting') engine.setTarget(...cellFromEvent(e));
  });
  canvas.addEventListener('click', e => {
    if (engine.status !== 'targeting') return;
    engine.setTarget(...cellFromEvent(e));
    engine.confirmTarget();
  });
  canvas.addEventListener('contextmenu', e => {
    if (engine.status === 'targeting') { e.preventDefault(); engine.toggleAxis(); }
  });

  el.puSlot.addEventListener('click', () => { Sound.unlock(); if (engine.status === 'playing') engine.usePowerUp(); });
  el.abilityBtn.addEventListener('click', () => { Sound.unlock(); if (engine.status === 'playing') engine.openAbilityMenu(); });

  // Los botones no deben conservar el foco (Espacio activaría el botón en vez de la caída)
  document.addEventListener('click', e => {
    const b = e.target.closest && e.target.closest('button');
    if (b) b.blur();
  });

  el.restart.addEventListener('click', () => startGame(lastSpec));
  el.resume.addEventListener('click', () => engine.togglePause());
  el.menuBtn.addEventListener('click', () => { hideOverlays(); showMain(); });
  el.toMenu.addEventListener('click', () => { hideOverlays(); showMain(); });
  function hideOverlays() { show(el.overlay, false); show(el.pauseMenu, false); show(el.abilityMenu, false); shownStatus = null; }

  // ---------- Tema y sonido ----------
  function applyTheme(theme, save) {
    const isLight = theme === 'light';
    document.documentElement.dataset.theme = isLight ? 'light' : 'dark';
    palette = isLight ? C.colorsLight : C.colors;
    gridColor = getComputedStyle(document.documentElement).getPropertyValue('--grid').trim() || gridColor;
    el.theme.textContent = isLight ? 'Modo oscuro' : 'Modo claro';
    el.theme.setAttribute('aria-pressed', String(isLight));
    if (save) { try { localStorage.setItem('theme', isLight ? 'light' : 'dark'); } catch (e) {} }
  }
  el.theme.addEventListener('click', () => {
    applyTheme(document.documentElement.dataset.theme === 'light' ? 'dark' : 'light', true);
  });

  function applyMute(muted, save) {
    Sound.setMuted(muted);
    el.mute.textContent = muted ? 'Sonido: no' : 'Sonido: sí';
    el.mute.setAttribute('aria-pressed', String(muted));
    if (save) { try { localStorage.setItem('muted', muted ? '1' : '0'); } catch (e) {} }
  }
  el.mute.addEventListener('click', () => { Sound.unlock(); applyMute(!Sound.muted, true); });

  let savedTheme = 'dark', savedMute = false;
  try {
    savedTheme = localStorage.getItem('theme') === 'light' ? 'light' : 'dark';
    savedMute = localStorage.getItem('muted') === '1';
  } catch (e) {}
  applyTheme(savedTheme, false);
  applyMute(savedMute, false);

  // ---------- Bucle principal ----------
  // Siempre activo: renderiza y anima efectos; la lógica solo avanza en 'playing' (engine.update).
  let last = performance.now();
  function frame(ts) {
    const dt = Math.min(ts - last, 100);
    last = ts;
    engine.update(dt);
    fx.update(dt);
    syncStatus();
    render();
    updateHUD();
    requestAnimationFrame(frame);
  }

  showMain();
  requestAnimationFrame(frame);
})();
