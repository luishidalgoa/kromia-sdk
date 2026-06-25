import 'package:test/test.dart';
import 'package:kromia_core/kromia_core.dart';

/// KRO-221 — `SlotComposition.fieldAppearances`: apariencia por-field (key →
/// override) que el render mergea sobre la base del slot.
void main() {
  group('SlotComposition.fieldAppearances', () {
    test('fromJson parsea el map por-field', () {
      final s = SlotComposition.fromJson(const {
        'fields': ['rareza', 'tipo'],
        'fieldAppearances': {
          'rareza': {'bgColor': 'red-500'},
          'tipo': {'textColor': 'blue-500'},
        },
      });
      expect(s.fieldAppearances!['rareza']!.bgColor, 'red-500');
      expect(s.fieldAppearances!['tipo']!.textColor, 'blue-500');
      expect(s.fields, ['rareza', 'tipo']);
    });

    test('sin fieldAppearances → null', () {
      expect(SlotComposition.fromJson(const {'fields': ['x']}).fieldAppearances, isNull);
    });
  });
}
