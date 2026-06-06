/// Corpus de `media_path.dart` — ESPEJO de `tests/media-path.test.ts` (KRO-132).
import 'package:kromia_core/kromia_core.dart';
import 'package:test/test.dart';

void main() {
  group('slugify — determinista y sin acentos', () {
    test('minúsculas, espacios → guion', () {
      expect(slugify('Semana Santa Cordoba'), 'semana-santa-cordoba');
    });
    test('elimina acentos (NFD + Diacritic)', () {
      expect(slugify('Córdoba'), 'cordoba');
      expect(slugify('España'), 'espana');
      expect(slugify('Mêlée Pingüino'), 'melee-pinguino');
    });
    test('colapsa puntuación y runs de no-alfanuméricos', () {
      expect(slugify('  ¡Hola,   Mundo!  '), 'hola-mundo');
      expect(slugify('a___b...c'), 'a-b-c');
    });
    test('recorta guiones de los extremos', () {
      expect(slugify('---hola---'), 'hola');
      expect(slugify('2025'), '2025');
    });
    test('cadena sin alfanuméricos → vacío', () {
      expect(slugify('¡!¿?'), '');
      expect(slugify('★'), '');
    });
  });

  group('slugifyAlbumName — edición como sub-carpeta', () {
    test('la edición es una sub-carpeta del nombre', () {
      expect(slugifyAlbumName('Semana Santa Córdoba', '2025'), 'semana-santa-cordoba/2025');
      expect(slugifyAlbumName('Liga', '2024-25'), 'liga/2024-25');
    });
    test('edición ausente/vacía → solo el nombre', () {
      expect(slugifyAlbumName('Bestiario'), 'bestiario');
      expect(slugifyAlbumName('Bestiario', ''), 'bestiario');
      expect(slugifyAlbumName('Bestiario', '   '), 'bestiario');
    });
    test('fallback a "album"', () {
      expect(slugifyAlbumName('★', ''), 'album');
      expect(slugifyAlbumName('', ''), 'album');
      expect(slugifyAlbumName('★', '2025'), 'album/2025');
    });
  });

  group('albumMediaNamespace — la organización gana la raíz', () {
    test('independiente → username del dueño', () {
      expect(albumMediaNamespace(const AlbumMediaRoot(ownerUsername: 'ana')), 'ana');
      expect(albumMediaNamespace(const AlbumMediaRoot(ownerUsername: 'ana', orgSlug: null)), 'ana');
      expect(albumMediaNamespace(const AlbumMediaRoot(ownerUsername: 'ana', orgSlug: '')), 'ana');
      expect(albumMediaNamespace(const AlbumMediaRoot(ownerUsername: 'ana', orgSlug: '   ')), 'ana');
    });
    test('de organización → slug de la org', () {
      expect(albumMediaNamespace(const AlbumMediaRoot(ownerUsername: 'ana', orgSlug: 'kromia')), 'kromia');
    });
  });

  group('albumMediaPrefix — prefijo canónico con / final', () {
    test('álbum independiente', () {
      expect(albumMediaPrefix(ownerUsername: 'ana', albumSlug: 'liga-2025'), 'ana/liga-2025/');
    });
    test('álbum de organización', () {
      expect(albumMediaPrefix(ownerUsername: 'ana', orgSlug: 'kromia', albumSlug: 'liga-2025'), 'kromia/liga-2025/');
    });
  });

  group('constantes de cuota', () {
    test('400 MB por álbum', () {
      expect(albumMediaQuotaBytes, 419430400);
    });
    test('agregado por dueño = 6 × 400 MB ≈ 2,4 GB', () {
      expect(ownerMediaAlbumAllowance, 6);
      expect(ownerMediaQuotaBytes, albumMediaQuotaBytes * 6);
      expect(ownerMediaQuotaBytes, 2516582400);
    });
  });
}
