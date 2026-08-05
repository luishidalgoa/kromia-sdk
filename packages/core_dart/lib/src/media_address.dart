/// KRO-302 — cómo se DIRECCIONA un objeto del bucket. Espejo de
/// `packages/core/src/media-address.ts`.
///
/// El SDK ya poseía dónde VIVE un objeto. Lo que no poseía era cómo se convierte
/// una key en una URL y al revés — y esa parte acabó escrita **tres veces**, con
/// tres criterios distintos:
///
/// - el backend construía `${publicUrl}/${bucket}/${key}`;
/// - Studio hacía la inversa quitando el primer segmento **fuera el que fuera**;
/// - Flutter la inversa exigiendo esquema y que el primer segmento fuese el
///   bucket.
///
/// Divergieron, y el día que el backend guardó la ruta del proxy en vez de la
/// URL del bucket, cada host se rompió de una forma distinta y **ninguno con una
/// excepción**: la app cayó a los placeholders y la web pidió
/// `/api/images/api/images/…`. El síntoma en los dos era «esa foto no se subió
/// bien», que es justo lo contrario de lo que pasaba.
///
/// **Lo que se GUARDA es la key, o la URL del bucket. La ruta del proxy es cosa
/// del RENDER y no se persiste nunca.**
library;

/// Lo que NO es un objeto del bucket y hay que dejar pasar tal cual.
final _noEsObjeto = RegExp(r'^(data:|blob:|mockup:)', caseSensitive: false);
final _esHttp = RegExp(r'^https?://', caseSensitive: false);
final _prefijoProxy = RegExp(r'^api/images/');

String _sinBarras(String s) =>
    s.replaceAll(RegExp(r'^/+'), '').replaceAll(RegExp(r'/+$'), '');

/// La ruta DECODIFICADA de una URL.
///
/// `Uri.path` la devuelve escapada, y las rutas reales llevan tildes sin
/// escapar (`.../HolyCards/Córdoba/...`). Sacar la key de ahí daba
/// `C%C3%B3rdoba`, que el host volvía a escapar al construir el proxy —
/// `C%25C3%25B3rdoba`— y el objeto dejaba de encontrarse. Un 404 sobre algo que
/// existe, que es de los errores que más tiempo cuestan.
/// `pathSegments` YA viene decodificado: volver a decodificarlo revienta con
/// «Illegal percent encoding» en cuanto hay un `%` legítimo en un nombre.
String _rutaLegible(Uri u) => u.pathSegments.join('/');

/// La URL con la que se descarga un objeto, a partir de su key.
///
/// `null` si no se sabe dónde vive el bucket: **mejor no dar URL que dar una
/// inventada**, porque una URL que no existe se ve igual que una imagen que no
/// se subió, y manda a quien depure al sitio equivocado.
String? objectUrl(String? key, {String? publicUrl, String? bucket}) {
  if (key == null || key.isEmpty) return null;
  final base = publicUrl != null ? _sinBarras(publicUrl) : '';
  if (base.isEmpty) return null;
  final b = bucket != null ? _sinBarras(bucket) : '';
  final limpia = _sinBarras(key);
  return b.isNotEmpty ? '$base/$b/$limpia' : '$base/$limpia';
}

/// La KEY de un objeto, a partir de lo que sea que se tenga: su URL absoluta,
/// una key suelta, o incluso la ruta de un proxy.
///
/// Devuelve `null` cuando la fuente **no es un objeto de nuestro bucket** —una
/// URL externa (el avatar de Google), un `data:`, un `blob:`— para que el host la
/// deje pasar tal cual en vez de proxyarla y romperla.
///
/// Con [publicUrl] la conversión es EXACTA: se quita ese prefijo y ya. Sin ella
/// cae a la heurística de quitar el primer segmento del path, que es lo que
/// hacían los hosts y funciona mientras la base no lleve path — pero deja de
/// funcionar el día que haya un CDN delante, y por eso conviene pasar la base.
String? objectKey(String? source, {String? publicUrl, String? bucket}) {
  if (source == null) return null;
  final s = source.trim();
  if (s.isEmpty || _noEsObjeto.hasMatch(s)) return null;

  final b = bucket != null ? _sinBarras(bucket) : '';

  // Camino RELATIVO: ya es una key, o la ruta de un proxy con la key detrás.
  if (!_esHttp.hasMatch(s)) {
    final limpio = _sinBarras(s).replaceFirst(_prefijoProxy, '');
    return limpio.isEmpty ? null : limpio;
  }

  final u = Uri.tryParse(s);
  if (u == null) return null;

  // Con la base conocida, la conversión es exacta — incluso si lleva path.
  final base = publicUrl != null ? _sinBarras(publicUrl) : '';
  if (base.isNotEmpty) {
    final baseUri = Uri.tryParse(base) ?? u;
    if (u.host != baseUri.host) return null; // otro host: no es nuestro
    final raiz = _sinBarras(_rutaLegible(baseUri));
    var path = _sinBarras(_rutaLegible(u));
    if (raiz.isNotEmpty && path.startsWith('$raiz/')) {
      path = path.substring(raiz.length + 1);
    }
    if (b.isNotEmpty && path.startsWith('$b/')) path = path.substring(b.length + 1);
    return path.isEmpty ? null : path;
  }

  // Sin base: heurística. El primer segmento es el bucket.
  final seg = _sinBarras(_rutaLegible(u)).split('/').where((e) => e.isNotEmpty).toList();
  if (seg.length < 2) return null;
  if (b.isNotEmpty && seg.first != b) return null;
  return seg.skip(1).join('/');
}
