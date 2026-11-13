# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Vanilla JavaScript Tetris on HTML5 Canvas. No runtime dependencies, no build step, no package.json, no linter. The README and UI text are in Spanish; keep user-facing strings in Spanish.

## Running and testing

- Play: open `index.html` directly, or serve statically (e.g. `python -m http.server 8000`, then http://localhost:8000).
- Tests (Node only, for the engine; no dependencies): `node --test tests/*.test.js`. Run them after any change to `js/`.

## Architecture

The game logic is a DOM-free engine (testable in Node); `game.js` is only presentation. All scripts are classic `<script>`s (not modules) loaded in the order listed in `index.html`. Each `js/*.js` is a small UMD-style IIFE: it registers itself on `window.Tetris` (browser) / `globalThis.Tetris` (Node) and also does `module.exports` when available, and resolves dependencies with `T.X || require('./x')`. Add new files to the `<script>` list in dependency order.

- `js/config.js` — `CONFIG`: board size, scoring tables, piece weights, power-up/energy balance, color palettes. Cell values: 1–7 standard pieces, 8 Tuerca, 9 `+`, 10 `U`, 11 `Y`, 12 `1×1`, 13 garbage (`CELL.GARBAGE`), 14 wildcard (`CELL.WILD`). `colors`/`colorsLight` are indexed by cell value.
- `js/board.js` — pure functions over a board matrix (collide, rotate CW/CCW, merge, clearFullRows with wildcard rule `empties <= wilds`, compact (gravity), bomb, clearRow/Column, convertColor, pushGarbage, tSpinCorners…). They mutate the board passed in.
- `js/pieces.js` — piece shapes (`KEYS` order defines the type id = index+1), `makePiece`, and `PieceQueue` (weighted random; `items[0]` is the next piece; the 1×1 is never random, it is `pushFront`-ed as a Tetris reward).
- `js/managers/` — `hold`, `combo` (the single place that computes placement score: combo, T-Spin, B2B, perfect clear), `powerups` (slot + freeze timer), `abilities` (energy + slow/foresight timers), `challenge` (5 challenge definitions, progress, win/lose checks).
- `js/engine.js` — `GameEngine`: the single source of truth. Status machine: `menu | ready | playing | paused | targeting | abilityMenu | over | won`. Actions (`move`, `rotate`, `softDrop`, `hardDrop`, `holdPiece`, `usePowerUp`/`confirmTarget`, `openAbilityMenu`/`useAbility`, `undo`…), `update(dt)`, and an event emitter (`on`/`emit`) that the UI subscribes to. Piece lifecycle: `lockPiece()` → merge → `clearFullRows` → `combo.score` → `addLines` (level, energy, power-up roll) → `spawn()` (pushes an undo snapshot; ends the game if the new piece collides).
- `js/fx.js`, `js/audio.js` — canvas effects and WebAudio sounds; used only by `game.js`.
- `game.js` — DOM lookup by id (must match `index.html`), rendering, HUD, menus, keyboard/mouse input, and handlers that turn engine events into FX/sound. `window.Tetris.engine` is exposed for console debugging.

### Rules to keep when changing things

- **All time-based logic must advance through `engine.update(dt)`** and only while `status === 'playing'`. Do not use `setTimeout`/`setInterval` for gameplay: timers then pause with the game and `reset()` clears them. (The render loop in `game.js` always runs; the engine ignores updates when not playing. This is also what keeps Game Over from continuing to spawn pieces — `cancelAnimationFrame` cannot cancel the frame currently executing.)
- Engine code must not touch the DOM. UI reacts to events (`lines`, `bomb`, `denied`, `over`, `won`, …).
- Inject randomness through `engine.rng` so tests stay deterministic (`tests/helpers.js` has a seeded RNG).
- Rendering constants: `BLOCK = 30`px, 10×20 board; canvas size in `index.html` (300×600) must match `COLS*BLOCK` × `ROWS*BLOCK`.
- Scoring/speed: `lineScores * level * combo (×1.5 B2B)`, level = `floor(lines/10)+1`, `dropInterval = max(100, 1000 - (level-1)*90)` ms (×3 with Tiempo lento); soft drop +1 per cell, hard drop +2 per cell. Rotation is `rotateCW`/`rotateCCW` plus the `KICKS` table (horizontal kicks and small downward kicks, no SRS).
