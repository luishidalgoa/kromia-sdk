/**
 * KRO-285 — el PERFIL PÚBLICO de un publisher.
 *
 * Hasta aquí un publisher no tenía identidad propia: su modelo era `slug` +
 * `name` + `ownerId`, y la cara que se veía era el avatar de la persona dueña de
 * la cuenta. Este es el contrato de lo que puede enseñar.
 *
 * ## La división que gobierna todo el tipo
 *
 * Los campos se parten en dos, y la separación no es cosmética:
 *
 * - **EDITABLES** — los escribe el publisher desde Studio (con `profile:manage`).
 * - **CALCULADOS** — los pone el servidor al leer. No se guardan en el perfil ni
 *   se aceptan al escribir: un número de seguidores que el propio publisher
 *   pudiera fijar no es un dato, es un cartel.
 *
 * Está así porque quien edita su perfil tiene que entender **qué controla él y
 * qué no**. Si los dos grupos llegaran mezclados, la interfaz acabaría pintando
 * un campo «seguidores» que no se puede tocar y nadie sabría por qué.
 *
 * ## Cada campo vacío tiene su forma, y es parte del contrato
 *
 * Un perfil recién creado no tiene nada, y es justo el que más necesita no dar
 * pena. Lo que se hace con cada hueco lo decide el HOST, pero el contrato lo
 * permite explícitamente: todos los editables salvo el nombre son opcionales.
 */

// ── Quién hay detrás ─────────────────────────────────────────────────────────

/**
 * KRO-295 — de qué está hecho el perfil que se está mirando.
 *
 * Es una **discriminante, no un tipo distinto**: los tres comparten forma para
 * que el host pinte UNA sola pantalla. Lo que cambia no es el diseño, es de
 * dónde sale el dato y quién manda:
 *
 * - `publisher` — una organización. El perfil se ESCRIBE (con `profile:manage`).
 * - `creator` — una persona a título personal, sin publisher. El perfil se
 *   DERIVA de lo que ya se sabe de ella; no hay nada que configurar, así que
 *   `canManage` es siempre `false` y la banda es siempre la neutra.
 * - `unknown` — ya no hay nadie detrás: la cuenta se dio de baja y el álbum
 *   quedó huérfano (KRO-267). **No es un error**, y el host no debe pintarlo
 *   como tal: el álbum existe y quien llegó siguió un enlace que funcionaba.
 *
 * Sin esta marca el host tendría que adivinar a qué endpoint llamar ANTES de
 * saber qué está mirando, que es justo lo que no sabe al llegar desde un enlace.
 */
export const PROFILE_KINDS = ['publisher', 'creator', 'unknown'] as const;
export type ProfileKind = typeof PROFILE_KINDS[number];

/**
 * A quién apunta un álbum. Lo resuelve el SERVIDOR y el host solo lo sigue.
 *
 * Existe porque el álbum es el punto de entrada al perfil, y hasta ahora no
 * llevaba encima nada con lo que enlazar: solo ids crudos. Con esto, la
 * referencia dentro del álbum se pinta con una sola petición y sin que el host
 * decida nada.
 */
export interface AlbumCreatorRef {
  kind: ProfileKind;
  /**
   * Con qué pedir el perfil completo. **Ausente si `kind` es `unknown`**: no
   * hay perfil que pedir, y mandar al host a una petición que va a fallar es
   * peor que decirle desde el principio que no hay nadie.
   */
  ref?: string;
  /** Lo justo para pintar la referencia sin una segunda petición. */
  displayName?: string;
  logoUrl?: string | null;
}

// ── Color de la banda ────────────────────────────────────────────────────────

/**
 * Los colores que puede tener la banda de la cabecera.
 *
 * **Conjunto CERRADO, no un hex libre.** Un selector de color arbitrario deja
 * elegir el gris del fondo o un fucsia que se pelea con todo, y el perfil deja
 * de parecer parte de Kromia. Con un conjunto cerrado, cada host traduce el
 * token a su propio valor —la web a CSS, la app a `Color`— y ninguno inventa.
 *
 * `neutral` existe a propósito y es el DEFAULT: es la banda de quien no ha
 * elegido, y tiene que verse deliberada, no a medio hacer.
 */
