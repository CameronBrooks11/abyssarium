# Phase 10 — Renderer

## Goal

Implement the `Renderer` — the single system that translates simulation state
to pixels on the HTML Canvas. The renderer must be entirely read-only with
respect to simulation state, support sub-frame position interpolation (alpha),
produce visually rich output consistent with the dark ocean aesthetic, and
maintain 60fps on mid-range hardware.

---

## Design Principles

1. **Read-only** — the renderer never mutates `Tank`, `Creature`, or `Particle`.
   It reads positions, traits, and lifecycle state. Nothing else.
2. **Layered draw order** — background → fluid caustics → particles (back) →
   creatures (sorted by y, back-to-front) → particles (fore) → HUD effects →
   glow compositing.
3. **Alpha interpolation** — creature positions are interpolated between
   `prevPosition` and `body.position` by `alpha` ∈ [0, 1). This eliminates
   jitter from the fixed timestep.
4. **Glow via composite operations** — creature glow effects use
   `ctx.globalCompositeOperation = 'lighter'` (additive blending) on an
   offscreen canvas, then composited onto the main canvas. This avoids
   per-glow shadow blur which is expensive.
5. **Reuse Path2D for static shapes** — star/polygon paths are pre-built
   once per creature species and cached, since they only change on scale.

---

## Files Produced

| File | Exports |
|---|---|
| `src/systems/Renderer.ts` | `Renderer` class |
| `src/systems/drawCreature.ts` | Per-body-plan draw functions |
| `src/systems/drawParticle.ts` | Per-kind particle draw |
| `src/systems/drawBackground.ts` | Background + caustics |

---

## Step-by-Step Execution

### 1. Renderer class (`src/systems/Renderer.ts`)

```ts
import type { Tank }    from '@/tank/Tank';
import { drawBackground } from './drawBackground';
import { drawCreature }   from './drawCreature';
import { drawParticle }   from './drawParticle';
import { lerp }           from '@/utils/math';
import { CreatureLifeState } from '@/types/entities';
import type { Vec2 }      from '@/utils/vec2';

export class Renderer {
  private readonly ctx:    CanvasRenderingContext2D;
  private readonly glowCanvas:  OffscreenCanvas;
  private readonly glowCtx:     OffscreenCanvasRenderingContext2D;

  constructor(private readonly canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not get 2D canvas context');
    this.ctx = ctx;

    this.glowCanvas = new OffscreenCanvas(canvas.width, canvas.height);
    const gCtx = this.glowCanvas.getContext('2d');
    if (!gCtx) throw new Error('Could not get offscreen 2D context');
    this.glowCtx = gCtx;
  }

  resize(width: number, height: number): void {
    this.glowCanvas.width  = width;
    this.glowCanvas.height = height;
  }

  render(tank: Tank, alpha: number): void {
    const { ctx, canvas } = this;
    const w = canvas.width;
    const h = canvas.height;

    // ── 1. Background ──────────────────────────────────────────────────────
    drawBackground(ctx, w, h, tank.lightIntensity, tank.time);

    // ── 2. Glow layer (offscreen, additive) ───────────────────────────────
    this.renderGlowLayer(tank, alpha, w, h);

    // ── 3. Particles (behind creatures) ───────────────────────────────────
    for (const p of tank.particles) {
      if (p.kind === 'bubble') drawParticle(ctx, p, alpha);
    }

    // ── 4. Creatures (sorted back-to-front by Y) ──────────────────────────
    const sorted = [...tank.creatures].sort(
      (a, b) => this.interpY(a.body.position.y, a.prevPosition.y, alpha)
               - this.interpY(b.body.position.y, b.prevPosition.y, alpha),
    );

    for (const creature of sorted) {
      if (creature.lifeState === CreatureLifeState.Dead) continue;

      const renderPos = this.interpPos(
        creature.prevPosition, creature.body.position, alpha,
      );

      const dyingAlpha = creature.lifeState === CreatureLifeState.Dying
        ? Math.max(0, creature.dyingTimer / 1.2)
        : 1;

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
    ctx.drawImage(this.glowCanvas, 0, 0);
    ctx.restore();

    // ── 7. Light pulse screen flash ───────────────────────────────────────
    if (tank.lightIntensity > 0.05) {
      ctx.save();
      ctx.globalAlpha = tank.lightIntensity * 0.18;
      ctx.fillStyle   = '#c8f0ff';
      ctx.fillRect(0, 0, w, h);
      ctx.restore();
    }
  }

  // ── Private ───────────────────────────────────────────────────────────────

  private renderGlowLayer(tank: Tank, alpha: number, w: number, h: number): void {
    const gc = this.glowCtx;
    gc.clearRect(0, 0, w, h);

    for (const creature of tank.creatures) {
      if (creature.lifeState === CreatureLifeState.Dead) continue;
      if (creature.glowIntensity < 0.02) continue;

      const rx = lerp(creature.prevPosition.x, creature.body.position.x, alpha);
      const ry = lerp(creature.prevPosition.y, creature.body.position.y, alpha);
      const r  = creature.radius * 2.5;

      const grad = gc.createRadialGradient(rx, ry, 0, rx, ry, r);
      const [base] = creature.traits.palette;
      const glowColor = `hsla(${base.h.toFixed(0)},${base.s.toFixed(0)}%,${base.l.toFixed(0)}%,${(creature.glowIntensity * 0.55).toFixed(3)})`;
      grad.addColorStop(0, glowColor);
      grad.addColorStop(1, `hsla(${base.h.toFixed(0)},${base.s.toFixed(0)}%,${base.l.toFixed(0)}%,0)`); // color-matched transparent

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
```

