/**
 * KRO-101 — Autoridad PURA de acceso a medios (capa de capabilities del bucket).
 *
 * Vive en `@kromia/core` para que las DOS superficies que tocan el bucket deriven
 * EXACTAMENTE las mismas reglas (anti-drift, patrón KRO-79/86):
 *   - Studio: rutas `/api/minio/{list,upload,delete}` + `/api/images`.
 *   - Backend: proxy `/api/images` (KRO-138) + ciclo de vida del bucket.
 *
 * Es PURA: no consulta BD ni sesión, solo decide un booleano a partir de los
 * HECHOS que le pasa el caller (username + roles + grants ya resueltos a slug).
 * Cada superficie recoge sus hechos (Studio vía `/users/me` + endpoint de grants;
 * backend vía `getEffectiveGrants`) y llama aquí. La regla NUNCA se duplica.
 *
 * Esquema de namespaces del bucket (decidido en KRO-132, case real en KRO-130):
 *   - `{username}/{albumSlug}/…`  → álbum independiente (raíz = username del dueño)
 *   - `{orgSlug}/{albumSlug}/…`   → álbum de organización (raíz = slug del publisher)
 *   - `__private/…`               → zona privada del sistema (avatares) — no navegable
 *
 * **Ground truth cross-language**: `tests/media-access.test.ts` es la spec.
 */

// ── Acciones ─────────────────────────────────────────────────────────────────

/** Acción sobre un objeto/prefijo del bucket. */
import { isDerivedMediaKey } from './derived-media';

export type MediaAction = 'read' | 'write' | 'list' | 'delete';

// ── Zona privada (avatares) ──────────────────────────────────────────────────

/** Prefijo privado del sistema: NUNCA listable desde "medios". */
export const PRIVATE_PREFIX = '__private/';
/** Subzona de avatares dentro de la zona privada. */
export const AVATAR_PREFIX = `${PRIVATE_PREFIX}avatars/`;

/** Normaliza: quita barras iniciales. */
function norm(path: string): string {
  return path.replace(/^\/+/, '');
}

/** ¿El path vive en una zona privada del sistema (no navegable por "medios")? */
export function isPrivatePath(path: string): boolean {
  return norm(path).startsWith(PRIVATE_PREFIX);
}

/**
 * Path del objeto avatar de un usuario: `__private/avatars/{username}.{ext}`.
 * Vive fuera del namespace `{username}/` para que el gestor de medios (que lista
 * el namespace del usuario) nunca lo muestre, y para restringirlo por permisos
 * de forma independiente.
 */
export function avatarObjectPath(username: string, ext: string): string {
  const safeExt = (ext || 'jpg').replace(/[^a-z0-9]/gi, '').toLowerCase() || 'jpg';
  return `${AVATAR_PREFIX}${username}.${safeExt}`;
}

// ── Hechos que aporta el caller ──────────────────────────────────────────────

/**
 * Grant EFECTIVO del usuario sobre un publisher, ya resuelto a SLUG (la raíz del
 * namespace del bucket). El caller (backend) mapea `publisherId → slug` y, para
 * grants de un solo álbum, `albumId → albumSlug` antes de pasarlos aquí.
 */
export interface MediaGrant {
  /** Slug del publisher = raíz del namespace en el bucket (`{orgSlug}/…`). */
  publisherSlug: string;
  /** `publisher` = toda la organización; `album` = un álbum concreto. */
  scope: 'publisher' | 'album';
  /** Permisos concedidos (vocabulario de grants: `album:write`, `album:read`, …). */
  permissions: string[];
  /** Si `scope === 'album'`, limita a `{publisherSlug}/{albumSlug}/`. */
  albumSlug?: string | null;
}

/** Identidad + permisos del solicitante (los HECHOS de la decisión). */
export interface MediaContext {
  /** username del solicitante = su namespace propio en el bucket. */
  username: string;
  /** Roles del usuario. `admin` mantiene override total (fuera de la zona privada). */
  roles: string[];
  /** Grants efectivos resueltos a slug. Vacío si el user no colabora en ninguna org. */
  grants: MediaGrant[];
}

/** Hechos opcionales que afinan la decisión (rellenados por fases posteriores). */
export interface MediaCapabilityOpts {
  /**
   * Visibilidad del álbum dueño del path, para la regla de `read` (KRO-140).
   * Si se omite → se asume `public` (comportamiento actual: lectura abierta).
   * Cuando KRO-140 cablee el flag, un álbum `private` solo lo leerá el dueño,
   * los miembros del publisher con grant, o admin.
   */
  albumVisibility?: 'public' | 'private';
}

// ── Helpers internos ─────────────────────────────────────────────────────────

/** Primer segmento del path = namespace (username u orgSlug). */
function namespaceOf(p: string): string {
  const slash = p.indexOf('/');
  return slash === -1 ? p : p.slice(0, slash);
}

/** ¿El path cuelga del álbum `{ns}/{albumSlug}/…` (o es esa carpeta exacta)? */
function pathWithinAlbum(p: string, ns: string, albumSlug: string): boolean {
  const base = `${ns}/${albumSlug}`;
  return p === base || p.startsWith(`${base}/`);
}

/** ¿El conjunto de permisos de un grant habilita la acción pedida? */
function grantAllows(permissions: string[], action: MediaAction): boolean {
  const canWrite = permissions.includes('album:write');
  const canRead = canWrite || permissions.includes('album:read');
  switch (action) {
    case 'write':
    case 'delete':
      return canWrite;
    case 'list':
    case 'read':
      return canRead;
    default:
      return false;
  }
}

