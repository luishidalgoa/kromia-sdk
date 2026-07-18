import { describe, it, expect } from 'vitest';
import { foilPatternCss, FOIL_PATTERN_IDS, holographicOpacity, EFFECT_FACTORY_PRESETS, parseFoilPatternHex, foilCustomPatternCss, foilEffectiveAngle, foilPatternBaseAngle, foilWarpDisplacement, FOIL_ORGANIC_WARP, FOIL_PATTERN_NONE, FOIL_NEUTRAL_SHEEN, foilNeutralSheenCss, resolveFoilBorderFill, FOIL_BORDER_SOLID, FOIL_CARD_BG, FOIL_MOTIONS, FOIL_MOTION_TIMING, foilMotionFlags, foilMotionSweepSec, foilMotionHueSec, FOIL_MASK_SPARKLES, FOIL_MASK_SPARKLE, FOIL_BORDER_SHEENS, FOIL_BORDER_SHEEN, foilBorderSheenCss, FOIL_BORDER_EDGE, FOIL_GRADIENT_SPEC, parseFoilGradientSpec, isMultibandGradient, foilGradientPositions, foilWeightedGradientCss } from '../src/foil-recipe';
import { getVisualEffect } from '../src/registries/visual-effects';

// Strings EXACTOS que vivían en Studio (VisualEffectLayers `IRID_GRAD`). El builder
// DEBE reproducirlos byte a byte para que mover el dato al SDK no cambie el foil.
const EXPECTED: Record<string, string> = {
  spectrum: 'repeating-linear-gradient(115deg,#ff5fa2 0%,#ffd166 9%,#6efea0 18%,#57d2ff 27%,#b985ff 36%,#ff5fa2 45%)',
  oilslick: 'repeating-linear-gradient(120deg,#3a6df0 0%,#9b5cff 10%,#ff5fa2 20%,#27c4b0 30%,#3a6df0 40%)',
  sunset:   'repeating-linear-gradient(110deg,#ff7e5f 0%,#ffd166 12%,#ff5fa2 24%,#b985ff 36%,#ff7e5f 48%)',
  mint:     'repeating-linear-gradient(115deg,#6efea0 0%,#57d2ff 12%,#b4ddd8 24%,#a0ffe0 36%,#6efea0 48%)',
  aurora:   'conic-gradient(from 0deg,#57d2ff,#6efea0,#ffd166,#ff5fa2,#b985ff,#57d2ff)',
  midnight: 'repeating-linear-gradient(120deg,#3a5fd0 0%,#7a4ad0 11%,#2aa088 22%,#4a6ad0 33%,#3a5fd0 45%)',
};

