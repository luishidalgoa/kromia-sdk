import 'package:kromia_core/kromia_core.dart';
import 'package:test/test.dart';

/// KRO-228 — espejo Dart de `card-back.ts`: tipos del reverso + `resolveCardBack`
/// + el matcher condicional `matchConditionalCase` (de `conditional-style.ts`).
void main() {
  group('matchConditionalCase (KRO-198)', () {
    test('eq por defecto: case-insensitive + trim', () {
      expect(matchConditionalCase(value: 'Rara', raw: ' rara '), isTrue);
      expect(matchConditionalCase(op: 'eq', value: 'Rara', raw: 'común'), isFalse);
    });
    test('neq', () {
      expect(matchConditionalCase(op: 'neq', value: 'Rara', raw: 'Común'), isTrue);
      expect(matchConditionalCase(op: 'neq', value: 'Rara', raw: 'rara'), isFalse);
    });
    test('contains (value vacío → false)', () {
      expect(matchConditionalCase(op: 'contains', value: 'fue', raw: 'Fuego'), isTrue);
      expect(matchConditionalCase(op: 'contains', value: '', raw: 'x'), isFalse);
    });
    test('gt/gte/lt/lte numéricas (acepta strings); no numérico → false', () {
      expect(matchConditionalCase(op: 'gt', value: '5', raw: '10'), isTrue);
      expect(matchConditionalCase(op: 'gte', value: '5', raw: 5), isTrue);
      expect(matchConditionalCase(op: 'lt', value: '5', raw: 3), isTrue);
      expect(matchConditionalCase(op: 'lte', value: '5', raw: '6'), isFalse);
      expect(matchConditionalCase(op: 'gt', value: 'x', raw: '10'), isFalse);
    });
    test('truthy/falsy (ignoran value; "0"/"false"/0/"" son falsy)', () {
      expect(matchConditionalCase(op: 'truthy', raw: 'sí'), isTrue);
      expect(matchConditionalCase(op: 'truthy', raw: '0'), isFalse);
      expect(matchConditionalCase(op: 'truthy', raw: 0), isFalse);
      expect(matchConditionalCase(op: 'truthy', raw: ''), isFalse);
      expect(matchConditionalCase(op: 'falsy', raw: 'false'), isTrue);
      expect(matchConditionalCase(op: 'falsy', raw: 'algo'), isFalse);
    });
  });

  group('resolveCardBack (KRO-228)', () {
    const base = CardBackDesign(image: 'base.png', qr: QrPlacement(x: 50, y: 80, size: 20));

    test('sin comp → null', () {
      expect(resolveCardBack(null, const {}), isNull);
    });
    test('sin condicional → base', () {
      final r = resolveCardBack(const CardBackComposition(base: base), const {'rareza': 'rara'});
      expect(r?.image, 'base.png');
    });
    test('eq: 1º caso que matchea PISA la base (merge superficial conserva el qr)', () {
      const comp = CardBackComposition(
        base: base,
        conditional: ConditionalCardBack(fieldKey: 'rareza', cases: [
          ConditionalCardBackCase(op: 'eq', value: 'épica', design: CardBackDesign(image: 'epic.png')),
        ]),
      );
      final r = resolveCardBack(comp, const {'rareza': 'Épica'});
      expect(r?.image, 'epic.png');
      expect(r?.qr?.x, 50, reason: 'el qr de la base se conserva (design solo cambió image)');
    });
    test('ningún caso → otherwise (else)', () {
      const comp = CardBackComposition(
        base: base,
        conditional: ConditionalCardBack(
          fieldKey: 'rareza',
          cases: [ConditionalCardBackCase(value: 'épica', design: CardBackDesign(image: 'epic.png'))],
          otherwise: CardBackDesign(image: 'else.png'),
        ),
      );
      expect(resolveCardBack(comp, const {'rareza': 'común'})?.image, 'else.png');
    });
    test('__section__ filtra por la sección de la carta', () {
      const comp = CardBackComposition(
        base: base,
        conditional: ConditionalCardBack(fieldKey: cardBackSectionKey, cases: [
          ConditionalCardBackCase(value: 'fuego', design: CardBackDesign(image: 'fire.png')),
        ]),
      );
      expect(resolveCardBack(comp, const {}, section: 'Fuego')?.image, 'fire.png');
      // sin match → base (no otherwise).
      expect(resolveCardBack(comp, const {}, section: 'Agua')?.image, 'base.png');
    });
    test('fromJson parsea composición + qr + casos y resuelve', () {
      final comp = CardBackComposition.fromJson(const {
        'base': {'image': 'b.png', 'qr': {'x': 50, 'y': 90, 'size': 18}},
        'conditional': {
          'fieldKey': 'rareza',
          'cases': [
            {'op': 'eq', 'value': 'rara', 'design': {'image': 'r.png'}},
          ],
          'otherwise': {'image': 'o.png'},
        },
      });
      expect(comp.base?.qr?.size, 18);
      expect(comp.conditional?.cases.first.value, 'rara');
      final r = resolveCardBack(comp, const {'rareza': 'rara'});
      expect(r?.image, 'r.png');
      expect(r?.qr?.y, 90, reason: 'qr de la base conservado en el merge');
    });
  });
}
