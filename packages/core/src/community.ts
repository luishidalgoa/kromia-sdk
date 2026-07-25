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
   * KRO-265 (diseño) — ¿se puede reaccionar en este canal? Es propiedad del CANAL,
   * no del post: al apagarlo, los posts pierden la fila de emojis y el muro avisa.
   * Ausente = true (retro-compat: los canales existentes ya permiten reaccionar).
   */
  reactionsEnabled?: boolean;
  /**
   * KRO-265 (diseño) — ¿cada publicación avisa a los seguidores? Ausente = true
   * (el fan-out de KRO-211 es el comportamiento por defecto del canal de anuncios).
   */
  notifyFollowers?: boolean;
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

/**
 * Adjunto de un post — **unión discriminada por `kind`** (KRO-272).
 *
 * Nace extensible a propósito: añadir una variante nueva (`card-ref` está ya
 * previsto) es ADITIVO y no rompe a nadie, porque cada variante lleva solo sus
 * propios campos y los hosts ignoran los `kind` que no conocen. Si esto fuera
 * un objeto plano con todo opcional, un `album-ref` tendría que rellenar `key`
 * con basura y nadie sabría qué campos son obligatorios en cada caso.
 *
 * Las referencias internas guardan **solo el id**, nunca datos derivados
 * (nombre, portada): el preview se resuelve al leer, así no miente cuando el
 * álbum se renombra o cambia de imagen.
 */
export type PostAttachment =
  | PostImageAttachment
  | PostFileAttachment
  | PostAlbumRefAttachment
  | PostLinkAttachment;

/** Imagen subida por el publisher; se sirve por el proxy de medios. */
export interface PostImageAttachment {
  kind:    'image';
  /** Key del objeto en el almacenamiento — se sirve vía `/api/images/<key>`. */
  key:     string;
  width?:  number;
  height?: number;
  alt?:    string;                 // texto alternativo (a11y)
}

/** Fichero adjunto. Whitelist ESTRICTA: hoy solo PDF (ver `COMMUNITY_LIMITS.file`). */
export interface PostFileAttachment {
  kind:  'file';
  key:   string;
  mime:  string;                   // debe estar en COMMUNITY_LIMITS.file.mimes
  size:  number;                   // bytes; tope en COMMUNITY_LIMITS.file.maxBytes
  name?: string;                   // nombre visible para descargar
}

/** Referencia a un álbum del propio publisher. El host pinta la tarjeta embebida. */
export interface PostAlbumRefAttachment {
  kind:    'album-ref';
  albumId: string;
}

/** Enlace externo. V1 muestra SOLO el dominio — el servidor no visita la URL. */
export interface PostLinkAttachment {
  kind: 'link';
  url:  string;                    // http/https únicamente
}

/** Los `kind` que este SDK sabe validar. Uno fuera de esta lista se IGNORA, no invalida. */
export const ATTACHMENT_KINDS = ['image', 'file', 'album-ref', 'link'] as const;
export type PostAttachmentKind = typeof ATTACHMENT_KINDS[number];

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

/**
 * ¿Se puede reaccionar en este canal? Ausente = SÍ (retro-compat). Fuente única
 * para los tres hosts: el backend rechaza la reacción y la UI oculta la fila.
 */
export function reactionsAllowed(channel: Pick<Channel, 'reactionsEnabled'> | null | undefined): boolean {
  return channel?.reactionsEnabled !== false;
}

/** ¿Publicar en este canal avisa a los seguidores? Ausente = SÍ (retro-compat). */
export function notifiesFollowers(channel: Pick<Channel, 'notifyFollowers'> | null | undefined): boolean {
  return channel?.notifyFollowers !== false;
}

// ── Contratos de validación (compartidos por backend + Studio + Flutter) ──────

/** Límites de contrato de canales y posts. Fuente ÚNICA — no re-declarar en los hosts. */
export const COMMUNITY_LIMITS = {
  channelName:        { min: 1, max: 60 },
  channelSlug:        { min: 1, max: 48 },
  channelDescription: { max: 280 },
  postBody:           { max: 2000 },
  postAttachments:    { max: 10 },
  /**
   * Cuántas publicaciones pueden estar fijadas a la vez en un canal. Fijar es un
   * recurso ESCASO a propósito: si todo está fijado, nada destaca. El host debe
   * negar la fijación número 4 y decir cuál desfijar.
   */
  pinnedPerChannel:   { max: 3 },
  /**
   * Ficheros adjuntos (KRO-272). Whitelist ESTRICTA por decisión del user: solo
   * PDF, y tope de 60 MB. Vive aquí para que backend, Studio y Flutter apliquen
   * el MISMO límite — si cada host pusiera el suyo, el más permisivo mandaría.
   */
  file: {
    maxBytes: 60 * 1024 * 1024,          // 60 MB
    mimes:    ['application/pdf'] as readonly string[],
  },
  /**
   * Imágenes adjuntas. Tope MUY inferior al de los ficheros a propósito: una
   * imagen de muro se ve a un par de miles de píxeles, y lo que pasa de ahí es
   * casi siempre un original sin redimensionar que solo cuesta ancho de banda.
   * El PDF es distinto —se descarga entero y su tamaño es intrínseco—, por eso
   * tiene su propio límite.
   */
  image: {
    maxBytes: 10 * 1024 * 1024,          // 10 MB
    mimes:    ['image/jpeg', 'image/png', 'image/webp', 'image/gif'] as readonly string[],
  },
} as const;

