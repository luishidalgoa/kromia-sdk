/**
 * KRO-265 / Epic KRO-209 — Comunidad del publisher: CANALES + POSTS.
 *
 * Un publisher tiene uno o más CANALES (`Channel`); dentro de un canal se
 * publican POSTS (`Post`). En V1 ("canal de anuncios") solo publican los
 * AUTORIZADOS — este modelo NO decide permisos: el backend los resuelve con el
 * sistema de grants/capability existente (`PublisherGrant` + `evaluateCapability`,
 * deny-by-default). El resto de coleccionistas lee + reacciona.
 *
 * Reparto: el **backend** persiste (canales, posts, reacciones) y valida; **Studio**
 * es la UI de publicación; la app **Flutter** renderiza el timeline y las reacciones.
 * Espejo `core_dart` = handoff a Mobile.
 *
 * DATA social aditiva (dominio nuevo, ajeno al render de cartas) → **NO bumpea el
 * KRP**; entra en el CHANGELOG del SDK bajo `[Unreleased]`. Claves Dart-safe.
 */

/** Tipos de canal. V1 solo `announcements` (unidireccional). Futuro: `discussion` (V2), `events` (V3). */
export const CHANNEL_KINDS = ['announcements', 'discussion', 'events'] as const;
export type ChannelKind = typeof CHANNEL_KINDS[number];

/**
 * Quién puede VER el canal:
 * - `public`     → cualquiera (incluso sin sesión).
 * - `collectors` → quien posee ≥ 1 carta de algún álbum del publisher.
 * - `followers`  → solo seguidores del publisher (`PublisherFollow`, KRO-210).
 */
export const CHANNEL_VISIBILITIES = ['public', 'collectors', 'followers'] as const;
export type ChannelVisibility = typeof CHANNEL_VISIBILITIES[number];

/** Un canal de comunidad de un publisher. */
export interface Channel {
  id:           string;
  publisherId:  string;
  name:         string;            // "Anuncios", "Novedades"
  slug:         string;            // url-friendly, único dentro del publisher
  kind:         ChannelKind;
  visibility:   ChannelVisibility;
  description?: string;
  /** Orden en la barra de canales (menor = antes). Default 0. */
  order?:       number;
  /** Archivado: sigue VISIBLE en read-only, no acepta posts nuevos. Distinto de eliminado. */
  archived?:    boolean;
  /**
   * Soft-delete (tombstone): si presente, el canal está ELIMINADO (oculto).
   * Borrarlo arrastra sus posts — el backend los da por eliminados en cascada
   * (mismo criterio que la cascada de borrado de álbum). Se conserva el registro.
   */
  deletedAt?:   string;
  deletedBy?:   string;
  createdAt:    string;            // ISO
  updatedAt?:   string;
}

/** Adjunto de un post. V1 solo imágenes, servidas por el proxy de medios (MinIO hoy). */
export interface PostAttachment {
  /** Key del objeto en el almacenamiento de medios — se sirve vía `/api/images/<key>`. */
  key:     string;
  kind:    'image';                // V1 solo 'image'
  width?:  number;
  height?: number;
  alt?:    string;                 // texto alternativo (a11y)
}

/** Reacción agregada a un post: un emoji + quiénes reaccionaron. */
export interface PostReaction {
  emoji:   string;                 // uno de POST_REACTION_EMOJIS
  userIds: string[];               // permite contar y saber "¿reaccioné yo?"
}

/** Un post dentro de un canal. */
export interface Post {
  id:           string;
  channelId:    string;
  publisherId:  string;            // denormalizado (queries por publisher)
  authorId:     string;            // quién publicó (autorizado por grant)
  body:         string;            // markdown
  attachments?: PostAttachment[];
  reactions?:   PostReaction[];
  pinned?:      boolean;
  createdAt:    string;            // ISO
  updatedAt?:   string;            // cualquier cambio del registro (reacción, pin…)
  editedAt?:    string;            // si se EDITÓ EL CUERPO tras publicar (UI: "editado")
  editedBy?:    string;            // quién hizo la última edición (puede haber varios autorizados)
  /**
   * Soft-delete (tombstone): si presente, el post está ELIMINADO. Se conserva el
   * registro para moderación/auditoría; la UI lo oculta o muestra "[eliminado]".
   */
  deletedAt?:   string;
  deletedBy?:   string;            // el autor, o un moderador/publisher
}

