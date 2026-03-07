/** drawCreature — per-body-plan rendering dispatched from Renderer.
 *
 *  Worm body plan special case:
 *  - The parent draw call has already applied ctx.translate(pos) + ctx.rotate(angle).
 *  - drawWorm immediately calls ctx.restore() to undo that transform, then draws
 *    each segment in world space using the pre-computed segments[] array.
 *  - A dummy ctx.save() at the end keeps the ctx stack balanced for the parent's
 *    ctx.restore(). */

import type { Creature } from '@/creatures/Creature';
import type { Vec2 } from '@/utils/vec2';
import { hslaToString } from '@/utils/color';
import { BodyPlan } from '@/types/entities';

export const drawCreature = (
  ctx: CanvasRenderingContext2D,
  creature: Creature,
  pos: Vec2,
  globalAlpha: number,
  time: number,
): void => {
  ctx.save();
  ctx.globalAlpha = globalAlpha;
  ctx.translate(pos.x, pos.y);
  ctx.rotate(creature.body.angle);

  // Death scale-down: shrink to 60 % as creature fades out
  if (globalAlpha < 1) {
    const deathScale = 0.6 + globalAlpha * 0.4;
    ctx.scale(deathScale, deathScale);
  }

  // Bioluminescence trail — soft halo drawn behind main body
  if (creature.glowIntensity > 0.6) {
    const [base] = creature.traits.palette;
    const trailAlpha = (creature.glowIntensity - 0.6) * 0.4;
    ctx.beginPath();
    ctx.arc(0, 0, creature.radius * 1.2, 0, Math.PI * 2);
    ctx.fillStyle = `hsla(${base.h},${base.s}%,${base.l}%,${trailAlpha.toFixed(3)})`;
    ctx.fill();
  }

  switch (creature.traits.bodyPlan) {
    case BodyPlan.Blob:
      drawBlob(ctx, creature, time);
      break;
    case BodyPlan.Triangle:
      drawTriangle(ctx, creature, time);
      break;
    case BodyPlan.Star:
      drawStar(ctx, creature, time);
      break;
    case BodyPlan.Worm:
      drawWorm(ctx, creature, pos, globalAlpha);
      break;
    case BodyPlan.Orb:
      drawOrb(ctx, creature, time);
      break;
  }

  ctx.restore();
};

// ── Blob ──────────────────────────────────────────────────────────────────────

const drawBlob = (ctx: CanvasRenderingContext2D, c: Creature, time: number): void => {
  const r = c.radius;
  const pulse = 1 + Math.sin(c.animPhase + time * 2) * 0.08;
  const [base, accent] = c.traits.palette;

  const grad = ctx.createRadialGradient(0, -r * 0.25, 0, 0, 0, r * pulse);
  grad.addColorStop(0, hslaToString({ ...accent, l: accent.l + 15, a: 0.95 }));
  grad.addColorStop(1, hslaToString({ ...base, a: 0.7 }));

  const p = r * pulse;
  ctx.beginPath();
  ctx.moveTo(0, -p);
  ctx.bezierCurveTo(p * 0.8, -p * 0.6, p, p * 0.4, 0, p);
  ctx.bezierCurveTo(-p * 0.8, p * 0.4, -p * 0.8, -p * 0.6, 0, -p);
  ctx.fillStyle = grad;
  ctx.fill();
};

// ── Triangle ──────────────────────────────────────────────────────────────────

const drawTriangle = (ctx: CanvasRenderingContext2D, c: Creature, time: number): void => {
  const r = c.radius;
  const [base, accent] = c.traits.palette;
  const flick = 1 + Math.sin(c.animPhase + time * 3) * 0.05;

  ctx.beginPath();
  ctx.moveTo(0, -r * 1.4 * flick);
  ctx.lineTo(r * 0.8, r * 0.9);
  ctx.lineTo(-r * 0.8, r * 0.9);
  ctx.closePath();
  ctx.fillStyle = hslaToString(base);
  ctx.strokeStyle = hslaToString({ ...accent, l: accent.l + 20, a: 0.9 });
  ctx.lineWidth = 1.5;
  ctx.fill();
  ctx.stroke();
};

// ── Star ──────────────────────────────────────────────────────────────────────

const drawStar = (ctx: CanvasRenderingContext2D, c: Creature, time: number): void => {
  const r = c.radius;
  const n = c.traits.spineCount || 5;
  const pulse = 1 + Math.sin(c.animPhase + time * 1.5) * 0.1;
  const [base] = c.traits.palette;

  ctx.beginPath();
  for (let i = 0; i < n * 2; i++) {
    const a = (i / (n * 2)) * Math.PI * 2 - Math.PI / 2;
    const len = i % 2 === 0 ? r * pulse : r * 0.45;
    if (i === 0) ctx.moveTo(Math.cos(a) * len, Math.sin(a) * len);
    else ctx.lineTo(Math.cos(a) * len, Math.sin(a) * len);
  }
  ctx.closePath();
  ctx.fillStyle = hslaToString(base);
  ctx.fill();
};

// ── Worm ──────────────────────────────────────────────────────────────────────

const drawWorm = (
  ctx: CanvasRenderingContext2D,
  c: Creature,
  _headPos: Vec2, // segments[] already contain world-space positions
  globalAlpha: number,
): void => {
  const [base] = c.traits.palette;
  const segR = c.radius * 0.55;

  // Undo the parent translate/rotate — worm draws in world space
  ctx.restore();
  ctx.save();
  ctx.globalAlpha = globalAlpha;

  for (let i = c.segments.length - 1; i >= 0; i--) {
    const seg = c.segments[i]!;
    const frac = i / c.segments.length;
    const segAlpha = 0.9 - frac * 0.4;
    const scale = 1 - frac * 0.45;
    ctx.beginPath();
    ctx.arc(seg.x, seg.y, segR * scale, 0, Math.PI * 2);
    ctx.fillStyle = hslaToString({ ...base, a: segAlpha });
    ctx.fill();
  }

  ctx.restore();
  // Dummy save to balance the parent's ctx.restore() call
  ctx.save();
};

// ── Orb cluster ───────────────────────────────────────────────────────────────

const drawOrb = (ctx: CanvasRenderingContext2D, c: Creature, time: number): void => {
  const r = c.radius;
  const [base, accent] = c.traits.palette;
  const n = c.traits.segmentCount;

  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + c.animPhase + time;
    const or = r * 0.55;
    const ox = Math.cos(a) * or;
    const oy = Math.sin(a) * or;
    ctx.beginPath();
    ctx.arc(ox, oy, r * 0.45, 0, Math.PI * 2);
    ctx.fillStyle = hslaToString(i % 2 === 0 ? base : accent);
    ctx.fill();
  }

  // Central core
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.4, 0, Math.PI * 2);
  ctx.fillStyle = hslaToString({ ...base, l: base.l + 20 });
  ctx.fill();
};
