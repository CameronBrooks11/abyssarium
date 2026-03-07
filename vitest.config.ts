import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  test: {
    environment: 'node',
    globals: false,
    reporters: ['verbose'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/**/*.ts'],
      exclude: [
        'src/main.ts',
        'src/ui/**',
        'src/systems/drawCreature.ts',
        'src/systems/drawParticle.ts',
        'src/systems/drawBackground.ts',
        'src/systems/Renderer.ts',
      ],
    },
  },
});
