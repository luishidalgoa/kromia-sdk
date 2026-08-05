import 'package:kromia_core/kromia_core.dart';
import 'package:test/test.dart';

/// KRO-302 — la conversión URL↔key del bucket. Corpus 1:1 con
/// `tests/media-address.test.ts`.
///
/// Existe porque esto estaba escrito tres veces con tres criterios distintos, y
/// el día que el dato guardado cambió de forma cada host se rompió de una manera
/// diferente y **ninguno con una excepción**. Lo que se fija aquí es sobre todo
/// qué NO es un objeto del bucket: ahí es donde divergían.
void main() {
  const base = 'https://s3.ejemplo.com';
  const bucket = 'kromia';

  group('objectUrl', () {
    test('compone base + bucket + key', () {
      expect(
        objectUrl('__private/avatars/luis.webp', publicUrl: base, bucket: bucket),
        'https://s3.ejemplo.com/kromia/__private/avatars/luis.webp',
      );
    });

    test('sin saber dónde vive el bucket NO se inventa una URL', () {
      // Una URL falsa se ve igual que una imagen que no se subió, y manda a
      // quien depure al sitio equivocado. Mejor decir que no se sabe.
      expect(objectUrl('a/b.png'), isNull);
      expect(objectUrl('a/b.png', bucket: bucket), isNull);
    });

    test('tolera barras de más por los dos lados', () {
      expect(
        objectUrl('/a/b.png',
            publicUrl: 'https://s3.ejemplo.com/', bucket: '/kromia/'),
        'https://s3.ejemplo.com/kromia/a/b.png',
      );
    });
  });

  group('objectKey', () {
    test('vuelve de la URL a la key', () {
      expect(
        objectKey('https://s3.ejemplo.com/kromia/__private/avatars/luis.webp',
            publicUrl: base, bucket: bucket),
        '__private/avatars/luis.webp',
      );
    });

    test('ida y vuelta', () {
      const key = 'ana/liga-2025/original/foto.png';
      expect(
        objectKey(objectUrl(key, publicUrl: base, bucket: bucket),
            publicUrl: base, bucket: bucket),
        key,
      );
    });

    test('una key suelta se devuelve tal cual', () {
      expect(objectKey('ana/liga/foto.png', publicUrl: base, bucket: bucket),
          'ana/liga/foto.png');
      expect(objectKey('/ana/liga/foto.png', publicUrl: base, bucket: bucket),
          'ana/liga/foto.png');
    });

    test('tolera la ruta del PROXY, que es lo que rompió el avatar', () {
      // El backend guardó un tiempo `/api/images/{key}`. Sin quitar ese prefijo,
      // el host se lo volvía a poner y pedía `/api/images/api/images/…`.
      expect(
        objectKey('/api/images/__private/avatars/luis.webp',
            publicUrl: base, bucket: bucket),
        '__private/avatars/luis.webp',
      );
    });

    test('lo que NO es del bucket devuelve null, para que el host lo deje pasar',
        () {
      // Proxyar el avatar de Google o un blob local los ROMPE. Este es justo el
      // punto donde los tres hosts tenían criterios distintos.
      for (final v in [
        'https://lh3.googleusercontent.com/a/foto.jpg',
        'data:image/png;base64,AAAA',
        'blob:http://localhost/abc',
        'mockup:image',
        '',
      ]) {
        expect(objectKey(v, publicUrl: base, bucket: bucket), isNull,
            reason: 'con «$v»');
      }
      expect(objectKey(null, publicUrl: base, bucket: bucket), isNull);
    });

    test('con un CDN que lleva PATH sigue acertando', () {
      // Es el caso que rompía la heurística de «quita el primer segmento»: aquí
      // el primero es `media`, no el bucket.
      const cdn = 'https://cdn.ejemplo.com/media';
      expect(
        objectKey('https://cdn.ejemplo.com/media/kromia/a/b.png',
            publicUrl: cdn, bucket: bucket),
        'a/b.png',
      );
      expect(objectUrl('a/b.png', publicUrl: cdn, bucket: bucket),
          'https://cdn.ejemplo.com/media/kromia/a/b.png');
    });

    test('sin base, cae a la heurística de quitar el primer segmento', () {
      // El comportamiento que tenían los hosts. Se conserva para no romper lo ya
      // guardado, pero por eso conviene pasar siempre `publicUrl`.
      expect(objectKey('https://otro.host/kromia/a/b.png'), 'a/b.png');
      // Con un solo segmento no hay key que sacar.
      expect(objectKey('https://otro.host/solo'), isNull);
    });

    test('si se dice el bucket, una URL de OTRO bucket no cuela', () {
      expect(objectKey('https://otro.host/ajeno/a/b.png', bucket: bucket), isNull);
    });
  });
}
