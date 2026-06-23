/**
 * Vitest config local del paquete `@kromia/react`.
 *
 * Igual que en `@kromia/core`, AÍSLA el vitest del SDK del vitest.config.ts de
 * kromia-studio (este repo es submodule de Studio). Además fija el transform JSX
 * automático (`jsxImportSource: 'react'`) para que los `.tsx` del SOURCE —que no
 * importan React— compilen igual que en el build real. Sin esto, esbuild usa el
 * transform clásico y revienta con "React is not defined".
 */

import { defineConfig } from 'vitest/config';

export default defineConfig({
  esbuild: {
    jsx: 'automatic',
    jsxImportSource: 'react',
  },
  test: {
    include: ['tests/**/*.test.{ts,tsx}'],
    environment: 'node',
  },
});
