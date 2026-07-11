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
}
