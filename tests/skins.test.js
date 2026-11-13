'use strict';
const test = require('node:test');
const assert = require('node:assert');
const Skins = require('../js/skins');

function mockCtx() {
  const state = { globalAlpha: 1, shadowBlur: 0 };
  const stack = [];
  return new Proxy({}, {
    get(_, k) {
      if (k === 'save') return () => stack.push({ ...state });
      if (k === 'restore') return () => Object.assign(state, stack.pop());
      if (k in state) return state[k];
      return () => {};
    },
    set(_, k, v) { state[k] = v; return true; },
  });
}

test('4 skins con paleta de 15 entradas', () => {
  assert.deepStrictEqual(Skins.list.map(s => s.id), ['retro', 'neon', 'pastel', 'pixel']);
  for (const s of Skins.list) {
    assert.strictEqual(s.colors.length, 15, s.id);
    assert.strictEqual(s.colors[0], null);
    for (let i = 1; i < 15; i++) assert.match(s.colors[i], /^#[0-9a-f]{6}$/i, `${s.id}[${i}]`);
    assert.ok(s.name && s.grid);
  }
  assert.strictEqual(Skins.palette(Skins.get('retro'), true).length, 15);
});

test('drawBlock no lanza y no filtra glow ni alpha', () => {
  for (const s of Skins.list) {
    const ctx = mockCtx();
    ctx.globalAlpha = 0.2;
    for (const garbage of [false, true]) s.drawBlock(ctx, 1, 1, 28, s.colors[3], { size: 30, garbage });
    assert.strictEqual(ctx.shadowBlur, 0, s.id);
    assert.strictEqual(ctx.globalAlpha, 0.2, s.id);
  }
});

test('id desconocido cae a Retro', () => {
  assert.strictEqual(Skins.get('nope').id, 'retro');
  assert.strictEqual(Skins.get(undefined).id, 'retro');
});

test('Retro usa paleta clara en tema claro; otras no', () => {
  assert.notStrictEqual(Skins.palette(Skins.get('retro'), true), Skins.palette(Skins.get('retro'), false));
  assert.strictEqual(Skins.palette(Skins.get('neon'), true), Skins.get('neon').colors);
});
