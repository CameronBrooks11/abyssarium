/** drawParticle — renders a single particle with kind-specific visuals.
 *  Alpha fades over the last 30% of the particle's lifetime. */

import type { Particle } from '@/particles/Particle';
import { hslaToString } from '@/utils/color';
import { lerp } from '@/utils/math';

export const drawParticle = (ctx: CanvasRenderingContext2D, p: Particle, alpha: number): void => {
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
      ctx.lineWidth = 0.8;
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
