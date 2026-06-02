/// Corpus de `isSchemaOutdated` — ESPEJO 1:1 de `tests/schema-version.test.ts` (KRO-115).
import 'package:kromia_core/kromia_core.dart';
import 'package:test/test.dart';

void main() {
  group('isSchemaOutdated', () {
    test('major estampado MENOR que el actual → true (desactualizado)', () {
      expect(isSchemaOutdated('1.9.9', '2.2.1'), isTrue);
      expect(isSchemaOutdated('1.0.0', '3.0.0'), isTrue);
    });

    test('major estampado IGUAL al actual → false (al día)', () {
      expect(isSchemaOutdated('2.0.0', '2.2.1'), isFalse);
      expect(isSchemaOutdated('2.9.9', '2.2.1'), isFalse);
      expect(isSchemaOutdated('2.2.1', '2.2.1'), isFalse);
    });

    test('major estampado MAYOR que el actual → false (más nuevo)', () {
      expect(isSchemaOutdated('3.0.0', '2.2.1'), isFalse);
    });

    test('stamped ausente / vacío / basura → false (legacy/desconocido)', () {
      expect(isSchemaOutdated(null, '2.2.1'), isFalse);
      expect(isSchemaOutdated('', '2.2.1'), isFalse);
      expect(isSchemaOutdated('garbage', '2.2.1'), isFalse);
    });

    test('current no-parseable → false (sin referencia no marcamos)', () {
      expect(isSchemaOutdated('1.0.0', 'x'), isFalse);
    });

    test('tolera SemVer sin minor/patch', () {
      expect(isSchemaOutdated('1', '2'), isTrue);
      expect(isSchemaOutdated('2', '2.0.0'), isFalse);
    });
  });
}
