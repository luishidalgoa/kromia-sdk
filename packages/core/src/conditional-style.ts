/**
 * KRO-198 — Estilo condicional por valor: evalúa `SlotComposition.conditionalStyle`
 * contra el dato de una carta y devuelve la apariencia efectiva.
 *
 * Resuelve "color/estilo por rareza" (y similares) de forma DECLARATIVA, dentro
 * del propio modelo de appearance — sin depender del sistema overlay de
 * visual-effects. Puro: mismas entradas → misma salida. Flutter lo espeja.
 */
import type { ConditionalStyle, ConditionalStyleCase, SlotAppearance } from './types';

/** Parsea un valor a número (acepta strings numéricos); null si no es número. */
function asNumber(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.trim() !== '' && !Number.isNaN(Number(v))) return Number(v);
  return null;
}

/** ¿El valor `raw` del dato cumple este caso? Comparación de texto
 *  case-insensitive + trim; gt/gte/lt/lte numéricas; truthy/falsy ignoran value. */
export function matchConditionalCase(c: ConditionalStyleCase, raw: unknown): boolean {
  const op = c.op ?? 'eq';
  if (op === 'truthy') return !!raw && raw !== '0' && raw !== 'false';
  if (op === 'falsy')  return !raw || raw === '0' || raw === 'false';

  if (op === 'gt' || op === 'gte' || op === 'lt' || op === 'lte') {
    const a = asNumber(raw), b = asNumber(c.value);
    if (a == null || b == null) return false;
    return op === 'gt' ? a > b : op === 'gte' ? a >= b : op === 'lt' ? a < b : a <= b;
  }

  const s  = (raw == null ? '' : String(raw)).trim().toLowerCase();
  const t  = (c.value ?? '').trim().toLowerCase();
  if (op === 'contains') return t !== '' && s.includes(t);
  if (op === 'neq')      return s !== t;
  return s === t; // eq
}

/**
 * Apariencia EFECTIVA tras aplicar el estilo condicional: el primer caso que
 * matchea el valor de `cond.fieldKey` en `item` MERGE-a su appearance sobre la
 * base. Sin condicional / sin match / sin item → devuelve la base intacta.
 */
export function resolveConditionalAppearance(
  cond: ConditionalStyle | undefined,
  base: SlotAppearance | undefined,
  item: Record<string, unknown> | undefined,
): SlotAppearance | undefined {
  const matched = matchedConditionalCase(cond, item);
  if (!matched) return base;
  return { ...(base ?? {}), ...(matched.appearance ?? {}) };
}

/**
 * KRO-198 — devuelve el CASO que matchea (no solo el merge), para que el caller pueda
 * leer su `target` y aplicar la apariencia a los chip(s) correctos del slot componible
 * (ganando sobre su apariencia por-chip) en vez de a la base de toda la fila. Sin
 * condicional / sin match / sin item → undefined. Mismo orden de evaluación (1º que
 * matchea gana) que `resolveConditionalAppearance`.
 */
export function matchedConditionalCase(
  cond: ConditionalStyle | undefined,
  item: Record<string, unknown> | undefined,
): ConditionalStyleCase | undefined {
  if (!cond?.fieldKey || !cond.cases?.length || !item) return undefined;
  const raw = item[cond.fieldKey];
  return cond.cases.find(c => matchConditionalCase(c, raw));
}