/**
 * Set CERRADO de emojis de reacción (coherencia cross-host — el "like + N emojis"
 * de KRO-49). Cambiarlo es un cambio de contrato de datos: coordinar con Flutter.
 */
export const POST_REACTION_EMOJIS = ['👍', '❤️', '🔥', '🎉', '👀', '😮'] as const;
export type PostReactionEmoji = typeof POST_REACTION_EMOJIS[number];

/** ¿Es un emoji de reacción permitido? (determinista, cross-host). */
export function isValidReactionEmoji(e: string): e is PostReactionEmoji {
  return (POST_REACTION_EMOJIS as readonly string[]).includes(e);
}

/** Nº de reacciones de un emoji en un post. */
export function reactionCount(post: Post, emoji: string): number {
  return post.reactions?.find(r => r.emoji === emoji)?.userIds.length ?? 0;
}

/** ¿El usuario `userId` reaccionó con ese emoji? */
export function hasReacted(post: Post, emoji: string, userId: string): boolean {
  return post.reactions?.some(r => r.emoji === emoji && r.userIds.includes(userId)) ?? false;
}

/**
 * Normaliza un nombre de canal a un slug url-friendly (minúsculas, sin acentos,
 * separadores a `-`). Determinista y cross-host: Studio muestra el preview del
 * slug y el backend valida su unicidad dentro del publisher con la MISMA regla.
 */
export function channelSlugify(name: string): string {
  return name
    .normalize('NFD').replace(/[̀-ͯ]/g, '') // quita diacríticos
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')                       // no-alfanumérico → guion
    .replace(/^-+|-+$/g, '')                           // recorta guiones extremos
    .slice(0, 48);
}

/** ¿Eliminado (soft-delete)? Vale para `Post` y `Channel` (ambos llevan `deletedAt`). */
export function isDeleted(x: { deletedAt?: string }): boolean {
  return x.deletedAt != null;
}

/** ¿El post fue editado tras publicarse? (para el sello "editado" en la UI). */
export function isEdited(post: Post): boolean {
  return post.editedAt != null;
}

// ── Contratos de validación (compartidos por backend + Studio + Flutter) ──────

/** Límites de contrato de canales y posts. Fuente ÚNICA — no re-declarar en los hosts. */
export const COMMUNITY_LIMITS = {
  channelName:        { min: 1, max: 60 },
  channelSlug:        { min: 1, max: 48 },
  channelDescription: { max: 280 },
  postBody:           { max: 5000 },
  postAttachments:    { max: 10 },
} as const;

/** Un slug válido: minúsculas/números en grupos separados por un solo guion, sin guiones en los extremos. */
const CHANNEL_SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export interface CommunityIssue {
  /** Campo con el problema, p.ej. `name`, `slug`, `attachments[2].key`. */
  field:   string;
  message: string;
}
export interface CommunityValidationResult {
  valid:  boolean;
  issues: CommunityIssue[];
}

/**
 * Valida un canal (creación o edición). Reglas de contrato compartidas: publisher
 * presente, nombre en rango, slug bien formado, `kind`/`visibility` del catálogo,
 * descripción acotada. NO valida permisos ni unicidad del slug (eso es del backend
 * con estado de BD) — solo la FORMA del dato.
 */
