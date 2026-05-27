/**
 * Tests de `composeSlotValues` — KRO-73 (B+).
 *
 * Cubre formateo + filtering + orientation + separator + truncate.
 * El JSX que envuelve esto vive en Studio (`<ComposableSlot>`) y consume
 * el resultado.
 */

import { describe, it, expect } from 'vitest';
import { composeSlotValues, type ComposeSlotInput } from '../src/compose-slot';
import type { FieldDefLike } from '../src/types';

const slot = (overrides: Partial<ComposeSlotInput>): ComposeSlotInput => ({
  fields:      [],
  orientation: 'horizontal',
  separator:   ' · ',
  ...overrides,
});

const f = (value: unknown, behavior?: string): { def?: FieldDefLike; value: unknown } => ({
  def:   behavior ? { key: 'k', type: 'text', behavior } : { key: 'k', type: 'text' },
  value,
});

describe('composeSlotValues — items + filtering', () => {
  it('slot vacío → items vacío', () => {
    const r = composeSlotValues(slot({}));
    expect(r.items).toEqual([]);
  });

  it('values vacíos filtrados', () => {
    const r = composeSlotValues(slot({
      fields: [f('Madrid'), f(''), f(null), f('2024'), f(undefined)],
    }));
    expect(r.items).toEqual(['Madrid', '2024']);
  });

  it('aplica formatScalar por behavior', () => {
    const r = composeSlotValues(slot({
      fields: [f(4, 'rating'), f('2026-05-24', 'iso_date')],
    }));
    expect(r.items[0]).toBe('★★★★☆');
    expect(r.items[1]).toMatch(/2026/);
  });
});

describe('composeSlotValues — orientation / separator echo', () => {
  it('horizontal con separator custom → echo', () => {
    const r = composeSlotValues(slot({
      fields:      [f('a'), f('b')],
      orientation: 'horizontal',
      separator:   ' / ',
    }));
    expect(r.orientation).toBe('horizontal');
    expect(r.separator).toBe(' / ');
  });

  it('vertical → echo', () => {
    const r = composeSlotValues(slot({
      fields:      [f('línea 1'), f('línea 2')],
      orientation: 'vertical',
      separator:   ' · ',
    }));
    expect(r.orientation).toBe('vertical');
    expect(r.items).toEqual(['línea 1', 'línea 2']);
  });
});

describe('composeSlotValues — truncate', () => {
  it('sin charLimit → truncated null', () => {
    const r = composeSlotValues(slot({
      fields: [f('Madrid'), f('Barcelona')],
    }));
    expect(r.truncated).toBeNull();
  });

  it('charLimit=0 → no aplica', () => {
    const r = composeSlotValues(slot({
      fields:     [f('Madrid')],
      appearance: { truncateChars: 0 },
    }));
    expect(r.truncated).toBeNull();
  });

  it('texto MÁS corto que charLimit → no aplica', () => {
    const r = composeSlotValues(slot({
      fields:     [f('AB')],
      appearance: { truncateChars: 20 },
    }));
    expect(r.truncated).toBeNull();
  });

  it('texto que excede charLimit → truncated con "…"', () => {
    const r = composeSlotValues(slot({
      fields:     [f('Una frase razonablemente larga que excede')],
      appearance: { truncateChars: 10 },
    }));
    expect(r.truncated).toBe('Una frase…');
  });

  it('charLimit aplica al string COMPLETO joined (no por item)', () => {
    const r = composeSlotValues(slot({
      fields:     [f('aa'), f('bb'), f('cc')],
      separator:  ' · ',
      appearance: { truncateChars: 6 },
    }));
    // Joined: "aa · bb · cc" (12 chars). Cortado a 6 + "…".
    expect(r.truncated).toBeTruthy();
    expect(r.truncated!.endsWith('…')).toBe(true);
    expect(r.truncated!.length).toBeLessThanOrEqual(7);
  });

  it('orientation vertical usa joiner=" " para el truncate', () => {
    const r = composeSlotValues(slot({
      fields:      [f('línea1'), f('línea2')],
      orientation: 'vertical',
      separator:   ' · ', // ignorado en vertical
      appearance:  { truncateChars: 8 },
    }));
    // Joined: "línea1 línea2" (13 chars). Cortado a 8 + "…".
    expect(r.truncated).toBeTruthy();
    expect(r.truncated!.endsWith('…')).toBe(true);
  });
});

describe('composeSlotValues — sin def en field', () => {
  it('field sin def usa formatScalar fallback (string echo)', () => {
    const r = composeSlotValues(slot({
      fields: [{ value: 'plain' }],
    }));
    expect(r.items).toEqual(['plain']);
  });
});
