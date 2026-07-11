/**
 * KRO-133 — FIXTURE DE CONFORMIDAD del motor de layout (ratchet anti-drift).
 *
 * Problema: el render por bloques (LayoutRenderer) se espeja en cada plataforma
 * (Studio = @kromia/react, Flutter = @kromia/flutter). Cuando el catálogo CRECE
 * (un container kind nuevo, un prefab nuevo, una prop de appearance nueva), es
 * fácil que una plataforma se quede atrás y aparezca drift silencioso.
 *
 * Este fixture es un **corpus golden** que ejercita, a propósito, TODOS los
 * primitivos del motor: los 3 container kinds, los N prefab components y las N
 * props de appearance. El test `layout-conformance.test.ts` verifica que el
 * fixture CUBRE el catálogo completo → si alguien añade un primitivo y no lo mete
 * aquí, el test FALLA (ratchet). Flutter renderiza este mismo fixture como golden
 * y compara → cualquier primitivo que su LayoutRenderer no soporte salta.
 *
 * No es para mostrarse a un usuario: es estructura de cobertura. Los slots
 * referencian keys de campo sintéticas; el dato real lo aporta cada golden.
 */
import { COMPONENT_IDS } from './registries/components';
import { ALL_APPEARANCE_PROPS } from './registries/slot-kinds';
import { LAYOUT_CONTAINER_KINDS, ALL_SURFACE_PROPS, ALL_TRACK_PROPS } from './layout';
import type { LayoutNode, LayoutContainerNode, ViewComposition, SlotComposition } from './types';

// ── Slots con appearance que, en conjunto, cubren TODAS las props ──────────────
const slots: Record<string, SlotComposition> = {
  img:    { fields: ['arte'],     appearance: { shape: 'rounded', aspect: '16:9', objectFit: 'cover', imageFocus: { x: 50, y: 40, zoom: 1.2 }, opacity: '90', shadow: 'md', paddingY: 'sm' } },
  text:   { fields: ['nombre'],   appearance: { align: 'center', weight: 'bold', italic: true, underline: true, textTransform: 'uppercase', font: 'serif', lineHeight: 'relaxed', tracking: 'wide', textShadow: 'sm', size: 'xl', truncate: '2', truncateChars: 80, textColor: 'muted', bgColor: 'primary', display: 'badge' } },
  refs:   { fields: ['habitat'],  appearance: { refColumns: '3', refTap: 'focus', refSize: 60 } },
  accent: { fields: ['elemento'], appearance: { accentPosition: 'left' } },
  // Slots simples referenciados por prefabs (sin appearance extra).
  title: { fields: ['nombre'] }, subtitle: { fields: ['fecha'] }, caption: { fields: ['clima'] },
  badge: { fields: ['elemento'] }, media: { fields: ['arte'] }, banner: { fields: ['arte'] },
  avatar: { fields: ['arte'] }, images: { fields: ['imagenes'] }, cards: { fields: ['protagonista'] },
  stats: { fields: ['altura', 'peso'] }, badges: { fields: ['elemento', 'rareza'] }, sectionLabel: { fields: ['nombre'] },
};

// ── Un nodo `component` por cada prefab del catálogo (rol→slot) ────────────────
const COMPONENT_ROLE_SLOTS: Record<string, Record<string, string>> = {
  card:              { media: 'media', title: 'title', caption: 'caption', badge: 'badge' },
  ref_gallery:       { refs: 'refs' },
  carousel_peek:     { images: 'images' },
  carousel_centered: { images: 'images' },
  gallery_grid:      { images: 'images' },
  cards_carousel:    { cards: 'cards' },
  divider:           {},
  stats_row:         { stats: 'stats' },
  badge_row:         { badges: 'badges' },
  // chips_row DEBE llevar un slot REAL (no `{}`): si va con slots vacíos el golden
  // lo renderiza como nada → un host que NO soporte `chips_row` (cae a default:null)
  // produce el MISMO golden vacío = drift silencioso. Fue exactamente el bug de
  // 2026-07-11 (chips_row no espejado en core_dart/flutter, termómetro verde). Con
  // un slot poblado el golden exige que el componente RENDERICE sus chips.
  chips_row:         { chips: 'badges' },
  section_title:     { text: 'sectionLabel' },
  hero_header:       { banner: 'banner', avatar: 'avatar', title: 'title', subtitle: 'subtitle' },
};

const componentNodes: LayoutNode[] = COMPONENT_IDS.map((component, i) => ({
  type: 'component',
  component,
  slots: COMPONENT_ROLE_SLOTS[component] ?? {},
  place: { colStart: 1, rowStart: i + 3 },
}));

// ── Árbol que usa los 3 container kinds (grid raíz + flex + stack) ─────────────
const flexRow: LayoutContainerNode = {
  type: 'container', kind: 'flex', direction: 'row', gap: 'md', align: 'center',
  children: [
    { type: 'slot', slot: 'img',  place: {} },
    { type: 'slot', slot: 'text', place: {}, grow: 1 },
    { type: 'slot', slot: 'accent', place: {} },
  ],
};
const zStack: LayoutContainerNode = {
  type: 'container', kind: 'stack', gap: 'none',
  scrim: 'bottom',
  children: [
    { type: 'slot', slot: 'img',  place: {} },
    { type: 'slot', slot: 'refs', place: { position: 'absolute', x: 5, y: 60, w: 90 } },
  ],
};

