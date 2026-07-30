import 'package:kromia_core/kromia_core.dart';
import 'package:test/test.dart';

/// KRO-285 / KRO-295 — espejo Dart del perfil público. Se prueban las reglas
/// que, espejadas mal, se notan tarde: los huecos que son valores de verdad y el
/// conjunto cerrado de colores.
void main() {
  group('a quién apunta un álbum', () {
    test('un publisher trae slug con el que pedir su perfil', () {
      final r = AlbumCreatorRef.fromJson(const {
        'kind': 'publisher',
        'ref': 'forjabrasa',
        'displayName': 'Forjabrasa Ediciones',
      });
      expect(r.hayAlguien, isTrue);
      expect(r.ref, 'forjabrasa');
    });

    test('`unknown` NO trae ref, y eso es el contrato', () {
      // Mandar a la app a una petición que va a fallar es peor que decirle desde
      // el principio que no hay nadie.
      final r = AlbumCreatorRef.fromJson(const {'kind': 'unknown'});
      expect(r.ref, isNull);
      expect(r.hayAlguien, isFalse);
    });

    test('un ref en blanco cuenta como que no hay nadie', () {
      expect(
        AlbumCreatorRef.fromJson(const {'kind': 'publisher', 'ref': '   '}).hayAlguien,
        isFalse,
      );
    });

    test('un kind que no conocemos degrada a desconocido, no a pantalla vacía', () {
      // Seguir el ref de un tipo que la app no sabe abrir acaba en blanco; la
      // pantalla del desconocido es la degradación segura.
      final r = AlbumCreatorRef.fromJson(const {'kind': 'sindicato', 'ref': 'x'});
      expect(r.hayAlguien, isFalse);
    });
  });

  group('banda de color', () {
    test('el conjunto es CERRADO y neutral es el default', () {
      expect(profileBandColors, contains('neutral'));
      expect(defaultBandColor, 'neutral');
      expect(isBandColor('fucsia'), isFalse);
      expect(isBandColor('gold'), isTrue);
    });

    test('cada banda trae su color de TEXTO, no solo el fondo', () {
      // El `fg` viene del contrato para que el nombre se lea encima; dejarlo al
      // criterio de cada host es cómo aparece texto blanco sobre oro.
      for (final c in profileBandColors) {
        expect(bandColorValues[c]!.bg, startsWith('#'));
        expect(bandColorValues[c]!.fg, startsWith('#'));
      }
      expect(bandColorValues['gold']!.fg, '#1A2E1A');
      expect(bandColorValues['violet']!.fg, '#FFFFFF');
    });

    test('un color inventado cae a la neutra en vez de dejar la banda sin pintar', () {
      expect(bandOf('fucsia').bg, bandColorValues['neutral']!.bg);
      expect(bandOf(null).bg, bandColorValues['neutral']!.bg);
    });
  });

  group('el perfil', () {
    test('una persona llega con la misma forma y sin comunidad', () {
      final p = PublisherProfile.fromJson(const {
        'publisherId': 'u1',
        'slug': 'luis',
        'displayName': 'Luis',
        'kind': 'creator',
        'followersCount': 0,
        'isFollowing': false,
        'albumsCount': 2,
        'editionsCount': 5,
      });
      expect(p.esPersona, isTrue);
      expect(p.canManage, isFalse);
      // 0 seguidores aquí es un VALOR, no un hueco: no hay a quién seguir.
      expect(p.followersCount, 0);
      expect(p.isFollowing, isFalse);
    });

    test('álbumes y ediciones son cifras distintas', () {
      final p = PublisherProfile.fromJson(const {
        'publisherId': 'p1',
        'slug': 'fe',
        'displayName': 'Forjabrasa',
        'albumsCount': 2,
        'editionsCount': 7,
      });
      expect(p.albumsCount, 2);
      expect(p.editionsCount, 7);
    });

    test('sin lastPostAt NO es un error: es el perfil recién creado', () {
      final p = PublisherProfile.fromJson(const {
        'publisherId': 'p1',
        'slug': 'fe',
        'displayName': 'Forjabrasa',
      });
      expect(p.lastPostAt, isNull);
      expect(p.bandColor, isNull);
      expect(bandOf(p.bandColor).bg, bandColorValues['neutral']!.bg);
    });

    test('un perfil privado llega sin descripción y NO está roto', () {
      // El servidor degrada el nombre al username y esconde la bio, pero el
      // catálogo sigue llegando: se oculta la persona, no su obra.
      final p = PublisherProfile.fromJson(const {
        'publisherId': 'u2',
        'slug': 'mvidal',
        'displayName': 'mvidal',
        'kind': 'creator',
        'albumsCount': 3,
      });
      expect(p.description, isNull);
      expect(p.albumsCount, 3);
    });
  });

  group('validación', () {
    test('el nombre es obligatorio y tiene tope', () {
      expect(validatePublisherProfile(displayName: 'Forjabrasa').valid, isTrue);
      expect(validatePublisherProfile(displayName: '   ').valid, isFalse);
      expect(
        validatePublisherProfile(displayName: 'x' * (profileLimits.displayName.max + 1)).valid,
        isFalse,
      );
    });

    test('el lema es más corto que la descripción, y es la razón de que existan los dos', () {
      expect(profileLimits.tagline.max, 80);
      expect(profileLimits.description.max, 600);
      expect(
        validatePublisherProfile(
          displayName: 'F',
          tagline: 'x' * profileLimits.tagline.max,
        ).valid,
        isTrue,
      );
      final r = validatePublisherProfile(
        displayName: 'F',
        tagline: 'x' * (profileLimits.tagline.max + 1),
      );
      expect(r.valid, isFalse);
      expect(r.issues.single.field, 'tagline');
    });

    test('un color fuera del conjunto se rechaza', () {
      final r = validatePublisherProfile(displayName: 'F', bandColor: 'fucsia');
      expect(r.valid, isFalse);
      expect(r.issues.any((i) => i.field == 'bandColor'), isTrue);
    });
  });

  group('perfil a medio hacer', () {
    test('vacío es válido, pero se sabe que está vacío', () {
      expect(profileIsBare(), isTrue);
      expect(profileIsBare(tagline: '   '), isTrue);
      expect(profileIsBare(tagline: 'Cromos de bestiario'), isFalse);
      expect(profileIsBare(logoKey: 'x/y.webp'), isFalse);
    });
  });
}
