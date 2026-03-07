# Phase 01 — Project Foundation

## Goal

Establish the complete scaffolded project: directory structure, build tooling,
TypeScript configuration, package manifest, and base HTML entry point. By the
end of this phase the dev server must boot and render a blank dark canvas at
full viewport dimensions.

---

## Prerequisites

- Node.js ≥ 20 installed
- Git repo initialised (already done via GitHub)
- `npm` available on PATH

---

## Deliverables

| File / Directory | Description |
|---|---|
| `package.json` | Project manifest with all dev dependencies |
| `tsconfig.json` | TypeScript compiler options |
| `vite.config.ts` | Vite build config |
| `.gitignore` | Standard node + dist ignores |
| `public/index.html` | Single-page HTML shell with `<canvas>` |
| `src/main.ts` | Entry point stub |
| `src/types/` | Empty directory for shared type files |
| All `src/` subdirs | Empty placeholder structure matching spec |
| `agent-policy.yaml` | Initial stub |

---

## Step-by-Step Execution

### 1. Initialise npm project

```bash
npm init -y
```

Edit `package.json` to set:

```json
{
  "name": "abyssarium",
  "version": "0.1.0",
  "description": "A chaotic procedural aquarium where strange creatures evolve, swarm, and react to disturbances in a simulated fluid tank.",
  "type": "module",
  "scripts": {
    "dev":   "vite",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "test":  "vitest run"
  },
  "devDependencies": {
    "typescript": "^5.4.0",
    "vite": "^5.2.0",
    "vitest": "^1.5.0"
  }
}
```

> No runtime npm deps — everything is hand-written in TS.

---

### 2. Install dependencies

```bash
npm install
```

---

### 3. TypeScript configuration (`tsconfig.json`)

```jsonc
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "exactOptionalPropertyTypes": true,
    "skipLibCheck": true,
    "sourceMap": true,
    "outDir": "dist",
    "rootDir": "src",
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["src", "tests"],
  "exclude": ["node_modules", "dist"]
}
```

---

### 4. Vite configuration (`vite.config.ts`)

```ts
import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  // index.html lives at the project root (default Vite convention).
  // 'public/' holds purely static assets (favicon, etc.).
  publicDir: 'public',

  // '/abyssarium/' when building for GitHub Pages (set GITHUB_PAGES=true in CI).
  // '/' for local dev — no env var needed.
  base: process.env.GITHUB_PAGES === 'true' ? '/abyssarium/' : '/',

  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  build: {
    outDir:     'dist',
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    open: true,
  },
});
```

---

### 5. HTML shell (`index.html`)

> Lives at the **project root**, not in `public/`. Vite uses the project root by default.
> Static assets (favicon, etc.) live in `public/`.

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Abyssarium</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    html, body {
      width: 100%;
      height: 100%;
      background: #020a10;
      overflow: hidden;
      font-family: 'Courier New', monospace;
      color: #8af;
    }

    #app {
      display: flex;
      flex-direction: column;
      width: 100%;
      height: 100%;
    }

    #toolbar {
      flex: 0 0 auto;
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 12px;
      background: rgba(0,10,20,0.85);
      border-bottom: 1px solid rgba(100,180,255,0.15);
      z-index: 10;
    }

    #toolbar button {
      padding: 6px 14px;
      background: rgba(0,40,80,0.7);
      border: 1px solid rgba(100,180,255,0.35);
      border-radius: 4px;
      color: #8af;
      cursor: pointer;
      font-size: 13px;
      letter-spacing: 0.04em;
      transition: background 0.15s, border-color 0.15s;
    }

    #toolbar button:hover {
      background: rgba(0,80,160,0.7);
      border-color: rgba(100,200,255,0.7);
    }

    #hud {
      position: absolute;
      top: 56px;
      right: 12px;
      font-size: 11px;
      color: rgba(100,180,255,0.55);
      pointer-events: none;
      z-index: 10;
    }

    #tank-container {
      flex: 1 1 auto;
      position: relative;
      overflow: hidden;
    }

    canvas {
      display: block;
      width: 100%;
      height: 100%;
    }
  </style>
