/**
 * Slot Acceptance Kinds — metadata humana + props de apariencia editables.
 *
 * Single source of truth de `SlotAcceptKind`. Iterar `SLOT_ACCEPT_KIND_META`
 * garantiza que cualquier nuevo kind añadido al union (en `../types.ts`) se
 * refleje automáticamente en el form de "Añadir slot custom" sin tocar
 * código de UI.
 *
 * Si en el futuro se añade una nueva clase (ej. `audio-clip`), basta con:
 *  1. Añadir el literal al union `SlotAcceptKind` en `../types.ts`.
 *  2. Añadir la entry aquí — TypeScript fuerza exhaustividad via Record.
 *  3. Añadir las props de appearance aplicables en
 *     `APPEARANCE_PROPS_BY_KIND` (mismo file).
 *
 * Los labels evitan jerga interna (no "image-avatar" sino "Imagen") y son
 * cortos pensando en pills inline. La descripción es para tooltip al hover.
 */

import type { SlotAcceptKind } from '../types';

export const SLOT_ACCEPT_KIND_META: Record<SlotAcceptKind, { label: string; description: string }> = {
  'text-short':   { label: 'Texto',              description: 'Fields tipo text o select (nombre, ciudad, opciones cerradas).' },
  'text-long':    { label: 'Texto largo',        description: 'Fields tipo textarea (descripción, bio, párrafos). También markdown/notes/html.' },
  'number':       { label: 'Número',             description: 'Fields tipo number (precio, índice, cantidad). Cualquier behavior numérico.' },
  'date':         { label: 'Fecha',              description: 'Fields con behavior year o iso_date (año de fundación, fecha de evento).' },
  'badge':        { label: 'Badge',              description: 'Fields con behavior rating, enum u ordinal_enum (rareza, categoría, tier).' },
  'color':        { label: 'Color',              description: 'Fields con behavior color_hex. Se renderiza como swatch visual (cuadradito coloreado) y futuro accent del wrapper.' },
  'image':        { label: 'Imagen',             description: 'Cualquier field tipo image. El slot decide cómo se renderiza (circular, banner, cover…) según su id y su Apariencia.' },
  'image-avatar': { label: 'Imagen',             description: '[Legacy] Alias de "Imagen". Mantenido para composiciones existentes. Cualquier field tipo image.' },
  'image-cover':  { label: 'Imagen',             description: '[Legacy] Alias de "Imagen". Mantenido para composiciones existentes. Cualquier field tipo image.' },
  'image-banner': { label: 'Imagen',             description: '[Legacy] Alias de "Imagen". Mantenido para composiciones existentes. Cualquier field tipo image.' },
  'image-array':  { label: 'Galería',            description: 'Fields tipo array<image> o behaviors gallery/slideshow/card_multiview.' },
  'card-ref':     { label: 'Referencia a carta', description: 'Fields con behavior card_index_list o card_code_list (referencias a otras cartas).' },
  'url':          { label: 'Enlace',             description: 'Fields con behavior url, email o phone (links clicables).' },
  'any':          { label: 'Cualquier tipo',     description: 'Wildcard — acepta cualquier field sin filtrar.' },
};

/**
 * Devuelve el catálogo como array, en orden estable, para iteración en UI.
 */
export function getSlotAcceptKindOptions(): Array<{ id: SlotAcceptKind; label: string; description: string }> {
  return (Object.keys(SLOT_ACCEPT_KIND_META) as SlotAcceptKind[]).map(id => ({
    id,
    ...SLOT_ACCEPT_KIND_META[id],
  }));
}

/**
 * Etiqueta humana corta y separada por " / " para los accepts de un slot.
 * 1 accept → su label ("Avatar"). N accepts → "Texto / Fecha". 'any' →
 * "cualquiera". Usado en el header del SlotEditor para que el publisher
 * entienda qué tipos de field puede asignarle.
 */
export function formatSlotAccepts(
  accepts: ReadonlyArray<SlotAcceptKind>,
): string {
  if (accepts.length === 0) return '';
  if (accepts.includes('any')) return 'cualquiera';
  return accepts.map(k => SLOT_ACCEPT_KIND_META[k]?.label ?? k).join(' / ');
}

// ── KRO-69 V6 — Appearance overrides per-slot ─────────────────────────────
//
// Cada SlotAcceptKind declara qué props de `SlotAppearance` son aplicables.
// El editor (SlotEditor → "Apariencia") consulta este mapa para mostrar
// solo los controles relevantes. El renderer también puede consultarlo
// para ignorar props que llegan pero no aplican.

/** Tag de propiedad editable. Hay un control UI por cada uno. */
export type AppearanceProp =
  | 'shape'
  | 'aspect'
  | 'imageFocus'
  | 'align'
  | 'weight'
  | 'size'
  | 'truncate'
  | 'truncateChars'
  | 'accentPosition'
  | 'paddingY';

const APPEARANCE_PROPS_BY_KIND: Record<SlotAcceptKind, ReadonlyArray<AppearanceProp>> = {
  // KRO-69 follow-up — image unificado. Mismo set de props para los 4
  // (incluidos los 3 legacy aliases que ahora son sinónimos).
  'image':        ['shape', 'aspect', 'imageFocus', 'size', 'paddingY'],
  'image-avatar': ['shape', 'aspect', 'imageFocus', 'size', 'paddingY'],
  'image-banner': ['shape', 'aspect', 'imageFocus', 'size', 'paddingY'],
  'image-cover':  ['shape', 'aspect', 'imageFocus', 'size', 'paddingY'],
  'image-array':  ['shape', 'aspect', 'imageFocus', 'size', 'paddingY'],
  'text-short':   ['align', 'weight', 'size', 'truncate', 'truncateChars', 'paddingY'],
  'text-long':    ['align', 'weight', 'size', 'truncate', 'truncateChars', 'paddingY'],
  'number':       ['align', 'weight', 'size', 'truncate', 'truncateChars', 'paddingY'],
  'date':         ['align', 'weight', 'size', 'truncate', 'truncateChars', 'paddingY'],
  'url':          ['align', 'weight', 'size', 'truncate', 'truncateChars', 'paddingY'],
  'badge':        ['size', 'truncate', 'truncateChars', 'paddingY'],
  'color':        ['accentPosition', 'size', 'paddingY'],
  'card-ref':     ['paddingY'],
  'any':          ['shape', 'aspect', 'imageFocus', 'align', 'weight', 'size', 'truncate', 'truncateChars', 'paddingY'],
};

/**
 * Devuelve la lista de props de `SlotAppearance` editables para un slot
 * cuyo kind/accept es el dado. Un slot con múltiples `accepts` recibe la
 * UNIÓN de props relevantes.
 */
export function getAvailableAppearanceProps(
  accepts: ReadonlyArray<SlotAcceptKind>,
): AppearanceProp[] {
  if (accepts.length === 0) return [];
  const order: AppearanceProp[] = ['shape', 'aspect', 'imageFocus', 'align', 'weight', 'size', 'truncate', 'truncateChars', 'accentPosition', 'paddingY'];
  const union = new Set<AppearanceProp>();
  for (const kind of accepts) {
    for (const prop of APPEARANCE_PROPS_BY_KIND[kind]) {
      union.add(prop);
    }
  }
  return order.filter(p => union.has(p));
}
