/**
 * KRO-133 — spec del modelo de LAYOUT (árbol flex/grid/stack + validador +
 * auto-migración slots-plano→árbol). Ground truth cross-language: Studio, backend
 * y el motor de render deben derivar estas mismas decisiones.
 */
import { describe, it, expect } from 'vitest';
import {
  validateLayout,
  pruneLayoutSlots,
  gridCols,
  gridRows,
  cellCovered,
  migrateSlotsToLayout,
  migrateSlotsToGrid,
  layoutDepth,
  collectLayoutSlots,
  clampPlaceToGrid,
  MAX_LAYOUT_DEPTH,
  MAX_GRID_COLUMNS,
  MAX_GRID_ROWS,
} from '../src/layout';
import type { LayoutContainerNode, LayoutNode, SlotComposition } from '../src/types';

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

describe('KRO-133 F3 — grid 2D: placement (celdas + spans)', () => {
  const grid = (over: Partial<LayoutContainerNode> = {}): LayoutContainerNode => ({
    type: 'container', kind: 'grid', columns: 2, children: [], ...over,
  });

  it('hijo con place válido dentro del grid → ok', () => {
    const root = grid({ columns: 2, children: [
      { type: 'slot', slot: 'avatar', place: { colStart: 1, colSpan: 1 } },
      { type: 'slot', slot: 'title',  place: { colStart: 2, colSpan: 1 } },
    ] });
    expect(validateLayout(root, { slots: slots('avatar', 'title') }).ok).toBe(true);
  });

  it('colSpan que se sale del grid → warn (no rompe)', () => {
    const root = grid({ columns: 2, children: [
      { type: 'slot', slot: 'avatar', place: { colStart: 2, colSpan: 3 } },
    ] });
    const res = validateLayout(root, { slots: slots('avatar') });
    expect(res.ok).toBe(true); // warn, no error
    expect(res.issues.some(i => i.level === 'warn' && /derecha/.test(i.message))).toBe(true);
  });

  it('place con valores no enteros / < 1 → error', () => {
    const root = grid({ columns: 2, children: [
      { type: 'slot', slot: 'avatar', place: { colStart: 0, colSpan: 1 } },
    ] });
    expect(validateLayout(root, { slots: slots('avatar') }).ok).toBe(false);
  });

  it('place dentro de un contenedor NO-grid → warn', () => {
    const root: LayoutContainerNode = {
      type: 'container', kind: 'flex', direction: 'row', children: [
        { type: 'slot', slot: 'avatar', place: { colStart: 1 } },
      ],
    };
    const res = validateLayout(root, { slots: slots('avatar') });
    expect(res.issues.some(i => i.level === 'warn' && /grid/.test(i.message))).toBe(true);
  });

  it('rows fuera de rango → error', () => {
    const root = grid({ columns: 2, rows: MAX_GRID_ROWS + 1, children: [{ type: 'slot', slot: 'a' }] });
    expect(validateLayout(root, { slots: slots('a') }).ok).toBe(false);
  });

  it('rowStart fuera de las filas explícitas → warn', () => {
    const root = grid({ columns: 2, rows: 2, children: [
      { type: 'slot', slot: 'a', place: { rowStart: 3 } },
    ] });
    const res = validateLayout(root, { slots: slots('a') });
    expect(res.ok).toBe(true);
    expect(res.issues.some(i => i.level === 'warn' && /fila/.test(i.message))).toBe(true);
  });
});

