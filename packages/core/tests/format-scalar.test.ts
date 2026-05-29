/**
 * Tests de `formatScalar` — KRO-73 (B+).
 *
 * Cubre el corpus de behaviors estables + fallbacks. **Ground truth
 * cross-language**: si en el futuro un SDK Dart implementa formatScalar,
 * debe producir los mismos outputs para los mismos `(value, behavior)`.
 */

import { describe, it, expect } from 'vitest';
import { formatScalar } from '../src/format-scalar';
import type { FieldDefLike } from '../src/types';

const def = (behavior?: string): FieldDefLike => ({ key: 'x', type: 'text', behavior });

describe('formatScalar — empty values', () => {
  it('null → ""', () => {
    expect(formatScalar(null)).toBe('');
  });
  it('undefined → ""', () => {
    expect(formatScalar(undefined)).toBe('');
  });
  it('"" → ""', () => {
    expect(formatScalar('')).toBe('');
  });
  it('whitespace string → ""', () => {
    expect(formatScalar('   ')).toBe('');
  });
  it('[] → ""', () => {
    expect(formatScalar([])).toBe('');
  });
});

describe('formatScalar — behavior=year', () => {
  it('número → string sin separadores', () => {
    expect(formatScalar(2026, def('year'))).toBe('2026');
  });
  it('número grande → string sin separadores', () => {
    expect(formatScalar(20260, def('year'))).toBe('20260');
  });
  it('value string → fallback (cae al genérico string)', () => {
    // Si behavior=year pero value no es number, la rama específica no
    // matchea; cae al fallback genérico que devuelve el string.
    expect(formatScalar('2026', def('year'))).toBe('2026');
  });
});

describe('formatScalar — behavior=iso_date', () => {
  it('fecha ISO válida → formato es-ES', () => {
    const out = formatScalar('2026-05-24', def('iso_date'));
    // El formato exacto depende del runtime — pero debe contener los
    // componentes 24, 5/05, 2026.
    expect(out).toMatch(/\b24\b/);
    expect(out).toMatch(/\b2026\b/);
  });
  it('fecha inválida → "Invalid Date" string (Node no lanza)', () => {
    // new Date('not-a-date') devuelve un Invalid Date que NO lanza al
    // formatear; el catch del código nunca ejecuta. El output es la
    // string "Invalid Date" que el caller debe interpretar como tal.
    // Defensivo: lo que importa es que NO crashea.
    expect(() => formatScalar('not-a-date', def('iso_date'))).not.toThrow();
  });
});

describe('formatScalar — behavior=currency', () => {
  it('19.99 → "19,99 €"', () => {
    expect(formatScalar(19.99, def('currency'))).toBe('19,99 €');
  });
  it('0 → "0,00 €" (cero NO es empty para números)', () => {
    expect(formatScalar(0, def('currency'))).toBe('0,00 €');
  });
  it('1234.5 → currency con 2 decimales y €', () => {
    // Separador de miles depende de que el runtime tenga ICU full data.
    // Node "small-icu" da "1234,50 €", Node "full-icu" da "1.234,50 €".
    // Verificamos forma robusta.
    const out = formatScalar(1234.5, def('currency'));
    expect(out).toMatch(/^1[.,]?234,50 €$/);
  });
});

describe('formatScalar — behavior=percentage', () => {
  it('75 → "75 %"', () => {
    expect(formatScalar(75, def('percentage'))).toBe('75 %');
  });
  it('0 → "0 %"', () => {
    expect(formatScalar(0, def('percentage'))).toBe('0 %');
  });
});

