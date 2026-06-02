/// `schema_version.dart` — espejo 1:1 de `schema-version.ts` (@kromia/core, KRO-115).
///
/// Un schema (CardSchema/AlbumSchema) se ESTAMPA al crearse con el
/// `protocolVersion` del core de ese momento (`coreVersion`). Esto permite saber
/// si un schema (o el álbum que lo referencia) está DESACTUALIZADO frente al core
/// actual. Eje NUEVO, distinto del `version` del propio schema (KROM-23).
///
/// Solo un bump MAJOR del core es breaking → desactualizado = el MAJOR estampado
/// es MENOR que el actual. Puro, determinista.
library;

/// Extrae el MAJOR de un SemVer (`"2.5.1"` → 2). Tolera `"2"`. null si no parsea.
int? _majorOf(String? v) {
  if (v == null) return null;
  final m = RegExp(r'^(\d+)').firstMatch(v.trim());
  return m == null ? null : int.parse(m.group(1)!);
}

/// ¿`stamped` está DESACTUALIZADO frente a `current` (típ. `protocolVersion`)?
///  - `stamped` ausente/null/no-parseable → `false` (legacy/desconocido).
///  - `current` no-parseable              → `false` (sin referencia no marcamos).
///  - `majorOf(stamped) <  majorOf(current)` → `true`.
///  - `majorOf(stamped) >= majorOf(current)` → `false` (al día o más nuevo).
bool isSchemaOutdated(String? stamped, String current) {
  final s = _majorOf(stamped);
  final c = _majorOf(current);
  if (s == null || c == null) return false;
  return s < c;
}
