/**
 * KRO-114 — Test de DRIFT del contrato KRP.
 *
 * Regenera el contrato en memoria con `buildPayload()` (puro) y exige que sea
 * IDÉNTICO al `.json` commiteado. Cierra el hueco que `contract-shape` +
 * `api-snapshot` NO cubren: una MODIFICACIÓN de un bloque existente (p.ej.
 * cambiar `applicableTypes` de un behavior, o `accepts[]` de un slot) que no
 * altera counts ni exports → antes pasaba desapercibida y el `.json` quedaba
 * stale con la versión sin subir. Ahora este test la caza y OBLIGA a `pnpm gen`.
 *
 * Neutraliza los campos meta no-contractuales:
 *  - `generatedAt`: usamos el del .json commiteado (es solo un timestamp).
 *  - `protocolVersion`: usamos el del .json commiteado — la coherencia de la
 *    versión la valida `api-snapshot`; aquí comparamos SOLO el SHAPE.
 *
 * Si este test importa sin reescribir el contrato, además prueba que el guard
 * de `main()` en generate.ts funciona (importar buildPayload = cero efectos).
 */
import { describe, it, expect } from 'vitest';
import committed from '../../../contracts/kromia-recipe-protocol-v1.json';
import { buildPayload } from '../src/generate';

describe('KRO-114 — drift del contrato KRP (.json ↔ registries)', () => {
  it('regenerar en memoria == el .json commiteado (si falla: corre `pnpm gen` y commitea)', () => {
    const c = committed as { protocolVersion: string; generatedAt: string };
    const rebuilt = buildPayload(c.protocolVersion, c.generatedAt);
    // toEqual compara el shape completo recursivamente (ignora orden de claves).
    expect(rebuilt).toEqual(committed);
  });

  it('buildPayload es puro/determinista y respeta sus args (importar no regenera)', () => {
    const a = buildPayload('9.9.9', '2000-01-01T00:00:00.000Z');
    const b = buildPayload('9.9.9', '2000-01-01T00:00:00.000Z');
    expect(a).toEqual(b);                    // determinista
    expect(a.protocolVersion).toBe('9.9.9'); // respeta la versión pasada
    expect(a.generatedAt).toBe('2000-01-01T00:00:00.000Z');
  });
});
