/** KRO-230 — catálogo de siluetas de carta: sanidad del protocolo 0..1. */
import { describe, it, expect } from 'vitest';
import {
  CARD_SHAPES, CARD_SHAPE_IDS, DEFAULT_CARD_SHAPE, CUSTOM_CARD_SHAPE,
  cardShapeById, cardShapePath, validateShapePath,
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

  it('todo preset cumple la GRAMÁTICA canónica (validateShapePath = null)', () => {
    // La misma regla que un path custom: M/L/C/Q/Z absolutos, 0..1, un subpath.
    for (const s of CARD_SHAPES) {
      if (!s.path) continue;
      expect(validateShapePath(s.path), s.id).toBeNull();
    }
  });

  it('cada silueta tiene label + tooltip (metadata del editor)', () => {
    for (const s of CARD_SHAPES) {
      expect(s.label, s.id).toBeTruthy();
      expect(s.tooltip, s.id).toBeTruthy();
    }
  });

  it('validateShapePath rechaza lo que rompe el protocolo', () => {
    expect(validateShapePath('')).toBeTruthy();
    expect(validateShapePath('M 0 0 L 1 0 Z')).toBeTruthy();                       // < 3 segmentos
    expect(validateShapePath('M 0 0 L 1 0 L 1 1 L 0 1')).toBeTruthy();             // sin Z
    expect(validateShapePath('M 0 0 L 2 0 L 1 1 L 0 1 Z')).toBeTruthy();           // fuera de 0..1
    expect(validateShapePath('M 0 0 A 1 1 0 0 0 1 1 L 0 1 Z')).toBeTruthy();       // comando A prohibido
    expect(validateShapePath('M 0 0 L 1 0 Z M 0 1 L 1 1 Z')).toBeTruthy();         // dos subpaths
    expect(validateShapePath('m 0 0 l 1 0 l 1 1 z')).toBeTruthy();                 // relativos/minúsculas
    expect(validateShapePath('M 0 0 L 1 0 L 1 1 L 0 1 Z')).toBeNull();             // válido
  });

  it("shape 'custom': usa shapePath válido; inválido cae a estándar", () => {
    const good = 'M 0.5 0 L 1 0.5 L 0.5 1 L 0 0.5 Z';
    expect(cardShapePath({ shape: CUSTOM_CARD_SHAPE, shapePath: good })).toBe(good);
    expect(cardShapePath({ shape: CUSTOM_CARD_SHAPE, shapePath: 'M 0 0 basura Z' })).toBeNull();
    expect(cardShapePath({ shape: CUSTOM_CARD_SHAPE })).toBeNull();
  });
});
