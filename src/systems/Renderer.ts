/** Renderer — draws the full scene to a Canvas 2D context each frame.
 *  Stub for Phase 05 dependency resolution; fully implemented in Phase 10. */

import type { Tank } from '@/tank/Tank';

export class Renderer {
  constructor(private readonly canvas: HTMLCanvasElement) {}

  /**
   * Draw one frame. `alpha` is the sub-step interpolation fraction [0, 1)
   * for smooth rendering between fixed physics ticks.
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  render(_tank: Tank, _alpha: number): void {
    // Implemented in Phase 10
    const ctx = this.canvas.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#020a10';
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
  }
}
