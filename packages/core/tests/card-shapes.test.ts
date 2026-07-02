/** KRO-230 — catálogo de siluetas de carta: sanidad del protocolo 0..1. */
import { describe, it, expect } from 'vitest';
import {
  CARD_SHAPES, CARD_SHAPE_IDS, DEFAULT_CARD_SHAPE, cardShapeById, cardShapePath,
} from '../src/card-shapes';

describe('card-shapes (KRO-230)', () => {
  it('ids únicos y el default existe', () => {
    expect(new Set(CARD_SHAPE_IDS).size).toBe(CARD_SHAPES.length);
    expect(CARD_SHAPE_IDS).toContain(DEFAULT_CARD_SHAPE);
  });

  it('standard = sin clip (rect redondeado por cornerRadius)', () => {
    expect(cardShapeById('standard').path).toBeNull();
    expect(cardShapePath(undefined)).toBeNull();
    expect(cardShapePath({ shape: 'standard' })).toBeNull();
    // id desconocido → fallback defensivo a estándar, nunca throw.
    expect(cardShapePath({ shape: 'no-existe' })).toBeNull();
  });

  it('todo path cumple el protocolo: cerrado, coordenadas normalizadas 0..1', () => {
    for (const s of CARD_SHAPES) {
      if (!s.path) continue;
      expect(s.path.trim().startsWith('M'), s.id).toBe(true);
      expect(s.path.trim().endsWith('Z'), s.id).toBe(true);
      // Un solo subpath (sin holes): una única M.
      expect(s.path.match(/M/g)?.length, s.id).toBe(1);
      // Todas las coordenadas dentro de [0, 1].
      const nums = s.path.match(/-?\d*\.?\d+/g)!.map(Number);
      for (const n of nums) {
        expect(n, `${s.id}: ${n}`).toBeGreaterThanOrEqual(0);
        expect(n, `${s.id}: ${n}`).toBeLessThanOrEqual(1);
      }
    }
  });

  it('cada silueta tiene label + tooltip (metadata del editor)', () => {
    for (const s of CARD_SHAPES) {
      expect(s.label, s.id).toBeTruthy();
      expect(s.tooltip, s.id).toBeTruthy();
    }
  });
});