---

### 2. Background Draw (`src/systems/drawBackground.ts`)

```ts
export const drawBackground = (
  ctx: CanvasRenderingContext2D,
  w:   number,
  h:   number,
  lightIntensity: number,
  time: number,
): void => {
  // Deep ocean gradient
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  const lShift = lightIntensity * 8;
  grad.addColorStop(0,   `hsl(210, 45%, ${10 + lShift}%)`);
  grad.addColorStop(0.5, `hsl(210, 50%, ${5  + lShift * 0.5}%)`);
  grad.addColorStop(1,   `hsl(220, 55%, ${3  + lShift * 0.3}%)`);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  // Subtle caustic shimmer — a handful of drifting radial spots
  ctx.save();
  ctx.globalAlpha = 0.04 + lightIntensity * 0.03;
  ctx.globalCompositeOperation = 'lighter';
  const count = 6;
  for (let i = 0; i < count; i++) {
    const phase = time * 0.4 + (i / count) * Math.PI * 2;
    const cx    = w * (0.15 + (i / count) * 0.72 + Math.sin(phase + i) * 0.05);
    const cy    = h * (0.2  + Math.sin(phase * 0.7 + i * 0.9) * 0.3);
    const r     = 80 + Math.sin(phase * 1.3) * 30;
    const cg    = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    cg.addColorStop(0,   'rgba(160,220,255,0.6)');
    cg.addColorStop(1,   'rgba(160,220,255,0)'); // color-matched transparent avoids grey fringe
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = cg;
    ctx.fill();
  }
  ctx.restore();
};
```

---

### 3. Creature Draw (`src/systems/drawCreature.ts`)

