/**
 * KRO-133 — spec del modelo de LAYOUT (árbol flex/grid/stack + validador +
 * auto-migración slots-plano→árbol). Ground truth cross-language: Studio, backend
 * y el motor de render deben derivar estas mismas decisiones.
 */
import { describe, it, expect } from 'vitest';
import {
  validateLayout,
  migrateSlotsToLayout,
  layoutDepth,
  collectLayoutSlots,
  MAX_LAYOUT_DEPTH,
  MAX_GRID_COLUMNS,
} from '../src/layout';
import type { LayoutContainerNode, SlotComposition } from '../src/types';

const slots = (...keys: string[]): Record<string, SlotComposition> =>
  Object.fromEntries(keys.map(k => [k, { fields: [k] }]));

const container = (over: Partial<LayoutContainerNode> = {}): LayoutContainerNode => ({
  type: 'container', kind: 'flex', direction: 'column', children: [], ...over,
});

describe('validateLayout — estructura y catálogos', () => {
  it('sin layout (null/undefined) → válido', () => {
    expect(validateLayout(null, { slots: slots('a') }).ok).toBe(true);
    expect(validateLayout(undefined, { slots: slots('a') }).ok).toBe(true);
  });

  it('árbol válido (flex column con slots existentes) → ok', () => {
    const root = container({ children: [
      { type: 'slot', slot: 'avatar' },
      { type: 'slot', slot: 'title' },
    ] });
    const res = validateLayout(root, { slots: slots('avatar', 'title') });
    expect(res.ok).toBe(true);
    expect(res.issues).toEqual([]);
  });

  it('slot que NO existe en la composición → error', () => {
    const root = container({ children: [{ type: 'slot', slot: 'fantasma' }] });
    const res = validateLayout(root, { slots: slots('avatar') });
    expect(res.ok).toBe(false);
    expect(res.issues.some(i => i.level === 'error' && /fantasma/.test(i.message))).toBe(true);
  });

  it('mismo slot dos veces → error', () => {
    const root = container({ children: [
      { type: 'slot', slot: 'avatar' },
      { type: 'slot', slot: 'avatar' },
    ] });
    const res = validateLayout(root, { slots: slots('avatar') });
    expect(res.ok).toBe(false);
    expect(res.issues.some(i => /más de una vez/.test(i.message))).toBe(true);
  });

  it('contenedor vacío → warn (no rompe)', () => {
    const res = validateLayout(container({ children: [] }), { slots: slots('a') });
    expect(res.ok).toBe(true);
    expect(res.issues.some(i => i.level === 'warn')).toBe(true);
  });

  it('grid con columnas fuera de rango → error', () => {
    const root = container({ kind: 'grid', columns: MAX_GRID_COLUMNS + 1, children: [{ type: 'slot', slot: 'a' }] });
    expect(validateLayout(root, { slots: slots('a') }).ok).toBe(false);
  });

  it('gap/align/justify inválidos → error', () => {
    const root = container({ gap: 'huge' as any, children: [{ type: 'slot', slot: 'a' }] });
    expect(validateLayout(root, { slots: slots('a') }).ok).toBe(false);
  });

  it('raíz que no es contenedor → error', () => {
    const res = validateLayout({ type: 'slot', slot: 'a' } as any, { slots: slots('a') });
    expect(res.ok).toBe(false);
  });

  it('anidamiento por encima del máximo → error', () => {
    // Construye una cadena de contenedores más profunda que MAX_LAYOUT_DEPTH.
    let node: LayoutContainerNode = container({ children: [{ type: 'slot', slot: 'a' }] });
    for (let i = 0; i < MAX_LAYOUT_DEPTH + 1; i++) node = container({ children: [node] });
    expect(validateLayout(node, { slots: slots('a') }).ok).toBe(false);
  });

  it('anidamiento válido (contenedor dentro de contenedor) → ok', () => {
    const root = container({ kind: 'flex', direction: 'row', children: [
      { type: 'slot', slot: 'avatar' },
      container({ kind: 'flex', direction: 'column', children: [
        { type: 'slot', slot: 'title' },
        { type: 'slot', slot: 'subtitle' },
      ] }),
    ] });
    expect(validateLayout(root, { slots: slots('avatar', 'title', 'subtitle') }).ok).toBe(true);
  });
});

describe('migrateSlotsToLayout — slots-plano → árbol', () => {
  it('respeta un layout ya existente', () => {
    const layout = container({ children: [{ type: 'slot', slot: 'x' }] });
    expect(migrateSlotsToLayout({ recipe: 'compact_avatar', slots: slots('x'), layout })).toBe(layout);
  });

  it('receta conocida → columna flex con los slots en orden de la receta', () => {
    const out = migrateSlotsToLayout({ recipe: 'compact_avatar', slots: slots('title', 'avatar') });
    expect(out.type).toBe('container');
    expect(out.kind).toBe('flex');
    // compact_avatar declara avatar antes que title → el orden de la receta manda.
    expect(collectLayoutSlots(out)).toEqual(['avatar', 'title']);
  });

  it('el árbol migrado es VÁLIDO contra sus propios slots', () => {
    const s = slots('avatar', 'title', 'subtitle');
    const out = migrateSlotsToLayout({ recipe: 'compact_avatar', slots: s });
    expect(validateLayout(out, { slots: s }).ok).toBe(true);
  });
});

describe('helpers de recorrido', () => {
  it('layoutDepth', () => {
    expect(layoutDepth({ type: 'slot', slot: 'a' })).toBe(1);
    expect(layoutDepth(container({ children: [{ type: 'slot', slot: 'a' }] }))).toBe(2);
    expect(layoutDepth(container({ children: [container({ children: [{ type: 'slot', slot: 'a' }] })] }))).toBe(3);
  });

  it('collectLayoutSlots (en orden de aparición)', () => {
    const root = container({ children: [
      { type: 'slot', slot: 'a' },
      container({ children: [{ type: 'slot', slot: 'b' }, { type: 'slot', slot: 'c' }] }),
    ] });
    expect(collectLayoutSlots(root)).toEqual(['a', 'b', 'c']);
  });
});
