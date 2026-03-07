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