```ts
import type { Creature } from '@/creatures/Creature';
import type { Vec2 }     from '@/utils/vec2';
import { hslaToString }  from '@/utils/color';

export const drawCreature = (
  ctx:          CanvasRenderingContext2D,
  creature:     Creature,
  pos:          Vec2,
  globalAlpha:  number,
  time:         number,
): void => {
  ctx.save();
  ctx.globalAlpha = globalAlpha;
  ctx.translate(pos.x, pos.y);
  ctx.rotate(creature.body.angle);

  const { bodyPlan } = creature.traits;

  switch (bodyPlan) {
    case 'blob':     drawBlob(ctx, creature, time); break;
    case 'triangle': drawTriangle(ctx, creature, time); break;
    case 'star':     drawStar(ctx, creature, time); break;
    case 'worm':     drawWorm(ctx, creature, pos, globalAlpha); break;
    case 'orb':      drawOrb(ctx, creature, time); break;
  }

  ctx.restore();
};

// ── Blob ──────────────────────────────────────────────────────────────────────

const drawBlob = (ctx: CanvasRenderingContext2D, c: Creature, time: number): void => {
  const r     = c.radius;
  const pulse = 1 + Math.sin(c.animPhase + time * 2) * 0.08;
  const [base, accent] = c.traits.palette;

  const grad = ctx.createRadialGradient(0, -r * 0.25, 0, 0, 0, r * pulse);
  grad.addColorStop(0, hslaToString({ ...accent, l: accent.l + 15, a: 0.95 }));
  grad.addColorStop(1, hslaToString({ ...base,   a: 0.7 }));

  ctx.beginPath();
  // Slightly irregular blob using bezier
  const p = r * pulse;
  ctx.moveTo(0, -p);
  ctx.bezierCurveTo(p * 0.8, -p * 0.6,  p, p * 0.4,  0, p);
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
  ctx.moveTo(0,       -r * 1.4 * flick);
  ctx.lineTo(r * 0.8,  r * 0.9);
  ctx.lineTo(-r * 0.8, r * 0.9);
  ctx.closePath();
  ctx.fillStyle   = hslaToString(base);
  ctx.strokeStyle = hslaToString({ ...accent, l: accent.l + 20, a: 0.9 });
  ctx.lineWidth   = 1.5;
  ctx.fill();
  ctx.stroke();
};

// ── Star ──────────────────────────────────────────────────────────────────────

const drawStar = (ctx: CanvasRenderingContext2D, c: Creature, time: number): void => {
  const r     = c.radius;
  const n     = c.traits.spineCount || 5;
  const pulse = 1 + Math.sin(c.animPhase + time * 1.5) * 0.1;
  const [base] = c.traits.palette;

  ctx.beginPath();
  for (let i = 0; i < n * 2; i++) {
    const a   = (i / (n * 2)) * Math.PI * 2 - Math.PI / 2;
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
  ctx:         CanvasRenderingContext2D,
  c:           Creature,
  headPos:     Vec2,
  globalAlpha: number,
): void => {
  const [base] = c.traits.palette;
  const segR   = c.radius * 0.55;

  ctx.restore(); // undo translate/rotate from parent — worm draws in world space
  ctx.save();
  ctx.globalAlpha = globalAlpha;

  for (let i = c.segments.length - 1; i >= 0; i--) {
    const seg   = c.segments[i]!;
    const frac  = i / c.segments.length;
    const alpha = 0.9 - frac * 0.4;
    const scale = 1 - frac * 0.45;
    ctx.beginPath();
    ctx.arc(seg.x, seg.y, segR * scale, 0, Math.PI * 2);
    ctx.fillStyle = hslaToString({ ...base, a: alpha });
    ctx.fill();
  }
  ctx.restore();

  // Push a dummy save so the parent drawCreature restore() doesn't crash
  ctx.save();
};

// ── Orb cluster ───────────────────────────────────────────────────────────────

const drawOrb = (ctx: CanvasRenderingContext2D, c: Creature, time: number): void => {
  const r = c.radius;
  const [base, accent] = c.traits.palette;
  const n = c.traits.segmentCount;

  for (let i = 0; i < n; i++) {
    const a   = (i / n) * Math.PI * 2 + c.animPhase + time;
    const or  = r * 0.55;
    const ox  = Math.cos(a) * or;
    const oy  = Math.sin(a) * or;
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
```

---

### 4. Particle Draw (`src/systems/drawParticle.ts`)

