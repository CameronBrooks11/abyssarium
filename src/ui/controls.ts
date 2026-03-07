/** bindControls — wires HTML buttons and the canvas to InputSystem events.
 *
 *  Only this module and src/ui/HUD.ts directly access the DOM. */

import type { InputSystem } from '@/systems/InputSystem';
import type { Tank } from '@/tank/Tank';
import { CatastropheKind } from '@/types/entities';
import type { Rng } from '@/utils/rng';
import { rngPick } from '@/utils/rng';

const CATASTROPHE_KINDS: CatastropheKind[] = Object.values(CatastropheKind) as CatastropheKind[];

export const bindControls = (input: InputSystem, tank: Tank, rng: Rng): void => {
  const btn = (id: string): HTMLButtonElement => {
    const el = document.getElementById(id);
    if (!(el instanceof HTMLButtonElement)) {
      throw new Error(`Button #${id} not found in DOM`);
    }
    return el;
  };

  // ── Add Food ───────────────────────────────────────────────────────────────
  btn('btn-food').addEventListener('click', () => {
    const x = 80 + Math.random() * (tank.width - 160);
    const y = tank.height * 0.1;
    input.queueAddFood({ x, y }, 10);
  });

  // ── Shake Tank ────────────────────────────────────────────────────────────
  btn('btn-shake').addEventListener('click', () => {
    input.queueShakeTank(220);
  });

  // ── Light Pulse ───────────────────────────────────────────────────────────
  btn('btn-light').addEventListener('click', () => {
    input.queueLightPulse(1.0);
  });

  // ── Spawn Creature ────────────────────────────────────────────────────────
  btn('btn-spawn').addEventListener('click', () => {
    const x = 80 + Math.random() * (tank.width - 160);
    input.queueSpawnCreature({ x, y: 60 });
  });

  // ── Catastrophe ───────────────────────────────────────────────────────────
  btn('btn-catastrophe').addEventListener('click', () => {
    input.queueCatastrophe(rngPick(rng, CATASTROPHE_KINDS));
  });

  // ── Click canvas to add food at cursor position ───────────────────────────
  const canvas = document.getElementById('tank-canvas') as HTMLCanvasElement;
  canvas.addEventListener('click', (e: MouseEvent) => {
    const rect = canvas.getBoundingClientRect();
    input.queueAddFood({ x: e.clientX - rect.left, y: e.clientY - rect.top }, 5);
  });
};
