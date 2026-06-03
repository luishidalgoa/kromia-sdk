/**
 * KRO-28 — Fuente de rareza: validador + helpers puros.
 */
import { describe, it, expect } from 'vitest';
import {
  isFieldEligibleForRarity,
  validateRaritySource,
  rarityBucketForValue,
  normalizeRarityWeights,
} from '../src/rarity';
import type { FieldDefLike, RaritySource } from '../src/types';

const enumField: FieldDefLike = { key: 'tier', label: 'Tier', type: 'select', behavior: 'ordinal_enum', options: ['rookie', 'pro', 'star', 'legend'] };
const ratingField: FieldDefLike = { key: 'valoracion', label: 'Valoración', type: 'number', behavior: 'rating' };
const plainField: FieldDefLike = { key: 'nombre', label: 'Nombre', type: 'text' };

describe('isFieldEligibleForRarity', () => {
  it('rating/enum/ordinal_enum → true', () => {
    expect(isFieldEligibleForRarity({ behavior: 'rating' })).toBe(true);
    expect(isFieldEligibleForRarity({ behavior: 'enum' })).toBe(true);
    expect(isFieldEligibleForRarity({ behavior: 'ordinal_enum' })).toBe(true);
  });
  it('otros behaviors / sin behavior → false', () => {
    expect(isFieldEligibleForRarity({ behavior: 'url' })).toBe(false);
    expect(isFieldEligibleForRarity({})).toBe(false);
  });
});

describe('validateRaritySource', () => {
  it('undefined → válido sin issues', () => {
    expect(validateRaritySource(undefined, [enumField])).toEqual({ valid: true, issues: [] });
  });

  it('enum válido con pesos que suman 100 → válido', () => {
    const rs: RaritySource = { fieldKey: 'tier', buckets: [
      { value: 'rookie', weight: 60 }, { value: 'pro', weight: 25 }, { value: 'star', weight: 12 }, { value: 'legend', weight: 3 },
    ] };
    const r = validateRaritySource(rs, [enumField]);
    expect(r.valid).toBe(true);
    expect(r.issues).toHaveLength(0);
  });

  it('rating válido por rangos → válido', () => {
    const rs: RaritySource = { fieldKey: 'valoracion', buckets: [
      { range: [0, 1.5], weight: 50 }, { range: [2, 3.5], weight: 35 }, { range: [4, 5], weight: 15 },
    ] };
    expect(validateRaritySource(rs, [ratingField]).valid).toBe(true);
  });

  it('field inexistente → error', () => {
    const r = validateRaritySource({ fieldKey: 'noexiste', buckets: [{ value: 'x', weight: 100 }] }, [enumField]);
    expect(r.valid).toBe(false);
    expect(r.issues.some(i => i.path === 'raritySource.fieldKey' && i.level === 'error')).toBe(true);
  });

  it('field no elegible → error', () => {
    const r = validateRaritySource({ fieldKey: 'nombre', buckets: [{ value: 'x', weight: 100 }] }, [plainField]);
    expect(r.valid).toBe(false);
  });

  it('buckets vacíos → error', () => {
    expect(validateRaritySource({ fieldKey: 'tier', buckets: [] }, [enumField]).valid).toBe(false);
  });

  it('bucket con value Y range → error', () => {
    const r = validateRaritySource({ fieldKey: 'tier', buckets: [{ value: 'rookie', range: [0, 1], weight: 100 }] }, [enumField]);
    expect(r.valid).toBe(false);
  });

  it('range con min > max → error', () => {
    const r = validateRaritySource({ fieldKey: 'valoracion', buckets: [{ range: [5, 0], weight: 100 }] }, [ratingField]);
    expect(r.valid).toBe(false);
  });

  it('weight negativo → error', () => {
    const r = validateRaritySource({ fieldKey: 'tier', buckets: [{ value: 'rookie', weight: -5 }] }, [enumField]);
    expect(r.valid).toBe(false);
  });

  it('value fuera de options → warn (no invalida)', () => {
    const r = validateRaritySource({ fieldKey: 'tier', buckets: [{ value: 'mythic', weight: 100 }] }, [enumField]);
    expect(r.valid).toBe(true);
    expect(r.issues.some(i => i.level === 'warn')).toBe(true);
  });

  it('pesos que no suman 100 → warn (normalizable)', () => {
    const r = validateRaritySource({ fieldKey: 'tier', buckets: [{ value: 'rookie', weight: 30 }, { value: 'pro', weight: 30 }] }, [enumField]);
    expect(r.valid).toBe(true);
    expect(r.issues.some(i => i.message.includes('normaliz'))).toBe(true);
  });
});

describe('rarityBucketForValue', () => {
  const enumBuckets = [{ value: 'rookie', weight: 60 }, { value: 'legend', weight: 3 }];
  const rangeBuckets = [{ range: [0, 1.5] as [number, number], weight: 50 }, { range: [4, 5] as [number, number], weight: 15 }];

  it('match por valor (enum)', () => {
    expect(rarityBucketForValue('legend', enumBuckets)?.weight).toBe(3);
  });
  it('match por rango (rating)', () => {
    expect(rarityBucketForValue(4.5, rangeBuckets)?.weight).toBe(15);
    expect(rarityBucketForValue(1, rangeBuckets)?.weight).toBe(50);
  });
  it('sin match → undefined', () => {
    expect(rarityBucketForValue('mythic', enumBuckets)).toBeUndefined();
    expect(rarityBucketForValue(3, rangeBuckets)).toBeUndefined();
  });
});

describe('normalizeRarityWeights', () => {
  it('escala a sumar 100 preservando proporciones', () => {
    const out = normalizeRarityWeights([{ value: 'a', weight: 30 }, { value: 'b', weight: 30 }]);
    expect(out.map(b => b.weight)).toEqual([50, 50]);
  });
  it('todos 0 → reparto equitativo', () => {
    const out = normalizeRarityWeights([{ value: 'a', weight: 0 }, { value: 'b', weight: 0 }, { value: 'c', weight: 0 }]);
    out.forEach(b => expect(b.weight).toBeCloseTo(100 / 3));
  });
  it('vacío → vacío', () => {
    expect(normalizeRarityWeights([])).toEqual([]);
  });
});