// ── Autoridad ────────────────────────────────────────────────────────────────

/**
 * ¿Puede `ctx` ejecutar `action` sobre `path` en el bucket de medios?
 *
 * Orden de evaluación (importa):
 *  1. **Zona privada** (`__private/…`) — ANTES que admin a propósito:
 *     - `list`: NUNCA, para nadie (ni admin) → invisible en todo gestor de medios.
 *     - `read/write/delete`: SOLO el dueño de su propio avatar (por PROPIEDAD).
 *  2. **admin** (fuera de la privada): override total.
 *  3. **Namespace propio** (`{username}/…`): control total del dueño.
 *  4. **Namespace de publisher**: si el user tiene un grant sobre ese `orgSlug`
 *     (scope publisher, o scope álbum que cubra el path) con el permiso adecuado.
 *  5. **read público** (KRO-140): si la acción es `read` y el álbum es `public`
 *     (o no se informó la visibilidad → se asume público), cualquiera puede leer.
 *  6. Denegado.
 *
 * NOTA (cambio vs. el comportamiento legacy de Studio): se elimina el escape de
 * rol "editor borra en cualquier namespace" (`canDeleteAny`). El borrado fuera
 * del namespace propio ahora EXIGE grant sobre ese publisher — que es el objetivo
 * de KRO-101 (permisos, no roles dispersos).
 */
export function mediaCapability(
  ctx: MediaContext,
  path: string,
  action: MediaAction,
  opts?: MediaCapabilityOpts,
): boolean {
  const p = norm(path);

  // 0 · Namespace INTERNO de derivados (`__raster/…`) — nadie, nunca, ninguna
  //     acción. Ni siquiera admin, igual que `list` en la zona privada.
  //
  // KRO-338 — no es una precaución teórica: pasó. Los derivados llevan el prefijo
  // del álbum EN MEDIO de la clave, así que ningún host consigue resolver a qué
  // álbum pertenecen; el resolvedor devuelve «sin álbum» y ambos hosts traducían
  // eso a **público**. Resultado: la miniatura de un álbum privado se servía a
  // cualquiera que supiera su URL, saltándose la verja entera.
  //
  // El backend tenía un guard explícito y Studio no, porque el guard se escribió
  // en el host en vez de aquí. Poniéndolo en la AUTORIDAD, un host que se olvide
  // de comprobarlo falla cerrado en vez de abrir un agujero.
  //
  // Estos objetos los escribe y lee el propio servicio con su credencial, que no
  // pasa por aquí; para todo lo demás no existen.
  if (isDerivedMediaKey(p)) return false;

  // 1 · Zona privada (avatares, etc.) — antes del override de admin.
  if (p.startsWith(PRIVATE_PREFIX)) {
    // NUNCA listable, para nadie. Eso es lo que hace «privada» a la carpeta: que
    // no se pueda recorrer ni usar para descubrir qué usuarios existen.
    if (action === 'list') return false;

    // KRO-288 — LEER un avatar concreto lo puede cualquiera identificado.
    //
    // Antes leer estaba limitado al dueño, y era un error de bulto: el avatar es
    // lo más PÚBLICO que tiene una persona aquí. Sale junto a su nombre en el
    // ranking del álbum, en descubrir creadores, en los seguidores, en los
    // asistentes de una quedada y en el autor de cada publicación y respuesta.
    // Con la regla vieja, cada usuario veía su propia cara y la de nadie más:
    // todo lo demás caía a iniciales por un 403.
    //
    // La confusión estaba en haber cumplido «que no se fisgue la carpeta»
    // prohibiendo LEER, cuando lo que hacía falta era prohibir LISTAR. Para leer
    // hay que saber el nombre exacto, y ese ya se conoce: viene en la publicación
    // o en el asistente que estás mirando.
    if (p.startsWith(AVATAR_PREFIX)) {
      if (action === 'read') return ctx.username !== '';
      // ESCRIBIR y BORRAR siguen siendo solo del dueño: que tu cara la vea
      // cualquiera no significa que cualquiera pueda cambiarla.
      return p.startsWith(`${AVATAR_PREFIX}${ctx.username}.`);
    }

    // Cualquier otra cosa bajo `__private/` sigue siendo solo del dueño.
    if (p.startsWith(`${PRIVATE_PREFIX}${ctx.username}/`)) {
      return action === 'read' || action === 'write' || action === 'delete';
    }
    return false;
  }

  // 2 · admin: override total fuera de la zona privada.
  if (ctx.roles.includes('admin')) return true;

  const ns = namespaceOf(p);

  // 3 · Namespace propio del usuario.
  if (ns !== '' && ns === ctx.username) return true;

  // 4 · Namespace de un publisher donde el user tiene grant.
  for (const g of ctx.grants) {
    if (g.publisherSlug !== ns) continue;
    if (g.scope === 'album') {
      if (!g.albumSlug || !pathWithinAlbum(p, ns, g.albumSlug)) continue;
    }
    if (grantAllows(g.permissions, action)) return true;
  }

  // 5 · Lectura pública (KRO-140 la afinará con la visibilidad real).
  if (action === 'read' && (opts?.albumVisibility ?? 'public') === 'public') {
    return true;
  }

  // 6 · Denegado.
  return false;
}
