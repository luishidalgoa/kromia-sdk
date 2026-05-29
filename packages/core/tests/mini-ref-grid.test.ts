/**
 * Tests de `miniRefGridColumns` — KRO-78.
 *
 * Nº de columnas del grid de mini-cards relacionadas (MiniCardRefs del
 * HeroProtagonicoRecipe) derivado del cardFormat. Vive en core para que
 * `@kromia/react` y el futuro `@kromia/flutter` deriven EXACTAMENTE las
 * mismas columnas — **ground truth cross-language**: un port Dart debe
 * producir la misma matriz para los mismos (aspect, size).
 */

import { describe, it, expect } from 'vitest';
import {
  miniRefGridColumns,
  MINI_REF_GRID_SIZE_MULTIPLIER,
  CARD_ASPECTS,
  CARD_SIZES,
  DEFAULT_CARD_FORMAT,
} from '../src/options';
import type { CardAspect, CardSize } from '../src/options';

describe('miniRefGridColumns — matriz aspect × size', () => {
  // Matriz documentada (clamp 1-6):
  //                mini   standard   large   poster
  //   2:3 / 1:1     4       3          2       1
  //   3:2 / 16:9    3       2          1       1
  const EXPECTED: Record<CardAspect, Record<CardSize, number>> = {
    '2:3':  { mini: 4, standard: 3, large: 2, poster: 1 },
    '1:1':  { mini: 4, standard: 3, large: 2, poster: 1 },
    '3:2':  { mini: 3, standard: 2, large: 1, poster: 1 },
    '16:9': { mini: 3, standard: 2, large: 1, poster: 1 },
  };

  for (const aspect of CARD_ASPECTS) {
    for (const size of CARD_SIZES) {
      it(`${aspect} · ${size} → ${EXPECTED[aspect][size]} columnas`, () => {
        expect(miniRefGridColumns({ aspect, size })).toBe(EXPECTED[aspect][size]);
      });
    }
  }
});

describe('miniRefGridColumns — invariantes', () => {
  it('siempre devuelve un entero entre 1 y 6 (clamp)', () => {
    for (const aspect of CARD_ASPECTS) {
      for (const size of CARD_SIZES) {
        const cols = miniRefGridColumns({ aspect, size });
        expect(Number.isInteger(cols)).toBe(true);
        expect(cols).toBeGreaterThanOrEqual(1);
        expect(cols).toBeLessThanOrEqual(6);
      }
    }
  });

  it('el default (2:3 standard) son 3 columnas', () => {
    expect(miniRefGridColumns(DEFAULT_CARD_FORMAT)).toBe(3);
  });

  it('aspect panorámico/horizontal (ratio > 1.2) da menos columnas que vertical para el mismo size', () => {
    for (const size of CARD_SIZES) {
      const vertical   = miniRefGridColumns({ aspect: '2:3', size });
      const horizontal = miniRefGridColumns({ aspect: '3:2', size });
      expect(horizontal).toBeLessThanOrEqual(vertical);
    }
  });

  it('size más grande nunca da más columnas que uno más pequeño (mismo aspect)', () => {
    const order: CardSize[] = ['mini', 'standard', 'large', 'poster'];
    for (const aspect of CARD_ASPECTS) {
      for (let i = 1; i < order.length; i++) {
        const prev = miniRefGridColumns({ aspect, size: order[i - 1] });
        const curr = miniRefGridColumns({ aspect, size: order[i] });
        expect(curr).toBeLessThanOrEqual(prev);
      }
    }
  });
});

describe('MINI_REF_GRID_SIZE_MULTIPLIER — cobertura del catálogo', () => {
  it('tiene una entrada por cada CardSize (no drift con el catálogo)', () => {
    for (const size of CARD_SIZES) {
      expect(MINI_REF_GRID_SIZE_MULTIPLIER[size]).toBeTypeOf('number');
    }
    expect(Object.keys(MINI_REF_GRID_SIZE_MULTIPLIER).sort()).toEqual([...CARD_SIZES].sort());
  });
});
