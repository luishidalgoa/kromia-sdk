/**
 * Tests de los helpers del behavior `incremental` — KRO-84.
 * `nextIncrementalValue` (auto-asignación) + `findDuplicateIncrementalValues`
 * (detección de duplicados). Ground truth cross-language.
 */

import { describe, it, expect } from 'vitest';
import { nextIncrementalValue, findDuplicateIncrementalValues } from '../src/incremental';

describe('nextIncrementalValue', () => {
  it('lista vacía → 1', () => {
    expect(nextIncrementalValue([])).toBe(1);
  });
  it('max + 1', () => {
    expect(nextIncrementalValue([3, 7, 5])).toBe(8);
    expect(nextIncrementalValue([1])).toBe(2);
  });
  it('[0] → 1', () => {
    expect(nextIncrementalValue([0])).toBe(1);
  });
  it('ignora valores no numéricos / vacíos', () => {
    expect(nextIncrementalValue(['x', 4, null, undefined, ''])).toBe(5);
    expect(nextIncrementalValue(['a', 'b'])).toBe(1);
  });
  it('coerciona strings numéricos', () => {
    expect(nextIncrementalValue(['3', '7'])).toBe(8);
  });
  it('trunca decimales', () => {
    expect(nextIncrementalValue([4.9])).toBe(5);
  });
});

describe('findDuplicateIncrementalValues', () => {
  it('sin duplicados → []', () => {
    expect(findDuplicateIncrementalValues([1, 2, 3])).toEqual([]);
    expect(findDuplicateIncrementalValues([])).toEqual([]);
  });
  it('detecta duplicados, cada uno una vez, ordenados', () => {
    expect(findDuplicateIncrementalValues([3, 1, 2, 2, 3, 3])).toEqual([2, 3]);
  });
  it('coerción string↔number cuenta como el mismo valor', () => {
    expect(findDuplicateIncrementalValues([7, '7'])).toEqual([7]);
  });
  it('ignora no numéricos / vacíos', () => {
    expect(findDuplicateIncrementalValues([1, null, undefined, '', 'x', 1])).toEqual([1]);
  });
});