describe('foil-recipe — foilPatternCss reproduce los strings de Studio', () => {
  it('los 6 patterns coinciden byte a byte con IRID_GRAD', () => {
    for (const [k, v] of Object.entries(EXPECTED)) expect(foilPatternCss(k)).toBe(v);
  });
  it('pattern desconocido cae a spectrum', () => {
    expect(foilPatternCss('nope')).toBe(EXPECTED.spectrum);
  });
  it('FOIL_PATTERN_IDS = las 6 keys', () => {
    expect([...FOIL_PATTERN_IDS].sort()).toEqual(Object.keys(EXPECTED).sort());
  });
  // KRO-244 — orientación: rotate=0 NO cambia el string (retro-compat byte a byte).
  it('foilPatternCss con rotate gira el ángulo (0 = idéntico)', () => {
    expect(foilPatternCss('spectrum', 0)).toBe(EXPECTED.spectrum);
    expect(foilPatternCss('spectrum', 30)).toContain('repeating-linear-gradient(145deg,');
    expect(foilPatternCss('aurora', 90)).toContain('conic-gradient(from 90deg,');
  });

  // KRO-244 — paleta personalizada (pattern_hex).
  it('parseFoilPatternHex valida 2–4 hex separados por coma', () => {
    expect(parseFoilPatternHex('#ff0000,#00ff00')).toEqual(['#ff0000', '#00ff00']);
    expect(parseFoilPatternHex(' #ff0000 , #00ff00 , #0000ff ')).toHaveLength(3);
    expect(parseFoilPatternHex('')).toBeNull();
    expect(parseFoilPatternHex('#ff0000')).toBeNull();            // <2
    expect(parseFoilPatternHex('#a,#b')).toBeNull();              // hex inválidos
    expect(parseFoilPatternHex('#ff0000,#00ff00,#0000ff,#ffffff,#000000')).toBeNull(); // >4
  });
  it('foilCustomPatternCss — ciclo 45% con cierre en el primer color', () => {
    expect(foilCustomPatternCss(['#ff0000', '#00ff00', '#0000ff']))
      .toBe('repeating-linear-gradient(115deg,#ff0000 0%,#00ff00 15%,#0000ff 30%,#ff0000 45%)');
    expect(foilCustomPatternCss(['#ff0000', '#00ff00'], 145)).toContain('(145deg,#ff0000 0%,#00ff00 22.5%,#ff0000 45%)');
  });

  // KRO-244 — orientación: ángulo efectivo = nativo + rotate.
  it('foilPatternBaseAngle / foilEffectiveAngle', () => {
    expect(foilPatternBaseAngle('spectrum')).toBe(115);
    expect(foilPatternBaseAngle('sunset')).toBe(110);
    expect(foilPatternBaseAngle('aurora')).toBe(0);       // conic → fromDeg
    expect(foilPatternBaseAngle('nope')).toBe(115);       // desconocido/custom → 115
    expect(foilEffectiveAngle('spectrum', 30)).toBe(145);
    expect(foilEffectiveAngle('aurora', 90)).toBe(90);
    expect(foilEffectiveAngle('spectrum')).toBe(115);
  });

  // KRO-247 — paleta "Ninguna": id reservado FUERA de FOIL_PATTERNS + barrido neutro.
  it('FOIL_PATTERN_NONE no vive en FOIL_PATTERNS (id reservado del enum)', () => {
    expect(FOIL_PATTERN_NONE).toBe('none');
    expect(FOIL_PATTERN_IDS).not.toContain(FOIL_PATTERN_NONE);
    // el enum `pattern` del contrato SÍ lo incluye (aditivo)
    expect(getVisualEffect('iridescent_foil')?.config.find(p => p.key === 'pattern')?.options)
      .toContain(FOIL_PATTERN_NONE);
  });
  it('foilNeutralSheenCss — barrido blanco diagonal desde FOIL_NEUTRAL_SHEEN', () => {
    expect(foilNeutralSheenCss())
      .toBe('linear-gradient(115deg,rgba(255,255,255,0) 0%,rgba(255,255,255,0.9) 50%,rgba(255,255,255,0) 100%)');
    expect(FOIL_NEUTRAL_SHEEN.angleDeg).toBe(115);
    expect(FOIL_NEUTRAL_SHEEN.stops[0].alpha).toBe(0);    // sin costura en los extremos
    expect(FOIL_NEUTRAL_SHEEN.stops.at(-1)!.alpha).toBe(0);
  });

  // KRO-249 — fill libre del marco: precedencia texture > hex > gradiente > enum.
  it('resolveFoilBorderFill — precedencia y kinds', () => {
    // 1. textura MANDA sobre todo
    expect(resolveFoilBorderFill({ border_texture_url: 'foo/metal.png', border_color_hex: '#ff0000', border_gradient_hex: '#a1a1a1,#e8e8e8', border_color: 'gold' }))
      .toEqual({ kind: 'texture', url: 'foo/metal.png' });
    // 2. hex sólido sobre gradiente/enum (solo si es #RRGGBB válido)
    expect(resolveFoilBorderFill({ border_color_hex: '#ff0000', border_gradient_hex: '#a1a1a1,#e8e8e8', border_color: 'gold' }))
      .toEqual({ kind: 'solid', color: '#ff0000' });
    expect(resolveFoilBorderFill({ border_color_hex: 'nope', border_color: 'gold' }))
      .toEqual({ kind: 'solid', color: FOIL_BORDER_SOLID.gold });
    // 3. degradado custom — KRO-264: gana `stops` (peso 1 por defecto)
    expect(resolveFoilBorderFill({ border_gradient_hex: '#a1a1a1,#e8e8e8', border_color: 'gold' }))
      .toEqual({
        kind: 'custom-gradient',
        colors: ['#a1a1a1', '#e8e8e8'],
        stops: [{ color: '#a1a1a1', weight: 1 }, { color: '#e8e8e8', weight: 1 }],
      });
    // 4. enum: spectrum = sigue al foil; paleta = gradiente fijo; card-bg; sólidos
    expect(resolveFoilBorderFill({ border_color: 'spectrum' })).toEqual({ kind: 'follow-foil' });
    expect(resolveFoilBorderFill({ border_color: 'aurora' })).toEqual({ kind: 'palette', pattern: 'aurora' });
    expect(resolveFoilBorderFill({ border_color: 'midnight' })).toEqual({ kind: 'palette', pattern: 'midnight' });
    expect(resolveFoilBorderFill({ border_color: 'forest' }))
      .toEqual({ kind: 'card-bg', top: FOIL_CARD_BG.forest.top, bottom: FOIL_CARD_BG.forest.bottom });
    expect(resolveFoilBorderFill({ border_color: 'silver' })).toEqual({ kind: 'solid', color: FOIL_BORDER_SOLID.silver });
    // fallback: sin nada / id desconocido = blanco (look base)
    expect(resolveFoilBorderFill({})).toEqual({ kind: 'solid', color: '#ffffff' });
    expect(resolveFoilBorderFill({ border_color: 'bogus' })).toEqual({ kind: 'solid', color: '#ffffff' });
  });
  it('resolveFoilBorderFill — el enum del contrato solo produce kinds conocidos', () => {
    const opts = getVisualEffect('iridescent_foil')?.config.find(p => p.key === 'border_color')?.options ?? [];
    expect(opts.length).toBeGreaterThanOrEqual(13);
    for (const o of opts) {
      const kind = resolveFoilBorderFill({ border_color: o }).kind;
      expect(['solid', 'follow-foil', 'palette', 'card-bg']).toContain(kind);
    }
  });

  // KRO-244 — geometría orgánica: desplazamiento lineal, clampeado.
  it('foilWarpDisplacement escala 0..maxDisplacement, clampeado', () => {
    expect(foilWarpDisplacement(0)).toBe(0);
    expect(foilWarpDisplacement(100)).toBe(FOIL_ORGANIC_WARP.maxDisplacement);
    expect(foilWarpDisplacement(50)).toBe(FOIL_ORGANIC_WARP.maxDisplacement / 2);
    expect(foilWarpDisplacement(-20)).toBe(0);            // clamp inferior
    expect(foilWarpDisplacement(500)).toBe(FOIL_ORGANIC_WARP.maxDisplacement); // clamp superior
  });

  it('holographicOpacity mapea low/medium/high (default medium)', () => {
    expect(holographicOpacity('low')).toBe(0.18);
    expect(holographicOpacity('medium')).toBe(0.32);
    expect(holographicOpacity('high')).toBe(0.48);
    expect(holographicOpacity(undefined)).toBe(0.32);
  });
});

