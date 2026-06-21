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
  EUR: '€', USD: '$', GBP: '£', JPY: '¥', CHF: 'CHF', CAD: '$', AUD: '$',
  MXN: '$', BRL: 'R$', ARS: '$', CNY: '¥', KRW: '₩', INR: '₹',
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

  // Currency: 19.99 → "19,99 €". KRO-198 — el código de moneda viene de
  // behaviorConfig.currency (ISO: EUR/USD/GBP/JPY/…); fallback EUR. Símbolo
  // SIEMPRE tras el número (formato es-ES uniforme, determinista cross-lang);
  // si el código no tiene símbolo conocido, se usa el propio código. JPY/KRW
  // sin decimales.
  if (b === 'currency' && typeof value === 'number') {
    const cfg  = (def?.behaviorConfig ?? {}) as Record<string, unknown>;
    const code = typeof cfg.currency === 'string' && cfg.currency.trim()
      ? cfg.currency.trim().toUpperCase() : 'EUR';
    const symbol  = CURRENCY_SYMBOLS[code] ?? code;
    const noCents = code === 'JPY' || code === 'KRW';
    const digits  = noCents ? 0 : 2;
    return `${value.toLocaleString('es-ES', { minimumFractionDigits: digits, maximumFractionDigits: digits })} ${symbol}`;
  }

  // Percentage: 75 → "75 %".
  if (b === 'percentage' && typeof value === 'number') return `${value} %`;

  // Rating: 4 → "★★★★☆".
  if (b === 'rating' && typeof value === 'number') {
    const max = 5;
    const v = Math.max(0, Math.min(max, Math.round(value)));
    return '★'.repeat(v) + '☆'.repeat(max - v);
  }

  // Measurement: 12.5 → "12.5 cm". KRO-198 — la unidad viene de
  // behaviorConfig.unit (string libre: cm/kg/ml/…); sin unidad → número plano.
  if (b === 'measurement') {
    const cfg  = (def?.behaviorConfig ?? {}) as Record<string, unknown>;
    const unit = typeof cfg.unit === 'string' && cfg.unit.trim() ? ` ${cfg.unit.trim()}` : '';
    return `${value}${unit}`;
  }

  // Incremental (contador / dorsal) — KRO-84 V2: zero-padding + prefijo/sufijo
  // OPCIONALES vía behaviorConfig. Solo PRESENTACIÓN: en BD se guarda el number
  // puro y el sort/búsqueda siguen sobre el número real. Sin config → número
  // plano (compat V1). Ej.: 7 + {pad:3, prefix:'HC-'} → "HC-007".
  if (b === 'incremental' && typeof value === 'number') {
    const cfg    = (def?.behaviorConfig ?? {}) as Record<string, unknown>;
    const pad    = typeof cfg.pad === 'number' && cfg.pad > 0 ? Math.trunc(cfg.pad) : 0;
    const prefix = typeof cfg.prefix === 'string' ? cfg.prefix : '';
    const suffix = typeof cfg.suffix === 'string' ? cfg.suffix : '';
    const n      = Math.trunc(value);
    const body   = pad > 0 ? String(Math.abs(n)).padStart(pad, '0') : String(Math.abs(n));
    return `${n < 0 ? '-' : ''}${prefix}${body}${suffix}`;
  }

  // ordinal_enum / enum: el valor ya es un string del catálogo.
  if (typeof value === 'string')  return value;
  if (typeof value === 'number')  return String(value);
  if (typeof value === 'boolean') return value ? 'sí' : 'no';

  // Fallback: stringify defensivo.
  try { return JSON.stringify(value); }
  catch { return String(value); }
}
