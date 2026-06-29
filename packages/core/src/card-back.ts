/**
 * KRO-227 — Reverso de la carta: resuelve el `CardBackDesign` efectivo de una carta
 * a partir de su `CardBackComposition` (base + condicional por valor/sección).
 *
 * Puro: mismas entradas → misma salida. Reusa el matcher de `ConditionalStyle`
 * (`matchConditionalCase`) para que la semántica de los operadores sea IDÉNTICA a
 * la del "Estilo por valor". Flutter lo espeja 1:1.
 */
import type { CardBackComposition, CardBackDesign } from './types';
import { matchConditionalCase } from './conditional-style';

/** KRO-227 — pseudo-campo: filtrar el reverso por la SECCIÓN de la carta. */
export const CARD_BACK_SECTION_KEY = '__section__';

/**
 * Reverso EFECTIVO de una carta. El primer caso condicional que coincide (merge
 * sobre la base), o el `otherwise`, o la `base`. `section` alimenta el filtro
 * `__section__`. Sin composición / sin condicional configurado → la base intacta.
 */
export function resolveCardBack(
  comp:     CardBackComposition | undefined,
  item:     Record<string, unknown> | undefined,
  section?: string,
): CardBackDesign | undefined {
  if (!comp) return undefined;
  const { base, conditional: cond } = comp;
  // Sin condicional configurado o sin datos que evaluar → la base.
  if (!cond?.fieldKey || !cond.cases?.length || !item) return base;

  const raw = cond.fieldKey === CARD_BACK_SECTION_KEY ? section : item[cond.fieldKey];
  const chosen =
    cond.cases.find(c => matchConditionalCase({ op: c.op, value: c.value }, raw))?.design
    ?? cond.otherwise;

  if (!chosen) return base;
  // El reverso elegido PISA la base campo a campo (image/qr) — como el merge de
  // apariencia condicional: variar solo la imagen conserva el QR de la base, etc.
  return { ...(base ?? {}), ...chosen };
}
