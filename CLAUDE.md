# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Vanilla JavaScript Tetris on HTML5 Canvas. No dependencies, no build step, no package.json, no tests or linter. The README and UI text are in Spanish; keep user-facing strings in Spanish.

## Running

Open `index.html` directly, or serve statically (e.g. `python -m http.server 8000`, then http://localhost:8000).

## Architecture

Three files, all logic in `game.js` (loaded as a classic script, `'use strict'`, global state — not a module):

- `index.html` defines the DOM that `game.js` looks up by id at load time (`board`, `next-canvas`, `score`, `lines`, `level`, `overlay`, `overlay-title`, `overlay-score`, `restart-btn`). Renaming an id requires updating the constants at the top of `game.js`.
- Game state lives in module-level `let` variables (`board`, `current`, `next`, `score`, `lines`, `level`, `paused`, `gameOver`, `dropInterval`, ...) reset by `init()`, which is also the restart handler.
- The loop is `requestAnimationFrame`-driven (`loop`): accumulates delta time into `dropAccum`, applies gravity when it exceeds `dropInterval`, then calls `draw()`. Pause and game over stop the loop via `cancelAnimationFrame(animId)`; unpausing restarts it. Input is handled separately in a `keydown` listener that mutates state directly.
- Piece lifecycle: `lockPiece()` → `merge()` → `clearLines()` → `spawn()`. `spawn()` promotes `next` to `current` and ends the game if the new piece collides immediately.
- Pieces are 2D matrices in `PIECES`, where each cell holds the color index into `COLORS` (index 0 = empty/null). The board stores those same indices. Rotation is `rotateCW` plus horizontal wall kicks `[0,-1,1,-2,2]` in `tryRotate` (no SRS).
- Scoring/speed: `LINE_SCORES * level`, level = `floor(lines/10)+1`, `dropInterval = max(100, 1000 - (level-1)*90)` ms; soft drop +1 per cell, hard drop +2 per cell.
- Rendering constants: `BLOCK = 30`px, 10×20 board; canvas size in `index.html` (300×600) must match `COLS*BLOCK` × `ROWS*BLOCK`.