export const PROFILE_BAND_COLORS = [
  'neutral', 'green', 'mint', 'peach', 'orange', 'gold', 'violet',
] as const;
export type ProfileBandColor = typeof PROFILE_BAND_COLORS[number];

export const DEFAULT_BAND_COLOR: ProfileBandColor = 'neutral';

/**
 * El valor de marca de cada banda, y qué color de texto se lee encima.
 *
 * Se guarda el MISMO literal que usa la paleta del diseño (`colors_and_type.css`)
 * para que web y app pinten idéntico. El host convierte: la web usa el hex tal
 * cual, la app lo pasa por su helper de `Color`.
 *
 * El `fg` va aquí y no lo decide cada host porque es lo que garantiza que el
 * nombre del publisher se LEA sobre su banda. Dejarlo al criterio de cada uno
 * es cómo aparece un texto blanco sobre oro.
 */
export const BAND_COLOR_VALUES: Record<ProfileBandColor, { bg: string; fg: string }> = {
  neutral: { bg: '#F5F1E8', fg: '#1A2E1A' },
  green:   { bg: '#2D6B45', fg: '#FFFFFF' },
  mint:    { bg: '#B4DDD8', fg: '#1A2E1A' },
  peach:   { bg: '#F5DEC0', fg: '#B5651D' },
  orange:  { bg: '#E07B39', fg: '#FFFFFF' },
  gold:    { bg: '#F0B429', fg: '#1A2E1A' },
  violet:  { bg: '#6D4AA7', fg: '#FFFFFF' },
};

export function isBandColor(v: unknown): v is ProfileBandColor {
  return typeof v === 'string' && (PROFILE_BAND_COLORS as readonly string[]).includes(v);
}

// ── Límites ──────────────────────────────────────────────────────────────────

export const PROFILE_LIMITS = {
  /** El nombre visible. Puede diferir del `name` interno del publisher. */
  displayName: { min: 1, max: 60 },
  /**
   * El lema, de UNA línea. El tope corto es la forma de que lo sea: con 200
   * caracteres deja de ser un lema y se convierte en la descripción otra vez, y
   * entonces el diseño tiene dos párrafos donde quería un gancho.
   */
  tagline:     { max: 80 },
  description: { max: 600 },
  /** La ciudad. Texto libre a propósito: no hay catálogo de ciudades ni falta. */
  city:        { max: 60 },
} as const;

// ── El tipo ──────────────────────────────────────────────────────────────────

/** Lo que el publisher escribe. Todo opcional salvo el nombre. */
export interface PublisherProfileEditable {
  displayName: string;
  /**
   * La key del logo en el bucket, NO una URL. La URL la construye el host con
   * su proxy —el bucket es privado y su URL cruda da 403—, así que guardar una
   * URL aquí la ataría al host que la escribió.
   */
  logoKey?: string;
  bandColor?: ProfileBandColor;
  tagline?: string;
  description?: string;
  city?: string;
}

/**
 * Lo que pone el SERVIDOR al leer. Nunca se acepta al escribir.
 *
 * `lastPostAt` puede faltar —un publisher que no ha publicado nada— y eso NO es
 * un error: es el perfil recién creado, que es un estado normal y frecuente.
 */
export interface PublisherProfileComputed {
  followersCount: number;
  albumsCount: number;
  editionsCount: number;
  joinedAt: string;              // ISO
  lastPostAt?: string;           // ISO
}

/**
 * Una edición concreta dentro del catálogo del perfil.
 *
 * `owned` es el distintivo «lo coleccionas» del diseño: lo resuelve el servidor
 * contra quien mira, porque el host no tiene con qué saberlo sin otra petición.
 */
export interface ProfileAlbumEdition {
  _id: string;
  edition: string;
  albumType?: string;
  cover?: string | null;
  slug?: string | null;
  owned: boolean;
}

/**
 * Una obra y sus entregas. **Un álbum NO es una edición**: por eso las ediciones
 * cuelgan del nombre en vez de ser filas sueltas, y por eso `albumsCount` y
 * `editionsCount` son cifras distintas.
 */
export interface ProfileAlbum {
  name: string;
  editions: ProfileAlbumEdition[];
}

/**
 * El catálogo agrupado por categoría, **ya ordenado por el servidor** para que
 * todos los hosts enseñen la misma lista.
 *
 * `category: null` es el grupo de los que no tienen categoría, y va al FINAL: un
 * álbum publicado que no se ve porque nadie le puso etiqueta es peor que una
 * categoría fea.
 */
