/**
 * KRO-129 — carta anclada como FAVORITA por un coleccionista.
 *
 * Registro transversal a TODA la colección del usuario (no por álbum): el
 * coleccionista fija cartas de cualquier álbum y con ellas arma su galería /
 * escaparate. El backend persiste; la app Flutter es la UI (anclar desde el modo
 * focus + pantalla de escaparate). DATA (registro por usuario) → **no bumpea el
 * KRP**. Studio no participa (feature de coleccionista, no de publisher).
 */

/** Referencia estable a una carta dentro de un álbum. */
export interface FavoriteCardRef {
  albumId:   string;
  /** Índice/clave de la carta dentro del álbum (igual que `CardIdentity.cardIndex`). */
  cardIndex: string | number;
}

/** Una carta favorita de un usuario. */
export interface Favorite extends FavoriteCardRef {
  id:         string;
  userId:     string;
  /** Orden manual en el escaparate (curaduría); menor = antes. Default 0. */
  order?:     number;
  createdAt?: string;
}

/**
 * Clave estable de una carta para deduplicar/consultar favoritos (albumId +
 * cardIndex). Determinista y cross-host: el backend la usa como índice único y
 * la app la usa para saber si una carta ya está en favoritos sin recorrer el
 * objeto. `cardIndex` se normaliza a String.
 */
export function favoriteKey(albumId: string, cardIndex: string | number): string {
  return `${albumId}::${String(cardIndex)}`;
}
