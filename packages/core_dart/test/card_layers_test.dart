import 'package:kromia_core/kromia_core.dart';
import 'package:test/test.dart';

/// KRO-130/122 — espejo Dart de `card-layers.ts` (capas de profundidad 3D +
/// parallax + foil). Valores verificados 1:1 contra el source TS.
void main() {
  // Las constantes canónicas (parallax, blend modes, orden, claves) viven en el
  // drift-test cruzado: `card_layers_drift_test.dart`.

  group('getCardDepthLayers', () {
    test('null / sin clave / no-lista → []', () {
      expect(getCardDepthLayers(null), isEmpty);
      expect(getCardDepthLayers({}), isEmpty);
      expect(getCardDepthLayers({depthLayersKey: 'nope'}), isEmpty);
    });

    test('descarta malformadas (sin url / depth inválida) y reordena back→mid→front', () {
      final card = {
        depthLayersKey: [
          {'url': 'f.png', 'depth': 'front'},
          {'depth': 'back'}, // sin url → descartada
          {'url': 'b.png', 'depth': 'back'},
          {'url': 'x.png', 'depth': 'side'}, // depth inválida → descartada
          {'url': 'm.png', 'depth': 'mid'},
        ],
      };
      final layers = getCardDepthLayers(card);
      expect(layers.map((l) => l.depth).toList(), ['back', 'mid', 'front']);
      expect(layers.map((l) => l.url).toList(), ['b.png', 'm.png', 'f.png']);
    });

    test('parsea el foil vinculado a una capa', () {
      final card = {
        depthLayersKey: [
          {
            'url': 's.png',
            'depth': 'mid',
            'foil': {
              'kind': 'foil',
              'textureUrl': 'foil.png',
              'maskUrl': 'mask.png',
              'blend': 'color-dodge',
              'intensity': 0.6,
            },
          },
        ],
      };
      final foil = getCardDepthLayers(card).single.foil!;
      expect(foil.kind, 'foil');
      expect(foil.textureUrl, 'foil.png');
      expect(foil.maskUrl, 'mask.png');
      expect(foil.blend, 'color-dodge');
      expect(foil.intensity, 0.6);
    });
  });

  group('validateCardDepthLayers', () {
    test('null / vacía → válida (es opt-in)', () {
      expect(validateCardDepthLayers(null).valid, isTrue);
      expect(validateCardDepthLayers(const []).valid, isTrue);
    });

    test('url vacía, depth inválida y foil sin textura → issues', () {
      final res = validateCardDepthLayers([
        const CardDepthLayer(url: '', depth: 'back'),
        const CardDepthLayer(url: 'ok.png', depth: 'nope'),
        const CardDepthLayer(
          url: 'ok.png',
          depth: 'mid',
          foil: EffectLayer(kind: 'foil', textureUrl: '', blend: 'overlay'),
        ),
      ]);
      expect(res.valid, isFalse);
      expect(res.issues.length, 3);
      expect(res.issues.map((i) => i.index).toSet(), {0, 1, 2});
    });

    test('capa válida con foil correcto → sin issues', () {
      final res = validateCardDepthLayers([
        const CardDepthLayer(
          url: 's.png',
          depth: 'mid',
          foil: EffectLayer(kind: 'foil', textureUrl: 't.png', blend: 'screen'),
        ),
      ]);
      expect(res.valid, isTrue);
      expect(res.issues, isEmpty);
    });
  });

  group('EffectLayer.fromJson', () {
    test('lee kind/textureUrl/maskUrl/blend/intensity/motion', () {
      final e = EffectLayer.fromJson(const {
        'kind': 'glitter',
        'textureUrl': 't.png',
        'maskUrl': 'm.png',
        'blend': 'soft-light',
        'intensity': 0.4,
        'motion': 0.8,
      });
      expect(e.kind, 'glitter');
      expect(e.textureUrl, 't.png');
      expect(e.maskUrl, 'm.png');
      expect(e.blend, 'soft-light');
      expect(e.intensity, 0.4);
      expect(e.motion, 0.8);
    });
  });
}
