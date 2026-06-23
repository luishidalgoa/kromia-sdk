import 'package:test/test.dart';
import 'package:kromia_core/kromia_core.dart';

/// KRO-198 — espejo del `conditional-style.ts` canónico: "Estilo por valor" v2
/// (target por chip + el caso gana) + cláusula `otherwise` (else). Puro.
void main() {
  const apCase = SlotAppearance(bgColor: 'red-500');
  const apElse = SlotAppearance(bgColor: 'slate-200');
  const base = SlotAppearance(textColor: 'foreground');

  ConditionalStyle cond({ConditionalStyleCase? otherwise, List<ConditionalStyleCase>? cases}) =>
      ConditionalStyle(
        fieldKey: 'rareza',
        cases: cases ?? const [ConditionalStyleCase(op: 'eq', value: 'Épica', appearance: apCase)],
        otherwise: otherwise,
      );

  group('matchConditionalCase', () {
    test('eq (default) case-insensitive + trim', () {
      expect(matchConditionalCase(const ConditionalStyleCase(value: 'épica'), '  Épica '), isTrue);
      expect(matchConditionalCase(const ConditionalStyleCase(value: 'común'), 'Épica'), isFalse);
    });
    test('neq', () {
      expect(matchConditionalCase(const ConditionalStyleCase(op: 'neq', value: 'común'), 'Épica'), isTrue);
    });
    test('contains', () {
      expect(matchConditionalCase(const ConditionalStyleCase(op: 'contains', value: 'pic'), 'Épica'), isTrue);
      expect(matchConditionalCase(const ConditionalStyleCase(op: 'contains', value: ''), 'Épica'), isFalse);
    });
    test('gt/gte/lt/lte numéricos (acepta strings numéricos)', () {
      expect(matchConditionalCase(const ConditionalStyleCase(op: 'gt', value: '10'), 12), isTrue);
      expect(matchConditionalCase(const ConditionalStyleCase(op: 'gt', value: '10'), '12'), isTrue);
      expect(matchConditionalCase(const ConditionalStyleCase(op: 'gte', value: '12'), 12), isTrue);
      expect(matchConditionalCase(const ConditionalStyleCase(op: 'lt', value: '10'), 12), isFalse);
      expect(matchConditionalCase(const ConditionalStyleCase(op: 'lte', value: '12'), 13), isFalse);
      expect(matchConditionalCase(const ConditionalStyleCase(op: 'gt', value: 'x'), 12), isFalse);
    });
    test('truthy / falsy (ignoran value; "0"/"false" cuentan como falsy)', () {
      expect(matchConditionalCase(const ConditionalStyleCase(op: 'truthy'), 'sí'), isTrue);
      expect(matchConditionalCase(const ConditionalStyleCase(op: 'truthy'), ''), isFalse);
      expect(matchConditionalCase(const ConditionalStyleCase(op: 'truthy'), '0'), isFalse);
      expect(matchConditionalCase(const ConditionalStyleCase(op: 'truthy'), 'false'), isFalse);
      expect(matchConditionalCase(const ConditionalStyleCase(op: 'truthy'), 0), isFalse);
      expect(matchConditionalCase(const ConditionalStyleCase(op: 'falsy'), ''), isTrue);
      expect(matchConditionalCase(const ConditionalStyleCase(op: 'falsy'), '0'), isTrue);
      expect(matchConditionalCase(const ConditionalStyleCase(op: 'falsy'), 'sí'), isFalse);
    });
  });

  group('matchedConditionalCase (solo cases, NO else)', () {
    test('primer caso que matchea gana', () {
      final c = ConditionalStyle(fieldKey: 'rareza', cases: const [
        ConditionalStyleCase(value: 'Épica', appearance: apCase),
        ConditionalStyleCase(value: 'Épica', appearance: apElse),
      ]);
      expect(identical(matchedConditionalCase(c, const {'rareza': 'Épica'})!.appearance, apCase), isTrue);
    });
    test('sin match → null (NO cae al else)', () {
      expect(matchedConditionalCase(cond(otherwise: const ConditionalStyleCase(appearance: apElse)),
          const {'rareza': 'Común'}), isNull);
    });
    test('sin item / sin cond → null', () {
      expect(matchedConditionalCase(cond(), null), isNull);
      expect(matchedConditionalCase(null, const {'rareza': 'Épica'}), isNull);
    });
  });

  group('resolveConditionalStyling (CON else, gated)', () {
    test('caso coincide → ese caso', () {
      final eff = resolveConditionalStyling(cond(), const {'rareza': 'Épica'});
      expect(identical(eff!.appearance, apCase), isTrue);
    });
    test('sin match + hay else → el else', () {
      final eff = resolveConditionalStyling(
          cond(otherwise: const ConditionalStyleCase(appearance: apElse)), const {'rareza': 'Común'});
      expect(identical(eff!.appearance, apElse), isTrue);
    });
    test('sin match + sin else → null', () {
      expect(resolveConditionalStyling(cond(), const {'rareza': 'Común'}), isNull);
    });
    test('sin item / sin cond / sin cases → null (else NO se filtra sin datos)', () {
      expect(resolveConditionalStyling(cond(otherwise: const ConditionalStyleCase(appearance: apElse)), null), isNull);
      expect(resolveConditionalStyling(null, const {'rareza': 'Épica'}), isNull);
      expect(
          resolveConditionalStyling(
              const ConditionalStyle(fieldKey: 'rareza', cases: [], otherwise: ConditionalStyleCase(appearance: apElse)),
              const {'rareza': 'Épica'}),
          isNull);
    });
  });

  group('resolveConditionalAppearance (merge sobre la base)', () {
    test('caso coincide → merge appearance del caso sobre la base', () {
      final r = resolveConditionalAppearance(cond(), base, const {'rareza': 'Épica'});
      expect(r!.bgColor, 'red-500'); // del caso
      expect(r.textColor, 'foreground'); // de la base (preservado)
    });
    test('sin match + else → merge del else', () {
      final r = resolveConditionalAppearance(
          cond(otherwise: const ConditionalStyleCase(appearance: apElse)), base, const {'rareza': 'Común'});
      expect(r!.bgColor, 'slate-200');
      expect(r.textColor, 'foreground');
    });
    test('sin match + sin else → base intacta', () {
      final r = resolveConditionalAppearance(cond(), base, const {'rareza': 'Común'});
      expect(identical(r, base), isTrue);
    });
  });

  group('ConditionalStyle.fromJson', () {
    test('parsea cases + otherwise + target', () {
      final cs = ConditionalStyle.fromJson(const {
        'fieldKey': 'rareza',
        'cases': [
          {'op': 'eq', 'value': 'Épica', 'appearance': {'bgColor': 'red-500'}, 'target': ['rareza']},
        ],
        'otherwise': {'appearance': {'bgColor': 'slate-200'}},
      });
      expect(cs.fieldKey, 'rareza');
      expect(cs.cases.single.value, 'Épica');
      expect(cs.cases.single.target, ['rareza']);
      expect(cs.cases.single.appearance!.bgColor, 'red-500');
      expect(cs.otherwise!.appearance!.bgColor, 'slate-200');
    });
  });
}
