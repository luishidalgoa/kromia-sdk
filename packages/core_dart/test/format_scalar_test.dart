/// Corpus de `formatScalar` — ESPEJO 1:1 de `packages/core/tests/format-scalar.test.ts`.
///
/// Ground truth cross-language: mismos `(value, behavior)` → mismos outputs que
/// el TS. Paridad por construcción.
import 'package:test/test.dart';
import 'package:kromia_core/kromia_core.dart';

FieldDefLike def([String? behavior]) =>
    FieldDefLike(key: 'x', type: 'text', behavior: behavior);

void main() {
  group('formatScalar — empty values', () {
    test('null → ""', () => expect(formatScalar(null), ''));
    test('"" → ""', () => expect(formatScalar(''), ''));
    test('whitespace → ""', () => expect(formatScalar('   '), ''));
    test('[] → ""', () => expect(formatScalar(<dynamic>[]), ''));
  });

  group('formatScalar — behavior=year', () {
    test('número → string sin separadores', () {
      expect(formatScalar(2026, def('year')), '2026');
    });
    test('número grande → sin separadores', () {
      expect(formatScalar(20260, def('year')), '20260');
    });
    test('value string → fallback string', () {
      expect(formatScalar('2026', def('year')), '2026');
    });
  });

  group('formatScalar — behavior=iso_date', () {
    test('fecha ISO válida → contiene 24 y 2026', () {
      final out = formatScalar('2026-05-24', def('iso_date'));
      expect(out, matches(RegExp(r'\b24\b')));
      expect(out, matches(RegExp(r'\b2026\b')));
    });
    test('fecha inválida → no lanza', () {
      expect(() => formatScalar('not-a-date', def('iso_date')), returnsNormally);
    });
  });

  group('formatScalar — behavior=currency', () {
    test('19.99 → "19,99 €"', () {
      expect(formatScalar(19.99, def('currency')), '19,99 €');
    });
    test('0 → "0,00 €"', () {
      expect(formatScalar(0, def('currency')), '0,00 €');
    });
    // es-ES (ICU, `minimumGroupingDigits: 2`) NO agrupa los números de 4 cifras:
    // el punto de miles aparece desde 5. Medido contra el TS (Node 24, ICU 78.2).
    // Antes esto era una regex que aceptaba las dos formas y tapaba la diferencia.
    test('1234.5 → "1234,50 €" (4 cifras: sin punto de miles)', () {
      expect(formatScalar(1234.5, def('currency')), '1234,50 €');
    });
    test('1000 → "1000,00 €"', () => expect(formatScalar(1000, def('currency')), '1000,00 €'));
    test('12345.5 → "12.345,50 €" (5 cifras: con punto)', () {
      expect(formatScalar(12345.5, def('currency')), '12.345,50 €');
    });
    test('1234567.891 → "1.234.567,89 €"', () {
      expect(formatScalar(1234567.891, def('currency')), '1.234.567,89 €');
    });
    test('9999.999 → "10.000,00 €" (se agrupa DESPUÉS de redondear)', () {
      expect(formatScalar(9999.999, def('currency')), '10.000,00 €');
    });
    test('9999.99 → "9999,99 €"', () => expect(formatScalar(9999.99, def('currency')), '9999,99 €'));
    // KRO-198 — símbolo dinámico vía behaviorConfig.currency (espejo de 53808fb).
    FieldDefLike defCur([String? code]) => FieldDefLike(
        key: 'x', type: 'number', behavior: 'currency',
        behaviorConfig: code == null ? null : {'currency': code});
    test('USD → "19,99 \$"', () => expect(formatScalar(19.99, defCur('USD')), '19,99 \$'));
    test('GBP → "19,99 £"', () => expect(formatScalar(19.99, defCur('GBP')), '19,99 £'));
    test('JPY → sin decimales, y 4 cifras sin punto: "1500 ¥"', () {
      expect(formatScalar(1500, defCur('JPY')), '1500 ¥');
    });
    test('JPY 9999.5 → "10.000 ¥" (redondea a 5 cifras y entonces agrupa)', () {
      expect(formatScalar(9999.5, defCur('JPY')), '10.000 ¥');
    });
    test('negativo de 4 cifras → "-1234,50 \$"', () {
      expect(formatScalar(-1234.5, defCur('USD')), '-1234,50 \$');
    });
    test('negativo de 5 cifras → "-12.345,50 \$"', () {
      expect(formatScalar(-12345.5, defCur('USD')), '-12.345,50 \$');
    });
    test('código desconocido → usa el propio código como símbolo', () {
      expect(formatScalar(5, defCur('ZZZ')), '5,00 ZZZ');
    });
    test('código en minúsculas se normaliza a mayúsculas', () {
      expect(formatScalar(5, defCur('usd')), '5,00 \$');
    });
  });

  group('formatScalar — behavior=percentage', () {
    test('75 → "75 %"', () => expect(formatScalar(75, def('percentage')), '75 %'));
    test('0 → "0 %"', () => expect(formatScalar(0, def('percentage')), '0 %'));
  });

  group('formatScalar — behavior=rating', () {
    test('4 → "★★★★☆"', () => expect(formatScalar(4, def('rating')), '★★★★☆'));
    test('0 → "☆☆☆☆☆"', () => expect(formatScalar(0, def('rating')), '☆☆☆☆☆'));
    test('5 → "★★★★★"', () => expect(formatScalar(5, def('rating')), '★★★★★'));
    test('clamp 7 → "★★★★★"', () => expect(formatScalar(7, def('rating')), '★★★★★'));
    test('clamp -1 → "☆☆☆☆☆"', () => expect(formatScalar(-1, def('rating')), '☆☆☆☆☆'));
    test('round 3.7 → "★★★★☆"', () => expect(formatScalar(3.7, def('rating')), '★★★★☆'));
  });

  group('formatScalar — behavior=measurement', () {
    test('12.5 → "12.5"', () => expect(formatScalar(12.5, def('measurement')), '12.5'));
    // KRO-198 — unidad vía behaviorConfig.unit (espejo de 53808fb).
    FieldDefLike defUnit([String? unit]) => FieldDefLike(
        key: 'x', type: 'number', behavior: 'measurement',
        behaviorConfig: unit == null ? null : {'unit': unit});
    test('12.5 + {unit:"cm"} → "12.5 cm"', () => expect(formatScalar(12.5, defUnit('cm')), '12.5 cm'));
    test('70 + {unit:"kg"} → "70 kg"', () => expect(formatScalar(70, defUnit('kg')), '70 kg'));
    test('unidad vacía → número plano', () => expect(formatScalar(9, defUnit('  ')), '9'));
  });

  group('formatScalar — fallback', () {
    test('string → echo', () => expect(formatScalar('hello'), 'hello'));
    test('number → toString', () => expect(formatScalar(42), '42'));
    test('true → "sí"', () => expect(formatScalar(true), 'sí'));
    test('false → "no"', () => expect(formatScalar(false), 'no'));
    test('object → JSON', () => expect(formatScalar({'a': 1}), '{"a":1}'));
  });

  group('formatScalar — incremental (KRO-84 V2)', () {
    FieldDefLike inc([Map<String, dynamic>? config]) => FieldDefLike(
        key: 'dorsal', type: 'number', behavior: 'incremental', behaviorConfig: config);

    test('sin config → número plano', () {
      expect(formatScalar(7, inc()), '7');
      expect(formatScalar(100, inc(<String, dynamic>{})), '100');
    });
    test('pad → zero-padding', () {
      expect(formatScalar(7, inc({'pad': 3})), '007');
      expect(formatScalar(42, inc({'pad': 3})), '042');
    });
    test('pad NO trunca si el número es más largo', () {
      expect(formatScalar(100, inc({'pad': 2})), '100');
    });
    test('prefix + suffix', () {
      expect(formatScalar(7, inc({'prefix': 'HC-'})), 'HC-7');
      expect(formatScalar(7, inc({'suffix': '-2025'})), '7-2025');
      expect(formatScalar(7, inc({'prefix': 'HC-', 'suffix': '-2025'})), 'HC-7-2025');
    });
    test('pad + prefix + suffix', () {
      expect(formatScalar(7, inc({'pad': 3, 'prefix': 'HC-', 'suffix': '-25'})), 'HC-007-25');
    });
    test('pad <= 0 o no-número → sin padding', () {
      expect(formatScalar(7, inc({'pad': 0})), '7');
      expect(formatScalar(7, inc({'pad': -2})), '7');
      expect(formatScalar(7, inc({'pad': 'x'})), '7');
    });
    test('decimal se trunca a entero', () {
      expect(formatScalar(7.9, inc({'pad': 3})), '007');
    });
    test('0 válido; null vacío', () {
      expect(formatScalar(0, inc({'pad': 3})), '000');
      expect(formatScalar(null, inc({'pad': 3})), '');
    });
    test('value no-numérico → fallback string', () {
      expect(formatScalar('7', inc({'pad': 3})), '7');
    });
  });
}
