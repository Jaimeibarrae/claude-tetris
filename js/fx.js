(function (G) {
  'use strict';
  const T = G.Tetris = G.Tetris || {};

  const MAX_PARTICLES = 400;
  const MAX_POPUPS = 4;

  // Efectos visuales sobre el canvas del tablero: partículas, popups, sacudida, rayos, anillos.
  class FX {
    constructor() { this.reset(); }

    reset() {
      this.particles = [];
      this.popups = [];
      this.bolts = [];
      this.rings = [];
      this.shakeMs = 0;
      this.shakeMag = 0;
      this.flashMs = 0;
      this.flashColor = '#ffffff';
      this.boardFlashMs = 0; // destello del tablero (desafío de piezas invisibles)
      this.banner = null;
    }

    burst(x, y, color, n = 6, speed = 0.18) {
      for (let i = 0; i < n && this.particles.length < MAX_PARTICLES; i++) {
        const a = Math.random() * Math.PI * 2;
        const s = speed * (0.4 + Math.random());
        this.particles.push({
          x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 0.05,
          life: 500 + Math.random() * 400, max: 900, color, size: 2 + Math.random() * 3,
        });
      }
    }

    popup(text, color, size = 22) {
      this.popups.push({ text, color, size, life: 1300, max: 1300 });
      if (this.popups.length > MAX_POPUPS) this.popups.shift();
    }

    showBanner(text, color = '#ffb74d') { this.banner = { text, color, life: 2200, max: 2200 }; }

    shake(ms, mag) { this.shakeMs = Math.max(this.shakeMs, ms); this.shakeMag = Math.max(this.shakeMag, mag); }
    flash(ms, color) { this.flashMs = ms; this.flashColor = color; }

    ring(x, y, color, radius = 90) { this.rings.push({ x, y, color, radius, life: 450, max: 450 }); }

    // Rayo en zigzag entre dos puntos
    bolt(x1, y1, x2, y2) {
      const pts = [[x1, y1]];
      const steps = 8;
      for (let i = 1; i < steps; i++) {
        const t = i / steps;
        const jitter = (Math.random() - 0.5) * 24;
        const horizontal = Math.abs(x2 - x1) > Math.abs(y2 - y1);
        pts.push([x1 + (x2 - x1) * t + (horizontal ? 0 : jitter), y1 + (y2 - y1) * t + (horizontal ? jitter : 0)]);
      }
      pts.push([x2, y2]);
      this.bolts.push({ pts, life: 350, max: 350 });
    }

    update(dt) {
      for (const p of this.particles) {
        p.life -= dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vy += 0.0006 * dt;
      }
      this.particles = this.particles.filter(p => p.life > 0);
      for (const l of [this.popups, this.bolts, this.rings]) for (const o of l) o.life -= dt;
      this.popups = this.popups.filter(o => o.life > 0);
      this.bolts = this.bolts.filter(o => o.life > 0);
      this.rings = this.rings.filter(o => o.life > 0);
      if (this.shakeMs > 0) { this.shakeMs -= dt; if (this.shakeMs <= 0) this.shakeMag = 0; }
      if (this.flashMs > 0) this.flashMs -= dt;
      if (this.boardFlashMs > 0) this.boardFlashMs -= dt;
      if (this.banner) { this.banner.life -= dt; if (this.banner.life <= 0) this.banner = null; }
    }

    shakeOffset() {
      if (this.shakeMs <= 0) return [0, 0];
      return [(Math.random() - 0.5) * this.shakeMag * 2, (Math.random() - 0.5) * this.shakeMag * 2];
    }

    // Capa que va debajo de la sacudida (se llama dentro del translate)
    draw(ctx, w, h) {
      for (const r of this.rings) {
        const k = 1 - r.life / r.max;
        ctx.globalAlpha = 1 - k;
        ctx.strokeStyle = r.color;
        ctx.lineWidth = 4 * (1 - k) + 1;
        ctx.beginPath();
        ctx.arc(r.x, r.y, r.radius * k, 0, Math.PI * 2);
        ctx.stroke();
      }
      for (const b of this.bolts) {
        ctx.globalAlpha = b.life / b.max;
        ctx.strokeStyle = '#fff59d';
        ctx.shadowColor = '#ffee58';
        ctx.shadowBlur = 12;
        ctx.lineWidth = 3;
        ctx.beginPath();
        b.pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
        ctx.stroke();
        ctx.shadowBlur = 0;
      }
      for (const p of this.particles) {
        ctx.globalAlpha = Math.max(0, p.life / p.max);
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x, p.y, p.size, p.size);
      }
      ctx.globalAlpha = 1;

      if (this.flashMs > 0) {
        ctx.globalAlpha = Math.min(0.35, this.flashMs / 600);
        ctx.fillStyle = this.flashColor;
        ctx.fillRect(0, 0, w, h);
        ctx.globalAlpha = 1;
      }

      // Popups apilados desde el centro hacia abajo
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      this.popups.forEach((p, i) => {
        const k = 1 - p.life / p.max;
        const alpha = k < 0.1 ? k / 0.1 : Math.min(1, p.life / 400);
        const scale = k < 0.15 ? 1.4 - (k / 0.15) * 0.4 : 1;
        ctx.save();
        ctx.globalAlpha = Math.max(0, alpha);
        ctx.translate(w / 2, h * 0.38 + i * 34 - k * 24);
        ctx.scale(scale, scale);
        ctx.font = `800 ${p.size}px system-ui, sans-serif`;
        ctx.lineWidth = 4;
        ctx.strokeStyle = 'rgba(0,0,0,0.65)';
        ctx.strokeText(p.text, 0, 0);
        ctx.fillStyle = p.color;
        ctx.fillText(p.text, 0, 0);
        ctx.restore();
      });

      if (this.banner) {
        const b = this.banner;
        ctx.save();
        ctx.globalAlpha = Math.min(1, b.life / 400, (b.max - b.life) / 150);
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.fillRect(0, h * 0.5 - 28, w, 56);
        ctx.font = '800 22px system-ui, sans-serif';
        ctx.fillStyle = b.color;
        ctx.fillText(b.text, w / 2, h * 0.5);
        ctx.restore();
      }
      ctx.globalAlpha = 1;
    }
  }

  T.FX = FX;
})(typeof window !== 'undefined' ? window : globalThis);
