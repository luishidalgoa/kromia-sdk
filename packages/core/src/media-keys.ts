/**
 * KRO-272 — cómo se llaman los objetos de cada uso dentro del bucket.
 *
 * Hasta ahora todo lo del bucket era de un álbum, y la key empezaba por el
 * namespace del publisher (`Album.mediaPrefix`). Con los medios de comunidad
 * entra un segundo tipo de objeto en el mismo espacio de nombres, y hay que
 * poder distinguirlos **por la propia key**: el proxy de imágenes recibe solo la
 * key y a partir de ella tiene que decidir DOS cosas —de qué servidor la baja y
 * quién puede verla— sin poder preguntar a quién pertenece.
 *
 * De ahí el prefijo reservado:
 *
 *     community/<channelId>/<fichero>
 *
 * El `channelId` va DENTRO de la ruta a propósito. La lectura de un objeto de
 * comunidad se gatea por la visibilidad de su canal, así que tenerlo en la key
 * permite resolver el permiso sin buscar antes a qué publicación pertenece — y
 * sin que un objeto quede huérfano de verja si su post se borra.
 *
 * CONSECUENCIA: `community` queda RESERVADO como namespace de primer nivel. Un
 * publisher no puede tener ese `mediaPrefix`, o sus objetos se leerían con el
 * criterio de permisos equivocado.
 */

export const COMMUNITY_MEDIA_PREFIX = 'community';

/** Namespaces de primer nivel que no puede tomar un publisher. */
export const RESERVED_MEDIA_NAMESPACES: readonly string[] = [COMMUNITY_MEDIA_PREFIX];

/** ¿Es la key de un objeto de comunidad (y no de un álbum)? */
export function isCommunityMediaKey(key: string): boolean {
    return normalize(key).startsWith(`${COMMUNITY_MEDIA_PREFIX}/`);
}

/**
 * El `channelId` de una key de comunidad, o `null` si la key no tiene la forma
 * esperada. Devolver `null` —y no lanzar— es deliberado: el caller lo traduce a
 * «no se puede autorizar» y por tanto DENIEGA, que es lo correcto para una key
 * que no reconocemos.
 */
export function channelIdFromCommunityKey(key: string): string | null {
    const partes = normalize(key).split('/');
    if (partes.length < 3) return null;                 // prefijo + canal + fichero
    if (partes[0] !== COMMUNITY_MEDIA_PREFIX) return null;
    const id = partes[1];
    return /^[a-f0-9]{24}$/i.test(id) ? id : null;
}

/** Key de un objeto nuevo de comunidad. El nombre del fichero lo pone el caller. */
export function communityMediaKey(channelId: string, fileName: string): string {
    return `${COMMUNITY_MEDIA_PREFIX}/${channelId}/${fileName}`;
}

function normalize(key: string): string {
    return String(key ?? '').replace(/^\/+/, '');
}