```ts
import type { Particle } from '@/particles/Particle';
import { hslaToString, hslaWithAlpha } from '@/utils/color';
import { lerp } from '@/utils/math';

export const drawParticle = (
  ctx:   CanvasRenderingContext2D,
  p:     Particle,
  alpha: number,
): void => {
  const x = lerp(p.prevPosition.x, p.body.position.x, alpha);
  const y = lerp(p.prevPosition.y, p.body.position.y, alpha);
  const lifeAlpha = Math.min(1, p.life / Math.min(p.maxLife * 0.3, 1));

  ctx.save();
  ctx.globalAlpha = p.color.a * lifeAlpha;

  switch (p.kind) {
    case 'food': {
      ctx.beginPath();
      ctx.arc(x, y, p.radius, 0, Math.PI * 2);
      ctx.fillStyle = hslaToString(p.color);
      ctx.fill();
      // Small warm inner highlight
      ctx.beginPath();
      ctx.arc(x - p.radius * 0.25, y - p.radius * 0.25, p.radius * 0.4, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,255,200,0.5)';
      ctx.fill();
      break;
    }
    case 'bubble': {
      ctx.beginPath();
      ctx.arc(x, y, p.radius, 0, Math.PI * 2);
      ctx.strokeStyle = hslaToString(p.color);
      ctx.lineWidth   = 0.8;
      ctx.stroke();
      break;
    }
    case 'debris': {
      ctx.translate(x, y);
      ctx.rotate(p.body.angle);
      ctx.fillStyle = hslaToString(p.color);
      ctx.fillRect(-p.radius, -p.radius * 0.5, p.radius * 2, p.radius);
      break;
    }
    case 'glow': {
      const grad = ctx.createRadialGradient(x, y, 0, x, y, p.radius * 2);
      grad.addColorStop(0, hslaToString(p.color));
      grad.addColorStop(1, `hsla(${p.color.h},${p.color.s}%,${p.color.l}%,0)`);
      ctx.beginPath();
      ctx.arc(x, y, p.radius * 2, 0, Math.PI * 2);
      ctx.fillStyle = grad;
      ctx.fill();
      break;
    }
  }

  ctx.restore();
};
```

---

## Render Layer Stack

```
1. Background gradient + caustic shimmer      (fillRect + radial grads)
2. Glow offscreen canvas (clearRect)
    └── Per-creature radial glow halo
3. Bubble particles
4. Creatures (sorted Y, back-to-front)
    └── Per-body-plan draw function
5. Food + debris particles
6. Glow canvas composited with 'lighter'
7. Light pulse screen flash overlay
```

---

## Performance Notes

| Technique | Benefit |
|---|---|
| Offscreen glow canvas | Batch additive compositing; one `drawImage` per frame |
| Sort only glowing/alive creatures | Skip dead; skip if glowIntensity < 0.02 |
| No `save/restore` inside hot inner loops unless needed | Minimise state stack ops |
| No `shadowBlur` — glow is manual radial gradient | `shadowBlur` is slow on all browsers |
| Canvas size = container CSS size (no device pixel ratio scaling by default) | 2× on retina optional in Phase 15 |
| `cancelAnimationFrame` on `stop()` | No orphaned RAF callbacks |

---

## Acceptance Criteria

- [ ] All 5 body plans render visibly distinct shapes
- [ ] Dying creatures fade correctly over 1.2 seconds
- [ ] Light pulse flash is visible as screen tint when `tank.lightIntensity > 0`
- [ ] Bubbles render as rings (stroke only, not fill)
- [ ] No console errors on resize (offscreen canvas resized correctly)
- [ ] `tsc --noEmit` passes

---

## Notes & Decisions

- **Worm draw exits transform stack early** — worm segments live in world space
  coordinates, so the draw function undoes the `translate/rotate` from the
  parent call and draws directly. The dummy `ctx.save()` at the end pairs with
  the parent's `ctx.restore()`. This is the one tricky pattern in the renderer
  and is explicitly documented here.
- **`OffscreenCanvas`** is supported in all modern browsers (Chrome 69+,
  Firefox 105+, Safari 16.4+). A fallback to a hidden `<canvas>` element is
  planned as Phase 15 polish for older targets.
- **Sorting creatures by Y** gives a subtle depth-of-field feeling for free —
  creatures at the bottom appear "in front of" those at the top.
