/// `media_path.dart` — KRO-132. Capa PURA del almacenamiento de medios por-álbum.
/// Espejo de `media-path.ts`. Mismas entradas → mismas rutas/slugs/cuotas que el
/// backend y Studio (anti-drift). Ground truth: `tests/media-path.test.ts`.
///
/// NOTA Dart: el TS hace `normalize('NFD') + strip \p{Diacritic}`. Dart no tiene
/// NFD nativo en dart:core → se replica con un mapa de diacríticos latinos
/// (cubre el alfabeto latino usado en nombres de álbum). Para scripts no-latinos
/// el resultado puede diferir del TS; los nombres de álbum son latinos y el slug
/// lo deduplica el caller, así que es seguro en la práctica.
library;

// ── Cuota (política compartida) ──────────────────────────────────────────────

/// Límite duro de almacenamiento por álbum: 400 MB (TS `ALBUM_MEDIA_QUOTA_BYTES`).
const int albumMediaQuotaBytes = 400 * 1024 * 1024;

/// Nº de álbumes "de cupo" que cubre el agregado por dueño (`OWNER_MEDIA_ALBUM_ALLOWANCE`).
const int ownerMediaAlbumAllowance = 6;

/// Agregado por dueño (usuario u organización): ~2,4 GB (`OWNER_MEDIA_QUOTA_BYTES`).
const int ownerMediaQuotaBytes = albumMediaQuotaBytes * ownerMediaAlbumAllowance;

// ── Slug ─────────────────────────────────────────────────────────────────────

/// Diacríticos latinos → letra base (tras `toLowerCase`). Espeja el strip NFD
/// del TS para el rango latino.
const Map<String, String> _diacritics = {
  'à': 'a', 'á': 'a', 'â': 'a', 'ã': 'a', 'ä': 'a', 'å': 'a', 'ā': 'a',
  'è': 'e', 'é': 'e', 'ê': 'e', 'ë': 'e', 'ē': 'e',
  'ì': 'i', 'í': 'i', 'î': 'i', 'ï': 'i', 'ī': 'i',
  'ò': 'o', 'ó': 'o', 'ô': 'o', 'õ': 'o', 'ö': 'o', 'ø': 'o', 'ō': 'o',
  'ù': 'u', 'ú': 'u', 'û': 'u', 'ü': 'u', 'ū': 'u',
  'ñ': 'n', 'ç': 'c', 'ý': 'y', 'ÿ': 'y', 'š': 's', 'ž': 'z',
};

final RegExp _nonAlnum = RegExp(r'[^a-z0-9]+');
final RegExp _trimDashes = RegExp(r'^-+|-+$');

/// Slugify determinista: minúsculas, sin acentos, no-alfanuméricos → guion,
/// guiones recortados en los extremos. `slugify('Semana Santa Córdoba')` →
/// `'semana-santa-cordoba'`.
String slugify(String text) {
  final lower = text.toLowerCase();
  final buf = StringBuffer();
  for (final rune in lower.runes) {
    final ch = String.fromCharCode(rune);
    buf.write(_diacritics[ch] ?? ch);
  }
  return buf
      .toString()
      .replaceAll(_nonAlnum, '-')
      .replaceAll(_trimDashes, '');
}

/// Slug de la carpeta de un álbum: la edición es una SUB-carpeta del nombre →
/// `{nombre-slug}/{edición-slug}` (o solo `{nombre-slug}` sin edición). Fallback
/// a `'album'` si el nombre no es slugificable.
String slugifyAlbumName(String name, [String? edition]) {
  final nameSlug = slugify(name).isEmpty ? 'album' : slugify(name);
  final ed = (edition != null && edition.trim().isNotEmpty) ? slugify(edition) : '';
  return ed.isNotEmpty ? '$nameSlug/$ed' : nameSlug;
}

/// Slug RESERVADO de la carpeta de medios de un borrador del wizard (TS
/// `DRAFT_MEDIA_SLUG`). El prefijo `__` nunca lo produce `slugify` → no colisiona.
const String draftMediaSlug = '__draft';

// ── Ruta del bucket ──────────────────────────────────────────────────────────

/// Raíz de medios de un álbum. Espejo de `AlbumMediaRoot`.
class AlbumMediaRoot {
  /// username del dueño (raíz si es independiente).
  final String ownerUsername;

  /// slug de la organización dueña, si pertenece a una (gana la raíz).
  final String? orgSlug;

  const AlbumMediaRoot({required this.ownerUsername, this.orgSlug});
}

/// Namespace raíz del álbum en el bucket: la organización si pertenece a una, si
/// no el usuario dueño. Centraliza "la org gana la raíz".
String albumMediaNamespace(AlbumMediaRoot root) {
  final org = root.orgSlug?.trim();
  return (org != null && org.isNotEmpty) ? org : root.ownerUsername;
}

/// Prefijo canónico del directorio de un álbum en el bucket, con `/` final.
/// `albumMediaPrefix(ownerUsername:'ana', albumSlug:'liga-2025')` → `'ana/liga-2025/'`.
String albumMediaPrefix({
  required String ownerUsername,
  String? orgSlug,
  required String albumSlug,
}) {
  final ns = albumMediaNamespace(
      AlbumMediaRoot(ownerUsername: ownerUsername, orgSlug: orgSlug));
  return '$ns/$albumSlug/';
}
