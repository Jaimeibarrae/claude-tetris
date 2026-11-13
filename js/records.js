(function (G) {
  'use strict';
  const T = G.Tetris = G.Tetris || {};

  const KEY = 'tetris-records';
  const MAX = 5;
  const NAME_MAX = 12;
  const DEFAULT_NAME = 'Jugador';

  const num = v => (Number.isFinite(Number(v)) && Number(v) > 0 ? Math.floor(Number(v)) : 0);

  function cleanName(name) {
    const n = String(name == null ? '' : name).trim().slice(0, NAME_MAX).trim();
    return n || DEFAULT_NAME;
  }

  function normalize(e) {
    if (!e || typeof e !== 'object') return null;
    const score = num(e.score);
    if (score <= 0) return null;
    return {
      name: cleanName(e.name), score, lines: num(e.lines), level: num(e.level) || 1,
      maxCombo: num(e.maxCombo), date: typeof e.date === 'string' || typeof e.date === 'number' ? e.date : null,
    };
  }

  const sortList = list => list.slice().sort((a, b) => b.score - a.score).slice(0, MAX);

  function load(storage) {
    try {
      const raw = JSON.parse(storage.getItem(KEY));
      if (!Array.isArray(raw)) return [];
      return sortList(raw.map(normalize).filter(Boolean));
    } catch (e) { return []; }
  }

  function save(storage, list) {
    try { storage.setItem(KEY, JSON.stringify(list)); return true; } catch (e) { return false; }
  }

  function clear(storage) {
    try { storage.removeItem(KEY); return true; } catch (e) { return false; }
  }

  function qualifies(list, score) {
    const s = num(score);
    if (s <= 0) return false;
    return list.length < MAX || s > list[list.length - 1].score;
  }

  // Inserta tras los empates existentes; rank es 1-based, o 0 si no entra.
  function add(list, entry) {
    const e = normalize(entry);
    if (!e || !qualifies(list, e.score)) return { list: list.slice(), rank: 0 };
    let i = list.findIndex(x => x.score < e.score);
    if (i < 0) i = list.length;
    const out = list.slice();
    out.splice(i, 0, e);
    return { list: out.slice(0, MAX), rank: i + 1 };
  }

  function bests(list) {
    return {
      maxCombo: list.reduce((m, e) => Math.max(m, e.maxCombo || 0), 0),
      maxLines: list.reduce((m, e) => Math.max(m, e.lines || 0), 0),
    };
  }

  const Records = { KEY, MAX, NAME_MAX, DEFAULT_NAME, cleanName, load, save, clear, qualifies, add, bests };
  T.Records = Records;
  if (typeof module !== 'undefined' && module.exports) module.exports = Records;
})(typeof window !== 'undefined' ? window : globalThis);
