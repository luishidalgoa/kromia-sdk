/**
 * KRO-314 — normalizar el valor de un campo-imagen antes de pintarlo.
 *
 * Existe por un fallo real y silencioso. Los renderers hacían esto:
 *
 * ```ts
 * const bannerUrl = banner?.fields[0]?.value as string | undefined;
 * ```
 *
 * Ese `as string` es una AFIRMACIÓN, no una comprobación: si el campo del slot
 * es `array<image>`, el valor es un array, TypeScript se calla porque se lo han
 * jurado, y quien lo recibe lo coacciona a texto. En web sale
 * `"/api/images/a.svg,/api/images/b.svg,…"` en el `src` —cuatro URLs pegadas por
 * el `toString()` de Array— y la imagen no carga. Sin error, sin aviso: solo un
 * hueco donde debería estar la portada.
 *
 * Y el fallo va en las DOS direcciones: un slot de galería con `as string[]`
 * recibiendo un `image` suelto tampoco es un array, y ahí revienta o itera
 * carácter a carácter.
 *
 * Por eso vive en el SDK y no en cada host: es la misma decisión en web y en
 * Flutter, y repetirla es exactamente cómo aparecieron las nueve copias.
 *
 * **No sanea la URL ni la proxya** — eso es de cada host (Studio la reescribe a
 * `/api/images/<key>` en su frontera). Esto solo decide *cuántas* imágenes hay y
 * *en qué orden*.
 */

/** Un valor de campo-imagen (uno o varios) → siempre una lista, sin huecos. */
export function imageUrls(value: unknown): string[] {
  if (typeof value === 'string') return value.trim() ? [value] : [];
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === 'string' && v.trim() !== '');
}

/**
 * La PRIMERA imagen, para un slot que solo puede pintar una (banner, avatar,
 * miniatura). Devuelve `undefined` cuando no hay ninguna, que es lo que esos
 * componentes ya esperan para dibujar su hueco o la inicial del título.
 *
 * Colapsar a la primera y no rechazar: un `array<image>` en un banner es una
 * combinación que el editor permite, y enseñar la primera es lo que el usuario
 * quiere decir. `imageCount` deja pintar el «+N» a quien pueda.
 */
export function firstImageUrl(value: unknown): string | undefined {
  return imageUrls(value)[0];
}

/** Cuántas imágenes hay de verdad. Para el chip «+N» de los slots colapsados. */
export function imageCount(value: unknown): number {
  return imageUrls(value).length;
}