// Grid 2×1 que ejercita track sizing (columnSizes/rowSizes) + una `surface` que
// cubre las 7 props de ContainerSurface (background, bgColor, border completo
// con sides/color/style, radius, radiusCorners, shadow, padding). Junto con la
// surface de la raíz, garantiza cobertura del catálogo de decoración (ratchet).
const gridDuo: LayoutContainerNode = {
  type: 'container', kind: 'grid', columns: 2, rows: 1, gap: 'sm',
  columnSizes: ['2fr', 'content'], rowSizes: ['auto'],
  surface: {
    background: 'muted', bgColor: 'slate-100',
    border: { width: 'medium', sides: ['top', 'bottom'], color: 'accent', style: 'dashed' },
    radius: 'md', radiusCorners: ['tl', 'tr'], shadow: 'sm', padding: 'sm',
  },
  children: [
    { type: 'slot', slot: 'title', place: { colStart: 1, rowStart: 1 } },
    { type: 'slot', slot: 'badge', place: { colStart: 2, rowStart: 1 } },
  ],
};

const root: LayoutContainerNode = {
  type: 'container', kind: 'grid', columns: 1, rows: componentNodes.length + 3,
  gap: 'md', surface: { background: 'card', radius: 'lg', border: { width: 'thin' }, shadow: 'sm', padding: 'md' },
  children: [
    { ...flexRow, place: { colStart: 1, rowStart: 1 } },
    { ...zStack,  place: { colStart: 1, rowStart: 2 } },
    ...componentNodes,
    { ...gridDuo, place: { colStart: 1, rowStart: componentNodes.length + 3 } },
  ],
};

/** Composición golden que ejercita TODO el motor de layout. */
export const LAYOUT_CONFORMANCE_FIXTURE: ViewComposition = {
  recipe: 'hero_protagonico',
  action: 'none',
  slots,
  layout: root,
};

// ── Walkers de cobertura (los usa el test ratchet + el golden de Flutter) ──────
function walk(node: LayoutNode, visit: (n: LayoutNode) => void): void {
  visit(node);
  if (node.type === 'container') for (const c of node.children) walk(c, visit);
}

/** Container kinds presentes en el fixture. */
export function conformanceContainerKinds(comp: ViewComposition = LAYOUT_CONFORMANCE_FIXTURE): Set<string> {
  const out = new Set<string>();
  if (comp.layout) walk(comp.layout, n => { if (n.type === 'container') out.add(n.kind); });
  return out;
}

/** Prefab components presentes en el fixture. */
export function conformanceComponents(comp: ViewComposition = LAYOUT_CONFORMANCE_FIXTURE): Set<string> {
  const out = new Set<string>();
  if (comp.layout) walk(comp.layout, n => { if (n.type === 'component') out.add(n.component); });
  return out;
}

/** Props de appearance presentes en los slots del fixture. */
export function conformanceAppearanceProps(comp: ViewComposition = LAYOUT_CONFORMANCE_FIXTURE): Set<string> {
  const out = new Set<string>();
  for (const sc of Object.values(comp.slots ?? {})) {
    for (const k of Object.keys(sc.appearance ?? {})) out.add(k);
  }
  return out;
}

/** Props de `surface` (decoración de caja) presentes en CUALQUIER nodo del
 *  fixture (contenedor o componente — ambos llevan `surface?`). KRO-133. */
export function conformanceSurfaceProps(comp: ViewComposition = LAYOUT_CONFORMANCE_FIXTURE): Set<string> {
  const out = new Set<string>();
  if (comp.layout) walk(comp.layout, n => {
    const surface = (n as { surface?: Record<string, unknown> }).surface;
    if (surface) for (const k of Object.keys(surface)) out.add(k);
  });
  return out;
}

/** Props de track sizing (columnSizes/rowSizes) presentes en algún contenedor
 *  del fixture. KRO-133. */
export function conformanceTrackProps(comp: ViewComposition = LAYOUT_CONFORMANCE_FIXTURE): Set<string> {
  const out = new Set<string>();
  if (comp.layout) walk(comp.layout, n => {
    if (n.type !== 'container') return;
    for (const k of ALL_TRACK_PROPS) if ((n as unknown as Record<string, unknown>)[k] !== undefined) out.add(k);
  });
  return out;
}

/** Catálogos esperados (re-export para el golden de Flutter). */
export const CONFORMANCE_CATALOG = {
  containerKinds: LAYOUT_CONTAINER_KINDS,
  components: COMPONENT_IDS,
  appearanceProps: ALL_APPEARANCE_PROPS,
  surfaceProps: ALL_SURFACE_PROPS,
  trackProps: ALL_TRACK_PROPS,
} as const;
