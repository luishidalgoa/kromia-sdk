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

/** El perfil tal y como lo devuelve el servidor: lo escrito + lo calculado. */
export interface PublisherProfile extends PublisherProfileEditable, PublisherProfileComputed {
  publisherId: string;
  slug: string;
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