/** Motivo por el que una subida no se autoriza, o `null` si es aceptable. */
export type UploadRejection =
  | { reason: 'kind'; message: string }
  | { reason: 'mime'; message: string }
  | { reason: 'size'; message: string };

/**
 * ¿Se puede AUTORIZAR esta subida? Se comprueba antes de firmar nada: negar
 * aquí ahorra subir 60 MB para rechazarlos al final.
 *
 * Vive en el SDK porque los tres hosts tienen que aplicar el mismo límite. Si
 * cada uno pusiera el suyo mandaría el más permisivo — basta con que UN cliente
 * se salte el tope para que el objeto acabe en el bucket.
 *
 * OJO a lo que esto NO es: valida lo que el cliente DICE que va a subir. No
 * sustituye ni a las condiciones que se firman en la política (esas las hace
 * cumplir el servidor de almacenamiento) ni a comprobar el contenido REAL una
 * vez subido — el `Content-Type` lo elige quien sube, y renombrar un `.exe` a
 * `.pdf` no puede colar.
 */
export function validateAttachmentUpload(
  kind: 'image' | 'file',
  mime: string,
  size: number,
): UploadRejection | null {
  if (kind !== 'image' && kind !== 'file') {
    return { reason: 'kind', message: 'Solo se pueden subir imágenes y ficheros.' };
  }
  const limite = kind === 'image' ? COMMUNITY_LIMITS.image : COMMUNITY_LIMITS.file;

  // El `Content-Type` puede venir con parámetros («application/pdf; charset=…»).
  const normalizado = String(mime ?? '').trim().toLowerCase().split(';')[0];
  if (!limite.mimes.includes(normalizado)) {
    return {
      reason: 'mime',
      message: kind === 'file'
        ? 'Solo se admiten PDF.'
        : `Formato de imagen no admitido. Se admiten: ${limite.mimes.join(', ')}.`,
    };
  }

  if (!Number.isFinite(size) || size <= 0) {
    return { reason: 'size', message: 'No se puede determinar el tamaño del fichero.' };
  }
  if (size > limite.maxBytes) {
    return {
      reason: 'size',
      message: `Supera el máximo de ${Math.round(limite.maxBytes / 1024 / 1024)} MB.`,
    };
  }
  return null;
}

/**
 * Los primeros bytes que DEBE tener un fichero para ser lo que dice ser.
 *
 * Es la contrapartida de `validateAttachmentUpload`: aquella cree al cliente,
 * esta lo comprueba. El host lee esos bytes del objeto ya subido y, si no casan,
 * lo borra. Sin esto, el «solo PDF» es una sugerencia — la extensión y el
 * `Content-Type` los pone quien sube.
 */
export const MAGIC_BYTES: Readonly<Record<string, readonly number[]>> = {
  'application/pdf': [0x25, 0x50, 0x44, 0x46],              // %PDF
  'image/jpeg':      [0xff, 0xd8, 0xff],
  'image/png':       [0x89, 0x50, 0x4e, 0x47],              // \x89PNG
  'image/gif':       [0x47, 0x49, 0x46, 0x38],              // GIF8
  // WebP es RIFF....WEBP: los bytes 8-11 son los que identifican, no los primeros.
  'image/webp':      [0x52, 0x49, 0x46, 0x46],              // RIFF
};

/** Cuántos bytes hay que leer del objeto para poder comprobar cualquier firma. */
export const MAGIC_BYTES_NEEDED = 12;

/**
 * ¿El contenido real casa con el mime declarado? `head` son los primeros bytes
 * del objeto. Un mime sin firma conocida devuelve `false`: preferimos borrar un
 * fichero legítimo a aceptar uno que no sabemos identificar.
 */
export function matchesMagicBytes(mime: string, head: Uint8Array | number[]): boolean {
  const normalizado = String(mime ?? '').trim().toLowerCase().split(';')[0];
  const firma = MAGIC_BYTES[normalizado];
  if (!firma) return false;
  if (head.length < firma.length) return false;
  for (let i = 0; i < firma.length; i++) if (head[i] !== firma[i]) return false;
  // WebP: RIFF es un contenedor genérico (también .wav). El formato real está en
  // los bytes 8..11, así que sin comprobarlos un audio pasaría por imagen.
  if (normalizado === 'image/webp') {
    const webp = [0x57, 0x45, 0x42, 0x50];                  // WEBP
    if (head.length < 12) return false;
    for (let i = 0; i < 4; i++) if (head[8 + i] !== webp[i]) return false;
  }
  return true;
}

/**
 * ¿Cabe otra publicación fijada en el canal? `currentPinnedCount` NO debe incluir
 * el post que se está fijando. Un valor no finito o negativo se trata como 0:
 * ante un contador roto, preferimos dejar fijar a bloquear al usuario.
 */
