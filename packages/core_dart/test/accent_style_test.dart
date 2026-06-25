import 'package:test/test.dart';
import 'package:kromia_core/kromia_core.dart';

/// KRO-219 — `accentStyle` se copia a `AccentSettings.style` (default 'bar'),
/// sin alterar color/posición. Espejo de extract-accent.ts:87.
void main() {
  const defs = [FieldDefLike(key: 'color', type: 'text', behavior: 'color_hex')];
  ViewComposition comp(String? style) =>
      ViewComposition(recipe: 'editorial', action: 'none', slots: const {}, accentStyle: style);

  group('accentStyle → AccentSettings.style', () {
    test('copia el style de la composición (no toca color/posición)', () {
      final a = extractAccentSettings(comp('glow'), const {'color': '#ff0000'}, defs, 'top');
      expect(a!.style, 'glow');
      expect(a.color, '#ff0000');
      expect(a.position, 'top');
    });

    test('sin accentStyle → default "bar"', () {
      expect(extractAccentSettings(comp(null), const {'color': '#ff0000'}, defs, 'top')!.style, 'bar');
    });

    test('cada estilo válido se copia tal cual', () {
      for (final s in ['bar', 'rounded', 'glow', 'gradient', 'ambient']) {
        expect(extractAccentSettings(comp(s), const {'color': '#abcdef'}, defs, 'left')!.style, s);
      }
    });

    test('ViewComposition.fromJson parsea accentStyle', () {
      final c = ViewComposition.fromJson(
          const {'recipe': 'editorial', 'action': 'none', 'slots': <String, dynamic>{}, 'accentStyle': 'ambient'});
      expect(c.accentStyle, 'ambient');
    });

    test('== / hashCode distinguen por style', () {
      const a = AccentSettings(color: '#fff', position: 'top', style: 'bar');
      const b = AccentSettings(color: '#fff', position: 'top', style: 'glow');
      expect(a == b, isFalse);
      expect(a.hashCode == b.hashCode, isFalse);
    });
  });
}