// KRO-256 — vida del iridiscente: movimiento + destellos de máscara + brillo del marco.
describe('KRO-256 — motion / mask_sparkle / border_sheen', () => {
  it('los valores de las recetas == options del contrato (anti-drift)', () => {
    const def = getVisualEffect('iridescent_foil')!;
    expect(def.config.find(p => p.key === 'motion')?.options).toEqual([...FOIL_MOTIONS]);
    expect(def.config.find(p => p.key === 'mask_sparkle')?.options).toEqual([...FOIL_MASK_SPARKLES]);
    expect(def.config.find(p => p.key === 'border_sheen')?.options).toEqual([...FOIL_BORDER_SHEENS]);
  });
  it('foilMotionFlags deriva drift/hueCycle (tolerante a basura)', () => {
    expect(foilMotionFlags('auto')).toEqual({ drift: false, hueCycle: false });
    expect(foilMotionFlags('deriva')).toEqual({ drift: true, hueCycle: false });
    expect(foilMotionFlags('tono')).toEqual({ drift: false, hueCycle: true });
    expect(foilMotionFlags('total')).toEqual({ drift: true, hueCycle: true });
    expect(foilMotionFlags(undefined)).toEqual({ drift: false, hueCycle: false });
    expect(foilMotionFlags('bogus')).toEqual({ drift: false, hueCycle: false });
  });
  it('tiempos del movimiento: shimmer 0/50/100 + clamps + el default del vaivén clásico', () => {
    expect(foilMotionSweepSec(0)).toBe(FOIL_MOTION_TIMING.sweep.baseSec);
    expect(foilMotionSweepSec(100)).toBe(+(FOIL_MOTION_TIMING.sweep.baseSec - FOIL_MOTION_TIMING.sweep.spanSec).toFixed(2));
    // shimmer 50 (default) = 3.75s — MISMO valor que el vaivén de rejilla clásico (5.5 - 0.5*3.5)
    expect(foilMotionSweepSec(50)).toBe(3.75);
    expect(foilMotionHueSec(0)).toBe(14);
    expect(foilMotionHueSec(100)).toBe(4);
    expect(foilMotionSweepSec(-50)).toBe(5.5);   // clamp inferior
    expect(foilMotionHueSec(500)).toBe(4);       // clamp superior
    expect(foilMotionSweepSec(NaN)).toBe(3.75);  // basura → default 50
  });
  it('foilBorderSheenCss reproduce la banda especular de la receta (afilada, QA)', () => {
    expect(foilBorderSheenCss()).toBe(
      'linear-gradient(100deg,rgba(255,255,255,0) 0%,rgba(255,255,255,0) 42%,rgba(255,255,255,1) 50%,rgba(255,255,255,0) 58%,rgba(255,255,255,0) 100%)');
    expect(FOIL_BORDER_SHEEN.sizePct).toBe(250);
  });
  it('FOIL_BORDER_EDGE — canto del marco (contorno oscuro sub-píxel)', () => {
    expect(FOIL_BORDER_EDGE.color).toBe('rgba(24,22,34,0.75)');
    expect(FOIL_BORDER_EDGE.blurPx).toBe(0.6);
  });
  it('FOIL_MASK_SPARKLE: variantes completas para cada opción activa del contrato', () => {
    for (const v of FOIL_MASK_SPARKLES.filter(v => v !== 'no')) {
      expect(FOIL_MASK_SPARKLE.variants[v as keyof typeof FOIL_MASK_SPARKLE.variants]).toBeDefined();
    }
  });
});

