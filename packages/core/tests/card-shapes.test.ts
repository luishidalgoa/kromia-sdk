/** KRO-230 — catálogo de siluetas de carta: sanidad del protocolo 0..1. */
import { describe, it, expect } from 'vitest';
import {
  CARD_SHAPES, CARD_SHAPE_IDS, DEFAULT_CARD_SHAPE, CUSTOM_CARD_SHAPE,
  cardShapeById, cardShapePath, validateShapePath, scaleShapePath, clampShapeScale,
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

  it('NO hay siluetas de ejemplo: el catálogo es solo estándar (deselección)', () => {
    // KRO-230 feedback: la silueta la aporta el creador; nada de presets.
    expect(CARD_SHAPES.map(s => s.id)).toEqual(['standard']);
    expect(CARD_SHAPES[0].path).toBeNull();
    // Cualquier preset viejo persistido cae a estándar (defensivo, sin throw).
    expect(cardShapePath({ shape: 'arch' })).toBeNull();
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

  it('clampShapeScale acota a [0.5, 1] con default 1', () => {
    expect(clampShapeScale(undefined)).toBe(1);
    expect(clampShapeScale(NaN)).toBe(1);
    expect(clampShapeScale(0.1)).toBe(0.5);
    expect(clampShapeScale(2)).toBe(1);
    expect(clampShapeScale(0.7)).toBe(0.7);
  });

  it('scaleShapePath escala sobre el centro (0.5,0.5); 1 = intacto', () => {
    const diamond = 'M 0.5 0 L 1 0.5 L 0.5 1 L 0 0.5 Z';
    expect(scaleShapePath(diamond, 1)).toBe(diamond);
    // a 0.5, cada punto se acerca al centro a la mitad de su distancia.
    expect(scaleShapePath(diamond, 0.5)).toBe('M 0.5 0.25 L 0.75 0.5 L 0.5 0.75 L 0.25 0.5 Z');
    // el resultado sigue siendo un path válido del protocolo.
    expect(validateShapePath(scaleShapePath(diamond, 0.5))).toBeNull();
  });
});