export function validateChannel(input: Partial<Channel> | null | undefined): CommunityValidationResult {
  const issues: CommunityIssue[] = [];
  const c = input ?? {};
  if (typeof c.publisherId !== 'string' || c.publisherId.trim() === '')
    issues.push({ field: 'publisherId', message: 'El canal necesita un publisher.' });
  const name = typeof c.name === 'string' ? c.name.trim() : '';
  if (name.length < COMMUNITY_LIMITS.channelName.min || name.length > COMMUNITY_LIMITS.channelName.max)
    issues.push({ field: 'name', message: `El nombre debe tener entre ${COMMUNITY_LIMITS.channelName.min} y ${COMMUNITY_LIMITS.channelName.max} caracteres.` });
  const slug = typeof c.slug === 'string' ? c.slug : '';
  if (!CHANNEL_SLUG_RE.test(slug) || slug.length > COMMUNITY_LIMITS.channelSlug.max)
    issues.push({ field: 'slug', message: 'El slug debe ser minúsculas, números y guiones (sin guiones al inicio o al final).' });
  if (c.kind !== undefined && !CHANNEL_KINDS.includes(c.kind as ChannelKind))
    issues.push({ field: 'kind', message: `Tipo de canal inválido: ${String(c.kind)}.` });
  if (c.visibility !== undefined && !CHANNEL_VISIBILITIES.includes(c.visibility as ChannelVisibility))
    issues.push({ field: 'visibility', message: `Visibilidad inválida: ${String(c.visibility)}.` });
  if (typeof c.description === 'string' && c.description.length > COMMUNITY_LIMITS.channelDescription.max)
    issues.push({ field: 'description', message: `La descripción no puede superar ${COMMUNITY_LIMITS.channelDescription.max} caracteres.` });
  return { valid: issues.length === 0, issues };
}

/**
 * Valida un post (publicación o edición). Un post necesita **cuerpo O al menos un
 * adjunto** (no puede estar vacío). Valida referencias de autor/canal, longitud del
 * cuerpo, adjuntos (key + tipo `image`) y reacciones (emoji del set, sin duplicar).
 */
export function validatePost(input: Partial<Post> | null | undefined): CommunityValidationResult {
  const issues: CommunityIssue[] = [];
  const p = input ?? {};
  if (typeof p.channelId !== 'string' || p.channelId.trim() === '')
    issues.push({ field: 'channelId', message: 'El post necesita un canal.' });
  if (typeof p.authorId !== 'string' || p.authorId.trim() === '')
    issues.push({ field: 'authorId', message: 'El post necesita un autor.' });
  const body = typeof p.body === 'string' ? p.body.trim() : '';
  const attachments = Array.isArray(p.attachments) ? p.attachments : [];
  if (body === '' && attachments.length === 0)
    issues.push({ field: 'body', message: 'El post no puede estar vacío (texto o al menos una imagen).' });
  if (body.length > COMMUNITY_LIMITS.postBody.max)
    issues.push({ field: 'body', message: `El texto no puede superar ${COMMUNITY_LIMITS.postBody.max} caracteres.` });
  if (attachments.length > COMMUNITY_LIMITS.postAttachments.max)
    issues.push({ field: 'attachments', message: `Máximo ${COMMUNITY_LIMITS.postAttachments.max} imágenes por post.` });
  attachments.forEach((a, i) => {
    if (!a || typeof a.key !== 'string' || a.key.trim() === '')
      issues.push({ field: `attachments[${i}].key`, message: 'Adjunto sin referencia de imagen (key).' });
    if (a && a.kind !== 'image')
      issues.push({ field: `attachments[${i}].kind`, message: `Tipo de adjunto no soportado: ${String(a?.kind)}.` });
  });
  if (Array.isArray(p.reactions)) {
    const seen = new Set<string>();
    p.reactions.forEach((r, i) => {
      if (!r || !isValidReactionEmoji(r.emoji))
        issues.push({ field: `reactions[${i}].emoji`, message: `Emoji de reacción no permitido: ${String(r?.emoji)}.` });
      else if (seen.has(r.emoji))
        issues.push({ field: `reactions[${i}].emoji`, message: `Reacción duplicada: ${r.emoji}.` });
      else seen.add(r.emoji);
    });
  }
  return { valid: issues.length === 0, issues };
}
