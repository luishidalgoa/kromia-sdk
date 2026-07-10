import 'package:kromia_core/kromia_core.dart';
import 'package:test/test.dart';

/// KRO-225 — espejo del radio de esquina carta/marco (`CARD_CORNER_RADIUS_PX` +
/// `cardCornerRadiusOf` + `CardFormat.cornerRadius`). El render deriva UN radio del
/// formato y lo usa para el clip de la carta Y el radius del marco → coherencia por
/// construcción (`svg/300 == css%`).
void main() {
  group('cardCornerRadiusPx (KRO-225)', () {
    test('la tabla espeja 1:1 @kromia/core (options.ts)', () {
      expect(cardCornerRadii, ['none', 'sm', 'md', 'lg', 'xl']);
      expect(cardCornerRadiusPx['none'], (css: '0', svg: 0.0));
      expect(cardCornerRadiusPx['sm'], (css: '4%', svg: 12.0));
      expect(cardCornerRadiusPx['md'], (css: '8%', svg: 24.0));
      expect(cardCornerRadiusPx['lg'], (css: '16%', svg: 48.0));
      expect(cardCornerRadiusPx['xl'], (css: '28%', svg: 84.0));
    });

    // La coherencia clip/marco es POR CONSTRUCCIÓN: el % del css == svg/300.
    test('coherencia svg/300 == css% para cada nivel', () {
      for (final key in cardCornerRadii) {
        final r = cardCornerRadiusPx[key]!;
        final cssPct = double.parse(r.css.replaceAll('%', ''));
        expect(r.svg / 300.0 * 100.0, closeTo(cssPct, 1e-9), reason: key);
      }
    });

    test('cardCornerRadiusOf: fallback a md si el formato no declara o es inválido', () {
      expect(cardCornerRadiusOf(null), cardCornerRadiusPx['md']);
      expect(cardCornerRadiusOf(const CardFormat(aspect: '2:3', size: 'standard')),
          cardCornerRadiusPx['md']);
      expect(
          cardCornerRadiusOf(
              const CardFormat(aspect: '2:3', size: 'standard', cornerRadius: 'zzz')),
          cardCornerRadiusPx['md']);
    });

    test('cardCornerRadiusOf: usa el nivel declarado', () {
      expect(cardCornerRadiusOf(const CardFormat(aspect: '2:3', size: 'large', cornerRadius: 'sm')),
          cardCornerRadiusPx['sm']);
      expect(cardCornerRadiusOf(const CardFormat(aspect: '2:3', size: 'large', cornerRadius: 'xl')),
          cardCornerRadiusPx['xl']);
    });

    test('CardFormat.fromJson lee cornerRadius (aditivo; ausente = null → resuelve md)', () {
      final f = CardFormat.fromJson(const {
        'aspect': '2:3',
        'size': 'large',
        'cornerRadius': 'md',
        'shape': 'standard',
        'shapePath': 'M0,0 L1,0 L1,1 Z',
        'shapeScale': 1,
      });
      expect(f.cornerRadius, 'md');
      expect(cardCornerRadiusOf(f).svg, 24);
      // Sin cornerRadius en el JSON → null, pero el resolver cae a md.
      final g = CardFormat.fromJson(const {'aspect': '2:3', 'size': 'standard'});
      expect(g.cornerRadius, isNull);
      expect(cardCornerRadiusOf(g).svg, 24);
    });
  });
}
