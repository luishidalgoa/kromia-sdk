/// KRO-265 / KRO-272 — espejo Dart del contrato de COMUNIDAD (`community.ts`).
///
/// Lado LECTOR (el que consume la app del coleccionista): canales, posts,
/// adjuntos y reacciones. La creación/moderación vive en Studio, así que aquí no
/// se espeja `validatePost`/`validateChannel` — solo lo que el host necesita
/// para PINTAR y para reaccionar.
///
/// Paquete Dart PURO (sin `dart:ui`): los colores/estilos son cosa del host.
library;

/// Tipos de canal (`CHANNEL_KINDS`).
const List<String> channelKinds = ['announcements', 'discussion', 'events'];

/// Visibilidades (`CHANNEL_VISIBILITIES`). El backend ya FILTRA por ellas: un
/// canal sin acceso no llega al cliente (el wireframe es explícito: no se pinta
/// "bloqueado", simplemente no aparece).
const List<String> channelVisibilities = ['public', 'collectors', 'followers'];

/// Un canal del muro de un publisher.
class Channel {
  final String id;
  final String publisherId;
  final String name;
  final String slug;
  final String kind;
  final String visibility;
  final String? description;
  final int order;

  /// Archivado: sigue VISIBLE en solo-lectura; no acepta posts nuevos.
  final bool archived;

  /// ¿Se puede reaccionar? Ausente = SÍ (retro-compat). Es propiedad del CANAL,
  /// no del post — ver [reactionsAllowed].
  final bool? reactionsEnabled;

  /// ¿Publicar avisa a los seguidores? Ausente = SÍ. Ver [notifiesFollowers].
  final bool? notifyFollowers;

  /// Soft-delete (tombstone).
  final String? deletedAt;

  /// Nº de publicaciones (lo añade el endpoint de listado del publisher).
  final int? postCount;

  const Channel({
    required this.id,
    required this.publisherId,
    required this.name,
    required this.slug,
    this.kind = 'announcements',
    this.visibility = 'public',
    this.description,
    this.order = 0,
    this.archived = false,
    this.reactionsEnabled,
    this.notifyFollowers,
    this.deletedAt,
    this.postCount,
  });

  factory Channel.fromJson(Map<String, dynamic> json) => Channel(
        id: (json['id'] ?? json['_id'])?.toString() ?? '',
        publisherId: json['publisherId']?.toString() ?? '',
        name: json['name']?.toString() ?? '',
        slug: json['slug']?.toString() ?? '',
        kind: json['kind']?.toString() ?? 'announcements',
        visibility: json['visibility']?.toString() ?? 'public',
        description: json['description']?.toString(),
        order: (json['order'] as num?)?.toInt() ?? 0,
        archived: json['archived'] == true,
        reactionsEnabled: json['reactionsEnabled'] as bool?,
        notifyFollowers: json['notifyFollowers'] as bool?,
        deletedAt: json['deletedAt']?.toString(),
        postCount: (json['postCount'] as num?)?.toInt(),
      );
}

// ── Adjuntos (unión discriminada por `kind`) ─────────────────────────────────

/// Base de los adjuntos. Un `kind` DESCONOCIDO no invalida el post: se ignora al
/// pintar (leer tolera, crear no — la verja de creación vive en el backend).
sealed class PostAttachment {
  const PostAttachment();

  /// Devuelve `null` si el `kind` no es de los conocidos ([attachmentKinds]).
  static PostAttachment? fromJson(Map<String, dynamic> json) {
    switch (json['kind']?.toString()) {
      case 'image':
        return PostImageAttachment(
          key: json['key']?.toString() ?? '',
          width: (json['width'] as num?)?.toInt(),
          height: (json['height'] as num?)?.toInt(),
          alt: json['alt']?.toString(),
        );
      case 'file':
        return PostFileAttachment(
          key: json['key']?.toString() ?? '',
          mime: json['mime']?.toString() ?? '',
          size: (json['size'] as num?)?.toInt() ?? 0,
          name: json['name']?.toString(),
        );
      case 'album-ref':
        return PostAlbumRefAttachment(albumId: json['albumId']?.toString() ?? '');
      case 'link':
        return PostLinkAttachment(url: json['url']?.toString() ?? '');
      case 'location':
        // OJO (aviso de backend): que el `kind` esté permitido NO basta — los
        // CAMPOS tienen que leerse uno a uno. En su Mongoose, `location` pasaba
        // la validación y el subesquema descartaba label/address/lat/lng EN
        // SILENCIO: la tarjeta se guardaba vacía sin un solo error.
        return PostLocationAttachment(
          label: json['label']?.toString() ?? '',
          address: json['address']?.toString(),
          lat: (json['lat'] as num?)?.toDouble(),
          lng: (json['lng'] as num?)?.toDouble(),
        );
      default:
        return null; // kind desconocido → se ignora, no rompe el muro
    }
  }
}

