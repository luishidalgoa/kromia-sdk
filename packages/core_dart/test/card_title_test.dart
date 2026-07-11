import 'package:test/test.dart';
import 'package:kromia_core/kromia_core.dart';

/// KRO-222/223 — espejo de `tests/card-title.test.ts`. `resolveCardTitle` con la
/// misma prioridad (cardTitleKey → texto legible → primaryKey → 'Carta') en ambos hosts.
void main() {
  const fields = [
    FieldDefLike(key: 'numero', type: 'number', behavior: 'incremental'),
    FieldDefLike(key: 'nombre', type: 'text'),
    FieldDefLike(key: 'web', type: 'text', behavior: 'url'),
  ];

  group('resolveCardTitle — título visible de carta', () {
    test('1) cardTitleKey explícito manda', () {
      expect(resolveCardTitle({'numero': 6, 'nombre': 'Ignis'}, fields, 'nombre', 'numero'), 'Ignis');
    });

    test('2) sin cardTitleKey → primer texto legible (no la PK)', () {
      expect(resolveCardTitle({'numero': 6, 'nombre': 'Ignis'}, fields, null, 'numero'), 'Ignis');
    });

    test('el texto legible ignora url/email/phone', () {
      const only = [
        FieldDefLike(key: 'web', type: 'text', behavior: 'url'),
        FieldDefLike(key: 'n', type: 'number'),
      ];
      expect(resolveCardTitle({'web': 'x', 'n': 3}, only), 'Carta');
    });

    test('3) fallback a la primary key si no hay texto legible', () {
      const nums = [FieldDefLike(key: 'numero', type: 'number')];
      expect(resolveCardTitle({'numero': 6}, nums, null, 'numero'), '6');
    });

    test('4) fallback final "Carta" si el campo elegido no tiene valor', () {
      expect(resolveCardTitle({'numero': 6}, fields, 'nombre', 'numero'), 'Carta');
    });

    test('cardTitleKey inexistente → cae a texto legible', () {
      expect(resolveCardTitle({'numero': 6, 'nombre': 'Ignis'}, fields, 'noexiste', 'numero'), 'Ignis');
    });

    test('lee claves dot-notation anidadas', () {
      const f = [FieldDefLike(key: 'meta.title', type: 'text')];
      expect(resolveCardTitle({'meta': {'title': 'Anidado'}}, f, 'meta.title'), 'Anidado');
    });
  });
}