// KRO-264 — degradado MULTIBANDA del marco (hasta 16 colores, pesos, ciclo).
describe('KRO-264 — parseFoilGradientSpec / foilWeightedGradientCss', () => {
  it('parsea pesos opcionales (@) y defaultea 1', () => {
    expect(parseFoilGradientSpec('#ff0000,#00ff00@2.5')).toEqual([
      { color: '#ff0000', weight: 1 },
      { color: '#00ff00', weight: 2.5 },
    ]);
  });
  it('acepta hasta 16 colores; rechaza <2, >16, hex o pesos inválidos', () => {
    const dieciseis = Array.from({ length: 16 }, (_, i) => `#0000${(10 + i).toString(16).padStart(2, '0')}`).join(',');
    expect(parseFoilGradientSpec(dieciseis)).toHaveLength(16);
    expect(parseFoilGradientSpec(dieciseis + ',#ffffff')).toBeNull();  // 17
    expect(parseFoilGradientSpec('#ff0000')).toBeNull();               // 1
    expect(parseFoilGradientSpec('#xyz,#00ff00')).toBeNull();
    expect(parseFoilGradientSpec('#ff0000@0,#00ff00')).toBeNull();     // peso < 0.1
    expect(parseFoilGradientSpec('#ff0000@25,#00ff00')).toBeNull();    // peso > 20
  });
  it('isMultibandGradient: >4 colores, pesos ≠1 o ciclo explícito', () => {
    const s4 = parseFoilGradientSpec('#111111,#222222,#333333,#444444')!;
    expect(isMultibandGradient(s4)).toBe(false);                        // clásico
    expect(isMultibandGradient(s4, 30)).toBe(true);
    expect(isMultibandGradient(parseFoilGradientSpec('#111111,#222222@2')!)).toBe(true);
    expect(isMultibandGradient(parseFoilGradientSpec('#111111,#222222,#333333,#444444,#555555')!)).toBe(true);
  });
  it('foilGradientPositions reparte el ciclo por pesos acumulados', () => {
    const stops = parseFoilGradientSpec('#111111@1,#222222@2,#333333@1')!;
    expect(foilGradientPositions(stops, 40)).toEqual([0, 10, 30]);      // 1:2:1 de 40
  });
  it('foilWeightedGradientCss cierra el ciclo con el primer color', () => {
    const stops = parseFoilGradientSpec('#111111,#222222')!;
    expect(foilWeightedGradientCss(stops, 115, 20))
      .toBe('repeating-linear-gradient(115deg,#111111 0%,#222222 10%,#111111 20%)');
  });
  it('el param del contrato refleja los límites de la receta', () => {
    const p = getVisualEffect('iridescent_foil')!.config.find(c => c.key === 'border_gradient_cycle')!;
    expect(p.min).toBe(FOIL_GRADIENT_SPEC.cycle.min);
    expect(p.max).toBe(FOIL_GRADIENT_SPEC.cycle.max);
    expect(p.default).toBe(FOIL_GRADIENT_SPEC.cycle.default);
  });
});

// KRO-244 UX — los presets de fábrica no pueden quedarse obsoletos si cambia
// el catálogo: cada key debe existir en el config del efecto y cada valor caer
// dentro de su espacio (enum options / rango numérico).
describe('EFFECT_FACTORY_PRESETS — configs válidos contra el registry', () => {
  it('cada preset usa keys existentes y valores dentro del espacio del efecto', () => {
    for (const [effectId, presets] of Object.entries(EFFECT_FACTORY_PRESETS)) {
      const def = getVisualEffect(effectId);
      expect(def, `efecto ${effectId}`).toBeDefined();
      expect(presets.length).toBeGreaterThan(0);
      for (const p of presets) {
        for (const [k, v] of Object.entries(p.config)) {
          const param = def!.config.find(c => c.key === k);
          expect(param, `${p.id}.${k} no existe en el config de ${effectId}`).toBeDefined();
          if (param!.type === 'enum') expect(param!.options, `${p.id}.${k}`).toContain(v);
          if (param!.type === 'number') {
            expect(typeof v, `${p.id}.${k}`).toBe('number');
            if (param!.min !== undefined) expect(v as number).toBeGreaterThanOrEqual(param!.min);
            if (param!.max !== undefined) expect(v as number).toBeLessThanOrEqual(param!.max);
          }
        }
      }
    }
  });
});
