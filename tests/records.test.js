const test = require('node:test');
const assert = require('node:assert');
const R = require('../js/records');

const mem = (init) => {
  const d = {};
  if (init !== undefined) d[R.KEY] = init;
  return { getItem: k => (k in d ? d[k] : null), setItem: (k, v) => { d[k] = String(v); }, removeItem: k => { delete d[k]; }, d };
};
const e = (score, extra) => Object.assign({ name: 'A', score, lines: 1, level: 1, maxCombo: 0, date: 'x' }, extra);

test('add ordena por puntuación desc y devuelve rank', () => {
  let l = [];
  l = R.add(l, e(100)).list;
  l = R.add(l, e(300)).list;
  const r = R.add(l, e(200));
  assert.deepStrictEqual(r.list.map(x => x.score), [300, 200, 100]);
  assert.strictEqual(r.rank, 2);
});

test('límite de 5 y qualifies', () => {
  let l = [];
  for (const s of [50, 60, 70, 80, 90]) l = R.add(l, e(s)).list;
  assert.strictEqual(l.length, 5);
  assert.strictEqual(R.qualifies(l, 50), false);
  assert.strictEqual(R.qualifies(l, 51), true);
  const r = R.add(l, e(55));
  assert.strictEqual(r.list.length, 5);
  assert.strictEqual(r.list[4].score, 55);
  assert.strictEqual(r.rank, 5);
  const no = R.add(l, e(10));
  assert.strictEqual(no.rank, 0);
  assert.strictEqual(no.list.length, 5);
});

test('puntuación 0 no entra; lista no llena sí', () => {
  assert.strictEqual(R.qualifies([], 0), false);
  assert.strictEqual(R.add([], e(0)).rank, 0);
  assert.strictEqual(R.qualifies([], 1), true);
});

test('empate queda detrás del existente', () => {
  const l = R.add([e(100, { name: 'Uno' })], e(100, { name: 'Dos' }));
  assert.strictEqual(l.rank, 2);
  assert.strictEqual(l.list[0].name, 'Uno');
});

test('bests', () => {
  const l = [e(10, { maxCombo: 3, lines: 5 }), e(5, { maxCombo: 7, lines: 2 })];
  assert.deepStrictEqual(R.bests(l), { maxCombo: 7, maxLines: 5 });
  assert.deepStrictEqual(R.bests([]), { maxCombo: 0, maxLines: 0 });
});

test('save / load / clear', () => {
  const s = mem();
  const l = R.add([], e(42)).list;
  assert.ok(R.save(s, l));
  assert.strictEqual(R.load(s)[0].score, 42);
  R.clear(s);
  assert.deepStrictEqual(R.load(s), []);
});

test('JSON corrupto o storage que lanza', () => {
  assert.deepStrictEqual(R.load(mem('{no json')), []);
  assert.deepStrictEqual(R.load(mem('{"a":1}')), []);
  const bad = { getItem() { throw new Error('x'); }, setItem() { throw new Error('x'); }, removeItem() { throw new Error('x'); } };
  assert.deepStrictEqual(R.load(bad), []);
  assert.strictEqual(R.save(bad, []), false);
  assert.strictEqual(R.clear(bad), false);
  assert.deepStrictEqual(R.load(null), []);
});

test('saneado de nombre', () => {
  assert.strictEqual(R.cleanName('   '), 'Jugador');
  assert.strictEqual(R.cleanName(undefined), 'Jugador');
  assert.strictEqual(R.cleanName('  Ana  '), 'Ana');
  assert.strictEqual(R.cleanName('abcdefghijklmnopqrstuvwxyz').length, 12);
  assert.strictEqual(R.add([], e(5, { name: '' })).list[0].name, 'Jugador');
});
