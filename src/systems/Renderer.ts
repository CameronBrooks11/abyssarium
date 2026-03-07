/** Renderer — translates simulation state to pixels each frame.
 *
 *  Layer stack:
 *  1. Background gradient + caustics
 *  2. Glow offscreen pass (additive blending)
 *  3. Bubble particles
 *  4. Creatures sorted back-to-front by interpolated Y
 *  5. Food + debris particles
 *  6. Glow composited with 'lighter' at 75% opacity
 *  7. Light-pulse screen flash overlay
 *
 *  Read-only with respect to Tank/Creature/Particle state. */

import type { Tank } from '@/tank/Tank';
import { drawBackground } from './drawBackground';
import { drawCreature } from './drawCreature';
import { drawParticle } from './drawParticle';
import { lerp } from '@/utils/math';
import { CreatureLifeState } from '@/types/entities';
import type { Vec2 } from '@/utils/vec2';

export class Renderer {
  private readonly dpr: number;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly glowCanvas: OffscreenCanvas | HTMLCanvasElement;
  private readonly glowCtx: CanvasRenderingContext2D;

  constructor(private readonly canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not get 2D canvas context');
    this.ctx = ctx;

    this.dpr = Math.min(typeof window !== 'undefined' ? (window.devicePixelRatio ?? 1) : 1, 2);

    if (typeof OffscreenCanvas !== 'undefined') {
      this.glowCanvas = new OffscreenCanvas(canvas.width, canvas.height);
    } else {
      const fallback = document.createElement('canvas');
      fallback.width = canvas.width;
      fallback.height = canvas.height;
      this.glowCanvas = fallback;
    }
    const gCtx = this.glowCanvas.getContext('2d');
    if (!gCtx) throw new Error('Could not get offscreen 2D context');
    this.glowCtx = gCtx as CanvasRenderingContext2D;
  }

  resize(width: number, height: number): void {
    this.glowCanvas.width = width * this.dpr;
    this.glowCanvas.height = height * this.dpr;
  }

  render(tank: Tank, alpha: number): void {
    const { ctx, canvas, dpr } = this;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const w = canvas.width / dpr;
    const h = canvas.height / dpr;

    // ── 1. Background ──────────────────────────────────────────────────────
    drawBackground(ctx, w, h, tank.lightIntensity, tank.time);

    // ── 2. Glow layer (offscreen, additive) ───────────────────────────────
    this.renderGlowLayer(tank, alpha, w, h);

    // ── 3. Particles — bubbles (behind creatures) ─────────────────────────
    for (const p of tank.particles) {
      if (p.kind === 'bubble') drawParticle(ctx, p, alpha);
    }

    // ── 4. Creatures — sorted back-to-front by interpolated Y ─────────────
    const sorted = [...tank.creatures].sort(
      (a, b) =>
        this.interpY(a.body.position.y, a.prevPosition.y, alpha) -
        this.interpY(b.body.position.y, b.prevPosition.y, alpha),
    );

    for (const creature of sorted) {
      if (creature.lifeState === CreatureLifeState.Dead) continue;

      const renderPos = this.interpPos(creature.prevPosition, creature.body.position, alpha);

      const dyingAlpha =
        creature.lifeState === CreatureLifeState.Dying ? Math.max(0, creature.dyingTimer / 1.2) : 1;

      drawCreature(ctx, creature, renderPos, dyingAlpha, tank.time);
    }

    // ── 5. Food + debris particles (in front of creatures) ────────────────
    for (const p of tank.particles) {
      if (p.kind !== 'bubble') drawParticle(ctx, p, alpha);
    }

    // ── 6. Composite glow layer onto main canvas ──────────────────────────
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.75;
    ctx.drawImage(this.glowCanvas as CanvasImageSource, 0, 0, w, h);
    ctx.restore();

    // ── 7. Light pulse screen flash ───────────────────────────────────────
    if (tank.lightIntensity > 0.05) {
      ctx.save();
      ctx.globalAlpha = tank.lightIntensity * 0.18;
      ctx.fillStyle = '#c8f0ff';
      ctx.fillRect(0, 0, w, h);
      ctx.restore();
    }
  }

  // ── Private ───────────────────────────────────────────────────────────────

  private renderGlowLayer(tank: Tank, alpha: number, w: number, h: number): void {
    const gc = this.glowCtx;
    gc.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    gc.clearRect(0, 0, w, h);

    for (const creature of tank.creatures) {
      if (creature.lifeState === CreatureLifeState.Dead) continue;
      if (creature.glowIntensity < 0.02) continue;

      const rx = lerp(creature.prevPosition.x, creature.body.position.x, alpha);
      const ry = lerp(creature.prevPosition.y, creature.body.position.y, alpha);
      const r = creature.radius * 2.5;

      const grad = gc.createRadialGradient(rx, ry, 0, rx, ry, r);
      const [base] = creature.traits.palette;
      const glowColor = `hsla(${base.h.toFixed(0)},${base.s.toFixed(0)}%,${base.l.toFixed(0)}%,${(creature.glowIntensity * 0.55).toFixed(3)})`;
      // Color-matched transparent stop prevents grey fringe
      const glowTransparent = `hsla(${base.h.toFixed(0)},${base.s.toFixed(0)}%,${base.l.toFixed(0)}%,0)`;
      grad.addColorStop(0, glowColor);
      grad.addColorStop(1, glowTransparent);

      gc.beginPath();
      gc.arc(rx, ry, r, 0, Math.PI * 2);
      gc.fillStyle = grad;
      gc.fill();
    }
  }

  private interpPos(prev: Readonly<Vec2>, curr: Readonly<Vec2>, alpha: number): Vec2 {
    return {
      x: lerp(prev.x, curr.x, alpha),
      y: lerp(prev.y, curr.y, alpha),
    };
  }

  private interpY(curr: number, prev: number, alpha: number): number {
    return lerp(prev, curr, alpha);
  }
}
