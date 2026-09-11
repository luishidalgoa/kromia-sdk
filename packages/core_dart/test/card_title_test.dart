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

  /// KRO-223 — la CLAVE del campo que titula, para poder OCULTARLA del cuerpo.
  ///
  /// Sin esto la app tendría que deducirla, que sería la TERCERA copia de la
  /// prioridad (TS, aquí, la app). Y `resolveCardTitle` se apoya en ella: un
  /// solo criterio, no dos que puedan separarse — los sabotajes de abajo lo
  /// comprueban en las DOS familias.
  group('resolveCardTitleKey', () {
    const fields = [
      FieldDefLike(key: 'numero', type: 'number'),
      FieldDefLike(key: 'nombre', type: 'text'),
      FieldDefLike(key: 'web', type: 'text', behavior: 'url'),
    ];

    test('la elección del publisher manda', () {
      expect(resolveCardTitleKey(fields, 'numero', 'numero'), 'numero');
    });

    test('sin elección, el primer texto LEGIBLE — no la PK', () {
      // El caso que motivó KRO-222: la PK ganaba y titulaba con el número.
      expect(resolveCardTitleKey(fields, null, 'numero'), 'nombre');
    });

    test('una clave inválida se comporta como no haber elegido', () {
      // No se devuelve: devolverla haría creer al publisher que eligió algo,
      // y el título ya cae al siguiente candidato en silencio.
      expect(resolveCardTitleKey(fields, 'noexiste', 'numero'), 'nombre');
    });

    test('un texto con behavior url NO sirve de título', () {
      const soloUrl = [
        FieldDefLike(key: 'numero', type: 'number'),
        FieldDefLike(key: 'web', type: 'text', behavior: 'url'),
      ];
      expect(resolveCardTitleKey(soloUrl, null, 'numero'), 'numero',
          reason: 'sin texto legible cae a la PK, no a la url');
    });

    test('sin ningún candidato, null', () {
      expect(resolveCardTitleKey(const [FieldDefLike(key: 'x', type: 'number')]),
          isNull);
    });

    test('es ESTRUCTURAL: no mira la carta', () {
      // No recibe datos a propósito. Si dependiera del valor, dos cartas de la
      // misma sección ocultarían campos distintos y el detalle cambiaría de
      // forma según cuál abras.
      expect(resolveCardTitleKey(fields, null, 'numero'),
          resolveCardTitleKey(fields, null, 'numero'));
    });

    test('y es la MISMA elección que usa resolveCardTitle', () {
      // El cierre: si las dos se separan, el detalle oculta una fila y enseña
      // otra en la cabecera. Aquí se comprueba que la clave elegida es la que
      // aporta el valor del título.
      const carta = {'numero': 6, 'nombre': 'Ignis'};
      final clave = resolveCardTitleKey(fields, null, 'numero')!;

      expect(resolveCardTitle(carta, fields, null, 'numero'),
          carta[clave].toString());
    });
  });
}
