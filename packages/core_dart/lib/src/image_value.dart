/// KRO-314 — normalizar el valor de un campo-imagen antes de pintarlo.
///
/// Espejo de `packages/core/src/image-value.ts`.
///
/// Existe por un fallo real y silencioso en la web. Los renderers hacían esto:
///
/// ```ts
/// const bannerUrl = banner?.fields[0]?.value as string | undefined;
/// ```
///
/// Ese `as string` es una AFIRMACIÓN, no una comprobación: si el campo del slot
/// es `array<image>`, el valor es un array, TypeScript se calla porque se lo han
/// jurado, y quien lo recibe lo coacciona a texto. Sale
/// `"/api/images/a.svg,/api/images/b.svg,…"` en el `src` —varias URLs pegadas por
/// el `toString()` de Array— y la imagen no carga. Sin error, sin aviso: solo un
/// hueco donde debería ir la portada.
///
/// **En Dart ese fallo no se podía escribir**, y conviene saber por qué: aquí el
/// valor llega como `Object?` y no hay forma de pintarlo sin decidir antes qué
/// es, así que los dos sitios del renderer ya lo hacían bien cada uno por su
/// cuenta. Esto se espeja igualmente porque «cada uno por su cuenta» repetido es
/// exactamente cómo nacieron las nueve copias del lado TS.
///
/// El fallo va en las DOS direcciones: un slot de galería que espere lista y
/// reciba una imagen suelta tampoco tiene un array.
///
/// **No sanea la URL ni la proxya** — eso es de cada host. Esto solo decide
/// *cuántas* imágenes hay y *en qué orden*.
library;

/// Un valor de campo-imagen (una o varias) → siempre una lista, sin huecos.
List<String> imageUrls(Object? value) {
  if (value is String) return value.trim().isEmpty ? const [] : [value];
  if (value is! List) return const [];
  return [
    for (final v in value)
      if (v is String && v.trim().isNotEmpty) v,
  ];
}

/// La PRIMERA imagen, para un slot que solo puede pintar una (banner, avatar,
/// miniatura). `null` cuando no hay ninguna, que es lo que esos componentes ya
/// esperan para dibujar su hueco o la inicial del título.
///
/// Colapsa a la primera y no rechaza: un `array<image>` en un banner es una
/// combinación que el editor permite, y enseñar la primera es lo que el usuario
/// quiere decir. [imageCount] deja pintar el «+N» a quien pueda.
String? firstImageUrl(Object? value) {
  final urls = imageUrls(value);
  return urls.isEmpty ? null : urls.first;
}

/// Cuántas imágenes hay de verdad. Para el chip «+N» de los slots colapsados.
int imageCount(Object? value) => imageUrls(value).length;
