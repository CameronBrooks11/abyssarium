# Phase 16 — CI/CD & Deployment

## Goal

Set up GitHub Actions CI to run type-checks and tests on every push and pull
request, produce a production Vite build, and deploy the built output to
GitHub Pages automatically on merge to `main`. Also add `scripts/build.sh` and
finalize `agent-policy.yaml` with all rules that should govern automated agents
working in this repository.

---

## Files Produced

| File | Purpose |
|---|---|
| `.github/workflows/ci.yml` | Lint, type-check, test, build on every PR |
| `.github/workflows/deploy.yml` | Build + deploy to GitHub Pages on `main` merge |
| `scripts/build.sh` | Convenience build script |
| `agent-policy.yaml` | Final governing rules for automated agents |

---

## Step-by-Step Execution

### 1. CI Workflow (`.github/workflows/ci.yml`)

```yaml
name: CI

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

env:
  NODE_VERSION: '20'

jobs:
  # ── Type check ──────────────────────────────────────────────────────────────
  typecheck:
    name: TypeScript
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: npm

      - name: Install dependencies
        run: npm ci

      - name: Type check
        run: npx tsc --noEmit

  # ── Unit tests ──────────────────────────────────────────────────────────────
  test:
    name: Unit Tests
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: npm

      - name: Install dependencies
        run: npm ci

      - name: Run tests
        run: npm run test

      - name: Upload coverage
        uses: actions/upload-artifact@v4
        if: always()
        with:
          name: coverage
          path: coverage/

  # ── Production build ────────────────────────────────────────────────────────
  build:
    name: Build
    runs-on: ubuntu-latest
    needs: [typecheck, test]
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: npm

      - name: Install dependencies
        run: npm ci

      - name: Build
        run: npm run build

      - name: Upload dist artifact
        uses: actions/upload-artifact@v4
        with:
          name: dist
          path: dist/
          retention-days: 7
```

---

### 2. Deploy Workflow (`.github/workflows/deploy.yml`)

```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [main]

permissions:
  contents: read
  pages:    write
  id-token: write

concurrency:
  group:    pages
  cancel-in-progress: true

jobs:
  deploy:
    name: Deploy
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}

    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: npm

      - name: Install dependencies
        run: npm ci

      - name: Build
        run: npm run build
        env:
          # Tells vite.config.ts to set base: '/abyssarium/' so all
          # asset URLs are rooted correctly on GitHub Pages.
          GITHUB_PAGES: 'true'

      - name: Setup Pages
        uses: actions/configure-pages@v4

      - name: Upload Pages artifact
        uses: actions/upload-pages-artifact@v3
        with:
          path: dist/

      - name: Deploy to GitHub Pages
        id: deployment
        uses: actions/deploy-pages@v4
```

> **Note:** GitHub Pages deployment requires the repository to have Pages
> enabled in Settings → Pages → Source: **GitHub Actions**.

---

### 3. Vite `base` for GitHub Pages

The `base` path is already configured in `vite.config.ts` (see Phase 01):

```ts
base: process.env.GITHUB_PAGES === 'true' ? '/abyssarium/' : '/',
```

This means:
- **`npm run dev`** locally → `base: '/'` → works at `http://localhost:5173/`
- **`npm run preview`** locally → `base: '/'` → works at `http://localhost:4173/`
- **CI deploy build** (`GITHUB_PAGES=true npm run build`) → `base: '/abyssarium/'`
  → all asset `<script>` and `<link>` tags are prefixed correctly for the live URL

To manually test the production build locally before pushing:

```powershell
$env:GITHUB_PAGES='true'; npm run build; npm run preview
```

Then open http://localhost:4173/abyssarium/ to verify everything loads correctly.

---

### 4. Build Script (`scripts/build.sh`)

```bash
#!/usr/bin/env bash
set -euo pipefail

echo "[abyssarium] Type checking..."
npx tsc --noEmit

echo "[abyssarium] Running tests..."
npm run test

echo "[abyssarium] Building production bundle..."
npm run build

echo "[abyssarium] Build complete → dist/"
du -sh dist/
```

Make executable: `chmod +x scripts/build.sh`

---

### 5. Final `agent-policy.yaml`

