import 'package:kromia_core/kromia_core.dart';
import 'package:test/test.dart';

/// KRO-198 — espejo de la resolución del "estilo por valor" (conditional-style.ts):
/// primer caso que coincide → su appearance/target; si ninguno, el `otherwise` (else).
void main() {
  const cond = ConditionalStyle(
    fieldKey: 'elemento',
    cases: [
      ConditionalStyleCase(value: 'Fuego', target: ['tipo'], appearance: SlotAppearance(bgColor: 'red-500')),
      ConditionalStyleCase(value: 'Agua', target: ['tipo'], appearance: SlotAppearance(bgColor: 'blue-500')),
    ],
    otherwise: ConditionalStyleCase(appearance: SlotAppearance(bgColor: 'slate-500')),
  );

  test('primer caso que coincide gana (Fuego → red-500)', () {
    final c = resolveConditionalStyling(cond, {'elemento': 'Fuego'});
    expect(c?.appearance?.bgColor, 'red-500');
    expect(c?.target, ['tipo']);
  });

  test('case-insensitive + trim (fuego)', () {
    expect(resolveConditionalStyling(cond, {'elemento': ' fuego '})?.appearance?.bgColor, 'red-500');
  });

  test('ningún caso → otherwise/else', () {
    expect(resolveConditionalStyling(cond, {'elemento': 'Tierra'})?.appearance?.bgColor, 'slate-500');
  });

  test('sin item → null (no aplica el else sin datos que evaluar)', () {
    expect(resolveConditionalStyling(cond, null), isNull);
  });

  test('matchedConditionalCase NO contempla el else', () {
    expect(matchedConditionalCase(cond, {'elemento': 'Tierra'}), isNull);
  });

  test('resolveConditionalAppearance mergea sobre la base (el caso gana)', () {
    const base = SlotAppearance(bgColor: 'muted', weight: 'bold');
    final eff = resolveConditionalAppearance(cond, base, {'elemento': 'Fuego'});
    expect(eff?.bgColor, 'red-500'); // el caso gana
    expect(eff?.weight, 'bold'); // lo que el caso no toca, se conserva de la base
  });

  test('conditionalStyle se parsea de JSON', () {
    final s = SlotComposition.fromJson({
      'fields': ['tipo'],
      'conditionalStyle': {
        'fieldKey': 'elemento',
        'cases': [
          {'op': 'eq', 'value': 'Fuego', 'target': ['tipo'], 'appearance': {'bgColor': 'red-500'}},
        ],
        'otherwise': {'appearance': {'bgColor': 'slate-500'}},
      },
    });
    expect(s.conditionalStyle?.fieldKey, 'elemento');
    expect(s.conditionalStyle?.cases.first.value, 'Fuego');
    expect(s.conditionalStyle?.cases.first.appearance?.bgColor, 'red-500');
    expect(s.conditionalStyle?.otherwise?.appearance?.bgColor, 'slate-500');
  });
}