/// Imagen subida por el publisher (se sirve por el proxy de medios).
class PostImageAttachment extends PostAttachment {
  final String key;
  final int? width;
  final int? height;
  final String? alt;
  const PostImageAttachment({required this.key, this.width, this.height, this.alt});
}

/// Fichero adjunto. Whitelist ESTRICTA (hoy solo PDF, ver [communityLimits]).
class PostFileAttachment extends PostAttachment {
  final String key;
  final String mime;

  /// Bytes.
  final int size;
  final String? name;
  const PostFileAttachment({
    required this.key,
    required this.mime,
    required this.size,
    this.name,
  });
}

/// Referencia a un álbum del PROPIO publisher; el host pinta la tarjeta.
class PostAlbumRefAttachment extends PostAttachment {
  final String albumId;
  const PostAlbumRefAttachment({required this.albumId});
}

/// Enlace externo. V1 muestra SOLO el dominio — el servidor no visita la URL
/// (sin previsualización: evita SSRF, cuelgues y exponer la IP del servidor).
class PostLinkAttachment extends PostAttachment {
  final String url;
  const PostLinkAttachment({required this.url});

  /// Dominio a mostrar (sin `www.`). Cadena vacía si la URL no es parseable.
  String get domain {
    final u = Uri.tryParse(url);
    final h = u?.host ?? '';
    return h.startsWith('www.') ? h.substring(4) : h;
  }
}

/// Ubicación de un evento o tienda. `label` es lo ÚNICO obligatorio: "la tienda
/// de Paco" ubica más que unas coordenadas sueltas.
class PostLocationAttachment extends PostAttachment {
  final String label;
  final String? address;

  /// Coordenadas: van JUNTAS o ninguna (media coordenada no ubica nada, y el
  /// host no sabría si ofrecer abrir el mapa). El backend rechaza el par a
  /// medias; aquí se comprueba igual antes de usarlas.
  final double? lat;
  final double? lng;

  const PostLocationAttachment({
    required this.label,
    this.address,
    this.lat,
    this.lng,
  });

  bool get hasCoords => lat != null && lng != null && lat!.isFinite && lng!.isFinite;
}

const List<String> attachmentKinds = [
  'image',
  'file',
  'album-ref',
  'link',
  'location',
];

/// Enlace para ABRIR la ubicación, espejo de `mapLinkFor`.
///
/// SIEMPRE `https://`, un único camino para las tres plataformas. El intento
/// anterior devolvía `geo:` con coordenadas —para que el sistema ofreciera la
/// app de mapas del usuario—, pero `geo:` es un esquema de ANDROID: en iOS no
/// hay ninguna app registrada, así que al pulsar NO PASABA NADA (QA en iPhone).
/// Lo irónico es que el caso con MENOS información —solo texto, sin
/// coordenadas— sí funcionaba, porque ese ya usaba `https`.
///
/// Con coordenadas se busca por `lat,lng` y NO por el nombre: la chincheta cae
/// en el punto exacto, mientras que buscar "La tienda de Paco" puede acabar en
/// otra ciudad. Se pierde poder elegir otra app de mapas y a cambio el enlace
/// funciona de verdad — que era lo que se prometía y no se cumplía.
///
/// `null` si no hay nada que abrir, para no pintar un enlace muerto.
String? mapLinkFor(PostLocationAttachment? a) {
  if (a == null) return null;
  final consulta = a.hasCoords
      ? '${a.lat},${a.lng}'
      : [a.label, a.address]
          .map((v) => v?.trim())
          .where((v) => v != null && v.isNotEmpty)
          .join(', ');
  if (consulta.isEmpty) return null;
  return 'https://www.google.com/maps/search/?api=1&query=${Uri.encodeComponent(consulta)}';
}

// ── Post + reacciones ────────────────────────────────────────────────────────

