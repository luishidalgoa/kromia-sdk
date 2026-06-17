/// Tests propios del paquete Dart (no tienen equivalente directo en TS porque
/// `isCompatible` es nuevo de KRO-65). Cubren el SemVer compare + la politica
/// de compatibilidad major-based que la app Flutter usa al cargar un album.
import 'dart:io';

import 'package:test/test.dart';
import 'package:kromia_core/kromia_core.dart';

void main() {
  group('compareSemver', () {
    test('igualdad', () => expect(compareSemver('2.2.1', '2.2.1'), 0));
    test('major manda', () => expect(compareSemver('3.0.0', '2.9.9'), greaterThan(0)));
    test('minor manda dentro del mismo major', () => expect(compareSemver('2.3.0', '2.2.9'), greaterThan(0)));
    test('patch manda dentro del mismo minor', () => expect(compareSemver('2.2.2', '2.2.1'), greaterThan(0)));
    test('menor que', () => expect(compareSemver('1.0.0', '2.0.0'), lessThan(0)));
    test('tolera sufijos (-beta / +build)', () => expect(compareSemver('2.2.1+build7', '2.2.1'), 0));
    test('lanza FormatException en version invalida', () {
      expect(() => compareSemver('no-version', '1.0.0'), throwsFormatException);
    });
  });

  group('isCompatible (politica major-based)', () {
    test('mismo major, album con minor mayor -> compatible (aditivo, se ignora lo desconocido)', () {
      expect(isCompatible('2.5.0', '2.2.1'), isTrue);
    });
    test('album major mayor -> incompatible (fallback render)', () {
      expect(isCompatible('3.0.0', '2.2.1'), isFalse);
    });
    test('album major menor -> compatible (cliente nuevo, album viejo)', () {
      expect(isCompatible('1.9.9', '2.2.1'), isTrue);
    });
    test('clientVersion por defecto = protocolVersion', () {
      expect(isCompatible(protocolVersion), isTrue);
    });
  });

  group('protocolVersion', () {
    test('es un SemVer parseable', () {
      expect(() => Semver.parse(protocolVersion), returnsNormally);
    });
    test('iguala la versión del paquete (anti-drift; TS deriva PROTOCOL_VERSION de pkg.version)', () {
      final pubspec = File('pubspec.yaml').readAsStringSync();
      final m = RegExp(r'^version:\s*(\S+)', multiLine: true).firstMatch(pubspec);
      expect(m, isNotNull, reason: 'pubspec.yaml debe declarar version');
      // El pubspec puede llevar build (+N); el protocolo es solo major.minor.patch.
      final pkgVersion = m!.group(1)!.split('+').first;
      expect(protocolVersion, pkgVersion);
    });
  });
}
