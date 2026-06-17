/// Corpus de `miniRefGridColumns` — ESPEJO de `tests/mini-ref-grid.test.ts` (KRO-78).
import 'package:kromia_core/kromia_core.dart';
import 'package:test/test.dart';

void main() {
  const expected = <String, Map<String, int>>{
    '2:3': {'mini': 4, 'standard': 3, 'large': 2, 'poster': 1},
    '1:1': {'mini': 4, 'standard': 3, 'large': 2, 'poster': 1},
    '3:2': {'mini': 3, 'standard': 2, 'large': 1, 'poster': 1},
    '16:9': {'mini': 3, 'standard': 2, 'large': 1, 'poster': 1},
  };

  group('miniRefGridColumns — matriz aspect × size', () {
    for (final aspect in cardAspects) {
      for (final size in cardSizes) {
        test('$aspect · $size → ${expected[aspect]![size]} columnas', () {
          expect(miniRefGridColumns(CardFormat(aspect: aspect, size: size)), expected[aspect]![size]);
        });
      }
    }
  });

  group('invariantes', () {
    test('siempre entero entre 1 y 6', () {
      for (final a in cardAspects) {
        for (final s in cardSizes) {
          final cols = miniRefGridColumns(CardFormat(aspect: a, size: s));
          expect(cols, greaterThanOrEqualTo(1));
          expect(cols, lessThanOrEqualTo(6));
        }
      }
    });

    test('default (2:3 standard) = 3 columnas', () {
      expect(miniRefGridColumns(defaultCardFormat), 3);
    });

    test('panorámico (ratio>1.2) ≤ vertical para el mismo size', () {
      for (final size in cardSizes) {
        final vertical = miniRefGridColumns(CardFormat(aspect: '2:3', size: size));
        final horizontal = miniRefGridColumns(CardFormat(aspect: '3:2', size: size));
        expect(horizontal, lessThanOrEqualTo(vertical));
      }
    });

    test('size más grande nunca da más columnas (mismo aspect)', () {
      const order = ['mini', 'standard', 'large', 'poster'];
      for (final aspect in cardAspects) {
        for (var i = 1; i < order.length; i++) {
          final prev = miniRefGridColumns(CardFormat(aspect: aspect, size: order[i - 1]));
          final curr = miniRefGridColumns(CardFormat(aspect: aspect, size: order[i]));
          expect(curr, lessThanOrEqualTo(prev));
        }
      }
    });

    test('MINI_REF_GRID_SIZE_MULTIPLIER cubre cada CardSize', () {
      expect(miniRefGridSizeMultiplier.keys.toList()..sort(), [...cardSizes]..sort());
    });
  });
}
