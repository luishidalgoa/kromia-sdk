import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kromia_core/kromia_core.dart';
import 'package:kromia_flutter/kromia_flutter.dart';
import 'package:kromia_flutter/src/utils/appearance_styles.dart';

/// KRO-221 — infraestructura de apariencia por-field: resolveSlot expone `key` +
/// `fieldAppearances`; `mergeFieldAppearance` (override por-field gana sobre base);
/// `applyAppearanceTruncate` (recorte por caracteres).
void main() {
  group('resolveSlot expone key + fieldAppearances', () {
    test('cada field lleva su key + el slot expone fieldAppearances', () {
      final ctx = RenderCtx(
        composition: const ViewComposition(recipe: 'editorial', action: 'none', slots: {
          'badges': SlotComposition(
            fields: ['rareza', 'tipo'],
            appearance: SlotAppearance(textColor: 'foreground'),
            fieldAppearances: {'rareza': SlotAppearance(bgColor: 'red-500')},
          ),
        }),
        item: const {'rareza': 'Épica', 'tipo': 'Fuego'},
        fieldDefs: const [FieldDefLike(key: 'rareza', type: 'text'), FieldDefLike(key: 'tipo', type: 'text')],
      );
      final r = resolveSlot(ctx, 'badges')!;
      expect(r.fields.map((f) => f.key).toList(), ['rareza', 'tipo']);
      expect(r.fieldAppearances!['rareza']!.bgColor, 'red-500');
    });

    test('sin fieldAppearances → null (camino base intacto)', () {
      final ctx = RenderCtx(
        composition: const ViewComposition(recipe: 'editorial', action: 'none', slots: {
          'badges': SlotComposition(fields: ['rareza']),
        }),
        item: const {'rareza': 'Épica'},
        fieldDefs: const [FieldDefLike(key: 'rareza', type: 'text')],
      );
      expect(resolveSlot(ctx, 'badges')!.fieldAppearances, isNull);
    });
  });

  group('mergeFieldAppearance', () {
    const base = SlotAppearance(textColor: 'foreground', bgColor: 'muted');
    test('override por-field GANA sobre la base (merge shallow)', () {
      final m = mergeFieldAppearance(base, const {'rareza': SlotAppearance(bgColor: 'red-500')}, 'rareza');
      expect(m!.bgColor, 'red-500'); // override gana
      expect(m.textColor, 'foreground'); // base preservada
    });
    test('field sin entrada → base intacta (misma instancia)', () {
      expect(identical(mergeFieldAppearance(base, const {'rareza': SlotAppearance(bgColor: 'red-500')}, 'tipo'), base), isTrue);
    });
    test('sin key / sin map → base', () {
      expect(identical(mergeFieldAppearance(base, null, 'rareza'), base), isTrue);
      expect(identical(mergeFieldAppearance(base, const {}, null), base), isTrue);
    });
  });

  group('applyAppearanceTruncate', () {
    test('recorta a truncateChars + …', () {
      expect(applyAppearanceTruncate('Épica legendaria', const SlotAppearance(truncateChars: 5)), 'Épica…');
    });
    test('texto más corto / sin truncateChars → intacto', () {
      expect(applyAppearanceTruncate('Épi', const SlotAppearance(truncateChars: 5)), 'Épi');
      expect(applyAppearanceTruncate('hola', const SlotAppearance()), 'hola');
    });
  });
}
