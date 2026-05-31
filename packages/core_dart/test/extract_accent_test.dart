import 'package:kromia_core/kromia_core.dart';
import 'package:test/test.dart';

/// Espejo 1:1 del corpus TS `tests/extract-accent.test.ts` (KRO-73).
/// Misma entrada → misma salida que `@kromia/core` (paridad vigilada por drift-CI).
void main() {
  const colorField = FieldDefLike(key: 'color', type: 'text', behavior: 'color_hex');

  ViewComposition comp(Map<String, dynamic> json) =>
      ViewComposition.fromJson(<String, dynamic>{'recipe': 'compact_avatar', ...json});

  group('extractAccentSettings — color hex detection', () {
    test('item con color hex válido (#ff0000) → color + position', () {
      final r = extractAccentSettings(null, {'color': '#ff0000'}, [colorField], 'top');
      expect(r, const AccentSettings(color: '#ff0000', position: 'top'));
    });

    test('color hex sin "#" (ff0000) → añade el prefix', () {
      final r = extractAccentSettings(null, {'color': 'ff0000'}, [colorField], 'top');
      expect(r?.color, '#ff0000');
    });

    test('color hex con alpha (#ff000080) → válido', () {
      final r = extractAccentSettings(null, {'color': '#ff000080'}, [colorField], 'top');
      expect(r?.color, '#ff000080');
    });

    test('color hex inválido (xyz) → null', () {
      final r = extractAccentSettings(null, {'color': 'xyz'}, [colorField], 'top');
      expect(r, isNull);
    });

    test('sin fields color_hex → null', () {
      final r = extractAccentSettings(
          null, {'nombre': '#ff0000'}, [const FieldDefLike(key: 'nombre', type: 'text')], 'top');
      expect(r, isNull);
    });

    test('item sin valor en el field color → null', () {
      final r = extractAccentSettings(null, {}, [colorField], 'top');
      expect(r, isNull);
    });

    test('múltiples color_hex → coge el primero', () {
      final r = extractAccentSettings(
        null,
        {'c1': '#ff0000', 'c2': '#00ff00'},
        [
          const FieldDefLike(key: 'c1', type: 'text', behavior: 'color_hex'),
          const FieldDefLike(key: 'c2', type: 'text', behavior: 'color_hex'),
        ],
        'top',
      );
      expect(r?.color, '#ff0000');
    });
  });

  group('extractAccentSettings — resolución de posición', () {
    test('sin overrides → recipeDefault', () {
      final r = extractAccentSettings(null, {'color': '#ff0000'}, [colorField], 'left');
      expect(r?.position, 'left');
    });

    test('composition.accentPosition="top" → "top"', () {
      final r = extractAccentSettings(
          comp({'slots': {}, 'accentPosition': 'top'}), {'color': '#ff0000'}, [colorField], 'left');
      expect(r?.position, 'top');
    });

    test('composition.accentPosition="none" → "none" (NO cae a default)', () {
      final r = extractAccentSettings(
          comp({'slots': {}, 'accentPosition': 'none'}), {'color': '#ff0000'}, [colorField], 'top');
      expect(r?.position, 'none');
    });

    test('composition "auto" + slot.appearance override → slot override', () {
      final r = extractAccentSettings(
        comp({
          'slots': {
            'title': {
              'fields': ['color'],
              'appearance': {'accentPosition': 'right'},
            },
          },
          'accentPosition': 'auto',
        }),
        {'color': '#ff0000'},
        [colorField],
        'top',
      );
      expect(r?.position, 'right');
    });

    test('composition "auto" + slot sin override → recipeDefault', () {
      final r = extractAccentSettings(
        comp({
          'slots': {
            'title': {'fields': ['color']},
          },
          'accentPosition': 'auto',
        }),
        {'color': '#ff0000'},
        [colorField],
        'left',
      );
      expect(r?.position, 'left');
    });

    test('composition explícito > slot override (composition gana)', () {
      final r = extractAccentSettings(
        comp({
          'slots': {
            'title': {
              'fields': ['color'],
              'appearance': {'accentPosition': 'right'},
            },
          },
          'accentPosition': 'bottom',
        }),
        {'color': '#ff0000'},
        [colorField],
        'top',
      );
      expect(r?.position, 'bottom');
    });
  });
}
