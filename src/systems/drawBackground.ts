/** drawBackground — renders the deep ocean gradient backdrop and caustic shimmer.
 *
 *  Design rules:
 *  - No 'transparent' keyword in gradients — use color-matched rgba(..., 0)
 *    to avoid the grey fringe caused by compositing premultiplied alpha. */

export const drawBackground = (
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  lightIntensity: number,
  time: number,
): void => {
  // ── Deep ocean gradient ─────────────────────────────────────────────────
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  const lShift = lightIntensity * 8;
  grad.addColorStop(0, `hsl(210, 45%, ${10 + lShift}%)`);
  grad.addColorStop(0.5, `hsl(210, 50%, ${5 + lShift * 0.5}%)`);
  grad.addColorStop(1, `hsl(220, 55%, ${3 + lShift * 0.3}%)`);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  // ── Caustic shimmer — drifting radial light blobs ──────────────────────
  ctx.save();
  ctx.globalAlpha = 0.04 + lightIntensity * 0.03;
  ctx.globalCompositeOperation = 'lighter';
  const count = 6;
  for (let i = 0; i < count; i++) {
    const phase = time * 0.4 + (i / count) * Math.PI * 2;
    const cx = w * (0.15 + (i / count) * 0.72 + Math.sin(phase + i) * 0.05);
    const cy = h * (0.2 + Math.sin(phase * 0.7 + i * 0.9) * 0.3);
    const r = 80 + Math.sin(phase * 1.3) * 30;
    const cg = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    cg.addColorStop(0, 'rgba(160,220,255,0.6)');
    cg.addColorStop(1, 'rgba(160,220,255,0)'); // color-matched transparent — no grey fringe
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = cg;
    ctx.fill();
  }
  ctx.restore();
};