describe('migrateSlotsToGrid — slots-plano → grid 1 columna', () => {
  it('respeta un layout existente', () => {
    const layout = { type: 'container', kind: 'grid', columns: 1, children: [{ type: 'slot', slot: 'x' }] } as LayoutContainerNode;
    expect(migrateSlotsToGrid({ recipe: 'compact_avatar', slots: slots('x'), layout })).toBe(layout);
  });

  it('produce un grid de 1 columna con los slots de la receta (auto-flow)', () => {
    const out = migrateSlotsToGrid({ recipe: 'compact_avatar', slots: slots('title', 'avatar') });
    expect(out.kind).toBe('grid');
    expect(out.columns).toBe(1);
    expect(collectLayoutSlots(out)).toEqual(['avatar', 'title']); // orden de la receta
    expect(validateLayout(out, { slots: slots('avatar', 'title') }).ok).toBe(true);
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

describe('clampPlaceToGrid — colocación dentro del ancho del grid', () => {
  it('clampa colStart al nº de columnas (no flota fuera)', () => {
    // grid de 1 columna, hijo pedido en col 2 → vuelve a col 1.
    expect(clampPlaceToGrid({ colStart: 2, colSpan: 1, rowStart: 4, rowSpan: 1 }, 1))
      .toEqual({ colStart: 1, colSpan: 1, rowStart: 4, rowSpan: 1 });
  });

  it('clampa colSpan para que no se salga por la derecha', () => {
    // grid de 2 cols, hijo en col 2 con span 2 → span 1 (cabe 1).
    expect(clampPlaceToGrid({ colStart: 2, colSpan: 2, rowStart: 1, rowSpan: 1 }, 2))
      .toEqual({ colStart: 2, colSpan: 1, rowStart: 1, rowSpan: 1 });
  });

  it('respeta colocaciones válidas (devuelve el mismo objeto) y las filas', () => {
    const ok = { colStart: 2, colSpan: 1, rowStart: 9, rowSpan: 2 };
    expect(clampPlaceToGrid(ok, 3)).toBe(ok); // sin cambios → misma ref; filas libres
    expect(clampPlaceToGrid(undefined, 2)).toBeUndefined();
  });
});

// ── KRO-165 — pruneLayoutSlots ───────────────────────────────────────────────
describe('pruneLayoutSlots (KRO-165)', () => {
  const tree = (): LayoutContainerNode => ({
    type: 'container', kind: 'grid', columns: 2, rows: 2, gap: 'sm',
    children: [
      { type: 'slot', slot: 'title',  place: { colStart: 1, colSpan: 1, rowStart: 1, rowSpan: 1 } },
      { type: 'slot', slot: 'extra',  place: { colStart: 2, colSpan: 1, rowStart: 1, rowSpan: 1 } },
      {
        type: 'container', kind: 'grid', columns: 1, rows: 1, gap: 'sm',
        place: { colStart: 1, colSpan: 2, rowStart: 2, rowSpan: 1 },
        children: [
          { type: 'slot', slot: 'extra', place: { colStart: 1, colSpan: 1, rowStart: 1, rowSpan: 1 } },
        ],
      },
      {
        type: 'component', component: 'hero_header',
        slots: { banner: 'image', title: 'extra' },
        place: { colStart: 1, colSpan: 2, rowStart: 3, rowSpan: 1 },
      },
    ],
  });

  it('poda las hojas-slot inválidas a cualquier profundidad', () => {
    const pruned = pruneLayoutSlots(tree(), ['title', 'image']);
    const slots: string[] = [];
    const walk = (n: LayoutNode) => {
      if (n.type === 'slot') slots.push(n.slot);
      if (n.type === 'container') n.children.forEach(walk);
    };
    walk(pruned);
    expect(slots).toEqual(['title']);
  });

  it('desmapea roles de componente que apuntan a slots inválidos (conserva el componente)', () => {
    const pruned = pruneLayoutSlots(tree(), ['title', 'image']);
    const comp = pruned.children.find(c => c.type === 'component');
    expect(comp).toBeDefined();
    expect((comp as { slots?: Record<string, string> }).slots).toEqual({ banner: 'image' });
  });

  it('conserva contenedores aunque queden vacíos + es pura (no muta la entrada)', () => {
    const input = tree();
    const before = JSON.stringify(input);
    const pruned = pruneLayoutSlots(input, ['title', 'image']);
    expect(JSON.stringify(input)).toBe(before);
    const inner = pruned.children.find(c => c.type === 'container');
    expect(inner).toBeDefined();
    expect((inner as LayoutContainerNode).children).toEqual([]);
  });

  it('el resultado de podar pasa validateLayout sin "no declarado"', () => {
    const pruned = pruneLayoutSlots(tree(), ['title', 'image']);
    const res = validateLayout(pruned, { slots: { title: { fields: ['nombre'] }, image: { fields: ['foto'] } } });
    expect(res.issues.filter(i => /no está declarado/.test(i.message))).toEqual([]);
  });
});

// ── KRO-166 — geometría canónica + solapes ──────────────────────────────────
describe('geometría canónica y solapes (KRO-166)', () => {
  it('default de columnas UNIFICADO: sin `columns`, colStart 2 avisa (la rejilla real es de 1)', () => {
    const root: LayoutContainerNode = {
      type: 'container', kind: 'grid', rows: 1, gap: 'sm',
      children: [
        { type: 'slot', slot: 'title', place: { colStart: 2, colSpan: 1, rowStart: 1, rowSpan: 1 } },
      ],
    };
    const res = validateLayout(root, { slots: { title: { fields: ['nombre'] } } });
    expect(res.issues.some(i => /columna|colStart|fuera/i.test(i.message))).toBe(true);
  });

  it('dos hijos apilados en la misma celda → warn de solape con la celda', () => {
    const root: LayoutContainerNode = {
      type: 'container', kind: 'grid', columns: 2, rows: 2, gap: 'sm',
      children: [
        { type: 'slot', slot: 'title', place: { colStart: 1, colSpan: 2, rowStart: 1, rowSpan: 1 } },
        { type: 'slot', slot: 'body',  place: { colStart: 2, colSpan: 1, rowStart: 1, rowSpan: 1 } },
      ],
    };
    const res = validateLayout(root, { slots: { title: { fields: ['nombre'] }, body: { fields: ['lore'] } } });
    const overlaps = res.issues.filter(i => /se solapan/.test(i.message));
    expect(overlaps.length).toBe(1);
    expect(overlaps[0].level).toBe('warn');
    expect(res.ok).toBe(true); // warn, no error
  });

  it('los bloques ABSOLUTOS no cuentan para el solape', () => {
    const root: LayoutContainerNode = {
      type: 'container', kind: 'grid', columns: 1, rows: 1, gap: 'sm',
      children: [
        { type: 'slot', slot: 'title', place: { colStart: 1, colSpan: 1, rowStart: 1, rowSpan: 1 } },
        { type: 'slot', slot: 'body',  place: { colStart: 1, colSpan: 1, rowStart: 1, rowSpan: 1, position: 'absolute', x: 10, y: 10 } },
      ],
    };
    const res = validateLayout(root, { slots: { title: { fields: ['nombre'] }, body: { fields: ['lore'] } } });
    expect(res.issues.filter(i => /se solapan/.test(i.message))).toEqual([]);
  });

  it('gridCols/gridRows/cellCovered: helpers canónicos', () => {
    const c: LayoutContainerNode = {
      type: 'container', kind: 'grid', columns: 2, rows: 1, gap: 'sm',
      children: [
        { type: 'slot', slot: 'title', place: { colStart: 1, colSpan: 2, rowStart: 1, rowSpan: 1 } },
      ],
    };
    expect(gridCols(c)).toBe(2);
    expect(gridCols({ ...c, columns: undefined })).toBe(1);
    expect(gridRows(c)).toBe(1);
    expect(cellCovered(c, 2, 1)).toBe(true);
    expect(cellCovered(c, 1, 2)).toBe(false);
  });
});

// ── KRO-167 — validador completo: absoluto, surface, tracks ─────────────────
describe('validateLayout — absoluto/surface/tracks (KRO-167)', () => {
  const base = (extra: Partial<LayoutContainerNode>): LayoutContainerNode => ({
    type: 'container', kind: 'grid', columns: 1, rows: 1, gap: 'sm',
    children: [{ type: 'slot', slot: 'title', place: { colStart: 1, colSpan: 1, rowStart: 1, rowSpan: 1 } }],
    ...extra,
  });
  const slotsOpt = { slots: { title: { fields: ['nombre'] }, body: { fields: ['lore'] } } };

  it('absoluto: x/y fuera de 0..100 → error; en rango → limpio y sin reglas de grid', () => {
    const bad = base({ children: [
      { type: 'slot', slot: 'title', place: { colStart: 9, colSpan: 1, rowStart: 1, rowSpan: 1, position: 'absolute', x: 150, y: 10 } },
    ]});
    expect(validateLayout(bad, slotsOpt).issues.some(i => /x\/y deben ser/.test(i.message))).toBe(true);
    const ok = base({ children: [
      { type: 'slot', slot: 'title', place: { colStart: 9, colSpan: 1, rowStart: 1, rowSpan: 1, position: 'absolute', x: 50, y: 10, w: 30 } },
    ]});
    const res = validateLayout(ok, slotsOpt);
    // colStart 9 es un recuerdo del flujo: NO debe avisar de columnas.
    expect(res.issues.filter(i => /columna|colStart/.test(i.message))).toEqual([]);
    expect(res.issues.filter(i => i.level === 'error')).toEqual([]);
  });

  it('surface: tokens inválidos → error con path surface.*', () => {
    const bad = base({ surface: { background: 'fucsia' as never, radius: 'xxl' as never } });
    const res = validateLayout(bad, slotsOpt);
    expect(res.issues.some(i => i.path.endsWith('surface.background') && i.level === 'error')).toBe(true);
    expect(res.issues.some(i => i.path.endsWith('surface.radius') && i.level === 'error')).toBe(true);
  });

  it('surface válida → sin issues de surface', () => {
    const ok = base({ surface: { background: 'card', radius: 'lg', padding: 'md', border: { width: 'thin', style: 'dashed', sides: ['top'] } } });
    expect(validateLayout(ok, slotsOpt).issues.filter(i => i.path.includes('surface'))).toEqual([]);
  });

  it('surface en un COMPONENTE (card): se valida igual que la del contenedor (KRO-155)', () => {
    const layout: LayoutContainerNode = {
      type: 'container', kind: 'grid', columns: 1, rows: 1, gap: 'sm',
      children: [{
        type: 'component', component: 'card', slots: { media: 'cover' },
        surface: { background: 'fucsia' as never, radius: 'xxl' as never },
        place: { colStart: 1, colSpan: 1, rowStart: 1, rowSpan: 1 },
      }],
    };
    const res = validateLayout(layout, { slots: { cover: { fields: ['foto'] } } });
    expect(res.issues.some(i => i.path.endsWith('surface.background') && i.level === 'error')).toBe(true);
    expect(res.issues.some(i => i.path.endsWith('surface.radius')     && i.level === 'error')).toBe(true);
    // una surface válida en el componente → sin issues de surface
    const okLayout: LayoutContainerNode = {
      type: 'container', kind: 'grid', columns: 1, rows: 1, gap: 'sm',
      children: [{
        type: 'component', component: 'card', slots: { media: 'cover' },
        surface: { radius: 'lg', shadow: 'md' },
        place: { colStart: 1, colSpan: 1, rowStart: 1, rowSpan: 1 },
      }],
    };
    expect(validateLayout(okLayout, { slots: { cover: { fields: ['foto'] } } }).issues.filter(i => i.path.includes('surface'))).toEqual([]);
  });

  it('track desconocido → warn; columnSizes de más → warn', () => {
    const bad = base({ columns: 2, columnSizes: ['1fr', '7fr', 'auto'], children: [
      { type: 'slot', slot: 'title', place: { colStart: 1, colSpan: 1, rowStart: 1, rowSpan: 1 } },
      { type: 'slot', slot: 'body',  place: { colStart: 2, colSpan: 1, rowStart: 1, rowSpan: 1 } },
    ]});
    const res = validateLayout(bad, slotsOpt);
    expect(res.issues.some(i => /Track "7fr" desconocido/.test(i.message))).toBe(true);
    expect(res.issues.some(i => /entradas pero el grid tiene/.test(i.message))).toBe(true);
    expect(res.ok).toBe(true); // warns, no errors
  });
});