</head>
<body>
  <div id="app">
    <nav id="toolbar">
      <span style="font-size:14px;letter-spacing:.08em;margin-right:8px;">ABYSSARIUM</span>
      <button id="btn-food">Add Food</button>
      <button id="btn-shake">Shake Tank</button>
      <button id="btn-light">Light Pulse</button>
      <button id="btn-spawn">Spawn Creature</button>
      <button id="btn-catastrophe">Catastrophe</button>
    </nav>
    <div id="tank-container">
      <canvas id="tank-canvas"></canvas>
    </div>
    <div id="hud">
      <div id="hud-creatures">creatures: 0</div>
      <div id="hud-particles">particles: 0</div>
      <div id="hud-fps">fps: --</div>
    </div>
  </div>
  <script type="module" src="/src/main.ts"></script>
</body>
</html>
```

---

### 6. Main entry point stub (`src/main.ts`)

```ts
// Abyssarium — entry point
// Bootstrapped in Phase 01; wired up fully in Phase 13.

const canvas = document.getElementById('tank-canvas') as HTMLCanvasElement;
const container = document.getElementById('tank-container') as HTMLDivElement;

function resizeCanvas(): void {
  canvas.width  = container.clientWidth;
  canvas.height = container.clientHeight;
}

resizeCanvas();
window.addEventListener('resize', resizeCanvas);

const ctx = canvas.getContext('2d')!;
ctx.fillStyle = '#020a10';
ctx.fillRect(0, 0, canvas.width, canvas.height);

console.log('[Abyssarium] Phase 01 boot — canvas ready:', canvas.width, 'x', canvas.height);
```

---

### 7. Directory scaffold

Create the following empty directories (with `.gitkeep` files so Git tracks them):

```
src/
  types/
  tank/
  creatures/
    behaviors/
  particles/
  systems/
  ui/
  utils/
tests/
docs/
scripts/
.github/
  workflows/
planning/
```

---

### 8. `.gitignore`

```
node_modules/
dist/
.env
*.local
.DS_Store
```

---

### 9. `agent-policy.yaml` stub

```yaml
# agent-policy.yaml
# Governs automated agent behaviour within this repository.

version: 1

rules:
  - id: no-framework-deps
    description: Do not add React, Vue, Angular or other UI frameworks. Canvas + TS only.
    pattern: package.json
    deny: ["react", "vue", "angular", "@angular", "svelte"]

  - id: test-required
    description: All new modules under src/creatures/ and src/systems/ must have a corresponding test.
    applies_to: ["src/creatures/**", "src/systems/**"]
    requires_test: true

  - id: no-physics-engine
    description: Do not add external physics engines (matter.js, cannon.js, rapier, etc.).
    deny: ["matter-js", "cannon", "rapier", "planck", "p2"]

  - id: canvas-only-rendering
    description: Rendering must use HTML Canvas 2D. Do not introduce WebGL, Three.js, or PixiJS.
    deny: ["three", "pixi.js", "babylon", "webgl"]
```

---

## Acceptance Criteria

- [ ] `npm install` completes without errors
- [ ] `npm run dev` launches Vite dev server at `localhost:5173`
- [ ] Browser shows dark background (`#020a10`) with toolbar at top
- [ ] Canvas fills remaining viewport below toolbar
- [ ] Console prints `[Abyssarium] Phase 01 boot — canvas ready: NNNx NNN`
- [ ] No TypeScript errors (`tsc --noEmit` passes)
- [ ] All directories from the repo spec exist

---

## Notes & Decisions

- **`"type": "module"`** is set in `package.json` to match Vite's ESM expectations.
- `index.html` lives at the **project root** (Vite's default `root: '.'`). This is the
  standard convention — putting it in `public/` causes confusing relative paths and
  a circular `publicDir` reference. The `src/` alias `@/` maps to the source tree for
  clean imports like `import { Tank } from '@/tank/Tank'`.
- Canvas is sized to its CSS container dimensions via `clientWidth / clientHeight`,
  not `window.innerWidth / innerHeight`, so the toolbar is properly excluded.
- `noUncheckedIndexedAccess` is enabled to force safe array access throughout;
  this will catch a class of bugs in physics / particle indexing early.
- Vitest is included now so tests (Phase 14) can be added incrementally without
  a later config change.