export function canPinAnother(currentPinnedCount: number): boolean {
  const n = Number.isFinite(currentPinnedCount) ? Math.max(0, Math.trunc(currentPinnedCount)) : 0;
  return n < COMMUNITY_LIMITS.pinnedPerChannel.max;
}

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

/** ¿Es un `kind` de adjunto que este SDK sabe validar y pintar? */
export function isKnownAttachment(a: PostAttachment | null | undefined): boolean {
  return !!a && (ATTACHMENT_KINDS as readonly string[]).includes((a as any).kind);
}

/**
 * Los adjuntos que el host sabe tratar. Un cliente antiguo que reciba un `kind`
 * futuro lo descarta con esto en vez de intentar pintarlo.
 */
export function knownAttachments(attachments: PostAttachment[] | null | undefined): PostAttachment[] {
  return (attachments ?? []).filter(isKnownAttachment);
}

/**
 * ¿Viene algún adjunto con un `kind` que no reconocemos?
 *
 * Existe porque LEER y CREAR piden lo contrario: al leer hay que tolerar lo
 * desconocido (un cliente viejo no debe dar por rota una publicación nueva),
 * pero al CREAR hay que rechazarlo — si no, cualquiera podría guardar adjuntos
 * arbitrarios que ningún host valida. `validatePost` tolera; el backend usa
 * ESTO en la puerta de entrada.
 */
export function hasUnknownAttachments(attachments: PostAttachment[] | null | undefined): boolean {
  return (attachments ?? []).some(a => !isKnownAttachment(a));
}

/**
 * Dominio legible de un enlace, para pintarlo SIN visitar la URL.
 *
 * Que el servidor no salga a buscar la página es justamente lo que evita la
 * familia de agujeros SSRF (pedir por nosotros a una IP interna o al endpoint
 * de metadatos de la nube). Devuelve `null` si no es un enlace http/https
 * válido — y ojo, eso incluye `javascript:` y `data:`, que puestos en un href
 * son XSS directo.
 */
export function linkDomain(url: string | null | undefined): string | null {
  try {
    const u = new URL(String(url ?? ''));
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
    return u.hostname.replace(/^www\./, '') || null;
  } catch {
    return null;
  }
}

/** Valida UN adjunto según su variante. Un `kind` desconocido no genera issue. */
function validateAttachment(a: PostAttachment | null | undefined, i: number): CommunityIssue[] {
  const out: CommunityIssue[] = [];
  const at = `attachments[${i}]`;
  if (!a || typeof (a as any).kind !== 'string') {
    out.push({ field: at, message: 'Adjunto sin tipo (kind).' });
    return out;
  }
  // Tolerancia hacia adelante: un `kind` que no conocemos NO invalida el post.
  // Sin esto, el día que se añada `card-ref` un cliente viejo daría por corrupta
  // la publicación entera en vez de mostrar el resto.
  if (!isKnownAttachment(a)) return out;

  switch (a.kind) {
    case 'image':
      if (typeof a.key !== 'string' || a.key.trim() === '')
        out.push({ field: `${at}.key`, message: 'Adjunto sin referencia de imagen (key).' });
      break;

    case 'file': {
      if (typeof a.key !== 'string' || a.key.trim() === '')
        out.push({ field: `${at}.key`, message: 'Adjunto sin referencia de fichero (key).' });
      if (!COMMUNITY_LIMITS.file.mimes.includes(a.mime))
        out.push({ field: `${at}.mime`, message: 'Solo se admiten ficheros PDF.' });
      if (typeof a.size !== 'number' || !Number.isFinite(a.size) || a.size <= 0)
        out.push({ field: `${at}.size`, message: 'Falta el tamaño del fichero.' });
      else if (a.size > COMMUNITY_LIMITS.file.maxBytes)
        out.push({
          field: `${at}.size`,
          message: `El fichero no puede superar ${Math.round(COMMUNITY_LIMITS.file.maxBytes / (1024 * 1024))} MB.`,
        });
      break;
    }

    case 'album-ref':
      if (typeof a.albumId !== 'string' || a.albumId.trim() === '')
        out.push({ field: `${at}.albumId`, message: 'La referencia necesita el álbum.' });
      break;

    case 'link':
      // Se valida la FORMA aquí; que el destino exista no se comprueba a
      // propósito (implicaría que el servidor visite la URL).
      if (linkDomain(a.url) === null)
        out.push({ field: `${at}.url`, message: 'El enlace debe ser una URL http o https válida.' });
      break;
  }
  return out;
}

/**
 * Valida un post (publicación o edición). Un post necesita **cuerpo O al menos un
 * adjunto** (no puede estar vacío). Valida referencias de autor/canal, longitud del
 * cuerpo, cada adjunto según su variante y las reacciones (emoji del set, sin duplicar).
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
    issues.push({ field: 'attachments', message: `Máximo ${COMMUNITY_LIMITS.postAttachments.max} adjuntos por post.` });
  attachments.forEach((a, i) => issues.push(...validateAttachment(a, i)));
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
