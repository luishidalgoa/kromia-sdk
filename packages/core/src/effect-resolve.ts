/**
 * KRO-30 / KRO-224 — Resolver PURO de efectos visuales por carta (movido a
 * @kromia/core: fuente única cross-platform; Flutter lo espeja en core_dart).
 *
 * Dado un item (carta o item de sección), sus fieldDefs y los `tagStyles` del
 * álbum, calcula qué efectos visuales aplican: lee los valores de los fields con
 * `behavior: 'tags'` del item y los matchea (por valor exacto) contra el mapeo
 * `tagStyles` (o, si el estilo está anclado a un `fieldKey`, contra ese campo).
 * Pure + testeable; los hosts (Studio `VisualEffectLayers`, Flutter) consumen el
 * resultado para pintar las capas. El catálogo + el `layer` de cada efecto vienen
 * del registro (`getVisualEffect`).
 */

import { getVisualEffect, type VisualEffectLayer } from './registries/visual-effects';
import type { TagStyle, EffectLayer, FieldDefLike } from './types';

export interface ResolvedEffect {
  /** id del efecto del catálogo (ej. 'holographic_effect') o 'custom_foil'. */
  effect: string;
  /** Capa de render (overlay/badge/filter/border) — del catálogo. */
  layer:  VisualEffectLayer;
  /** displayName del efecto (para tooltips/labels). */
  label:  string;
  /** config del TagStyle (intensity, color, position…). */
  config?: Record<string, string | number>;
  /** KRO-122 — capas del foil personalizado (si es un efecto importado). */
  customLayers?: EffectLayer[];
}

/** Lectura dot-notation — las claves de campo pueden ser anidadas
 *  (p.ej. `images.standard`). Mismo criterio que `getFieldRaw` del editor. */
function getRaw(item: Record<string, unknown>, key: string): unknown {
  return key.split('.').reduce<unknown>(
    (v, p) => (v == null ? undefined : (v as Record<string, unknown>)[p]),
    item,
  );
}

/** Recolecta los valores de tag de un item (fields con behavior 'tags'). */
export function cardTagValues(
  item:      Record<string, unknown>,
  fieldDefs: FieldDefLike[],
): string[] {
  const out: string[] = [];
  for (const f of fieldDefs) {
    if (f.behavior !== 'tags') continue;
    const v = getRaw(item, f.key);
    if (Array.isArray(v)) {
      for (const x of v) if (typeof x === 'string' && x.trim()) out.push(x);
    } else if (typeof v === 'string' && v.trim()) {
      out.push(v);
    }
  }
  return out;
}

/** ¿El valor del item (escalar o lista) coincide con el `target` de un TagStyle? */
function fieldValueMatches(v: unknown, target: string): boolean {
  if (Array.isArray(v)) return v.some(x => x != null && String(x) === target);
  return v != null && String(v) === target;
}

/**
 * Resuelve los efectos visuales que aplican a un item según los tagStyles del
 * álbum. Orden = el de `tagStyles` (z-order que el publisher controla). Dedup
 * por id de efecto (dos disparadores → mismo efecto no se pinta dos veces).
 *
 * KRO-120 — un TagStyle puede estar ANCLADO a un campo (`fieldKey`):
 *  - con `fieldKey`: matchea si el valor de ESE campo del item == `value`
 *    (incl. el campo de rareza enum/ordinal_enum, o cualquier otro).
 *  - sin `fieldKey`: comportamiento clásico — matchea `value` contra los
 *    valores de los campos con behavior `tags` del item (standalone).
 */
export function resolveCardEffects(
  item:      Record<string, unknown>,
  fieldDefs: FieldDefLike[],
  tagStyles: TagStyle[] | undefined | null,
): ResolvedEffect[] {
  if (!tagStyles || tagStyles.length === 0) return [];

  // Valores de tag del item (solo para los estilos standalone, sin fieldKey).
  const tagValues = new Set(cardTagValues(item, fieldDefs));

  const out: ResolvedEffect[] = [];
  const seen = new Set<string>();
  for (const ts of tagStyles) {
    const matches = ts.fieldKey
      ? fieldValueMatches(getRaw(item, ts.fieldKey), ts.value)
      : tagValues.has(ts.value);
    if (!matches) continue;

    // KRO-122 — foil PERSONALIZADO: no es un id de catálogo, sino capas propias.
    if (ts.customLayers && ts.customLayers.length > 0) {
      const key = `custom:${ts.fieldKey ?? ''}:${ts.value}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({
        effect: ts.effect || 'custom_foil',
        layer:  'overlay',
        label:  'Foil personalizado',
        config: ts.config,
        customLayers: ts.customLayers,
      });
      continue;
    }

    if (seen.has(ts.effect)) continue;
    const def = getVisualEffect(ts.effect);
    if (!def) continue;
    seen.add(ts.effect);
    out.push({ effect: ts.effect, layer: def.layer, label: def.displayName, config: ts.config });
  }
  return out;
}
