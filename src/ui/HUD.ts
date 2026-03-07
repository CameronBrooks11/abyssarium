/** HUD — renders live simulation statistics to DOM text nodes.
 *
 *  Passive observer: reads LoopStats from the loop's onStats callback and
 *  writes to DOM elements. Never calls into the simulation.
 *
 *  Usage:
 *    const hud = new HUD();
 *    loop.onStats(hud.createStatsListener()); */

import type { LoopStats, LoopStatsListener } from '@/tank/SimulationLoop';

export class HUD {
  private readonly elCreatures: HTMLElement;
  private readonly elParticles: HTMLElement;
  private readonly elFps: HTMLElement;

  constructor() {
    this.elCreatures = this.required('hud-creatures');
    this.elParticles = this.required('hud-particles');
    this.elFps = this.required('hud-fps');
  }

  update(stats: Readonly<LoopStats>): void {
    this.elCreatures.textContent = `creatures: ${stats.creatureCount}`;
    this.elParticles.textContent = `particles: ${stats.particleCount}`;
    this.elFps.textContent = `fps: ${stats.fps}`;
  }

  /**
   * Returns a LoopStatsListener bound to this HUD instance.
   * Pass the result directly to loop.onStats().
   *
   * @example
   *   loop.onStats(hud.createStatsListener());
   */
  createStatsListener(): LoopStatsListener {
    return (stats: Readonly<LoopStats>) => this.update(stats);
  }

  private required(id: string): HTMLElement {
    const el = document.getElementById(id);
    if (!el) throw new Error(`HUD element #${id} not found`);
    return el;
  }
}
