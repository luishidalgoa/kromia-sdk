import { describe, it, expect } from 'vitest';
import {
  EFFECT_LAYER_KINDS, EFFECT_BLEND_MODES, isEffectBlendMode, isEffectLayerKind,
  CUSTOM_FOIL_LAYER_DEFAULTS, foilLayerOpacity, foilTextureLayout,
  CUSTOM_FOIL_MASK, EFFECT_BLEND_TO_FLUTTER,
  FOIL_MASK_LAYOUTS, FOIL_MASK_TILE, foilMaskLayout,
  IRIDESCENT_LAYER_KIND, isIridescentLayer,
} from '../src/custom-foil-recipe';
import type { EffectBlendMode } from '../src/types';

describe('custom-foil-recipe — receta DATA del foil personalizado', () => {
  it('los 5 modos de fusión canónicos (== CSS mix-blend-mode), en orden', () => {
    expect(EFFECT_BLEND_MODES).toEqual([
      'color-dodge', 'overlay', 'screen', 'soft-light', 'hard-light',
    ]);
  });

  it('los 3 kinds de capa, en orden del selector', () => {
    expect(EFFECT_LAYER_KINDS).toEqual(['foil', 'glitter', 'pattern']);
  });

  it('type guards de blend y kind', () => {
    expect(isEffectBlendMode('color-dodge')).toBe(true);
    expect(isEffectBlendMode('multiply')).toBe(false);
    expect(isEffectBlendMode(42)).toBe(false);
    expect(isEffectLayerKind('glitter')).toBe(true);
    expect(isEffectLayerKind('bogus')).toBe(false);
  });

  // KRO-250 — capa PROCEDURAL iridiscente: kind válido pero FUERA del selector
  // de texturas (EFFECT_LAYER_KINDS solo lista los 3 kinds con textureUrl).
  it('iridescent es kind válido pero no un kind de textura', () => {
    expect(IRIDESCENT_LAYER_KIND).toBe('iridescent');
    expect(isEffectLayerKind('iridescent')).toBe(true);
    expect(EFFECT_LAYER_KINDS).not.toContain('iridescent');
    expect(isIridescentLayer({ kind: 'iridescent' })).toBe(true);
    expect(isIridescentLayer({ kind: 'foil' })).toBe(false);
  });

  it('defaults de capa nueva == emptyEffectLayer de Studio', () => {
    expect(CUSTOM_FOIL_LAYER_DEFAULTS.kind).toBe('foil');
    expect(CUSTOM_FOIL_LAYER_DEFAULTS.blend).toBe('color-dodge');
    expect(CUSTOM_FOIL_LAYER_DEFAULTS.intensity).toBe(0.6);
  });

  it('opacidad efectiva: intensity con default 0.6 y clamp 0..1', () => {
    expect(foilLayerOpacity({ intensity: 0.4 })).toBe(0.4);
    expect(foilLayerOpacity({})).toBe(0.6);
    expect(foilLayerOpacity({ intensity: -1 })).toBe(0);
    expect(foilLayerOpacity({ intensity: 5 })).toBe(1);
  });

  it('layout de textura: pattern tesela 160%/auto; foil y glitter lámina 250%x100%', () => {
    expect(foilTextureLayout('pattern')).toEqual({ repeat: true, sizeW: 160, sizeH: 'auto' });
    expect(foilTextureLayout('foil')).toEqual({ repeat: false, sizeW: 250, sizeH: 100 });
    expect(foilTextureLayout('glitter')).toEqual({ repeat: false, sizeW: 250, sizeH: 100 });
  });

  it('la máscara se interpreta por LUMINANCIA (no alfa), cover/center', () => {
    expect(CUSTOM_FOIL_MASK.mode).toBe('luminance');
    expect(CUSTOM_FOIL_MASK.fit).toBe('cover');
    expect(CUSTOM_FOIL_MASK.align).toBe('center');
    expect(CUSTOM_FOIL_MASK.repeat).toBe(false);
  });

  // KRO-248 — layouts de máscara (cover | tile).
  it('foilMaskLayout: cover (default/desconocido) == CUSTOM_FOIL_MASK, siempre luminancia', () => {
    expect(FOIL_MASK_LAYOUTS).toEqual(['cover', 'tile']);
    const cover = foilMaskLayout('cover');
    expect(cover).toEqual({ repeat: false, size: 'cover', align: 'center', mode: 'luminance' });
    expect(foilMaskLayout(undefined)).toEqual(cover);   // ausente = retro-compat
    expect(foilMaskLayout('bogus')).toEqual(cover);      // desconocido = fallback seguro
    expect(cover.repeat).toBe(CUSTOM_FOIL_MASK.repeat);
    expect(cover.mode).toBe(CUSTOM_FOIL_MASK.mode);
  });
  it('foilMaskLayout tile: repite, escala clampeada 5–100 (default 25), desde esquina', () => {
    expect(foilMaskLayout('tile')).toEqual({ repeat: true, size: { widthPct: 25 }, align: 'top-left', mode: 'luminance' });
    expect(foilMaskLayout('tile', 40).size).toEqual({ widthPct: 40 });
    expect(foilMaskLayout('tile', 1).size).toEqual({ widthPct: FOIL_MASK_TILE.minScalePct });
    expect(foilMaskLayout('tile', 500).size).toEqual({ widthPct: FOIL_MASK_TILE.maxScalePct });
    // el rango de la receta == el rango del param mask_scale del contrato
    expect(FOIL_MASK_TILE.minScalePct).toBe(5);
    expect(FOIL_MASK_TILE.maxScalePct).toBe(100);
    expect(FOIL_MASK_TILE.defaultScalePct).toBe(25);
  });

  it('mapeo blend → Flutter cubre los 5 modos exactamente', () => {
    const keys = Object.keys(EFFECT_BLEND_TO_FLUTTER).sort();
    expect(keys).toEqual([...EFFECT_BLEND_MODES].sort());
    (EFFECT_BLEND_MODES as readonly EffectBlendMode[]).forEach(b => {
      expect(EFFECT_BLEND_TO_FLUTTER[b]).toMatch(/^BlendMode\.[a-zA-Z]+$/);
    });
  });
});
