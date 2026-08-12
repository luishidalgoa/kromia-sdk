/// KRO-335 — el ancho de un DERIVADO de imagen. Espejo de
/// `packages/core/src/derived-media.ts`.
///
/// Vive en el SDK y no en cada host por un motivo concreto: **Studio y el
/// backend sirven los dos el mismo `/api/images`**, cada uno con su
/// implementación. Studio aceptaba un ancho libre y rehacía el resize en cada
/// petición; el backend usa una lista cerrada y cachea el resultado. Dos
/// contratos distintos para el mismo `?w=`.
///
/// Es el patrón que ya costó KRO-302 —`objectKey` escrito tres veces con tres
/// criterios—, pero aquí el precio de divergir sería peor que una imagen rota:
/// sería **caché partida**, cada host generando su propio derivado del mismo
/// objeto, pagando el doble y ocupando el doble.
///
/// De la parte de la CLAVE del derivado solo se espeja lo que la app necesita —
/// pedir el ancho—: componer la clave con el ETag es cosa de quien sirve, no de
/// quien pide.
library;

/// Anchos PERMITIDOS de derivado.
///
/// Una lista cerrada y no un número libre, por dos motivos. Uno: cada ancho
/// distinto es un objeto más en el bucket, y con ancho libre cualquiera puede
/// fabricar miles pidiendo `?w=101`, `?w=102`… Dos: la app solo necesita un
/// puñado de tamaños reales; los intermedios no se distinguen.
const List<int> derivedWidths = [96, 240, 480, 960, 1600];

/// El ancho efectivo para un `?w=` pedido, o `null` si no se pidió (o no es un
/// número usable).
///
/// **Redondea HACIA ARRIBA** al primero que lo cubra, nunca hacia abajo: servir
/// menos píxeles que la celda se ve borroso, y evitar eso es medio motivo de que
/// este sistema exista. Un ancho desmedido se acota al mayor de la lista en vez
/// de fabricar un objeto a medida.
///
/// `null` significa **«no se pidió»**, y el host sirve el original. Inventar un
/// ancho por defecto aquí serviría una imagen que nadie pidió.
int? snapDerivedWidth(Object? raw) {
  final n = raw is num ? raw.toDouble() : double.tryParse('$raw');
  if (n == null || !n.isFinite || n <= 0) return null;
  for (final a in derivedWidths) {
    if (a >= n) return a;
  }
  return derivedWidths.last;
}
