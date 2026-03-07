# Abyssarium — Ecosystem Model

## Creatures

Every creature is procedurally generated with a random **archetype**:

| Archetype | Behaviour | Visual |
|---|---|---|
| Predator | Fast, aggressive, carnivorous | Red/magenta triangle |
| Drifter | Slow, glowing, photophobic | Blue/teal blob |
| Grazer | Curious, herbivorous, flocking | Green/cyan star |
| Swarmer | Medium speed, highly social | Purple/violet orb |

## Energy Loop

```
Creatures drain energy constantly.
Food restores energy.
Starved creatures enter the dying state and dissolve to debris.
Debris fades out as particles.
```

## Body Plans

| Plan | Appearance | Notes |
|---|---|---|
| Blob | Pulsing bezier oval | Default |
| Triangle | Pointed dart shape | Predators favour this |
| Star | Multi-armed radial | Grazers, spiney |
| Worm | Segmented chain | Sinuous, slow |
| Orb | Orbiting ball cluster | Swarmers |

## Catastrophes

Four random disasters can strike:

1. **Predator Spawn** — One or two apex predators appear at a random position in the tank.
2. **Toxic Bloom** — A chemical event reduces creature energy to 45% and spawns
   strange green food particles.
3. **Freezing Shock** — All motion stops suddenly. Creatures recover slowly.
4. **Oxygen Storm** — A mass bubble eruption flings everyone upward.

## Tuning Constants

| Parameter | Value | Notes |
|---|---|---|
| Base metabolic rate | 1.2 energy/s | Before speed cost |
| Speed cost | speed/300 × 2.5 | Fast creatures burn more |
| Food energy gain | +18 energy | Per food particle consumed |
| Dying timer | 1.2 s | Dissolve duration |
| Initial population | 12 creatures | On page load |
| Initial food | 30 particles | Scattered in upper 60% |
| Max creatures | 40 | Hard cap prevents lag |
| Max particles | 600 | Hard cap prevents lag |
