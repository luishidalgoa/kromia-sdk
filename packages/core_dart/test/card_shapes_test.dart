import 'package:kromia_core/kromia_core.dart';
import 'package:test/test.dart';

/// KRO-232 — espejo Dart de `card-shapes.ts`: catálogo mínimo + `validateShapePath`
/// (1:1) + `cardShapePath`/`clampShapeScale`/`scaleShapePath`.
void main() {
  group('catálogo', () {
    test('solo standard (sin siluetas de ejemplo)', () {
      expect(cardShapeIds, ['standard']);
      expect(cardShapeById('standard').path, isNull);
    });
    test('id desconocido/legacy → estándar (path null)', () {
      expect(cardShapeById('hex').id, 'standard');
      expect(cardShapeById(null).path, isNull);
    });
  });

  group('validateShapePath', () {
    test('triángulo válido → null', () {
      expect(validateShapePath('M 0 0 L 1 0 L 1 1 Z'), isNull);
      expect(validateShapePath('M 0.5 0 C 1 0 1 1 0.5 1 L 0 0.5 Z'), isNull);
    });
    test('vacío / no-string', () {
      expect(validateShapePath(''), 'El path está vacío.');
      expect(validateShapePath('   '), 'El path está vacío.');
      expect(validateShapePath(42), 'El path está vacío.');
    });
    test('demasiado largo', () {
      final long = 'M 0 0 ${'L 0.1 0.1 ' * 800}Z';
      expect(validateShapePath(long), 'El path es demasiado largo (simplifica la forma).');
    });
    test('caracteres/comandos no admitidos', () {
      expect(validateShapePath('M 0 0 A 1 1 Z'), 'Solo se admiten comandos M/L/C/Q/Z absolutos y números.');
      // Número donde se esperaba comando → "Comando no admitido".
      expect(validateShapePath('M 0 0 1 1 Z'), 'Comando no admitido: "1".');
    });
    test('un solo subpath (una M) + empieza por M', () {
      expect(validateShapePath('M 0 0 L 1 0 M 0.5 0.5 Z'),
          'Solo se admite un subpath (una única M, sin holes).');
      expect(validateShapePath('L 0 0 Z'), 'El path debe empezar por M.');
    });
    test('coords numéricas y normalizadas', () {
      expect(validateShapePath('M 0 . L 1 1 Z'), 'Coordenada no numérica.');
      expect(validateShapePath('M 0 0 L 2 0 L 1 1 Z'),
          'Las coordenadas deben estar normalizadas en 0..1.');
    });
    test('cierre con Z + Z al final + mínimo 3 puntos', () {
      expect(validateShapePath('M 0 0 L 1 0 L 1 1'), 'El path debe cerrarse con Z.');
      expect(validateShapePath('M 0 0 L 1 0 Z L 1 1'),
          'Z debe ser el último comando (un solo subpath, sin holes).');
      expect(validateShapePath('M 0 0 L 1 1 Z'), 'La forma necesita al menos 3 puntos.');
    });
  });

  group('cardShapePath', () {
    test("custom + path válido → el path; inválido → null", () {
      expect(cardShapePath(shape: 'custom', shapePath: 'M 0 0 L 1 0 L 1 1 Z'), 'M 0 0 L 1 0 L 1 1 Z');
      expect(cardShapePath(shape: 'custom', shapePath: 'basura'), isNull);
      expect(cardShapePath(shape: 'custom'), isNull);
    });
    test("standard/ausente/desconocido → null", () {
      expect(cardShapePath(shape: 'standard'), isNull);
      expect(cardShapePath(), isNull);
      expect(cardShapePath(shape: 'hex'), isNull);
    });
  });

  group('clampShapeScale / scaleShapePath', () {
    test('clamp a [0.5, 1]; ausente/no-finito → 1', () {
      expect(clampShapeScale(null), 1);
      expect(clampShapeScale(double.nan), 1);
      expect(clampShapeScale(0.3), 0.5);
      expect(clampShapeScale(0.7), 0.7);
      expect(clampShapeScale(2), 1);
    });
    test('scale 1 → intacto; <1 → reproyecta sobre el centro (0.5 fijo)', () {
      const p = 'M 0 0 L 1 0 L 1 1 Z';
      expect(scaleShapePath(p, 1), p);
      // s=0.5: 0→0.25, 1→0.75, 0.5→0.5.
      expect(scaleShapePath('M 0 0 L 1 1 L 0.5 0.5 Z', 0.5), 'M 0.25 0.25 L 0.75 0.75 L 0.5 0.5 Z');
    });
  });
}
