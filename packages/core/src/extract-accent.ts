/**
 * `extract-accent.ts` — resuelve color + posición del accent visual.
 *
 * Las recetas pueden pintar un borde lateral (accent) cuyo color se deriva
 * de un field con `behavior=color_hex` de la sección. La posición la decide
 * el publisher con una cascada de overrides; si todas son `auto`, se cae al
 * default que la receta provee (top en hero, left en compact_*).
 *
 * **Cascada de resolución de posición** (primer hit gana):
 *  1. `composition.accentPosition` (override global del publisher)
 *  2. `slot.appearance.accentPosition` del slot que contiene el field color
 *  3. `recipeDefault` (heurística cableada por la receta)
 *
 * Pure: sin side effects, sin acceso a DOM/CSS. Devuelve undefined si no
 * hay color hex válido en la sección — el caller renderea sin accent.
 *
 * Historia: extraído de `kromia-studio/src/components/album/recipes/
 * recipe-utils.tsx:223-261` en KRO-73 (migración B+).
 */

import type { SlotComposition, AccentSettings, FieldDefLike } from './types';

/**
 * Estructura mínima de la composition que esta función consume.
 * Compatible con `ViewComposition` (que tiene `slots` y opcionalmente
 * `accentPosition`).
 */
interface AccentSourceComposition {
  slots: Record<string, SlotComposition>;
  accentPosition?: 'top' | 'right' | 'bottom' | 'left' | 'none' | 'auto';
}

/**
 * Extrae color hex + posición del accent para una composition + item dados.
 *
 * @param composition   ViewComposition de la receta (puede ser undefined
 *                      si la sección no tiene composition declarada).
 * @param item          Fila de datos (key → value). Se consultan solo los
 *                      fields con behavior=color_hex.
 * @param fieldDefs     Definiciones de fields de la sección.
 * @param recipeDefault Posición por defecto que aplica la receta concreta
 *                      cuando todos los overrides son `auto`.
 * @returns             `{ color, position }` o `undefined` si no hay
 *                      color hex válido en `item`.
 */
export function extractAccentSettings(
  composition:   AccentSourceComposition | undefined,
  item:          Record<string, unknown>,
  fieldDefs:     FieldDefLike[],
  recipeDefault: 'top' | 'left',
): AccentSettings | undefined {
  // 1. Buscar color hex válido en cualquier field de la sección.
  let color: string | undefined;
  let colorFieldKey: string | undefined;
  for (const def of fieldDefs) {
    if (def.behavior !== 'color_hex') continue;
    const value = item[def.key];
    if (typeof value !== 'string') continue;
    const raw = value.trim();
    if (!/^#?[0-9a-f]{6}([0-9a-f]{2})?$/i.test(raw)) continue;
    color = raw.startsWith('#') ? raw : `#${raw}`;
    colorFieldKey = def.key;
    break;
  }
  if (!color || !colorFieldKey) return undefined;

  // 2. Resolver posición — orden de prioridad:
  //   a. composition.accentPosition (override global del publisher)
  //   b. slot.appearance.accentPosition (override per-slot legacy)
  //   c. recipeDefault (heurística por receta)
  let resolved: AccentSettings['position'] | 'auto' = composition?.accentPosition ?? 'auto';
  if (resolved === 'auto' && composition?.slots) {
    for (const slot of Object.values(composition.slots)) {
      if (!slot.fields.includes(colorFieldKey)) continue;
      const p = slot.appearance?.accentPosition;
      if (p) {
        resolved = p;
        break;
      }
    }
  }
  const position = resolved === 'auto' ? recipeDefault : resolved;
  // KRO-198 — `colorFieldKey` viaja en el resultado: el host suprime como celda el
  // slot que mapea ese campo cuando el acento está activo (no duplica swatch + raya).
  return { color, position, colorFieldKey };
}
