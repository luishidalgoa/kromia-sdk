/// Corpus de `composeSlotValues` — ESPEJO 1:1 de `tests/compose-slot.test.ts`.
import 'package:test/test.dart';
import 'package:kromia_core/kromia_core.dart';

ComposeSlotInput slot({
  List<ComposeSlotField>? fields,
  String orientation = 'horizontal',
  String separator = ' · ',
  SlotAppearance? appearance,
}) =>
    ComposeSlotInput(
      fields: fields ?? const [],
      orientation: orientation,
      separator: separator,
      appearance: appearance,
    );

ComposeSlotField f(dynamic value, [String? behavior]) => ComposeSlotField(
      def: FieldDefLike(key: 'k', type: 'text', behavior: behavior),
      value: value,
    );

void main() {
  group('composeSlotValues — items + filtering', () {
    test('slot vacío → items vacío', () {
      expect(composeSlotValues(slot()).items, <String>[]);
    });

    test('values vacíos filtrados', () {
      final r = composeSlotValues(
          slot(fields: [f('Madrid'), f(''), f(null), f('2024'), f(null)]));
      expect(r.items, ['Madrid', '2024']);
    });

    test('aplica formatScalar por behavior', () {
      final r = composeSlotValues(
          slot(fields: [f(4, 'rating'), f('2026-05-24', 'iso_date')]));
      expect(r.items[0], '★★★★☆');
      expect(r.items[1], matches(RegExp(r'2026')));
    });
  });

  group('composeSlotValues — orientation / separator echo', () {
    test('horizontal con separator custom → echo', () {
      final r = composeSlotValues(
          slot(fields: [f('a'), f('b')], orientation: 'horizontal', separator: ' / '));
      expect(r.orientation, 'horizontal');
      expect(r.separator, ' / ');
    });

    test('vertical → echo', () {
      final r = composeSlotValues(
          slot(fields: [f('línea 1'), f('línea 2')], orientation: 'vertical'));
      expect(r.orientation, 'vertical');
      expect(r.items, ['línea 1', 'línea 2']);
    });
  });

  group('composeSlotValues — truncate', () {
    test('sin charLimit → null', () {
      expect(composeSlotValues(slot(fields: [f('Madrid'), f('Barcelona')])).truncated,
          isNull);
    });

    test('charLimit=0 → no aplica', () {
      expect(
          composeSlotValues(slot(
                  fields: [f('Madrid')],
                  appearance: const SlotAppearance(truncateChars: 0)))
              .truncated,
          isNull);
    });

    test('texto más corto que charLimit → no aplica', () {
      expect(
          composeSlotValues(slot(
                  fields: [f('AB')],
                  appearance: const SlotAppearance(truncateChars: 20)))
              .truncated,
          isNull);
    });

    test('texto que excede → truncated con …', () {
      final r = composeSlotValues(slot(
          fields: [f('Una frase razonablemente larga que excede')],
          appearance: const SlotAppearance(truncateChars: 10)));
      expect(r.truncated, 'Una frase…');
    });

    test('charLimit al string joined completo', () {
      final r = composeSlotValues(slot(
          fields: [f('aa'), f('bb'), f('cc')],
          separator: ' · ',
          appearance: const SlotAppearance(truncateChars: 6)));
      expect(r.truncated, isNotNull);
      expect(r.truncated!.endsWith('…'), isTrue);
      expect(r.truncated!.length, lessThanOrEqualTo(7));
    });

    test('vertical usa joiner espacio', () {
      final r = composeSlotValues(slot(
          fields: [f('línea1'), f('línea2')],
          orientation: 'vertical',
          separator: ' · ',
          appearance: const SlotAppearance(truncateChars: 8)));
      expect(r.truncated, isNotNull);
      expect(r.truncated!.endsWith('…'), isTrue);
    });
  });

  group('composeSlotValues — sin def', () {
    test('field sin def usa fallback string', () {
      final r = composeSlotValues(slot(fields: [const ComposeSlotField(value: 'plain')]));
      expect(r.items, ['plain']);
    });
  });
}
