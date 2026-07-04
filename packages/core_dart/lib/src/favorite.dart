/// KRO-129 — carta anclada como FAVORITA por un coleccionista. Espejo de
/// `favorite.ts`. Registro transversal a TODA la colección (no por álbum): el
/// coleccionista fija cartas de cualquier álbum y arma su galería/escaparate. El
/// backend persiste; la app Flutter es la UI. DATA → NO bumpea el KRP.
library;

/// Referencia estable a una carta dentro de un álbum.
class FavoriteCardRef {
  final String albumId;

  /// Índice/clave de la carta dentro del álbum (= `CardIdentity.cardIndex`,
  /// String o num).
  final Object cardIndex;

  const FavoriteCardRef({required this.albumId, required this.cardIndex});

  factory FavoriteCardRef.fromJson(Map<String, dynamic> j) => FavoriteCardRef(
        albumId: (j['albumId'] ?? '').toString(),
        cardIndex: j['cardIndex'] ?? '',
      );

  Map<String, dynamic> toJson() => {'albumId': albumId, 'cardIndex': cardIndex};
}

/// Una carta favorita de un usuario.
class Favorite {
  final String id;
  final String userId;
  final String albumId;
  final Object cardIndex;

  /// Orden manual en el escaparate (curaduría); menor = antes. Default 0.
  final int? order;
  final String? createdAt;

  const Favorite({
    required this.id,
    required this.userId,
    required this.albumId,
    required this.cardIndex,
    this.order,
    this.createdAt,
  });

  factory Favorite.fromJson(Map<String, dynamic> j) => Favorite(
        id: (j['id'] ?? j['_id'] ?? '').toString(),
        userId: (j['userId'] ?? '').toString(),
        albumId: (j['albumId'] ?? '').toString(),
        cardIndex: j['cardIndex'] ?? '',
        order: (j['order'] as num?)?.toInt(),
        createdAt: j['createdAt'] as String?,
      );

  Map<String, dynamic> toJson() => {
        'id': id,
        'userId': userId,
        'albumId': albumId,
        'cardIndex': cardIndex,
        if (order != null) 'order': order,
        if (createdAt != null) 'createdAt': createdAt,
      };
}

/// Clave estable de una carta (albumId + cardIndex) para deduplicar/consultar
/// favoritos. Determinista y cross-host: el backend la usa como índice único y la
/// app para saber si una carta ya está en favoritos. `cardIndex` → String. Espejo
/// de `favoriteKey`.
String favoriteKey(String albumId, Object cardIndex) => '$albumId::$cardIndex';
