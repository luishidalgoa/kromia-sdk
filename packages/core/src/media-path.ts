/**
 * KRO-132 — capa PURA del almacenamiento de medios por-álbum.
 *
 * Vive en `@kromia/core` para que el backend (dueño del ciclo de vida del
 * bucket tras la decisión A) y Studio (subida/listado/borrado) deriven EXACTAMENTE
 * la misma ruta y apliquen los mismos límites de cuota (anti-drift, pattern
 * KRO-75/76/78). Un futuro port Dart debe producir los mismos resultados.
 *
 * **Ground truth cross-language**: `tests/media-path.test.ts` es la spec.
 *
 * Esquema de ruta (decidido en KRO-132):
 *   - Álbum independiente → `{usuario}/{albumSlug}/…`
 *   - Álbum de organización → `{orgSlug}/{albumSlug}/…`   (la org "gana" la raíz)
 * El slug se fija al CREAR el álbum (slugify de nombre+edición, deduplicado por
 * el caller) y NO cambia al renombrar → la carpeta es legible y estable.
 *
 * Política de cuota (decidida en KRO-132): dura, anclada al DUEÑO (usuario u
 * organización), nunca a quien sube → invitar editores da acceso, no cuota.
 */

// ── Cuota (política compartida) ──────────────────────────────────────────────

/** Límite duro de almacenamiento por álbum: 400 MB. */
export const ALBUM_MEDIA_QUOTA_BYTES = 400 * 1024 * 1024;

/** Nº de álbumes "de cupo" que cubre el agregado por dueño. */
export const OWNER_MEDIA_ALBUM_ALLOWANCE = 6;

/** Agregado por dueño (usuario u organización): ~2,4 GB (6 × 400 MB). */
export const OWNER_MEDIA_QUOTA_BYTES = ALBUM_MEDIA_QUOTA_BYTES * OWNER_MEDIA_ALBUM_ALLOWANCE;

// ── Slug ─────────────────────────────────────────────────────────────────────

/**
 * Slugify determinista: minúsculas, sin acentos, no-alfanuméricos → guion,
 * guiones recortados en los extremos. Cross-language stable (NFD + strip de
 * diacríticos vía la propiedad Unicode `Diacritic`): "Córdoba" → "cordoba",
 * "España" → "espana".
 *
 * @example
 *   slugify('Semana Santa Córdoba')  // 'semana-santa-cordoba'
 *   slugify('  ¡Hola, Mundo!  ')     // 'hola-mundo'
 *   slugify('2025')                  // '2025'
 */
export function slugify(text: string): string {
  return text
    .normalize('NFD')                    // separa el diacrítico del carácter base
    .replace(/\p{Diacritic}/gu, '')      // elimina los diacríticos
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')         // cualquier run no-alfanumérico → un guion
    .replace(/^-+|-+$/g, '');            // recorta guiones de los extremos
}

/**
 * Slug de la carpeta de un álbum: la edición es una SUB-carpeta del nombre →
 * `{nombre-slug}/{edición-slug}` (o solo `{nombre-slug}` si no hay edición). Así
 * las ediciones del mismo álbum se agrupan bajo la carpeta del nombre. El caller
 * deduplica dentro del namespace del dueño (sufijo `-2`, `-3`… en el último
 * segmento). Si el nombre queda vacío, cae a `'album'`.
 *
 * @example
 *   slugifyAlbumName('Semana Santa Córdoba', '2025')  // 'semana-santa-cordoba/2025'
 *   slugifyAlbumName('Liga', '2024-25')               // 'liga/2024-25'
 *   slugifyAlbumName('Bestiario')                      // 'bestiario'  (sin edición)
 *   slugifyAlbumName('★', '')                          // 'album'      (fallback)
 */
export function slugifyAlbumName(name: string, edition?: string | null): string {
  const nameSlug = slugify(name) || 'album';
  const ed = edition && edition.trim() ? slugify(edition) : '';
  return ed ? `${nameSlug}/${ed}` : nameSlug;
}

/**
 * KRO-132 — slug RESERVADO de la carpeta de medios de un borrador del wizard.
 * El prefijo `__` no lo puede producir `slugify`, así que NUNCA colisiona con un
 * álbum real. Es de UN solo segmento (`{ns}/__draft/`) a propósito; al finalizar
 * se renombra a `{nombre}/{edición}`. Compartido por backend y Studio.
 */
export const DRAFT_MEDIA_SLUG = '__draft';

// ── Ruta del bucket ──────────────────────────────────────────────────────────

export interface AlbumMediaRoot {
  /** username del dueño del álbum (raíz si es independiente). */
  ownerUsername: string;
  /** slug de la organización dueña, si el álbum pertenece a una (gana la raíz). */
  orgSlug?: string | null;
}

/**
 * Namespace raíz del álbum en el bucket: la organización si pertenece a una,
 * si no el usuario dueño. Centraliza la regla "la org gana la raíz".
 *
 * @example
 *   albumMediaNamespace({ ownerUsername: 'ana' })                       // 'ana'
 *   albumMediaNamespace({ ownerUsername: 'ana', orgSlug: 'kromia' })    // 'kromia'
 *   albumMediaNamespace({ ownerUsername: 'ana', orgSlug: '' })          // 'ana'
 */
export function albumMediaNamespace(root: AlbumMediaRoot): string {
  const org = root.orgSlug?.trim();
  return org ? org : root.ownerUsername;
}

export interface AlbumMediaPrefixInput extends AlbumMediaRoot {
  /** slug fijo del álbum (persistido al crear). */
  albumSlug: string;
}

/**
 * Prefijo canónico del directorio de un álbum en el bucket, con `/` final
 * (coherente con la convención previa). Bajo él cuelgan `original/` (subidas) y
 * las carpetas que cree el usuario en el gestor de ficheros.
 *
 * @example
 *   albumMediaPrefix({ ownerUsername: 'ana', albumSlug: 'liga-2025' })
 *     // 'ana/liga-2025/'
 *   albumMediaPrefix({ ownerUsername: 'ana', orgSlug: 'kromia', albumSlug: 'liga-2025' })
 *     // 'kromia/liga-2025/'
 */
export function albumMediaPrefix(input: AlbumMediaPrefixInput): string {
  return `${albumMediaNamespace(input)}/${input.albumSlug}/`;
}
