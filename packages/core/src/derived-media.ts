/**
 * KRO-331 — la clave de un DERIVADO de imagen (miniatura o rasterizado).
 *
 * Vive en el SDK y no en cada host por un motivo concreto: **Studio y el backend
 * sirven las dos el mismo `/api/images`**, cada uno con su implementación. Studio
 * aceptaba un ancho libre (1..MAX) y rehacía el resize en cada petición; el
 * backend usa una lista cerrada y cachea el resultado en el bucket. Dos
 * contratos distintos para el mismo `?w=`.
 *
 * Es exactamente el patrón que ya nos costó KRO-302: `objectKey` estaba escrito
 * tres veces con tres criterios y divergieron, y el síntoma fue «en la web se ve
 * y en la app no». Aquí el precio de divergir sería peor que una imagen rota —
 * sería **caché partida**: cada host generando su propio derivado del mismo
 * objeto, pagando el doble y ocupando el doble.
 *
 * Con una sola definición, quien pida primero genera y el otro se lo encuentra
 * hecho.
 *
 * Son funciones PURAS y no entran en el `.json` del KRP: no bumpean
 * `protocolVersion` (mismo criterio que `imageUrls`, KRO-314).
 */

/**
 * Namespace de los derivados, en la RAÍZ del bucket.
 *
 * Va en la raíz a propósito: así queda fuera de los álbumes y por tanto
 * **invisible en el gestor de medios**, que es lo que impide que alguien borre
 * a mano un fichero que no sabe que existe. Los hosts además bloquean el acceso
 * directo a este prefijo.
 */
export const DERIVED_PREFIX = '__raster/' as const;

/**
 * Versión del formato de la clave. Subirla deja huérfano TODO lo generado antes
 * — es el botón de «invalidar la caché entera» y no hay otro.
 *
 * `v3` = la clave lleva el ETag del original y el ancho.
 */
export const DERIVED_CACHE_VERSION = 'v3' as const;

/**
 * Anchos PERMITIDOS de derivado.
 *
 * Una lista cerrada y no un número libre, por dos motivos. Uno: cada ancho
 * distinto es un objeto más en el bucket, y con el ancho libre cualquiera puede
 * fabricar miles pidiendo `?w=101`, `?w=102`… Dos: el navegador y la app solo
 * necesitan un puñado de tamaños reales; los intermedios no se distinguen.
 */
export const DERIVED_WIDTHS = [96, 240, 480, 960, 1600] as const;

/**
 * El ancho efectivo para un `?w=` pedido, o `null` si no se pidió (o no es un
 * número usable).
 *
 * **Redondea HACIA ARRIBA** al primero que lo cubra, nunca hacia abajo: servir
 * menos píxeles que la celda se ve borroso, y evitar eso es medio motivo de que
 * este sistema exista. Un ancho desmedido se acota al mayor de la lista en vez
 * de fabricar un objeto a medida.
 */
export function snapDerivedWidth(raw: unknown): number | null {
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return null;
  return DERIVED_WIDTHS.find(a => a >= n) ?? DERIVED_WIDTHS[DERIVED_WIDTHS.length - 1];
}

/**
 * La clave del derivado, que lleva el **ETag del original**.
 *
 * Es lo que hace **imposible** una caché vieja, en vez de vigilada: si alguien
 * sube otra imagen bajo la misma key, su ETag cambia → cambia esta clave → el
 * derivado que se pide no existe → se genera. No hay nada que invalidar, porque
 * no hay nada que *acordarse* de invalidar.
 *
 * Y eso importa más de lo que parece: hay cinco rutas de escritura fuera de
 * Studio (automatización, migraciones, backfills, rename de clave primaria,
 * seed). Un guard «al guardar» sería ciego a todas ellas; el único punto por el
 * que pasa todo es la lectura.
 *
 * El fallo degrada de «se sirve una imagen vieja» a «se trabaja una vez de
 * más», que es un fallo que no duele.
 *
 * @param key   clave del objeto ORIGINAL dentro del bucket
 * @param etag  ETag del original (sale del `stat`; es una cabecera, no bytes)
 * @param width ancho del derivado, ya pasado por {@link snapDerivedWidth}
 * @param ext   extensión del derivado (`png` para un SVG rasterizado)
 */
export function derivedMediaKey(key: string, etag: string, width: number, ext: string): string {
  // Se limpia PRIMERO y se cae al literal después: al revés, el propio
  // limpiador se comería el guion del literal de reserva.
  const limpio = String(etag ?? '').replace(/[^a-zA-Z0-9]/g, '').slice(0, 16);
  return `${DERIVED_PREFIX}${DERIVED_CACHE_VERSION}/${limpio || 'sin-etag'}/${width}/${key}.${ext}`;
}

/** ¿Esta clave es un derivado nuestro? Los hosts lo usan para NO servirlo directo. */
export function isDerivedMediaKey(key: string): boolean {
  return key.startsWith(DERIVED_PREFIX);
}
