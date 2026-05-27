/**
 * `format-scalar.ts` — formateo visible de valores escalares según behavior.
 *
 * Función pura: dado un value + (opcional) FieldDefLike → string listo para
 * renderizar. No produce JSX/Widgets — solo el texto final. El caller decide
 * cómo lo envuelve (Studio en `<span>`, Flutter en `Text(...)`).
 *
 * Cubre los behaviors estables al 2026-05-27:
 *  - year, iso_date, currency, percentage, rating, measurement
 *  - fallback genérico para string/number/boolean
 *
 * **Determinismo cross-language**: para los mismos `(value, behavior)`,
 * el output debe ser idéntico en TS y en futuras impl. (Dart). Los tests
 * en `tests/format-scalar.test.ts` son la spec.
 *
 * Historia: extraído de `kromia-studio/src/components/album/recipes/
 * recipe-utils.tsx:461-506` en KRO-73 (migración B+).
 */

import type { FieldDefLike } from './types';

// ── Helpers internos ────────────────────────────────────────────────────

const CURRENCY_SYMBOLS: Record<string, string> = {
  EUR: '€', USD: '$', GBP: '£', JPY: '¥',
};

/** True si el valor es null/undefined/'' o array vacío. Privado al módulo. */
function isEmpty(v: unknown): boolean {
  if (v == null) return true;
  if (typeof v === 'string') return v.trim() === '';
  if (Array.isArray(v))      return v.length === 0;
  return false;
}

// ── API pública ─────────────────────────────────────────────────────────

/**
 * Formato visible para un valor escalar según su behavior.
 *
 * El símbolo de currency real lo gestiona la celda del editor con
 * behaviorConfig — el SDK solo conoce € por defecto. Las recetas
 * delegan la decisión a Studio (que sí sabe el config del field).
 *
 * @param value  El valor raw (número, string, boolean, etc.).
 * @param def    FieldDefLike con `behavior` opcional. Si no se provee,
 *               se aplica fallback genérico.
 * @returns      String listo para renderizar. `''` si el value está vacío.
 */
export function formatScalar(
  value: unknown,
  def?:  FieldDefLike,
): string {
  if (isEmpty(value)) return '';
  const b = def?.behavior;

  // Año entero: 2026 (sin separadores de miles).
  if (b === 'year' && typeof value === 'number') return String(value);

  // Fecha ISO: 2026-05-24 → "24/05/2026" en es-ES.
  if (b === 'iso_date' && typeof value === 'string') {
    try { return new Date(value).toLocaleDateString('es'); }
    catch { return value; }
  }

  // Currency: 19.99 → "19,99 €".
  if (b === 'currency' && typeof value === 'number') {
    return `${value.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${CURRENCY_SYMBOLS.EUR}`;
  }

  // Percentage: 75 → "75 %".
  if (b === 'percentage' && typeof value === 'number') return `${value} %`;

  // Rating: 4 → "★★★★☆".
  if (b === 'rating' && typeof value === 'number') {
    const max = 5;
    const v = Math.max(0, Math.min(max, Math.round(value)));
    return '★'.repeat(v) + '☆'.repeat(max - v);
  }

  // Measurement: 12.5 → "12.5" (la unidad la define behaviorConfig del
  // editor, no la receta).
  if (b === 'measurement') return String(value);

  // ordinal_enum / enum: el valor ya es un string del catálogo.
  if (typeof value === 'string')  return value;
  if (typeof value === 'number')  return String(value);
  if (typeof value === 'boolean') return value ? 'sí' : 'no';

  // Fallback: stringify defensivo.
  try { return JSON.stringify(value); }
  catch { return String(value); }
}
