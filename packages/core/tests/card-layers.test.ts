import { describe, it, expect } from 'vitest';
import {
  DEPTH_LAYERS_KEY,
  LAYER_DEPTH_ORDER,
  OPTIONS_LAYER_DEPTH,
  depthToParallaxFactor,
  getCardDepthLayers,
  validateCardDepthLayers,
} from '../src/card-layers';
import type { CardDepthLayer } from '../src/types';

describe('KRO-130 — depthToParallaxFactor', () => {
  it('crece de fondo a frente (back < mid < front)', () => {
    expect(depthToParallaxFactor('back')).toBeLessThan(depthToParallaxFactor('mid'));
    expect(depthToParallaxFactor('mid')).toBeLessThan(depthToParallaxFactor('front'));
  });

  it('todos los factores están en 0..1', () => {
    for (const d of LAYER_DEPTH_ORDER) {
      const f = depthToParallaxFactor(d);
      expect(f).toBeGreaterThanOrEqual(0);
      expect(f).toBeLessThanOrEqual(1);
    }
  });

  it('valor fuera de catálogo → 0.5 neutro', () => {
    // @ts-expect-error — probamos robustez ante un depth no válido en runtime
    expect(depthToParallaxFactor('whatever')).toBe(0.5);
  });
});

describe('KRO-130 — OPTIONS_LAYER_DEPTH', () => {
  it('tiene los 3 presets y sus ids casan con LAYER_DEPTH_ORDER', () => {
    expect(OPTIONS_LAYER_DEPTH.map(o => o.id)).toEqual([...LAYER_DEPTH_ORDER]);
    for (const o of OPTIONS_LAYER_DEPTH) expect(o.label).toBeTruthy();
  });
});

describe('KRO-130 — getCardDepthLayers', () => {
  const mk = (depth: string, url = 'x.png'): CardDepthLayer => ({ depth: depth as any, url });

  it('carta sin capas → []', () => {
    expect(getCardDepthLayers(undefined)).toEqual([]);
    expect(getCardDepthLayers({})).toEqual([]);
    expect(getCardDepthLayers({ name: 'C1' })).toEqual([]);
  });

  it('lee del campo reservado y ordena fondo→frente', () => {
    const card = { [DEPTH_LAYERS_KEY]: [mk('front', 'p.png'), mk('back', 'bg.png'), mk('mid', 's.png')] };
    expect(getCardDepthLayers(card).map(l => l.depth)).toEqual(['back', 'mid', 'front']);
  });

  it('descarta entradas malformadas (sin url o depth inválido)', () => {
    const card = {
      [DEPTH_LAYERS_KEY]: [
        mk('back', 'bg.png'),
        { depth: 'mid' },                 // sin url
        { url: 'x.png', depth: 'nope' },  // depth inválido
        null,
      ],
    };
    expect(getCardDepthLayers(card)).toHaveLength(1);
    expect(getCardDepthLayers(card)[0].url).toBe('bg.png');
  });

  it('campo presente pero no-array → []', () => {
    expect(getCardDepthLayers({ [DEPTH_LAYERS_KEY]: 'oops' })).toEqual([]);
  });
});

describe('KRO-130 — validateCardDepthLayers', () => {
  it('lista vacía o ausente → válida', () => {
    expect(validateCardDepthLayers(undefined).valid).toBe(true);
    expect(validateCardDepthLayers([]).valid).toBe(true);
  });

  it('capas correctas (con y sin foil) → válida', () => {
    const layers: CardDepthLayer[] = [
      { url: 'bg.png', depth: 'back' },
      { url: 's.png', depth: 'mid', foil: { kind: 'foil', textureUrl: 'foil.png', blend: 'screen' } },
    ];
    expect(validateCardDepthLayers(layers).valid).toBe(true);
  });

  it('reporta url vacía, depth inválido y foil sin textura', () => {
    const layers = [
      { url: '', depth: 'back' },
      { url: 'x.png', depth: 'wrong' },
      { url: 'y.png', depth: 'front', foil: { kind: 'foil', textureUrl: '', blend: 'screen' } },
    ] as unknown as CardDepthLayer[];
    const r = validateCardDepthLayers(layers);
    expect(r.valid).toBe(false);
    expect(r.issues.map(i => i.index).sort()).toEqual([0, 1, 2]);
  });
});
