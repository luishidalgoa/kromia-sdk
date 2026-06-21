import 'package:kromia_core/kromia_core.dart';
import 'package:test/test.dart';

/// Espejo de `section-icons.test.ts`: la sugerencia por keyword (anti-drift).
void main() {
  group('suggestSectionIcon', () {
    test('mapea nombres de lore', () {
      expect(suggestSectionIcon('Reinos'), 'crown');
      expect(suggestSectionIcon('Leyendas'), 'book');
      expect(suggestSectionIcon('Cartas'), 'cards');
    });

    test('pliega acentos del input (Montaña → mountain)', () {
      expect(suggestSectionIcon('Montaña'), 'mountain');
      expect(suggestSectionIcon('Pociones'), 'flask');
    });

    test('match por PALABRA, no substring (cartagena → null)', () {
      expect(suggestSectionIcon('Cartagena'), isNull);
    });

    test('sin match claro → null (no icono de relleno)', () {
      expect(suggestSectionIcon('Qwerty zxcv'), isNull);
      expect(suggestSectionIcon(''), isNull);
    });

    test('el catálogo tiene ids únicos', () {
      final ids = sectionIcons.map((e) => e.id).toList();
      expect(ids.toSet().length, ids.length);
    });

    test('géneros/deportes nuevos (KRO): futbol → soccer-ball, no ball', () {
      expect(suggestSectionIcon('Fútbol'), 'soccer-ball');
      expect(suggestSectionIcon('Baloncesto'), 'basketball');
      expect(suggestSectionIcon('Videojuegos'), 'gamepad');
      expect(suggestSectionIcon('Dinosaurios'), 'bone');
    });
  });

  group('lucideForIconId', () {
    test('regla: == id salvo excepciones', () {
      expect(lucideForIconId('crown'), 'crown');
      expect(lucideForIconId('star'), 'star');
    });
    test('excepciones (incluidas las nuevas)', () {
      expect(lucideForIconId('book'), 'book-open');
      expect(lucideForIconId('wand'), 'wand-sparkles');
      expect(lucideForIconId('home'), 'house');
      expect(lucideForIconId('cards'), 'wallet-cards');
      expect(lucideForIconId('ball'), 'goal');
      expect(lucideForIconId('gamepad'), 'gamepad-2');
      expect(lucideForIconId('mask'), 'venetian-mask');
      expect(lucideForIconId('flower'), 'flower-2');
    });
    test('id desconocido → el propio id', () {
      expect(lucideForIconId('xyz'), 'xyz');
    });
  });

  group('integridad / anti-drift del catálogo (espejo de section-icons-parity)', () {
    test('count anclado al catálogo canónico @kromia/core (d643a2e): 79', () {
      // CANARIO de drift TS↔Dart: 77 lucide + 2 svg inline. Si cambia el catálogo
      // de `@kromia/core/src/section-icons.ts`, actualiza el mirror Dart Y este
      // número CONSCIENTEMENTE — así un add/remove silencioso hace saltar el test.
      expect(sectionIcons.length, 79);
    });

    test('exactamente soccer-ball y basketball llevan svg inline', () {
      // El `svg` es el CONTRATO compartido: si el SDK retoca ese markup hay que
      // RE-TRADUCIR el CustomPainter de Flutter (`_SectionGlyphPainter`).
      final withSvg =
          sectionIcons.where((d) => d.svg != null).map((d) => d.id).toSet();
      expect(withSvg, {'soccer-ball', 'basketball'});
      expect(sectionIcons.firstWhere((d) => d.id == 'star').svg, isNull);
    });

    test('lucide y svg son mutuamente excluyentes', () {
      for (final d in sectionIcons) {
        expect(d.lucide != null && d.svg != null, isFalse, reason: d.id);
      }
    });
  });

  group('sectionIconSvg / resolveSectionIconId (glifos inline + resolución)', () {
    test('sectionIconSvg solo para glifos no-lucide', () {
      expect(sectionIconSvg('soccer-ball'), isNotNull);
      expect(sectionIconSvg('basketball'), isNotNull);
      expect(sectionIconSvg('star'), isNull); // lucide puro
      expect(sectionIconSvg('inexistente'), isNull);
      expect(sectionIconSvg(null), isNull);
    });

    test('resolveSectionIconId: elegido válido → ese; si no, sugerencia; si no, null', () {
      expect(resolveSectionIconId('soccer-ball', 'X'), 'soccer-ball');
      expect(resolveSectionIconId(null, 'Reinos'), 'crown');
      expect(resolveSectionIconId('', 'Leyendas'), 'book');
      expect(resolveSectionIconId('id-que-no-existe', 'Qwerty zxcv'), isNull);
    });
  });
}
