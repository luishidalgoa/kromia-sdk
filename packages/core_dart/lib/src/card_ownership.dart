/// KRO-215 — Cartas físicas: identidad + propiedad (tronco SDK-first). DATA (NO
/// entra al `.json` del KRP → no bumpea PROTOCOL_VERSION; igual que CardBack).
/// Espejo 1:1 de `types.ts` (§KRO-215) + `card-ownership.ts`. El minteo, la FIRMA
/// y los endpoints scan/transfer viven en el backend; el escaneo de cámara y los
/// badges en Flutter. Nada lo consume hasta KRO-16 — evita acumular drift.
/// Spec: docs/physical-cards-foundation-spec.md.
library;

/// Origen de la propiedad de una carta. `qr` = verificada; el resto = declarada.
const Set<String> ownershipSources = {'qr', 'manual', 'code', 'photo'};

/// Identidad de UNA instancia física (rama `qr`). Se mintea en fabricación
/// (KRO-216) y se siembra sin dueño; KRO-16 la valida en cada escaneo.
class CardIdentity {
  /// Token único OPACO = el contenido firmado del QR.
  final String id;
  final String albumId;

  /// Qué carta del álbum es esta instancia (String | num).
  final Object cardIndex;

  /// Nº legible de tirada opcional, p.ej. "0123/5000".
  final String? serial;

  /// ISO — minteado en fabricación.
  final String mintedAt;

  const CardIdentity({
    required this.id,
    required this.albumId,
    required this.cardIndex,
    this.serial,
    required this.mintedAt,
  });

  factory CardIdentity.fromJson(Map<String, dynamic> j) => CardIdentity(
        id: (j['id'] ?? '').toString(),
        albumId: (j['albumId'] ?? '').toString(),
        cardIndex: j['cardIndex'] ?? '',
        serial: j['serial'] as String?,
        mintedAt: (j['mintedAt'] ?? '').toString(),
      );
}

/// Propiedad de una carta (compartida por ambas ramas, qr y self-declared).
/// Evolución backward-compatible de `ownedCards = [{index, quantity}]`, que se
/// lee como `{ source:'manual', verified:false }` SIN migración (ver
/// [CardOwnership.fromLegacyOwnedCard]).
class CardOwnership {
  final String userId;
  final String albumId;
  final Object cardIndex;

  /// `OwnershipSource`: 'qr' | 'manual' | 'code' | 'photo'.
  final String source;

  /// `true` SOLO si `source=='qr'` y la identidad valida (DERIVADO en backend,
  /// nunca auto-declarable).
  final bool verified;

  /// self-declared puede ser >1; `qr` = 1 por identidad.
  final int quantity;

  /// FK a `CardIdentity` (solo `source=='qr'`).
  final String? identityId;

  /// ISO.
  final String acquiredAt;

  /// self-declared: foto del coleccionista (sugerencia).
  final String? photoUrl;

  const CardOwnership({
    required this.userId,
    required this.albumId,
    required this.cardIndex,
    required this.source,
    required this.verified,
    required this.quantity,
    this.identityId,
    required this.acquiredAt,
    this.photoUrl,
  });

  factory CardOwnership.fromJson(Map<String, dynamic> j) => CardOwnership(
        userId: (j['userId'] ?? '').toString(),
        albumId: (j['albumId'] ?? '').toString(),
        cardIndex: j['cardIndex'] ?? '',
        source: (j['source'] as String?) ?? 'manual',
        verified: j['verified'] as bool? ?? false,
        quantity: (j['quantity'] as num?)?.toInt() ?? 1,
        identityId: j['identityId'] as String?,
        acquiredAt: (j['acquiredAt'] ?? '').toString(),
        photoUrl: j['photoUrl'] as String?,
      );

  /// Lee una entrada legacy `ownedCards[{index, quantity}]` como propiedad
  /// self-declared (`source:'manual', verified:false`), SIN migración.
  factory CardOwnership.fromLegacyOwnedCard({
    required String userId,
    required String albumId,
    required Object cardIndex,
    int quantity = 1,
    String acquiredAt = '',
  }) =>
      CardOwnership(
        userId: userId,
        albumId: albumId,
        cardIndex: cardIndex,
        source: 'manual',
        verified: false,
        quantity: quantity,
        acquiredAt: acquiredAt,
      );
}

/// Token efímero para transferir una carta verificada entre dueños (rama `qr`,
/// KRO-16). A lo genera → B escanea + reclama dentro del TTL → la propiedad se
/// mueve A→B.
class TransferToken {
  final String id;
  final String identityId;
  final String fromUserId;
  final String createdAt;
  final String expiresAt;

  const TransferToken({
    required this.id,
    required this.identityId,
    required this.fromUserId,
    required this.createdAt,
    required this.expiresAt,
  });

  factory TransferToken.fromJson(Map<String, dynamic> j) => TransferToken(
        id: (j['id'] ?? '').toString(),
        identityId: (j['identityId'] ?? '').toString(),
        fromUserId: (j['fromUserId'] ?? '').toString(),
        createdAt: (j['createdAt'] ?? '').toString(),
        expiresAt: (j['expiresAt'] ?? '').toString(),
      );
}

/// Payload del QR firmado de carta (permanente, por-instancia, verificación
/// pública asimétrica). La FIRMA la pone el backend con la clave privada;
/// cualquiera la verifica con la pública (Flutter, offline).
class CardQrPayload {
  /// Versión del esquema del payload (para evolución).
  final int v;

  /// Siempre 'card-identity'.
  final String kind;

  /// Identidad opaca de la instancia (= `CardIdentity.id`).
  final String id;
  final String albumId;
  final Object cardIndex;
  final String? serial;

  /// Firma criptográfica del resto del payload (base64/base64url).
  final String sig;

  const CardQrPayload({
    required this.v,
    this.kind = 'card-identity',
    required this.id,
    required this.albumId,
    required this.cardIndex,
    this.serial,
    required this.sig,
  });

  factory CardQrPayload.fromJson(Map<String, dynamic> j) => CardQrPayload(
        v: (j['v'] as num?)?.toInt() ?? 1,
        kind: (j['kind'] as String?) ?? 'card-identity',
        id: (j['id'] ?? '').toString(),
        albumId: (j['albumId'] ?? '').toString(),
        cardIndex: j['cardIndex'] ?? '',
        serial: j['serial'] as String?,
        sig: (j['sig'] ?? '').toString(),
      );

  Map<String, dynamic> toJson() => {
        'v': v,
        'kind': kind,
        'id': id,
        'albumId': albumId,
        'cardIndex': cardIndex,
        if (serial != null) 'serial': serial,
        'sig': sig,
      };
}

/// Verificada vs Declarada — el "nivel de confianza" visible de una carta.
/// `verified` = `source=='qr'` y la identidad validó; `declared` = el resto
/// (manual/código/foto, NO es anti-fraude). Espejo de `ownershipBadge`.
String ownershipBadge(CardOwnership o) =>
    (o.source == 'qr' && o.verified) ? 'verified' : 'declared';

/// ¿La propiedad está verificada por QR (no solo declarada)? Azúcar sobre
/// [ownershipBadge].
bool isVerifiedOwnership(CardOwnership o) => ownershipBadge(o) == 'verified';
