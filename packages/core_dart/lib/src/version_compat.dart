/// Compatibilidad de protocolo en runtime — lo que la app Flutter usa al cargar
/// un album para decidir si puede renderizarlo o debe caer en fallback.
///
/// (En TS el `PROTOCOL_VERSION` se lee de package.json; aqui se hardcodea y el
/// drift-CI (KRO-64) vigila que matchee. `isCompatible` es NUEVO de KRO-65 —
/// no existia helper equivalente en el TS todavia.)

/// Version del protocolo de ESTE paquete. DEBE matchear @kromia/core
/// (packages/core/package.json#version, de donde el TS deriva PROTOCOL_VERSION).
/// El script de paridad (KRO-64) lo verifica: si difiere de la versión del
/// paquete, la app rechazaría como "incompatible" álbumes/QRs del protocolo actual.
const String protocolVersion = '5.1.0';

/// SemVer parseado (major.minor.patch). Ignora sufijos (-beta, +build).
class Semver {
  final int major;
  final int minor;
  final int patch;
  const Semver(this.major, this.minor, this.patch);

  static final RegExp _re = RegExp(r'^\s*(\d+)\.(\d+)\.(\d+)');

  /// Parsea una version. Lanza [FormatException] si no es SemVer valido.
  static Semver parse(String v) {
    final m = _re.firstMatch(v);
    if (m == null) {
      throw FormatException('Version SemVer invalida: "$v"');
    }
    return Semver(
      int.parse(m.group(1)!),
      int.parse(m.group(2)!),
      int.parse(m.group(3)!),
    );
  }

  @override
  String toString() => '$major.$minor.$patch';
}

/// Compara dos versiones SemVer. <0 si a<b, 0 si iguales, >0 si a>b.
int compareSemver(String a, String b) {
  final pa = Semver.parse(a);
  final pb = Semver.parse(b);
  if (pa.major != pb.major) return pa.major - pb.major;
  if (pa.minor != pb.minor) return pa.minor - pb.minor;
  return pa.patch - pb.patch;
}

/// ¿Un cliente en [clientVersion] puede renderizar un album creado con
/// [albumVersion]?
///
/// Politica MAJOR-based: compatible mientras `client.major >= album.major`.
///  - major bump = breaking (formas nuevas que un cliente viejo no entiende →
///    debe caer en fallback render + banner "actualiza la app").
///  - minor/patch = aditivos (el cliente ignora entidades desconocidas sin
///    romper) → siguen compatibles.
///  - album con major MENOR que el cliente = album viejo, cliente nuevo →
///    compatible (backward-compat del render).
///
/// [clientVersion] por defecto = [protocolVersion] (la version de este paquete).
bool isCompatible(String albumVersion, [String? clientVersion]) {
  final client = Semver.parse(clientVersion ?? protocolVersion);
  final album = Semver.parse(albumVersion);
  return album.major <= client.major;
}
