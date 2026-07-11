import 'package:kromia_core/kromia_core.dart';
import 'package:test/test.dart';

/// KRO-245 — espejo 1:1 de `custom-foil-recipe.ts` (59688aa). Corpus de paridad.
void main() {
  test('kinds/blends (card_layers) + defaults', () {
    expect(effectLayerKinds, ['foil', 'glitter', 'pattern']);
    expect(effectBlendModes,
        ['color-dodge', 'overlay', 'screen', 'soft-light', 'hard-light']);
    expect(customFoilLayerDefaults,
        (kind: 'foil', blend: 'color-dodge', intensity: 0.6));
  });
  test('foilLayerOpacity: default 0.6 + clamp 0..1', () {
    expect(foilLayerOpacity(null), 0.6);
    expect(foilLayerOpacity(0.3), 0.3);
    expect(foilLayerOpacity(1.5), 1.0);
    expect(foilLayerOpacity(-1), 0.0);
  });
  test('foilTextureLayout por kind', () {
    expect(foilTextureLayout('pattern'), (repeat: true, sizeW: 160.0, sizeH: null));
    expect(foilTextureLayout('foil'), (repeat: false, sizeW: 250.0, sizeH: 100.0));
    expect(foilTextureLayout('glitter'), (repeat: false, sizeW: 250.0, sizeH: 100.0));
  });
  test('máscara por LUMINANCIA cover/center + tilt/shimmer canónicos', () {
    expect(customFoilMask,
        (mode: 'luminance', fit: 'cover', align: 'center', repeat: false));
    expect(customFoilTilt, (defaultPoint: 0.5, followMs: 140));
    expect(customFoilShimmer,
        (durationBaseS: 3.4, durationStepS: 0.5, delayStepS: 0.3));
    expect(customFoilLayerOrder, 'array-order');
  });

  // KRO-248 — layouts de máscara (cover | tile), espejo de foilMaskLayout.
  test('foilMaskLayout: cover (default/desconocido) == customFoilMask, luminancia', () {
    expect(foilMaskLayouts, ['cover', 'tile']);
    final cover = foilMaskLayout('cover');
    expect(cover,
        (repeat: false, tileWidthPct: null, align: 'center', mode: 'luminance'));
    expect(foilMaskLayout(null), cover, reason: 'ausente = retro-compat');
    expect(foilMaskLayout('bogus'), cover, reason: 'desconocido = fallback seguro');
  });
  test('foilMaskLayout tile: repite, escala clampeada 5–100 (default 25), esquina', () {
    expect(foilMaskLayout('tile'),
        (repeat: true, tileWidthPct: 25.0, align: 'top-left', mode: 'luminance'));
    expect(foilMaskLayout('tile', 40).tileWidthPct, 40.0);
    expect(foilMaskLayout('tile', 1).tileWidthPct, foilMaskTile.minScalePct);
    expect(foilMaskLayout('tile', 500).tileWidthPct, foilMaskTile.maxScalePct);
    expect(foilMaskTile,
        (defaultScalePct: 25.0, minScalePct: 5.0, maxScalePct: 100.0));
  });

  // KRO-250 — capa PROCEDURAL iridiscente (pila unificada).
  test('iridescent: kind válido pero FUERA del selector de texturas', () {
    expect(iridescentLayerKind, 'iridescent');
    expect(isIridescentLayer('iridescent'), isTrue);
    expect(isIridescentLayer('foil'), isFalse);
    expect(effectLayerKinds.contains('iridescent'), isFalse);
    expect(isEffectLayerKind('iridescent'), isTrue);
    expect(isEffectLayerKind('glitter'), isTrue);
    expect(isEffectLayerKind('bogus'), isFalse);
  });
  test('EffectLayer: config + maskLayout/maskScale + textureUrl opcional (fromJson)', () {
    final l = EffectLayer.fromJson({
      'kind': 'iridescent',
      'blend': 'color-dodge',
      'config': {'pattern': 'none', 'mask_layout': 'tile', 'mask_scale': 18},
    });
    expect(l.kind, 'iridescent');
    expect(l.textureUrl, '', reason: "procedural: sin textura ('' = ausente)");
    expect(l.config!['pattern'], 'none');
    final t = EffectLayer.fromJson({
      'kind': 'pattern',
      'textureUrl': 'x/dots.png',
      'blend': 'screen',
      'maskUrl': 'x/mask.png',
      'maskLayout': 'tile',
      'maskScale': 40,
    });
    expect(t.maskLayout, 'tile');
    expect(t.maskScale, 40.0);
    expect(t.config, isNull);
  });
}
