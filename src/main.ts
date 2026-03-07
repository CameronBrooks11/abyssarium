// Abyssarium — entry point
// Phase 01 stub: boots canvas, verifies DOM, paints dark background.
// Fully wired in Phase 13.

const canvas    = document.getElementById('tank-canvas')    as HTMLCanvasElement;
const container = document.getElementById('tank-container') as HTMLDivElement;

if (!canvas || !container) {
  throw new Error('[Abyssarium] Required DOM elements not found. Check index.html.');
}

// ── Size canvas to its CSS container ─────────────────────────────────────────
// We set the canvas *pixel* dimensions to match the container element, not
// window.innerHeight, so the toolbar height is properly excluded.

function resizeCanvas(): void {
  canvas.width  = container.clientWidth;
  canvas.height = container.clientHeight;

  // Repaint placeholder background so no white flash on resize
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#020a10';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
}

resizeCanvas();
window.addEventListener('resize', resizeCanvas);

// ── Phase 01 placeholder paint ────────────────────────────────────────────────
const ctx = canvas.getContext('2d');
if (!ctx) throw new Error('[Abyssarium] Could not get 2D canvas context.');

ctx.fillStyle = '#020a10';
ctx.fillRect(0, 0, canvas.width, canvas.height);

console.log(
  '[Abyssarium] Phase 01 boot — canvas ready:',
  canvas.width, 'x', canvas.height,
);
