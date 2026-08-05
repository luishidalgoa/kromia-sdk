import 'package:kromia_core/kromia_core.dart';
import 'package:test/test.dart';

/// KRO-314 · valor de campo-imagen. Corpus 1:1 con `tests/image-value.test.ts`.
///
/// El fallo que lo originó: un `array<image>` en un slot de banner salía como
/// `"/api/images/a.svg,/api/images/b.svg,…"` dentro del `src`, porque el
/// renderer lo AFIRMABA string y quien lo recibía lo coaccionaba con el
/// `toString()` de Array. Sin error y sin aviso.
void main() {
  group('KRO-314 · valor de campo-imagen', () {
    test('un array NUNCA se convierte en una cadena con comas', () {
      const varias = ['/api/images/a.svg', '/api/images/b.svg', '/api/images/c.svg'];
      // Esto es lo que pasaba, y es lo que no puede volver a pasar.
      expect(varias.toString(), contains(','));
      expect(firstImageUrl(varias), '/api/images/a.svg');
      expect(firstImageUrl(varias), isNot(contains(',')));
    });

    test('una imagen suelta también sale como lista: el otro sentido', () {
      // Una galería que espere lista y reciba un `image` suelto tampoco tiene un
      // array — ahí revienta o itera carácter a carácter.
      expect(imageUrls('/api/images/sola.svg'), ['/api/images/sola.svg']);
    });

    test('descarta huecos en vez de pintar imágenes rotas', () {
      expect(
        imageUrls(['/a.svg', '', '   ', null, 7, '/b.svg']),
        ['/a.svg', '/b.svg'],
      );
    });

    test('sin valor no hay imagen — y eso es un hueco, no un error', () {
      // Los componentes ya saben dibujar su hueco (o la inicial del título)
      // cuando no reciben nada; devolver '' les haría pintar una rota.
      for (final v in <Object?>[null, '', '   ', <Object?>[], <String, Object?>{}, 0]) {
        expect(firstImageUrl(v), isNull, reason: 'con $v');
        expect(imageUrls(v), isEmpty, reason: 'con $v');
      }
    });

    test('el contador cuenta las de VERDAD, que es lo que dice el chip «+N»', () {
      expect(imageCount(['/a.svg', '', '/b.svg']), 2);
      expect(imageCount('/a.svg'), 1);
      expect(imageCount(null), 0);
    });
  });
}