describe('formatScalar — behavior=rating', () => {
  it('4 → "★★★★☆"', () => {
    expect(formatScalar(4, def('rating'))).toBe('★★★★☆');
  });
  it('0 → "☆☆☆☆☆"', () => {
    // 0 no es empty, entra al case rating.
    expect(formatScalar(0, def('rating'))).toBe('☆☆☆☆☆');
  });
  it('5 → "★★★★★"', () => {
    expect(formatScalar(5, def('rating'))).toBe('★★★★★');
  });
  it('clamped: 7 → "★★★★★" (max 5)', () => {
    expect(formatScalar(7, def('rating'))).toBe('★★★★★');
  });
  it('clamped: -1 → "☆☆☆☆☆" (min 0)', () => {
    expect(formatScalar(-1, def('rating'))).toBe('☆☆☆☆☆');
  });
  it('round: 3.7 → "★★★★☆" (round to 4)', () => {
    expect(formatScalar(3.7, def('rating'))).toBe('★★★★☆');
  });
});

describe('formatScalar — behavior=measurement', () => {
  it('número → string', () => {
    expect(formatScalar(12.5, def('measurement'))).toBe('12.5');
  });
});

describe('formatScalar — fallback sin behavior conocido', () => {
  it('string → echo', () => {
    expect(formatScalar('hello')).toBe('hello');
  });
  it('number → toString', () => {
    expect(formatScalar(42)).toBe('42');
  });
  it('true → "sí"', () => {
    expect(formatScalar(true)).toBe('sí');
  });
  it('false → "no"', () => {
    expect(formatScalar(false)).toBe('no');
  });
  it('object → JSON stringify', () => {
    expect(formatScalar({ a: 1 })).toBe('{"a":1}');
  });
});

describe('formatScalar — sin FieldDefLike', () => {
  it('def undefined → fallback genérico', () => {
    expect(formatScalar(42)).toBe('42');
    expect(formatScalar('foo')).toBe('foo');
  });
});

describe('formatScalar — incremental (KRO-84 V2)', () => {
  const inc = (config?: Record<string, unknown>): FieldDefLike => ({
    key: 'dorsal', type: 'number', behavior: 'incremental', behaviorConfig: config,
  });

  it('sin config → número plano (compat V1)', () => {
    expect(formatScalar(7, inc())).toBe('7');
    expect(formatScalar(100, inc({}))).toBe('100');
  });

  it('pad → zero-padding por la izquierda', () => {
    expect(formatScalar(7, inc({ pad: 3 }))).toBe('007');
    expect(formatScalar(42, inc({ pad: 3 }))).toBe('042');
  });

  it('pad NO trunca cuando el número es más largo que el pad', () => {
    expect(formatScalar(100, inc({ pad: 2 }))).toBe('100');
  });

  it('prefix + suffix (solo presentación)', () => {
    expect(formatScalar(7, inc({ prefix: 'HC-' }))).toBe('HC-7');
    expect(formatScalar(7, inc({ suffix: '-2025' }))).toBe('7-2025');
    expect(formatScalar(7, inc({ prefix: 'HC-', suffix: '-2025' }))).toBe('HC-7-2025');
  });

  it('pad + prefix + suffix combinados', () => {
    expect(formatScalar(7, inc({ pad: 3, prefix: 'HC-', suffix: '-25' }))).toBe('HC-007-25');
  });

  it('pad <= 0 o no-número → sin padding', () => {
    expect(formatScalar(7, inc({ pad: 0 }))).toBe('7');
    expect(formatScalar(7, inc({ pad: -2 }))).toBe('7');
    expect(formatScalar(7, inc({ pad: 'x' as unknown as number }))).toBe('7');
  });

  it('valor decimal se trunca a entero antes de formatear', () => {
    expect(formatScalar(7.9, inc({ pad: 3 }))).toBe('007');
  });

  it('0 es valor válido (no vacío) → se formatea', () => {
    expect(formatScalar(0, inc({ pad: 3 }))).toBe('000');
    expect(formatScalar(null, inc({ pad: 3 }))).toBe('');
  });

  it('value no-numérico con behavior incremental → fallback string', () => {
    expect(formatScalar('7', inc({ pad: 3 }))).toBe('7');
  });
});