class PostReaction {
  final String emoji;
  final List<String> userIds;
  const PostReaction({required this.emoji, this.userIds = const []});

  factory PostReaction.fromJson(Map<String, dynamic> json) => PostReaction(
        emoji: json['emoji']?.toString() ?? '',
        userIds: [
          for (final u in (json['userIds'] as List? ?? const [])) u.toString(),
        ],
      );
}

class Post {
  final String id;
  final String channelId;
  final String publisherId;
  final String authorId;
  final String body;
  final List<PostAttachment> attachments;
  final List<PostReaction> reactions;
  final bool pinned;
  final String createdAt;
  final String? editedAt;
  final String? deletedAt;

  /// Autor poblado por el backend (nombre visible), si viene.
  final String? authorName;

  const Post({
    required this.id,
    required this.channelId,
    required this.publisherId,
    required this.authorId,
    this.body = '',
    this.attachments = const [],
    this.reactions = const [],
    this.pinned = false,
    this.createdAt = '',
    this.editedAt,
    this.deletedAt,
    this.authorName,
  });

  factory Post.fromJson(Map<String, dynamic> json) {
    final author = json['authorId'];
    return Post(
      id: (json['id'] ?? json['_id'])?.toString() ?? '',
      channelId: json['channelId']?.toString() ?? '',
      publisherId: json['publisherId']?.toString() ?? '',
      authorId: (author is Map ? (author['_id'] ?? author['id']) : author)?.toString() ?? '',
      body: json['body']?.toString() ?? '',
      attachments: [
        for (final a in (json['attachments'] as List? ?? const []))
          if (a is Map)
            if (PostAttachment.fromJson(a.cast<String, dynamic>()) case final att?) att,
      ],
      reactions: [
        for (final r in (json['reactions'] as List? ?? const []))
          if (r is Map) PostReaction.fromJson(r.cast<String, dynamic>()),
      ],
      pinned: json['pinned'] == true,
      createdAt: json['createdAt']?.toString() ?? '',
      editedAt: json['editedAt']?.toString(),
      deletedAt: json['deletedAt']?.toString(),
      authorName: author is Map
          ? (author['username'] ?? author['name'])?.toString()
          : json['authorName']?.toString(),
    );
  }
}

/// Set CERRADO de emojis (coherencia cross-host). Cambiarlo es cambio de
/// contrato: hay que coordinarlo con Studio y backend.
const List<String> postReactionEmojis = ['👍', '❤️', '🔥', '🎉', '👀', '😮'];

bool isValidReactionEmoji(String e) => postReactionEmojis.contains(e);

/// Nº de reacciones de un emoji en un post.
int reactionCount(Post post, String emoji) {
  for (final r in post.reactions) {
    if (r.emoji == emoji) return r.userIds.length;
  }
  return 0;
}

/// ¿Reaccionó [userId] con ese emoji?
bool hasReacted(Post post, String emoji, String userId) {
  for (final r in post.reactions) {
    if (r.emoji == emoji && r.userIds.contains(userId)) return true;
  }
  return false;
}

/// ¿Eliminado (soft-delete)? Vale para [Post] y [Channel].
bool isDeletedAt(String? deletedAt) => deletedAt != null;

/// ¿Se editó el cuerpo tras publicar? (sello "editado").
bool isEdited(Post post) => post.editedAt != null;

/// ¿Se puede reaccionar en este canal? Ausente = SÍ (retro-compat). Fuente única
/// para los tres hosts: el backend rechaza la reacción Y la UI oculta la fila
/// entera (el wireframe: "nada que insinúe que existieron").
bool reactionsAllowed(Channel? channel) => channel?.reactionsEnabled != false;

/// ¿Publicar en este canal avisa a los seguidores? Ausente = SÍ.
bool notifiesFollowers(Channel? channel) => channel?.notifyFollowers != false;

/// Límites de contrato. Fuente ÚNICA — no re-declarar en los hosts.
const ({
  ({int min, int max}) channelName,
  ({int max}) postBody,
  ({int max}) postAttachments,
  ({int maxBytes, List<String> mimes}) file,
  ({int max}) pinnedPerChannel,
}) communityLimits = (
  channelName: (min: 1, max: 60),
  postBody: (max: 2000),
  postAttachments: (max: 10),
  file: (maxBytes: 60 * 1024 * 1024, mimes: ['application/pdf']),
  pinnedPerChannel: (max: 3),
);
