/**
 * KRO-133 — ratchet de conformidad del motor de layout.
 *
 * Verifica que el fixture golden cubre el catálogo COMPLETO de primitivos
 * (container kinds + prefab components + props de appearance). Si alguien añade
 * un primitivo nuevo y NO lo mete en el fixture, este test FALLA → fuerza a
 * actualizarlo (y, con él, el golden que Flutter renderiza) → no hay drift
 * silencioso cuando los diseños escalan a más tipos de slots.
 */
import { describe, it, expect } from 'vitest';
import {
  LAYOUT_CONFORMANCE_FIXTURE,
  conformanceContainerKinds, conformanceComponents, conformanceAppearanceProps,
  CONFORMANCE_CATALOG,
} from '../src/layout-conformance';

const missing = (catalog: readonly string[], covered: Set<string>) =>
  catalog.filter(x => !covered.has(x));

describe('layout conformance ratchet (KRO-133)', () => {
  it('el fixture cubre TODOS los container kinds del catálogo', () => {
    const m = missing(CONFORMANCE_CATALOG.containerKinds, conformanceContainerKinds());
    expect(m, `container kinds sin cobertura en el fixture: ${m.join(', ')}`).toEqual([]);
  });

  it('el fixture cubre TODOS los prefab components', () => {
    const m = missing(CONFORMANCE_CATALOG.components, conformanceComponents());
    expect(m, `componentes sin cobertura: ${m.join(', ')} — añádelos a layout-conformance.ts y al golden de Flutter`).toEqual([]);
  });

  it('el fixture cubre TODAS las props de appearance', () => {
    const m = missing(CONFORMANCE_CATALOG.appearanceProps, conformanceAppearanceProps());
    expect(m, `appearance props sin cobertura: ${m.join(', ')} — añádelas a un slot del fixture y al golden de Flutter`).toEqual([]);
  });

  it('el fixture es una composición válida con árbol de layout', () => {
    expect(LAYOUT_CONFORMANCE_FIXTURE.layout).toBeDefined();
    expect(LAYOUT_CONFORMANCE_FIXTURE.layout?.type).toBe('container');
  });
});