```yaml
# agent-policy.yaml — Abyssarium
# Governs automated agents (Copilot, CI bots, code generators) working in
# this repository.

version: 1

metadata:
  project: abyssarium
  description: >
    A browser-based procedural aquarium simulation.
    Canvas 2D only. No UI frameworks. No physics engines.

# ── Rules ─────────────────────────────────────────────────────────────────────

rules:
  # Technical stack constraints
  - id: no-ui-framework
    description: No React, Vue, Angular, Svelte or similar component frameworks.
    deny_packages: [react, react-dom, vue, "@angular/core", svelte, solid-js, preact]
    severity: error

  - id: no-physics-engine
    description: Physics must be hand-written. No external physics engines.
    deny_packages: [matter-js, cannon, "cannon-es", rapier, planck, p2, "@dimforge/rapier2d"]
    severity: error

  - id: no-webgl-renderer
    description: Rendering is Canvas 2D only. No WebGL, Three.js, PixiJS, or Babylon.
    deny_packages: [three, pixi.js, "@pixi/core", babylonjs, "@babylonjs/core"]
    severity: error

  # Code structure constraints
  - id: no-dom-in-simulation
    description: >
      Modules in src/tank/, src/creatures/, src/particles/, src/systems/Physics.ts,
      src/systems/BehaviorSystem.ts, and src/utils/ must not import from the DOM.
      DOM access is restricted to src/ui/, src/systems/InputSystem.ts, src/systems/Renderer.ts,
      and src/main.ts.
    applies_to:
      - "src/tank/**"
      - "src/creatures/**"
      - "src/particles/**"
      - "src/utils/**"
    deny_imports: ["document", "window", "HTMLElement", "HTMLCanvasElement"]
    severity: error

  - id: test-required-for-systems
    description: >
      Every new module added to src/systems/, src/creatures/, or src/utils/
      must have a corresponding test file in tests/.
    applies_to:
      - "src/systems/**"
      - "src/creatures/**"
      - "src/utils/**"
    requires_test: true
    severity: warning

  - id: no-global-state
    description: >
      Do not introduce module-level mutable singletons. Constructor injection
      is the pattern used throughout.
    severity: warning

  # Quality constraints
  - id: no-any-in-utils
    description: >
      src/utils/ must be strictly typed. Use of 'any' is forbidden in utility modules.
    applies_to: ["src/utils/**"]
    deny: ["as any", ": any"]
    severity: error

  - id: max-creatures-cap
    description: >
      The effective maximum number of live creatures must not exceed 100
      without a documented performance justification.
    max_value: 100
    severity: warning

  - id: no-hardcoded-magic-numbers
    description: >
      Physics constants, behavior weights, and timing values must be defined
      as named constants, not inline literals.
    applies_to:
      - "src/systems/Physics.ts"
      - "src/systems/BehaviorSystem.ts"
      - "src/tank/Fluid.ts"
    severity: warning

# ── Automated agent guidelines ────────────────────────────────────────────────

agent_guidelines:
  - When adding a new creature body plan, add a draw function in
    src/systems/drawCreature.ts, a case in the switch, and at least one test.
  - When adding a new interaction/button, implement the full chain:
    1. Add event type to TankEventType const
    2. Add payload to TankEventPayload union
    3. Add handler in InteractionHandlers.ts
    4. Bind button in controls.ts
    5. Document in docs/concept.md
  - When modifying PhysicsSystem, re-run physics tests before assuming correctness.
  - When changing simulation constants (energy rates, drag, etc.), note the
    before/after in the commit message.
  - Never use console.error or console.warn in production code paths; use
    custom error types or return Result<T, E>.
```

---

## Deployment Checklist

Before going live:

- [ ] `npm run build` exits cleanly with no TypeScript errors
- [ ] `npm run test` all green
- [ ] Production build loads at `dist/index.html` via `npm run preview`
- [ ] All 5 buttons work in the preview build
- [ ] No `console.error` in browser console on load
- [ ] GitHub repository has Pages enabled → GitHub Actions source
- [ ] First deploy workflow run completes successfully
- [ ] Live URL (`https://cameronbrooks11.github.io/abyssarium/`) loads the tank

---

## CI Status Badge

Add to `README.md` after CI is live:

```markdown
[![CI](https://github.com/CameronBrooks11/abyssarium/actions/workflows/ci.yml/badge.svg)](https://github.com/CameronBrooks11/abyssarium/actions/workflows/ci.yml)
```

---

## Acceptance Criteria

- [ ] CI workflow triggers on push to `main` and on all PRs
- [ ] `typecheck`, `test`, and `build` jobs all pass in CI
- [ ] Deploy workflow deploys to GitHub Pages on `main` merge
- [ ] `scripts/build.sh` runs the full check+test+build pipeline
- [ ] `agent-policy.yaml` covers all deny rules from the project spec
- [ ] No secrets or tokens committed to the repo

---

## Notes & Decisions

- **100% static — zero backend** — the output of `npm run build` is a folder of
  HTML, JS, and CSS. GitHub Pages serves it directly from the `dist/` tree.
  There is no server, no API, no database, no serverless functions. Everything
  runs in the browser.

- **Two-file workflow split (ci.yml / deploy.yml)** — CI runs on all pushes and
  PRs (typecheck + test + build). Deploy runs only on `main` push. This means
  a broken PR can never deploy a broken build.

- **`base` env-gated via `GITHUB_PAGES=true`** — Vite's `base` option prefixes
  all asset URLs. Locally (`npm run dev` / `npm run preview`) `base` is `'/'`
  so nothing special is needed. In CI the env var switches it to `'/abyssarium/'`
  matching the GitHub Pages URL `https://cameronbrooks11.github.io/abyssarium/`.

- **`npm ci` not `npm install`** — `ci` respects `package-lock.json` exactly,
  preventing version drift in CI that obscures local bugs.

- **`concurrency: cancel-in-progress: true`** on deploy — if two commits merge
  in quick succession only the latest deploy runs, avoiding race conditions on
  the Pages artifact.

- **`scripts/build.sh` is Linux/macOS only** — it is intended for CI runners
  and developer machines running bash. Windows developers use PowerShell:
  ```powershell
  npx tsc --noEmit; npm run test; npm run build
  ```
  Or simply push to `main` and let the CI workflow do it.