export interface ProfileAlbumGroup {
  category: string | null;
  albums: ProfileAlbum[];
}

/** El perfil tal y como lo devuelve el servidor: lo escrito + lo calculado. */
export interface PublisherProfile extends PublisherProfileEditable, PublisherProfileComputed {
  publisherId: string;
  slug: string;
  /**
   * La URL con la que se PINTA el logo, ya resuelta por el servidor.
   *
   * Va aparte de `logoKey` y no es redundante: `logoKey` es lo que se GUARDA y
   * `logoUrl` lo que se MUESTRA. Además cae al avatar del dueño cuando el
   * publisher no tiene logo propio, así que un host que construyera la URL a
   * partir de la key dejaría sin cara justo a quien no ha elegido ninguna.
   */
  logoUrl?: string | null;
  /**
   * Señal de perfil a medio hacer. La calcula el servidor con `profileIsBare`
   * sobre lo que de verdad va a servir —que no es siempre lo guardado: un perfil
   * en privado sale sin descripción—, así que el host la lee, no la recalcula.
   */
  isBare?: boolean;
  /** Su catálogo, agrupado y ordenado. Ver `ProfileAlbumGroup`. */
  albumGroups?: ProfileAlbumGroup[];
  /**
   * KRO-295 — de qué está hecho esto. Un `creator` trae la misma forma con los
   * campos derivados y `canManage: false`; el host no cambia de pantalla.
   */
  kind?: ProfileKind;
  /** ¿Sigue el que mira a este publisher? Decide el escaparate frente al interior. */
  isFollowing?: boolean;
  /** ¿Puede el que mira EDITAR este perfil? (`profile:manage` o dueño). */
  canManage?: boolean;
}

// ── Validación ───────────────────────────────────────────────────────────────

export interface ProfileIssue { field: string; message: string }
export interface ProfileValidationResult { valid: boolean; issues: ProfileIssue[] }

/**
 * Valida lo EDITABLE de un perfil. No mira los calculados a propósito: si
 * llegaran en el cuerpo de una escritura, el backend los ignora — no los
 * rechaza. Un cliente que reenvíe el objeto entero que acaba de leer es un
 * cliente razonable, y hacerle fallar por eso solo obliga a limpiar a mano.
 */
export function validatePublisherProfile(
  input: Partial<PublisherProfileEditable> | null | undefined,
): ProfileValidationResult {
  const issues: ProfileIssue[] = [];
  const p = input ?? {};

  const nombre = typeof p.displayName === 'string' ? p.displayName.trim() : '';
  if (nombre.length < PROFILE_LIMITS.displayName.min || nombre.length > PROFILE_LIMITS.displayName.max) {
    issues.push({
      field: 'displayName',
      message: `El nombre debe tener entre ${PROFILE_LIMITS.displayName.min} y ${PROFILE_LIMITS.displayName.max} caracteres.`,
    });
  }

  const tope = (campo: 'tagline' | 'description' | 'city', etiqueta: string) => {
    const v = p[campo];
    if (typeof v === 'string' && v.trim().length > PROFILE_LIMITS[campo].max) {
      issues.push({ field: campo, message: `${etiqueta} no puede superar ${PROFILE_LIMITS[campo].max} caracteres.` });
    }
  };
  tope('tagline', 'El lema');
  tope('description', 'La descripción');
  tope('city', 'La ciudad');

  if (p.bandColor !== undefined && !isBandColor(p.bandColor)) {
    issues.push({ field: 'bandColor', message: `Color de banda no válido: ${String(p.bandColor)}.` });
  }

  return { valid: issues.length === 0, issues };
}

/**
 * ¿Está el perfil lo bastante hecho como para que merezca la pena abrirlo?
 *
 * No es una validación: un perfil vacío es válido. Es la señal para que el host
 * pueda sugerirle al publisher que lo remate —y para no empujar a nadie a un
 * perfil que no dice nada de quién es.
 */
export function profileIsBare(p: Partial<PublisherProfileEditable> | null | undefined): boolean {
  if (!p) return true;
  const vacio = (v?: string) => !v || v.trim() === '';
  return vacio(p.tagline) && vacio(p.description) && vacio(p.logoKey);
}
