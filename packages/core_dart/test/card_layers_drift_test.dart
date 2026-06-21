import 'package:kromia_core/kromia_core.dart';
import 'package:test/test.dart';

/// KRO-130/122 — **drift-test cruzado de la CAPA B** (modelo de dato foil/3D).
///
/// Las constantes de las capas 3D/foil NO entran al `.json` del KRP (son data,
/// no catálogo), así que `contract-drift.test.ts` —que compara el `.json` con los
/// registries (capa A)— es CIEGO a ellas (ver `holographic-3d-foil-spec.md` §0/§10.5).
/// Para que no vuelvan a derivar TS↔Dart, este test ANCLA los valores canónicos
/// (mismo patrón que `classify_test.dart`: corpus espejado a mano).
///
/// GROUND TRUTH = `@kromia/core`:
///   - `src/card-layers.ts` → DEPTH_LAYERS_KEY, LAYER_DEPTH_ORDER, PARALLAX_FACTOR
///   - `src/types.ts` (579-693) → EffectLayerKind, EffectBlendMode
///
/// Si cambia un valor en el TS, hay que actualizarlo AQUÍ (y al revés). La mitad
/// TS de la paridad la mantiene el chat de Studio (coordinación §10.5: añadir el
/// assert equivalente en el lado TS o un corpus compartido). NO tocar el SDK-TS
/// desde Flutter.
void main() {
  group('capa B — constantes canónicas (TS↔Dart)', () {
    test('clave reservada del dato de la carta', () {
      expect(depthLayersKey, '__depthLayers');
    });

    test('orden de pintado/compositing (back→mid→front)', () {
      expect(layerDepthOrder, const ['back', 'mid', 'front']);
    });

    test('factor de parallax por profundidad — back .15 · mid .45 · front 1.0', () {
      expect(parallaxFactor, const {'back': 0.15, 'mid': 0.45, 'front': 1.0});
      // y el helper, incl. el fallback neutro 0.5 fuera de catálogo.
      expect(depthToParallaxFactor('back'), 0.15);
      expect(depthToParallaxFactor('mid'), 0.45);
      expect(depthToParallaxFactor('front'), 1.0);
      expect(depthToParallaxFactor('desconocida'), 0.5);
    });

    test('tipos de capa de efecto (EffectLayerKind) — foil/glitter/pattern', () {
      expect(effectLayerKinds, const {'foil', 'glitter', 'pattern'});
    });

    test('modos de fusión (EffectBlendMode) — los 5 exactos', () {
      expect(
        effectBlendModes,
        const {'color-dodge', 'overlay', 'screen', 'soft-light', 'hard-light'},
      );
    });
  });
}
