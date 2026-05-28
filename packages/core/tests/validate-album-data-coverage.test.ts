/**
 * KRO-86 Fase 4.5 — Red de seguridad contra drift entre el registry de
 * behaviors y el validador `validateAlbumData`.
 *
 * **Problema que resuelve**: alguien añade un behavior nuevo al registry
 * (`registries/behaviors.ts`) pero olvida actualizar el validador o el
 * cardsZodBuilder.ts del backend. Cliente acepta valor → backend lo
 * rechaza → 400 confuso para el publisher (el bug original de KRO-86).
 *
 * **Cómo funciona**: este test cruza la lista de behaviors registrados
 * con el map `_BEHAVIOR_VALIDATORS_INTERNAL` + `PASS_THROUGH_BEHAVIORS`.
 * Cada behavior debe estar en uno de los dos sets. Si falta → test falla
 * en CI con mensaje explícito de qué añadir.
 *
 * **Workflow correcto al añadir behavior nuevo**:
 *   1. Añadir entry al registry en `registries/behaviors.ts`
 *   2. O bien:
 *      a. Añadir validator en `validate-album-data.ts > BEHAVIOR_VALIDATORS`
 *         (con regex / rango / lo que aplique)
 *      b. Añadir el id a `PASS_THROUGH_BEHAVIORS` si NO necesita validación
 *         específica (con comentario justificando por qué)
 *   3. Añadir validator equivalente al backend (`Kromia_NodeJS/.../
 *      cardsZodBuilder.ts > BEHAVIOR_VALIDATORS`) — paridad estricta.
 *      Hasta que se haga Fase 5 (backend importa del SDK), esto es
 *      manual. Después es automático.
 *   4. Añadir test específico en `validate-album-data.test.ts` para el
 *      nuevo behavior.
 *
 * El test de aquí garantiza el paso 2. Los pasos 1, 3 y 4 son
 * responsabilidad del dev (documentados en AGENTS.md raíz del SDK).
 */
import { describe, it, expect } from 'vitest';
import { allBehaviors } from '../src/registries/behaviors';
import {
  _BEHAVIOR_VALIDATORS_INTERNAL,
  PASS_THROUGH_BEHAVIORS,
} from '../src/validate-album-data';

describe('validate-album-data · cobertura del registry (anti-drift)', () => {
  const allBehaviorIds = allBehaviors().map(b => b.id);
  const validatedIds = new Set(Object.keys(_BEHAVIOR_VALIDATORS_INTERNAL));

  it('cada behavior del registry está cubierto (validator O pass-through)', () => {
    const uncovered: string[] = [];
    for (const id of allBehaviorIds) {
      if (validatedIds.has(id)) continue;
      if (PASS_THROUGH_BEHAVIORS.has(id)) continue;
      uncovered.push(id);
    }

    expect(
      uncovered,
      uncovered.length > 0
        ? `\n\n  🚨 DRIFT DETECTADO: los siguientes behaviors están en el registry pero NO en validate-album-data.ts:\n` +
            uncovered.map(id => `      - ${id}`).join('\n') +
            `\n\n  Soluciones:\n` +
            `    a. Si necesita validación: añade entry en BEHAVIOR_VALIDATORS de validate-album-data.ts\n` +
            `    b. Si NO necesita validación (type base ya cubre): añade el id a PASS_THROUGH_BEHAVIORS\n` +
            `    + Replica el mismo cambio en Kromia_NodeJS/.../cardsZodBuilder.ts hasta Fase 5\n`
        : '',
    ).toEqual([]);
  });

  it('PASS_THROUGH_BEHAVIORS no contiene IDs duplicados con BEHAVIOR_VALIDATORS', () => {
    const overlap = [...PASS_THROUGH_BEHAVIORS].filter(id => validatedIds.has(id));
    expect(
      overlap,
      overlap.length > 0
        ? `\n\n  🚨 INCONSISTENCIA: estos behaviors están en AMBOS sets — decide cuál:\n` +
            overlap.map(id => `      - ${id}`).join('\n')
        : '',
    ).toEqual([]);
  });

  it('PASS_THROUGH_BEHAVIORS y BEHAVIOR_VALIDATORS no tienen IDs inexistentes (basura del registry)', () => {
    const allIds = new Set(allBehaviorIds);
    const orphanValidators = [...validatedIds].filter(id => !allIds.has(id));
    const orphanPassThrough = [...PASS_THROUGH_BEHAVIORS].filter(id => !allIds.has(id));
    const orphans = [...orphanValidators, ...orphanPassThrough];
    expect(
      orphans,
      orphans.length > 0
        ? `\n\n  🚨 BASURA: estos IDs están en validate-album-data.ts pero NO en el registry:\n` +
            orphans.map(id => `      - ${id}`).join('\n') +
            `\n\n  Probablemente alguien eliminó/renombró el behavior del registry sin limpiar aquí.\n`
        : '',
    ).toEqual([]);
  });
});
