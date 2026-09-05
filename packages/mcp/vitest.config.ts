/**
 * Vitest config local del paquete `@kromia/mcp`.
 *
 * Existe por la misma razón que el de `@kromia/core`, y su ausencia aquí dejó
 * la suite del MCP SIN CORRER durante meses: este repo es un submodule de
 * kromia-studio, así que un `vitest run` sin config propio sube por el
 * filesystem hasta `kromia-studio/vitest.config.ts`, que pide plugins de React
 * que aquí no están instalados. No falla en rojo — falla al ARRANCAR, con un
 * error de esbuild sobre ESM que no menciona ni a este paquete ni a sus tests.
 *
 * Y el CI tampoco lo cubría: `krp-drift.yml` corría `core` y `react` y de este
 * paquete no sabía nada. Entre las dos cosas, el «13/13 verde» del ticket era
 * cierto el día que se escribió y dejó de comprobarse al siguiente.
 */

import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
});
