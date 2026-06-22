import 'package:test/test.dart';
import 'package:kromia_core/kromia_core.dart';

/// KRO-198 — paridad 1:1 con `conditional-style.ts` (@kromia/core): estilo del
/// slot según el valor de un campo del dato.
void main() {
  group('matchConditionalCase', () {
    test('eq (default) case-insensitive + trim', () {
      expect(matchConditionalCase(const ConditionalStyleCase(value: 'Raro'), '  raro '), isTrue);
      expect(matchConditionalCase(const ConditionalStyleCase(value: 'raro'), 'comun'), isFalse);
    });
    test('neq', () {
      expect(matchConditionalCase(const ConditionalStyleCase(op: 'neq', value: 'a'), 'b'), isTrue);
      expect(matchConditionalCase(const ConditionalStyleCase(op: 'neq', value: 'a'), 'A'), isFalse);
    });
    test('contains (value vacio -> false)', () {
      expect(matchConditionalCase(const ConditionalStyleCase(op: 'contains', value: 'oro'), 'Tesoro'), isTrue);
      expect(matchConditionalCase(const ConditionalStyleCase(op: 'contains', value: ''), 'x'), isFalse);
    });
    test('gt/gte/lt/lte numericas (acepta strings; no-num -> false)', () {
      expect(matchConditionalCase(const ConditionalStyleCase(op: 'gt', value: '5'), 6), isTrue);
      expect(matchConditionalCase(const ConditionalStyleCase(op: 'gt', value: '5'), '5'), isFalse);
      expect(matchConditionalCase(const ConditionalStyleCase(op: 'gte', value: '5'), '5'), isTrue);
      expect(matchConditionalCase(const ConditionalStyleCase(op: 'lt', value: '5'), 4), isTrue);
      expect(matchConditionalCase(const ConditionalStyleCase(op: 'lte', value: '5'), 5), isTrue);
      expect(matchConditionalCase(const ConditionalStyleCase(op: 'gt', value: 'x'), 6), isFalse);
    });
    test('truthy / falsy (0, "0", "false", "" -> falsy)', () {
      expect(matchConditionalCase(const ConditionalStyleCase(op: 'truthy'), 1), isTrue);
      expect(matchConditionalCase(const ConditionalStyleCase(op: 'truthy'), 0), isFalse);
      expect(matchConditionalCase(const ConditionalStyleCase(op: 'truthy'), '0'), isFalse);
      expect(matchConditionalCase(const ConditionalStyleCase(op: 'truthy'), 'false'), isFalse);
      expect(matchConditionalCase(const ConditionalStyleCase(op: 'truthy'), ''), isFalse);
      expect(matchConditionalCase(const ConditionalStyleCase(op: 'truthy'), 'x'), isTrue);
      expect(matchConditionalCase(const ConditionalStyleCase(op: 'falsy'), 0), isTrue);
      expect(matchConditionalCase(const ConditionalStyleCase(op: 'falsy'), 'x'), isFalse);
    });
  });

  group('resolveConditionalAppearance', () {
    const base = SlotAppearance(textColor: 'muted', weight: 'regular');

    test('sin cond / sin item -> base intacta', () {
      expect(resolveConditionalAppearance(null, base, {'r': 'raro'}), base);
      const cond = ConditionalStyle(fieldKey: 'r', cases: [
        ConditionalStyleCase(value: 'raro', appearance: SlotAppearance(textColor: 'gold')),
      ]);
      expect(resolveConditionalAppearance(cond, base, null), base);
    });
    test('primer caso que matchea gana + merge sobre base', () {
      const cond = ConditionalStyle(fieldKey: 'rareza', cases: [
        ConditionalStyleCase(value: 'raro', appearance: SlotAppearance(textColor: 'gold')),
        ConditionalStyleCase(value: 'epico', appearance: SlotAppearance(textColor: 'purple')),
      ]);
      final r = resolveConditionalAppearance(cond, base, {'rareza': 'Raro'})!;
      expect(r.textColor, 'gold'); // ganó el caso
      expect(r.weight, 'regular'); // heredado de base (merge)
    });
    test('sin match -> base', () {
      const cond = ConditionalStyle(fieldKey: 'rareza', cases: [
        ConditionalStyleCase(value: 'raro', appearance: SlotAppearance(textColor: 'gold')),
      ]);
      expect(resolveConditionalAppearance(cond, base, {'rareza': 'comun'})!.textColor, 'muted');
    });
    test('caso sin appearance -> base', () {
      const cond = ConditionalStyle(fieldKey: 'r', cases: [ConditionalStyleCase(value: 'x')]);
      expect(resolveConditionalAppearance(cond, base, {'r': 'x'}), base);
    });
  });

  test('SlotComposition.fromJson parsea conditionalStyle', () {
    final sc = SlotComposition.fromJson({
      'fields': ['nombre'],
      'conditionalStyle': {
        'fieldKey': 'stock',
        'cases': [
          {'op': 'lte', 'value': '0', 'appearance': {'textColor': 'red'}},
        ],
      },
    });
    expect(sc.conditionalStyle, isNotNull);
    expect(sc.conditionalStyle!.fieldKey, 'stock');
    expect(sc.conditionalStyle!.cases.first.op, 'lte');
    expect(sc.conditionalStyle!.cases.first.appearance!.textColor, 'red');
  });
}
