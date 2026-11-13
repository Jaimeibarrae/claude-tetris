(function (G) {
  'use strict';
  const T = G.Tetris = G.Tetris || {};
  const C = T.Config || require('./config');

  // Cada skin: id, name (es), colors[15] (índice = valor de celda, 0 = null), bg, grid y drawBlock.
  // Retro además define colorsLight/bgLight/gridLight (tema claro). Sin DOM.
  // drawBlock(ctx, px, py, s, color, opts): opts = { size, garbage }. Siempre restaura el estado del ctx.

  function garbageMark(ctx, px, py, s) {
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(px + 3, py + 3, s - 6, s - 6);
  }

  function roundedPath(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  const retro = {
    id: 'retro', name: 'Retro',
    colors: C.colors, colorsLight: C.colorsLight,
    bg: null, bgLight: null, // null = lo decide style.css (panel)
    grid: '#22222e', gridLight: '#e1e4f0',
    drawBlock(ctx, px, py, s, color, opts) {
      const size = (opts && opts.size) || s + 2;
      ctx.save();
      ctx.fillStyle = color;
      ctx.fillRect(px, py, s, s);
      ctx.fillStyle = 'rgba(255,255,255,0.12)';
      ctx.fillRect(px, py, s, Math.max(2, size / 7));
      if (opts && opts.garbage) garbageMark(ctx, px, py, s);
      ctx.restore();
    },
  };

  const neon = {
    id: 'neon', name: 'Neón',
    colors: [null, '#00f0ff', '#ffee00', '#d500f9', '#39ff14', '#ff1744', '#2979ff', '#ff9100',
      '#b0bec5', '#ff4081', '#76ff03', '#651fff', '#ffff66', '#6a6f8f', '#ffffff'],
    bg: '#000000', grid: '#14142a',
    drawBlock(ctx, px, py, s, color, opts) {
      const a = ctx.globalAlpha;
      ctx.save();
      ctx.shadowColor = color;
      ctx.shadowBlur = 10;
      ctx.fillStyle = color;
      ctx.globalAlpha = a * 0.28;
      ctx.fillRect(px, py, s, s);
      ctx.globalAlpha = a;
      ctx.lineWidth = 2;
      ctx.strokeStyle = color;
      ctx.strokeRect(px + 1.5, py + 1.5, s - 3, s - 3);
      ctx.shadowBlur = 0;
      if (opts && opts.garbage) garbageMark(ctx, px, py, s);
      ctx.restore();
    },
  };

  const pastel = {
    id: 'pastel', name: 'Pastel',
    colors: [null, '#a8e6ef', '#fff3b0', '#d9b8f0', '#b9e8c0', '#f4b6b6', '#b8d4f5', '#ffd3a8',
      '#d5dde2', '#f8bbd0', '#d7efb5', '#bcc3f0', '#fff9c4', '#aeb3c8', '#ffffff'],
    bg: '#fdf6f9', grid: '#efe3ea',
    drawBlock(ctx, px, py, s, color, opts) {
      const r = Math.max(3, s * 0.28);
      ctx.save();
      roundedPath(ctx, px, py, s, s, r);
      ctx.fillStyle = color;
      ctx.fill();
      ctx.lineWidth = 1;
      ctx.strokeStyle = 'rgba(120,90,110,0.35)';
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.45)';
      roundedPath(ctx, px + s * 0.15, py + s * 0.12, s * 0.7, s * 0.18, s * 0.09);
      ctx.fill();
      if (opts && opts.garbage) {
        ctx.fillStyle = 'rgba(0,0,0,0.18)';
        roundedPath(ctx, px + 4, py + 4, s - 8, s - 8, r / 2);
        ctx.fill();
      }
      ctx.restore();
    },
  };

  const pixel = {
    id: 'pixel', name: 'Pixel art',
    colors: [null, '#29b6c6', '#e8b923', '#9c4fb0', '#4caf50', '#d84a4a', '#4a8fd8', '#e58a1f',
      '#8a9aa3', '#d8436f', '#8bbd3f', '#4a56b5', '#e6d83a', '#4a4e66', '#ffffff'],
    bg: '#14161f', grid: '#1e212e',
    drawBlock(ctx, px, py, s, color, opts) {
      ctx.save();
      ctx.fillStyle = color;
      ctx.fillRect(px, py, s, s);
      // damero 2×2 px
      ctx.fillStyle = 'rgba(0,0,0,0.12)';
      for (let y = 0; y < s; y += 2) {
        for (let x = 0; x < s; x += 2) {
          if (((x + y) / 2) % 2 === 0) ctx.fillRect(px + x, py + y, 2, 2);
        }
      }
      // bisel: luz arriba/izquierda, sombra abajo/derecha
      const b = Math.max(2, Math.round(s / 8));
      ctx.fillStyle = 'rgba(255,255,255,0.45)';
      ctx.fillRect(px, py, s, b);
      ctx.fillRect(px, py, b, s);
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      ctx.fillRect(px, py + s - b, s, b);
      ctx.fillRect(px + s - b, py, b, s);
      if (opts && opts.garbage) garbageMark(ctx, px, py, s);
      ctx.restore();
    },
  };

  const SKINS = [retro, neon, pastel, pixel];
  const DEFAULT = 'retro';

  const Skins = {
    DEFAULT,
    list: SKINS,
    get(id) { return SKINS.find(s => s.id === id) || retro; },
    // Paleta (15 entradas) de la skin; solo Retro varía con el tema claro
    palette(skin, light) { return light && skin.colorsLight ? skin.colorsLight : skin.colors; },
    gridColor(skin, light) { return light && skin.gridLight ? skin.gridLight : skin.grid; },
    boardBg(skin, light) { return light && skin.bgLight !== undefined ? skin.bgLight : skin.bg; },
  };

  T.Skins = Skins;
  if (typeof module !== 'undefined' && module.exports) module.exports = Skins;
})(typeof window !== 'undefined' ? window : globalThis);
