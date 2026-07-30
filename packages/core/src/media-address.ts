/**
 * KRO-302 — cómo se DIRECCIONA un objeto del bucket.
 *
 * El SDK ya poseía dónde VIVE un objeto (`media-path.ts`: namespace, slug,
 * prefijo del álbum; `media-keys.ts`: el namespace de comunidad). Lo que no
 * poseía era cómo se convierte una key en una URL y al revés — y esa parte
 * acabó escrita **tres veces**, con tres criterios distintos:
 *
 * - el backend construía `${publicUrl}/${bucket}/${key}`;
 * - Studio hacía la inversa quitando el primer segmento **fuera el que fuera**;
 * - Flutter la inversa exigiendo esquema y que el primer segmento fuese el bucket.
 *
 * Divergieron, y el día que el backend guardó la ruta del proxy en vez de la URL
 * del bucket, cada host se rompió de una forma distinta y **ninguno con una
 * excepción**: la app cayó a las iniciales y la web pidió
 * `/api/images/api/images/…`. El síntoma en los dos era «esa foto no se subió
 * bien», que es justo lo contrario de lo que pasaba.
 *
 * ## La regla que fija este módulo
 *
 * **Lo que se GUARDA es la key, o la URL del bucket. La ruta del proxy es cosa
 * del RENDER y no se persiste nunca.** Cada host construye su proxy encima
 * (`/api/images/…` en la web, el suyo en la app) porque el bucket es privado y
 * su URL cruda da 403 — pero eso es cómo se PINTA, no qué se guarda.
 */

/** Dónde vive el bucket. Los dos campos son opcionales a propósito: sin ellos
 *  las funciones degradan a la heurística en vez de fallar. */
export interface BucketLocation {
  /** Base pública del almacenamiento, sin barra final. Puede llevar path (un CDN). */
  publicUrl?: string | null;
  /** Nombre del bucket. */
  bucket?: string | null;
}

/** Lo que NO es un objeto del bucket y hay que dejar pasar tal cual. */
const NO_ES_OBJETO = /^(data:|blob:|mockup:)/i;

const sinBarras = (s: string) => s.replace(/^\/+/, '').replace(/\/+$/, '');

/**
 * La URL con la que se descarga un objeto, a partir de su key.
 *
 * Devuelve `null` si no se sabe dónde vive el bucket: **mejor no dar URL que dar
 * una inventada**, porque una URL que no existe se ve igual que una imagen que
 * no se subió, y manda a quien depure al sitio equivocado.
 */
export function objectUrl(key: string | null | undefined, loc: BucketLocation): string | null {
  if (!key) return null;
  const base = loc.publicUrl ? sinBarras(loc.publicUrl) : '';
  if (!base) return null;
  const bucket = loc.bucket ? sinBarras(loc.bucket) : '';
  const limpia = sinBarras(key);
  return bucket ? `${base}/${bucket}/${limpia}` : `${base}/${limpia}`;
}

/**
 * La KEY de un objeto, a partir de lo que sea que se tenga: su URL absoluta, una
 * key suelta, o incluso la ruta de un proxy.
 *
 * Devuelve `null` cuando la fuente **no es un objeto de nuestro bucket** —una URL
 * externa (el avatar de Google), un `data:`, un `blob:`— para que el host la deje
 * pasar tal cual en vez de proxyarla y romperla.
 *
 * Con `loc.publicUrl` la conversión es EXACTA: se quita ese prefijo y ya. Sin
 * ella cae a la heurística de quitar el primer segmento del path, que es lo que
 * hacían los hosts y funciona mientras la base no lleve path — pero deja de
 * funcionar el día que haya un CDN delante, y por eso conviene pasar la base.
 */
export function objectKey(
  source: string | null | undefined,
  loc: BucketLocation = {},
): string | null {
  if (!source) return null;
  const s = source.trim();
  if (!s || NO_ES_OBJETO.test(s)) return null;

  const bucket = loc.bucket ? sinBarras(loc.bucket) : '';

  // Camino RELATIVO: ya es una key, o la ruta de un proxy con la key detrás.
  if (!/^https?:\/\//i.test(s)) {
    const limpio = sinBarras(s).replace(/^api\/images\//, '');
    return limpio || null;
  }

  let u: URL;
  try { u = new URL(s); } catch { return null; }

  // Con la base conocida, la conversión es exacta — incluso si lleva path.
  const base = loc.publicUrl ? sinBarras(loc.publicUrl) : '';
  if (base) {
    let baseUrl: URL;
    try { baseUrl = new URL(base); } catch { baseUrl = u; }
    if (u.host !== baseUrl.host) return null;   // otro host: no es nuestro
    const raiz = sinBarras(baseUrl.pathname);
    let path = sinBarras(u.pathname);
    if (raiz && path.startsWith(`${raiz}/`)) path = path.slice(raiz.length + 1);
    if (bucket && path.startsWith(`${bucket}/`)) path = path.slice(bucket.length + 1);
    return path || null;
  }

  // Sin base: heurística. El primer segmento es el bucket.
  const seg = sinBarras(u.pathname).split('/').filter(Boolean);
  if (seg.length < 2) return null;
  if (bucket && seg[0] !== bucket) return null;
  return seg.slice(1).join('/');
}
