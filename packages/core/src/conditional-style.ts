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
 * base; si ninguno matchea pero hay cláusula `otherwise` (else), esa manda. Sin
 * condicional / sin match / sin else → devuelve la base intacta.
 */
export function resolveConditionalAppearance(
  cond: ConditionalStyle | undefined,
  base: SlotAppearance | undefined,
  item: Record<string, unknown> | undefined,
): SlotAppearance | undefined {
  const eff = resolveConditionalStyling(cond, item);
  if (!eff) return base;
  return { ...(base ?? {}), ...(eff.appearance ?? {}) };
}

/**
 * KRO-198 — devuelve el CASO que matchea (no solo el merge), para que el caller pueda
 * leer su `target` y aplicar la apariencia a los chip(s) correctos del slot componible
 * (ganando sobre su apariencia por-chip) en vez de a la base de toda la fila. Sin
 * condicional / sin match / sin item → undefined. Mismo orden de evaluación (1º que
 * matchea gana) que `resolveConditionalAppearance`. NO contempla el `otherwise` (else):
 * es puro "primer caso que coincide" → para el fallback usa `resolveConditionalStyling`.
 */
export function matchedConditionalCase(
  cond: ConditionalStyle | undefined,
  item: Record<string, unknown> | undefined,
): ConditionalStyleCase | undefined {
  if (!cond?.fieldKey || !cond.cases?.length || !item) return undefined;
  const raw = item[cond.fieldKey];
  return cond.cases.find(c => matchConditionalCase(c, raw));
}

/**
 * KRO-198 — caso EFECTIVO del estilo condicional, CON la cláusula else: el primer
 * `case` que coincide o, si ninguno, la cláusula `otherwise` (else); undefined si no
 * hay ni match ni else. El caller lee `.appearance` + `.target` IGUAL para casos y
 * para el else → el "aplica a"/scoping por-chip funciona idéntico en ambos. Este es
 * el helper que debe usar el render (resolveSlot) para que el else surta efecto.
 */
export function resolveConditionalStyling(
  cond: ConditionalStyle | undefined,
  item: Record<string, unknown> | undefined,
): ConditionalStyleCase | undefined {
  // El else aplica SOLO cuando el condicional está configurado (fieldKey + cases) y
  // se EVALUÓ contra datos (hay item) pero ningún caso coincidió. Sin configurar /
  // sin item → undefined (no filtra el else sin datos que evaluar).
  if (!cond?.fieldKey || !cond.cases?.length || !item) return undefined;
  return matchedConditionalCase(cond, item) ?? cond.otherwise;
}
