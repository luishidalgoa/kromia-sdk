/**
 * Vitest config local del paquete `@kromia/core`.
 *
 * Existe principalmente para AISLAR el vitest del SDK del vitest.config.ts
 * de kromia-studio (que vive varios niveles más arriba al ser este repo un
 * submodule de Studio). Sin este archivo, vitest sube por el filesystem y
 * encuentra el config de Studio, que requiere plugins React no instalados.
 */

import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
});
