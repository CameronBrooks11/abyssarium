import { Tank } from '@/tank/Tank';
import { SimulationLoop } from '@/tank/SimulationLoop';
import { PhysicsSystem } from '@/systems/Physics';
import { BehaviorSystem } from '@/systems/BehaviorSystem';
import { ParticleSystem } from '@/systems/ParticleSystem';
import { Renderer } from '@/systems/Renderer';
import { InputSystem } from '@/systems/InputSystem';
import { registerInteractionHandlers } from '@/systems/InteractionHandlers';
import { bindControls } from '@/ui/controls';
import { HUD } from '@/ui/HUD';
import { CreatureFactory } from '@/creatures/CreatureFactory';
import { spawnFood } from '@/particles/Food';
import { createRng } from '@/utils/rng';

const canvas = document.getElementById('tank-canvas') as HTMLCanvasElement;
const container = document.getElementById('tank-container') as HTMLDivElement;
if (!canvas || !container) throw new Error('[Abyssarium] Required DOM elements not found');

const getContainerSize = () => ({
  width: container.clientWidth || window.innerWidth,
  height: container.clientHeight || window.innerHeight - 48,
});
const dpr = Math.min(typeof window !== 'undefined' ? (window.devicePixelRatio ?? 1) : 1, 2);
const applySize = (width: number, height: number): void => {
  canvas.width = width * dpr;
  canvas.height = height * dpr;
};
const { width: initW, height: initH } = getContainerSize();
applySize(initW, initH);

const tank = new Tank({ width: initW, height: initH });
const physics = new PhysicsSystem({ bounds: { width: initW, height: initH } });
const behaviors = new BehaviorSystem();
const particles = new ParticleSystem();
const renderer = new Renderer(canvas);
const input = new InputSystem();
const hud = new HUD();
const factory = new CreatureFactory();
const rng = createRng(Date.now() & 0xffffffff);

registerInteractionHandlers(tank);
bindControls(input, tank, rng);

const loop = new SimulationLoop(tank, physics, behaviors, particles, renderer, input);
loop.onStats(hud.createStatsListener());

const INITIAL_POPULATION = 12;
for (let i = 0; i < INITIAL_POPULATION; i++) {
  tank.creatures.push(
    factory.create(
      {
        x: 0.05 * initW + rng() * 0.9 * initW,
        y: 0.05 * initH + rng() * 0.9 * initH,
      },
      rng,
    ),
  );
}
for (let i = 0; i < 30; i++) {
  tank.particles.push(spawnFood({ x: rng() * initW, y: rng() * initH * 0.6 }, rng));
}

let resizeTimer: ReturnType<typeof setTimeout> | null = null;
window.addEventListener('resize', () => {
  if (resizeTimer !== null) clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    const { width, height } = getContainerSize();
    applySize(width, height);
    tank.resize(width, height);
    physics.resize(width, height);
    renderer.resize(width, height);
  }, 120);
});

loop.start();
console.log(`[Abyssarium] Running — ${initW}×${initH} — ${INITIAL_POPULATION} creatures`);
