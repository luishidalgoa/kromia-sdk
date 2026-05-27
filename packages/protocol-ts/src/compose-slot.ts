/**
 * `compose-slot.ts` — lógica pura para slots composables.
 *
 * Un slot composable agrupa N fields que se renderizan como UN solo valor
 * visible (e.g. subtitle = "Madrid · 2024 · Capitán"). Esta función toma
 * la decisión de:
 *
 *  1. Formatear cada field con `formatScalar`.
 *  2. Filtrar vacíos (no aportan al texto final).
 *  3. Aplicar truncate por charLimit si está configurado en appearance.
 *  4. Decidir cómo se entregan los items al renderer (lista + meta).
 *
 * **No renderiza JSX/Widgets** — devuelve un `ComposedSlotResult` con la
 * información lista para que el caller (Studio React, Flutter) decida
 * cómo pintar. La paridad Studio↔Flutter es estructural: ambos producen
 * la misma lista de items y aplican el mismo truncate.
 *
 * Historia: extraído de `kromia-studio/src/components/album/recipes/
 * recipe-utils.tsx:560-627` (función `ComposableSlot`) en KRO-73. El JSX
 * permanece en Studio (`<ComposableSlot>` ahora consume esta función).
 */

import type { SlotAppearance, FieldDefLike } from './types';
import { formatScalar } from './format-scalar';

// ── Tipos ──────────────────────────────────────────────────────────────

/**
 * Forma mínima de entrada para `composeSlotValues`. Compatible
 * estructuralmente con el `ResolvedSlot` de Studio (que tiene también
 * `key` en cada field, ignorado aquí).
 */
export interface ComposeSlotInput {
  fields: Array<{
    def?:   FieldDefLike;
    value:  unknown;
  }>;
  orientation: 'horizontal' | 'vertical';
  separator:   string;
  appearance?: SlotAppearance;
}

/**
 * Resultado de `composeSlotValues`. El caller renderiza así:
 *
 *  - Si `truncated !== null`: pinta UN solo string plano (el limit recortó
 *    todo, perdimos el separador estilizado — trade-off aceptado).
 *  - Si `orientation === 'vertical'`: pinta los `items` apilados en columna.
 *  - Si horizontal: pinta los `items` intercalados con `separator`.
 *  - Si `items.length === 0`: el slot está vacío, no renderizar nada.
 */
export interface ComposedSlotResult {
  items:       string[];
  orientation: 'horizontal' | 'vertical';
  separator:   string;
  truncated:   string | null;
}

// ── Helpers privados ────────────────────────────────────────────────────

/** Slice por N chars + "…". Devuelve text original si N inválido o no
 *  excede. Privado al módulo. */
function applyTruncate(text: string, n: number | undefined): string {
  if (!n || n <= 0)     return text;
  if (text.length <= n) return text;
  return text.slice(0, n).trimEnd() + '…';
}

// ── API pública ─────────────────────────────────────────────────────────

/**
 * Calcula los items formateados de un slot composable + decide si aplicó
 * truncate.
 *
 * @param slot  Input mínimo con fields (def + value), orientation,
 *              separator, appearance opcional con truncateChars.
 * @returns     Objeto con `items` (formateados, sin vacíos), `orientation`
 *              y `separator` (echo para el caller), y `truncated` (string
 *              final si charLimit aplicó, o `null` si no).
 */
export function composeSlotValues(slot: ComposeSlotInput): ComposedSlotResult {
  const items = slot.fields
    .map(f => formatScalar(f.value, f.def))
    .filter(t => t !== '');

  const charLimit = slot.appearance?.truncateChars;
  let truncated: string | null = null;

  if (charLimit && charLimit > 0 && items.length > 0) {
    // El joiner depende de la orientación: vertical usa espacio simple
    // (perdemos visualmente la pinta column-stacked si se corta).
    const joiner   = slot.orientation === 'vertical' ? ' ' : slot.separator;
    const allText  = items.join(joiner);
    const cut      = applyTruncate(allText, charLimit);
    if (cut !== allText) {
      truncated = cut;
    }
  }

  return {
    items,
    orientation: slot.orientation,
    separator:   slot.separator,
    truncated,
  };
}
